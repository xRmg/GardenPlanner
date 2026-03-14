import i18n from "../config";
import type { CellDimensions, UnitSystem } from "../../data/schema";

/** Format a Date or ISO date string using the current locale. */
export function formatDate(date: Date | string, style: "short" | "long" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: style }).format(d);
}

/** Return the narrow month letter (e.g. "J") for month 1–12 in the current locale. */
export function formatMonthNarrow(month: number): string {
  const date = new Date(2024, month - 1, 1);
  return new Intl.DateTimeFormat(i18n.language, { month: "narrow" }).format(date);
}

/** Return month abbreviation (e.g. "Jan") for month 1–12 in the current locale. */
export function formatMonthShort(month: number): string {
  const date = new Date(2024, month - 1, 1);
  return new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(date);
}

/** Format a month range from an array of 1-indexed months */
export function formatMonthRange(months: number[]): string {
  if (!months?.length) return "";
  const sorted = [...months].sort((a, b) => a - b);
  return sorted.map(formatMonthShort).join(", ");
}

/**
 * Return the display symbol for a cell dimension unit.
 * e.g. 'feet' → 'ft', 'cm' → 'cm', 'inches' → 'in', 'm' → 'm'.
 */
function unitSymbol(unit: CellDimensions["unit"]): string {
  switch (unit) {
    case "feet":   return "ft";
    case "inches": return "in";
    case "m":      return "m";
    case "cm":     return "cm";
    default:       return unit;
  }
}

/**
 * Format a pair of cell dimensions as a compact string, e.g.
 *   { width: 1, depth: 1, unit: 'feet' }   → "1 ft × 1 ft"
 *   { width: 30, depth: 30, unit: 'cm' }   → "30 cm × 30 cm"
 *   { width: 30, depth: 25, unit: 'cm' }   → "30 × 25 cm"
 */
export function formatDimensions(dims: CellDimensions): string {
  const sym = unitSymbol(dims.unit);
  const w = Number.isInteger(dims.width) ? dims.width : dims.width.toFixed(1);
  const d = Number.isInteger(dims.depth) ? dims.depth : dims.depth.toFixed(1);
  if (w === d) {
    return `${w} ${sym} × ${w} ${sym}`;
  }
  return `${w} × ${d} ${sym}`;
}

/**
 * Return the default cell dimensions for a given unit system, matching
 * standard gardening conventions:
 *   imperial → 1 ft × 1 ft  (square-foot gardening standard)
 *   metric   → 30 cm × 30 cm
 */
export function defaultCellDimensions(unitSystem: UnitSystem): CellDimensions {
  if (unitSystem === "imperial") {
    return { width: 1, depth: 1, unit: "feet" };
  }
  return { width: 30, depth: 30, unit: "cm" };
}

/**
 * Detect the preferred unit system from a BCP 47 locale tag.
 * The United States uses imperial; all other regions default to metric.
 */
export function detectUnitSystem(locale: string): UnitSystem {
  const lower = locale.toLowerCase();
  // Match explicit US locale tags: "en-us", "en_US", or region "US" suffix
  if (lower === "en-us" || lower === "en_us" || lower.endsWith("-us")) {
    return "imperial";
  }
  return "metric";
}
