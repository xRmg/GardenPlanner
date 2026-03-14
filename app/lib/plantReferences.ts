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

export function normalizePlantReference(value: string): string {
  return normalizePlantName(value).replace(/\s+/g, "-");
}

export function isCanonicalPlantReference(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim());
}

export function normalizePlantReferenceList(
  values: string[] | undefined,
): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
        .map(normalizePlantReference),
    ),
  );
}

export function humanizePlantReference(value: string): string {
  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}