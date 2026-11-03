/**
 * One row of the Pelican cabinet-box coverage audit: which boxes the catalog
 * sells, and whether each one can actually be built today.
 *
 * "Available" means two things, and neither is a guess:
 *   1. the box is offered in the auto builder / auto-designer (the measured
 *      Auto-Design build can place it, either as a run piece, a measured
 *      anchor, a corner, or — for a tall oven/pantry — through the tall
 *      pop-up), and
 *   2. the box renders in the 3D Designer, which builds every box from its
 *      width, height, and depth plus the catalog drawing rules.
 *
 * Accessories are not boxes. Roll-out trays, valances, moldings, panels, and
 * fillers are add-on accessory lines: they can be dropped on the plan as
 * accessories, but they are never auto-built as cabinet boxes and never appear
 * in the 3D Designer as a cabinet box. They are listed separately with that
 * reason, so nobody mistakes a missing box for a missing tray.
 */
import { cabinetDrawingType } from "./cabinetGraphics";
import { isDesignerAccessoryItem, isDesignerPlaceableAccessory, positiveDesignerMeasure } from "@shared/designerEligibility";
import {
  isCornerCabinet,
  isFarmSinkBasePaletteItem,
  isFillerItem,
  isPanelItem,
  isSinkBaseCabinet,
  type DesignCabinet,
} from "./design";

export type BoxCoverageStatus = "available" | "missing" | "accessory";

export type BoxCoverageRow = {
  style: string;
  masterCode: string;
  description: string;
  category: string;
  subCategory: string;
  placement: string;
  widthIn: number | null;
  heightIn: number | null;
  depthIn: number | null;
  status: BoxCoverageStatus;
  /** True when the auto builder / auto-designer can place this box. */
  autoBuilder: boolean;
  /** True when the 3D Designer can draw this box. */
  threeDDesigner: boolean;
  /** Where the auto-designer places it, when it can. */
  autoBuilderPath: string | null;
  /** Plain reason a box or accessory is not available in the designer. */
  reason: string | null;
};

