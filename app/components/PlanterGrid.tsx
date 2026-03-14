import { useEffect, useMemo, useRef, useState } from "react";
import { X, Settings, Trash2, ArrowUp, ArrowDown, Move } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PlantDetailsDialog } from "./PlantDetailsDialog";
import { MovePlantPicker } from "./MovePlantPicker";
import { RemovalConfirmDialog } from "./RemovalConfirmDialog";
import { VirtualSection } from "./PlanterDialog";
import { cn } from "./ui/utils";
import { useIsMobile } from "./ui/use-mobile";
import type { Area as MoveArea, GrowthStage, HealthState } from "../data/schema";
import { getPlantDisplayName } from "../i18n/utils/plantTranslation";
import type { PlantMoveLocation } from "../services/plantMovement";
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
  daysToFlower?: number;
  daysToFruit?: number;
  plantingDate?: string;
  harvestDate?: string;
  isSeed?: boolean;
  amount?: number;
  spacingCm?: number;
  frostHardy?: boolean;
  frostSensitive?: boolean;
  watering?: string;
  growingTips?: string;
  localizedContent?: Record<
    string,
    {
      description?: string | null;
      watering?: string | null;
      growingTips?: string | null;
    }
  >;
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
  growthStage?: GrowthStage | null;
  growthStageOverride?: boolean;
  healthState?: HealthState | null;
}

export interface PlanterSquare {
  plantInstance: PlantInstance | null;
}

