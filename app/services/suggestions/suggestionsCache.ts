/**
 * app/services/suggestions/suggestionsCache.ts
 *
 * Dexie-backed cache for AI suggestion batches with lifecycle metadata.
 *
 * Key design decisions (LAS.4–LAS.10):
 *
 * - Cache key includes locale + model so English and Dutch batches never collide.
 * - Per-type TTL: fast-changing types (frost, pest, disease) expire in hours;
 *   strategic types (succession, mulch) persist for days.
 * - Every row stores spawnedAt/expiresAt/locale/model/cacheVersion so the UI
 *   and engine can make explicit freshness decisions.
 * - Spawn-aware refresh: getCachedAISuggestions returns the batch plus a
 *   `needsBackgroundRefresh` flag when the batch is still valid but ageing.
 * - Locale switch invalidation: getCachedAISuggestions rejects rows whose
 *   stored locale differs from the requested locale.
 * - Migration safety: the DB v12 upgrade clears all rows without lifecycle
 *   metadata, so stale legacy rows are never served.
 */

import { getGardenPlannerDB } from "../../data/dexieRepository";
import type { AISuggestionContext } from "./types";
import type { SuggestionType } from "../../data/schema";

// ---------------------------------------------------------------------------
// Cache schema version
// Increment whenever the row shape or key algorithm changes so old rows
// are automatically treated as stale.
// ---------------------------------------------------------------------------

export const CACHE_VERSION = 1;

// ---------------------------------------------------------------------------
// Per-type TTL policy (LAS.6)
// ---------------------------------------------------------------------------

/** Fast-changing suggestion types — expire in hours (weather risk, pest). */
const FAST_TTL_HOURS = 6;
/** Medium-changing types — expire in 1 day. */
const MEDIUM_TTL_HOURS = 24;
/** Slow strategic types — expire in 3 days. */
const SLOW_TTL_HOURS = 72;

/**
 * TTL in milliseconds, keyed by suggestion type.
 * Types not listed fall back to MEDIUM_TTL_HOURS.
 */
const TYPE_TTL_MS: Partial<Record<SuggestionType, number>> = {
  // Fast — weather-driven, high urgency
  frost_protect: FAST_TTL_HOURS * 60 * 60 * 1000,
  pest_alert: FAST_TTL_HOURS * 60 * 60 * 1000,
  disease_risk: FAST_TTL_HOURS * 60 * 60 * 1000,
  // Medium — moderate urgency (default)
  harden_seedlings: MEDIUM_TTL_HOURS * 60 * 60 * 1000,
  thin_seedlings: MEDIUM_TTL_HOURS * 60 * 60 * 1000,
  harvest: MEDIUM_TTL_HOURS * 60 * 60 * 1000,
  companion_conflict: MEDIUM_TTL_HOURS * 60 * 60 * 1000,
  // Slow — strategic, rarely time-critical
  succession_sow: SLOW_TTL_HOURS * 60 * 60 * 1000,
  mulch: SLOW_TTL_HOURS * 60 * 60 * 1000,
  end_of_season: SLOW_TTL_HOURS * 60 * 60 * 1000,
  prune: SLOW_TTL_HOURS * 60 * 60 * 1000,
  repot: SLOW_TTL_HOURS * 60 * 60 * 1000,
};

const DEFAULT_TTL_MS = MEDIUM_TTL_HOURS * 60 * 60 * 1000;

/**
 * Returns the effective TTL for a batch of mixed suggestion types.
 * Uses the shortest TTL across all types present — the batch expires as fast
 * as the most time-sensitive suggestion it contains.
 */
export function batchTtlMs(types: SuggestionType[]): number {
  if (types.length === 0) return DEFAULT_TTL_MS;
  return Math.min(
    ...types.map((t) => TYPE_TTL_MS[t] ?? DEFAULT_TTL_MS),
  );
}

/**
 * The fraction of the TTL window that has elapsed before we trigger a
 * background refresh, even if the batch is still technically valid.
 * 0.6 = refresh when 60% of the TTL window has passed.
 */
const BACKGROUND_REFRESH_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Simple deterministic fingerprint (djb2 — not cryptographic)
// ---------------------------------------------------------------------------

function djb2(raw: string): string {
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash.toString(16);
}

/**
 * Build a stable, locale-partitioned cache key from the AI context.
 * Includes locale + model so different locales/models never share rows (LAS.4).
 */
