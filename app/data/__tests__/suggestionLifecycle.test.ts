/**
 * app/data/__tests__/suggestionLifecycle.test.ts
 *
 * Unit tests for the Locale-Aware AI Suggestion Lifecycle (LAS.1–LAS.15).
 *
 * Covers:
 *   - LAS.1  Scope field on SuggestionResult and AISuggestionResult
 *   - LAS.4  Locale-partitioned cache keys (locale + model in key)
 *   - LAS.6  Per-type TTL policy (fast/slow types)
 *   - LAS.7  Locale switch invalidation
 *   - LAS.11 Scope-aware aggregation in merger
 *   - LAS.14 Legacy rows without cacheVersion treated as stale
 *   - LAS.15 buildAISuggestionContext carries model field
 */

import { describe, it, expect } from "vitest";
import {
  batchTtlMs,
  buildCacheKey,
  CACHE_VERSION,
} from "../../services/suggestions/suggestionsCache";
import { mergeSuggestions } from "../../services/suggestions/merger";
import { buildAISuggestionContext } from "../../services/suggestions/aiSuggestions";
import { buildCompletedSuggestionEvent } from "../../hooks/useGardenEvents";
import type {
  AISuggestionContext,
  SuggestionResult,
  AISuggestionResult,
  PlacedPlant,
  RuleContext,
} from "../../services/suggestions/types";
import type { Plant } from "../schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: "tomato",
    name: "Tomato",
    color: "#ef4444",
    icon: "🍅",
    companions: [],
    antagonists: [],
    sowIndoorMonths: [],
    sowDirectMonths: [],
    harvestMonths: [],
    isSeed: false,
    source: "bundled",
    ...overrides,
  };
}

function makeBaseContext(
  overrides: Partial<AISuggestionContext> = {},
): AISuggestionContext {
  return {
    koeppenZone: "Cfb",
    hemisphere: "N",
    currentMonth: 5,
    lat: 52,
    lng: 4,
    responseLocale: "en",
    responseLanguage: "English",
    model: "openai/gpt-4o-mini",
    weather: null,
    plants: [],
    seedlings: [],
    recentEvents: [],
    activeRuleSuggestionKeys: [],
    ...overrides,
  };
}

function makeRuleContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    currentMonth: 5,
    today: new Date("2026-05-15T00:00:00.000Z"),
    locale: "en",
    koeppenZone: "Cfb",
    lat: 52,
    lng: 4,
    placedPlants: [],
    seedlings: [],
    lastEvents: new Map(),
    weather: null,
    ...overrides,
  };
}

