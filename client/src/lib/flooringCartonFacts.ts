import { surfaceRole } from "@/lib/pelican";

/**
 * Carton facts for a flooring product.
 *
 * `coverageSqFt` is the structured square-feet-per-box field. It is empty on
 * the current flooring catalog, so the supplier's description is the other
 * source ("17pc/box 41.99sqft/box", "18.86 SF/box"). Nothing here invents a
 * coverage number: a missing fact stays null and the UI shows a dash.
 */
export type FlooringCartonFacts = {
  piecesPerBox: number | null;
  sqFtPerBox: number | null;
};

export type FlooringCartonSource = {
  category?: string | null;
  subCategory?: string | null;
  name?: string | null;
  description?: string | null;
  coverageSqFt?: number | string | null;
  piecesPerBox?: number | string | null;
};

const PIECES_PER_BOX = /(\d+(?:\.\d+)?)\s*(?:pc|pcs|pieces?)\s*\/\s*box/i;
const SQFT_PER_BOX = /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|sf)\s*\/\s*box/i;

function positiveNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(number) && number > 0 ? number : null;
}

function firstMatch(text: string | null | undefined, pattern: RegExp): number | null {
  if (!text) return null;
  const match = text.match(pattern);
  if (!match) return null;
  return positiveNumber(match[1]);
}

export function isFlooringCartonProduct(product: FlooringCartonSource): boolean {
  return product.category === "Flooring" || surfaceRole(product) === "flooring";
}

/** Structured coverage wins. Otherwise the description pattern is used. */
export function flooringCartonFacts(product: FlooringCartonSource): FlooringCartonFacts | null {
  if (!isFlooringCartonProduct(product)) return null;
  return {
    piecesPerBox: positiveNumber(product.piecesPerBox) ?? firstMatch(product.description, PIECES_PER_BOX),
    sqFtPerBox: positiveNumber(product.coverageSqFt) ?? firstMatch(product.description, SQFT_PER_BOX),
  };
}

export function formatCartonFact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}
