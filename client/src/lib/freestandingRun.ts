/**
 * Free-standing cabinet runs → the Continuous Wall Builder's code path.
 *
 * The Continuous Wall Builder (client/src/components/design/WallBuilder.tsx →
 * polygonRoom.wallBuilderRoomGeometry → room.customWalls / room.vertices)
 * already seats cabinets and builds the countertop for a run that turns 45°:
 *   • seat:       design.ts `wallPlacementAt()` (custom-wall branch)
 *   • slab:       design.ts `countertopSurfaces()` custom-wall branch
 *   • merge:      design.ts `mergeContiguousBaseCountertopRuns()`
 *   • 45° miter:  design.ts `measuredWallCountertopMiterSurfaces()` +
 *                 `miteredMeasuredWallCountertopSurfaces()`
 *
 * This module does NOT re-implement any of that. For bases standing in the
 * open room (no wall seat, not against a wall, not island/peninsula) it only:
 *   1. groups physically touching bodies into a chain,
 *   2. describes the chain's back line as the same wall model the Wall Builder
 *      emits (vertices + customWalls, diagonal segments `lockedAngle: ±45`,
 *      `openWallPath: true`),
 *   3. seats the chain's cabinets on those walls with `wallPlacementAt`, and
 *   4. calls `countertopSurfaces` on that synthetic room so the exact Wall
 *      Builder functions above produce the one mitered slab.
 *
 * Nothing here changes the Wall Builder's behaviour or any wall/peninsula/
 * island/pricing code.
 */
