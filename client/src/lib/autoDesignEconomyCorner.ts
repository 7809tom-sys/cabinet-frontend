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
  bearsCountertop,
  cabinetWall,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
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

/**
 * The 27″ footprint span of one leg of an economic corner, in the wall-run frame (null when the wall has
 * no run frame). Used to reserve the whole footprint — 24″ void + 3″ filler seat — before the base fill.
 */
export function economyCornerClaimSpan(wallId: WallSide, corner: { x: number; y: number }, room: RoomData): { wallId: string; start: number; end: number } | null {
  const frame = wallRunFrame(wallId, room);
  if (!frame) return null;
  const atStart = Math.hypot(frame.start.x - corner.x, frame.start.y - corner.y)
    <= Math.hypot(frame.end.x - corner.x, frame.end.y - corner.y);
  return atStart
    ? { wallId, start: frame.runStart, end: Math.min(frame.runEnd, frame.runStart + ECONOMY_CORNER_FOOTPRINT_IN) }
    : { wallId, start: Math.max(frame.runStart, frame.runEnd - ECONOMY_CORNER_FOOTPRINT_IN), end: frame.runEnd };
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
  /** Room openings: the upper row over the corner seat stops at a window or door edge (never a cabinet over a window). */
  openings?: readonly WallOpening[];
}): { placed: PlacedCabinet[]; notes: string[]; warnings: string[] } {
  const { room } = input;
  let placed = [...input.placed];
  const notes: string[] = [];
  const warnings: string[] = [];
  const fillerRow = catalogFillerForGap(input.catalogFillers, ECONOMY_CORNER_FILLER_IN, "base");
  if (!fillerRow) return { placed, notes, warnings };
  const fillerDepth = Number(fillerRow.depth) > 6 ? Number(fillerRow.depth) : STD.BASE_DEPTH;
  // Which end of the 3″ board meets the open 24″ void, in the board's own frame (the plan draws the 45° cut there).
  const miteredEndFor = (wallId: WallSide, atStart: boolean): "start" | "end" => {
    const frame = wallRunFrame(wallId, room);
    const base = frame ? frame.runStart + 10 : 10;
    const a = wallPlacementAt(base, 1, fillerDepth, wallId, room, null, false);
    const b = wallPlacementAt(base + 10, 1, fillerDepth, wallId, room, null, false);
    const dx = b.x - a.x, dy = b.y - a.y;
    const radians = ((a.rotation ?? 0) * Math.PI) / 180;
    const along = (atStart ? -1 : 1) * (dx * Math.cos(radians) + dy * Math.sin(radians));
    return along < 0 ? "start" : "end";
  };
  const buildBaseFiller = (label: string, wallId: WallSide, fillerStart: number, atStart: boolean): PlacedCabinet => {
    const spot = wallPlacementAt(fillerStart, ECONOMY_CORNER_FILLER_IN, fillerDepth, wallId, room, null, false);
    return {
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
      fillerPieceGroupId: `economy-corner:${label}:${wallId}`,
      fillerTotalWidth: ECONOMY_CORNER_FILLER_IN,
      fieldModificationNote: ECONOMIC_CORNER_BASE_NOTE,
      // The 45° cut on the end at the open void (Tom, Nov 19 2026): carried as data so the plan draws it, not only the note.
      fillerMiterAngle: 45,
      fillerMiteredEnd: miteredEndFor(wallId, atStart),
      ...(input.styleId != null ? { styleId: input.styleId } : {}),
    } as PlacedCabinet;
  };
  const familyOf = (code: string) => (code.toUpperCase().replace(/[^A-Z0-9]/g, "").match(/^(\d*[A-Z]+)\d/)?.[1] ?? null);
  const wallFillerRow = catalogFillerForGap(input.catalogFillers, ECONOMY_CORNER_FILLER_IN, "wall");
  // An opening's span in the wall-run frame (the frame the corner math works in), via the same wall mapping the cabinets use.
  const openingRunSpans = (wallId: WallSide) => {
    const frame = wallRunFrame(wallId, room);
    const onWall = (input.openings ?? []).filter((o) => o.side === wallId);
    if (!frame || onWall.length === 0) return [] as Array<{ start: number; end: number; sill: number; height: number }>;
    const r0 = frame.runStart + 10;
    const p0 = wallPlacementAt(r0, 1, 12, wallId, room, null, false).wallOffset ?? r0;
    const p1 = wallPlacementAt(r0 + 10, 1, 12, wallId, room, null, false).wallOffset ?? r0 + 10;
    const forward = p1 >= p0;
    return onWall.map((o) => forward
      ? { start: o.offset - (p0 - r0), end: o.offset + o.width - (p0 - r0), sill: Number(o.sill) || 0, height: Number(o.height) || 0 }
      : { start: (p0 + r0 + 1) - (o.offset + o.width), end: (p0 + r0 + 1) - o.offset, sill: Number(o.sill) || 0, height: Number(o.height) || 0 });
  };
  // Upper row beside the filler seat (keep-clear, Tom, Nov 19 2026, 11:59 AM CT): the base row is clear to 27″, so the upper
  // row gets a 3″ filler over the seat and a stock upper over the rest of the span up to the next upper (no hole above the run).
  const seatUppers = (label: string, wallId: WallSide, atStart: boolean, seatStart: number, seatEnd: number): string | null => {
    if (!wallFillerRow) return null;
    const uppers = placed.filter((item) => item.placement === "wall" && cabinetWall(item, room) === wallId)
      .map((item) => { const start = wallRunOffset(item, wallId, room); return { item, start, end: start + wallRunSpan(item, wallId, room) }; });
    if (uppers.some((seen) => seen.start < seatEnd - 0.06 && seen.end > seatStart + 0.06)) return null;
    const neighbor = atStart
      ? uppers.filter((seen) => seen.start >= seatEnd - 0.06).sort((a, b) => a.start - b.start)[0]
      : uppers.filter((seen) => seen.end <= seatStart + 0.06).sort((a, b) => b.end - a.end)[0];
    if (!neighbor) return null;
    let gapStart = atStart ? seatEnd : neighbor.end;
    let gapEnd = atStart ? neighbor.start : seatStart;
    if (gapEnd - gapStart < -0.06 || gapEnd - gapStart > 60) return null;
    // Windows and doors (Tom, Nov 19 2026): the new upper never lands in an opening. The span stops at the opening's edge.
    const upperBottom = Number(neighbor.item.mountBottom) || 54;
    const upperTop = upperBottom + (Number(neighbor.item.height) || 30);
    const blockers = openingRunSpans(wallId).filter((o) => o.sill < upperTop - 0.01 && o.sill + o.height > upperBottom + 0.01
      && o.end > gapStart + 0.01 && o.start < gapEnd - 0.01);
    let heldOpen = false;
    if (blockers.length > 0) {
      heldOpen = true;
      if (atStart) gapEnd = Math.max(gapStart, Math.min(gapEnd, ...blockers.map((o) => o.start)));
      else gapStart = Math.min(gapEnd, Math.max(gapStart, ...blockers.map((o) => o.end)));
    }
    const span = gapEnd - gapStart;
    // Size the new upper from a full-height upper (a short bridge over the sink is not the model).
    const full = uppers.filter((seen) => (Number(seen.item.height) || 0) >= 29 && /^W\d/i.test(seen.item.masterCode) && !/^DCW|diagonal|corner/i.test(`${seen.item.masterCode} ${seen.item.description ?? ""}`))
      .sort((a, b) => Math.abs(a.start - gapStart) - Math.abs(b.start - gapStart))[0];
    const ref = full?.item ?? neighbor.item;
    const refGlass = Boolean(ref.glassDoor) || /GD$|glass/i.test(`${ref.masterCode} ${ref.description ?? ""}`);
    const uDepth = Number(ref.depth) || 12;
    const uHeight = Number(ref.height) || 30;
    const make = (along: number, width: number, row: { id: number | string; masterCode: string; description?: string | null }, asFiller: boolean, gapFiller = false): PlacedCabinet => {
      const spot = wallPlacementAt(along, width, uDepth, wallId, room, null, false);
      return {
        ...(asFiller ? buildBaseFiller(label, wallId, along, atStart) : {}),
        uid: input.makeUid(), cabinetId: Number(row.id), masterCode: row.masterCode,
        description: row.description ?? ref.description, category: asFiller ? "Filler" : ref.category, subCategory: asFiller ? "Filler" : ref.subCategory,
        placement: "wall", x: spot.x, y: spot.y, rotation: spot.rotation, width, nominalWidth: width,
        depth: uDepth, nominalDepth: uDepth, height: uHeight, nominalHeight: uHeight, mountBottom: ref.mountBottom,
        wallId: spot.wallId ?? wallId, wallOffset: spot.wallOffset ?? along, styleId: ref.styleId,
        ...(asFiller && gapFiller
          ? { numberOfDoors: 0, numberOfDrawers: 0, fillerPieceGroupId: `economy-corner-gap:${label}:${wallId}:wall`, fillerTotalWidth: width, fillerMiterAngle: null, fillerMiteredEnd: null }
          : asFiller
            ? { numberOfDoors: 0, numberOfDrawers: 0, fillerPieceGroupId: `economy-corner:${label}:${wallId}:wall`, fillerTotalWidth: ECONOMY_CORNER_FILLER_IN, fieldModificationNote: ECONOMIC_CORNER_WALL_NOTE }
            : { numberOfDoors: ref.numberOfDoors, numberOfDrawers: 0 }),
      } as PlacedCabinet;
    };
    const filler = make(seatStart, ECONOMY_CORNER_FILLER_IN, wallFillerRow, true);
    const upperFamily = familyOf(ref.masterCode);
    const row = (input.wallCatalog ?? []).find((r) => Math.abs(Number(r.width) - span) <= 0.01
      && (upperFamily ? familyOf(r.masterCode) === upperFamily : true)
      && Math.abs((Number(r.height) || 0) - uHeight) <= 0.6 && Math.abs((Number(r.depth) || 12) - uDepth) <= 0.6
      && (refGlass || !/GD$|glass/i.test(`${r.masterCode} ${r.description ?? ""}`))
      && !/corner|blind|diagonal|filler|panel/i.test(`${r.masterCode} ${r.description ?? ""}`))
      ?? (input.wallCatalog ?? []).find((r) => Math.abs(Number(r.width) - span) <= 0.01
        && Math.abs((Number(r.height) || 0) - uHeight) <= 0.6 && Math.abs((Number(r.depth) || 12) - uDepth) <= 0.6
        && (refGlass || !/GD$|glass/i.test(`${r.masterCode} ${r.description ?? ""}`))
        && !/corner|blind|diagonal|filler|panel/i.test(`${r.masterCode} ${r.description ?? ""}`));
    placed.push(filler);
    if (span > 0.06 && !row) {
      // No stock upper is exactly this wide: the widest one that fits, plus a filler of the (≤3″) remainder, as the base row does.
      const fits = (input.wallCatalog ?? []).filter((r) => Number(r.width) >= 12 && span - Number(r.width) >= -0.01 && span - Number(r.width) <= ECONOMY_CORNER_FILLER_IN + 0.01
        && (upperFamily ? familyOf(r.masterCode) === upperFamily : true)
        && Math.abs((Number(r.height) || 0) - uHeight) <= 0.6 && Math.abs((Number(r.depth) || 12) - uDepth) <= 0.6
        && (refGlass || !/GD$|glass/i.test(`${r.masterCode} ${r.description ?? ""}`))
        && !/corner|blind|diagonal|filler|panel/i.test(`${r.masterCode} ${r.description ?? ""}`)).sort((a, b) => Number(b.width) - Number(a.width))[0];
      const remainder = fits ? span - Number(fits.width) : 0;
      const remFiller = fits && remainder > 0.06 ? catalogFillerForGap(input.catalogFillers, remainder, "wall") : null;
      if (fits && (remainder <= 0.06 || remFiller)) {
        const cabStart = atStart ? gapStart : gapStart + remainder;
        placed.push(make(cabStart, Number(fits.width), fits, false));
        if (remFiller) placed.push(make(atStart ? gapStart + Number(fits.width) : gapStart, remainder, remFiller, true, true));
        return `${label}: economy corner on ${wallId} — upper row: ${wallFillerRow.masterCode} 3″ filler over the corner seat and a ${fits.masterCode} over the rest; the line sells no ${span}″ upper, so a ${remainder.toFixed(2).replace(/\.?0+$/, "")}″ filler closes the span, as in the base row.`;
      }
    }
    if (span > 0.06 && row) {
      placed.push(make(gapStart, span, row, false));
      return `${label}: economy corner on ${wallId} — upper row: ${wallFillerRow.masterCode} 3″ filler over the corner seat and a ${row.masterCode} (${span}″) over the rest, so no hole is left above the run.`;
    }
    if (heldOpen) {
      return `${label}: economy corner on ${wallId} — upper row: ${wallFillerRow.masterCode} 3″ filler over the corner seat; no upper is placed over the window or door beside it.`;
    }
    return span > 0.06
      ? `${label}: economy corner on ${wallId} — upper row: ${wallFillerRow.masterCode} 3″ filler over the corner seat; the line sells no ${span}″ upper for the ${span}″ beside it, so that span stays open.`
      : `${label}: economy corner on ${wallId} — upper row: ${wallFillerRow.masterCode} 3″ filler over the corner seat.`;
  };
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
      if (!atEdge) {
        // Keep-clear (Tom, Nov 19 2026, 11:59 AM CT): the footprint is reserved, so the first box beside it may start past
        // 27″. When nothing sits in the 3″ filler seat, the filler goes there on its own.
        const seatStart = atStart ? squareEdge : squareEdge - ECONOMY_CORNER_FILLER_IN;
        const seatEnd = seatStart + ECONOMY_CORNER_FILLER_IN;
        if (onLeg.some((seen) => seen.start < seatEnd - 0.06 && seen.end > seatStart + 0.06)) continue;
        if (onLeg.some((seen) => seen.item.fillerPieceGroupId?.startsWith("economy-corner:") && Math.abs(seen.start - seatStart) <= 0.06)) continue;
        // Only when the leg is a run with something after the seat (otherwise the corner is just an empty wall end).
        // The first box may start past the seat when a keep-clear slide was blocked or the sink cannot move (Tom, Nov 19
        // 2026, 1:06 PM CT: the countertop always covers the corner). A counter-bearing base within 24″ still gets the
        // filler, and the countertop bridges the open run between the filler and that base (warned below).
        const following = onLeg.filter((seen) => atStart ? seen.start >= seatEnd - 0.06 : seen.end <= seatStart + 0.06)
          .sort((a, b) => atStart ? a.start - b.start : b.end - a.end)[0];
        if (!following) continue;
        const openRun = atStart ? following.start - seatEnd : seatStart - following.end;
        if (openRun > 0.06 && (openRun > 24 || !bearsCountertop(following.item))) {
          if (openRun <= 24) warnings.push(`${corner.label}: economic corner on ${wallId} — ${(Math.round(openRun * 100) / 100).toString()}″ of open run sits between the corner and ${following.item.masterCode}, which is not a countertop-bearing cabinet, so the 3″ filler was not placed there.`);
          continue;
        }
        placed.push(buildBaseFiller(corner.label, wallId, seatStart, atStart));
        notes.push(`${corner.label}: economy corner on ${wallId} — the 3″ ${fillerRow.masterCode} filler sits in the corner seat beside the 24″ void; nothing else is in the 27″ footprint.`);
        if (openRun > 0.06) {
          warnings.push(`${corner.label}: economic corner on ${wallId} — ${(Math.round(openRun * 100) / 100).toString()}″ of open run is left between the corner filler and ${following.item.masterCode} (it could not slide clear or cannot move). The countertop bridges it; no filler over 3″ is added. Check the open floor under the top.`);
        }
        // The upper row over the seat: a 3″ upper filler, and a real upper over what is left up to the next upper.
        const upperNote = seatUppers(corner.label, wallId, atStart, seatStart, seatEnd);
        if (upperNote) notes.push(upperNote);
        continue;
      }
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
      const filler = buildBaseFiller(corner.label, wallId, fillerStart, atStart);
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
  return { placed, notes, warnings };
}
