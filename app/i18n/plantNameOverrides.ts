import { getGardenPlannerDB } from "../data/dexieRepository";
import { normalizePlantReference } from "../lib/plantReferences";
import i18n, { supportedLocales, type SupportedLocale } from "./config";
import { hasPlantNameTranslation } from "./utils/plantTranslation";

export type PlantNameOverrideSource = "ai" | "user";

export interface PlantNameOverrideInput {
  label: string;
  confidence?: number;
  source?: PlantNameOverrideSource;
}

function normalizeLocale(locale?: string): SupportedLocale {
  const base = locale?.split("-")[0]?.toLowerCase();
  return (supportedLocales as readonly string[]).includes(base ?? "")
    ? (base as SupportedLocale)
    : "en";
}

export function applyPlantNameOverrides(
  locale: string | undefined,
  labels: Record<string, string>,
): void {
  const normalizedLocale = normalizeLocale(locale);

  Object.entries(labels).forEach(([ref, label]) => {
    const normalizedRef = normalizePlantReference(ref);
    const trimmedLabel = label.trim();
    if (!normalizedRef || !trimmedLabel) return;

    i18n.addResource(
      normalizedLocale,
      "plants",
      `names.${normalizedRef}`,
      trimmedLabel,
    );
  });
}

export async function loadPlantNameOverridesForLocale(
  locale?: string,
): Promise<Record<string, string>> {
  const normalizedLocale = normalizeLocale(locale);

  try {
    const db = getGardenPlannerDB();
    const rows = await db.plantNameOverrides
      .where("locale")
      .equals(normalizedLocale)
      .toArray();

    const labels = Object.fromEntries(rows.map((row) => [row.ref, row.label]));
    applyPlantNameOverrides(normalizedLocale, labels);
    return labels;
  } catch {
    return {};
  }
}

export async function upsertMissingPlantNameOverrides(
  locale: string | undefined,
  labels: Record<string, PlantNameOverrideInput>,
): Promise<Record<string, string>> {
  const normalizedLocale = normalizeLocale(locale);
  const db = getGardenPlannerDB();
  const applied: Record<string, string> = {};
  const updatedAt = Date.now();

  try {
    for (const [ref, input] of Object.entries(labels)) {
      const normalizedRef = normalizePlantReference(ref);
      const trimmedLabel = input.label.trim();
      if (!normalizedRef || !trimmedLabel) continue;
      if (hasPlantNameTranslation(normalizedRef, normalizedLocale)) continue;

      await db.plantNameOverrides.put({
        id: `${normalizedLocale}|${normalizedRef}`,
        locale: normalizedLocale,
        ref: normalizedRef,
        label: trimmedLabel,
        source: input.source ?? "ai",
        confidence: input.confidence,
        updatedAt,
      });
      applied[normalizedRef] = trimmedLabel;
    }

    applyPlantNameOverrides(normalizedLocale, applied);
    return applied;
  } catch {
    return {};
  }
}