import type { Database as BetterDatabase } from "better-sqlite3";

function hasColumn(
  db: BetterDatabase,
  table: string,
  column: string,
): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return rows.some((row) => row.name === column);
}

function ensureColumn(
  db: BetterDatabase,
  table: string,
  column: string,
  definition: string,
): void {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Create tables and apply additive column migrations on `db`.
 * Creates tables if they don't exist.
 * Idempotent — safe to call on every startup.
 */
export function initializeSchema(db: BetterDatabase): void {
  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Plants table (catalogue)
  db.exec(`
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      latinName TEXT,
      description TEXT,
      variety TEXT,
      daysToHarvest INTEGER,
      isSeed INTEGER DEFAULT 0,
      amount INTEGER DEFAULT 0,
      spacingCm REAL,
      frostHardy INTEGER,
      frostSensitive INTEGER,
      watering TEXT,
      growingTips TEXT,
      localizedContent TEXT DEFAULT '{}',
      companions TEXT DEFAULT '[]',
      antagonists TEXT DEFAULT '[]',
      sowIndoorMonths TEXT DEFAULT '[]',
      sowDirectMonths TEXT DEFAULT '[]',
      harvestMonths TEXT DEFAULT '[]',
      sunRequirement TEXT,
      source TEXT DEFAULT 'bundled',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureColumn(db, "plants", "latinName", "TEXT");
  ensureColumn(db, "plants", "frostSensitive", "INTEGER");
  ensureColumn(db, "plants", "watering", "TEXT");
  ensureColumn(db, "plants", "growingTips", "TEXT");
  ensureColumn(db, "plants", "localizedContent", "TEXT DEFAULT '{}' ");

  // Areas table
  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT,
      backgroundColor TEXT,
      profileId TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Planters table
  db.exec(`
    CREATE TABLE IF NOT EXISTS planters (
      id TEXT PRIMARY KEY,
      areaId TEXT NOT NULL,
      name TEXT NOT NULL,
      rows INTEGER NOT NULL,
      cols INTEGER NOT NULL,
      backgroundColor TEXT,
      tagline TEXT,
      virtualSections TEXT DEFAULT '[]',
      squares TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (areaId) REFERENCES areas(id) ON DELETE CASCADE
    );
  `);

  // Seedlings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS seedlings (
      id TEXT PRIMARY KEY,
      plant TEXT NOT NULL,
      plantedDate TEXT NOT NULL,
      seedCount INTEGER NOT NULL,
      location TEXT NOT NULL,
      method TEXT,
      status TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Garden events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      plant TEXT,
      date TEXT NOT NULL,
      gardenId TEXT,
      note TEXT,
      profileId TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Settings table (single row)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      location TEXT DEFAULT '',
      growthZone TEXT DEFAULT 'Cfb',
      aiProvider TEXT DEFAULT '{"type":"none"}',
      aiModel TEXT DEFAULT 'google/gemini-2.0-flash',
      locale TEXT DEFAULT 'en',
      lat REAL,
      lng REAL,
      aiLastValidatedAt TEXT,
      aiValidationError TEXT,
      profileId TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Full-fidelity JSON snapshot of each record. The typed columns above are
  // kept for legacy rows and ad-hoc inspection, but `data` is authoritative so
  // new frontend schema fields survive a round trip without a migration.
  for (const table of ["plants", "areas", "planters", "seedlings", "events"]) {
    ensureColumn(db, table, "data", "TEXT");
  }

  ensureColumn(db, "settings", "aiLastValidatedAt", "TEXT");
  ensureColumn(db, "settings", "aiValidationError", "TEXT");

  // Ensure settings row exists
  const settingsExists = db
    .prepare("SELECT 1 FROM settings WHERE id = 'default'")
    .get();
  if (!settingsExists) {
    db.prepare("INSERT INTO settings (id) VALUES ('default')").run();
  }

}