function numeric(value: string | null | undefined): number | null {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizedCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Same specialty-upper exclusion the wall-run planner applies. */
const NOT_A_STRAIGHT_UPPER = /glass|open shelf|plate rack|wine|microwave|refrigerator|hood|garage|stacker/i;

/** Sample, display, and temporary checkout test rows are never real catalog boxes. */
export function isNonSellableTestRow(row: DesignCabinet): boolean {
  const text = `${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""}`;
  return /\btest[-_ ]?only\b|\btest item\b|checkout test|\bsample\b|\bdisplay\b|\bkiosk\b/i.test(text)
    || /^TEST[-_]/i.test((row.masterCode ?? "").trim());
}

/** A tall oven/pantry tower, the family the tall pop-up auto-places. */
export function isTallOvenPantryBox(row: DesignCabinet): boolean {
  if (row.placement !== "tall") return false;
  const drawingType = cabinetDrawingType(row);
  if (drawingType === "oven-tall") return true;
  const code = normalizedCode(row.masterCode);
  const text = `${row.description ?? ""} ${row.subCategory ?? ""}`.toLowerCase();
  return /^(?:UOC|TOS|TOD|O3\d)/.test(code) || /\boven\b|\bpantry\b/.test(text);
}

/** A plain pantry / utility tall box with no oven opening. */
export function isPlainTallBox(row: DesignCabinet): boolean {
  return row.placement === "tall" && !isTallOvenPantryBox(row) && !isPanelItem(row);
}

/**
 * Which path the auto builder uses for a box, or null when it cannot place it.
 *
 * The measured build seats: the sink base (measured anchor), the range,
 * dishwasher, and refrigerator appliances, the corner boxes (diagonal, lazy
 * Susan, blind, pulled blind), the straight base runs and three-drawer bases,
 * the wall cabinets, and — when picked in the tall pop-up — the tall oven and
 * pantry boxes. Vanity boxes belong to the bathroom workflow, which the
 * kitchen auto build does not run.
 */
export function autoBuilderPath(row: DesignCabinet): string | null {
  const text = `${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""} ${row.category ?? ""}`.toLowerCase();
  // Vanity boxes belong to the bathroom vanity workflow, not the kitchen build,
  // so they are decided before the accessory split: a vanity sink base is a real
  // box, it is simply not the auto builder's box.
  if (/\bvanity\b/.test(`${row.category ?? ""} ${row.subCategory ?? ""} ${row.description ?? ""}`.toLowerCase())
    || /^v(sd|s|db|d|dd|db)?[-_ ]?\d/i.test(row.masterCode ?? "")) {
    return null;
  }
  if (isDesignerAccessoryItem(row)) return null;
  const code = normalizedCode(row.masterCode);
  void code;
  if (row.placement === "tall") {
    if (isPanelItem(row)) return null;
    if (isTallOvenPantryBox(row)) return "tall pop-up (oven pantry / oven tower)";
    if (isPlainTallBox(row)) return "tall pop-up (pantry / utility)";
    return null;
  }
  if (row.placement === "wall") {
    if (isPanelItem(row) || isFillerItem(row)) return null;
    if (/glass/.test(text)) return "wall run (glass-front choice)";
    if (/corner/.test(row.subCategory ?? "")) return "corner slot (diagonal, lazy Susan, or blind)";
    if (NOT_A_STRAIGHT_UPPER.test(`${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""}`)) {
      return "wall run as a specialty upper";
    }
    return "wall run above the lower runs";
  }
  if (row.placement !== "base") return null;
  if (isSinkBaseCabinet(row)) {
    return isFarmSinkBasePaletteItem(row)
      ? "measured sink anchor (farmhouse base, or paired from an apron-front sink)"
      : "measured sink anchor";
  }
  if (isCornerCabinet(row.masterCode, row.description, (row as { cornerType?: string | null }).cornerType ?? null)) {
    return "corner slot (diagonal, lazy Susan, or blind)";
  }
  if (/microwave|\bmw\b/i.test(text)) return "over-range microwave companions";
  if (/ada/.test(text)) return "regular base run (ADA height is not selected automatically)";
  return "regular base run";
}

/** Why a box is not available, in the owner's terms. */
export function boxMissingReason(row: DesignCabinet): string {
  if (!positiveDesignerMeasure(row.width) || !positiveDesignerMeasure(row.height) || !positiveDesignerMeasure(row.depth)) {
    return "Missing a width, height, or depth, so the Designer has no box to build or draw.";
  }
  const text = `${row.category ?? ""} ${row.subCategory ?? ""} ${row.description ?? ""}`.toLowerCase();
  if (/\bvanity\b/.test(text)) {
    return "Vanity box: it places and renders in the 3D Designer, but the auto builder is the kitchen build and does not run the bathroom vanity workflow.";
  }
  if (row.placement === "tall") {
    return "Tall box: it draws in the 3D Designer but has no auto-builder path outside the tall pop-up.";
  }
  if (row.placement === "wall") {
    return "Wall box that the wall-run planner cannot tile (non-standard face, glass add-on, or specialty upper).";
  }
  return "The auto builder has no path for this placement.";
}

/** Why an accessory is not a box. */
export function accessoryReason(row: DesignCabinet): string {
  const text = `${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""}`.toLowerCase();
  if (/valance/.test(text)) return "Valance: add-on accessory above a window, not a cabinet box.";
  if (/roll[- ]?out|pull[- ]?out tray/.test(text)) return "Roll-out / pull-out tray: add-on accessory inside another cabinet, not a box.";
  if (/filler|scribe/.test(text)) return "Filler: add-on accessory that closes a gap, not a box.";
  if (/panel|skin/.test(text)) return "Panel / skin: add-on accessory that finishes an exposed side, not a box.";
  if (/moulding|molding|crown|light rail|toe ?kick/.test(text)) return "Molding / trim: add-on accessory by the linear foot, not a box.";
  if (/sample/.test(text)) return "Sample or display item, not a sellable box.";
  return "Add-on accessory, not a cabinet box.";
}

/** True when the 3D Designer can draw this row as a cabinet box. */
export function threeDDesignerCanDraw(row: DesignCabinet): boolean {
  if (isDesignerAccessoryItem(row) && !isDesignerPlaceableAccessory(row)) return false;
  if (!positiveDesignerMeasure(row.width) || !positiveDesignerMeasure(row.height) || !positiveDesignerMeasure(row.depth)) return false;
  return true;
}

/**
 * One audit row for a catalog cabinet. `style` is the door style / line the row
 * belongs to, so the same SKU sold by two lines appears twice.
 */
export function boxCoverageRow(row: DesignCabinet, style: string): BoxCoverageRow {
  const testRow = isNonSellableTestRow(row);
  const accessory = testRow || (isDesignerAccessoryItem(row) && !isSinkBaseCabinet(row));
  const draws = testRow ? false : threeDDesignerCanDraw(row);
  const path = testRow ? null : autoBuilderPath(row);
  const status: BoxCoverageStatus = accessory ? "accessory" : path != null && draws ? "available" : "missing";
  return {
    style,
    masterCode: (row.masterCode ?? "").trim(),
    description: row.description ?? "",
    category: row.category ?? "",
    subCategory: row.subCategory ?? "",
    placement: row.placement ?? "",
    widthIn: numeric(row.width),
    heightIn: numeric(row.height),
    depthIn: numeric(row.depth),
    status,
    autoBuilder: path != null,
    threeDDesigner: draws,
    autoBuilderPath: path,
    reason: status === "available"
      ? null
      : status === "accessory"
        ? testRow ? "Sample, display, or temporary checkout test row — not a sellable cabinet box." : accessoryReason(row)
        : !draws
          ? "The 3D Designer cannot draw this row: it has no complete width, height, and depth."
          : boxMissingReason(row),
  };
}

export type BoxCoverageSummary = {
  rows: BoxCoverageRow[];
  available: BoxCoverageRow[];
  missing: BoxCoverageRow[];
  accessories: BoxCoverageRow[];
};

/** Sort so the report reads the same way every run. */
export function summarizeBoxCoverage(rows: readonly BoxCoverageRow[]): BoxCoverageSummary {
  const sorted = [...rows].sort((left, right) =>
    left.style.localeCompare(right.style, undefined, { numeric: true })
    || left.status.localeCompare(right.status)
    || left.placement.localeCompare(right.placement)
    || left.masterCode.localeCompare(right.masterCode, undefined, { numeric: true }));
  return {
    rows: sorted,
    available: sorted.filter((row) => row.status === "available"),
    missing: sorted.filter((row) => row.status === "missing"),
    accessories: sorted.filter((row) => row.status === "accessory"),
  };
}
