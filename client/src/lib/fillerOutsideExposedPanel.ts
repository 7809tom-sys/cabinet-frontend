/**
 * Owner rule (Tom, voice, Nov 18 2026, 4:53 PM CT): "No filler outside exposed panels."
 *
 * An exposed (finished end) panel is a finished skin. A filler never goes on its
 * outside face. Fillers go between cabinets, or between a cabinet and a wall,
 * never past a panel: the sequence cabinet, panel, filler, wall (or open floor)
 * is wrong. A gap there is taken up inside the run, between cabinets, or it is
 * left open and named on the review list. A filler is never hung on the panel.
 *
 * What counts as "outside":
 * - Any filler that touches a panel (end panel, refrigerator panel, dishwasher
 *   panel, decorative skin) on one side and does not have a cabinet or appliance on
 *   its other side. Its far side is a wall, an opening, another panel, or nothing.
 * - A filler that does have a cabinet or appliance on its far side closes a
 *   cabinet-to-panel seam. The panel's face is then covered by that cabinet, so the
 *   panel is not exposed there, and the filler stays (the sub 1.5 inch seam rule).
 * - Refrigerator panel (Tom, Nov 18 2026, 5:04 PM CT): the only optional filler is
 *   on the INSIDE of the panel, between the panel and the refrigerator, as a last
 *   resort for a small leftover gap (Nov 16 rule). A filler on the OUTSIDE of a
 *   refrigerator panel, the side away from the refrigerator, is never placed, even
 *   when a cabinet stands beyond it.
 *
 * Required corner fillers (blind-corner 3 inch filler, 45 degree miter pair,
 * angled wedge, provisional corner board, the wall blind filler) are tagged by the
 * engine that seats them. They are not run-end fillers and are never touched. A
 * plain filler that only happens to sit near a room corner is NOT protected: a
 * board between a perpendicular wall and a panel is still outside that panel.
 *
 * This module is pure. It reads finished placements and answers which fillers are
 * on the wrong side of a panel, so the engine can stop placing them.
 */
import {
  cabinetWall,
  isFillerItem,
  isCornerCabinet,
  isPanelItem,
  isRefrigerator,
  isSinkBaseCabinet,
  isRefrigeratorEndPanel,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import { isRequiredBlindCornerFillerGroupId } from "./blindCornerRequiredFiller";
import type { DesignerReviewFinding } from "./designerReviewFindings";

/** A filler and a panel touch when their run-edges are this close (inches). */
export const FILLER_PANEL_TOUCH_IN = 0.25;

export type FillerOutsidePanel = {
  filler: PlacedCabinet;
  panel: PlacedCabinet;
  wallId: string;
  /** Which side of the panel the filler is on, along the run. */
  side: "start" | "end";
  /** What stands on the filler's far side. */
  farSide: "cabinet" | "wall" | "opening" | "panel" | "nothing";
};

function isExposedPanelCandidate(item: PlacedCabinet): boolean {
  if (isFillerItem(item)) return false;
  return isRefrigeratorEndPanel(item) || isPanelItem(item);
}

function interval(item: PlacedCabinet, wallId: string, room: RoomData) {
  const start = wallRunOffset(item, wallId, room);
  return { start, end: start + wallRunSpan(item, wallId, room) };
}

/** A tall panel bounds both layers; a base or wall panel bounds its own layer. */
function sharesLayer(panel: PlacedCabinet, filler: PlacedCabinet): boolean {
  if (panel.placement === "tall") return true;
  if (panel.placement === filler.placement) return true;
  if (filler.placement === "base" && panel.placement === "appliance") return true;
  return false;
}

function isProtectedCornerFiller(filler: PlacedCabinet): boolean {
  if (filler.integratedWallBlindFiller === true) return true;
  if (isRequiredBlindCornerFillerGroupId(filler.fillerPieceGroupId)) return true;
  return filler.fillerTransitionKind === "front-miter-pair"
    || filler.fillerTransitionKind === "angled-wedge"
    || filler.fillerTransitionKind === "corner-provisional";
}

/**
 * Every filler sitting on the outside face of a panel, with what is beyond it.
 * `openings` is only used to tell a window or door edge from open floor.
 */
export function fillersOutsideExposedPanels(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly { side: string; offset: number; width: number }[];
}): FillerOutsidePanel[] {
  const { placed, room } = input;
  const found: FillerOutsidePanel[] = [];
  const panels = placed.filter(isExposedPanelCandidate);
  if (!panels.length) return found;
  for (const filler of placed) {
    if (!isFillerItem(filler) || !filler.wallId || filler.islandFace) continue;
    if (isProtectedCornerFiller(filler)) continue;
    const wallId = cabinetWall(filler, room);
    const mine = interval(filler, wallId, room);
    for (const panel of panels) {
      if (panel.uid === filler.uid || cabinetWall(panel, room) !== wallId || !sharesLayer(panel, filler)) continue;
      const theirs = interval(panel, wallId, room);
      const touchesStartOfFiller = Math.abs(theirs.end - mine.start) <= FILLER_PANEL_TOUCH_IN; // panel is before the filler
      const touchesEndOfFiller = Math.abs(theirs.start - mine.end) <= FILLER_PANEL_TOUCH_IN; // panel is after the filler
      if (!touchesStartOfFiller && !touchesEndOfFiller) continue;
      const farEdge = touchesStartOfFiller ? mine.end : mine.start;
      const outsideFridgePanel = isRefrigeratorEndPanel(panel)
        && fridgeIsOnOtherSide({ panel, filler, wallId, placed, room, fillerAfterPanel: touchesStartOfFiller });
      const far = farSideOf({ filler, panel, farEdge, direction: touchesStartOfFiller ? "end" : "start", wallId, placed, room, openings: input.openings ?? [] });
      if (far === "cabinet" && !outsideFridgePanel) continue;
      found.push({ filler, panel, wallId, side: touchesStartOfFiller ? "end" : "start", farSide: far });
      break;
    }
  }
  return found;
}

