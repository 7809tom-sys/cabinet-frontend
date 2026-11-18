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
  isPanelItem,
  isRefrigeratorEndPanel,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
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
  farSide: "wall" | "opening" | "panel" | "nothing";
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
      const far = farSideOf({ filler, panel, farEdge, direction: touchesStartOfFiller ? "end" : "start", wallId, placed, room, openings: input.openings ?? [] });
      if (far === "cabinet") continue;
      found.push({ filler, panel, wallId, side: touchesStartOfFiller ? "end" : "start", farSide: far });
      break;
    }
  }
  return found;
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
  notes: string[];
  findings: DesignerReviewFinding[];
};

const inches = (value: number) => `${Math.round(value * 100) / 100}″`;

/**
 * Drops every filler on a panel's outside face and names each one on the review
 * list. The freed width is not covered by a board hung on the panel: where a
 * cabinet can take it, the run's own passes already did; what is left is reported
 * so the shopper can slide the run or accept the gap.
 */
export function removeFillersOutsideExposedPanels(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly { side: string; offset: number; width: number }[];
  wallLabelOf?: (wallId: string) => string | null | undefined;
}): RemoveFillersOutsidePanelsResult {
  const removed = fillersOutsideExposedPanels(input);
  if (!removed.length) return { placed: [...input.placed], removed: [], notes: [], findings: [] };
  const drop = new Set(removed.map((entry) => entry.filler.uid));
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  const seen = new Set<string>();
  for (const entry of removed) {
    const width = Number(entry.filler.fillerTotalWidth) || Number(entry.filler.width) || 0;
    const layer = entry.filler.placement === "wall" ? "upper" : "base";
    const beyond = entry.farSide === "wall" ? "the wall" : entry.farSide === "opening" ? "the opening" : entry.farSide === "panel" ? "the next panel" : "open space";
    const label = input.wallLabelOf?.(entry.wallId) ?? null;
    const key = `${entry.wallId}|${layer}|${entry.filler.masterCode}|${Math.round(wallRunOffset(entry.filler, entry.wallId, input.room) * 4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push(`No ${entry.filler.masterCode} filler outside the ${entry.panel.masterCode} panel on ${label ?? entry.wallId} (${layer} run): ${inches(width)} beside ${beyond} stays open.`);
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
  return { placed: input.placed.filter((item) => !drop.has(item.uid)), removed, notes, findings };
}
