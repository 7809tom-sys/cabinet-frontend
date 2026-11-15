/**
 * Final tighten/snap pass (Tom, Nov 14 2026, 2:06 PM CT).
 *
 * Adjacent cabinets on a run (base and upper) butt flush (0 gap, within 1/16 in).
 * Appliance openings (range, fridge, dishwasher, microwave/OTR, bridge over
 * range, bridge over sink) equal the appliance's nominal width exactly
 * (a 30 in range leaves a 30.0 in opening, never 31 or 31.5). Any leftover
 * space goes to a single catalog filler at the run end or corner, never into
 * an opening or between cabinets. Upper bridges and microwave cabinets are
 * recentered on, and match, the opening below.
 *
 * Root cause of the extra 1–1.5 in: earlier leftover packing left slivers
 * beside appliances (the layout even named "a 1″ beside the range"), the
 * leftover "bare gap at a finished end" rule intentionally kept 1–1.5 in
 * open, closeSmallOpeningsWithStock only grew neighbors for openings ≤ the
 * 3 in filler cap, and seam snap only closes 1/16 in. Those slivers sat in
 * the appliance opening or between cabinets instead of being collected as
 * one filler at the run end.
 */
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";
import { formatFillerInches } from "./autoDesignFillerConsolidation";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { isDishwasherItem } from "./dishwasherPanelRule";
import { isRequiredBlindCornerFillerGroupId } from "./blindCornerRequiredFiller";
import { isCornerLegFillerGroupId } from "./cornerLegFillerGroup";
import {
  WALL_OPENING_CLEARANCE_IN,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isRefrigerator,
  isRefrigeratorEndPanel,
  isSinkBaseCabinet,
  standardHeight,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";

export const TIGHTEN_FLUSH_IN = 1 / 16;
const EPS = 0.02;

export type TightenOpeningsResult = {
  placed: PlacedCabinet[];
  notes: string[];
  findings: DesignerReviewFinding[];
};

function layerOf(item: PlacedCabinet): "base" | "wall" | "other" {
  if (item.placement === "wall") return "wall";
  if (item.placement === "base" || item.placement === "appliance" || isFillerItem(item) || isPanelItem(item)) return "base";
  return "other";
}

function isOpeningAppliance(item: PlacedCabinet): boolean {
  if (isRangeOrOven(item.masterCode, item.description)) return true;
  if (isRefrigerator(item)) return true;
  if (isDishwasherItem(item) || /^DW[-_]?/i.test(item.masterCode ?? "")) return true;
  return false;
}

function isOpeningUpper(item: PlacedCabinet): boolean {
  if (item.placement !== "wall") return false;
  if (item.overRangeMicrowaveBridge === true) return true;
  const text = `${item.masterCode} ${item.description ?? ""} ${item.subCategory ?? ""}`;
  if (Math.abs((item.mountBottom ?? 0) - 72) <= 0.6 && /bridge|microwave|^\s*MW[-_]/i.test(text)) return true;
  return false;
}

function isOpeningOnLayer(item: PlacedCabinet, layer: "base" | "wall"): boolean {
  return layer === "wall" ? isOpeningUpper(item) : isOpeningAppliance(item);
}

function isFixedOnRun(item: PlacedCabinet): boolean {
  if (isOpeningAppliance(item)) return true;
  if (isCornerCabinet(item.masterCode, item.description)) return true;
  if (isRefrigerator(item) || isRefrigeratorEndPanel(item) || item.refrigeratorAssemblyId != null) return true;
  if (isRequiredBlindCornerFillerGroupId(item.fillerPieceGroupId)) return true;
  if (isCornerLegFillerGroupId(item.fillerPieceGroupId)) return true;
  return false;
}

function nominalWidthOf(item: PlacedCabinet, wallId: string, room: RoomData): number {
  const catalog = Number(item.nominalWidth ?? item.width);
  if (Number.isFinite(catalog) && catalog > 0) return catalog;
  return wallRunSpan(item, wallId, room);
}

function relocate(item: PlacedCabinet, start: number, wallId: string, room: RoomData): PlacedCabinet | null {
  const width = wallRunSpan(item, wallId, room);
  const depth = dim(String(item.depth ?? ""), item.placement === "wall" ? 12 : 24);
  const spot = wallPlacementAt(start, width, depth, wallId as WallSide, room);
  if (!spot) return null;
  return { ...item, ...spot };
}

function windowBlocked(start: number, end: number, openings: readonly WallOpening[], wallId: string, layer: "base" | "wall"): boolean {
  const clearance = layer === "wall" ? WALL_OPENING_CLEARANCE_IN : 0;
  return openings.some((opening) => {
    if (opening.side !== wallId || (opening.kind !== "window" && opening.kind !== "door")) return false;
    if (layer === "base" && opening.kind === "window" && (opening.sill ?? 42) >= 36) return false;
    const openStart = opening.offset - clearance;
    const openEnd = opening.offset + opening.width + clearance;
    return start < openEnd - EPS && end > openStart + EPS;
  });
}

function placeEndFiller(input: {
  wallId: string;
  layer: "base" | "wall";
  start: number;
  width: number;
  fillers: readonly CatalogFillerCandidate[];
  room: RoomData;
  styleId: number | null;
  makeUid: () => string;
  heightIn: number;
  placed: PlacedCabinet[];
}): { placed: PlacedCabinet[]; item: PlacedCabinet | null } {
  const suggestion = catalogFillerForGap(input.fillers, input.width, input.layer);
  if (!suggestion) return { placed: input.placed, item: null };
  const depth = input.layer === "wall" ? 12 : 24;
  const spot = wallPlacementAt(input.start, input.width, depth, input.wallId as WallSide, input.room);
  if (!spot) return { placed: input.placed, item: null };
  const filler: PlacedCabinet = {
    uid: input.makeUid(),
    cabinetId: suggestion.id,
    masterCode: suggestion.masterCode,
    description: fittedCatalogFillerDescription(suggestion, input.width),
    category: suggestion.category ?? "Filler",
    subCategory: suggestion.subCategory ?? "Filler",
    placement: input.layer,
    ...spot,
    width: input.width,
    depth,
    height: input.heightIn,
    ...(input.layer === "wall" ? { mountBottom: 54 } : {}),
    styleId: input.styleId,
    fillerBillingRole: "primary",
    fillerTotalWidth: input.width,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  };
  const accepted = appendCollisionFreePlacements(input.placed, [filler], input.room);
  if (accepted.rejected.length > 0) return { placed: input.placed, item: null };
  return { placed: accepted.placed, item: filler };
}

/**
 * Snap adjacent cabinets flush and force appliance openings to exact nominal width.
 */
export function tightenRunOpenings(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
  wallIds: readonly string[];
  fillers: readonly CatalogFillerCandidate[];
  styleId: number | null;
  makeUid: () => string;
  wallHeightIn?: number | null;
}): TightenOpeningsResult {
  const openings = input.openings ?? [];
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  const byUid = new Map(input.placed.map((item) => [item.uid, item]));

  const commit = (next: PlacedCabinet) => {
    byUid.set(next.uid, next);
  };

  // Recenter bridges and microwave cabinets on the appliance (or sink) below,
  // and keep their width equal to that opening.
  let placed = Array.from(byUid.values());
  for (const below of placed) {
    const rangeLike = isRangeOrOven(below.masterCode, below.description) || isSinkBaseCabinet(below);
    if (!rangeLike) continue;
    const wall = cabinetWall(below, input.room);
    const belowStart = wallRunOffset(below, wall, input.room);
    const belowWidth = wallRunSpan(below, wall, input.room);
    const belowCenter = belowStart + belowWidth / 2;
    const overs = placed.filter((item) => {
      if (item.uid === below.uid || item.placement !== "wall") return false;
      if (cabinetWall(item, input.room) !== wall) return false;
      const start = wallRunOffset(item, wall, input.room);
      const end = start + wallRunSpan(item, wall, input.room);
      const overlap = Math.min(belowStart + belowWidth, end) - Math.max(belowStart, start);
      if (overlap < 1) return false;
      const microwave = /microwave|^\s*MW[-_]/i.test(`${item.masterCode} ${item.description}`);
      const bridge = item.overRangeMicrowaveBridge === true
        || /bridge/i.test(`${item.masterCode} ${item.description} ${item.subCategory ?? ""}`)
        || Math.abs((item.mountBottom ?? 0) - 72) <= 0.6;
      return microwave || bridge;
    });
    for (const over of overs) {
      const width = wallRunSpan(over, wall, input.room);
      const desired = belowCenter - width / 2;
      const current = wallRunOffset(over, wall, input.room);
      if (Math.abs(current - desired) <= EPS) continue;
      const moved = relocate(over, desired, wall, input.room);
      if (!moved) continue;
      const accepted = appendCollisionFreePlacements(placed.filter((item) => item.uid !== over.uid), [moved], input.room);
      if (accepted.rejected.length > 0) continue;
      placed = accepted.placed;
      notes.push(`${over.masterCode} was centered on the ${formatFillerInches(belowWidth)} ${below.masterCode} opening.`);
    }
  }
  for (const item of placed) commit(item);

  for (const layer of ["base", "wall"] as const) {
    const heightIn = layer === "wall" ? input.wallHeightIn ?? standardHeight("wall") : standardHeight("base");
    for (const wallId of input.wallIds) {
      if (!wallRunFrame(wallId, input.room)) continue;
      const onWall = () => Array.from(byUid.values())
        .filter((item) => cabinetWall(item, input.room) === wallId && layerOf(item) === layer)
        .sort((left, right) => wallRunOffset(left, wallId, input.room) - wallRunOffset(right, wallId, input.room));

      // First: snap each appliance's neighbors to its exact faces so the opening
      // equals the appliance's nominal width. Neighbors move; the appliance does not.
      for (const appliance of onWall().filter((item) => isOpeningOnLayer(item, layer))) {
        const start = wallRunOffset(appliance, wallId, input.room);
        const width = nominalWidthOf(appliance, wallId, input.room);
        const end = start + width;
        // If the recorded body is not the nominal width, leave the body (palette
        // width) as the opening; do not invent a different appliance size.
        const bodyWidth = wallRunSpan(appliance, wallId, input.room);
        const openingEnd = start + bodyWidth;
        if (Math.abs(bodyWidth - width) > 0.05) {
          notes.push(`${appliance.masterCode} opening is ${formatFillerInches(bodyWidth)} (its placed body), not a padded ${formatFillerInches(width)} rough opening.`);
        }
        const left = onWall()
          .filter((item) => item.uid !== appliance.uid && !isOpeningAppliance(item))
          .filter((item) => {
            const itemEnd = wallRunOffset(item, wallId, input.room) + wallRunSpan(item, wallId, input.room);
            return itemEnd <= start + TIGHTEN_FLUSH_IN + 1.6 && itemEnd >= start - 48;
          })
          .sort((a, b) => wallRunOffset(b, wallId, input.room) - wallRunOffset(a, wallId, input.room))[0];
        const right = onWall()
          .filter((item) => item.uid !== appliance.uid && !isOpeningAppliance(item))
          .filter((item) => {
            const itemStart = wallRunOffset(item, wallId, input.room);
            return itemStart >= openingEnd - TIGHTEN_FLUSH_IN - 1.6 && itemStart <= openingEnd + 48;
          })
          .sort((a, b) => wallRunOffset(a, wallId, input.room) - wallRunOffset(b, wallId, input.room))[0];
        if (left && (!isFixedOnRun(left) || isFillerItem(left) || isRefrigeratorEndPanel(left))) {
          const leftStart = wallRunOffset(left, wallId, input.room);
          const leftWidth = wallRunSpan(left, wallId, input.room);
          const leftEnd = leftStart + leftWidth;
          const short = start - leftEnd;
          if (isFillerItem(left) && short > EPS && short <= 3 + EPS && leftWidth + short <= 6 + EPS) {
            const grown = relocate({ ...left, width: leftWidth + short, fillerTotalWidth: leftWidth + short }, leftStart, wallId, input.room);
            if (grown) {
              commit(grown);
              notes.push(`${left.masterCode} was grown to butt ${appliance.masterCode} so the opening is exactly ${formatFillerInches(bodyWidth)}.`);
            }
          } else if (!isFixedOnRun(left) || isRefrigeratorEndPanel(left)) {
            const desired = start - leftWidth;
            const current = leftStart;
            if (Math.abs(current - desired) > EPS && Math.abs(current - desired) <= 48 + EPS) {
              const moved = relocate(left, desired, wallId, input.room);
              if (moved) {
                commit(moved);
                notes.push(`${left.masterCode} was butted to ${appliance.masterCode} so the opening is exactly ${formatFillerInches(bodyWidth)}.`);
              }
            }
          }
        }
        if (right && (!isFixedOnRun(right) || isFillerItem(right) || isRefrigeratorEndPanel(right))) {
          const current = wallRunOffset(right, wallId, input.room);
          const short = current - openingEnd;
          if (isFillerItem(right) && short > EPS && short <= 3 + EPS) {
            const moved = relocate(right, openingEnd, wallId, input.room);
            if (moved) {
              const grownWidth = wallRunSpan(right, wallId, input.room) + short;
              const grown = relocate({ ...moved, width: grownWidth, fillerTotalWidth: grownWidth }, openingEnd, wallId, input.room) ?? moved;
              commit(grown);
              notes.push(`${right.masterCode} was grown to butt ${appliance.masterCode} so the opening is exactly ${formatFillerInches(bodyWidth)}.`);
            }
          } else if ((!isFixedOnRun(right) || isRefrigeratorEndPanel(right)) && Math.abs(current - openingEnd) > EPS && Math.abs(current - openingEnd) <= 48 + EPS) {
            const moved = relocate(right, openingEnd, wallId, input.room);
            if (moved) {
              commit(moved);
              notes.push(`${right.masterCode} was butted to ${appliance.masterCode} so the opening is exactly ${formatFillerInches(bodyWidth)}.`);
            }
          }
        }
      }

      // Second: walk movable cabinets and close leftover gaps between them,
      // collecting remainder at the far end (wall/corner), never between boxes.
      const items = onWall();
      for (let i = 1; i < items.length; i += 1) {
        const prev = byUid.get(items[i - 1]!.uid)!;
        const curr = byUid.get(items[i]!.uid)!;
        if (isOpeningOnLayer(prev, layer) || isOpeningOnLayer(curr, layer)) continue;
        if (isFixedOnRun(curr) || isOpeningOnLayer(curr, layer)) continue;
        const prevEnd = wallRunOffset(prev, wallId, input.room) + wallRunSpan(prev, wallId, input.room);
        const currStart = wallRunOffset(curr, wallId, input.room);
        const gap = currStart - prevEnd;
        if (gap <= TIGHTEN_FLUSH_IN + 1e-9) continue;
        if (windowBlocked(prevEnd, currStart, openings, wallId, layer)) continue;
        // A large leftover is not a seam; closeRemainingRunGaps places cabinets first.
        if (gap > 6 + EPS) continue;
        const moved = relocate(curr, prevEnd, wallId, input.room);
        if (moved && !isFixedOnRun(curr) && !isOpeningOnLayer(curr, layer)) {
          commit(moved);
          items[i] = moved;
          notes.push(`${curr.masterCode} was slid flush to ${prev.masterCode} (closed a ${formatFillerInches(gap)} seam).`);
          continue;
        }
        const seamFiller = placeEndFiller({
          wallId, layer, start: prevEnd, width: Math.round(gap * 1000) / 1000, fillers: input.fillers,
          room: input.room, styleId: input.styleId, makeUid: input.makeUid, heightIn,
          placed: Array.from(byUid.values()),
        });
        if (seamFiller.item) {
          commit(seamFiller.item);
          notes.push(`${seamFiller.item.masterCode} filled a ${formatFillerInches(gap)} seam on ${wallId} (${layer}).`);
        }
      }

      // Third: one catalog filler for a leftover at the run end / after the last cabinet.
      const packed = onWall();
      if (packed.length === 0) continue;
      const frame = wallRunFrame(wallId, input.room);
      if (!frame) continue;
      const last = packed[packed.length - 1]!;
      const lastEnd = wallRunOffset(last, wallId, input.room) + wallRunSpan(last, wallId, input.room);
      const leftover = Math.round((frame.length - lastEnd) * 1000) / 1000;
      if (leftover >= 0.125 && leftover <= 6 + EPS && !windowBlocked(lastEnd, lastEnd + leftover, openings, wallId, layer)) {
        // If the last item is already a filler covering this, skip.
        if (isFillerItem(last) && Math.abs(wallRunSpan(last, wallId, input.room) - leftover) <= EPS) continue;
        const result = placeEndFiller({
          wallId, layer, start: lastEnd, width: leftover, fillers: input.fillers,
          room: input.room, styleId: input.styleId, makeUid: input.makeUid, heightIn,
          placed: Array.from(byUid.values()),
        });
        if (result.item) {
          commit(result.item);
          notes.push(`${result.item.masterCode} collected a ${formatFillerInches(leftover)} leftover at the end of ${wallId} (${layer}).`);
        } else if (leftover > TIGHTEN_FLUSH_IN) {
          findings.push({
            ruleId: "tighten-run-openings",
            code: "end-filler-unavailable",
            severity: "warning",
            title: `${formatFillerInches(leftover)} leftover on ${wallId}`,
            detail: "The selected line sells no priced filler that covers this leftover, so nothing was invented to close it.",
          });
        }
      }
    }
  }

  placed = Array.from(byUid.values());
  return { placed, notes, findings };
}

