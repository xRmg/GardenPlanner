/**
 * app/hooks/useAreaManager.ts
 *
 * Manages area and planter CRUD operations, including:
 * - Add / remove / update / reorder areas
 * - Add / edit / save / remove / reorder planters within areas
 * - PlanterDialog open/close state
 * - Removing planter-related events when a planter is deleted
 */

import { useState } from "react";
import type { GardenRepository } from "../data/repository";
import type { GardenEvent } from "../components/EventsBar";
import type { PlanterConfig } from "../components/PlanterDialog";
import i18n from "../i18n/config";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  notifyErrorToast,
} from "../lib/asyncErrors";
import type { Area, Planter } from "../types";

export interface AreaManagerState {
  planterDialogOpen: boolean;
  setPlanterDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingPlanter: { areaId: string; planter: Planter | null } | null;
  handleAddArea: () => void;
  handleRemoveArea: (id: string) => void;
  handleUpdateArea: (id: string, updates: Partial<Area>) => void;
  handleAddPlanter: (areaId: string) => void;
  handleEditPlanter: (areaId: string, planter: Planter) => void;
  handleSavePlanter: (config: PlanterConfig) => void;
  handleRemovePlanter: (areaId: string, planterId: string) => void;
  handleMoveArea: (id: string, direction: "up" | "down") => void;
  handleMovePlanter: (
    areaId: string,
    planterId: string,
    direction: "up" | "down",
  ) => void;
}

interface UseAreaManagerParams {
  setAreas: React.Dispatch<React.SetStateAction<Area[]>>;
  events: GardenEvent[];
  setEvents: React.Dispatch<React.SetStateAction<GardenEvent[]>>;
  repositoryRef: React.MutableRefObject<GardenRepository>;
}

export function useAreaManager({
  setAreas,
  events,
  setEvents,
  repositoryRef,
}: UseAreaManagerParams): AreaManagerState {
  const [planterDialogOpen, setPlanterDialogOpen] = useState(false);
  const [editingPlanter, setEditingPlanter] = useState<{
    areaId: string;
    planter: Planter | null;
  } | null>(null);

  const handleAddArea = () => {
    const newArea: Area = {
      id: `area-${Date.now()}`,
      name: String(i18n.t("areas.newArea")),
      tagline: String(i18n.t("areas.newAreaTagline")),
      backgroundColor: "#f0fdf4",
      planters: [],
    };
    setAreas((prev) => [...prev, newArea]);
  };

  const handleRemoveArea = (id: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== id));
    void repositoryRef.current.deleteArea(id)
      .then(() => dismissErrorToast(ERROR_TOAST_IDS.areasSync))
      .catch((error) => {
        notifyErrorToast({
          id: ERROR_TOAST_IDS.areasSync,
          title: "Could not save garden layout",
          error,
          fallback: "The area removal may not be fully persisted.",
        });
      });
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
                ? ({ ...p, ...config } as Planter)
                : p,
            )
          : [
              ...area.planters,
              { ...config, id: `planter-${Date.now()}` } as Planter,
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
    const repo = repositoryRef.current;
    void Promise.all(
      events
        .filter((e) => e.gardenId === planterId)
        .map((event) => repo.deleteEvent(event.id)),
    )
      .then(() => dismissErrorToast(ERROR_TOAST_IDS.eventsSync))
      .catch((error) => {
        notifyErrorToast({
          id: ERROR_TOAST_IDS.eventsSync,
          title: "Could not update garden journal",
          error,
          fallback: "Planter journal cleanup may not be fully persisted.",
        });
      });
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

  return {
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
  };
}
