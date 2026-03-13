import { toast } from "sonner";

export const ERROR_TOAST_IDS = {
  dbInit: "db-init-error",
  startupSync: "server-startup-sync-error",
  areasSync: "areas-sync-error",
  plantsSync: "plants-sync-error",
  seedlingsSync: "seedlings-sync-error",
  settingsSync: "settings-sync-error",
  eventsSync: "events-sync-error",
  locationVerify: "location-verify-error",
  aiKeyValidation: "ai-key-validation-error",
  suggestions: "suggestions-error",
  plantAiLookup: "plant-ai-lookup-error",
  treatmentOptions: "treatment-options-error",
  unhandledAsync: "unhandled-async-error",
} as const;

interface ErrorToastOptions {
  id: string;
  title: string;
  error?: unknown;
  fallback?: string;
  description?: string;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
}

export function notifyErrorToast({
  id,
  title,
  error,
  fallback = "Something went wrong.",
  description,
}: ErrorToastOptions): string {
  const nextDescription = description ?? getErrorMessage(error, fallback);

  toast.error(title, {
    id,
    description: nextDescription,
  });

  return nextDescription;
}

export function dismissErrorToast(id: string): void {
  toast.dismiss(id);
}