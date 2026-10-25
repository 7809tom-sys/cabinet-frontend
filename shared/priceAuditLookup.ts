// Pure parsing for the admin Price Audit lookup box.
//
// The owner can punch in either a queue number (the cabinet's own record id,
// optionally prefixed with "#", e.g. "#123" or "123") or a model / master
// code (e.g. "B24", "DB-24-3"). This helper decides which mode a raw search
// term means so the server can resolve it by id vs. by masterCode LIKE.

export type PriceAuditLookup =
  | { kind: "id"; id: number }
  | { kind: "code"; code: string };

/**
 * Parse a raw Price Audit search term.
 * - A bare integer or a "#"-prefixed integer => lookup by queue number (id).
 * - Anything else (contains letters, dashes, etc.) => lookup by model code.
 * Returns null for empty / whitespace-only input.
 */
export function parsePriceAuditQuery(raw: string): PriceAuditLookup | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const numericPart = trimmed.replace(/^#/, "").trim();
  if (/^\d+$/.test(numericPart)) {
    const id = Number(numericPart);
    if (Number.isSafeInteger(id) && id > 0) return { kind: "id", id };
  }

  return { kind: "code", code: trimmed.toUpperCase() };
}
