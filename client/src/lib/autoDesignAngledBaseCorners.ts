/**
 * Close 135° base corners (Tom, owner voice, Nov 20 2026, 4:33 PM CT).
 *
 * The angled filler pair is measured from the cabinets (or appliances) that
 * actually terminate at the join. After that measurement is honest, this pass
 * seats each leg at the 45° filler setback when a real stock move can get
 * there, and grows a range-left B12 to B15/B18 when that lands flush on the
 * range without a leftover filler (the range may use its remaining wiggle).
 * The shared miter repair then cuts the pair from selected-line filler stock.
 * No SKU is invented.
 */
import { fortyFiveCornerSeat } from "./autoDesignFortyFiveCornerSeat";
import {
  cabinetPlacementCollisionDetail,
  cabinetWall,
  dim,
  isFillerItem,
  isRangeOrOven,
  isSinkBaseCabinet,
  wallLength,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

const EPS = 0.05;

export type CloseAngledBaseCornersResult = {
  placed: PlacedCabinet[];
  notes: string[];
};

function widthOf(row: { width?: string | number | null }): number {
  return dim(row.width == null ? null : String(row.width), 0);
}

function sameBand(item: PlacedCabinet): boolean {
  return item.placement === "base" || item.placement === "tall" || item.placement === "appliance";
}

function spanOf(item: PlacedCabinet, wallId: string, room: RoomData) {
  const start = wallRunOffset(item, wallId, room);
  return { start, end: start + wallRunSpan(item, wallId, room) };
}

function gapToVertex(item: PlacedCabinet, wallId: string, at: "start" | "end", wallLen: number, room: RoomData): number {
  const { start, end } = spanOf(item, wallId, room);
  return at === "start" ? start : wallLen - end;
}

function relocate(item: PlacedCabinet, wallId: string, nextStart: number, room: RoomData): PlacedCabinet {
  const width = wallRunSpan(item, wallId, room) || Number(item.width) || 0;
  const depth = Number(item.depth) || 0;
  const spot = wallPlacementAt(nextStart, width, depth, wallId as WallSide, room, item.peninsulaSide);
  return { ...item, ...spot, width, depth, rotation: spot.rotation };
}

function rangeGroupUids(range: PlacedCabinet, placed: readonly PlacedCabinet[], room: RoomData): Set<string> {
  const wallId = cabinetWall(range, room);
  const uids = new Set<string>([range.uid]);
  if (!wallId) return uids;
  const { start, end } = spanOf(range, wallId, room);
  for (const item of placed) {
    if (item.uid === range.uid || cabinetWall(item, room) !== wallId) continue;
    const s = spanOf(item, wallId, room);
    const over = s.start >= start - 0.5 && s.end <= end + 0.5;
    if (!over) continue;
    if (item.overRangeMicrowaveBridge === true || item.placement === "appliance" || /^HOOD/i.test(item.masterCode ?? "")) {
      uids.add(item.uid);
    }
  }
  return uids;
}

function nearestOccupant(
  placed: readonly PlacedCabinet[],
  wallId: string,
  at: "start" | "end",
  wallLen: number,
  room: RoomData,
): PlacedCabinet | null {
  const candidates = placed
    .filter((item) => !item.fillerPieceGroupId && sameBand(item) && !isFillerItem(item) && (item.wallId === wallId || cabinetWall(item, room) === wallId))
    .map((item) => ({ item, gap: gapToVertex(item, wallId, at, wallLen, room) }))
    .filter(({ gap }) => gap >= -0.5)
    .sort((left, right) => left.gap - right.gap);
  return candidates[0]?.item ?? null;
}

function growableBaseRows(catalog: readonly DesignCabinet[], height: number, depth: number, minWidth: number): DesignCabinet[] {
  return catalog
    .filter((row) => {
      const width = widthOf(row);
      const rowHeight = dim(row.height, 0);
      const rowDepth = dim(row.depth, 24);
      if (width + EPS < minWidth) return false;
      if (Math.abs(rowDepth - depth) > 0.5) return false;
      if (rowHeight && height && Math.abs(rowHeight - height) > 1) return false;
      const hay = `${row.masterCode} ${row.description} ${row.subCategory ?? ""}`;
      if (/filler|scribe|panel|corner|lazy|susan|blind|sink|SB\d|3DB|drawer/i.test(hay)) return false;
      // Range flanks stay a regular B12/B15/B18, never a drawer-base substitute.
      if (!/^B\d+/.test(row.masterCode ?? "")) return false;
      return row.placement === "base" || !row.placement;
    })
    .sort((left, right) => widthOf(left) - widthOf(right));
}

/**
 * When the cabinet beside a range can become B15/B18 (or another sold width)
 * and still sit on the 45° setback, flush to the range, with no leftover
 * filler, grow it. The range may slide inside its remaining wiggle.
 */
function growRangeNeighbor(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  wallId: string;
  at: "start" | "end";
  setbacks: number[];
  wallLen: number;
  catalog: readonly DesignCabinet[];
  rangeWiggleIn: (range: PlacedCabinet) => number;
}): { placed: PlacedCabinet[]; note: string } | null {
  const { room, wallId, at, wallLen, catalog } = input;
  const working = input.placed;
  const occupant = nearestOccupant(working, wallId, at, wallLen, room);
  if (!occupant || occupant.placement !== "base" || isSinkBaseCabinet(occupant) || isFillerItem(occupant)) return null;
  const occ = spanOf(occupant, wallId, room);
  const onWall = working
    .filter((item) => item.uid !== occupant.uid && (item.wallId === wallId || cabinetWall(item, room) === wallId))
    .map((item) => ({ item, ...spanOf(item, wallId, room) }));
  const neighbors = onWall.filter((row) => sameBand(row.item) || isFillerItem(row.item));
  const rangeEntry = (at === "start"
    ? neighbors.filter((row) => row.start >= occ.end - EPS).sort((a, b) => a.start - b.start)
    : neighbors.filter((row) => row.end <= occ.start + EPS).sort((a, b) => b.end - a.end)
  ).find((row) => row.item.placement === "appliance" && isRangeOrOven(row.item.masterCode, row.item.description));
  if (!rangeEntry) return null;
  const range = rangeEntry.item;
  const wiggle = Math.max(0, input.rangeWiggleIn(range));
  const rows = growableBaseRows(catalog, Number(occupant.height) || 34.5, Number(occupant.depth) || 24, 12);
  // Prefer B18 then B15 then the current width, at the tightest setback that
  // still lets a sold width land flush on the range with no leftover filler.
  const flushRows = [...rows].sort((left, right) => widthOf(right) - widthOf(left));
  const setbacks = input.setbacks.filter((value, index, all) => all.indexOf(value) === index).sort((a, b) => a - b);
  type Candidate = { row: DesignCabinet; width: number; setback: number; nextStart: number; rangeDelta: number };
  const candidates: Candidate[] = [];
  for (const setback of setbacks) {
    for (const row of flushRows) {
      const width = widthOf(row);
      const nextStart = at === "start" ? setback : (wallLen - setback) - width;
      if (nextStart < -EPS || nextStart + width > wallLen + EPS) continue;
      const nextEnd = nextStart + width;
      const rangeDelta = at === "start" ? nextEnd - rangeEntry.start : nextStart - rangeEntry.end;
      if (Math.abs(rangeDelta) > wiggle + EPS) continue;
      // Only grow B12 -> B15/B18 (or a similar sold step). Do not slide a
      // flank that is already a stock width just to hug the 45° setback —
      // that undoes the range-flank pack.
      if (width < (Number(occupant.width) || 0) + 3 - EPS) continue;
      candidates.push({ row, width, setback, nextStart, rangeDelta });
    }
  }
  candidates.sort((left, right) => {
    if (left.width !== right.width) return right.width - left.width;
    if (Math.abs(left.setback - right.setback) > EPS) return left.setback - right.setback;
    return Math.abs(left.rangeDelta) - Math.abs(right.rangeDelta);
  });
  for (const pick of candidates) {
    const { row, width, nextStart, rangeDelta } = pick;
    const depth = Number(occupant.depth) || dim(row.depth, 24);
    const spot = wallPlacementAt(nextStart, width, depth, wallId as WallSide, room, occupant.peninsulaSide);
    const grown: PlacedCabinet = {
      ...occupant,
      ...spot,
      cabinetId: row.id,
      masterCode: row.masterCode,
      description: row.description,
      category: row.category,
      subCategory: row.subCategory,
      width,
      depth,
      rotation: spot.rotation,
      numberOfDoors: row.numberOfDoors,
      numberOfDrawers: row.numberOfDrawers,
    };
    const group = rangeGroupUids(range, working, room);
    // The range's trailing pack (flank cabinet, end panel) slides with it so
    // the far side stays flush instead of colliding.
    const trail = new Set<string>(group);
    for (const rowOnWall of onWall) {
      if (rowOnWall.item.uid === occupant.uid) continue;
      const follows = at === "start" ? rowOnWall.start >= rangeEntry.start - EPS : rowOnWall.end <= rangeEntry.end + EPS;
      if (follows) trail.add(rowOnWall.item.uid);
    }
    const last = at === "start"
      ? Math.max(...working.filter((item) => trail.has(item.uid)).map((item) => spanOf(item, wallId, room).end), rangeEntry.end)
      : Math.min(...working.filter((item) => trail.has(item.uid)).map((item) => spanOf(item, wallId, room).start), rangeEntry.start);
    if (at === "start" && last + rangeDelta > wallLen + EPS) continue;
    if (at === "end" && last + rangeDelta < -EPS) continue;
    const trial = working.map((item) => {
      if (item.uid === occupant.uid) return grown;
      if (!trail.has(item.uid)) return item;
      const current = spanOf(item, wallId, room);
      return relocate(item, wallId, current.start + rangeDelta, room);
    });
    if (cabinetPlacementCollisionDetail(grown, trial.filter((item) => item.uid !== grown.uid), room)) continue;
    const movedRange = trial.find((item) => item.uid === range.uid);
    if (movedRange && cabinetPlacementCollisionDetail(movedRange, trial.filter((item) => !trail.has(item.uid) && item.uid !== grown.uid), room)) {
      continue;
    }
    const growNote = grown.masterCode === occupant.masterCode
      ? `${occupant.masterCode} sat on the 45° setback, flush to the range.`
      : `${occupant.masterCode} beside the range became ${grown.masterCode}, flush to the range with no leftover filler.`;
    const slideNote = Math.abs(rangeDelta) > EPS
      ? ` The ${range.masterCode} slid ${Math.round(Math.abs(rangeDelta) * 8) / 8}″ inside its wiggle to close that joint.`
      : "";
    return { placed: trial, note: growNote + slideNote };
  }
  return null;
}

