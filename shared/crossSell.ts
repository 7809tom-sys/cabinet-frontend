// Pure, framework-free cross-sell logic for the checkout cart.
//
// Given the cabinets already in the cart, decide which accessory categories are
// worth recommending. The server resolves these category keys to real, buyable
// SKUs in the cart's locked door style + tier; the UI only shows what resolves.
//
// Design rules:
//  - Only recommend accessories that make sense for what's in the cart.
//  - Never recommend an item that is already in the cart.
//  - Trays make sense when there is a base cabinet with doors (a place to put
//    a roll-out). Crown/light-rail molding makes sense when wall cabinets are
//    present. End panels finish any run. A touch-up kit is always sensible.
//  - Fillers make sense when there are cabinets at all (gaps against walls).

export type CrossSellCategory =
  | "touchUpKit"
  | "rollOutTray"
  | "endPanel"
  | "crownMolding"
  | "filler";

/** Minimal view of a cart line needed to reason about recommendations. */
export interface CrossSellCartLine {
  masterCode: string;
  /** base | wall | tall | accessory | appliance | opening — best-effort. */
  placement?: string | null;
  numberOfDoors?: number | null;
  isCornerCabinet?: boolean | null;
}

/** A resolved, buyable recommendation row (priced by the server). */
export interface CrossSellItem {
  category: CrossSellCategory;
  masterCode: string;
  name: string;
  /** Unit price in the cart's tier, or null when quoted later. */
  unitPrice: number | null;
  /** Short, human reason shown under the item. */
  reason: string;
}

const PLACEMENT_BASE = new Set(["base", "ada base", "vanity"]);

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Decide which accessory categories are relevant for the given cart.
 * Returns categories in display priority order. Pure + deterministic.
 */
export function relevantCategories(lines: CrossSellCartLine[]): CrossSellCategory[] {
  if (lines.length === 0) return [];

  let hasBase = false;
  let hasWall = false;
  let hasBaseWithDoors = false;

  for (const l of lines) {
    const p = norm(l.placement);
    if (PLACEMENT_BASE.has(p)) {
      hasBase = true;
      if ((l.numberOfDoors ?? 0) > 0) hasBaseWithDoors = true;
    }
    if (p === "wall") hasWall = true;
  }

  const out: CrossSellCategory[] = [];
  // Roll-out trays: only when there's a base cabinet you could fit them into.
  if (hasBaseWithDoors) out.push("rollOutTray");
  // Crown molding: only meaningful with wall cabinets to crown.
  if (hasWall) out.push("crownMolding");
  // End panels finish exposed sides of any run.
  out.push("endPanel");
  // Fillers close gaps wherever there are cabinets.
  if (hasBase || hasWall) out.push("filler");
  // Touch-up kit is always a sensible add for a cabinet order.
  out.push("touchUpKit");

  return out;
}

/**
 * Filter resolved candidate items down to a final recommendation list:
 *  - drop anything whose masterCode is already in the cart
 *  - keep only categories deemed relevant
 *  - cap per-category and overall to keep the UI focused
 */
export function selectRecommendations(
  candidates: CrossSellItem[],
  cartCodes: string[],
  relevant: CrossSellCategory[],
  opts: { perCategory?: number; max?: number } = {}
): CrossSellItem[] {
  const perCategory = opts.perCategory ?? 2;
  const max = opts.max ?? 6;

  const inCart = new Set<string>(cartCodes.map(norm));
  const relevantSet = new Set(relevant);

  const perCatCount = new Map<CrossSellCategory, number>();
  const seen = new Set<string>();
  const out: CrossSellItem[] = [];

  // Preserve the priority order defined by `relevant`.
  for (const cat of relevant) {
    for (const item of candidates) {
      if (item.category !== cat) continue;
      if (!relevantSet.has(item.category)) continue;
      if (inCart.has(norm(item.masterCode))) continue;
      if (seen.has(norm(item.masterCode))) continue;
      const n = perCatCount.get(cat) ?? 0;
      if (n >= perCategory) continue;
      out.push(item);
      seen.add(norm(item.masterCode));
      perCatCount.set(cat, n + 1);
      if (out.length >= max) return out;
    }
  }
  return out;
}
