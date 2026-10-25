// Roll-out (pull-out) shelf matching for per-cabinet add-ons.
//
// Business rules confirmed with the dealer:
//   • A roll-out shelf is sized to the cabinet it goes inside: a B18 takes an
//     18" shelf, a B24 a 24" shelf, etc. When there is no shelf of the exact
//     nominal width, we pick the LARGEST available shelf that still fits inside
//     the cabinet (width <= cabinet nominal width). A B17 therefore takes a 15"
//     shelf, a B23 a 21" shelf, and so on.
//   • Each distributor line carries its OWN roll-out shelf SKUs — you cannot mix
//     a shelf from one line into a cabinet from another line. The caller MUST
//     pass only the shelves available for the cabinet's effective door style /
//     line, so the match is always same-line.
//   • Each eligible cabinet can carry 1–5 rollout trays, with 0 meaning removed.
//   • Eligible cabinets: bases 18" through 36" wide with a door, plus pantry/tall
//     cabinets 18" through 36" wide with doors. Wall cabinets, corners, drawer-only cabinets,
//     appliance/opening towers, fillers, panels, and trim are excluded.

export const MIN_ROLLOUT_ELIGIBLE_WIDTH_IN = 18;
export const MAX_ROLLOUT_ELIGIBLE_WIDTH_IN = 36;
export const MAX_ROLLOUT_TRAYS_PER_CABINET = 5;

export function normalizedRollOutTrayQty(value: unknown): number {
  const qty = Math.floor(Number(value));
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.min(MAX_ROLLOUT_TRAYS_PER_CABINET, qty);
}

/** Minimal shape of a catalog roll-out shelf row used for matching. */
export interface TrayOption {
  cabinetId: number;
  masterCode: string;
  /** Nominal shelf width in inches (e.g. 18, 21, 24). */
  width: number;
}

/** Minimal shape of the placed cabinet we are matching a tray for. */
export interface TrayTarget {
  placement?: string | null;
  category?: string | null;
  subCategory?: string | null;
  masterCode?: string | null;
  numberOfDoors?: number | null;
  isCornerCabinet?: boolean | null;
  /** Catalog nominal width; falls back to live width when absent. */
  nominalWidth?: number | null;
  width?: number | null;
}

/**
 * True when this cabinet can take a roll-out shelf. Base cabinets with at least
 * one door qualify; everything else (walls, tall/pantry, corners, drawer-only
 * bases, fillers/panels) is excluded. Sink bases ARE eligible — the dealer
 * offers shelves there too because the end use varies.
 */
export function isRollOutEligible(c: TrayTarget): boolean {
	  const placement = (c.placement ?? "").toLowerCase();
	  if (placement && placement !== "base" && placement !== "tall") return false;

  if (c.isCornerCabinet) return false;

  const code = (c.masterCode ?? "").toUpperCase();
  const sub = (c.subCategory ?? "").toLowerCase();
  const cat = (c.category ?? "").toLowerCase();
	  const hay = `${sub} ${cat} ${code}`.toLowerCase();
	  const width = targetWidth(c);
	  if (width + 1e-9 < MIN_ROLLOUT_ELIGIBLE_WIDTH_IN || width - 1e-9 > MAX_ROLLOUT_ELIGIBLE_WIDTH_IN) return false;

  // Not a real base box: panels, skins, fillers, trim, accessories, the tray
  // itself, decorative legs, brackets, dummy fronts, etc.
  if (
	    /\bpanel\b|\bskin\b|\bfiller\b|\bscribe\b|trim|molding|moulding|accessory|roll[- ]?out|pull[- ]?out|decorative leg|bracket|dummy front|toe ?kick|\bappliance\b|\boven\b|microwave|refrigerator|\bopen(?:ing)?\b|bookcase/.test(
      hay,
    )
  ) {
    return false;
  }

  // Drawer-only bases (no door) can't take a behind-the-door roll-out.
  if (/drawer base/.test(sub) && (c.numberOfDoors ?? 0) <= 0) return false;

  // Must have a door to hide/ride the shelf.
  if ((c.numberOfDoors ?? 0) <= 0) return false;

  return true;
}

/** Nominal width to match against (catalog nominal preferred, live as fallback). */
export function targetWidth(c: TrayTarget): number {
  const nominal = typeof c.nominalWidth === "number" && c.nominalWidth > 0 ? c.nominalWidth : null;
  if (nominal != null) return nominal;
  const live = typeof c.width === "number" && c.width > 0 ? c.width : 0;
  return live;
}

