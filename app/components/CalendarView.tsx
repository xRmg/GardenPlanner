import { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";

import type {
  Area,
  GardenEvent,
  Settings,
  Suggestion,
  SuggestionMode,
} from "../data/schema";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import {
  addCalendarMonths,
  buildCalendarMonth,
  startOfCalendarMonth,
  type CalendarDayCell,
  type CalendarEventItem,
  type CalendarHarvestItem,
  type CalendarSuggestionItem,
} from "./calendar/calendarModel";

const MODE_BADGES: Record<
  SuggestionMode,
  { label: string; className: string }
> = {
  "ai+weather": {
    label: "AI + weather",
    className: "bg-violet-50 text-violet-700 border border-violet-200",
  },
  "rules+weather": {
    label: "Rules + weather",
    className: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  rules: {
    label: "Rules",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  static: {
    label: "Static",
    className: "bg-gray-50 text-gray-600 border border-gray-200",
  },
};

const EVENT_STYLES: Record<
  CalendarEventItem["type"],
  { chip: string; count: string }
> = {
  planted: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    count: "bg-emerald-50 text-emerald-700",
  },
  watered: {
    chip: "border-sky-200 bg-sky-50 text-sky-700",
    count: "bg-sky-50 text-sky-700",
  },
  composted: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    count: "bg-amber-50 text-amber-700",
  },
  weeded: {
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    count: "bg-orange-50 text-orange-700",
  },
  harvested: {
    chip: "border-violet-200 bg-violet-50 text-violet-700",
    count: "bg-violet-50 text-violet-700",
  },
  sown: {
    chip: "border-lime-200 bg-lime-50 text-lime-700",
    count: "bg-lime-50 text-lime-700",
  },
  sprouted: {
    chip: "border-teal-200 bg-teal-50 text-teal-700",
    count: "bg-teal-50 text-teal-700",
  },
  removed: {
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    count: "bg-rose-50 text-rose-700",
  },
  pest: {
    chip: "border-red-200 bg-red-50 text-red-700",
    count: "bg-red-50 text-red-700",
  },
  treatment: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    count: "bg-emerald-50 text-emerald-700",
  },
};

const PRIORITY_STYLES: Record<
  CalendarSuggestionItem["priority"],
  { chip: string; count: string }
> = {
  high: {
    chip: "border-red-200 bg-red-50 text-red-700",
    count: "bg-red-50 text-red-700",
  },
  medium: {
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    count: "bg-orange-50 text-orange-700",
  },
  low: {
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    count: "bg-blue-50 text-blue-700",
  },
};

const HARVEST_STYLES: Record<
  CalendarHarvestItem["state"],
  { chip: string; badge: string; label: string }
> = {
  upcoming: {
    chip: "border-lime-200 bg-lime-50 text-lime-800",
    badge: "bg-lime-50 text-lime-700 border border-lime-200",
    label: "Approaching",
  },
  ready: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "Ready",
  },
  overdue: {
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Overdue",
  },
  seasonal: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "Seasonal",
  },
};

interface CalendarViewProps {
  areas: Area[];
  events: GardenEvent[];
  suggestions: Suggestion[];
  settings: Settings;
  suggestionsMode?: SuggestionMode;
  suggestionsLoading?: boolean;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDateKey(dateKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(parseDateKey(dateKey));
}

function formatWindow(item: CalendarHarvestItem, locale: string): string {
  if (item.timing === "seasonal") {
    return "This crop only has month-level harvest timing.";
  }

  const ready = item.readyDateKey
    ? `Ready ${formatDateKey(item.readyDateKey, locale)}`
    : undefined;
  const span =
    item.startDateKey && item.endDateKey
      ? `${formatDateKey(item.startDateKey, locale)} to ${formatDateKey(item.endDateKey, locale)}`
      : undefined;

  return [ready, span].filter(Boolean).join(" · ");
}

function DayCounts({ day }: { day: CalendarDayCell }) {
  const eventCount = day.events.length;
  const suggestionCount = day.suggestions.length;
  const harvestCount = day.harvests.length;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {suggestionCount > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-black uppercase tracking-wider",
            PRIORITY_STYLES[day.suggestions[0].priority].count,
          )}
        >
          {suggestionCount} task{suggestionCount === 1 ? "" : "s"}
        </span>
      )}
      {eventCount > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-black uppercase tracking-wider",
            EVENT_STYLES[day.events[0].type].count,
          )}
        >
          {eventCount} log{eventCount === 1 ? "" : "s"}
        </span>
      )}
      {harvestCount > 0 && (
        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-black uppercase tracking-wider text-emerald-700">
          {harvestCount} harvest
        </span>
      )}
    </div>
  );
}

