import { useState } from "react";
import { GardenGrid, Plant, PlantInstance } from "./components/GardenGrid";
import { EventsBar, GardenEvent, Suggestion } from "./components/EventsBar";
import { ToolBar } from "./components/ToolBar";
import {
  GardenBedDialog,
  GardenBedConfig,
  VirtualBed,
} from "./components/GardenBedDialog";

// Available plants for the garden
const AVAILABLE_PLANTS: Plant[] = [
  { id: "1", name: "Tomato", color: "#ef4444", icon: "🍅" },
  { id: "2", name: "Carrot", color: "#f97316", icon: "🥕" },
  { id: "3", name: "Lettuce", color: "#84cc16", icon: "🥬" },
  { id: "4", name: "Pepper", color: "#eab308", icon: "🌶️" },
  { id: "5", name: "Broccoli", color: "#22c55e", icon: "🥦" },
  { id: "6", name: "Cucumber", color: "#10b981", icon: "🥒" },
  { id: "7", name: "Corn", color: "#fbbf24", icon: "🌽" },
  { id: "8", name: "Pumpkin", color: "#fb923c", icon: "🎃" },
  { id: "9", name: "Eggplant", color: "#a855f7", icon: "🍆" },
  { id: "10", name: "Radish", color: "#ec4899", icon: "🌱" },
];

interface Garden {
  id: string;
  name: string;
  rows: number;
  cols: number;
  virtualBeds?: VirtualBed[];
}

