/**
 * app/data/repository.ts
 *
 * GardenRepository — the single data-access contract for the entire app.
 *
 * All UI code (hooks, components) talks to this interface only.
 * Swap the implementation (localStorage → Dexie → Supabase) without
 * touching any UI code.
 *
 * Implementations:
 *   LocalStorageRepository  — wraps current gp_* keys (Phase 0 / bridge)
 *   DexieRepository         — IndexedDB via Dexie v4 (Phase 1, Task 1.3)
 *   SupabaseRepository      — Postgres + Dexie local cache (Phase 3)
 */

import type { Area, GardenEvent, Plant, Seedling, Settings } from "./schema";

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface GardenRepository {
  /**
   * Resolves when the underlying store is ready to accept reads/writes.
   * - localStorage: resolves immediately
   * - Dexie: resolves after Dexie.open()
   * Call this once on app startup before any other method.
   */
  ready(): Promise<void>;

  // ── Areas ────────────────────────────────────────────────────────────────
  /** Return all areas for the current profile. */
  getAreas(): Promise<Area[]>;
  /**
   * Insert or update a single area.
   * Matched by `area.id`. Creates if not found.
   */
  saveArea(area: Area): Promise<void>;
  /** Remove an area (and all its nested planters/squares) by id. */
  deleteArea(id: string): Promise<void>;

  // ── Custom plants ────────────────────────────────────────────────────────
  /**
   * Return all user-defined plants (source: 'custom').
   * Does NOT include bundled DEFAULT_PLANTS — those live in the app bundle.
   */
  getCustomPlants(): Promise<Plant[]>;
  /** Insert or update a custom plant. Matched by `plant.id`. */
  savePlant(plant: Plant): Promise<void>;
  /** Remove a custom plant by id. */
  deletePlant(id: string): Promise<void>;

  // ── Seedlings ────────────────────────────────────────────────────────────
  /** Return all seedling batches. */
  getSeedlings(): Promise<Seedling[]>;
  /** Insert or update a seedling batch. Matched by `seedling.id`. */
  saveSeedling(seedling: Seedling): Promise<void>;
  /** Remove a seedling batch by id. */
  deleteSeedling(id: string): Promise<void>;

  // ── Settings ─────────────────────────────────────────────────────────────
  /**
   * Return persisted settings, merged with schema defaults for any missing
   * fields (e.g. after an app upgrade adds a new setting).
   * Never returns null — falls back to defaults if nothing is stored.
   */
  getSettings(): Promise<Settings>;
  /** Persist the full settings object. */
  saveSettings(settings: Settings): Promise<void>;

  // ── Events ───────────────────────────────────────────────────────────────
  /**
   * Return all garden events, newest first.
   * Fixes Bug 6.11: events were stored only in useState and lost on refresh.
   */
  getEvents(): Promise<GardenEvent[]>;
  /** Insert or update an event. Matched by `event.id`. */
  saveEvent(event: GardenEvent): Promise<void>;
  /** Remove an event by id. */
  deleteEvent(id: string): Promise<void>;

  // ── Migration / maintenance ───────────────────────────────────────────────
  /**
   * Wipe all persisted data. Used by:
   * - The localStorage → Dexie migration (after confirmed copy).
   * - Tests.
   * Not exposed in any UI.
   */
  clearAll(): Promise<void>;
}
