import { autoFillSpan, type FillItem } from "./autofill";
import {
  catalogFillerForGap,
  fittedCatalogFillerDescription,
  type CatalogFillerCandidate,
} from "./catalogFiller";
import {
  COLLISION_EPSILON_IN, STD, WALL_OPENING_CLEARANCE_IN, appendCollisionFreePlacements,
  cabinetPlacementCollisionDetail, cabinetWall, dim, freeSegmentsOnWall, isRangeOrOven, isRefrigerator,
  isSinkBaseCabinet, matchInstalledFillerToCabinet, wallPlacementAt, wallRunFrame, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening,
} from "./design";
import { installedFillerVerticalSpec } from "./smallGapFiller";

/** A seam narrower than this is tape-measure noise, not a gap. */
export const SEAM_MIN_IN = 0.125;
/** One catalog filler is cut at most this wide; wider openings are split in two (up to 12 inches) or tiled with cabinets. */
export const SEAM_MAX_FILLER_IN = 6;
/** A range always has a real cabinet at least this wide on each side. */
export const RANGE_NEIGHBOR_MIN_WIDTH_IN = 15;

const EDGE_TOL_IN = 0.02;

export type SeamLayer = "base" | "wall";
export type SeamPiece = { start: number; end: number };
export type FourAnchorSeam = {
  wall: string;
  start: number;
  end: number;
  /** The placed item that ends exactly where the seam starts, if any. */
  left: PlacedCabinet | null;
  /** The placed item that starts exactly where the seam ends, if any. */
  right: PlacedCabinet | null;
};

const wallOf = (item: PlacedCabinet, room: RoomData) => cabinetWall(item, room) as string;
const startOf = (item: PlacedCabinet, wall: string, room: RoomData) => wallRunOffset(item, wall, room);
const endOf = (item: PlacedCabinet, wall: string, room: RoomData) => wallRunOffset(item, wall, room) + wallRunSpan(item, wall, room);

/** A refrigerator, its two end panels and its cabinet above are one assembly; the 1/2-inch clearances inside it are deliberate. */
function assemblyKey(item: PlacedCabinet): string | null {
  if (item.refrigeratorAssemblyId) return item.refrigeratorAssemblyId;
  return item.placement === "appliance" && isRefrigerator(item) ? item.uid : null;
}

function isLayerItem(item: PlacedCabinet, layer: SeamLayer): boolean {
  if (item.islandFace) return false;
  if (layer === "base") return !/hood/i.test(item.masterCode ?? "") && (item.placement === "base" || item.placement === "appliance" || item.placement === "tall");
  return item.placement === "wall" || item.placement === "tall" || /hood/i.test(item.masterCode ?? "");
}

/** Which wall ends sit at a vertex that a chosen corner cabinet owns (its pocket is never a gap). */
function cornerOwnsWallEnd(wall: string, room: RoomData, corners: readonly { x: number; y: number }[], at: "start" | "end"): boolean {
  const frame = wallRunFrame(wall, room);
  if (!frame) return false;
  const vertex = at === "start" ? frame.start : frame.end;
  return corners.some((point) => Math.hypot(point.x - vertex.x, point.y - vertex.y) <= 0.05);
}

function subtractPieces(pieces: SeamPiece[], zones: readonly SeamPiece[]): SeamPiece[] {
  let out = pieces;
  for (const zone of zones) {
    out = out.flatMap((piece) => {
      if (zone.end <= piece.start + EDGE_TOL_IN || zone.start >= piece.end - EDGE_TOL_IN) return [piece];
      const parts: SeamPiece[] = [];
      if (zone.start > piece.start + EDGE_TOL_IN) parts.push({ start: piece.start, end: zone.start });
      if (zone.end < piece.end - EDGE_TOL_IN) parts.push({ start: zone.end, end: piece.end });
      return parts;
    });
  }
  return out;
}

/**
 * Every opening between the pieces of a finished wall layer, found with the same
 * run engine placement uses. Deliberate spaces are never reported: a refrigerator
 * assembly's own clearances, a chosen corner cabinet's pocket, and the zones the
 * caller reserves (above the range, above the sink).
 */
