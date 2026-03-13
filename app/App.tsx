import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n, { supportedLocales, LOCALE_LABELS, type SupportedLocale } from "./i18n/config";
import { PlanterGrid, PlantInstance } from "./components/PlanterGrid";
import {
  EventsBar,
  type Suggestion as SidebarSuggestion,
} from "./components/EventsBar";
import {
  TreatmentOptionsDialog,
  type TreatmentSuggestionTarget,
} from "./components/TreatmentOptionsDialog";
import { ToolBar } from "./components/ToolBar";
import { PlanterDialog } from "./components/PlanterDialog";
import { PlantDialog } from "./components/PlantDefinitionDialog";
import { SowSeedsDialog } from "./components/SowSeedsDialog";
import { AddSeedlingDialog } from "./components/AddSeedlingDialog";
import { CalendarView } from "./components/CalendarView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import {
  Calendar as CalendarIcon,
  Map as MapIcon,
  Leaf,
  Sparkles,
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
  Bell,
} from "lucide-react";
import { Sheet, SheetContent } from "./components/ui/sheet";
import { useGardenData } from "./hooks/useGardenData";
import { useLocationSettings } from "./hooks/useLocationSettings";
import { useOpenRouterSettings } from "./hooks/useOpenRouterSettings";
import { useAreaManager } from "./hooks/useAreaManager";
import { usePlantCatalog } from "./hooks/usePlantCatalog";
import { useSeedlingManager } from "./hooks/useSeedlingManager";
import { useGardenEvents } from "./hooks/useGardenEvents";
import { useSuggestions } from "./hooks/useSuggestions";
import { useGlobalAsyncErrorToasts } from "./hooks/useGlobalAsyncErrorToasts";
import type { PestEvent } from "./data/schema";

