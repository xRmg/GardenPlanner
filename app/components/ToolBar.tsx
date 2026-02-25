import { Plus, Minus, Edit } from 'lucide-react';
import { Plant } from './GardenGrid';

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
  gardenCount
}: ToolBarProps) {
  return (
    <div className="h-32 bg-card border-t border-border p-4 flex items-center gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm text-muted-foreground">Garden Beds</label>
        <div className="flex gap-2">
          <button
            onClick={onAddGarden}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md"
          >
            <Plus className="w-4 h-4" />
            New Bed
          </button>
          <button
            onClick={onRemoveGarden}
            disabled={gardenCount === 0}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Minus className="w-4 h-4" />
            Remove Last
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {gardenCount} bed{gardenCount !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="h-full w-px bg-border" />

      <div className="flex-1 flex flex-col gap-2">
        <label className="text-sm text-muted-foreground">Select Plant</label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => onSelectPlant(null)}
            className={`px-4 py-2 rounded-lg border-2 transition-all flex-shrink-0 shadow-sm ${
              selectedPlant === null
                ? 'border-primary bg-primary/10 shadow-md'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            None (Remove)
          </button>
          {plants.map((plant) => (
            <button
              key={plant.id}
              onClick={() => onSelectPlant(plant)}
              className={`px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2 flex-shrink-0 shadow-sm ${
                selectedPlant?.id === plant.id
                  ? 'border-primary scale-105 shadow-md'
                  : 'border-border hover:border-primary/50'
              }`}
              style={{
                backgroundColor: selectedPlant?.id === plant.id ? plant.color + '30' : 'white'
              }}
            >
              <span className="text-2xl">{plant.icon}</span>
              <span>{plant.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}