export function findFourAnchorSeams(input: {
  layer: SeamLayer;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  corners?: readonly { x: number; y: number }[];
  /** Per-wall spans that must stay empty (wall layer: over the range and sink). */
  reservedZones?: (wall: string) => readonly SeamPiece[];
}): FourAnchorSeam[] {
  const { layer, room } = input;
  const placed = [...input.placed];
  const corners = input.corners ?? [];
  const walls = Array.from(new Set(placed.filter((item) => isLayerItem(item, "base") || isLayerItem(item, "wall")).map((item) => wallOf(item, room))));
  const seams: FourAnchorSeam[] = [];
  const probeDepth = layer === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH;
  for (const wall of walls) {
    const frame = wallRunFrame(wall, room);
    if (!frame) continue;
    const items = placed.filter((item) => isLayerItem(item, layer) && wallOf(item, room) === wall);
    if (!items.length) continue;
    const clearance = layer === "wall" ? WALL_OPENING_CLEARANCE_IN : 0;
    const openingZones = input.openings.filter((opening) => opening.side === wall)
      .map((opening) => ({ start: opening.offset - clearance, end: opening.offset + opening.width + clearance }));
    const reserved = [...(input.reservedZones?.(wall) ?? [])];
    const zones = [...openingZones, ...reserved];
    const raw = freeSegmentsOnWall(wall as never, room, placed, [...input.openings], SEAM_MIN_IN, clearance, layer, layer === "wall", undefined, probeDepth)
      .map((segment) => ({ start: segment.start, end: segment.start + segment.length }));
    // A cabinet on an ADJOINING wall (the 12-inch corner upper, a corner box's leg) can
    // occupy the end of this run without being one of its items. Trim the run to what a
    // real cabinet could occupy, and remember that the trimmed end is bounded by something.
    const probe = (start: number, width: number) => {
      const spot = wallPlacementAt(start, width, probeDepth, wall as never, room);
      if (!spot) return true;
      // Filler-shaped on purpose: flat stock is exempt from the 6-inch minimum box size, so the probe
      // measures the true opening rather than a 6-inch cabinet.
      const candidate = {
        uid: "__seam_probe__", cabinetId: 0, masterCode: "FILL-PROBE", description: "seam probe filler", category: "Filler",
        subCategory: "Filler", placement: layer, ...spot, width, depth: probeDepth,
        height: layer === "wall" ? 30 : STD.BASE_HEIGHT, mountBottom: layer === "wall" ? 54 : 0, numberOfDoors: 0, numberOfDrawers: 0,
      } as PlacedCabinet;
      return cabinetPlacementCollisionDetail(candidate, placed, room) != null;
    };
    const trimmedStart = new Set<number>();
    const trimmedEnd = new Set<number>();
    let pieces = subtractPieces(raw, reserved).flatMap((piece) => {
      let { start, end } = piece;
      let cutStart = false;
      let cutEnd = false;
      while (end - start >= SEAM_MIN_IN && probe(start, SEAM_MIN_IN)) { start += SEAM_MIN_IN; cutStart = true; }
      while (end - start >= SEAM_MIN_IN && probe(end - SEAM_MIN_IN, SEAM_MIN_IN)) { end -= SEAM_MIN_IN; cutEnd = true; }
      if (end - start < SEAM_MIN_IN) return [];
      if (cutStart) trimmedStart.add(Math.round(start * 1000));
      if (cutEnd) trimmedEnd.add(Math.round(end * 1000));
      return [{ start, end }];
    });
    for (const piece of pieces) {
      if (piece.end - piece.start < SEAM_MIN_IN) continue;
      const left = items.find((item) => Math.abs(endOf(item, wall, room) - piece.start) <= EDGE_TOL_IN) ?? null;
      const right = items.find((item) => Math.abs(startOf(item, wall, room) - piece.end) <= EDGE_TOL_IN) ?? null;
      const edge = (side: "left" | "right"): "item" | "wall" | "zone" | "blocked" => {
        const neighbor = side === "left" ? left : right;
        const at = side === "left" ? piece.start : piece.end;
        if (neighbor) return "item";
        if ((side === "left" ? trimmedStart : trimmedEnd).has(Math.round(at * 1000))) return "item";
        if (zones.some((zone) => Math.abs((side === "left" ? zone.end : zone.start) - at) <= EDGE_TOL_IN)) return "zone";
        if (side === "left" && Math.abs(at - frame.runStart) <= EDGE_TOL_IN) {
          return cornerOwnsWallEnd(wall, room, corners, "start") ? "blocked" : "wall";
        }
        if (side === "right" && Math.abs(at - frame.runEnd) <= EDGE_TOL_IN) {
          return cornerOwnsWallEnd(wall, room, corners, "end") ? "blocked" : "wall";
        }
        return "blocked";
      };
      if (edge("left") === "blocked" || edge("right") === "blocked") continue;
      const leftKey = left ? assemblyKey(left) : null;
      if (leftKey && leftKey === (right ? assemblyKey(right) : null)) continue;
      seams.push({ wall, start: piece.start, end: piece.end, left, right });
    }
  }
  return seams;
}

