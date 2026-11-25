import { COUNTERTOP_MATERIALS, EDGE_PROFILES } from "@/lib/design";

/**
 * Display helpers for the admin Countertop Quotes cards (Tom, Nov 25 2026):
 * each card shows when the request came in (Central time) and the countertop
 * style that was asked for. Only real data is shown; nothing is guessed.
 */

const CT_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Nov 25, 2026, 11:47 AM CT", or null when the value isn't a real date. */
export function formatQuoteDateCT(value: unknown): string | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return null;
  return `${CT_FORMAT.format(d)} CT`;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v === "string") {
    try {
      return asRecord(JSON.parse(v));
    } catch {
      return null;
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function materialName(id: unknown): string | null {
  const key = text(id);
  if (!key) return null;
  // Exact match only: an unknown id must not fall back to a default material.
  return COUNTERTOP_MATERIALS.find((m) => m.id === key)?.name ?? null;
}

function edgeName(id: unknown): string | null {
  const key = text(id);
  if (!key) return null;
  return EDGE_PROFILES.find((p) => p.id === key)?.name ?? key;
}

export interface QuoteStyleDetail {
  label: string;
  value: string;
}

/**
 * Countertop style lines for one quote: the `material` column first, then any
 * more specific style / color / edge that the saved roomData snapshot really
 * holds. Returns an empty list when nothing was recorded.
 */
export function countertopQuoteStyleDetails(quote: {
  material?: string | null;
  roomData?: unknown;
}): QuoteStyleDetail[] {
  const out: QuoteStyleDetail[] = [];
  const seen = new Set<string>();
  const push = (label: string, value: string | null) => {
    if (!value) return;
    const key = `${label}|${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, value });
  };

  push("Material", text(quote.material));

  const room = asRecord(quote.roomData);
  if (room) {
    push("Style", text(room.countertopStyle) ?? text(room.countertopName) ?? materialName(room.countertopMaterialId));
    push("Color", text(room.countertopColor));
    push("Edge", edgeName(room.countertopEdge ?? room.edgeProfileId ?? room.edgeProfile));
    const entities = asRecord(room.persistedEntities);
    const island = asRecord(entities?.island);
    push("Island top", materialName(island?.countertopMaterialId));
  }
  return out;
}

/**
 * Corian® Solid Surface standard sheet, in inches: 30" wide x 144" long
 * (12 mm / 1/2" sheet; 19 mm / 3/4" sheets share the same size), which is
 * 30 sq ft per sheet. Corian is sold by the full sheet only, so the slab count
 * always rounds up. Change these two numbers if the supplier's sheet changes.
 * Source: Corian Solid Surface Sheet Products (K-24016-NA) and Product
 * Overview (K-27478-NA), corian.com:
 * https://www.corian.com/bin/corianweb/pdf-inline?path=%2Fcontent%2Fdam%2Fcorian%2Fassets%2Fpdf%2Fdocuments%2Fen-us%2Fk-24016_corian_solid_surface_sheet_products.pdf
 * No waste factor is applied: the repo's countertop slab math
 * (lib/surfaceCartLines.ts) uses none, only full-slab rounding.
 */
export const CORIAN_SHEET_WIDTH_IN = 30;
export const CORIAN_SHEET_LENGTH_IN = 144;
export const CORIAN_SHEET_SQ_FT = (CORIAN_SHEET_WIDTH_IN * CORIAN_SHEET_LENGTH_IN) / 144;

/**
 * Whole Corian slabs needed for a quote: ceil(squareFeet / sheet sq ft).
 * Returns null when the area is missing, zero or not a number, so the card
 * shows a dash instead of a made-up count.
 */
export function countertopQuoteSlabsNeeded(
  squareFeet: unknown,
  sheetSqFt: number = CORIAN_SHEET_SQ_FT,
): number | null {
  const area = typeof squareFeet === "number" ? squareFeet : Number(squareFeet);
  if (squareFeet == null || squareFeet === "" || !Number.isFinite(area) || area <= 0) return null;
  if (!Number.isFinite(sheetSqFt) || sheetSqFt <= 0) return null;
  // Tiny tolerance so float noise (e.g. 2.0000000000000004) never adds a slab.
  return Math.ceil(area / sheetSqFt - 1e-9);
}
