/**
 * app/data/migration.ts
 *
 * One-time migration from the legacy localStorage keys to Dexie (IndexedDB).
 *
 * Called once on startup (before App initialises state).
 * After a successful migration the localStorage keys are removed so the
 * migration never runs again.
 *
 * Migration flag key: "gp_migrated_to_dexie"
 */

import {
  AreaSchema,
  GardenEventSchema,
  PlantSchema,
  SeedlingSchema,
  SettingsSchema,
  parseWithDefaults,
  safeParse,
} from "./schema";
import type { DexieRepository } from "./dexieRepository";

const LEGACY_KEYS = {
  areas: "gp_areas",
  customPlants: "gp_customPlants",
  seedlings: "gp_seedlings",
  settings: "gp_settings",
  events: "gp_events",
} as const;

const MIGRATED_FLAG = "gp_migrated_to_dexie";

function readLegacyArray<T>(
  key: string,
  parse: (item: unknown, i: number) => T | null,
): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item, i) => {
      const result = parse(item, i);
      return result ? [result] : [];
    });
  } catch {
    return [];
  }
}

/**
 * Migrate legacy localStorage data to Dexie.
 * No-op if already migrated or if there is no legacy data.
 */
export async function migrateLocalStorageToDexie(
  repo: DexieRepository,
): Promise<void> {
  if (localStorage.getItem(MIGRATED_FLAG) === "1") return;

  const areas = readLegacyArray(LEGACY_KEYS.areas, (item, i) =>
    safeParse(AreaSchema, item, `migrate:areas[${i}]`),
  );
  const plants = readLegacyArray(LEGACY_KEYS.customPlants, (item, i) =>
    safeParse(PlantSchema, item, `migrate:customPlants[${i}]`),
  );
  const seedlings = readLegacyArray(LEGACY_KEYS.seedlings, (item, i) =>
    safeParse(SeedlingSchema, item, `migrate:seedlings[${i}]`),
  );
  const events = readLegacyArray(LEGACY_KEYS.events, (item, i) =>
    safeParse(GardenEventSchema, item, `migrate:events[${i}]`),
  );

  let settingsRaw: unknown = {};
  try {
    const raw = localStorage.getItem(LEGACY_KEYS.settings);
    if (raw) settingsRaw = JSON.parse(raw);
  } catch {
    /* use defaults */
  }
  const settings = parseWithDefaults(SettingsSchema, settingsRaw);

  // Write to Dexie
  await Promise.all([
    ...areas.map((a) => repo.saveArea(a)),
    ...plants.map((p) => repo.savePlant(p)),
    ...seedlings.map((s) => repo.saveSeedling(s)),
    ...events.map((e) => repo.saveEvent(e)),
    repo.saveSettings(settings),
  ]);

  // Mark migration complete and clean up legacy keys
  localStorage.setItem(MIGRATED_FLAG, "1");
  Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key));

  console.info("[migration] localStorage → Dexie migration complete.");
}
