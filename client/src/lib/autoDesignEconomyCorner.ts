/**
 * Economy corner (Tom, voice, Nov 19 2026, 8:44 + 9:01 AM CT), budget friendly only.
 *
 * A budget kitchen does not buy a corner cabinet. The inside corner keeps its 24″ square (the base
 * depth of the other leg, countertop over it) and each meeting leg claims 24″ + a 3″ door-clearance
 * filler = a 27″ corner footprint FIRST. Only then are the leg's bases sized, to what is left:
 * 27″ available beside the corner -> 3″ filler + B24, never an oversized B27/B33 jammed into the corner.
 *
 * Real SKUs only: the filler is the line's own 3″ base filler (catalogFillerForGap). A line with no
 * 3″ filler, or a leg that cannot give up the 27″ (an anchored appliance inside it), keeps the
 * normal corner-cabinet decision, and the note says why.
 */
import { catalogFillerForGap, type CatalogFillerCandidate } from "./catalogFiller";
import {
  BLIND_CORNER_FILLER_WIDTH_IN,
  STD,
  cabinetWall,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

export const ECONOMY_CORNER_SQUARE_IN = STD.BASE_DEPTH;
export const ECONOMY_CORNER_FILLER_IN = BLIND_CORNER_FILLER_WIDTH_IN;
export const ECONOMY_CORNER_FOOTPRINT_IN = ECONOMY_CORNER_SQUARE_IN + ECONOMY_CORNER_FILLER_IN;

/**
 * Material-list label + cut instruction for the economic corner (Tom, voice, Nov 19 2026, 11:53 AM CT).
 * The 27″ footprint is a 24″ VOID (no corner cabinet, no blind pull pocket, countertop over it) plus a
 * 3″ filler that is MITERED at 45° on the end that meets the void. The text rides on the filler's
 * fieldModificationNote, which the material list, build sheet and cart lines already print.
 */
export const ECONOMIC_CORNER_LABEL = "Economic corner";
export const ECONOMIC_CORNER_BASE_NOTE =
  `${ECONOMIC_CORNER_LABEL}: 3\" filler, MITER 45° on the end at the open 24\" corner void (no corner cabinet, no pull pocket; countertop runs over the void).`;
export const ECONOMIC_CORNER_WALL_NOTE =
  `${ECONOMIC_CORNER_LABEL} (upper): 3\" upper filler over the economic-corner base filler, MITER 45° on the end at the open corner void.`;

/** True for the 3″ fillers this module seats at the edge of the 24″ corner void (base or upper). */
export function isEconomicCornerFiller(item: Pick<PlacedCabinet, "fillerPieceGroupId">): boolean {
  return typeof item.fillerPieceGroupId === "string" && item.fillerPieceGroupId.startsWith("economy-corner:");
}

export type EconomyCornerResult =
  | { ok: true; placed: PlacedCabinet[]; fillerUids: string[]; note: string } // boards are seated by enforceEconomyCornerFillers
  | { ok: false; note: string };

export function seatEconomyCorner(input: {
  label: string;
  wallIds: readonly WallSide[];
  corner: { x: number; y: number };
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalogFillers: readonly CatalogFillerCandidate[];
  makeUid?: () => string;
  styleId?: number | null;
}): EconomyCornerResult {
  const { room } = input;
  const row = catalogFillerForGap(input.catalogFillers, ECONOMY_CORNER_FILLER_IN, "base");
  if (!row) {
    return { ok: false, note: `${input.label}: budget friendly economy corner skipped — the line sells no 3″ base filler, so the normal corner cabinet is used.` };
  }
  const legs: Array<{ wallId: WallSide; fillerStart: number }> = [];
  for (const wallId of input.wallIds) {
    const frame = wallRunFrame(wallId, room);
    if (!frame) return { ok: false, note: `${input.label}: economy corner skipped — ${wallId} has no run frame.` };
    const atStart = Math.hypot(frame.start.x - input.corner.x, frame.start.y - input.corner.y)
      <= Math.hypot(frame.end.x - input.corner.x, frame.end.y - input.corner.y);
    const claim = atStart
      ? { start: frame.runStart, end: frame.runStart + ECONOMY_CORNER_FOOTPRINT_IN }
      : { start: frame.runEnd - ECONOMY_CORNER_FOOTPRINT_IN, end: frame.runEnd };
    const blocker = input.placed.find((item) => {
      if (item.placement === "wall" || cabinetWall(item, room) !== wallId) return false;
      const start = wallRunOffset(item, wallId, room);
      const end = start + wallRunSpan(item, wallId, room);
      return start < claim.end - 0.01 && end > claim.start + 0.01;
    });
    if (blocker) {
      return { ok: false, note: `${input.label}: budget friendly economy corner skipped — ${blocker.masterCode} sits inside the 27″ corner footprint on ${wallId}, so the normal corner decision is used.` };
    }
    legs.push({ wallId, fillerStart: atStart ? claim.start + ECONOMY_CORNER_SQUARE_IN : claim.start });
  }
  void legs;
  return {
    ok: true,
    placed: [...input.placed],
    fillerUids: [],
    note: `${input.label}: budget friendly economy corner — no corner cabinet. Each leg claims the 27″ corner footprint first (24″ corner square + ${row.masterCode} 3″ filler), then its bases are sized to what is left (27″ beside the corner -> B24, not an oversized base).`,
  };
}

/**
 * Final economy-corner pass: after every re-tile, each leg's first base beside the 24″ corner square
 * gives up the 3″ the filler needs — it is swapped for the same family's stock width 3″ narrower
 * (B27 -> B24), and the real 3″ filler goes between it and the corner square. When the line has no
 * such width, nothing is forced: the base stays and a note says so.
 */
export function enforceEconomyCornerFillers(input: {
  corners: ReadonlyArray<{ label: string; wallIds: readonly WallSide[]; corner: { x: number; y: number } }>;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  baseCatalog: readonly { id: number; masterCode: string; description?: string | null; width?: string | number | null; height?: string | number | null; depth?: string | number | null; category?: string | null; subCategory?: string | null }[];
  wallCatalog?: readonly { id: number; masterCode: string; description?: string | null; width?: string | number | null; height?: string | number | null; depth?: string | number | null; category?: string | null; subCategory?: string | null }[];
  catalogFillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId?: number | null;
}): { placed: PlacedCabinet[]; notes: string[] } {
  const { room } = input;
  let placed = [...input.placed];
  const notes: string[] = [];
  const fillerRow = catalogFillerForGap(input.catalogFillers, ECONOMY_CORNER_FILLER_IN, "base");
  if (!fillerRow) return { placed, notes };
  const familyOf = (code: string) => (code.toUpperCase().replace(/[^A-Z0-9]/g, "").match(/^(\d*[A-Z]+)\d/)?.[1] ?? null);
  for (const corner of input.corners) {
    for (const wallId of corner.wallIds) {
      const frame = wallRunFrame(wallId, room);
      if (!frame) continue;
      const atStart = Math.hypot(frame.start.x - corner.corner.x, frame.start.y - corner.corner.y)
        <= Math.hypot(frame.end.x - corner.corner.x, frame.end.y - corner.corner.y);
      const squareEdge = atStart ? frame.runStart + ECONOMY_CORNER_SQUARE_IN : frame.runEnd - ECONOMY_CORNER_SQUARE_IN;
      const onLeg = placed.filter((item) => item.placement !== "wall" && cabinetWall(item, room) === wallId)
        .map((item) => { const start = wallRunOffset(item, wallId, room); return { item, start, end: start + wallRunSpan(item, wallId, room) }; });
      // Already finished: a filler sits right at the square's edge.
      const atEdge = onLeg.find((seen) => atStart ? Math.abs(seen.start - squareEdge) <= 0.06 : Math.abs(seen.end - squareEdge) <= 0.06);
      if (!atEdge) continue;
      if (/filler/i.test(`${atEdge.item.category ?? ""} ${atEdge.item.subCategory ?? ""} ${atEdge.item.description ?? ""}`)) continue;
      const base = atEdge.item;
      const family = familyOf(base.masterCode);
      const width = atEdge.end - atEdge.start;
      const fits = (row: (typeof input.baseCatalog)[number]) => Math.abs(Number(row.width) - (width - ECONOMY_CORNER_FILLER_IN)) <= 0.01
        && Math.abs((Number(row.height) || 34.5) - (Number(base.height) || 34.5)) <= 0.6
        && Math.abs((Number(row.depth) || 24) - (Number(base.depth) || 24)) <= 0.6
        && !/sink|corner|blind|susan|filler|panel/i.test(`${row.masterCode} ${row.description ?? ""}`);
      // Same family first (3DB27 -> 3DB24), then the plain B family (3DB15 -> B12).
      const narrower = family && base.placement === "base"
        ? input.baseCatalog.find((row) => familyOf(row.masterCode) === family && fits(row))
          ?? input.baseCatalog.find((row) => familyOf(row.masterCode) === "B" && fits(row))
        : null;
      if (!narrower) {
        notes.push(`${corner.label}: economy corner on ${wallId} — ${base.masterCode} touches the corner square and the line sells no ${family ?? ""}${width - ECONOMY_CORNER_FILLER_IN} to leave room for the 3″ filler, so ${base.masterCode} was kept and the corner has no clearance filler. Check door/drawer clearance.`);
        continue;
      }
      const newWidth = Number(narrower.width);
      const fillerStart = atStart ? squareEdge : squareEdge - ECONOMY_CORNER_FILLER_IN;
      const baseStart = atStart ? squareEdge + ECONOMY_CORNER_FILLER_IN : atEdge.start;
      const baseSpot = wallPlacementAt(baseStart, newWidth, Number(base.depth) || 24, wallId, room, null, false);
      const swapped: PlacedCabinet = {
        ...base,
        cabinetId: narrower.id,
        masterCode: narrower.masterCode,
        description: narrower.description ?? base.description,
        width: newWidth,
        nominalWidth: newWidth,
        x: baseSpot.x,
        y: baseSpot.y,
        wallOffset: baseSpot.wallOffset ?? baseStart,
      };
      const fillerDepth = Number(fillerRow.depth) > 6 ? Number(fillerRow.depth) : STD.BASE_DEPTH;
      const spot = wallPlacementAt(fillerStart, ECONOMY_CORNER_FILLER_IN, fillerDepth, wallId, room, null, false);
      const filler = {
        uid: input.makeUid(),
        cabinetId: Number(fillerRow.id),
        masterCode: fillerRow.masterCode,
        description: fillerRow.description ?? `${fillerRow.masterCode} filler`,
        category: fillerRow.category ?? "Filler",
        subCategory: fillerRow.subCategory ?? "Filler",
        placement: "base",
        x: spot.x,
        y: spot.y,
        width: ECONOMY_CORNER_FILLER_IN,
        depth: fillerDepth,
        height: STD.BASE_HEIGHT,
        nominalWidth: Number(fillerRow.width) || ECONOMY_CORNER_FILLER_IN,
        nominalHeight: STD.BASE_HEIGHT,
        nominalDepth: fillerDepth,
        rotation: spot.rotation,
        wallId: spot.wallId ?? wallId,
        wallOffset: spot.wallOffset ?? fillerStart,
        mountBottom: 0,
        numberOfDoors: 0,
        numberOfDrawers: 0,
        fillerPieceGroupId: `economy-corner:${corner.label}:${wallId}`,
        fillerTotalWidth: ECONOMY_CORNER_FILLER_IN,
        fieldModificationNote: ECONOMIC_CORNER_BASE_NOTE,
        ...(input.styleId != null ? { styleId: input.styleId } : {}),
      } as PlacedCabinet;
      placed = placed.map((item) => (item.uid === base.uid ? swapped : item));
      placed.push(filler);
      // The upper above the old base follows it, so the doors stay lined up over the 3" filler.
      const upper = placed.find((item) => item.placement === "wall" && cabinetWall(item, room) === wallId
        && Math.abs(wallRunOffset(item, wallId, room) - atEdge.start) <= 0.06
        && Math.abs(wallRunSpan(item, wallId, room) - width) <= 0.06);
      const upperFamily = upper ? familyOf(upper.masterCode) : null;
      const upperRow = upper && upperFamily
        ? (input.wallCatalog ?? []).find((row) => familyOf(row.masterCode) === upperFamily
          && Math.abs(Number(row.width) - newWidth) <= 0.01
          && Math.abs((Number(row.height) || 0) - (Number(upper.height) || 0)) <= 0.6
          && Math.abs((Number(row.depth) || 12) - (Number(upper.depth) || 12)) <= 0.6
          && !/corner|blind|diagonal|filler|panel/i.test(`${row.masterCode} ${row.description ?? ""}`))
        : null;
      const wallFiller = catalogFillerForGap(input.catalogFillers, ECONOMY_CORNER_FILLER_IN, "wall");
      if (upper && upperRow && wallFiller) {
        const uDepth = Number(upper.depth) || 12;
        const uSpot = wallPlacementAt(baseStart, newWidth, uDepth, wallId, room, null, false);
        placed = placed.map((item) => (item.uid === upper.uid ? {
          ...upper, cabinetId: upperRow.id, masterCode: upperRow.masterCode, description: upperRow.description ?? upper.description,
          width: newWidth, nominalWidth: newWidth, x: uSpot.x, y: uSpot.y, wallOffset: uSpot.wallOffset ?? baseStart,
        } : item));
        const wSpot = wallPlacementAt(fillerStart, ECONOMY_CORNER_FILLER_IN, uDepth, wallId, room, null, false);
        placed.push({
          ...filler, uid: input.makeUid(), cabinetId: Number(wallFiller.id), masterCode: wallFiller.masterCode,
          description: wallFiller.description ?? filler.description, placement: "wall", x: wSpot.x, y: wSpot.y,
          depth: uDepth, height: Number(upper.height) || 30, nominalHeight: Number(upper.height) || 30, nominalDepth: uDepth,
          mountBottom: upper.mountBottom, wallOffset: wSpot.wallOffset ?? fillerStart,
          fillerPieceGroupId: `economy-corner:${corner.label}:${wallId}:wall`,
          fieldModificationNote: ECONOMIC_CORNER_WALL_NOTE,
        } as PlacedCabinet);
        notes.push(`${corner.label}: economy corner on ${wallId} — the upper ${upper.masterCode} above it became ${upperRow.masterCode} with a ${wallFiller.masterCode} 3″ filler, so the doors stay lined up.`);
      }
      notes.push(`${corner.label}: economy corner on ${wallId} — the 3″ ${fillerRow.masterCode} clearance filler was claimed first, so ${base.masterCode} (${width}″) became ${narrower.masterCode} (${newWidth}″): 24″ square + 3″ filler = the 27″ corner footprint.`);
    }
  }
  return { placed, notes };
}
