/**
 * app/services/suggestions/aiSuggestions.ts
 *
 * AI-powered suggestion generation using OpenRouter.
 *
 * Builds a compact garden-state context (targeting ~800 input tokens),
 * sends it to the AI, parses and validates the response, then maps
 * raw AI suggestions to typed AISuggestionResult objects.
 *
 * AI is PROHIBITED from generating: water, weed, harvest, fertilize, no_water
 * — those are owned by the rules engine.
 */

import { OpenRouterClient, MODEL_CHAIN } from "../ai/openrouter";
import { RateLimiter } from "../ai/rateLimiter";
import type {
  RuleContext,
  AISuggestionContext,
  AISuggestionResult,
  RawAISuggestion,
} from "./types";
import { getCachedAISuggestions, cacheAISuggestions } from "./suggestionsCache";
import type { Plant, Settings, SuggestionType } from "../../data/schema";
import type { SuggestionResult } from "./types";

// Backend proxy URL — all AI calls are routed server-side (key never in browser)
const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;

// ---------------------------------------------------------------------------
// Rate limiter: max 3 calls per 10 minutes (per the spec)
// ---------------------------------------------------------------------------

const rateLimiter = new RateLimiter(3, 600_000);

// ---------------------------------------------------------------------------
// Allowed AI-generated suggestion types (rules engine owns the rest)
// ---------------------------------------------------------------------------

const AI_ALLOWED_TYPES: SuggestionType[] = [
  "thin_seedlings",
  "harden_seedlings",
  "companion_conflict",
  "succession_sow",
  "pest_alert",
  "disease_risk",
  "end_of_season",
  "mulch",
  "prune",
  "frost_protect",
  // Also allow repot and sow from AI (supplementary context)
  "repot",
  "sow",
];

const AI_CONFIDENCE_THRESHOLD = 0.4;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a practical gardening advisor embedded in a garden planning application.
Your role is to review a garden state snapshot and return a JSON list of
actionable care suggestions for the coming 7 days.

RESPONSE FORMAT
- Return ONLY a single valid JSON object. No markdown, no code fences, no prose.
- The object must have exactly one key: "suggestions" (array).
- Limit to a maximum of 12 suggestions. If fewer than 12 are genuinely warranted,
  return only those. Do not pad with low-value suggestions.

SUGGESTION PRINCIPLES
- Prefer non-obvious advice: companion planting conflicts, pest/disease pressure
  windows, succession sowing opportunities, harvest timing nuances.
- Do NOT repeat what a basic rule engine would already catch:
  - Overdue watering when no rain is forecast
  - Harvest-window reminders derivable from planting date + daysToHarvest alone
  - Generic seasonal tips ("water more in summer")
- Each suggestion must be directly supported by at least one piece of data in
  the input context (plant name, planting date, weather reading, seedling status).
  Never invent plants or events not present in the context.
- description: one imperative sentence, ≤ 120 characters, no plant emoji.
- rationale: one internal sentence (≤ 100 chars) explaining why — for logging only,
  never displayed to the user.

CLIMATE AWARENESS
- Apply the supplied Köppen–Geiger zone and hemisphere to all timing advice.
- Month numbers in the input are 1-indexed (1 = January).
- "frost risk" means tempMinC ≤ 2 °C forecast within 7 days.

CONFIDENCE SCORES
- Include a confidence score (0.0–1.0) on every suggestion.
- Never return a suggestion with confidence < 0.40. Suppress it instead.

PRIORITY RULES
- "high": time-sensitive, risk of plant loss or missed harvest window within 48 h
- "medium": should act this week, minor consequence if delayed
- "low": informational / planning ahead

VALID SUGGESTION TYPES
thin_seedlings, harden_seedlings, companion_conflict, succession_sow, pest_alert,
disease_risk, end_of_season, mulch, prune, frost_protect, repot, sow

DO NOT generate suggestions of type: water, weed, harvest, fertilize, no_water, compost
— those are handled by the rules engine.

