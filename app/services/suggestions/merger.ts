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
 * 4. Aggregate duplicate-like suggestions upward through the hierarchy
 *    (plant -> planter -> area) when one grouped action is clearer than many
 * 5. Sort: HIGH priority first, then MEDIUM, then LOW; within each tier by dueDate
 * 6. Cap at MAX_SUGGESTIONS to avoid overwhelming the UI
 */

import type { Suggestion } from "../../data/schema";
import type { SuggestionResult, AISuggestionResult } from "./types";
import i18n from "../../i18n/config";

type StaticTipKey = "addPlants" | "companionPlanting";
type GroupedSuggestionKey =
  | "waterPlanters"
  | "skipWateringPlanters"
  | "weedPlanters"
  | "fertilizePlanters"
  | "protectFrostPlanters"
  | "mulchPlanters"
  | "inspectPestsPlanters"
  | "inspectDiseaseRiskPlanters"
  | "reviewCompanionsPlanters"
  | "wrapSeasonPlanters"
  | "prunePlanters"
  | "repotPlanters"
  | "thinSeedlings"
  | "hardenSeedlings"
  | "protectFrostPlants"
  | "inspectPestsPlants"
  | "inspectDiseaseRiskPlants"
  | "reviewCompanionsPlants"
  | "prunePlants"
  | "repotPlants"
  | "generalPlanters"
  | "generalPlants";

type AggregationTarget = "planter" | "area";

function translateStaticTip(key: StaticTipKey, locale?: string): string {
  const translationKey = `eventsBar.staticTips.${key}` as const;
  return String(i18n.t(translationKey, { lng: locale }));
}

function translateGroupedSuggestion(
  key: GroupedSuggestionKey,
  count: number,
  locale?: string,
): string {
  const translationKey = `eventsBar.groupedSuggestionDescriptions.${key}` as const;
  return String(i18n.t(translationKey, { lng: locale, count }));
}

const MAX_SUGGESTIONS = 7;
const PRIORITY_ORDER: Record<Suggestion["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const SOURCE_ORDER: Record<NonNullable<Suggestion["source"]>, number> = {
  rules: 0,
  ai: 1,
  static: 2,
};
const AGGREGATABLE_TYPES = new Set<Suggestion["type"]>([
  "water",
  "no_water",
  "weed",
  "fertilize",
  "compost",
  "frost_protect",
  "mulch",
  "pest_alert",
  "disease_risk",
  "companion_conflict",
  "end_of_season",
  "prune",
  "repot",
  "thin_seedlings",
  "harden_seedlings",
]);

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function ruleResultToSuggestion(result: SuggestionResult): Suggestion {
  // Derive scope from existing fields when not explicitly set
  const scope =
    result.scope ??
    (result.instanceId || result.plant
      ? "plant"
      : result.planterId
        ? "planter"
        : result.areaId
          ? "area"
          : undefined);

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
    areaId: result.areaId,
    areaName: result.areaName,
    planterName: result.planterName,
    scope,
  };
}

function aiResultToSuggestion(
  result: AISuggestionResult,
  index: number,
): Suggestion {
  return {
    id: `ai:${result.type}:${result.plant?.name ?? result.areaName ?? "global"}:${index}`,
    type: result.type,
    plant: result.plant,
    planterId: result.planterId,
    instanceId: result.instanceId,
    priority: result.priority,
    description: result.description,
    dueDate: result.dueDate,
    source: "ai",
    areaName: result.areaName,
    planterName: result.planterName,
    scope: result.scope,
  };
}

// ---------------------------------------------------------------------------
// Deduplication key
// ---------------------------------------------------------------------------

function dedupeKey(s: Suggestion): string {
  // Include scope in the dedup key so area-scoped and planter-scoped
  // suggestions of the same type are not incorrectly merged (LAS.11)
  return `${s.type}:${s.scope ?? "none"}:${s.planterId ?? s.areaId ?? "global"}:${s.instanceId ?? "global"}:${s.plant?.name ?? "no-plant"}`;
}

function dueDateBucket(value?: string): string {
  return value ? value.slice(0, 10) : "undated";
}

function isAggregatableSuggestion(suggestion: Suggestion): boolean {
  return (
    suggestion.source !== "static" &&
    AGGREGATABLE_TYPES.has(suggestion.type)
  );
}

function getHighestPriority(suggestions: Suggestion[]): Suggestion["priority"] {
  return suggestions.reduce((best, current) =>
    PRIORITY_ORDER[current.priority] < PRIORITY_ORDER[best.priority]
      ? current
      : best,
  ).priority;
}

function getPreferredSource(
  suggestions: Suggestion[],
): NonNullable<Suggestion["source"]> {
  return suggestions.reduce((best, current) =>
    SOURCE_ORDER[current.source ?? "rules"] < SOURCE_ORDER[best.source ?? "rules"]
      ? current
      : best,
  ).source ?? "rules";
}

function getEarliestDate(
  suggestions: Suggestion[],
  field: "dueDate" | "expiresAt",
): string | undefined {
  const values = suggestions
    .map((suggestion) => suggestion[field])
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

  return values[0];
}

