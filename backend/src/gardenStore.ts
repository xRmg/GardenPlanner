import type { Database as BetterDatabase } from "better-sqlite3";

/**
 * Garden state persistence for the SQLite backend.
 *
 * Every row stores a full JSON snapshot of the record in its `data` column,
 * which is authoritative on read. The typed columns are still written so the
 * database stays inspectable, and they are the fallback for rows persisted
 * before the `data` column existed.
 */

type JsonObject = Record<string, unknown>;
type Row = Record<string, any>;

export interface GardenState {
  areas: JsonObject[];
  plants: JsonObject[];
  seedlings: JsonObject[];
  events: JsonObject[];
}

export interface GardenSyncPayload {
  areas?: unknown;
  plants?: unknown;
  seedlings?: unknown;
  events?: unknown;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseSnapshot(row: Row): JsonObject | null {
  const parsed = parseJson<unknown>(row.data, null);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as JsonObject)
    : null;
}

function asObjects(value: unknown): JsonObject[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(
    (item): item is JsonObject =>
      !!item && typeof item === "object" && !Array.isArray(item),
  );
}

// ---------------------------------------------------------------------------
// Legacy row → record mapping (rows without a `data` snapshot)
// ---------------------------------------------------------------------------

function legacyPlant(row: Row): JsonObject {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    latinName: row.latinName || undefined,
    description: row.description || undefined,
    variety: row.variety || undefined,
    daysToHarvest: row.daysToHarvest || undefined,
    isSeed: row.isSeed === 1,
    amount: row.amount === -1 ? undefined : row.amount || 0,
    spacingCm: row.spacingCm || undefined,
    frostHardy: row.frostHardy === 1,
    frostSensitive:
      row.frostSensitive === null || row.frostSensitive === undefined
        ? undefined
        : row.frostSensitive === 1,
    watering: row.watering || undefined,
    growingTips: row.growingTips || undefined,
    localizedContent: parseJson(row.localizedContent, {}),
    companions: parseJson(row.companions, []),
    antagonists: parseJson(row.antagonists, []),
    sowIndoorMonths: parseJson(row.sowIndoorMonths, []),
    sowDirectMonths: parseJson(row.sowDirectMonths, []),
    harvestMonths: parseJson(row.harvestMonths, []),
    sunRequirement: row.sunRequirement || undefined,
    source: row.source || "bundled",
  };
}

function legacyPlanter(row: Row): JsonObject {
  return {
    id: row.id,
    name: row.name,
    rows: row.rows,
    cols: row.cols,
    backgroundColor: row.backgroundColor || undefined,
    tagline: row.tagline || undefined,
    virtualSections: parseJson(row.virtualSections, []),
    squares: parseJson(row.squares, undefined),
  };
}

function legacyArea(row: Row): JsonObject {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline || undefined,
    backgroundColor: row.backgroundColor || undefined,
    profileId: row.profileId || "default",
  };
}

function legacySeedling(row: Row): JsonObject {
  return {
    id: row.id,
    plant: parseJson(row.plant, undefined),
    plantedDate: row.plantedDate,
    seedCount: row.seedCount,
    location: row.location,
    method: row.method || undefined,
    status: row.status,
  };
}

