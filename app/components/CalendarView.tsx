import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n/config";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Loader2,
  MapPin,
  Plus,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
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
  { className: string }
> = {
  "ai+weather": {
    className: "bg-violet-50 text-violet-700 border border-violet-200",
  },
  "rules+weather": {
    className: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  rules: {
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  static: {
    className: "bg-gray-50 text-gray-600 border border-gray-200",
  },
};

const DEFAULT_EVENT_STYLE = {
  chip: "border-slate-200 bg-slate-50 text-slate-700",
  count: "bg-slate-50 text-slate-700",
};

const EVENT_STYLES: Partial<Record<
  CalendarEventItem["visualType"],
  { chip: string; count: string }
>> = {
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
  observation: {
    chip: "border-teal-200 bg-teal-50 text-teal-700",
    count: "bg-teal-50 text-teal-700",
  },
  water: {
    chip: "border-sky-200 bg-sky-50 text-sky-700",
    count: "bg-sky-50 text-sky-700",
  },
  harvest: {
    chip: "border-violet-200 bg-violet-50 text-violet-700",
    count: "bg-violet-50 text-violet-700",
  },
  repot: {
    chip: "border-indigo-200 bg-indigo-50 text-indigo-700",
    count: "bg-indigo-50 text-indigo-700",
  },
  compost: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    count: "bg-amber-50 text-amber-700",
  },
  weed: {
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    count: "bg-orange-50 text-orange-700",
  },
  sow: {
    chip: "border-lime-200 bg-lime-50 text-lime-700",
    count: "bg-lime-50 text-lime-700",
  },
  fertilize: {
    chip: "border-yellow-200 bg-yellow-50 text-yellow-700",
    count: "bg-yellow-50 text-yellow-700",
  },
  no_water: {
    chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
    count: "bg-cyan-50 text-cyan-700",
  },
  frost_protect: {
    chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
    count: "bg-cyan-50 text-cyan-700",
  },
  thin_seedlings: {
    chip: "border-lime-200 bg-lime-50 text-lime-700",
    count: "bg-lime-50 text-lime-700",
  },
  harden_seedlings: {
    chip: "border-yellow-200 bg-yellow-50 text-yellow-700",
    count: "bg-yellow-50 text-yellow-700",
  },
  companion_conflict: {
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    count: "bg-rose-50 text-rose-700",
  },
  succession_sow: {
    chip: "border-teal-200 bg-teal-50 text-teal-700",
    count: "bg-teal-50 text-teal-700",
  },
  pest_alert: {
    chip: "border-red-200 bg-red-50 text-red-700",
    count: "bg-red-50 text-red-700",
  },
  disease_risk: {
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    count: "bg-orange-50 text-orange-700",
  },
  end_of_season: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    count: "bg-amber-50 text-amber-700",
  },
  mulch: {
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    count: "bg-amber-50 text-amber-800",
  },
  prune: {
    chip: "border-violet-200 bg-violet-50 text-violet-700",
    count: "bg-violet-50 text-violet-700",
  },
};

function getEventStyle(visualType: CalendarEventItem["visualType"]) {
  return EVENT_STYLES[visualType] ?? DEFAULT_EVENT_STYLE;
}

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
  { chip: string; badge: string }
> = {
  upcoming: {
    chip: "border-lime-200 bg-lime-50 text-lime-800",
    badge: "bg-lime-50 text-lime-700 border border-lime-200",
  },
  ready: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  overdue: {
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  seasonal: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
};

interface CalendarViewProps {
  areas: Area[];
  events: GardenEvent[];
  suggestions: Suggestion[];
  settings: Settings;
  suggestionsMode?: SuggestionMode;
  suggestionsLoading?: boolean;
  onAddEvent?: (event: Omit<GardenEvent, "id">) => void;
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
    return i18n.t("calendarView.harvestTiming.monthLevelOnly");
  }

  const ready = item.readyDateKey
    ? i18n.t("calendarView.harvestTiming.readyOn", {
        date: formatDateKey(item.readyDateKey, locale),
      })
    : undefined;
  const span = item.startDateKey && item.endDateKey
    ? i18n.t("calendarView.harvestTiming.range", {
        start: formatDateKey(item.startDateKey, locale),
        end: formatDateKey(item.endDateKey, locale),
      })
    : undefined;

  return [ready, span].filter(Boolean).join(" · ");
}

