import { useState, useMemo } from "react";
import { Plus, Map as MapIcon } from "lucide-react";
import { Plant } from "./PlanterGrid";

interface ToolBarProps {
  plants: Plant[];
  selectedPlant: Plant | null;
  onSelectPlant: (plant: Plant | null) => void;
  onAddArea: () => void;
  onAddPlant: () => void;
  seedlingCount?: number;
  onShowSeedlings?: () => void;
}

type PlantFilter = "all" | "plants" | "seeds";

const LOW_STOCK_THRESHOLD = 5;

export function ToolBar({
  plants,
  selectedPlant,
  onSelectPlant,
  onAddArea,
  onAddPlant,
  seedlingCount = 0,
  onShowSeedlings,
}: ToolBarProps) {
  const [filter, setFilter] = useState<PlantFilter>("all");

  const { filtered, seedCount, plantCount } = useMemo(() => {
    const seeds = plants.filter((p) => p.isSeed);
    const nonSeeds = plants.filter((p) => !p.isSeed);
    const list =
      filter === "plants" ? nonSeeds : filter === "seeds" ? seeds : plants;
    return { filtered: list, seedCount: seeds.length, plantCount: nonSeeds.length };
  }, [plants, filter]);

  return (
    <div className="min-h-20 bg-white/70 backdrop-blur-md border border-white/60 p-3 flex items-center gap-4 rounded-xl shadow-lg flex-wrap">
      {/* Left: Garden organisation */}
      <div className="flex flex-col gap-1.5 pl-2 shrink-0">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          Garden
        </label>
        <div className="flex gap-1.5">
          <button
            onClick={onAddArea}
            className="h-8 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md shadow-primary/10 hover:scale-105 active:scale-95 text-sm"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="font-medium whitespace-nowrap">New Area</span>
          </button>
          {onShowSeedlings && (
            <button
              onClick={onShowSeedlings}
              className={`h-8 px-3 rounded-lg border transition-all flex-shrink-0 flex items-center gap-1.5 text-xs font-bold ${
                seedlingCount > 0
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-border/30 bg-white/40 text-muted-foreground hover:bg-white/70"
              }`}
            >
              🌱
              {seedlingCount > 0 && (
                <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {seedlingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="h-8 w-px bg-border/20 mx-1 shrink-0" />

      {/* Right: Plant selection with filter */}
      <div className="flex-1 flex flex-col gap-1.5 overflow-hidden min-w-0">
        {/* Filter tabs row */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 shrink-0">
            Plot Plant
          </label>
          <div className="flex gap-0.5 bg-muted/30 rounded-md p-0.5">
            {(
              [
                { key: "all", label: `All (${plants.length})` },
                { key: "plants", label: `🌿 ${plantCount}` },
                { key: "seeds", label: `🌾 ${seedCount}` },
              ] as { key: PlantFilter; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                  filter === key
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Plant buttons */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide px-0.5">
          <button
            onClick={onAddPlant}
            className="h-8 px-3 rounded-lg border border-dashed border-primary text-primary hover:bg-primary/5 transition-all flex-shrink-0 flex items-center gap-1.5 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          <div className="w-px h-6 bg-border/20 self-center mx-1 shrink-0" />
          <button
            onClick={() => onSelectPlant(null)}
            className={`h-8 px-4 rounded-lg border transition-all flex-shrink-0 flex items-center gap-1.5 text-xs ${
              selectedPlant === null
                ? "border-primary bg-primary/10 text-primary font-bold shadow-inner"
                : "border-border/40 bg-white hover:border-primary/40 text-muted-foreground"
            }`}
          >
            Clear
          </button>

          {filtered.length === 0 ? (
            <span className="self-center text-[10px] text-muted-foreground/50 italic px-2">
              No {filter === "seeds" ? "seeds" : filter === "plants" ? "plants" : "items"} yet
            </span>
          ) : (
            filtered.map((plant) => {
              const isSelected = selectedPlant?.id === plant.id;
              const isDepleted = plant.isSeed && plant.amount === 0;
              const isInfinite = plant.amount === undefined || plant.amount === null;
              const showBadge = plant.isSeed && !isInfinite;

              return (
                <button
                  key={plant.id}
                  onClick={() => onSelectPlant(isDepleted ? null : plant)}
                  disabled={isDepleted}
                  title={
                    isDepleted
                      ? `${plant.name} – out of seeds`
                      : plant.isSeed
                        ? `${plant.name} (${isInfinite ? "∞" : plant.amount} seeds)`
                        : plant.name
                  }
                  className={`h-8 px-3 rounded-lg border transition-all flex items-center gap-1.5 flex-shrink-0 animate-in fade-in zoom-in duration-300 relative ${
                    isDepleted
                      ? "border-red-200 bg-red-50/50 opacity-50 cursor-not-allowed grayscale"
                      : isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/5 shadow-sm"
                        : "border-transparent bg-white/40 hover:bg-white hover:border-border shadow-sm"
                  }`}
                >
                  <span className="text-base drop-shadow-sm">{plant.icon}</span>
                  <span
                    className={`text-xs font-semibold ${
                      isSelected && !isDepleted ? "text-primary font-bold" : "text-foreground"
                    }`}
                  >
                    {plant.name}
                  </span>
                  {/* Inventory badge */}
                  {showBadge && !isDepleted && (
                    <span
                      className={`text-[8px] font-black px-1 py-px rounded leading-none ${
                        (plant.amount ?? 0) <= LOW_STOCK_THRESHOLD
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {plant.amount}
                    </span>
                  )}
                  {plant.isSeed && isInfinite && (
                    <span className="text-[8px] font-black px-1 py-px rounded leading-none bg-emerald-50 text-emerald-600">
                      ∞
                    </span>
                  )}
                  {isDepleted && (
                    <span className="text-[7px] font-black px-1 py-px rounded leading-none bg-red-100 text-red-600 uppercase">
                      Empty
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
