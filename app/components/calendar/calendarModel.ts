import type {
  Area,
  GardenEvent,
  Priority,
  Suggestion,
} from "../../data/schema";
import { buildPlacedPlants } from "../../services/gardenState";

const GRID_DAY_COUNT = 42;
const HARVEST_WINDOW_LEAD_DAYS = 7;
const HARVEST_WINDOW_TRAIL_DAYS = 14;

const EVENT_LABELS: Record<GardenEvent["type"], string> = {
  planted: "Planted",
  watered: "Watered",
  composted: "Composted",
  weeded: "Weeded",
  harvested: "Harvested",
  sown: "Sowed",
  sprouted: "Sprouted",
  removed: "Removed",
  pest: "Pest noted",
  treatment: "Treatment logged",
  observation: "Observation",
};

const HARVEST_STATE_ORDER = {
  overdue: 3,
  ready: 2,
  upcoming: 1,
  seasonal: 0,
} as const;

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export interface CalendarEventItem {
  id: string;
  type: GardenEvent["type"];
  label: string;
  detail?: string;
  plantName?: string;
  plantIcon?: string;
  dateKey: string;
}

export interface CalendarSuggestionItem {
  id: string;
  type: Suggestion["type"];
  label: string;
  detail?: string;
  plantName?: string;
  plantIcon?: string;
  priority: Priority;
  source: Suggestion["source"];
  dateKey?: string;
}

export interface CalendarHarvestItem {
  id: string;
  label: string;
  detail: string;
  plantName: string;
  plantIcon: string;
  areaName: string;
  planterName: string;
  priority: Priority;
  state: "upcoming" | "ready" | "overdue" | "seasonal";
  timing: "window" | "seasonal";
  startDateKey?: string;
  endDateKey?: string;
  readyDateKey?: string;
}

export interface CalendarDayCell {
  date: Date;
  dateKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEventItem[];
  suggestions: CalendarSuggestionItem[];
  harvests: CalendarHarvestItem[];
}

export interface CalendarMonthCounts {
  events: number;
  datedSuggestions: number;
  undatedSuggestions: number;
  harvests: number;
}

export interface CalendarMonthModel {
  monthStart: Date;
  monthEnd: Date;
  gridStart: Date;
  days: CalendarDayCell[];
  undatedSuggestions: CalendarSuggestionItem[];
  harvestWindows: CalendarHarvestItem[];
  seasonalHarvests: CalendarHarvestItem[];
  counts: CalendarMonthCounts;
  isCurrentMonth: boolean;
}

interface BuildCalendarMonthParams {
  month: Date;
  areas: Area[];
  events: GardenEvent[];
  suggestions: Suggestion[];
  today?: Date;
}

interface PlanterLocation {
  areaName: string;
  planterName: string;
}

function padNumber(value: number): string {
  return String(value).padStart(2, "0");
}

function createLocalDate(
  year: number,
  monthIndex: number,
  day: number,
): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function parseDateKey(dateKey: string): Date | null {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return null;
  }

  return createLocalDate(year, month - 1, day);
}

function addCalendarDays(date: Date, delta: number): Date {
  return createLocalDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + delta,
  );
}

function normalizeDate(value: Date | string): Date | null {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return createLocalDate(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );
}

function compareByLabel(left: { label: string }, right: { label: string }) {
  return left.label.localeCompare(right.label);
}

function sortSuggestions(
  suggestions: CalendarSuggestionItem[],
): CalendarSuggestionItem[] {
  return suggestions.sort(
    (left, right) =>
      PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority] ||
      left.label.localeCompare(right.label),
  );
}

function sortHarvests(harvests: CalendarHarvestItem[]): CalendarHarvestItem[] {
  return harvests.sort(
    (left, right) =>
      HARVEST_STATE_ORDER[right.state] - HARVEST_STATE_ORDER[left.state] ||
      PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority] ||
      left.label.localeCompare(right.label),
  );
}

function diffCalendarDays(later: Date, earlier: Date): number {
  const laterUtc = Date.UTC(
    later.getFullYear(),
    later.getMonth(),
    later.getDate(),
  );
  const earlierUtc = Date.UTC(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate(),
  );
  return Math.round((laterUtc - earlierUtc) / 86_400_000);
}

function isSameMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function intersectsMonth(start: Date, end: Date, monthStart: Date, monthEnd: Date) {
  return start <= monthEnd && end >= monthStart;
}