Return schema (JSON):
{
  "suggestions": [
    {
      "type": string,
      "plantName": string | null,
      "planterName": string | null,
      "priority": "high" | "medium" | "low",
      "description": string,
      "dueDate": string | null,
      "rationale": string,
      "confidence": number
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

export function buildAISuggestionContext(
  ctx: RuleContext,
  ruleResults: SuggestionResult[],
): AISuggestionContext {
  const today = ctx.today;
  const hemisphere: "N" | "S" = (ctx.lat ?? 45) >= 0 ? "N" : "S";

  // Weather summary
  let weatherSummary: AISuggestionContext["weather"] = null;
  if (ctx.weather) {
    const todayStr = today.toISOString().slice(0, 10);
    const todayData = ctx.weather.daily.find((d) => d.date === todayStr);
    const futureDays = ctx.weather.daily.filter((d) => d.date >= todayStr);

    weatherSummary = {
      todayTempMaxC:
        Math.round((todayData?.tempMaxC ?? ctx.weather.current.tempC) * 10) /
        10,
      todayPrecipMm:
        Math.round(
          (todayData?.precipSumMm ?? ctx.weather.current.precipMm) * 10,
        ) / 10,
      next7DaysMaxTempC: Math.max(...futureDays.map((d) => d.tempMaxC)),
      next7DaysMinTempC: Math.min(...futureDays.map((d) => d.tempMinC)),
      next7DaysTotalPrecipMm:
        Math.round(futureDays.reduce((s, d) => s + d.precipSumMm, 0) * 10) / 10,
      next7DaysPrecipProbMax: Math.max(
        ...futureDays.map((d) => d.precipProbabilityMax),
      ),
    };
  }

  // Plants (deduplicated by instanceId)
  const plants = ctx.placedPlants.map((p) => {
    let plantedDaysAgo: number | undefined;
    if (p.plantingDate) {
      plantedDaysAgo = Math.floor(
        (today.getTime() - new Date(p.plantingDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
    }
    return {
      name: p.plant.name,
      planterName: p.planterName,
      plantedDaysAgo,
      daysToHarvest: p.plant.daysToHarvest,
      harvestMonths: p.plant.harvestMonths,
      sowDirectMonths: p.plant.sowDirectMonths,
      companions: p.plant.companions,
      antagonists: p.plant.antagonists,
      adjacentPlants: p.adjacentPlantNames,
    };
  });

  // Seedlings
  const seedlings = ctx.seedlings.map((s) => ({
    name: s.plant.name,
    status: s.status,
    daysSinceSeeded: Math.floor(
      (today.getTime() - new Date(s.plantedDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  }));

  // Recent events (last 14 days)
  const recentEvents: AISuggestionContext["recentEvents"] = [];
  const cutoff = today.getTime() - 14 * 24 * 60 * 60 * 1000;
  ctx.lastEvents.forEach((typeMap, key) => {
    typeMap.forEach((date, type) => {
      if (date.getTime() >= cutoff) {
        const [planterId] = key.split(":");
        const planterName = ctx.placedPlants.find(
          (p) => p.planterId === planterId,
        )?.planterName;
        recentEvents.push({
          type,
          daysAgo: Math.floor(
            (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
          ),
          planterName,
        });
      }
    });
  });

  // Active rule suggestion keys (to avoid AI duplication)
  const activeRuleSuggestionKeys = ruleResults.map((r) => r.key);

  return {
    koeppenZone: ctx.koeppenZone,
    hemisphere,
    currentMonth: ctx.currentMonth,
    weather: weatherSummary,
    plants,
    seedlings,
    recentEvents,
    activeRuleSuggestionKeys,
  };
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseAIResponse(
  raw: unknown,
  ctx: AISuggestionContext,
  allPlants: Plant[],
): AISuggestionResult[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const suggestions = obj.suggestions;
  if (!Array.isArray(suggestions)) return [];

  const results: AISuggestionResult[] = [];

  for (const item of suggestions as RawAISuggestion[]) {
    // Confidence gate
    if (
      typeof item.confidence !== "number" ||
      item.confidence < AI_CONFIDENCE_THRESHOLD
    )
      continue;

    // Type validation
    const type = item.type as SuggestionType;
    if (!AI_ALLOWED_TYPES.includes(type)) continue;

    // Priority validation
    const priority = item.priority as AISuggestionResult["priority"];
    if (!["high", "medium", "low"].includes(priority)) continue;

    // Description validation
    if (!item.description || typeof item.description !== "string") continue;
    const description = item.description.slice(0, 120);

    // Plant matching (optional)
    let plant: Plant | undefined;
    if (item.plantName) {
      plant = allPlants.find(
        (p) => p.name.toLowerCase() === item.plantName!.toLowerCase(),
      );
    }

    // Planter matching (optional)
    let planterId: string | undefined;
    if (item.planterName) {
      const matched = ctx.plants.find(
        (p) => p.planterName.toLowerCase() === item.planterName!.toLowerCase(),
      );
      // We don't have the planter ID in the context, so we store the name and resolve later
      planterId = matched?.planterName;
    }

    // Due date validation
    let dueDate: string | undefined;
    if (item.dueDate) {
      try {
        const d = new Date(item.dueDate);
        if (!isNaN(d.getTime())) {
          dueDate = d.toISOString();
        }
      } catch {
        // ignore invalid dates
      }
    }

    results.push({
      type,
      plant,
      planterId,
      priority,
      description,
      dueDate,
      source: "ai",
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Generate AI-powered suggestions using OpenRouter.
 * Returns an empty array on any failure (non-throwing, degradation-friendly).
 */
export async function getAISuggestions(
  ctx: RuleContext,
  ruleResults: SuggestionResult[],
  settings: Settings,
  allPlants: Plant[],
  signal?: AbortSignal,
): Promise<AISuggestionResult[]> {
  if (settings.aiProvider.type === "none") return [];
  if (!settings.lat || !settings.lng) return [];
  const aiContext = buildAISuggestionContext(ctx, ruleResults);

  // Check cache first
  const cached = await getCachedAISuggestions(aiContext);
  if (cached) {
    return parseAIResponse({ suggestions: cached }, aiContext, allPlants);
  }

  // Rate limit check
  try {
    await rateLimiter.acquire();
  } catch {
    console.warn("[aiSuggestions] Rate limited — skipping AI call");
    return [];
  }

  // Build API client — always route through the backend proxy (key stays server-side)
  const client = new OpenRouterClient({
    apiKey: "",
    siteUrl: "https://gardenplanner.app",
    siteName: "Garden Planner",
    model: settings.aiModel,
    proxyUrl: API_BASE ? `${API_BASE}/api/ai/chat` : "/api/ai/chat",
  });

  const userMessage = JSON.stringify(aiContext, null, 0);

  try {
    // Try primary model, then fall through the fallback chain
    let lastError: unknown;
    for (const model of [
      settings.aiModel,
      ...MODEL_CHAIN.filter((m) => m !== settings.aiModel),
    ]) {
      try {
        const response = await client.chatCompletion(
          model,
          [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          {
            temperature: 0.3,
            maxTokens: 8192,
            responseFormat: { type: "json_object" },
            signal,
          },
        );

        const content = response.choices[0]?.message?.content;
        if (!content) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          console.warn("[aiSuggestions] Failed to parse AI response JSON");
          continue;
        }

        const results = parseAIResponse(parsed, aiContext, allPlants);

        // Cache raw suggestions for next call
        if (Array.isArray((parsed as Record<string, unknown>)?.suggestions)) {
          await cacheAISuggestions(
            aiContext,
            (parsed as { suggestions: unknown[] }).suggestions,
          );
        }

        return results;
      } catch (err) {
        lastError = err;
        console.warn(`[aiSuggestions] Model ${model} failed:`, err);
      }
    }
    console.warn("[aiSuggestions] All models failed:", lastError);
    return [];
  } catch (err) {
    console.warn("[aiSuggestions] Unexpected error:", err);
    return [];
  }
}
