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
} from "lucide-react";
import { PlantInstance } from "./PlanterGrid";
import { getBundledPlantByMatch } from "../data/bundledPlants";

interface PlantDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantInstance: PlantInstance | null;
  onUpdate: (updated: PlantInstance) => void;
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

  const handleSave = () => {
    onUpdate({
      ...plantInstance,
      variety: variety || undefined,
      pestEvents,
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
  }, [open, variety, pestEvents]);

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
                <div className="text-sm text-gray-500 font-normal italic mt-1">
                  {mergedPlant.latinName}
                </div>
              )}
              {variety && (
                <div className="text-sm text-gray-600 font-normal mt-1">
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
          {/* Plant Description */}
          {mergedPlant.description && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              <p className="text-sm text-gray-700">{mergedPlant.description}</p>
            </div>
          )}

          {/* Specific Plant Instance Info */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-sm font-semibold mb-3">Your Plant Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Planted</div>
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
                  <div className="text-xs text-gray-600">Expected Harvest</div>
                  <div className="text-sm font-medium">
                    {plantInstance.harvestDate
                      ? formatDate(plantInstance.harvestDate)
                      : "Not set"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs text-gray-600 block mb-1">
                Variety (optional)
              </label>
              <input
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder="e.g., Cherry, Beefsteak, Roma..."
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Generic Plant Care Information */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm mb-3">Growing Information</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Sun className="w-4 h-4 mt-0.5 text-yellow-600" />
                <div>
                  <div className="text-xs text-gray-600">Sunlight</div>
                  <div className="text-sm">
                    {formatSunlight(mergedPlant.sunRequirement)}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Droplets className="w-4 h-4 mt-0.5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Watering</div>
                  <div className="text-sm">
                    {mergedPlant.watering || "Not recorded"}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Ruler className="w-4 h-4 mt-0.5 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-600">Spacing</div>
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
                  <div className="text-xs text-gray-600">Days to Harvest</div>
                  <div className="text-sm">
                    {mergedPlant.daysToHarvest
                      ? `${mergedPlant.daysToHarvest} days`
                      : "Not recorded"}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 p-3 bg-green-50 rounded border border-green-100">
              <div className="text-xs text-gray-600 mb-1">💡 Growing Tips</div>
              <div className="text-sm">
                {mergedPlant.growingTips || "No specific tips recorded yet."}
              </div>
            </div>
          </div>

          {/* Pest & Treatment Log */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm mb-3 flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Pest &amp; Treatment Log
            </h3>

            {/* Add new event */}
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="flex gap-2 mb-2">
                <select
                  value={newEventType}
                  onChange={(e) =>
                    setNewEventType(e.target.value as "pest" | "treatment")
                  }
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pest">🐛 Pest Spotted</option>
                  <option value="treatment">💊 Treatment Applied</option>
                </select>
                <input
                  type="text"
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  placeholder="Describe what happened..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddEvent();
                  }}
                />
                <button
                  onClick={handleAddEvent}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Event list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sortedPestEvents.length === 0 ? (
                <div className="text-center text-gray-400 py-4 text-sm">
                  No pest or treatment events logged yet
                </div>
              ) : (
                sortedPestEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 p-2 bg-white border rounded hover:bg-gray-50"
                  >
                    {event.type === "pest" ? (
                      <Bug className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{event.description}</div>
                      <div className="text-xs text-gray-500">
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
          <div className="flex gap-2 justify-end pt-2 border-t">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
