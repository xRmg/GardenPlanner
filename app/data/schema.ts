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

/** Measurement unit system chosen by the user. */
export const UnitSystemSchema = z.enum(["imperial", "metric"]);

/** Unit for cell dimension values. */
export const CellDimensionUnitSchema = z.enum(["feet", "inches", "cm", "m"]);

/**
 * Physical dimensions of a single grid cell.
 * Imperial default: 1 ft × 1 ft (square-foot gardening).
 * Metric defaults: 30 cm × 30 cm or 25 cm × 25 cm.
 */
export const CellDimensionsSchema = z.object({
  width: z.number().positive().finite(),
  depth: z.number().positive().finite(),
  unit: CellDimensionUnitSchema,
});

/** Layout style for a planter — standard grid or a pot/container view. */
export const PlanterLayoutSchema = z.enum(["grid", "pot-container"]);

export const SeedlingStatusSchema = z.enum([
  "germinating",
  "growing",
  "hardening",
  "ready",
]);

export const GrowthStageSchema = z.enum([
  "sprouting",
  "vegetative",
  "flowering",
  "fruiting",
  "dormant",
]);

export const HealthStateSchema = z.enum([
  "healthy",
  "stressed",
  "damaged",
  "diseased",
  "dead",
]);

export const GardenEventTypeSchema = z.enum([
  "planted",
  "watered",
  "composted",
  "weeded",
  "harvested",
  "sown",
  "sprouted",
  "removed",
  "pest",
  "treatment",
  "observation",
]);
export const SuggestionTypeSchema = z.enum([
  // Rules-engine types
  "water",
  "harvest",
  "repot",
  "compost",
  "weed",
  "sow",
  "fertilize",
  "treatment",
  "no_water",
  "frost_protect",
  // AI-only types
  "thin_seedlings",
  "harden_seedlings",
  "companion_conflict",
  "succession_sow",
  "pest_alert",
  "disease_risk",
  "end_of_season",
  "mulch",
  "prune",
]);
export const PrioritySchema = z.enum(["low", "medium", "high"]);

/**
 * Which part of the garden hierarchy a suggestion targets.
 * Used for scoped display, completion flow, and cache partitioning.
 */
export const SuggestionScopeSchema = z.enum(["area", "planter", "plant"]);

/**
 * Where a plant record originated.
 * Determines whether it can be overwritten on a shared library sync.
 */
export const PlantSourceSchema = z.enum(["bundled", "synced", "custom"]);

export const PlantLocalizedContentEntrySchema = z.object({
  description: z.string().nullable().optional(),
  watering: z.string().nullable().optional(),
  growingTips: z.string().max(500).nullable().optional(),
});

export const PlantLocalizedContentSchema = z.record(
  z.string(),
  PlantLocalizedContentEntrySchema,
);

// ---------------------------------------------------------------------------
// VirtualSection — a named row/column band within a Planter
// (previously exported from PlanterDialog.tsx)
// ---------------------------------------------------------------------------

export const VirtualSectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  type: z.enum(["rows", "columns"]),
  start: z.number().int().min(1),
  end: z.number().int().min(1),
  color: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Plant — a species/variety in the plant catalogue
// (previously exported from PlanterGrid.tsx)
// ---------------------------------------------------------------------------

export const PlantSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  color: z.string(),
  icon: z.string(),
  /** Accepted botanical name, e.g. "Solanum lycopersicum". */
  latinName: z.string().optional(),
  description: z.string().optional(),
  variety: z.string().max(80).optional(),
  daysToHarvest: z.number().int().positive().optional(),
  daysToFlower: z.number().int().positive().optional(),
  daysToFruit: z.number().int().positive().optional(),
  isSeed: z.boolean().default(false),
  /** Current stock count (seeds). */
  amount: z.number().int().min(0).optional(),
  spacingCm: z.number().positive().optional(),
  frostHardy: z.boolean().optional(),
  /** Whether this plant is sensitive to frost (opposite of frostHardy). */
  frostSensitive: z.boolean().optional(),
  watering: z.string().optional(),
  growingTips: z.string().max(500).optional(),
  localizedContent: PlantLocalizedContentSchema.optional(),
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
  description: z.string().max(500),
});

// ---------------------------------------------------------------------------
// PlantInstance — a specific plant placed in a Planter square
// ---------------------------------------------------------------------------

