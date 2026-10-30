/**
 * Values from MySQL decimals and JSON columns often arrive as strings, null,
 * or missing arrays. These helpers keep admin renders from calling number or
 * array methods on those values.
 */

export function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

export function formatFixed(value: unknown, digits: number): string {
  return finiteNumber(value).toFixed(digits);
}

export function formatCents(value: unknown): string {
  return (finiteNumber(value) / 100).toFixed(2);
}

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Join an array, keep a non-empty string, and render anything else as empty. */
export function joinList(value: unknown, separator = ", ", empty = "—"): string {
  if (Array.isArray(value)) {
    const parts = value
      .filter((item) => item != null && String(item).trim() !== "")
      .map((item) => String(item).trim());
    return parts.length > 0 ? parts.join(separator) : empty;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || empty;
  }
  return empty;
}

export function formatTimestamp(value: unknown, style: "datetime" | "time" | "iso" = "datetime"): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return "—";
  if (style === "iso") return date.toISOString();
  if (style === "time") return date.toLocaleTimeString();
  return date.toLocaleString();
}

/** Render a primitive. Objects are not valid React children. */
export function displayValue(value: unknown, empty = "—"): string {
  if (value == null || value === "") return empty;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : empty;
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  return empty;
}

export function textSnippet(value: unknown, max: number, fallback = "error"): string {
  const text = value == null || value === "" ? fallback : String(value);
  return text.slice(0, max);
}
