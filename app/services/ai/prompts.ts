/**
 * app/services/ai/prompts.ts
 *
 * System prompt, JSON schema, user-prompt builder, and response types
 * for the AI plant data lookup feature.
 */

export {
  PLANT_ALIASES,
  normalizePlantName,
  normalizePlantReference,
} from "../../lib/plantReferences";

import { getAIResponseLanguage } from "./locale";

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
  /** Canonical relationship refs (locale-independent slugs). */
  companions: string[];
  antagonists: string[];
  /** Optional localized labels for the requested response language, keyed by canonical ref. */
  localizedCompanionLabels?: Record<string, string>;
  localizedAntagonistLabels?: Record<string, string>;
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
    localizedCompanionLabels?: number;
    localizedAntagonistLabels?: number;
    icon?: number;
    color?: number;
  };
}

export interface FilteredPlantAIResponse
  extends Omit<
    PlantAIResponse,
    | "latinName"
    | "description"
    | "daysToHarvest"
    | "spacingCm"
    | "sunRequirement"
    | "watering"
    | "growingTips"
  > {
  latinName?: string;
  description?: string;
  daysToHarvest?: number;
  spacingCm?: number;
  sunRequirement?: "full" | "partial" | "shade";
  watering?: string;
  growingTips?: string;
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
- Do not substitute a related plant or a different species just because the requested name is ambiguous or localized.
- Include latinName using accepted botanical nomenclature when known.
- If you are not confident about the botanical match, keep the requested plant name unchanged and lower confidence on uncertain fields instead of guessing.
- All month fields use 1-indexed arrays (1=January, 12=December)
- Interpret sowing and harvest windows using the supplied Köppen–Geiger climate zone and coordinates when provided
- spacingCm is the minimum distance between plants in centimeters
- companions and antagonists are canonical lowercase plant slugs using hyphens for spaces
- Never include the plant itself in companions or antagonists.
- daysToHarvest is from transplant/direct sow to first harvest
- sunRequirement is one of: "full", "partial", "shade"
- watering should be a short practical watering note focused on frequency or soil moisture
- growingTips should be 1-2 concise practical sentences
- description should be 1-2 practical growing sentences, not marketing copy
- Write description, watering, and growingTips in the requested response language.
- Keep companions and antagonists locale-independent. Do not translate the canonical slug arrays.
- Include localizedCompanionLabels and localizedAntagonistLabels as objects keyed by canonical ref.
- Each localized label value must be written in the requested response language.
- If you do not know a localized label for a returned ref, omit that ref from the localized label object.
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
  "localizedCompanionLabels": { [canonicalRef: string]: string },
  "localizedAntagonistLabels": { [canonicalRef: string]: string },
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
    "antagonists": number,
    "localizedCompanionLabels": number,
    "localizedAntagonistLabels": number
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
    localizedCompanionLabels: {
      type: "object",
      additionalProperties: { type: "string" },
    },
    localizedAntagonistLabels: {
      type: "object",
      additionalProperties: { type: "string" },
    },
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
        localizedCompanionLabels: { type: "number" },
        localizedAntagonistLabels: { type: "number" },
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
  locale?: string;
}): string {
  const { locale, languageName } = getAIResponseLanguage(input.locale);
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
  lines.push(`Response language: ${languageName} (${locale})`);
  lines.push(
    "Use canonical slug refs for companions/antagonists and provide localizedCompanionLabels/localizedAntagonistLabels keyed by those refs when known.",
  );
  return lines.join("\n");
}
