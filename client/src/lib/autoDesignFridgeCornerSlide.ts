/**
 * Fridge-panel 45° corners (Tom, Nov 16 2026, 8:17 and 8:41 AM CT): a filler
 * against a refrigerator panel is the last resort, and wiggle room is used to
 * shrink it before a wide one is accepted.
 *
 * At a 45° corner the two 24″ fronts meet on a miter line fixed by the corner
 * itself (depth × tan 22.5° from the vertex). The panel-side miter piece runs
 * from that line to the panel, so its width depends only on where the panel
 * is; shifting or resizing the cabinets on the other wall changes only the
 * other piece. The one lever is the refrigerator bay itself, within the
 * anchor wiggle cap (3″ by default):
 *   1. away from the corner just far enough that the smallest live-catalog
 *      base fits beside the panel, so the corner closes cabinet-to-cabinet and
 *      no filler touches the panel; else
 *   2. toward the corner so the panel-side piece shrinks toward ~2″, but never
 *      so far that the upper already seated beside the panel stops fitting.
 * A slide is kept only when the rebuilt plan still closes that corner, adds
 * no new review finding, and leaves every other 45° corner exactly as it was.
 */
import {
  insideCornerHoldIn,
  isFillerItem,
  isRefrigeratorEndPanel,
  roomWallRunFrames,
  wallLength,
  wallRunJoinAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import type { DesignerReviewFinding } from "./designerReviewFindings";

/** The panel-side board Tom asked for when no cabinet fits: about 2″. */
export const FRIDGE_PANEL_CORNER_TARGET_IN = 2;
const EPS = 0.05;

export type FridgePanelCornerState = {
  vertexKey: string;
  wallId: string;
  neighborWallId: string;
  panel: PlacedCabinet;
  /** Distance along the panel's wall from the 45° vertex to the panel's near face. */
  panelGapIn: number;
  /** The base front-miter piece cut against the panel, if any. */
  basePiece: PlacedCabinet | null;
  baseCabinetBesidePanel: PlacedCabinet | null;
  upperBesidePanel: PlacedCabinet | null;
};

function spanOn(item: PlacedCabinet, wallId: string, room: RoomData) {
  const start = wallRunOffset(item, wallId, room);
  return { start, end: start + wallRunSpan(item, wallId, room) };
}

/** Every 45° corner whose wall starts (at that vertex) with a refrigerator end panel in the base band. */
export function fridgePanelCornerStates(placed: readonly PlacedCabinet[], room: RoomData): FridgePanelCornerState[] {
  const states: FridgePanelCornerState[] = [];
  for (const frame of roomWallRunFrames(room)) {
    for (const at of ["start", "end"] as const) {
      const join = wallRunJoinAt(frame, at, room);
      if (!join || Math.abs(join.turnDeg - 45) > 0.5) continue;
      const len = wallLength(frame.id as WallSide, room);
      const gapOf = (item: PlacedCabinet) => {
        const span = spanOn(item, frame.id, room);
        return at === "start" ? span.start : len - span.end;
      };
      const nearest = placed
        .filter((item) => item.wallId === frame.id && !item.fillerPieceGroupId && !isFillerItem(item)
          && (isRefrigeratorEndPanel(item) || item.placement === "base" || item.placement === "tall" || item.placement === "appliance"))
        .map((item) => ({ item, gap: gapOf(item) }))
        .filter((entry) => entry.gap >= -EPS)
        .sort((left, right) => left.gap - right.gap)[0];
      if (!nearest || !isRefrigeratorEndPanel(nearest.item)) continue;
      const panelSpan = spanOn(nearest.item, frame.id, room);
      const panelFace = at === "start" ? panelSpan.start : panelSpan.end;
      const touching = (item: PlacedCabinet) => {
        const span = spanOn(item, frame.id, room);
        return Math.abs((at === "start" ? span.end : span.start) - panelFace) <= EPS;
      };
      const onWall = placed.filter((item) => item.wallId === frame.id && item.uid !== nearest.item.uid);
      const vertex = at === "start" ? frame.start : frame.end;
      states.push({
        vertexKey: `${Math.round(vertex.x * 100)}:${Math.round(vertex.y * 100)}`,
        wallId: frame.id,
        neighborWallId: join.frame.id,
        panel: nearest.item,
        panelGapIn: nearest.gap,
        basePiece: onWall.find((item) => item.fillerTransitionKind === "front-miter-pair" && item.placement === "base" && touching(item)) ?? null,
        baseCabinetBesidePanel: onWall.find((item) => item.placement === "base" && !isFillerItem(item) && !item.fillerPieceGroupId && touching(item)) ?? null,
        upperBesidePanel: onWall.find((item) => item.placement === "wall" && !isFillerItem(item) && !item.fillerPieceGroupId && touching(item)) ?? null,
      });
    }
  }
  return states;
}

/** How far the panel must move (+ away from the corner, − toward it) for each option, best first. */
export function fridgePanelCornerSlideOptions(state: FridgePanelCornerState, input: {
  smallestBaseWidthIn: number | null;
  capIn: number;
  /** Live-catalog widths of uppers matching the one seated beside the panel. */
  upperWidthsIn?: readonly number[];
}): { panelDeltaIn: number; goal: "cabinet" | "smaller-filler" }[] {
  const options: { panelDeltaIn: number; goal: "cabinet" | "smaller-filler" }[] = [];
  const roundUp = (value: number) => Math.ceil(value * 8 - 1e-6) / 8;
  const roundDown = (value: number) => Math.floor(value * 8 + 1e-6) / 8;
  const piece = state.basePiece ? Number(state.basePiece.width) || 0 : 0;
  if (!state.basePiece || piece <= FRIDGE_PANEL_CORNER_TARGET_IN + 1 / 16) return options;
  const hold = insideCornerHoldIn(45, 24);
  if (input.smallestBaseWidthIn != null) {
    const away = roundUp(input.smallestBaseWidthIn - (state.panelGapIn - hold));
    if (away > EPS && away <= input.capIn + EPS) options.push({ panelDeltaIn: away, goal: "cabinet" });
  }
  // Closest to ~2″ first, then ⅛″ less each step. The refrigerator's own corner
  // clearance and the rebuilt plan decide how far it can really go; the upper
  // seated beside the panel stays only if it still fits, and the upper corner
  // must still close either way.
  const toward = Math.min(input.capIn, roundDown(piece - FRIDGE_PANEL_CORNER_TARGET_IN));
  const upper = state.upperBesidePanel;
  const upperHold = upper ? insideCornerHoldIn(45, Number(upper.depth) || 12) : 0;
  for (let step = toward; step > EPS; step = Math.round((step - 0.125) * 8) / 8) {
    // An upper corner closed by a cabinet beside the panel needs one there
    // after the slide too: skip a slide no stock upper fits (no rebuild).
    if (upper && input.upperWidthsIn) {
      const space = state.panelGapIn - step - upperHold;
      if (!input.upperWidthsIn.some((width) => width <= space + EPS)) continue;
    }
    options.push({ panelDeltaIn: -step, goal: "smaller-filler" });
  }
  return options;
}

/** Every 45° miter piece away from `skipWallId`, as a comparable signature. */
export function otherCornerSignature(placed: readonly PlacedCabinet[], room: RoomData, skip: { wallId: string; neighborWallId: string }): string[] {
  const pieces = placed.filter((item) => item.fillerTransitionKind === "front-miter-pair" && item.wallId);
  const skipGroups = new Set(pieces.filter((item) => item.wallId === skip.wallId).map((item) => item.fillerPieceGroupId ?? item.uid));
  return pieces
    .filter((item) => item.wallId !== skip.wallId && !skipGroups.has(item.fillerPieceGroupId ?? item.uid))
    .map((item) => {
      const span = spanOn(item, item.wallId!, room);
      return `${item.wallId}|${item.placement}|${item.masterCode}|${(Number(item.width) || 0).toFixed(2)}|${span.start.toFixed(2)}`;
    })
    .sort();
}

export function newFindingCodes(before: readonly DesignerReviewFinding[], after: readonly DesignerReviewFinding[]): string[] {
  const count = (list: readonly DesignerReviewFinding[]) => {
    const map = new Map<string, number>();
    for (const finding of list) map.set(finding.code, (map.get(finding.code) ?? 0) + 1);
    return map;
  };
  const a = count(before);
  return Array.from(count(after)).filter(([code, n]) => n > (a.get(code) ?? 0)).map(([code]) => code);
}
