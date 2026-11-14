/**
 * Rule 10: a 3/4 inch exposed finished panel on EVERY visible side.
 *
 * The broad exposed-side engine already knows what "visible" means, but rule 10 is narrower and
 * stronger: an Auto-Design build must finish every visible side with 3/4 inch stock — at an open
 * run end, beside a refrigerator, beside a dishwasher, under a window, and on a tall run end —
 * without waiting for the admin flag. What it must NOT do is double-stock a side it already
 * finished, or finish a side that is against the wall or butted to a cabinet.
 */
import {
  STD,
  cabinetWall,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isPlainBaseCode,
  isRefrigerator,
  isRefrigeratorEndPanel,
  isSinkBaseCabinet,
  placedFootprint,
  placedHeight,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import type { DesignerReviewFinding } from "./designerReviewFindings";

/** Rule 10: finished end stock is 3/4 inch. */
export const EXPOSED_PANEL_THICKNESS_IN = STD.PANEL_THICKNESS;

export type ExposedPanelThicknessCheck = {
  ok: boolean;
  /** Panels thinner than 3/4 inch on a visible side. */
  tooThin: PlacedCabinet[];
  /** Panels thicker than 3/4 inch on a visible side. */
  tooThick: PlacedCabinet[];
};

/**
 * Rule 10: every exposed finished panel is exactly 3/4 inch stock. A panel that was cut to 1/2"
 * or 1-1/2" is a real miss, not a rounding error.
 */
export function verifyExposedPanelThickness(placed: readonly PlacedCabinet[]): ExposedPanelThicknessCheck {
  const visiblePanels = placed.flatMap((item) => (
    isPanelItem(item) && !item.islandFace && item.autoPlacedReason != null ? [item] : []
  ));
  // A finished end panel is stock: its thinnest plan dimension is the 3/4" thickness.
  const thicknessOf = (item: PlacedCabinet) => Math.min(Number(item.width) || Infinity, Number(item.depth) || Infinity);
  const tooThin = visiblePanels.filter((item) => thicknessOf(item) < EXPOSED_PANEL_THICKNESS_IN - 0.01);
  const tooThick = visiblePanels.filter((item) => thicknessOf(item) > EXPOSED_PANEL_THICKNESS_IN + 0.01);
  return { ok: tooThin.length === 0 && tooThick.length === 0, tooThin, tooThick };
}

export type ExposedSide = "start" | "end";

export type ExposedPanelRequirement = {
  cabinetUid: string;
  cabinetCode: string;
  wallId: string;
  side: ExposedSide;
  /** Along-run offset where the panel's inner face sits. */
  atIn: number;
  /** Plain reason for the review list, e.g. "open end of the run". */
  reason: string;
};

/**
 * Rule 10: sides that need a 3/4 inch finished panel.
 *
 * A side is exposed when nothing on the same wall covers it at this cabinet's elevation:
 * no adjoining cabinet of equal or greater depth, no filler, no end panel. A side against the
 * room wall's own end is exposed unless the wall ends at another wall.
 */
export function exposedPanelRequirements(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** Walls the build actually cabinets; a run end on one of these is exposed. */
  buildWallIds?: readonly string[];
  /**
   * A run end flush with the room wall's end meets the next wall, so it is not a visible side
   * (rectangular rooms).
   */
  wallEndsCovered?: boolean;
}): ExposedPanelRequirement[] {
  const requirements: ExposedPanelRequirement[] = [];
  const owned = input.placed.filter((item) => (
    (item.placement === "base" || item.placement === "wall" || item.placement === "tall")
    && !item.islandFace
    && !isPanelItem(item)
    && !isFillerItem(item)
  ));
  for (const cabinet of owned) {
    const wallId = cabinetWall(cabinet, input.room);
    if (!wallId) continue;
    const frame = wallRunFrame(wallId, input.room);
    if (!frame) continue;
    const start = wallRunOffset(cabinet, wallId, input.room);
    const end = start + wallRunSpan(cabinet, wallId, input.room);
    const height = placedHeight(cabinet);
    const depth = Number(cabinet.depth) || 0;
    const others = input.placed.filter((item) => item.uid !== cabinet.uid && cabinetWall(item, input.room) === wallId);
    const isCorner = !isPlainBaseCode(cabinet.masterCode ?? "")
      && isCornerCabinet(cabinet.masterCode ?? "", cabinet.description ?? undefined, cabinet.cornerType ?? undefined);
    const isCornerSide = isCorner;
    const covers = (side: ExposedSide) => {
      const meeting = others.filter((other) => {
        const otherStart = wallRunOffset(other, wallId, input.room);
        const otherEnd = otherStart + wallRunSpan(other, wallId, input.room);
        return side === "start"
          ? Math.abs(otherEnd - start) <= 0.06
          : Math.abs(otherStart - end) <= 0.06;
      });
      if (meeting.some((other) => isPanelItem(other) || isFillerItem(other))) return true;
      // A tall panel whose near face sits just off the edge (e.g. a refrigerator end panel with a
      // 1/2 inch panel gap beside the cabinet above the refrigerator) finishes the side.
      if (others.some((other) => (
        isPanelItem(other)
        && other.placement === "tall"
        && (side === "start"
          ? Math.abs(wallRunOffset(other, wallId, input.room) + wallRunSpan(other, wallId, input.room) - start) <= 1.0
          : Math.abs(wallRunOffset(other, wallId, input.room) - end) <= 1.0)
      ))) return true;
      // Stacked neighbors: the union of the meeting neighbors' vertical spans (at least as deep as
      // this cabinet) must contain this cabinet's span.
      // A corner cabinet's leg is a standard run depth even when its box is listed deeper (36x36 lazy Susan).
      const sideDepth = input.wallEndsCovered === true && isCornerSide
        ? Math.min(depth, cabinet.placement === "wall" ? 12 : 24)
        : depth;
      const thisBottom = Number(cabinet.mountBottom) || 0;
      const thisTop = thisBottom + height;
      const spans = meeting
        .filter((other) => (Number(other.depth) || 0) >= sideDepth - 0.01)
        .map((other) => {
          const bottom = Number(other.mountBottom) || 0;
          return [bottom, bottom + placedHeight(other)] as const;
        })
        .sort((a, b) => a[0] - b[0]);
      let coveredTo = thisBottom;
      for (const [bottom, top] of spans) {
        if (bottom > coveredTo + 0.05) break;
        if (top > coveredTo) coveredTo = top;
        if (coveredTo >= thisTop - 0.05) return true;
      }
      return false;
    };
    const panelPresent = (side: ExposedSide) => others.some((other) => (
      isPanelItem(other)
      && other.autoPlacedForUid === cabinet.uid
      && other.autoPlacedSide === side
    ));
    const wallEndCovered = (side: ExposedSide) => (
      input.wallEndsCovered === true
      && (wallId === "top" || wallId === "right" || wallId === "bottom" || wallId === "left")
      && (side === "start"
        ? start <= 0.06
        : end >= frame.length - 0.06)
    );
    // A side also counts as covered when it butts a cabinet on ANOTHER wall run (typically the
    // perpendicular run's corner wall cabinet occupying the corner square).
    const crossWallCovered = (side: ExposedSide) => {
      if (input.wallEndsCovered !== true) return false;
      const along = side === "start" ? start - 0.5 : end + 0.5;
      const inwardDist = Math.min(depth, 12) / 2;
      const p = {
        x: frame.start.x + frame.tangent.x * along + frame.inward.x * inwardDist,
        y: frame.start.y + frame.tangent.y * along + frame.inward.y * inwardDist,
      };
      const thisBottom = Number(cabinet.mountBottom) || 0;
      const thisTop = thisBottom + height;
      const halfHeight = height / 2;
      return input.placed.some((item) => {
        if (item.uid === cabinet.uid) return false;
        if (cabinetWall(item, input.room) === wallId) return false;
        const bottom = Number(item.mountBottom) || 0;
        const top = bottom + placedHeight(item);
        const overlap = Math.min(top, thisTop) - Math.max(bottom, thisBottom);
        if (overlap < halfHeight) return false;
        const footprint = placedFootprint(item);
        return p.x >= item.x - 0.05
          && p.x <= item.x + footprint.w + 0.05
          && p.y >= item.y - 0.05
          && p.y <= item.y + footprint.d + 0.05;
      });
    };
    // A corner cabinet's corner-facing side tucks into the corner box behind the next run.
    const cornerSideHidden = (side: ExposedSide) => (
      input.wallEndsCovered === true
      && isCorner
      && (side === "start" ? start <= 30 : end >= frame.length - 30)
    );
    for (const side of ["start", "end"] as const) {
      if (panelPresent(side)) continue;
      if (wallEndCovered(side)) continue;
      if (crossWallCovered(side)) continue;
      if (cornerSideHidden(side)) continue;
      if (covers(side)) continue;
      const atRunEdge = side === "start" ? start <= 0.06 : end >= frame.length - 0.06;
      const isFridgeSide = others.some((other) => (
        isRefrigerator(other) || isRefrigeratorEndPanel(other)
      )) && (side === "start"
        ? others.some((other) => isRefrigerator(other) && Math.abs(wallRunOffset(other, wallId, input.room) + wallRunSpan(other, wallId, input.room) - start) <= 0.06)
        : others.some((other) => isRefrigerator(other) && Math.abs(wallRunOffset(other, wallId, input.room) - end) <= 0.06));
      const besideDishwasher = others.some((other) => (
        /^DW[-_]?\d/i.test(`${other.masterCode ?? ""}`)
        && (side === "start"
          ? Math.abs(wallRunOffset(other, wallId, input.room) + wallRunSpan(other, wallId, input.room) - start) <= 0.06
          : Math.abs(wallRunOffset(other, wallId, input.room) - end) <= 0.06)
      ));
      const reason = atRunEdge
        ? "open end of the run"
        : isFridgeSide
          ? "beside the refrigerator"
          : besideDishwasher
            ? "beside the dishwasher"
            : isSinkBaseCabinet(cabinet) && cabinet.placement === "base"
              ? "sink base side"
              : "visible side with nothing to finish it";
      requirements.push({
        cabinetUid: cabinet.uid,
        cabinetCode: cabinet.masterCode,
        wallId,
        side,
        atIn: side === "start" ? start : end,
        reason,
      });
    }
  }
  return requirements;
}

/** Rule 10 review text for a side that stayed unfinishable (the line sells no matching panel). */
export function exposedPanelFindings(
  requirements: readonly ExposedPanelRequirement[],
  satisfied: ReadonlySet<string>,
): DesignerReviewFinding[] {
  return requirements
    .filter((requirement) => !satisfied.has(`${requirement.cabinetUid}:${requirement.side}`))
    .map((requirement) => ({
      ruleId: "exposed-panel-three-quarter",
      code: "exposed-side-left-unfinished",
      severity: "warning" as const,
      title: `${requirement.cabinetCode} keeps an unfinished ${requirement.side} side`,
      detail: `Rule 10 needs 3/4″ stock on every visible side (${requirement.reason}), and the selected line sells no matching panel here.`,
      cabinetUid: requirement.cabinetUid,
      cabinetCode: requirement.cabinetCode,
    }));
}

/** True when the exposed-panel engine is on for this build (rule 10 forces it on). */
export function exposedPanelsForcedOn(): boolean {
  return kitchenRuleNumber("panel_thickness_in") === EXPOSED_PANEL_THICKNESS_IN;
}