function getRepresentativeSuggestion(
  suggestions: Suggestion[],
  scope: Suggestion["scope"],
): Suggestion {
  const candidates = suggestions.filter((suggestion) => suggestion.scope === scope);
  const pool = candidates.length > 0 ? candidates : suggestions;

  return pool.reduce((best, current) => {
    const currentSource = SOURCE_ORDER[current.source ?? "rules"];
    const bestSource = SOURCE_ORDER[best.source ?? "rules"];
    if (currentSource !== bestSource) {
      return currentSource < bestSource ? current : best;
    }

    if (PRIORITY_ORDER[current.priority] !== PRIORITY_ORDER[best.priority]) {
      return PRIORITY_ORDER[current.priority] < PRIORITY_ORDER[best.priority]
        ? current
        : best;
    }

    return current;
  });
}

function getUniqueCount(
  suggestions: Suggestion[],
  target: AggregationTarget,
): number {
  if (target === "area") {
    const planters = new Set(
      suggestions
        .map((suggestion) => suggestion.planterId ?? suggestion.planterName)
        .filter((value): value is string => Boolean(value)),
    );
    return Math.max(planters.size, 2);
  }

  const plants = new Set(
    suggestions
      .map(
        (suggestion) =>
          suggestion.instanceId ?? suggestion.plant?.id ?? suggestion.id,
      )
      .filter((value): value is string => Boolean(value)),
  );
  return Math.max(plants.size, 2);
}

function buildGroupedDescription(
  type: Suggestion["type"],
  target: AggregationTarget,
  count: number,
  locale?: string,
): string {
  if (target === "area") {
    switch (type) {
      case "water":
        return translateGroupedSuggestion("waterPlanters", count, locale);
      case "no_water":
        return translateGroupedSuggestion("skipWateringPlanters", count, locale);
      case "weed":
        return translateGroupedSuggestion("weedPlanters", count, locale);
      case "fertilize":
      case "compost":
        return translateGroupedSuggestion("fertilizePlanters", count, locale);
      case "frost_protect":
        return translateGroupedSuggestion("protectFrostPlanters", count, locale);
      case "mulch":
        return translateGroupedSuggestion("mulchPlanters", count, locale);
      case "pest_alert":
        return translateGroupedSuggestion("inspectPestsPlanters", count, locale);
      case "disease_risk":
        return translateGroupedSuggestion(
          "inspectDiseaseRiskPlanters",
          count,
          locale,
        );
      case "companion_conflict":
        return translateGroupedSuggestion(
          "reviewCompanionsPlanters",
          count,
          locale,
        );
      case "end_of_season":
        return translateGroupedSuggestion("wrapSeasonPlanters", count, locale);
      case "prune":
        return translateGroupedSuggestion("prunePlanters", count, locale);
      case "repot":
        return translateGroupedSuggestion("repotPlanters", count, locale);
      case "thin_seedlings":
        return translateGroupedSuggestion("thinSeedlings", count, locale);
      case "harden_seedlings":
        return translateGroupedSuggestion("hardenSeedlings", count, locale);
      default:
        return translateGroupedSuggestion("generalPlanters", count, locale);
    }
  }

  switch (type) {
    case "frost_protect":
      return translateGroupedSuggestion("protectFrostPlants", count, locale);
    case "pest_alert":
      return translateGroupedSuggestion("inspectPestsPlants", count, locale);
    case "disease_risk":
      return translateGroupedSuggestion("inspectDiseaseRiskPlants", count, locale);
    case "companion_conflict":
      return translateGroupedSuggestion("reviewCompanionsPlants", count, locale);
    case "prune":
      return translateGroupedSuggestion("prunePlants", count, locale);
    case "repot":
      return translateGroupedSuggestion("repotPlants", count, locale);
    case "thin_seedlings":
      return translateGroupedSuggestion("thinSeedlings", count, locale);
    case "harden_seedlings":
      return translateGroupedSuggestion("hardenSeedlings", count, locale);
    default:
      return translateGroupedSuggestion("generalPlants", count, locale);
  }
}

function buildAggregateId(
  suggestions: Suggestion[],
  target: AggregationTarget,
): string {
  return [
    "agg",
    target,
    suggestions[0].type,
    dueDateBucket(suggestions[0].dueDate),
    ...suggestions.map((suggestion) => suggestion.id).sort(),
  ].join(":");
}

function createRepresentativeSuggestion(
  suggestions: Suggestion[],
  scope: Extract<Suggestion["scope"], "planter" | "area">,
): Suggestion {
  const representative = getRepresentativeSuggestion(suggestions, scope);

  return {
    ...representative,
    id: buildAggregateId(suggestions, scope),
    plant: undefined,
    instanceId: undefined,
    priority: getHighestPriority(suggestions),
    dueDate: getEarliestDate(suggestions, "dueDate"),
    expiresAt: getEarliestDate(suggestions, "expiresAt"),
    source: getPreferredSource(suggestions),
    scope,
    planterId:
      scope === "planter"
        ? representative.planterId ??
          suggestions.find((suggestion) => suggestion.planterId)?.planterId
        : undefined,
    planterName:
      scope === "planter"
        ? representative.planterName ??
          suggestions.find((suggestion) => suggestion.planterName)?.planterName
        : undefined,
    areaId:
      representative.areaId ??
      suggestions.find((suggestion) => suggestion.areaId)?.areaId,
    areaName:
      representative.areaName ??
      suggestions.find((suggestion) => suggestion.areaName)?.areaName,
  };
}

