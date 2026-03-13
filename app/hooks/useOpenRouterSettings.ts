/**
 * app/hooks/useOpenRouterSettings.ts
 *
 * Manages the Settings UI state for storing / replacing the OpenRouter API key.
 * Validation and persistence happen via backend settings endpoints so the
 * browser never talks to OpenRouter directly.
 */

import { useEffect, useState } from "react";
import type { GardenRepository } from "../data/repository";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  notifyErrorToast,
} from "../lib/asyncErrors";
import type { Settings } from "../data/schema";

export interface OpenRouterSettingsState {
  orKeyDraft: string;
  setOrKeyDraft: React.Dispatch<React.SetStateAction<string>>;
  orStatus: "idle" | "checking" | "valid" | "invalid";
  setOrStatus: React.Dispatch<
    React.SetStateAction<"idle" | "checking" | "valid" | "invalid">
  >;
  orError: string;
  setOrError: React.Dispatch<React.SetStateAction<string>>;
  showOrKey: boolean;
  setShowOrKey: React.Dispatch<React.SetStateAction<boolean>>;
  handleValidateOpenRouter: () => Promise<void>;
}

export function useOpenRouterSettings(
  settings: Settings,
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
  repositoryRef: React.MutableRefObject<GardenRepository>,
): OpenRouterSettingsState {
  const [orKeyDraft, setOrKeyDraft] = useState("");
  const [orStatus, setOrStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >(
    settings.aiProvider.type === "server"
      ? settings.aiValidationError
        ? "invalid"
        : "valid"
      : "idle",
  );
  const [orError, setOrError] = useState(settings.aiValidationError ?? "");
  const [showOrKey, setShowOrKey] = useState(false);

  useEffect(() => {
    if (orKeyDraft.trim()) return;
    if (settings.aiProvider.type === "server") {
      setOrStatus(settings.aiValidationError ? "invalid" : "valid");
      setOrError(settings.aiValidationError ?? "");
      return;
    }
    setOrStatus("idle");
    setOrError("");
  }, [settings.aiProvider.type, settings.aiValidationError, orKeyDraft]);

  const handleValidateOpenRouter = async () => {
    const key = orKeyDraft.trim();
    if (!key) return;

    setOrStatus("checking");
    setOrError("");

    try {
      const savedSettings = await repositoryRef.current.storeAiKey(key);
      setSettings(savedSettings);
      setOrKeyDraft("");
      setShowOrKey(false);
      setOrStatus("valid");
      setOrError("");
      dismissErrorToast(ERROR_TOAST_IDS.aiKeyValidation);
    } catch (error) {
      setOrStatus("invalid");
      setOrError(
        error instanceof Error ? error.message : "Failed to validate API key.",
      );
      notifyErrorToast({
        id: ERROR_TOAST_IDS.aiKeyValidation,
        title: "OpenRouter validation failed",
        error,
        fallback: "The API key could not be validated.",
      });
    }
  };

  return {
    orKeyDraft,
    setOrKeyDraft,
    orStatus,
    setOrStatus,
    orError,
    setOrError,
    showOrKey,
    setShowOrKey,
    handleValidateOpenRouter,
  };
}
