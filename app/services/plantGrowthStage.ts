/**
 * app/services/plantGrowthStage.ts
 *
 * Auto-derives the growth stage of a PlantInstance from its planting date
 * and the optional daysToFlower / daysToFruit fields on the Plant.
 *
 * Stages (in order):
 *  sprouting   → 0 to 14 days after planting (always — seeds take 2 weeks)
 *  vegetative  → 15 days after planting until daysToFlower (if set)
 *  flowering   → from daysToFlower until daysToFruit (if set)
 *  fruiting    → from daysToFruit onward (harvest window)
 *  dormant     → if no planting date is known, or after daysToHarvest has passed by 30+ days
 *
 * If daysToFlower is not set, stages jump straight from vegetative to fruiting
 * at daysToFruit (if set), or stay vegetative until harvest.
 */

import type { PlantInstance, GrowthStage } from "../data/schema";

/** Minimal plant timeline shape needed for stage derivation. */
export interface PlantTimeline {
  plantingDate?: string;
  plant: {
    daysToHarvest?: number;
    daysToFlower?: number;
    daysToFruit?: number;
  };
}

export function deriveGrowthStage(
  instance: PlantTimeline,
  today: Date = new Date(),
): GrowthStage | null {
  if (!instance.plantingDate) return null;

  const planted = new Date(instance.plantingDate);
  if (isNaN(planted.getTime())) return null;

  const daysElapsed = Math.floor(
    (today.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24),
  );

  const { daysToFlower, daysToFruit, daysToHarvest } = instance.plant;

  // Dead / dormant: well past harvest
  if (daysToHarvest && daysElapsed > daysToHarvest + 30) return "dormant";

  // Sprouting: first two weeks
  if (daysElapsed <= 14) return "sprouting";

  // Fruiting: at daysToFruit, or at daysToHarvest - 14 if no daysToFruit
  const fruitDay = daysToFruit ?? (daysToHarvest ? daysToHarvest - 14 : undefined);
  if (fruitDay !== undefined && daysElapsed >= fruitDay) return "fruiting";

  // Flowering: between daysToFlower and daysToFruit
  if (daysToFlower !== undefined && daysElapsed >= daysToFlower) return "flowering";

  return "vegetative";
}

/**
 * Returns the effective growth stage for a PlantInstance:
 * - Returns the manual override if growthStageOverride is true
 * - Otherwise auto-derives
 */
export function getEffectiveGrowthStage(
  instance: PlantInstance,
  today: Date = new Date(),
): GrowthStage | null {
  if (instance.growthStageOverride && instance.growthStage !== null) {
    return instance.growthStage;
  }
  return deriveGrowthStage(instance, today);
}