function createGroupedSuggestion(
  suggestions: Suggestion[],
  target: AggregationTarget,
  locale?: string,
): Suggestion {
  const representative = getRepresentativeSuggestion(
    suggestions,
    target === "area" ? "area" : "planter",
  );
  const count = getUniqueCount(suggestions, target);

  return {
    id: buildAggregateId(suggestions, target),
    type: representative.type,
    priority: getHighestPriority(suggestions),
    description: buildGroupedDescription(representative.type, target, count, locale),
    dueDate: getEarliestDate(suggestions, "dueDate"),
    expiresAt: getEarliestDate(suggestions, "expiresAt"),
    source: getPreferredSource(suggestions),
    areaId:
      representative.areaId ??
      suggestions.find((suggestion) => suggestion.areaId)?.areaId,
    areaName:
      representative.areaName ??
      suggestions.find((suggestion) => suggestion.areaName)?.areaName,
    planterId:
      target === "planter"
        ? representative.planterId ??
          suggestions.find((suggestion) => suggestion.planterId)?.planterId
        : undefined,
    planterName:
      target === "planter"
        ? representative.planterName ??
          suggestions.find((suggestion) => suggestion.planterName)?.planterName
        : undefined,
    scope: target,
  };
}

function promoteSuggestionsToPlanter(
  suggestions: Suggestion[],
  locale?: string,
): Suggestion[] {
  const passthrough: Suggestion[] = [];
  const groups = new Map<string, Suggestion[]>();

  for (const suggestion of suggestions) {
    if (
      !isAggregatableSuggestion(suggestion) ||
      suggestion.scope === "area" ||
      !(suggestion.planterId ?? suggestion.planterName)
    ) {
      passthrough.push(suggestion);
      continue;
    }

    const key = [
      suggestion.type,
      suggestion.planterId ?? suggestion.planterName,
      dueDateBucket(suggestion.dueDate),
    ].join(":");
    const existing = groups.get(key);
    if (existing) {
      existing.push(suggestion);
    } else {
      groups.set(key, [suggestion]);
    }
  }

  for (const group of groups.values()) {
    const hasPlanterSuggestion = group.some(
      (suggestion) => suggestion.scope === "planter",
    );
    const plantTargetCount = new Set(
      group
        .map((suggestion) => suggestion.instanceId ?? suggestion.plant?.id)
        .filter((value): value is string => Boolean(value)),
    ).size;

    if (plantTargetCount > 1) {
      passthrough.push(createGroupedSuggestion(group, "planter", locale));
      continue;
    }

    if (hasPlanterSuggestion && group.length > 1) {
      passthrough.push(createRepresentativeSuggestion(group, "planter"));
      continue;
    }

    passthrough.push(...group);
  }

  return passthrough;
}

function promoteSuggestionsToArea(
  suggestions: Suggestion[],
  locale?: string,
): Suggestion[] {
  const passthrough: Suggestion[] = [];
  const groups = new Map<string, Suggestion[]>();

  for (const suggestion of suggestions) {
    const areaKey = suggestion.areaName ?? suggestion.areaId;
    if (!isAggregatableSuggestion(suggestion) || !areaKey) {
      passthrough.push(suggestion);
      continue;
    }

    const key = [suggestion.type, areaKey, dueDateBucket(suggestion.dueDate)].join(":");
    const existing = groups.get(key);
    if (existing) {
      existing.push(suggestion);
    } else {
      groups.set(key, [suggestion]);
    }
  }

  for (const group of groups.values()) {
    const uniquePlanters = new Set(
      group
        .map((suggestion) => suggestion.planterId ?? suggestion.planterName)
        .filter((value): value is string => Boolean(value)),
    );
    const hasAreaSuggestion = group.some(
      (suggestion) => suggestion.scope === "area",
    );

    if (uniquePlanters.size > 1) {
      passthrough.push(createGroupedSuggestion(group, "area", locale));
      continue;
    }

    if (hasAreaSuggestion && group.length > 1) {
      passthrough.push(createRepresentativeSuggestion(group, "area"));
      continue;
    }

    passthrough.push(...group);
  }

  return passthrough;
}

function aggregateSuggestions(
  suggestions: Suggestion[],
  locale?: string,
): Suggestion[] {
  return promoteSuggestionsToArea(
    promoteSuggestionsToPlanter(suggestions, locale),
    locale,
  );
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

  const aggregated = aggregateSuggestions(all, locale);

  // Sort by priority, then dueDate
  aggregated.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  return aggregated.slice(0, MAX_SUGGESTIONS);
}
