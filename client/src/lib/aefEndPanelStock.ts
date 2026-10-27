import { AEF_PRINTED_GEOMETRY_MARKER, hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";

/**
 * AltaEuro V8.2 end-panel stock. Face width is the dimension that covers the
 * cabinet side (depth). Height is the vertical stock before the field cut.
 *
 * WEP1523 / WEP1530 / WEP1535 / WEP1542 — 15 1/4" face. PDF p.74 / printed p.56.
 * WEP1542 stock is 15 1/4 × 41 3/4; a 40 1/4" wall is cut down to the box.
 * BEP2535 — 25 5/8 × 35 1/4. PDF p.73 / printed p.55. Base ends only.
 * TEP3096 — 29 7/8 × 96. PDF p.74 / printed p.56.
 * BP9642 — 96 × 42 long end panel. PDF p.73 / printed p.55.
 *
 * There is no refrigerator-panel SKU and no 24"-deep wall-panel SKU. A
 * 24"-deep refrigerator wall and every tall cabinet use TEP3096, or BP9642
 * when the tall sheet is not in the catalog and 42" of height is enough.
 *
 * Door-front depth is an inference, not a printed cut table: Design Tips say
 * panels are oversized and trimmed flush with the door front (islands and
 * peninsulas: flush with the back panel and the door/drawer front). Slab doors
 * are 3/4" (PDF p.6). Installed depth is therefore the box depth plus 3/4",
 * never the bare box. Slim Cava's 7/8" door is not applied to this default cut.
 */
export const AEF_SLAB_DOOR_THICKNESS_IN = 0.75;
export const AEF_END_PANEL_THICKNESS_IN = 0.75;

export type AefEndPanelFamily = "wall" | "base" | "tall" | "long";

export type AefEndPanelStock = {
  masterCode: string;
  /** Face width: how far the sheet can cover a cabinet side. */
  stockWidth: number;
  stockHeight: number;
  family: AefEndPanelFamily;
};

export const AEF_WEP_STOCK: readonly AefEndPanelStock[] = [
  { masterCode: "WEP1523", stockWidth: 15.25, stockHeight: 22.625, family: "wall" },
  { masterCode: "WEP1530", stockWidth: 15.25, stockHeight: 30.25, family: "wall" },
  { masterCode: "WEP1535", stockWidth: 15.25, stockHeight: 35.25, family: "wall" },
  { masterCode: "WEP1542", stockWidth: 15.25, stockHeight: 41.75, family: "wall" },
];

export const AEF_BEP2535: AefEndPanelStock = {
  masterCode: "BEP2535", stockWidth: 25.625, stockHeight: 35.25, family: "base",
};
export const AEF_TEP3096: AefEndPanelStock = {
  masterCode: "TEP3096", stockWidth: 29.875, stockHeight: 96, family: "tall",
};
/** 96" face × 42" height. The 42" height cannot cover a tall cabinet. */
export const AEF_BP9642: AefEndPanelStock = {
  masterCode: "BP9642", stockWidth: 96, stockHeight: 42, family: "long",
};

const COVER_EPSILON_IN = 0.01;

export type AefEndPanelCatalogItem = {
  id: number;
  masterCode: string;
  constructionMethod?: string | null;
};

export type AefEndPanelSelection = {
  masterCode: string;
  cabinetId: number | null;
  pendingSku: boolean;
  stockWidth: number;
  stockHeight: number;
  stockThickness: number;
  /** Field-cut height. Never taller than the cabinet, even when stock is. */
  height: number;
  /** Field-cut depth, flush with the 3/4" door front. */
  depth: number;
  family: AefEndPanelFamily;
};

export function aefFinishedEndDepth(boxDepth: number): number {
  return Math.max(0, boxDepth) + AEF_SLAB_DOOR_THICKNESS_IN;
}

function stockCovers(stock: AefEndPanelStock, finishedDepth: number, cabinetHeight: number): boolean {
  return stock.stockWidth + COVER_EPSILON_IN >= finishedDepth
    && stock.stockHeight + COVER_EPSILON_IN >= cabinetHeight;
}

function cutToCabinet(stock: AefEndPanelStock, finishedDepth: number, cabinetHeight: number): Pick<AefEndPanelSelection, "height" | "depth" | "stockWidth" | "stockHeight" | "stockThickness" | "family"> {
  return {
    family: stock.family,
    stockWidth: stock.stockWidth,
    stockHeight: stock.stockHeight,
    stockThickness: AEF_END_PANEL_THICKNESS_IN,
    height: Math.min(stock.stockHeight, Math.max(0, cabinetHeight)),
    depth: Math.min(stock.stockWidth, finishedDepth),
  };
}

function lookup(catalog: readonly AefEndPanelCatalogItem[], masterCode: string): AefEndPanelCatalogItem | null {
  const wanted = masterCode.toUpperCase();
  return catalog.find((item) => (
    hasAefPrintedGeometry(item)
    && item.masterCode.toUpperCase() === wanted
  )) ?? null;
}

function resolve(
  stock: AefEndPanelStock,
  catalog: readonly AefEndPanelCatalogItem[],
  finishedDepth: number,
  cabinetHeight: number,
): AefEndPanelSelection {
  const item = lookup(catalog, stock.masterCode);
  return {
    masterCode: stock.masterCode,
    cabinetId: item?.id ?? null,
    pendingSku: item == null,
    ...cutToCabinet(stock, finishedDepth, cabinetHeight),
  };
}

/**
 * The priced spec SKU for one exposed frameless end. A missing catalog row is
 * flagged on the real spec code. No substitute code and no price are invented.
 * WEP stock is never used on a side deeper than 15 1/4", and BEP is never used
 * on a wall or tall cabinet.
 */
export function selectAefEndPanel(
  placement: "wall" | "base" | "tall",
  boxDepth: number,
  cabinetHeight: number,
  catalog: readonly AefEndPanelCatalogItem[],
): AefEndPanelSelection {
  const finishedDepth = aefFinishedEndDepth(boxDepth);
  const wep = AEF_WEP_STOCK.find((stock) => stock.stockHeight + COVER_EPSILON_IN >= cabinetHeight) ?? null;

  if (placement === "wall" && wep && stockCovers(wep, finishedDepth, cabinetHeight)) {
    return resolve(wep, catalog, finishedDepth, cabinetHeight);
  }

  if (placement === "base" && stockCovers(AEF_BEP2535, finishedDepth, cabinetHeight)) {
    return resolve(AEF_BEP2535, catalog, finishedDepth, cabinetHeight);
  }

  if (placement === "tall") {
    return resolve(AEF_TEP3096, catalog, finishedDepth, cabinetHeight);
  }

  // 24"-deep refrigerator walls, and any base the 35 1/4" BEP cannot cover.
  if (stockCovers(AEF_TEP3096, finishedDepth, cabinetHeight)) {
    const tallSheet = lookup(catalog, AEF_TEP3096.masterCode);
    if (tallSheet) return resolve(AEF_TEP3096, catalog, finishedDepth, cabinetHeight);
    if (stockCovers(AEF_BP9642, finishedDepth, cabinetHeight) && lookup(catalog, AEF_BP9642.masterCode)) {
      return resolve(AEF_BP9642, catalog, finishedDepth, cabinetHeight);
    }
    return resolve(AEF_TEP3096, catalog, finishedDepth, cabinetHeight);
  }

  if (placement === "base" && stockCovers(AEF_BP9642, finishedDepth, cabinetHeight)) {
    return resolve(AEF_BP9642, catalog, finishedDepth, cabinetHeight);
  }

  const flagged = placement === "base" ? AEF_BEP2535 : placement === "wall" && wep ? wep : AEF_TEP3096;
  return resolve(flagged, catalog, finishedDepth, cabinetHeight);
}

export const AEF_END_PANEL_CATALOG_MARKER = AEF_PRINTED_GEOMETRY_MARKER;
