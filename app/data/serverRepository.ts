/**
 * app/data/serverRepository.ts
 *
 * Implements GardenRepository with server-side SQLite persistence.
 * 
 * Strategy:
 * - Maintains local Dexie cache for fast reads and offline support
 * - POSTs full garden state to /api/garden/sync on every mutation
 * - Syncs server state on app startup via GET /api/garden
 * - Gracefully degrades if server is unavailable (keeps local Dexie)
 */

import { DexieRepository } from "./dexieRepository";
import type {
  Area,
  GardenEvent,
  Plant,
  Seedling,
  Settings,
} from "./schema";
import type { GardenRepository } from "./repository";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const API_GARDEN = `${API_BASE}/api/garden`;

class ServerRepository implements GardenRepository {
  private dexie: DexieRepository;
  private syncInProgress = false;

  constructor() {
    this.dexie = new DexieRepository();
  }

  /**
   * Initialize: open local Dexie, then sync from server if available.
   */
  async ready(): Promise<void> {
    // Open local Dexie first
    await this.dexie.ready();

    // Try to sync from server on startup
    try {
      await this.syncFromServer();
      console.log("✓ Synced from server on startup");
    } catch (error) {
      console.warn(
        "⚠ Server sync on startup failed; using local Dexie only:",
        error,
      );
      // Still mark as ready — we'll use local Dexie as fallback
    }
  }

  /**
   * Fetch full garden state from server and hydrate local Dexie.
   */
  private async syncFromServer(): Promise<void> {
    const response = await fetch(API_GARDEN);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const {
      areas = [],
      plants = [],
      seedlings = [],
      events = [],
      settings,
    } = await response.json() as {
      areas?: Area[];
      plants?: Plant[];
      seedlings?: Seedling[];
      events?: GardenEvent[];
      settings?: Settings;
    };

    // Clear local Dexie and repopulate from server
    await this.dexie.clearAll();

    // Bulk insert plants
    if (plants.length > 0) {
      await Promise.all(plants.map((p: Plant) => this.dexie.savePlant(p)));
    }

    // Bulk insert areas (with planters)
    if (areas.length > 0) {
      await Promise.all(areas.map((a: Area) => this.dexie.saveArea(a)));
    }

    // Bulk insert seedlings
    if (seedlings.length > 0) {
      await Promise.all(seedlings.map((s: Seedling) => this.dexie.saveSeedling(s)));
    }

    // Bulk insert events
    if (events.length > 0) {
      await Promise.all(events.map((e: GardenEvent) => this.dexie.saveEvent(e)));
    }

    // Save settings
    if (settings) {
      await this.dexie.saveSettings(settings);
    }
  }

  /**
   * POST full garden state to server for persistence.
   * Called after every mutation.
   */
  private async syncToServer(): Promise<void> {
    if (this.syncInProgress) {
      console.debug("Sync already in progress, skipping");
      return;
    }

    this.syncInProgress = true;
    try {
      const [areas, plants, seedlings, events, settings] = await Promise.all([
        this.dexie.getAreas(),
        this.dexie.getCustomPlants(),
        this.dexie.getSeedlings(),
        this.dexie.getEvents(),
        this.dexie.getSettings(),
      ]);

      // Also fetch bundled plants from app state
      // For now, we'll just send custom plants — backend will merge on startup
      const allPlants = plants;

      console.log(
        `[Server Sync] Sending to ${API_GARDEN}/sync:`,
        { areas: areas.length, plants: allPlants.length, seedlings: seedlings.length, events: events.length }
      );

      const response = await fetch(API_GARDEN + "/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areas,
          plants: allPlants,
          seedlings,
          events,
          settings,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Server sync failed: ${response.status} - ${error}`);
      }

      const result = await response.json();
      console.log("✓ Server sync successful:", result);
    } catch (error) {
      console.error("✗ Failed to sync to server:", error);
      // Emit event or show toast here if needed
      // For now, just log — local Dexie is safe
    } finally {
      this.syncInProgress = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Areas
  // ─────────────────────────────────────────────────────────────────────────

  async getAreas(): Promise<Area[]> {
    return this.dexie.getAreas();
  }

  async saveArea(area: Area): Promise<void> {
    await this.dexie.saveArea(area);
    await this.syncToServer();
  }

  async deleteArea(id: string): Promise<void> {
    await this.dexie.deleteArea(id);
    await this.syncToServer();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Custom Plants
  // ─────────────────────────────────────────────────────────────────────────

  async getCustomPlants(): Promise<Plant[]> {
    return this.dexie.getCustomPlants();
  }

  async savePlant(plant: Plant): Promise<void> {
    await this.dexie.savePlant(plant);
    await this.syncToServer();
  }

  async deletePlant(id: string): Promise<void> {
    await this.dexie.deletePlant(id);
    await this.syncToServer();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Seedlings
  // ─────────────────────────────────────────────────────────────────────────

  async getSeedlings(): Promise<Seedling[]> {
    return this.dexie.getSeedlings();
  }

  async saveSeedling(seedling: Seedling): Promise<void> {
    await this.dexie.saveSeedling(seedling);
    await this.syncToServer();
  }

  async deleteSeedling(id: string): Promise<void> {
    await this.dexie.deleteSeedling(id);
    await this.syncToServer();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────────────────

  async getSettings(): Promise<Settings> {
    return this.dexie.getSettings();
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.dexie.saveSettings(settings);
    await this.syncToServer();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────────────────

  async getEvents(): Promise<GardenEvent[]> {
    return this.dexie.getEvents();
  }

  async saveEvent(event: GardenEvent): Promise<void> {
    await this.dexie.saveEvent(event);
    await this.syncToServer();
  }

  async deleteEvent(id: string): Promise<void> {
    await this.dexie.deleteEvent(id);
    await this.syncToServer();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Maintenance
  // ─────────────────────────────────────────────────────────────────────────

  async clearAll(): Promise<void> {
    await this.dexie.clearAll();
    // Don't sync to server on clear — this is for testing/migration only
  }
}

export function createServerRepository(): GardenRepository {
  return new ServerRepository();
}
