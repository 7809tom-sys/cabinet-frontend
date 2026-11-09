/**
 * Drop-in cooktop bases (`RB2DB*`, `RB3DB*`) belong under a cooktop and nowhere
 * else.
 *
 * Issue #354 items 2 and 5 (Tom, Nov 9 2026): the reported plan had an
 * `RB3DB24` sitting between the dishwasher and a freestanding range, where a
 * plain 24" base belongs. A range base is a drawer box with a false front whose
 * top is opened for a drop-in cooktop; with no cooktop above it the top is a
 * hole, and beside a freestanding range the cooking surface is the range, not
 * this box.
 *
 * Rules enforced here, in one place so Auto-Design, manual placement and the
 * saved-plan restore pass cannot drift apart:
 *
 * 1. Auto-Design and every default pick use a standard base of the same width.
 *    `autoDesignBaseRows` is the straight-base pool every auto pass reads, and
 *    it drops the RB family outright; `standardBaseForRangeBase` is the
 *    same-width substitute for a plan that already carries one.
 * 2. A range base is only legal with a cooktop over it. `rangeBaseCooktopFor`
 *    finds that cooktop (the frameless conversion seats a
 *    `countertop-opening` appliance on the base's own uid), and
 *    `rangeBaseNeedsCooktopPrompt` is what a manual selection asks before the
 *    box is committed.
 * 3. A saved plan that has one without a cooktop is repaired to the standard
 *    base of the same width, so the drawing, cart, quote and order all show the
 *    cabinet that is really installed.
 *
 * The RB codes themselves are never deleted, renamed, or aliased: the
 * distributor still receives `RB3DB24` when a range base really is under a
 * cooktop.
 */
import {
  COLLISION_EPSILON_IN,
  cabinetWall,
  dim,
  isRangeOrOven,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { cabinetDrawingType } from "./cabinetGraphics";
import { isRangeBaseCabinetCode, rangeBaseNominalWidth } from "./designerCabinetNames";

const PANEL_OR_FILLER_TEXT = /filler|panel|skin|moulding|molding|crown|valance|sample|touch.?up/i;

/**
 * A straight, two-door (or one-door, at 21" and under) standard base row of
 * the selected line — the box Auto-Design is allowed to stand in a run.
 */
export function isStandardStraightBaseRow(row: DesignCabinet): boolean {
  if (row.placement !== "base") return false;
  if (row.isCornerCabinet === true) return false;
  if (isRangeBaseCabinetCode(row.masterCode)) return false;
  if (!(dim(row.width, 0) > 0) || !(dim(row.depth, 0) > 0)) return false;
  if (PANEL_OR_FILLER_TEXT.test(`${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""}`)) return false;
  return cabinetDrawingType(row) === "standard-door";
}

/**
 * The straight-base pool Auto-Design tiles a run from. A drop-in cooktop base
 * is never in it, whatever a catalog row's sub-category says, so Auto-Design
 * can never seat one beside a range or anywhere else without a cooktop.
 */
export function autoDesignBaseRows<T extends DesignCabinet>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isRangeBaseCabinetCode(row.masterCode));
}

/**
 * The standard base of the same nominal width that stands in for a range base.
 * The code's own width wins over a stale `width` field, exactly as the door
 * reference does. Null when the line sells no plain base at that width, so the
 * caller reports it instead of inventing a box.
 */
export function standardBaseForRangeBase<T extends DesignCabinet>(
  rangeBase: { masterCode?: string | null; width?: number | string | null },
  catalog: readonly T[],
): T | null {
  const width = rangeBaseNominalWidth(rangeBase.masterCode) ?? Number(rangeBase.width) ?? 0;
  if (!(width > 0)) return null;
  return catalog.find((row) => isStandardStraightBaseRow(row)
    && Math.abs(dim(row.width, 0) - width) <= COLLISION_EPSILON_IN) ?? null;
}

/**
 * The same-width plain base as a `PlacedCabinet` record, or null when the line
 * sells none. Position, size and finish come from the row; the record keeps the
 * uid it replaced so history, selection and 3D focus stay put.
 */
