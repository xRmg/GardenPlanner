import { describe, expect, it } from "vitest";

import type { Area, Plant } from "../schema";
import {
  movePlantBetweenLocations,
  type PlantMoveLocation,
} from "../../services/plantMovement";

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

function makeArea(): Area {
  return {
    id: "area-1",
    name: "Garden",
    profileId: "default",
    planters: [
      {
        id: "planter-1",
        name: "Bed A",
        rows: 1,
        cols: 1,
        squares: [
          [
            {
              plantInstance: {
                instanceId: "inst-1",
                plant: makePlant(),
                pestEvents: [],
                growthStage: null,
                growthStageOverride: false,
                healthState: null,
              },
            },
          ],
        ],
        virtualSections: [],
      },
      {
        id: "planter-2",
        name: "Bed B",
        rows: 1,
        cols: 1,
        squares: [
          [
            {
              plantInstance: {
                instanceId: "inst-2",
                plant: makePlant({ id: "pepper", name: "Pepper", icon: "🫑" }),
                pestEvents: [],
                growthStage: null,
                growthStageOverride: false,
                healthState: null,
              },
            },
          ],
        ],
        virtualSections: [],
      },
    ],
  };
}

describe("movePlantBetweenLocations", () => {
  it("swaps plants atomically across planters", () => {
    const source: PlantMoveLocation = {
      areaId: "area-1",
      planterId: "planter-1",
      row: 0,
      col: 0,
    };
    const target: PlantMoveLocation = {
      areaId: "area-1",
      planterId: "planter-2",
      row: 0,
      col: 0,
    };

    const nextAreas = movePlantBetweenLocations([makeArea()], source, target);

    expect(
      nextAreas[0].planters[0].squares?.[0][0].plantInstance?.instanceId,
    ).toBe("inst-2");
    expect(
      nextAreas[0].planters[1].squares?.[0][0].plantInstance?.instanceId,
    ).toBe("inst-1");
  });
});