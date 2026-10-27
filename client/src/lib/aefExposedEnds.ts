import { hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";
import {
  cabinetWall,
  elevationBox,
  formatEighthInches,
  isFillerItem,
  isPanelItem,
  isRefrigerator,
  placedHeight,
  rotatedSize,
  wallLength,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";
import {
  selectAefEndPanel,
  type AefEndPanelCatalogItem,
  type AefEndPanelSelection,
} from "./aefEndPanelStock";

/**
 * A side is exposed when a customer can see it.
 *
 * Hidden only when it is fully covered:
 * - flush against the room wall (and not a window), or
 * - butted to a filler, which is the finish even though the filler is 3/4" deep, or
 * - butted to a cabinet, tall cabinet, or end panel of equal or greater depth
 *   whose vertical span contains this cabinet.
 *
 * Design Tips (p.1): use a panel next to appliances or when cabinet heights
 * vary. A shorter neighbor, a shallower neighbor, an appliance, an open end,
 * and a window are exposed. One record per cabinet end, so the window rule and
 * this rule cannot add the same panel twice.
 *
 * Islands and peninsulas are not measured here. Design Tips still say those
 * panels finish flush with the back and the door front; that cut is the same
 * door-flush depth, applied when an island face is added to this pass.
 */
const FLUSH_GAP_IN = 0.125;
/** Owner's window casing plus the 3/4" panel. The book states no window clearance. */
const WINDOW_FACE_GAP_IN = 3.75;

export type AefExposedEnd = "start" | "end";

export type AefExposedEndRequirement = AefEndPanelSelection & {
  cabinetUid: string;
  /** Set when this end faces a window. The same end is never listed twice. */
  windowUid: string | null;
  end: AefExposedEnd;
  description: string;
};

function isOwnedCabinet(cabinet: PlacedCabinet): cabinet is PlacedCabinet & { placement: "wall" | "base" | "tall" } {
  return (cabinet.placement === "wall" || cabinet.placement === "base" || cabinet.placement === "tall")
    && hasAefPrintedGeometry(cabinet)
    && !cabinet.islandFace
    && !isPanelItem(cabinet)
    && !isFillerItem(cabinet)
    && !isRefrigerator(cabinet);
}

function spans(cabinet: PlacedCabinet, room: RoomData) {
  const side = cabinetWall(cabinet, room);
  const start = wallRunOffset(cabinet, side, room);
  return { side, start, end: start + wallRunSpan(cabinet, side, room) };
}

function windowFacing(
  edge: number,
  end: AefExposedEnd,
  side: string,
  openings: readonly WallOpening[],
): WallOpening | null {
  for (const opening of openings) {
    if (opening.kind !== "window" || opening.side !== side) continue;
    const windowStart = opening.offset;
    const windowEnd = opening.offset + opening.width;
    const gap = end === "start" ? edge - windowEnd : windowStart - edge;
    const overlaps = windowStart < edge + FLUSH_GAP_IN && windowEnd > edge - FLUSH_GAP_IN;
    if (overlaps || (gap >= -FLUSH_GAP_IN && gap <= WINDOW_FACE_GAP_IN + FLUSH_GAP_IN)) return opening;
  }
  return null;
}

function meetsEnd(
  ownerStart: number,
  ownerEnd: number,
  neighborStart: number,
  neighborEnd: number,
  end: AefExposedEnd,
): boolean {
  if (end === "start") {
    return neighborEnd >= ownerStart - FLUSH_GAP_IN && neighborStart < ownerStart + FLUSH_GAP_IN;
  }
  return neighborStart <= ownerEnd + FLUSH_GAP_IN && neighborEnd > ownerEnd - FLUSH_GAP_IN;
}

function coversLayer(owner: PlacedCabinet, neighbor: PlacedCabinet): boolean {
  if (neighbor.placement === "tall" || isPanelItem(neighbor)) return true;
  if (isFillerItem(neighbor)) return neighbor.placement === owner.placement;
  return neighbor.placement === owner.placement;
}

function neighborHides(owner: PlacedCabinet, neighbor: PlacedCabinet, room: RoomData): boolean {
  if (neighbor.placement === "appliance" || isRefrigerator(neighbor)) return false;
  if (!coversLayer(owner, neighbor)) return false;
  if (isFillerItem(neighbor)) return true;
  if (rotatedSize(neighbor).d + FLUSH_GAP_IN < rotatedSize(owner).d) return false;
  const ownerBox = elevationBox(owner, room);
  const neighborBox = elevationBox(neighbor, room);
  return neighborBox.bottom <= ownerBox.bottom + FLUSH_GAP_IN
    && neighborBox.bottom + neighborBox.height >= ownerBox.bottom + ownerBox.height - FLUSH_GAP_IN;
}

function describe(
  selection: AefEndPanelSelection,
  cabinet: PlacedCabinet,
  end: AefExposedEnd,
  windowUid: string | null,
): string {
  const where = windowUid
    ? `exposed ${end} side of ${cabinet.masterCode} at window ${windowUid}`
    : `exposed ${end} side of ${cabinet.masterCode}`;
  const stock = `${formatEighthInches(selection.stockWidth)} W × ${formatEighthInches(selection.stockHeight)} H stock`;
  const cut = `field-cut flush with the door front to ${formatEighthInches(selection.depth)} deep × ${formatEighthInches(selection.height)} high`;
  const pending = selection.pendingSku ? " Spec stock is not in this catalog, so the line is unpriced." : "";
  return `${selection.masterCode} — 3/4" Frameless End Panel: ${stock}, ${cut}, for the ${where}.${pending}`;
}

export function aefExposedEndRequirements(
  placed: readonly PlacedCabinet[],
  openings: readonly WallOpening[],
  room: RoomData,
  panelCatalog: readonly AefEndPanelCatalogItem[],
): AefExposedEndRequirement[] {
  const requirements: AefExposedEndRequirement[] = [];
  const seen = new Set<string>();

  for (const cabinet of placed) {
    if (!isOwnedCabinet(cabinet)) continue;
    const ownerSpan = spans(cabinet, room);
    const wallLen = wallLength(ownerSpan.side, room);
    for (const end of ["start", "end"] as const) {
      const key = `${cabinet.uid}:${end}`;
      if (seen.has(key)) continue;
      const edge = end === "start" ? ownerSpan.start : ownerSpan.end;
      const wallGap = end === "start" ? ownerSpan.start : wallLen - ownerSpan.end;
      const window = windowFacing(edge, end, ownerSpan.side, openings);
      const coveringNeighbor = placed.some((neighbor) => {
        if (neighbor.uid === cabinet.uid || neighbor.islandFace) return false;
        if (cabinetWall(neighbor, room) !== ownerSpan.side) return false;
        const neighborSpan = spans(neighbor, room);
        return meetsEnd(ownerSpan.start, ownerSpan.end, neighborSpan.start, neighborSpan.end, end)
          && neighborHides(cabinet, neighbor, room);
      });
      const flushToWall = wallGap <= FLUSH_GAP_IN && window == null;
      if (coveringNeighbor || flushToWall) continue;
      seen.add(key);
      const selection = selectAefEndPanel(cabinet.placement, rotatedSize(cabinet).d, placedHeight(cabinet), panelCatalog);
      requirements.push({
        ...selection,
        cabinetUid: cabinet.uid,
        windowUid: window?.uid ?? null,
        end,
        description: describe(selection, cabinet, end, window?.uid ?? null),
      });
    }
  }

  return requirements;
}
