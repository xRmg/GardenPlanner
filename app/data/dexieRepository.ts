/**
 * app/data/dexieRepository.ts
 *
 * GardenRepository implementation backed by IndexedDB via Dexie v4.
 *
 * This replaces LocalStorageRepository as the active store and fixes:
 *   - Bug 6.11: Events were lost on page refresh (now in a Dexie table)
 *   - Bug 6.12: Plant placements (squares) were lost on page refresh
 *                (squares are part of the Area object stored in Dexie)
 *
 * Database name: GardenPlannerDB
 * Version:       1
 *
 * Tables:
 *   areas         — Area objects (with nested planters + squares)
 *   customPlants  — User-created Plant objects
 *   seedlings     — Seedling batch records
 *   settings      — Single-row settings (key: "singleton")
 *   events        — GardenEvent records
 */

import Dexie, { type Table } from "dexie";
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
// AI plant cache row type
// ---------------------------------------------------------------------------

export interface AiPlantCacheRow {
  /** Normalised cache key: "name|latinName|koeppenZone" (lowercase, trimmed). */
  key: string;
  /** AI-generated plant data. Typed as `unknown` to keep the repository layer
   *  free of a dependency on the AI service types. Callers cast to PlantAIResponse. */
  data: unknown;
  timestamp: number;
  model: string;
}

// ---------------------------------------------------------------------------
// Dexie database definition
// ---------------------------------------------------------------------------

export class GardenPlannerDB extends Dexie {
  areas!: Table<Area, string>;
  customPlants!: Table<Plant, string>;
  seedlings!: Table<Seedling, string>;
  settings!: Table<{ key: string; value: Settings }, string>;
  events!: Table<GardenEvent, string>;
  aiPlantCache!: Table<AiPlantCacheRow, string>;

  constructor() {
    super("GardenPlannerDB");
    this.version(1).stores({
      areas: "id, profileId",
      customPlants: "id, source",
      seedlings: "id",
      settings: "key",
      events: "id, date, profileId",
    });
    // v2: placeholder (upgrade ran before migration was written — no-op)
    this.version(2).stores({});
    // v3: migrate virtualSection start/end from 0-based half-open [start, end)
    //     to 1-based closed [start, end].
    //     Conversion: new_start = old_start + 1, new_end unchanged.
    this.version(3).upgrade((trans) => {
      console.info(
        "[DB] Running v3 migration: fixing virtualSection start values",
      );
      return trans
        .table("areas")
        .toCollection()
        .modify((area: Record<string, unknown>) => {
          const planters = area.planters as
            | Array<Record<string, unknown>>
            | undefined;
          for (const planter of planters ?? []) {
            const sections = planter.virtualSections as
              | Array<Record<string, number>>
              | undefined;
            for (const section of sections ?? []) {
              if (section.start === 0) {
                section.start = 1;
              }
            }
          }
        });
    });
    // v4: add missing planter ids (planters were saved before id field existed)
    this.version(4).upgrade((trans) => {
      console.info("[DB] Running v4 migration: adding missing planter ids");
      return trans
        .table("areas")
        .toCollection()
        .modify((area: Record<string, unknown>) => {
          const planters = area.planters as
            | Array<Record<string, unknown>>
            | undefined;
          for (const planter of planters ?? []) {
            if (!planter.id) {
              planter.id = crypto.randomUUID();
            }
          }
        });
    });
    // v5: fix planters saved with id: undefined (spread-order bug in handleSavePlanter)
    this.version(5).upgrade((trans) => {
      console.info("[DB] Running v5 migration: fixing planters with undefined id");
      return trans
        .table("areas")
        .toCollection()
        .modify((area: Record<string, unknown>) => {
          const planters = area.planters as
            | Array<Record<string, unknown>>
            | undefined;
          for (const planter of planters ?? []) {
            if (planter.id === undefined || planter.id === null) {
              planter.id = crypto.randomUUID();
            }
          }
        });
    });
    // v6: add aiPlantCache table for caching AI-generated plant data (30-day TTL)
    this.version(6).stores({
      aiPlantCache: "key, timestamp",
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton DB instance (shared across DexieRepository and AI services)
// ---------------------------------------------------------------------------

let _db: GardenPlannerDB | null = null;

/**
 * Returns the shared GardenPlannerDB instance.
 * Used by DexieRepository and the AI plant cache service.
 */
export function getGardenPlannerDB(): GardenPlannerDB {
  if (!_db) _db = new GardenPlannerDB();
  return _db;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DexieRepository implements GardenRepository {
  private db: GardenPlannerDB;

  constructor() {
    this.db = getGardenPlannerDB();
  }

  async ready(): Promise<void> {
    await this.db.open();
  }

  // ── Areas ────────────────────────────────────────────────────────────────

  async getAreas(): Promise<Area[]> {
    const rows = await this.db.areas.toArray();
    return rows.flatMap((row, i) => {
      const parsed = safeParse(AreaSchema, row, `areas[${i}]`);
      return parsed ? [parsed] : [];
    });
  }

  async saveArea(area: Area): Promise<void> {
    await this.db.areas.put(area);
  }

  async deleteArea(id: string): Promise<void> {
    await this.db.areas.delete(id);
  }

  // ── Custom plants ────────────────────────────────────────────────────────

  async getCustomPlants(): Promise<Plant[]> {
    const rows = await this.db.customPlants.toArray();
    return rows.flatMap((row, i) => {
      const parsed = safeParse(PlantSchema, row, `customPlants[${i}]`);
      return parsed ? [parsed] : [];
    });
  }

  async savePlant(plant: Plant): Promise<void> {
    await this.db.customPlants.put(plant);
  }

  async deletePlant(id: string): Promise<void> {
    await this.db.customPlants.delete(id);
  }

  // ── Seedlings ────────────────────────────────────────────────────────────

  async getSeedlings(): Promise<Seedling[]> {
    const rows = await this.db.seedlings.toArray();
    return rows.flatMap((row, i) => {
      const parsed = safeParse(SeedlingSchema, row, `seedlings[${i}]`);
      return parsed ? [parsed] : [];
    });
  }

  async saveSeedling(seedling: Seedling): Promise<void> {
    await this.db.seedlings.put(seedling);
  }

  async deleteSeedling(id: string): Promise<void> {
    await this.db.seedlings.delete(id);
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<Settings> {
    const row = await this.db.settings.get("singleton");
    return parseWithDefaults(SettingsSchema, row?.value ?? {});
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.settings.put({ key: "singleton", value: settings });
  }

  // ── Events ───────────────────────────────────────────────────────────────

  async getEvents(): Promise<GardenEvent[]> {
    const rows = await this.db.events.toArray();
    const parsed = rows.flatMap((row, i) => {
      const p = safeParse(GardenEventSchema, row, `events[${i}]`);
      return p ? [p] : [];
    });
    // Newest first
    return parsed.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  async saveEvent(event: GardenEvent): Promise<void> {
    await this.db.events.put(event);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.db.events.delete(id);
  }

  // ── Maintenance ───────────────────────────────────────────────────────────

  async clearAll(): Promise<void> {
    await Promise.all([
      this.db.areas.clear(),
      this.db.customPlants.clear(),
      this.db.seedlings.clear(),
      this.db.settings.clear(),
      this.db.events.clear(),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: DexieRepository | null = null;

/**
 * Returns the shared DexieRepository instance.
 * Call `await repo.ready()` once before the first read/write.
 */
export function getDexieRepository(): DexieRepository {
  if (!_instance) _instance = new DexieRepository();
  return _instance;
}
