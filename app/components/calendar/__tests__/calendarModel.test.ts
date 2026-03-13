import { describe, expect, it } from "vitest";

import type { Area, GardenEvent, Suggestion } from "../../../data/schema";
import {
  addCalendarMonths,
  buildCalendarMonth,
  startOfCalendarMonth,
  toLocalDateKey,
} from "../calendarModel";

function makeArea(overrides: Partial<Area> = {}): Area {
  return {
    id: "area-1",
    name: "Kitchen Garden",
    planters: [],
    profileId: "default",
    ...overrides,
  };
}

function makePlantedArea(): Area {
  return makeArea({
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
                instanceId: "instance-1",
                plantingDate: "2026-03-01T10:00:00.000Z",
                plant: {
                  id: "lettuce",
                  name: "Lettuce",
                  color: "#84cc16",
                  icon: "🥬",
                  daysToHarvest: 14,
                  companions: [],
                  antagonists: [],
                  sowIndoorMonths: [],
                  sowDirectMonths: [],
                  harvestMonths: [],
                  isSeed: false,
                  source: "bundled",
                },
                pestEvents: [],
              },
            },
          ],
        ],
        virtualSections: [],
      },
    ],
  });
}

function makeSeasonalArea(): Area {
  return makeArea({
    planters: [
      {
        id: "planter-2",
        name: "Bed B",
        rows: 1,
        cols: 1,
        squares: [
          [
            {
              plantInstance: {
                instanceId: "instance-2",
                plant: {
                  id: "pumpkin",
                  name: "Pumpkin",
                  color: "#f97316",
                  icon: "🎃",
                  companions: [],
                  antagonists: [],
                  sowIndoorMonths: [],
                  sowDirectMonths: [],
                  harvestMonths: [10],
                  isSeed: false,
                  source: "bundled",
                },
                pestEvents: [],
              },
            },
          ],
        ],
        virtualSections: [],
      },
    ],
  });
}

function makeEvent(overrides: Partial<GardenEvent> = {}): GardenEvent {
  return {
    id: "event-1",
    type: "planted",
    date: "2026-03-15T08:00:00.000Z",
    profileId: "default",
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: "suggestion-1",
    type: "water",
    priority: "medium",
    description: "Water the salad bed",
    source: "rules",
    ...overrides,
  };
}

describe("calendarModel", () => {
  it("adds calendar months across year boundaries", () => {
    const nextMonth = addCalendarMonths(new Date("2026-12-12T12:00:00.000Z"), 1);
    expect(nextMonth.getFullYear()).toBe(2027);
    expect(nextMonth.getMonth()).toBe(0);
    expect(nextMonth.getDate()).toBe(1);
  });

  it("builds a stable local date key", () => {
    expect(toLocalDateKey("2026-03-15T08:00:00.000Z")).toBe("2026-03-15");
  });

  it("places events and due-dated suggestions onto the correct day", () => {
    const model = buildCalendarMonth({
      month: new Date("2026-03-01T12:00:00.000Z"),
      areas: [makeArea({ planters: [{ id: "planter-1", name: "Bed A", rows: 1, cols: 1, squares: [[{ plantInstance: null }]], virtualSections: [] }] })],
      events: [makeEvent({ gardenId: "planter-1" })],
      suggestions: [
        makeSuggestion({
          id: "suggestion-2",
          description: "Harvest looseleaf lettuce",
          dueDate: "2026-03-15T16:00:00.000Z",
          planterId: "planter-1",
        }),
      ],
      today: new Date("2026-03-12T12:00:00.000Z"),
    });

    const march15 = model.days.find((day) => day.dateKey === "2026-03-15");

    expect(march15?.events).toHaveLength(1);
    expect(march15?.suggestions).toHaveLength(1);
    expect(model.counts.events).toBe(1);
    expect(model.counts.datedSuggestions).toBe(1);
  });

  it("keeps undated suggestions on the current month only", () => {
    const currentMonthModel = buildCalendarMonth({
      month: new Date("2026-03-01T12:00:00.000Z"),
      areas: [makeArea()],
      events: [],
      suggestions: [makeSuggestion()],
      today: new Date("2026-03-12T12:00:00.000Z"),
    });

    const futureMonthModel = buildCalendarMonth({
      month: new Date("2026-04-01T12:00:00.000Z"),
      areas: [makeArea()],
      events: [],
      suggestions: [makeSuggestion()],
      today: new Date("2026-03-12T12:00:00.000Z"),
    });

    expect(currentMonthModel.undatedSuggestions).toHaveLength(1);
    expect(currentMonthModel.counts.undatedSuggestions).toBe(1);
    expect(futureMonthModel.undatedSuggestions).toHaveLength(0);
    expect(futureMonthModel.counts.undatedSuggestions).toBe(0);
  });

  it("derives an exact harvest window from planting date and days to harvest", () => {
    const model = buildCalendarMonth({
      month: new Date("2026-03-01T12:00:00.000Z"),
      areas: [makePlantedArea()],
      events: [],
      suggestions: [],
      today: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(model.harvestWindows).toHaveLength(1);
    expect(model.harvestWindows[0].readyDateKey).toBe("2026-03-15");
    expect(model.harvestWindows[0].startDateKey).toBe("2026-03-08");
    expect(model.harvestWindows[0].endDateKey).toBe("2026-03-29");

    const readyDay = model.days.find((day) => day.dateKey === "2026-03-15");
    expect(readyDay?.harvests).toHaveLength(1);
    expect(model.counts.harvests).toBe(1);
  });

  it("falls back to seasonal harvests when precise timing is unavailable", () => {
    const model = buildCalendarMonth({
      month: new Date("2026-10-01T12:00:00.000Z"),
      areas: [makeSeasonalArea()],
      events: [],
      suggestions: [],
      today: new Date("2026-10-04T12:00:00.000Z"),
    });

    expect(model.harvestWindows).toHaveLength(0);
    expect(model.seasonalHarvests).toHaveLength(1);
    expect(model.seasonalHarvests[0].state).toBe("seasonal");
    expect(model.counts.harvests).toBe(1);
    expect(model.days.some((day) => day.harvests.length > 0)).toBe(false);
  });

  it("builds a full six-week grid for leap-year February", () => {
    const model = buildCalendarMonth({
      month: new Date("2028-02-01T12:00:00.000Z"),
      areas: [makeArea()],
      events: [],
      suggestions: [],
      today: startOfCalendarMonth(new Date("2028-02-10T12:00:00.000Z")),
    });

    expect(model.days).toHaveLength(42);
    expect(model.days.some((day) => day.dateKey === "2028-02-29")).toBe(true);
  });
});