/**
 * Pick the best roll-out shelf for a cabinet from the shelves available IN ITS
 * OWN LINE (the caller filters by styleId before calling). Returns the largest
 * shelf whose width is <= the cabinet's nominal width, or null when the cabinet
 * is ineligible, there are no shelves, or none fit.
 *
 * A small tolerance (0.25") absorbs decimal rounding so a 24.00" cabinet still
 * matches a 24" shelf.
 */
export function matchRollOutTray(c: TrayTarget, options: TrayOption[]): TrayOption | null {
  if (!isRollOutEligible(c)) return null;
  const w = targetWidth(c);
  if (w <= 0) return null;
  if (!options || options.length === 0) return null;

  let best: TrayOption | null = null;
  for (const opt of options) {
    if (!(opt.width > 0)) continue;
    if (opt.width <= w + 0.25) {
      if (best == null || opt.width > best.width) best = opt;
    }
  }
  return best;
}

// ─── BOM / cart aggregation ──────────────────────────────────────────────────
// Given the placed cabinets (each carrying an effective styleId, a nominal
// width and a rolloutQty) plus the available shelves grouped by styleId, build
// the aggregated roll-out shelf line items. Lines are grouped by
// (matched shelf cabinetId + styleId) so multiple cabinets that resolve to the
// same shelf in the same line collapse into one line with summed quantity —
// mirroring how cabinets themselves aggregate on the build sheet and cart.

/** A placed cabinet as seen by the aggregator. */
export interface TrayPlaced extends TrayTarget {
  /** Effective door style for this cabinet (override or design default). */
  effectiveStyleId?: number | null;
  /** Number of roll-out shelves the customer added (0 = none). */
  rolloutQty?: number | null;
}

/** A priced shelf option keyed to a specific door style line. */
export interface TrayOptionForStyle extends TrayOption {
  styleId: number;
  description?: string | null;
  unitPrice?: number | null;
}

/** One aggregated roll-out shelf line for the BOM / cart. */
export interface TrayLine {
  cabinetId: number;
  masterCode: string;
  description: string | null;
  styleId: number;
  width: number;
  qty: number;
  unitPrice: number | null;
}

export interface RollOutTrayCartItem {
  masterCode: string;
  name: string;
  styleId: number;
  styleLabel: string;
  distributorId: number | null;
  tier: import("@shared/pricingTier").PricingTier;
  unitPrice: number;
  qty: number;
}

/** Convert only buyable rollout lines into the exact cart payload. */
export function rollOutTrayCartItems(args: {
  lines: readonly TrayLine[];
  styleNameById: ReadonlyMap<number, string>;
  distributorId: number | null;
  tier: import("@shared/pricingTier").PricingTier;
}): RollOutTrayCartItem[] {
  return args.lines.flatMap((line) => {
    if (line.unitPrice == null || !Number.isFinite(line.unitPrice)) return [];
    return [{
      masterCode: line.masterCode,
      name: line.description ?? line.masterCode,
      styleId: line.styleId,
      styleLabel: args.styleNameById.get(line.styleId) ?? "",
      distributorId: args.distributorId,
      tier: args.tier,
      unitPrice: line.unitPrice,
      qty: line.qty,
    }];
  });
}

/**
 * Resolve and aggregate roll-out shelf lines for a whole design.
 *
 * @param placed         placed cabinets (with effectiveStyleId, width, rolloutQty)
 * @param optionsByStyle map of styleId -> available shelves IN THAT LINE
 */
export function buildRollOutLines(
  placed: TrayPlaced[],
  optionsByStyle: Map<number, TrayOptionForStyle[]>,
): TrayLine[] {
  const lines = new Map<string, TrayLine>();
  for (const p of placed) {
	    const qty = normalizedRollOutTrayQty(p.rolloutQty);
    if (qty <= 0) continue;
    if (!isRollOutEligible(p)) continue;
    const sid = p.effectiveStyleId;
    if (sid == null) continue;
    const opts = optionsByStyle.get(sid);
    if (!opts || opts.length === 0) continue;
    const match = matchRollOutTray(p, opts) as TrayOptionForStyle | null;
    if (!match) continue;
    const key = `${match.cabinetId}:${sid}`;
    const existing = lines.get(key);
    if (existing) {
      existing.qty += qty;
    } else {
      lines.set(key, {
        cabinetId: match.cabinetId,
        masterCode: match.masterCode,
        description: match.description ?? null,
        styleId: sid,
        width: match.width,
        qty,
        unitPrice: match.unitPrice ?? null,
      });
    }
  }
  return Array.from(lines.values());
}
