import React from "react";
import {
  Calendar,
  Sprout,
  Droplets,
  Leaf,
  Package,
  Scissors,
  CheckCircle2,
  Trash2,
  Sun,
  Snowflake,
  Bug,
  Sparkles,
  Loader2,
  CloudRain,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Plant } from "./PlanterGrid";
import type { Priority, SuggestionMode } from "../data/schema";
import { Button } from "./ui/button";
import { getPlantName } from "../i18n/utils/plantTranslation";
import { InfoTooltip } from "./ui/info-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export interface GardenEvent {
  id: string;
  type:
    | "planted"
    | "watered"
    | "composted"
    | "weeded"
    | "harvested"
    | "sown"
    | "sprouted"
    | "removed"
    | "pest"
    | "treatment"
    | "observation";
  plant?: Plant;
  date: string;
  gardenId?: string;
  instanceId?: string;
  note?: string;
  /** Where in the garden hierarchy this action was logged. */
  scope?: "plant" | "planter" | "area";
  /** Area ID for planter- or area-scope events. */
  areaId?: string;
  /** Human-readable planter name for display in the journal. */
  planterName?: string;
  /** Human-readable area name for display in the journal. */
  areaName?: string;
  /** Original suggestion type when this log came from a completed suggestion. */
  suggestionType?: Suggestion["type"];
  /** Original suggestion title for journal rendering. */
  suggestionDescription?: string;
  /** Source of the suggestion that produced this event. */
  suggestionSource?: "rules" | "ai" | "static";
}

export interface Suggestion {
  id: string;
  type:
    | "water"
    | "harvest"
    | "repot"
    | "compost"
    | "weed"
    | "sow"
    | "fertilize"
    | "treatment"
    | "no_water"
    | "frost_protect"
    | "thin_seedlings"
    | "harden_seedlings"
    | "companion_conflict"
    | "succession_sow"
    | "pest_alert"
    | "disease_risk"
    | "end_of_season"
    | "mulch"
    | "prune";
  plant?: Plant;
  priority: "low" | "medium" | "high";
  description: string;
  dueDate?: string;
  planterId?: string;
  instanceId?: string;
  expiresAt?: string;
  source?: "rules" | "ai" | "static";
  /** Area ID for planter-wide suggestions. */
  areaId?: string;
  /** Human-readable area name for display. */
  areaName?: string;
  /** Human-readable planter name for display. */
  planterName?: string;
  /** Explicit scope of the suggestion target. */
  scope?: "area" | "planter" | "plant";
}

interface EventsBarProps {
  events: GardenEvent[];
  suggestions: Suggestion[];
  onCompleteSuggestion?: (suggestion: Suggestion) => void;
  onOpenTreatmentSuggestion?: (suggestion: Suggestion) => void;
  suggestionsMode?: SuggestionMode;
  suggestionsLoading?: boolean;
}

const eventIcons: Partial<Record<GardenEvent["type"], { icon: React.ElementType; color: string }>> = {
  planted: { icon: Sprout, color: "text-green-600" },
  watered: { icon: Droplets, color: "text-blue-600" },
  composted: { icon: Package, color: "text-amber-700" },
  weeded: { icon: Scissors, color: "text-orange-600" },
  harvested: { icon: Leaf, color: "text-purple-600" },
  sown: { icon: Sprout, color: "text-blue-400" },
  sprouted: { icon: Sprout, color: "text-emerald-400" },
  removed: { icon: Trash2, color: "text-red-600" },
  pest: { icon: Bug, color: "text-red-600" },
  treatment: { icon: Sparkles, color: "text-emerald-600" },
  observation: { icon: Calendar, color: "text-teal-600" },
};

const suggestionIcons: Record<
  string,
  { icon: React.ElementType; color: string }