export function standardBasePlacementForRangeBase(input: {
  rangeBase: PlacedCabinet;
  catalog: readonly DesignCabinet[];
}): PlacedCabinet | null {
  const row = standardBaseForRangeBase(input.rangeBase, input.catalog);
  if (!row) return null;
  const width = dim(row.width, Number(input.rangeBase.width) || 0);
  return {
    ...input.rangeBase,
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description ?? input.rangeBase.description,
    category: row.category ?? input.rangeBase.category,
    subCategory: row.subCategory ?? input.rangeBase.subCategory,
    width,
    height: dim(row.height, Number(input.rangeBase.height) || 0),
    depth: dim(row.depth, Number(input.rangeBase.depth) || 0),
    numberOfDoors: row.numberOfDoors ?? input.rangeBase.numberOfDoors,
    numberOfDrawers: row.numberOfDrawers ?? input.rangeBase.numberOfDrawers,
    catalogImageUrl: row.catalogImageUrl ?? input.rangeBase.catalogImageUrl ?? null,
  };
}

function overlapsOnRunAxis(a: PlacedCabinet, b: PlacedCabinet, room: RoomData): boolean {
  const wall = cabinetWall(a, room);
  if (!wall || cabinetWall(b, room) !== wall) return false;
  const aStart = wallRunOffset(a, wall, room);
  const aEnd = aStart + wallRunSpan(a, wall, room);
  const bStart = wallRunOffset(b, wall, room);
  const bEnd = bStart + wallRunSpan(b, wall, room);
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > COLLISION_EPSILON_IN;
}

/**
 * The cooktop over one range base, or null.
 *
 * A frameless conversion seats the cooktop as a `countertop-opening` appliance
 * on the base's own uid (`<baseUid>:cooktop`), so that link is the exact one.
 * A cooktop a customer added through Surfaces & Fixtures is matched by the bay
 * it covers on the same wall. A freestanding range is a different product and
 * never counts.
 */
export function rangeBaseCooktopFor(
  rangeBase: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): PlacedCabinet | null {
  const own = placed.find((item) => item.uid === `${rangeBase.uid}:cooktop`
    && item.placement === "appliance"
    && item.applianceRole === "countertop-opening");
  if (own) return own;
  return placed.find((item) => item.placement === "appliance"
    && item.applianceRole === "countertop-opening"
    && !isRangeOrOven(item.masterCode, null)
    && overlapsOnRunAxis(rangeBase, item, room)) ?? null;
}

/** True when the range base really has a drop-in cooktop on its top. */
export function rangeBaseHasCooktop(
  rangeBase: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): boolean {
  return rangeBaseCooktopFor(rangeBase, placed, room) != null;
}

/**
 * A range base a customer just picked needs a cooktop confirmed for its top
 * before the box is committed. Returns the width so the prompt can name the
 * cooktop that has to go on it, or null for any other cabinet.
 */
export function rangeBaseCooktopPromptWidth(masterCode: string | null | undefined): number | null {
  return isRangeBaseCabinetCode(masterCode) ? rangeBaseNominalWidth(masterCode) : null;
}

export type RangeBaseRepair = {
  placed: PlacedCabinet[];
  replacements: Array<{ uid: string; from: string; to: string | null }>;
};

/**
 * Save/restore repair: every range base with no cooktop over it becomes the
 * standard base of the same width. A width the line cannot supply is reported
 * and left alone rather than deleted, so nothing silently disappears from a
 * cart or an order.
 */
export function repairRangeBasesWithoutCooktop(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalog: readonly DesignCabinet[];
}): RangeBaseRepair {
  const replacements: RangeBaseRepair["replacements"] = [];
  let changed = false;
  const placed = input.placed.map((item) => {
    if (item.placement !== "base") return item;
    if (!isRangeBaseCabinetCode(item.masterCode)) return item;
    if (rangeBaseHasCooktop(item, input.placed, input.room)) return item;
    const replacement = standardBasePlacementForRangeBase({ rangeBase: item, catalog: input.catalog });
    changed = true;
    replacements.push({ uid: item.uid, from: item.masterCode, to: replacement?.masterCode ?? null });
    return replacement ?? item;
  });
  return { placed: changed ? placed : (input.placed as PlacedCabinet[]), replacements };
}
