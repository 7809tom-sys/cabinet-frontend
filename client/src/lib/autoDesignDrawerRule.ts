import {
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  footprintDepth,
  isPlainBaseCode,
  isRangeOrOven,
  standardHeight,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import { isThreeDrawerBaseCatalog, pickDoorDrawerSplit } from "./kitchenUsage";

/**
 * Every Auto-Design layout has at least one three-drawer base (Tom, Oct 31). The base planner already splits a wide
 * door base beside the range into door + drawer. This pass is the safety net for what is left: when no drawer base got
 * placed anywhere, convert the best-fitting straight door base into a door base plus a three-drawer base of the same
 * total width, using only widths the selected line sells. If the line sells no three-drawer base, or nothing fits, the
 * layout is returned unchanged with a warning (never a failure).
 */
export type EnsureDrawerBaseResult = {
  placed: PlacedCabinet[];
  /** The layout now has at least one drawer base. */
  hasDrawerBase: boolean;
  /** A convertible base was replaced by door + drawer. */
  converted: boolean;
  note: string | null;
  warning: string | null;
};

function isPlacedDrawerBase(item: PlacedCabinet): boolean {
  if (item.placement !== "base") return false;
  return isThreeDrawerBaseCatalog({
    masterCode: item.masterCode, description: item.description, subCategory: item.subCategory, category: item.category,
    width: item.width, placement: item.placement, numberOfDoors: item.numberOfDoors, numberOfDrawers: item.numberOfDrawers,
  });
}

function isConvertibleDoorBase(item: PlacedCabinet): boolean {
  if (item.placement !== "base") return false;
  if (!isPlainBaseCode(item.masterCode) || !/^B-?\d+$/i.test(item.masterCode)) return false;
  if ((item.numberOfDoors ?? 0) <= 0) return false;
  return !/sink|corner|blind|trash|spice|tray|diagonal|lazy/i.test(`${item.description ?? ""} ${item.subCategory ?? ""}`);
}

export function ensureDrawerBase(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** Straight base catalog of the selected line (already limited to what the line sells and has in stock). */
  catalog: readonly DesignCabinet[];
  makeUid: () => string;
  styleId: number | null;
}): EnsureDrawerBaseResult {
  const placed = [...input.placed];
  const unchanged = (hasDrawerBase: boolean, warning: string | null): EnsureDrawerBaseResult => ({ placed, hasDrawerBase, converted: false, note: null, warning });
  if (placed.some(isPlacedDrawerBase)) return unchanged(true, null);
  if (!input.catalog.some(isThreeDrawerBaseCatalog)) {
    return unchanged(false, "This line has no three-drawer base, so the layout has no drawer base. Add drawers by hand if you want them.");
  }

  const ranges = placed.filter((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description));
  const sinks = placed.filter((item) => /sink/i.test(`${item.masterCode} ${item.description ?? ""}`) && item.placement === "base");
  type Candidate = { item: PlacedCabinet; wall: WallSide; start: number; end: number; pair: { door: DesignCabinet; drawer: DesignCabinet }; score: number; rangeSide: "start" | "end" | null };
  const candidates: Candidate[] = [];
  for (const item of placed) {
    if (!isConvertibleDoorBase(item)) continue;
    const pair = pickDoorDrawerSplit(item.width, input.catalog);
    if (!pair) continue;
    const wall = cabinetWall(item, input.room) as WallSide;
    const start = wallRunOffset(item, wall, input.room);
    const end = start + wallRunSpan(item, wall, input.room);
    const touching = (other: PlacedCabinet) => {
      if (cabinetWall(other, input.room) !== wall) return null;
      const oStart = wallRunOffset(other, wall, input.room);
      const oEnd = oStart + wallRunSpan(other, wall, input.room);
      if (Math.abs(oEnd - start) <= 0.1) return "start" as const;
      if (Math.abs(oStart - end) <= 0.1) return "end" as const;
      return null;
    };
    let rangeSide: "start" | "end" | null = null;
    for (const range of ranges) rangeSide = rangeSide ?? touching(range);
    const nearSink = sinks.some((sink) => touching(sink) != null);
    // near the range first, then the prep area beside the sink, then the widest door base
    const score = (rangeSide ? 1000 : 0) + (nearSink ? 500 : 0) + item.width;
    candidates.push({ item, wall, start, end, pair, score, rangeSide });
  }
  if (candidates.length === 0) {
    return unchanged(false, "Auto-Design could not fit a three-drawer base into this layout from the cabinets this line sells. Add one by hand if you want it.");
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const best of candidates) {
    const { item, wall, start, pair, rangeSide } = best;
    const order = rangeSide === "start" ? [pair.drawer, pair.door] : [pair.door, pair.drawer]; // drawer nearest the range
    const others = placed.filter((entry) => entry.uid !== item.uid);
    let trial = others;
    let cursor = start;
    const pieces: PlacedCabinet[] = [];
    let ok = true;
    for (const source of order) {
      const width = dim(source.width, 0);
      const depth = footprintDepth(source);
      const spot = wallPlacementAt(cursor, width, depth, wall, input.room);
      if (!spot) { ok = false; break; }
      const piece: PlacedCabinet = {
        uid: input.makeUid(), cabinetId: source.id, masterCode: source.masterCode, description: source.description,
        category: source.category, subCategory: source.subCategory, placement: "base", ...spot, width, depth,
        height: dim(source.height, standardHeight("base")), catalogImageUrl: source.catalogImageUrl ?? null,
        numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers, styleId: input.styleId,
      };
      const accepted = appendCollisionFreePlacements(trial, [piece], input.room);
      if (accepted.rejected.length > 0) { ok = false; break; }
      trial = accepted.placed;
      pieces.push(piece);
      cursor += width;
    }
    if (!ok) continue;
    return {
      placed: trial,
      hasDrawerBase: true,
      converted: true,
      note: `Drawer base added: ${item.masterCode} became ${order.map((source) => source.masterCode).join(" + ")} (same ${item.width}" run).`,
      warning: null,
    };
  }
  return unchanged(false, "Auto-Design could not fit a three-drawer base into this layout without moving other cabinets. Add one by hand if you want it.");
}

