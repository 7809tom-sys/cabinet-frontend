/**
 * One decision table for what may be placed on a RANGE BASE, and what that
 * placement bills.
 *
 * Tom (Nov 9 2026, issue #354): **a range base is the cabinet you put a RANGE TOP
 * on, exactly the way a sink base is the cabinet you put a sink on.** Selecting a
 * range base must therefore show the catalog's range tops as the things to put on
 * it — the same flow a sink base uses to show sink basins, not a "confirm a
 * range-top" prompt about a different product.
 *
 * This module is the range-base counterpart of `sinkBaseSelection.ts`:
 *
 *   - `rangeTopRowsForBase`     the range tops the picker may show for this base
 *   - `rangeTopRowFitsBase`     whether one row may go on one base
 *   - `placeRangeTopOnBase`     seats it in the base's countertop, like a sink
 *   - `RANGE_BASE_CONFIG_OPTIONS` the option set the side panel offers
 *
 * What it deliberately does NOT do: bill the range top. Per the existing owner
 * rule (`rangeTopDisplayOnly.ts`) the eight catalog range tops are drawn in the
 * designer but never become a cart, quote, or order line. The cabinet under the
 * range top keeps its own identity and remains billable.
 *
 * A freestanding or slide-in range is a different product entirely. It is not a
 * range top and can never be seated in a range base's countertop.
 */
