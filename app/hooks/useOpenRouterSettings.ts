/**
 * app/hooks/useOpenRouterSettings.ts
 *
 * Manages OpenRouter API-key draft state, show/hide toggle, and
 * the validate-against-API flow. Syncs the key draft once when
 * settings are first loaded from the database.
 *
 * The key entered here is synced to the backend SQLite via
 * POST /api/garden/sync. The backend proxy (/api/ai/chat) reads
 * it server-side for all AI calls — the key never leaves the server.
 */

import { useState, useEffect, useRef } from "react";
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
): OpenRouterSettingsState {
  const [orKeyDraft, setOrKeyDraft] = useState(
    settings.aiProvider.type === "byok" ? settings.aiProvider.key : "",
  );
  const [orStatus, setOrStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >(settings.aiProvider.type === "byok" ? "valid" : "idle");
  const [orError, setOrError] = useState("");
  const [showOrKey, setShowOrKey] = useState(false);

  // Sync draft once when settings are first loaded from the database.
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current && settings.aiProvider.type === "byok") {
      setOrKeyDraft(settings.aiProvider.key);
      setOrStatus("valid");
      hasInitialized.current = true;
    } else if (!hasInitialized.current && settings.aiProvider.type !== "none") {
      hasInitialized.current = true;
    }
  }, [settings.aiProvider]);

  const handleValidateOpenRouter = async () => {
    const key = orKeyDraft.trim();
    if (!key) return;
    setOrStatus("checking");
    setOrError("");
    try {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.status === 401) {
        setOrStatus("invalid");
        setOrError("Invalid API key — check your key at openrouter.ai.");
        setSettings((prev) => ({ ...prev, aiProvider: { type: "none" } }));
        return;
      }
      if (!res.ok) {
        setOrStatus("invalid");
        setOrError(
          `OpenRouter returned status ${res.status}. Try again later.`,
        );
        setSettings((prev) => ({ ...prev, aiProvider: { type: "none" } }));
        return;
      }
      setOrStatus("valid");
      setSettings((prev) => ({
        ...prev,
        aiProvider: { type: "byok", key },
      }));
    } catch {
      setOrStatus("invalid");
      setOrError("Cannot reach OpenRouter. Check your network connection.");
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
