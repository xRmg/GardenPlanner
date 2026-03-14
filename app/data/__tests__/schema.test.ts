/**
 * app/data/__tests__/schema.test.ts
 *
 * Validates that the Zod schemas accept valid data and reject invalid data.
 * Also exercises safeParse and parseWithDefaults helpers.
 */

import { describe, it, expect } from "vitest";
import {
  PlantSchema,
  AreaSchema,
  SeedlingSchema,
  SettingsSchema,
  StoredSettingsSchema,
  GardenEventSchema,
  PlanterSchema,
  PlantInstanceSchema,
  safeParse,
  parseWithDefaults,
} from "../schema";

// ---------------------------------------------------------------------------
// PlantSchema
// ---------------------------------------------------------------------------

describe("PlantSchema", () => {
  const validPlant = {
    id: "tomato",
    name: "Tomato",
    color: "#ef4444",
    icon: "🍅",
  };

  it("accepts a minimal valid plant", () => {
    const result = PlantSchema.safeParse(validPlant);
    expect(result.success).toBe(true);
  });

  it("applies defaults for optional array fields", () => {
    const result = PlantSchema.parse(validPlant);
    expect(result.companions).toEqual([]);
    expect(result.antagonists).toEqual([]);
    expect(result.sowIndoorMonths).toEqual([]);
    expect(result.isSeed).toBe(false);
    expect(result.source).toBe("bundled");
  });

  it("accepts optional care notes", () => {
    const result = PlantSchema.safeParse({
      ...validPlant,
      watering: "Keep evenly moist.",
      growingTips: "Harvest often.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts localized plant prose overrides", () => {
    const result = PlantSchema.safeParse({
      ...validPlant,
      description: "Legacy fallback description.",
      localizedContent: {
        nl: {
          description: "Nederlandse beschrijving.",
          watering: null,
          growingTips: "Regelmatig toppen.",
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects a plant with an empty name", () => {
    const result = PlantSchema.safeParse({ ...validPlant, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative daysToHarvest", () => {
    const result = PlantSchema.safeParse({
      ...validPlant,
      daysToHarvest: -5,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PlanterSchema
// ---------------------------------------------------------------------------

describe("PlanterSchema", () => {
  const validPlanter = {
    id: "p1",
    name: "Raised Bed",
    rows: 4,
    cols: 4,
  };

  it("accepts a valid planter", () => {
    expect(PlanterSchema.safeParse(validPlanter).success).toBe(true);
  });

  it("accepts a planter with squares", () => {
    const squares = Array(2)
      .fill(null)
      .map(() =>
        Array(2)
          .fill(null)
          .map(() => ({ plantInstance: null })),
      );
    const result = PlanterSchema.safeParse({
      ...validPlanter,
      rows: 2,
      cols: 2,
      squares,
    });
    expect(result.success).toBe(true);
  });

  it("rejects rows > 20", () => {
    expect(PlanterSchema.safeParse({ ...validPlanter, rows: 21 }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// AreaSchema
// ---------------------------------------------------------------------------

describe("AreaSchema", () => {
  const validArea = {
    id: "area-1",
    name: "Backyard",
    planters: [],
  };

  it("accepts a valid area", () => {
    expect(AreaSchema.safeParse(validArea).success).toBe(true);
  });

  it("defaults profileId to 'default'", () => {
    const result = AreaSchema.parse(validArea);
    expect(result.profileId).toBe("default");
  });

  it("rejects an area with empty name", () => {
    expect(AreaSchema.safeParse({ ...validArea, name: "" }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// SeedlingSchema
// ---------------------------------------------------------------------------

describe("SeedlingSchema", () => {
  const validSeedling = {
    id: "s1",
    plant: {
      id: "tomato",
      name: "Tomato",
      color: "#ef4444",
      icon: "🍅",
    },
    plantedDate: new Date().toISOString(),
    seedCount: 10,
    location: "Greenhouse",
    status: "germinating",
  };

  it("accepts a valid seedling", () => {
    expect(SeedlingSchema.safeParse(validSeedling).success).toBe(true);
  });

  it("rejects seedCount of 0", () => {
    expect(
      SeedlingSchema.safeParse({ ...validSeedling, seedCount: 0 }).success,
    ).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(
      SeedlingSchema.safeParse({ ...validSeedling, status: "dead" }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SettingsSchema
// ---------------------------------------------------------------------------

describe("SettingsSchema", () => {
  it("applies defaults on empty object", () => {
    const result = SettingsSchema.parse({});
    expect(result.location).toBe("");
    expect(result.growthZone).toBe("Cfb");
    expect(result.locale).toBe("en");
    expect(result.aiProvider).toEqual({ type: "none" });
  });

  it("rejects a stored BYOK AI provider in the frontend-safe settings DTO", () => {
    const result = SettingsSchema.safeParse({
      aiProvider: { type: "byok", key: "sk-test-key" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a BYOK AI provider in the stored settings schema", () => {
    const result = StoredSettingsSchema.safeParse({
      aiProvider: { type: "byok", key: "sk-test-key" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a BYOK AI provider with empty key in the stored settings schema", () => {
    const result = StoredSettingsSchema.safeParse({
      aiProvider: { type: "byok", key: "" },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GardenEventSchema
// ---------------------------------------------------------------------------

describe("GardenEventSchema", () => {
  it("accepts a valid planted event", () => {
    const result = GardenEventSchema.safeParse({
      id: "e1",
      type: "planted",
      date: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("accepts a pest event with a note", () => {
    const result = GardenEventSchema.safeParse({
      id: "e-pest-1",
      type: "pest",
      date: new Date().toISOString(),
      note: "Found aphids on new growth",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const result = GardenEventSchema.safeParse({
      id: "e2",
      type: "unknown",
      date: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PlantInstanceSchema
// ---------------------------------------------------------------------------

describe("PlantInstanceSchema", () => {
  const validInstance = {
    instanceId: "inst-1",
    plant: {
      id: "carrot",
      name: "Carrot",
      color: "#f97316",
      icon: "🥕",
    },
  };

  it("accepts a valid instance", () => {
    expect(PlantInstanceSchema.safeParse(validInstance).success).toBe(true);
  });

  it("defaults pestEvents to empty array", () => {
    const result = PlantInstanceSchema.parse(validInstance);
    expect(result.pestEvents).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe("safeParse", () => {
  it("returns null and logs a warning for invalid data", () => {
    const result = safeParse(PlantSchema, { id: 123 }, "test plant");
    expect(result).toBeNull();
  });

  it("returns parsed data for valid input", () => {
    const plant = { id: "x", name: "X", color: "#fff", icon: "🌱" };
    const result = safeParse(PlantSchema, plant, "test plant");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("x");
  });
});

describe("parseWithDefaults", () => {
  it("merges partial data with schema defaults", () => {
    const result = parseWithDefaults(SettingsSchema, { location: "Amsterdam" });
    expect(result.location).toBe("Amsterdam");
    expect(result.growthZone).toBe("Cfb"); // default
  });

  it("falls back to defaults on completely invalid data", () => {
    const result = parseWithDefaults(SettingsSchema, "not-an-object");
    expect(result.growthZone).toBe("Cfb");
  });
});
