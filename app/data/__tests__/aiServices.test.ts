/**
 * app/data/__tests__/aiServices.test.ts
 *
 * Unit tests for the AI service layer:
 *   - prompts.ts: normalizePlantName, buildPlantLookupUserPrompt, CONFIDENCE
 *   - plantCache.ts: key normalisation and in-memory get/set (without IndexedDB)
 *   - schema: PlantSchema accepts latinName
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizePlantName,
  buildPlantLookupUserPrompt,
  CONFIDENCE,
  PLANT_ALIASES,
  type PlantAIResponse,
} from "../../services/ai/prompts";
import { PlantCache } from "../../services/ai/plantCache";
import { PlantSchema } from "../schema";

// ---------------------------------------------------------------------------
// prompts.ts
// ---------------------------------------------------------------------------

describe("normalizePlantName", () => {
  it("lowercases and trims the name", () => {
    expect(normalizePlantName("  Tomato  ")).toBe("tomato");
  });

  it("maps known aliases", () => {
    expect(normalizePlantName("zucchini")).toBe("courgette");
    expect(normalizePlantName("arugula")).toBe("rocket");
    expect(normalizePlantName("cilantro")).toBe("coriander");
    expect(normalizePlantName("eggplant")).toBe("aubergine");
  });

  it("returns the normalised name unchanged when no alias matches", () => {
    expect(normalizePlantName("basil")).toBe("basil");
  });

  it("covers all documented PLANT_ALIASES entries", () => {
    for (const [input, expected] of Object.entries(PLANT_ALIASES)) {
      expect(normalizePlantName(input)).toBe(expected);
    }
  });
});

describe("buildPlantLookupUserPrompt", () => {
  it("includes the plant name", () => {
    const prompt = buildPlantLookupUserPrompt({ plantName: "Tomato" });
    expect(prompt).toContain('"Tomato"');
  });

  it("includes variety when provided", () => {
    const prompt = buildPlantLookupUserPrompt({
      plantName: "Tomato",
      variety: "Roma",
    });
    expect(prompt).toContain('"Roma"');
  });

  it("includes Köppen zone when provided", () => {
    const prompt = buildPlantLookupUserPrompt({
      plantName: "Basil",
      koeppenZone: "Cfb",
    });
    expect(prompt).toContain("Cfb");
  });

  it("includes coordinates when both lat and lng are provided", () => {
    const prompt = buildPlantLookupUserPrompt({
      plantName: "Basil",
      latitude: 52.37,
      longitude: 4.9,
    });
    expect(prompt).toContain("52.37");
    expect(prompt).toContain("4.9");
  });

  it("omits coordinates when only one is provided", () => {
    const prompt = buildPlantLookupUserPrompt({
      plantName: "Basil",
      latitude: 52.37,
    });
    expect(prompt).not.toContain("Coordinates");
  });
});

describe("CONFIDENCE thresholds", () => {
  it("are ordered correctly", () => {
    expect(CONFIDENCE.HIGH).toBeGreaterThan(CONFIDENCE.MEDIUM);
    expect(CONFIDENCE.MEDIUM).toBeGreaterThan(CONFIDENCE.LOW);
    expect(CONFIDENCE.LOW).toBeGreaterThan(CONFIDENCE.REJECT);
    expect(CONFIDENCE.REJECT).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// PlantCache — in-memory tier (no IndexedDB needed in tests)
// ---------------------------------------------------------------------------

describe("PlantCache (in-memory)", () => {
  const makeAiResponse = (name: string): PlantAIResponse => ({
    name,
    latinName: "Solanum lycopersicum",
    description: "A fruiting vegetable.",
    daysToHarvest: 75,
    spacingCm: 60,
    sunRequirement: "full",
    sowIndoorMonths: [2, 3],
    sowDirectMonths: [],
    harvestMonths: [7, 8, 9],
    companions: ["basil"],
    antagonists: ["fennel"],
    confidence: {
      latinName: 0.95,
      description: 0.9,
      daysToHarvest: 0.85,
      spacingCm: 0.8,
      sunRequirement: 0.95,
      sowIndoorMonths: 0.9,
      sowDirectMonths: 0.7,
      harvestMonths: 0.85,
      companions: 0.8,
      antagonists: 0.75,
    },
  });

  // Mock the Dexie db to avoid real IndexedDB calls in tests
  beforeEach(() => {
    vi.mock("../../data/dexieRepository", () => ({
      getGardenPlannerDB: () => ({
        aiPlantCache: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        },
      }),
    }));
  });

  it("returns null for an uncached plant", async () => {
    const cache = new PlantCache();
    const result = await cache.get("tomato");
    expect(result).toBeNull();
  });

  it("returns data after set()", async () => {
    const cache = new PlantCache();
    const data = makeAiResponse("tomato");
    await cache.set("tomato", data, "gemini");
    const result = await cache.get("tomato");
    expect(result).toEqual(data);
  });

  it("normalises the cache key (alias + case)", async () => {
    const cache = new PlantCache();
    const data = makeAiResponse("courgette");
    // Store with canonical name
    await cache.set("courgette", data, "gemini");
    // Retrieve with alias
    const result = await cache.get("zucchini");
    expect(result).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// schema.ts — latinName field
// ---------------------------------------------------------------------------

describe("PlantSchema.latinName", () => {
  const base = { id: "p1", name: "Tomato", color: "#ef4444", icon: "🍅" };

  it("is optional — plant without latinName is valid", () => {
    expect(PlantSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a valid latin name string", () => {
    const result = PlantSchema.safeParse({
      ...base,
      latinName: "Solanum lycopersicum",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.latinName).toBe("Solanum lycopersicum");
    }
  });
});
