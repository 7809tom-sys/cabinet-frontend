/**
 * 45° corner seat (Tom, Nov 16 2026, voice 11:53 AM CT).
 *
 * At every 45° corner (two walls meeting at a 135° interior angle) Auto Design
 * first sets one 135° angled filler that runs 3″ out from the corner along EACH
 * wall, and then builds the rest of the cabinetry from the end of each filler.
 * This replaces the 24″ inside-corner square that used to be reserved at every
 * shared vertex (the lazy-Susan / blind square) and was never given back at a
 * 45° join, so a base run stopped about 25¾″ short of the corner.
 *
 * "The corner" here is the visible miter line where the two cabinet fronts meet,
 * not the wall vertex: two 24″-deep fronts cannot reach the vertex itself. Each
 * filler is the selected line's own 3″ filler stock with only its 22.5° miter
 * cut (PR 433's front-miter pair, `angledWallFiller.ts`). Nothing is ripped,
 * stretched, or invented, so the cabinet edge sits where the full 3″ board ends
 * on its long (rear) point. On a 24″ base that is ≈12⅝″ from the wall vertex
 * (visible face ≈2 11/16″); on a 12″ upper it is ≈7⅝″ from the vertex.
 *
 * A 90° corner is not a 45° seat: it keeps its 24″ square and the lazy Susan /
 * blind corner decision unchanged.
 *
 * Extension point: `cornerUnitIn` is the along-wall width a real 45° angle
 * (diagonal) corner cabinet would take on each leg, if a line ever sells one.
 * It is 0 today (none of the lines checked in the test fixtures sells a 45°/135° angle corner base or
 * wall cabinet), so the filler starts at the miter. When such a cabinet exists
 * the seat becomes: corner cabinet at the miter → 3″ filler on each side →
 * run, and only `cornerUnitIn` has to be supplied.
 */
import { STD, wallRunFrame, type RoomData } from "./design";

/** Tom's 45° corner filler: 3″ along each wall. */
export const FORTY_FIVE_CORNER_FILLER_IN = 3;
/** Same ¾″ board thickness the front-miter pair uses. */
const FILLER_BOARD_THICKNESS_IN = 0.75;
/** Same half-degree tolerance as `customWallJoinTurnsFortyFive`. */
const TURN_TOLERANCE_RAD = 0.5 * Math.PI / 180;

export type FortyFiveCornerSeat = {
  wallId: string;
  neighborWallId: string;
  at: "start" | "end";
  layer: "base" | "wall";
  /** Cabinet front depth used for the miter (24″ base, 12″ upper). */
  depthIn: number;
  /** Along-wall inches from the vertex to the front miter point. */
  frontMiterIn: number;
  /** Along-wall inches from the vertex to the rear (¾″) miter point. */
  rearMiterIn: number;
  /** Width of a future 45° angle corner cabinet on this leg; 0 = none sold. */
  cornerUnitIn: number;
  /** Filler stock width (3″). */
  fillerIn: number;
  /** Along-wall inches from the vertex where the first cabinet edge sits. */
  cabinetSetbackIn: number;
};

function vertexOf(frame: { start: { x: number; y: number }; end: { x: number; y: number } }, at: "start" | "end") {
  return at === "start" ? frame.start : frame.end;
}

function samePoint(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= 0.01;
}

/** Along-wall distance (into the wall, from the vertex) where the two offset lines meet. */
function miterAlongIn(
  vertex: { x: number; y: number },
  owner: { tangent: { x: number; y: number }; inward: { x: number; y: number } },
  ownerInto: number,
  neighbor: { tangent: { x: number; y: number }; inward: { x: number; y: number } },
  depth: number,
): number | null {
  const p = { x: vertex.x + owner.inward.x * depth, y: vertex.y + owner.inward.y * depth };
  const q = { x: vertex.x + neighbor.inward.x * depth, y: vertex.y + neighbor.inward.y * depth };
  const d1 = owner.tangent;
  const d2 = neighbor.tangent;
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) <= 1e-6) return null;
  const t = ((q.x - p.x) * d2.y - (q.y - p.y) * d2.x) / det;
  const point = { x: p.x + d1.x * t, y: p.y + d1.y * t };
  return ownerInto * ((point.x - vertex.x) * d1.x + (point.y - vertex.y) * d1.y);
}

/**
 * The 45° corner seat at one end of a cabinet run, or null when that end is not
 * a 45° inside corner with another run wall (90° corners, open ends, outside
 * corners and sharp 45° interiors all return null and keep today's behavior).
 */
export function fortyFiveCornerSeat(
  room: RoomData,
  wallId: string,
  at: "start" | "end",
  layer: "base" | "wall",
  options: { neighborWallIds?: readonly string[]; fillerIn?: number; cornerUnitIn?: number } = {},
): FortyFiveCornerSeat | null {
  if (!room.customWalls?.length || !room.vertices?.length) return null;
  const owner = wallRunFrame(wallId, room);
  if (!owner || owner.kind === "peninsula") return null;
  const vertex = vertexOf(owner, at);
  const ownerInto = at === "start" ? 1 : -1;
  for (const candidate of room.customWalls) {
    if (candidate.id === wallId) continue;
    if (options.neighborWallIds && !options.neighborWallIds.includes(candidate.id)) continue;
    const neighbor = wallRunFrame(candidate.id, room);
    if (!neighbor || neighbor.kind === "peninsula") continue;
    const neighborAt = samePoint(neighbor.start, vertex) ? "start" : samePoint(neighbor.end, vertex) ? "end" : null;
    if (!neighborAt) continue;
    // Interior turn between the two walls' directions of travel into the corner.
    const a = { x: ownerInto * owner.tangent.x, y: ownerInto * owner.tangent.y };
    const neighborInto = neighborAt === "start" ? 1 : -1;
    const b = { x: neighborInto * neighbor.tangent.x, y: neighborInto * neighbor.tangent.y };
    const interior = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y)));
    if (Math.abs(interior - (3 * Math.PI) / 4) > TURN_TOLERANCE_RAD) continue;
    const depthIn = layer === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH;
    const frontMiterIn = miterAlongIn(vertex, owner, ownerInto, neighbor, depthIn);
    const rearMiterIn = miterAlongIn(vertex, owner, ownerInto, neighbor, depthIn - FILLER_BOARD_THICKNESS_IN);
    // An inside 135° corner has its miter a little way into each wall, inside
    // one cabinet depth. Anything else (an outside corner) is not this rule.
    if (frontMiterIn == null || rearMiterIn == null) continue;
    if (!(frontMiterIn > 0 && frontMiterIn < depthIn && rearMiterIn > 0)) continue;
    const fillerIn = options.fillerIn ?? FORTY_FIVE_CORNER_FILLER_IN;
    const cornerUnitIn = Math.max(0, options.cornerUnitIn ?? 0);
    // The filler is cut from full-width stock: its longer edge is the stock
    // width, so the cabinet edge sits one stock width past the nearer miter.
    const cabinetSetbackIn = Math.min(frontMiterIn, rearMiterIn) + cornerUnitIn + fillerIn;
    return { wallId, neighborWallId: candidate.id, at, layer, depthIn, frontMiterIn, rearMiterIn, cornerUnitIn, fillerIn, cabinetSetbackIn };
  }
  return null;
}
