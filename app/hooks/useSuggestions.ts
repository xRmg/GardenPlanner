/**
 * app/hooks/useSuggestions.ts
 *
 * React hook that wires together the weather service and suggestion engine.
 *
 * Refresh strategy:
 * - On mount (after DB data loads)
 * - When areas or seedlings change (debounced 2 s)
 * - Silent background refresh every 15 minutes
 * - Manual refresh() call
 * - Settings change (lat/lng, AI provider)
 *
 * NOTE: Events are intentionally NOT a refresh trigger — completing a
 * suggestion logs an event, which would create a feedback loop.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { Area, GardenEvent, Plant, Seedling, Settings, Suggestion, SuggestionMode } from "../data/schema";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  notifyErrorToast,
} from "../lib/asyncErrors";
import { evaluateSuggestions } from "../services/suggestions";
const DEBOUNCE_MS = 2_000;
const BACKGROUND_REFRESH_MS = 15 * 60 * 1_000; // 15 minutes

export interface UseSuggestionsReturn {
  suggestions: Suggestion[];
  loading: boolean;
  backgroundRefreshing: boolean;
  error: string | null;
  mode: SuggestionMode;
  lastRefreshed: Date | null;
  refresh: () => void;
}

export interface UseSuggestionsParams {
  areas: Area[];
  seedlings: Seedling[];
  events: GardenEvent[];
  settings: Settings;
  plants: Plant[];
  /**
   * Ref that becomes true once the DB has finished loading initial data.
   * Matches the shape returned by useGardenData.
   */
  hasLoadedFromDB: React.MutableRefObject<boolean>;
}

export function useSuggestions({
  areas,
  seedlings,
  events,
  settings,
  plants,
  hasLoadedFromDB,
}: UseSuggestionsParams): UseSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SuggestionMode>("static");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const isFirstRun = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use a ref for events so the latest value is always available inside the
  // evaluate callback without making events a dependency (which would cause
  // a feedback loop: completing a suggestion logs an event → re-evaluates).
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  // Core evaluation function
  const evaluate = useCallback(
    async (isBackground: boolean) => {
      // Guard: don't evaluate before the DB has loaded
      if (!hasLoadedFromDB.current) return;

      // Cancel any in-flight evaluation
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      if (isBackground) {
        setBackgroundRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await evaluateSuggestions(
          { areas, seedlings, events: eventsRef.current, settings, plants },
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setSuggestions(result.suggestions);
          setMode(result.mode);
          setLastRefreshed(new Date());
          dismissErrorToast(ERROR_TOAST_IDS.suggestions);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : "Suggestion engine error";
          setError(message);
          console.warn("[useSuggestions] Evaluation failed:", err);
          notifyErrorToast({
            id: ERROR_TOAST_IDS.suggestions,
            title: "Suggestions refresh failed",
            error: err,
            fallback: "Suggestions could not be refreshed.",
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setBackgroundRefreshing(false);
        }
      }
    },
    [areas, seedlings, settings, plants, hasLoadedFromDB],
  );

  // Manual refresh
  const refresh = useCallback(() => {
    evaluate(false);
  }, [evaluate]);

  // Trigger evaluation when areas/seedlings/settings change (i.e., after DB load)
  useEffect(() => {
    if (isFirstRun.current) {
      // Delay the initial run slightly to allow the DB load to settle
      const timer = setTimeout(() => {
        isFirstRun.current = false;
        evaluate(false);
      }, 100);
      return () => clearTimeout(timer);
    }

    // Subsequent triggers — debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      evaluate(lastRefreshed !== null);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluate]);

  // Background refresh every 15 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      evaluate(true);
    }, BACKGROUND_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [evaluate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    suggestions,
    loading,
    backgroundRefreshing,
    error,
    mode,
    lastRefreshed,
    refresh,
  };
}
