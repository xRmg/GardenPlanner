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
// Dexie database definition
// ---------------------------------------------------------------------------

class GardenPlannerDB extends Dexie {
  areas!: Table<Area, string>;
  customPlants!: Table<Plant, string>;
  seedlings!: Table<Seedling, string>;
  settings!: Table<{ key: string; value: Settings }, string>;
  events!: Table<GardenEvent, string>;

  constructor() {
    super("GardenPlannerDB");
    this.version(1).stores({
      areas: "id, profileId",
      customPlants: "id, source",
      seedlings: "id",
      settings: "key",
      events: "id, date, profileId",
    });
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DexieRepository implements GardenRepository {
  private db: GardenPlannerDB;

  constructor() {
    this.db = new GardenPlannerDB();
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