import {
  STD,
  bearsCountertop,
  isRangeOrOven,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import {
  RANGE_TOP_CATALOG_CATEGORY,
  isRangeTopCatalogCategory,
  isRangeTopItemCode,
  isRangeTopPlacement,
  isRangeTopProductId,
} from "./rangeTopDisplayOnly";
import { isRangeBaseCabinetCode, rangeBaseNominalWidth } from "./designerCabinetNames";

/** A catalog row the range-top picker may place on a range base. */
export type RangeBaseTopRow = {
  id: number;
  /** The Stone Creek item code (`SC-RT-…`); the picker matches on this. */
  pelicanCode?: string | null;
  name: string;
  category?: string | null;
  subCategory?: string | null;
  /** Published overall size text, e.g. `30"`. */
  size?: string | null;
  imageUrl?: string | null;
  sellPrice?: number | null;
  slug?: string | null;
};

export type RangeBaseIdentity = Pick<PlacedCabinet, "masterCode" | "description" | "subCategory" | "category"> & {
  placement?: string | null;
  width?: number | string | null;
  depth?: number | string | null;
};

/** The nominal width a range base accepts a range top at. */
export function rangeBaseTopWidthIn(base: RangeBaseIdentity | null | undefined): number | null {
  if (!base) return null;
  return rangeBaseNominalWidth(base.masterCode) ?? (Number(base.width) > 0 ? Number(base.width) : null);
}

/**
 * Width of a range-top row from its published size text (`30"`, `36 in`, `36`).
 * Null when the row publishes nothing usable, so the caller can show it under a
 * "check the size" note instead of silently dropping a real product.
 */
export function rangeTopRowWidthIn(row: { size?: string | null; name?: string | null }): number | null {
  const source = `${row.size ?? ""} ${row.name ?? ""}`;
  const match = /(\d{2})(?:\s*(?:"|''|in\b|inch))?/i.exec(source);
  if (!match) return null;
  const width = Number(match[1]);
  return Number.isFinite(width) && width > 0 ? width : null;
}

/** True for a catalog row that really is one of the range tops. */
export function isRangeTopRow(row: RangeBaseTopRow): boolean {
  return isRangeTopCatalogCategory(row.category)
    || isRangeTopItemCode(row.pelicanCode)
    || isRangeTopProductId(row.id);
}

/**
 * True when this range-top row may be placed on this range base: the row must be
 * a real range top, and a row that publishes a width must fit the base within
 * the standard 3" step. A row with no published width is still offered, because
 * the catalog owns the size and hiding a product is worse than asking.
 */
export function rangeTopRowFitsBase(row: RangeBaseTopRow, base: RangeBaseIdentity | null | undefined): boolean {
  if (!isRangeTopRow(row)) return false;
  const baseWidth = rangeBaseTopWidthIn(base);
  if (baseWidth == null) return false;
  const rowWidth = rangeTopRowWidthIn(row);
  if (rowWidth == null) return true;
  return Math.abs(rowWidth - baseWidth) <= 3.01;
}

/** The rows the range-top picker may show for this base, in the order given. */
export function rangeTopRowsForBase<T extends RangeBaseTopRow>(
  rows: readonly T[],
  base: RangeBaseIdentity | null | undefined,
): T[] {
  if (!base) return [];
  return rows.filter((row) => rangeTopRowFitsBase(row, base));
}

/** The label a disabled range-top row carries, or null when it is selectable. */
export function rangeTopRowDisabledReason(row: RangeBaseTopRow, base: RangeBaseIdentity | null | undefined): string | null {
  if (!isRangeTopRow(row)) return `${row.name} is not a range top.`;
  const baseWidth = rangeBaseTopWidthIn(base);
  if (baseWidth == null) return "This cabinet is not a range base.";
  const rowWidth = rangeTopRowWidthIn(row);
  if (rowWidth == null) return null;
  return Math.abs(rowWidth - baseWidth) <= 3.01
    ? null
    : `${rowWidth}″ ${row.name} does not fit this ${baseWidth}″ range base.`;
}

/** The option set a placed range base exposes — the same surface a sink base has. */
export const RANGE_BASE_CONFIG_OPTIONS = [
  "select",
  "move",
  "rotate",
  "attributes",
  "range-top",
  "door-finish",
  "delete",
] as const;

export type RangeBaseConfigOption = (typeof RANGE_BASE_CONFIG_OPTIONS)[number];

export type RangeBaseConfig = {
  selectable: boolean;
  /** The width the picker offers range tops at. */
  topWidthIn: number | null;
  options: RangeBaseConfigOption[];
};

/** The configuration surface of a placed range base. */
export function rangeBaseConfig(base: RangeBaseIdentity | null | undefined): RangeBaseConfig {
  const isRangeBase = Boolean(base && isRangeBaseCabinetCode(base.masterCode));
  return {
    selectable: isRangeBase,
    topWidthIn: isRangeBase ? rangeBaseTopWidthIn(base) : null,
    options: isRangeBase ? [...RANGE_BASE_CONFIG_OPTIONS] : [],
  };
}

/** The placement record for one range top on one base, or null. */
export function rangeTopOnBase(base: PlacedCabinet, placed: readonly PlacedCabinet[]): PlacedCabinet | null {
  return placed.find((item) => item.uid === `${base.uid}:cooktop` && isRangeTopPlacement(item))
    ?? placed.find((item) => item.applianceRole === "countertop-opening"
      && item.placement === "appliance"
      && isRangeTopPlacement(item)
      && Math.abs(Number(item.width) - Number(base.width)) <= 0.01
      && item.wallId === base.wallId)
    ?? null;
}

export type RangeTopPlacementResult =
  | {
    ok: true;
    top: PlacedCabinet;
    /** Always false: range tops are display-only and never billed. */
    billable: false;
    /** The plan with any earlier top for this base replaced by the chosen one. */
    placed: PlacedCabinet[];
  }
  | { ok: false; reason: string };

/**
 * Seats one range top in the base's countertop, the way a sink is seated in a
 * sink base: the thin appliance body sits ON the base (`countertop-opening`), its
 * top meeting the finished 36" countertop line, centered in the base.
 *
 * The range top is display-only and never billable; the base keeps its own line.
 */
export function placeRangeTopOnBase(input: {
  base: PlacedCabinet | null | undefined;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  row: RangeBaseTopRow | null;
}): RangeTopPlacementResult {
  const { base, placed, row } = input;
  if (!base || base.placement !== "base") return { ok: false, reason: "Select a range base first." };
  if (!isRangeBaseCabinetCode(base.masterCode)) {
    return { ok: false, reason: `${base.masterCode} is not a range base. A range top goes on a range base, the way a sink goes in a sink base.` };
  }
  // A range base is by definition a counter-bearing box whose top is opened for
  // the range top — the same relationship a sink base has to its basin. It is not
  // a freestanding range, even though its name contains the word "range".
  if (!isRangeBaseCabinetCode(base.masterCode) || !bearsCountertop(base)) {
    return { ok: false, reason: `${base.masterCode} has no countertop, so a range top cannot sit in it.` };
  }
  if (!row) return { ok: false, reason: "Choose a range top for this range base." };
  if (!isRangeTopRow(row)) {
    return { ok: false, reason: `${row.name} is not a range top. A range base holds a range top, never a freestanding range.` };
  }
  const disabled = rangeTopRowDisabledReason(row, base);
  if (disabled) return { ok: false, reason: disabled };

  const width = Number(base.width) > 0 ? Number(base.width) : rangeBaseTopWidthIn(base) ?? 0;
  const depth = Number(base.depth) > 0 ? Number(base.depth) : STD.BASE_DEPTH;
  const top: PlacedCabinet = {
    uid: `${base.uid}:cooktop`,
    cabinetId: 0,
    masterCode: row.pelicanCode ?? `CATALOG-APPLIANCE-${row.id}`,
    description: row.name,
    category: "Appliance",
    subCategory: "Range Top",
    placement: "appliance",
    applianceRole: "countertop-opening",
    applianceProductId: row.id,
    applianceCatalogCode: row.pelicanCode ?? `CATALOG-APPLIANCE-${row.id}`,
    applianceCatalogName: row.name,
    // Display only, never billed (rangeTopDisplayOnly.ts).
    applianceCatalogPrice: null,
    x: base.x,
    y: base.y,
    rotation: base.rotation,
    wallId: base.wallId,
    wallOffset: base.wallOffset,
    peninsulaSide: base.peninsulaSide,
    islandFace: base.islandFace,
    width,
    depth,
    height: STD.COUNTERTOP_THICKNESS,
    mountBottom: STD.COUNTERTOP_HEIGHT - STD.COUNTERTOP_THICKNESS,
    rangeTopImageUrl: row.imageUrl ?? null,
  };
  const others = placed.filter((item) => item.uid !== top.uid && item.uid !== `${base.uid}:cooktop`);
  return {
    ok: true,
    top,
    billable: false,
    /** The plan with the previous top for this base removed and the chosen one seated. */
    placed: [...others, top],
  };
}

/** True when a placed item is a freestanding / slide-in range with an oven, not a range top. */
export function isFreestandingRangeUnit(item: PlacedCabinet): boolean {
  if (item.placement !== "appliance") return false;
  if (item.applianceRole === "countertop-opening") return false;
  return isRangeOrOven(item.masterCode, item.description);
}

/** The catalog heading the picker reads. Exported so the dialog and tests agree. */
export const RANGE_BASE_TOP_CATALOG_CATEGORY = RANGE_TOP_CATALOG_CATEGORY;