/** The neighbor whose elevation and depth an installed filler matches: a real cabinet first, then an appliance, a filler last. */
export function seamOwner(seam: Pick<FourAnchorSeam, "left" | "right">, layer: SeamLayer): { owner: PlacedCabinet; ownerIsLeft: boolean } | null {
  const isFill = (item: PlacedCabinet) => isFillerLike(item);
  const cabinet = (item: PlacedCabinet | null) => item != null && !isFill(item)
    && (layer === "wall" ? item.placement === "wall" && !/hood/i.test(item.masterCode ?? "") : item.placement === "base" || item.placement === "tall");
  if (cabinet(seam.left)) return { owner: seam.left!, ownerIsLeft: true };
  if (cabinet(seam.right)) return { owner: seam.right!, ownerIsLeft: false };
  if (layer === "wall") return null;
  const appliance = (item: PlacedCabinet | null) => item != null && item.placement === "appliance";
  if (appliance(seam.left)) return { owner: seam.left!, ownerIsLeft: true };
  if (appliance(seam.right)) return { owner: seam.right!, ownerIsLeft: false };
  if (seam.left) return { owner: seam.left, ownerIsLeft: true };
  if (seam.right) return { owner: seam.right, ownerIsLeft: false };
  return null;
}

/** One real catalog filler cut to `width`, seated on the wall run at `start`, matched to its neighbor. Null when the line sells no filler that wide. */
export function makeSeamFiller(input: {
  fillers: readonly CatalogFillerCandidate[];
  owner: PlacedCabinet;
  wall: string;
  start: number;
  width: number;
  /** Which side of its owner the filler is installed on. */
  side: "left" | "right";
  totalWidth: number;
  groupId: string;
  role: "primary" | "secondary";
  mode: "left" | "right" | "split";
  room: RoomData;
  makeUid: () => string;
  styleId: number | null;
}): PlacedCabinet | null {
  const { owner, room } = input;
  const layer = owner.placement === "wall" ? "wall" : owner.placement === "tall" ? "tall" : "base";
  const def = catalogFillerForGap(input.fillers, input.mode === "split" ? input.totalWidth / 2 : input.width, layer);
  if (!def) return null;
  const depth = dim(def.depth, layer === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH);
  const ownerHeight = Number.isFinite(Number(owner.height)) ? Number(owner.height) : layer === "wall" ? STD.WALL_HEIGHT : STD.BASE_HEIGHT;
  const height = installedFillerVerticalSpec(layer, ownerHeight).storedHeight;
  const draft: PlacedCabinet = {
    uid: input.makeUid(), cabinetId: def.id, masterCode: def.masterCode,
    description: `${fittedCatalogFillerDescription(def, input.totalWidth)} — install on ${input.side}`,
    category: def.category ?? "Filler", subCategory: def.subCategory ?? "Filler",
    placement: layer, x: 0, y: 0, width: input.width, nominalWidth: dim(def.width, input.width),
    depth, nominalDepth: depth, height, nominalHeight: Number(def.height) || height, rotation: 0,
    numberOfDoors: 0, numberOfDrawers: 0, catalogImageUrl: def.catalogImageUrl ?? null, styleId: input.styleId,
    fillerPieceGroupId: input.groupId, fillerBillingRole: input.role, fillerTotalWidth: input.totalWidth,
    fillerPlacementMode: input.mode, fillerForCabinetUid: owner.uid,
  };
  const matched = matchInstalledFillerToCabinet(draft, owner, room);
  const spot = wallPlacementAt(input.start, input.width, matched.depth, input.wall as never, room);
  if (!spot) return null;
  return {
    ...matched, x: spot.x, y: spot.y, rotation: spot.rotation,
    ...(spot.wallId ? { wallId: spot.wallId, wallOffset: spot.wallOffset, peninsulaSide: spot.peninsulaSide } : {}),
  };
}

/** The exact width a seam takes: never rounded up, so a filler can never overlap a neighbor. */
const exactWidth = (value: number) => Math.floor(value * 16 + 1e-6) / 16;

function isFillerLike(item: Pick<PlacedCabinet, "masterCode" | "description" | "subCategory" | "fillerPieceGroupId">): boolean {
  return Boolean(item.fillerPieceGroupId) || /filler|scribe/i.test(`${item.masterCode} ${item.description ?? ""} ${item.subCategory ?? ""}`);
}

/**
 * The filler boards that close an opening: one board up to 6 inches, two equal
 * boards (a split) up to 12, nothing for tape-measure noise, null when wider.
 */
