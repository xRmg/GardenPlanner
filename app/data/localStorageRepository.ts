/**
 * app/data/localStorageRepository.ts
 *
 * GardenRepository implementation backed by localStorage.
 *
 * This wraps the existing behaviour of App.tsx exactly, but routes all
 * reads and writes through the GardenRepository interface and validates
 * every payload against the Zod schemas.
 *
 * Storage keys (unchanged from the original app):
 *   gp_areas         — Area[]
 *   gp_customPlants  — Plant[]
 *   gp_seedlings     — Seedling[]
 *   gp_settings      — Settings
 *   gp_events        — GardenEvent[]  ← NEW: fixes Bug 6.11
 *
 * Lifecycle:
 *   This implementation is intentionally kept simple — no batching, no
 *   transactions. It is the "bridge" that keeps the app working identically
 *   while DexieRepository is being built (Task 1.3).
 *
 * Thread safety:
 *   localStorage is synchronous and single-threaded in the browser, so
 *   the naive read-modify-write pattern below is safe.
 */

import {
  AreaSchema,
  GardenEventSchema,
  PlantSchema,
  SeedlingSchema,
  SettingsSchema,
  parseWithDefaults,
  safeParse,
  type Area,
  type GardenEvent,
  type Plant,
  type Seedling,
  type Settings,
} from "./schema";
import type { GardenRepository } from "./repository";

// ---------------------------------------------------------------------------
// Storage key constants
// ---------------------------------------------------------------------------

const KEYS = {
  areas: "gp_areas",
  customPlants: "gp_customPlants",
  seedlings: "gp_seedlings",
  settings: "gp_settings",
  events: "gp_events",
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read and JSON-parse a localStorage key.
 * Returns `null` on missing key or parse error.
 */
function readRaw(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Serialize `value` to JSON and write to localStorage.
 * Logs a warning on quota or serialisation errors instead of swallowing them.
 */
function writeRaw(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[localStorage] Failed to write key "${key}":`, err);
  }
}

/**
 * Read and validate an array of records.
 * Each item is parsed individually — corrupt items are dropped with a warning
 * instead of discarding the entire array.
 */
function readArray<T>(
  key: string,
  parse: (item: unknown, index: number) => T | null,
): T[] {
  const raw = readRaw(key);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, i) => {
    const parsed = parse(item, i);
    return parsed !== null ? [parsed] : [];
  });
}

/**
 * Generic upsert: replace the item with matching `id`, or push if absent.
 */
function upsert<T extends { id: string }>(items: T[], next: T): T[] {
  const idx = items.findIndex((x) => x.id === next.id);
  if (idx === -1) return [...items, next];
  const result = [...items];
  result[idx] = next;
  return result;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class LocalStorageRepository implements GardenRepository {
  /** Synchronous store — always ready. */
  async ready(): Promise<void> {
    // Nothing to initialise for localStorage.
  }

  // ── Areas ────────────────────────────────────────────────────────────────

  async getAreas(): Promise<Area[]> {
    return readArray(KEYS.areas, (item, i) =>
      safeParse(AreaSchema, item, `areas[${i}]`),
    );
  }

  async saveArea(area: Area): Promise<void> {
    const current = await this.getAreas();
    writeRaw(KEYS.areas, upsert(current, area));
  }

  async deleteArea(id: string): Promise<void> {
    const current = await this.getAreas();
    writeRaw(
      KEYS.areas,
      current.filter((a) => a.id !== id),
    );
  }

  // ── Custom plants ────────────────────────────────────────────────────────

  async getCustomPlants(): Promise<Plant[]> {
    return readArray(KEYS.customPlants, (item, i) =>
      safeParse(PlantSchema, item, `customPlants[${i}]`),
    );
  }

  async savePlant(plant: Plant): Promise<void> {
    const current = await this.getCustomPlants();
    writeRaw(KEYS.customPlants, upsert(current, plant));
  }

  async deletePlant(id: string): Promise<void> {
    const current = await this.getCustomPlants();
    writeRaw(
      KEYS.customPlants,
      current.filter((p) => p.id !== id),
    );
  }

  // ── Seedlings ────────────────────────────────────────────────────────────

  async getSeedlings(): Promise<Seedling[]> {
    return readArray(KEYS.seedlings, (item, i) =>
      safeParse(SeedlingSchema, item, `seedlings[${i}]`),
    );
  }

  async saveSeedling(seedling: Seedling): Promise<void> {
    const current = await this.getSeedlings();
    writeRaw(KEYS.seedlings, upsert(current, seedling));
  }

  async deleteSeedling(id: string): Promise<void> {
    const current = await this.getSeedlings();
    writeRaw(
      KEYS.seedlings,
      current.filter((s) => s.id !== id),
    );
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<Settings> {
    const raw = readRaw(KEYS.settings);
    // parseWithDefaults merges stored partial data with schema defaults —
    // so adding new settings fields in a future release never crashes.
    return parseWithDefaults(SettingsSchema, raw ?? {});
  }

  async saveSettings(settings: Settings): Promise<void> {
    writeRaw(KEYS.settings, settings);
  }

  // ── Events ───────────────────────────────────────────────────────────────

  async getEvents(): Promise<GardenEvent[]> {
    const events = readArray(KEYS.events, (item, i) =>
      safeParse(GardenEventSchema, item, `events[${i}]`),
    );
    // Newest first, consistent with EventsBar render order.
    return events.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  async saveEvent(event: GardenEvent): Promise<void> {
    const current = await this.getEvents();
    writeRaw(KEYS.events, upsert(current, event));
  }

  async deleteEvent(id: string): Promise<void> {
    const current = await this.getEvents();
    writeRaw(
      KEYS.events,
      current.filter((e) => e.id !== id),
    );
  }

  // ── Maintenance ───────────────────────────────────────────────────────────

  async clearAll(): Promise<void> {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: LocalStorageRepository | null = null;

/**
 * Returns the shared LocalStorageRepository instance.
 * Call `await repo.ready()` before the first read/write.
 */
export function getLocalStorageRepository(): LocalStorageRepository {
  if (!_instance) _instance = new LocalStorageRepository();
  return _instance;
}
