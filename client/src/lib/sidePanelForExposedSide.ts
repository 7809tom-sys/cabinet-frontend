/**
 * Side panels that an exposed side earns on its own — no prompt, no filler.
 *
 * Issue #354 items 3 and 4 (Tom, Nov 9 2026):
 *
 *   "Today, placing a range in the Pelican designer asks for a filler every
 *    time. Instead, the designer should automatically shift the cabinets over
 *    and put a 3/4 in side panel on the exposed side next to the range (or
 *    microwave), and tell the customer a side panel is going in because that
 *    side will be exposed."
 *
 *   "...when a smaller cabinet sits next to a larger one (a shallower or
 *    shorter cabinet beside a deeper or taller one) and leaves part of the
 *    larger cabinet's side exposed, it automatically adds a 3/4 in side panel on
 *    the exposed side and notifies the customer, same as the range rule."
 *
 * The panels come from the altaeuro V8.2 frameless book (pp. 73-74) and are
 * priced from the door style's catalog SKU:
 *
 *   3/4" wall end panels   WEP1523 / WEP1530 / WEP1535 / WEP1542  (by height)
 *   3/4" base end panel    BEP2535
 *   3/4" tall end panel    TEP3096   (long sheet BP9642 where 42" is enough)
 *
 * Fillers stay for gaps only (`OF*` / `AF3006` / `SM8` scribe). This module is
 * deliberately separate from the broad exposed-side engine in
 * `exposedSidePanels.ts` and from the range-flank panels in
 * `autoDesignRangeFlanks.ts`: it answers exactly these two questions and
 * nothing else, so the two panel rules can be merged without touching either
 * one's internals.
 */
import { hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";
import {
  STD,
  appendCollisionFreePlacements,
  cabinetWall,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  placedHeight,
  rotatedSize,
  wallLength,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import {
  selectAefEndPanel,
  type AefEndPanelCatalogItem,
  type AefEndPanelSelection,
} from "./aefEndPanelStock";

/** A side panel is 3/4" stock, the same finished-end thickness used everywhere else. */
export const SIDE_PANEL_THICKNESS_IN = STD.PANEL_THICKNESS;

/** How close two boxes must stand to count as touching for this rule. */
const SEAM_IN = 0.125;

/** How far past its neighbour a taller/deeper box has to stand to have a visible side. */
const EXPOSURE_MIN_IN = 0.125;

export type SidePanelReason = "beside-range" | "beside-microwave" | "smaller-neighbour";

export type SidePanelNeed = {
  /** The cabinet whose side is exposed. */
  hostUid: string;
  hostCode: string;
  /** The side that faces the opening. `start` is the run-start side. */
  side: "start" | "end";
  reason: SidePanelReason;
  wallId: WallSide;
  /** Along-wall start the 3/4" board occupies, outside the host body. */
  startIn: number;
  /** The exposed side only needs finishing for this much of the box. */
  heightIn: number;
  depthIn: number;
  placement: "wall" | "base" | "tall";
  selection: AefEndPanelSelection;
  /** Customer-facing sentence for the design-check notice. */
  message: string;
};

export type SidePanelResult = {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  needs: SidePanelNeed[];
  /** Needs the run had no room for, named rather than silently dropped. */
  skipped: Array<{ hostCode: string; side: "start" | "end"; reason: SidePanelReason; why: string }>;
};

function isFramelessBox(item: PlacedCabinet): boolean {
  return hasAefPrintedGeometry(item)
    && (item.placement === "wall" || item.placement === "base" || item.placement === "tall")
    && !isFillerItem(item)
    && !isPanelItem(item)
    && !item.islandFace;
}

function isMicrowaveAppliance(item: PlacedCabinet): boolean {
  return item.placement === "appliance"
    && (/^MW[-_]/i.test(item.masterCode ?? "") || /over[- ]the[- ]range microwave|\bmicrowave\b/i.test(item.description ?? ""));
}

/** A freestanding range or oven. An over-the-range microwave is a different product. */
function isRangeAppliance(item: PlacedCabinet): boolean {
  if (isMicrowaveAppliance(item)) return false;
  return item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description);
}

function spanOf(item: PlacedCabinet, room: RoomData): { side: WallSide; start: number; end: number } | null {
  const side = cabinetWall(item, room);
  if (!side) return null;
  const start = wallRunOffset(item, side, room);
  return { side, start, end: start + wallRunSpan(item, side, room) };
}

function verticalOf(item: PlacedCabinet): { bottom: number; top: number } {
  const bottom = item.placement === "wall"
    ? (typeof item.mountBottom === "number" ? item.mountBottom : STD.WALL_MOUNT_BOTTOM)
    : (typeof item.mountBottom === "number" ? item.mountBottom : 0);
  return { bottom, top: bottom + placedHeight(item) };
}

/** The band of the host's side that no neighbour covers, in inches. */
function uncoveredBand(host: PlacedCabinet, neighbour: PlacedCabinet): { heightIn: number; depthIn: number } | null {
  const hostV = verticalOf(host);
  const neighbourV = verticalOf(neighbour);
  const hostDepth = rotatedSize(host).d;
  const neighbourDepth = rotatedSize(neighbour).d;
  const vertical = hostV.top - Math.max(hostV.bottom, Math.min(hostV.top, neighbourV.top));
  const horizontal = hostDepth - neighbourDepth;
  if (vertical <= EXPOSURE_MIN_IN && horizontal <= EXPOSURE_MIN_IN) return null;
  return {
    heightIn: Math.max(vertical, 0),
    depthIn: Math.max(horizontal, 0),
  };
}

/**
 * True when the neighbour is on the same wall and stands at this side of the
 * host. An appliance is allowed the 3/4" the panel itself occupies: Auto
 * Design already reserves that slot beside a range so the finished end has
 * somewhere to go.
 */
function neighbourAt(
  host: PlacedCabinet,
  neighbour: PlacedCabinet,
  side: "start" | "end",
  room: RoomData,
  tolerance = SEAM_IN,
): boolean {
  const hostSpan = spanOf(host, room);
  const neighbourSpan = spanOf(neighbour, room);
  if (!hostSpan || !neighbourSpan) return false;
  if (hostSpan.side !== neighbourSpan.side) return false;
  if (side === "start") {
    return neighbourSpan.end >= hostSpan.start - tolerance && neighbourSpan.end <= hostSpan.start + tolerance;
  }
  return neighbourSpan.start >= hostSpan.end - tolerance && neighbourSpan.start <= hostSpan.end + tolerance;
}

function describe(reason: SidePanelReason, hostCode: string, selection: AefEndPanelSelection, side: "start" | "end"): string {
  const where = side === "start" ? "left" : "right";
  switch (reason) {
    case "beside-range":
      return `A 3/4″ side panel (${selection.masterCode}) was added to the ${where} side of ${hostCode} because that side is exposed beside the range.`;
    case "beside-microwave":
      return `A 3/4″ side panel (${selection.masterCode}) was added to the ${where} side of ${hostCode} because that side is exposed beside the microwave.`;
    case "smaller-neighbour":
      return `A 3/4″ side panel (${selection.masterCode}) was added to the ${where} side of ${hostCode} because the adjacent cabinet is smaller and leaves that side exposed.`;
  }
}

/**
 * Every side that is exposed for a reason this rule owns, with the book panel
 * that finishes it. Read-only: nothing moves and nothing is placed here.
 */
export function sidePanelNeeds(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalog: readonly AefEndPanelCatalogItem[];
}): SidePanelNeed[] {
  const { placed, room, catalog } = input;
  const needs: SidePanelNeed[] = [];
  const seen = new Set<string>();
  const record = (host: PlacedCabinet, side: "start" | "end", reason: SidePanelReason, band: { heightIn: number; depthIn: number }) => {
    const key = `${host.uid}:${side}`;
    if (seen.has(key)) return;
    const span = spanOf(host, room);
    if (!span) return;
    seen.add(key);
    const placement = host.placement as "wall" | "base" | "tall";
    const selection = selectAefEndPanel(placement, rotatedSize(host).d, Math.max(band.heightIn, placedHeight(host)), catalog);
    needs.push({
      hostUid: host.uid,
      hostCode: host.masterCode ?? "",
      side,
      reason,
      wallId: span.side,
      startIn: side === "start" ? span.start - SIDE_PANEL_THICKNESS_IN : span.end,
      heightIn: band.heightIn > 0 ? band.heightIn : placedHeight(host),
      depthIn: band.depthIn > 0 ? band.depthIn : rotatedSize(host).d,
      placement,
      selection,
      message: describe(reason, host.masterCode ?? "", selection, side),
    });
  };

  for (const host of placed) {
    if (!isFramelessBox(host)) continue;
    for (const side of ["start", "end"] as const) {
      const span = spanOf(host, room);
      if (!span) continue;
      // The neighbour on this side, whatever layer it belongs to: an appliance
      // in the same plan bay hides nothing unless it is the same height, and a
      // cabinet of another layer never covers this one's side.
      const neighbour = placed.find((other) => {
        if (other.uid === host.uid) return false;
        if (isPanelItem(other)) return false;
        // Cooking equipment may stand 3/4" off the host: that gap is the panel.
        const appliance = isRangeAppliance(other) || isMicrowaveAppliance(other);
        return neighbourAt(host, other, side, room, appliance ? SEAM_IN + SIDE_PANEL_THICKNESS_IN : SEAM_IN);
      }) ?? null;

      if (neighbour && isRangeAppliance(neighbour)) {
        record(host, side, "beside-range", uncoveredBand(host, neighbour) ?? { heightIn: placedHeight(host), depthIn: rotatedSize(host).d });
        continue;
      }
      if (neighbour && isMicrowaveAppliance(neighbour)) {
        record(host, side, "beside-microwave", uncoveredBand(host, neighbour) ?? { heightIn: placedHeight(host), depthIn: rotatedSize(host).d });
        continue;
      }
      if (!neighbour) continue;
      if (neighbour.placement !== host.placement) continue;
      if (isFillerItem(neighbour)) continue;
      const band = uncoveredBand(host, neighbour);
      if (band) record(host, side, "smaller-neighbour", band);
    }
  }
  return needs;
}

