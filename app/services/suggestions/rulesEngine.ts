/**
 * app/services/suggestions/rulesEngine.ts
 *
 * Deterministic rules engine for garden care suggestions.
 * Each rule produces zero or more SuggestionResult objects given a RuleContext.
 *
 * 6 core rules (from suggestion-engine-plan.md):
 *   1. Weeding — wet warm weather + time since last weeding
 *   2. Sowing — calendar window + seedling/instance absence this season
 *   3. Harvesting — daysToHarvest elapsed or harvestMonths match
 *   4. Fertilization — days since last composted event
 *   5. Watering — low recent rain + high temperature
 *   6. No-Watering — rain forecast overrides watering suggestion
 */

import type { RuleContext, SuggestionResult, PlacedPlant } from "./types";
import type { Seedling } from "../../data/schema";

// ---------------------------------------------------------------------------
// Hemisphere detection from Köppen zone + lat
// ---------------------------------------------------------------------------

/** Derive the first frost month for the Northern Hemisphere based on the Köppen zone.
 * Returns 13 as a sentinel for frost-free zones (always > any valid month 1-12). */
function approxFirstFrostMonthNH(koeppenZone: string): number {
  if (koeppenZone.startsWith("A") || koeppenZone.startsWith("B") || koeppenZone === "Aw") return 13; // no frost
  if (koeppenZone.startsWith("ET") || koeppenZone.startsWith("EF")) return 9;
  if (koeppenZone.startsWith("D")) return 10;
  // C zones
  const sub = koeppenZone[2];
  if (sub === "c" || sub === "d") return 10;
  return 11;
}

/** Derive last frost month (spring) for Northern Hemisphere.
 * Returns 0 as a sentinel for frost-free zones (always < any valid month 1-12). */
function approxLastFrostMonthNH(koeppenZone: string): number {
  if (koeppenZone.startsWith("A") || (koeppenZone.startsWith("B") && !koeppenZone.includes("k"))) return 0; // no frost
  if (koeppenZone.startsWith("ET") || koeppenZone.startsWith("EF")) return 6;
  if (koeppenZone.startsWith("D")) return 5;
  const sub = koeppenZone[2];
  if (sub === "c" || sub === "d") return 5;
  return 3; // Cfa, Cfb, Csa, Csb
}

/** Adjust month for Southern Hemisphere (offset by 6 months). */
function adjustForSH(month: number): number {
  return ((month - 1 + 6) % 12) + 1;
}

// ---------------------------------------------------------------------------
// Cooldown helpers
// ---------------------------------------------------------------------------