export const PlantInstanceSchema = z.object({
  instanceId: z.string(),
  plant: PlantSchema,
  plantingDate: z.string().datetime({ offset: true }).optional(),
  harvestDate: z.string().datetime({ offset: true }).optional(),
  variety: z.string().max(80).optional(),
  pestEvents: z.array(PestEventSchema).default([]),
  growthStage: GrowthStageSchema.nullable().default(null),
  growthStageOverride: z.boolean().default(false),
  healthState: HealthStateSchema.nullable().default(null),
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
  /**
   * Physical size of each grid cell.
   * Imperial default: { width: 1, depth: 1, unit: 'feet' }.
   * Metric default:   { width: 30, depth: 30, unit: 'cm' }.
   * If absent on legacy planters, callers should derive the default from the
   * user's unit system setting.
   */
  cellDimensions: CellDimensionsSchema.optional(),
  /**
   * Visual layout type for the planter.
   * 'grid'          — standard rectangular grid cells (default).
   * 'pot-container' — round pot/container cells; cellDimensions represents
   *                   the pot diameter or footprint.
   * Optional — defaults to 'grid' wherever missing (e.g. legacy records).
   */
  layout: PlanterLayoutSchema.optional(),
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
  location: z.string().max(200),
  method: z.enum(["indoor", "direct-sow"]).optional(),
  status: SeedlingStatusSchema,
});

// ---------------------------------------------------------------------------
// Settings — user preferences and configuration
// ---------------------------------------------------------------------------

export const StoredAiProviderSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("byok"),
    /**
     * User-supplied OpenRouter API key.
     * Entered in the Settings UI and stored by the backend via
     * POST /api/settings/ai-key. The backend reads it server-side for all
     * AI calls via the /api/ai/chat proxy.
     */
    key: z.string().min(1),
  }),
]);

export const AiProviderSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  /** Indicates an API key is stored server-side. Returned by GET /api/settings
   *  so the frontend knows AI is configured without exposing the actual key. */
  z.object({ type: z.literal("server") }),
]);

export const StoredSettingsSchema = z.object({
  location: z.string().default(""),
  /**
   * Köppen–Geiger climate zone code, e.g. 'Cfb'.
   * Auto-derived from Open-Meteo climate data during location verification.
   * Field name kept as `growthZone` for backwards compatibility.
   */
  growthZone: z.string().default("Cfb"),
  aiProvider: StoredAiProviderSchema.default({ type: "none" }),
  /** OpenRouter model identifier, e.g. 'google/gemini-2.0-flash'. */
  aiModel: z.string().default("google/gemini-2.0-flash"),
  /** BCP 47 locale tag, e.g. 'en', 'nl'. */
  locale: z.string().default("en"),
  /** Geocoded coordinates derived from `location` via Open-Meteo Geocoding API. */
  lat: z.number().optional(),
  lng: z.number().optional(),
  /** Last successful backend validation time for the stored AI key. */
  aiLastValidatedAt: z.string().datetime({ offset: true }).optional(),
  /** Last backend validation error for the stored AI key, if any. */
  aiValidationError: z.string().optional(),
  /** Forward-compatibility for Tier 1c / Tier 4 multi-profile. */
  profileId: z.string().default("default"),
  /** Whether the area planner is in edit-layout mode (vs view/interact mode). */
  isEditMode: z.boolean().default(false),
  /** The area last interacted with — restored on page reload. */
  lastSelectedAreaId: z.string().optional(),
  /** The planter last interacted with — restored on page reload. */
  lastSelectedPlanterId: z.string().optional(),
  /**
   * Preferred measurement unit system.
   * Defaults to 'imperial' for US locales, 'metric' everywhere else.
   * Determines default cell dimension presets in the planter dialog.
   * Optional — filled in on first load by useGardenData if absent.
   */
  unitSystem: UnitSystemSchema.optional(),
});

export const SettingsSchema = z.object({
  location: z.string().default(""),
  growthZone: z.string().default("Cfb"),
  aiProvider: AiProviderSchema.default({ type: "none" }),
  aiModel: z.string().default("google/gemini-2.0-flash"),
  locale: z.string().default("en"),
  lat: z.number().optional(),
  lng: z.number().optional(),
  aiLastValidatedAt: z.string().datetime({ offset: true }).optional(),
  aiValidationError: z.string().optional(),
  profileId: z.string().default("default"),
  /** Whether the area planner is in edit-layout mode (vs view/interact mode). */
  isEditMode: z.boolean().default(false),
  /** The area last interacted with — restored on page reload. */
  lastSelectedAreaId: z.string().optional(),
  /** The planter last interacted with — restored on page reload. */
  lastSelectedPlanterId: z.string().optional(),
  /** Preferred measurement unit system. Optional — filled in on first load. */
  unitSystem: UnitSystemSchema.optional(),
});