> = {
  water: { icon: Droplets, color: "text-blue-600" },
  harvest: { icon: Leaf, color: "text-purple-600" },
  repot: { icon: Package, color: "text-indigo-600" },
  compost: { icon: Package, color: "text-amber-700" },
  weed: { icon: Scissors, color: "text-orange-600" },
  sow: { icon: Sprout, color: "text-emerald-600" },
  fertilize: { icon: Package, color: "text-yellow-600" },
  treatment: { icon: Sparkles, color: "text-emerald-600" },
  no_water: { icon: CloudRain, color: "text-sky-500" },
  frost_protect: { icon: Snowflake, color: "text-cyan-600" },
  thin_seedlings: { icon: Sprout, color: "text-lime-600" },
  harden_seedlings: { icon: Sun, color: "text-yellow-500" },
  companion_conflict: { icon: Leaf, color: "text-rose-600" },
  succession_sow: { icon: Sprout, color: "text-teal-600" },
  pest_alert: { icon: Bug, color: "text-red-600" },
  disease_risk: { icon: Bug, color: "text-orange-700" },
  end_of_season: { icon: Leaf, color: "text-amber-600" },
  mulch: { icon: Leaf, color: "text-amber-800" },
  prune: { icon: Scissors, color: "text-violet-600" },
};

const DEFAULT_SUGGESTION_ICON = {
  icon: Package,
  color: "text-muted-foreground",
};

const eventBg: Partial<Record<GardenEvent["type"], string>> = {
  planted: "bg-green-50",
  watered: "bg-blue-50",
  composted: "bg-amber-50",
  weeded: "bg-orange-50",
  harvested: "bg-purple-50",
  sown: "bg-sky-50",
  sprouted: "bg-emerald-50",
  removed: "bg-red-50",
  pest: "bg-red-50",
  treatment: "bg-emerald-50",
  observation: "bg-teal-50",
};

function getEventVisual(event: Pick<GardenEvent, "type" | "suggestionType">) {
  if (event.suggestionType) {
    const suggestionVisual =
      suggestionIcons[event.suggestionType] ?? DEFAULT_SUGGESTION_ICON;

    return {
      icon: suggestionVisual.icon,
      color: suggestionVisual.color,
      background: suggestionBg[event.suggestionType] ?? "bg-white",
    };
  }

  const eventVisual = eventIcons[event.type] ?? DEFAULT_SUGGESTION_ICON;
  return {
    icon: eventVisual.icon,
    color: eventVisual.color,
    background: eventBg[event.type] ?? "bg-white",
  };
}

const suggestionBg: Record<string, string> = {
  water: "bg-blue-50",
  harvest: "bg-purple-50",
  repot: "bg-indigo-50",
  compost: "bg-amber-50",
  weed: "bg-orange-50",
  sow: "bg-emerald-50",
  fertilize: "bg-yellow-50",
  treatment: "bg-emerald-50",
  no_water: "bg-sky-50",
  frost_protect: "bg-cyan-50",
  thin_seedlings: "bg-lime-50",
  harden_seedlings: "bg-yellow-50",
  companion_conflict: "bg-rose-50",
  succession_sow: "bg-teal-50",
  pest_alert: "bg-red-50",
  disease_risk: "bg-orange-50",
  end_of_season: "bg-amber-50",
  mulch: "bg-amber-50",
  prune: "bg-violet-50",
};

const MODE_BADGE_CLASSES: Record<SuggestionMode, string> = {
  "ai+weather": "bg-violet-50 text-violet-600 border border-violet-200",
  "rules+weather": "bg-sky-50 text-sky-600 border border-sky-200",
  rules: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  static: "bg-gray-50 text-gray-500 border border-gray-200",
};

const MODE_BADGE_I18N_KEYS = {
  "ai+weather": "eventsBar.modeBadges.aiWeather",
  "rules+weather": "eventsBar.modeBadges.rulesWeather",
  rules: "eventsBar.modeBadges.rules",
  static: "eventsBar.modeBadges.static",
} as const satisfies Record<SuggestionMode, string>;

const MODE_BADGE_TOOLTIP_I18N_KEYS = {
  "ai+weather": "eventsBar.modeBadgeTooltips.aiWeather",
  "rules+weather": "eventsBar.modeBadgeTooltips.rulesWeather",
  rules: "eventsBar.modeBadgeTooltips.rules",
  static: "eventsBar.modeBadgeTooltips.static",
} as const satisfies Record<SuggestionMode, string>;

