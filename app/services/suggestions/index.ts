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
import type { RuleContext, SuggestionResult } from "./types";

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
  /** Set when the AI call failed — rules-based suggestions are still returned. */
  aiError?: Error;
}

export interface EvaluateRuleSuggestionsResult {
  suggestions: Suggestion[];
  mode: Exclude<SuggestionMode, "ai+weather">;
  ruleCtx?: RuleContext;
  ruleResults?: SuggestionResult[];
  weatherAvailable: boolean;
  canEnhanceWithAI: boolean;
}

export async function evaluateRuleSuggestions(
  params: EvaluateSuggestionsParams,
  signal?: AbortSignal,
): Promise<EvaluateRuleSuggestionsResult> {
  const { areas, seedlings, events, settings } = params;

  const isEmpty =
    areas.every((a) => a.planters.every((p) => !p.squares?.some((row) => row.some((cell) => cell.plantInstance)))) &&
    seedlings.length === 0;

  if (isEmpty) {
    return {
      suggestions: mergeSuggestions([], [], true, settings.locale),
      mode: "static",
      weatherAvailable: false,
      canEnhanceWithAI: false,
    };
  }

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

  const ruleCtx = buildRuleContext({ areas, seedlings, events, settings, weather });
  const ruleResults = runRules(ruleCtx);
  const mode: Exclude<SuggestionMode, "ai+weather"> = weatherAvailable
    ? "rules+weather"
    : "rules";

  return {
    suggestions: mergeSuggestions(ruleResults, [], false, settings.locale),
    mode,
    ruleCtx,
    ruleResults,
    weatherAvailable,
    canEnhanceWithAI:
      settings.aiProvider.type !== "none" &&
      settings.lat != null &&
      settings.lng != null &&
      weatherAvailable,
  };
}

export async function enhanceSuggestionsWithAI(
  ruleCtx: RuleContext,
  ruleResults: SuggestionResult[],
  settings: Settings,
  plants: Plant[],
  signal?: AbortSignal,
): Promise<Pick<EvaluateSuggestionsResult, "suggestions" | "mode" | "aiError">> {
  let aiResults: ReturnType<typeof getAISuggestions> extends Promise<infer T> ? T : never = [];
  let aiError: Error | undefined;

  try {
    aiResults = await getAISuggestions(ruleCtx, ruleResults, settings, plants, signal);
  } catch (err) {
    console.warn("[suggestions] AI call failed, falling back to rules+weather:", err);
    aiError = err instanceof Error ? err : new Error(String(err));
  }

  return {
    suggestions: mergeSuggestions(ruleResults, aiResults, false, settings.locale),
    mode: aiResults.length > 0 ? "ai+weather" : "rules+weather",
    aiError,
  };
}

/**
 * Main entry point. Evaluates all rules and (optionally) AI, returning a
 * merged, sorted Suggestion[] and the active degradation tier.
 */
export async function evaluateSuggestions(
  params: EvaluateSuggestionsParams,
  signal?: AbortSignal,
): Promise<EvaluateSuggestionsResult> {
  const { settings, plants } = params;
  const base = await evaluateRuleSuggestions(params, signal);

  if (
    !base.canEnhanceWithAI ||
    !base.ruleCtx ||
    !base.ruleResults ||
    base.mode === "static"
  ) {
    return {
      suggestions: base.suggestions,
      mode: base.mode,
    };
  }

  const enhanced = await enhanceSuggestionsWithAI(
    base.ruleCtx,
    base.ruleResults,
    settings,
    plants,
    signal,
  );

  return enhanced;
}
