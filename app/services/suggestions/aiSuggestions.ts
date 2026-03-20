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

import { OpenRouterClient } from "../ai/openrouter";
import { getAIResponseLanguage } from "../ai/locale";
import { truncate } from "../ai/prompts";
import { RateLimiter } from "../ai/rateLimiter";
import { normalizePlantReference } from "../../lib/plantReferences";
import { getPlantName } from "../../i18n/utils/plantTranslation";
import type {
  RuleContext,
  AISuggestionContext,
  AISuggestionResult,
  RawAISuggestion,
} from "./types";
import { getCachedAISuggestions, cacheAISuggestions } from "./suggestionsCache";
import type { Plant, Settings, SuggestionType } from "../../data/schema";
import type { SuggestionResult } from "./types";
import { apiUrl } from "../../lib/api";

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
- For companion_conflict, only consider plants in the same planterName.
  Never infer a proximity conflict from plants in different planters.
  Treat adjacentPlants as same-planter neighbors only.
- The input includes responseLocale and responseLanguage.
- CRITICAL: Write ALL text fields (description, rationale) entirely in responseLanguage.
  Never mix languages. If responseLanguage is Dutch, respond in Dutch. If English, respond in English.
- If a plant or seedling includes displayName fields, use those localized names
  in prose (description/rationale).
- Keep plantName and planterName in the JSON response equal to the canonical
  input name and planterName values so the application can match entities.
- description: one imperative sentence, ≤ 120 characters, no plant emoji.
- rationale: one internal sentence (≤ 100 chars) explaining why — for logging only,
  never displayed to the user.

SCOPE RULES
- Set "scope" to "area" for broad risk affecting multiple planters (frost, storm, heat stress).
  Area suggestions may mention especially sensitive plants in the description when it improves
  actionability, but the primary target must remain the whole area.
