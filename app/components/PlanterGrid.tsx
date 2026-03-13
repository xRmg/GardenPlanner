import { useState } from "react";
import { X, Settings, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { PlantDetailsDialog } from "./PlantDetailsDialog";
import { RemovalConfirmDialog } from "./RemovalConfirmDialog";
import { VirtualSection } from "./PlanterDialog";
import { cn } from "./ui/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

export interface Plant {
  id: string;
  name: string;
  color: string;
  icon: string;
  latinName?: string;
  description?: string;
  variety?: string;
  daysToHarvest?: number;
  plantingDate?: string;
  harvestDate?: string;
  isSeed?: boolean;
  amount?: number;
  spacingCm?: number;
  frostHardy?: boolean;
  frostSensitive?: boolean;
  watering?: string;
  growingTips?: string;
  companions?: string[];
  antagonists?: string[];
  sowIndoorMonths?: number[];
  sowDirectMonths?: number[];
  harvestMonths?: number[];
  sunRequirement?: "full" | "partial" | "shade";
  source?: "bundled" | "synced" | "custom";
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
    type: "pest" | "treatment";
    description: string;
  }>;
}

export interface PlanterSquare {
  plantInstance: PlantInstance | null;
}

interface PlanterGridProps {
  id: string;
  name: string;
  rows: number;
  cols: number;
  selectedPlant: Plant | null;
  initialSquares?: PlanterSquare[][];
  virtualSections?: VirtualSection[];
  backgroundColor?: string;
  viewOnly?: boolean;
  getAvailableStock?: (plantId: string) => number;
  onPlantAdded?: (plantInstance: PlantInstance, planterId: string) => void;
  onPlantRemoved?: (
    plantInstance: PlantInstance,
    planterId: string,
    eventType?: "harvested" | "removed",
  ) => void;
  onPlantUpdated?: (
    plantInstance: PlantInstance,
    previousPlantInstance: PlantInstance | null,
    planterId: string,
  ) => void;
  onSquaresChange?: (squares: PlanterSquare[][], planterId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function abbreviatePlantName(name: string): string {
  if (name.length <= 9) return name;
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return name.slice(0, 8) + ".";
  }
  if (words.length === 2) {
    const first =
      words[0].length > 6 ? words[0].slice(0, 5) + "." : words[0];
    return first + " " + words[1][0].toUpperCase() + ".";
  }
  // 3+ words → all initials
  return words.map((w) => w[0].toUpperCase() + ".").join("");
}

export function PlanterGrid({
  id,
  name,
  rows,
  cols,
  selectedPlant,
  initialSquares,
  virtualSections,
  backgroundColor,
  viewOnly = false,
  getAvailableStock,
  onPlantAdded,
  onPlantRemoved,
  onPlantUpdated,
  onSquaresChange,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: PlanterGridProps) {
  const buildEmptyGrid = () =>
    Array(rows)
      .fill(null)
      .map(() =>
        Array(cols)
          .fill(null)
          .map(() => ({ plantInstance: null })),
      );

  const [squares, setSquares] = useState<PlanterSquare[][]>(() => {
    if (
      initialSquares &&
      initialSquares.length === rows &&
      initialSquares[0]?.length === cols
    ) {
      return initialSquares;
    }
    return buildEmptyGrid();
  });
  const [selectedPlantInstance, setSelectedPlantInstance] =
    useState<PlantInstance | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [plantToRemove, setPlantToRemove] = useState<{
    plantInstance: PlantInstance;
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  // Helper function to determine which virtual section a square belongs to
  const getVirtualSection = (
    rowIndex: number,
    colIndex: number,
  ): VirtualSection | undefined => {
    if (!virtualSections) return undefined;

    return virtualSections.find((vb) => {
      if (vb.type === "rows") {
        return rowIndex + 1 >= vb.start && rowIndex + 1 <= vb.end;
      } else {
        return colIndex + 1 >= vb.start && colIndex + 1 <= vb.end;
      }
    });
  };

  // Helper function to check if we should draw a thick border
  const shouldDrawThickBorder = (
    rowIndex: number,
    colIndex: number,
    side: "top" | "bottom" | "left" | "right",
  ): boolean => {
    if (!virtualSections) return false;

    for (const vb of virtualSections) {
      if (vb.type === "rows") {
        if (side === "top" && rowIndex + 1 === vb.start) return true;
        if (side === "bottom" && rowIndex + 1 === vb.end) return true;
      } else {
        if (side === "left" && colIndex + 1 === vb.start) return true;
        if (side === "right" && colIndex + 1 === vb.end) return true;
      }
    }

    return false;
  };

  const handleSquareClick = (
    rowIndex: number,
    colIndex: number,
    e: React.MouseEvent,
  ) => {
    const currentSquare = squares[rowIndex][colIndex];

    if (currentSquare.plantInstance) {
      // Open details dialog for existing plant
      e.stopPropagation();
      setSelectedPlantInstance(currentSquare.plantInstance);
      setDetailsOpen(true);
    } else if (selectedPlant) {
      // Check if stock is available
      const availableStock = getAvailableStock?.(selectedPlant.id) ?? 1;
      if (availableStock <= 0) {
        // Insufficient stock - do not allow placement
        return;
      }

      // Add new plant
      const newPlantInstance: PlantInstance = {
        instanceId: `instance-${Date.now()}-${Math.random()}`,
        plant: selectedPlant,
        plantingDate: new Date().toISOString(),
        harvestDate: new Date(
          Date.now() +
            (selectedPlant.daysToHarvest ?? 60) * 24 * 60 * 60 * 1000,
        ).toISOString(),
        pestEvents: [],
      };

      const newSquares = squares.map((row) => [...row]);
      newSquares[rowIndex][colIndex] = { plantInstance: newPlantInstance };
      setSquares(newSquares);
      onSquaresChange?.(newSquares, id);

      if (onPlantAdded) {
        onPlantAdded(newPlantInstance, id);
      }
    }
  };

  const handleRemovePlant = (
    rowIndex: number,
    colIndex: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const currentSquare = squares[rowIndex][colIndex];
    if (currentSquare.plantInstance) {
      setPlantToRemove({
        plantInstance: currentSquare.plantInstance,
        rowIndex,
        colIndex,
      });
    }
  };

  const handleRemovalConfirm = (eventType: "harvested" | "removed") => {
    if (!plantToRemove) return;
    const { plantInstance, rowIndex, colIndex } = plantToRemove;

    if (onPlantRemoved) {
      onPlantRemoved(plantInstance, id, eventType);
    }

    const newSquares = squares.map((row) => [...row]);
    newSquares[rowIndex][colIndex] = { plantInstance: null };
    setSquares(newSquares);
    onSquaresChange?.(newSquares, id);
    setPlantToRemove(null);
  };

  const handleUpdatePlant = (updatedInstance: PlantInstance) => {
    const previousPlantInstance = squares
      .flat()
      .find(
        (square) =>
          square.plantInstance?.instanceId === updatedInstance.instanceId,
      )?.plantInstance;
    const newSquares = squares.map((row) =>
      row.map((square) => {
        if (square.plantInstance?.instanceId === updatedInstance.instanceId) {
          return { plantInstance: updatedInstance };
        }
        return square;
      }),
    );
    setSquares(newSquares);
    onSquaresChange?.(newSquares, id);
    if (onPlantUpdated) {
      onPlantUpdated(updatedInstance, previousPlantInstance ?? null, id);
    }
  };

  return (
    <>
      <div className="inline-block bg-card rounded-2xl shadow-sm p-5 border border-border/20 transition-shadow hover:shadow-md animate-in fade-in zoom-in duration-500">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-foreground tracking-tight">
              {name}
            </h3>
            <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mt-0.5">
              {rows} × {cols} Grid • {rows * cols} SQ FT
            </span>
          </div>
          <div className="flex gap-1">
            {!viewOnly && onMoveUp && (
              <button
                onClick={onMoveUp}
                className="p-2 bg-muted/40 hover:bg-muted/60 text-muted-foreground rounded-xl transition-[background-color,transform] duration-150 shadow-sm active:scale-[0.96]"
                title="Move planter up"
                aria-label={`Move ${name} up`}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
            {!viewOnly && onMoveDown && (
              <button
                onClick={onMoveDown}
                className="p-2 bg-muted/40 hover:bg-muted/60 text-muted-foreground rounded-xl transition-[background-color,transform] duration-150 shadow-sm active:scale-[0.96]"
                title="Move planter down"
                aria-label={`Move ${name} down`}
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}
            {!viewOnly && onEdit && (
              <button
                onClick={onEdit}
                className="p-2 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl transition-[background-color,transform] duration-150 shadow-sm active:scale-[0.96]"
                title="Edit planter"
                aria-label={`Edit ${name}`}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {!viewOnly && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="p-2 bg-destructive/5 hover:bg-destructive/10 text-destructive rounded-xl transition-[background-color,transform] duration-150 shadow-sm active:scale-[0.96]"
                    title="Remove planter"
                    aria-label={`Remove ${name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Planter?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{name}" and all its planted
                      vegetables. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Planter
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div
          className="inline-block p-2 rounded-xl border border-black/10 shadow-inner"
          style={{
            backgroundColor: backgroundColor || "rgba(6, 78, 59, 0.05)",
          }}
        >
          {/* Virtual section labels */}
          {virtualSections && virtualSections.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5 px-0.5">
              {virtualSections.map((vb) => (
                <div
                  key={vb.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider text-white shadow-sm"
                  style={{ backgroundColor: vb.color }}
                >
                  <div className="w-1 h-1 rounded-full bg-white/40 mr-1.5" />
                  {vb.name}
                </div>
              ))}
            </div>
          )}

          <div className="inline-grid gap-1.5">
            {squares.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.5">
                {row.map((square, colIndex) => {
                  const vSection = getVirtualSection(rowIndex, colIndex);
                  const hasThickTop = shouldDrawThickBorder(
                    rowIndex,
                    colIndex,
                    "top",
                  );
                  const hasThickBottom = shouldDrawThickBorder(
                    rowIndex,
                    colIndex,
                    "bottom",
                  );
                  const hasThickLeft = shouldDrawThickBorder(
                    rowIndex,
                    colIndex,
                    "left",
                  );
                  const hasThickRight = shouldDrawThickBorder(
                    rowIndex,
                    colIndex,
                    "right",
                  );

                  return (
                    <div key={colIndex} className="relative group/square">
                      <button
                        onClick={(e) =>
                          handleSquareClick(rowIndex, colIndex, e)
                        }
                        title={
                          square.plantInstance
                            ? `${square.plantInstance.plant.name}${square.plantInstance.plant.spacingCm ? ` · ${square.plantInstance.plant.spacingCm}cm spacing` : ""}`
                            : undefined
                        }
                        aria-label={
                          square.plantInstance
                            ? `${square.plantInstance.plant.name} at row ${rowIndex + 1}, column ${colIndex + 1}`
                            : selectedPlant
                              ? `Place ${selectedPlant.name} at row ${rowIndex + 1}, column ${colIndex + 1}`
                              : `Row ${rowIndex + 1}, column ${colIndex + 1} — empty`
                        }
                        className={cn(
                          "w-12 h-12 rounded-lg relative transition-[transform,background-color,box-shadow] duration-150 hover:scale-105 cursor-pointer shadow-sm flex flex-col items-center justify-center overflow-hidden",
                          square.plantInstance
                            ? "bg-white/90"
                            : "bg-white/40 hover:bg-white/80",
                        )}
                        style={{
                          borderTop: hasThickTop
                            ? `3px solid ${vSection?.color || "#15803d"}`
                            : "1px solid rgba(0,0,0,0.05)",
                          borderBottom: hasThickBottom
                            ? `3px solid ${vSection?.color || "#15803d"}`
                            : "1px solid rgba(0,0,0,0.05)",
                          borderLeft: hasThickLeft
                            ? `3px solid ${vSection?.color || "#15803d"}`
                            : "1px solid rgba(0,0,0,0.05)",
                          borderRight: hasThickRight
                            ? `3px solid ${vSection?.color || "#15803d"}`
                            : "1px solid rgba(0,0,0,0.05)",
                        }}
                      >
                        {square.plantInstance ? (
                          <div className="flex flex-col items-center justify-center h-full relative animate-plant-place">
                            <span className="text-xl drop-shadow-sm select-none">
                              {square.plantInstance.plant.icon}
                            </span>
                            <span className="text-[7px] font-black uppercase text-muted-foreground/60 truncate w-full px-1 text-center mt-0.5">
                              {abbreviatePlantName(
                                square.plantInstance.variety ||
                                  square.plantInstance.plant.name,
                              )}
                            </span>
                          </div>
                        ) : (
                          !viewOnly &&
                          selectedPlant && (
                            <>
                              {(getAvailableStock?.(selectedPlant.id) ?? 1) >
                              0 ? (
                                <div className="opacity-0 group-hover/square:opacity-20 transition-opacity duration-200 flex items-center justify-center">
                                  <span className="text-xl grayscale select-none">
                                    {selectedPlant.icon}
                                  </span>
                                </div>
                              ) : (
                                <div className="opacity-0 group-hover/square:opacity-100 flex items-center justify-center bg-red-50/80 text-red-600 text-xs font-semibold">
                                  No stock
                                </div>
                              )}
                            </>
                          )
                        )}
                      </button>
                      {!viewOnly && square.plantInstance && (
                        <button
                          onClick={(e) =>
                            handleRemovePlant(rowIndex, colIndex, e)
                          }
                          className="absolute -top-1 -right-1 bg-white border border-red-100 text-red-500 rounded-full p-1 shadow-lg opacity-0 group-hover/square:opacity-100 hover:bg-red-50 transition-[opacity,background-color,transform] duration-150 hover:scale-110 active:scale-95 z-10"
                          title="Remove plant"
                          aria-label={`Remove ${square.plantInstance?.plant.name}`}
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

      <RemovalConfirmDialog
        open={plantToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPlantToRemove(null);
        }}
        plantInstance={plantToRemove?.plantInstance ?? null}
        onConfirm={handleRemovalConfirm}
      />

      <PlantDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        plantInstance={selectedPlantInstance}
        onUpdate={handleUpdatePlant}
      />
    </>
  );
}
