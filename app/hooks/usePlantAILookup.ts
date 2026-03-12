/**
 * app/hooks/usePlantAILookup.ts
 *
 * Encapsulates the plant AI lookup flow:
 *   1. Check the plant cache (in-memory + Dexie)
 *   2. If no cache hit, call OpenRouter via the model fallback chain
 *   3. Cache the result for 30 days
 *   4. Expose loading / error / cancel state to the UI
 *
 * Note: the hook does NOT auto-trigger on keystroke — the consumer calls
 * `handleAiLookup()` explicitly (triggered by the "Ask AI ✨" button).
 * This gives the user full control and avoids unintended API calls.
 */

import { useState, useRef, useCallback } from "react";
import type { Settings } from "../data/schema";
import { OpenRouterClient } from "../services/ai/openrouter";
import {
  PLANT_LOOKUP_SYSTEM_PROMPT,
  buildPlantLookupUserPrompt,
  CONFIDENCE,
  type PlantAIResponse,
} from "../services/ai/prompts";
import { getPlantCache } from "../services/ai/plantCache";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PlantAILookupState {
  /** The most-recently received AI response, or null if not yet fetched. */
  aiResult: PlantAIResponse | null;
  /** True while the API call (or cache lookup) is in progress. */
  aiLoading: boolean;
  /** Non-empty when the last lookup failed. */
  aiError: string;
  /** The model name that produced the current `aiResult`. */
  aiModel: string;
  /**
   * Trigger an AI lookup for the given plant name + variety.
   * Checks cache first; only calls the API on cache miss.
   */
  handleAiLookup: (plantName: string, variety?: string) => Promise<void>;
  /** Cancel an in-progress lookup. */
  cancelAiLookup: () => void;
  /** Clear the previous result (e.g. when the user clears the name field). */
  clearAiResult: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlantAILookup(settings: Settings): PlantAILookupState {
  const [aiResult, setAiResult] = useState<PlantAIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiModel, setAiModel] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const cancelAiLookup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAiLoading(false);
  }, []);

  const clearAiResult = useCallback(() => {
    setAiResult(null);
    setAiError("");
    setAiModel("");
  }, []);

  const handleAiLookup = useCallback(
    async (plantName: string, variety?: string) => {
      const name = plantName.trim();
      if (!name || settings.aiProvider.type !== "byok") return;

      // Cancel any previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setAiLoading(true);
      setAiError("");

      try {
        const cache = getPlantCache();
        const koeppenZone = settings.growthZone || undefined;

        // 1. Try cache first (no API call needed)
        const cached = await cache.get(name, undefined, koeppenZone);
        if (cached) {
          setAiResult(cached);
          setAiModel("cache");
          setAiLoading(false);
          return;
        }

        // 2. Build the API client
        const client = new OpenRouterClient({
          apiKey: settings.aiProvider.key,
          model: settings.aiModel,
        });

        // 3. Call the API
        const userPrompt = buildPlantLookupUserPrompt({
          plantName: name,
          variety: variety?.trim() || undefined,
          koeppenZone,
          latitude: settings.lat,
          longitude: settings.lng,
        });

        const { content, model } = await client.chatCompletionWithFallback(
          [
            { role: "system", content: PLANT_LOOKUP_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          {
            temperature: 0.3,
            maxTokens: 1024,
            signal: controller.signal,
          },
        );

        // 4. Parse JSON response
        const parsed: PlantAIResponse = JSON.parse(content);

        // 5. Filter out fields below the rejection threshold
        const filtered = filterLowConfidenceFields(parsed);

        // 6. Cache result
        await cache.set(
          name,
          filtered,
          model,
          filtered.latinName,
          koeppenZone,
        );

        setAiResult(filtered);
        setAiModel(model);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          // User cancelled — treat as silent, clear loading
          setAiLoading(false);
          return;
        }
        const msg =
          error instanceof Error ? error.message : "Unknown error from AI";
        setAiError(`AI lookup failed: ${msg}`);
        console.error("[usePlantAILookup]", error);
      } finally {
        setAiLoading(false);
      }
    },
    [settings],
  );

  return {
    aiResult,
    aiLoading,
    aiError,
    aiModel,
    handleAiLookup,
    cancelAiLookup,
    clearAiResult,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Zero-out fields whose confidence is below the rejection threshold so they
 * don't accidentally overwrite user data with low-quality AI suggestions.
 */
function filterLowConfidenceFields(
  result: PlantAIResponse,
): PlantAIResponse {
  const c = result.confidence;
  return {
    ...result,
    sowIndoorMonths:
      (c.sowIndoorMonths ?? 1) >= CONFIDENCE.REJECT
        ? result.sowIndoorMonths
        : [],
    sowDirectMonths:
      (c.sowDirectMonths ?? 1) >= CONFIDENCE.REJECT
        ? result.sowDirectMonths
        : [],
    harvestMonths:
      (c.harvestMonths ?? 1) >= CONFIDENCE.REJECT
        ? result.harvestMonths
        : [],
    companions:
      (c.companions ?? 1) >= CONFIDENCE.REJECT ? result.companions : [],
    antagonists:
      (c.antagonists ?? 1) >= CONFIDENCE.REJECT ? result.antagonists : [],
    icon:
      (c.icon ?? 0) >= CONFIDENCE.HIGH ? result.icon : undefined,
    color:
      (c.color ?? 0) >= CONFIDENCE.HIGH ? result.color : undefined,
  };
}