export function seamFillerWidths(width: number): number[] | null {
  const w = exactWidth(width);
  if (w < SEAM_MIN_IN) return [];
  if (w <= SEAM_MAX_FILLER_IN + COLLISION_EPSILON_IN) return [w];
  if (w <= SEAM_MAX_FILLER_IN * 2 + COLLISION_EPSILON_IN) {
    const half = exactWidth(w / 2);
    return [half, exactWidth(w - half)];
  }
  return null;
}

/**
 * Closes one seam of 12 inches or less with real catalog filler: one board up to
 * 6 inches, or two equal boards (a split) up to 12. Returns the pieces without placing them.
 */
export function fillersForSeam(input: {
  seam: FourAnchorSeam; layer: SeamLayer; fillers: readonly CatalogFillerCandidate[];
  room: RoomData; makeUid: () => string; styleId: number | null;
}): { pieces: PlacedCabinet[] } | { error: string } {
  const { seam, layer, room } = input;
  const width = exactWidth(seam.end - seam.start);
  const picked = seamOwner(seam, layer);
  if (!picked) return { error: `${width}″ opening on the ${seam.wall} wall has no neighboring cabinet to match.` };
  const { owner, ownerIsLeft } = picked;
  const side = ownerIsLeft ? "right" : "left";
  const widths = seamFillerWidths(width);
  if (widths == null) return { error: `A ${width}″ opening on the ${seam.wall} wall is wider than a filler and needs a cabinet.` };
  if (!widths.length) return { pieces: [] };
  const split = widths.length > 1;
  const groupId = `filler-group-${input.makeUid()}`;
  let at = seam.start;
  const pieces: PlacedCabinet[] = [];
  for (let index = 0; index < widths.length; index += 1) {
    const piece = makeSeamFiller({
      fillers: input.fillers, owner, wall: seam.wall, start: at, width: widths[index]!, side, totalWidth: width,
      groupId, role: index === 0 ? "primary" : "secondary", mode: split ? "split" : side === "right" ? "right" : "left",
      room, makeUid: input.makeUid, styleId: input.styleId,
    });
    if (!piece) return { error: `No source-priced filler is sold for the ${width}″ opening on the ${seam.wall} wall.` };
    pieces.push(piece);
    at += widths[index]!;
  }
  return { pieces };
}

/**
 * Where lower cabinets stand along a wall: every floor item assigned to it, plus the
 * leg a selected corner cabinet reaches along it from the shared vertex. The upper
 * layer is only ever tiled above this, never across a blank wall.
 */
