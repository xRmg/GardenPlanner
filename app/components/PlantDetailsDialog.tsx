import { useState } from "react";
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

interface PlantDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantInstance: PlantInstance | null;
  onUpdate: (updated: PlantInstance) => void;
}

// Generic plant care information database
const PLANT_INFO: Record<
  string,
  {
    sunlight: string;
    water: string;
    spacing: string;
    daysToHarvest: string;
    tips: string;
  }
> = {
  Tomato: {
    sunlight: "6-8 hours of full sun daily",
    water: "Water deeply 2-3 times per week",
    spacing: "24-36 inches apart",
    daysToHarvest: "60-85 days",
    tips: "Stake or cage plants for support. Pinch off suckers for larger fruits.",
  },
  Carrot: {
    sunlight: "6-8 hours of full sun",
    water: "Keep soil consistently moist",
    spacing: "2-3 inches apart",
    daysToHarvest: "60-80 days",
    tips: "Thin seedlings early. Loose soil is essential for straight roots.",
  },
  Lettuce: {
    sunlight: "4-6 hours, tolerates partial shade",
    water: "Keep soil moist, water daily in heat",
    spacing: "8-12 inches apart",
    daysToHarvest: "30-60 days",
    tips: "Harvest outer leaves first for continuous production.",
  },
  Pepper: {
    sunlight: "6-8 hours of full sun",
    water: "Water regularly, 1-2 inches per week",
    spacing: "18-24 inches apart",
    daysToHarvest: "60-90 days",
    tips: "Support plants with stakes. Peppers like warm soil.",
  },
  Broccoli: {
    sunlight: "6-8 hours of sun",
    water: "Keep soil consistently moist",
    spacing: "18-24 inches apart",
    daysToHarvest: "55-80 days",
    tips: "Harvest main head before flowers open. Side shoots will continue.",
  },
  Cucumber: {
    sunlight: "6-8 hours of full sun",
    water: "Water deeply, keep soil moist",
    spacing: "12-24 inches apart",
    daysToHarvest: "50-70 days",
    tips: "Harvest regularly to encourage more production. Use trellis to save space.",
  },
  Corn: {
    sunlight: "Full sun, 6-8 hours",
    water: "1-2 inches per week",
    spacing: "8-12 inches apart",
    daysToHarvest: "60-100 days",
    tips: "Plant in blocks for better pollination. Harvest when kernels are plump.",
  },
  Pumpkin: {
    sunlight: "Full sun, 6-8 hours",
    water: "1-2 inches per week",
    spacing: "36-60 inches apart",
    daysToHarvest: "90-120 days",
    tips: "Needs lots of space. Harvest when skin is hard and color is deep.",
  },
  Eggplant: {
    sunlight: "Full sun, 6-8 hours",
    water: "Water regularly, keep soil moist",
    spacing: "24-30 inches apart",
    daysToHarvest: "65-80 days",
    tips: "Likes warm weather. Harvest when skin is glossy.",
  },
  Radish: {
    sunlight: "4-6 hours of sun",
    water: "Keep soil evenly moist",
    spacing: "1-2 inches apart",
    daysToHarvest: "25-30 days",
    tips: "Fast growing! Great for beginners. Harvest promptly to avoid woody texture.",
  },
};

interface PestEvent {
  id: string;
  date: string;
  type: "pest" | "treatment";
  description: string;
}

export function PlantDetailsDialog({
  open,
  onOpenChange,
  plantInstance,
  onUpdate,
}: PlantDetailsDialogProps) {
  const [variety, setVariety] = useState(plantInstance?.variety || "");
  const [pestEvents, setPestEvents] = useState<PestEvent[]>(
    plantInstance?.pestEvents || [],
  );
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventType, setNewEventType] = useState<"pest" | "treatment">(
    "pest",
  );

  if (!plantInstance) return null;

  const plantInfo = PLANT_INFO[plantInstance.plant.name] || {
    sunlight: "Not available",
    water: "Not available",
    spacing: "Not available",
    daysToHarvest: "Not available",
    tips: "No specific tips available for this plant.",
  };

  const handleSave = () => {
    onUpdate({
      ...plantInstance,
      variety: variety || undefined,
      pestEvents,
    });
    onOpenChange(false);
  };

  const handleAddEvent = () => {
    if (newEventDescription.trim()) {
      const newEvent: PestEvent = {
        id: `event-${Date.now()}`,
        date: new Date().toISOString(),
        type: newEventType,
        description: newEventDescription,
      };
      setPestEvents([newEvent, ...pestEvents]);
      setNewEventDescription("");
    }
  };

  const handleDeleteEvent = (id: string) => {
    setPestEvents(pestEvents.filter((e) => e.id !== id));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          {/* Specific Plant Instance Info */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-sm mb-3">Your Plant Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Planted</div>
                  <div className="text-sm">
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
                  <div className="text-sm">
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
                  <div className="text-sm">{plantInfo.sunlight}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Droplets className="w-4 h-4 mt-0.5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Watering</div>
                  <div className="text-sm">{plantInfo.water}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Ruler className="w-4 h-4 mt-0.5 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-600">Spacing</div>
                  <div className="text-sm">{plantInfo.spacing}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 mt-0.5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-600">Days to Harvest</div>
                  <div className="text-sm">{plantInfo.daysToHarvest}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 p-3 bg-green-50 rounded border border-green-100">
              <div className="text-xs text-gray-600 mb-1">💡 Growing Tips</div>
              <div className="text-sm">{plantInfo.tips}</div>
            </div>
          </div>

          {/* Pest & Treatment Log */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm mb-3 flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Pest & Treatment Log
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
                    if (e.key === "Enter") {
                      handleAddEvent();
                    }
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
              {pestEvents.length === 0 ? (
                <div className="text-center text-gray-400 py-4 text-sm">
                  No pest or treatment events logged yet
                </div>
              ) : (
                pestEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 p-2 bg-white border rounded hover:bg-gray-50"
                  >
                    {event.type === "pest" ? (
                      <Bug className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{event.description}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(event.date)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1 hover:bg-red-50 rounded transition-colors flex-shrink-0"
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