function slideInvadingOccupant(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  wallId: string;
  at: "start" | "end";
  setback: number;
  wallLen: number;
}): { placed: PlacedCabinet[]; note: string } | null {
  const { room, wallId, at, setback, wallLen } = input;
  const occupant = nearestOccupant(input.placed, wallId, at, wallLen, room);
  if (!occupant) return null;
  const gap = gapToVertex(occupant, wallId, at, wallLen, room);
  const deficit = setback - gap;
  if (deficit <= EPS) return null;
  const occ = spanOf(occupant, wallId, room);
  // Look inward for a filler or bare gap that can give up the deficit.
  const inwardItems = input.placed
    .filter((item) => item.uid !== occupant.uid && (item.wallId === wallId || cabinetWall(item, room) === wallId))
    .map((item) => ({ item, ...spanOf(item, wallId, room) }));
  const inward = at === "start"
    ? inwardItems.filter((row) => row.start >= occ.end - EPS).sort((a, b) => a.start - b.start)
    : inwardItems.filter((row) => row.end <= occ.start + EPS).sort((a, b) => b.end - a.end);
  const first = inward[0];
  const inwardEdge = at === "start" ? occ.end : occ.start;
  const nextEdge = first ? (at === "start" ? first.start : first.end) : (at === "start" ? wallLen : 0);
  const free = at === "start" ? nextEdge - inwardEdge : inwardEdge - nextEdge;
  const takeFromFiller = first && isFillerItem(first.item) ? Math.max(0, (at === "start" ? first.end - first.start : first.end - first.start) - 0.125) : 0;
  const available = free + takeFromFiller;
  if (available + EPS < deficit) return null;
  const delta = at === "start" ? deficit : -deficit;
  let working = input.placed.map((item) => {
    if (item.uid !== occupant.uid) return item;
    const current = spanOf(item, wallId, room);
    return relocate(item, wallId, current.start + delta, room);
  });
  if (first && isFillerItem(first.item)) {
    const fillerWidth = first.end - first.start;
    const nextWidth = fillerWidth - Math.max(0, deficit - free);
    if (nextWidth <= 0.125) {
      working = working.filter((item) => item.uid !== first.item.uid);
    } else {
      const fillerStart = at === "start" ? first.start + deficit : first.start;
      working = working.map((item) => {
        if (item.uid !== first.item.uid) return item;
        const spot = wallPlacementAt(fillerStart, nextWidth, Number(item.depth) || 0, wallId as WallSide, room, item.peninsulaSide);
        return { ...item, ...spot, width: nextWidth, rotation: spot.rotation };
      });
    }
  }
  const moved = working.find((item) => item.uid === occupant.uid)!;
  if (cabinetPlacementCollisionDetail(moved, working.filter((item) => item.uid !== moved.uid), room)) return null;
  return {
    placed: working,
    note: `${occupant.masterCode} slid ${Math.round(deficit * 8) / 8}″ off the 45° corner on ${wallId} so the base miter can close from selected-line stock.`,
  };
}