/** Read an explicit price if the catalog row carries one. A missing field is not treated as "unpriced" — Auto-Design pools are already the line's source-priced stock. A present null/NaN/non-positive value is unpriced and must not be used. Never invent a price. */
export function explicitCatalogPrice(item: DesignCabinet): number | null | undefined {
  const raw = item as DesignCabinet & {
    unitPrice?: number | null;
    sellPrice?: number | null;
    price?: number | null;
    listPrice?: number | null;
  };
  const keys = ["unitPrice", "sellPrice", "price", "listPrice", "applianceCatalogPrice"] as const;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = raw[key];
    if (value == null) return null;
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }
  return undefined;
}

/** True when the row is a real catalog SKU that can be placed. Rejects inventing a SKU or using an explicitly unpriced row. */
export function isPricedCatalogSku(item: DesignCabinet): boolean {
  if (!item.masterCode?.trim()) return false;
  if (item.id == null || (typeof item.id === "number" && !Number.isFinite(item.id))) return false;
  const price = explicitCatalogPrice(item);
  if (price === undefined) return true;
  return price != null && price > 0;
}

export const BUDGET_FRIENDLY_DRAWER_BASE_MISSING_WARNING =
  "Budget friendly: no priced drawer-base SKU from this line would fit, so the layout has no drawer base.";

/**
 * Budget-friendly path only: if the layout has no drawer base, swap one standard door base
 * for a same-width three-drawer SKU the line already sells and prices. Does not invent SKUs
 * or prices, and does not move other cabinets.
 */