function getSuggestionModeLabel(
  t: ReturnType<typeof useTranslation>["t"],
  mode: SuggestionMode,
): string {
  switch (mode) {
    case "ai+weather":
      return t("eventsBar.modeBadges.aiWeather");
    case "rules+weather":
      return t("eventsBar.modeBadges.rulesWeather");
    case "rules":
      return t("eventsBar.modeBadges.rules");
    case "static":
      return t("eventsBar.modeBadges.static");
  }
}

function getPriorityLabel(
  t: ReturnType<typeof useTranslation>["t"],
  priority: CalendarSuggestionItem["priority"],
): string {
  switch (priority) {
    case "high":
      return t("common.priorities.high");
    case "medium":
      return t("common.priorities.medium");
    case "low":
      return t("common.priorities.low");
  }
}

function getHarvestStateLabel(
  t: ReturnType<typeof useTranslation>["t"],
  state: CalendarHarvestItem["state"],
): string {
  switch (state) {
    case "upcoming":
      return t("calendarView.harvestStates.upcoming");
    case "ready":
      return t("calendarView.harvestStates.ready");
    case "overdue":
      return t("calendarView.harvestStates.overdue");
    case "seasonal":
      return t("calendarView.harvestStates.seasonal");
  }
}

function DayCounts({ day }: { day: CalendarDayCell }) {
  const { t } = useTranslation();
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
          {t("calendarView.taskCount", { count: suggestionCount })}
        </span>
      )}
      {eventCount > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-black uppercase tracking-wider",
            getEventStyle(day.events[0].visualType).count,
          )}
        >
          {t("calendarView.logCount", { count: eventCount })}
        </span>
      )}
      {harvestCount > 0 && (
        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-black uppercase tracking-wider text-emerald-700">
          {t("calendarView.harvestCount", { count: harvestCount })}
        </span>
      )}
    </div>
  );
}