/**
 * True when the refrigerator stands on the far side of the panel from this filler,
 * which puts the filler on the panel's outside face. The refrigerator is the one in
 * the panel's own assembly, else the nearest one on the wall.
 */
function fridgeIsOnOtherSide(input: {
  panel: PlacedCabinet;
  filler: PlacedCabinet;
  wallId: string;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  fillerAfterPanel: boolean;
}): boolean {
  const { panel, wallId, room } = input;
  const mine = interval(panel, wallId, room);
  const center = (mine.start + mine.end) / 2;
  const fridges = input.placed.filter((item) => item.uid !== panel.uid && !isFillerItem(item) && !isPanelItem(item)
    && isRefrigerator(item) && cabinetWall(item, room) === wallId);
  const owned = panel.refrigeratorAssemblyId ? fridges.filter((item) => item.uid === panel.refrigeratorAssemblyId || item.refrigeratorAssemblyId === panel.refrigeratorAssemblyId) : [];
  const pool = owned.length ? owned : fridges;
  if (!pool.length) return false;
  const nearest = pool
    .map((item) => { const span = interval(item, wallId, room); return { span, distance: Math.abs((span.start + span.end) / 2 - center) }; })
    .sort((a, b) => a.distance - b.distance)[0]!;
  const fridgeAfterPanel = (nearest.span.start + nearest.span.end) / 2 > center;
  return fridgeAfterPanel !== input.fillerAfterPanel;
}

function farSideOf(input: {
  filler: PlacedCabinet;
  panel: PlacedCabinet;
  farEdge: number;
  direction: "start" | "end";
  wallId: string;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly { side: string; offset: number; width: number }[];
}): "cabinet" | "wall" | "opening" | "panel" | "nothing" {
  const { farEdge, direction, wallId, room } = input;
  for (const item of input.placed) {
    if (item.uid === input.filler.uid || item.uid === input.panel.uid || isFillerItem(item)) continue;
    if (cabinetWall(item, room) !== wallId || !sharesLayer(item, input.filler)) continue;
    const span = interval(item, wallId, room);
    const edge = direction === "end" ? span.start : span.end;
    if (Math.abs(edge - farEdge) > FILLER_PANEL_TOUCH_IN) continue;
    return isExposedPanelCandidate(item) ? "panel" : "cabinet";
  }
  for (const opening of input.openings) {
    if (opening.side !== wallId) continue;
    const edge = direction === "end" ? opening.offset : opening.offset + opening.width;
    if (Math.abs(edge - farEdge) <= FILLER_PANEL_TOUCH_IN) return "opening";
  }
  const frame = wallRunFrame(wallId, room);
  if (frame) {
    const wallEdge = direction === "end" ? frame.runEnd : Math.max(0, frame.runStart);
    if (Math.abs(wallEdge - farEdge) <= FILLER_PANEL_TOUCH_IN) return "wall";
  }
  return "nothing";
}

