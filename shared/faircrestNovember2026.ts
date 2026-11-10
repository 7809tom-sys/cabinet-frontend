/**
 * Bring a Faircrest / Clark & Son catalog in line with the November 2026
 * Product Specification Guide.
 *
 * The guide is the source for dimensions, door and drawer counts, names, and
 * the printed RTA list price. This module does not delete or rename a code
 * that is already in the catalog. A code the guide dropped stays, and is
 * reported. Vanity, ADA, and toilet rows are reported and left as they are.
 * Auto Design layout rules do not live here.
 */

import {
  FAIRCREST_NOVEMBER_2026_DOOR_STYLES,
  FAIRCREST_NOVEMBER_2026_GUIDE,
  type FaircrestGuideSku,
} from "./faircrestNovember2026Guide";

export { FAIRCREST_NOVEMBER_2026_DOOR_STYLES, FAIRCREST_NOVEMBER_2026_GUIDE };

export type FaircrestCatalogRow = {
  id?: number;
  masterCode: string;
  description: string | null;
  category: string | null;
  subCategory?: string | null;
  width: string | number | null;
  height: string | number | null;
  depth: string | number | null;
  placement?: string | null;
  placementType?: string | null;
  numberOfDoors: number | null;
  numberOfDrawers: number | null;
  numberOfAdjShelves?: number | null;
  numberOfFixedShelves?: number | null;
  isCornerCabinet?: boolean | null;
  fillerRequired?: boolean | null;
  graphicType?: string | null;
  openingWidth?: string | number | null;
  openingHeight?: string | number | null;
  openingType?: string | null;
  doorHeight?: string | number | null;
  drawerHeight?: string | number | null;
  doorOrientation?: string | null;
  doorsPerRow?: number | null;
  drawerLayout?: string | null;
  cornerType?: string | null;
  facePattern?: string | null;
  ovenType?: string | null;
  sourceOvenDrawerLayout?: string | null;
  glassIncluded?: boolean | null;
  pullMin?: string | number | null;
  pullMax?: string | number | null;
  /** Present only when the November 2026 guide prints an RTA list price. */
  listPrice?: number | null;
  /** Styles the guide prices. Null means that style is not offered. */
  listPriceByStyle?: Record<string, number | null> | null;
};

export type VanityDifference = {
  code: string;
  differences: string[];
};

export type FaircrestReconcileReport = {
  rows: FaircrestCatalogRow[];
  added: string[];
  corrected: string[];
  unchanged: string[];
  /** Codes we already sell that the November 2026 guide does not list. Left in place. */
  absentFromGuide: string[];
  /** New SKUs whose guide page states no price in any door style. */
  unpricedAdded: string[];
  /** New kitchen SKUs the guide does not offer in Rustic Hickory. */
  notOfferedInRusticHickory: string[];
  vanityDifferences: VanityDifference[];
};

function codeKey(code: string): string {
  return code.trim().toUpperCase();
}

const GUIDE_BY_CODE = new Map(FAIRCREST_NOVEMBER_2026_GUIDE.map((sku) => [codeKey(sku.code), sku]));

/** Standard face-frame door boxes. Tall, corner, oven, and drawer stacks keep the guide's own count. */
function isStandardDoorSection(section: string): boolean {
  return /^(Single Door Wall|Double Door Wall|Bridge & Short|18" Height Single Door|24" Deep Single Door|24" Deep Double Door|Single Door Base|Double Door Base|Full Height Single Door|Full Height Double Door)/.test(
    section,
  );
}

/**
 * House rule: a standard cabinet 24 inches or wider is not a single door, and
 * a standard cabinet 21 inches or under has one door. Specialty families keep
 * the count the guide prints.
 */
export function faircrestDoorCount(sku: Pick<FaircrestGuideSku, "section" | "width" | "doors">): number | null {
  if (sku.doors == null) return null;
  if (!isStandardDoorSection(sku.section) || sku.width == null) return sku.doors;
  if (sku.width >= 24 && sku.doors === 1) return 2;
  if (sku.width <= 21 && sku.doors > 1) return 1;
  return sku.doors;
}

