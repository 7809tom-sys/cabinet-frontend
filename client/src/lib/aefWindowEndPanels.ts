import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import {
  cabinetWall,
  isPanelItem,
  placedHeight,
  rotatedSize,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  formatEighthInches,
} from "./design";

/**
 * AEF Frameless V8.2 wall end panels are 3/4-inch flat stock, 15-1/4 inches
 * wide, and are field-cut to the adjacent standard wall cabinet's 13-1/2-inch
 * depth. The shortest stock height that covers the cabinet is selected.
 */
const AEF_WALL_END_PANEL_STOCK = [
  { masterCode: "WEP1523", height: 22.625 },
  { masterCode: "WEP1530", height: 30.25 },
  { masterCode: "WEP1535", height: 35.25 },
  { masterCode: "WEP1542", height: 41.75 },
] as const;

const AEF_WALL_END_PANEL_STOCK_WIDTH_IN = 15.25;
const EPSILON_IN = 0.01;

type WindowPanelCatalogItem = Pick<
  DesignCabinet,
  "id" | "masterCode" | "constructionMethod"
>;

export type AefWindowEndPanelRequirement = {
  /** The upper cabinet whose visible end needs the panel. */
  cabinetUid: string;
  /** Opening that exposes this particular cabinet end. */
  windowUid: string;
  /** "start" is the left/bottom side of a wall run; "end" is right/top. */
  end: "start" | "end";
  /** Real, selectable line SKU where the source stock fits the adjacent upper. */
  masterCode: string | null;
  cabinetId: number | null;
  /** True only for an extraordinary deep upper where V8.2 WEP stock cannot cover the side. */
  pendingSku: boolean;
  description: string;
  /** Manufacturer stock face width before it is field cut to the upper depth. */
  stockWidth: number;
  /** Manufacturer stock height selected for the upper. */
  stockHeight: number;
  /** Finished panel thickness. */
  stockThickness: number;
  /** Cabinet-side coverage after trimming the stock-width field edge. */
  height: number;
  depth: number;
};

function isAefWallCabinet(cabinet: PlacedCabinet): boolean {
  return cabinet.placement === "wall"
    && cabinet.constructionMethod === AEF_PRINTED_GEOMETRY_MARKER
    && !isPanelItem(cabinet);
}

function panelStockFor(cabinet: PlacedCabinet): (typeof AEF_WALL_END_PANEL_STOCK)[number] | null {
  const sideDepth = rotatedSize(cabinet).d;
  // The source WEP board is 15-1/4 inches wide. Do not invent a panel that
  // cannot cover a 24-inch refrigerator-wall side.
  if (sideDepth > AEF_WALL_END_PANEL_STOCK_WIDTH_IN + EPSILON_IN) return null;
  const cabinetHeight = placedHeight(cabinet);
  return AEF_WALL_END_PANEL_STOCK.find((panel) => panel.height + EPSILON_IN >= cabinetHeight) ?? null;
}

/**
 * Returns one required 3/4-inch WEP panel for each AEF standard wall cabinet
 * end directly adjacent to a window break. A window between two upper runs
 * therefore returns two records: right end of the left run and left end of the
 * right run. It does not alter cabinet placement, the Wall Builder, or other
 * supplier lines.
 */
export function aefWindowEndPanelRequirements(
  placed: readonly PlacedCabinet[],
  openings: readonly WallOpening[],
  room: RoomData,
  panelCatalog: readonly WindowPanelCatalogItem[],
): AefWindowEndPanelRequirement[] {
  const catalogByCode = new Map(
    panelCatalog
      .filter((item) => item.constructionMethod === AEF_PRINTED_GEOMETRY_MARKER)
      .map((item) => [item.masterCode.toUpperCase(), item]),
  );
  const requirements: AefWindowEndPanelRequirement[] = [];
  const seen = new Set<string>();

  for (const window of openings) {
    if (window.kind !== "window") continue;
    const windowStart = window.offset;
    const windowEnd = window.offset + window.width;
    const candidates = placed.filter(
      (cabinet) => isAefWallCabinet(cabinet) && cabinetWall(cabinet, room) === window.side,
    );
    const left = candidates
      .filter((cabinet) => wallRunOffset(cabinet, window.side, room) + wallRunSpan(cabinet, window.side, room) <= windowStart + EPSILON_IN)
      .sort((a, b) => (
        wallRunOffset(b, window.side, room) + wallRunSpan(b, window.side, room)
        - wallRunOffset(a, window.side, room)
        - wallRunSpan(a, window.side, room)
      ))[0];
    const right = candidates
      .filter((cabinet) => wallRunOffset(cabinet, window.side, room) >= windowEnd - EPSILON_IN)
      .sort((a, b) => wallRunOffset(a, window.side, room) - wallRunOffset(b, window.side, room))[0];

    for (const [cabinet, end] of [[left, "end"], [right, "start"]] as const) {
      if (!cabinet) continue;
      const key = `${window.uid}:${cabinet.uid}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const stock = panelStockFor(cabinet);
      const catalogItem = stock ? catalogByCode.get(stock.masterCode) ?? null : null;
      const depth = rotatedSize(cabinet).d;
      requirements.push({
        cabinetUid: cabinet.uid,
        windowUid: window.uid,
        end,
        masterCode: catalogItem?.masterCode ?? null,
        cabinetId: catalogItem?.id ?? null,
        pendingSku: !catalogItem,
        stockWidth: AEF_WALL_END_PANEL_STOCK_WIDTH_IN,
        stockHeight: stock?.height ?? placedHeight(cabinet),
        stockThickness: 0.75,
        height: placedHeight(cabinet),
        depth,
        description: stock
          ? `${stock.masterCode} — 3/4\" Frameless Wall End Panel: ${formatEighthInches(AEF_WALL_END_PANEL_STOCK_WIDTH_IN)} W × ${formatEighthInches(stock.height)} H stock, trim the stock width to ${formatEighthInches(depth)} for the exposed ${end} side of ${cabinet.masterCode} at window ${window.uid}`
          : `3/4\" Frameless Wall End Panel — no source WEP stock covers the ${depth}\"-deep exposed ${end} side of ${cabinet.masterCode} at window ${window.uid}`,
      });
    }
  }

  return requirements;
}