import {
  STD,
  cabinetPlanBodiesIntersect,
  cabinetWall,
  countertopSurfaces,
  countertopSurfacePlanPolygon,
  customWallCabinetSide,
  insideCornerHoldIn,
  isAgainstWall,
  isOnIsland,
  peninsulaRunById,
  placedCornerGeometryKind,
  placedFootprint,
  wallPlacementAt,
  wallRunAlongAtPoint,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type CountertopPlanPoint,
  type CountertopSurface,
  type IslandZone,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";

const EPS = 1e-6;
/** Two free-standing boxes count as touching when a pair of corners is within this gap. */
export const FREESTANDING_JOIN_TOLERANCE_IN = 1.5;

type Pt = CountertopPlanPoint;

export interface FreestandingBody {
  cabinet: PlacedCabinet;
  /** World centre of the rotated body. */
  center: Pt;
  width: number;
  depth: number;
  /** Plan rotation in radians (0 = front faces +y). */
  radians: number;
  /** Unit vector along the cabinet's width (left → right as seen from the front). */
  tangent: Pt;
  /** Unit vector from the back toward the front face. */
  forward: Pt;
}

function rot(p: Pt, radians: number): Pt {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}
function add(a: Pt, b: Pt): Pt { return { x: a.x + b.x, y: a.y + b.y }; }
function scale(a: Pt, k: number): Pt { return { x: a.x * k, y: a.y * k }; }
function dist(a: Pt, b: Pt): number { return Math.hypot(a.x - b.x, a.y - b.y); }

/** True when a standard base is in the open room: not seated, not against a wall, not on an island or peninsula. */
export function isFreestandingBase(cabinet: PlacedCabinet, room: RoomData, island?: IslandZone | null): boolean {
  if (cabinet.placement !== "base") return false;
  if (cabinet.wallId || cabinet.islandFace) return false;
  if (placedCornerGeometryKind(cabinet) !== "standard") return false;
  if (island && isOnIsland(cabinet, island)) return false;
  const nearest = cabinetWall(cabinet, room);
  if (nearest && isAgainstWall(cabinet, nearest as never, room)) return false;
  return !(["top", "bottom", "left", "right"] as const).some((side) => isAgainstWall(cabinet, side, room));
}

/**
 * A cabinet turned off the square axis — the angled cabinet of a 45° return.
 * It is the joint that turns a wall-attached run into a second leg, whichever
 * wall (or none) its own record still names.
 */
export function isAngledReturnCabinet(cabinet: PlacedCabinet): boolean {
  if (cabinet.placement !== "base" || cabinet.islandFace) return false;
  if (placedCornerGeometryKind(cabinet) !== "standard") return false;
  const rotation = ((Math.round(Number(cabinet.rotation) || 0) % 360) + 360) % 360;
  return rotation % 90 !== 0;
}

/**
 * True for a base that takes part in a free-standing chain: either a genuinely
 * unseated box, or an angled return cabinet that has come loose from its wall.
 *
 * The regular designer seats a run on the room wall and then drops the angled
 * return beside it. That angled box is not "free standing" by the strict test
 * (its AABB can still overlap the wall band), so without this the wall run and
 * the angled leg were topped as two independent pieces: two rectangular slabs
 * with a gap and no miter, and no two-piece 45° front filler, because neither
 * `snapFreestandingFortyFive` nor `measuredAngledWallTransition` had a pair to
 * measure. See issue 353 outcomes 3 and 4.
 */
export function participatesInFreestandingChain(cabinet: PlacedCabinet, room: RoomData, island?: IslandZone | null): boolean {
  if (island && isOnIsland(cabinet, island)) return false;
  if (isAngledReturnCabinet(cabinet)) {
    // The synthetic Continuous Wall Builder room re-enters `countertopSurfaces`,
    // where every chain member is already seated on a drawn wall. Only the real
    // room may promote an angled box into a chain.
    if (room.openWallPath) return false;
    // A genuine measured-wall seat is the Wall Builder's job, not the chain's.
    if (room.customWalls?.some((wall) => wall.id === cabinet.wallId)) return false;
    // A peninsula owns its own continuous slab and miter; the 45° leg of a
    // Wizard peninsula is not a loose cabinet.
    if (peninsulaRunById(room, cabinet.wallId ?? "")) return false;
    // A rotated body only touches a cardinal wall at one corner, so its
    // axis-aligned footprint cannot decide this. The join test does: an angled
    // box that reaches no run stays its own single-body chain.
    return true;
  }
  return isFreestandingBase(cabinet, room, island);
}

/**
 * True when this wall-seated cabinet belongs to a wall that a returned chain
 * continues. It is the anchor the angled leg is measured from, so the chain
 * builder can read the wall run's real frame instead of only the loose bodies.
 */
export function isChainWallAnchor(cabinet: PlacedCabinet, room: RoomData): boolean {
  if (cabinet.placement !== "base" || cabinet.islandFace) return false;
  if (placedCornerGeometryKind(cabinet) !== "standard") return false;
  return Boolean(cabinet.wallId);
}

/** Resolves the rotated body frame of a free-standing cabinet from its AABB record. */
export function freestandingBody(cabinet: PlacedCabinet): FreestandingBody {
  const footprint = placedFootprint(cabinet);
  const width = Math.max(0.01, Number(cabinet.width) || footprint.w);
  const depth = Math.max(0.01, Number(cabinet.depth) || footprint.d);
  const radians = ((((Number(cabinet.rotation) || 0) % 360) + 360) % 360) * Math.PI / 180;
  const center = { x: cabinet.x + footprint.w / 2, y: cabinet.y + footprint.d / 2 };
  return {
    cabinet,
    center,
    width,
    depth,
    radians,
    tangent: rot({ x: 1, y: 0 }, radians),
    forward: rot({ x: 0, y: 1 }, radians),
  };
}

/** The four world corners of the body: back-left, back-right, front-right, front-left. */
export function freestandingBodyCorners(body: FreestandingBody): [Pt, Pt, Pt, Pt] {
  const hw = body.width / 2;
  const hd = body.depth / 2;
  const t = body.tangent;
  const f = body.forward;
  const c = body.center;
  return [
    add(c, add(scale(t, -hw), scale(f, -hd))),
    add(c, add(scale(t, hw), scale(f, -hd))),
    add(c, add(scale(t, hw), scale(f, hd))),
    add(c, add(scale(t, -hw), scale(f, hd))),
  ];
}

/** Fitted filler the Wall Builder allows beside a 45° inside corner (design.ts FITTED_FORTY_FIVE_CORNER_FILLER_MAX_IN). */
const FORTY_FIVE_FILLER_MAX_IN = 3;

export interface FreestandingJoin {
  /** Shared wall vertex of the two runs (the Wall Builder's corner point). */
  vertex: Pt;
  /** Interior turn between the two headings in degrees: 0 (straight), 45, or 90. */
  turnDeg: number;
}

function headingOf(body: FreestandingBody): number {
  return Math.atan2(body.tangent.y, body.tangent.x);
}

function interiorTurnDeg(a: FreestandingBody, b: FreestandingBody): number {
  const raw = Math.abs(((headingOf(a) - headingOf(b) + Math.PI) % (2 * Math.PI)) - Math.PI);
  const interior = Math.min(raw, Math.abs(Math.PI - raw));
  return Math.round((interior * 180) / Math.PI);
}

/**
 * How two free-standing bodies meet, using the Continuous Wall Builder's own
 * corner rule: on a straight run their end corners touch; at a 45° turn each
 * leg is held `insideCornerHoldIn(45, depth)` back from the shared wall vertex
 * (plus up to one fitted filler), exactly as `freeSegmentsOnWall` seats them
 * on drawn walls. Returns null when the bodies are not joined.
 */
export function freestandingJoin(a: FreestandingBody, b: FreestandingBody): FreestandingJoin | null {
  const turnDeg = interiorTurnDeg(a, b);
  const ends = (body: FreestandingBody): Array<{ corner: Pt; outward: Pt }> => {
    const [bl, br] = freestandingBodyCorners(body);
    return [
      { corner: bl, outward: scale(body.tangent, -1) },
      { corner: br, outward: body.tangent },
    ];
  };
  let best: { vertex: Pt; distance: number } | null = null;
  for (const endA of ends(a)) {
    for (const endB of ends(b)) {
      if (turnDeg === 45) {
        const holdA = insideCornerHoldIn(45, a.depth);
        const holdB = insideCornerHoldIn(45, b.depth);
        for (const extraA of [0, FORTY_FIVE_FILLER_MAX_IN]) {
          for (const extraB of [0, FORTY_FIVE_FILLER_MAX_IN]) {
            const va = add(endA.corner, scale(endA.outward, holdA + extraA));
            const vb = add(endB.corner, scale(endB.outward, holdB + extraB));
            const distance = dist(va, vb);
            if (distance <= FREESTANDING_JOIN_TOLERANCE_IN && (!best || distance < best.distance)) {
              best = { vertex: { x: (va.x + vb.x) / 2, y: (va.y + vb.y) / 2 }, distance };
            }
          }
        }
      } else {
        const distance = dist(endA.corner, endB.corner);
        if (distance <= FREESTANDING_JOIN_TOLERANCE_IN && (!best || distance < best.distance)) {
          best = { vertex: { x: (endA.corner.x + endB.corner.x) / 2, y: (endA.corner.y + endB.corner.y) / 2 }, distance };
        }
      }
    }
  }
  return best ? { vertex: best.vertex, turnDeg } : null;
}

function bodiesJoin(a: FreestandingBody, b: FreestandingBody): boolean {
  return freestandingJoin(a, b) != null;
}

/** Groups free-standing bases into chains of physically touching bodies, ordered along the run. */
export function freestandingChains(placed: readonly PlacedCabinet[], room: RoomData, island?: IslandZone | null): FreestandingBody[][] {
  const bodies = placed.filter((cabinet) => participatesInFreestandingChain(cabinet, room, island)).map(freestandingBody);
  const unvisited = new Set(bodies.map((_, index) => index));
  const chains: FreestandingBody[][] = [];
  while (unvisited.size) {
    const seed = unvisited.values().next().value as number;
    unvisited.delete(seed);
    const members = [bodies[seed]!];
    let grew = true;
    while (grew) {
      grew = false;
      for (const index of Array.from(unvisited)) {
        if (members.some((member) => bodiesJoin(member, bodies[index]!))) {
          members.push(bodies[index]!);
          unvisited.delete(index);
          grew = true;
        }
      }
    }
    chains.push(orderChain(members));
  }
  return chains;
}

function orderChain(members: FreestandingBody[]): FreestandingBody[] {
  if (members.length <= 2) return members;
  const neighbours = members.map((member) => members.filter((other) => other !== member && bodiesJoin(member, other)));
  let startIndex = neighbours.findIndex((list) => list.length === 1);
  if (startIndex < 0) startIndex = 0;
  const ordered: FreestandingBody[] = [members[startIndex]!];
  const used = new Set<FreestandingBody>(ordered);
  while (ordered.length < members.length) {
    const last = ordered[ordered.length - 1]!;
    const next = neighbours[members.indexOf(last)]!.find((candidate) => !used.has(candidate));
    if (!next) break;
    ordered.push(next);
    used.add(next);
  }
  for (const member of members) if (!used.has(member)) ordered.push(member);
  return ordered;
}

function flipBody(body: FreestandingBody): FreestandingBody {
  return { ...body, radians: body.radians + Math.PI, tangent: scale(body.tangent, -1), forward: scale(body.forward, -1) };
}

/** Walk the chain so each body's right end meets the next body's left end. */
function orientChain(chain: FreestandingBody[]): FreestandingBody[] {
  if (chain.length < 2) return chain;
  const out: FreestandingBody[] = [];
  for (let index = 0; index < chain.length; index += 1) {
    const current = chain[index]!;
    if (index === 0) {
      const [bl, br] = freestandingBodyCorners(current);
      const nextCorners = freestandingBodyCorners(chain[1]!);
      const nearRight = Math.min(...nextCorners.map((p) => dist(p, br)));
      const nearLeft = Math.min(...nextCorners.map((p) => dist(p, bl)));
      out.push(nearRight <= nearLeft ? current : flipBody(current));
      continue;
    }
    const prev = out[index - 1]!;
    const [, pbr, pfr] = freestandingBodyCorners(prev);
    const [bl, br, fr, fl] = freestandingBodyCorners(current);
    const asIs = Math.min(dist(bl, pbr), dist(fl, pfr));
    const flipped = Math.min(dist(br, pbr), dist(fr, pfr));
    out.push(asIs <= flipped ? current : flipBody(current));
  }
  return out;
}


/**
 * `customWallCabinetSide` picks the cabinet side of an open wall path from its
 * first turn. When that side is opposite to where the bodies actually face,
 * walking the path backwards flips it — same walls, same vertices, same seat.
 */
function orientWallPathToFacing(
  vertices: Array<{ id: string; x: number; y: number }>,
  walls: NonNullable<RoomData["customWalls"]>,
  room: RoomData,
  forward: Pt,
): { vertices: typeof vertices; customWalls: typeof walls } {
  const probe: RoomData = { ...room, vertices, customWalls: walls, openWallPath: true, peninsulaRuns: undefined };
  const first = walls[0]!;
  const a = vertices.find((v) => v.id === first.startVertexId)!;
  const b = vertices.find((v) => v.id === first.endVertexId)!;
  const radians = Math.atan2(b.y - a.y, b.x - a.x);
  const leftNormal = { x: -Math.sin(radians), y: Math.cos(radians) };
  const side = customWallCabinetSide(probe, first.id);
  const inward = side === "left" ? leftNormal : scale(leftNormal, -1);
  if (inward.x * forward.x + inward.y * forward.y >= 0) return { vertices, customWalls: walls };
  const reversedVertices = [...vertices].reverse();
  const reversedWalls = [...walls].reverse().map((wall) => ({ ...wall, startVertexId: wall.endVertexId, endVertexId: wall.startVertexId }));
  return { vertices: reversedVertices, customWalls: reversedWalls };
}

/**
 * The Wall Builder room model for one chain: the chain's back line as an open
 * wall path. Consecutive bodies with the same heading share one wall segment;
 * a heading change starts a new segment at the shared back corner. Diagonal
 * segments carry `lockedAngle` exactly like `wallBuilderRoomGeometry` sets it,
 * which is what `customWallJoinTurnsFortyFive` keys on for the miter.
 */
export interface FreestandingWallModel {
  room: RoomData;
  /** Chain cabinets re-seated on the synthetic walls via `wallPlacementAt`. */
  seated: PlacedCabinet[];
  /** Every cabinet the model carries: the chain's own bodies plus any joined wall run. */
  memberUids: string[];
}

/**
 * The wall-seated run an angled chain leg continues.
 *
 * The regular designer keeps its straight bases seated on a real room wall; only
 * the angled return comes loose. The chain builder therefore has to open its
 * wall path with that wall's own back line, running from the far end of the
 * seated run up to the shared corner vertex — exactly the shape the Wall Builder
 * draws. Without this leg the angled cabinet is measured against nothing.
 */
function joinedWallRunLeg(
  chain: readonly FreestandingBody[],
  placed: readonly PlacedCabinet[],
  room: RoomData,
): { bodies: FreestandingBody[]; start: Pt; end: Pt; radians: number } | null {
  const angled = chain.find((body) => isAngledReturnCabinet(body.cabinet));
  if (!angled) return null;
  let best: {
    bodies: FreestandingBody[];
    start: Pt;
    end: Pt;
    radians: number;
    join: FreestandingJoin;
  } | null = null;
  const walls = Array.from(new Set(placed
    .filter((item) => isChainWallAnchor(item, room))
    .map((item) => item.wallId)
    .filter((wallId): wallId is string => Boolean(wallId))));
  for (const wallId of walls) {
    const frame = wallRunFrame(wallId, room);
    if (!frame) continue;
    const members = placed
      .filter((item) => item.wallId === wallId
        && isChainWallAnchor(item, room)
        && item.uid !== angled.cabinet.uid)
      .map((item) => ({ item, body: freestandingBody(item) }))
      .sort((left, right) => wallRunOffset(left.item, wallId, room) - wallRunOffset(right.item, wallId, room));
    if (!members.length) continue;
    // Only the run ends the angled leg actually reaches can turn onto it.
    for (const end of ["start", "end"] as const) {
      const ordered = end === "end" ? members : [...members].reverse();
      const touching = ordered[ordered.length - 1]!;
      const join = freestandingJoin(touching.body, angled);
      if (!join || join.turnDeg !== 45) continue;
      if (best && best.join.vertex && Math.hypot(best.join.vertex.x - join.vertex.x, best.join.vertex.y - join.vertex.y) <= FREESTANDING_JOIN_TOLERANCE_IN) continue;
      // The wall's own back line, from the far end of the seated run to the corner.
      const farItem = ordered[0]!.item;
      const farAlong = end === "end"
        ? wallRunOffset(farItem, wallId, room)
        : wallRunOffset(farItem, wallId, room) + wallRunSpan(farItem, wallId, room);
      const start = {
        x: frame.start.x + frame.tangent.x * farAlong,
        y: frame.start.y + frame.tangent.y * farAlong,
      };
      best = {
        bodies: ordered.map((entry) => entry.body),
        start,
        end: join.vertex,
        // The run's cabinet fronts face along the frame's inward normal.
        radians: Math.atan2(frame.tangent.y, frame.tangent.x),
        join,
      };
    }
  }
  return best
    ? { bodies: best.bodies, start: best.start, end: best.end, radians: best.radians }
    : null;
}

export function freestandingChainWallModel(
  chain: FreestandingBody[],
  room: RoomData,
  chainIndex = 0,
  placed: readonly PlacedCabinet[] = [],
): FreestandingWallModel | null {
  const oriented = orientChain(chain);
  if (oriented.length === 0) return null;
  type Segment = { start: Pt; end: Pt; radians: number; bodies: FreestandingBody[]; joinedWallSeat?: boolean };
  const segments: Segment[] = [];
  const wallLeg = joinedWallRunLeg(oriented, placed, room);
  // A joined wall run comes first, so the angled leg reads as its continuation.
  if (wallLeg) segments.push({ ...wallLeg, joinedWallSeat: true });
  const bodiesToSeat = wallLeg
    ? oriented.filter((body) => !wallLeg.bodies.some((member) => member.cabinet.uid === body.cabinet.uid))
    : oriented;
  bodiesToSeat.forEach((body, index) => {
    const [bl, br] = freestandingBodyCorners(body);
    const heading = headingOf(body);
    const last = segments[segments.length - 1];
    if (last && Math.abs(((heading - last.radians + Math.PI) % (2 * Math.PI)) - Math.PI) <= 1e-6) {
      last.end = br;
      last.bodies.push(body);
      return;
    }
    // A turn: both walls meet at the Wall Builder's shared vertex (each leg holds 11" back at 45°).
    const previous = bodiesToSeat[index - 1];
    const join = last && previous ? freestandingJoin(previous, body) : null;
    if (last && join) last.end = join.vertex;
    const start = join ? join.vertex : bl;
    const bodyEnd = br;
    segments.push({ start, end: bodyEnd, radians: heading, bodies: [body] });
  });
  if (!segments.length) return null;
  // The last wall also ends where the Wall Builder would end it: at the last body's end corner.
  const prefix = `fs${chainIndex}`;
  const vertices = [
    { id: `${prefix}-v0`, x: segments[0]!.start.x, y: segments[0]!.start.y },
    ...segments.map((segment, index) => ({ id: `${prefix}-v${index + 1}`, x: segment.end.x, y: segment.end.y })),
  ];
  const customWalls = segments.map((segment, index) => {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const diagonal = Math.abs(dx) > EPS && Math.abs(dy) > EPS;
    return {
      id: `${prefix}-w${index}`,
      startVertexId: `${prefix}-v${index}`,
      endVertexId: `${prefix}-v${index + 1}`,
      label: `Run ${index + 1}`,
      ...(diagonal ? { lockedAngle: (dx * dy >= 0 ? 45 : -45) as 45 | -45 } : {}),
      height: room.ceilingHeight,
    };
  });
  const oriented45 = orientWallPathToFacing(vertices, customWalls, room, oriented[0]!.forward);
  const syntheticRoom: RoomData = {
    ...room,
    vertices: oriented45.vertices,
    customWalls: oriented45.customWalls,
    openWallPath: true,
    peninsulaRuns: undefined,
    wallCeilings: undefined,
  };
  // Seat every chain cabinet on its wall with the Wall Builder's own placement.
  const seated: PlacedCabinet[] = [];
  segments.forEach((segment, index) => {
    const wallId = customWalls[index]!.id;
    const frame = wallRunFrame(wallId, syntheticRoom);
    if (!frame) return;
    for (const body of segment.bodies) {
      const [bl] = freestandingBodyCorners(body);
      const along = Math.max(0, wallRunAlongAtPoint(frame, bl));
      const spot = wallPlacementAt(along, body.width, body.depth, wallId as never, syntheticRoom, null, false);
      seated.push({ ...body.cabinet, x: spot.x, y: spot.y, rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset });
    }
  });
  if (seated.length === 0) return null;
  return {
    room: syntheticRoom,
    seated,
    memberUids: seated.map((item) => item.uid),
  };
}

/**
 * The cabinets a joined chain's top covers: the angled return leg plus the wall
 * run it continues. `countertopSurfaces` leaves these to the chain so one
 * continuous mitered piece is built, never a square slab plus a separate one.
 */
export function freestandingChainMemberUids(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  island?: IslandZone | null,
): Set<string> {
  const uids = new Set<string>();
  for (const chain of freestandingChains(placed, room, island)) {
    if (!chain.some((body) => isAngledReturnCabinet(body.cabinet))) continue;
    const model = freestandingChainWallModel(chain, room, 0, placed);
    if (!model) continue;
    for (const uid of model.memberUids) uids.add(uid);
  }
  return uids;
}

/**
 * One CountertopSurface per free-standing chain, produced by the Continuous
 * Wall Builder's `countertopSurfaces` custom-wall path (slab → merge → miter)
 * on the chain's synthetic wall model, then returned as a plain world polygon.
 */
export function freestandingCountertopSurfaces(placed: readonly PlacedCabinet[], room: RoomData, island?: IslandZone | null): CountertopSurface[] {
  const out: CountertopSurface[] = [];
  freestandingChains(placed, room, island).forEach((chain, chainIndex) => {
    const model = freestandingChainWallModel(chain, room, chainIndex, placed);
    if (!model) return;
    const surfaces = countertopSurfaces(model.seated, model.room, null);
    for (const surface of surfaces) {
      if (countertopSurfacePlanPolygon(surface).length < 3) continue;
      // Keep the Wall Builder surface exactly as built (frame, rotation, local
      // polygon, miter flags); only re-tag it so the standard-room passes know
      // it belongs to this free-standing chain and not to a drawn wall.
      out.push({
        ...surface,
        customWallId: undefined,
        customWallRunStartIn: undefined,
        customWallMiterWallIds: undefined,
        customWallMiterVertexId: undefined,
        cabinetRunId: `freestanding:${model.memberUids.slice().sort().join("+")}`,
        freestandingMemberUids: model.memberUids,
      });
    }
  });
  return out;
}

/**
 * 45° join on drop — the Continuous Wall Builder's rule, not a new one. When a
 * free cabinet turned to an odd 45° lands near the end of a free-standing
 * neighbour, the neighbour's back line and the new heading become a two-wall
 * open path sharing a vertex at the neighbour's end corner. The cabinet is then
 * seated by `wallPlacementAt` at `insideCornerHoldIn(45, depth)` along the new
 * wall — exactly where `freeSegmentsOnWall` lets the Wall Builder place it —
 * and `miteredMeasuredWallCountertopSurfaces` closes the corner. Returns the
 * adjusted AABB position, or null when nothing is near or the seat overlaps.
 */
export function snapFreestandingFortyFive(
  moving: PlacedCabinet,
  others: readonly PlacedCabinet[],
  room: RoomData,
  island?: IslandZone | null,
  threshold = STD.SNAP_THRESHOLD,
): { x: number; y: number; neighbourUid: string } | null {
  const rotation = (((Number(moving.rotation) || 0) % 360) + 360) % 360;
  if (![45, 135, 225, 315].includes(rotation)) return null;
  if (moving.placement !== "base" || placedCornerGeometryKind(moving) !== "standard" || moving.wallId) return null;
  const body = freestandingBody(moving);
  const [mbl, mbr] = freestandingBodyCorners(body);
  const hold = insideCornerHoldIn(45, body.depth);
  const freeOthers = others.filter((other) => other.uid !== moving.uid && isFreestandingBase(other, room, island));
  let best: { x: number; y: number; neighbourUid: string; distance: number } | null = null;
  for (const other of freeOthers) {
    const otherBody = freestandingBody(other);
    const [obl, obr] = freestandingBodyCorners(otherBody);
    const otherHold = insideCornerHoldIn(45, otherBody.depth);
    const candidates: Array<{ mine: Pt; vertex: Pt; otherStart: Pt; heading: Pt }> = [
      // continue past the neighbour's right end, my heading forward
      { mine: mbl, vertex: add(obr, scale(otherBody.tangent, otherHold)), otherStart: obl, heading: body.tangent },
      // continue past the neighbour's left end, my heading reversed
      { mine: mbr, vertex: add(obl, scale(otherBody.tangent, -otherHold)), otherStart: obr, heading: scale(body.tangent, -1) },
    ];
    for (const candidate of candidates) {
      // Where my back corner would sit once held back from the vertex.
      const seatCorner = add(candidate.vertex, scale(candidate.heading, hold));
      const distance = dist(candidate.mine, seatCorner);
      if (distance > threshold || (best && distance >= best.distance)) continue;
      const end = add(candidate.vertex, scale(candidate.heading, hold + body.width));
      const diagonal = ((end.x - candidate.vertex.x) * (end.y - candidate.vertex.y) >= 0 ? 45 : -45) as 45 | -45;
      const vertices = [
        { id: "snap-v0", x: candidate.otherStart.x, y: candidate.otherStart.y },
        { id: "snap-v1", x: candidate.vertex.x, y: candidate.vertex.y },
        { id: "snap-v2", x: end.x, y: end.y },
      ];
      const walls = [
        { id: "snap-w0", startVertexId: "snap-v0", endVertexId: "snap-v1", height: room.ceilingHeight },
        { id: "snap-w1", startVertexId: "snap-v1", endVertexId: "snap-v2", lockedAngle: diagonal, height: room.ceilingHeight },
      ];
      const oriented = orientWallPathToFacing(vertices, walls, room, otherBody.forward);
      const syntheticRoom: RoomData = { ...room, ...oriented, openWallPath: true, peninsulaRuns: undefined };
      const frame = wallRunFrame("snap-w1", syntheticRoom);
      if (!frame) continue;
      const along = wallRunAlongAtPoint(frame, seatCorner);
      const spot = wallPlacementAt(along, body.width, body.depth, "snap-w1" as never, syntheticRoom, null, false);
      const seated = { ...moving, x: spot.x, y: spot.y };
      if (freeOthers.some((peer) => cabinetPlanBodiesIntersect(seated, peer))) continue;
      best = { x: seated.x, y: seated.y, neighbourUid: other.uid, distance };
    }
  }
  return best ? { x: best.x, y: best.y, neighbourUid: best.neighbourUid } : null;
}
