/**
 * app/services/ai/prompts.ts
 *
 * System prompt, JSON schema, user-prompt builder, and response types
 * for the AI plant data lookup feature.
 */

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

export interface PlantAIResponse {
  name: string;
  latinName: string;
  variety?: string;
  description: string;
  daysToHarvest: number;
  spacingCm: number;
  sunRequirement: "full" | "partial" | "shade";
  watering?: string;
  growingTips?: string;
  sowIndoorMonths: number[];
  sowDirectMonths: number[];
  harvestMonths: number[];
  companions: string[];
  antagonists: string[];
  /** Single emoji, only when confidence is high. */
  icon?: string;
  /** Hex colour, only when confidence is high. */
  color?: string;
  confidence: {
    latinName: number;
    description: number;
    daysToHarvest: number;
    spacingCm: number;
    sunRequirement: number;
    watering: number;
    growingTips: number;
    sowIndoorMonths: number;
    sowDirectMonths: number;
    harvestMonths: number;
    companions: number;
    antagonists: number;
    icon?: number;
    color?: number;
  };
}

// ---------------------------------------------------------------------------
// Confidence thresholds
// ---------------------------------------------------------------------------

export const CONFIDENCE = {
  HIGH: 0.85, // no indicator needed
  MEDIUM: 0.7, // amber ⚠
  LOW: 0.5, // red ⚠⚠
  REJECT: 0.3, // do not auto-fill
} as const;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const PLANT_LOOKUP_SYSTEM_PROMPT = `You are a horticultural database assistant. Given a plant name and an optional variety, return structured growing data in JSON format.

Rules:
- Return ONLY valid JSON. No markdown, no prose.
- Echo the requested plant name and variety instead of inventing a different plant.
- Include latinName using accepted botanical nomenclature when known.
- All month fields use 1-indexed arrays (1=January, 12=December)
- Interpret sowing and harvest windows using the supplied Köppen–Geiger climate zone and coordinates when provided
- spacingCm is the minimum distance between plants in centimeters
- companions and antagonists are lowercase plant names
- daysToHarvest is from transplant/direct sow to first harvest
- sunRequirement is one of: "full", "partial", "shade"
- watering should be a short practical watering note focused on frequency or soil moisture
- growingTips should be 1-2 concise practical sentences
- description should be 1-2 practical growing sentences, not marketing copy
- icon and color are optional convenience fields; only include them when confidence is high
- Include a confidence object with a score (0-1) for each AI-managed field

Return ONLY valid JSON with EXACTLY these field names:
{
  "name": string,
  "latinName": string,
  "variety": string (optional),
  "description": string,
  "daysToHarvest": number,
  "spacingCm": number,
  "sunRequirement": "full" | "partial" | "shade",
  "watering": string,
  "growingTips": string,
  "sowIndoorMonths": number[],
  "sowDirectMonths": number[],
  "harvestMonths": number[],
  "companions": string[],
  "antagonists": string[],
  "icon": string (optional, single emoji),
  "color": string (optional, hex color),
  "confidence": {
    "latinName": number,
    "description": number,
    "daysToHarvest": number,
    "spacingCm": number,
    "sunRequirement": number,
    "watering": number,
    "growingTips": number,
    "sowIndoorMonths": number,
    "sowDirectMonths": number,
    "harvestMonths": number,
    "companions": number,
    "antagonists": number
  }
}`;

// ---------------------------------------------------------------------------
// JSON schema (passed as structured output hint, not enforced at runtime)
// ---------------------------------------------------------------------------

export const PLANT_LOOKUP_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    latinName: { type: "string" },
    variety: { type: "string" },
    description: { type: "string", maxLength: 200 },
    daysToHarvest: { type: "number" },
    spacingCm: { type: "number" },
    sunRequirement: { type: "string", enum: ["full", "partial", "shade"] },
    watering: { type: "string", maxLength: 160 },
    growingTips: { type: "string", maxLength: 240 },
    sowIndoorMonths: {
      type: "array",
      items: { type: "number", minimum: 1, maximum: 12 },
    },
    sowDirectMonths: {
      type: "array",
      items: { type: "number", minimum: 1, maximum: 12 },
    },
    harvestMonths: {
      type: "array",
      items: { type: "number", minimum: 1, maximum: 12 },
    },
    companions: { type: "array", items: { type: "string" } },
    antagonists: { type: "array", items: { type: "string" } },
    icon: { type: "string", description: "Single emoji" },
    color: { type: "string", description: "Hex color code" },
    confidence: {
      type: "object",
      properties: {
        latinName: { type: "number" },
        description: { type: "number" },
        daysToHarvest: { type: "number" },
        spacingCm: { type: "number" },
        sunRequirement: { type: "number" },
        watering: { type: "number" },
        growingTips: { type: "number" },
        sowIndoorMonths: { type: "number" },
        sowDirectMonths: { type: "number" },
        harvestMonths: { type: "number" },
        companions: { type: "number" },
        antagonists: { type: "number" },
        icon: { type: "number" },
        color: { type: "number" },
      },
    },
  },
  required: [
    "name",
    "latinName",
    "description",
    "daysToHarvest",
    "spacingCm",
    "sunRequirement",
    "watering",
    "growingTips",
    "sowIndoorMonths",
    "sowDirectMonths",
    "harvestMonths",
    "companions",
    "antagonists",
    "confidence",
  ],
};

// ---------------------------------------------------------------------------
// Truncation helper — prevents oversized user-controlled strings from
// inflating prompts or enabling injection attacks.
// An optional fieldName improves debuggability.
// ---------------------------------------------------------------------------

export function truncate(s: string, max: number, fieldName?: string): string {
  if (s.length <= max) return s;
  console.warn(`[prompts] Truncated ${fieldName ?? "string"} from ${s.length} to ${max} chars`);
  return s.slice(0, max);
}

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

export function buildPlantLookupUserPrompt(input: {
  plantName: string;
  variety?: string;
  koeppenZone?: string;
  latitude?: number;
  longitude?: number;
}): string {
  const lines = [`Plant: "${truncate(input.plantName, 80, "plantName")}"`];
  if (input.variety) lines.push(`Variety: "${truncate(input.variety, 80, "variety")}"`);
  if (input.koeppenZone) {
    lines.push(`Köppen–Geiger climate zone: ${input.koeppenZone}`);
  }
  if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number"
  ) {
    lines.push(`Coordinates: ${input.latitude}, ${input.longitude}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Common plant alias map — prevents duplicate lookups for regional name variants
// ---------------------------------------------------------------------------

export const PLANT_ALIASES: Record<string, string> = {
  zucchini: "courgette",
  "bell pepper": "pepper",
  "sweet pepper": "pepper",
  chili: "chilli",
  cilantro: "coriander",
  arugula: "rocket",
  eggplant: "aubergine",
  "green onion": "spring onion",
  scallion: "spring onion",
};

export function normalizePlantName(name: string): string {
  const lower = name.toLowerCase().trim();
  return PLANT_ALIASES[lower] ?? lower;
}
