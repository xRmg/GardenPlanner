/**
 * app/data/schema.ts
 *
 * Single source of truth for all Garden Planner data shapes.
 * Zod schemas are used for:
 *   - Runtime validation when loading data from Dexie / localStorage
 *   - TypeScript type inference (no separate interface files needed)
 *   - Parsing and sanitising AI responses
 *
 * All interfaces previously scattered across App.tsx, PlanterGrid.tsx,
 * EventsBar.tsx, and PlanterDialog.tsx are replaced by the inferred
 * types at the bottom of this file.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives & shared enums
// ---------------------------------------------------------------------------

export const SunRequirementSchema = z.enum(["full", "partial", "shade"]);
export const SeedlingStatusSchema = z.enum([
  "germinating",
  "growing",
  "hardening",
  "ready",
]);
export const GardenEventTypeSchema = z.enum([
  "planted",
  "watered",
  "composted",
  "weeded",
  "harvested",
  "sown",
  "sprouted",
]);
export const SuggestionTypeSchema = z.enum([
  "water",
  "harvest",
  "repot",
  "compost",
  "weed",
]);
export const PrioritySchema = z.enum(["low", "medium", "high"]);

/**
 * Where a plant record originated.
 * Determines whether it can be overwritten on a shared library sync.
 */
export const PlantSourceSchema = z.enum(["bundled", "synced", "custom"]);

// ---------------------------------------------------------------------------
// VirtualSection — a named row/column band within a Planter
// (previously exported from PlanterDialog.tsx)
// ---------------------------------------------------------------------------

export const VirtualSectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(["rows", "columns"]),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  color: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Plant — a species/variety in the plant catalogue
// (previously exported from PlanterGrid.tsx)
// ---------------------------------------------------------------------------

export const PlantSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string(),
  icon: z.string(),
  description: z.string().optional(),
  variety: z.string().optional(),
  daysToHarvest: z.number().int().positive().optional(),
  isSeed: z.boolean().default(false),
  /** Current stock count (seeds). */
  amount: z.number().int().min(0).optional(),
  spacingCm: z.number().positive().optional(),
  frostHardy: z.boolean().optional(),
  companions: z.array(z.string()).default([]),
  antagonists: z.array(z.string()).default([]),
  sowIndoorMonths: z.array(z.number().int().min(1).max(12)).default([]),
  sowDirectMonths: z.array(z.number().int().min(1).max(12)).default([]),
  harvestMonths: z.array(z.number().int().min(1).max(12)).default([]),
  sunRequirement: SunRequirementSchema.optional(),
  /** Origin of this record — controls sync overwrite behaviour. */
  source: PlantSourceSchema.default("bundled"),
});

// ---------------------------------------------------------------------------
// PestEvent — a logged pest or treatment on a PlantInstance
// ---------------------------------------------------------------------------

export const PestEventSchema = z.object({
  id: z.string(),
  date: z.string().datetime({ offset: true }),
  type: z.enum(["pest", "treatment"]),
  description: z.string(),
});

// ---------------------------------------------------------------------------
// PlantInstance — a specific plant placed in a Planter square
// ---------------------------------------------------------------------------

export const PlantInstanceSchema = z.object({
  instanceId: z.string(),
  plant: PlantSchema,
  plantingDate: z.string().datetime({ offset: true }).optional(),
  harvestDate: z.string().datetime({ offset: true }).optional(),
  variety: z.string().optional(),
  pestEvents: z.array(PestEventSchema).default([]),
});

// ---------------------------------------------------------------------------
// PlanterSquare — one cell in the Planter grid
// ---------------------------------------------------------------------------

export const PlanterSquareSchema = z.object({
  plantInstance: PlantInstanceSchema.nullable(),
});

// ---------------------------------------------------------------------------
// Planter — a raised bed, container, or row within an Area
//
// NOTE: Previously the `squares` grid was owned by PlanterGrid's local
// useState and was never persisted. This caused all plant placements to be
// silently lost on page refresh (Bug 6.12). The `squares` field here fixes
// that — it is the rows×cols grid of what is planted where.
// ---------------------------------------------------------------------------

export const PlanterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  rows: z.number().int().min(1).max(20),
  cols: z.number().int().min(1).max(20),
  /**
   * The plant placement grid: squares[rowIndex][colIndex].
   * Dimensions must match rows × cols.
   * Empty squares have plantInstance: null.
   */
  squares: z.array(z.array(PlanterSquareSchema)).optional(),
  virtualSections: z.array(VirtualSectionSchema).default([]),
  backgroundColor: z.string().optional(),
  tagline: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Area — a named garden zone containing one or more Planters
// ---------------------------------------------------------------------------

