import {
  Calendar,
  Sprout,
  Droplets,
  Leaf,
  Package,
  Scissors,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Plant } from "./PlanterGrid";

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
    | "removed";
  plant?: Plant;
  date: string;
  gardenId?: string;
  note?: string;
}

export interface Suggestion {
  id: string;
  type: "water" | "harvest" | "repot" | "compost" | "weed";
  plant?: Plant;
  priority: "low" | "medium" | "high";
  description: string;
  dueDate?: string;
}

interface EventsBarProps {
  events: GardenEvent[];
  suggestions: Suggestion[];
  harvestAlerts?: Array<{
    plantName: string;
    plantIcon: string;
    daysUntilHarvest: number;
    areaName: string;
  }>;
  onCompleteSuggestion?: (suggestion: Suggestion) => void;
}

const eventIcons = {
  planted: { icon: Sprout, color: "text-green-600" },
  watered: { icon: Droplets, color: "text-blue-600" },
  composted: { icon: Package, color: "text-amber-700" },
  weeded: { icon: Scissors, color: "text-orange-600" },
  harvested: { icon: Leaf, color: "text-purple-600" },
  sown: { icon: Sprout, color: "text-blue-400" },
  sprouted: { icon: Sprout, color: "text-emerald-400" },
  removed: { icon: Trash2, color: "text-red-600" },
};

const suggestionIcons = {
  water: { icon: Droplets, color: "text-blue-600" },
  harvest: { icon: Leaf, color: "text-purple-600" },
  repot: { icon: Package, color: "text-indigo-600" },
  compost: { icon: Package, color: "text-amber-700" },
  weed: { icon: Scissors, color: "text-orange-600" },
};

export function EventsBar({
  events,
  suggestions,
  harvestAlerts = [],
  onCompleteSuggestion,
}: EventsBarProps) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  // Group consecutive touching events of the same type + plant into one entry
  type EventGroup = {
    type: GardenEvent["type"];
    plant?: GardenEvent["plant"];
    date: string; // most recent in group
    count: number;
    key: string;
  };

  const groupedEvents = sortedEvents.reduce<EventGroup[]>((acc, event) => {
    const last = acc[acc.length - 1];
    const sameType = last?.type === event.type;
    const samePlant =
      last?.plant?.id !== undefined
        ? last.plant.id === event.plant?.id
        : last?.plant === undefined && event.plant === undefined;
    if (last && sameType && samePlant) {
      last.count += 1;
    } else {
      acc.push({
        type: event.type,
        plant: event.plant,
        date: event.date,
        count: 1,
        key: event.id,
      });
    }
    return acc;
  }, []);

  const currentMonth = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days ago`;
    } else if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Tomorrow";
    } else if (diffDays < 7) {
      return `In ${diffDays} days`;
    } else {
      return date.toLocaleDateString("en-US", {
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
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div className="w-72 bg-white/60 backdrop-blur-md rounded-2xl border border-white/70 shadow-lg flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-white/20 bg-primary/5">
        <h2 className="flex items-center gap-2 font-black text-foreground tracking-tight text-base uppercase">
          <Calendar className="w-4.5 h-4.5 text-primary" />
          {currentMonth}
        </h2>
      </div>

      {/* Scrollable container for both sections */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 custom-scrollbar space-y-6">
        {/* Harvest Soon Section */}
        {harvestAlerts.length > 0 && (
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-3 px-1">
              Harvest Soon
            </h3>
            <div className="space-y-1.5 mb-2">
              {harvestAlerts.slice(0, 5).map((alert, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-purple-50/60 border border-purple-100 rounded-lg px-2.5 py-2"
                >
                  <span className="text-base shrink-0">{alert.plantIcon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-foreground truncate">
                      {alert.plantName}
                    </p>
                    <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-bold">
                      {alert.areaName}
                    </p>
                  </div>
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                      alert.daysUntilHarvest <= 3
                        ? "bg-red-100 text-red-600"
                        : alert.daysUntilHarvest <= 7
                          ? "bg-orange-100 text-orange-600"
                          : "bg-purple-100 text-purple-600"
                    }`}
                  >
                    {alert.daysUntilHarvest <= 0
                      ? "Now!"
                      : `${alert.daysUntilHarvest}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps Section */}
        <div>
          <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-3 px-1">
            Next Steps
          </h3>
          <div className="space-y-2.5">
            {suggestions.map((suggestion) => {
              const IconComponent = suggestionIcons[suggestion.type].icon;
              const iconColor = suggestionIcons[suggestion.type].color;

              return (
                <div
                  key={suggestion.id}
                  className="bg-white/80 rounded-lg p-2.5 shadow-sm border border-emerald-50 hover:shadow-md transition-all group animate-in slide-in-from-right-4 duration-500"
                >
                  <div className="flex gap-2.5">
                    <div
                      className={`p-1.5 rounded-md bg-muted/20 ${iconColor} shrink-0 mt-0.5`}
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
                          {suggestion.priority}
                        </span>
                        {suggestion.dueDate && (
                          <span className="text-[8px] font-medium text-muted-foreground/40">
                            {formatDate(suggestion.dueDate)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-foreground mt-0.5 leading-tight">
                        {suggestion.description}
                      </p>
                      {suggestion.plant && (
                        <div className="flex items-center gap-1 mt-0.5 opacity-60">
                          <span className="text-xs scale-90 origin-left">
                            {suggestion.plant.icon}
                          </span>
                          <span className="text-[7.5px] font-black uppercase text-muted-foreground tracking-wider">
                            {suggestion.plant.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onCompleteSuggestion?.(suggestion)}
                      className="shrink-0 p-1 rounded-lg text-muted-foreground/30 hover:text-emerald-500 hover:bg-emerald-50 transition-all mt-0.5"
                      title="Mark done"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {suggestions.length === 0 && (
              <div className="text-center py-6 px-4 text-muted-foreground/40 bg-white/30 rounded-2xl border border-dashed border-border/40">
                <div className="text-lg mb-0.5">✨</div>
                <p className="text-[9px] font-black uppercase tracking-widest">
                  All caught up!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Garden Journal Section */}
        <div>
          <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-3 px-1">
            Garden Journal
          </h3>
          <div className="space-y-1.5 ">
            {groupedEvents.map((group) => {
              const IconComponent = eventIcons[group.type].icon;
              const iconColor = eventIcons[group.type].color;

              return (
                <div
                  key={group.key}
                  className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white/40 transition-colors animate-in fade-in duration-300"
                >
                  <div
                    className={`p-1 rounded-md bg-white shadow-sm border border-border/5 ${iconColor} shrink-0`}
                  >
                    <IconComponent className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-semibold text-foreground truncate text-[11px]">
                      <span className="font-black">
                        {group.type.charAt(0).toUpperCase() +
                          group.type.slice(1)}
                      </span>
                      {group.plant && ` ${group.plant.name}`}
                    </p>
                    <div className="flex items-center gap-2 mt-0">
                      <span className="text-[8px] font-medium text-muted-foreground/40">
                        {formatEventDate(group.date)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {group.count > 1 && (
                      <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                        ×{group.count}
                      </span>
                    )}
                    {group.plant && (
                      <span className="text-base opacity-80">
                        {group.plant.icon}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="text-center py-4 text-muted-foreground/20 text-[10px] font-bold uppercase tracking-widest">
                No recent logs
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