function legacyEvent(row: Row): JsonObject {
  return {
    id: row.id,
    type: row.type,
    plant: parseJson(row.plant, undefined),
    date: row.date,
    gardenId: row.gardenId || undefined,
    note: row.note || undefined,
    profileId: row.profileId || "default",
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function readGardenState(db: BetterDatabase): GardenState {
  const plants = (db.prepare("SELECT * FROM plants").all() as Row[]).map(
    (row) => parseSnapshot(row) ?? legacyPlant(row),
  );

  const plantersByArea = new Map<string, JsonObject[]>();
  for (const row of db
    .prepare("SELECT * FROM planters ORDER BY rowid")
    .all() as Row[]) {
    const planter = parseSnapshot(row) ?? legacyPlanter(row);
    const list = plantersByArea.get(row.areaId) ?? [];
    list.push(planter);
    plantersByArea.set(row.areaId, list);
  }

  const areas = (
    db.prepare("SELECT * FROM areas ORDER BY rowid").all() as Row[]
  ).map((row) => ({
    ...(parseSnapshot(row) ?? legacyArea(row)),
    // Planters live in their own table; the area snapshot excludes them.
    planters: plantersByArea.get(row.id) ?? [],
  }));

  const seedlings = (
    db.prepare("SELECT * FROM seedlings ORDER BY rowid").all() as Row[]
  ).map((row) => parseSnapshot(row) ?? legacySeedling(row));

  const events = (
    db.prepare("SELECT * FROM events ORDER BY date DESC").all() as Row[]
  ).map((row) => parseSnapshot(row) ?? legacyEvent(row));

  return { areas, plants, seedlings, events };
}

// ---------------------------------------------------------------------------
// Write (full replace per provided collection)
// ---------------------------------------------------------------------------

function boolToInt(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  return value ? 1 : 0;
}

export function replaceGardenState(
  db: BetterDatabase,
  payload: GardenSyncPayload,
): void {
  const plants = asObjects(payload.plants);
  const areas = asObjects(payload.areas);
  const seedlings = asObjects(payload.seedlings);
  const events = asObjects(payload.events);

  const transaction = db.transaction(() => {
    if (plants) {
      db.prepare("DELETE FROM plants").run();
      const insertPlant = db.prepare(`
        INSERT INTO plants (
          id, name, color, icon, latinName, description, variety,
          daysToHarvest, isSeed, amount, spacingCm, frostHardy,
          frostSensitive, watering, growingTips, localizedContent,
          companions, antagonists,
          sowIndoorMonths, sowDirectMonths, harvestMonths, sunRequirement, source,
          data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const plant of plants) {
        insertPlant.run(
          plant.id,
          plant.name,
          plant.color,
          plant.icon,
          plant.latinName ?? null,
          plant.description || null,
          plant.variety || null,
          plant.daysToHarvest ?? null,
          plant.isSeed ? 1 : 0,
          plant.amount === undefined ? -1 : plant.amount,
          plant.spacingCm ?? null,
          plant.frostHardy ? 1 : 0,
          boolToInt(plant.frostSensitive),
          plant.watering ?? null,
          plant.growingTips ?? null,
          JSON.stringify(plant.localizedContent || {}),
          JSON.stringify(plant.companions || []),
          JSON.stringify(plant.antagonists || []),
          JSON.stringify(plant.sowIndoorMonths || []),
          JSON.stringify(plant.sowDirectMonths || []),
          JSON.stringify(plant.harvestMonths || []),
          plant.sunRequirement ?? null,
          plant.source ?? "custom",
          JSON.stringify(plant),
        );
      }
    }

    if (areas) {
      db.prepare("DELETE FROM planters").run();
      db.prepare("DELETE FROM areas").run();
      const insertArea = db.prepare(`
        INSERT INTO areas (id, name, tagline, backgroundColor, profileId, data)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insertPlanter = db.prepare(`
        INSERT INTO planters (
          id, areaId, name, rows, cols, backgroundColor, tagline,
          virtualSections, squares, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const area of areas) {
        const { planters, ...areaSnapshot } = area;
        insertArea.run(
          area.id,
          area.name,
          area.tagline || null,
          area.backgroundColor || null,
          area.profileId || "default",
          JSON.stringify(areaSnapshot),
        );
        for (const planter of asObjects(planters) ?? []) {
          insertPlanter.run(
            planter.id,
            area.id,
            planter.name,
            planter.rows,
            planter.cols,
            planter.backgroundColor || null,
            planter.tagline || null,
            JSON.stringify(planter.virtualSections || []),
            planter.squares ? JSON.stringify(planter.squares) : null,
            JSON.stringify(planter),
          );
        }
      }
    }

    if (seedlings) {
      db.prepare("DELETE FROM seedlings").run();
      const insertSeedling = db.prepare(`
        INSERT INTO seedlings (
          id, plant, plantedDate, seedCount, location, method, status, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const seedling of seedlings) {
        insertSeedling.run(
          seedling.id,
          JSON.stringify(seedling.plant),
          seedling.plantedDate,
          seedling.seedCount,
          seedling.location,
          seedling.method || null,
          seedling.status,
          JSON.stringify(seedling),
        );
      }
    }

    if (events) {
      db.prepare("DELETE FROM events").run();
      const insertEvent = db.prepare(`
        INSERT INTO events (id, type, plant, date, gardenId, note, profileId, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const event of events) {
        insertEvent.run(
          event.id,
          event.type,
          event.plant ? JSON.stringify(event.plant) : null,
          event.date,
          event.gardenId || null,
          event.note || null,
          event.profileId || "default",
          JSON.stringify(event),
        );
      }
    }
  });

  transaction();
}