/** True when this filler is on a panel's outside face. */
export function isFillerOutsideExposedPanel(filler: PlacedCabinet, input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly { side: string; offset: number; width: number }[];
}): boolean {
  return fillersOutsideExposedPanels(input).some((entry) => entry.filler.uid === filler.uid);
}

export type RemoveFillersOutsidePanelsResult = {
  placed: PlacedCabinet[];
  removed: FillerOutsidePanel[];
  /** Fillers that were moved from the outside of a panel to the far side of the next cabinet. */
  relocated: FillerOutsidePanel[];
  notes: string[];
  findings: DesignerReviewFinding[];
};

const inches = (value: number) => `${Math.round(value * 100) / 100}″`;

type Openings = readonly { side: string; offset: number; width: number }[];

/** A plain run cabinet that may slide a few inches: not an anchor, corner, sink, appliance or owner of other boards. */
function isSlidableNeighbour(item: PlacedCabinet, placed: readonly PlacedCabinet[]): boolean {
  if (item.placement !== "base" && item.placement !== "wall") return false;
  if (isFillerItem(item) || isPanelItem(item) || isSinkBaseCabinet(item) || isRefrigerator(item)) return false;
  if (isCornerCabinet(item.masterCode ?? "", item.description ?? undefined, item.cornerType ?? undefined) || item.cornerType) return false;
  if (item.refrigeratorAssemblyRole || item.refrigeratorAssemblyId || item.overRangeMicrowaveBridge) return false;
  return !placed.some((other) => other.uid !== item.uid && (other.stackedOnCabinetUid === item.uid || other.fillerForCabinetUid === item.uid));
}

/**
 * Take the board's width up between cabinets instead of outside the panel: the
 * cabinet beyond the filler slides against the panel, and the same board closes
 * the space that opens on that cabinet's far side. That board then sits between
 * two cabinets (or a cabinet and a wall), which is where a filler belongs.
 */
function relocateBehindNeighbour(entry: FillerOutsidePanel, placed: readonly PlacedCabinet[], room: RoomData, openings: Openings): PlacedCabinet[] | null {
  if (entry.farSide !== "cabinet") return null;
  const { filler, wallId } = entry;
  const mine = interval(filler, wallId, room);
  const width = mine.end - mine.start;
  const after = entry.side === "end";
  const farEdge = after ? mine.end : mine.start;
  const neighbour = placed.find((item) => {
    if (item.uid === filler.uid || item.uid === entry.panel.uid || isFillerItem(item) || !sharesLayer(item, filler)) return false;
    if (cabinetWall(item, room) !== wallId) return false;
    const span = interval(item, wallId, room);
    return Math.abs((after ? span.start : span.end) - farEdge) <= FILLER_PANEL_TOUCH_IN;
  });
  if (!neighbour || neighbour.placement !== filler.placement || !isSlidableNeighbour(neighbour, placed)) return null;
  const span = interval(neighbour, wallId, room);
  const neighbourWidth = span.end - span.start;
  const beyondEdge = after ? span.end : span.start;
  const beyond = farSideOf({ filler: neighbour, panel: entry.panel, farEdge: beyondEdge, direction: after ? "end" : "start", wallId, placed: placed.filter((item) => item.uid !== filler.uid), room, openings });
  // What stands past the neighbour must close the board's new seat: a cabinet, appliance or the wall.
  if (beyond !== "cabinet" && beyond !== "wall") return null;
  const neighbourStart = after ? mine.start : mine.end - neighbourWidth;
  const fillerStart = after ? mine.start + neighbourWidth : mine.end - neighbourWidth - width;
  const seat = (item: PlacedCabinet, along: number) => {
    const depth = Number(item.depth) || 0;
    const spot = wallPlacementAt(along, Number(item.width) || 0, depth, wallId as WallSide, room, item.peninsulaSide ?? null, false);
    if (Math.abs(Number(spot.wallOffset ?? along) - along) > 0.2) return null;
    return { ...item, x: spot.x, y: spot.y, rotation: spot.rotation, wallOffset: spot.wallOffset ?? along };
  };
  const movedNeighbour = seat(neighbour, neighbourStart);
  const movedFiller = seat(filler, fillerStart);
  if (!movedNeighbour || !movedFiller) return null;
  return placed.map((item) => (item.uid === neighbour.uid ? movedNeighbour : item.uid === filler.uid ? movedFiller : item));
}

