import Database, { type Database as BetterDatabase } from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { LOCAL_PROFILE_ID, LOCAL_USER_ID, LOCAL_WORKSPACE_ID } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "garden.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: BetterDatabase = new Database(dbPath);

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function ensureColumn(table: string, column: string, definition: string): void {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureIndex(name: string, sql: string): void {
  db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${sql}`);
}

export function initializeSchema(): void {
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      email_normalized TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email_verified_at TEXT,
      locale TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      consumed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_recovery_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      consumed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_memberships (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

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
      workspaceId TEXT DEFAULT '${LOCAL_WORKSPACE_ID}',
      userId TEXT DEFAULT '${LOCAL_USER_ID}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureColumn("plants", "latinName", "TEXT");
  ensureColumn("plants", "frostSensitive", "INTEGER");
  ensureColumn("plants", "watering", "TEXT");
  ensureColumn("plants", "growingTips", "TEXT");
  ensureColumn("plants", "localizedContent", "TEXT DEFAULT '{}' ");
  ensureColumn("plants", "workspaceId", `TEXT DEFAULT '${LOCAL_WORKSPACE_ID}'`);
  ensureColumn("plants", "userId", `TEXT DEFAULT '${LOCAL_USER_ID}'`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT,
      backgroundColor TEXT,
      profileId TEXT DEFAULT '${LOCAL_PROFILE_ID}',
      workspaceId TEXT DEFAULT '${LOCAL_WORKSPACE_ID}',
      userId TEXT DEFAULT '${LOCAL_USER_ID}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureColumn("areas", "workspaceId", `TEXT DEFAULT '${LOCAL_WORKSPACE_ID}'`);
  ensureColumn("areas", "userId", `TEXT DEFAULT '${LOCAL_USER_ID}'`);

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS seedlings (
      id TEXT PRIMARY KEY,
      plant TEXT NOT NULL,
      plantedDate TEXT NOT NULL,
      seedCount INTEGER NOT NULL,
      location TEXT NOT NULL,
      method TEXT,
      status TEXT NOT NULL,
      workspaceId TEXT DEFAULT '${LOCAL_WORKSPACE_ID}',
      userId TEXT DEFAULT '${LOCAL_USER_ID}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureColumn("seedlings", "workspaceId", `TEXT DEFAULT '${LOCAL_WORKSPACE_ID}'`);
  ensureColumn("seedlings", "userId", `TEXT DEFAULT '${LOCAL_USER_ID}'`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      plant TEXT,
      date TEXT NOT NULL,
      gardenId TEXT,
      note TEXT,
      profileId TEXT DEFAULT '${LOCAL_PROFILE_ID}',
      workspaceId TEXT DEFAULT '${LOCAL_WORKSPACE_ID}',
      userId TEXT DEFAULT '${LOCAL_USER_ID}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureColumn("events", "workspaceId", `TEXT DEFAULT '${LOCAL_WORKSPACE_ID}'`);
  ensureColumn("events", "userId", `TEXT DEFAULT '${LOCAL_USER_ID}'`);

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
      profileId TEXT DEFAULT '${LOCAL_PROFILE_ID}',
      userId TEXT DEFAULT '${LOCAL_USER_ID}',
      workspaceId TEXT DEFAULT '${LOCAL_WORKSPACE_ID}',
      preferredAiMode TEXT DEFAULT 'own-key',
      onboardingCompletedAt TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureColumn("settings", "aiLastValidatedAt", "TEXT");
  ensureColumn("settings", "aiValidationError", "TEXT");
  ensureColumn("settings", "userId", `TEXT DEFAULT '${LOCAL_USER_ID}'`);
  ensureColumn("settings", "workspaceId", `TEXT DEFAULT '${LOCAL_WORKSPACE_ID}'`);
  ensureColumn("settings", "preferredAiMode", "TEXT DEFAULT 'own-key'");
  ensureColumn("settings", "onboardingCompletedAt", "TEXT");

  const settingsExists = db.prepare("SELECT 1 FROM settings WHERE id = 'default'").get();
  if (!settingsExists) {
    db.prepare(
      `
        INSERT INTO settings (id, profileId, userId, workspaceId, preferredAiMode)
        VALUES ('default', ?, ?, ?, 'own-key')
      `,
    ).run(LOCAL_PROFILE_ID, LOCAL_USER_ID, LOCAL_WORKSPACE_ID);
  }

  ensureIndex("idx_auth_sessions_user", "auth_sessions(user_id)");
  ensureIndex("idx_auth_sessions_expires", "auth_sessions(expires_at)");
  ensureIndex("idx_verification_user", "auth_verification_tokens(user_id)");
  ensureIndex("idx_recovery_user", "auth_recovery_tokens(user_id)");
  ensureIndex("idx_workspaces_owner", "workspaces(owner_user_id)");
  ensureIndex("idx_memberships_user", "workspace_memberships(user_id)");
  ensureIndex("idx_plants_workspace", "plants(workspaceId)");
  ensureIndex("idx_areas_workspace", "areas(workspaceId)");
  ensureIndex("idx_seedlings_workspace", "seedlings(workspaceId)");
  ensureIndex("idx_events_workspace", "events(workspaceId)");
  ensureIndex("idx_settings_user", "settings(userId)");
  ensureIndex("idx_settings_workspace", "settings(workspaceId)");

  console.log("✓ Database schema initialized");
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
