/**
 * app/services/suggestions/suggestionsCache.ts
 *
 * Dexie-backed 24-hour cache for AI suggestion batches.
 *
 * Cache key is a deterministic hash of the context inputs so that
 * semantically identical requests reuse the same result.
 */

import { getGardenPlannerDB } from "../../data/dexieRepository";
import type { AISuggestionContext } from "./types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Simple deterministic fingerprint (not a cryptographic hash)
// ---------------------------------------------------------------------------

/**
 * Build a stable cache key from the AI context.
 * Uses only the fields that actually affect suggestion quality.
 */
function buildCacheKey(ctx: AISuggestionContext): string {
  const plantKeys = ctx.plants
    .map((p) => `${p.name}@${p.planterName}`)
    .sort()
    .join(",");
  const seedlingKeys = ctx.seedlings
    .map((s) => `${s.name}:${s.status}`)
    .sort()
    .join(",");
  const weatherFingerprint = ctx.weather
    ? `${Math.round(ctx.weather.todayTempMaxC)}|${Math.round(ctx.weather.next7DaysTotalPrecipMm / 5) * 5}`
    : "no-weather";
  const raw = [
    ctx.koeppenZone,
    ctx.hemisphere,
    ctx.currentMonth,
    ctx.responseLocale,
    weatherFingerprint,
    plantKeys,
    seedlingKeys,
  ].join("|");

  // Simple djb2 hash — not cryptographic, just deterministic
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0; // keep it unsigned 32-bit
  }
  return `ai-sug-${hash.toString(16)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns cached AI suggestions for the given context, or null if the
 * cache is empty or expired.
 */
export async function getCachedAISuggestions(
  ctx: AISuggestionContext,
): Promise<unknown[] | null> {
  const key = buildCacheKey(ctx);
  const db = getGardenPlannerDB();
  const row = await db.aiSuggestionsCache.get(key);
  if (!row) return null;
  if (Date.now() - row.createdAt > CACHE_TTL_MS) {
    await db.aiSuggestionsCache.delete(key);
    return null;
  }
  return row.suggestions;
}

/**
 * Store AI suggestions in the cache.
 */
export async function cacheAISuggestions(
  ctx: AISuggestionContext,
  suggestions: unknown[],
): Promise<void> {
  const key = buildCacheKey(ctx);
  const db = getGardenPlannerDB();
  await db.aiSuggestionsCache.put({
    id: key,
    suggestions,
    createdAt: Date.now(),
  });
}

/**
 * Clear all AI suggestion caches.
 */
export async function clearAISuggestionsCache(): Promise<void> {
  const db = getGardenPlannerDB();
  await db.aiSuggestionsCache.clear();
}
