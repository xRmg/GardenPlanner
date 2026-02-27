import { useState, useEffect } from "react";
import { PlanterGrid, Plant, PlantInstance, PlanterSquare } from "./components/PlanterGrid";
import { EventsBar, GardenEvent, Suggestion } from "./components/EventsBar";
import { ToolBar } from "./components/ToolBar";
import {
  PlanterDialog,
  PlanterConfig,
  VirtualSection,
} from "./components/PlanterDialog";
import { PlantDialog } from "./components/PlantDefinitionDialog";
import { SowSeedsDialog } from "./components/SowSeedsDialog";
import {
  AddSeedlingDialog,
  SeedlingFormData,
} from "./components/AddSeedlingDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import {
  Map as MapIcon,
  Users,
  Thermometer,
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Edit,
  MoveUp,
  MoveDown,
  Sprout,
  Eye,
  EyeOff,
} from "lucide-react";

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function formatMonthRange(months: number[]): string {
  if (!months?.length) return "";
  const sorted = [...months].sort((a, b) => a - b);
  if (sorted.length === 1) return MONTH_ABBR[sorted[0] - 1];
  return `${MONTH_ABBR[sorted[0] - 1]}–${MONTH_ABBR[sorted[sorted.length - 1] - 1]}`;
}

const DEFAULT_PLANTS: Plant[] = [
  {
    id: "tomato",
    name: "Tomato",
    icon: "🍅",
    color: "#ef4444",
    daysToHarvest: 75,
    variety: "Cherry",
    description: "Indeterminate climber. Pinch out side shoots. Stake early.",
    spacingCm: 60,
    frostHardy: false,
    sunRequirement: "full",
    sowIndoorMonths: [2, 3, 4],
    sowDirectMonths: [],
    harvestMonths: [7, 8, 9],
    companions: ["basil", "carrot", "onion"],
    antagonists: ["fennel", "broccoli"],
  },
  {
    id: "carrot",
    name: "Carrot",
    icon: "🥕",
    color: "#f97316",
    daysToHarvest: 70,
    variety: "Nantes",
    description: "Needs deep, stone-free soil. Thin to 8cm to avoid forking.",
    spacingCm: 8,
    frostHardy: true,
    sunRequirement: "full",
    sowIndoorMonths: [],
    sowDirectMonths: [3, 4, 5, 6, 7],
    harvestMonths: [6, 7, 8, 9, 10],
    companions: ["onion", "leek", "tomato"],
    antagonists: ["fennel", "dill"],
  },
  {
    id: "lettuce",
    name: "Lettuce",
    icon: "🥬",
    color: "#22c55e",
    daysToHarvest: 45,
    variety: "Butterhead",
    description:
      "Sow successionally every 3 weeks to avoid a glut. Bolts in heat.",
    spacingCm: 25,
    frostHardy: true,
    sunRequirement: "partial",
    sowIndoorMonths: [2, 3],
    sowDirectMonths: [3, 4, 5, 6, 7, 8],
    harvestMonths: [5, 6, 7, 8, 9, 10],
    companions: ["carrot", "radish", "strawberry"],
    antagonists: [],
  },
  {
    id: "pepper",
    name: "Pepper",
    icon: "🫑",
    color: "#10b981",
    daysToHarvest: 80,
    variety: "Bell",
    description:
      "Start early indoors. Needs warmth — ideal for greenhouse or sunny porch.",
    spacingCm: 45,
    frostHardy: false,
    sunRequirement: "full",
    sowIndoorMonths: [2, 3],
    sowDirectMonths: [],
    harvestMonths: [7, 8, 9, 10],
    companions: ["tomato", "basil"],
    antagonists: ["fennel"],
  },
  {
    id: "broccoli",
    name: "Broccoli",
    icon: "🥦",
    color: "#15803d",
    daysToHarvest: 65,
    variety: "Calabrese",
    description:
      "Cut the central head early to encourage side shoots. Net against pigeons.",
    spacingCm: 45,
    frostHardy: true,
    sunRequirement: "full",
    sowIndoorMonths: [3, 4, 5],
    sowDirectMonths: [4, 5, 6],
    harvestMonths: [7, 8, 9, 10, 11],
    companions: ["onion", "celery"],
    antagonists: ["tomato", "strawberry"],
  },
  {
    id: "cucumber",
    name: "Cucumber",
    icon: "🥒",
    color: "#4ade80",
    daysToHarvest: 55,
    variety: "Slicing",
    description:
      "Train up a trellis. Keep well watered. Pick regularly to keep producing.",
    spacingCm: 45,
    frostHardy: false,
    sunRequirement: "full",
    sowIndoorMonths: [4],
    sowDirectMonths: [5, 6],
    harvestMonths: [7, 8, 9],
    companions: ["bean", "pea", "lettuce"],
    antagonists: ["sage", "fennel"],
  },
  {
    id: "courgette",
    name: "Courgette",
    icon: "🌿",
    color: "#65a30d",
    daysToHarvest: 55,
    variety: "Defender",
    description:
      "Harvest at 15–20cm to keep the plant cropping. One plant feeds a family.",
    spacingCm: 90,
    frostHardy: false,
    sunRequirement: "full",
    sowIndoorMonths: [4],
    sowDirectMonths: [5],
    harvestMonths: [7, 8, 9],
    companions: ["bean", "tomato", "nasturtium"],
    antagonists: [],
  },
  {
    id: "onion",
    name: "Onion",
    icon: "🧅",
    color: "#d97706",
    daysToHarvest: 120,
    variety: "Sturon",
    description:
      "Grow from sets for ease. Harvest when foliage falls over and dry well.",
    spacingCm: 10,
    frostHardy: true,
    sunRequirement: "full",
    sowIndoorMonths: [2, 3],
    sowDirectMonths: [3, 4],
    harvestMonths: [7, 8, 9],
    companions: ["carrot", "tomato", "lettuce"],
    antagonists: ["pea", "bean"],
  },
  {
    id: "pea",
    name: "Pea",
    icon: "🫛",
    color: "#84cc16",
    daysToHarvest: 70,
    variety: "Kelvedon Wonder",
    description:
      "Sow straight into the ground. Provide twiggy sticks or netting for support.",
    spacingCm: 8,
    frostHardy: true,
    sunRequirement: "full",
    sowIndoorMonths: [],
    sowDirectMonths: [3, 4, 5, 6],
    harvestMonths: [6, 7, 8],
    companions: ["carrot", "turnip", "lettuce"],
    antagonists: ["onion", "garlic"],
  },
  {
    id: "bean",
    name: "French Bean",
    icon: "🫘",
    color: "#16a34a",
    daysToHarvest: 60,
    variety: "Climbing",
    description:
      "Sow after last frost. Needs a strong support structure at least 2m tall.",
    spacingCm: 15,
    frostHardy: false,
    sunRequirement: "full",
    sowIndoorMonths: [4],
    sowDirectMonths: [5, 6, 7],
    harvestMonths: [8, 9, 10],
    companions: ["carrot", "cucumber", "celery"],
    antagonists: ["onion", "fennel"],
  },
  {
    id: "garlic",
    name: "Garlic",
    icon: "🧄",
    color: "#f5f5f5",
    daysToHarvest: 240,
    variety: "Hardneck",
    description:
      "Plant cloves in autumn, harvest June–July when leaves yellow.",
    spacingCm: 15,
    frostHardy: true,
    sunRequirement: "full",
    sowIndoorMonths: [],
    sowDirectMonths: [10, 11],
    harvestMonths: [6, 7],
    companions: ["tomato", "carrot", "lettuce"],
    antagonists: ["pea", "bean"],
  },
];

