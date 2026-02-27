import { useState } from "react";
import { X, Settings, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { PlantDetailsDialog } from "./PlantDetailsDialog";
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
  description?: string;
  variety?: string;
  daysToHarvest?: number;
  plantingDate?: string;
  harvestDate?: string;
  isSeed?: boolean;
  amount?: number;
  spacingCm?: number;
  frostHardy?: boolean;
  companions?: string[];
  antagonists?: string[];
  sowIndoorMonths?: number[];
  sowDirectMonths?: number[];
  harvestMonths?: number[];
  sunRequirement?: "full" | "partial" | "shade";
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
  onPlantAdded?: (plantInstance: PlantInstance, planterId: string) => void;
  onPlantRemoved?: (plantInstance: PlantInstance, planterId: string) => void;
  onPlantUpdated?: (plantInstance: PlantInstance, planterId: string) => void;
  onSquaresChange?: (squares: PlanterSquare[][], planterId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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

  // Helper function to determine which virtual section a square belongs to
  const getVirtualSection = (
    rowIndex: number,
    colIndex: number,
  ): VirtualSection | undefined => {
    if (!virtualSections) return undefined;

    return virtualSections.find((vb) => {
      if (vb.type === "rows") {
        return rowIndex >= vb.start && rowIndex < vb.end;
      } else {
        return colIndex >= vb.start && colIndex < vb.end;
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
        if (side === "top" && rowIndex === vb.start) return true;
        if (side === "bottom" && rowIndex === vb.end - 1) return true;
      } else {
        if (side === "left" && colIndex === vb.start) return true;
        if (side === "right" && colIndex === vb.end - 1) return true;
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

    if (currentSquare.plantInstance && onPlantRemoved) {
      onPlantRemoved(currentSquare.plantInstance, id);
    }

    const newSquares = squares.map((row) => [...row]);
    newSquares[rowIndex][colIndex] = { plantInstance: null };
    setSquares(newSquares);
    onSquaresChange?.(newSquares, id);
  };

  const handleUpdatePlant = (updatedInstance: PlantInstance) => {
    // Update in grid
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

    // Notify parent
    if (onPlantUpdated) {
      onPlantUpdated(updatedInstance, id);
    }
  };

  return (
    <>
      <div className="inline-block bg-white/80 backdrop-blur-md rounded-2xl shadow-lg p-5 border border-white/60 transition-all hover:shadow-xl animate-in fade-in zoom-in duration-500">
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
                className="p-2 bg-muted/40 hover:bg-muted/60 text-muted-foreground rounded-xl transition-all shadow-sm active:scale-90"
                title="Move planter up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
            {!viewOnly && onMoveDown && (
              <button
                onClick={onMoveDown}
                className="p-2 bg-muted/40 hover:bg-muted/60 text-muted-foreground rounded-xl transition-all shadow-sm active:scale-90"
                title="Move planter down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}
            {!viewOnly && onEdit && (
              <button
                onClick={onEdit}
                className="p-2 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl transition-all shadow-sm active:scale-90"
                title="Edit planter"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {!viewOnly && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="p-2 bg-destructive/5 hover:bg-destructive/10 text-destructive rounded-xl transition-all shadow-sm active:scale-90"
                    title="Remove planter"
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
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
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
                        className={cn(
                          "w-12 h-12 rounded-lg relative transition-all hover:scale-105 cursor-pointer shadow-sm flex flex-col items-center justify-center overflow-hidden",
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
                          <div className="flex flex-col items-center justify-center h-full relative animate-in zoom-in duration-300">
                            <span className="text-xl drop-shadow-sm select-none">
                              {square.plantInstance.plant.icon}
                            </span>
                            <span className="text-[7px] font-black uppercase text-muted-foreground/60 truncate w-full px-1 text-center mt-0.5">
                              {square.plantInstance.variety ||
                                square.plantInstance.plant.name}
                            </span>
                          </div>
                        ) : (
                          !viewOnly &&
                          selectedPlant && (
                            <div className="opacity-0 group-hover/square:opacity-20 flex items-center justify-center">
                              <span className="text-xl grayscale select-none">
                                {selectedPlant.icon}
                              </span>
                            </div>
                          )
                        )}
                      </button>
                      {!viewOnly && square.plantInstance && (
                        <button
                          onClick={(e) =>
                            handleRemovePlant(rowIndex, colIndex, e)
                          }
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