function makePlacedPlant(overrides: Partial<PlacedPlant> = {}): PlacedPlant {
  return {
    instanceId: "inst-1",
    plant: makePlant(),
    pestEvents: [],
    planterId: "planter-1",
    planterName: "Bed A",
    areaId: "area-1",
    areaName: "Garden",
    adjacentPlantNames: [],
    growthStage: null,
    healthState: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LAS.4 — Locale-partitioned cache keys
// ---------------------------------------------------------------------------

describe("buildCacheKey — LAS.4 locale and model partitioning", () => {
  it("produces different keys for different locales with same content", () => {
    const enCtx = makeBaseContext({ responseLocale: "en" });
    const nlCtx = makeBaseContext({ responseLocale: "nl" });
    expect(buildCacheKey(enCtx)).not.toBe(buildCacheKey(nlCtx));
  });

  it("produces different keys for different models with same content", () => {
    const gpt4Ctx = makeBaseContext({ model: "openai/gpt-4o" });
    const claudeCtx = makeBaseContext({ model: "anthropic/claude-3-haiku" });
    expect(buildCacheKey(gpt4Ctx)).not.toBe(buildCacheKey(claudeCtx));
  });

  it("produces same key for same locale + model + content", () => {
    const ctx1 = makeBaseContext();
    const ctx2 = makeBaseContext();
    expect(buildCacheKey(ctx1)).toBe(buildCacheKey(ctx2));
  });

  it("key includes cacheVersion prefix for migration safety", () => {
    const ctx = makeBaseContext();
    const key = buildCacheKey(ctx);
    expect(key).toMatch(new RegExp(`^ai-sug-v${CACHE_VERSION}-`));
  });

  it("produces different keys for different weather states", () => {
    const noWeather = makeBaseContext({ weather: null });
    const withWeather = makeBaseContext({
      weather: {
        todayTempMaxC: 22,
        todayPrecipMm: 0,
        next7DaysMaxTempC: 25,
        next7DaysMinTempC: 10,
        next7DaysTotalPrecipMm: 5,
        next7DaysPrecipProbMax: 30,
      },
    });
    expect(buildCacheKey(noWeather)).not.toBe(buildCacheKey(withWeather));
  });

  it("produces different keys when coordinates change", () => {
    const amsterdamCtx = makeBaseContext({ lat: 52.4, lng: 4.9 });
    const rotterdamCtx = makeBaseContext({ lat: 51.9, lng: 4.5 });
    expect(buildCacheKey(amsterdamCtx)).not.toBe(buildCacheKey(rotterdamCtx));
  });

  it("produces different keys when recent events change", () => {
    const baselineCtx = makeBaseContext({
      recentEvents: [
        {
          type: "watered",
          daysAgo: 2,
          areaName: "Garden",
          planterName: "Bed A",
        },
      ],
    });
    const updatedCtx = makeBaseContext({
      recentEvents: [
        {
          type: "weeded",
          daysAgo: 1,
          areaName: "Garden",
          planterName: "Bed A",
        },
      ],
    });

    expect(buildCacheKey(baselineCtx)).not.toBe(buildCacheKey(updatedCtx));
  });
});

// ---------------------------------------------------------------------------
// LAS.6 — Per-type TTL policy
// ---------------------------------------------------------------------------

describe("batchTtlMs — LAS.6 per-type TTL policy", () => {
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  it("uses short TTL for fast-changing types (frost_protect, pest_alert, disease_risk)", () => {
    const fastTtl = batchTtlMs(["frost_protect"]);
    expect(fastTtl).toBeLessThan(DAY_MS);
    expect(fastTtl).toBeGreaterThanOrEqual(HOUR_MS);
  });

  it("uses long TTL for slow strategic types (succession_sow, mulch)", () => {
    const slowTtl = batchTtlMs(["succession_sow"]);
    expect(slowTtl).toBeGreaterThan(DAY_MS);
  });

  it("uses the minimum TTL when a mixed batch contains a fast type", () => {
    const fastTtl = batchTtlMs(["frost_protect"]);
    const mixedTtl = batchTtlMs(["succession_sow", "frost_protect"]);
    // Mixed batch should expire as fast as frost_protect
    expect(mixedTtl).toBe(fastTtl);
  });

  it("uses default TTL when types array is empty", () => {
    const defaultTtl = batchTtlMs([]);
    const mediumTtl = batchTtlMs(["companion_conflict"]);
    expect(defaultTtl).toBe(mediumTtl);
  });

  it("fast types expire strictly faster than slow types", () => {
    expect(batchTtlMs(["frost_protect"])).toBeLessThan(
      batchTtlMs(["succession_sow"]),
    );
  });
});

// ---------------------------------------------------------------------------
// LAS.1 — Scope field on rule results flows through merger
// ---------------------------------------------------------------------------

describe("merger — LAS.1 scope field propagation", () => {
  it("carries scope from SuggestionResult to Suggestion", () => {
    const ruleResult: SuggestionResult = {
      key: "water:p1:global",
      type: "water",
      planterId: "p1",
      priority: "medium",
      description: "Water Bed A",
      source: "rules",
      ruleId: "water",
      areaId: "a1",
      areaName: "Garden",
      planterName: "Bed A",
      scope: "planter",
    };

    const merged = mergeSuggestions([ruleResult], [], false, "en");
    expect(merged).toHaveLength(1);
    expect(merged[0].scope).toBe("planter");
  });

  it("carries scope from AISuggestionResult to Suggestion", () => {
    const aiResult: AISuggestionResult = {
      type: "frost_protect",
      priority: "high",
      description: "Protect from frost",
      source: "ai",
      areaName: "Garden",
      scope: "area",
    };

    const merged = mergeSuggestions([], [aiResult], false, "en");
    expect(merged).toHaveLength(1);
    expect(merged[0].scope).toBe("area");
    expect(merged[0].areaName).toBe("Garden");
  });

  it("infers planter scope from planterId when scope not set on rule result", () => {
    const ruleResult: SuggestionResult = {
      key: "weed:p1:global",
      type: "weed",
      planterId: "p1",
      priority: "low",
      description: "Time to weed",
      source: "rules",
      ruleId: "weed",
    };

    const merged = mergeSuggestions([ruleResult], [], false, "en");
    expect(merged[0].scope).toBe("planter");
  });

  it("infers plant scope from instanceId when scope not set on rule result", () => {
    const plant = makePlant();
    const ruleResult: SuggestionResult = {
      key: "harvest:p1:inst1",
      type: "harvest",
      plant,
      planterId: "p1",
      instanceId: "inst1",
      priority: "medium",
      description: "Harvest tomatoes",
      source: "rules",
      ruleId: "harvest",
    };

    const merged = mergeSuggestions([ruleResult], [], false, "en");
    expect(merged[0].scope).toBe("plant");
  });
});

// ---------------------------------------------------------------------------
// LAS.11 — Scope-aware aggregation in merger
// ---------------------------------------------------------------------------

describe("merger — LAS.11 scope-aware aggregation", () => {
  it("promotes planter duplicates to one area-scope suggestion", () => {
    const areaResult: AISuggestionResult = {
      type: "frost_protect",
      priority: "high",
      description: "Area frost warning",
      source: "ai",
      areaId: "a1",
      areaName: "Garden",
      scope: "area",
    };

    const planterResult: SuggestionResult = {
      key: "frost_protect:p1:global",
      type: "frost_protect",
      planterId: "p1",
      priority: "high",
      description: "Protect Bed A",
      source: "rules",
      ruleId: "frost_protect",
      areaId: "a1",
      areaName: "Garden",
      planterName: "Bed A",
      scope: "planter",
    };

    const merged = mergeSuggestions([planterResult], [areaResult], false, "en");
    expect(merged).toHaveLength(1);
    expect(merged[0].scope).toBe("area");
    expect(merged[0].description).toBe("Area frost warning");
  });

  it("promotes multiple plant-scope suggestions in one planter to one planter suggestion", () => {
    const result1: SuggestionResult = {
      key: "pest_alert:p1:i1",
      type: "pest_alert",
      planterId: "p1",
      instanceId: "i1",
      plant: makePlant({ id: "tomato", name: "Tomato" }),
      priority: "high",
      description: "Check Tomato for aphids",
      source: "rules",
      ruleId: "pest_alert",
      scope: "plant",
    };
    const result2: SuggestionResult = {
      key: "pest_alert:p1:i2",
      type: "pest_alert",
      planterId: "p1",
      instanceId: "i2",
      plant: makePlant({ id: "pepper", name: "Pepper", icon: "🫑" }),
      priority: "high",
      description: "Check Pepper for aphids",
      source: "rules",
      ruleId: "pest_alert",
      areaId: "a1",
      areaName: "Garden",
      planterName: "Bed A",
      scope: "plant",
    };

    const merged = mergeSuggestions([result1, result2], [], false, "en");
    expect(merged).toHaveLength(1);
    expect(merged[0].scope).toBe("planter");
    expect(merged[0].planterName).toBe("Bed A");
    expect(merged[0].description).toBe("Inspect 2 plants for pests");
  });
});

// ---------------------------------------------------------------------------
// LAS.15 — buildAISuggestionContext carries model field
// ---------------------------------------------------------------------------

describe("buildAISuggestionContext — LAS.15 model field", () => {
  it("includes the model from settings in the context", () => {
    const ctx = makeRuleContext({ placedPlants: [makePlacedPlant()] });
    const result = buildAISuggestionContext(
      ctx,
      [],
      "en",
      "openai/gpt-4o-mini",
    );
    expect(result.model).toBe("openai/gpt-4o-mini");
  });

  it("defaults model to 'unknown' when not provided", () => {
    const ctx = makeRuleContext({ placedPlants: [makePlacedPlant()] });
    const result = buildAISuggestionContext(ctx, [], "en");
    expect(result.model).toBe("unknown");
  });

  it("includes responseLocale in context for cache key partitioning", () => {
    const ctx = makeRuleContext({ placedPlants: [makePlacedPlant()] });
    const enResult = buildAISuggestionContext(ctx, [], "en", "model-a");
    const nlResult = buildAISuggestionContext(ctx, [], "nl", "model-a");
    expect(enResult.responseLocale).toBe("en");
    expect(nlResult.responseLocale).toBe("nl");
    // Different locales must produce different cache keys
    expect(buildCacheKey(enResult)).not.toBe(buildCacheKey(nlResult));
  });

  it("same model + locale produces the same cache key (deterministic)", () => {
    const ctx = makeRuleContext({ placedPlants: [makePlacedPlant()] });
    const r1 = buildAISuggestionContext(ctx, [], "en", "model-x");
    const r2 = buildAISuggestionContext(ctx, [], "en", "model-x");
    expect(buildCacheKey(r1)).toBe(buildCacheKey(r2));
  });

  it("includes area names in the AI context so area-scoped suggestions can stay area-targeted", () => {
    const ctx = makeRuleContext({ placedPlants: [makePlacedPlant()] });
    const result = buildAISuggestionContext(ctx, [], "en", "model-x");

    expect(result.plants[0]?.areaName).toBe("Garden");
  });
});

// ---------------------------------------------------------------------------
// LAS.12 — Completion flow consistency
// ---------------------------------------------------------------------------

describe("buildCompletedSuggestionEvent — LAS.12 scope-aware completion", () => {
  it("creates one area-scoped event for an area suggestion", () => {
    const event = buildCompletedSuggestionEvent(
      {
        id: "s1",
        type: "frost_protect",
        priority: "high",
        description: "Protect frost-sensitive plants in 2 planters tonight",
        source: "rules",
        scope: "area",
        areaId: "area-1",
        areaName: "Garden",
      },
      "2026-05-15T00:00:00.000Z",
    );

    expect(event?.scope).toBe("area");
    expect(event?.gardenId).toBeUndefined();
    expect(event?.plant).toBeUndefined();
    expect(event?.suggestionType).toBe("frost_protect");
  });

  it("creates a planter-scoped event for planter maintenance", () => {
    const event = buildCompletedSuggestionEvent(
      {
        id: "s2",
        type: "water",
        priority: "medium",
        description: "Water 2 planters",
        source: "rules",
        scope: "planter",
        planterId: "planter-1",
        planterName: "Bed A",
        areaId: "area-1",
        areaName: "Garden",
      },
      "2026-05-15T00:00:00.000Z",
    );

    expect(event?.scope).toBe("planter");
    expect(event?.gardenId).toBe("planter-1");
    expect(event?.type).toBe("watered");
  });

  it("keeps plant identity for plant-scoped suggestion completion", () => {
    const plant = makePlant();
    const event = buildCompletedSuggestionEvent(
      {
        id: "s3",
        type: "treatment",
        priority: "high",
        description: "Review Tomato and apply a treatment",
        source: "rules",
        scope: "plant",
        planterId: "planter-1",
        instanceId: "instance-1",
        plant,
      },
      "2026-05-15T00:00:00.000Z",
    );

    expect(event?.scope).toBe("plant");
    expect(event?.instanceId).toBe("instance-1");
    expect(event?.plant?.id).toBe("tomato");
    expect(event?.note).toBe("Review Tomato and apply a treatment");
  });
});

// ---------------------------------------------------------------------------
// LAS.14 — CACHE_VERSION exported and ≥ 1
// ---------------------------------------------------------------------------

describe("CACHE_VERSION — LAS.14 migration safety", () => {
  it("is a positive integer", () => {
    expect(typeof CACHE_VERSION).toBe("number");
    expect(CACHE_VERSION).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(CACHE_VERSION)).toBe(true);
  });
});