/**
 * Slide the host — and every cabinet beyond it on the same wall, away from the
 * exposed side — by the panel thickness, so the board has a real 3/4" of run.
 * All-or-nothing: a shift that would leave the room or collide is refused, and
 * the caller reports the side instead of half-moving a run.
 */
function shiftRunForPanel(input: {
  placed: PlacedCabinet[];
  host: PlacedCabinet;
  side: "start" | "end";
  wallId: WallSide;
  room: RoomData;
}): PlacedCabinet[] | null {
  const { host, side, wallId, room } = input;
  const delta = side === "start" ? SIDE_PANEL_THICKNESS_IN : -SIDE_PANEL_THICKNESS_IN;
  const hostSpan = spanOf(host, room);
  if (!hostSpan) return null;
  const limit = wallLength(wallId, room);
  const movers = input.placed.filter((item) => {
    if (item.placement === "appliance" || item.islandFace) return false;
    if (cabinetWall(item, room) !== wallId) return false;
    const span = spanOf(item, room);
    if (!span) return false;
    return side === "start" ? span.start >= hostSpan.start - SEAM_IN : span.end <= hostSpan.end + SEAM_IN;
  });
  if (!movers.some((item) => item.uid === host.uid)) return null;
  const moved: PlacedCabinet[] = [];
  for (const item of movers) {
    const span = spanOf(item, room)!;
    const start = span.start + delta;
    if (start < -0.01 || start + (span.end - span.start) > limit + 0.01) return null;
    const spot = wallPlacementAt(start, item.width, item.depth, wallId, room, item.peninsulaSide ?? null, false);
    if (Math.abs((spot.wallOffset ?? start) - start) > 0.2) return null;
    moved.push({ ...item, ...spot, wallId: spot.wallId ?? wallId, wallOffset: spot.wallOffset ?? start });
  }
  const rest = input.placed.filter((item) => !moved.some((entry) => entry.uid === item.uid));
  const accepted = appendCollisionFreePlacements(rest, moved, room);
  return accepted.rejected.length === 0 ? accepted.placed : null;
}

/**
 * Places each 3/4" panel as a real catalog row outside the host body. A side
 * with free room takes the board in place. A side butting an appliance or a
 * larger cabinet slides the run over by the 3/4" first, which is the owner's
 * "shift the cabinets over and put a panel on". A side that cannot take the
 * board is reported so the caller can say why.
 */