function DayCell({ day, onSelect }: { day: CalendarDayCell; onSelect: (day: CalendarDayCell) => void }) {
  const { t } = useTranslation();
  const harvestPreview = day.harvests[0];
  const suggestionPreview = day.suggestions[0];
  const eventPreview = day.events[0];
  const visibleItems = [harvestPreview, suggestionPreview, eventPreview].filter(
    Boolean,
  ).length;
  const overflowCount =
    day.harvests.length + day.suggestions.length + day.events.length - visibleItems;

  return (
    <div
      onClick={() => onSelect(day)}
      className={cn(
        "flex min-h-28 flex-col gap-2 rounded-2xl border p-2.5 shadow-sm transition-colors cursor-pointer hover:ring-2 hover:ring-primary/30 sm:min-h-32",
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
                ? t("calendarView.harvestSingle", { name: harvestPreview.plantName })
                : t("calendarView.harvestWindowTitle", { count: day.harvests.length })}
            </span>
          </div>
        </div>
      )}

      {suggestionPreview && (
        <div
          title={suggestionPreview.detail
            ? `${suggestionPreview.label} · ${suggestionPreview.detail}`
            : suggestionPreview.label}
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
          title={eventPreview.detail
            ? `${eventPreview.label} · ${eventPreview.detail}`
            : eventPreview.label}
          className={cn(
            "rounded-xl border px-2 py-1 text-[10px] font-bold leading-tight",
            getEventStyle(eventPreview.visualType).chip,
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs">
              {eventPreview.plantIcon ?? EVENT_TYPE_ICONS[eventPreview.visualType] ?? "📋"}
            </span>
            <span className="truncate">{eventPreview.label}</span>
          </div>
        </div>
      )}

      {overflowCount > 0 && (
        <p className="mt-auto text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {t("calendarView.overflowMore", { count: overflowCount })}
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
  onAddEvent,
}: CalendarViewProps) {
  const { t } = useTranslation();
  const locale = settings.locale || "en-US";
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfCalendarMonth(new Date()),
  );
  const [selectedDay, setSelectedDay] = useState<CalendarDayCell | null>(null);

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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto bg-card rounded-2xl border border-border/20 shadow-sm p-4 custom-scrollbar">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {t("calendarView.title")}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-[10px] uppercase font-bold tracking-wider opacity-60">
              {t("calendarView.subtitle")}
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
                  {getSuggestionModeLabel(t, suggestionsMode)}
                </span>
              )}
              {suggestionsLoading && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-muted/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> {t("calendarView.refreshing")}
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
                {t("calendarView.prev")}
              </Button>
              <div className="min-w-44 rounded-xl border border-border/20 bg-card px-4 py-2 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  {t("calendarView.viewing")}
                </p>
                <p className="text-sm font-black text-foreground">{monthLabel}</p>
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
                {t("calendarView.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-xl"
                onClick={() => setVisibleMonth(startOfCalendarMonth(new Date()))}
                disabled={model.isCurrentMonth}
              >
                {t("calendarView.today")}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-foreground border border-border/20">
            {t("calendarView.journalCount", { count: model.counts.events })}
          </span>
          <span className="rounded-full bg-muted/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-foreground border border-border/20">
            {t("calendarView.suggestionsCount", { count: model.counts.datedSuggestions + model.counts.undatedSuggestions })}
          </span>
          <span className="rounded-full bg-muted/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-foreground border border-border/20">
            {t("calendarView.harvestWindowsCount", { count: model.counts.harvests })}
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-3">
            {isQuietMonth && (
              <div className="rounded-2xl border border-dashed border-border/30 bg-muted/20 px-4 py-3 text-sm font-medium text-muted-foreground">
                {t("calendarView.quietMonth")}
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
                  <DayCell key={day.dateKey} day={day} onSelect={setSelectedDay} />
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t("calendarView.unscheduledSuggestions")}
                </h2>
                {model.isCurrentMonth && model.undatedSuggestions.length > 0 && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground border border-border/50">
                    {model.undatedSuggestions.length}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-2.5">
                {!model.isCurrentMonth && (
                  <p className="text-sm text-muted-foreground">
                    {t("calendarView.undatedNote")}
                  </p>
                )}

                {model.isCurrentMonth && model.undatedSuggestions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("calendarView.noUndated")}
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
                          {getPriorityLabel(t, suggestion.priority)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  {t("calendarView.harvestOutlook")}
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
                    {t("calendarView.harvestEmpty")}
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
                        {getHarvestStateLabel(t, harvest.state)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <DayDetailPanel
        day={selectedDay}
        locale={locale}
        onClose={() => setSelectedDay(null)}
        onAddEvent={onAddEvent}
      />
    </div>
  );
}

const EVENT_TYPE_ICONS: Partial<Record<CalendarEventItem["visualType"], string>> = {
  planted: "🌱",
  watered: "💧",
  composted: "🌿",
  weeded: "🪴",
  harvested: "🌾",
  sown: "🌰",
  sprouted: "🌿",
  removed: "🗑️",
  pest: "🪲",
  treatment: "💊",
  observation: "👁️",
  water: "💧",
  harvest: "🌾",
  repot: "🪴",
  compost: "🌿",
  weed: "✂️",
  sow: "🌰",
  fertilize: "🌿",
  no_water: "🌧️",
  frost_protect: "❄️",
  thin_seedlings: "🌱",
  harden_seedlings: "☀️",
  companion_conflict: "🌿",
  succession_sow: "🌱",
  pest_alert: "🪲",
  disease_risk: "🦠",
  end_of_season: "🍂",
  mulch: "🍂",
  prune: "✂️",
};

function DayDetailPanel({
  day,
  locale,
  onClose,
  onAddEvent,
}: {
  day: CalendarDayCell | null;
  locale: string;
  onClose: () => void;
  onAddEvent?: (event: Omit<GardenEvent, "id">) => void;
}) {
  const { t } = useTranslation();
  const isEmpty =
    day !== null &&
    day.events.length === 0 &&
    day.suggestions.length === 0 &&
    day.harvests.length === 0;

  const quickAddActions = [
    {
      type: "watered" as const,
      icon: "💧",
      label: t("calendarView.dayDetail.quickAddActions.watered"),
    },
    {
      type: "harvested" as const,
      icon: "🌾",
      label: t("calendarView.dayDetail.quickAddActions.harvested"),
    },
    {
      type: "pest" as const,
      icon: "🪲",
      label: t("calendarView.dayDetail.quickAddActions.pest"),
    },
    {
      type: "observation" as const,
      icon: "✏️",
      label: t("calendarView.dayDetail.quickAddActions.observation"),
    },
  ];

  const formattedDate = day
    ? new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(parseDateKey(day.dateKey))
    : "";

  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");

  const handleQuickAdd = (type: GardenEvent["type"], note?: string) => {
    if (!day || !onAddEvent) return;
    onAddEvent({
      type,
      date: parseDateKey(day.dateKey).toISOString(),
      profileId: "default",
      ...(note ? { note } : {}),
    });
  };

  const handleAddNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    handleQuickAdd("observation", trimmed);
    setNoteText("");
    setShowNoteInput(false);
  };

  return (
    <Sheet open={day !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto pl-2.5">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formattedDate}
          </SheetTitle>
        </SheetHeader>

        {day && (
          <div className="flex flex-col gap-5">
            {isEmpty && (
              <div className="rounded-2xl border border-dashed border-border/30 bg-muted/20 px-4 py-6 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("calendarView.dayDetail.emptyTitle")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {t("calendarView.dayDetail.emptyHint")}
                </p>
              </div>
            )}

            {day.events.length > 0 && (
              <section>
                <h3 className="mb-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">
                  {t("calendarView.dayDetail.journalEntries")}
                </h3>
                <div className="space-y-2">
                  {day.events.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "rounded-xl border px-3 py-2.5",
                        getEventStyle(event.visualType).chip,
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5">
                          {event.plantIcon ?? EVENT_TYPE_ICONS[event.visualType] ?? "📋"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold leading-snug">
                            {event.label}
                          </p>
                          {event.detail && (
                            <p className="mt-0.5 text-[11px] font-medium opacity-75">
                              {event.detail}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {day.suggestions.length > 0 && (
              <section>
                <h3 className="mb-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">
                  {t("calendarView.dayDetail.suggestionsDue")}
                </h3>
                <div className="space-y-2">
                  {day.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={cn(
                        "rounded-xl border px-3 py-2.5",
                        PRIORITY_STYLES[suggestion.priority].chip,
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {suggestion.plantIcon && (
                              <span className="text-xs">{suggestion.plantIcon}</span>
                            )}
                            <p className="text-sm font-bold leading-snug">
                              {suggestion.label}
                            </p>
                          </div>
                          {suggestion.detail && (
                            <p className="mt-0.5 text-[11px] font-medium opacity-75 flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {suggestion.detail}
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                            PRIORITY_STYLES[suggestion.priority].count,
                          )}
                        >
                          {getPriorityLabel(t, suggestion.priority)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {day.harvests.length > 0 && (
              <section>
                <h3 className="mb-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">
                  {t("calendarView.dayDetail.harvestWindows")}
                </h3>
                <div className="space-y-2">
                  {day.harvests.map((harvest) => (
                    <div
                      key={harvest.id}
                      className={cn(
                        "rounded-xl border px-3 py-2.5",
                        HARVEST_STYLES[harvest.state].chip,
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{harvest.plantIcon}</span>
                            <p className="text-sm font-bold leading-snug">
                              {harvest.plantName}
                            </p>
                          </div>
                          {harvest.detail && (
                            <p className="mt-0.5 text-[11px] font-medium opacity-75">
                              {harvest.detail}
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                            HARVEST_STYLES[harvest.state].badge,
                          )}
                        >
                          {getHarvestStateLabel(t, harvest.state)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {onAddEvent && (
              <section>
                <h3 className="mb-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
                  <Plus className="h-3 w-3" />
                  {t("calendarView.dayDetail.quickAdd")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {quickAddActions.filter((a) => a.type !== "observation").map((action) => (
                    <button
                      key={action.type}
                      type="button"
                      onClick={() => handleQuickAdd(action.type)}
                      className="rounded-full border border-border/30 bg-muted/30 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                    >
                      {`${action.icon} ${action.label}`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setShowNoteInput((v) => !v); setNoteText(""); }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                      showNoteInput
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/30 bg-muted/30 hover:bg-primary/10 hover:border-primary/30 hover:text-primary",
                    )}
                  >
                    {`✏️ ${t("calendarView.dayDetail.quickAddActions.observation")}`}
                  </button>
                </div>
                {showNoteInput && (
                  <div className="mt-2.5 flex flex-col gap-2">
                    <textarea
                      autoFocus
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); }
                        if (e.key === "Escape") { setShowNoteInput(false); setNoteText(""); }
                      }}
                      placeholder={t("calendarView.dayDetail.notePlaceholder")}
                      rows={2}
                      className="w-full resize-none rounded-xl border border-border/40 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddNote}
                        disabled={!noteText.trim()}
                        className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                      >
                        {t("calendarView.dayDetail.addNote")}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNoteInput(false); setNoteText(""); }}
                        className="rounded-full border border-border/30 bg-muted/30 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted/50"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}