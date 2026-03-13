/**
 * app/data/serverRepository.ts
 *
 * Implements GardenRepository with server-side SQLite persistence.
 *
 * Strategy:
 * - Maintains local Dexie cache for fast reads and offline support
 * - POSTs garden data mutations to /api/garden/sync
 * - Reads and writes settings through dedicated /api/settings endpoints
 * - Gracefully degrades if server is unavailable (keeps local Dexie)
 */

import { DexieRepository } from "./dexieRepository";
import {
  SettingsSchema,
  parseWithDefaults,
  type Area,
  type GardenEvent,
  type Plant,
  type Seedling,
  type Settings,
  type SettingsPatch,
} from "./schema";
import type { GardenRepository } from "./repository";
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  notifyErrorToast,
} from "../lib/asyncErrors";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const API_GARDEN = `${API_BASE}/api/garden`;
const API_SETTINGS = `${API_BASE}/api/settings`;
class ServerRepository implements GardenRepository {
  private dexie: DexieRepository;
  private syncQueued = false;
  private syncPromise: Promise<void> | null = null;

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
      dismissErrorToast(ERROR_TOAST_IDS.startupSync);
      if (import.meta.env.DEV) console.log("✓ Synced from server on startup");
    } catch (error) {
      console.warn(
        "⚠ Server sync on startup failed; using local Dexie only:",
        error,
      );
      notifyErrorToast({
        id: ERROR_TOAST_IDS.startupSync,
        title: "Server sync unavailable",
        error,
        fallback:
          "Using local garden data only until the backend responds again.",
        description:
          "Using local garden data only until the backend responds again.",
      });
      // Still mark as ready — we'll use local Dexie as fallback
    }
  }

  /**
   * Fetch full garden state from server and hydrate local Dexie.
   */
  private async syncFromServer(): Promise<void> {
    const [gardenResponse, settingsResponse] = await Promise.all([
      fetch(API_GARDEN),
      fetch(API_SETTINGS),
    ]);
    if (!gardenResponse.ok) {
      throw new Error(`Garden API returned ${gardenResponse.status}`);
    }
    if (!settingsResponse.ok) {
      throw new Error(`Settings API returned ${settingsResponse.status}`);
    }

    const {
      areas = [],
      plants = [],
      seedlings = [],
      events = [],
    } = (await gardenResponse.json()) as {
      areas?: Area[];
      plants?: Plant[];
      seedlings?: Seedling[];
      events?: GardenEvent[];
    };
    const settings = parseWithDefaults(
      SettingsSchema,
      await settingsResponse.json(),
    );

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
      await Promise.all(
        seedlings.map((s: Seedling) => this.dexie.saveSeedling(s)),
      );
    }

    // Bulk insert events
    if (events.length > 0) {
      await Promise.all(
        events.map((e: GardenEvent) => this.dexie.saveEvent(e)),
      );
    }

    // Save settings
    await this.dexie.saveSettings(settings);
  }

  private buildSettingsPatch(settings: Settings): SettingsPatch {
    return {
      growthZone: settings.growthZone,
      aiModel: settings.aiModel,
      locale: settings.locale,
    };
  }

  private async requestSettings(
    method: "PATCH" | "POST" | "DELETE",
    url: string,
    body?: unknown,
  ): Promise<Settings> {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let message = `Settings request failed: ${response.status}`;
      try {
        const error = (await response.json()) as { error?: string };
        if (error.error) message = error.error;
      } catch {
        // Ignore JSON parse failures — keep the generic status message.
      }
      throw new Error(message);
    }

    const settings = parseWithDefaults(SettingsSchema, await response.json());
    await this.dexie.saveSettings(settings);
    return settings;
  }

  /**
   * POST full garden state to server for persistence.
   * Called after every mutation.
   */
  private async performSyncToServer(): Promise<void> {
    const [areas, plants, seedlings, events] = await Promise.all([
      this.dexie.getAreas(),
      this.dexie.getCustomPlants(),
      this.dexie.getSeedlings(),
      this.dexie.getEvents(),
    ]);

    const allPlants = plants;

    if (import.meta.env.DEV)
      console.log(`[Server Sync] Sending to ${API_GARDEN}/sync:`, {
        areas: areas.length,
        plants: allPlants.length,
        seedlings: seedlings.length,
        events: events.length,
      });

    const response = await fetch(API_GARDEN + "/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        areas,
        plants: allPlants,
        seedlings,
        events,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Local changes were saved, but backend sync failed (${response.status}): ${error}`,
      );
    }

    const result = await response.json();
    if (import.meta.env.DEV) console.log("✓ Server sync successful:", result);
  }

  private async syncToServer(): Promise<void> {
    if (this.syncPromise) {
      console.debug("Sync already in progress, queuing follow-up");
      this.syncQueued = true;
      return this.syncPromise;
    }

    this.syncPromise = (async () => {
      do {
        this.syncQueued = false;
        try {
          await this.performSyncToServer();
        } catch (error) {
          console.error("✗ Failed to sync to server:", error);
          throw error;
        }
      } while (this.syncQueued);
    })().finally(() => {
      this.syncPromise = null;
    });

    return this.syncPromise;
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
    await this.requestSettings(
      "PATCH",
      API_SETTINGS,
      this.buildSettingsPatch(settings),
    );
  }

  async storeAiKey(key: string): Promise<Settings> {
    return this.requestSettings("POST", `${API_SETTINGS}/ai-key`, { key });
  }

  async clearAiKey(): Promise<Settings> {
    return this.requestSettings("DELETE", `${API_SETTINGS}/ai-key`);
  }

  async resolveLocation(query: string): Promise<Settings> {
    return this.requestSettings("POST", `${API_SETTINGS}/location/resolve`, {
      query,
    });
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