export default function App() {
  useGlobalAsyncErrorToasts();
  const { t } = useTranslation();

  const [eventsSheetOpen, setEventsSheetOpen] = useState(false);

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

  // ── i18n locale sync ─────────────────────────────────────────────────────
  useEffect(() => {
    if (settings.locale && i18n.language !== settings.locale) {
      i18n.changeLanguage(settings.locale);
      document.documentElement.lang = settings.locale;
    }
  }, [settings.locale]);

  // ── UI-only state kept in App as orchestration layer ──────────────────────
  const [activeTab, setActiveTab] = useState("areas");
  const [selectedPlant, setSelectedPlant] = useState<
    PlantInstance["plant"] | null
  >(null);
  const [treatmentDialogOpen, setTreatmentDialogOpen] = useState(false);
  const [treatmentTarget, setTreatmentTarget] =
    useState<TreatmentSuggestionTarget | null>(null);

  // ── View mode — derived from settings and persisted to Dexie ──────────────
  const isEditMode = settings.isEditMode ?? false;
  const setIsEditMode = (value: boolean | ((prev: boolean) => boolean)) => {
    setSettings((prev) => ({
      ...prev,
      isEditMode: typeof value === "function" ? value(prev.isEditMode ?? false) : value,
    }));
  };

  // Track the last interacted area/planter so we can restore scroll position
  const setLastSelected = (areaId: string, planterId?: string) => {
    setSettings((prev) => ({
      ...prev,
      lastSelectedAreaId: areaId,
      lastSelectedPlanterId: planterId ?? prev.lastSelectedPlanterId,
    }));
  };

  // ── Settings sub-hooks ────────────────────────────────────────────────────
  const {
    locationDraft,
    setLocationDraft,
    locationStatus,
    setLocationStatus,
    locationError,
    setLocationError,
    handleVerifyLocation,
  } = useLocationSettings(settings, setSettings, repositoryRef);

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
  } = useOpenRouterSettings(settings, setSettings, repositoryRef);

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

  // Scroll to last-selected area when the DB finishes loading.
  // We fire the effect when `settings.lastSelectedAreaId` changes (which happens
  // when data loads from DB). We check hasLoadedFromDB.current inside to guard
  // against firing before persistence is ready, and a one-shot ref to avoid
  // scrolling again when the user navigates back to the Areas tab.
  const scrolledToLastSelected = useRef(false);
  useEffect(() => {
    if (!hasLoadedFromDB.current || scrolledToLastSelected.current) return;
    const areaId = settings.lastSelectedAreaId;
    if (!areaId) return;
    scrolledToLastSelected.current = true;
    // Brief timeout lets the DOM paint before scrolling
    setTimeout(() => {
      const el = document.getElementById(`area-${areaId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, [settings.lastSelectedAreaId]); // hasLoadedFromDB is a ref; check its .current inside

  const getLatestTreatmentContext = (pestEvents: PestEvent[]) => {
    const sorted = [...pestEvents].sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime(),
    );

    const latestPest = sorted.find((event) => event.type === "pest");
    const latestTreatment = sorted.find((event) => event.type === "treatment");

    return { latestPest, latestTreatment };
  };

  const resolveTreatmentTarget = (
    suggestion: SidebarSuggestion,
  ): TreatmentSuggestionTarget | null => {
    for (const area of areas) {
      for (const planter of area.planters) {
        if (suggestion.planterId && planter.id !== suggestion.planterId)
          continue;

        for (const row of planter.squares ?? []) {
          for (const square of row) {
            const plantInstance = square.plantInstance;
            if (!plantInstance) continue;

            const matchesInstance = suggestion.instanceId
              ? plantInstance.instanceId === suggestion.instanceId
              : suggestion.plant
                ? plantInstance.plant.id === suggestion.plant.id
                : false;

            if (!matchesInstance) continue;

            const { latestPest, latestTreatment } = getLatestTreatmentContext(
              plantInstance.pestEvents ?? [],
            );

            if (!latestPest) continue;
            if (
              latestTreatment &&
              new Date(latestTreatment.date).getTime() >=
                new Date(latestPest.date).getTime()
            ) {
              continue;
            }

            return {
              suggestion,
              plantInstance,
              planterId: planter.id,
              planterName: planter.name,
              areaName: area.name,
              latestPest,
              latestTreatment,
            };
          }
        }
      }
    }

    return null;
  };

  const handleOpenTreatmentSuggestion = (suggestion: SidebarSuggestion) => {
    const resolvedTarget = resolveTreatmentTarget(suggestion);
    if (!resolvedTarget) return;
    setTreatmentTarget(resolvedTarget);
    setTreatmentDialogOpen(true);
  };

  const handleApplyTreatment = (note: string) => {
    if (!treatmentTarget) return;

    const trimmedNote = note.trim();
    if (!trimmedNote) return;

    const newTreatmentEvent: PestEvent = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: "treatment",
      description: trimmedNote,
    };

    let previousPlantInstance: PlantInstance | null = null;
    let updatedPlantInstance: PlantInstance | null = null;

    const nextAreas = areas.map((area) => ({
      ...area,
      planters: area.planters.map((planter) => {
        if (planter.id !== treatmentTarget.planterId) return planter;

        return {
          ...planter,
          squares: planter.squares?.map((row) =>
            row.map((square) => {
              if (
                square.plantInstance?.instanceId !==
                treatmentTarget.plantInstance.instanceId
              ) {
                return square;
              }

              previousPlantInstance = square.plantInstance;
              updatedPlantInstance = {
                ...square.plantInstance,
                pestEvents: [
                  ...(square.plantInstance.pestEvents ?? []),
                  newTreatmentEvent,
                ],
              };

              return {
                ...square,
                plantInstance: updatedPlantInstance,
              };
            }),
          ),
        };
      }),
    }));

    setAreas(nextAreas);

    if (updatedPlantInstance && previousPlantInstance) {
      handlePlantUpdated(
        updatedPlantInstance,
        previousPlantInstance,
        treatmentTarget.planterId,
      );
    }

    setTreatmentDialogOpen(false);
    setTreatmentTarget(null);
  };

  return (
    <div className="size-full flex flex-col bg-background relative overflow-hidden">
      {dbError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 text-sm font-semibold flex items-center gap-2">
          <span>{t("dbError")}</span>
          <span className="font-mono font-normal">{dbError}</span>
        </div>
      )}
      <div
        className={`fixed bottom-24 right-3 md:bottom-4 md:right-4 z-50 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transition-[opacity,transform] duration-500 ${
          savedIndicator
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50 animate-pulse" />
        {t("common.saved")}
      </div>
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden p-2 sm:p-4 gap-2 sm:gap-4 relative z-10">
        <div className="flex-1 flex flex-col gap-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full h-auto flex-wrap justify-start bg-muted border border-border">
              <TabsTrigger value="areas">
                <MapIcon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("tabs.areas")}</span>
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarIcon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("tabs.calendar")}</span>
              </TabsTrigger>
              <TabsTrigger value="plants">
                <Leaf className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("tabs.plants")}</span>
              </TabsTrigger>
              <TabsTrigger value="seedlings">
                <Sprout className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("tabs.seedlings")}</span>
              </TabsTrigger>
              <TabsTrigger value="settings">
                <SettingsIcon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("tabs.settings")}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="areas"
              className="flex-1 mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200"
            >
              <div className="flex-1 overflow-auto bg-card rounded-2xl border border-border/60 shadow-sm p-4 custom-scrollbar h-[calc(100dvh-13rem)] md:h-[calc(100dvh-12rem)]">
                <div className="mb-4 px-1 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-black text-foreground tracking-tight uppercase">
                      {t("areas.title")}
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-[10px] uppercase font-bold tracking-wider opacity-60">
                      {t("areas.subtitle")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditMode((prev) => !prev)}
                      className={`h-8 px-3 rounded-lg border flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-[color,background-color,border-color] ${
                        isEditMode
                          ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                          : "bg-white/60 border-border/40 text-muted-foreground hover:bg-white/90 hover:text-foreground"
                      }`}
                    >
                      {isEditMode ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> {t("areas.doneEditing")}
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> {t("areas.editLayout")}
                        </>
                      )}
                    </button>
                    {isEditMode && (
                      <Button
                        onClick={handleAddArea}
                        className="bg-primary hover:bg-primary/90 h-8 rounded-lg px-3 shadow-md shadow-primary/20 text-xs font-bold uppercase tracking-wider"
                      >
                        <Plus className="w-4 h-4 mr-1.5" /> {t("areas.newArea")}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  {areas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground/50 w-full mt-12 py-12 border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5">
                      <div className="bg-primary/10 p-4 rounded-full mb-3">
                        <MapIcon className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-lg font-bold text-foreground">
                        {t("areas.emptyTitle")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                        {t("areas.emptyHint")}
                      </p>
                    </div>
                  ) : (
                    areas.map((area, areaIdx) => (
                      <div
                        key={area.id}
                        id={`area-${area.id}`}
                        className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
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
                                  className="bg-transparent text-lg font-black text-foreground border-none focus:outline-none focus:ring-1 focus:ring-primary/20 rounded px-1 -ml-1 transition-shadow"
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
                                  className="bg-transparent text-xs font-bold uppercase tracking-widest text-muted-foreground block border-none focus:outline-none focus:ring-1 focus:ring-primary/20 rounded px-1 -ml-1 mt-0"
                                  value={area.tagline}
                                  onChange={(e) =>
                                    handleUpdateArea(area.id, {
                                      tagline: e.target.value,
                                    })
                                  }
                                />
                              ) : (
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block px-1">
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
                                aria-label={t("areas.moveAreaUpAriaLabel")}
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
                                aria-label={t("areas.moveAreaDownAriaLabel")}
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
                                aria-label={t("areas.removeAreaAriaLabel")}
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
                                    setLastSelected(area.id, planterId);
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
                              className={`w-40 h-40 flex flex-col items-center justify-center border-4 border-dashed border-border rounded-3xl text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-[color,background-color,border-color] group ${
                                !isEditMode ? "hidden" : ""
                              }`}
                            >
                              <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-bold uppercase tracking-widest">
                                {t("areas.newPlanter")}
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

            <TabsContent value="calendar" className="flex-1 mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200">
              <CalendarView
                areas={areas as unknown as import("./data/schema").Area[]}
                events={events as unknown as import("./data/schema").GardenEvent[]}
                suggestions={
                  suggestions as unknown as import("./data/schema").Suggestion[]
                }
                settings={settings}
                suggestionsMode={suggestionsMode}
                suggestionsLoading={suggestionsLoading}
                onAddEvent={(partialEvent) => {
                  const newEvent = {
                    ...partialEvent,
                    id: crypto.randomUUID(),
                  };
                  // EventsBar uses its own GardenEvent interface (subset of schema);
                  // the schema type is a superset so this cast is safe.
                  setEvents((prev) => [
                    ...prev,
                    newEvent as (typeof prev)[number],
                  ]);
                  void repositoryRef.current.saveEvent(
                    newEvent as unknown as import("./data/schema").GardenEvent,
                  );
                }}
              />
            </TabsContent>

            <TabsContent
              value="plants"
              className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200"
            >
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-[calc(100dvh-13rem)] md:h-[calc(100dvh-12rem)] overflow-auto">
                <div className="mb-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">
                        {t("plants.title")}
                      </h2>
                      <p className="text-muted-foreground text-[11px] font-medium mt-1 uppercase tracking-wider opacity-60">
                        {t("plants.subtitle")}
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
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("plants.addSeeds")}
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingPlant(null);
                          setDialogDefaultIsSeed(false);
                          setShowAddPlantModal(true);
                        }}
                        className="h-8 rounded-lg px-3 shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 text-xs font-bold uppercase tracking-wider"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("plants.addPlant")}
                      </Button>
                    </div>
                  </div>

                  {/* Search + filter row */}
                  <div className="flex items-center gap-3">
                    <input
                      type="search"
                      placeholder={t("plants.searchPlaceholder")}
                      value={plantsSearch}
                      onChange={(e) => setPlantsSearch(e.target.value)}
                      className="h-8 flex-1 max-w-xs bg-white/60 border border-border/40 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                    />
                    <div className="flex gap-0.5 bg-muted/30 rounded-lg p-0.5">
                      {(
                        [
                          { key: "all", label: t("plants.tabAll", { count: plantTabCounts.all }) },
                          {
                            key: "plants",
                            label: t("plants.tabPlants", { count: plantTabCounts.plants }),
                          },
                          {
                            key: "seeds",
                            label: t("plants.tabSeeds", { count: plantTabCounts.seeds }),
                          },
                        ] as {
                          key: "all" | "plants" | "seeds";
                          label: string;
                        }[]
                      ).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setPlantsFilter(key)}
                          className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-[color,background-color] ${
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

                {/* Plants — featured: sow this month / compact list for the rest */}
                {(() => {
                  const inSeasonPlants = filteredAvailablePlants.filter(
                    (p) =>
                      p.sowIndoorMonths?.includes(currentMonth) ||
                      p.sowDirectMonths?.includes(currentMonth),
                  );
                  const inSeasonIds = new Set(
                    inSeasonPlants.map((p) => p.id),
                  );
                  const hasInSeason = inSeasonPlants.length > 0;
                  const listPlants = hasInSeason
                    ? filteredAvailablePlants.filter(
                        (p) => !inSeasonIds.has(p.id),
                      )
                    : filteredAvailablePlants;
                  if (filteredAvailablePlants.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                        <p className="text-sm font-bold uppercase tracking-wider">
                          {t("plants.nothingFound")}
                        </p>
                        <p className="text-xs mt-1">
                          {t("plants.nothingFoundHint")}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-6">
                      {/* Featured: Sow This Month */}
                      {hasInSeason && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                              {t("plants.sowThisMonth")}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {inSeasonPlants.map((plant) => {
                              const isCustom = customPlants.some(
                                (p) => p.id === plant.id,
                              );
                              const availableStock = getAvailableStock(
                                plant.id,
                              );
                              const isDepleted =
                                plant.isSeed && availableStock === 0;
                              return (
                                <div
                                  key={plant.id}
                                  className={`group relative flex gap-4 items-start p-4 rounded-xl border transition-[border-color] ${
                                    isDepleted
                                      ? "border-red-200 bg-red-50/20 grayscale-[0.3]"
                                      : "border-primary/20 bg-primary/5 hover:border-primary/40"
                                  }`}
                                >
                                  <div
                                    className={`w-14 h-14 flex items-center justify-center text-4xl ${
                                      plant.isSeed ? "bg-blue-50" : "bg-white"
                                    } rounded-xl shadow-sm border border-primary/10 shrink-0 group-hover:scale-105 transition-transform duration-300`}
                                  >
                                    {plant.icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-sm text-foreground leading-tight">
                                      {plant.name}
                                      {plant.variety && (
                                        <span className="ml-1.5 text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-widest align-middle">
                                          {plant.variety}
                                        </span>
                                      )}
                                    </h3>
                                    <div className="flex gap-1 mt-1.5 flex-wrap">
                                      {plant.sowIndoorMonths?.includes(
                                        currentMonth,
                                      ) && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-primary text-white uppercase tracking-widest">
                                          {t("plants.indoorsNow")}
                                        </span>
                                      )}
                                      {plant.sowDirectMonths?.includes(
                                        currentMonth,
                                      ) && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-700 text-white uppercase tracking-widest">
                                          {t("plants.directNow")}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex gap-3 mt-2 flex-wrap">
                                      <span className="text-[10px] font-bold text-muted-foreground">
                                        {t("common.daysToHarvest", { count: plant.daysToHarvest ?? 60 })}
                                      </span>
                                      {plant.spacingCm && (
                                        <span className="text-[10px] font-bold text-muted-foreground">
                                          {t("common.spacingCm", { count: plant.spacingCm })}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2">
                                      <span
                                        className={`text-[10px] font-black uppercase tracking-wider ${
                                          isDepleted
                                            ? "text-red-500"
                                            : "text-foreground/50"
                                        }`}
                                      >
                                        {plant.amount === undefined
                                          ? t("common.infiniteUnlimited")
                                          : `${availableStock} ${plant.isSeed ? t("common.seeds") : t("common.qty")}`}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1.5 shrink-0">
                                    {plant.isSeed && !isDepleted && (
                                      <button
                                        onClick={() =>
                                          handleOpenSowModal(plant)
                                        }
                                        className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
                                        aria-label={t("plants.sowSeedsAriaLabel", { name: plant.name })}
                                      >
                                        <Sprout className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {isCustom ? (
                                      <>
                                        <button
                                          onClick={() =>
                                            handleEditPlantManually(plant)
                                          }
                                          className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
                                          aria-label={t("plants.editAriaLabel", { name: plant.name })}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleRemovePlantManually(plant.id)
                                          }
                                          className="p-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-md transition-colors"
                                          aria-label={t("plants.deleteAriaLabel", { name: plant.name })}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        disabled
                                        aria-label={t("plants.bundledCannotEdit")}
                                        className="p-1.5 bg-muted/50 text-muted-foreground rounded-md cursor-not-allowed opacity-30"
                                      >
                                        <SettingsIcon className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Compact list: remaining plants */}
                      {listPlants.length > 0 && (
                        <div>
                          {hasInSeason && (
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-2 px-1">
                              All Plants &amp; Seeds
                            </p>
                          )}
                          <div className="space-y-0.5">
                            {listPlants.map((plant) => {
                              const isCustom = customPlants.some(
                                (p) => p.id === plant.id,
                              );
                              const availableStock = getAvailableStock(
                                plant.id,
                              );
                              const isDepleted =
                                plant.isSeed && availableStock === 0;
                              return (
                                <div
                                  key={plant.id}
                                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-[background-color,opacity] ${
                                    isDepleted
                                      ? "opacity-50"
                                      : "hover:bg-muted/30"
                                  }`}
                                >
                                  <div
                                    className={`w-8 h-8 flex items-center justify-center text-xl ${
                                      plant.isSeed
                                        ? "bg-blue-50"
                                        : "bg-emerald-50"
                                    } rounded-lg shrink-0`}
                                  >
                                    {plant.icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-bold text-sm text-foreground truncate block leading-tight">
                                      {plant.name}
                                    </span>
                                    {plant.variety && (
                                      <span className="text-[9px] font-black text-primary/70 uppercase tracking-wider">
                                        {plant.variety}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {plant.isSeed && (
                                      <span
                                        className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                                          isDepleted
                                            ? "bg-red-600 text-white"
                                            : "bg-blue-100 text-blue-700"
                                        }`}
                                      >
                                        {isDepleted ? t("plants.emptyBadge") : t("plants.seedBadge")}
                                      </span>
                                    )}
                                    {plant.frostHardy === true && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                                        ❄
                                      </span>
                                    )}
                                    {plant.frostHardy === false && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">
                                        ⚡
                                      </span>
                                    )}
                                    <span className="text-[9px] font-bold text-muted-foreground/40 tabular-nums">
                                      {plant.daysToHarvest ?? 60}d
                                    </span>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                    {plant.isSeed && !isDepleted && (
                                      <button
                                        onClick={() =>
                                          handleOpenSowModal(plant)
                                        }
                                        className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-md transition-colors"
                                        aria-label={t("plants.sowSeedsAriaLabel", { name: plant.name })}
                                      >
                                        <Sprout className="w-3 h-3" />
                                      </button>
                                    )}
                                    {isCustom ? (
                                      <>
                                        <button
                                          onClick={() =>
                                            handleEditPlantManually(plant)
                                          }
                                          className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
                                          aria-label={t("plants.editAriaLabel", { name: plant.name })}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleRemovePlantManually(plant.id)
                                          }
                                          className="p-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-md transition-colors"
                                          aria-label={t("plants.deleteAriaLabel", { name: plant.name })}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        disabled
                                        aria-label={t("plants.bundledCannotEdit")}
                                        className="p-1.5 bg-muted/50 text-muted-foreground rounded-md cursor-not-allowed opacity-30"
                                      >
                                        <SettingsIcon className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent
              value="seedlings"
              className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200"
            >
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-[calc(100dvh-13rem)] md:h-[calc(100dvh-12rem)] overflow-auto">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">
                      {t("seedlings.title")}
                    </h2>
                    <p className="text-muted-foreground text-[11px] font-medium mt-1 uppercase tracking-wider opacity-60">
                      {t("seedlings.subtitle")}
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowAddSeedlingModal(true)}
                    className="h-8 rounded-lg px-3 shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 text-xs font-bold uppercase tracking-wider"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("seedlings.addSeedling")}
                  </Button>
                </div>
                {seedlings.length === 0 ? (
                  <div className="text-center py-12 bg-emerald-50/40 rounded-2xl border-2 border-dashed border-emerald-200/50">
                    <Sprout className="mx-auto w-10 h-10 text-emerald-400/60 mb-3" />
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                      {t("seedlings.emptyTitle")}
                    </p>
                    <p className="text-muted-foreground/60 text-[10px] mt-1 normal-case font-medium">
                      {t("seedlings.emptyHint")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(
                      [
                        {
                          status: "ready" as const,
                          label: t("seedlings.statusLabels.ready"),
                          dotColor: "bg-primary",
                          borderColor: "border-l-primary",
                          featured: true,
                        },
                        {
                          status: "hardening" as const,
                          label: t("seedlings.statusLabels.hardening"),
                          dotColor: "bg-orange-500",
                          borderColor: "border-l-orange-400",
                          featured: false,
                        },
                        {
                          status: "growing" as const,
                          label: t("seedlings.statusLabels.growing"),
                          dotColor: "bg-blue-500",
                          borderColor: "border-l-blue-400",
                          featured: false,
                        },
                        {
                          status: "germinating" as const,
                          label: t("seedlings.statusLabels.germinating"),
                          dotColor: "bg-amber-500",
                          borderColor: "border-l-amber-400",
                          featured: false,
                        },
                      ] as Array<{
                        status:
                          | "ready"
                          | "hardening"
                          | "growing"
                          | "germinating";
                        label: string;
                        dotColor: string;
                        borderColor: string;
                        featured: boolean;
                      }>
                    ).map(
                      ({ status, label, dotColor, borderColor, featured }) => {
                        const group = seedlings.filter(
                          (s) => s.status === status,
                        );
                        if (group.length === 0) return null;
                        return (
                          <div key={status}>
                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${dotColor} inline-block`}
                              />
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                {label} · {group.length}
                              </p>
                            </div>
                            {featured ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {group.map((seedling) => {
                                  const daysOld = Math.floor(
                                    (Date.now() - new Date(seedling.plantedDate).getTime()) /
                                      (1000 * 60 * 60 * 24),
                                  );
                                  return (
                                  <div
                                    key={seedling.id}
                                    className="flex gap-4 items-start p-4 rounded-xl border border-primary/20 bg-primary/5 hover:border-primary/40 transition-[border-color]"
                                  >
                                    <div className="w-14 h-14 flex items-center justify-center text-4xl bg-white rounded-xl shadow-sm border border-primary/10 shrink-0">
                                      {seedling.plant.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-black text-sm text-foreground">
                                        {seedling.plant.name}
                                      </h3>
                                      <div className="flex gap-3 mt-1">
                                        <span className="text-[10px] font-bold text-muted-foreground">
                                          {t("seedlings.daysOld", { count: daysOld })}
                                        </span>
                                        <span className="text-[10px] font-bold text-muted-foreground">
                                          {t("seedlings.batchCount", { count: seedling.seedCount })}
                                        </span>
                                      </div>
                                      <div className="flex gap-2 mt-3">
                                        <Button
                                          onClick={() =>
                                            handlePlantFromBatch(seedling)
                                          }
                                          className="flex-1 h-7 bg-primary hover:bg-primary/90 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm shadow-primary/20"
                                        >
                                          {t("seedlings.useBatch")}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          onClick={() =>
                                            handleRemoveSeedling(seedling.id)
                                          }
                                          className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
                                          aria-label={t("seedlings.removeSeedlingAriaLabel")}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {group.map((seedling) => {
                                  const daysOld = Math.floor(
                                    (Date.now() -
                                      new Date(
                                        seedling.plantedDate,
                                      ).getTime()) /
                                      (1000 * 60 * 60 * 24),
                                  );
                                  return (
                                    <div
                                      key={seedling.id}
                                      className={`group flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-lg border-l-2 ${borderColor} bg-muted/10 hover:bg-muted/20 transition-[background-color]`}
                                    >
                                      <div className="text-xl w-8 h-8 flex items-center justify-center shrink-0">
                                        {seedling.plant.icon}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="font-bold text-sm text-foreground truncate block">
                                          {seedling.plant.name}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground/60 font-medium">
                                          {daysOld}d · {seedling.seedCount}× ·{" "}
                                          {seedling.location}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                        {status === "germinating" && (
                                          <Button
                                            onClick={() =>
                                              handleUpdateSeedlingStatus(
                                                seedling.id,
                                                "growing",
                                              )
                                            }
                                            className="h-7 px-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 shadow-none"
                                          >
                                            {t("seedlings.sprouted")}
                                          </Button>
                                        )}
                                        {status === "growing" && (
                                          <Button
                                            onClick={() =>
                                              handleUpdateSeedlingStatus(
                                                seedling.id,
                                                "hardening",
                                              )
                                            }
                                            className="h-7 px-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 shadow-none"
                                          >
                                            {t("seedlings.hardenOff")}
                                          </Button>
                                        )}
                                        {status === "hardening" && (
                                          <Button
                                            onClick={() =>
                                              handleUpdateSeedlingStatus(
                                                seedling.id,
                                                "ready",
                                              )
                                            }
                                            className="h-7 px-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-none"
                                          >
                                            {t("seedlings.markReady")}
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          onClick={() =>
                                            handleRemoveSeedling(seedling.id)
                                          }
                                          className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
                                          aria-label={t("seedlings.removeSeedlingAriaLabel")}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="settings"
              className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200"
            >
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-[calc(100dvh-13rem)] md:h-[calc(100dvh-12rem)] overflow-auto">
                <h2 className="text-2xl font-black text-foreground tracking-tight uppercase mb-6 leading-none">
                  {t("settings.title")}
                </h2>
                <div className="max-w-lg space-y-8">
                  {/* ── Location & Weather ─────────────────────────────── */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                        {t("settings.locationWeather")}
                      </h3>
                    </div>

                    {/* Location with verify */}
                    <div className="space-y-1.5">
                      <label htmlFor="settings-location" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {t("settings.location")}
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            id="settings-location"
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
                            placeholder={t("settings.locationPlaceholder")}
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
                            t("common.verify")
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
                          {t("settings.locationVerified", {
                            lat: settings.lat.toFixed(4),
                            lng: settings.lng?.toFixed(4),
                            zone: settings.growthZone,
                          })}
                        </p>
                      )}
                    </div>

                    {/* Climate Zone — auto-derived but still overridable */}
                    <div className="space-y-1.5">
                      <label htmlFor="settings-growth-zone" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {t("settings.koppenZone")}
                        <span className="ml-2 normal-case font-medium text-muted-foreground/70">
                          {t("settings.koppenZoneNote")}
                        </span>
                      </label>
                      <select
                        id="settings-growth-zone"
                        className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner appearance-none"
                        value={settings.growthZone}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            growthZone: e.target.value,
                          }))
                        }
                      >
                        <optgroup label={t("settings.climateZones.groupTropical")}>
                          <option value="Af">{t("settings.climateZones.Af")}</option>
                          <option value="Am">{t("settings.climateZones.Am")}</option>
                          <option value="Aw">{t("settings.climateZones.Aw")}</option>
                        </optgroup>
                        <optgroup label={t("settings.climateZones.groupArid")}>
                          <option value="BWh">{t("settings.climateZones.BWh")}</option>
                          <option value="BWk">{t("settings.climateZones.BWk")}</option>
                          <option value="BSh">{t("settings.climateZones.BSh")}</option>
                          <option value="BSk">{t("settings.climateZones.BSk")}</option>
                        </optgroup>
                        <optgroup label={t("settings.climateZones.groupTemperate")}>
                          <option value="Csa">{t("settings.climateZones.Csa")}</option>
                          <option value="Csb">{t("settings.climateZones.Csb")}</option>
                          <option value="Csc">{t("settings.climateZones.Csc")}</option>
                          <option value="Cwa">{t("settings.climateZones.Cwa")}</option>
                          <option value="Cwb">{t("settings.climateZones.Cwb")}</option>
                          <option value="Cfa">{t("settings.climateZones.Cfa")}</option>
                          <option value="Cfb">{t("settings.climateZones.Cfb")}</option>
                          <option value="Cfc">{t("settings.climateZones.Cfc")}</option>
                        </optgroup>
                        <optgroup label={t("settings.climateZones.groupContinental")}>
                          <option value="Dsa">{t("settings.climateZones.Dsa")}</option>
                          <option value="Dsb">{t("settings.climateZones.Dsb")}</option>
                          <option value="Dwa">{t("settings.climateZones.Dwa")}</option>
                          <option value="Dwb">{t("settings.climateZones.Dwb")}</option>
                          <option value="Dwc">{t("settings.climateZones.Dwc")}</option>
                          <option value="Dfa">{t("settings.climateZones.Dfa")}</option>
                          <option value="Dfb">{t("settings.climateZones.Dfb")}</option>
                          <option value="Dfc">{t("settings.climateZones.Dfc")}</option>
                          <option value="Dfd">{t("settings.climateZones.Dfd")}</option>
                        </optgroup>
                        <optgroup label={t("settings.climateZones.groupPolar")}>
                          <option value="ET">{t("settings.climateZones.ET")}</option>
                          <option value="EF">{t("settings.climateZones.EF")}</option>
                        </optgroup>
                      </select>
                    </div>

                    {/* End Location & Weather section */}
                  </section>

                  {/* ── AI Integration (OpenRouter) ───────────────────── */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                        {t("settings.aiIntegration")}
                      </h3>
                      {orStatus === "valid" && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> {t("common.enabled")}
                        </span>
                      )}
                    </div>

                    {/* OpenRouter API key */}
                    <div className="space-y-1.5">
                      <label htmlFor="settings-or-key" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {t("settings.openRouterKey")}
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            id="settings-or-key"
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
                              settings.aiProvider.type === "server" &&
                              !orKeyDraft.trim()
                                ? t("settings.keyStoredServerSide")
                                : t("settings.keyPlaceholder")
                            }
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOrKey((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showOrKey ? t("settings.hideApiKey") : t("settings.showApiKey")}
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
                            t("settings.validateAndSave")
                          )}
                        </button>
                      </div>
                      {orStatus === "invalid" && orError && (
                        <p className="text-[11px] text-red-500 ml-1">
                          {orError}
                        </p>
                      )}
                      {settings.aiProvider.type === "server" &&
                        settings.aiLastValidatedAt && (
                          <p className="text-[11px] text-green-700 ml-1">
                            {t("settings.lastValidated", {
                              date: new Date(
                                settings.aiLastValidatedAt,
                              ).toLocaleString(),
                            })}
                          </p>
                        )}
                      <p className="text-[11px] text-muted-foreground ml-1">
                        {t("settings.aiDescription")}{" "}
                        <a
                          href="https://openrouter.ai/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          {t("settings.getKeyAt")}
                        </a>
                      </p>
                    </div>

                    {/* Model */}
                    <div className="space-y-1.5">
                      <label htmlFor="settings-ai-model" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {t("settings.aiModel")}
                      </label>
                      <input
                        id="settings-ai-model"
                        className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner font-mono"
                        value={settings.aiModel}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            aiModel: e.target.value,
                          }))
                        }
                        placeholder={t("settings.aiModelDefault")}
                      />
                      <p className="text-[11px] text-muted-foreground ml-1">
                        {t("settings.aiModelHint")}
                      </p>
                    </div>
                  </section>
                  {/* ── Language ─────────────────────────────────────────────────────── */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                        {t("settings.language")}
                      </h3>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="settings-language" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {t("settings.language")}
                      </label>
                      <p className="text-[11px] text-muted-foreground/70 ml-1">{t("settings.languageHint")}</p>
                      <select
                        id="settings-language"
                        className="w-full bg-white/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner appearance-none"
                        value={settings.locale || "en"}
                        onChange={(e) => {
                          const locale = e.target.value as SupportedLocale;
                          i18n.changeLanguage(locale);
                          document.documentElement.lang = locale;
                          setSettings((prev) => ({ ...prev, locale }));
                          repositoryRef.current?.saveSettings({ ...settings, locale });
                        }}
                      >
                        {supportedLocales.map((locale) => (
                          <option key={locale} value={locale}>
                            {LOCALE_LABELS[locale]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </section>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Events sidebar - desktop only */}
        <div className="hidden md:flex w-72 h-full flex-col drop-shadow-xl">
          <EventsBar
            events={events}
            suggestions={
              suggestions as unknown as import("./components/EventsBar").Suggestion[]
            }
            harvestAlerts={harvestAlerts}
            onCompleteSuggestion={handleCompleteSuggestion}
            onOpenTreatmentSuggestion={handleOpenTreatmentSuggestion}
            suggestionsMode={suggestionsMode}
            suggestionsLoading={suggestionsLoading}
          />
        </div>
      </div>

      {/* Mobile events sheet */}
      <Sheet open={eventsSheetOpen} onOpenChange={setEventsSheetOpen}>
        <SheetContent
          side="right"
          className="md:hidden w-full max-w-sm p-0 flex flex-col"
        >
          <EventsBar
            events={events}
            suggestions={
              suggestions as unknown as import("./components/EventsBar").Suggestion[]
            }
            harvestAlerts={harvestAlerts}
            onCompleteSuggestion={(s) => {
              handleCompleteSuggestion(s);
              setEventsSheetOpen(false);
            }}
            onOpenTreatmentSuggestion={(s) => {
              handleOpenTreatmentSuggestion(s);
              setEventsSheetOpen(false);
            }}
            suggestionsMode={suggestionsMode}
            suggestionsLoading={suggestionsLoading}
          />
        </SheetContent>
      </Sheet>

      {/* Mobile FAB — opens events sheet */}
      <button
        onClick={() => setEventsSheetOpen(true)}
        className="md:hidden fixed right-3 bottom-30 z-30 w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-[background-color,transform] duration-150"
        aria-label="Open garden events and suggestions"
      >
        <Bell className="w-5 h-5" />
        {suggestions.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">
            {suggestions.length > 9 ? "9+" : suggestions.length}
          </span>
        )}
      </button>

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

      <TreatmentOptionsDialog
        open={treatmentDialogOpen}
        onOpenChange={(open) => {
          setTreatmentDialogOpen(open);
          if (!open) setTreatmentTarget(null);
        }}
        target={treatmentTarget}
        settings={settings}
        onApplyTreatment={handleApplyTreatment}
      />
    </div>
  );
}
