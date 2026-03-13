/**
 * app/hooks/usePlantCatalog.ts
 *
 * Manages the custom-plant catalogue, including:
 * - Add / edit / remove custom plants
 * - Plant search and filter UI state
 * - Computed AVAILABLE_PLANTS, filteredAvailablePlants, plantTabCounts
 * - Stock tracking helpers (getUsedPlantCount, getAvailableStock)
 * - PlantDefinitionDialog open/close and editing state
 */

import { useState, useMemo } from "react";
import type { GardenRepository } from "../data/repository";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  notifyErrorToast,
} from "../lib/asyncErrors";
import type { Area } from "../types";
import type { Plant } from "../components/PlanterGrid";

export interface PlantCatalogState {
  showAddPlantModal: boolean;
  setShowAddPlantModal: React.Dispatch<React.SetStateAction<boolean>>;
  editingPlant: Plant | null;
  setEditingPlant: React.Dispatch<React.SetStateAction<Plant | null>>;
  dialogDefaultIsSeed: boolean;
  setDialogDefaultIsSeed: React.Dispatch<React.SetStateAction<boolean>>;
  plantsFilter: "all" | "plants" | "seeds";
  setPlantsFilter: React.Dispatch<
    React.SetStateAction<"all" | "plants" | "seeds">
  >;
  plantsSearch: string;
  setPlantsSearch: React.Dispatch<React.SetStateAction<string>>;
  /** All custom plants with isSeed normalised to a boolean. */
  AVAILABLE_PLANTS: Plant[];
  filteredAvailablePlants: Plant[];
  plantTabCounts: { all: number; plants: number; seeds: number };
  getUsedPlantCount: (plantId: string) => number;
  getAvailableStock: (plantId: string) => number;
  handleAddPlant: (plant: Plant) => void;
  handleRemovePlantManually: (id: string) => void;
  handleEditPlantManually: (plant: Plant) => void;
}

interface UsePlantCatalogParams {
  customPlants: Plant[];
  setCustomPlants: React.Dispatch<React.SetStateAction<Plant[]>>;
  areas: Area[];
  repositoryRef: React.MutableRefObject<GardenRepository>;
}

export function usePlantCatalog({
  customPlants,
  setCustomPlants,
  areas,
  repositoryRef,
}: UsePlantCatalogParams): PlantCatalogState {
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [dialogDefaultIsSeed, setDialogDefaultIsSeed] = useState(false);
  const [plantsFilter, setPlantsFilter] = useState<"all" | "plants" | "seeds">(
    "all",
  );
  const [plantsSearch, setPlantsSearch] = useState("");

  const AVAILABLE_PLANTS = customPlants.map((p) => ({
    ...p,
    isSeed: p.isSeed ?? false,
  }));

  const getUsedPlantCount = (plantId: string): number => {
    let count = 0;
    areas.forEach((area) => {
      area.planters.forEach((planter) => {
        if (planter.squares) {
          planter.squares.forEach((row) => {
            row.forEach((square) => {
              if (square.plantInstance?.plant.id === plantId) {
                count++;
              }
            });
          });
        }
      });
    });
    return count;
  };

  const getAvailableStock = (plantId: string): number => {
    const plant = AVAILABLE_PLANTS.find((p) => p.id === plantId);
    if (!plant) return 0;
    if (plant.amount === undefined) return Infinity;
    const usedCount = getUsedPlantCount(plantId);
    return Math.max(0, plant.amount - usedCount);
  };

  const plantTabCounts = useMemo(
    () => ({
      all: AVAILABLE_PLANTS.length,
      plants: AVAILABLE_PLANTS.filter((p) => !p.isSeed).length,
      seeds: AVAILABLE_PLANTS.filter((p) => p.isSeed).length,
    }),
    [AVAILABLE_PLANTS],
  );

  const filteredAvailablePlants = useMemo(
    () =>
      AVAILABLE_PLANTS.filter((plant) => {
        const matchesFilter =
          plantsFilter === "all" ||
          (plantsFilter === "plants" && !plant.isSeed) ||
          (plantsFilter === "seeds" && plant.isSeed);
        const matchesSearch =
          !plantsSearch.trim() ||
          plant.name.toLowerCase().includes(plantsSearch.toLowerCase()) ||
          (plant.variety ?? "")
            .toLowerCase()
            .includes(plantsSearch.toLowerCase());
        return matchesFilter && matchesSearch;
      }),
    [AVAILABLE_PLANTS, plantsFilter, plantsSearch],
  );

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
    void repositoryRef.current.deletePlant(id)
      .then(() => dismissErrorToast(ERROR_TOAST_IDS.plantsSync))
      .catch((error) => {
        notifyErrorToast({
          id: ERROR_TOAST_IDS.plantsSync,
          title: "Could not save plant catalogue",
          error,
          fallback: "The plant removal may not be fully persisted.",
        });
      });
  };

  const handleEditPlantManually = (plant: Plant) => {
    setEditingPlant(plant);
    setShowAddPlantModal(true);
  };

  return {
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
    getUsedPlantCount,
    getAvailableStock,
    handleAddPlant,
    handleRemovePlantManually,
    handleEditPlantManually,
  };
}
