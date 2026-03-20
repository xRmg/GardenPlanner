/**
 * app/services/ai/plantCache.ts
 *
 * Two-tier plant data cache:
 *   1. In-memory Map (instant, lost on page refresh)
 *   2. Dexie/IndexedDB (persistent, 30-day TTL)
 *
 * Key format: "name|variety|requestedLatinName|koeppenZone|locale" (lowercase, trimmed).
 * Pre-seed from the saved plant catalogue to avoid repeated AI calls.
 */

import { getGardenPlannerDB } from "../../data/dexieRepository";
import type { Plant } from "../../data/schema";
import { normalizePlantReference } from "../../lib/plantReferences";
import type { FilteredPlantAIResponse } from "./prompts";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------------------------------------------------------------------------
// PlantCache
// ---------------------------------------------------------------------------

export class PlantCache {
  private memCache = new Map<
    string,
    { data: FilteredPlantAIResponse; timestamp: number; model: string }
  >();

  private normalizeVariety(value?: string): string | undefined {
    const normalized = value?.toLowerCase().trim().replace(/\s+/g, " ");
    return normalized || undefined;
  }

  private normalizeKey(
    name: string,
    requestedLatinName?: string,
    koeppenZone?: string,
    locale?: string,
    variety?: string,
  ): string {
    const normalizedLocale = locale?.split("-")[0]?.toLowerCase() ?? "en";

    return [
      normalizePlantReference(name),
      this.normalizeVariety(variety),
      requestedLatinName,
      koeppenZone,
      normalizedLocale,
    ]
      .filter(Boolean)
      .map((s) => s!.toLowerCase().trim())
      .join("|");
  }

  async get(
    name: string,
    requestedLatinName?: string,
    koeppenZone?: string,
    locale?: string,
    variety?: string,
  ): Promise<FilteredPlantAIResponse | null> {
    const key = this.normalizeKey(
      name,
      requestedLatinName,
      koeppenZone,
      locale,
      variety,
    );

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
        data: cached.data as FilteredPlantAIResponse,
        timestamp: cached.timestamp,
        model: cached.model,
      });
      return cached.data as FilteredPlantAIResponse;
    } catch {
      // IndexedDB unavailable (e.g. tests without a real browser)
      return null;
    }
  }

  async set(
    name: string,
    data: FilteredPlantAIResponse,
    model: string,
    requestedLatinName?: string,
    koeppenZone?: string,
    locale?: string,
    variety?: string,
  ): Promise<void> {
    const key = this.normalizeKey(
      name,
      requestedLatinName,
      koeppenZone,
      locale,
      variety,
    );
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
      const key = this.normalizeKey(
        p.name,
        undefined,
        undefined,
        undefined,
        p.variety,
      );
      if (this.memCache.has(key)) continue;
      // Build a minimal PlantAIResponse from the saved Plant
      const data: FilteredPlantAIResponse = {
        name: p.name,
        latinName: p.latinName,
        variety: p.variety,
        description: p.description ?? "",
        daysToHarvest: p.daysToHarvest ?? 60,
        spacingCm: p.spacingCm ?? 30,
        sunRequirement: p.sunRequirement ?? "full",
        watering: p.watering,
        growingTips: p.growingTips,
        sowIndoorMonths: p.sowIndoorMonths ?? [],
        sowDirectMonths: p.sowDirectMonths ?? [],
        harvestMonths: p.harvestMonths ?? [],
        companions: (p.companions ?? []).map(normalizePlantReference),
        antagonists: (p.antagonists ?? []).map(normalizePlantReference),
        localizedCompanionLabels: {},
        localizedAntagonistLabels: {},
        icon: p.icon,
        color: p.color,
        confidence: {
          latinName: 1,
          description: 1,
          daysToHarvest: 1,
          spacingCm: 1,
          sunRequirement: 1,
          watering: 1,
          growingTips: 1,
          sowIndoorMonths: 1,
          sowDirectMonths: 1,
          harvestMonths: 1,
          companions: 1,
          antagonists: 1,
          localizedCompanionLabels: 1,
          localizedAntagonistLabels: 1,
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
