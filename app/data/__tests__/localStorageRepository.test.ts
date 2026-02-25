/**
 * app/data/__tests__/localStorageRepository.test.ts
 *
 * Tests for the LocalStorageRepository — ensures areas, plants, seedlings,
 * settings, and events are correctly persisted and retrieved.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  LocalStorageRepository,
  getLocalStorageRepository,
} from "../localStorageRepository";
import type { Area, Plant, Seedling, Settings, GardenEvent } from "../schema";

// jsdom provides localStorage; clear it before each test.
beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeArea(id = "a1"): Area {
  return {
    id,
    name: "Backyard",
    profileId: "default",
    planters: [],
  };
}

function makePlant(id = "tomato"): Plant {
  return {
    id,
    name: "Tomato",
    color: "#ef4444",
    icon: "🍅",
    isSeed: false,
    source: "custom",
    companions: [],
    antagonists: [],
    sowIndoorMonths: [],
    sowDirectMonths: [],
    harvestMonths: [],
  };
}

function makeSeedling(id = "s1"): Seedling {
  return {
    id,
    plant: makePlant(),
    plantedDate: new Date().toISOString(),
    seedCount: 5,
    location: "Greenhouse",
    status: "germinating",
  };
}

function makeSettings(): Settings {
  return {
    location: "Amsterdam",
    growthZone: "8b",
    weatherProvider: "open-meteo",
    aiProvider: { type: "none" },
    locale: "en",
    profileId: "default",
  };
}

function makeEvent(id = "e1"): GardenEvent {
  return {
    id,
    type: "planted",
    date: new Date().toISOString(),
    profileId: "default",
  };
}

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

describe("LocalStorageRepository — areas", () => {
  it("returns [] when no areas stored", async () => {
    const repo = new LocalStorageRepository();
    expect(await repo.getAreas()).toEqual([]);
  });

  it("saves and retrieves an area", async () => {
    const repo = new LocalStorageRepository();
    const area = makeArea();
    await repo.saveArea(area);
    const areas = await repo.getAreas();
    expect(areas).toHaveLength(1);
    expect(areas[0].id).toBe("a1");
  });

  it("updates an existing area on second save", async () => {
    const repo = new LocalStorageRepository();
    await repo.saveArea(makeArea());
    await repo.saveArea({ ...makeArea(), name: "Front Yard" });
    const areas = await repo.getAreas();
    expect(areas).toHaveLength(1);
    expect(areas[0].name).toBe("Front Yard");
  });

  it("deletes an area", async () => {
    const repo = new LocalStorageRepository();
    await repo.saveArea(makeArea("a1"));
    await repo.saveArea(makeArea("a2"));
    await repo.deleteArea("a1");
    const areas = await repo.getAreas();
    expect(areas).toHaveLength(1);
    expect(areas[0].id).toBe("a2");
  });

  it("persists planter squares in area", async () => {
    const repo = new LocalStorageRepository();
    const area: Area = {
      ...makeArea(),
      planters: [
        {
          id: "p1",
          name: "Bed",
          rows: 2,
          cols: 2,
          squares: [
            [
              {
                plantInstance: {
                  instanceId: "inst-1",
                  plant: makePlant(),
                  pestEvents: [],
                },
              },
              { plantInstance: null },
            ],
            [{ plantInstance: null }, { plantInstance: null }],
          ],
          virtualSections: [],
        },
      ],
    };
    await repo.saveArea(area);
    const [loaded] = await repo.getAreas();
    expect(loaded.planters[0].squares?.[0][0].plantInstance?.instanceId).toBe(
      "inst-1",
    );
  });
});

// ---------------------------------------------------------------------------
// Custom plants
// ---------------------------------------------------------------------------

describe("LocalStorageRepository — customPlants", () => {
  it("saves and retrieves a custom plant", async () => {
    const repo = new LocalStorageRepository();
    await repo.savePlant(makePlant());
    expect(await repo.getCustomPlants()).toHaveLength(1);
  });

  it("deletes a plant", async () => {
    const repo = new LocalStorageRepository();
    await repo.savePlant(makePlant("p1"));
    await repo.savePlant(makePlant("p2"));
    await repo.deletePlant("p1");
    const plants = await repo.getCustomPlants();
    expect(plants).toHaveLength(1);
    expect(plants[0].id).toBe("p2");
  });
});

// ---------------------------------------------------------------------------
// Seedlings
// ---------------------------------------------------------------------------

describe("LocalStorageRepository — seedlings", () => {
  it("saves and retrieves a seedling", async () => {
    const repo = new LocalStorageRepository();
    await repo.saveSeedling(makeSeedling());
    expect(await repo.getSeedlings()).toHaveLength(1);
  });

  it("deletes a seedling", async () => {
    const repo = new LocalStorageRepository();
    await repo.saveSeedling(makeSeedling("s1"));
    await repo.saveSeedling(makeSeedling("s2"));
    await repo.deleteSeedling("s1");
    const seedlings = await repo.getSeedlings();
    expect(seedlings).toHaveLength(1);
    expect(seedlings[0].id).toBe("s2");
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe("LocalStorageRepository — settings", () => {
  it("returns schema defaults when nothing stored", async () => {
    const repo = new LocalStorageRepository();
    const settings = await repo.getSettings();
    expect(settings.growthZone).toBe("6b");
    expect(settings.locale).toBe("en");
  });

  it("persists and retrieves custom settings", async () => {
    const repo = new LocalStorageRepository();
    await repo.saveSettings(makeSettings());
    const settings = await repo.getSettings();
    expect(settings.location).toBe("Amsterdam");
    expect(settings.growthZone).toBe("8b");
  });
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe("LocalStorageRepository — events", () => {
  it("saves and retrieves an event", async () => {
    const repo = new LocalStorageRepository();
    await repo.saveEvent(makeEvent());
    expect(await repo.getEvents()).toHaveLength(1);
  });

  it("returns events newest-first", async () => {
    const repo = new LocalStorageRepository();
    const older: GardenEvent = {
      ...makeEvent("e1"),
      date: new Date(Date.now() - 10000).toISOString(),
    };
    const newer: GardenEvent = {
      ...makeEvent("e2"),
      date: new Date().toISOString(),
    };
    await repo.saveEvent(older);
    await repo.saveEvent(newer);
    const events = await repo.getEvents();
    expect(events[0].id).toBe("e2");
    expect(events[1].id).toBe("e1");
  });

  it("deletes an event", async () => {
    const repo = new LocalStorageRepository();
    await repo.saveEvent(makeEvent("e1"));
    await repo.saveEvent(makeEvent("e2"));
    await repo.deleteEvent("e1");
    const events = await repo.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("e2");
  });
});

// ---------------------------------------------------------------------------
// clearAll
// ---------------------------------------------------------------------------

describe("LocalStorageRepository — clearAll", () => {
  it("wipes all data", async () => {
    const repo = new LocalStorageRepository();
    await repo.saveArea(makeArea());
    await repo.savePlant(makePlant());
    await repo.clearAll();
    expect(await repo.getAreas()).toEqual([]);
    expect(await repo.getCustomPlants()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

describe("getLocalStorageRepository", () => {
  it("returns the same instance each call", () => {
    const a = getLocalStorageRepository();
    const b = getLocalStorageRepository();
    expect(a).toBe(b);
  });
});
