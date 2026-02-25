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
    <div className="h-20 bg-white/70 backdrop-blur-md border border-white/60 p-3 flex items-center gap-4 rounded-xl shadow-lg">
      <div className="flex flex-col gap-1.5 pl-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          Garden Beds
        </label>
        <div className="flex gap-1.5">
          <button
            onClick={onAddGarden}
            className="h-8 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md shadow-primary/10 hover:scale-105 active:scale-95 text-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="font-medium whitespace-nowrap">New Bed</span>
          </button>
          <button
            onClick={onRemoveGarden}
            disabled={gardenCount === 0}
            className="h-8 px-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-destructive/5 hover:scale-105 active:scale-95"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="h-8 w-px bg-border/20 mx-1" />

      <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          Select Plant to Plot
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide px-0.5">
          <button
            onClick={() => onSelectPlant(null)}
            className={`h-8 px-4 rounded-lg border transition-all flex-shrink-0 flex items-center gap-1.5 text-xs ${
              selectedPlant === null
                ? "border-primary bg-primary/10 text-primary font-bold shadow-inner"
                : "border-border/40 bg-white hover:border-primary/40 text-muted-foreground"
            }`}
          >
            Clear Tool
          </button>
          {plants.map((plant) => (
            <button
              key={plant.id}
              onClick={() => onSelectPlant(plant)}
              className={`h-8 px-4 rounded-lg border transition-all flex items-center gap-2 flex-shrink-0 animate-in fade-in zoom-in duration-300 ${
                selectedPlant?.id === plant.id
                  ? "border-primary bg-primary/5 ring-2 ring-primary/5"
                  : "border-transparent bg-white/40 hover:bg-white hover:border-border shadow-sm"
              }`}
            >
              <span className="text-lg drop-shadow-sm">{plant.icon}</span>
              <span
                className={`text-xs font-semibold ${selectedPlant?.id === plant.id ? "text-primary font-bold" : "text-foreground"}`}
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
