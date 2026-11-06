/**
 * Real cabinets before filler. This is the single shared pass every run goes
 * through, base and wall alike.
 *
 * Owner rules, in order:
 *   1. Slide the cabinets beside an opening within the wiggle room. Anchors (range,
 *      refrigerator, sink base) move at most 2 inches; windows never move.
 *   2. If that is not enough, widen a neighbor to a real larger cabinet.
 *   3. Seat a real narrow cabinet in the opening.
 *   4. Only then, and only if the space is a genuinely unusable sliver, use filler.
 *
 * The auto designer does not add filler at the END of a run at all: a run end that
 * lands on a wall is finished, not gapped. Filler is placed only when the person
 * asks for one, or here as the last resort for an interior sliver that no real
 * cabinet and no legal slide can close.
 */
import { cabinetDrawingType } from "./cabinetGraphics";
import { isPlacedCornerCabinet } from "./autoDesignCornerGuard";
import {
  COLLISION_EPSILON_IN,
  STD,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  footprintDepth,
  freeSegmentsOnWall,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isSinkBaseCabinet,
  roomWallRunFrames,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import { autoDesignFillerMaxIn } from "./autoDesignSeamFillers";

/** Narrowest real cabinet the shared pass will try to seat in an opening. */
export const REAL_CABINET_MIN_WIDTH_IN = 6;
/** Widest opening this pass treats as a single real cabinet. */
export const REAL_CABINET_MAX_WIDTH_IN = 21;

export type RealCabinetFix =
  | { kind: "seat"; cabinet: DesignCabinet; startIn: number; widthIn: number }
  | { kind: "slide-sliver"; cabinet: DesignCabinet; deltaIn: number; widthIn: number }
  | { kind: "widen"; neighbor: PlacedCabinet; cabinet: DesignCabinet; startIn: number; widthIn: number }
  | { kind: "slide"; cabinet: PlacedCabinet; deltaIn: number };

function width(row: { width?: string | number | null }): number {
  return dim(row.width == null ? null : String(row.width), 0);
}

/** A real straight base or wall box that can stand in a narrow opening. */
export function isRealNarrowCabinet(row: DesignCabinet, layer: "base" | "wall"): boolean {
  if (row.placement !== layer) return false;
  if (isFillerItem(row) || isPanelItem(row) || isSinkBaseCabinet(row)) return false;
  if (isCornerCabinet(row.masterCode, row.description)) return false;
  const w = width(row);
  if (!(w >= REAL_CABINET_MIN_WIDTH_IN - 0.05) || w > REAL_CABINET_MAX_WIDTH_IN + 0.05) return false;
  const text = `${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""}`.toLowerCase();
  if (/filler|panel|skin|moulding|molding|crown|valance|sample|touch.?up/.test(text)) return false;
  return cabinetDrawingType(row) !== undefined;
}

/**
 * Openings in one layer of one wall that no cabinet covers, widest first.
 * `minWidthIn` below the live filler maximum is deliberately NOT honoured:
 * slivers that small are the only place filler may ever go.
 */
export function openRunGaps(input: {
  wallId: string;
  room: RoomData;
  placed: readonly PlacedCabinet[];
  openings: readonly WallOpening[];
  layer: "base" | "wall";
  minWidthIn?: number;
}): Array<{ startIn: number; widthIn: number }> {
  const minWidthIn = input.minWidthIn ?? REAL_CABINET_MIN_WIDTH_IN;
  const depth = input.layer === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH;
  return freeSegmentsOnWall(
    input.wallId as WallSide,
    input.room,
    [...input.placed],
    [...input.openings],
    Math.max(0.125, minWidthIn),
    0,
    input.layer,
    false,
    undefined,
    depth,
  )
    .filter((segment) => segment.length > autoDesignFillerMaxIn() + COLLISION_EPSILON_IN)
    .map((segment) => ({ startIn: segment.start, widthIn: segment.length }))
    .sort((left, right) => right.widthIn - left.widthIn);
}

/**
 * The real fixes available for one opening, cheapest first: seat a real cabinet
 * that is exactly this width, slide a neighbor the small amount that turns the
 * opening into a width the line DOES sell (then seat that cabinet), widen the
 * neighbor, or slide a neighbor to open a real width.
 */
export function planRealCabinetFixes(input: {
  gapIn: number;
  catalog: readonly DesignCabinet[];
  neighbors: readonly PlacedCabinet[];
  room: RoomData;
  wallId: string;
  layer: "base" | "wall";
  /** Maximum legal slide for a neighbor, in inches. Anchors pass their 2 inch cap. */
  slideLimitIn?: number;
}): RealCabinetFix[] {
  const fixes: RealCabinetFix[] = [];
  const exact = input.catalog.filter((row) => isRealNarrowCabinet(row, input.layer)
    && Math.abs(width(row) - input.gapIn) <= 0.05);
  for (const cabinet of exact) {
    fixes.push({ kind: "seat", cabinet, startIn: 0, widthIn: input.gapIn });
  }
  const slideLimit = Math.max(0, input.slideLimitIn ?? autoDesignFillerMaxIn());
  // The wiggle-room principle: if this exact opening is not a width the line sells,
  // slide a neighbor the small amount that MAKES it a sold width, then seat that
  // real cabinet. This is what turns a 7 inch gap into a 6 or 9 inch cabinet.
  if (!exact.length && slideLimit > 0) {
    const sold = input.catalog
      .filter((row) => isRealNarrowCabinet(row, input.layer))
      .map((row) => width(row))
      .filter((value) => value > 0);
    const options = Array.from(new Set(sold))
      .map((value) => ({ width: value, delta: value - input.gapIn }))
      .filter((option) => Math.abs(option.delta) <= slideLimit + COLLISION_EPSILON_IN)
      .sort((left, right) => Math.abs(left.delta) - Math.abs(right.delta));
    for (const option of options) {
      const cabinet = input.catalog.find((row) => isRealNarrowCabinet(row, input.layer)
        && Math.abs(width(row) - option.width) <= 0.05);
      if (!cabinet) continue;
      fixes.push({ kind: "slide-sliver", cabinet, deltaIn: option.delta, widthIn: option.width });
      break;
    }
  }
  // Widen a neighbor into the opening when the line sells the wider box.
  for (const neighbor of input.neighbors) {
    // A seated corner cabinet keeps its own footprint and its corner seat. Only
    // a run cabinet may grow, and only into a wider row of its own family.
    if (isPlacedCornerCabinet(neighbor)) continue;
    const targetWidth = Math.round((Number(neighbor.width) + input.gapIn) * 8) / 8;
    const family = /^([A-Z]+)/i.exec(neighbor.masterCode ?? "")?.[1]?.toUpperCase();
    const wider = family
      ? input.catalog.find((row) => row.placement === input.layer
        && new RegExp(`^${family}`, "i").test(row.masterCode ?? "")
        && Math.abs(width(row) - targetWidth) <= 0.05
        && !isCornerCabinet(row.masterCode, row.description))
      : undefined;
    if (!wider) continue;
    fixes.push({
      kind: "widen",
      neighbor,
      cabinet: wider,
      startIn: wallRunOffset(neighbor, input.wallId, input.room),
      widthIn: targetWidth,
    });
  }
  // Slide a neighbor to open a real width. A corner never slides: leaving its
  // vertex is what empties the inside corner.
  if (slideLimit > 0 && input.gapIn + slideLimit >= REAL_CABINET_MIN_WIDTH_IN) {
    for (const neighbor of input.neighbors) {
      if (isPlacedCornerCabinet(neighbor)) continue;
      fixes.push({ kind: "slide", cabinet: neighbor, deltaIn: Math.min(slideLimit, REAL_CABINET_MAX_WIDTH_IN - input.gapIn) });
    }
  }
  return fixes;
}

export type RealCabinetPassResult = {
  placed: PlacedCabinet[];
  /** Plain notes for the review list. */
  notes: string[];
  /** Openings this pass could not close with real cabinets. */
  unfilled: Array<{ wallId: string; layer: "base" | "wall"; startIn: number; widthIn: number }>;
};

/**
 * True when an opening is a sliver no real cabinet can take: narrower than the
 * narrowest box the line sells, or a width between the steps the line sells. That
 * is the ONLY case where filler is legitimate, and only because nothing else would
 * leave a bare hole in the run.
 */
export function isFillerLastResort(input: {
  gapIn: number;
  catalog: readonly DesignCabinet[];
  layer: "base" | "wall";
}): boolean {
  const widths = input.catalog
    .filter((row) => row.placement === input.layer)
    .map((row) => width(row))
    .filter((value) => value > 0);
  if (!widths.length) return input.gapIn <= autoDesignFillerMaxIn() + COLLISION_EPSILON_IN;
  const narrowest = Math.min(...widths);
  if (input.gapIn < narrowest - 0.05) return true;
  // A width the line does not sell at all is also a sliver.
  return !widths.some((value) => Math.abs(value - input.gapIn) <= 0.05);
}

/**
 * Run the shared pass on every wall and both layers. A real cabinet, a widened
 * neighbor, or a legal slide closes the opening; anything left over is reported,
 * not silently filled.
 */
export function applyRealCabinetsBeforeFiller(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  catalog: readonly DesignCabinet[];
  makeUid: () => string;
  styleId: number | null;
  /** Skip walls that are not part of this build. */
  wallIds?: readonly string[];
  /** Per-cabinet maximum legal slide. Defaults to the filler allowance. */
  slideLimitFor?: (cabinet: PlacedCabinet) => number;
}): RealCabinetPassResult {
  let working = [...input.placed];
  const notes: string[] = [];
  const unfilled: RealCabinetPassResult["unfilled"] = [];
  const walls = input.wallIds && input.wallIds.length > 0
    ? [...input.wallIds]
    : roomWallRunFrames(input.room).filter((frame) => frame.kind !== "peninsula").map((frame) => frame.id);
  for (const layer of ["base", "wall"] as const) {
    for (const wallId of walls) {
      if (!wallRunFrame(wallId, input.room)) continue;
      // One fix per opening per iteration, then recompute: a widen changes the run.
      for (let guard = 0; guard < 12; guard += 1) {
        const gaps = openRunGaps({ wallId, room: input.room, placed: working, openings: input.openings, layer });
        if (!gaps.length) break;
        const gap = gaps[0]!;
        const neighbors = working.filter((item) => item.placement === layer
          && !isFillerItem(item)
          && cabinetWall(item, input.room) === wallId
          && Math.abs(wallRunOffset(item, wallId, input.room) + wallRunSpan(item, wallId, input.room) - gap.startIn) <= 0.75
          || (item.placement === layer
            && !isFillerItem(item)
            && cabinetWall(item, input.room) === wallId
            && Math.abs(wallRunOffset(item, wallId, input.room) - (gap.startIn + gap.widthIn)) <= 0.75));
        const fixes = planRealCabinetFixes({
          gapIn: gap.widthIn,
          catalog: input.catalog,
          neighbors,
          room: input.room,
          wallId,
          layer,
          slideLimitIn: neighbors.reduce((smallest, item) => Math.min(smallest, input.slideLimitFor?.(item) ?? autoDesignFillerMaxIn()), autoDesignFillerMaxIn()),
        }).sort((left, right) => rank(left) - rank(right));
        let applied = false;
        for (const fix of fixes) {
          if (fix.kind === "seat") {
            const depth = footprintDepth(fix.cabinet);
            const spot = wallPlacementAt(gap.startIn, fix.widthIn, depth, wallId as WallSide, input.room);
            const draft: PlacedCabinet = {
              uid: input.makeUid(), cabinetId: fix.cabinet.id, masterCode: fix.cabinet.masterCode,
              description: fix.cabinet.description, category: fix.cabinet.category ?? null,
              subCategory: fix.cabinet.subCategory ?? null, placement: layer, ...spot,
              width: fix.widthIn, depth, height: dim(fix.cabinet.height, layer === "wall" ? STD.WALL_HEIGHT : STD.BASE_HEIGHT),
              numberOfDoors: fix.cabinet.numberOfDoors, numberOfDrawers: fix.cabinet.numberOfDrawers,
              catalogImageUrl: fix.cabinet.catalogImageUrl ?? null, styleId: input.styleId,
              ...(layer === "wall" ? { mountBottom: 54 } : {}),
            } as PlacedCabinet;
            const accepted = appendCollisionFreePlacements(working, [draft], input.room);
            if (accepted.rejected.length) continue;
            working = accepted.placed;
            notes.push(`${fix.cabinet.masterCode} filled a ${gap.widthIn}″ opening on ${wallId}.`);
            applied = true;
            break;
          }
          if (fix.kind === "slide-sliver") {
            // Slide the neighbor that bounds this opening by the small delta that
            // turns the opening into a width the line sells, then seat that cabinet.
            const neighbor = neighbors.find((item) => Math.abs(
              wallRunOffset(item, wallId, input.room) + wallRunSpan(item, wallId, input.room) - gap.startIn,
            ) <= 0.75 || Math.abs(wallRunOffset(item, wallId, input.room) - (gap.startIn + gap.widthIn)) <= 0.75);
            if (!neighbor) continue;
            const boundsStart = Math.abs(wallRunOffset(neighbor, wallId, input.room) - (gap.startIn + gap.widthIn)) <= 0.75;
            const start = wallRunOffset(neighbor, wallId, input.room) + (boundsStart ? fix.deltaIn : -fix.deltaIn);
            const spot = wallPlacementAt(start, Number(neighbor.width), Number(neighbor.depth), wallId as WallSide, input.room);
            const moved = { ...neighbor, ...spot } as PlacedCabinet;
            const without = working.filter((item) => item.uid !== neighbor.uid);
            const movedAccepted = appendCollisionFreePlacements(without, [moved], input.room);
            if (movedAccepted.rejected.length) continue;
            const openedGapStart = boundsStart ? gap.startIn : gap.startIn - fix.deltaIn;
            const depth = footprintDepth(fix.cabinet);
            const cabinetSpot = wallPlacementAt(openedGapStart, fix.widthIn, depth, wallId as WallSide, input.room);
            const draft: PlacedCabinet = {
              uid: input.makeUid(), cabinetId: fix.cabinet.id, masterCode: fix.cabinet.masterCode,
              description: fix.cabinet.description, category: fix.cabinet.category ?? null,
              subCategory: fix.cabinet.subCategory ?? null, placement: layer, ...cabinetSpot,
              width: fix.widthIn, depth, height: dim(fix.cabinet.height, layer === "wall" ? STD.WALL_HEIGHT : STD.BASE_HEIGHT),
              numberOfDoors: fix.cabinet.numberOfDoors, numberOfDrawers: fix.cabinet.numberOfDrawers,
              catalogImageUrl: fix.cabinet.catalogImageUrl ?? null, styleId: input.styleId,
              ...(layer === "wall" ? { mountBottom: 54 } : {}),
            } as PlacedCabinet;
            const accepted = appendCollisionFreePlacements(movedAccepted.placed, [draft], input.room);
            if (accepted.rejected.length) continue;
            working = accepted.placed;
            notes.push(`${fix.cabinet.masterCode} filled the opening on ${wallId} after a ${Math.abs(fix.deltaIn)}″ slide.`);
            applied = true;
            break;
          }
          if (fix.kind === "widen") {
            const depth = Math.max(Number(fix.neighbor.depth) || 0, footprintDepth(fix.cabinet));
            const growsTowardGap = wallRunOffset(fix.neighbor, wallId, input.room) + wallRunSpan(fix.neighbor, wallId, input.room) <= gap.startIn + 0.75;
            const start = growsTowardGap
              ? wallRunOffset(fix.neighbor, wallId, input.room)
              : wallRunOffset(fix.neighbor, wallId, input.room) - (fix.widthIn - Number(fix.neighbor.width));
            const spot = wallPlacementAt(start, fix.widthIn, depth, wallId as WallSide, input.room);
            const grown: PlacedCabinet = {
              ...fix.neighbor, cabinetId: fix.cabinet.id, masterCode: fix.cabinet.masterCode,
              description: fix.cabinet.description, ...spot, width: fix.widthIn, depth,
            } as PlacedCabinet;
            const without = working.filter((item) => item.uid !== fix.neighbor.uid);
            const accepted = appendCollisionFreePlacements(without, [grown], input.room);
            if (accepted.rejected.length) continue;
            working = accepted.placed;
            notes.push(`${fix.neighbor.masterCode} became ${fix.cabinet.masterCode} to close a ${gap.widthIn}″ opening on ${wallId}.`);
            applied = true;
            break;
          }
          if (fix.kind === "slide") {
            const start = wallRunOffset(fix.cabinet, wallId, input.room);
            const towardGap = Math.abs(start + wallRunSpan(fix.cabinet, wallId, input.room) - gap.startIn) <= 0.75;
            const nextStart = start + (towardGap ? -fix.deltaIn : fix.deltaIn);
            const spot = wallPlacementAt(nextStart, Number(fix.cabinet.width), Number(fix.cabinet.depth), wallId as WallSide, input.room);
            const moved = { ...fix.cabinet, ...spot } as PlacedCabinet;
            const without = working.filter((item) => item.uid !== fix.cabinet.uid);
            const accepted = appendCollisionFreePlacements(without, [moved], input.room);
            if (accepted.rejected.length) continue;
            working = accepted.placed;
            notes.push(`${fix.cabinet.masterCode} slid ${fix.deltaIn}″ to open a real cabinet on ${wallId}.`);
            applied = true;
            break;
          }
        }
        if (!applied) {
          unfilled.push({ wallId, layer, startIn: gap.startIn, widthIn: gap.widthIn });
          break;
        }
      }
    }
  }
  return { placed: working, notes, unfilled };
}

function rank(fix: RealCabinetFix): number {
  if (fix.kind === "seat") return 0;
  if (fix.kind === "slide-sliver") return 1;
  if (fix.kind === "widen") return 2;
  return 3;
}
