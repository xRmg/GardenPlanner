import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Plus, Map as MapIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Plant } from "./PlanterGrid";
import { getPlantDisplayName } from "../i18n/utils/plantTranslation";

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
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<PlantFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollState]);

  // Re-check whenever the filtered list changes
  useEffect(() => {
    // Small delay to let DOM settle after filter change
    const timer = setTimeout(updateScrollState, 50);
    return () => clearTimeout(timer);
  }, [filter, updateScrollState]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const { filtered, seedCount, plantCount } = useMemo(() => {
    const seeds = plants.filter((p) => p.isSeed);
    const nonSeeds = plants.filter((p) => !p.isSeed);
    const list =
      filter === "plants" ? nonSeeds : filter === "seeds" ? seeds : plants;
    return {
      filtered: list,
      seedCount: seeds.length,
      plantCount: nonSeeds.length,
    };
  }, [plants, filter]);

  return (
    <div className="min-h-20 bg-card border border-border p-3 flex items-center gap-4 rounded-xl shadow-sm flex-wrap">
      {/* Left: Garden organisation */}
      <div className="flex flex-col gap-1.5 pl-2 shrink-0">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {t("toolbar.garden")}
        </label>
        <div className="flex gap-1.5">
          <button
            onClick={onAddArea}
            className="h-8 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-[background-color,transform] flex items-center gap-1.5 shadow-md shadow-primary/10 hover:scale-105 active:scale-95 text-sm"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="font-medium whitespace-nowrap">{t("toolbar.newArea")}</span>
          </button>
          {onShowSeedlings && (
            <button
              onClick={onShowSeedlings}
              className={`h-8 px-3 rounded-lg border transition-[color,background-color,border-color] shrink-0 flex items-center gap-1.5 text-xs font-bold ${
                seedlingCount > 0
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-border/30 bg-white/40 text-muted-foreground hover:bg-white/70"
              }`}
            >
              🌱
              {seedlingCount > 0 && (
                <span className="bg-emerald-600 text-white text-xs font-black px-1.5 py-0.5 rounded-full leading-none">
                  {seedlingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="h-8 w-px bg-border mx-1 shrink-0" />

      {/* Right: Plant selection with filter */}
      <div className="flex-1 flex flex-col gap-1.5 overflow-hidden min-w-0">
        {/* Filter tabs row */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 shrink-0">
            {t("toolbar.plotPlant")}
          </label>
          <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
            {(
              [
                { key: "all", label: t("toolbar.allCount", { count: plants.length }) },
                { key: "plants", label: t("toolbar.plantsCount", { count: plantCount }) },
                { key: "seeds", label: t("toolbar.seedsCount", { count: seedCount }) },
              ] as { key: PlantFilter; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider transition-[color,background-color] ${
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
        <div className="relative flex items-center">
          {/* Left fade + arrow */}
          <div
            className={`absolute left-0 top-0 bottom-0 z-10 flex items-center transition-opacity duration-200 ${canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <div className="absolute inset-y-0 left-0 w-10 bg-linear-to-r from-card to-transparent" />
            <button
              onClick={() => scroll("left")}
              className="relative z-10 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-md transition-[box-shadow,color] ml-0.5"
              aria-label={t("toolbar.scrollPlantsLeft")}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide px-0.5"
          >
            <button
              onClick={onAddPlant}
              className="h-8 px-3 rounded-lg border border-dashed border-primary text-primary hover:bg-primary/5 transition-[background-color] shrink-0 flex items-center gap-1.5 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("toolbar.add")}
            </button>
            <div className="w-px h-6 bg-border self-center mx-1 shrink-0" />

            {filtered.length === 0 ? (
              <span className="self-center text-[10px] text-muted-foreground/50 italic px-2">
                {filter === "seeds"
                  ? t("toolbar.noSeedsYet")
                  : filter === "plants"
                    ? t("toolbar.noPlantsYet")
                    : t("toolbar.noItemsYet")}
              </span>
            ) : (
              filtered.map((plant) => {
                const isSelected = selectedPlant?.id === plant.id;
                const isDepleted = plant.isSeed && plant.amount === 0;
                const isInfinite =
                  plant.amount === undefined || plant.amount === null;
                const showBadge = plant.isSeed && !isInfinite;
                const displayName = getPlantDisplayName(plant, i18n.language);

                return (
                  <button
                    key={plant.id}
                    onClick={() => onSelectPlant(isDepleted ? null : plant)}
                    disabled={isDepleted}
                    title={
                      isDepleted
                        ? t("toolbar.outOfSeeds", { name: displayName })
                        : plant.isSeed
                          ? isInfinite
                            ? t("toolbar.infiniteSeeds", { name: displayName })
                            : t("toolbar.seedsAvailable", { name: displayName, count: plant.amount })
                          : displayName
                    }
                    className={`h-8 px-3 rounded-lg border transition-[background-color,border-color,box-shadow] flex items-center gap-1.5 shrink-0 animate-in fade-in zoom-in duration-300 relative ${
                      isDepleted
                        ? "border-red-200 bg-red-50/50 opacity-50 cursor-not-allowed grayscale"
                        : isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/5 shadow-sm"
                          : "border-border/60 bg-white/70 hover:bg-white hover:border-border shadow-sm"
                    }`}
                  >
                    <span className="text-base drop-shadow-sm">
                      {plant.icon}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        isSelected && !isDepleted
                          ? "text-primary font-bold"
                          : "text-foreground"
                      }`}
                    >
                      {displayName}
                    </span>
                    {/* Inventory badge */}
                    {showBadge && !isDepleted && (
                      <span
                        className={`text-xs font-black px-1 py-px rounded leading-none ${
                          (plant.amount ?? 0) <= LOW_STOCK_THRESHOLD
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {plant.amount}
                      </span>
                    )}
                    {plant.isSeed && isInfinite && (
                      <span className="text-xs font-black px-1 py-px rounded leading-none bg-emerald-50 text-emerald-600">
                        ∞
                      </span>
                    )}
                    {isDepleted && (
                      <span className="text-[7px] font-black px-1 py-px rounded leading-none bg-red-100 text-red-600 uppercase">
                        {t("common.empty")}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Right fade + arrow */}
          <div
            className={`absolute right-0 top-0 bottom-0 z-10 flex items-center justify-end transition-opacity duration-200 ${canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <div className="absolute inset-y-0 right-0 w-10 bg-linear-to-l from-card to-transparent" />
            <button
              onClick={() => scroll("right")}
              className="relative z-10 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-md transition-[box-shadow,color] mr-0.5"
              aria-label={t("toolbar.scrollPlantsRight")}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
