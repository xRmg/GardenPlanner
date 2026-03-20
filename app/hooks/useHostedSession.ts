import { useCallback, useEffect, useState } from "react";
import { APP_CAPABILITIES } from "../config/capabilities";
import { apiFetch, apiJson } from "../lib/api";

export interface HostedUserProfile {
  authSubjectId: string;
  email: string;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  locale?: string;
}

export interface HostedWorkspaceSummary {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  createdAt: string;
  updatedAt: string;
}

export interface HostedSessionState {
  mode: "hosted";
  user: HostedUserProfile;
  workspace: HostedWorkspaceSummary | null;
  onboarding: {
    completed: boolean;
  };
}

export interface UseHostedSessionResult {
  enabled: boolean;
  loading: boolean;
  error: string;
  session: HostedSessionState | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useHostedSession(): UseHostedSessionResult {
  const enabled = APP_CAPABILITIES.auth.mode === "hosted";
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [session, setSession] = useState<HostedSessionState | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setSession(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/api/auth/me");
      if (response.status === 401 || response.status === 403) {
        setSession(null);
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || `Auth session check failed (${response.status})`);
      }

      const nextSession = (await response.json()) as HostedSessionState;
      setSession(nextSession);
    } catch (sessionError) {
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : "Could not load hosted session.",
      );
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const signOut = useCallback(async () => {
    if (!enabled) return;
    await apiJson<{ success: boolean }>("/api/auth/sign-out", {
      method: "POST",
    });
    setSession(null);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    enabled,
    loading,
    error,
    session,
    refresh,
    signOut,
  };
}
