/**
 * app/types.ts
 *
 * Shared local TypeScript types used across the app and its hooks.
 * These are distinct from the Zod-derived schema types in app/data/schema.ts
 * (which are the canonical persistence types). Cast with `as unknown as Schema*`
 * when passing to the repository layer.
 */

import type { Plant, PlantInstance, PlanterSquare } from "./components/PlanterGrid";
import type { VirtualSection } from "./components/PlanterDialog";

export interface Planter {
  id: string;
  name: string;
  rows: number;
  cols: number;
  squares?: PlanterSquare[][];
  virtualSections?: VirtualSection[];
  backgroundColor?: string;
  tagline?: string;
}

export interface Area {
  id: string;
  name: string;
  tagline?: string;
  backgroundColor?: string;
  planters: Planter[];
}

export interface Seedling {
  id: string;
  plant: Plant;
  plantedDate: string;
  seedCount: number;
  location: string;
  method?: "indoor" | "direct-sow";
  status: "germinating" | "growing" | "hardening" | "ready";
}

// Re-export component types so hooks can import from a single location
export type { Plant, PlantInstance, PlanterSquare };