interface PlanterGridProps {
  areaId: string;
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
  onHealthStateChange?: (instance: PlantInstance, planterId: string) => void;
  moveAreas: MoveArea[];
  activeDragSource: PlantMoveLocation | null;
  onDragSourceChange: (source: PlantMoveLocation | null) => void;
  onMovePlant: (source: PlantMoveLocation, target: PlantMoveLocation) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/**
 * Returns all [row, col] positions forming the 8-connected metaplant group
 * containing the seed cell. Two cells belong to the same group when they share
 * the same plant name (case-sensitive).
 */
function findMetaplantGroup(
  squares: PlanterSquare[][],
  seedRow: number,
  seedCol: number,
): Array<[number, number]> {
  const plantName = squares[seedRow][seedCol].plantInstance?.plant.name;
  if (!plantName) return [];

  const rows = squares.length;
  const cols = squares[0]?.length ?? 0;
  const visited = new Set<string>();
  const group: Array<[number, number]> = [];

  const queue: Array<[number, number]> = [[seedRow, seedCol]];
  visited.add(`${seedRow},${seedCol}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    group.push([r, c]);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        const key = `${nr},${nc}`;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (visited.has(key)) continue;
        visited.add(key);
        if (squares[nr][nc].plantInstance?.plant.name === plantName) {
          queue.push([nr, nc]);
        }
      }
    }
  }

  return group;
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
  areaId,
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
  onHealthStateChange,
  moveAreas,
  activeDragSource,
  onDragSourceChange,
  onMovePlant,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: PlanterGridProps) {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
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
  // Set of "row,col" keys currently highlighted as part of a metaplant group
  const [highlightedCells, setHighlightedCells] = useState<Set<string>>(
    new Set(),
  );
  // true = user right-clicked (single-cell override); false = group selection
  const [singleCellMode, setSingleCellMode] = useState(false);
  // Set of "row,col" keys whose group is currently hovered (for group-wide zoom)
  const [hoveredCells, setHoveredCells] = useState<Set<string>>(new Set());
  const [dragOverCell, setDragOverCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [movePickerSource, setMovePickerSource] = useState<{
    location: PlantMoveLocation;
    plantInstance: PlantInstance;
  } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (
      initialSquares &&
      initialSquares.length === rows &&
      initialSquares[0]?.length === cols
    ) {
      setSquares(initialSquares);
      return;
    }

    setSquares(buildEmptyGrid());
  }, [cols, initialSquares, rows]);

  useEffect(() => {
    if (!detailsOpen) {
      setHighlightedCells(new Set());
      setSingleCellMode(false);
    }
  }, [detailsOpen]);

  useEffect(() => {
    if (!activeDragSource) {
      setDragOverCell(null);
    }
  }, [activeDragSource]);

  // Precompute group sizes for all cells to avoid repeated flood-fills in render
  const groupSizeMap = useMemo(() => {
    const map = new Map<string, number>();
    const processed = new Set<string>();
    squares.forEach((row, r) => {
      row.forEach((square, c) => {
        const key = `${r},${c}`;
        if (!square.plantInstance || processed.has(key)) return;
        const group = findMetaplantGroup(squares, r, c);
        group.forEach(([gr, gc]) => {
          const gkey = `${gr},${gc}`;
          map.set(gkey, group.length);
          processed.add(gkey);
        });
      });
    });
    return map;
  }, [squares]);
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
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const currentSquare = squares[rowIndex][colIndex];

    if (currentSquare.plantInstance) {
      e.stopPropagation();
      // Compute metaplant group and highlight all members
      const group = findMetaplantGroup(squares, rowIndex, colIndex);
      setHighlightedCells(new Set(group.map(([r, c]) => `${r},${c}`)));
      setSingleCellMode(false);
      setSelectedPlantInstance(currentSquare.plantInstance);
      setDetailsOpen(true);
    } else if (selectedPlant) {
      // Clicking an empty cell clears any active highlight
      setHighlightedCells(new Set());
      setSingleCellMode(false);

      // Check if stock is available
      const availableStock = getAvailableStock?.(selectedPlant.id) ?? 1;
      if (availableStock <= 0) {
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
    } else {
      // Empty cell, no plant selected — clear highlights
      setHighlightedCells(new Set());
      setSingleCellMode(false);
    }
  };

  const handleRightClickCell = (
    rowIndex: number,
    colIndex: number,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const currentSquare = squares[rowIndex][colIndex];
    if (!currentSquare.plantInstance) return;
    // Single-cell mode: highlight only this cell and open dialog
    setHighlightedCells(new Set([`${rowIndex},${colIndex}`]));
    setSingleCellMode(true);
    setSelectedPlantInstance(currentSquare.plantInstance);
    setDetailsOpen(true);
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

    const newSquares = squares.map((row, rIdx) =>
      row.map((square, cIdx) => {
        if (square.plantInstance?.instanceId === updatedInstance.instanceId) {
          return { plantInstance: updatedInstance };
        }
        // Propagate pest events, health state, and growth stage to other members of the same metaplant group
        if (
          !singleCellMode &&
          highlightedCells.size > 1 &&
          highlightedCells.has(`${rIdx},${cIdx}`) &&
          square.plantInstance &&
          square.plantInstance.plant.name === updatedInstance.plant.name
        ) {
          const prevHealthState = previousPlantInstance?.healthState ?? null;
          const prevGrowthStage = previousPlantInstance?.growthStage ?? null;
          const cellHealthState = square.plantInstance.healthState ?? null;
          const cellGrowthStage = square.plantInstance.growthStage ?? null;
          return {
            plantInstance: {
              ...square.plantInstance,
              pestEvents: updatedInstance.pestEvents,
              // Only propagate health if this cell had the same health state as the original (before update)
              healthState:
                cellHealthState === prevHealthState
                  ? updatedInstance.healthState
                  : square.plantInstance.healthState,
              // Only propagate growth stage override if this cell had the same stage as the original
              ...(updatedInstance.growthStageOverride &&
                cellGrowthStage === prevGrowthStage && {
                  growthStage: updatedInstance.growthStage,
                  growthStageOverride: updatedInstance.growthStageOverride,
                }),
              // Also clear override on other cells if user switched back to auto
              ...(!updatedInstance.growthStageOverride &&
                (square.plantInstance.growthStageOverride ?? false) &&
                cellGrowthStage === prevGrowthStage && {
                  growthStage: null,
                  growthStageOverride: false,
                }),
            },
          };
        }
        return square;
      }),
    );

    setSquares(newSquares);
    onSquaresChange?.(newSquares, id);

    if (onPlantUpdated) {
      onPlantUpdated(updatedInstance, previousPlantInstance ?? null, id);
    }
    if (
      onHealthStateChange &&
      updatedInstance.healthState !== (previousPlantInstance?.healthState ?? null)
    ) {
      onHealthStateChange(updatedInstance, id);
    }
  };

  const handleDragStart = (
    rowIndex: number,
    colIndex: number,
    e: React.DragEvent,
  ) => {
    if (!squares[rowIndex][colIndex].plantInstance) return;
    const source = { areaId, planterId: id, row: rowIndex, col: colIndex };
    onDragSourceChange(source);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/gardenplanner-plant", JSON.stringify(source));
    e.dataTransfer.setData("text/plain", `${rowIndex},${colIndex}`);
  };

  const handleDragOver = (
    rowIndex: number,
    colIndex: number,
    e: React.DragEvent,
  ) => {
    e.preventDefault();
    if (!activeDragSource) return;
    if (
      activeDragSource.areaId === areaId &&
      activeDragSource.planterId === id &&
      activeDragSource.row === rowIndex &&
      activeDragSource.col === colIndex
    ) {
      return;
    }
    e.dataTransfer.dropEffect = "move";
    setDragOverCell({ row: rowIndex, col: colIndex });
  };

  const handleDragLeave = (rowIndex: number, colIndex: number) => {
    if (
      dragOverCell?.row === rowIndex &&
      dragOverCell?.col === colIndex
    ) {
      setDragOverCell(null);
    }
  };

  const handleDrop = (
    rowIndex: number,
    colIndex: number,
    e: React.DragEvent,
  ) => {
    e.preventDefault();
    if (!activeDragSource) return;
    setDragOverCell(null);
    const target = { areaId, planterId: id, row: rowIndex, col: colIndex };
    if (
      activeDragSource.areaId === target.areaId &&
      activeDragSource.planterId === target.planterId &&
      activeDragSource.row === target.row &&
      activeDragSource.col === target.col
    ) {
      onDragSourceChange(null);
      return;
    }

    onMovePlant(activeDragSource, target);
    onDragSourceChange(null);
  };

  const handleDragEnd = () => {
    onDragSourceChange(null);
    setDragOverCell(null);
  };

  const clearLongPressTimer = () => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const openMovePicker = (
    rowIndex: number,
    colIndex: number,
    plantInstance: PlantInstance,
  ) => {
    setMovePickerSource({
      location: { areaId, planterId: id, row: rowIndex, col: colIndex },
      plantInstance,
    });
  };

  const handleTouchStart = (
    rowIndex: number,
    colIndex: number,
    plantInstance: PlantInstance | null,
  ) => {
    if (!isMobile || viewOnly || !plantInstance) return;

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      suppressClickRef.current = true;
      openMovePicker(rowIndex, colIndex, plantInstance);
      clearLongPressTimer();
    }, 450);
  };

  const isDragSourceCell =
    activeDragSource?.areaId === areaId && activeDragSource?.planterId === id;

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
                title={t("planterGrid.movePlanterUpTitle")}
                aria-label={t("planterGrid.movePlanterUpAriaLabel", { name })}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
            {!viewOnly && onMoveDown && (
              <button
                onClick={onMoveDown}
                className="p-2 bg-muted/40 hover:bg-muted/60 text-muted-foreground rounded-xl transition-[background-color,transform] duration-150 shadow-sm active:scale-[0.96]"
                title={t("planterGrid.movePlanterDownTitle")}
                aria-label={t("planterGrid.movePlanterDownAriaLabel", { name })}
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}
            {!viewOnly && onEdit && (
              <button
                onClick={onEdit}
                className="p-2 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl transition-[background-color,transform] duration-150 shadow-sm active:scale-[0.96]"
                title={t("planterGrid.editPlanterTitle")}
                aria-label={t("planterGrid.editPlanterAriaLabel", { name })}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {!viewOnly && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="p-2 bg-destructive/5 hover:bg-destructive/10 text-destructive rounded-xl transition-[background-color,transform] duration-150 shadow-sm active:scale-[0.96]"
                    title={t("planterGrid.removePlanterTitle")}
                    aria-label={t("planterGrid.removePlanterAriaLabel", {
                      name,
                    })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("planterGrid.removePlanterDialogTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("planterGrid.removePlanterDialogDescription", {
                        name,
                      })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("planterGrid.deletePlanter")}
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
                        onContextMenu={(e) =>
                          handleRightClickCell(rowIndex, colIndex, e)
                        }
                        onMouseEnter={() => {
                          if (square.plantInstance) {
                            const group = findMetaplantGroup(squares, rowIndex, colIndex);
                            setHoveredCells(new Set(group.map(([r, c]) => `${r},${c}`)));
                          }
                        }}
                        onMouseLeave={() => setHoveredCells(new Set())}
                        draggable={!viewOnly && !!square.plantInstance}
                        onDragStart={(e) =>
                          handleDragStart(rowIndex, colIndex, e)
                        }
                        onDragOver={(e) =>
                          handleDragOver(rowIndex, colIndex, e)
                        }
                        onDragLeave={() =>
                          handleDragLeave(rowIndex, colIndex)
                        }
                        onDrop={(e) => handleDrop(rowIndex, colIndex, e)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={() =>
                          handleTouchStart(
                            rowIndex,
                            colIndex,
                            square.plantInstance,
                          )
                        }
                        onTouchEnd={clearLongPressTimer}
                        onTouchCancel={clearLongPressTimer}
                        onTouchMove={clearLongPressTimer}
                        title={
                          square.plantInstance
                            ? `${getPlantDisplayName(square.plantInstance.plant, i18n.language)}${square.plantInstance.plant.spacingCm ? ` · ${t("common.spacingCm", { count: square.plantInstance.plant.spacingCm })}` : ""}`
                            : undefined
                        }
                        aria-label={
                          square.plantInstance
                            ? t("planterGrid.cellPlantAriaLabel", {
                                name: getPlantDisplayName(
                                  square.plantInstance.plant,
                                  i18n.language,
                                ),
                                row: rowIndex + 1,
                                col: colIndex + 1,
                              })
                            : selectedPlant
                              ? t("planterGrid.cellPlacePlantAriaLabel", {
                                  name: getPlantDisplayName(
                                    selectedPlant,
                                    i18n.language,
                                  ),
                                  row: rowIndex + 1,
                                  col: colIndex + 1,
                                })
                              : t("planterGrid.cellEmptyAriaLabel", {
                                  row: rowIndex + 1,
                                  col: colIndex + 1,
                                })
                        }
                        className={cn(
                          "w-12 h-12 rounded-lg relative transition-[transform,background-color,box-shadow,outline] duration-150 cursor-pointer shadow-sm flex flex-col items-center justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2",
                          square.plantInstance
                            ? "bg-white/90"
                            : "bg-white/40 hover:bg-white/80",
                          // Drag source: dim the cell being dragged
                          isDragSourceCell &&
                            activeDragSource?.row === rowIndex &&
                            activeDragSource?.col === colIndex &&
                            "opacity-40 scale-95",
                          // Drop target highlight (sky-blue ring)
                          activeDragSource &&
                            dragOverCell?.row === rowIndex &&
                            dragOverCell?.col === colIndex &&
                            "ring-2 ring-sky-400/70 ring-offset-1 scale-105",
                          // Grab cursor on draggable cells
                          !viewOnly &&
                            !!square.plantInstance &&
                            !activeDragSource &&
                            "cursor-grab",
                          // Group hover zoom (applied to all cells in the hovered group)
                          !activeDragSource &&
                            hoveredCells.has(`${rowIndex},${colIndex}`) &&
                            "scale-105",
                          // Group highlight (green ring)
                          highlightedCells.has(`${rowIndex},${colIndex}`) &&
                            !singleCellMode &&
                            "ring-2 ring-primary/60 ring-offset-1 scale-105",
                          // Single-cell highlight (amber ring)
                          highlightedCells.has(`${rowIndex},${colIndex}`) &&
                            singleCellMode &&
                            "ring-2 ring-amber-400/80 ring-offset-1",
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
                          <div className={cn(
                            "flex flex-col items-center justify-center h-full relative animate-plant-place",
                            square.plantInstance.healthState === "dead" && "grayscale opacity-50",
                          )}>
                            <span className="text-xl drop-shadow-sm select-none">
                              {square.plantInstance.plant.icon}
                            </span>
                            <span className="text-[7px] font-black uppercase text-muted-foreground/60 truncate w-full px-1 text-center mt-0.5">
                              {abbreviatePlantName(
                                square.plantInstance.variety ||
                                  getPlantDisplayName(
                                    square.plantInstance.plant,
                                    i18n.language,
                                  ),
                              )}
                            </span>
                            {square.plantInstance.healthState &&
                              square.plantInstance.healthState !== "healthy" && (
                                <span
                                  className={cn(
                                    "absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white/80",
                                    square.plantInstance.healthState === "stressed" && "bg-yellow-400",
                                    square.plantInstance.healthState === "damaged" && "bg-orange-500",
                                    square.plantInstance.healthState === "diseased" && "bg-red-500",
                                    square.plantInstance.healthState === "dead" && "bg-gray-400",
                                  )}
                                  title={t("planterGrid.healthTitle", {
                                    state: t(
                                      `dialogs.plantDetailsDialog.healthStates.${square.plantInstance.healthState}`,
                                    ),
                                  })}
                                />
                              )}
                            {/* Group membership indicator: shown before any click */}
                            {(groupSizeMap.get(`${rowIndex},${colIndex}`) ?? 1) > 1 && (
                              <span
                                className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-primary/40"
                                title={t("planterGrid.metaplantGroupTitle")}
                              />
                            )}
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
                                  {t("planterGrid.noStock")}
                                </div>
                              )}
                            </>
                          )
                        )}
                      </button>
                      {!viewOnly && square.plantInstance && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openMovePicker(rowIndex, colIndex, square.plantInstance!);
                          }}
                          className="absolute -top-1 -left-1 bg-white border border-primary/20 text-primary rounded-full p-1 shadow-lg opacity-0 group-hover/square:opacity-100 group-focus-within/square:opacity-100 hover:bg-primary/5 transition-[opacity,background-color,transform] duration-150 hover:scale-110 active:scale-95 z-10 hidden sm:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          title={t("planterGrid.movePlantTitle")}
                          aria-label={t("planterGrid.movePlantAriaLabel", {
                            name: getPlantDisplayName(
                              square.plantInstance.plant,
                              i18n.language,
                            ),
                            row: rowIndex + 1,
                            col: colIndex + 1,
                          })}
                        >
                          <Move className="w-3 h-3" />
                        </button>
                      )}
                      {!viewOnly && square.plantInstance && (
                        <button
                          onClick={(e) =>
                            handleRemovePlant(rowIndex, colIndex, e)
                          }
                          className="absolute -top-1 -right-1 bg-white border border-red-100 text-red-500 rounded-full p-1 shadow-lg opacity-0 group-hover/square:opacity-100 hover:bg-red-50 transition-[opacity,background-color,transform] duration-150 hover:scale-110 active:scale-95 z-10"
                          title={t("planterGrid.removePlantTitle")}
                          aria-label={t("planterGrid.removePlantAriaLabel", {
                            name: getPlantDisplayName(
                              square.plantInstance.plant,
                              i18n.language,
                            ),
                          })}
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
        groupSize={highlightedCells.size}
        singleCellMode={singleCellMode}
      />

      <MovePlantPicker
        open={movePickerSource !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMovePickerSource(null);
          }
        }}
        source={movePickerSource}
        areas={moveAreas}
        mobile={isMobile}
        onConfirmMove={onMovePlant}
      />
    </>
  );
}
