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
import { selectAefEndPanel } from "./aefEndPanelStock";

/**
 * A window break is one exposed end. Stock, the door-front field cut, and the
 * 24"-deep TEP3096 / BP9642 fallback all come from the shared end-panel selector
 * so this path cannot disagree with the general exposed-end rule.
 */
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
      const selection = selectAefEndPanel("wall", rotatedSize(cabinet).d, placedHeight(cabinet), panelCatalog);
      const catalogItem = catalogByCode.get(selection.masterCode.toUpperCase()) ?? null;
      requirements.push({
        cabinetUid: cabinet.uid,
        windowUid: window.uid,
        end,
        masterCode: selection.masterCode,
        cabinetId: catalogItem?.id ?? null,
        pendingSku: catalogItem == null,
        stockWidth: selection.stockWidth,
        stockHeight: selection.stockHeight,
        stockThickness: selection.stockThickness,
        height: selection.height,
        depth: selection.depth,
        description: `${selection.masterCode} — 3/4\" Frameless Wall End Panel: ${formatEighthInches(selection.stockWidth)} W × ${formatEighthInches(selection.stockHeight)} H stock, trim flush with the door front to ${formatEighthInches(selection.depth)} deep × ${formatEighthInches(selection.height)} high for the exposed ${end} side of ${cabinet.masterCode} at window ${window.uid}${catalogItem ? "" : ". Spec stock is not in this catalog, so the line is unpriced."}`,
      });
    }
  }

  return requirements;
}
