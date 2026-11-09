/**
 * Rule 4: a vertical filler is ONE continuous piece, floor to the top of the highest
 * cabinet it stands beside — including a glass stacker or topper above that cabinet.
 * There is no seam at the 34½ inch base line, at the 54 inch upper line, or under a stacker.
 *
 * The Designer used to cut a base filler to the base box and hang a second board for the
 * uppers, which left two visible seams on the same elevation. This module owns the one
 * elevation contract every filler writer uses.
 */
import {
  STD,
  isFillerItem,
  isRefrigerator,
  isRefrigeratorEndPanel,
  isStacker,
  placedHeight,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";

export type VerticalFillerSpec = {
  /** Bottom of the board, inches off the finished floor. */
  bottomIn: number;
  /** Top of the board. Never below the highest cabinet it finishes. */
  topIn: number;
  /** Stored board height (top - bottom), which is what the order and the elevation read. */
  heightIn: number;
  /** Why this top line was chosen, for the review list. */
  reason: "floor-to-upper-top" | "floor-to-stacker-top" | "floor-to-tall-top" | "floor-to-base-top";
};

/** Top of a cabinet including any glass stacker resting on it. */
export function cabinetTopWithTopper(item: PlacedCabinet, placed: readonly PlacedCabinet[]): number {
  const base = (Number(item.mountBottom) || 0) + placedHeight(item);
  const stackers = placed.filter((other) => other.stackedOnCabinetUid === item.uid);
  if (!stackers.length) return base;
  return Math.max(base, ...stackers.map((stacker) => (Number(stacker.mountBottom) || base) + placedHeight(stacker)));
}

/**
 * The single board that finishes a run beside `owner` (or the whole adjacent group when no
 * owner is given): from the floor to the highest cabinet top, stackers included.
 *
 * A filler that only touches base cabinets still reaches the top of the tallest cabinet in the
 * same vertical stack — this is why an 18 inch filler beside a B18 under a W1830 with a 12 inch
 * glass stacker runs to 96 inches as one piece.
 */
export function continuousVerticalFiller(input: {
  wallId: string;
  startIn: number;
  widthIn: number;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** The cabinet the filler is fitted against. Its vertical stack sets the top line. */
  owner?: PlacedCabinet | null;
}): VerticalFillerSpec {
  const onWall = input.placed.filter((item) => (
    !item.islandFace
    && !isFillerItem(item)
    && !isRefrigeratorEndPanel(item)
    && !isRefrigerator(item)
    && (item.placement === "base" || item.placement === "wall" || item.placement === "tall"
      || (item.placement === "appliance" && !isRefrigerator(item)))
    && item.wallId != null
    && item.wallId === input.wallId
  ));
  // The vertical stack the board finishes: every cabinet on this wall whose plan span overlaps
  // the board, or the owner's span (an upper sits directly above the base it belongs to).
  const spans: Array<{ start: number; end: number }> = [{ start: input.startIn, end: input.startIn + input.widthIn }];
  if (input.owner && input.owner.wallId === input.wallId) {
    const ownerStart = wallRunOffset(input.owner, input.wallId, input.room);
    spans.push({ start: ownerStart, end: ownerStart + wallRunSpan(input.owner, input.wallId, input.room) });
  }
  const tolerance = 0.75;
  const touching = onWall.filter((item) => {
    const start = wallRunOffset(item, input.wallId, input.room);
    const end = start + wallRunSpan(item, input.wallId, input.room);
    return spans.some((span) => start < span.end + tolerance && end > span.start - tolerance);
  });
  if (!touching.length) {
    // Nothing beside it: a bare board from the floor to the base box top.
    return { bottomIn: 0, topIn: STD.BASE_HEIGHT, heightIn: STD.BASE_HEIGHT, reason: "floor-to-base-top" };
  }
  const tops = touching.map((item) => cabinetTopWithTopper(item, input.placed));
  const topIn = Math.round(Math.max(...tops) * 1000) / 1000;
  const hasTopper = touching.some((item) => input.placed.some((other) => other.stackedOnCabinetUid === item.uid))
    || touching.some((item) => isStacker(item));
  const hasTall = touching.some((item) => item.placement === "tall");
  const hasUpper = touching.some((item) => item.placement === "wall");
  const reason: VerticalFillerSpec["reason"] = hasTopper
    ? "floor-to-stacker-top"
    : hasTall
      ? "floor-to-tall-top"
      : hasUpper
        ? "floor-to-upper-top"
        : "floor-to-base-top";
  return { bottomIn: 0, topIn, heightIn: Math.round(topIn * 1000) / 1000, reason };
}

/**
 * Rewrites an installed filler so it is the one continuous board. Keeps the purchased SKU, the
 * finish and the group identity; only the elevation changes.
 */
export function asContinuousVerticalFiller(
  filler: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
  owner?: PlacedCabinet | null,
): PlacedCabinet {
  if (!isFillerItem(filler) || filler.islandFace) return filler;
  const wallId = filler.wallId;
  if (!wallId) return filler;
  const spec = continuousVerticalFiller({
    wallId,
    startIn: wallRunOffset(filler, wallId, room),
    widthIn: wallRunSpan(filler, wallId, room),
    placed,
    room,
    owner,
  });
  if (
    filler.mountBottom === spec.bottomIn
    && Math.abs((Number(filler.height) || 0) - spec.heightIn) <= 1e-6
    && filler.fillerContinuousVertical === true
  ) return filler;
  return {
    ...filler,
    mountBottom: spec.bottomIn,
    height: spec.heightIn,
    nominalHeight: Math.max(Number(filler.nominalHeight) || 0, spec.heightIn),
    // The elevation must read the stored height exactly, not re-cut it to a base box.
    fillerMatchesFullOwnerEnvelope: true,
    fillerContinuousVertical: true,
  };
}

/** Applies the one continuous-board contract to every filler on the plan. */
export function normalizeContinuousVerticalFillers(
  placed: readonly PlacedCabinet[],
  room: RoomData,
): { placed: PlacedCabinet[]; changed: boolean } {
  let changed = false;
  const next = placed.map((item) => {
    if (!isFillerItem(item) || item.islandFace) return item;
    const owner = item.fillerForCabinetUid
      ? placed.find((candidate) => candidate.uid === item.fillerForCabinetUid) ?? null
      : null;
    const updated = asContinuousVerticalFiller(item, placed, room, owner);
    if (updated !== item) changed = true;
    return updated;
  });
  return { placed: changed ? next : [...placed], changed };
}
