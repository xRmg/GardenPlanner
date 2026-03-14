import i18n, { supportedLocales } from "../config";
import {
  humanizePlantReference,
  normalizePlantReference,
} from "../../lib/plantReferences";

interface PlantNamesResource {
  names?: Record<string, string>;
}

interface PlantNameLike {
  id: string;
  name: string;
  variety?: string;
}

export type PlantLocalizedContentField =
  | "description"
  | "watering"
  | "growingTips";

export interface PlantLocalizedContentEntry {
  description?: string | null;
  watering?: string | null;
  growingTips?: string | null;
}

interface PlantLocalizedContentLike {
  description?: string;
  watering?: string;
  growingTips?: string;
  localizedContent?: Record<string, PlantLocalizedContentEntry>;
}

function normalizePlantLookupValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeLocaleKey(locale?: string): string {
  return (
    locale?.split("-")[0]?.toLowerCase() ??
    i18n.language.split("-")[0]?.toLowerCase()
  );
}

function getPlantNamesResource(locale?: string): Record<string, string> {
  const language = normalizeLocaleKey(locale);
  const bundle = i18n.getResourceBundle(language, "plants") as
    | PlantNamesResource
    | undefined;

  return bundle?.names ?? {};
}

/** Resolve the display name for a plant in the current locale.
 *  Falls back to the English name if no translation exists. */
export function getPlantName(
  plantId: string,
  englishName: string,
  locale?: string,
): string {
  const key = `plants:names.${normalizePlantReference(plantId)}`;
  // Use i18n instance directly to allow arbitrary string keys
  const translated = i18n.t(key, { lng: locale, defaultValue: "" });
  return translated || englishName;
}

export function getPlantDisplayName(
  plant: PlantNameLike,
  locale?: string,
): string {
  return getPlantName(plant.id, plant.name, locale);
}

export function getLocalizedPlantContent(
  plant: PlantLocalizedContentLike | null | undefined,
  field: PlantLocalizedContentField,
  locale?: string,
): string | undefined {
  if (!plant) return undefined;

  const localizedEntry = plant.localizedContent?.[normalizeLocaleKey(locale)];
  if (
    localizedEntry &&
    Object.prototype.hasOwnProperty.call(localizedEntry, field)
  ) {
    return localizedEntry[field] ?? undefined;
  }

  return plant[field];
}

export function updatePlantLocalizedContent<T extends PlantLocalizedContentLike>(
  plant: T,
  locale: string | undefined,
  values: Partial<Record<PlantLocalizedContentField, string>>,
  fieldsToPersist: readonly PlantLocalizedContentField[],
): T & PlantLocalizedContentLike {
  if (fieldsToPersist.length === 0) return plant;

  const normalizedLocale = normalizeLocaleKey(locale);
  const nextLocalizedContent = { ...(plant.localizedContent ?? {}) };
  const nextEntry: PlantLocalizedContentEntry = {
    ...(nextLocalizedContent[normalizedLocale] ?? {}),
  };

  fieldsToPersist.forEach((field) => {
    const value = values[field];
    if (value === undefined) return;

    const trimmedValue = value.trim();
    nextEntry[field] = trimmedValue ? trimmedValue : null;
  });

  if (Object.keys(nextEntry).length === 0) {
    delete nextLocalizedContent[normalizedLocale];
  } else {
    nextLocalizedContent[normalizedLocale] = nextEntry;
  }

  return {
    ...plant,
    localizedContent:
      Object.keys(nextLocalizedContent).length > 0
        ? nextLocalizedContent
        : undefined,
  };
}

export function matchesPlantSearchQuery(
  plant: PlantNameLike,
  query: string,
  locale?: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const candidates = [
    plant.name,
    getPlantDisplayName(plant, locale),
    plant.id.replace(/-/g, " "),
    plant.variety,
  ];

  return candidates.some((candidate) =>
    candidate?.toLowerCase().includes(normalizedQuery),
  );
}

export function hasPlantNameTranslation(
  plantRef: string,
  locale?: string,
): boolean {
  const normalizedRef = normalizePlantReference(plantRef);
  return Boolean(getPlantNamesResource(locale)[normalizedRef]);
}

export function getLocalizedPlantReferenceName(
  value: string,
  locale?: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const plantRef = normalizePlantReference(trimmed);
  const englishFallback = getPlantName(
    plantRef,
    humanizePlantReference(plantRef),
    "en",
  );

  return getPlantName(plantRef, englishFallback, locale);
}

export function formatPlantReferenceList(
  values: string[] | undefined,
  locale?: string,
): string {
  return (values ?? [])
    .map((value) => getLocalizedPlantReferenceName(value, locale))
    .join(", ");
}

export function parseLocalizedPlantReferenceList(
  value: string,
  locale?: string,
): string[] {
  const localeNames = getPlantNamesResource(locale);
  const englishNames = getPlantNamesResource("en");
  const localizedLookup = new Map<string, string>();

  const refs = new Set([
    ...Object.keys(localeNames),
    ...Object.keys(englishNames),
  ]);

  refs.forEach((key) => {
    const canonicalRef = normalizePlantReference(key);
    const localeLabel = getPlantName(
      canonicalRef,
      humanizePlantReference(canonicalRef),
      locale,
    );
    const englishLabel = getPlantName(
      canonicalRef,
      humanizePlantReference(canonicalRef),
      "en",
    );

    [
      key,
      key.replace(/-/g, " "),
      humanizePlantReference(canonicalRef),
      localeLabel,
      englishLabel,
    ].forEach((candidate) => {
      if (!candidate) return;
      localizedLookup.set(normalizePlantLookupValue(candidate), canonicalRef);
    });
  });

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const normalized = normalizePlantLookupValue(item);
      return localizedLookup.get(normalized) ?? normalizePlantReference(item);
    });
}

export function getKnownPlantReferences(
  locales: readonly string[] = supportedLocales,
): Set<string> {
  const refs = new Set<string>();

  locales.forEach((locale) => {
    Object.keys(getPlantNamesResource(locale)).forEach((ref) => {
      refs.add(normalizePlantReference(ref));
    });
  });

  return refs;
}
