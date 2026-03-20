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
import { getBundledPlantByMatch } from "../data/bundledPlants";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  isAbortError,
  notifyErrorToast,
} from "../lib/asyncErrors";
import { OpenRouterClient } from "../services/ai/openrouter";
import {
  isCanonicalPlantReference,
  normalizePlantReference,
} from "../lib/plantReferences";
import { upsertMissingPlantNameOverrides } from "../i18n/plantNameOverrides";
import {
  getLocalizedPlantReferenceName,
  getKnownPlantReferences,
  hasPlantNameTranslation,
  parseLocalizedPlantReferenceList,
} from "../i18n/utils/plantTranslation";

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
import {
  PLANT_LOOKUP_SYSTEM_PROMPT,
  buildPlantLookupUserPrompt,
  CONFIDENCE,
  normalizePlantName,
  type FilteredPlantAIResponse,
  type PlantAIResponse,
} from "../services/ai/prompts";
import { getPlantCache } from "../services/ai/plantCache";

const PLANT_AI_LOOKUP_TIMEOUT_MS = 25_000;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PlantAILookupState {
  /** The most-recently received AI response, or null if not yet fetched. */
  aiResult: FilteredPlantAIResponse | null;
  /** True while the API call (or cache lookup) is in progress. */
  aiLoading: boolean;
  /** Non-empty when the last lookup failed. */
  aiError: string;
  /** The model name that produced the current `aiResult`. */
  aiModel: string;
  /**
   * Trigger an AI lookup for the given plant name + variety + optional latin name.
   * Checks cache first; only calls the API on cache miss.
   */
  handleAiLookup: (
    plantName: string,
    variety?: string,
    latinName?: string,
  ) => Promise<void>;
  /** Cancel an in-progress lookup. */
  cancelAiLookup: () => void;
  /** Clear the previous result (e.g. when the user clears the name field). */
  clearAiResult: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlantAILookup(settings: Settings): PlantAILookupState {
  const [aiResult, setAiResult] = useState<FilteredPlantAIResponse | null>(null);
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
    async (plantName: string, variety?: string, latinName?: string) => {
      const isDev = import.meta.env.DEV;
      const name = plantName.trim();
      const requestedVariety = variety?.trim() || undefined;
      const requestedLatinName = latinName?.trim() || undefined;
      if (!name || settings.aiProvider.type === "none") return;

      if (isDev)
        console.log("[usePlantAILookup] Starting AI lookup for:", {
          name,
          variety: requestedVariety,
          latinName: requestedLatinName,
        });

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
        if (isDev) console.log("[usePlantAILookup] Checking cache…");
        const cached = await cache.get(
          name,
          requestedLatinName,
          koeppenZone,
          settings.locale,
          requestedVariety,
        );
        if (cached) {
          if (isDev) console.log("[usePlantAILookup] ✓ Cache hit:", cached);
          setAiResult(cached);
          setAiModel("cache");
          setAiLoading(false);
          dismissErrorToast(ERROR_TOAST_IDS.plantAiLookup);
          return;
        }
        if (isDev) console.log("[usePlantAILookup] Cache miss, calling API…");

        // 2. Build the API client
        // All AI calls are routed through the server proxy so the API key
        // stays server-side (never exposed in the browser). The apiKey field
        // is intentionally left empty — the backend reads the key from its
        // own SQLite settings row.
        const proxyUrl = API_BASE ? `${API_BASE}/api/ai/chat` : "/api/ai/chat";
        const client = new OpenRouterClient({
          apiKey: "", // Always empty — backend reads the key from its own SQLite DB
          model: settings.aiModel,
          proxyUrl,
        });

        if (isDev) {
          console.log(
            `[usePlantAILookup] Using backend proxy: ${proxyUrl} (API key stays server-side; full logs in npm terminal)`,
          );
        }

        // 3. Call the API
        const userPrompt = buildPlantLookupUserPrompt({
          plantName: name,
          variety: requestedVariety,
          latinName: requestedLatinName,
          koeppenZone,
          latitude: settings.lat,
          longitude: settings.lng,
          locale: settings.locale,
        });

        if (isDev) {
          console.log(
            "[usePlantAILookup] ══════════════════════════════════════",
          );
          console.log("[usePlantAILookup] API Request:");
          console.log("[usePlantAILookup] Model:", settings.aiModel);
          console.log("[usePlantAILookup] Köppen zone:", koeppenZone);
          console.log(
            "[usePlantAILookup] Coordinates:",
            settings.lat,
            settings.lng,
          );
          console.log("[usePlantAILookup] ── System Prompt ──");
          console.log(PLANT_LOOKUP_SYSTEM_PROMPT);
          console.log("[usePlantAILookup] ── User Prompt ──");
          console.log(userPrompt);
          console.log(
            "[usePlantAILookup] ══════════════════════════════════════",
          );
        }

        const { content, model } = await client.chatCompletionWithFallback(
          [
            { role: "system", content: PLANT_LOOKUP_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          {
            temperature: 0.3,
            // 8192 gives reasoning models (stepfun, deepseek-r1, etc.) enough
            // room to think AND produce output. Tested: stepfun/step-3.5-flash:free
            // uses ~3600 reasoning tokens + ~800 output tokens = ~4400 total.
            maxTokens: 8192,
            timeoutMs: PLANT_AI_LOOKUP_TIMEOUT_MS,
            signal: controller.signal,
          },
        );

        if (isDev) {
          console.log("[usePlantAILookup] ✓ API Response received");
          console.log("[usePlantAILookup] Model used:", model);
          console.log("[usePlantAILookup] Content length:", content.length);
          console.log("[usePlantAILookup] ── Full content ──");
          console.log(content);
          console.log("[usePlantAILookup] ──────────────────");
        }

        // 4. Parse JSON response
        if (!content || content.trim().length === 0) {
          const emptyError = "API returned empty response";
          if (isDev) console.error("[usePlantAILookup]", emptyError);
          setAiError(emptyError);
          setAiLoading(false);
          notifyErrorToast({
            id: ERROR_TOAST_IDS.plantAiLookup,
            title: "AI plant lookup failed",
            description: emptyError,
          });
          return;
        }

        if (isDev) console.log("[usePlantAILookup] Parsing JSON response…");
        let parsed: PlantAIResponse;
        try {
          const stripped = content
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "");
          parsed = JSON.parse(stripped);
        } catch (parseError) {
          if (isDev) {
            console.error(
              "[usePlantAILookup] ✗ JSON parse failed:",
              parseError instanceof Error ? parseError.message : parseError,
            );
            console.log(
              "[usePlantAILookup] Full content that failed to parse:",
            );
            console.log(content);
          }
          throw parseError;
        }

        if (isDev) console.log("[usePlantAILookup] ✓ JSON parsed:", parsed);

        if (!isPlantLookupNameMatch(name, parsed.name, settings.locale)) {
          throw new Error(
            `AI returned data for a different plant (requested: ${name}, received: ${parsed.name})`,
          );
        }

        const verified = applyUserVerifiedPlantIdentity(parsed, {
          variety: requestedVariety,
          latinName: requestedLatinName,
          locale: settings.locale,
        });

        // 5. Filter out fields below the rejection threshold
        const filtered = filterLowConfidenceFields(
          verified,
          settings.locale,
          name,
        );
        if (isDev)
          console.log(
            "[usePlantAILookup] ✓ Filtered (low-confidence fields removed):",
            filtered,
          );

        await persistLocalizedRelationshipLabels(filtered, settings.locale);

        // 6. Cache result
        if (isDev) console.log("[usePlantAILookup] Caching result…");
        await cache.set(
          name,
          filtered,
          model,
          requestedLatinName,
          koeppenZone,
          settings.locale,
          requestedVariety,
        );
        if (isDev)
          console.log(
            "[usePlantAILookup] ✓ Cached successfully with model:",
            model,
          );

        setAiResult(filtered);
        setAiModel(model);
        dismissErrorToast(ERROR_TOAST_IDS.plantAiLookup);
      } catch (error) {
        if (isAbortError(error)) {
          // User cancelled — treat as silent, clear loading
          if (isDev) console.log("[usePlantAILookup] Lookup cancelled by user");
          setAiLoading(false);
          return;
        }
        const msg =
          error instanceof Error ? error.message : "Unknown error from AI";
        setAiError(`AI lookup failed: ${msg}`);
        console.error("[usePlantAILookup] Error:", error);
        notifyErrorToast({
          id: ERROR_TOAST_IDS.plantAiLookup,
          title: "AI plant lookup failed",
          error,
          fallback: "Plant details could not be generated.",
        });
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

interface VerifiedPlantIdentityInput {
  variety?: string;
  latinName?: string;
  locale?: string;
}

function normalizeComparableValue(value?: string): string {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/["'`“”‘’]/g, "")
    .replace(/\s+/g, " ") ?? "";
}

function normalizeLatinNameForComparison(value?: string): string {
  return normalizeComparableValue(value).replace(/\./g, "");
}

function areEquivalentLatinNames(left?: string, right?: string): boolean {
  const normalizedLeft = normalizeLatinNameForComparison(left);
  const normalizedRight = normalizeLatinNameForComparison(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = normalizedLeft.split(" ");
  const rightTokens = normalizedRight.split(" ");
  if (leftTokens.length < 2 || rightTokens.length < 2) return false;

  if (leftTokens.slice(1).join(" ") !== rightTokens.slice(1).join(" ")) {
    return false;
  }

  return leftTokens[0][0] === rightTokens[0][0];
}

function proseMentionsValue(prose: string | undefined, value?: string): boolean {
  if (!value) return true;
  return normalizeComparableValue(prose).includes(normalizeComparableValue(value));
}

function appendSentence(prose: string | undefined, sentence: string): string {
  const trimmed = prose?.trim() ?? "";
  if (!trimmed) return sentence;
  if (/[.!?]$/.test(trimmed)) return `${trimmed} ${sentence}`;
  return `${trimmed}. ${sentence}`;
}

function buildVerifiedIdentitySentence(
  field: "description" | "growingTips",
  locale: string | undefined,
  variety?: string,
  latinName?: string,
): string | null {
  if (!variety && !latinName) return null;

  const isDutch = locale?.toLowerCase().startsWith("nl") ?? false;

  if (isDutch) {
    if (field === "description") {
      if (variety && latinName) {
        return `Dit gaat specifiek over ${variety} (${latinName}).`;
      }
      if (variety) {
        return `Dit gaat specifiek over het ras ${variety}.`;
      }
      return `Dit gaat specifiek over ${latinName}.`;
    }

    if (variety && latinName) {
      return `Deze tips gelden specifiek voor ${variety} (${latinName}).`;
    }
    if (variety) {
      return `Deze tips gelden specifiek voor het ras ${variety}.`;
    }
    return `Deze tips gelden specifiek voor ${latinName}.`;
  }

  if (field === "description") {
    if (variety && latinName) {
      return `This entry specifically covers ${variety} (${latinName}).`;
    }
    if (variety) {
      return `This entry specifically covers the ${variety} variety.`;
    }
    return `This entry specifically covers ${latinName}.`;
  }

  if (variety && latinName) {
    return `These tips are specific to ${variety} (${latinName}).`;
  }
  if (variety) {
    return `These tips are specific to the ${variety} variety.`;
  }
  return `These tips are specific to ${latinName}.`;
}

function ensureVerifiedIdentityMention(
  prose: string | undefined,
  field: "description" | "growingTips",
  locale: string | undefined,
  variety?: string,
  latinName?: string,
): string {
  if (proseMentionsValue(prose, variety) && proseMentionsValue(prose, latinName)) {
    return prose ?? "";
  }

  const sentence = buildVerifiedIdentitySentence(
    field,
    locale,
    variety,
    latinName,
  );
  if (!sentence) return prose ?? "";
  return appendSentence(prose, sentence);
}

export function applyUserVerifiedPlantIdentity(
  result: PlantAIResponse,
  input: VerifiedPlantIdentityInput,
): PlantAIResponse {
  const requestedVariety = input.variety?.trim() || undefined;
  const requestedLatinName = input.latinName?.trim() || undefined;

  if (requestedVariety) {
    const returnedVariety = result.variety?.trim();
    if (
      !returnedVariety ||
      normalizeComparableValue(returnedVariety) !==
        normalizeComparableValue(requestedVariety)
    ) {
      throw new Error(
        `AI could not verify the provided variety (provided: ${requestedVariety}, received: ${returnedVariety ?? "none"})`,
      );
    }
  }

  if (
    requestedLatinName &&
    !areEquivalentLatinNames(result.latinName, requestedLatinName)
  ) {
    throw new Error(
      `AI could not verify the provided latin name (provided: ${requestedLatinName}, received: ${result.latinName || "none"})`,
    );
  }

  if (!requestedVariety && !requestedLatinName) {
    return result;
  }

  return {
    ...result,
    variety: requestedVariety ?? result.variety?.trim(),
    latinName: requestedLatinName ?? result.latinName,
    description: ensureVerifiedIdentityMention(
      result.description,
      "description",
      input.locale,
      requestedVariety,
      requestedLatinName,
    ),
    growingTips: ensureVerifiedIdentityMention(
      result.growingTips,
      "growingTips",
      input.locale,
      requestedVariety,
      requestedLatinName,
    ),
  };
}

/**
 * Zero-out fields whose confidence is below the rejection threshold so they
 * don't accidentally overwrite user data with low-quality AI suggestions.
 */
export function filterLowConfidenceFields(
  result: PlantAIResponse,
  locale?: string,
  requestedPlantName?: string,
): FilteredPlantAIResponse {
  const c = result.confidence;
  const selfRefs = new Set<string>();

  if (requestedPlantName) {
    resolvePlantLookupRefs(requestedPlantName, locale).forEach((ref) =>
      selfRefs.add(ref),
    );
  }

  resolvePlantLookupRefs(result.name, locale).forEach((ref) => selfRefs.add(ref));

  const normalizedCompanionLabels =
    (c.localizedCompanionLabels ?? c.companions ?? 1) >= CONFIDENCE.REJECT
      ? normalizeLocalizedLabelMap(result.localizedCompanionLabels, locale)
      : {};
  const normalizedAntagonistLabels =
    (c.localizedAntagonistLabels ?? c.antagonists ?? 1) >=
    CONFIDENCE.REJECT
      ? normalizeLocalizedLabelMap(result.localizedAntagonistLabels, locale)
      : {};
  const companions = stripSelfReferences(
    (c.companions ?? 1) >= CONFIDENCE.REJECT
      ? normalizeRelationshipRefs(
          result.companions,
          normalizedCompanionLabels,
          locale,
        )
      : [],
    selfRefs,
  );
  const antagonists = stripSelfReferences(
    (c.antagonists ?? 1) >= CONFIDENCE.REJECT
      ? normalizeRelationshipRefs(
          result.antagonists,
          normalizedAntagonistLabels,
          locale,
        )
      : [],
    selfRefs,
  );
  const conflictingRefs = new Set(
    companions.filter((ref) => antagonists.includes(ref)),
  );
  const filteredCompanions = companions.filter(
    (ref) => !conflictingRefs.has(ref),
  );
  const filteredAntagonists = antagonists.filter(
    (ref) => !conflictingRefs.has(ref),
  );

  const filtered: FilteredPlantAIResponse = {
    ...result,
    latinName:
      (c.latinName ?? 1) >= CONFIDENCE.REJECT
        ? result.latinName?.trim() || undefined
        : undefined,
    description:
      (c.description ?? 1) >= CONFIDENCE.REJECT
        ? result.description?.trim() || undefined
        : undefined,
    daysToHarvest:
      (c.daysToHarvest ?? 1) >= CONFIDENCE.REJECT
        ? result.daysToHarvest
        : undefined,
    spacingCm:
      (c.spacingCm ?? 1) >= CONFIDENCE.REJECT ? result.spacingCm : undefined,
    sunRequirement:
      (c.sunRequirement ?? 1) >= CONFIDENCE.REJECT
        ? result.sunRequirement
        : undefined,
    watering:
      (c.watering ?? 1) >= CONFIDENCE.REJECT ? result.watering : undefined,
    growingTips:
      (c.growingTips ?? 1) >= CONFIDENCE.REJECT
        ? result.growingTips
        : undefined,
    sowIndoorMonths:
      (c.sowIndoorMonths ?? 1) >= CONFIDENCE.REJECT
        ? result.sowIndoorMonths
        : [],
    sowDirectMonths:
      (c.sowDirectMonths ?? 1) >= CONFIDENCE.REJECT
        ? result.sowDirectMonths
        : [],
    harvestMonths:
      (c.harvestMonths ?? 1) >= CONFIDENCE.REJECT ? result.harvestMonths : [],
    companions: filteredCompanions,
    antagonists: filteredAntagonists,
    localizedCompanionLabels: filterLocalizedLabelMap(
      normalizedCompanionLabels,
      filteredCompanions,
    ),
    localizedAntagonistLabels: filterLocalizedLabelMap(
      normalizedAntagonistLabels,
      filteredAntagonists,
    ),
    icon: (c.icon ?? 0) >= CONFIDENCE.HIGH ? result.icon : undefined,
    color: (c.color ?? 0) >= CONFIDENCE.HIGH ? result.color : undefined,
  };

  return enforceBundledPlantConsistency(requestedPlantName, filtered, locale);
}

function isPlantLookupNameMatch(
  requestedName: string,
  returnedName: string,
  locale?: string,
): boolean {
  if (normalizePlantName(requestedName) === normalizePlantName(returnedName)) {
    return true;
  }

  const requestedRefs = resolvePlantLookupRefs(requestedName, locale);
  const returnedRefs = resolvePlantLookupRefs(returnedName, locale);

  return [...requestedRefs].some((ref) => returnedRefs.has(ref));
}

function resolvePlantLookupRefs(name: string, locale?: string): Set<string> {
  return new Set(
    [normalizePlantReference(name), ...parseLocalizedPlantReferenceList(name, locale)]
      .filter(Boolean),
  );
}

function stripSelfReferences(values: string[], selfRefs: Set<string>): string[] {
  return values.filter((ref) => !selfRefs.has(ref));
}

function normalizeLatinName(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function enforceBundledPlantConsistency(
  requestedPlantName: string | undefined,
  result: FilteredPlantAIResponse,
  locale?: string,
): FilteredPlantAIResponse {
  if (!requestedPlantName || !result.latinName) return result;

  const requestedRefs = resolvePlantLookupRefs(requestedPlantName, locale);
  const bundledMatch = [
    getBundledPlantByMatch({ name: requestedPlantName }),
    ...[...requestedRefs].map((ref) => getBundledPlantByMatch({ id: ref })),
  ].find(Boolean);

  if (!bundledMatch?.latinName) return result;

  if (
    normalizeLatinName(result.latinName) !==
    normalizeLatinName(bundledMatch.latinName)
  ) {
    console.warn(
      `[usePlantAILookup] Dropping latinName "${result.latinName}" because bundled data for "${requestedPlantName}" expects "${bundledMatch.latinName}"`,
    );
    return {
      ...result,
      latinName: undefined,
    };
  }

  return result;
}

function normalizeRelationshipRefs(
  values: string[] | undefined,
  localizedLabels: Record<string, string>,
  locale?: string,
): string[] {
  const knownRefs = getKnownPlantReferences();

  return Array.from(
    new Set(
      parseLocalizedPlantReferenceList((values ?? []).join(", "), locale),
    ),
  ).filter((ref) => {
    if (!isCanonicalPlantReference(ref)) {
      console.warn(
        `[usePlantAILookup] Dropping malformed relationship ref "${ref}"`,
      );
      return false;
    }

    if (knownRefs.has(ref) || localizedLabels[ref]) {
      return true;
    }

    console.warn(
      `[usePlantAILookup] Dropping unknown relationship ref "${ref}" without localized label`,
    );
    return false;
  });
}

function normalizeLocalizedLabelMap(
  labels: Record<string, string> | undefined,
  locale?: string,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  Object.entries(labels ?? {}).forEach(([ref, label]) => {
    const normalizedRef = normalizePlantReference(ref);
    const trimmedLabel = label.trim();
    if (!normalizedRef || !trimmedLabel) return;

    if (locale && hasPlantNameTranslation(normalizedRef, locale)) {
      const existingLabel = getLocalizedPlantReferenceName(normalizedRef, locale);
      if (existingLabel.trim().toLowerCase() !== trimmedLabel.toLowerCase()) {
        console.warn(
          `[usePlantAILookup] Dropping AI label "${trimmedLabel}" for "${normalizedRef}" because the locale bundle already provides "${existingLabel}"`,
        );
      }
      return;
    }

    normalized[normalizedRef] = trimmedLabel;
  });

  return normalized;
}

function filterLocalizedLabelMap(
  labels: Record<string, string>,
  allowedRefs: string[],
): Record<string, string> {
  const allowed = new Set(allowedRefs);
  return Object.fromEntries(
    Object.entries(labels).filter(([ref]) => allowed.has(ref)),
  );
}

async function persistLocalizedRelationshipLabels(
  result: FilteredPlantAIResponse,
  locale?: string,
): Promise<void> {
  const labels: Record<
    string,
    { label: string; confidence?: number; source: "ai" }
  > = {};

  Object.entries(result.localizedCompanionLabels ?? {}).forEach(
    ([ref, label]) => {
      labels[ref] = {
        label,
        confidence:
          result.confidence.localizedCompanionLabels ?? result.confidence.companions,
        source: "ai",
      };
    },
  );

  Object.entries(result.localizedAntagonistLabels ?? {}).forEach(
    ([ref, label]) => {
      labels[ref] = {
        label,
        confidence:
          result.confidence.localizedAntagonistLabels ?? result.confidence.antagonists,
        source: "ai",
      };
    },
  );

  if (Object.keys(labels).length === 0) return;

  await upsertMissingPlantNameOverrides(locale, labels);
}
