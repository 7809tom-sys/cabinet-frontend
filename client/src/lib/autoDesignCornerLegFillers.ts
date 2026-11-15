/**
 * Filler on each leg of a two-leg inside corner cabinet (Tom, Nov 15 2026).
 *
 * A lazy Susan (or a diagonal corner base) meets a straight base on BOTH walls
 * of the corner. Butted tight, the doors and drawer fronts of the corner box
 * and its neighbors hit each other, so a filler goes between the corner
 * cabinet and the base beside it on each leg. The blind corner already owns
 * its required filler (`blindCornerRequiredFiller.ts`), so it is not touched
 * here.
 *
 * The filler is the selected line's own filler SKU, cut to width, and is
 * seated before the straight runs are tiled, so the runs close around it.
 * A line that sells no filler stock, or a leg that is already occupied, is
 * named on the review list; nothing is invented.
 */
import {
  STD,
  appendCollisionFreePlacements,
  cabinetWall,
  isFillerItem,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import { autoDesignCornerFamily } from "./autoDesignCornerStage";
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";
import { installedFillerVerticalSpec } from "./smallGapFiller";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { cornerLegFillerGroupId, isCornerLegFillerGroupId } from "./cornerLegFillerGroup";

/** Installed width of each corner leg filler: cut from the line's 3 in stock. */
export const CORNER_LEG_FILLER_IN = 3;

export { cornerLegFillerGroupId, isCornerLegFillerGroupId };

/** A base corner that meets a straight run on both legs: lazy Susan or diagonal. */
export function needsCornerLegFillers(corner: Pick<PlacedCabinet, "masterCode" | "description" | "cornerType" | "subCategory" | "placement">): boolean {
  if (corner.placement !== "base") return false;
  const family = autoDesignCornerFamily(corner as Parameters<typeof autoDesignCornerFamily>[0]);
  return family === "lazy-susan" || family === "diagonal";
}

export type CornerLegFillerResult = {
  placed: PlacedCabinet[];
  fillers: PlacedCabinet[];
  findings: DesignerReviewFinding[];
  notes: string[];
};

function legFinding(corner: PlacedCabinet, detail: string): DesignerReviewFinding {
  return {
    ruleId: "corner-leg-filler",
    code: "corner-leg-filler-missing",
    severity: "warning",
    title: `${corner.masterCode}: no filler beside the corner cabinet`,
    detail,
    cabinetUid: corner.uid,
    cabinetCode: corner.masterCode,
  };
}

/**
 * Seat one catalog filler on each leg of `corner`, on the open edge (away from
 * the corner vertex). Existing leg fillers are kept; nothing is moved.
 */
export function placeCornerLegFillers(input: {
  corner: PlacedCabinet;
  cornerPoint: { x: number; y: number };
  wallIds: readonly string[];
  room: RoomData;
  placed: readonly PlacedCabinet[];
  catalogFillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
  widthIn?: number;
  /**
   * The narrowest straight base the line sells. When the leg's pocket (corner
   * to the next cabinet or appliance already on the leg) fits that real base
   * only WITHOUT the filler, the real base wins (the owner's 9 in flank beside a
   * range next to the corner) and the skip is named in `notes`.
   */
  minBaseWidthIn?: number | null;
}): CornerLegFillerResult {
  const { corner, room } = input;
  let working = [...input.placed];
  const fillers: PlacedCabinet[] = [];
  const findings: DesignerReviewFinding[] = [];
  const notes: string[] = [];
  if (!needsCornerLegFillers(corner)) return { placed: working, fillers, findings, notes };
  const width = input.widthIn ?? CORNER_LEG_FILLER_IN;
  const catalog = catalogFillerForGap(input.catalogFillers, width, "base");
  if (!catalog) {
    findings.push(legFinding(corner, `${corner.masterCode} needs a ${width}″ filler on each leg so its doors clear the cabinets beside it, and this line sells no base filler stock that covers ${width}″. Nothing was invented.`));
    return { placed: working, fillers, findings, notes };
  }
  for (const wallId of input.wallIds) {
    const frame = wallRunFrame(wallId, room);
    if (!frame) continue;
    const span = wallRunSpan(corner, wallId, room);
    if (!(span > 0)) continue;
    const start = wallRunOffset(corner, wallId, room);
    const atStart = Math.hypot(frame.start.x - input.cornerPoint.x, frame.start.y - input.cornerPoint.y) <= 0.5;
    const along = atStart ? start + span : start - width;
    const groupId = cornerLegFillerGroupId(corner, wallId);
    if (working.some((item) => item.fillerPieceGroupId === groupId)) continue;
    // A filler (any) already touching the open edge on this leg counts.
    const edge = atStart ? start + span : start;
    const touching = working.some((item) => item.uid !== corner.uid && isFillerItem(item) && item.placement !== "wall"
      && cabinetWall(item, room) === wallId
      && (atStart
        ? Math.abs(wallRunOffset(item, wallId, room) - edge) <= 0.25
        : Math.abs(wallRunOffset(item, wallId, room) + wallRunSpan(item, wallId, room) - edge) <= 0.25));
    if (touching) continue;
    // The pocket on this leg: open edge of the corner to the nearest box already seated.
    let pocket = Number.POSITIVE_INFINITY;
    for (const item of working) {
      if (item.uid === corner.uid || isFillerItem(item) || item.placement === "wall" || cabinetWall(item, room) !== wallId) continue;
      const itemStart = wallRunOffset(item, wallId, room);
      const itemEnd = itemStart + wallRunSpan(item, wallId, room);
      const gap = atStart ? itemStart - edge : edge - itemEnd;
      if (gap >= -0.05 && gap < pocket) pocket = gap;
    }
    const minBase = input.minBaseWidthIn ?? null;
    if (minBase != null && minBase > 0 && pocket >= minBase - 0.05 && pocket - width < minBase - 0.05) {
      notes.push(`${corner.masterCode}: no filler on the ${wallId} leg. The ${Math.round(pocket * 8) / 8}″ space beside it takes a real ${minBase}″ cabinet only without a ${width}″ filler, so the cabinet wins.`);
      continue;
    }
    if (along < -0.05 || along + width > frame.length + 0.05) {
      findings.push(legFinding(corner, `The ${wallId} leg of ${corner.masterCode} ends at the wall, so there is no room for its ${width}″ filler.`));
      continue;
    }
    const height = installedFillerVerticalSpec("base", Number(corner.height) || STD.BASE_HEIGHT).storedHeight;
    const spot = wallPlacementAt(Math.max(0, along), width, STD.BASE_DEPTH, wallId as WallSide, room);
    const filler: PlacedCabinet = {
      uid: input.makeUid(),
      cabinetId: catalog.id,
      masterCode: catalog.masterCode,
      description: `${fittedCatalogFillerDescription(catalog, width)} — clearance beside ${corner.masterCode}`,
      category: catalog.category ?? "Filler",
      subCategory: catalog.subCategory ?? "Filler",
      placement: "base",
      ...spot,
      width,
      nominalWidth: Number(catalog.width) || width,
      depth: STD.BASE_DEPTH,
      nominalDepth: Number(catalog.depth) || STD.BASE_DEPTH,
      height,
      nominalHeight: height,
      mountBottom: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      catalogImageUrl: catalog.catalogImageUrl ?? null,
      styleId: input.styleId,
      fillerPieceGroupId: groupId,
      fillerTotalWidth: width,
      fillerForCabinetUid: corner.uid,
    } as PlacedCabinet;
    const accepted = appendCollisionFreePlacements(working, [filler], room);
    if (accepted.rejected.length > 0 || !accepted.placed.some((item) => item.uid === filler.uid)) {
      findings.push(legFinding(corner, `The ${wallId} leg of ${corner.masterCode} is already occupied right beside the corner, so its ${width}″ filler could not be seated. Nothing was moved.`));
      continue;
    }
    working = accepted.placed;
    fillers.push(filler);
  }
  return { placed: working, fillers, findings, notes };
}
