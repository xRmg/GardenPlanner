import i18n from "../config";

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