function num(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function close(actual: string | number | null | undefined, expected: number | null): boolean {
  if (expected == null) return true;
  const parsed = num(actual);
  if (parsed == null) return false;
  return Math.abs(parsed - expected) <= 0.02;
}

function dimensionString(value: number): string {
  return value.toFixed(3);
}

function formatInches(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

/** Designer-facing copy. The order code is not part of this string. */
export function faircrestDesignerDescription(input: {
  code: string;
  name: string | null;
  section: string;
  width: number | null;
  height: number | null;
  depth: number | null;
  doors: number | null;
  drawers: number | null;
}): string {
  const name = input.name?.trim() || input.section;
  const size = [input.width, input.height, input.depth]
    .map((value) => (value == null ? null : `${formatInches(value)}"`))
    .filter((value): value is string => Boolean(value))
    .join(" × ");
  const faces: string[] = [];
  if (input.doors != null && input.doors > 0) {
    faces.push(`${input.doors} ${input.doors === 1 ? "door" : "doors"}`);
  }
  if (input.drawers != null && input.drawers > 0) {
    faces.push(`${input.drawers} ${input.drawers === 1 ? "drawer" : "drawers"}`);
  }
  const face = faces.length ? ` — ${faces.join(", ")}` : "";
  return `${size ? `${size} ` : ""}${name}${face}`
    .replace(/^\s*RB-?[23]DB-?\d+\s*[—–-]+\s*/i, "")
    .replace(/\brange[\s-]*base\b/gi, "base")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function statedCount(description: string, kind: "door" | "drawer"): number | null {
  const single = kind === "door" ? /\bsingle[\s-]*door\b/i : /\bsingle[\s-]*drawer\b/i;
  const double = kind === "door" ? /\b(double[\s-]*door|two[\s-]*door)\b/i : /\b(double[\s-]*drawer|two[\s-]*drawer)\b/i;
  if (single.test(description)) return 1;
  if (double.test(description)) return 2;
  const match = description.match(new RegExp(`(\\d+)\\s*${kind}`, "i"));
  return match ? Number(match[1]) : null;
}

function descriptionContradicts(
  description: string | null,
  doors: number | null,
  drawers: number | null,
): boolean {
  if (!description) return false;
  if (/\brange[\s-]*base\b/i.test(description) || /^\s*RB-?[23]DB/i.test(description)) return true;
  if (/TBD/i.test(description)) return true;
  if (doors != null) {
    const stated = statedCount(description, "door");
    if (stated != null && stated !== doors) return true;
  }
  if (drawers != null) {
    const stated = statedCount(description, "drawer");
    if (stated != null && stated !== drawers) return true;
  }
  return false;
}

export function isFaircrestBathRow(row: Pick<FaircrestCatalogRow, "masterCode" | "description" | "category" | "subCategory">): boolean {
  const code = row.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^(ADA|3VDB|VDB|VSDB|VDDB|MVEP)/.test(code)) return true;
  if (/^V\d/.test(code) || /^VS\d/.test(code)) return true;
  const text = `${row.description ?? ""} ${row.category ?? ""} ${row.subCategory ?? ""}`;
  return /\bvanity\b|\btoilet\b/i.test(text);
}

function vanityDifferences(row: FaircrestCatalogRow, guide: FaircrestGuideSku): string[] {
  const differences: string[] = [];
  const doors = faircrestDoorCount(guide);
  if (!close(row.width, guide.width)) differences.push(`width ${row.width} vs guide ${guide.width}`);
  if (!close(row.height, guide.height)) differences.push(`height ${row.height} vs guide ${guide.height}`);
  if (!close(row.depth, guide.depth)) differences.push(`depth ${row.depth} vs guide ${guide.depth}`);
  if (doors != null && row.numberOfDoors !== doors) differences.push(`doors ${row.numberOfDoors} vs guide ${doors}`);
  if (guide.drawers != null && row.numberOfDrawers !== guide.drawers) {
    differences.push(`drawers ${row.numberOfDrawers} vs guide ${guide.drawers}`);
  }
  if (guide.adjustableShelves != null && (row.numberOfAdjShelves ?? null) !== guide.adjustableShelves) {
    differences.push(`adjustable shelves ${row.numberOfAdjShelves} vs guide ${guide.adjustableShelves}`);
  }
  return differences;
}

function categoryFor(section: string): { category: string; placement: "base" | "wall" | "tall" | "accessory" } {
  const text = section.toLowerCase();
  if (text.includes("filler")) return { category: "Filler", placement: "accessory" };
  if (/mould|crown|toe kick|light rail|scribe|rope|shoe|batten/.test(text)) {
    return { category: "Molding", placement: "accessory" };
  }
  if (/panel|skin|plywood|sheet|bead board/.test(text)) return { category: "Panels", placement: "accessory" };
  if (/utility|oven|pantry/.test(text)) return { category: "Tall", placement: "tall" };
  if (text.includes("wall")) return { category: "Wall", placement: "wall" };
  if (/base|sink|lazy|tray|spice|microwave/.test(text)) return { category: "Base", placement: "base" };
  return { category: "Accessory", placement: "accessory" };
}

function isCornerSection(section: string): boolean {
  return /corner|diagonal|lazy susan|easy reach|blind|angle/i.test(section);
}

function anyPrice(sku: FaircrestGuideSku): boolean {
  return Object.values(sku.listPriceByStyle).some((price) => price != null);
}

function blankRow(id: number, sku: FaircrestGuideSku, doors: number | null): FaircrestCatalogRow {
  const placed = categoryFor(sku.section);
  const description = faircrestDesignerDescription({
    code: sku.code,
    name: sku.name,
    section: sku.section,
    width: sku.width,
    height: sku.height,
    depth: sku.depth,
    doors,
    drawers: sku.drawers,
  });
  return {
    id,
    masterCode: sku.code,
    description,
    category: placed.category,
    subCategory: sku.section,
    width: sku.width == null ? null : dimensionString(sku.width),
    height: sku.height == null ? null : dimensionString(sku.height),
    depth: sku.depth == null ? null : dimensionString(sku.depth),
    placement: placed.placement,
    placementType: placed.placement,
    numberOfDoors: doors ?? 0,
    numberOfDrawers: sku.drawers ?? 0,
    numberOfFixedShelves: sku.fixedShelves ?? 0,
    numberOfAdjShelves: sku.adjustableShelves ?? 0,
    isCornerCabinet: isCornerSection(sku.section),
    fillerRequired: false,
    graphicType: null,
    openingWidth: null,
    openingHeight: null,
    openingType: null,
    doorHeight: null,
    drawerHeight: null,
    doorOrientation: null,
    doorsPerRow: null,
    drawerLayout: null,
    cornerType: isCornerSection(sku.section) ? sku.section : null,
    facePattern: null,
    ovenType: null,
    sourceOvenDrawerLayout: null,
    glassIncluded: /glass/i.test(sku.section),
    pullMin: null,
    pullMax: null,
    listPrice: sku.listPriceByStyle.RH ?? null,
    listPriceByStyle: sku.listPriceByStyle,
  };
}

function correctRow(row: FaircrestCatalogRow, guide: FaircrestGuideSku): { row: FaircrestCatalogRow; changed: boolean } {
  const doors = faircrestDoorCount(guide);
  const next: FaircrestCatalogRow = { ...row };
  let changed = false;
  if (!close(row.width, guide.width) && guide.width != null) {
    next.width = dimensionString(guide.width);
    changed = true;
  }
  if (!close(row.height, guide.height) && guide.height != null) {
    next.height = dimensionString(guide.height);
    changed = true;
  }
  if (!close(row.depth, guide.depth) && guide.depth != null) {
    next.depth = dimensionString(guide.depth);
    changed = true;
  }
  if (doors != null && row.numberOfDoors !== doors) {
    next.numberOfDoors = doors;
    changed = true;
  }
  if (guide.drawers != null && row.numberOfDrawers !== guide.drawers) {
    next.numberOfDrawers = guide.drawers;
    changed = true;
  }
  if (guide.adjustableShelves != null && (row.numberOfAdjShelves ?? null) !== guide.adjustableShelves) {
    next.numberOfAdjShelves = guide.adjustableShelves;
    changed = true;
  }
  if (guide.fixedShelves != null && (row.numberOfFixedShelves ?? null) !== guide.fixedShelves) {
    next.numberOfFixedShelves = guide.fixedShelves;
    changed = true;
  }
  if (descriptionContradicts(row.description, doors, guide.drawers)) {
    next.description = faircrestDesignerDescription({
      code: guide.code,
      name: guide.name,
      section: guide.section,
      width: guide.width,
      height: guide.height,
      depth: guide.depth,
      doors,
      drawers: guide.drawers,
    });
    changed = true;
  }
  if (anyPrice(guide)) {
    next.listPrice = guide.listPriceByStyle.RH ?? row.listPrice ?? null;
    next.listPriceByStyle = guide.listPriceByStyle;
  }
  return { row: next, changed };
}

/**
 * Reconcile one Faircrest catalog (every placement bucket flattened) with the
 * November 2026 guide. Existing codes stay. Bath rows stay, including their
 * current dimensions.
 */
export function reconcileFaircrestCatalog(rows: readonly FaircrestCatalogRow[]): FaircrestReconcileReport {
  const present = new Set(rows.map((row) => codeKey(row.masterCode)));
  const added: string[] = [];
  const corrected: string[] = [];
  const unchanged: string[] = [];
  const absentFromGuide: string[] = [];
  const unpricedAdded: string[] = [];
  const notOfferedInRusticHickory: string[] = [];
  const vanityDifferencesOut: VanityDifference[] = [];
  let nextId = rows.reduce((max, row) => Math.max(max, row.id ?? 0), 94000000) + 1;

  const reconciled = rows.map((row) => {
    const key = codeKey(row.masterCode);
    const guide = GUIDE_BY_CODE.get(key);
    const bath = isFaircrestBathRow(row) || guide?.bath === true;
    if (bath) {
      if (guide) {
        const differences = vanityDifferences(row, guide);
        if (differences.length) vanityDifferencesOut.push({ code: row.masterCode, differences });
      } else {
        vanityDifferencesOut.push({
          code: row.masterCode,
          differences: ["in our catalog, not in the November 2026 vanity or ADA pages"],
        });
      }
      unchanged.push(row.masterCode);
      return row;
    }
    if (!guide) {
      absentFromGuide.push(row.masterCode);
      unchanged.push(row.masterCode);
      return row;
    }
    const result = correctRow(row, guide);
    if (result.changed) corrected.push(row.masterCode);
    else unchanged.push(row.masterCode);
    return result.row;
  });

  for (const sku of FAIRCREST_NOVEMBER_2026_GUIDE) {
    if (sku.bath) continue;
    const key = codeKey(sku.code);
    if (present.has(key)) continue;
    const doors = faircrestDoorCount(sku);
    const row = blankRow(nextId, sku, doors);
    nextId += 1;
    reconciled.push(row);
    added.push(sku.code);
    if (!anyPrice(sku)) unpricedAdded.push(sku.code);
    if (sku.listPriceByStyle.RH == null) notOfferedInRusticHickory.push(sku.code);
  }

  return {
    rows: reconciled,
    added,
    corrected,
    unchanged,
    absentFromGuide,
    unpricedAdded,
    notOfferedInRusticHickory,
    vanityDifferences: vanityDifferencesOut,
  };
}