/** Gaps between adjacent same-layer cabinets on a run (not appliance openings or window clearances). */
export function interCabinetGaps(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
  wallIds: readonly string[];
  minIn?: number;
}): Array<{ wallId: string; layer: "base" | "wall"; width: number; left: string; right: string }> {
  const minIn = input.minIn ?? TIGHTEN_FLUSH_IN;
  const openings = input.openings ?? [];
  const out: Array<{ wallId: string; layer: "base" | "wall"; width: number; left: string; right: string }> = [];
  for (const layer of ["base", "wall"] as const) {
    for (const wallId of input.wallIds) {
      if (!wallRunFrame(wallId, input.room)) continue;
      const items = input.placed
        .filter((item) => cabinetWall(item, input.room) === wallId && layerOf(item) === layer)
        .sort((left, right) => wallRunOffset(left, wallId, input.room) - wallRunOffset(right, wallId, input.room));
      for (let i = 1; i < items.length; i += 1) {
        const prev = items[i - 1]!;
        const curr = items[i]!;
        if (isOpeningOnLayer(prev, layer) || isOpeningOnLayer(curr, layer)) continue;
        const gap = wallRunOffset(curr, wallId, input.room) - (wallRunOffset(prev, wallId, input.room) + wallRunSpan(prev, wallId, input.room));
        if (gap <= minIn + 1e-9) continue;
        if (windowBlocked(wallRunOffset(prev, wallId, input.room) + wallRunSpan(prev, wallId, input.room), wallRunOffset(curr, wallId, input.room), openings, wallId, layer)) continue;
        out.push({ wallId, layer, width: Math.round(gap * 1000) / 1000, left: prev.masterCode, right: curr.masterCode });
      }
    }
  }
  return out;
}

