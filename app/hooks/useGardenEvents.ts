/**
 * app/hooks/useGardenEvents.ts
 *
 * Manages garden events and care suggestions, including:
 * - Hardcoded initial suggestions (water, weed, compost)
 * - Adding / removing harvest suggestions when plants are added / removed
 * - Updating harvest suggestions when plant instances are updated
 * - Completing a suggestion (removes it and logs the corresponding event)
 * - Deriving the harvestAlerts list from current suggestions
 */

import { useState } from "react";
import type { GardenRepository } from "../data/repository";
import type { GardenEvent as SchemaGardenEvent } from "../data/schema";
import type { PlantInstance } from "../components/PlanterGrid";
import type { GardenEvent, Suggestion } from "../components/EventsBar";

export interface GardenEventsState {
  suggestions: Suggestion[];
  setSuggestions: React.Dispatch<React.SetStateAction<Suggestion[]>>;
  harvestAlerts: Array<{
    plantName: string;
    plantIcon: string;
    daysUntilHarvest: number;
    areaName: string;
  }>;
  handlePlantAdded: (
    plantInstance: PlantInstance,
    planterId: string,
  ) => void;
  handlePlantRemoved: (
    plantInstance: PlantInstance,
    planterId: string,
    eventType?: "harvested" | "removed",
  ) => void;
  handlePlantUpdated: (
    plantInstance: PlantInstance,
    planterId: string,
  ) => void;
  handleCompleteSuggestion: (suggestion: Suggestion) => void;
}

interface UseGardenEventsParams {
  setEvents: React.Dispatch<React.SetStateAction<GardenEvent[]>>;
  repositoryRef: React.MutableRefObject<GardenRepository>;
}

export function useGardenEvents({
  setEvents,
  repositoryRef,
}: UseGardenEventsParams): GardenEventsState {
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

  const handlePlantAdded = (
    plantInstance: PlantInstance,
    planterId: string,
  ) => {
    const eventLog: GardenEvent = {
      id: `planted-${Date.now()}-${Math.random()}`,
      type: "planted",
      plant: plantInstance.plant,
      date: new Date().toISOString(),
      gardenId: planterId,
    };
    setEvents((prev) => [eventLog, ...prev]);
    void repositoryRef.current.saveEvent(
      eventLog as unknown as SchemaGardenEvent,
    );

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
    planterId: string,
    eventType: "harvested" | "removed" = "harvested",
  ) => {
    const eventLog: GardenEvent = {
      id: `${eventType}-${Date.now()}-${Math.random()}`,
      type: eventType,
      plant: plantInstance.plant,
      date: new Date().toISOString(),
      gardenId: planterId,
    };
    setEvents((prev) => [eventLog, ...prev]);
    void repositoryRef.current.saveEvent(
      eventLog as unknown as SchemaGardenEvent,
    );

    setSuggestions((prev) =>
      prev.filter((s) => s.id !== `harvest-sug-${plantInstance.instanceId}`),
    );
  };

  const handlePlantUpdated = (
    plantInstance: PlantInstance,
    _planterId: string,
  ) => {
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
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

    const eventType =
      suggestion.type === "water"
        ? "watered"
        : suggestion.type === "harvest"
          ? "harvested"
          : suggestion.type === "compost"
            ? "composted"
            : suggestion.type === "weed"
              ? "weeded"
              : "composted";

    const completedEvent: GardenEvent = {
      id: `event-${Date.now()}-${Math.random()}`,
      type: eventType as GardenEvent["type"],
      plant: suggestion.plant,
      date: new Date().toISOString(),
    };
    setEvents((prev) => [completedEvent, ...prev]);
    void repositoryRef.current.saveEvent(
      completedEvent as unknown as SchemaGardenEvent,
    );
  };

  return {
    suggestions,
    setSuggestions,
    harvestAlerts,
    handlePlantAdded,
    handlePlantRemoved,
    handlePlantUpdated,
    handleCompleteSuggestion,
  };
}
