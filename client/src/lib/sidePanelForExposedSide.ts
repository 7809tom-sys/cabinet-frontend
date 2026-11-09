/**
 * EXPOSED SIDES — the one place that decides which cabinet sides need a panel.
 *
 * A side is EXPOSED when it can be seen:
 *
 *   - next to an appliance (a range hood, an oven, or a range);
 *   - where cabinet heights change (a shorter cabinet beside a taller one);
 *   - at an open end of a run.
 *
 * A side against a wall, or against an adjoining cabinet of the same height and
 * depth, is NOT exposed.
 *
 * What goes on an exposed side:
 *
 *   - FRAMELESS lines (USCD altaeuro and every USCD frameless line) get a 3/4"
 *     panel on every exposed side, automatically, with a notice to the customer.
 *     The book sells no 1/4" skins, so the 3/4" end panel is the finished face:
 *     WEP1523 / WEP1530 / WEP1535 / WEP1542 (walls by height), BEP2535 (bases),
 *     TEP3096 / BP9642 (tall), priced from the door style's catalog SKU.
 *   - FRAMED lines with finished sides get NO automatic panel. The customer adds
 *     one with the per-cabinet Left panel / Right panel options.
 *
 * Fillers are only for gaps and door/handle clearance. Panels finish the face.
 * When a side needs a panel and a filler would also apply, the required panel
 * wins (see `dropFillersOvertakenByExposedPanel`).
 *
 * Required automatic panels:
 *   - the WALL cabinet side that faces a range hood;
 *   - the BASE cabinet side that faces the oven or range.
 *
 * A 1/4" SKIN is a thin finished sheet glued onto an UNFINISHED side — the plain
 * box side meant to sit against a wall or another cabinet. Skins and panels go
 * only on exposed sides, never on hidden ones.
 *
 * A side against a pantry that is not part of the run is OPTIONAL and never
 * automatic: it gets a panel only when the customer chooses one. A pantry inside
 * the run already has its end treatment, so it gets no panel.
 *
 * For symmetry the DEFAULT is the same panel on the wall and the base at the
 * same end of a run, so the look lines up (see `symmetricEndPanel`). It is a
 * default, never a requirement: the customer may change or remove either panel,
 * and nothing forces them back into agreement.
 *
 * A 3/4" panel is REAL WIDTH in the run; `exposedSideRunAccounting.ts` measures
 * it with the cabinets, fillers and appliances so the plan, elevation, 3D view
 * and dimension labels all agree.
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

export type ExposedSideReason =
  | "beside-range"
  | "beside-microwave"
  | "beside-hood"
  | "beside-oven"
  | "smaller-neighbour"
  | "symmetric-end";

export type ExposedSidePanelNeed = {
  /** The cabinet whose side is exposed. */
  hostUid: string;
  hostCode: string;
  /** The side that faces the opening. `start` is the run-start side. */
  side: "start" | "end";
  reason: ExposedSideReason;
  wallId: WallSide;
  /** Along-wall start the 3/4" board occupies, outside the host body. */
  startIn: number;
  /**
   * Finished-floor bottom of the exposed band, so the board is mounted where the
   * side really shows. Equal to the host's own bottom when the whole side shows.
   */
  bottomIn: number;
  /** The exposed side only needs finishing for this much of the box. */
  heightIn: number;
  depthIn: number;
  placement: "wall" | "base" | "tall";
  selection: AefEndPanelSelection;
  /** Customer-facing sentence for the design-check notice. */
  message: string;
};

