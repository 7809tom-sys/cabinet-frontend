/**
 * Auto Design corner decision (Tom, Nov 14 2026).
 *
 *  1. Recognize every true 90° inside corner of the cabineted runs first, and
 *     reserve the inside-corner square (24" along each leg, the base depth)
 *     before any fill — including leftover, "use every inch", and the 15-rule
 *     intake repack. A plain B## must never occupy that square.
 *  2. After fixed appliances are seated at their measured positions, choose the
 *     corner TYPE from the remaining run math:
 *       - An appliance, or a required clearance such as the 15" fridge landing,
 *         near the corner on either leg → a blind corner (with its 3" filler,
 *         pulled along the longer leg as needed).
 *       - Room on both legs for a two-leg cabinet → a diagonal corner, then a
 *         lazy Susan.
 *  3. Pick a source-priced SKU of that type from the line. If the line sells
 *     none of that type, try the next valid type in the order above. If it sells
 *     no corner cabinet at all, keep the square blocked and surface
 *     `corner-cabinet-not-seated`. Never fall back to a straight base.
 *
 * A normal or diagonal corner base still gets a diagonal corner upper. A fridge
 * stays at the start or end of an L run. The 15" fridge-landing minimum is one
 * of the clearances that can force a blind corner.
 */
import { autoBuildSelectedWallCornerReservations, subtractAnchorRunReservations, type AnchorRunReservation } from "./autoDesignAutoBuild";
import {
  autoDesignCornerFamily,
  type AutoBuildCornerCandidate,
  type AutoDesignCornerFamily,
} from "./autoDesignCornerStage";