export function swapSameWidthDrawerBase(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalog: readonly DesignCabinet[];
  makeUid: () => string;
  styleId: number | null;
}): EnsureDrawerBaseResult {
  const placed = [...input.placed];
  const unchanged = (hasDrawerBase: boolean, warning: string | null): EnsureDrawerBaseResult => ({ placed, hasDrawerBase, converted: false, note: null, warning });
  if (placed.some(isPlacedDrawerBase)) return unchanged(true, null);
  const drawers = input.catalog.filter((row) => isThreeDrawerBaseCatalog(row) && isPricedCatalogSku(row));
  if (drawers.length === 0) {
    return unchanged(false, BUDGET_FRIENDLY_DRAWER_BASE_MISSING_WARNING);
  }

  const ranges = placed.filter((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description));
  const sinks = placed.filter((item) => /sink/i.test(`${item.masterCode} ${item.description ?? ""}`) && item.placement === "base");
  type Candidate = { item: PlacedCabinet; wall: WallSide; start: number; drawer: DesignCabinet; score: number };
  const candidates: Candidate[] = [];
  for (const item of placed) {
    if (!isConvertibleDoorBase(item)) continue;
    const drawer = drawers.find((row) => Math.abs(dim(row.width, 0) - item.width) <= 0.05);
    if (!drawer) continue;
    const wall = cabinetWall(item, input.room) as WallSide;
    const start = wallRunOffset(item, wall, input.room);
    const end = start + wallRunSpan(item, wall, input.room);
    const touching = (other: PlacedCabinet) => {
      if (cabinetWall(other, input.room) !== wall) return null;
      const oStart = wallRunOffset(other, wall, input.room);
      const oEnd = oStart + wallRunSpan(other, wall, input.room);
      if (Math.abs(oEnd - start) <= 0.1) return "start" as const;
      if (Math.abs(oStart - end) <= 0.1) return "end" as const;
      return null;
    };
    const nearRange = ranges.some((range) => touching(range) != null);
    const nearSink = sinks.some((sink) => touching(sink) != null);
    const score = (nearRange ? 1000 : 0) + (nearSink ? 500 : 0) + item.width;
    candidates.push({ item, wall, start, drawer, score });
  }
  if (candidates.length === 0) {
    return unchanged(false, BUDGET_FRIENDLY_DRAWER_BASE_MISSING_WARNING);
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const best of candidates) {
    const { item, wall, start, drawer } = best;
    const width = dim(drawer.width, item.width);
    const depth = footprintDepth(drawer);
    const spot = wallPlacementAt(start, width, depth, wall, input.room);
    if (!spot) continue;
    const piece: PlacedCabinet = {
      ...item,
      uid: input.makeUid(),
      cabinetId: drawer.id,
      masterCode: drawer.masterCode,
      description: drawer.description,
      category: drawer.category,
      subCategory: drawer.subCategory,
      placement: "base",
      ...spot,
      width,
      depth,
      height: dim(drawer.height, standardHeight("base")),
      catalogImageUrl: drawer.catalogImageUrl ?? item.catalogImageUrl ?? null,
      numberOfDoors: drawer.numberOfDoors,
      numberOfDrawers: drawer.numberOfDrawers,
      styleId: input.styleId,
    };
    const others = placed.filter((entry) => entry.uid !== item.uid);
    const accepted = appendCollisionFreePlacements(others, [piece], input.room);
    if (accepted.rejected.length > 0) continue;
    return {
      placed: accepted.placed,
      hasDrawerBase: true,
      converted: true,
      note: `Budget friendly: ${item.masterCode} was swapped for the same-width drawer base ${drawer.masterCode}.`,
      warning: null,
    };
  }
  return unchanged(false, BUDGET_FRIENDLY_DRAWER_BASE_MISSING_WARNING);
}

/** Budget-friendly safety net: same-width priced swap first, then the existing door+drawer convert. Warns only when both fail. */
export function ensureBudgetFriendlyDrawerBase(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalog: readonly DesignCabinet[];
  makeUid: () => string;
  styleId: number | null;
}): EnsureDrawerBaseResult {
  const swapped = swapSameWidthDrawerBase(input);
  if (swapped.hasDrawerBase) return swapped;
  const split = ensureDrawerBase({ ...input, placed: swapped.placed });
  if (split.hasDrawerBase) return split;
  return { ...split, warning: BUDGET_FRIENDLY_DRAWER_BASE_MISSING_WARNING };
}