export function buildCacheKey(ctx: AISuggestionContext): string {
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
    ctx.responseLocale,   // LAS.4: locale partition
    ctx.model,            // LAS.4: model partition
    weatherFingerprint,
    plantKeys,
    seedlingKeys,
  ].join("|");

  return `ai-sug-v${CACHE_VERSION}-${djb2(raw)}`;
}

// ---------------------------------------------------------------------------
// Cache result type
// ---------------------------------------------------------------------------

export interface CachedAISuggestionsResult {
  suggestions: unknown[];
  /** True when the batch is still valid but should be refreshed in the background (LAS.9). */
  needsBackgroundRefresh: boolean;
  /** When this batch was spawned (Unix ms). */
  spawnedAt: number;
  /** When this batch expires (Unix ms). */
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the cached AI suggestion batch for the given context, or null if
 * the cache is empty, expired, or belongs to a different locale (LAS.7).
 *
 * Also returns `needsBackgroundRefresh` when the batch is still valid but
 * ageing — the caller can immediately serve the cached result while starting
 * a background refresh (LAS.9).
 */
export async function getCachedAISuggestions(
  ctx: AISuggestionContext,
): Promise<CachedAISuggestionsResult | null> {
  const key = buildCacheKey(ctx);
  const db = getGardenPlannerDB();
  const row = await db.aiSuggestionsCache.get(key);

  if (!row) return null;

  // LAS.7 — locale switch invalidation: reject rows from another locale
  if (row.locale !== ctx.responseLocale) {
    console.debug(
      `[suggestionsCache] Locale mismatch: cached=${row.locale} requested=${ctx.responseLocale} — dropping row`,
    );
    await db.aiSuggestionsCache.delete(key);
    return null;
  }

  // LAS.14 — treat rows lacking cacheVersion as stale
  if (row.cacheVersion === undefined || row.cacheVersion < CACHE_VERSION) {
    console.debug("[suggestionsCache] Stale cacheVersion — dropping row");
    await db.aiSuggestionsCache.delete(key);
    return null;
  }

  const now = Date.now();

  // Hard expiry
  if (now >= row.expiresAt) {
    console.debug(
      `[suggestionsCache] Cache expired (key=${key}, expiresAt=${new Date(row.expiresAt).toISOString()}) — dropping row`,
    );
    await db.aiSuggestionsCache.delete(key);
    return null;
  }

  // LAS.9 — spawn-aware refresh: recommend background refresh past the threshold
  const age = now - row.createdAt;
  const ttl = row.expiresAt - row.createdAt;
  const needsBackgroundRefresh =
    ttl > 0 && age / ttl >= BACKGROUND_REFRESH_THRESHOLD;

  console.debug(
    `[suggestionsCache] Cache hit (key=${key}, locale=${row.locale}, model=${row.model}, ` +
      `age=${Math.round(age / 60_000)}min, needsRefresh=${needsBackgroundRefresh})`,
  );

  return {
    suggestions: row.suggestions,
    needsBackgroundRefresh,
    spawnedAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

/**
 * Store an AI suggestion batch in the cache with full lifecycle metadata.
 * @param types - The suggestion types present in the batch, used to compute TTL.
 */
export async function cacheAISuggestions(
  ctx: AISuggestionContext,
  suggestions: unknown[],
  types: SuggestionType[],
): Promise<void> {
  const key = buildCacheKey(ctx);
  const now = Date.now();
  const ttl = batchTtlMs(types);
  const db = getGardenPlannerDB();

  console.debug(
    `[suggestionsCache] Caching batch (key=${key}, locale=${ctx.responseLocale}, ` +
      `model=${ctx.model}, ttl=${Math.round(ttl / 60_000)}min, count=${suggestions.length})`,
  );

  await db.aiSuggestionsCache.put({
    id: key,
    suggestions,
    createdAt: now,
    expiresAt: now + ttl,
    locale: ctx.responseLocale,
    model: ctx.model,
    cacheVersion: CACHE_VERSION,
  });
}

/**
 * Clear all AI suggestion caches.
 */
export async function clearAISuggestionsCache(): Promise<void> {
  const db = getGardenPlannerDB();
  await db.aiSuggestionsCache.clear();
}

/**
 * Invalidate cache entries for a specific locale.
 * Used when the user's locale changes (LAS.7, LAS.10).
 */
export async function invalidateAISuggestionsByLocale(
  locale: string,
): Promise<void> {
  const db = getGardenPlannerDB();
  await db.aiSuggestionsCache.where("locale").equals(locale).delete();
  console.debug(`[suggestionsCache] Invalidated cache for locale=${locale}`);
}