function DayCell({ day }: { day: CalendarDayCell }) {
  const harvestPreview = day.harvests[0];
  const suggestionPreview = day.suggestions[0];
  const eventPreview = day.events[0];
  const visibleItems = [harvestPreview, suggestionPreview, eventPreview].filter(
    Boolean,
  ).length;
  const overflowCount =
    day.harvests.length +
    day.suggestions.length +
    day.events.length -
    visibleItems;

  return (
    <div
      className={cn(
        "flex min-h-28 flex-col gap-2 rounded-2xl border p-2.5 shadow-sm transition-colors sm:min-h-32",
        day.inCurrentMonth
          ? "border-border/20 bg-card"
          : "border-border/10 bg-muted/20 text-muted-foreground/55",
        day.isToday &&
          "border-primary/30 bg-primary/5 ring-2 ring-primary/10 ring-offset-0",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "text-sm font-black tabular-nums",
            day.inCurrentMonth ? "text-foreground" : "text-muted-foreground/70",
          )}
        >
          {day.dayOfMonth}
        </span>
        <DayCounts day={day} />
      </div>

      {harvestPreview && (
        <div
          title={`${harvestPreview.label} · ${harvestPreview.detail}`}
          className={cn(
            "rounded-xl border px-2 py-1 text-[10px] font-bold leading-tight",
            HARVEST_STYLES[harvestPreview.state].chip,
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs">{harvestPreview.plantIcon}</span>
            <span className="truncate">
              {day.harvests.length === 1
                ? `${harvestPreview.plantName} harvest`
                : `${day.harvests.length} harvest windows`}
            </span>
          </div>
        </div>
      )}

      {suggestionPreview && (
        <div
          title={
            suggestionPreview.detail
              ? `${suggestionPreview.label} · ${suggestionPreview.detail}`
              : suggestionPreview.label
          }
          className={cn(
            "rounded-xl border px-2 py-1 text-[10px] font-bold leading-tight",
            PRIORITY_STYLES[suggestionPreview.priority].chip,
          )}
        >
          <div className="flex items-center gap-1.5">
            {suggestionPreview.plantIcon && (
              <span className="text-xs">{suggestionPreview.plantIcon}</span>
            )}
            <span className="truncate">{suggestionPreview.label}</span>
          </div>
        </div>
      )}

      {eventPreview && (
        <div
          title={
            eventPreview.detail
              ? `${eventPreview.label} · ${eventPreview.detail}`
              : eventPreview.label
          }
          className={cn(
            "rounded-xl border px-2 py-1 text-[10px] font-bold leading-tight",
            EVENT_STYLES[eventPreview.type].chip,
          )}
        >
          <div className="flex items-center gap-1.5">
            {eventPreview.plantIcon && (
              <span className="text-xs">{eventPreview.plantIcon}</span>
            )}
            <span className="truncate">{eventPreview.label}</span>
          </div>
        </div>
      )}

      {overflowCount > 0 && (
        <p className="mt-auto text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          +{overflowCount} more
        </p>
      )}
    </div>
  );
}

export function CalendarView({
  areas,
  events,
  suggestions,
  settings,
  suggestionsMode,
  suggestionsLoading = false,
}: CalendarViewProps) {
  const locale = settings.locale || "en-US";
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfCalendarMonth(new Date()),
  );

  const model = buildCalendarMonth({
    month: visibleMonth,
    areas,
    events,
    suggestions,
  });

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(model.monthStart);

  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      new Date(2026, 0, 4 + index, 12, 0, 0, 0),
    ),
  );

  const exactHarvests = model.harvestWindows;
  const harvestItems = [...exactHarvests, ...model.seasonalHarvests];
  const isQuietMonth =
    model.counts.events === 0 &&
    model.counts.datedSuggestions === 0 &&
    model.counts.harvests === 0;

  return (
    <div className="flex-1 overflow-auto bg-card rounded-2xl border border-border/20 shadow-sm p-4 custom-scrollbar h-[calc(100dvh-13rem)] md:h-[calc(100dvh-12rem)]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Calendar Planner
            </h1>
            <p className="text-muted-foreground mt-0.5 text-[10px] uppercase font-bold tracking-wider opacity-60">
              Navigate month by month to review journal entries, due
              suggestions, and crop harvest windows.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
              {suggestionsMode && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                    MODE_BADGES[suggestionsMode].className,
                  )}
                >
                  {MODE_BADGES[suggestionsMode].label}
                </span>
              )}
              {suggestionsLoading && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-muted/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Refreshing
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
                onClick={() =>
                  setVisibleMonth((currentMonth) =>
                    addCalendarMonths(currentMonth, -1),
                  )
                }
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <div className="min-w-44 rounded-xl border border-border/20 bg-card px-4 py-2 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  Viewing
                </p>
                <p className="text-sm font-black text-foreground">
                  {monthLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
                onClick={() =>
                  setVisibleMonth((currentMonth) =>
                    addCalendarMonths(currentMonth, 1),
                  )
                }
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-xl"
                onClick={() =>
                  setVisibleMonth(startOfCalendarMonth(new Date()))
                }
                disabled={model.isCurrentMonth}
              >
                Today
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-foreground border border-border/20">
            {model.counts.events} journal
          </span>
          <span className="rounded-full bg-muted/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-foreground border border-border/20">
            {model.counts.datedSuggestions + model.counts.undatedSuggestions}{" "}
            suggestions
          </span>
          <span className="rounded-full bg-muted/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-foreground border border-border/20">
            {model.counts.harvests} harvest windows
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-3">
            {isQuietMonth && (
              <div className="rounded-2xl border border-dashed border-border/30 bg-muted/20 px-4 py-3 text-sm font-medium text-muted-foreground">
                This month has no dated activity yet. Use the summary panel for
                harvest context, and switch back to the current month for
                unscheduled suggestions.
              </div>
            )}

            <div className="overflow-x-auto pb-1">
              <div className="grid min-w-176 grid-cols-7 gap-2">
                {weekdayLabels.map((label) => (
                  <div
                    key={label}
                    className="px-1 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60"
                  >
                    {label}
                  </div>
                ))}

                {model.days.map((day) => (
                  <DayCell key={day.dateKey} day={day} />
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Unscheduled Suggestions
                </h2>
                {model.isCurrentMonth &&
                  model.undatedSuggestions.length > 0 && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground border border-border/50">
                      {model.undatedSuggestions.length}
                    </span>
                  )}
              </div>

              <div className="mt-3 space-y-2.5">
                {!model.isCurrentMonth && (
                  <p className="text-sm text-muted-foreground">
                    Undated suggestions stay pinned to the current month so they
                    do not get assigned to arbitrary dates in the future or
                    past.
                  </p>
                )}

                {model.isCurrentMonth &&
                  model.undatedSuggestions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      All active suggestions already have a specific date.
                    </p>
                  )}

                {model.isCurrentMonth &&
                  model.undatedSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="rounded-xl border border-border/10 bg-muted/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground leading-snug">
                            {suggestion.label}
                          </p>
                          {suggestion.detail && (
                            <p className="mt-1 text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="h-3 w-3" />
                              {suggestion.detail}
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-black uppercase tracking-wider",
                            PRIORITY_STYLES[suggestion.priority].count,
                          )}
                        >
                          {suggestion.priority}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  Harvest Outlook
                </h2>
                {harvestItems.length > 0 && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground border border-border/50">
                    {harvestItems.length}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-2.5">
                {harvestItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No planted crops land in a harvest window for this month.
                  </p>
                )}

                {harvestItems.map((harvest) => (
                  <div
                    key={harvest.id}
                    className="rounded-xl border border-white/70 bg-white/80 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{harvest.plantIcon}</span>
                          <p className="text-sm font-bold text-foreground leading-none">
                            {harvest.plantName}
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                          {harvest.detail}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold text-foreground/80">
                          {formatWindow(harvest, locale)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-black uppercase tracking-wider",
                          HARVEST_STYLES[harvest.state].badge,
                        )}
                      >
                        {HARVEST_STYLES[harvest.state].label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