function formatLocation(location?: PlanterLocation, note?: string): string | undefined {
  const parts = [
    location ? `${location.areaName} · ${location.planterName}` : undefined,
    note?.trim() ? note.trim() : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function getPlanterLookup(areas: Area[]): Map<string, PlanterLocation> {
  const lookup = new Map<string, PlanterLocation>();

  for (const area of areas) {
    for (const planter of area.planters) {
      lookup.set(planter.id, {
        areaName: area.name,
        planterName: planter.name,
      });
    }
  }

  return lookup;
}

function pushItem<T>(map: Map<string, T[]>, key: string, item: T) {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(item);
    return;
  }

  map.set(key, [item]);
}

function buildEventItem(
  event: GardenEvent,
  dateKey: string,
  locations: Map<string, PlanterLocation>,
): CalendarEventItem {
  const location = event.gardenId ? locations.get(event.gardenId) : undefined;
  const label = event.plant
    ? `${EVENT_LABELS[event.type]} ${event.plant.name}`
    : event.note?.trim() || EVENT_LABELS[event.type];

  return {
    id: event.id,
    type: event.type,
    label,
    detail: formatLocation(location, event.note),
    plantName: event.plant?.name,
    plantIcon: event.plant?.icon,
    dateKey,
  };
}

function buildSuggestionItem(
  suggestion: Suggestion,
  locations: Map<string, PlanterLocation>,
  dateKey?: string,
): CalendarSuggestionItem {
  const location = suggestion.planterId
    ? locations.get(suggestion.planterId)
    : undefined;

  return {
    id: suggestion.id,
    type: suggestion.type,
    label: suggestion.description,
    detail: location ? `${location.areaName} · ${location.planterName}` : undefined,
    plantName: suggestion.plant?.name,
    plantIcon: suggestion.plant?.icon,
    priority: suggestion.priority,
    source: suggestion.source,
    dateKey,
  };
}

function resolveHarvestWindow(
  readyDate: Date,
  today: Date,
): Pick<
  CalendarHarvestItem,
  "priority" | "state" | "startDateKey" | "endDateKey" | "readyDateKey"
> {
  const windowStart = addCalendarDays(readyDate, -HARVEST_WINDOW_LEAD_DAYS);
  const windowEnd = addCalendarDays(readyDate, HARVEST_WINDOW_TRAIL_DAYS);
  const daysUntilReady = diffCalendarDays(readyDate, today);

  if (daysUntilReady < 0) {
    return {
      priority: "high",
      state: "overdue",
      startDateKey: toLocalDateKey(windowStart)!,
      endDateKey: toLocalDateKey(windowEnd)!,
      readyDateKey: toLocalDateKey(readyDate)!,
    };
  }

  if (daysUntilReady <= 3) {
    return {
      priority: "high",
      state: "ready",
      startDateKey: toLocalDateKey(windowStart)!,
      endDateKey: toLocalDateKey(windowEnd)!,
      readyDateKey: toLocalDateKey(readyDate)!,
    };
  }

  if (daysUntilReady <= 7) {
    return {
      priority: "medium",
      state: "upcoming",
      startDateKey: toLocalDateKey(windowStart)!,
      endDateKey: toLocalDateKey(windowEnd)!,
      readyDateKey: toLocalDateKey(readyDate)!,
    };
  }

  return {
    priority: "low",
    state: "upcoming",
    startDateKey: toLocalDateKey(windowStart)!,
    endDateKey: toLocalDateKey(windowEnd)!,
    readyDateKey: toLocalDateKey(readyDate)!,
  };
}

export function startOfCalendarMonth(month: Date): Date {
  return createLocalDate(month.getFullYear(), month.getMonth(), 1);
}

export function addCalendarMonths(month: Date, delta: number): Date {
  return createLocalDate(month.getFullYear(), month.getMonth() + delta, 1);
}

export function toLocalDateKey(value: Date | string): string | null {
  const normalized = normalizeDate(value);
  if (!normalized) return null;

  return `${normalized.getFullYear()}-${padNumber(normalized.getMonth() + 1)}-${padNumber(normalized.getDate())}`;
}

export function buildCalendarMonth({
  month,
  areas,
  events,
  suggestions,
  today = new Date(),
}: BuildCalendarMonthParams): CalendarMonthModel {
  const monthStart = startOfCalendarMonth(month);
  const monthEnd = createLocalDate(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const gridStart = addCalendarDays(monthStart, -monthStart.getDay());
  const gridEnd = addCalendarDays(gridStart, GRID_DAY_COUNT - 1);
  const todayLocal = normalizeDate(today) ?? startOfCalendarMonth(new Date());
  const isCurrentMonth = isSameMonth(monthStart, todayLocal);
  const locations = getPlanterLookup(areas);

  const eventMap = new Map<string, CalendarEventItem[]>();
  const datedSuggestionMap = new Map<string, CalendarSuggestionItem[]>();
  const harvestMap = new Map<string, CalendarHarvestItem[]>();

  const counts: CalendarMonthCounts = {
    events: 0,
    datedSuggestions: 0,
    undatedSuggestions: 0,
    harvests: 0,
  };

  for (const event of events) {
    const dateKey = toLocalDateKey(event.date);
    if (!dateKey) continue;

    const date = normalizeDate(event.date);
    if (!date) continue;

    pushItem(eventMap, dateKey, buildEventItem(event, dateKey, locations));
    if (isSameMonth(date, monthStart)) {
      counts.events += 1;
    }
  }

  const undatedSuggestions = isCurrentMonth
    ? suggestions
        .filter((suggestion) => !suggestion.dueDate)
        .map((suggestion) => buildSuggestionItem(suggestion, locations))
    : [];

  counts.undatedSuggestions = undatedSuggestions.length;

  for (const suggestion of suggestions) {
    if (!suggestion.dueDate) continue;

    const dueDateKey = toLocalDateKey(suggestion.dueDate);
    const dueDate = normalizeDate(suggestion.dueDate);
    if (!dueDateKey || !dueDate) continue;

    pushItem(
      datedSuggestionMap,
      dueDateKey,
      buildSuggestionItem(suggestion, locations, dueDateKey),
    );

    if (isSameMonth(dueDate, monthStart)) {
      counts.datedSuggestions += 1;
    }
  }

  const harvestWindows: CalendarHarvestItem[] = [];
  const seasonalHarvests: CalendarHarvestItem[] = [];
  const placedPlants = buildPlacedPlants(areas);
  const selectedMonthNumber = monthStart.getMonth() + 1;

  for (const placedPlant of placedPlants) {
    let readyDate: Date | null = null;

    if (placedPlant.plantingDate && placedPlant.plant.daysToHarvest) {
      const plantedDate = normalizeDate(placedPlant.plantingDate);
      if (plantedDate) {
        readyDate = addCalendarDays(plantedDate, placedPlant.plant.daysToHarvest);
      }
    }

    if (!readyDate && placedPlant.harvestDate) {
      readyDate = normalizeDate(placedPlant.harvestDate);
    }

    if (readyDate) {
      const harvestWindow = resolveHarvestWindow(readyDate, todayLocal);
      const harvestItem: CalendarHarvestItem = {
        id: `harvest:${placedPlant.planterId}:${placedPlant.instanceId}`,
        label: placedPlant.plant.name,
        detail: `${placedPlant.areaName} · ${placedPlant.planterName}`,
        plantName: placedPlant.plant.name,
        plantIcon: placedPlant.plant.icon,
        areaName: placedPlant.areaName,
        planterName: placedPlant.planterName,
        timing: "window",
        ...harvestWindow,
      };

      const windowStart = parseDateKey(harvestItem.startDateKey!);
      const windowEnd = parseDateKey(harvestItem.endDateKey!);
      if (!windowStart || !windowEnd) continue;

      if (intersectsMonth(windowStart, windowEnd, monthStart, monthEnd)) {
        harvestWindows.push(harvestItem);
        counts.harvests += 1;
      }

      const clippedStart = windowStart < gridStart ? gridStart : windowStart;
      const clippedEnd = windowEnd > gridEnd ? gridEnd : windowEnd;

      if (clippedStart <= clippedEnd) {
        for (
          let currentDate = clippedStart;
          currentDate <= clippedEnd;
          currentDate = addCalendarDays(currentDate, 1)
        ) {
          pushItem(harvestMap, toLocalDateKey(currentDate)!, harvestItem);
        }
      }

      continue;
    }

    if (!placedPlant.plant.harvestMonths.includes(selectedMonthNumber)) {
      continue;
    }

    seasonalHarvests.push({
      id: `seasonal:${placedPlant.planterId}:${placedPlant.instanceId}:${selectedMonthNumber}`,
      label: placedPlant.plant.name,
      detail: `${placedPlant.areaName} · ${placedPlant.planterName}`,
      plantName: placedPlant.plant.name,
      plantIcon: placedPlant.plant.icon,
      areaName: placedPlant.areaName,
      planterName: placedPlant.planterName,
      priority: "low",
      state: "seasonal",
      timing: "seasonal",
    });
    counts.harvests += 1;
  }

  const days = Array.from({ length: GRID_DAY_COUNT }, (_, index) => {
    const date = addCalendarDays(gridStart, index);
    const dateKey = toLocalDateKey(date)!;
    const dayEvents = (eventMap.get(dateKey) ?? []).sort(compareByLabel);
    const daySuggestions = sortSuggestions(datedSuggestionMap.get(dateKey) ?? []);
    const dayHarvests = sortHarvests(harvestMap.get(dateKey) ?? []);

    return {
      date,
      dateKey,
      dayOfMonth: date.getDate(),
      inCurrentMonth: isSameMonth(date, monthStart),
      isToday: toLocalDateKey(todayLocal) === dateKey,
      events: dayEvents,
      suggestions: daySuggestions,
      harvests: dayHarvests,
    };
  });

  return {
    monthStart,
    monthEnd,
    gridStart,
    days,
    undatedSuggestions: sortSuggestions(undatedSuggestions),
    harvestWindows: sortHarvests(harvestWindows),
    seasonalHarvests: sortHarvests(seasonalHarvests),
    counts,
    isCurrentMonth,
  };
}