export function lowerCoverageOnWall(
  placed: readonly PlacedCabinet[], room: RoomData, wall: string,
  corners: ReadonlyArray<{ base: PlacedCabinet; point: { x: number; y: number } }> = [],
): SeamPiece[] {
  const spans: SeamPiece[] = placed
    .filter((item) => isLayerItem(item, "base") && !item.islandFace && wallOf(item, room) === wall)
    .map((item) => ({ start: startOf(item, wall, room), end: endOf(item, wall, room) }));
  const frame = wallRunFrame(wall, room);
  if (frame) {
    for (const { base, point } of corners) {
      const reach = Math.max(0, Number(base.depth) || STD.BASE_DEPTH);
      if (Math.hypot(point.x - frame.start.x, point.y - frame.start.y) <= 0.05) spans.push({ start: frame.runStart, end: frame.runStart + reach });
      if (Math.hypot(point.x - frame.end.x, point.y - frame.end.y) <= 0.05) spans.push({ start: frame.runEnd - reach, end: frame.runEnd });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const merged: SeamPiece[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end + EDGE_TOL_IN) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

/** The parts of `piece` that lie inside `cover`. */
export function intersectWithCoverage(piece: SeamPiece, cover: readonly SeamPiece[]): SeamPiece[] {
  return cover
    .map((span) => ({ start: Math.max(piece.start, span.start), end: Math.min(piece.end, span.end) }))
    .filter((part) => part.end - part.start >= SEAM_MIN_IN);
}

/**
 * Lower layer: no gap is left anywhere between measured anchors, panels, corners and
 * runs. Every opening up to 12 inches takes real catalog filler; the 3-inch seam a
 * range leaves beside its corner cabinet is one of them.
 */
export function fillFourAnchorLowerSeams(input: {
  placed: PlacedCabinet[]; room: RoomData; openings: readonly WallOpening[];
  fillers: readonly CatalogFillerCandidate[]; makeUid: () => string; styleId: number | null;
  corners?: readonly { x: number; y: number }[];
}): { placed: PlacedCabinet[]; additions: PlacedCabinet[]; notes: string[] } {
  let working = [...input.placed];
  const additions: PlacedCabinet[] = [];
  const notes: string[] = [];
  const seams = findFourAnchorSeams({ layer: "base", placed: working, room: input.room, openings: input.openings, corners: input.corners });
  for (const seam of seams) {
    const result = fillersForSeam({ seam, layer: "base", fillers: input.fillers, room: input.room, makeUid: input.makeUid, styleId: input.styleId });
    if ("error" in result) { notes.push(result.error); continue; }
    const accepted = appendCollisionFreePlacements(working, result.pieces, input.room);
    if (accepted.rejected.length) { notes.push(`The ${exactWidth(seam.end - seam.start)}″ filler on the ${seam.wall} wall could not be seated without overlap.`); continue; }
    working = accepted.placed;
    additions.push(...result.pieces);
  }
  return { placed: working, additions, notes };
}

/** Spans on a wall that must stay empty in the upper layer: over the range, over the sink, and the whole refrigerator assembly. */
export function upperReservedZones(placed: readonly PlacedCabinet[], room: RoomData): (wall: string) => SeamPiece[] {
  return (wall: string) => {
    const zones: SeamPiece[] = [];
    const fridge: SeamPiece[] = [];
    for (const item of placed) {
      if (item.islandFace || wallOf(item, room) !== wall) continue;
      const span = { start: startOf(item, wall, room), end: endOf(item, wall, room) };
      if ((item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description))
        || (item.placement === "base" && isSinkBaseCabinet(item))) zones.push(span);
      if (assemblyKey(item) && item.placement !== "wall") fridge.push(span);
    }
    if (fridge.length) zones.push({ start: Math.min(...fridge.map((z) => z.start)), end: Math.max(...fridge.map((z) => z.end)) });
    return zones;
  };
}

/**
 * Chooses and orders the cabinets for one base-run segment (first item sits at
 * the segment start). Largest-first minimizes filler. A segment that touches a
 * range puts its widest cabinet beside the range, and that neighbor must be at
 * least 15 inches; a restricted plan from only 15-inch-or-wider boxes is used
 * when the free mix would put something narrower there. A narrower neighbor is
 * reported only when the segment itself is too short to do better. Filler goes
 * at the end away from the range.
 */
export function planFourAnchorBaseSegment(input: {
  length: number; catalog: DesignCabinet[]; rangeAtStart: boolean; rangeAtEnd: boolean;
}): { items: FillItem[]; note: string | null } {
  const free = autoFillSpan(input.length, "kitchen", input.catalog, { strategy: "largest-first" });
  const arrange = (items: FillItem[]): FillItem[] => {
    const cabinets = items.filter((item) => !item.isFiller).sort((a, b) => b.width - a.width);
    const fillers = items.filter((item) => item.isFiller);
    if (input.rangeAtStart && input.rangeAtEnd) {
      if (cabinets.length >= 2) return [cabinets[0]!, ...cabinets.slice(2), ...fillers, cabinets[1]!];
      return [...cabinets, ...fillers];
    }
    if (input.rangeAtEnd) return [...fillers, ...[...cabinets].reverse()];
    return [...cabinets, ...fillers];
  };
  const arranged = arrange(free.items);
  if (!input.rangeAtStart && !input.rangeAtEnd) return { items: arranged, note: null };
  const beside = (items: FillItem[]): FillItem[] => {
    const out: FillItem[] = [];
    if (input.rangeAtStart && items.length) out.push(items[0]!);
    if (input.rangeAtEnd && items.length) out.push(items[items.length - 1]!);
    return out;
  };
  const ok = (items: FillItem[]) => items.length > 0
    && beside(items).every((item) => !item.isFiller && item.width >= RANGE_NEIGHBOR_MIN_WIDTH_IN - COLLISION_EPSILON_IN);
  if (ok(arranged)) return { items: arranged, note: null };
  const wide = input.catalog.filter((candidate) => dim(candidate.width, 0) >= RANGE_NEIGHBOR_MIN_WIDTH_IN - COLLISION_EPSILON_IN);
  const restricted = autoFillSpan(input.length, "kitchen", wide, { strategy: "largest-first" });
  const restrictedArranged = arrange(restricted.items);
  if (ok(restrictedArranged) && restricted.leftoverInches <= free.leftoverInches + 0.01) {
    return { items: restrictedArranged, note: null };
  }
  return {
    items: arranged,
    note: `The run beside the range is only ${Math.round(input.length * 100) / 100}″, so its neighbor is narrower than ${RANGE_NEIGHBOR_MIN_WIDTH_IN}″.`,
  };
}