function getEventTypeLabel(
  t: ReturnType<typeof useTranslation>["t"],
  type: GardenEvent["type"],
): string {
  const translate = t as (key: string) => string;

  switch (type) {
    case "planted":
      return translate("common.eventTypes.planted");
    case "watered":
      return translate("common.eventTypes.watered");
    case "composted":
      return translate("common.eventTypes.composted");
    case "weeded":
      return translate("common.eventTypes.weeded");
    case "harvested":
      return translate("common.eventTypes.harvested");
    case "sown":
      return translate("common.eventTypes.sown");
    case "sprouted":
      return translate("common.eventTypes.sprouted");
    case "removed":
      return translate("common.eventTypes.removed");
    case "pest":
      return translate("common.eventTypes.pest");
    case "treatment":
      return translate("common.eventTypes.treatment");
    case "observation":
      return translate("common.eventTypes.observation");
  }
}

function getPriorityLabel(
  t: ReturnType<typeof useTranslation>["t"],
  priority: Priority,
): string {
  const translate = t as (key: string) => string;

  switch (priority) {
    case "high":
      return translate("common.priorities.high");
    case "medium":
      return translate("common.priorities.medium");
    case "low":
      return translate("common.priorities.low");
  }
}

/**
 * Derives the human-readable location label for a suggestion based on its
 * scope, areaName, and planterName. Returns null when no context is available.
 */
function getSuggestionLocationLabel(s: Suggestion): string | null {
  const { scope, areaName, planterName } = s;
  if (scope === "area") return areaName ?? null;
  if (scope === "planter") {
    if (planterName && areaName) return `${areaName} › ${planterName}`;
    return planterName ?? areaName ?? null;
  }
  // plant scope with no plant object, or no scope set — show planter/area if available
  if (!s.plant) return planterName ?? areaName ?? null;
  return null;
}

