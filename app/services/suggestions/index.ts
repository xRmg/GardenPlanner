/**
 * app/services/suggestions/index.ts
 *
 * Top-level orchestrator for the suggestion engine.
 * Called by the useSuggestions hook.
 *
 * Implements the 4-tier degradation:
 *   Tier 1: AI + weather      (ai+weather)
 *   Tier 2: Rules + weather   (rules+weather)
 *   Tier 3: Rules only        (rules)
 *   Tier 4: Static tips       (static, empty garden)
 */

import type { Area, GardenEvent, Plant, Seedling, Settings, Suggestion, SuggestionMode } from "../../data/schema";
import { getWeather } from "../weather";
import { buildRuleContext, runRules } from "./rulesEngine";
import { getAISuggestions } from "./aiSuggestions";
import { mergeSuggestions } from "./merger";

export type { SuggestionMode } from "../../data/schema";

export interface EvaluateSuggestionsParams {
  areas: Area[];
  seedlings: Seedling[];
  events: GardenEvent[];
  settings: Settings;
  plants: Plant[];
}

export interface EvaluateSuggestionsResult {
  suggestions: Suggestion[];
  mode: SuggestionMode;
}

/**
 * Main entry point. Evaluates all rules and (optionally) AI, returning a
 * merged, sorted Suggestion[] and the active degradation tier.
 */
export async function evaluateSuggestions(
  params: EvaluateSuggestionsParams,
  signal?: AbortSignal,
): Promise<EvaluateSuggestionsResult> {
  const { areas, seedlings, events, settings, plants } = params;

  // Determine if the garden is empty
  const isEmpty =
    areas.every((a) => a.planters.every((p) => !p.squares?.some((row) => row.some((cell) => cell.plantInstance)))) &&
    seedlings.length === 0;

  // Tier 4: static tips for empty garden
  if (isEmpty) {
    return {
      suggestions: mergeSuggestions([], [], true),
      mode: "static",
    };
  }

  // Attempt to fetch weather data (needed for Tiers 1 and 2)
  let weather = null;
  let weatherAvailable = false;
  if (settings.lat != null && settings.lng != null) {
    try {
      weather = await getWeather(settings.lat, settings.lng, signal);
      weatherAvailable = true;
    } catch (err) {
      console.warn("[suggestions] Weather fetch failed, falling back to rules-only:", err);
    }
  }

  // Build the rule context
  const ruleCtx = buildRuleContext({ areas, seedlings, events, settings, weather });

  // Run the rules engine
  const ruleResults = runRules(ruleCtx);

  // Determine mode and (optionally) run AI
  const hasAI = settings.aiProvider.type !== "none";
  const hasLocation = settings.lat != null && settings.lng != null;

  let mode: SuggestionMode;
  let aiResults: ReturnType<typeof getAISuggestions> extends Promise<infer T> ? T : never = [];

  if (hasAI && hasLocation && weatherAvailable) {
    // Tier 1: attempt AI + weather
    try {
      aiResults = await getAISuggestions(ruleCtx, ruleResults, settings, plants, signal);
      mode = aiResults.length > 0 ? "ai+weather" : "rules+weather";
    } catch (err) {
      console.warn("[suggestions] AI call failed, falling back to rules+weather:", err);
      mode = "rules+weather";
    }
  } else if (weatherAvailable) {
    // Tier 2: rules + weather
    mode = "rules+weather";
  } else {
    // Tier 3: rules only
    mode = "rules";
  }

  const suggestions = mergeSuggestions(ruleResults, aiResults, false);

  return { suggestions, mode };
}