/** Width may be optional or null on catalog rows; keep this looser than DesignCabinet. */
type CornerOptionForDecision = Pick<AutoBuildCornerCandidate, "masterCode" | "description" | "cornerType" | "width">;
import { LANDING_MIN_IN } from "./autoDesignFifteenRules";
import { cornerLegClearance } from "./cornerFirst";
import {
  STD,
  dim,
  wallLength,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/** The inside-corner square along each meeting leg: a standard 24" base depth. */
export const INSIDE_CORNER_SQUARE_IN = STD.BASE_DEPTH;

/** Typical two-leg corner (lazy Susan / diagonal) when the line has not published a width. */
export const TWO_LEG_CORNER_DEFAULT_IN = 36;

export type CornerTypeDecision = {
  /** Tight (appliance or clearance near the corner) or open (room on both legs). */
  tightness: "tight" | "open";
  /** Families to try, first to last. `other` is always last. */
  order: AutoDesignCornerFamily[];
  /** Shopper-facing reason, suitable for a layout note. */
  reason: string;
  /** Width a two-leg corner would need on each leg. */
  twoLegNeedIn: number;
};

/** Reservations of the inside-corner square on every cabineted run. */
export function autoDesignInsideCornerReservations(
  room: RoomData,
  runWallIds: readonly string[],
  depthIn = INSIDE_CORNER_SQUARE_IN,
): Array<AnchorRunReservation & { wallId: string }> {
  const reserved: Array<AnchorRunReservation & { wallId: string }> = [];
  for (const wallId of runWallIds) {
    for (const span of autoBuildSelectedWallCornerReservations(wallId, room, runWallIds, depthIn)) {
      reserved.push({ wallId, start: span.start, end: span.end });
    }
  }
  return reserved;
}

export function cornerReservationsOnWall(
  wallId: string,
  reserved: ReadonlyArray<{ wallId?: string; start: number; end: number }>,
): AnchorRunReservation[] {
  return reserved
    .filter((span) => !span.wallId || span.wallId === wallId)
    .map((span) => ({ start: span.start, end: span.end }));
}

/** Drop reserved corner squares from otherwise free run segments. */
export function subtractInsideCornerReservations(
  segments: ReadonlyArray<{ start: number; length: number }>,
  reservations: ReadonlyArray<AnchorRunReservation>,
  minLen = 0,
): Array<{ start: number; length: number }> {
  return subtractAnchorRunReservations(segments, reservations).filter((segment) => segment.length >= minLen - 1e-6);
}

export function twoLegCornerNeedIn(options: readonly CornerOptionForDecision[]): number {
  const widths = options
    .filter((option) => {
      const family = autoDesignCornerFamily(option);
      return family === "diagonal" || family === "lazy-susan";
    })
    .map((option) => dim(option.width, 0))
    .filter((width) => width >= 9);
  return widths.length ? Math.min(...widths) : TWO_LEG_CORNER_DEFAULT_IN;
}

/**
 * Decide the corner-type order from appliance proximity and the run math.
 * Intake preference may swap diagonal vs lazy Susan on an open corner; it does
 * not override a tight (blind-first) decision, and it never introduces a straight base.
 */
export function decideAutoDesignCornerTypeOrder(input: {
  room: RoomData;
  cornerWallIds: readonly string[];
  corner: { x: number; y: number };
  placed: readonly PlacedCabinet[];
  options: readonly CornerOptionForDecision[];
  wiggleLimitIn?: number;
  preferLazySusan?: boolean;
  preferBlind?: boolean;
}): CornerTypeDecision {
  const legs = cornerLegClearance(input);
  const need = twoLegCornerNeedIn(input.options);
  const wiggle = Math.max(0, input.wiggleLimitIn ?? 0);
  const short: string[] = [];
  let tight = false;
  for (const leg of legs) {
    const length = wallLength(leg.wallId, input.room);
    const boundedByAppliance = length > 0 && leg.clearIn < length - 0.5;
    if (leg.clearIn + wiggle + 0.05 < need) {
      tight = true;
      short.push(`${leg.wallId} has only ${fmt(leg.clearIn)}" to the next box (a ${fmt(need)}" two-leg corner needs more)`);
      continue;
    }
    if (boundedByAppliance && leg.clearIn - need < LANDING_MIN_IN - 0.05) {
      tight = true;
      short.push(`${leg.wallId} would leave ${fmt(Math.max(0, leg.clearIn - need))}" beside the appliance after a ${fmt(need)}" two-leg corner (under the ${fmt(LANDING_MIN_IN)}" landing)`);
    }
  }
  if (tight) {
    return {
      tightness: "tight",
      order: ["blind", "lazy-susan", "diagonal", "other"],
      reason: short.join("; ") || "An appliance or required clearance is close to the corner.",
      twoLegNeedIn: need,
    };
  }
  const openOrder: AutoDesignCornerFamily[] = input.preferLazySusan
    ? ["lazy-susan", "diagonal", "blind", "other"]
    : ["diagonal", "lazy-susan", "blind", "other"];
  // A shopper who asked for a blind corner still gets a two-leg cabinet when both
  // legs are open; the math, not the door line or a default B42, decides the type.
  void input.preferBlind;
  return {
    tightness: "open",
    order: openOrder,
    reason: `Both legs have room for a ${fmt(need)}" two-leg corner with the ${fmt(LANDING_MIN_IN)}" landing left beside any nearby appliance.`,
    twoLegNeedIn: need,
  };
}

/** Options in the decided family order, largest first inside each family. The first family with no SKU is simply skipped. */
export function cornerOptionsInTypeOrder<T extends AutoBuildCornerCandidate>(
  options: readonly T[],
  order: readonly AutoDesignCornerFamily[],
): T[] {
  const seen = new Set<number | string>();
  const out: T[] = [];
  const byWidth = (family: AutoDesignCornerFamily) => [...options]
    .filter((option) => autoDesignCornerFamily(option) === family)
    .sort((left, right) => dim(right.width, 0) - dim(left.width, 0) || left.masterCode.localeCompare(right.masterCode));
  for (const family of order) {
    for (const option of byWidth(family)) {
      const key = option.id ?? option.masterCode;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(option);
    }
  }
  for (const option of options) {
    const key = option.id ?? option.masterCode;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(option);
  }
  return out;
}

export function describeCornerTypeDecision(slotLabel: string, decision: CornerTypeDecision): string {
  const first = decision.order.find((family) => family !== "other") ?? "blind";
  const typeName = first === "blind" ? "a blind corner"
    : first === "lazy-susan" ? "a lazy Susan"
    : first === "diagonal" ? "a diagonal corner"
    : "a corner cabinet";
  return `${slotLabel}: ${typeName} (${decision.tightness === "tight" ? decision.reason : decision.reason})`;
}

function fmt(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
