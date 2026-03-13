import { useState } from "react";
import {
  PlanterGrid,
  PlantInstance,
} from "./components/PlanterGrid";
import { EventsBar } from "./components/EventsBar";
import { ToolBar } from "./components/ToolBar";
import { PlanterDialog } from "./components/PlanterDialog";
import { PlantDialog } from "./components/PlantDefinitionDialog";
import { SowSeedsDialog } from "./components/SowSeedsDialog";
import { AddSeedlingDialog } from "./components/AddSeedlingDialog";
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
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { useGardenData } from "./hooks/useGardenData";
import { useLocationSettings } from "./hooks/useLocationSettings";
import { useOpenRouterSettings } from "./hooks/useOpenRouterSettings";
import { useAreaManager } from "./hooks/useAreaManager";
import { usePlantCatalog } from "./hooks/usePlantCatalog";
import { useSeedlingManager } from "./hooks/useSeedlingManager";
import { useGardenEvents } from "./hooks/useGardenEvents";
import { useSuggestions } from "./hooks/useSuggestions";

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

export default function App() {
  // ── Core data (DB loading + persistence) ──────────────────────────────────
  const {
    dbError,
    savedIndicator,
    areas,
    setAreas,
    customPlants,
    setCustomPlants,
    seedlings,
    setSeedlings,
    settings,
    setSettings,
    events,
    setEvents,
    repositoryRef,
    hasLoadedFromDB,
  } = useGardenData();

  // ── UI-only state kept in App as orchestration layer ──────────────────────
  const [activeTab, setActiveTab] = useState("areas");
  const [isEditMode, setIsEditMode] = useState(true);
  const [selectedPlant, setSelectedPlant] = useState<
    PlantInstance["plant"] | null
  >(null);

  // ── Settings sub-hooks ────────────────────────────────────────────────────
  const {
    locationDraft,
    setLocationDraft,
    locationStatus,
    setLocationStatus,
    locationError,
    setLocationError,
    handleVerifyLocation,
  } = useLocationSettings(settings, setSettings);

  const {
    orKeyDraft,
    setOrKeyDraft,
    orStatus,
    setOrStatus,
    orError,
    setOrError,
    showOrKey,
    setShowOrKey,
    handleValidateOpenRouter,
  } = useOpenRouterSettings(settings, setSettings);

  // ── Area + planter management ─────────────────────────────────────────────
  const {
    planterDialogOpen,
    setPlanterDialogOpen,
    editingPlanter,
    handleAddArea,
    handleRemoveArea,
    handleUpdateArea,
    handleAddPlanter,
    handleEditPlanter,
    handleSavePlanter,
    handleRemovePlanter,
    handleMoveArea,
    handleMovePlanter,
  } = useAreaManager({ setAreas, events, setEvents, repositoryRef });

  // ── Plant catalogue ───────────────────────────────────────────────────────
  const {
    showAddPlantModal,
    setShowAddPlantModal,
    editingPlant,
    setEditingPlant,
    dialogDefaultIsSeed,
    setDialogDefaultIsSeed,
    plantsFilter,
    setPlantsFilter,
    plantsSearch,
    setPlantsSearch,
    AVAILABLE_PLANTS,
    filteredAvailablePlants,
    plantTabCounts,
    getAvailableStock,
    handleAddPlant,
    handleRemovePlantManually,
    handleEditPlantManually,
  } = usePlantCatalog({ customPlants, setCustomPlants, areas, repositoryRef });

  // ── Seedling management ───────────────────────────────────────────────────
  const {
    showAddSeedlingModal,
    setShowAddSeedlingModal,
    showSowModal,
    setShowSowModal,
    selectedSowPlant,
    handleAddSeedling,
    handleOpenSowModal,
    handleSowSeeds,
    handleUpdateSeedlingStatus,
    handlePlantFromBatch,
    handleRemoveSeedling,
  } = useSeedlingManager({
    seedlings,
    setSeedlings,
    setCustomPlants,
    setEvents,
    repositoryRef,
    setSelectedPlant,
    setActiveTab,
  });

  // ── Events + suggestions ──────────────────────────────────────────────────
  const {
    harvestAlerts,
    handlePlantAdded,
    handlePlantRemoved,
    handlePlantUpdated,
    handleCompleteSuggestion,
  } = useGardenEvents({ setEvents, repositoryRef });

  const {
    suggestions,
    loading: suggestionsLoading,
    mode: suggestionsMode,
  } = useSuggestions({
    areas: areas as unknown as import("./data/schema").Area[],
    seedlings: seedlings as unknown as import("./data/schema").Seedling[],
    events: events as unknown as import("./data/schema").GardenEvent[],
    settings,
    plants: AVAILABLE_PLANTS as unknown as import("./data/schema").Plant[],
    hasLoadedFromDB,
  });

  const currentMonth = new Date().getMonth() + 1; // 1–12

  return (
    <div className="size-full flex flex-col bg-background relative overflow-hidden">
      {dbError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
          <span>⚠ Database error – data will not persist:</span>
          <span className="font-mono font-normal">{dbError}</span>
        </div>
      )}
      <div
        className={`fixed bottom-4 right-4 z-50 bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transition-all duration-500 ${
          savedIndicator
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
        Saved
      </div>
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
                                  getAvailableStock={getAvailableStock}
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
                <div className="mb-5">
                  <div className="flex justify-between items-start mb-4">
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

                  {/* Search + filter row */}
                  <div className="flex items-center gap-3">
                    <input
                      type="search"
                      placeholder="Search plants…"
                      value={plantsSearch}
                      onChange={(e) => setPlantsSearch(e.target.value)}
                      className="h-8 flex-1 max-w-xs bg-white/60 border border-border/40 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                    />
                    <div className="flex gap-0.5 bg-muted/30 rounded-lg p-0.5">
                      {(
                        [
                          { key: "all", label: `All (${plantTabCounts.all})` },
                          {
                            key: "plants",
                            label: `🌿 Plants (${plantTabCounts.plants})`,
                          },
                          {
                            key: "seeds",
                            label: `🌾 Seeds (${plantTabCounts.seeds})`,
                          },
                        ] as {
                          key: "all" | "plants" | "seeds";
                          label: string;
                        }[]
                      ).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setPlantsFilter(key)}
                          className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                            plantsFilter === key
                              ? "bg-white shadow-sm text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {filteredAvailablePlants.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                      <p className="text-sm font-bold uppercase tracking-wider">
                        No results
                      </p>
                      <p className="text-xs mt-1">
                        Try a different filter or search term
                      </p>
                    </div>
                  ) : null}
                  {filteredAvailablePlants.map((plant) => {
                    const isCustom = customPlants.some(
                      (p) => p.id === plant.id,
                    );
                    const availableStock = getAvailableStock(plant.id);
                    const isDepleted = plant.isSeed && availableStock === 0;

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
                          <span
                            className={`text-sm font-black uppercase tracking-wider ${
                              isDepleted ? "text-red-500" : "text-foreground/60"
                            }`}
                          >
                            {plant.amount === undefined
                              ? "∞ Unlimited"
                              : `${availableStock} ${plant.isSeed ? "seeds" : "qty"}`}
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
                            <div className="flex flex-wrap gap-1 items-center mt-1">
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
                              {seedling.method && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-[0.1em] bg-muted/40 text-muted-foreground">
                                  {seedling.method === "indoor"
                                    ? "🏠 Indoor"
                                    : "🌾 Direct"}
                                </span>
                              )}
                              <span
                                className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 truncate max-w-[80px]"
                                title={seedling.location}
                              >
                                {seedling.location}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4 bg-muted/20 p-3 rounded-xl border border-white/20">
                          <div>
                            <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider">
                              Started
                            </p>
                            <p className="text-[10px] font-bold">
                              {new Date(
                                seedling.plantedDate,
                              ).toLocaleDateString(
                                settings.locale || undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider">
                              Days
                            </p>
                            <p className="text-[10px] font-bold">
                              {Math.floor(
                                (Date.now() -
                                  new Date(seedling.plantedDate).getTime()) /
                                  (1000 * 60 * 60 * 24),
                              )}
                              d
                            </p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider">
                              Batch
                            </p>
                            <p className="text-[10px] font-bold">
                              {seedling.seedCount}×
                            </p>
                          </div>
                        </div>

                        <div className="mt-auto pt-2 space-y-2">
                          {/* Primary action button */}
                          <div className="flex gap-2">
                            {seedling.status === "germinating" && (
                              <Button
                                onClick={() =>
                                  handleUpdateSeedlingStatus(
                                    seedling.id,
                                    "growing",
                                  )
                                }
                                className="flex-1 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
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
                                className="flex-1 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                Hardening Off
                              </Button>
                            )}
                            {seedling.status === "hardening" && (
                              <Button
                                onClick={() =>
                                  handleUpdateSeedlingStatus(
                                    seedling.id,
                                    "ready",
                                  )
                                }
                                className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                Ready to Plant
                              </Button>
                            )}
                            {seedling.status === "ready" && (
                              <Button
                                onClick={() => handlePlantFromBatch(seedling)}
                                className="flex-1 h-8 bg-primary hover:bg-primary/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-primary/20"
                              >
                                Use Batch
                              </Button>
                            )}
                            {/* Delete always visible */}
                            <Button
                              variant="ghost"
                              onClick={() => handleRemoveSeedling(seedling.id)}
                              className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
                              title="Remove seedling batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          {/* Sow More – only show if the plant has seeds available */}
                          {(() => {
                            const sourcePlant = AVAILABLE_PLANTS.find(
                              (p) => p.id === seedling.plant.id && p.isSeed,
                            );
                            if (!sourcePlant) return null;
                            const canSow =
                              sourcePlant.amount === undefined ||
                              sourcePlant.amount > 0;
                            if (!canSow) return null;
                            const amountLabel =
                              sourcePlant.amount === undefined
                                ? "∞"
                                : sourcePlant.amount;
                            return (
                              <button
                                onClick={() => handleOpenSowModal(sourcePlant)}
                                className="w-full h-7 rounded-lg border border-blue-200 bg-blue-50/60 text-blue-600 hover:bg-blue-100 text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                              >
                                🌱 Sow More ({amountLabel} seeds left)
                              </button>
                            );
                          })()}
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
                <div className="max-w-lg space-y-8">
                  {/* ── Location & Weather ─────────────────────────────── */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                        Location &amp; Weather
                      </h3>
                    </div>

                    {/* Location with verify */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        Location
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            className={`w-full bg-white/50 border rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner pr-9 ${
                              locationStatus === "valid"
                                ? "border-green-400/60"
                                : locationStatus === "invalid"
                                  ? "border-red-400/60"
                                  : "border-border/40"
                            }`}
                            value={locationDraft}
                            onChange={(e) => {
                              setLocationDraft(e.target.value);
                              setLocationStatus("idle");
                              setLocationError("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleVerifyLocation();
                            }}
                            placeholder="e.g. London, UK"
                          />
                          {locationStatus === "valid" && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none" />
                          )}
                          {locationStatus === "invalid" && (
                            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />
                          )}
                        </div>
                        <button
                          disabled={
                            locationStatus === "checking" ||
                            !locationDraft.trim()
                          }
                          onClick={handleVerifyLocation}
                          className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {locationStatus === "checking" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </button>
                      </div>
                      {locationStatus === "invalid" && locationError && (
                        <p className="text-[11px] text-red-500 ml-1">
                          {locationError}
                        </p>
                      )}
                      {locationStatus === "valid" && settings.lat != null && (
                        <p className="text-[11px] text-green-600 ml-1">
                          Verified · {settings.lat.toFixed(4)}°,{" "}
                          {settings.lng?.toFixed(4)}° · Climate zone auto-set to{" "}
                          <strong>{settings.growthZone}</strong>
                        </p>
                      )}
                    </div>

                    {/* Climate Zone — auto-derived but still overridable */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        Köppen–Geiger Climate Zone
                        <span className="ml-2 normal-case font-medium text-muted-foreground/70">
                          (auto-derived from location, or set manually)
                        </span>
                      </label>
                      <select
                        className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner appearance-none"
                        value={settings.growthZone}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            growthZone: e.target.value,
                          })
                        }
                      >
                        <optgroup label="A — Tropical">
                          <option value="Af">Af — Tropical Rainforest</option>
                          <option value="Am">Am — Tropical Monsoon</option>
                          <option value="Aw">Aw/As — Tropical Savanna</option>
                        </optgroup>
                        <optgroup label="B — Arid">
                          <option value="BWh">BWh — Hot Desert</option>
                          <option value="BWk">BWk — Cold Desert</option>
                          <option value="BSh">BSh — Hot Steppe</option>
                          <option value="BSk">BSk — Cold Steppe</option>
                        </optgroup>
                        <optgroup label="C — Temperate">
                          <option value="Csa">
                            Csa — Mediterranean (Hot Summer)
                          </option>
                          <option value="Csb">
                            Csb — Mediterranean (Warm Summer)
                          </option>
                          <option value="Csc">
                            Csc — Mediterranean (Cool Summer)
                          </option>
                          <option value="Cwa">
                            Cwa — Humid Subtropical (Dry Winter)
                          </option>
                          <option value="Cwb">
                            Cwb — Subtropical Highland (Dry Winter)
                          </option>
                          <option value="Cfa">Cfa — Humid Subtropical</option>
                          <option value="Cfb">Cfb — Temperate Oceanic</option>
                          <option value="Cfc">Cfc — Subpolar Oceanic</option>
                        </optgroup>
                        <optgroup label="D — Continental">
                          <option value="Dsa">
                            Dsa — Hot-Summer Mediterranean Continental
                          </option>
                          <option value="Dsb">
                            Dsb — Warm-Summer Mediterranean Continental
                          </option>
                          <option value="Dwa">
                            Dwa — Monsoon-Influenced Hot-Summer Continental
                          </option>
                          <option value="Dwb">
                            Dwb — Monsoon-Influenced Warm-Summer Continental
                          </option>
                          <option value="Dwc">
                            Dwc — Monsoon-Influenced Subarctic
                          </option>
                          <option value="Dfa">
                            Dfa — Continental (Hot Summer)
                          </option>
                          <option value="Dfb">
                            Dfb — Continental (Warm Summer)
                          </option>
                          <option value="Dfc">Dfc — Subarctic</option>
                          <option value="Dfd">
                            Dfd — Subarctic (Extreme Winter)
                          </option>
                        </optgroup>
                        <optgroup label="E — Polar">
                          <option value="ET">ET — Tundra</option>
                          <option value="EF">EF — Ice Cap</option>
                        </optgroup>
                      </select>
                    </div>

                    {/* End Location & Weather section */}
                  </section>

                  {/* ── AI Integration (OpenRouter) ───────────────────── */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Thermometer className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                        AI Integration
                      </h3>
                      {orStatus === "valid" && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Enabled
                        </span>
                      )}
                    </div>

                    {/* OpenRouter API key */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        OpenRouter API Key
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showOrKey ? "text" : "password"}
                            className={`w-full bg-white/50 border rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner pr-10 font-mono ${
                              orStatus === "valid"
                                ? "border-green-400/60"
                                : orStatus === "invalid"
                                  ? "border-red-400/60"
                                  : "border-border/40"
                            }`}
                            value={orKeyDraft}
                            onChange={(e) => {
                              setOrKeyDraft(e.target.value);
                              setOrStatus("idle");
                              setOrError("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleValidateOpenRouter();
                            }}
                            placeholder={
                              orStatus === "valid" && !orKeyDraft.trim()
                                ? "API key stored — enter a new key to replace"
                                : "sk-or-…"
                            }
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOrKey((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showOrKey ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          {orStatus === "valid" && (
                            <CheckCircle2 className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none" />
                          )}
                          {orStatus === "invalid" && (
                            <AlertCircle className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />
                          )}
                        </div>
                        <button
                          disabled={
                            orStatus === "checking" || !orKeyDraft.trim()
                          }
                          onClick={handleValidateOpenRouter}
                          className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {orStatus === "checking" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Validate"
                          )}
                        </button>
                      </div>
                      {orStatus === "invalid" && orError && (
                        <p className="text-[11px] text-red-500 ml-1">
                          {orError}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground ml-1">
                        Required for AI plant lookup and suggestions. The key is
                        stored server-side and never used directly from the
                        browser.{" "}
                        <a
                          href="https://openrouter.ai/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          Get a free key at openrouter.ai
                        </a>
                      </p>
                    </div>

                    {/* Model */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        Model
                      </label>
                      <input
                        className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner font-mono"
                        value={settings.aiModel}
                        onChange={(e) =>
                          setSettings({ ...settings, aiModel: e.target.value })
                        }
                        placeholder="google/gemini-2.0-flash"
                      />
                      <p className="text-[11px] text-muted-foreground ml-1">
                        Any model available on your OpenRouter account. Default:{" "}
                        <code className="font-mono">
                          google/gemini-2.0-flash
                        </code>
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Events sidebar - Floating style */}
        <div className="w-72 h-full flex flex-col drop-shadow-xl">
          <EventsBar
            events={events}
            suggestions={
              suggestions as unknown as import("./components/EventsBar").Suggestion[]
            }
            harvestAlerts={harvestAlerts}
            onCompleteSuggestion={handleCompleteSuggestion}
            suggestionsMode={suggestionsMode}
            suggestionsLoading={suggestionsLoading}
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
            seedlingCount={seedlings.length}
            onShowSeedlings={() => setActiveTab("seedlings")}
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
        settings={settings}
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