function daysSince(date: Date | undefined, today: Date): number {
  if (!date) return Infinity;
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function getLastEvent(
  ctx: RuleContext,
  planterId: string,
  instanceId: string,
  eventType: string,
): Date | undefined {
  const key = `${planterId}:${instanceId}`;
  return ctx.lastEvents.get(key)?.get(eventType as never);
}

function getLastGlobalEvent(ctx: RuleContext, planterId: string, eventType: string): Date | undefined {
  const key = `${planterId}:global`;
  return ctx.lastEvents.get(key)?.get(eventType as never);
}

// ---------------------------------------------------------------------------
// Weather helpers
// ---------------------------------------------------------------------------

/** Sum precipitation over the last N past days in the daily array. */
function precipLast(ctx: RuleContext, days: number): number {
  if (!ctx.weather) return 0;
  const todayStr = ctx.today.toISOString().slice(0, 10);
  const pastDays = ctx.weather.daily
    .filter((d) => d.date < todayStr)
    .slice(-days);
  return pastDays.reduce((sum, d) => sum + d.precipSumMm, 0);
}

/** Max temperature over the last N past days. */
function tempMaxLast(ctx: RuleContext, days: number): number {
  if (!ctx.weather) return 0;
  const todayStr = ctx.today.toISOString().slice(0, 10);
  const pastDays = ctx.weather.daily.filter((d) => d.date <= todayStr).slice(-days);
  return Math.max(...pastDays.map((d) => d.tempMaxC), 0);
}

/** Forecast precipitation over the next N forecast days (from today). */
function precipForecast(ctx: RuleContext, days: number): { total: number; maxProb: number } {
  if (!ctx.weather) return { total: 0, maxProb: 0 };
  const todayStr = ctx.today.toISOString().slice(0, 10);
  const futureDays = ctx.weather.daily.filter((d) => d.date >= todayStr).slice(0, days);
  return {
    total: futureDays.reduce((sum, d) => sum + d.precipSumMm, 0),
    maxProb: Math.max(...futureDays.map((d) => d.precipProbabilityMax), 0),
  };
}

/** Min temperature over the next N forecast days. */
function tempMinForecast(ctx: RuleContext, days: number): number {
  if (!ctx.weather) return 99;
  const todayStr = ctx.today.toISOString().slice(0, 10);
  const futureDays = ctx.weather.daily.filter((d) => d.date >= todayStr).slice(0, days);
  return Math.min(...futureDays.map((d) => d.tempMinC), 99);
}

// ---------------------------------------------------------------------------
// Rule: Weeding
// ---------------------------------------------------------------------------

const weedingRule = {
  id: "weed",
  label: "Weeding",
  cooldownDays: 7,
  evaluate(ctx: RuleContext): SuggestionResult[] {
    const isNH = (ctx.lat ?? 45) >= 0;
    const growingMonths = isNH ? [4, 5, 6, 7, 8, 9, 10] : [10, 11, 12, 1, 2, 3, 4];
    if (!growingMonths.includes(ctx.currentMonth)) return [];

    const avgMaxTemp = tempMaxLast(ctx, 3);
    const totalPrecip = precipLast(ctx, 5);

    // Without weather, fire a generic seasonal reminder
    const weatherTrigger = ctx.weather
      ? avgMaxTemp >= 12 && totalPrecip >= 8
      : true;
    if (!weatherTrigger) return [];

    // Check cooldown per planter (garden-wide event)
    const planterIds = new Set(ctx.placedPlants.map((p) => p.planterId));
    const results: SuggestionResult[] = [];

    for (const planterId of planterIds) {
      const lastWeeded = getLastGlobalEvent(ctx, planterId, "weeded");
      const daysAgo = daysSince(lastWeeded, ctx.today);
      if (daysAgo < this.cooldownDays) continue;

      let priority: SuggestionResult["priority"] = "low";
      if (ctx.weather) {
        if (avgMaxTemp >= 18 && totalPrecip >= 15 && daysAgo >= 14) {
          priority = "high";
        } else if (daysAgo >= 10) {
          priority = "medium";
        }
      } else {
        priority = daysAgo >= 14 ? "medium" : "low";
      }

      const planterName = ctx.placedPlants.find((p) => p.planterId === planterId)?.planterName ?? planterId;
      results.push({
        key: `weed:${planterId}:global`,
        type: "weed",
        planterId,
        priority,
        description: `Time to weed ${planterName} — conditions are promoting weed growth`,
        source: "rules",
        ruleId: this.id,
      });
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Rule: Sowing
// ---------------------------------------------------------------------------

const sowingRule = {
  id: "sow",
  label: "Sowing",
  cooldownDays: 30,
  evaluate(ctx: RuleContext): SuggestionResult[] {
    const results: SuggestionResult[] = [];
    const isNH = (ctx.lat ?? 45) >= 0;
    const lastFrostMonth = isNH
      ? approxLastFrostMonthNH(ctx.koeppenZone)
      : adjustForSH(approxLastFrostMonthNH(ctx.koeppenZone));

    // Collect plants already actively seeded this season (seedlings only — placed plants
    // may be from a previous season cycle, so we suggest starting a new batch)
    const activeSeedlingNames = new Set(
      ctx.seedlings.map((s) => s.plant.name.toLowerCase()),
    );

    // Collect placed plant names that are "active":
    //   - Planted this calendar year (has plantingDate in current year), OR
    //   - Placed but with no plantingDate (assume currently growing)
    const currentYear = ctx.today.getFullYear();
    const activePlantedNames = new Set(
      ctx.placedPlants
        .filter((p) => {
          if (!p.plantingDate) return true; // no date → assume currently active
          return new Date(p.plantingDate).getFullYear() === currentYear;
        })
        .map((p) => p.plant.name.toLowerCase()),
    );

    const activePlantNames = new Set([...activeSeedlingNames, ...activePlantedNames]);

    // Find unique plants (by name) from placed plants to generate sowing suggestions
    const seenPlants = new Set<string>();
    for (const placed of ctx.placedPlants) {
      const plant = placed.plant;
      const nameLower = plant.name.toLowerCase();
      if (seenPlants.has(nameLower)) continue;
      seenPlants.add(nameLower);

      // Indoor sowing window
      if (plant.sowIndoorMonths.includes(ctx.currentMonth) && !activePlantNames.has(nameLower)) {
        const windowEnd = Math.max(...plant.sowIndoorMonths);
        const weeksToClose = ((windowEnd - ctx.currentMonth) * 4);
        const priority: SuggestionResult["priority"] =
          weeksToClose <= 2 ? "high" : weeksToClose <= 4 ? "medium" : "low";

        results.push({
          key: `sow:indoor:${nameLower}`,
          type: "sow",
          plant,
          priority,
          description: `Start ${plant.name} seeds indoors — sowing window is open`,
          source: "rules",
          ruleId: this.id,
        });
      }

      // Direct sowing window (requires last frost to have passed)
      if (
        plant.sowDirectMonths.includes(ctx.currentMonth) &&
        ctx.currentMonth > lastFrostMonth &&
        !activePlantNames.has(nameLower)
      ) {
        const windowEnd = Math.max(...plant.sowDirectMonths);
        const weeksToClose = (windowEnd - ctx.currentMonth) * 4;
        const priority: SuggestionResult["priority"] =
          weeksToClose <= 2 ? "high" : weeksToClose <= 4 ? "medium" : "low";

        results.push({
          key: `sow:direct:${nameLower}`,
          type: "sow",
          plant,
          priority,
          description: `Sow ${plant.name} directly — conditions are suitable`,
          source: "rules",
          ruleId: this.id,
        });
      }
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Rule: Harvesting
// ---------------------------------------------------------------------------

const harvestingRule = {
  id: "harvest",
  label: "Harvesting",
  cooldownDays: 0,
  evaluate(ctx: RuleContext): SuggestionResult[] {
    const results: SuggestionResult[] = [];
    const FAST_BOLTING = ["lettuce", "spinach", "rocket", "arugula", "beans", "courgette", "zucchini", "radish"];

    for (const placed of ctx.placedPlants) {
      const { plant, planterId, plantingDate } = placed;

      // Check harvest cooldown per instance
      const lastHarvested = getLastEvent(ctx, planterId, placed.instanceId, "harvested");
      if (lastHarvested) {
        const daysAgo = daysSince(lastHarvested, ctx.today);
        if (daysAgo < 30) continue; // Recently harvested
      }

      const isFastBolting = FAST_BOLTING.some((fb) => plant.name.toLowerCase().includes(fb));

      let shouldSuggest = false;
      let priority: SuggestionResult["priority"] = "low";
      let description = `Check if ${plant.name} is ready to harvest`;

      // Trigger by daysToHarvest elapsed since planting
      if (plantingDate && plant.daysToHarvest) {
        const daysSincePlanted = Math.floor(
          (ctx.today.getTime() - new Date(plantingDate).getTime()) / (1000 * 60 * 60 * 24),
        );
        const daysOverdue = daysSincePlanted - plant.daysToHarvest;
        if (daysOverdue >= -7) {
          shouldSuggest = true;
          if (daysOverdue > 7 || (isFastBolting && daysOverdue >= 0)) {
            priority = "high";
            description = `${plant.name} is overdue for harvest — pick now to prevent bolting`;
          } else if (daysOverdue >= -3) {
            priority = "high";
            description = `${plant.name} should be ready to harvest this week`;
          } else {
            priority = isFastBolting ? "medium" : "low";
            description = `${plant.name} is approaching harvest time`;
          }
        }
      }

      // Trigger by harvest month window
      if (!shouldSuggest && plant.harvestMonths.includes(ctx.currentMonth)) {
        shouldSuggest = true;
        priority = isFastBolting ? "medium" : "low";
        description = `${plant.name} is in its harvest window`;
      }

      if (shouldSuggest) {
        results.push({
          key: `harvest:${planterId}:${placed.instanceId}`,
          type: "harvest",
          plant,
          planterId,
          priority,
          description,
          source: "rules",
          ruleId: this.id,
        });
      }
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Rule: Fertilization
// ---------------------------------------------------------------------------

const fertilizationRule = {
  id: "fertilize",
  label: "Fertilization",
  cooldownDays: 21,
  evaluate(ctx: RuleContext): SuggestionResult[] {
    const isNH = (ctx.lat ?? 45) >= 0;
    const growingMonths = isNH ? [3, 4, 5, 6, 7, 8, 9] : [9, 10, 11, 12, 1, 2, 3];
    if (!growingMonths.includes(ctx.currentMonth)) return [];

    // Suppress if heavy rain forecast
    if (ctx.weather) {
      const forecast48h = precipForecast(ctx, 2);
      if (forecast48h.total >= 15 && forecast48h.maxProb >= 60) return [];
    }

    const planterIds = new Set(ctx.placedPlants.map((p) => p.planterId));
    const results: SuggestionResult[] = [];

    for (const planterId of planterIds) {
      const lastComposted = getLastGlobalEvent(ctx, planterId, "composted");
      const daysAgo = daysSince(lastComposted, ctx.today);

      if (daysAgo < this.cooldownDays) continue;

      let priority: SuggestionResult["priority"] = "medium";
      if (daysAgo >= 42 || lastComposted === undefined) {
        priority = "high";
      }

      const planterName = ctx.placedPlants.find((p) => p.planterId === planterId)?.planterName ?? planterId;
      results.push({
        key: `fertilize:${planterId}:global`,
        type: "fertilize",
        planterId,
        priority,
        description: `Add compost or fertilizer to ${planterName}`,
        source: "rules",
        ruleId: this.id,
      });
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Rule: Watering
// ---------------------------------------------------------------------------

const wateringRule = {
  id: "water",
  label: "Watering",
  cooldownDays: 2,
  evaluate(ctx: RuleContext): SuggestionResult[] {
    const results: SuggestionResult[] = [];

    // Without weather data, skip — no-op (avoid false positives)
    if (!ctx.weather) return [];

    // Water budget: rain - evapotranspiration over past 5 days
    const todayStr = ctx.today.toISOString().slice(0, 10);
    const past5 = ctx.weather.daily.filter((d) => d.date <= todayStr).slice(-5);
    const rainSum = past5.reduce((s, d) => s + d.rainSumMm, 0);
    const et0Sum = past5.reduce((s, d) => s + d.et0Fao, 0);
    const waterBudget = rainSum - et0Sum;

    if (waterBudget >= 0) return []; // Adequate moisture

    const maxTempLast3 = tempMaxLast(ctx, 3);
    const planterIds = new Set(ctx.placedPlants.map((p) => p.planterId));

    for (const planterId of planterIds) {
      const lastWatered = getLastGlobalEvent(ctx, planterId, "watered");
      const daysAgo = daysSince(lastWatered, ctx.today);
      if (daysAgo < this.cooldownDays) continue;

      let priority: SuggestionResult["priority"] = "low";
      if (waterBudget < -10 && maxTempLast3 >= 25) {
        priority = "high";
      } else if (waterBudget < -5 && maxTempLast3 >= 20) {
        priority = "medium";
      }

      const planterName = ctx.placedPlants.find((p) => p.planterId === planterId)?.planterName ?? planterId;
      results.push({
        key: `water:${planterId}:global`,
        type: "water",
        planterId,
        priority,
        description: `Water ${planterName} — soil moisture is low`,
        source: "rules",
        ruleId: this.id,
      });
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Rule: No-Watering (skip — rain forecast)
// ---------------------------------------------------------------------------

const noWaterRule = {
  id: "no_water",
  label: "No-Watering",
  cooldownDays: 0,
  evaluate(ctx: RuleContext, wateringSuggestionKeys: Set<string>): SuggestionResult[] {
    if (!ctx.weather) return [];

    const forecast24h = precipForecast(ctx, 1);
    const forecast48h = precipForecast(ctx, 2);

    const rainComing =
      (forecast24h.total >= 8 && forecast24h.maxProb >= 70) ||
      (forecast48h.total >= 15 && forecast48h.maxProb >= 70);

    if (!rainComing) return [];

    // Replace any watering suggestions for the same planters
    const results: SuggestionResult[] = [];
    const planterIds = new Set(ctx.placedPlants.map((p) => p.planterId));

    for (const planterId of planterIds) {
      // Only emit no-water if a watering suggestion would otherwise fire
      if (!wateringSuggestionKeys.has(`water:${planterId}:global`)) continue;

      const planterName = ctx.placedPlants.find((p) => p.planterId === planterId)?.planterName ?? planterId;
      const mm = Math.round(forecast48h.total);
      results.push({
        key: `no_water:${planterId}:global`,
        type: "no_water",
        planterId,
        priority: "medium",
        description: `No need to water ${planterName} — ${mm}mm of rain forecast`,
        source: "rules",
        ruleId: this.id,
      });
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Rule: Frost protection
// ---------------------------------------------------------------------------

const frostRule = {
  id: "frost_protect",
  label: "Frost protection",
  cooldownDays: 0,
  evaluate(ctx: RuleContext): SuggestionResult[] {
    if (!ctx.weather) return [];

    const minTemp48h = tempMinForecast(ctx, 2);
    if (minTemp48h > 2) return [];

    const results: SuggestionResult[] = [];
    const seenPlanters = new Set<string>();

    for (const placed of ctx.placedPlants) {
      const { plant, planterId } = placed;
      // Emit once per planter
      if (seenPlanters.has(planterId)) continue;

      const isFrostSensitive =
        plant.frostSensitive === true || plant.frostHardy === false;

      if (!isFrostSensitive && plant.frostHardy !== false) continue;

      seenPlanters.add(planterId);
      const planterName = placed.planterName;
      results.push({
        key: `frost_protect:${planterId}:global`,
        type: "frost_protect",
        plant,
        planterId,
        priority: "high",
        description: `Frost risk in ${planterName} — protect frost-sensitive plants tonight`,
        source: "rules",
        ruleId: this.id,
      });
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Public runRules function
// ---------------------------------------------------------------------------

export interface Rule {
  id: string;
  label: string;
  cooldownDays: number;
  evaluate(ctx: RuleContext, ...args: unknown[]): SuggestionResult[];
}

export const RULES: Rule[] = [
  weedingRule as Rule,
  sowingRule as Rule,
  harvestingRule as Rule,
  fertilizationRule as Rule,
  wateringRule as Rule,
  noWaterRule as unknown as Rule,
  frostRule as Rule,
];

/**
 * Run all rules against the context and return deduplicated SuggestionResults.
 * Watering and no-watering rules are mutually exclusive per planter.
 */
export function runRules(ctx: RuleContext): SuggestionResult[] {
  const allResults: SuggestionResult[] = [];
  const seenKeys = new Set<string>();

  // Run watering rule first to determine which planters need water
  const waterResults = wateringRule.evaluate(ctx);
  const waterKeys = new Set(waterResults.map((r) => r.key));

  // Run no-water rule and collect planters where rain replaces watering
  const noWaterResults = noWaterRule.evaluate(ctx, waterKeys);
  const noWaterPlanterKeys = new Set(noWaterResults.map((r) => r.planterId));

  for (const rule of RULES) {
    if (rule.id === "water") {
      // Skip watering for planters where no-water fires
      for (const result of waterResults) {
        if (!noWaterPlanterKeys.has(result.planterId) && !seenKeys.has(result.key)) {
          seenKeys.add(result.key);
          allResults.push(result);
        }
      }
    } else if (rule.id === "no_water") {
      for (const result of noWaterResults) {
        if (!seenKeys.has(result.key)) {
          seenKeys.add(result.key);
          allResults.push(result);
        }
      }
    } else {
      const results = rule.evaluate(ctx);
      for (const result of results) {
        if (!seenKeys.has(result.key)) {
          seenKeys.add(result.key);
          allResults.push(result);
        }
      }
    }
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// Helper: build a RuleContext from app state
// ---------------------------------------------------------------------------

/**
 * Build adjacentPlantNames for each PlantInstance in a planter's grid.
 * Returns a map from instanceId → adjacent plant names.
 */
function buildAdjacentPlantNames(
  squares: Array<Array<{ plantInstance: { instanceId: string; plant: { name: string } } | null }>> | undefined,
  rows: number,
  cols: number,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!squares) return result;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = squares[r]?.[c]?.plantInstance;
      if (!cell) continue;

      const adj: string[] = [];
      const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of deltas) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const neighbor = squares[nr]?.[nc]?.plantInstance;
        if (neighbor && neighbor.instanceId !== cell.instanceId) {
          adj.push(neighbor.plant.name);
        }
      }
      result.set(cell.instanceId, adj);
    }
  }
  return result;
}

import type { Area, GardenEvent, Settings, Plant } from "../../data/schema";

/**
 * Build a RuleContext from the current application state.
 */
export function buildRuleContext(params: {
  areas: Area[];
  seedlings: Seedling[];
  events: GardenEvent[];
  settings: Settings;
  weather: import("../weather").WeatherData | null;
}): RuleContext {
  const { areas, seedlings, events, settings, weather } = params;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Flatten placed plants
  const placedPlants: PlacedPlant[] = [];
  for (const area of areas) {
    for (const planter of area.planters) {
      const adjacentMap = buildAdjacentPlantNames(planter.squares, planter.rows, planter.cols);
      for (const row of planter.squares ?? []) {
        for (const cell of row) {
          if (!cell.plantInstance) continue;
          const { instanceId, plant, plantingDate, harvestDate } = cell.plantInstance;
          placedPlants.push({
            instanceId,
            plant,
            plantingDate,
            harvestDate,
            planterId: planter.id,
            planterName: planter.name,
            areaId: area.id,
            areaName: area.name,
            adjacentPlantNames: adjacentMap.get(instanceId) ?? [],
          });
        }
      }
    }
  }

  // Build lastEvents map
  const lastEvents = new Map<string, Map<string, Date>>();
  for (const event of events) {
    // Per-planter global events (watered, composted, weeded)
    if (event.gardenId) {
      const globalKey = `${event.gardenId}:global`;
      if (!lastEvents.has(globalKey)) lastEvents.set(globalKey, new Map());
      const existing = lastEvents.get(globalKey)!.get(event.type);
      const evDate = new Date(event.date);
      if (!existing || evDate > existing) {
        lastEvents.get(globalKey)!.set(event.type, evDate);
      }
    }
    // Per-instance events (harvested, planted, etc.)
    // We match by finding plants with the same name in placedPlants
    if (event.plant) {
      for (const placed of placedPlants) {
        if (placed.plant.name === event.plant.name) {
          const instanceKey = `${placed.planterId}:${placed.instanceId}`;
          if (!lastEvents.has(instanceKey)) lastEvents.set(instanceKey, new Map());
          const existing = lastEvents.get(instanceKey)!.get(event.type);
          const evDate = new Date(event.date);
          if (!existing || evDate > existing) {
            lastEvents.get(instanceKey)!.set(event.type, evDate);
          }
        }
      }
    }
  }

  return {
    currentMonth: today.getMonth() + 1,
    today,
    koeppenZone: settings.growthZone ?? "Cfb",
    lat: settings.lat,
    lng: settings.lng,
    placedPlants,
    seedlings,
    lastEvents: lastEvents as Map<string, Map<import("../../data/schema").GardenEventType, Date>>,
    weather,
  };
}
