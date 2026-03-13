import { useEffect, useMemo, useState } from "react";
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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSunlight(
  sunRequirement: "full" | "partial" | "shade" | undefined,
) {
  if (sunRequirement === "full") return "Full sun";
  if (sunRequirement === "partial") return "Partial sun";
  if (sunRequirement === "shade") return "Shade";
  return "Not recorded";
}

export function PlantDetailsDialog({
  open,
  onOpenChange,
  plantInstance,
  onUpdate,
  groupSize,
  singleCellMode,
}: PlantDetailsDialogProps) {
  if (!plantInstance) return null;

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
    () => getBundledPlantByMatch(plantInstance.plant),
    [plantInstance.plant],
  );
  const mergedPlant = useMemo(
    () => ({ ...fallbackPlant, ...plantInstance.plant }),
    [fallbackPlant, plantInstance.plant],
  );
  const sortedPestEvents = useMemo(
    () =>
      [...pestEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [pestEvents],
  );

  const autoGrowthStage = useMemo(
    () =>
      deriveGrowthStage({
        plantingDate: plantInstance.plantingDate,
        plant: {
          daysToHarvest: plantInstance.plant.daysToHarvest,
          daysToFlower: plantInstance.plant.daysToFlower,
          daysToFruit: plantInstance.plant.daysToFruit,
        },
      }),
    // instanceId covers the whole plant definition changing; plantingDate is
    // the only runtime-mutable field that affects derivation. Plant timeline
    // fields (daysToHarvest/Flower/Fruit) are static once a PlantInstance is
    // created, so omitting them avoids spurious recomputes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantInstance.instanceId, plantInstance.plantingDate],
  );

  const displayedGrowthStage = growthStageOverride
    ? manualGrowthStage
    : autoGrowthStage;

  const handleSave = () => {
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
    if (open) {
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
              <div>{plantInstance.plant.name}</div>
              {mergedPlant.latinName && (
                <div className="text-sm text-muted-foreground font-normal italic mt-1">
                  {mergedPlant.latinName}
                </div>
              )}
              {variety && (
                <div className="text-sm text-muted-foreground font-normal mt-1">
                  Variety: {variety}
                </div>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            View and manage details for this plant
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
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: singleCellMode ? "#f59e0b" : "var(--primary)" }}
              />
              {singleCellMode
                ? `Single-plant mode — changes apply to this plant only`
                : `Part of a group of ${groupSize} ${plantInstance.plant.name} plants — pest events will apply to all`}
            </div>
          )}
          {/* Plant Description */}
          {mergedPlant.description && (
            <div className="bg-accent/30 rounded-xl p-4 border border-accent">
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-2">
                Description
              </h3>
              <p className="text-sm text-foreground/80">
                {mergedPlant.description}
              </p>
            </div>
          )}

          {/* Specific Plant Instance Info */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-3">
              Your Plant Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Planted</div>
                  <div className="text-sm font-medium">
                    {plantInstance.plantingDate
                      ? formatDate(plantInstance.plantingDate)
                      : "Not recorded"}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 mt-0.5 text-green-600" />
                <div>
                  <div className="text-xs text-muted-foreground">
                    Expected Harvest
                  </div>
                  <div className="text-sm font-medium">
                    {plantInstance.harvestDate
                      ? formatDate(plantInstance.harvestDate)
                      : "Not set"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="variety-input"
                className="text-xs font-bold text-muted-foreground block mb-1"
              >
                Variety (optional)
              </label>
              <input
                id="variety-input"
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder="e.g., Cherry, Beefsteak, Roma..."
                className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
            </div>

            {/* Growth Stage */}
            <div className="mt-4">
              <label className="text-xs font-bold text-muted-foreground block mb-1 flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5" />
                Growth Stage
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
                    Auto{autoGrowthStage ? ` (${autoGrowthStage})` : " (unknown)"}
                  </option>
                  <option value="sprouting">🌱 Sprouting</option>
                  <option value="vegetative">🌿 Vegetative</option>
                  <option value="flowering">🌸 Flowering</option>
                  <option value="fruiting">🍅 Fruiting</option>
                  <option value="dormant">💤 Dormant</option>
                </select>
                {displayedGrowthStage && (
                  <span className="text-xs text-muted-foreground font-medium px-2 py-1 bg-muted/30 rounded-lg whitespace-nowrap">
                    Current: {displayedGrowthStage}
                  </span>
                )}
              </div>
            </div>

            {/* Health State */}
            <div className="mt-4">
              <label className="text-xs font-bold text-muted-foreground block mb-1 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                Health State
              </label>
              <select
                value={healthState ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setHealthState(val === "" ? null : (val as HealthState));
                }}
                className="w-full bg-white/50 border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              >
                <option value="">— Not set —</option>
                <option value="healthy">💚 Healthy</option>
                <option value="stressed">🟡 Stressed</option>
                <option value="damaged">🟠 Damaged</option>
                <option value="diseased">🔴 Diseased</option>
                <option value="dead">⬛ Dead</option>
              </select>
            </div>
          </div>

          {/* Generic Plant Care Information */}
          <div className="bg-muted/20 rounded-xl p-4 border border-white/30">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-3">
              Growing Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Sun className="w-4 h-4 mt-0.5 text-yellow-600" />
                <div>
                  <div className="text-xs text-muted-foreground">Sunlight</div>
                  <div className="text-sm">
                    {formatSunlight(mergedPlant.sunRequirement)}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Droplets className="w-4 h-4 mt-0.5 text-blue-600" />
                <div>
                  <div className="text-xs text-muted-foreground">Watering</div>
                  <div className="text-sm">
                    {mergedPlant.watering || "Not recorded"}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Ruler className="w-4 h-4 mt-0.5 text-gray-600" />
                <div>
                  <div className="text-xs text-muted-foreground">Spacing</div>
                  <div className="text-sm">
                    {mergedPlant.spacingCm
                      ? `${mergedPlant.spacingCm} cm minimum between plants`
                      : "Not recorded"}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 mt-0.5 text-green-600" />
                <div>
                  <div className="text-xs text-muted-foreground">
                    Days to Harvest
                  </div>
                  <div className="text-sm">
                    {mergedPlant.daysToHarvest
                      ? `${mergedPlant.daysToHarvest} days`
                      : "Not recorded"}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
              <div className="text-xs font-bold text-muted-foreground mb-1">
                💡 Growing Tips
              </div>
              <div className="text-sm">
                {mergedPlant.growingTips || "No specific tips recorded yet."}
              </div>
            </div>
          </div>

          {/* Pest & Treatment Log */}
          <div className="bg-muted/20 rounded-xl p-4 border border-white/30">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-3 flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Pest &amp; Treatment Log
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
                  <option value="pest">🐛 Pest Spotted</option>
                  <option value="treatment">💊 Treatment Applied</option>
                </select>
                <input
                  type="text"
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  placeholder="Describe what happened..."
                  className="flex-1 bg-white/50 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddEvent();
                  }}
                />
                <button
                  onClick={handleAddEvent}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  aria-label="Add event"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Event list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sortedPestEvents.length === 0 ? (
                <div className="text-center text-muted-foreground/40 py-4 text-sm">
                  No pest or treatment events logged yet
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
                        {formatDate(event.date)}
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
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-bold shadow-md shadow-primary/20"
            >
              Save Changes
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
