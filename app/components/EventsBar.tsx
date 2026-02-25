import {
  Calendar,
  Sprout,
  Droplets,
  Leaf,
  Package,
  Scissors,
} from "lucide-react";
import { Plant } from "./GardenGrid";

export interface GardenEvent {
  id: string;
  type: "planted" | "watered" | "composted" | "weeded" | "harvested";
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
  onCompleteSuggestion?: (suggestion: Suggestion) => void;
}

const eventIcons = {
  planted: { icon: Sprout, color: "text-green-600" },
  watered: { icon: Droplets, color: "text-blue-600" },
  composted: { icon: Package, color: "text-amber-700" },
  weeded: { icon: Scissors, color: "text-orange-600" },
  harvested: { icon: Leaf, color: "text-purple-600" },
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
  onCompleteSuggestion,
}: EventsBarProps) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

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
    <div className="w-72 bg-white/60 backdrop-blur-md rounded-xl border border-white/70 shadow-lg flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border/5 bg-primary/5">
        <h2 className="flex items-center gap-2 font-bold text-foreground tracking-tight text-lg">
          <Calendar className="w-5 h-5 text-primary" />
          {currentMonth}
        </h2>
      </div>

      {/* Suggestions Section */}
      <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
        <div className="mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-3 px-1">
            Next Steps
          </h3>
          <div className="space-y-2">
            {suggestions.map((suggestion) => {
              const IconComponent = suggestionIcons[suggestion.type].icon;
              const iconColor = suggestionIcons[suggestion.type].color;

              return (
                <div
                  key={suggestion.id}
                  className="bg-white/80 rounded-lg p-3 shadow-sm border border-emerald-50 hover:shadow-md transition-all group animate-in slide-in-from-right-4 duration-500"
                >
                  <div className="flex gap-2.5 mb-0.5">
                    <div className={`p-2 rounded-md bg-muted/20 ${iconColor}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
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
                          <span className="text-[9px] font-medium text-muted-foreground/40">
                            {formatDate(suggestion.dueDate)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-foreground mt-0.5 leading-tight">
                        {suggestion.description}
                      </p>
                      {suggestion.plant && (
                        <div className="flex items-center gap-1 mt-0.5 opacity-60">
                          <span className="text-xs">
                            {suggestion.plant.icon}
                          </span>
                          <span className="text-[8px] font-black uppercase text-muted-foreground tracking-wider">
                            {suggestion.plant.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onCompleteSuggestion?.(suggestion)}
                    className="w-full mt-2 py-2 rounded-2xl bg-primary/5 hover:bg-primary text-primary hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2"
                  >
                    Done
                  </button>
                </div>
              );
            })}
            {suggestions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground/40 italic text-sm bg-white/20 rounded-3xl border border-dashed border-border/50">
                All caught up!
              </div>
            )}
          </div>
        </div>

        {/* Garden Journal Section */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-3 px-1">
            Garden Journal
          </h3>
          <div className="space-y-1">
            {sortedEvents.map((event) => {
              const IconComponent = eventIcons[event.type].icon;
              const iconColor = eventIcons[event.type].color;

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/40 transition-colors animate-in fade-in duration-300"
                >
                  <div
                    className={`p-1.5 rounded-md bg-white shadow-sm border border-border/5 ${iconColor}`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-semibold text-foreground truncate">
                      <span className="font-bold">
                        {event.type.charAt(0).toUpperCase() +
                          event.type.slice(1)}
                      </span>
                      {event.plant && ` ${event.plant.name}`}
                    </p>
                    <div className="flex items-center gap-2 mt-0">
                      <span className="text-[9px] font-medium text-muted-foreground/40">
                        {formatEventDate(event.date)}
                      </span>
                    </div>
                  </div>
                  {event.plant && (
                    <span className="text-lg opacity-80">
                      {event.plant.icon}
                    </span>
                  )}
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="text-center py-6 text-muted-foreground/30 text-xs italic">
                Logs will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
