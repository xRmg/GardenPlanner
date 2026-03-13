/**
 * app/hooks/useSeedlingManager.ts
 *
 * Manages seedling batch state and operations, including:
 * - Adding a new seedling batch (AddSeedlingDialog)
 * - Sowing seeds from the plant catalogue (SowSeedsDialog)
 * - Updating seedling status through the germination pipeline
 * - Planting a ready batch into the garden
 * - Removing seedling batches
 * - Dialog open/close state for AddSeedlingDialog and SowSeedsDialog
 */

import { useState } from "react";
import type { GardenRepository } from "../data/repository";
import type {
  GardenEvent as SchemaGardenEvent,
} from "../data/schema";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  notifyErrorToast,
} from "../lib/asyncErrors";
import type { SeedlingFormData } from "../components/AddSeedlingDialog";
import type { GardenEvent } from "../components/EventsBar";
import type { Plant } from "../components/PlanterGrid";
import type { Seedling } from "../types";

export interface SeedlingManagerState {
  showAddSeedlingModal: boolean;
  setShowAddSeedlingModal: React.Dispatch<React.SetStateAction<boolean>>;
  showSowModal: boolean;
  setShowSowModal: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSowPlant: Plant | null;
  handleAddSeedling: (data: SeedlingFormData) => void;
  handleOpenSowModal: (plant: Plant) => void;
  handleSowSeeds: (plant: Plant, seedCount: number, location: string) => void;
  handleUpdateSeedlingStatus: (id: string, status: Seedling["status"]) => void;
  handlePlantFromBatch: (seedling: Seedling) => void;
  handleRemoveSeedling: (id: string) => void;
}

interface UseSeedlingManagerParams {
  seedlings: Seedling[];
  setSeedlings: React.Dispatch<React.SetStateAction<Seedling[]>>;
  setCustomPlants: React.Dispatch<React.SetStateAction<Plant[]>>;
  setEvents: React.Dispatch<React.SetStateAction<GardenEvent[]>>;
  repositoryRef: React.MutableRefObject<GardenRepository>;
  /** Called when the user clicks "Use Batch" to switch to the Areas tab. */
  setSelectedPlant: React.Dispatch<React.SetStateAction<Plant | null>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

export function useSeedlingManager({
  seedlings,
  setSeedlings,
  setCustomPlants,
  setEvents,
  repositoryRef,
  setSelectedPlant,
  setActiveTab,
}: UseSeedlingManagerParams): SeedlingManagerState {
  const [showAddSeedlingModal, setShowAddSeedlingModal] = useState(false);
  const [showSowModal, setShowSowModal] = useState(false);
  const [selectedSowPlant, setSelectedSowPlant] = useState<Plant | null>(null);

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
    const sowEvent: GardenEvent = {
      id: `sow-event-${Date.now()}`,
      type: "sown",
      plant: data.plant,
      date: new Date().toISOString(),
    };
    setEvents((prev) => [sowEvent, ...prev]);
    void repositoryRef.current.saveEvent(
      sowEvent as unknown as SchemaGardenEvent,
    )
      .then(() => dismissErrorToast(ERROR_TOAST_IDS.eventsSync))
      .catch((error) => {
        notifyErrorToast({
          id: ERROR_TOAST_IDS.eventsSync,
          title: "Could not log seed sowing",
          error,
          fallback: "The sowing event may not be fully persisted.",
        });
      });
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
    // 1. Decrement amount (only if not unlimited)
    setCustomPlants((prev) => {
      const exists = prev.find((p) => p.id === plant.id);
      if (exists) {
        return prev.map((p) =>
          p.id === plant.id
            ? {
                ...p,
                amount:
                  p.amount === undefined
                    ? undefined
                    : Math.max(0, p.amount - seedCount),
              }
            : p,
        );
      } else {
        return [
          ...prev,
          {
            ...plant,
            amount:
              plant.amount === undefined
                ? undefined
                : Math.max(0, plant.amount - seedCount),
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
    const sowEvent: GardenEvent = {
      id: `sow-event-${Date.now()}`,
      type: "sown",
      plant,
      date: new Date().toISOString(),
    };
    setEvents((prev) => [sowEvent, ...prev]);
    void repositoryRef.current.saveEvent(
      sowEvent as unknown as SchemaGardenEvent,
    )
      .then(() => dismissErrorToast(ERROR_TOAST_IDS.eventsSync))
      .catch((error) => {
        notifyErrorToast({
          id: ERROR_TOAST_IDS.eventsSync,
          title: "Could not log seed sowing",
          error,
          fallback: "The sowing event may not be fully persisted.",
        });
      });
  };

  const handleUpdateSeedlingStatus = (
    id: string,
    status: Seedling["status"],
  ) => {
    setSeedlings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );

    const seedling = seedlings.find((s) => s.id === id);
    if (!seedling) return;

    const statusEvent: GardenEvent = {
      id: `update-seedling-${Date.now()}`,
      type:
        status === "growing"
          ? "sprouted"
          : status === "hardening" || status === "ready"
            ? "sprouted"
            : "watered",
      plant: seedling.plant,
      date: new Date().toISOString(),
    };
    setEvents((prev) => [statusEvent, ...prev]);
    void repositoryRef.current.saveEvent(
      statusEvent as unknown as SchemaGardenEvent,
    )
      .then(() => dismissErrorToast(ERROR_TOAST_IDS.eventsSync))
      .catch((error) => {
        notifyErrorToast({
          id: ERROR_TOAST_IDS.eventsSync,
          title: "Could not save seedling status",
          error,
          fallback: "The status update may not be fully persisted.",
        });
      });
  };

  const handlePlantFromBatch = (seedling: Seedling) => {
    setSelectedPlant(seedling.plant);
    setActiveTab("areas");
  };

  const handleRemoveSeedling = (id: string) => {
    setSeedlings((prev) => prev.filter((s) => s.id !== id));
    void repositoryRef.current.deleteSeedling(id)
      .then(() => dismissErrorToast(ERROR_TOAST_IDS.seedlingsSync))
      .catch((error) => {
        notifyErrorToast({
          id: ERROR_TOAST_IDS.seedlingsSync,
          title: "Could not remove seedling",
          error,
          fallback: "The seedling removal may not be fully persisted.",
        });
      });
  };

  return {
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
  };
}
