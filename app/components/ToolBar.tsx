import { Plus, Minus } from "lucide-react";
import { Plant } from "./GardenGrid";

interface ToolBarProps {
  plants: Plant[];
  selectedPlant: Plant | null;
  onSelectPlant: (plant: Plant | null) => void;
  onAddGarden: () => void;
  onRemoveGarden: () => void;
  gardenCount: number;
}

export function ToolBar({
  plants,
  selectedPlant,
  onSelectPlant,
  onAddGarden,
  onRemoveGarden,
  gardenCount,
}: ToolBarProps) {
  return (
    <div className="h-28 bg-white/70 backdrop-blur-md border border-white/60 p-4 flex items-center gap-6 rounded-[2.5rem] shadow-2xl">
      <div className="flex flex-col gap-2 pl-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
          Garden Beds
        </label>
        <div className="flex gap-2">
          <button
            onClick={onAddGarden}
            className="h-10 px-5 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium whitespace-nowrap">New Bed</span>
          </button>
          <button
            onClick={onRemoveGarden}
            disabled={gardenCount === 0}
            className="h-10 px-5 bg-destructive text-destructive-foreground rounded-2xl hover:bg-destructive/90 transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-destructive/10 hover:scale-105 active:scale-95"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-12 w-px bg-border/20 mx-2" />

      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
          Select Plant to Plot
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-1">
          <button
            onClick={() => onSelectPlant(null)}
            className={`h-10 px-5 rounded-2xl border transition-all flex-shrink-0 flex items-center gap-2 ${
              selectedPlant === null
                ? "border-primary bg-primary/10 text-primary font-bold shadow-inner"
                : "border-border/50 bg-white hover:border-primary/50"
            }`}
          >
            Clear Tool
          </button>
          {plants.map((plant) => (
            <button
              key={plant.id}
              onClick={() => onSelectPlant(plant)}
              className={`h-10 px-5 rounded-2xl border-2 transition-all flex items-center gap-3 flex-shrink-0 animate-in fade-in zoom-in duration-300 ${
                selectedPlant?.id === plant.id
                  ? "border-primary scale-105 shadow-xl shadow-primary/10 bg-primary/5 ring-4 ring-primary/10"
                  : "border-transparent bg-white/40 hover:bg-white hover:border-border shadow-sm"
              }`}
            >
              <span className="text-2xl drop-shadow-sm">{plant.icon}</span>
              <span
                className={`font-medium ${selectedPlant?.id === plant.id ? "text-primary font-bold" : "text-foreground"}`}
              >
                {plant.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
