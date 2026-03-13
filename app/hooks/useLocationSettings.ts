/**
 * app/hooks/useLocationSettings.ts
 *
 * Manages the Settings UI state for location verification.
 * Canonical location resolution, coordinate lookup, and climate-zone
 * derivation are handled by the backend via the GardenRepository.
 */

import { useEffect, useState } from "react";
import type { GardenRepository } from "../data/repository";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  notifyErrorToast,
} from "../lib/asyncErrors";
import type { Settings } from "../data/schema";

export interface LocationSettingsState {
  locationDraft: string;
  setLocationDraft: React.Dispatch<React.SetStateAction<string>>;
  locationStatus: "idle" | "checking" | "valid" | "invalid";
  setLocationStatus: React.Dispatch<
    React.SetStateAction<"idle" | "checking" | "valid" | "invalid">
  >;
  locationError: string;
  setLocationError: React.Dispatch<React.SetStateAction<string>>;
  handleVerifyLocation: () => Promise<void>;
}

export function useLocationSettings(
  settings: Settings,
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
  repositoryRef: React.MutableRefObject<GardenRepository>,
): LocationSettingsState {
  const [locationDraft, setLocationDraft] = useState(settings.location);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >(settings.lat != null ? "valid" : "idle");
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    setLocationDraft(settings.location);
    setLocationStatus(settings.lat != null ? "valid" : "idle");
  }, [settings.location, settings.lat]);

  const handleVerifyLocation = async () => {
    const query = locationDraft.trim();
    if (!query) return;

    setLocationStatus("checking");
    setLocationError("");

    try {
      const savedSettings = await repositoryRef.current.resolveLocation(query);
      setSettings(savedSettings);
      setLocationDraft(savedSettings.location);
      setLocationStatus(savedSettings.lat != null ? "valid" : "idle");
      dismissErrorToast(ERROR_TOAST_IDS.locationVerify);
    } catch (error) {
      setLocationStatus("invalid");
      setLocationError(
        error instanceof Error ? error.message : "Failed to verify location.",
      );
      notifyErrorToast({
        id: ERROR_TOAST_IDS.locationVerify,
        title: "Location verification failed",
        error,
        fallback: "The location could not be verified.",
      });
    }
  };

  return {
    locationDraft,
    setLocationDraft,
    locationStatus,
    setLocationStatus,
    locationError,
    setLocationError,
    handleVerifyLocation,
  };
}
