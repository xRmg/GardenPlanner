/**
 * app/services/suggestions/merger.ts
 *
 * Merges rules-engine SuggestionResults and AI AISuggestionResults into a
 * single sorted Suggestion[] array suitable for the EventsBar component.
 *
 * Merge strategy:
 * 1. Convert both result types to Suggestion[] using stable deterministic IDs
 * 2. Deduplicate: rules-engine results take precedence over AI for the same
 *    planter+type combination
 * 3. Filter expired suggestions
 * 4. Sort: HIGH priority first, then MEDIUM, then LOW; within each tier by dueDate
 * 5. Cap at MAX_SUGGESTIONS to avoid overwhelming the UI
 */

import type { Suggestion } from "../../data/schema";
import type { SuggestionResult, AISuggestionResult } from "./types";
import i18n from "../../i18n/config";

type StaticTipKey = "addPlants" | "companionPlanting";

function translateStaticTip(key: StaticTipKey, locale?: string): string {
  const translationKey = `eventsBar.staticTips.${key}` as const;
  return String(i18n.t(translationKey, { lng: locale }));
}

const MAX_SUGGESTIONS = 7;
const PRIORITY_ORDER: Record<Suggestion["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function ruleResultToSuggestion(result: SuggestionResult): Suggestion {
  return {
    id: `rule:${result.key}`,
    type: result.type,
    plant: result.plant,
    planterId: result.planterId,
    instanceId: result.instanceId,
    priority: result.priority,
    description: result.description,
    dueDate: result.dueDate,
    expiresAt: result.expiresAt,
    source: "rules",
  };
}

function aiResultToSuggestion(
  result: AISuggestionResult,
  index: number,
): Suggestion {
  return {
    id: `ai:${result.type}:${result.plant?.name ?? "global"}:${index}`,
    type: result.type,
    plant: result.plant,
    planterId: result.planterId,
    instanceId: result.instanceId,
    priority: result.priority,
    description: result.description,
    dueDate: result.dueDate,
    source: "ai",
  };
}

// ---------------------------------------------------------------------------
// Deduplication key
// ---------------------------------------------------------------------------

function dedupeKey(s: Suggestion): string {
  return `${s.type}:${s.planterId ?? "global"}:${s.instanceId ?? "global"}:${s.plant?.name ?? "no-plant"}`;
}

// ---------------------------------------------------------------------------
// Static tips (Tier 4: shown when garden is empty)
// ---------------------------------------------------------------------------

function getStaticTips(locale?: string): Suggestion[] {
  return [
    {
      id: "static:start-seeds",
      type: "sow",
      priority: "low",
      description: translateStaticTip("addPlants", locale),
      source: "static",
    },
    {
      id: "static:companion-planting",
      type: "companion_conflict",
      priority: "low",
      description: translateStaticTip("companionPlanting", locale),
      source: "static",
    },
  ];
}

// ---------------------------------------------------------------------------
// Public merge function
// ---------------------------------------------------------------------------

/**
 * Merge and sort rule + AI suggestions into the final Suggestion[] array.
 *
 * @param ruleResults - Raw rule engine outputs
 * @param aiResults - Raw AI outputs (may be empty)
 * @param isEmpty - True when the garden has no plants and no seedlings
 */
export function mergeSuggestions(
  ruleResults: SuggestionResult[],
  aiResults: AISuggestionResult[],
  isEmpty: boolean,
  locale?: string,
): Suggestion[] {
  const now = new Date();

  if (isEmpty && ruleResults.length === 0 && aiResults.length === 0) {
    return getStaticTips(locale);
  }

  const all: Suggestion[] = [];
  const seenKeys = new Set<string>();

  // Rules results first (higher trust)
  for (const result of ruleResults) {
    const suggestion = ruleResultToSuggestion(result);
    // Filter expired
    if (suggestion.expiresAt && new Date(suggestion.expiresAt) < now) continue;
    const key = dedupeKey(suggestion);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      all.push(suggestion);
    }
  }

  // AI results — only add if not already covered by a rules suggestion
  for (let i = 0; i < aiResults.length; i++) {
    const suggestion = aiResultToSuggestion(aiResults[i], i);
    const key = dedupeKey(suggestion);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      all.push(suggestion);
    }
  }

  // Sort by priority, then dueDate
  all.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  return all.slice(0, MAX_SUGGESTIONS);
}