export const SettingsPatchSchema = z
  .object({
    growthZone: z.string().optional(),
    aiModel: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict();

export function toFrontendSettings(stored: StoredSettings): Settings {
  return {
    location: stored.location,
    growthZone: stored.growthZone,
    aiProvider:
      stored.aiProvider.type === "byok" ? { type: "server" } : { type: "none" },
    aiModel: stored.aiModel,
    locale: stored.locale,
    lat: stored.lat,
    lng: stored.lng,
    aiLastValidatedAt: stored.aiLastValidatedAt,
    aiValidationError: stored.aiValidationError,
    profileId: stored.profileId,
    isEditMode: stored.isEditMode,
    lastSelectedAreaId: stored.lastSelectedAreaId,
    lastSelectedPlanterId: stored.lastSelectedPlanterId,
    unitSystem: stored.unitSystem,
  };
}

// ---------------------------------------------------------------------------
// EventScope — where in the garden hierarchy an action was logged
// ---------------------------------------------------------------------------

/**
 * Scope of a garden action:
 * - 'plant'   — logged against a specific plant instance (default)
 * - 'planter' — logged against a whole planter (e.g. watered the bed)
 * - 'area'    — logged against a whole area (e.g. weeded the backyard)
 */
export const EventScopeSchema = z.enum(["plant", "planter", "area"]);

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
  /** The placed plant instance this event relates to, if applicable. */
  instanceId: z.string().optional(),
  note: z.string().max(500).optional(),
  /** Forward-compatibility for Tier 1c / Tier 4. */
  profileId: z.string().default("default"),
  /** Where in the garden hierarchy this action was logged. Defaults to 'plant'. */
  scope: EventScopeSchema.optional(),
  /** The area ID this event relates to (for planter- or area-scope events). */
  areaId: z.string().optional(),
  /** Human-readable planter name for display in the journal. */
  planterName: z.string().optional(),
  /** Human-readable area name for display in the journal. */
  areaName: z.string().optional(),
  /** Original suggestion type when this event was created from a suggestion. */
  suggestionType: SuggestionTypeSchema.optional(),
  /** Original suggestion title for suggestion-derived journal rendering. */
  suggestionDescription: z.string().max(500).optional(),
  /** Source of the suggestion that produced this event. */
  suggestionSource: z.enum(["rules", "ai", "static"]).optional(),
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
  /** Which planter this suggestion applies to, if plant-specific. */
  planterId: z.string().optional(),
  /** Which placed plant instance this suggestion applies to, if instance-specific. */
  instanceId: z.string().optional(),
  /** Automatically dismiss this suggestion after this time. */
  expiresAt: z.string().datetime({ offset: true }).optional(),
  /** Origin of the suggestion — rules engine, AI, or bundled static tips. */
  source: z.enum(["rules", "ai", "static"]).default("rules"),
  /** Which area this suggestion applies to (for planter-wide suggestions). */
  areaId: z.string().optional(),
  /** Human-readable area name for display. */
  areaName: z.string().optional(),
  /** Human-readable planter name for display. */
  planterName: z.string().optional(),
  /**
   * Explicit scope of the suggestion target.
   * 'area'    — broad work affecting multiple sibling planters (frost, storm, heat).
   * 'planter' — focused maintenance on one planter (water, weed, fertilise).
   * 'plant'   — instance-specific work (harvest, pest, treatment, prune).
   */
  scope: SuggestionScopeSchema.optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// Use these everywhere instead of the old hand-written interfaces.
// ---------------------------------------------------------------------------

export type SunRequirement = z.infer<typeof SunRequirementSchema>;
export type UnitSystem = z.infer<typeof UnitSystemSchema>;
export type CellDimensionUnit = z.infer<typeof CellDimensionUnitSchema>;
export type CellDimensions = z.infer<typeof CellDimensionsSchema>;
export type PlanterLayout = z.infer<typeof PlanterLayoutSchema>;
export type SeedlingStatus = z.infer<typeof SeedlingStatusSchema>;
export type GrowthStage = z.infer<typeof GrowthStageSchema>;
export type HealthState = z.infer<typeof HealthStateSchema>;
export type GardenEventType = z.infer<typeof GardenEventTypeSchema>;
export type EventScope = z.infer<typeof EventScopeSchema>;
export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type SuggestionScope = z.infer<typeof SuggestionScopeSchema>;
export type PlantSource = z.infer<typeof PlantSourceSchema>;

/** Which tier of suggestion quality is active. */
export type SuggestionMode =
  | "ai+weather" // Tier 1: AI + live weather
  | "rules+weather" // Tier 2: rules engine + live weather
  | "rules" // Tier 3: rules engine, offline
  | "static"; // Tier 4: bundled tips, empty garden

export type VirtualSection = z.infer<typeof VirtualSectionSchema>;
export type Plant = z.infer<typeof PlantSchema>;
export type PestEvent = z.infer<typeof PestEventSchema>;
export type PlantInstance = z.infer<typeof PlantInstanceSchema>;
export type PlanterSquare = z.infer<typeof PlanterSquareSchema>;
export type Planter = z.infer<typeof PlanterSchema>;
export type Area = z.infer<typeof AreaSchema>;
export type Seedling = z.infer<typeof SeedlingSchema>;
export type StoredAiProvider = z.infer<typeof StoredAiProviderSchema>;
export type AiProvider = z.infer<typeof AiProviderSchema>;
export type StoredSettings = z.infer<typeof StoredSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
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
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      code: i.code,
      message: i.message,
    }));
    console.warn(`[schema] Failed to parse ${label}:`, JSON.stringify(issues));
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