/** Width of the opening a neighbor pair leaves for an appliance, or the appliance body if no neighbors. */
export function applianceOpeningWidths(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallIds: readonly string[];
}): Array<{ wallId: string; code: string; opening: number; nominal: number }> {
  const out: Array<{ wallId: string; code: string; opening: number; nominal: number }> = [];
  for (const wallId of input.wallIds) {
    if (!wallRunFrame(wallId, input.room)) continue;
    const items = input.placed
      .filter((item) => cabinetWall(item, input.room) === wallId && layerOf(item) === "base")
      .sort((left, right) => wallRunOffset(left, wallId, input.room) - wallRunOffset(right, wallId, input.room));
    for (const appliance of items.filter(isOpeningAppliance)) {
      const start = wallRunOffset(appliance, wallId, input.room);
      const body = wallRunSpan(appliance, wallId, input.room);
      const end = start + body;
      const left = items.filter((item) => {
        if (item.uid === appliance.uid) return false;
        const itemEnd = wallRunOffset(item, wallId, input.room) + wallRunSpan(item, wallId, input.room);
        return itemEnd <= start + 0.2 && itemEnd >= start - 0.2;
      }).sort((a, b) => wallRunOffset(b, wallId, input.room) - wallRunOffset(a, wallId, input.room))[0];
      const right = items.filter((item) => {
        if (item.uid === appliance.uid) return false;
        const itemStart = wallRunOffset(item, wallId, input.room);
        return itemStart >= end - 0.2 && itemStart <= end + 0.2;
      }).sort((a, b) => wallRunOffset(a, wallId, input.room) - wallRunOffset(b, wallId, input.room))[0];
      const openingStart = left ? wallRunOffset(left, wallId, input.room) + wallRunSpan(left, wallId, input.room) : start;
      const openingEnd = right ? wallRunOffset(right, wallId, input.room) : end;
      out.push({
        wallId,
        code: appliance.masterCode,
        opening: Math.round((openingEnd - openingStart) * 1000) / 1000,
        nominal: Math.round(body * 1000) / 1000,
      });
    }
  }
  return out;
}
