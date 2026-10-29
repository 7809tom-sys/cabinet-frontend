import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "@/lib/catalogFiller";
import {
  BLIND_CORNER_FILLER_WIDTH_IN,
  appendCollisionFreePlacements,
  cabinetWall,
  elevationBox,
  isFillerItem,
  isRefrigerator,
  isRefrigeratorEndPanel,
  isRefrigeratorWallCabinet,
  matchInstalledFillerToCabinet,
  wallLength,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";
import { hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";

/**
 * Blind-corner and range-handle door clearance already use a 3-inch filler.
 * A frameless door opening against a refrigerator cabinet or end panel uses
 * that same clearance so the slab can swing past the neighboring side.
 */
export const FRAMELESS_DOOR_CLEARANCE_FILLER_IN = BLIND_CORNER_FILLER_WIDTH_IN;

const FLUSH_GAP_IN = 0.125;
const ELEVATION_OVERLAP_IN = 0.5;

export function isFramelessCabinet(cabinet: {
  constructionMethod?: string | null;
  description?: string | null;
}): boolean {
  if (hasAefPrintedGeometry(cabinet)) return true;
  return /\bframeless\b/i.test(`${cabinet.constructionMethod ?? ""} ${cabinet.description ?? ""}`);
}

/** Refrigerator wall cabinet, refrigerator tall cabinet, or refrigerator end panel. */
export function isRefrigeratorSideCabinet(cabinet: PlacedCabinet): boolean {
  if (isRefrigerator(cabinet) || isFillerItem(cabinet)) return false;
  if (isRefrigeratorEndPanel(cabinet) || isRefrigeratorWallCabinet(cabinet)) return true;
  if (cabinet.placement !== "tall" && cabinet.placement !== "wall") return false;
  const hay = `${cabinet.masterCode ?? ""} ${cabinet.description ?? ""} ${cabinet.subCategory ?? ""}`.toLowerCase();
  return /\brefrigerator\b/.test(hay) && /\b(cabinet|tall|pantry|upper|wall)\b/.test(hay);
}

function elevationsOverlap(left: PlacedCabinet, right: PlacedCabinet, room: RoomData): boolean {
  const a = elevationBox(left, room);
  const b = elevationBox(right, room);
  return a.bottom < b.bottom + b.height - ELEVATION_OVERLAP_IN
    && b.bottom < a.bottom + a.height - ELEVATION_OVERLAP_IN;
}

type ClearancePair = {
  cabinet: PlacedCabinet;
  neighbor: PlacedCabinet;
  wall: ReturnType<typeof cabinetWall>;
  /** Cabinet is farther along the run than the refrigerator cabinet or panel. */
  cabinetOnRight: boolean;
};

function findClearancePair(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  skipCabinetUids: ReadonlySet<string>,
): ClearancePair | null {
  const cabinets = placed.filter((cabinet) =>
    isFramelessCabinet(cabinet)
    && !skipCabinetUids.has(cabinet.uid)
    && !isFillerItem(cabinet)
    && (cabinet.placement === "base" || cabinet.placement === "wall" || cabinet.placement === "tall"),
  );
  for (const cabinet of cabinets) {
    const wall = cabinetWall(cabinet, room);
    const cabinetStart = wallRunOffset(cabinet, wall, room);
    const cabinetEnd = cabinetStart + wallRunSpan(cabinet, wall, room);
    for (const neighbor of placed) {
      if (neighbor.uid === cabinet.uid || !isRefrigeratorSideCabinet(neighbor)) continue;
      if (cabinetWall(neighbor, room) !== wall || !elevationsOverlap(cabinet, neighbor, room)) continue;
      const neighborStart = wallRunOffset(neighbor, wall, room);
      const neighborEnd = neighborStart + wallRunSpan(neighbor, wall, room);
      const cabinetOnRight = cabinetStart >= neighborEnd - FLUSH_GAP_IN;
      const gap = cabinetOnRight ? cabinetStart - neighborEnd : neighborStart - cabinetEnd;
      if (gap < -0.05 || gap > FLUSH_GAP_IN) continue;
      return { cabinet, neighbor, wall, cabinetOnRight };
    }
  }
  return null;
}

function shiftRun(
  placed: readonly PlacedCabinet[],
  pair: ClearancePair,
  room: RoomData,
): PlacedCabinet[] | null {
  const delta = pair.cabinetOnRight ? FRAMELESS_DOOR_CLEARANCE_FILLER_IN : -FRAMELESS_DOOR_CLEARANCE_FILLER_IN;
  const length = wallLength(pair.wall, room);
  const moving = placed.filter((item) => {
    if (item.uid === pair.neighbor.uid) return false;
    if (cabinetWall(item, room) !== pair.wall) return false;
    const start = wallRunOffset(item, pair.wall, room);
    const end = start + wallRunSpan(item, pair.wall, room);
    return pair.cabinetOnRight
      ? start >= wallRunOffset(pair.cabinet, pair.wall, room) - FLUSH_GAP_IN
      : end <= wallRunOffset(pair.cabinet, pair.wall, room) + wallRunSpan(pair.cabinet, pair.wall, room) + FLUSH_GAP_IN;
  });
  for (const item of moving) {
    const start = wallRunOffset(item, pair.wall, room) + delta;
    const span = wallRunSpan(item, pair.wall, room);
    if (start < -0.01 || start + span > length + 0.01) return null;
  }
  const movingIds = new Set(moving.map((item) => item.uid));
  return placed.map((item) => {
    if (!movingIds.has(item.uid)) return item;
    const start = wallRunOffset(item, pair.wall, room) + delta;
    const span = wallRunSpan(item, pair.wall, room);
    const spot = wallPlacementAt(start, span, item.depth, pair.wall, room, item.peninsulaSide);
    return spot ? { ...item, ...spot } : item;
  });
}

/**
 * Inserts the standard door-clearance filler between a frameless cabinet and
 * the refrigerator cabinet or end panel it is butted against. Framed cabinets
 * are left unchanged. Returns the same array when nothing is added.
 */
export function applyFramelessDoorClearanceFillers(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  fillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
}): { placed: PlacedCabinet[]; added: PlacedCabinet[] } {
  let working = input.placed;
  const added: PlacedCabinet[] = [];
  const skipped = new Set<string>();
  for (let guard = 0; guard < 12; guard += 1) {
    const pair = findClearancePair(working, input.room, skipped);
    if (!pair) break;
    const layer = pair.cabinet.placement === "wall" ? "wall" : pair.cabinet.placement === "tall" ? "tall" : "base";
    const fillerDef = catalogFillerForGap(input.fillers, FRAMELESS_DOOR_CLEARANCE_FILLER_IN, layer);
    if (!fillerDef) break;
    const shifted = shiftRun(working, pair, input.room);
    if (!shifted) {
      skipped.add(pair.cabinet.uid);
      continue;
    }
    const neighborEnd = wallRunOffset(pair.neighbor, pair.wall, input.room) + wallRunSpan(pair.neighbor, pair.wall, input.room);
    const cabinetStart = wallRunOffset(pair.cabinet, pair.wall, input.room);
    const fillerStart = pair.cabinetOnRight ? neighborEnd : cabinetStart - FRAMELESS_DOOR_CLEARANCE_FILLER_IN;
    const spot = wallPlacementAt(
      fillerStart,
      FRAMELESS_DOOR_CLEARANCE_FILLER_IN,
      Number(pair.cabinet.depth) || 24,
      pair.wall,
      input.room,
    );
    if (!spot) {
      skipped.add(pair.cabinet.uid);
      continue;
    }
    const uid = input.makeUid();
    const draft: PlacedCabinet = {
      uid,
      cabinetId: fillerDef.id,
      masterCode: fillerDef.masterCode,
      description: `${fittedCatalogFillerDescription(fillerDef, FRAMELESS_DOOR_CLEARANCE_FILLER_IN)} — frameless door clearance`,
      category: fillerDef.category ?? "Filler",
      subCategory: fillerDef.subCategory ?? "Filler",
      placement: layer,
      x: spot.x,
      y: spot.y,
      rotation: spot.rotation,
      ...(spot.wallId ? { wallId: spot.wallId, wallOffset: spot.wallOffset, peninsulaSide: spot.peninsulaSide } : {}),
      width: FRAMELESS_DOOR_CLEARANCE_FILLER_IN,
      nominalWidth: Number(fillerDef.width) || FRAMELESS_DOOR_CLEARANCE_FILLER_IN,
      depth: Number(pair.cabinet.depth) || 24,
      height: Number(pair.cabinet.height) || 34.5,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      catalogImageUrl: fillerDef.catalogImageUrl ?? null,
      styleId: pair.cabinet.styleId ?? input.styleId,
      fillerPieceGroupId: `filler-group-${uid}`,
      fillerBillingRole: "primary",
      fillerTotalWidth: FRAMELESS_DOOR_CLEARANCE_FILLER_IN,
      fillerPlacementMode: pair.cabinetOnRight ? "left" : "right",
      fillerForCabinetUid: pair.cabinet.uid,
    };
    const filler = matchInstalledFillerToCabinet(draft, pair.cabinet, input.room);
    const accepted = appendCollisionFreePlacements(shifted, [filler], input.room);
    if (accepted.rejected.length > 0 || !accepted.placed.some((item) => item.uid === filler.uid)) {
      skipped.add(pair.cabinet.uid);
      continue;
    }
    working = accepted.placed;
    added.push(filler);
  }
  return added.length > 0 ? { placed: working, added } : { placed: input.placed, added: [] };
}
