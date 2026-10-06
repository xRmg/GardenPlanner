import Database, { type Database as BetterDatabase } from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { initializeSchema as initializeSchemaOn } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "garden.db");

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: BetterDatabase = new Database(dbPath);

/**
 * Initialize database schema.
 * Idempotent — safe to call on every startup.
 */
export function initializeSchema(): void {
  initializeSchemaOn(db);
}

/**
 * Get a database connection.
 * Throws if database is not initialized.
 */
export function getDb(): BetterDatabase {
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