export type ExposedSidePanelResult = {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  needs: ExposedSidePanelNeed[];
  /** Needs the run had no room for, named rather than silently dropped. */
  skipped: Array<{ hostCode: string; side: "start" | "end"; reason: ExposedSideReason; why: string }>;
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

/**
 * A range hood: the ventilation box that hangs in the UPPER band over the range.
 * A wood hood front (RHF*) is a cabinet face, not the appliance, so it is
 * excluded exactly as the rest of the app excludes it.
 */
function isHoodAppliance(item: PlacedCabinet): boolean {
  const code = (item.masterCode ?? "").toUpperCase();
  const desc = (item.description ?? "").toLowerCase();
  if (/^RHF/.test(code) || /range\s*hood\s*front/.test(desc)) return false;
  return /^HOOD(?:-|\b)/.test(code) || (item.placement === "appliance" && /\bhood\b/.test(desc));
}

/**
 * A built-in OVEN (the appliance, or a tall oven cabinet). The base panel rule
 * needs the oven/range that the base stands beside, whichever form it takes.
 */
function isOvenUnit(item: PlacedCabinet): boolean {
  if (isMicrowaveAppliance(item)) return false;
  const code = (item.masterCode ?? "").toUpperCase();
  const desc = (item.description ?? "").toLowerCase();
  if (/^(?:UOC|TOS|TOD|O3\d)/.test(code)) return true;
  if (item.placement === "appliance" && /\b(?:single|double|wall)\s+oven\b/.test(desc)) return true;
  // A tall oven cabinet is a tall box that already carries its own finished
  // sides; it is handled by the included-pantry rule, not by this trigger.
  return false;
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

/**
 * True when two pieces share vertical space. The 3/4" column a side panel
 * occupies is only taken where the panel's own band is already covered: a
 * shorter neighbour under the exposed band leaves that column free.
 */
function verticalOverlap(a: { bottom: number; top: number }, b: { bottom: number; top: number }): boolean {
  return Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) > EXPOSURE_MIN_IN;
}

/**
 * The band of the host's side that no neighbour covers, in inches.
 *
 * `bottomIn` is where that band starts, measured from the floor — not the
 * host's own bottom. A 40-1/4" wall cabinet beside a 30-1/4" one has its visible
 * side in the 84-1/4"–94-1/4" band, so the panel has to be mounted there; a
 * panel pinned to 54" would hang over the part the neighbour already covers and
 * leave the exposed inch face bare.
 */
function uncoveredBand(
  host: PlacedCabinet,
  neighbour: PlacedCabinet,
): { bottomIn: number; heightIn: number; depthIn: number } | null {
  const hostV = verticalOf(host);
  const neighbourV = verticalOf(neighbour);
  const hostDepth = rotatedSize(host).d;
  const neighbourDepth = rotatedSize(neighbour).d;
  // The neighbour covers from the floor up to its own top. Whatever the host
  // shows above that line (and above its own bottom) is the exposed band.
  const coveredTop = Math.max(hostV.bottom, Math.min(hostV.top, neighbourV.top));
  const vertical = hostV.top - coveredTop;
  const horizontal = hostDepth - neighbourDepth;
  if (vertical <= EXPOSURE_MIN_IN && horizontal <= EXPOSURE_MIN_IN) return null;
  const heightIn = Math.max(vertical, 0);
  return {
    bottomIn: hostV.top - heightIn,
    heightIn,
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

function describe(reason: ExposedSideReason, hostCode: string, selection: AefEndPanelSelection, side: "start" | "end"): string {
  const where = side === "start" ? "left" : "right";
  switch (reason) {
    case "beside-range":
      return `A 3/4″ side panel (${selection.masterCode}) was added to the ${where} side of ${hostCode} because that side is exposed beside the range.`;
    case "beside-microwave":
      return `A 3/4″ side panel (${selection.masterCode}) was added to the ${where} side of ${hostCode} because that side is exposed beside the microwave.`;
    case "beside-hood":
      return `A 3/4″ side panel (${selection.masterCode}) was added to the ${where} side of ${hostCode} because that side faces the range hood.`;
    case "beside-oven":
      return `A 3/4″ side panel (${selection.masterCode}) was added to the ${where} side of ${hostCode} because that side faces the oven/range.`;
    case "smaller-neighbour":
      return `A 3/4″ side panel (${selection.masterCode}) was added to the ${where} side of ${hostCode} because the adjacent cabinet is smaller and leaves that side exposed.`;
    case "symmetric-end":
      return `A 3/4″ side panel (${selection.masterCode}) was matched to the ${where} side of ${hostCode} so the wall and base ends line up. You can change or remove it.`;
  }
}

/**
 * A tall unit that already carries its own finished end: a pantry, a tall oven
 * tower, or a refrigerator bay box. A run that butts one of these needs no
 * separate board on that side — the tall box finishes it.
 */
function isTallUnitCabinet(item: PlacedCabinet): boolean {
  if (item.placement !== "tall") return false;
  if (isFillerItem(item) || isPanelItem(item)) return false;
  return true;
}

/**
 * True when a box on this side finishes the host's side completely, so no board
 * may go there. That is: another cabinet of the same layer at full height and
 * depth, a filler, an existing panel, or a tall unit that covers the side.
 *
 * Tom's rules (Nov 9 2026): a panel goes ONLY on an exposed side — never on a
 * side that abuts another cabinet or a finished tall unit. A tall unit that is
 * part of the run already has its own end treatment.
 */
function sideIsCovered(
  host: PlacedCabinet,
  side: "start" | "end",
  placed: readonly PlacedCabinet[],
  room: RoomData,
): boolean {
  return placed.some((other) => {
    if (other.uid === host.uid) return false;
    if (!neighbourAt(host, other, side, room)) return false;
    // A panel or filler only "covers" the side when it actually stands in this
    // side's 3/4" slot. A panel on the opposite side must not block this one.
    const hostSpan = spanOf(host, room);
    const otherSpan = spanOf(other, room);
    if (!hostSpan || !otherSpan) return false;
    const inThisSlot = side === "start"
      ? otherSpan.end >= hostSpan.start - SEAM_IN && otherSpan.end <= hostSpan.start + SIDE_PANEL_THICKNESS_IN + SEAM_IN
      : otherSpan.start >= hostSpan.end - SEAM_IN && otherSpan.start <= hostSpan.end + SIDE_PANEL_THICKNESS_IN + SEAM_IN;
    if (isPanelItem(other) || isFillerItem(other)) {
      // A panel finishes only its OWN layer's side. A base-layer end panel must
      // not mark the wall cabinet above it as covered.
      if (other.placement !== host.placement) return false;
      return inThisSlot;
    }
    // A tall unit always finishes the side it stands against.
    if (isTallUnitCabinet(other)) return true;
    // Appliances never finish a cabinet's side: a range, oven, microwave or hood
    // is exactly the case where a panel IS required.
    if (other.placement === "appliance") return false;
    if (other.placement !== host.placement) return false;
    // A same-layer box at least as tall and as deep covers the side entirely.
    return uncoveredBand(host, other) == null;
  });
}

/**
 * The whole host side, bottom to top — the fallback when a neighbour hides
 * nothing measurable but the side is still exposed (a range narrower than the
 * host, say).
 */
function wholeSideBand(host: PlacedCabinet): { bottomIn: number; heightIn: number; depthIn: number } {
  const v = verticalOf(host);
  return { bottomIn: v.bottom, heightIn: placedHeight(host), depthIn: rotatedSize(host).d };
}

/**
 * Every side that is exposed for a reason this rule owns, with the book panel
 * that finishes it. Read-only: nothing moves and nothing is placed here.
 */
export function exposedSidePanelNeeds(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalog: readonly AefEndPanelCatalogItem[];
}): ExposedSidePanelNeed[] {
  const { placed, room, catalog } = input;
  const needs: ExposedSidePanelNeed[] = [];
  const seen = new Set<string>();
  const record = (host: PlacedCabinet, side: "start" | "end", reason: ExposedSideReason, band: { bottomIn: number; heightIn: number; depthIn: number }) => {
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
      bottomIn: band.bottomIn,
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
      // A side that another cabinet, filler, panel or tall unit already finishes
      // is not exposed: no board goes there (Tom's rule b).
      if (sideIsCovered(host, side, placed, room)) continue;
      // The neighbour on this side, whatever layer it belongs to: an appliance
      // in the same plan bay hides nothing unless it is the same height, and a
      // cabinet of another layer never covers this one's side.
      const neighbour = placed.find((other) => {
        if (other.uid === host.uid) return false;
        if (isPanelItem(other)) return false;
        // Cooking equipment and hoods may stand 3/4" off the host: that gap is
        // the panel.
        const appliance = isRangeAppliance(other) || isMicrowaveAppliance(other) || isHoodAppliance(other);
        return neighbourAt(host, other, side, room, appliance ? SEAM_IN + SIDE_PANEL_THICKNESS_IN : SEAM_IN);
      }) ?? null;

      // Rule 1 (Tom, Nov 9 2026): the wall cabinet side that faces a RANGE HOOD
      // is required to carry a wall end panel sized to that cabinet's height.
      if (host.placement === "wall" && neighbour && isHoodAppliance(neighbour)) {
        record(host, side, "beside-hood", uncoveredBand(host, neighbour) ?? wholeSideBand(host));
        continue;
      }
      // Rule 2 (Tom, Nov 9 2026): the base cabinet side that faces the oven/range
      // is required to carry a base end panel.
      if (host.placement === "base" && neighbour && (isRangeAppliance(neighbour) || isOvenUnit(neighbour))) {
        record(host, side, "beside-oven", uncoveredBand(host, neighbour) ?? wholeSideBand(host));
        continue;
      }
      if (neighbour && isRangeAppliance(neighbour)) {
        record(host, side, "beside-range", uncoveredBand(host, neighbour) ?? wholeSideBand(host));
        continue;
      }
      if (neighbour && isMicrowaveAppliance(neighbour)) {
        record(host, side, "beside-microwave", uncoveredBand(host, neighbour) ?? wholeSideBand(host));
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
 *
 * Idempotent: a side that already carries an auto-placed panel is left alone,
 * and a pass that changes nothing returns `input.placed` by reference. The
 * Designer runs this in an effect and calls `setPlaced` on a new array, so a
 * fresh array on a settled plan would re-render (and re-run) forever.
 */
export function applyExposedSidePanels(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  needs: readonly ExposedSidePanelNeed[];
  styleId: number | null;
  makeUid: () => string;
}): ExposedSidePanelResult {
  let working = input.placed;
  let changed = false;
  const additions: PlacedCabinet[] = [];
  const skipped: ExposedSidePanelResult["skipped"] = [];
  // One board per host side. The board this rule seats records the pair, so a
  // second pass (or a pass after the run slid) never stacks a duplicate.
  const alreadyPanelled = new Set(input.placed
    .filter((item) => item.autoPlacedForUid && item.autoPlacedSide)
    .map((item) => `${item.autoPlacedForUid}:${item.autoPlacedSide}`));
  for (const need of input.needs) {
    if (alreadyPanelled.has(`${need.hostUid}:${need.side}`)) continue;
    let host = working.find((item) => item.uid === need.hostUid);
    if (!host) continue;
    let startIn = need.startIn;
    const wallLengthIn = wallLength(need.wallId, input.room);
    // The 3/4" column is free unless something standing in it shares the band
    // the panel will occupy. A shorter cabinet under that band is not in the way.
    const panelBand = { bottom: need.bottomIn, top: need.bottomIn + Math.min(need.heightIn, placedHeight(host)) };
    const occupied = working.some((item) => {
      if (item.uid === host!.uid || isPanelItem(item)) return false;
      if (cabinetWall(item, input.room) !== need.wallId) return false;
      const span = spanOf(item, input.room);
      if (!span) return false;
      const inColumn = span.start < startIn + SIDE_PANEL_THICKNESS_IN - SEAM_IN && span.end > startIn + SEAM_IN;
      return inColumn && verticalOverlap(verticalOf(item), panelBand);
    });
    const fitsInPlace = startIn >= -0.01 && startIn + SIDE_PANEL_THICKNESS_IN <= wallLengthIn + 0.01 && !occupied;
    if (!fitsInPlace) {
      const shifted = shiftRunForPanel({ placed: working, host, side: need.side, wallId: need.wallId, room: input.room });
      if (!shifted) {
        skipped.push({ hostCode: need.hostCode, side: need.side, reason: need.reason, why: "the run has no free 3/4″ outside the cabinet and cannot be slid over" });
        continue;
      }
      working = shifted;
      changed = true;
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
    // Mount the board on the band that is really showing, never on the host's
    // own bottom: a 40-1/4" wall beside a 30-1/4" one shows 84-1/4"–94-1/4".
    const height = Math.max(0, Math.min(need.heightIn, placedHeight(host)));
    const hostTop = verticalOf(host).top;
    const mountBottom = Math.max(0, Math.min(need.bottomIn, hostTop - height));
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
      height,
      nominalHeight: need.selection.stockHeight,
      mountBottom,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      styleId: host.styleId ?? input.styleId,
      autoPlacedForUid: host.uid,
      autoPlacedSide: need.side,
      fieldModificationNote: `Auto-added: side panel because the side is exposed (${need.reason}). Cut from ${need.selection.masterCode}. Mounted ${mountBottom}″–${mountBottom + height}″.`,
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
    changed = true;
    alreadyPanelled.add(`${need.hostUid}:${need.side}`);
    additions.push(panel);
  }
  // A settled plan is returned by reference, the same contract
  // `syncExposedSidePanelsForRun` and `syncDishwasherPanels` use.
  return {
    placed: changed ? working : (input.placed as PlacedCabinet[]),
    additions,
    needs: [...input.needs],
    skipped,
  };
}

/** One call for the design-check rail: what is exposed and what panel finishes it. */
export function syncExposedSidePanelsForRun(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  catalog: readonly AefEndPanelCatalogItem[];
  styleId: number | null;
  makeUid: () => string;
}): ExposedSidePanelResult {
  const needs = exposedSidePanelNeeds(input);
  return applyExposedSidePanels({ ...input, needs });
}

/**
 * Ranges whose butting cabinet sides are all finished by a side panel.
 *
 * Issue #354 item 3 (Tom): "Do not prompt for a filler when a range is placed;
 * fillers are for gaps." Where this rule adds the 3/4" panel on each side that
 * faces the range, the old corner handle-clearance filler prompt is satisfied
 * by the panel and must not be raised again.
 */
export function cookingSidesFinishedByExposedPanels(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  needs: readonly ExposedSidePanelNeed[];
}): Set<string> {
  // A base side facing the range reports as `beside-oven`; both count as the
  // panel that satisfies the range's handle clearance.
  const covered = new Set(input.needs
    .filter((need) => need.reason === "beside-range" || need.reason === "beside-oven")
    .map((need) => need.hostUid));
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

/**
 * A side panel the customer asked for by hand: the per-cabinet Left panel /
 * Right panel toggle.
 *
 * Tom (Nov 9 2026): these are PANEL options, not fillers. A toggle puts the
 * line's real end panel (frameless: the 3/4" WEP/BEP/TEP board; framed: the
 * line's own end panel / skin row) on that side, priced as a real catalog row.
 *
 * A panel goes ONLY on an exposed side: a side that abuts another cabinet, a
 * filler, or a tall unit that finishes it is refused with the reason, so a
 * toggle can never stack a board where nothing shows.
 */
export type ExposedSideHand = "start" | "end";

export type ManualPanelResult =
  | { ok: true; panel: PlacedCabinet; placed: PlacedCabinet[] }
  | { ok: false; reason: string };

/** The board a per-cabinet toggle would put on this side, or the reason it cannot. */
export function exposedSidePanelSelection(
  host: PlacedCabinet,
  side: ExposedSideHand,
  catalog: readonly AefEndPanelCatalogItem[],
): AefEndPanelSelection | null {
  if (host.placement !== "wall" && host.placement !== "base" && host.placement !== "tall") return null;
  return selectAefEndPanel(host.placement, rotatedSize(host).d, placedHeight(host), catalog);
}

/**
 * Place or remove the per-cabinet panel on one side.
 *
 * `enabled` true seats the line's end panel as a real catalog row outside the
 * host body (marking it as a customer choice, so the automatic pass never
 * removes it); false removes the board this toggle owns. The run slides by the
 * 3/4" when the slot is not free, exactly like the automatic pass.
 */
export function setExposedSidePanel(input: {
  placed: PlacedCabinet[];
  hostUid: string;
  side: ExposedSideHand;
  enabled: boolean;
  room: RoomData;
  catalog: readonly AefEndPanelCatalogItem[];
  styleId: number | null;
  makeUid: () => string;
}): ManualPanelResult {
  const { hostUid, side, enabled, room, catalog } = input;
  const host = input.placed.find((item) => item.uid === hostUid);
  if (!host) return { ok: false, reason: "Select a cabinet first." };
  const ownedUid = `${hostUid}:manual-panel:${side}`;

  if (!enabled) {
    const without = input.placed.filter((item) => item.uid !== ownedUid);
    return without.length === input.placed.length
      ? { ok: false, reason: "There is no panel on that side to remove." }
      : { ok: true, panel: input.placed.find((item) => item.uid === ownedUid)!, placed: without };
  }

  // A panel goes only on a side that is really exposed.
  const currentHost = input.placed.find((item) => item.uid === hostUid) ?? host;
  if (sideIsCovered(currentHost, side, input.placed, room)) {
    const span = spanOf(currentHost, room);
    const wallLen = span ? wallLength(span.side, room) : 0;
    const againstWall = span != null
      && (side === "start" ? span.start <= SEAM_IN : wallLen - span.end <= SEAM_IN);
    return {
      ok: false,
      reason: againstWall
        ? `${currentHost.masterCode}'s ${side === "start" ? "left" : "right"} side is against the wall, so it needs no panel.`
        : `${currentHost.masterCode}'s ${side === "start" ? "left" : "right"} side is already finished by the cabinet or tall unit beside it, so it needs no panel.`,
    };
  }

  const selection = exposedSidePanelSelection(host, side, catalog);
  if (!selection) return { ok: false, reason: `${host.masterCode} cannot take a side panel.` };

  const span = spanOf(currentHost, room);
  if (!span) return { ok: false, reason: `${currentHost.masterCode} is not on a wall, so it has no side to finish.` };
  let working = input.placed.filter((item) => item.uid !== ownedUid);
  let startIn = side === "start" ? span.start - SIDE_PANEL_THICKNESS_IN : span.end;

  // The board goes in the 3/4" immediately outside the host, and only that slot
  // is tested: an existing panel on the OTHER side must never force a shift.
  const slotIsFree = (items: readonly PlacedCabinet[], at: number, hostUid: string) => items.every((item) => {
    // `true` = "this item does not block the slot".
    if (item.uid === hostUid) return true;
    if (isPanelItem(item)) return true;
    if (cabinetWall(item, room) !== span.side) return true;
    const other = spanOf(item, room);
    if (!other) return true;
    return !(other.start < at + SIDE_PANEL_THICKNESS_IN - SEAM_IN && other.end > at + SEAM_IN);
  });
  if (!slotIsFree(working, startIn, host.uid)) {
    const shifted = shiftRunForPanel({ placed: working, host, side, wallId: span.side, room });
    if (!shifted) {
      return {
        ok: false,
        reason: `There is no free 3/4″ on the ${side === "start" ? "left" : "right"} of ${host.masterCode} for a panel, and the run cannot be slid over.`,
      };
    }
    working = shifted;
    const movedHost = working.find((item) => item.uid === host.uid) ?? host;
    const movedSpan = spanOf(movedHost, room);
    if (!movedSpan) return { ok: false, reason: `${host.masterCode} is not on a wall, so it has no side to finish.` };
    startIn = side === "start" ? movedSpan.start : movedSpan.end;
  }

  const depth = Math.max(Number(host.depth) || STD.BASE_DEPTH, SIDE_PANEL_THICKNESS_IN);
  const spot = wallPlacementAt(startIn, SIDE_PANEL_THICKNESS_IN, depth, span.side, room, host.peninsulaSide ?? null, false);
  if (Math.abs((spot.wallOffset ?? startIn) - startIn) > 0.2) {
    return { ok: false, reason: `The run has no free 3/4″ on the ${side === "start" ? "left" : "right"} of ${host.masterCode}.` };
  }
  const panel: PlacedCabinet = {
    uid: ownedUid,
    cabinetId: selection.cabinetId ?? 0,
    masterCode: selection.masterCode,
    description: `${selection.masterCode} 3/4" Frameless End Panel`,
    category: "Panels",
    subCategory: "End panel",
    placement: host.placement as "wall" | "base" | "tall",
    ...spot,
    wallId: spot.wallId ?? span.side,
    wallOffset: spot.wallOffset ?? startIn,
    width: SIDE_PANEL_THICKNESS_IN,
    nominalWidth: SIDE_PANEL_THICKNESS_IN,
    depth,
    nominalDepth: depth,
    height: Math.max(0, Math.min(placedHeight(host), placedHeight(host))),
    nominalHeight: selection.stockHeight,
    mountBottom: typeof host.mountBottom === "number" ? host.mountBottom : null,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    styleId: host.styleId ?? input.styleId,
    // A customer choice, not an auto panel: the automatic pass never removes it.
    fieldModificationNote: `Customer panel: ${side === "start" ? "left" : "right"} side of ${host.masterCode}. Cut from ${selection.masterCode}.`,
  };
  const accepted = appendCollisionFreePlacements(
    working.filter((item) => item.placement !== "appliance" && item.uid !== host.uid),
    [panel],
    room,
  );
  if (accepted.rejected.length > 0) {
    return { ok: false, reason: `Another piece already occupies the 3/4″ on the ${side === "start" ? "left" : "right"} of ${host.masterCode}.` };
  }
  return {
    ok: true,
    panel,
    placed: [
      ...accepted.placed,
      ...working.filter((item) => item.uid === host.uid),
      ...working.filter((item) => item.placement === "appliance"),
    ],
  };
}

/** True when the per-cabinet toggle already owns a panel on this side. */
export function exposedSidePanelFor(
  hostUid: string,
  side: ExposedSideHand,
  placed: readonly PlacedCabinet[],
): PlacedCabinet | null {
  return placed.find((item) => item.uid === `${hostUid}:manual-panel:${side}`) ?? null;
}

/**
 * Remove the filler boards that a REQUIRED panel has made redundant on the same
 * side. Tom's rule (Nov 9 2026): when a panel is required, the panel wins; a
 * filler only fills whatever gap is left over, never the panel's own slot.
 */
export function dropFillersOvertakenByExposedPanel(input: {
  placed: readonly PlacedCabinet[];
  needs: readonly ExposedSidePanelNeed[];
  room: RoomData;
}): { placed: PlacedCabinet[]; removed: PlacedCabinet[] } {
  const required = new Set(input.needs.map((need) => need.hostUid));
  const removed = input.placed.filter((item) => {
    if (!isFillerItem(item)) return false;
    // A filler attached to a host that now requires a panel moves aside.
    if (item.fillerForCabinetUid && required.has(item.fillerForCabinetUid)) return true;
    // Any filler standing in a required panel's own 3/4" column also moves
    // aside: the panel is required there, and the filler only fills what is left.
    const fillerSpan = spanOf(item, input.room);
    if (!fillerSpan) return false;
    return input.needs.some((need) => {
      if (cabinetWall(item, input.room) !== need.wallId) return false;
      return fillerSpan.end > need.startIn + SEAM_IN
        && fillerSpan.start < need.startIn + SIDE_PANEL_THICKNESS_IN - SEAM_IN;
    });
  });
  if (removed.length === 0) return { placed: input.placed as PlacedCabinet[], removed: [] };
  const gone = new Set(removed.map((item) => item.uid));
  return { placed: input.placed.filter((item) => !gone.has(item.uid)), removed };
}

/**
 * The matching panel on the other layer at the same end of a run.
 *
 * Tom (Nov 9 2026): for symmetry, the DEFAULT is the same panel on the wall and
 * the base at the same end of a run, so the look lines up. When a base end gets
 * a panel, the wall cabinet above it at that end defaults to the matching panel
 * (same material / finish / style, from the same catalog stock family), and vice
 * versa — but only when that side is itself exposed. It is a default, never a
 * requirement: the customer may change or remove either panel on its own, and
 * nothing here forces them back into agreement.
 */
export function symmetricEndPanel(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalog: readonly AefEndPanelCatalogItem[];
  /** The panel that was just placed (or chosen) on one layer. */
  panelUid: string;
}): ExposedSidePanelNeed | null {
  const { placed, room, catalog } = input;
  const panel = placed.find((item) => item.uid === input.panelUid);
  if (!panel || !isPanelItem(panel)) return null;
  const hostUid = panel.autoPlacedForUid;
  if (!hostUid) return null;
  const host = placed.find((item) => item.uid === hostUid);
  if (!host) return null;
  const side = panel.autoPlacedSide === "start" || panel.autoPlacedSide === "end"
    ? panel.autoPlacedSide
    : null;
  if (!side) return null;
  // Only a wall and a base mirror each other; tall/filler boards have no pair.
  if (host.placement !== "wall" && host.placement !== "base") return null;
  const otherLayer: "wall" | "base" = host.placement === "wall" ? "base" : "wall";
  const hostSpan = spanOf(host, room);
  if (!hostSpan) return null;
  const wallSide = hostSpan.side;

  // The cabinet on the other layer that shares this run end. Run ends are
  // compared by the shared wall side, not by both cabinets being the same width:
  // a 24" base under a 30" upper at the same end of a run still pairs.
  const neighbour = placed.find((item) => {
    if (item.uid === host.uid) return false;
    if (item.placement !== otherLayer) return false;
    if (isFillerItem(item) || isPanelItem(item)) return false;
    if (cabinetWall(item, room) !== wallSide) return false;
    const other = spanOf(item, room);
    if (!other) return false;
    // Both start at (or near) the same point, or both end at the same point.
    const sameStart = Math.abs(other.start - hostSpan.start) <= SEAM_IN;
    const sameEnd = Math.abs(other.end - hostSpan.end) <= SEAM_IN;
    return sameStart || sameEnd;
  }) ?? null;
  if (!neighbour) return null;

  // The matching side: the exposed side at the SAME end of the run. When the two
  // boxes are different widths, map by the end they share, not by the literal
  // start/end flag.
  const neighbourSpan = spanOf(neighbour, room);
  if (!neighbourSpan) return null;
  const sameStart = Math.abs(neighbourSpan.start - hostSpan.start) <= SEAM_IN;
  const neighbourSide: "start" | "end" = sameStart ? "start" : "end";
  // Never add a panel to a hidden side just for symmetry.
  if (sideIsCovered(neighbour, neighbourSide, placed, room)) return null;
  if (placed.some((item) => item.autoPlacedForUid === neighbour.uid && item.autoPlacedSide === neighbourSide)) return null;

  const band = wholeSideBand(neighbour);
  const selection = selectAefEndPanel(
    neighbour.placement as "wall" | "base" | "tall",
    rotatedSize(neighbour).d,
    placedHeight(neighbour),
    catalog,
  );
  return {
    hostUid: neighbour.uid,
    hostCode: neighbour.masterCode ?? "",
    side: neighbourSide,
    reason: "symmetric-end",
    wallId: neighbourSpan.side,
    startIn: neighbourSide === "start" ? neighbourSpan.start - SIDE_PANEL_THICKNESS_IN : neighbourSpan.end,
    bottomIn: band.bottomIn,
    heightIn: band.heightIn,
    depthIn: band.depthIn,
    placement: neighbour.placement as "wall" | "base" | "tall",
    selection,
    message: `A 3/4″ side panel (${selection.masterCode}) was matched to the ${neighbourSide === "start" ? "left" : "right"} side of ${neighbour.masterCode} so the wall and base ends line up. You can change or remove it.`,
  };
}
