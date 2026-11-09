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
  isFillerItem,
  isPanelItem,
  isRefrigerator,
  isRefrigeratorEndPanel,
  isSinkBaseCabinet,
  placedHeight,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { isShortUpperCabinet } from "./shortUpper";

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
}): ExposedPanelRequirement[] {
  const requirements: ExposedPanelRequirement[] = [];
  const owned = input.placed.filter((item) => (
    (item.placement === "base" || item.placement === "wall" || item.placement === "tall")
    && !item.islandFace
    && !isPanelItem(item)
    && !isFillerItem(item)
    // A 24-inch-or-shorter upper is a one-face appliance surround, not an
    // upper-run end, so rule 10 never asks for a board beside it (issue 353
    // outcome 8).
    && !isShortUpperCabinet(item)
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
    const covers = (side: ExposedSide) => others.some((other) => {
      const otherStart = wallRunOffset(other, wallId, input.room);
      const otherEnd = otherStart + wallRunSpan(other, wallId, input.room);
      const meetsEdge = side === "start"
        ? Math.abs(otherEnd - start) <= 0.06
        : Math.abs(otherStart - end) <= 0.06;
      if (!meetsEdge) return false;
      if (isPanelItem(other) || isFillerItem(other)) return true;
      const otherHeight = placedHeight(other);
      const otherDepth = Number(other.depth) || 0;
      return otherHeight >= height - 0.01 && otherDepth >= depth - 0.01;
    });
    const panelPresent = (side: ExposedSide) => others.some((other) => (
      isPanelItem(other)
      && other.autoPlacedForUid === cabinet.uid
      && other.autoPlacedSide === side
    ));
    for (const side of ["start", "end"] as const) {
      if (panelPresent(side)) continue;
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