- Set "scope" to "planter" for maintenance affecting one specific planter.
- Set "scope" to "plant" for instance-specific work (harvest timing, pest treatment, pruning).
- When setting scope="area", set areaName to the area name if only plants from one area are involved;
  otherwise omit areaName.

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
      "scope": "area" | "planter" | "plant",
      "plantName": string | null,
      "planterName": string | null,
      "areaName": string | null,
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
  locale?: string,
  model?: string,
): AISuggestionContext {
  const today = ctx.today;
  const hemisphere: "N" | "S" = (ctx.lat ?? 45) >= 0 ? "N" : "S";
  const { locale: responseLocale, languageName: responseLanguage } =
    getAIResponseLanguage(locale);

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
  // Truncation here is defense-in-depth: schema .max() was added after data may
  // already exist in IndexedDB without those constraints.
  const plants = ctx.placedPlants.map((p) => {
    let plantedDaysAgo: number | undefined;
    if (p.plantingDate) {
      plantedDaysAgo = Math.floor(
        (today.getTime() - new Date(p.plantingDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
    }

    const displayName = truncate(
      getPlantName(p.plant.id, p.plant.name, responseLocale),
      80,
      "plant.displayName",
    );

    return {
      name: truncate(p.plant.name, 80, "plant.name"),
      displayName,
      areaName: truncate(p.areaName, 80, "areaName"),
      planterName: truncate(p.planterName, 80, "planterName"),
      plantedDaysAgo,
      daysToHarvest: p.plant.daysToHarvest,
      harvestMonths: p.plant.harvestMonths,
      sowDirectMonths: p.plant.sowDirectMonths,
      companions: p.plant.companions,
      antagonists: p.plant.antagonists,
      adjacentPlants: p.adjacentPlantNames,
      adjacentPlantDisplayNames: (p.adjacentPlants ?? []).map((adjacentPlant) =>
        truncate(
          getPlantName(adjacentPlant.id, adjacentPlant.name, responseLocale),
          80,
          "plant.adjacentDisplayName",
        ),
      ),
    };
  });

  // Seedlings
  const seedlings = ctx.seedlings.map((s) => ({
    name: truncate(s.plant.name, 80, "seedling.name"),
    displayName: truncate(
      getPlantName(s.plant.id, s.plant.name, responseLocale),
      80,
      "seedling.displayName",
    ),
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
        const location = ctx.placedPlants.find(
          (p) => p.planterId === planterId,
        );
        const planterName = location?.planterName;
        recentEvents.push({
          type,
          daysAgo: Math.floor(
            (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
          ),
          areaName: location?.areaName,
          planterName: planterName !== undefined ? truncate(planterName, 80, "recentEvent.planterName") : undefined,
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
    lat: ctx.lat,
    lng: ctx.lng,
    responseLocale,
    responseLanguage,
    model: model ?? "unknown",
    weather: weatherSummary,
    plants,
    seedlings,
    recentEvents,
    activeRuleSuggestionKeys,
  };
}

function namesMatch(left: string | null | undefined, right: string): boolean {
  if (!left) return false;
  return normalizePlantReference(left) === normalizePlantReference(right);
}

function planterNamesMatch(
  left: string | null | undefined,
  right: string,
): boolean {
  return left?.trim().toLowerCase() === right.trim().toLowerCase();
}

function plantsConflict(
  left: AISuggestionContext["plants"][number],
  right: AISuggestionContext["plants"][number],
): boolean {
  const leftName = normalizePlantReference(left.name);
  const rightName = normalizePlantReference(right.name);
  const leftAntagonists = new Set(left.antagonists.map(normalizePlantReference));
  const rightAntagonists = new Set(
    right.antagonists.map(normalizePlantReference),
  );

  return (
    leftAntagonists.has(rightName) || rightAntagonists.has(leftName)
  );
}

export function hasSamePlanterCompanionConflict(
  ctx: AISuggestionContext,
  suggestion: Pick<RawAISuggestion, "plantName" | "planterName">,
): boolean {
  if (suggestion.planterName) {
    const planterPlants = ctx.plants.filter((plant) =>
      planterNamesMatch(suggestion.planterName, plant.planterName),
    );
    if (planterPlants.length < 2) return false;

    if (suggestion.plantName) {
      return planterPlants
        .filter((plant) => namesMatch(suggestion.plantName, plant.name))
        .some((plant) =>
          planterPlants.some(
            (candidate) =>
              candidate !== plant && plantsConflict(plant, candidate),
          ),
        );
    }

    return planterPlants.some((plant, plantIndex) =>
      planterPlants.some(
        (candidate, candidateIndex) =>
          candidateIndex > plantIndex && plantsConflict(plant, candidate),
      ),
    );
  }

  if (!suggestion.plantName) return false;

  const matchingPlants = ctx.plants.filter((plant) =>
    namesMatch(suggestion.plantName, plant.name),
  );

  return matchingPlants.some((plant) =>
    ctx.plants.some(
      (candidate) =>
        planterNamesMatch(candidate.planterName, plant.planterName) &&
        candidate !== plant &&
        plantsConflict(plant, candidate),
    ),
  );
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
    if (
      type === "companion_conflict" &&
      !hasSamePlanterCompanionConflict(ctx, item)
    ) {
      continue;
    }

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
    let planterName: string | undefined;
    if (item.planterName) {
      const matched = ctx.plants.find(
        (p) => p.planterName.toLowerCase() === item.planterName!.toLowerCase(),
      );
      // We don't have the planter ID in the context, so we store the name and resolve later
      planterId = matched?.planterName;
      planterName = item.planterName;
    }

    // Area name (optional — for area-scoped suggestions, LAS.3)
    const areaName = item.areaName ?? undefined;

    // Scope — infer from presence of fields if not explicitly provided (LAS.1)
    const VALID_SCOPES = ["area", "planter", "plant"] as const;
    let scope: AISuggestionResult["scope"] = VALID_SCOPES.includes(
      item.scope as (typeof VALID_SCOPES)[number],
    )
      ? (item.scope as AISuggestionResult["scope"])
      : undefined;
    if (!scope) {
      if (areaName && !planterId && !plant) {
        scope = "area";
      } else if (plant || item.plantName) {
        scope = "plant";
      } else if (planterId || item.planterName) {
        scope = "planter";
      } else {
        scope = "area"; // broad suggestion with no specific target
      }
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

    // LAS.13 — debug explainability
    console.debug(
      `[aiSuggestions] Parsed suggestion: type=${type} scope=${scope} ` +
        `plant=${item.plantName ?? "-"} planter=${item.planterName ?? "-"} ` +
        `area=${areaName ?? "-"} confidence=${item.confidence.toFixed(2)} ` +
        `locale=${ctx.responseLocale}`,
    );

    results.push({
      type,
      plant,
      planterId,
      planterName,
      areaName,
      priority,
      description,
      dueDate,
      source: "ai",
      scope,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Generate AI-powered suggestions using OpenRouter.
 * Uses only `settings.aiModel` — no fallback chain. Throws on any failure
 * so callers can surface the error to the user.
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
  const aiContext = buildAISuggestionContext(
    ctx,
    ruleResults,
    settings.locale,
    settings.aiModel,
  );

  // Check cache first (LAS.4, LAS.7, LAS.9)
  const cached = await getCachedAISuggestions(aiContext);
  if (cached) {
    console.debug(
      `[aiSuggestions] Serving cached batch (spawnedAt=${new Date(cached.spawnedAt).toISOString()}, ` +
        `expiresAt=${new Date(cached.expiresAt).toISOString()}, ` +
        `needsRefresh=${cached.needsBackgroundRefresh}, locale=${aiContext.responseLocale})`,
    );
    const results = parseAIResponse(
      { suggestions: cached.suggestions },
      aiContext,
      allPlants,
    );
    // LAS.9: if the cache is ageing, signal caller to refresh (handled by useSuggestions)
    // For now, return cached results — background refresh is managed by the hook.
    return results;
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
    proxyUrl: apiUrl("/api/ai/chat"),
  });

  const userMessage = JSON.stringify(aiContext, null, 0);

  console.debug(
    `[aiSuggestions] Calling AI (model=${settings.aiModel}, locale=${aiContext.responseLocale}, ` +
      `plants=${aiContext.plants.length}, seedlings=${aiContext.seedlings.length})`,
  );

  const response = await client.chatCompletion(
    settings.aiModel,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    {
      temperature: 0.3,
      maxTokens: 1536,
      responseFormat: { type: "json_object" },
      signal,
    },
  );

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  let parsed: unknown;
  try {
    const stripped = (content as string).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(stripped);
  } catch {
    console.warn("[aiSuggestions] Failed to parse AI response JSON");
    return [];
  }

  const results = parseAIResponse(parsed, aiContext, allPlants);

  // Cache raw suggestions with lifecycle metadata (LAS.5, LAS.6)
  if (Array.isArray((parsed as Record<string, unknown>)?.suggestions)) {
    const rawSuggestions = (parsed as { suggestions: unknown[] }).suggestions;
    // Collect the suggestion types for per-type TTL policy
    const types = results.map((r) => r.type);
    await cacheAISuggestions(aiContext, rawSuggestions, types);
  }

  console.debug(
    `[aiSuggestions] AI returned ${results.length} suggestions ` +
      `(locale=${aiContext.responseLocale}, model=${settings.aiModel})`,
  );

  return results;
}