export function closeAutoDesignAngledBaseCorners(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  baseCatalog: readonly DesignCabinet[];
  rangeWiggleIn?: (range: PlacedCabinet) => number;
}): CloseAngledBaseCornersResult {
  const { room, baseCatalog } = input;
  let working = [...input.placed];
  const notes: string[] = [];
  const rangeWiggleIn = input.rangeWiggleIn ?? (() => 0);
  const walls = new Set(
    working
      .filter((item) => sameBand(item) && (item.wallId || cabinetWall(item, room)))
      .map((item) => item.wallId ?? cabinetWall(item, room)!),
  );
  for (const wallId of walls) {
    const wallLen = wallLength(wallId as WallSide, room);
    if (!(wallLen > 0)) continue;
    for (const at of ["start", "end"] as const) {
      const seat = fortyFiveCornerSeat(room, wallId, at, "base");
      if (!seat) continue;

      const slid = slideInvadingOccupant({
        placed: working, room, wallId, at, setback: seat.cabinetSetbackIn, wallLen,
      });
      if (slid) {
        working = slid.placed;
        notes.push(slid.note);
      }
      const grown = growRangeNeighbor({
        placed: working, room, wallId, at,
        setbacks: [seat.frontMiterIn, seat.cabinetSetbackIn].filter((value) => value > 0),
        wallLen, catalog: baseCatalog, rangeWiggleIn,
      });
      if (grown) {
        working = grown.placed;
        notes.push(grown.note);
      }
    }
  }
  return { placed: working, notes };
}
