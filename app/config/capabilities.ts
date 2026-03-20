export type HostedAuthMode = "none" | "hosted";
export type PreferredAiMode = "none" | "own-key" | "managed";

export interface AppCapabilities {
  auth: {
    mode: HostedAuthMode;
  };
  sync: {
    enabled: boolean;
  };
  ai: {
    managedModeSelectable: boolean;
  };
}

function readBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const authMode = (import.meta.env.VITE_GARDEN_AUTH_MODE || "none")
  .trim()
  .toLowerCase();

export const APP_CAPABILITIES: AppCapabilities = {
  auth: {
    mode: authMode === "hosted" ? "hosted" : "none",
  },
  sync: {
    enabled: readBooleanEnv(import.meta.env.VITE_GARDEN_SYNC_ENABLED, true),
  },
  ai: {
    managedModeSelectable: readBooleanEnv(
      import.meta.env.VITE_GARDEN_MANAGED_AI_SELECTABLE,
      true,
    ),
  },
};

export function isHostedAuthEnabled(): boolean {
  return APP_CAPABILITIES.auth.mode === "hosted";
}