export const AreaSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  tagline: z.string().optional(),
  backgroundColor: z.string().optional(),
  planters: z.array(PlanterSchema).default([]),
  /**
   * Forward-compatibility: ties this area to a profile for Tier 1c / Tier 4.
   * Defaults to 'default' (single implicit profile) in open / solo mode.
   */
  profileId: z.string().default("default"),
});

// ---------------------------------------------------------------------------
// Seedling — a batch of seeds being germinated or started indoors
// ---------------------------------------------------------------------------

export const SeedlingSchema = z.object({
  id: z.string(),
  plant: PlantSchema,
  plantedDate: z.string().datetime({ offset: true }),
  seedCount: z.number().int().positive(),
  location: z.string(),
  method: z.enum(["indoor", "direct-sow"]).optional(),
  status: SeedlingStatusSchema,
});

// ---------------------------------------------------------------------------
// Settings — user preferences and configuration
// ---------------------------------------------------------------------------

export const AiProviderSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("byok"),
    /**
     * User-supplied OpenRouter API key.
     * Docker: injected via /config.json at runtime (never in the bundle).
     * Browser: entered in Settings UI, stored in Dexie, never exported.
     */
    key: z.string().min(1),
  }),
  z.object({
    type: z.literal("proxy"),
    proxyUrl: z.string().url(),
    token: z.string().optional(),
  }),
]);

export const SettingsSchema = z.object({
  location: z.string().default(""),
  growthZone: z.string().default("6b"),
  /** Resolved to 'open-meteo' by default — no API key needed. */
  weatherProvider: z.string().default("open-meteo"),
  aiProvider: AiProviderSchema.default({ type: "none" }),
  /** BCP 47 locale tag, e.g. 'en', 'nl'. */
  locale: z.string().default("en"),
  /** Geocoded coordinates for Open-Meteo (derived from `location`). */
  lat: z.number().optional(),
  lng: z.number().optional(),
  /** Forward-compatibility for Tier 1c / Tier 4 multi-profile. */
  profileId: z.string().default("default"),
});

// ---------------------------------------------------------------------------
// GardenEvent — a logged action in the garden
// (previously exported from EventsBar.tsx)
// ---------------------------------------------------------------------------

export const GardenEventSchema = z.object({
  id: z.string(),
  type: GardenEventTypeSchema,
  plant: PlantSchema.optional(),
  date: z.string().datetime({ offset: true }),
  /** The planter ID this event relates to, if applicable. */
  gardenId: z.string().optional(),
  note: z.string().optional(),
  /** Forward-compatibility for Tier 1c / Tier 4. */
  profileId: z.string().default("default"),
});

// ---------------------------------------------------------------------------
// Suggestion — a runtime-derived recommendation (rules engine output)
// NOT persisted — re-derived on each session from garden state + weather.
// (previously exported from EventsBar.tsx)
// ---------------------------------------------------------------------------

export const SuggestionSchema = z.object({
  id: z.string(),
  type: SuggestionTypeSchema,
  plant: PlantSchema.optional(),
  priority: PrioritySchema,
  description: z.string(),
  dueDate: z.string().datetime({ offset: true }).optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// Use these everywhere instead of the old hand-written interfaces.
// ---------------------------------------------------------------------------

export type SunRequirement = z.infer<typeof SunRequirementSchema>;
export type SeedlingStatus = z.infer<typeof SeedlingStatusSchema>;
export type GardenEventType = z.infer<typeof GardenEventTypeSchema>;
export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type PlantSource = z.infer<typeof PlantSourceSchema>;

export type VirtualSection = z.infer<typeof VirtualSectionSchema>;
export type Plant = z.infer<typeof PlantSchema>;
export type PestEvent = z.infer<typeof PestEventSchema>;
export type PlantInstance = z.infer<typeof PlantInstanceSchema>;
export type PlanterSquare = z.infer<typeof PlanterSquareSchema>;
export type Planter = z.infer<typeof PlanterSchema>;
export type Area = z.infer<typeof AreaSchema>;
export type Seedling = z.infer<typeof SeedlingSchema>;
export type AiProvider = z.infer<typeof AiProviderSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type GardenEvent = z.infer<typeof GardenEventSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;

// ---------------------------------------------------------------------------
// Helper: safe parse with typed error reporting
// ---------------------------------------------------------------------------

export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[schema] Failed to parse ${label}:`, result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Like safeParse but falls back to the schema default instead of null.
 * Useful for Settings where a partial/corrupt saved object should be
 * merged with defaults rather than discarded entirely.
 */
export function parseWithDefaults<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  // Fall back to parsing an empty object — picks up all defaults
  return schema.parse({});
}
