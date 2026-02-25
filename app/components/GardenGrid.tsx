import { useState } from 'react';
import { X, Settings } from 'lucide-react';
import { PlantDetailsDialog } from './PlantDetailsDialog';
import { VirtualBed } from './GardenBedDialog';
import { cn } from './ui/utils';

export interface Plant {
  id: string;
  name: string;
  color: string;
  icon: string;
  plantingDate?: string;
  harvestDate?: string;
}

export interface PlantInstance {
  instanceId: string;
  plant: Plant;
  plantingDate?: string;
  harvestDate?: string;
  variety?: string;
  pestEvents?: Array<{
    id: string;
    date: string;
    type: 'pest' | 'treatment';
    description: string;
  }>;
}

export interface GardenSquare {
  plantInstance: PlantInstance | null;
}

interface GardenGridProps {
  id: string;
  name: string;
  rows: number;
  cols: number;
  selectedPlant: Plant | null;
  virtualBeds?: VirtualBed[];
  onPlantAdded?: (plantInstance: PlantInstance, gardenId: string) => void;
  onPlantRemoved?: (plantInstance: PlantInstance, gardenId: string) => void;
  onPlantUpdated?: (plantInstance: PlantInstance, gardenId: string) => void;
  onEdit?: () => void;
}

export function GardenGrid({ 
  id, 
  name, 
  rows, 
  cols, 
  selectedPlant,
  virtualBeds,
  onPlantAdded,
  onPlantRemoved,
  onPlantUpdated,
  onEdit
}: GardenGridProps) {
  const [squares, setSquares] = useState<GardenSquare[][]>(
    Array(rows).fill(null).map(() => 
      Array(cols).fill(null).map(() => ({ plantInstance: null }))
    )
  );
  const [selectedPlantInstance, setSelectedPlantInstance] = useState<PlantInstance | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Helper function to determine which virtual bed a square belongs to
  const getVirtualBed = (rowIndex: number, colIndex: number): VirtualBed | undefined => {
    if (!virtualBeds) return undefined;
    
    return virtualBeds.find(vb => {
      if (vb.type === 'rows') {
        return rowIndex >= vb.start && rowIndex < vb.end;
      } else {
        return colIndex >= vb.start && colIndex < vb.end;
      }
    });
  };

  // Helper function to check if we should draw a thick border
  const shouldDrawThickBorder = (rowIndex: number, colIndex: number, side: 'top' | 'bottom' | 'left' | 'right'): boolean => {
    if (!virtualBeds) return false;

    for (const vb of virtualBeds) {
      if (vb.type === 'rows') {
        if (side === 'top' && rowIndex === vb.start) return true;
        if (side === 'bottom' && rowIndex === vb.end - 1) return true;
      } else {
        if (side === 'left' && colIndex === vb.start) return true;
        if (side === 'right' && colIndex === vb.end - 1) return true;
      }
    }
    
    return false;
  };

  const handleSquareClick = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    const currentSquare = squares[rowIndex][colIndex];
    
    if (currentSquare.plantInstance) {
      // Open details dialog for existing plant
      e.stopPropagation();
      setSelectedPlantInstance(currentSquare.plantInstance);
      setDetailsOpen(true);
    } else if (selectedPlant) {
      // Add new plant
      const newPlantInstance: PlantInstance = {
        instanceId: `instance-${Date.now()}-${Math.random()}`,
        plant: selectedPlant,
        plantingDate: new Date().toISOString(),
        harvestDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        pestEvents: [],
      };
      
      setSquares(prev => {
        const newSquares = prev.map(row => [...row]);
        newSquares[rowIndex][colIndex] = { plantInstance: newPlantInstance };
        return newSquares;
      });
      
      if (onPlantAdded) {
        onPlantAdded(newPlantInstance, id);
      }
    }
  };

  const handleRemovePlant = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentSquare = squares[rowIndex][colIndex];
    
    if (currentSquare.plantInstance && onPlantRemoved) {
      onPlantRemoved(currentSquare.plantInstance, id);
    }
    
    setSquares(prev => {
      const newSquares = prev.map(row => [...row]);
      newSquares[rowIndex][colIndex] = { plantInstance: null };
      return newSquares;
    });
  };

  const handleUpdatePlant = (updatedInstance: PlantInstance) => {
    // Update in grid
    setSquares(prev => {
      const newSquares = prev.map(row => 
        row.map(square => {
          if (square.plantInstance?.instanceId === updatedInstance.instanceId) {
            return { plantInstance: updatedInstance };
          }
          return square;
        })
      );
      return newSquares;
    });

    // Notify parent
    if (onPlantUpdated) {
      onPlantUpdated(updatedInstance, id);
    }
  };

  return (
    <>
      <div className="inline-block bg-white/80 backdrop-blur-md rounded-[3rem] shadow-xl p-8 border border-white/60 transition-all hover:shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex flex-col">
            <h3 className="text-2xl font-bold text-foreground tracking-tight">{name}</h3>
            <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mt-1">{rows} × {cols} Grid • {rows * cols} SQ FT</span>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-3 bg-primary/5 hover:bg-primary/10 text-primary rounded-2xl transition-all shadow-sm active:scale-90"
              title="Edit garden bed"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="inline-block bg-emerald-950/5 p-4 rounded-[2.5rem] border border-border/10">
          {/* Virtual bed labels */}
          {virtualBeds && virtualBeds.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2 px-1">
              {virtualBeds.map((vb) => (
                <div
                  key={vb.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
                  style={{ backgroundColor: vb.color }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 mr-2" />
                  {vb.name}
                </div>
              ))}
            </div>
          )}

          <div className="inline-grid gap-2">
            {squares.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-2">
                {row.map((square, colIndex) => {
                  const vBed = getVirtualBed(rowIndex, colIndex);
                  const hasThickTop = shouldDrawThickBorder(rowIndex, colIndex, 'top');
                  const hasThickBottom = shouldDrawThickBorder(rowIndex, colIndex, 'bottom');
                  const hasThickLeft = shouldDrawThickBorder(rowIndex, colIndex, 'left');
                  const hasThickRight = shouldDrawThickBorder(rowIndex, colIndex, 'right');

                  return (
                    <div key={colIndex} className="relative group/square">
                      <button
                        onClick={(e) => handleSquareClick(rowIndex, colIndex, e)}
                        className={cn(
                          "w-16 h-16 rounded-2xl relative transition-all hover:scale-105 cursor-pointer shadow-sm flex flex-col items-center justify-center overflow-hidden",
                          square.plantInstance ? "bg-white/90" : "bg-white/40 hover:bg-white/80"
                        )}
                        style={{
                          borderTop: hasThickTop ? `4px solid ${vBed?.color || '#15803d'}` : '1px solid rgba(0,0,0,0.05)',
                          borderBottom: hasThickBottom ? `4px solid ${vBed?.color || '#15803d'}` : '1px solid rgba(0,0,0,0.05)',
                          borderLeft: hasThickLeft ? `4px solid ${vBed?.color || '#15803d'}` : '1px solid rgba(0,0,0,0.05)',
                          borderRight: hasThickRight ? `4px solid ${vBed?.color || '#15803d'}` : '1px solid rgba(0,0,0,0.05)',
                        }}
                      >
                        {square.plantInstance ? (
                          <div className="flex flex-col items-center justify-center h-full relative animate-in zoom-in duration-300">
                            <span className="text-3xl drop-shadow-sm select-none">{square.plantInstance.plant.icon}</span>
                            <span className="text-[9px] font-black uppercase text-muted-foreground/60 truncate w-full px-1 text-center mt-1">
                              {square.plantInstance.variety || square.plantInstance.plant.name}
                            </span>
                          </div>
                        ) : selectedPlant && (
                          <div className="opacity-0 group-hover/square:opacity-20 flex items-center justify-center">
                            <span className="text-3xl grayscale select-none">{selectedPlant.icon}</span>
                          </div>
                        )}
                      </button>
                      {square.plantInstance && (
                        <button
                          onClick={(e) => handleRemovePlant(rowIndex, colIndex, e)}
                          className="absolute -top-1 -right-1 bg-white border border-red-100 text-red-500 rounded-full p-1 shadow-lg opacity-0 group-hover/square:opacity-100 hover:bg-red-50 transition-all z-10"
                          title="Remove plant"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PlantDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        plantInstance={selectedPlantInstance}
        onUpdate={handleUpdatePlant}
      />
    </>
  );
}