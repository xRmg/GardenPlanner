// @vitest-environment node
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeSchema } from "../src/schema";
import { readGardenState, replaceGardenState } from "../src/gardenStore";

const plant = {
  id: "tomato",
  name: "Tomato",
  color: "#ef4444",
  icon: "🍅",
  isSeed: false,
  daysToHarvest: 70,
  daysToFlower: 40,
  daysToFruit: 55,
  companions: ["basil"],
  antagonists: [],
  sowIndoorMonths: [3],
  sowDirectMonths: [],
  harvestMonths: [8],
  source: "custom",
};

const area = {
  id: "area-1",
  name: "Backyard",
  profileId: "default",
  planters: [
    {
      id: "planter-1",
      name: "Bed A",
      rows: 1,
      cols: 2,
      virtualSections: [],
      layout: "pot-container",
      cellDimensions: { width: 30, depth: 30, unit: "cm" },
      squares: [[{ plantInstance: null }, { plantInstance: null }]],
    },
    { id: "planter-2", name: "Bed B", rows: 1, cols: 1, virtualSections: [] },
  ],
};

const event = {
  id: "event-1",
  type: "watered",
  date: "2026-05-01T08:00:00.000Z",
  profileId: "default",
  scope: "planter",
  gardenId: "planter-1",
  areaId: "area-1",
  planterName: "Bed A",
  areaName: "Backyard",
  instanceId: "inst-1",
  suggestionType: "water",
  suggestionDescription: "Water Bed A",
  suggestionSource: "rules",
};

const seedling = {
  id: "seedling-1",
  plant,
  plantedDate: "2026-03-01T00:00:00.000Z",
  seedCount: 6,
  location: "Windowsill",
  method: "indoor",
  status: "germinating",
};

describe("gardenStore", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
  });

  it("round-trips every field, including ones without dedicated columns", () => {
    replaceGardenState(db, {
      areas: [area],
      plants: [plant],
      seedlings: [seedling],
      events: [event],
    });

    const state = readGardenState(db);
    expect(state.plants).toEqual([plant]);
    expect(state.areas).toEqual([area]);
    expect(state.seedlings).toEqual([seedling]);
    expect(state.events).toEqual([event]);
  });

  it("only replaces collections present in the payload", () => {
    replaceGardenState(db, { areas: [area], events: [event] });
    replaceGardenState(db, { events: [] });

    const state = readGardenState(db);
    expect(state.areas).toHaveLength(1);
    expect(state.events).toHaveLength(0);
  });

  it("reads legacy rows that predate the data snapshot column", () => {
    db.prepare(
      "INSERT INTO areas (id, name, profileId) VALUES ('legacy', 'Old area', 'default')",
    ).run();
    db.prepare(
      `INSERT INTO planters (id, areaId, name, rows, cols, virtualSections)
       VALUES ('legacy-p', 'legacy', 'Old bed', 2, 3, '[]')`,
    ).run();
    db.prepare(
      `INSERT INTO events (id, type, date, note, profileId)
       VALUES ('legacy-e', 'weeded', '2025-06-01T00:00:00.000Z', 'Pulled weeds', 'default')`,
    ).run();

    const state = readGardenState(db);
    expect(state.areas[0]).toMatchObject({
      id: "legacy",
      name: "Old area",
      planters: [{ id: "legacy-p", rows: 2, cols: 3, virtualSections: [] }],
    });
    expect(state.events[0]).toMatchObject({
      id: "legacy-e",
      type: "weeded",
      note: "Pulled weeds",
    });
  });

  it("rolls back the whole sync when a record is invalid", () => {
    replaceGardenState(db, { areas: [area] });
    expect(() =>
      replaceGardenState(db, { areas: [{ id: "broken" }] }),
    ).toThrow();
    expect(readGardenState(db).areas).toEqual([area]);
  });

  it("keeps planter order within an area", () => {
    replaceGardenState(db, { areas: [area] });
    expect(
      readGardenState(db).areas[0].planters.map((p: any) => p.id),
    ).toEqual(["planter-1", "planter-2"]);
  });
});