export function EventsBar({
  events,
  suggestions,
  onCompleteSuggestion,
  onOpenTreatmentSuggestion,
  suggestionsMode,
  suggestionsLoading = false,
}: EventsBarProps) {
  const { t, i18n } = useTranslation();
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  // Group consecutive touching events of the same type + plant into one entry
  type EventGroup = {
    type: GardenEvent["type"];
    plant?: GardenEvent["plant"];
    date: string; // most recent in group
    count: number;
    note?: string;
    key: string;
    scope?: GardenEvent["scope"];
    planterName?: string;
    areaName?: string;
    suggestionType?: GardenEvent["suggestionType"];
    suggestionDescription?: GardenEvent["suggestionDescription"];
  };

  const groupedEvents = sortedEvents.reduce<EventGroup[]>((acc, event) => {
    const last = acc[acc.length - 1];
    const sameType = last?.type === event.type;
    const samePlant =
      last?.plant?.id !== undefined
        ? last.plant.id === event.plant?.id
        : last?.plant === undefined && event.plant === undefined;
    const sameNote = last?.note === event.note;
    const sameScope =
      last?.scope === event.scope &&
      last?.planterName === event.planterName &&
      last?.areaName === event.areaName;
    const sameSuggestionType = last?.suggestionType === event.suggestionType;
    const sameSuggestionDescription =
      last?.suggestionDescription === event.suggestionDescription;
    if (
      last &&
      sameType &&
      samePlant &&
      sameNote &&
      sameScope &&
      sameSuggestionType &&
      sameSuggestionDescription
    ) {
      last.count += 1;
    } else {
      acc.push({
        type: event.type,
        plant: event.plant,
        date: event.date,
        count: 1,
        note: event.note,
        key: event.id,
        scope: event.scope,
        planterName: event.planterName,
        areaName: event.areaName,
        suggestionType: event.suggestionType,
        suggestionDescription: event.suggestionDescription,
      });
    }
    return acc;
  }, []);

  const currentMonth = new Date().toLocaleDateString(i18n.language, {
    month: "long",
    year: "numeric",
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return t("eventsBar.daysAgo", { count: Math.abs(diffDays) });
    } else if (diffDays === 0) {
      return t("eventsBar.today");
    } else if (diffDays === 1) {
      return t("eventsBar.tomorrow");
    } else if (diffDays < 7) {
      return t("eventsBar.inDays", { count: diffDays });
    } else {
      return date.toLocaleDateString(i18n.language, {
        month: "short",
        day: "numeric",
      });
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t("eventsBar.today");
    } else if (diffDays === 1) {
      return t("eventsBar.yesterday");
    } else if (diffDays < 7) {
      return t("eventsBar.daysAgo", { count: diffDays });
    } else {
      return date.toLocaleDateString(i18n.language, {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div className="w-72 bg-card rounded-2xl border border-border shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-border bg-linear-to-br from-primary/20 to-primary/5">
        <h2 className="flex items-center gap-2 font-black text-foreground tracking-tight text-base uppercase">
          <Calendar className="w-5 h-5 text-primary" aria-hidden="true" />
          {currentMonth}
        </h2>
      </div>

      {/* Scrollable container for both sections */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 custom-scrollbar space-y-6">
        {/* Next Steps Section */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              {t("eventsBar.nextSteps")}
            </h3>
            <div className="flex items-center gap-1.5">
              {suggestionsLoading && (
                <Loader2 className="w-2.5 h-2.5 text-muted-foreground/40 animate-spin" />
              )}
              {suggestionsMode && !suggestionsLoading && (
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${MODE_BADGE_CLASSES[suggestionsMode]}`}
                  >
                    {t(MODE_BADGE_I18N_KEYS[suggestionsMode])}
                  </span>
                  <InfoTooltip
                    content={t(MODE_BADGE_TOOLTIP_I18N_KEYS[suggestionsMode])}
                    ariaLabel={t(MODE_BADGE_I18N_KEYS[suggestionsMode])}
                    side="left"
                    className="h-3.5 w-3.5"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2.5">
            {suggestionsLoading && suggestions.length === 0
              ? // Loading skeleton
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-card rounded-lg p-2.5 shadow-sm border border-border/10 animate-pulse"
                  >
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-muted/20 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2 bg-muted/20 rounded w-16" />
                        <div className="h-3 bg-muted/20 rounded w-full" />
                      </div>
                    </div>
                  </div>
                ))
              : suggestions.map((suggestion, suggestionIdx) => {
                  const iconEntry =
                    suggestionIcons[suggestion.type] ?? DEFAULT_SUGGESTION_ICON;
                  const IconComponent = iconEntry.icon;
                  const iconColor = iconEntry.color;

                  return (
                    <div
                      key={suggestion.id}
                      className="relative overflow-hidden bg-card rounded-lg p-2.5 shadow-sm border border-border/10 hover:shadow-md transition-shadow group animate-in fade-in slide-in-from-right-3 duration-300 fill-mode-both"
                      style={{ animationDelay: `${suggestionIdx * 55}ms` }}
                    >
                      {suggestion.priority !== "low" && (
                        <div
                          className={`absolute inset-y-0 left-0 w-1 ${
                            suggestion.priority === "high"
                              ? "bg-red-300"
                              : "bg-amber-300"
                          }`}
                        />
                      )}
                      <div className="flex gap-2.5">
                        <div
                          className={`p-1.5 rounded-md ${suggestionBg[suggestion.type] ?? "bg-muted/20"} ${iconColor} shrink-0 mt-0.5`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${
                                suggestion.priority === "high"
                                  ? "bg-red-50 text-red-500"
                                  : suggestion.priority === "medium"
                                    ? "bg-orange-50 text-orange-500"
                                    : "bg-blue-50 text-blue-500"
                              }`}
                            >
                              {getPriorityLabel(t, suggestion.priority)}
                            </span>
                            <div className="flex items-center gap-1">
                              {suggestion.source === "ai" && (
                                <Tooltip delayDuration={250}>
                                  <TooltipTrigger asChild>
                                    <span className="text-[6px] font-black text-violet-400/60 uppercase tracking-wider cursor-help">
                                      AI
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-64 leading-relaxed">
                                    {t("eventsBar.aiBadgeTooltip")}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {suggestion.dueDate && (
                                <span className="text-xs font-medium text-muted-foreground/40">
                                  {formatDate(suggestion.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-bold text-foreground mt-0.5 leading-tight">
                            {suggestion.description}
                          </p>
                          {/* Scope-aware location context (LAS.2) */}
                          {getSuggestionLocationLabel(suggestion) && (
                            <div className="flex items-center gap-1 mt-0.5 opacity-60">
                              <span className="text-[7.5px] font-black uppercase text-muted-foreground tracking-wider">
                                {getSuggestionLocationLabel(suggestion)}
                              </span>
                            </div>
                          )}
                          {suggestion.plant && (
                            <div className="flex items-center gap-1 mt-0.5 opacity-60">
                              <span className="text-xs scale-90 origin-left">
                                {suggestion.plant.icon}
                              </span>
                              <span className="text-[7.5px] font-black uppercase text-muted-foreground tracking-wider">
                                {getPlantName(
                                  suggestion.plant.id,
                                  suggestion.plant.name,
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                        {suggestion.type === "treatment" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-0.5 h-7 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-wider"
                            onClick={() =>
                              onOpenTreatmentSuggestion?.(suggestion)
                            }
                          >
                            {t("eventsBar.options")}
                          </Button>
                        ) : (
                          <Tooltip delayDuration={250}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => onCompleteSuggestion?.(suggestion)}
                                className="shrink-0 p-1 rounded-lg text-muted-foreground/30 hover:text-emerald-500 hover:bg-emerald-50 hover:scale-110 active:scale-95 transition-[color,background-color,transform] duration-150 mt-0.5"
                                aria-label={t("eventsBar.markSuggestionDone")}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-64 leading-relaxed">
                              {t("eventsBar.markSuggestionDoneTooltip")}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
            {!suggestionsLoading && suggestions.length === 0 && (
                <div className="text-center py-6 px-4 text-muted-foreground/40 bg-muted/20 rounded-2xl border border-dashed border-border/40">
                <div className="text-lg mb-0.5 animate-float-gentle">✨</div>
                <p className="text-xs font-black uppercase tracking-widest">
                  {t("eventsBar.allCaughtUp")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Garden Journal Section */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-3 px-1">
            {t("eventsBar.gardenJournal")}
          </h3>
          <div className="space-y-1.5 ">
              {groupedEvents.map((group, groupIdx) => {
              const eventVisual = getEventVisual(group);
              const IconComponent = eventVisual.icon;
              const iconColor = eventVisual.color;
              const plantName = group.plant
                ? getPlantName(group.plant.id, group.plant.name)
                : undefined;
              const title = group.suggestionDescription
                ? group.suggestionDescription
                : `${getEventTypeLabel(t, group.type)}${plantName ? ` ${plantName}` : ""}`;
              const detailNote =
                group.note && group.note !== group.suggestionDescription
                  ? group.note
                  : undefined;

              return (
                <div
                  key={group.key}
                  className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both"
                  style={{ animationDelay: `${Math.min(groupIdx, 8) * 40}ms` }}
                >
                  <div
                    className={`p-1 rounded-md ${eventVisual.background} shadow-sm border border-border/5 ${iconColor} shrink-0`}
                  >
                    <IconComponent className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-semibold text-foreground truncate text-[11px]">
                      <span className="font-black">{title}</span>
                    </p>
                    {/* Scope context — show area name for area-scope events, planter name for planter-scope events */}
                    {(group.scope === "planter" || group.scope === "area") && (() => {
                      let locationLabel: string;
                      if (group.scope === "area") {
                        locationLabel = group.areaName ?? "";
                      } else {
                        locationLabel = group.planterName ?? group.areaName ?? "";
                      }
                      return locationLabel ? (
                        <p className="text-[10px] text-muted-foreground/60 font-semibold truncate mt-0.5">
                          {locationLabel}
                        </p>
                      ) : null;
                    })()}
                    {detailNote && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                        {detailNote}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0">
                      <span className="text-xs font-medium text-muted-foreground/40">
                        {formatEventDate(group.date)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {group.count > 1 && (
                      <span className="text-xs font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                        ×{group.count}
                      </span>
                    )}
                    {group.plant && (
                      <span className="text-base opacity-80">
                        {group.plant.icon}
                      </span>
                    )}
                    {/* Area-scope badge */}
                    {group.scope === "area" && !group.plant && (
                      <span className="text-[9px] font-black bg-muted/60 text-muted-foreground/60 px-1 py-0.5 rounded uppercase tracking-wider">
                        {t("eventsBar.scopeBadgeArea")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="text-center py-5 px-2">
                <p className="text-muted-foreground/30 text-[10px] font-bold uppercase tracking-widest">
                  {t("eventsBar.noLogsYet")}
                </p>
                <p className="text-muted-foreground/20 text-xs mt-1 normal-case font-medium">
                  {t("eventsBar.noLogsHint")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
