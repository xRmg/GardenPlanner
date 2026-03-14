/**
 * app/data/__tests__/rulesEngine.test.ts
 *
 * Unit tests for the suggestion rules engine.
 * Each rule is tested with its primary trigger conditions and cooldown logic.
 */

import { describe, it, expect } from "vitest";
import {
  runRules,
  buildRuleContext,
} from "../../services/suggestions/rulesEngine";
import { mergeSuggestions } from "../../services/suggestions/merger";
import type {
  RuleContext,
  PlacedPlant,
} from "../../services/suggestions/types";
import type { Area, GardenEvent, Plant, Settings } from "../schema";

// ---------------------------------------------------------------------------
// Test helpers
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

function makePlacedPlant(overrides: Partial<PlacedPlant> = {}): PlacedPlant {
  return {
    instanceId: "inst-1",
    plant: makePlant(),
    pestEvents: [],
    planterId: "planter-1",
    planterName: "Raised Bed A",
    areaId: "area-1",
    areaName: "Garden",
    adjacentPlantNames: [],
    growthStage: null,
    healthState: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    currentMonth: 5, // May
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

function makeWeather(
  overrides: Partial<import("../../services/weather").WeatherData> = {},
): import("../../services/weather").WeatherData {
  const today = "2026-05-15";
  // Past 7 days + today + next 6 days
  const dailyDates = [
    "2026-05-13",
    "2026-05-14",
    today,
    "2026-05-16",
    "2026-05-17",
    "2026-05-18",
    "2026-05-19",
    "2026-05-20",
    "2026-05-21",
  ];
  return {
    fetchedAt: new Date().toISOString(),
    lat: 52,
    lng: 4,
    current: {
      tempC: 18,
      relativeHumidityPct: 65,
      precipMm: 0,
      weatherCode: 1,
      isDay: true,
    },
    daily: dailyDates.map((date) => ({
      date,
      tempMaxC: 20,
      tempMinC: 10,
      precipSumMm: 1,
      rainSumMm: 1,
      precipProbabilityMax: 20,
      et0Fao: 3,
      weatherCode: 1,
    })),
    hourly: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Watering rule
// ---------------------------------------------------------------------------

describe("watering rule", () => {
  it("fires when water budget is negative and temperature is high", () => {
    const today = "2026-05-15";
    const weather = makeWeather({
      daily: [
        // Past 5 days: very little rain, high ET
        {
          date: "2026-05-10",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-11",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-12",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-13",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-14",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: today,
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-16",
          tempMaxC: 25,
          tempMinC: 12,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 5,
          weatherCode: 1,
        },
        {
          date: "2026-05-17",
          tempMaxC: 25,
          tempMinC: 12,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 5,
          weatherCode: 1,
        },
        {
          date: "2026-05-18",
          tempMaxC: 25,
          tempMinC: 12,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 5,
          weatherCode: 1,
        },
      ],
    });

    const ctx = makeContext({
      placedPlants: [makePlacedPlant()],
      weather,
    });

    const results = runRules(ctx);
    const waterResult = results.find((r) => r.type === "water");
    expect(waterResult).toBeTruthy();
    expect(waterResult?.priority).toBe("high"); // budget < -10, temp >= 25
  });

  it("does not fire when recently watered (cooldown)", () => {
    const weather = makeWeather({
      daily: [
        {
          date: "2026-05-10",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-11",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-12",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-13",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-14",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-15",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-16",
          tempMaxC: 25,
          tempMinC: 12,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 5,
          weatherCode: 1,
        },
        {
          date: "2026-05-17",
          tempMaxC: 25,
          tempMinC: 12,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 5,
          weatherCode: 1,
        },
        {
          date: "2026-05-18",
          tempMaxC: 25,
          tempMinC: 12,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 5,
          weatherCode: 1,
        },
      ],
    });

    const lastEvents = new Map<string, Map<string, Date>>();
    // Watered yesterday
    lastEvents.set(
      "planter-1:global",
      new Map([["watered", new Date("2026-05-14T08:00:00Z")]]),
    );

    const ctx = makeContext({
      placedPlants: [makePlacedPlant()],
      weather,
      lastEvents: lastEvents as Map<
        string,
        Map<import("../schema").GardenEventType, Date>
      >,
    });

    const results = runRules(ctx);
    const waterResult = results.find((r) => r.type === "water");
    expect(waterResult).toBeUndefined();
  });

  it("does not fire without weather data", () => {
    const ctx = makeContext({
      placedPlants: [makePlacedPlant()],
      weather: null,
    });

    const results = runRules(ctx);
    const waterResult = results.find((r) => r.type === "water");
    expect(waterResult).toBeUndefined();
  });
});

describe("suggestion localization", () => {
  it("localizes rule descriptions using the active locale", () => {
    const ctx = makeContext({
      locale: "nl",
      placedPlants: [
        makePlacedPlant({
          plant: makePlant({
            id: "tomato",
            name: "Tomato",
            daysToHarvest: 60,
          }),
          plantingDate: "2026-03-01T00:00:00.000Z",
        }),
      ],
    });

    const harvestResult = runRules(ctx).find((result) => result.type === "harvest");

    expect(harvestResult?.description).toBe(
      "Tomaat is al aan oogst toe — oogst nu om doorschieten te voorkomen",
    );
  });

  it("localizes empty-state static tips", () => {
    const suggestions = mergeSuggestions([], [], true, "nl");

    expect(suggestions[0]?.description).toBe(
      "Voeg planten toe aan je planters om persoonlijke suggesties te krijgen",
    );
    expect(suggestions[1]?.description).toBe(
      "Probeer combinatieteelt — basilicum en tomaten groeien goed samen",
    );
  });
});

// ---------------------------------------------------------------------------
// No-water rule
// ---------------------------------------------------------------------------

describe("no-water rule", () => {
  it("fires when rain is forecast and watering would otherwise trigger", () => {
    const today = "2026-05-15";
    const weather = makeWeather({
      daily: [
        // Past: dry and hot → would trigger watering
        {
          date: "2026-05-10",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-11",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-12",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-13",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        {
          date: "2026-05-14",
          tempMaxC: 28,
          tempMinC: 15,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 6,
          weatherCode: 1,
        },
        // Today: rain forecast with high probability
        {
          date: today,
          tempMaxC: 20,
          tempMinC: 12,
          precipSumMm: 12,
          rainSumMm: 12,
          precipProbabilityMax: 85,
          et0Fao: 2,
          weatherCode: 63,
        },
        {
          date: "2026-05-16",
          tempMaxC: 18,
          tempMinC: 10,
          precipSumMm: 8,
          rainSumMm: 8,
          precipProbabilityMax: 80,
          et0Fao: 1,
          weatherCode: 61,
        },
        {
          date: "2026-05-17",
          tempMaxC: 18,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 20,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-18",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 15,
          et0Fao: 3,
          weatherCode: 1,
        },
      ],
    });

    const ctx = makeContext({
      placedPlants: [makePlacedPlant()],
      weather,
    });

    const results = runRules(ctx);
    // Should have no-water instead of water
    const noWaterResult = results.find((r) => r.type === "no_water");
    const waterResult = results.find((r) => r.type === "water");
    expect(noWaterResult).toBeTruthy();
    expect(waterResult).toBeUndefined(); // mutually exclusive
  });
});

// ---------------------------------------------------------------------------
// Weeding rule
// ---------------------------------------------------------------------------

describe("weeding rule", () => {
  it("fires during growing season without weather when overdue", () => {
    const lastEvents = new Map<string, Map<string, Date>>();
    // Last weeded 20 days ago
    lastEvents.set(
      "planter-1:global",
      new Map([["weeded", new Date("2026-04-25T08:00:00Z")]]),
    );

    const ctx = makeContext({
      currentMonth: 5,
      placedPlants: [makePlacedPlant()],
      lastEvents: lastEvents as Map<
        string,
        Map<import("../schema").GardenEventType, Date>
      >,
    });

    const results = runRules(ctx);
    const weedResult = results.find((r) => r.type === "weed");
    expect(weedResult).toBeTruthy();
    expect(weedResult?.priority).toBe("medium"); // overdue 20 days
  });

  it("does not fire in winter months (northern hemisphere)", () => {
    const ctx = makeContext({
      currentMonth: 1, // January
      lat: 52,
      placedPlants: [makePlacedPlant()],
    });

    const results = runRules(ctx);
    const weedResult = results.find((r) => r.type === "weed");
    expect(weedResult).toBeUndefined();
  });

  it("respects 7-day cooldown", () => {
    const lastEvents = new Map<string, Map<string, Date>>();
    // Weeded 3 days ago
    lastEvents.set(
      "planter-1:global",
      new Map([["weeded", new Date("2026-05-12T08:00:00Z")]]),
    );

    const ctx = makeContext({
      currentMonth: 5,
      placedPlants: [makePlacedPlant()],
      lastEvents: lastEvents as Map<
        string,
        Map<import("../schema").GardenEventType, Date>
      >,
    });

    const results = runRules(ctx);
    const weedResult = results.find((r) => r.type === "weed");
    expect(weedResult).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Harvesting rule
// ---------------------------------------------------------------------------

describe("harvesting rule", () => {
  it("fires when plant is past its daysToHarvest", () => {
    const plantingDate = new Date("2026-01-01T00:00:00Z").toISOString();
    const plant = makePlant({ daysToHarvest: 60 }); // 60 days → should harvest around Mar 2
    const placed = makePlacedPlant({
      plant,
      plantingDate,
      // today is May 15 = 134 days after Jan 1 → well past 60 days
    });

    const ctx = makeContext({
      placedPlants: [placed],
    });

    const results = runRules(ctx);
    const harvestResult = results.find((r) => r.type === "harvest");
    expect(harvestResult).toBeTruthy();
    expect(harvestResult?.priority).toBe("high"); // overdue by > 7 days
  });

  it("fires when current month is in harvestMonths", () => {
    const plant = makePlant({ harvestMonths: [5, 6, 7] }); // May, June, July
    const placed = makePlacedPlant({ plant });

    const ctx = makeContext({
      currentMonth: 5,
      placedPlants: [placed],
    });

    const results = runRules(ctx);
    const harvestResult = results.find((r) => r.type === "harvest");
    expect(harvestResult).toBeTruthy();
  });

  it("does not fire if recently harvested", () => {
    const plantingDate = new Date("2026-01-01T00:00:00Z").toISOString();
    const plant = makePlant({ daysToHarvest: 60 });
    const placed = makePlacedPlant({ plant, plantingDate });

    const lastEvents = new Map<string, Map<string, Date>>();
    // Harvested 10 days ago
    lastEvents.set(
      "planter-1:inst-1",
      new Map([["harvested", new Date("2026-05-05T08:00:00Z")]]),
    );

    const ctx = makeContext({
      placedPlants: [placed],
      lastEvents: lastEvents as Map<
        string,
        Map<import("../schema").GardenEventType, Date>
      >,
    });

    const results = runRules(ctx);
    const harvestResult = results.find((r) => r.type === "harvest");
    expect(harvestResult).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fertilization rule
// ---------------------------------------------------------------------------

describe("fertilization rule", () => {
  it("fires during growing season when never fertilized", () => {
    const ctx = makeContext({
      currentMonth: 5,
      placedPlants: [makePlacedPlant()],
    });

    const results = runRules(ctx);
    const fertResult = results.find((r) => r.type === "fertilize");
    expect(fertResult).toBeTruthy();
    expect(fertResult?.priority).toBe("high"); // never fertilized
  });

  it("does not fire in winter", () => {
    const ctx = makeContext({
      currentMonth: 1,
      lat: 52,
      placedPlants: [makePlacedPlant()],
    });

    const results = runRules(ctx);
    const fertResult = results.find((r) => r.type === "fertilize");
    expect(fertResult).toBeUndefined();
  });

  it("does not fire when recently composted", () => {
    const lastEvents = new Map<string, Map<string, Date>>();
    // Composted 10 days ago
    lastEvents.set(
      "planter-1:global",
      new Map([["composted", new Date("2026-05-05T08:00:00Z")]]),
    );

    const ctx = makeContext({
      currentMonth: 5,
      placedPlants: [makePlacedPlant()],
      lastEvents: lastEvents as Map<
        string,
        Map<import("../schema").GardenEventType, Date>
      >,
    });

    const results = runRules(ctx);
    const fertResult = results.find((r) => r.type === "fertilize");
    expect(fertResult).toBeUndefined();
  });

  it("suppresses fertilization when heavy rain is forecast", () => {
    const today = "2026-05-15";
    const weather = makeWeather({
      daily: [
        {
          date: "2026-05-13",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 2,
          rainSumMm: 2,
          precipProbabilityMax: 30,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-14",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 2,
          rainSumMm: 2,
          precipProbabilityMax: 30,
          et0Fao: 3,
          weatherCode: 1,
        },
        // Today and tomorrow: heavy rain forecast
        {
          date: today,
          tempMaxC: 15,
          tempMinC: 8,
          precipSumMm: 10,
          rainSumMm: 10,
          precipProbabilityMax: 90,
          et0Fao: 1,
          weatherCode: 63,
        },
        {
          date: "2026-05-16",
          tempMaxC: 15,
          tempMinC: 8,
          precipSumMm: 8,
          rainSumMm: 8,
          precipProbabilityMax: 85,
          et0Fao: 1,
          weatherCode: 61,
        },
        {
          date: "2026-05-17",
          tempMaxC: 18,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 15,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-18",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-19",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-20",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-21",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 3,
          weatherCode: 1,
        },
      ],
    });

    const ctx = makeContext({
      currentMonth: 5,
      placedPlants: [makePlacedPlant()],
      weather,
    });

    const results = runRules(ctx);
    const fertResult = results.find((r) => r.type === "fertilize");
    expect(fertResult).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Sowing rule
// ---------------------------------------------------------------------------

describe("sowing rule", () => {
  it("suggests indoor sowing when month is in sowIndoorMonths (previous-season plant)", () => {
    // A plant from last season (has a plantingDate from last year) with sow windows
    // open right now → should suggest starting a new batch
    const plant = makePlant({
      id: "pepper",
      name: "Pepper",
      sowIndoorMonths: [3, 4, 5], // March–May
    });
    const placed = makePlacedPlant({
      plant,
      plantingDate: "2025-06-01T00:00:00.000Z", // planted LAST year → not "this season"
    });

    const ctx = makeContext({
      currentMonth: 4,
      today: new Date("2026-04-15T00:00:00.000Z"),
      placedPlants: [placed],
    });

    const results = runRules(ctx);
    const sowResult = results.find((r) => r.type === "sow");
    expect(sowResult).toBeTruthy();
  });

  it("does not suggest sowing if plant is already active", () => {
    // The plant is in placedPlants (active), so we won't suggest re-sowing
    const plant = makePlant({
      id: "tomato",
      name: "Tomato",
      sowIndoorMonths: [3, 4, 5],
    });
    const placed = makePlacedPlant({ plant });

    const ctx = makeContext({
      currentMonth: 4,
      // placedPlants contains the plant, so "Tomato" is active
      placedPlants: [placed],
    });

    const results = runRules(ctx);
    // The sow rule should NOT fire because "tomato" is already in placedPlants
    const sowResults = results.filter((r) => r.type === "sow");
    // All sow suggestions for "tomato" should be absent
    const tomatoSow = sowResults.find(
      (r) => r.key.includes("tomato") || r.key.includes("Tomato"),
    );
    expect(tomatoSow).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Frost protection rule
// ---------------------------------------------------------------------------

describe("frost protection rule", () => {
  it("fires when frost is forecast and frost-sensitive plant is present", () => {
    const plant = makePlant({
      id: "basil",
      name: "Basil",
      frostSensitive: true,
    });
    const placed = makePlacedPlant({ plant });

    const today = "2026-05-15";
    const weather = makeWeather({
      daily: [
        {
          date: "2026-05-13",
          tempMaxC: 15,
          tempMinC: 8,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-14",
          tempMaxC: 15,
          tempMinC: 8,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: today,
          tempMaxC: 10,
          tempMinC: 1,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 10,
          et0Fao: 1,
          weatherCode: 1,
        }, // frost!
        {
          date: "2026-05-16",
          tempMaxC: 12,
          tempMinC: -1,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 1,
          weatherCode: 1,
        },
        {
          date: "2026-05-17",
          tempMaxC: 15,
          tempMinC: 4,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 2,
          weatherCode: 1,
        },
        {
          date: "2026-05-18",
          tempMaxC: 18,
          tempMinC: 8,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-19",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-20",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-21",
          tempMaxC: 20,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 3,
          weatherCode: 1,
        },
      ],
    });

    const ctx = makeContext({
      placedPlants: [placed],
      weather,
    });

    const results = runRules(ctx);
    const frostResult = results.find((r) => r.type === "frost_protect");
    expect(frostResult).toBeTruthy();
    expect(frostResult?.priority).toBe("high");
  });

  it("does not fire when all plants are frost-hardy", () => {
    const plant = makePlant({
      frostHardy: true,
      frostSensitive: false,
    });
    const placed = makePlacedPlant({ plant });

    const today = "2026-05-15";
    const weather = makeWeather({
      daily: [
        {
          date: "2026-05-13",
          tempMaxC: 8,
          tempMinC: 1,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 1,
          weatherCode: 1,
        },
        {
          date: "2026-05-14",
          tempMaxC: 8,
          tempMinC: 1,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 1,
          weatherCode: 1,
        },
        {
          date: today,
          tempMaxC: 8,
          tempMinC: 1,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 1,
          weatherCode: 1,
        },
        {
          date: "2026-05-16",
          tempMaxC: 8,
          tempMinC: -1,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 1,
          weatherCode: 1,
        },
        {
          date: "2026-05-17",
          tempMaxC: 10,
          tempMinC: 2,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 2,
          weatherCode: 1,
        },
        {
          date: "2026-05-18",
          tempMaxC: 12,
          tempMinC: 4,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 2,
          weatherCode: 1,
        },
        {
          date: "2026-05-19",
          tempMaxC: 14,
          tempMinC: 6,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-20",
          tempMaxC: 16,
          tempMinC: 8,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 3,
          weatherCode: 1,
        },
        {
          date: "2026-05-21",
          tempMaxC: 18,
          tempMinC: 10,
          precipSumMm: 0,
          rainSumMm: 0,
          precipProbabilityMax: 5,
          et0Fao: 3,
          weatherCode: 1,
        },
      ],
    });

    const ctx = makeContext({
      placedPlants: [placed],
      weather,
    });

    const results = runRules(ctx);
    const frostResult = results.find((r) => r.type === "frost_protect");
    expect(frostResult).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Treatment rule
// ---------------------------------------------------------------------------

describe("treatment rule", () => {
  it("creates a next-step treatment suggestion for an unresolved pest note", () => {
    const placed = makePlacedPlant({
      plant: makePlant({ id: "strawberry", name: "Strawberry" }),
      pestEvents: [
        {
          id: "pest-1",
          date: "2026-05-14T09:00:00.000Z",
          type: "pest",
          description: "cabbage fly",
        },
      ],
    });

    const ctx = makeContext({
      today: new Date("2026-05-15T00:00:00.000Z"),
      placedPlants: [placed],
    });

    const results = runRules(ctx);
    const treatmentResult = results.find((r) => r.type === "treatment");
    expect(treatmentResult).toBeTruthy();
    expect(treatmentResult?.plant?.name).toBe("Strawberry");
    expect(treatmentResult?.priority).toBe("high");
  });

  it("does not create a treatment suggestion when a later treatment note exists", () => {
    const placed = makePlacedPlant({
      pestEvents: [
        {
          id: "pest-1",
          date: "2026-05-10T09:00:00.000Z",
          type: "pest",
          description: "aphids",
        },
        {
          id: "treatment-1",
          date: "2026-05-12T09:00:00.000Z",
          type: "treatment",
          description: "sprayed with soap",
        },
      ],
    });

    const ctx = makeContext({
      today: new Date("2026-05-15T00:00:00.000Z"),
      placedPlants: [placed],
    });

    const results = runRules(ctx);
    const treatmentResult = results.find((r) => r.type === "treatment");
    expect(treatmentResult).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildRuleContext
// ---------------------------------------------------------------------------

describe("buildRuleContext", () => {
  it("builds a context with placed plants from areas", () => {
    const plant = makePlant();
    const area: Area = {
      id: "area-1",
      name: "Garden",
      planters: [
        {
          id: "planter-1",
          name: "Raised Bed A",
          rows: 2,
          cols: 2,
          squares: [
            [
              {
                plantInstance: { instanceId: "inst-1", plant, pestEvents: [], growthStage: null, growthStageOverride: false, healthState: null },
              },
              { plantInstance: null },
            ],
            [{ plantInstance: null }, { plantInstance: null }],
          ],
          virtualSections: [],
        },
      ],
      profileId: "default",
    };

    const settings: Settings = {
      location: "Amsterdam",
      growthZone: "Cfb",
      aiProvider: { type: "none" },
      aiModel: "google/gemini-2.0-flash",
      locale: "en",
      lat: 52.3,
      lng: 4.9,
      profileId: "default",
      isEditMode: false,
    };

    const ctx = buildRuleContext({
      areas: [area],
      seedlings: [],
      events: [],
      settings,
      weather: null,
    });

    expect(ctx.placedPlants).toHaveLength(1);
    expect(ctx.placedPlants[0].plant.name).toBe("Tomato");
    expect(ctx.placedPlants[0].planterId).toBe("planter-1");
    expect(ctx.koeppenZone).toBe("Cfb");
    expect(ctx.lat).toBe(52.3);
  });

  it("builds lastEvents map from events array", () => {
    const plant = makePlant();
    const area: Area = {
      id: "area-1",
      name: "Garden",
      planters: [
        {
          id: "planter-1",
          name: "Raised Bed A",
          rows: 1,
          cols: 1,
          squares: [
            [
              {
                plantInstance: { instanceId: "inst-1", plant, pestEvents: [], growthStage: null, growthStageOverride: false, healthState: null },
              },
            ],
          ],
          virtualSections: [],
        },
      ],
      profileId: "default",
    };

    const events: GardenEvent[] = [
      {
        id: "ev-1",
        type: "watered",
        date: "2026-05-10T10:00:00+00:00",
        gardenId: "planter-1",
        profileId: "default",
      },
    ];

    const settings: Settings = {
      location: "",
      growthZone: "Cfb",
      aiProvider: { type: "none" },
      aiModel: "google/gemini-2.0-flash",
      locale: "en",
      profileId: "default",
      isEditMode: false,
    };

    const ctx = buildRuleContext({
      areas: [area],
      seedlings: [],
      events,
      settings,
      weather: null,
    });

    const globalKey = "planter-1:global";
    expect(ctx.lastEvents.has(globalKey)).toBe(true);
    expect(ctx.lastEvents.get(globalKey)?.get("watered")).toBeInstanceOf(Date);
  });
});
