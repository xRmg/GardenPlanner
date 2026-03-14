import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Calendar,
  Droplets,
  Sun,
  Ruler,
  Clock,
  Bug,
  Sparkles,
  Plus,
  Trash2,
  Leaf,
  Heart,
} from "lucide-react";
import { PlantInstance } from "./PlanterGrid";
import { cn } from "./ui/utils";
import { getBundledPlantByMatch } from "../data/bundledPlants";
import { deriveGrowthStage } from "../services/plantGrowthStage";
import type { GrowthStage, HealthState } from "../data/schema";
import {
  getLocalizedPlantContent,
  getPlantDisplayName,
} from "../i18n/utils/plantTranslation";

interface PlantDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantInstance: PlantInstance | null;
  onUpdate: (updated: PlantInstance) => void;
  groupSize?: number;
  singleCellMode?: boolean;
}

interface PestEvent {
  id: string;
  date: string;
  type: "pest" | "treatment";
  description: string;
}

function formatDate(dateString: string, locale: string) {
  return new Date(dateString).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getGrowthStageLabel(
  t: ReturnType<typeof useTranslation>["t"],
  stage: GrowthStage,
): string {
  switch (stage) {
    case "sprouting":
      return t("dialogs.plantDetailsDialog.growthStages.sprouting");
    case "vegetative":
      return t("dialogs.plantDetailsDialog.growthStages.vegetative");
    case "flowering":
      return t("dialogs.plantDetailsDialog.growthStages.flowering");
    case "fruiting":
      return t("dialogs.plantDetailsDialog.growthStages.fruiting");
    case "dormant":
      return t("dialogs.plantDetailsDialog.growthStages.dormant");
  }
}

function getHealthStateLabel(
  t: ReturnType<typeof useTranslation>["t"],
  state: HealthState,
): string {
  switch (state) {
    case "healthy":
      return t("dialogs.plantDetailsDialog.healthStates.healthy");
    case "stressed":
      return t("dialogs.plantDetailsDialog.healthStates.stressed");
    case "damaged":
      return t("dialogs.plantDetailsDialog.healthStates.damaged");
    case "diseased":
      return t("dialogs.plantDetailsDialog.healthStates.diseased");
    case "dead":
      return t("dialogs.plantDetailsDialog.healthStates.dead");
  }
}

export function PlantDetailsDialog({
  open,
  onOpenChange,
  plantInstance,
  onUpdate,
  groupSize,
  singleCellMode,
}: PlantDetailsDialogProps) {
  const { t, i18n } = useTranslation();
  const displayPlantName = plantInstance
    ? getPlantDisplayName(plantInstance.plant, i18n.language)
    : "";

  const [variety, setVariety] = useState(plantInstance?.variety || "");
  const [pestEvents, setPestEvents] = useState<PestEvent[]>(
    plantInstance?.pestEvents || [],
  );
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventType, setNewEventType] = useState<"pest" | "treatment">(
    "pest",
  );
  const [growthStageOverride, setGrowthStageOverride] = useState(
    plantInstance?.growthStageOverride ?? false,
  );
  const [manualGrowthStage, setManualGrowthStage] = useState<GrowthStage | null>(
    plantInstance?.growthStage ?? null,
  );
  const [healthState, setHealthState] = useState<HealthState | null>(
    plantInstance?.healthState ?? null,
  );

  const fallbackPlant = useMemo(
    () => (plantInstance ? getBundledPlantByMatch(plantInstance.plant) : undefined),
    [plantInstance],
  );
  const mergedPlant = useMemo(
    () =>
      plantInstance
        ? { ...fallbackPlant, ...plantInstance.plant }
        : null,
    [fallbackPlant, plantInstance],
  );
  const descriptionText = mergedPlant
    ? getLocalizedPlantContent(mergedPlant, "description", i18n.language)
    : undefined;
  const wateringText = mergedPlant
    ? getLocalizedPlantContent(mergedPlant, "watering", i18n.language)
    : undefined;
  const growingTipsText = mergedPlant
    ? getLocalizedPlantContent(mergedPlant, "growingTips", i18n.language)
    : undefined;
  const sortedPestEvents = useMemo(
    () =>
      [...pestEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [pestEvents],
  );

  const autoGrowthStage = useMemo(
    () =>
      plantInstance
        ? deriveGrowthStage({
            plantingDate: plantInstance.plantingDate,
            plant: {
              daysToHarvest: plantInstance.plant.daysToHarvest,
              daysToFlower: plantInstance.plant.daysToFlower,
              daysToFruit: plantInstance.plant.daysToFruit,
            },
          })
        : null,
    // instanceId covers the whole plant definition changing; plantingDate is
    // the only runtime-mutable field that affects derivation. Plant timeline
    // fields (daysToHarvest/Flower/Fruit) are static once a PlantInstance is
    // created, so omitting them avoids spurious recomputes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantInstance?.instanceId, plantInstance?.plantingDate],
  );

  const displayedGrowthStage = growthStageOverride
    ? manualGrowthStage
    : autoGrowthStage;

  const handleSave = () => {
    if (!plantInstance) return;

    onUpdate({
      ...plantInstance,
      variety: variety || undefined,
      pestEvents,
      growthStage: growthStageOverride ? manualGrowthStage : null,
      growthStageOverride,
      healthState,
    });
    onOpenChange(false);
  };

  const handleAddEvent = () => {
    const description = newEventDescription.trim();
    if (description) {
      const newEvent: PestEvent = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: newEventType,
        description,
      };
      setPestEvents([newEvent, ...pestEvents]);
      setNewEventDescription("");
    }
  };

  const handleDeleteEvent = (id: string) => {
    setPestEvents(pestEvents.filter((e) => e.id !== id));
  };

  useEffect(() => {
    if (open && plantInstance) {
      setVariety(plantInstance.variety || "");
      setPestEvents(plantInstance.pestEvents || []);
      setNewEventDescription("");
      setNewEventType("pest");
      setGrowthStageOverride(plantInstance.growthStageOverride ?? false);
      setManualGrowthStage(plantInstance.growthStage ?? null);
      setHealthState(plantInstance.healthState ?? null);
    }
  }, [open, plantInstance]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, variety, pestEvents, growthStageOverride, manualGrowthStage, healthState]);

  if (!plantInstance || !mergedPlant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: plantInstance.plant.color }}
            >
              {plantInstance.plant.icon}
            </span>
            <div>
              <div>{displayPlantName}</div>
              {mergedPlant.latinName && (
                <div className="text-sm text-muted-foreground font-normal italic mt-1">
                  {mergedPlant.latinName}
                </div>
              )}
              {variety && (
                <div className="text-sm text-muted-foreground font-normal mt-1">
                  {t("dialogs.plantDetailsDialog.varietyLabel")}: {variety}
                </div>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            {t("dialogs.plantDetailsDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metaplant group banner */}
          {groupSize && groupSize > 1 && (
            <div className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 border text-sm font-medium",
              singleCellMode
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-primary/5 border-primary/20 text-primary",
            )}>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: singleCellMode ? "#f59e0b" : "var(--primary)" }}
              />
              {singleCellMode
                ? t("dialogs.plantDetailsDialog.singlePlantMode")
                : t("dialogs.plantDetailsDialog.partOfGroup", {
                    count: groupSize,
                    name: displayPlantName,
                  })}
            </div>
          )}

          {/* Plant Description */}
          {descriptionText && (
            <div className="bg-accent/30 rounded-xl p-4 border border-accent">
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-2">{t("dialogs.plantDetailsDialog.descriptionSection")}</h3>
              <p className="text-sm text-foreground/80">{descriptionText}</p>
            </div>
          )}

          {/* Specific Plant Instance Info */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-3">{t("dialogs.plantDetailsDialog.yourPlantDetails")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">{t("dialogs.plantDetailsDialog.planted")}</div>
                  <div className="text-sm font-medium">
                    {plantInstance.plantingDate
                      ? formatDate(plantInstance.plantingDate, i18n.language)
                      : t("dialogs.plantDetailsDialog.notRecorded")}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 mt-0.5 text-green-600" />
                <div>
                  <div className="text-xs text-muted-foreground">{t("dialogs.plantDetailsDialog.expectedHarvest")}</div>
                  <div className="text-sm font-medium">
                    {plantInstance.harvestDate
                      ? formatDate(plantInstance.harvestDate, i18n.language)
                      : t("dialogs.plantDetailsDialog.notSet")}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="variety-input" className="text-xs font-bold text-muted-foreground block mb-1">
                {t("dialogs.plantDetailsDialog.varietyOptional")}
              </label>
              <input
                id="variety-input"
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder={t("dialogs.plantDetailsDialog.varietyPlaceholder")}
                className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
            </div>

            {/* Growth Stage */}
            <div className="mt-4">
              <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Leaf className="w-3.5 h-3.5" />
                {t("dialogs.plantDetailsDialog.growthStageLabel")}
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={growthStageOverride ? (manualGrowthStage ?? "") : "auto"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "auto") {
                      setGrowthStageOverride(false);
                      setManualGrowthStage(null);
                    } else {
                      setGrowthStageOverride(true);
                      setManualGrowthStage(val as GrowthStage);
                    }
                  }}
                  className="flex-1 bg-white/50 border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                >
                  <option value="auto">
                    {autoGrowthStage
                      ? t("dialogs.plantDetailsDialog.growthStageAutoCurrent", {
                          value: getGrowthStageLabel(t, autoGrowthStage),
                        })
                      : t("dialogs.plantDetailsDialog.growthStageAutoUnknown")}
                  </option>
                  <option value="sprouting">🌱 {getGrowthStageLabel(t, "sprouting")}</option>
                  <option value="vegetative">🌿 {getGrowthStageLabel(t, "vegetative")}</option>
                  <option value="flowering">🌸 {getGrowthStageLabel(t, "flowering")}</option>
                  <option value="fruiting">🍅 {getGrowthStageLabel(t, "fruiting")}</option>
                  <option value="dormant">💤 {getGrowthStageLabel(t, "dormant")}</option>
                </select>
                {displayedGrowthStage && (
                  <span className="text-xs text-muted-foreground font-medium px-2 py-1 bg-muted/30 rounded-lg whitespace-nowrap">
                    {t("dialogs.plantDetailsDialog.growthStageCurrent", {
                      value: getGrowthStageLabel(t, displayedGrowthStage),
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* Health State */}
            <div className="mt-4">
              <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Heart className="w-3.5 h-3.5" />
                {t("dialogs.plantDetailsDialog.healthStateLabel")}
              </label>
              <select
                value={healthState ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setHealthState(val === "" ? null : (val as HealthState));
                }}
                className="w-full bg-white/50 border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              >
                <option value="">— {t("dialogs.plantDetailsDialog.healthStateNotSet")} —</option>
                <option value="healthy">💚 {getHealthStateLabel(t, "healthy")}</option>
                <option value="stressed">🟡 {getHealthStateLabel(t, "stressed")}</option>
                <option value="damaged">🟠 {getHealthStateLabel(t, "damaged")}</option>
                <option value="diseased">🔴 {getHealthStateLabel(t, "diseased")}</option>
                <option value="dead">⬛ {getHealthStateLabel(t, "dead")}</option>
              </select>
            </div>
          </div>

          {/* Generic Plant Care Information */}
          <div className="bg-muted/20 rounded-xl p-4 border border-white/30">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-3">{t("dialogs.plantDetailsDialog.growingInformation")}</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Sun className="w-4 h-4 mt-0.5 text-yellow-600" />
                <div>
                  <div className="text-xs text-muted-foreground">{t("dialogs.plantDetailsDialog.sunlight")}</div>
                  <div className="text-sm">
                    {mergedPlant.sunRequirement === "full"
                      ? t("dialogs.plantDetailsDialog.sunFull")
                      : mergedPlant.sunRequirement === "partial"
                        ? t("dialogs.plantDetailsDialog.sunPartial")
                        : mergedPlant.sunRequirement === "shade"
                          ? t("dialogs.plantDetailsDialog.sunShade")
                          : t("dialogs.plantDetailsDialog.notRecorded")}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Droplets className="w-4 h-4 mt-0.5 text-blue-600" />
                <div>
                  <div className="text-xs text-muted-foreground">{t("dialogs.plantDetailsDialog.watering")}</div>
                  <div className="text-sm">
                    {wateringText || t("dialogs.plantDetailsDialog.notRecorded")}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Ruler className="w-4 h-4 mt-0.5 text-gray-600" />
                <div>
                  <div className="text-xs text-muted-foreground">{t("dialogs.plantDetailsDialog.spacing")}</div>
                  <div className="text-sm">
                    {mergedPlant.spacingCm
                      ? t("dialogs.plantDetailsDialog.spacingValue", { count: mergedPlant.spacingCm })
                      : t("dialogs.plantDetailsDialog.notRecorded")}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 mt-0.5 text-green-600" />
                <div>
                  <div className="text-xs text-muted-foreground">{t("dialogs.plantDetailsDialog.daysToHarvest")}</div>
                  <div className="text-sm">
                    {mergedPlant.daysToHarvest
                      ? t("dialogs.plantDetailsDialog.daysToHarvestValue", { count: mergedPlant.daysToHarvest })
                      : t("dialogs.plantDetailsDialog.notRecorded")}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
              <div className="text-xs font-bold text-muted-foreground mb-1">{t("dialogs.plantDetailsDialog.growingTips")}</div>
              <div className="text-sm">
                {growingTipsText || t("dialogs.plantDetailsDialog.noTips")}
              </div>
            </div>
          </div>

          {/* Pest & Treatment Log */}
          <div className="bg-muted/20 rounded-xl p-4 border border-white/30">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-3 flex items-center gap-2">
              <Bug className="w-4 h-4" />
              {t("dialogs.plantDetailsDialog.pestLog")}
            </h3>

            {/* Add new event */}
            <div className="mb-4 p-3 bg-muted/30 rounded-xl">
              <div className="flex gap-2 mb-2">
                <select
                  value={newEventType}
                  onChange={(e) =>
                    setNewEventType(e.target.value as "pest" | "treatment")
                  }
                  className="bg-white/50 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                >
                  <option value="pest">{t("dialogs.plantDetailsDialog.pestSpotted")}</option>
                  <option value="treatment">{t("dialogs.plantDetailsDialog.treatmentApplied")}</option>
                </select>
                <input
                  type="text"
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  placeholder={t("dialogs.plantDetailsDialog.eventPlaceholder")}
                  className="flex-1 bg-white/50 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddEvent();
                  }}
                />
                <button
                  onClick={handleAddEvent}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  aria-label={t("dialogs.plantDetailsDialog.addEvent")}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Event list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sortedPestEvents.length === 0 ? (
                <div className="text-center text-muted-foreground/40 py-4 text-sm">
                  {t("dialogs.plantDetailsDialog.noEvents")}
                </div>
              ) : (
                sortedPestEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 p-2 bg-white/60 border border-border/20 rounded-lg hover:bg-white/90 transition-colors"
                  >
                    {event.type === "pest" ? (
                      <Bug className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{event.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(event.date, i18n.language)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1 hover:bg-red-50 rounded transition-colors shrink-0"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-end pt-2 border-t border-border/20">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border border-border rounded-lg hover:bg-muted/40 transition-colors text-sm font-bold"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-bold shadow-md shadow-primary/20"
            >
              {t("dialogs.plantDetailsDialog.saveChanges")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
