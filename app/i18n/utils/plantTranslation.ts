import i18n from "../config";

/** Resolve the display name for a plant in the current locale.
 *  Falls back to the English name if no translation exists. */
export function getPlantName(plantId: string, englishName: string): string {
  const key = `plants:names.${plantId}`;
  // Use i18n instance directly to allow arbitrary string keys
  const translated = i18n.t(key, { defaultValue: "" });
  return translated || englishName;
}