interface Planter {
  id: string;
  name: string;
  rows: number;
  cols: number;
  squares?: PlanterSquare[][];
  virtualSections?: VirtualSection[];
  backgroundColor?: string;
  tagline?: string;
}

interface Area {
  id: string;
  name: string;
  tagline?: string;
  backgroundColor?: string;
  planters: Planter[];
}

interface Seedling {
  id: string;
  plant: Plant;
  plantedDate: string;
  seedCount: number;
  location: string;
  method?: "indoor" | "direct-sow";
  status: "germinating" | "growing" | "hardening" | "ready";
}

interface Settings {
  location: string;
  growthZone: string;
  weatherProvider: string;
}

export default function App() {
  const [areas, setAreas] = useState<Area[]>(() => {
    try {
      const saved = localStorage.getItem("gp_areas");
      if (saved) return JSON.parse(saved) as Area[];
    } catch {
      /* ignore */
    }
    return [
      {
        id: "area-1",
        name: "Backyard",
        tagline: "Main Vegetable Garden",
        backgroundColor: "#f0fdf4",
        planters: [
          {
            id: "1",
            name: "Raised Bed 1",
            rows: 4,
            cols: 4,
            tagline: "Brassicas & Roots",
            backgroundColor: "#5D4037",
          },
          {
            id: "2",
            name: "Raised Bed 2",
            rows: 4,
            cols: 4,
            tagline: "Nightshades",
            backgroundColor: "#5D4037",
          },
        ],
      },
      {
        id: "area-2",
        name: "Patio",
        tagline: "Container Garden",
        backgroundColor: "#fefce8",
        planters: [
          {
            id: "3",
            name: "Large Pot",
            rows: 1,
            cols: 1,
            tagline: "Cucumber",
            backgroundColor: "#81C784",
          },
        ],
      },
    ];
  });
  const [customPlants, setCustomPlants] = useState<Plant[]>(() => {
    try {
      const saved = localStorage.getItem("gp_customPlants");
      if (saved) return JSON.parse(saved) as Plant[];
    } catch {
      /* ignore */
    }
    return [];
  });
  const [seedlings, setSeedlings] = useState<Seedling[]>(() => {
    try {
      const saved = localStorage.getItem("gp_seedlings");
      if (saved) return JSON.parse(saved) as Seedling[];
    } catch {
      /* ignore */
    }
    return [];
  });
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem("gp_settings");
      if (saved) return JSON.parse(saved) as Settings;
    } catch {
      /* ignore */
    }
    return {
      location: "",
      growthZone: "6b",
      weatherProvider: "OpenWeather",
    };
  });
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
  const [planterDialogOpen, setPlanterDialogOpen] = useState(false);
  const [editingPlanter, setEditingPlanter] = useState<{
    areaId: string;
    planter: Planter | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState("areas");
  const [isEditMode, setIsEditMode] = useState(true);
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [showAddSeedlingModal, setShowAddSeedlingModal] = useState(false);
  const [showSowModal, setShowSowModal] = useState(false);
  const [selectedSowPlant, setSelectedSowPlant] = useState<Plant | null>(null);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [dialogDefaultIsSeed, setDialogDefaultIsSeed] = useState(false);

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("gp_areas", JSON.stringify(areas));
    } catch {
      /* ignore */
    }
  }, [areas]);
  useEffect(() => {
    try {
      localStorage.setItem("gp_customPlants", JSON.stringify(customPlants));
    } catch {
      /* ignore */
    }
  }, [customPlants]);
  useEffect(() => {
    try {
      localStorage.setItem("gp_seedlings", JSON.stringify(seedlings));
    } catch {
      /* ignore */
    }
  }, [seedlings]);
  useEffect(() => {
    try {
      localStorage.setItem("gp_settings", JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const harvestAlerts = suggestions
    .filter((s) => s.type === "harvest" && s.plant && s.dueDate)
    .map((s) => ({
      plantName: s.plant!.name,
      plantIcon: s.plant!.icon,
      daysUntilHarvest: Math.ceil(
        (new Date(s.dueDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
      areaName: "Garden",
    }))
    .filter((a) => a.daysUntilHarvest <= 30)
    .sort((a, b) => a.daysUntilHarvest - b.daysUntilHarvest);

  const AVAILABLE_PLANTS = [...DEFAULT_PLANTS, ...customPlants].map((p) => ({
    ...p,
    isSeed: p.isSeed ?? false,
    amount: p.amount ?? (p.isSeed ? 25 : 1),
  }));

  const handleAddSeedling = (data: SeedlingFormData) => {
    const newSeedling: Seedling = {
      id: `seedling-${Date.now()}`,
      plant: data.plant,
      seedCount: data.seedCount,
      location: data.location,
      plantedDate: data.plantedDate,
      method: data.method,
      status: "germinating",
    };
    setSeedlings((prev) => [newSeedling, ...prev]);
    setEvents((prev) => [
      {
        id: `sow-event-${Date.now()}`,
        type: "sown",
        plant: data.plant,
        date: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleOpenSowModal = (plant: Plant) => {
    setSelectedSowPlant(plant);
    setShowSowModal(true);
  };

  const handleSowSeeds = (
    plant: Plant,
    seedCount: number,
    location: string,
  ) => {
    // 1. Decrement amount
    setCustomPlants((prev) => {
      const exists = prev.find((p) => p.id === plant.id);
      if (exists) {
        return prev.map((p) =>
          p.id === plant.id
            ? { ...p, amount: Math.max(0, (p.amount ?? 0) - seedCount) }
            : p,
        );
      } else {
        // If it was a DEFAULT_PLANT, it now becomes a custom plant to track amount
        return [
          ...prev,
          {
            ...plant,
            amount: Math.max(0, (plant.amount ?? 25) - seedCount),
          },
        ];
      }
    });

    // 2. Add to seedlings
    const newSeedling: Seedling = {
      id: `seedling-${Date.now()}`,
      plant,
      seedCount,
      location,
      plantedDate: new Date().toISOString(),
      status: "germinating",
    };
    setSeedlings((prev) => [newSeedling, ...prev]);

    // 3. Log event
    setEvents((prev) => [
      {
        id: `sow-event-${Date.now()}`,
        type: "sown",
        plant,
        date: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleUpdateSeedlingStatus = (
    id: string,
    status: Seedling["status"],
  ) => {
    setSeedlings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );

    // Log the update
    const seedling = seedlings.find((s) => s.id === id);
    if (!seedling) return;

    setEvents((prev) => [
      {
        id: `update-seedling-${Date.now()}`,
        type:
          status === "growing"
            ? "sprouted"
            : status === "hardening" || status === "ready"
              ? "sprouted"
              : "watered",
        plant: seedling.plant,
        date: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handlePlantFromBatch = (seedling: Seedling) => {
    setSelectedPlant(seedling.plant);
    setActiveTab("areas");
    // Batch stays until deleted manually
  };

  const handleRemoveSeedling = (id: string) => {
    setSeedlings((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddPlant = (plant: Plant) => {
    if (editingPlant) {
      setCustomPlants((prev) =>
        prev.map((p) => (p.id === plant.id ? plant : p)),
      );
    } else {
      setCustomPlants((prev) => [...prev, plant]);
    }
    setEditingPlant(null);
  };

  const handleRemovePlantManually = (id: string) => {
    setCustomPlants((prev) => prev.filter((p) => p.id !== id));
  };

  const handleEditPlantManually = (plant: Plant) => {
    setEditingPlant(plant);
    setShowAddPlantModal(true);
  };

  const handleAddArea = () => {
    const newArea: Area = {
      id: `area-${Date.now()}`,
      name: "New Area",
      tagline: "Location description",
      backgroundColor: "#f0fdf4",
      planters: [],
    };
    setAreas((prev) => [...prev, newArea]);
  };

  const handleRemoveArea = (id: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdateArea = (id: string, updates: Partial<Area>) => {
    setAreas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  };

  const handleAddPlanter = (areaId: string) => {
    setEditingPlanter({ areaId, planter: null });
    setPlanterDialogOpen(true);
  };

  const handleEditPlanter = (areaId: string, planter: Planter) => {
    setEditingPlanter({ areaId, planter });
    setPlanterDialogOpen(true);
  };

  const handleSavePlanter = (config: PlanterConfig) => {
    if (!editingPlanter) return;

    const { areaId } = editingPlanter;

    setAreas((prevAreas) =>
      prevAreas.map((area) => {
        if (area.id !== areaId) return area;

        const updatedPlanters = config.id
          ? area.planters.map((p) =>
              p.id === config.id
                ? ({
                    ...p,
                    ...config,
                  } as Planter)
                : p,
            )
          : [
              ...area.planters,
              {
                id: `planter-${Date.now()}`,
                ...config,
              } as Planter,
            ];

        return { ...area, planters: updatedPlanters };
      }),
    );

    setPlanterDialogOpen(false);
    setEditingPlanter(null);
  };

  const handleRemovePlanter = (areaId: string, planterId: string) => {
    setAreas((prevAreas) =>
      prevAreas.map((area) => {
        if (area.id !== areaId) return area;
        return {
          ...area,
          planters: area.planters.filter((p) => p.id !== planterId),
        };
      }),
    );
    setEvents((prev) => prev.filter((e) => e.gardenId !== planterId));
  };

  const handleMoveArea = (id: string, direction: "up" | "down") => {
    setAreas((prev) => {
      const index = prev.findIndex((a) => a.id === id);
      if (index < 0) return prev;
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const handleMovePlanter = (
    areaId: string,
    planterId: string,
    direction: "up" | "down",
  ) => {
    setAreas((prevAreas) =>
      prevAreas.map((area) => {
        if (area.id !== areaId) return area;
        const index = area.planters.findIndex((p) => p.id === planterId);
        if (index < 0) return area;
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= area.planters.length) return area;
        const next = [...area.planters];
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        return { ...area, planters: next };
      }),
    );
  };

  const handlePlantAdded = (
    plantInstance: PlantInstance,
    _planterId: string,
  ) => {
    // Log planting event
    const eventLog: GardenEvent = {
      id: `planted-${Date.now()}-${Math.random()}`,
      type: "planted",
      plant: plantInstance.plant,
      date: new Date().toISOString(),
      gardenId: _planterId,
    };
    setEvents((prev) => [eventLog, ...prev]);

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
    _planterId: string,
  ) => {
    // Remove harvest suggestions for this specific plant instance
    setSuggestions((prev) =>
      prev.filter((s) => s.id !== `harvest-sug-${plantInstance.instanceId}`),
    );
  };

  const handlePlantUpdated = (
    plantInstance: PlantInstance,
    _planterId: string,
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
                description: `Time to harvest ${
                  plantInstance.variety || plantInstance.plant.name
                }`,
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

  const currentMonth = new Date().getMonth() + 1; // 1–12

  return (
    <div className="size-full flex flex-col bg-background relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-secondary/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4 relative z-10">
        <div className="flex-1 flex flex-col gap-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="bg-white/40 backdrop-blur-sm border border-white/60">
              <TabsTrigger value="areas">
                <MapIcon className="w-4 h-4 mr-2" /> Areas
              </TabsTrigger>
              <TabsTrigger value="plants">
                <Users className="w-4 h-4 mr-2" /> My Plants / Seeds
              </TabsTrigger>
              <TabsTrigger value="seedlings">
                <Thermometer className="w-4 h-4 mr-2" /> Seedlings
              </TabsTrigger>
              <TabsTrigger value="settings">
                <SettingsIcon className="w-4 h-4 mr-2" /> Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="areas" className="flex-1 mt-0">
              <div className="flex-1 overflow-auto bg-white/40 backdrop-blur-sm rounded-2xl border border-white/60 shadow-lg p-4 custom-scrollbar h-[calc(100vh-12rem)]">
                <div className="mb-4 px-1 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-black text-foreground tracking-tight uppercase">
                      Area Planner
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-[10px] uppercase font-bold tracking-wider opacity-60">
                      Organize your garden into logical areas and planters.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditMode((prev) => !prev)}
                      className={`h-8 px-3 rounded-lg border flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                        isEditMode
                          ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                          : "bg-white/60 border-border/40 text-muted-foreground hover:bg-white/90 hover:text-foreground"
                      }`}
                    >
                      {isEditMode ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> View Mode
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Edit Mode
                        </>
                      )}
                    </button>
                    {isEditMode && (
                      <Button
                        onClick={handleAddArea}
                        className="bg-primary hover:bg-primary/90 h-8 rounded-lg px-3 shadow-md shadow-primary/20 text-xs font-bold uppercase tracking-wider"
                      >
                        <Plus className="w-4 h-4 mr-1.5" /> New Area
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  {areas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center text-gray-400 w-full mt-12 py-12 border-2 border-dashed border-gray-100 rounded-2xl bg-white/20">
                      <div className="bg-primary/10 p-4 rounded-full mb-3">
                        <MapIcon className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-lg font-bold text-gray-600">
                        No areas defined yet
                      </p>
                      <p className="mt-1 text-xs text-gray-400 max-w-sm">
                        Create your first area (like "Backyard" or "Front
                        Porch") to start adding planters.
                      </p>
                    </div>
                  ) : (
                    areas.map((area, areaIdx) => (
                      <div
                        key={area.id}
                        className="bg-white/50 backdrop-blur-xl rounded-2xl border border-white/80 shadow-sm overflow-hidden transition-all hover:shadow-md"
                      >
                        <div
                          className="px-4 py-2.5 flex items-center justify-between border-b border-white/40"
                          style={{
                            backgroundColor: `${area.backgroundColor}22`,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-2 h-8 rounded-full"
                              style={{ backgroundColor: area.backgroundColor }}
                            />
                            <div>
                              {isEditMode ? (
                                <input
                                  className="bg-transparent text-lg font-black text-foreground border-none focus:outline-none focus:ring-1 focus:ring-primary/20 rounded px-1 -ml-1 transition-all"
                                  value={area.name}
                                  onChange={(e) =>
                                    handleUpdateArea(area.id, {
                                      name: e.target.value,
                                    })
                                  }
                                />
                              ) : (
                                <span className="text-lg font-black text-foreground px-1">
                                  {area.name}
                                </span>
                              )}
                              {isEditMode ? (
                                <input
                                  className="bg-transparent text-[9px] font-bold uppercase tracking-widest text-muted-foreground block border-none focus:outline-none focus:ring-1 focus:ring-primary/20 rounded px-1 -ml-1 mt-0"
                                  value={area.tagline}
                                  onChange={(e) =>
                                    handleUpdateArea(area.id, {
                                      tagline: e.target.value,
                                    })
                                  }
                                />
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block px-1">
                                  {area.tagline}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isEditMode && (
                              <input
                                type="color"
                                value={area.backgroundColor}
                                onChange={(e) =>
                                  handleUpdateArea(area.id, {
                                    backgroundColor: e.target.value,
                                  })
                                }
                                className="w-5 h-5 rounded-full overflow-hidden border-none cursor-pointer bg-transparent"
                              />
                            )}
                            {isEditMode && (
                              <div className="h-4 w-px bg-gray-200 mx-1.5" />
                            )}
                            {isEditMode && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMoveArea(area.id, "up")}
                                disabled={areaIdx === 0}
                                className="h-7 w-7 rounded-md"
                              >
                                <MoveUp className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {isEditMode && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMoveArea(area.id, "down")}
                                disabled={areaIdx === areas.length - 1}
                                className="h-7 w-7 rounded-md"
                              >
                                <MoveDown className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {isEditMode && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveArea(area.id)}
                                className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="flex flex-wrap gap-4 items-start">
                            {area.planters.map((planter, pIdx) => (
                              <div
                                key={planter.id}
                                className="transition-transform hover:scale-[1.01] duration-300"
                              >
                                <PlanterGrid
                                  id={planter.id}
                                  name={planter.name}
                                  rows={planter.rows}
                                  cols={planter.cols}
                                  selectedPlant={
                                    isEditMode ? selectedPlant : null
                                  }
                                  initialSquares={planter.squares}
                                  virtualSections={planter.virtualSections}
                                  backgroundColor={planter.backgroundColor}
                                  viewOnly={!isEditMode}
                                  onPlantAdded={handlePlantAdded}
                                  onPlantRemoved={handlePlantRemoved}
                                  onPlantUpdated={handlePlantUpdated}
                                  onSquaresChange={(newSquares, planterId) => {
                                    setAreas((prev) =>
                                      prev.map((a) => ({
                                        ...a,
                                        planters: a.planters.map((p) =>
                                          p.id === planterId
                                            ? { ...p, squares: newSquares }
                                            : p,
                                        ),
                                      })),
                                    );
                                  }}
                                  onEdit={
                                    isEditMode
                                      ? () =>
                                          handleEditPlanter(area.id, planter)
                                      : undefined
                                  }
                                  onDelete={
                                    isEditMode
                                      ? () =>
                                          handleRemovePlanter(
                                            area.id,
                                            planter.id,
                                          )
                                      : undefined
                                  }
                                  onMoveUp={
                                    isEditMode && pIdx > 0
                                      ? () =>
                                          handleMovePlanter(
                                            area.id,
                                            planter.id,
                                            "up",
                                          )
                                      : undefined
                                  }
                                  onMoveDown={
                                    isEditMode &&
                                    pIdx < area.planters.length - 1
                                      ? () =>
                                          handleMovePlanter(
                                            area.id,
                                            planter.id,
                                            "down",
                                          )
                                      : undefined
                                  }
                                />
                              </div>
                            ))}

                            <button
                              onClick={() => handleAddPlanter(area.id)}
                              className={`w-40 h-40 flex flex-col items-center justify-center border-4 border-dashed border-gray-200/50 rounded-3xl text-gray-300 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all group ${
                                !isEditMode ? "hidden" : ""
                              }`}
                            >
                              <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-bold uppercase tracking-widest">
                                New Planter
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="plants">
              <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-white/60 shadow-lg p-5 h-[calc(100vh-12rem)] overflow-auto shadow-sm">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">
                      My Plants & Seeds
                    </h2>
                    <p className="text-muted-foreground text-[11px] font-medium mt-1 uppercase tracking-wider opacity-60">
                      Manage your catalog of vegetables, seeds, and flowers.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setEditingPlant(null);
                        setDialogDefaultIsSeed(true);
                        setShowAddPlantModal(true);
                      }}
                      variant="outline"
                      className="h-8 rounded-lg px-3 border-primary/40 text-primary hover:bg-primary/5 shadow-sm text-xs font-bold uppercase tracking-wider"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Seeds
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingPlant(null);
                        setDialogDefaultIsSeed(false);
                        setShowAddPlantModal(true);
                      }}
                      className="h-8 rounded-lg px-3 shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 text-xs font-bold uppercase tracking-wider"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Plant
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {AVAILABLE_PLANTS.map((plant) => {
                    const isCustom = customPlants.some(
                      (p) => p.id === plant.id,
                    );
                    const isDepleted = plant.isSeed && plant.amount === 0;

                    return (
                      <div
                        key={plant.id}
                        className={`group relative bg-white/70 backdrop-blur-sm p-3.5 rounded-xl shadow-sm border transition-all hover:shadow-md hover:bg-white/90 ${
                          isDepleted
                            ? "border-red-200 bg-red-50/10 grayscale-[0.3]"
                            : "border-emerald-50"
                        }`}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-12 h-12 flex items-center justify-center text-3xl bg-muted/40 rounded-xl group-hover:scale-105 transition-transform duration-500 shadow-inner border border-white/40 shrink-0">
                            {plant.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-base text-foreground tracking-tight leading-tight truncate">
                              {plant.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 items-center mt-1">
                              {plant.isSeed && (
                                <span
                                  className={`text-xs font-black px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                                    isDepleted
                                      ? "bg-red-600 text-white"
                                      : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {isDepleted ? "Depleted" : "Seed"}
                                </span>
                              )}
                              {plant.variety && (
                                <span className="text-xs font-black bg-primary/10 text-primary px-2 py-0.5 rounded-sm uppercase tracking-wider truncate max-w-[110px]">
                                  {plant.variety}
                                </span>
                              )}
                              {plant.frostHardy === true && (
                                <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-blue-100 text-blue-700 uppercase tracking-wider">
                                  ❄ Hardy
                                </span>
                              )}
                              {plant.frostHardy === false && (
                                <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-amber-100 text-amber-700 uppercase tracking-wider">
                                  ⚡ Tender
                                </span>
                              )}
                              {plant.sowIndoorMonths?.includes(
                                currentMonth,
                              ) && (
                                <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-green-600 text-white uppercase tracking-wider">
                                  🌱 Sow!
                                </span>
                              )}
                              {plant.sowDirectMonths?.includes(
                                currentMonth,
                              ) && (
                                <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-emerald-700 text-white uppercase tracking-wider">
                                  🌾 Direct!
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Info chips */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-muted/30 text-foreground uppercase tracking-wider">
                            {plant.daysToHarvest ?? 60}d
                          </span>
                          {plant.spacingCm && (
                            <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-muted/30 text-foreground uppercase tracking-wider">
                              {plant.spacingCm}cm
                            </span>
                          )}
                          {plant.sunRequirement === "full" && (
                            <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-yellow-50 text-yellow-700 uppercase tracking-wider">
                              ☀ Full Sun
                            </span>
                          )}
                          {plant.sunRequirement === "partial" && (
                            <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-yellow-50 text-yellow-600 uppercase tracking-wider">
                              ⛅ Partial
                            </span>
                          )}
                          {plant.sunRequirement === "shade" && (
                            <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600 uppercase tracking-wider">
                              🌥 Shade
                            </span>
                          )}
                        </div>

                        {/* Sow window */}
                        {((plant.sowIndoorMonths?.length ?? 0) > 0 ||
                          (plant.sowDirectMonths?.length ?? 0) > 0) && (
                          <p className="text-sm font-semibold text-foreground/70 mb-2 leading-relaxed">
                            {(plant.sowIndoorMonths?.length ?? 0) > 0 &&
                              `🌱 ${formatMonthRange(plant.sowIndoorMonths!)}`}
                            {(plant.sowIndoorMonths?.length ?? 0) > 0 &&
                              (plant.sowDirectMonths?.length ?? 0) > 0 &&
                              " · "}
                            {(plant.sowDirectMonths?.length ?? 0) > 0 &&
                              `🌾 ${formatMonthRange(plant.sowDirectMonths!)}`}
                          </p>
                        )}

                        {/* Companions */}
                        {(plant.companions?.length ?? 0) > 0 && (
                          <p className="text-sm font-medium text-emerald-700 mb-2">
                            ✓ {plant.companions!.slice(0, 3).join(", ")}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex justify-between items-center pt-1.5 border-t border-white/30 mt-auto">
                          <span className="text-sm font-black text-foreground/60 uppercase tracking-wider">
                            {plant.amount ?? 0}{" "}
                            {plant.isSeed ? "seeds" : "plants"}
                          </span>
                          <div className="flex gap-1.5">
                            {plant.isSeed && !isDepleted && (
                              <button
                                onClick={() => handleOpenSowModal(plant)}
                                className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-md transition-all group/sow"
                                title="Sow Seeds"
                              >
                                <Sprout className="w-3.5 h-3.5 group-hover/sow:scale-110 transition-transform" />
                              </button>
                            )}
                            {isCustom ? (
                              <>
                                <button
                                  onClick={() => handleEditPlantManually(plant)}
                                  className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-all"
                                  title="Edit"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleRemovePlantManually(plant.id)
                                  }
                                  className="p-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-md transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button className="p-1.5 bg-muted/50 text-muted-foreground rounded-md cursor-not-allowed opacity-30">
                                <SettingsIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="seedlings">
              <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-white/60 shadow-lg p-5 h-[calc(100vh-12rem)] overflow-auto">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">
                      Active Seedlings
                    </h2>
                    <p className="text-muted-foreground text-[11px] font-medium mt-1 uppercase tracking-wider opacity-60">
                      Track batches from seed to transplant.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowAddSeedlingModal(true)}
                    className="h-8 rounded-lg px-3 shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 text-xs font-bold uppercase tracking-wider"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Seedling
                  </Button>
                </div>
                {seedlings.length === 0 ? (
                  <div className="text-center py-12 bg-white/20 rounded-2xl border-2 border-dashed border-border/20">
                    <Thermometer className="mx-auto w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                      No seedlings yet. Start some seeds!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {seedlings.map((seedling) => (
                      <div
                        key={seedling.id}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/40 p-4 shadow-sm group hover:shadow-md transition-all flex flex-col"
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-12 h-12 flex items-center justify-center text-3xl bg-primary/10 rounded-xl shadow-inner border border-primary/20 shrink-0">
                            {seedling.plant.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-base text-foreground truncate">
                              {seedling.plant.name}
                            </h3>
                            <div className="flex gap-1.5 items-center mt-1">
                              <span
                                className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-[0.1em] ${
                                  seedling.status === "germinating"
                                    ? "bg-amber-100 text-amber-600"
                                    : seedling.status === "growing"
                                      ? "bg-blue-100 text-blue-600"
                                      : seedling.status === "hardening"
                                        ? "bg-orange-100 text-orange-600"
                                        : "bg-emerald-100 text-emerald-600"
                                }`}
                              >
                                {seedling.status === "hardening"
                                  ? "Hardening Off"
                                  : seedling.status}
                              </span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">
                                {seedling.location}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4 bg-muted/20 p-3 rounded-xl border border-white/20">
                          <div>
                            <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider">
                              Started
                            </p>
                            <p className="text-[11px] font-bold">
                              {new Date(
                                seedling.plantedDate,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider">
                              Batch Size
                            </p>
                            <p className="text-[11px] font-bold">
                              {seedling.seedCount} Seeds
                            </p>
                          </div>
                        </div>

                        <div className="mt-auto pt-2 flex gap-2">
                          {seedling.status === "germinating" && (
                            <Button
                              onClick={() =>
                                handleUpdateSeedlingStatus(
                                  seedling.id,
                                  "growing",
                                )
                              }
                              className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              Started Sprouting
                            </Button>
                          )}
                          {seedling.status === "growing" && (
                            <Button
                              onClick={() =>
                                handleUpdateSeedlingStatus(
                                  seedling.id,
                                  "hardening",
                                )
                              }
                              className="w-full h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              Hardening Off
                            </Button>
                          )}
                          {seedling.status === "hardening" && (
                            <Button
                              onClick={() =>
                                handleUpdateSeedlingStatus(seedling.id, "ready")
                              }
                              className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              Ready to Plant
                            </Button>
                          )}
                          {seedling.status === "ready" && (
                            <div className="w-full flex gap-2">
                              <Button
                                onClick={() => handlePlantFromBatch(seedling)}
                                className="flex-1 h-8 bg-primary hover:bg-primary/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-primary/20"
                              >
                                Use Batch
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  handleRemoveSeedling(seedling.id)
                                }
                                className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-white/60 shadow-lg p-5 h-[calc(100vh-12rem)] overflow-auto">
                <h2 className="text-2xl font-black text-foreground tracking-tight uppercase mb-6 leading-none">
                  Settings
                </h2>
                <div className="max-w-md space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      Location
                    </label>
                    <input
                      className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                      value={settings.location}
                      onChange={(e) =>
                        setSettings({ ...settings, location: e.target.value })
                      }
                      placeholder="e.g. London, UK"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      Growth Zone
                    </label>
                    <select
                      className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner appearance-none"
                      value={settings.growthZone}
                      onChange={(e) =>
                        setSettings({ ...settings, growthZone: e.target.value })
                      }
                    >
                      <option value="1">Zone 1</option>
                      <option value="2">Zone 2</option>
                      <option value="3">Zone 3</option>
                      <option value="4">Zone 4</option>
                      <option value="5">Zone 5</option>
                      <option value="6a">Zone 6a</option>
                      <option value="6b">Zone 6b</option>
                      <option value="7">Zone 7</option>
                      <option value="8">Zone 8</option>
                      <option value="9">Zone 9</option>
                      <option value="10">Zone 10</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      Weather Provider
                    </label>
                    <select
                      className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner appearance-none"
                      value={settings.weatherProvider}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          weatherProvider: e.target.value,
                        })
                      }
                    >
                      <option value="OpenWeather">OpenWeather</option>
                      <option value="Weatherbit">Weatherbit</option>
                      <option value="Visual Crossing">Visual Crossing</option>
                    </select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Events sidebar - Floating style */}
        <div className="w-72 h-full flex flex-col drop-shadow-xl">
          <EventsBar
            events={events}
            suggestions={suggestions}
            harvestAlerts={harvestAlerts}
            onCompleteSuggestion={handleCompleteSuggestion}
          />
        </div>
      </div>

      {/* Bottom toolbar - Floating style */}
      <div className="px-4 pb-4 relative z-20">
        <div className="max-w-5xl mx-auto drop-shadow-xl">
          <ToolBar
            plants={AVAILABLE_PLANTS}
            selectedPlant={selectedPlant}
            onSelectPlant={setSelectedPlant}
            onAddArea={handleAddArea}
            onAddPlant={() => setShowAddPlantModal(true)}
          />
        </div>
      </div>

      {/* Planter Configuration Dialog */}
      <PlanterDialog
        open={planterDialogOpen}
        onOpenChange={setPlanterDialogOpen}
        onSave={handleSavePlanter}
        initialConfig={
          editingPlanter?.planter
            ? {
                id: editingPlanter.planter.id,
                name: editingPlanter.planter.name,
                tagline: editingPlanter.planter.tagline,
                backgroundColor: editingPlanter.planter.backgroundColor,
                rows: editingPlanter.planter.rows,
                cols: editingPlanter.planter.cols,
                virtualSections: editingPlanter.planter.virtualSections,
              }
            : undefined
        }
      />

      <PlantDialog
        open={showAddPlantModal}
        onOpenChange={setShowAddPlantModal}
        onSave={handleAddPlant}
        initialPlant={editingPlant || undefined}
        defaultIsSeed={dialogDefaultIsSeed}
      />

      <SowSeedsDialog
        open={showSowModal}
        onOpenChange={setShowSowModal}
        plant={selectedSowPlant}
        onSow={handleSowSeeds}
      />

      <AddSeedlingDialog
        open={showAddSeedlingModal}
        onOpenChange={setShowAddSeedlingModal}
        plants={AVAILABLE_PLANTS}
        onAdd={handleAddSeedling}
      />
    </div>
  );
}
