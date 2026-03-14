import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Area } from "../data/schema";
import type { PlantInstance } from "./PlanterGrid";
import type { PlantMoveLocation } from "../services/plantMovement";
import { getPlantDisplayName } from "../i18n/utils/plantTranslation";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

interface MovePlantPickerSource {
  location: PlantMoveLocation;
  plantInstance: PlantInstance;
}

interface MovePlantPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: MovePlantPickerSource | null;
  areas: Area[];
  mobile: boolean;
  onConfirmMove: (source: PlantMoveLocation, target: PlantMoveLocation) => void;
}

interface PlanterOption {
  key: string;
  areaId: string;
  areaName: string;
  planterId: string;
  planterName: string;
  rows: number;
  cols: number;
  squares: Area["planters"][number]["squares"];
}

function buildPlanterKey(areaId: string, planterId: string): string {
  return `${areaId}:${planterId}`;
}

export function MovePlantPicker({
  open,
  onOpenChange,
  source,
  areas,
  mobile,
  onConfirmMove,
}: MovePlantPickerProps) {
  const { t, i18n } = useTranslation();

  const planterOptions = useMemo<PlanterOption[]>(
    () =>
      areas.flatMap((area) =>
        area.planters.map((planter) => ({
          key: buildPlanterKey(area.id, planter.id),
          areaId: area.id,
          areaName: area.name,
          planterId: planter.id,
          planterName: planter.name,
          rows: planter.rows,
          cols: planter.cols,
          squares: planter.squares,
        })),
      ),
    [areas],
  );

  const [selectedPlanterKey, setSelectedPlanterKey] = useState("");
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);

  useEffect(() => {
    if (!open || !source) return;

    setSelectedPlanterKey(
      buildPlanterKey(source.location.areaId, source.location.planterId),
    );
    setSelectedRow(source.location.row);
    setSelectedCol(source.location.col);
  }, [open, source]);

  const selectedPlanter =
    planterOptions.find((option) => option.key === selectedPlanterKey) ?? null;

  useEffect(() => {
    if (!selectedPlanter) return;
    if (selectedRow >= selectedPlanter.rows) {
      setSelectedRow(0);
    }
    if (selectedCol >= selectedPlanter.cols) {
      setSelectedCol(0);
    }
  }, [selectedCol, selectedPlanter, selectedRow]);

  if (!source) {
    return null;
  }

  const targetLocation: PlantMoveLocation | null = selectedPlanter
    ? {
        areaId: selectedPlanter.areaId,
        planterId: selectedPlanter.planterId,
        row: selectedRow,
        col: selectedCol,
      }
    : null;

  const selectedTargetPlant = targetLocation
    ? selectedPlanter?.squares?.[targetLocation.row]?.[targetLocation.col]
        ?.plantInstance ?? null
    : null;

  const isSameCell =
    !!targetLocation &&
    source.location.areaId === targetLocation.areaId &&
    source.location.planterId === targetLocation.planterId &&
    source.location.row === targetLocation.row &&
    source.location.col === targetLocation.col;

  const sourcePlantName = getPlantDisplayName(
    source.plantInstance.plant,
    i18n.language,
  );
  const targetPlantName = selectedTargetPlant
    ? getPlantDisplayName(selectedTargetPlant.plant, i18n.language)
    : null;

  const handleConfirm = () => {
    if (!targetLocation || isSameCell) return;
    onConfirmMove(source.location, targetLocation);
    onOpenChange(false);
  };

  const content = (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
          {t("dialogs.movePlantPicker.currentPlant")}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-2xl">{source.plantInstance.plant.icon}</span>
          <div>
            <div className="font-semibold text-foreground">{sourcePlantName}</div>
            <div className="text-xs text-muted-foreground">
              {t("dialogs.movePlantPicker.currentLocation", {
                row: source.location.row + 1,
                col: source.location.col + 1,
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          <span>{t("dialogs.movePlantPicker.destinationPlanter")}</span>
          <select
            value={selectedPlanterKey}
            onChange={(e) => setSelectedPlanterKey(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {planterOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.areaName} · {option.planterName}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            <span>{t("dialogs.movePlantPicker.row")}</span>
            <select
              value={selectedRow}
              onChange={(e) => setSelectedRow(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={!selectedPlanter}
            >
              {selectedPlanter
                ? Array.from({ length: selectedPlanter.rows }, (_, index) => (
                    <option key={index} value={index}>
                      {t("dialogs.movePlantPicker.rowOption", {
                        count: index + 1,
                      })}
                    </option>
                  ))
                : null}
            </select>
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            <span>{t("dialogs.movePlantPicker.column")}</span>
            <select
              value={selectedCol}
              onChange={(e) => setSelectedCol(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={!selectedPlanter}
            >
              {selectedPlanter
                ? Array.from({ length: selectedPlanter.cols }, (_, index) => (
                    <option key={index} value={index}>
                      {t("dialogs.movePlantPicker.columnOption", {
                        count: index + 1,
                      })}
                    </option>
                  ))
                : null}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-3 text-sm">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
          {t("dialogs.movePlantPicker.result")}
        </div>
        {isSameCell ? (
          <div className="mt-2 text-sm text-muted-foreground">
            {t("dialogs.movePlantPicker.chooseDifferentSquare")}
          </div>
        ) : selectedTargetPlant ? (
          <div className="mt-2 space-y-1">
            <div className="font-medium text-foreground">
              {t("dialogs.movePlantPicker.swapPlants")}
            </div>
            <div className="text-sm text-muted-foreground">
              {t("dialogs.movePlantPicker.swapDescription", {
                source: sourcePlantName,
                target: targetPlantName,
              })}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            {t("dialogs.movePlantPicker.emptySquare", {
              name: sourcePlantName,
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleConfirm} disabled={!targetLocation || isSameCell}>
          {selectedTargetPlant
            ? t("dialogs.movePlantPicker.swapPlants")
            : t("dialogs.movePlantPicker.movePlant")}
        </Button>
      </div>
    </div>
  );

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>{t("dialogs.movePlantPicker.title")}</SheetTitle>
            <SheetDescription>
              {t("dialogs.movePlantPicker.description", {
                name: sourcePlantName,
              })}
            </SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialogs.movePlantPicker.title")}</DialogTitle>
          <DialogDescription>
            {t("dialogs.movePlantPicker.description", {
              name: sourcePlantName,
            })}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}