export default function App() {
  const [gardens, setGardens] = useState<Garden[]>([
    { id: "1", name: "Garden Bed 1", rows: 4, cols: 4 },
    { id: "2", name: "Garden Bed 2", rows: 4, cols: 4 },
  ]);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [events, setEvents] = useState<GardenEvent[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    {
      id: "sug-1",
      type: "water",
      priority: "high",
      description: "Hot weather expected - give plants extra water",
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "sug-2",
      type: "weed",
      priority: "medium",
      description: "Regular weeding helps your vegetables grow better",
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "sug-3",
      type: "compost",
      priority: "low",
      description: "Add compost to enrich soil nutrients",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);
  const [bedDialogOpen, setBedDialogOpen] = useState(false);
  const [editingGarden, setEditingGarden] = useState<Garden | null>(null);

  const handleAddGarden = () => {
    setEditingGarden(null);
    setBedDialogOpen(true);
  };

  const handleEditGarden = (garden: Garden) => {
    setEditingGarden(garden);
    setBedDialogOpen(true);
  };

  const handleSaveGarden = (config: GardenBedConfig) => {
    if (config.id) {
      // Update existing garden
      setGardens(
        gardens.map((g) =>
          g.id === config.id
            ? {
                ...g,
                name: config.name,
                rows: config.rows,
                cols: config.cols,
                virtualBeds: config.virtualBeds,
              }
            : g,
        ),
      );
    } else {
      // Add new garden
      const newId = String(Date.now());
      setGardens([
        ...gardens,
        {
          id: newId,
          name: config.name,
          rows: config.rows,
          cols: config.cols,
          virtualBeds: config.virtualBeds,
        },
      ]);
    }
  };

  const handleRemoveGarden = () => {
    if (gardens.length > 0) {
      const removedGarden = gardens[gardens.length - 1];
      // Remove events associated with this garden
      setEvents(events.filter((e) => e.gardenId !== removedGarden.id));
      setGardens(gardens.slice(0, -1));
    }
  };

  const handlePlantAdded = (plantInstance: PlantInstance, _gardenId: string) => {
    // Log planting event
    const eventLog: GardenEvent = {
        id: `planted-${Date.now()}-${Math.random()}`,
        type: "planted",
        plant: plantInstance.plant,
        date: new Date().toISOString(),
        gardenId: _gardenId,
    };
    setEvents((prev) => [
      eventLog,
      ...prev,
    ]);

    // Add harvest suggestion
    if (plantInstance.harvestDate) {
      setSuggestions((prev) => [
        ...prev,
        {
          id: `harvest-sug-${plantInstance.instanceId}`,
          type: "harvest",
          plant: plantInstance.plant,
          priority: "medium",
          description: `Time to harvest ${plantInstance.plant.name}`,
          dueDate: plantInstance.harvestDate,
        },
      ]);
    }
  };

  const handlePlantRemoved = (
    plantInstance: PlantInstance,
    _gardenId: string,
  ) => {
    // Remove harvest suggestions for this specific plant instance
    setSuggestions((prev) =>
      prev.filter((s) => s.id !== `harvest-sug-${plantInstance.instanceId}`),
    );
  };

  const handlePlantUpdated = (
    plantInstance: PlantInstance,
    _gardenId: string,
  ) => {
    // Update harvest suggestion if harvest date changed
    if (plantInstance.harvestDate) {
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === `harvest-sug-${plantInstance.instanceId}`
            ? {
                ...s,
                plant: plantInstance.plant,
                dueDate: plantInstance.harvestDate,
                description: `Time to harvest ${plantInstance.variety || plantInstance.plant.name}`,
              }
            : s,
        ),
      );
    }
  };

  const handleCompleteSuggestion = (suggestion: Suggestion) => {
    // Remove the suggestion
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

    // Log the event
    const eventType =
      suggestion.type === "water"
        ? "watered"
        : suggestion.type === "harvest"
          ? "harvested"
          : suggestion.type === "compost"
            ? "composted"
            : suggestion.type === "weed"
              ? "weeded"
              : "composted"; // repot -> composted as fallback

    setEvents((prev) => [
      {
        id: `event-${Date.now()}-${Math.random()}`,
        type: eventType as GardenEvent["type"],
        plant: suggestion.plant,
        date: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  return (
    <div className="size-full flex flex-col bg-background relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6 relative z-10">
        {/* Garden area */}
        <div className="flex-1 overflow-auto bg-white/40 backdrop-blur-sm rounded-[2.5rem] border border-white/60 shadow-xl p-8 custom-scrollbar">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Garden Planner
            </h1>
            <p className="text-muted-foreground mt-3 text-lg max-w-2xl leading-relaxed">
              Design your bountiful garden with ease. Create custom beds, plan
              your companion planting, and watch your harvest grow.
            </p>
          </div>

          <div className="flex flex-wrap gap-8">
            {gardens.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-gray-400 w-full mt-24 py-12 border-2 border-dashed border-gray-200 rounded-3xl bg-white/20">
                <div className="bg-primary/10 p-6 rounded-full mb-4">
                  <div className="text-4xl">🌱</div>
                </div>
                <p className="text-2xl font-medium text-gray-500">
                  Your garden is waiting...
                </p>
                <p className="mt-2 text-gray-400 max-w-sm">
                  Tap "New Bed" in the toolbar below to start plotting your
                  first vegetables.
                </p>
              </div>
            ) : (
              gardens.map((garden) => (
                <div
                  key={garden.id}
                  className="transition-transform hover:scale-[1.01] duration-300"
                >
                  <GardenGrid
                    id={garden.id}
                    name={garden.name}
                    rows={garden.rows}
                    cols={garden.cols}
                    selectedPlant={selectedPlant}
                    virtualBeds={garden.virtualBeds}
                    onPlantAdded={handlePlantAdded}
                    onPlantRemoved={handlePlantRemoved}
                    onPlantUpdated={handlePlantUpdated}
                    onEdit={() => handleEditGarden(garden)}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Events sidebar - Floating style */}
        <div className="w-80 h-full flex flex-col drop-shadow-2xl">
          <EventsBar
            events={events}
            suggestions={suggestions}
            onCompleteSuggestion={handleCompleteSuggestion}
          />
        </div>
      </div>

      {/* Bottom toolbar - Floating style */}
      <div className="px-6 pb-6 relative z-20">
        <div className="max-w-6xl mx-auto drop-shadow-2xl">
          <ToolBar
            plants={AVAILABLE_PLANTS}
            selectedPlant={selectedPlant}
            onSelectPlant={setSelectedPlant}
            onAddGarden={handleAddGarden}
            onRemoveGarden={handleRemoveGarden}
            gardenCount={gardens.length}
          />
        </div>
      </div>

      {/* Garden Bed Configuration Dialog */}
      <GardenBedDialog
        open={bedDialogOpen}
        onOpenChange={setBedDialogOpen}
        onSave={handleSaveGarden}
        initialConfig={
          editingGarden
            ? {
                id: editingGarden.id,
                name: editingGarden.name,
                rows: editingGarden.rows,
                cols: editingGarden.cols,
                virtualBeds: editingGarden.virtualBeds,
              }
            : undefined
        }
      />
    </div>
  );
}
