import Database, { type Database as BetterDatabase } from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "garden.db");

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: BetterDatabase = new Database(dbPath);

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return rows.some((row) => row.name === column);
}

function ensureColumn(table: string, column: string, definition: string): void {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Initialize database schema.
 * Creates tables if they don't exist.
 * Idempotent — safe to call on every startup.
 */
export function initializeSchema(): void {
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

  ensureColumn("plants", "latinName", "TEXT");
  ensureColumn("plants", "frostSensitive", "INTEGER");
  ensureColumn("plants", "watering", "TEXT");
  ensureColumn("plants", "growingTips", "TEXT");
  ensureColumn("plants", "localizedContent", "TEXT DEFAULT '{}' ");

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

  ensureColumn("settings", "aiLastValidatedAt", "TEXT");
  ensureColumn("settings", "aiValidationError", "TEXT");

  // Ensure settings row exists
  const settingsExists = db
    .prepare("SELECT 1 FROM settings WHERE id = 'default'")
    .get();
  if (!settingsExists) {
    db.prepare("INSERT INTO settings (id) VALUES ('default')").run();
  }

  console.log("✓ Database schema initialized");
}

/**
 * Get a database connection.
 * Throws if database is not initialized.
 */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

/**
 * Close the database connection.
 */
export function closeDb(): void {
  if (db) {
    db.close();
  }
}