/**
 * No filler outside an exposed panel. For each board on a panel's outside face:
 * 1. if a plain cabinet stands beyond it, slide that cabinet against the panel and
 *    seat the same board on the cabinet's far side (between cabinets or against the
 *    wall), so the run still closes with no gap;
 * 2. otherwise (a wall, an opening, open space or another panel lies beyond), drop
 *    the board, leave the width open, and name it on the review list. A board is
 *    never hung on the panel.
 */
export function removeFillersOutsideExposedPanels(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: Openings;
  wallLabelOf?: (wallId: string) => string | null | undefined;
}): RemoveFillersOutsidePanelsResult {
  const hits = fillersOutsideExposedPanels(input);
  if (!hits.length) return { placed: [...input.placed], removed: [], relocated: [], notes: [], findings: [] };
  let working: PlacedCabinet[] = [...input.placed];
  const dropped: FillerOutsidePanel[] = [];
  const relocated: FillerOutsidePanel[] = [];
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  for (const entry of hits) {
    const current = working.find((item) => item.uid === entry.filler.uid);
    if (!current) continue;
    const live: FillerOutsidePanel = { ...entry, filler: current };
    const width = Number(entry.filler.fillerTotalWidth) || Number(entry.filler.width) || 0;
    const layer = entry.filler.placement === "wall" ? "upper" : "base";
    const label = input.wallLabelOf?.(entry.wallId) ?? null;
    const where = `${label ?? entry.wallId} (${layer} run)`;
    const moved = relocateBehindNeighbour(live, working, input.room, input.openings ?? []);
    if (moved) {
      working = moved;
      relocated.push(live);
      notes.push(`${entry.filler.masterCode} filler (${inches(width)}) moved from outside the ${entry.panel.masterCode} panel to the far side of the next cabinet on ${where}.`);
      continue;
    }
    working = working.filter((item) => item.uid !== entry.filler.uid);
    dropped.push(entry);
    const beyond = entry.farSide === "wall" ? "the wall" : entry.farSide === "opening" ? "the opening" : entry.farSide === "panel" ? "the next panel" : entry.farSide === "cabinet" ? "the next cabinet" : "open space";
    notes.push(`No ${entry.filler.masterCode} filler outside the ${entry.panel.masterCode} panel on ${where}: ${inches(width)} beside ${beyond} stays open.`);
    findings.push({
      ruleId: "no-filler-outside-exposed-panel",
      code: "filler-outside-exposed-panel-removed",
      severity: "warning",
      title: `${label ?? entry.wallId}: no filler outside the ${entry.panel.masterCode} panel`,
      detail: `A ${inches(width)} ${entry.filler.masterCode} filler would have sat on the outside face of the ${entry.panel.masterCode} panel (${layer} run, ${beyond} beyond it), so it was not placed. A filler goes only between cabinets or against a wall, never past an exposed panel. To close that ${inches(width)}, slide the run toward that end.`,
      wallLabel: (label as DesignerReviewFinding["wallLabel"]) ?? null,
      cabinetUid: entry.panel.uid,
      cabinetCode: entry.panel.masterCode,
    });
  }
  return { placed: working, removed: dropped, relocated, notes, findings };
}