export function applySidePanels(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  needs: readonly SidePanelNeed[];
  styleId: number | null;
  makeUid: () => string;
}): SidePanelResult {
  let working = [...input.placed];
  const additions: PlacedCabinet[] = [];
  const skipped: SidePanelResult["skipped"] = [];
  for (const need of input.needs) {
    let host = working.find((item) => item.uid === need.hostUid);
    if (!host) continue;
    let startIn = need.startIn;
    const wallLengthIn = wallLength(need.wallId, input.room);
    const occupied = working.some((item) => {
      if (item.uid === host!.uid || isPanelItem(item)) return false;
      if (cabinetWall(item, input.room) !== need.wallId) return false;
      const span = spanOf(item, input.room);
      if (!span) return false;
      return span.start < startIn + SIDE_PANEL_THICKNESS_IN - SEAM_IN && span.end > startIn + SEAM_IN;
    });
    const fitsInPlace = startIn >= -0.01 && startIn + SIDE_PANEL_THICKNESS_IN <= wallLengthIn + 0.01 && !occupied;
    if (!fitsInPlace) {
      const shifted = shiftRunForPanel({ placed: working, host, side: need.side, wallId: need.wallId, room: input.room });
      if (!shifted) {
        skipped.push({ hostCode: need.hostCode, side: need.side, reason: need.reason, why: "the run has no free 3/4″ outside the cabinet and cannot be slid over" });
        continue;
      }
      working = shifted;
      host = working.find((item) => item.uid === need.hostUid) ?? host;
      const hostSpan = spanOf(host, input.room);
      if (!hostSpan) continue;
      startIn = need.side === "start" ? hostSpan.start : hostSpan.end;
    }
    const depth = Math.max(Number(host.depth) || STD.BASE_DEPTH, SIDE_PANEL_THICKNESS_IN);
    const spot = wallPlacementAt(startIn, SIDE_PANEL_THICKNESS_IN, depth, need.wallId, input.room, host.peninsulaSide ?? null, false);
    if (Math.abs((spot.wallOffset ?? startIn) - startIn) > 0.2) {
      skipped.push({ hostCode: need.hostCode, side: need.side, reason: need.reason, why: "the run has no free 3/4″ outside the cabinet" });
      continue;
    }
    const panel: PlacedCabinet = {
      uid: input.makeUid(),
      cabinetId: need.selection.cabinetId ?? 0,
      masterCode: need.selection.masterCode,
      description: `${need.selection.masterCode} 3/4" Frameless End Panel`,
      category: "Panels",
      subCategory: "End panel",
      placement: need.placement,
      ...spot,
      wallId: spot.wallId ?? need.wallId,
      wallOffset: spot.wallOffset ?? startIn,
      width: SIDE_PANEL_THICKNESS_IN,
      nominalWidth: SIDE_PANEL_THICKNESS_IN,
      depth,
      nominalDepth: depth,
      height: Math.max(0, Math.min(need.heightIn, placedHeight(host))),
      nominalHeight: need.selection.stockHeight,
      mountBottom: host.mountBottom ?? null,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      styleId: host.styleId ?? input.styleId,
      autoPlacedForUid: host.uid,
      autoPlacedSide: need.side,
      fieldModificationNote: `Auto-added: side panel because the side is exposed (${need.reason}). Cut from ${need.selection.masterCode}.`,
    };
    // A 3/4" board flush against an appliance is the intended contact — the
    // panel is the finished face the range sits against — so the appliance is
    // not a collision for it. Everything else still is.
    const nonAppliance = working.filter((item) => item.placement !== "appliance");
    const accepted = appendCollisionFreePlacements(nonAppliance, [panel], input.room);
    if (accepted.rejected.length > 0) {
      skipped.push({ hostCode: need.hostCode, side: need.side, reason: need.reason, why: "another piece already occupies that 3/4″" });
      continue;
    }
    const appliances = working.filter((item) => item.placement === "appliance");
    working = [...accepted.placed, ...appliances];
    additions.push(panel);
  }
  return { placed: working, additions, needs: [...input.needs], skipped };
}

/** One call for the design-check rail: what is exposed and what panel finishes it. */
export function syncRangeAndNeighbourSidePanels(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  catalog: readonly AefEndPanelCatalogItem[];
  styleId: number | null;
  makeUid: () => string;
}): SidePanelResult {
  const needs = sidePanelNeeds(input);
  return applySidePanels({ ...input, needs });
}

/**
 * Ranges whose butting cabinet sides are all finished by a side panel.
 *
 * Issue #354 item 3 (Tom): "Do not prompt for a filler when a range is placed;
 * fillers are for gaps." Where this rule adds the 3/4" panel on each side that
 * faces the range, the old corner handle-clearance filler prompt is satisfied
 * by the panel and must not be raised again.
 */
export function rangesFinishedBySidePanels(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  needs: readonly SidePanelNeed[];
}): Set<string> {
  const covered = new Set(input.needs.filter((need) => need.reason === "beside-range").map((need) => need.hostUid));
  const finished = new Set<string>();
  for (const range of input.placed) {
    if (!isRangeAppliance(range)) continue;
    const touching = input.placed.filter((item) => !isRangeAppliance(item)
      && item.placement !== "appliance"
      && !isFillerItem(item)
      && !isPanelItem(item)
      && (neighbourAt(item, range, "start", input.room, SEAM_IN + SIDE_PANEL_THICKNESS_IN)
        || neighbourAt(item, range, "end", input.room, SEAM_IN + SIDE_PANEL_THICKNESS_IN)));
    if (touching.length === 0) continue;
    if (touching.every((item) => covered.has(item.uid))) finished.add(range.uid);
  }
  return finished;
}

/**
 * True while a range or microwave stands in the plan. The designer stops
 * offering a filler beside an appliance on this answer: an exposed side beside
 * cooking equipment gets the 3/4" panel above, and fillers are for gaps only.
 */
export function rangeOrMicrowaveInPlan(placed: readonly PlacedCabinet[]): boolean {
  return placed.some((item) => isRangeAppliance(item) || isMicrowaveAppliance(item));
}
