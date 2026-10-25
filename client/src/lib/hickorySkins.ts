// ─── Hickory unfinished-end skin auto-suggest engine ────────────────────────
// Business rule: Hickory cabinets ship with UNFINISHED exposed sides. Any cabinet
// end that is visible (not buried against a wall and not abutted by a neighboring
// cabinet) needs a matching Hickory finished-end "skin" panel so the run looks
// finished. We auto-suggest one skin per exposed end, as a SEPARATE line item at
// the same Hickory finish.
//
// IMPORTANT: the real skin SKU + pricing is PENDING catalog-book confirmation
// from the owner. Until confirmed, suggestions are emitted with a placeholder
// suggestCode and `pendingSku: true` so the UI can clearly flag them and the
// owner can drop in the real SKU later without reworking this logic.
//
// All math is in INCHES and pure/deterministic so it is unit-testable
// independently of the canvas and the database.

import {
  type PlacedCabinet,
  type RoomData,
  type Placement,
  cabinetWall,
  wallSpanMeasure,
  isPanelItem,
  placedHeight,
  rotatedSize,
} from "./design";

// Minimal shape of a door style we need to decide "is this Hickory?". The real
// DoorStyle row has more fields; we only read the descriptive ones.
export interface SkinStyleInfo {
  woodSpecies?: string | null;
  ourName?: string | null;
  distributorName?: string | null;
  finish?: string | null;
  color?: string | null;
  doorStyle?: string | null;
}

/**
 * True when a door style is a Hickory wood species. We check woodSpecies first
 * (authoritative), then fall back to scanning the descriptive name fields so a
 * style named "… Hickory …" is still caught even if woodSpecies wasn't filled.
 */
export function isHickoryStyle(style: SkinStyleInfo | null | undefined): boolean {
  if (!style) return false;
  const hay = [
    style.woodSpecies,
    style.ourName,
    style.distributorName,
    style.finish,
    style.color,
    style.doorStyle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\bhickory\b/.test(hay);
}

// Which left/right end of a cabinet is exposed. Along the wall run axis, "start"
// is the lower coordinate end and "end" is the higher coordinate end.
export type EndSide = "start" | "end";

export interface ExposedEnd {
  /** The placed cabinet that owns this exposed end. */
  uid: string;
  masterCode: string;
  placement: Placement;
  /** Which run-axis end is exposed. */
  end: EndSide;
  /** Cabinet height in inches (drives which skin size is needed). */
  height: number;
  /** Cabinet depth in inches (the skin covers a side of this depth). */
  depth: number;
}

// A cabinet end counts as exposed when the gap from that end to the nearest
// obstacle on that side is at least this many inches AND that obstacle is not a
// neighboring cabinet. A tiny gap (filler/scribe) is not an exposed end.
const EXPOSED_GAP_TOLERANCE_IN = 1.5;

/** Cabinets that can carry a finished/unfinished exposed END (base/wall/tall). */
function canHaveExposedEnd(p: PlacedCabinet): boolean {
  if (p.placement !== "base" && p.placement !== "wall" && p.placement !== "tall") {
    return false;
  }
  // A panel/skin itself never needs its own skin.
  if (isPanelItem(p)) return false;
  return true;
}

/**
 * Detect every exposed cabinet END in a layout. An end is exposed when, along
 * the wall the cabinet sits on, there is no neighboring cabinet abutting that
 * side (the next obstacle is the wall/open space, separated by more than the
 * tolerance). Cabinets flush in a corner still expose the OUTBOARD end if it is
 * open. This mirrors how an installer decides where a finished skin is needed.
 */
export function exposedEnds(
  placed: PlacedCabinet[],
  room: RoomData,
): ExposedEnd[] {
  const out: ExposedEnd[] = [];
  for (const p of placed) {
    if (!canHaveExposedEnd(p)) continue;
    const side = cabinetWall(p, room);
    const m = wallSpanMeasure(p, room, placed, side);
    const { d } = rotatedSize(p);
    const height = placedHeight(p);

    // "before" = gap on the start side, "after" = gap on the end side.
    // An end is exposed when the obstacle on that side is NOT a cabinet AND the
    // gap is wide enough to actually see the cabinet side (not a tight filler).
    if (!m.beforeIsCabinet && m.before >= EXPOSED_GAP_TOLERANCE_IN) {
      out.push({ uid: p.uid, masterCode: p.masterCode, placement: p.placement, end: "start", height, depth: d });
    }
    if (!m.afterIsCabinet && m.after >= EXPOSED_GAP_TOLERANCE_IN) {
      out.push({ uid: p.uid, masterCode: p.masterCode, placement: p.placement, end: "end", height, depth: d });
    }
  }
  return out;
}

/** Total count of exposed ends — drives how many skins are needed. */
export function exposedEndCount(placed: PlacedCabinet[], room: RoomData): number {
  return exposedEnds(placed, room).length;
}

// A single auto-suggested Hickory skin line. One per exposed end. The real SKU
// is pending confirmation, so `pendingSku` is true and `suggestCode` is a
// clearly-labeled placeholder the owner replaces once the book is reviewed.
export interface HickorySkinSuggestion {
  /** The exposed end this skin covers (cabinet uid + which side). */
  uid: string;
  masterCode: string;
  end: EndSide;
  placement: Placement;
  /** Placeholder code until the real Hickory skin SKU is confirmed. */
  suggestCode: string;
  /** Human label for the BOM / order line. */
  description: string;
  /** Skin height in inches (matches the cabinet end it covers). */
  height: number;
  /** Skin depth/width in inches (covers the cabinet's side, which is its depth). */
  depth: number;
  quantity: number;
  /** Always true until the owner confirms the real skin SKU + price. */
  pendingSku: boolean;
}

// Placeholder skin codes by placement bucket. These are NOT real catalog SKUs —
// they are flagged pending confirmation. Kept distinct per bucket because a base
// (34.5") vs wall (30") vs tall (84") skin is a different sized panel.
const PLACEHOLDER_SKIN_CODE: Record<Placement, string> = {
  base: "HICKORY-SKIN-BASE",
  wall: "HICKORY-SKIN-WALL",
  tall: "HICKORY-SKIN-TALL",
  appliance: "HICKORY-SKIN-BASE", // not used (appliances are filtered out)
  baseTop: "HICKORY-SKIN-BASE", // specialty items on base cabinets
  underCabinet: "HICKORY-SKIN-WALL", // specialty items under wall cabinets
};

function placementLabel(p: Placement): string {
  if (p === "wall") return "Wall";
  if (p === "tall") return "Tall";
  if (p === "baseTop") return "Base Top";
  if (p === "underCabinet") return "Under Cabinet";
  return "Base";
}

/**
 * Build the list of auto-suggested Hickory skins for a design. Returns an empty
 * list when the selected style is not Hickory (the rule is Hickory-only). One
 * skin is suggested per exposed cabinet end, sized to that cabinet's bucket.
 */
export function hickorySkinSuggestions(
  placed: PlacedCabinet[],
  room: RoomData,
  style: SkinStyleInfo | null | undefined,
): HickorySkinSuggestion[] {
  if (!isHickoryStyle(style)) return [];
  const ends = exposedEnds(placed, room);
  return ends.map((e) => ({
    uid: e.uid,
    masterCode: e.masterCode,
    end: e.end,
    placement: e.placement,
    suggestCode: PLACEHOLDER_SKIN_CODE[e.placement],
    description: `Hickory Finished End Skin — ${placementLabel(e.placement)} (covers exposed side of ${e.masterCode})`,
    height: e.height,
    depth: e.depth,
    quantity: 1,
    pendingSku: true,
  }));
}
