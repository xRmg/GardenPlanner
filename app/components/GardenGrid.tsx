import { useState } from 'react';
import { X, Settings } from 'lucide-react';
import { PlantDetailsDialog } from './PlantDetailsDialog';
import { VirtualBed } from './GardenBedDialog';

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
      <div className="inline-block bg-card rounded-lg shadow-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-foreground">{name}</h3>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 hover:bg-accent rounded transition-colors"
              title="Edit garden bed"
            >
              <Settings className="w-4 h-4 text-primary" />
            </button>
          )}
        </div>

        <div className="inline-block bg-green-200 p-1 rounded">
          {/* Virtual bed labels */}
          {virtualBeds && virtualBeds.length > 0 && (
            <div className="mb-2">
              {virtualBeds.map((vb) => (
                <div
                  key={vb.id}
                  className="inline-block px-2 py-1 rounded text-xs mr-2 mb-1"
                  style={{ backgroundColor: vb.color }}
                >
                  {vb.name}
                </div>
              ))}
            </div>
          )}

          <div className="inline-grid gap-1">
            {squares.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1">
                {row.map((square, colIndex) => {
                  const vBed = getVirtualBed(rowIndex, colIndex);
                  const hasThickTop = shouldDrawThickBorder(rowIndex, colIndex, 'top');
                  const hasThickBottom = shouldDrawThickBorder(rowIndex, colIndex, 'bottom');
                  const hasThickLeft = shouldDrawThickBorder(rowIndex, colIndex, 'left');
                  const hasThickRight = shouldDrawThickBorder(rowIndex, colIndex, 'right');

                  return (
                    <div key={colIndex} className="relative group">
                      <button
                        onClick={(e) => handleSquareClick(rowIndex, colIndex, e)}
                        className="w-16 h-16 rounded relative transition-all hover:scale-105 cursor-pointer"
                        style={{
                          backgroundColor: square.plantInstance 
                            ? square.plantInstance.plant.color 
                            : (vBed?.color || '#ffffff'),
                          borderTop: hasThickTop ? '3px solid #15803d' : '2px solid #86efac',
                          borderBottom: hasThickBottom ? '3px solid #15803d' : '2px solid #86efac',
                          borderLeft: hasThickLeft ? '3px solid #15803d' : '2px solid #86efac',
                          borderRight: hasThickRight ? '3px solid #15803d' : '2px solid #86efac',
                        }}
                      >
                        {square.plantInstance ? (
                          <div className="flex flex-col items-center justify-center h-full relative">
                            <span className="text-2xl">{square.plantInstance.plant.icon}</span>
                            <span className="text-xs mt-1 text-gray-700 truncate w-full px-1">
                              {square.plantInstance.variety || square.plantInstance.plant.name}
                            </span>
                          </div>
                        ) : (
                          <div className="text-gray-400 text-xs">
                            {selectedPlant ? '+' : ''}
                          </div>
                        )}
                      </button>
                      {square.plantInstance && (
                        <button
                          onClick={(e) => handleRemovePlant(rowIndex, colIndex, e)}
                          className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="Remove plant"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-2 text-sm text-muted-foreground">
          {rows} × {cols} grid ({rows * cols} squares)
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