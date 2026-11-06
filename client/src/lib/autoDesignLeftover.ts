/**
 * Rule 3: leftover space uses real cabinets before filler.
 *
 * A 9–12 inch hole beside a range used to stay open because the only closers were a ≤3 inch
 * filler or a like-for-like cabinet, and the range neighbour had to be ≥15 inches wide. The
 * real answer is to resize the neighbour: an 18 inch drawer base becomes a 27, a B9 plus a
 * 1 inch filler takes the last inch, and filler is the very last resort.
 *
 * Rule 1 says nothing ever extends past the refrigerator end panel, rule 3 says cabinets slide
 * tight and fillers come last, and a bare 1–1.5 inch gap is left at skins rather than forced
 * shut with a sliver.
 */
import { autoDesignFillerMaxIn } from "./autoDesignSeamFillers";
import { kitchenRuleNumber, KITCHEN_RULE_PARAMETER_DEFAULTS } from "./kitchenRuleParameters";
import {
  COLLISION_EPSILON_IN,
  cabinetWall,
  dim,
  isFillerItem,
  isPanelItem,
  isRefrigeratorEndPanel,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/** A gap 1–1.5 inches wide is left bare at a skin instead of being forced shut. */
export const LEFT_SKIN_BARE_GAP_MIN_IN = 1;
export const LEFT_SKIN_BARE_GAP_MAX_IN = 1.5;
/** Smallest real base the line is expected to sell for a narrow leftover (Kitchen Rules `narrow_cabinet_max_in`). */
export const LEFTOVER_NARROW_CABINET_MAX_IN = KITCHEN_RULE_PARAMETER_DEFAULTS.narrow_cabinet_max_in;

/** Widest cabinet that still counts as narrow enough to close a leftover. */
export function leftoverNarrowCabinetMaxIn(): number {
  return kitchenRuleNumber("narrow_cabinet_max_in");
}

export type LeftoverResolution =
  | {
    kind: "widen-neighbor";
    /** Neighbour replaced by a wider real catalog cabinet. */
    neighbor: PlacedCabinet;
    replacement: DesignCabinet;
    /** Width the replacement occupies along the run. */
    widthIn: number;
    /** Run start for the replacement. */
    startIn: number;
  }
  | {
    kind: "narrow-cabinet";
    /** A real narrow cabinet that takes part of the leftover. */
    source: DesignCabinet;
    widthIn: number;
    startIn: number;
    /** Filler, if any, that finishes the leftover beside the narrow cabinet. */
    fillerIn: number;
  }
  | { kind: "filler"; widthIn: number; startIn: number }
  | { kind: "leave-bare"; widthIn: number; startIn: number; reason: string };

/** Cabinet widths the line really sells along a run, largest first. */
function soldWidths(catalog: readonly DesignCabinet[]): number[] {
  return Array.from(new Set(catalog.map((row) => dim(row.width, 0)).filter((width) => width > 0)))
    .sort((left, right) => right - left);
}

/**
 * Same-family as the neighbour: a door base stays a door base, a drawer base stays the SAME
 * drawer base family (3DB stays 3DB, 2DB stays 2DB), a corner stays a corner. Resizing must
 * never change what the cabinet *is*, only how wide it is.
 */
function sameFamily(neighbor: PlacedCabinet, candidate: DesignCabinet): boolean {
  const neighborCode = `${neighbor.masterCode ?? ""}`.toUpperCase();
  const candidateCode = `${candidate.masterCode ?? ""}`.toUpperCase();
  const drawerFamily = (code: string): string | null => {
    const match = code.match(/^(3DB|2DB|3VDB|2VDB|DB|BD)[-_]?\d/);
    if (!match) return null;
    return match[1]!.replace(/^2VDB$/, "2DB").replace(/^3VDB$/, "3DB");
  };
  const neighborFamily = drawerFamily(neighborCode);
  const candidateFamily = drawerFamily(candidateCode);
  if ((neighborFamily != null) !== (candidateFamily != null)) return false;
  if (neighborFamily != null && neighborFamily !== candidateFamily) return false;
  if (isCornerLike(neighborCode) !== isCornerLike(candidateCode)) return false;
  const neighborDoor = /^B[-_]?\d/.test(neighborCode);
  const candidateDoor = /^B[-_]?\d/.test(candidateCode);
  if (neighborDoor && !candidateDoor) return false;
  return true;
}

function isCornerLike(code: string): boolean {
  return /^(?:BBC|WBC|BLB|BBR|LSB?|ERB|BER|DCB|DCW|WDC|CDB|CSB|BEC|BA)/.test(code);
}

/**
 * Resolves one leftover gap. `neighbor` is the cabinet the gap butts against; pass the one on
 * the side the cabinets can grow toward. Ordered exactly as the owner asked: widen a real
 * cabinet, then a real narrow cabinet plus a small filler, then filler, then a bare gap at a skin.
 */
export function resolveLeftoverGap(input: {
  gapIn: number;
  startIn: number;
  neighbor: PlacedCabinet | null;
  /** Straight base rows the line sells at this width family. */
  catalog: readonly DesignCabinet[];
  room: RoomData;
  /** True when the gap ends at a refrigerator end panel (nothing may pass it). */
  cappedByRefrigeratorPanel?: boolean;
  /** True when the gap is at a finished end (skin), where a small bare gap is correct. */
  atSkin?: boolean;
  /** Filler allowed at all? Auto-Design caps filler at 3 inches. */
  fillerMaxIn?: number;
}): LeftoverResolution {
  const gap = Math.round(input.gapIn * 1000) / 1000;
  const start = Math.round(input.startIn * 1000) / 1000;
  const fillerMax = input.fillerMaxIn ?? autoDesignFillerMaxIn();
  if (!(gap > COLLISION_EPSILON_IN)) return { kind: "leave-bare", widthIn: 0, startIn: start, reason: "no gap" };

  if (input.cappedByRefrigeratorPanel) {
    // Nothing grows past the panel; only filler inside the gap is allowed.
    if (gap <= fillerMax + COLLISION_EPSILON_IN) return { kind: "filler", widthIn: gap, startIn: start };
    return {
      kind: "leave-bare",
      widthIn: gap,
      startIn: start,
      reason: "the refrigerator end panel stops every piece, and this opening is wider than a filler",
    };
  }

  // 1) Widen the adjoining real cabinet to the nearest real width that closes the gap.
  if (input.neighbor && input.neighbor.placement === "base" && !isFillerItem(input.neighbor)) {
    const neighborWidth = Number(input.neighbor.width) || 0;
    const wanted = neighborWidth + gap;
    const matches = input.catalog
      .filter((row) => sameFamily(input.neighbor!, row))
      .map((row) => ({ row, width: dim(row.width, 0) }))
      .filter((entry) => entry.width > neighborWidth + COLLISION_EPSILON_IN)
      .filter((entry) => entry.width <= wanted + COLLISION_EPSILON_IN)
      // Whatever the wider cabinet does not take must still be fillable.
      .filter((entry) => wanted - entry.width <= fillerMax + COLLISION_EPSILON_IN)
      .sort((left, right) => right.width - left.width);
    const best = matches[0];
    if (best && wanted - best.width <= fillerMax + COLLISION_EPSILON_IN) {
      const wallId = cabinetWall(input.neighbor, input.room);
      const neighborStart = wallRunOffset(input.neighbor, wallId, input.room);
      // Grow INTO the gap: a gap on the neighbour's right grows it rightward from its own start,
      // a gap on its left grows it leftward so its far edge stays put.
      const growLeft = start < neighborStart - COLLISION_EPSILON_IN;
      return {
        kind: "widen-neighbor",
        neighbor: input.neighbor,
        replacement: best.row,
        widthIn: best.width,
        startIn: Math.round((growLeft ? neighborStart + neighborWidth - best.width : neighborStart) * 1000) / 1000,
      };
    }
  }

  // 2) A real narrow cabinet plus a small filler finishes the last inches.
  const narrow = input.catalog
    .filter((row) => dim(row.width, 0) > 0 && dim(row.width, 0) <= leftoverNarrowCabinetMaxIn())
    .map((row) => ({ row, width: dim(row.width, 0) }))
    .filter((entry) => entry.width <= gap + COLLISION_EPSILON_IN)
    .filter((entry) => gap - entry.width <= fillerMax + COLLISION_EPSILON_IN)
    .sort((left, right) => right.width - left.width)[0];
  if (narrow) {
    return {
      kind: "narrow-cabinet",
      source: narrow.row,
      widthIn: narrow.width,
      startIn: start,
      fillerIn: Math.round(Math.max(0, gap - narrow.width) * 1000) / 1000,
    };
  }

  // 3) A finished end keeps a bare 1–1.5 inch gap: a sliver of filler there is not what an
  // installer wants. This beats filler, which is the last resort everywhere else.
  if (input.atSkin && gap >= LEFT_SKIN_BARE_GAP_MIN_IN && gap <= LEFT_SKIN_BARE_GAP_MAX_IN) {
    return { kind: "leave-bare", widthIn: gap, startIn: start, reason: "a bare gap at a finished end reads as the scribe" };
  }

  // 4) Filler, only when it fits the Auto-Design cap.
  if (gap <= fillerMax + COLLISION_EPSILON_IN) return { kind: "filler", widthIn: gap, startIn: start };

  return {
    kind: "leave-bare",
    widthIn: gap,
    startIn: start,
    reason: `no real cabinet closes a ${gap}″ opening and it is wider than a ${fillerMax}″ filler`,
  };
}

/** Neighbour that owns a gap edge on a run, or null when the edge is a wall end or a panel. */
export function neighborAtGapEdge(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallId: string;
  /** Edge position along the run that the gap touches. */
  edgeIn: number;
  side: "start" | "end";
}): PlacedCabinet | null {
  const tolerance = 0.75;
  for (const item of input.placed) {
    if (cabinetWall(item, input.room) !== input.wallId) continue;
    if (isFillerItem(item) || isPanelItem(item) || isRefrigeratorEndPanel(item)) continue;
    const start = wallRunOffset(item, input.wallId, input.room);
    const end = start + wallRunSpan(item, input.wallId, input.room);
    if (input.side === "start" ? Math.abs(end - input.edgeIn) <= tolerance : Math.abs(start - input.edgeIn) <= tolerance) {
      return item;
    }
  }
  return null;
}

/** True when a refrigerator end panel caps the run at this edge. */
export function refrigeratorPanelAtEdge(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallId: string;
  edgeIn: number;
}): boolean {
  return input.placed.some((item) => (
    isRefrigeratorEndPanel(item)
    && cabinetWall(item, input.room) === input.wallId
    && Math.abs(wallRunOffset(item, input.wallId, input.room) - input.edgeIn) <= 0.75
  ));
}

/** The gap widths worth acting on: bigger than filler alone, smaller than a run. */
export function leftoverGapIsActionable(gapIn: number): boolean {
  return gapIn > autoDesignFillerMaxIn() + COLLISION_EPSILON_IN && gapIn <= 48;
}

/** Catalog widths available for a wider neighbour, for review text. */
export function soldNeighborWidths(neighbor: PlacedCabinet, catalog: readonly DesignCabinet[]): number[] {
  return soldWidths(catalog.filter((row) => sameFamily(neighbor, row)));
}
