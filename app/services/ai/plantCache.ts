/**
 * app/services/ai/plantCache.ts
 *
 * Two-tier plant data cache:
 *   1. In-memory Map (instant, lost on page refresh)
 *   2. Dexie/IndexedDB (persistent, 30-day TTL)
 *
 * Key format: "name|latinName|koeppenZone" (lowercase, trimmed).
 * Pre-seed with DEFAULT_PLANTS to avoid AI calls for well-known plants.
 */

import { getGardenPlannerDB } from "../../data/dexieRepository";
import type { Plant } from "../../data/schema";
import { normalizePlantName } from "./prompts";
import type { PlantAIResponse } from "./prompts";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------------------------------------------------------------------------
// PlantCache
// ---------------------------------------------------------------------------

export class PlantCache {
  private memCache = new Map<string, { data: PlantAIResponse; timestamp: number; model: string }>();

  private normalizeKey(
    name: string,
    latinName?: string,
    koeppenZone?: string,
  ): string {
    return [normalizePlantName(name), latinName, koeppenZone]
      .filter(Boolean)
      .map((s) => s!.toLowerCase().trim())
      .join("|");
  }

  async get(
    name: string,
    latinName?: string,
    koeppenZone?: string,
  ): Promise<PlantAIResponse | null> {
    const key = this.normalizeKey(name, latinName, koeppenZone);

    // 1. Memory cache
    const mem = this.memCache.get(key);
    if (mem && Date.now() - mem.timestamp <= CACHE_TTL_MS) {
      return mem.data;
    }

    // 2. Dexie cache
    try {
      const db = getGardenPlannerDB();
      const cached = await db.aiPlantCache.get(key);
      if (!cached) return null;
      if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        await db.aiPlantCache.delete(key);
        this.memCache.delete(key);
        return null;
      }
      this.memCache.set(key, {
        data: cached.data as PlantAIResponse,
        timestamp: cached.timestamp,
        model: cached.model,
      });
      return cached.data as PlantAIResponse;
    } catch {
      // IndexedDB unavailable (e.g. tests without a real browser)
      return null;
    }
  }

  async set(
    name: string,
    data: PlantAIResponse,
    model: string,
    latinName?: string,
    koeppenZone?: string,
  ): Promise<void> {
    const key = this.normalizeKey(name, latinName, koeppenZone);
    const entry = { data, timestamp: Date.now(), model };
    this.memCache.set(key, entry);
    try {
      const db = getGardenPlannerDB();
      await db.aiPlantCache.put({ key, ...entry });
    } catch {
      // Persist failure is non-fatal — memory cache still works for the session
    }
  }

  /**
   * Pre-seed from the user's existing custom-plant catalogue so that
   * plants already saved locally skip the AI lookup.
   */
  seedFromPlants(plants: Plant[]): void {
    for (const p of plants) {
      if (!p.latinName) continue;
      const key = this.normalizeKey(p.name, p.latinName);
      if (this.memCache.has(key)) continue;
      // Build a minimal PlantAIResponse from the saved Plant
      const data: PlantAIResponse = {
        name: p.name,
        latinName: p.latinName,
        variety: p.variety,
        description: p.description ?? "",
        daysToHarvest: p.daysToHarvest ?? 60,
        spacingCm: p.spacingCm ?? 30,
        sunRequirement: p.sunRequirement ?? "full",
        sowIndoorMonths: p.sowIndoorMonths ?? [],
        sowDirectMonths: p.sowDirectMonths ?? [],
        harvestMonths: p.harvestMonths ?? [],
        companions: p.companions ?? [],
        antagonists: p.antagonists ?? [],
        icon: p.icon,
        color: p.color,
        confidence: {
          latinName: 1,
          description: 1,
          daysToHarvest: 1,
          spacingCm: 1,
          sunRequirement: 1,
          sowIndoorMonths: 1,
          sowDirectMonths: 1,
          harvestMonths: 1,
          companions: 1,
          antagonists: 1,
          icon: 1,
          color: 1,
        },
      };
      this.memCache.set(key, { data, timestamp: Date.now(), model: "local" });
    }
  }
}

// Singleton
let _cache: PlantCache | null = null;
export function getPlantCache(): PlantCache {
  if (!_cache) _cache = new PlantCache();
  return _cache;
}
