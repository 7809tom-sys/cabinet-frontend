// MasterTrac closet products from the owner's approved March 2022 worksheet.
// This client-safe file contains LIST prices only. Dealer Invoice values remain
// in the original, private workbook and are never bundled into the browser.
import type { DesignCabinet, Placement } from "./design";
import catalog from "./mastertrac-catalog.json";

export interface MasterTracProduct {
  sku: string;
  description: string;
  finish: string;
  category: string;
  listEachUsd: number;
  listPackUsd: number;
  packQty: number;
  sourceRow: number;
  lengthIn: number | null;
  thicknessIn: number | null;
  depthIn: number | null;
  placeable: boolean;
  shape: "panel" | "shelf" | null;
  placement: Placement | null;
  widthIn: number | null;
  heightIn: number | null;
}

export const MASTERTRAC_PRICE_DATE = "March 1, 2022";
export const MASTERTRAC_BROCHURE_PHOTO = "/manus-storage/mastertrac-room-from-brochure_339f6cce.png";
export const CLOSET_PARTS: MasterTracProduct[] = catalog as MasterTracProduct[];
const bySku = new Map(CLOSET_PARTS.map((p) => [p.sku, p]));

/** Browser-safe source fields for discoverability only; reference records never establish placement, fit, or installation. */
export type MasterTracPublicReference = Pick<MasterTracProduct,
  "sku" | "description" | "finish" | "category" | "listEachUsd" | "listPackUsd" | "packQty" |
  "lengthIn" | "thicknessIn" | "depthIn" | "widthIn" | "heightIn" | "placeable">;

/**
 * The complete public 2022 List catalog for a searchable reference browser.
 * This deliberately excludes source rows and all private workbook values.
 */
export function masterTracPublicReferenceCatalog(): MasterTracPublicReference[] {
  return CLOSET_PARTS.map(({ sku, description, finish, category, listEachUsd, listPackUsd, packQty,
    lengthIn, thicknessIn, depthIn, widthIn, heightIn, placeable }) => ({
    sku, description, finish, category, listEachUsd, listPackUsd, packQty,
    lengthIn, thicknessIn, depthIn, widthIn, heightIn, placeable,
  })).sort((a, b) => a.category.localeCompare(b.category) || a.description.localeCompare(b.description) || a.finish.localeCompare(b.finish) || a.sku.localeCompare(b.sku));
}

export function masterTracProduct(masterCode: string): MasterTracProduct | undefined {
  return bySku.get(masterCode);
}

export function isMasterTracPlaceable(masterCode: string): boolean {
  return Boolean(bySku.get(masterCode)?.placeable);
}

/** The three brochure-era board finishes; do not infer a finish from kitchen door styles. */
export function masterTracFinishColor(finish: string): string {
  switch (finish.toLowerCase()) {
    case "glacier white": return "#f2f1ed";
    case "slate rift": return "#55514e";
    case "spiced mahogany": return "#6a4236";
    default: return "#d4cfc7";
  }
}

/** Preview only. Order-only accessories remain catalog records, not dummy boxes. */
export function closetPartAsDesignCabinet(part: MasterTracProduct): DesignCabinet {
  return {
    id: 0,
    masterCode: part.sku,
    description: `${part.description} · ${part.finish}`,
    category: "MasterTrac Closet",
    subCategory: part.category,
    width: part.widthIn == null ? "—" : String(part.widthIn),
    height: part.heightIn == null ? "—" : String(part.heightIn),
    depth: part.depthIn == null ? "—" : String(part.depthIn),
    // This fallback exists only for catalog searching; order-only SKUs are
    // disabled in the UI and must never be passed into addCabinet().
    placement: part.placement ?? "wall",
    numberOfDoors: 0,
    numberOfDrawers: 0,
    isCornerCabinet: false,
  };
}

export function closetPaletteByCategory(): { category: string; items: DesignCabinet[] }[] {
  const groups = new Map<string, DesignCabinet[]>();
  for (const product of CLOSET_PARTS) {
    const items = groups.get(product.category) ?? [];
    items.push(closetPartAsDesignCabinet(product));
    groups.set(product.category, items);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}

/** List unit price for actual placeable items; unknown old CL-* codes stay unpriced. */
export function closetPartPrice(masterCode: string): number | null {
  return bySku.get(masterCode)?.listEachUsd ?? null;
}

export function isClosetPart(masterCode: string): boolean {
  return bySku.has(masterCode) || masterCode.startsWith("CL-");
}
