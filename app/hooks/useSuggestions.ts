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
 * - Settings change (lat/lng, AI provider, locale, aiModel)
 *
 * NOTE: Events are intentionally NOT a refresh trigger — completing a
 * suggestion logs an event, which would create a feedback loop.
 *
 * LAS.7 / LAS.10: When settings.locale or settings.aiModel changes, the
 * AI suggestion cache is invalidated for the previous locale/model combination
 * and a fresh evaluation runs immediately.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  Area,
  GardenEvent,
  Plant,
  Seedling,
  Settings,
  Suggestion,
  SuggestionMode,
} from "../data/schema";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  notifyErrorToast,
} from "../lib/asyncErrors";
import {
  enhanceSuggestionsWithAI,
  evaluateRuleSuggestions,
} from "../services/suggestions";
import { clearAISuggestionsCache } from "../services/suggestions/suggestionsCache";

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
  /** Optimistically remove a suggestion by id (e.g. after completing/dismissing it). */
  dismissSuggestion: (id: string) => void;
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
  // a feedback loop: completing a suggestion logs an event -> re-evaluates).
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // LAS.7 / LAS.10 — track previous locale and model so we can invalidate
  // the AI cache when either changes (without creating a dependency cycle).
  const prevLocaleRef = useRef<string | undefined>(settings.locale);
  const prevModelRef = useRef<string>(settings.aiModel);
  useEffect(() => {
    const localeChanged = prevLocaleRef.current !== settings.locale;
    const modelChanged = prevModelRef.current !== settings.aiModel;
    if ((localeChanged || modelChanged) && hasLoadedFromDB.current) {
      console.debug(
        `[useSuggestions] Invalidation trigger: locale=${localeChanged} model=${modelChanged} — clearing AI cache`,
      );
      clearAISuggestionsCache().catch((err) => {
        console.warn("[useSuggestions] Failed to clear AI suggestions cache:", err);
      });
    }
    prevLocaleRef.current = settings.locale;
    prevModelRef.current = settings.aiModel;
  }, [settings.locale, settings.aiModel, hasLoadedFromDB]);

  const evaluate = useCallback(
    async (isBackground: boolean) => {
      if (!hasLoadedFromDB.current) return;

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
        const baseResult = await evaluateRuleSuggestions(
          { areas, seedlings, events: eventsRef.current, settings, plants },
          controller.signal,
        );

        if (controller.signal.aborted) return;

        setSuggestions(baseResult.suggestions);
        setMode(baseResult.mode);
        setLastRefreshed(new Date());

        if (
          !baseResult.canEnhanceWithAI ||
          !baseResult.ruleCtx ||
          !baseResult.ruleResults ||
          baseResult.mode === "static"
        ) {
          dismissErrorToast(ERROR_TOAST_IDS.suggestions);
          return;
        }

        if (!isBackground) {
          setLoading(false);
          setBackgroundRefreshing(true);
        }

        const enhancedResult = await enhanceSuggestionsWithAI(
          baseResult.ruleCtx,
          baseResult.ruleResults,
          settings,
          plants,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setSuggestions(enhancedResult.suggestions);
          setMode(enhancedResult.mode);
          setLastRefreshed(new Date());

          if (enhancedResult.aiError) {
            notifyErrorToast({
              id: ERROR_TOAST_IDS.suggestions,
              title: "AI suggestions failed",
              error: enhancedResult.aiError,
              fallback:
                "AI suggestions could not be loaded. Showing rule-based suggestions.",
            });
          } else {
            dismissErrorToast(ERROR_TOAST_IDS.suggestions);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "Suggestion engine error";
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

  const refresh = useCallback(() => {
    evaluate(false);
  }, [evaluate]);

  useEffect(() => {
    if (isFirstRun.current) {
      const timer = setTimeout(() => {
        isFirstRun.current = false;
        evaluate(false);
      }, 100);
      return () => clearTimeout(timer);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      evaluate(lastRefreshed !== null);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluate]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      evaluate(true);
    }, BACKGROUND_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [evaluate]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    suggestions,
    loading,
    backgroundRefreshing,
    error,
    mode,
    lastRefreshed,
    refresh,
    dismissSuggestion,
  };
}
