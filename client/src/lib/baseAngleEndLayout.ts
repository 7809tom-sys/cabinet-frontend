/**
 * Quarter-octagon plan for the 24" base angle end cabinet
 * (BA-24 / BEC-24 / BEC24 / BAC24).
 *
 * Shared by the 3D scene and the elevation so both draw the same outline.
 *
 * The uploaded catalog drawing labels two straight edges 24". Those edges meet
 * at 90°: one against the wall, one against the neighboring cabinet. The outer
 * boundary is one quarter of a regular octagon, so the two door faces turn
 * 45° where they meet (135° interior angle).
 *
 * Equal 17" faces cannot close that outline. With the ends of the two 24"
 * sides fixed, 17" chords meet at about 173° — nearly one straight diagonal.
 * The chord that closes at 45° is 2 × 24 × sin(22.5°) ≈ 18.369". The catalog
 * face width and the owner's door width are both 17", so each door slab is
 * 17" centered on that face. The remaining (18.369 − 17) / 2 ≈ 0.684" at
 * each end is the face-frame stile the drawing shows at the corner. The more
 * frontal door spans 24 × sin(45°) ≈ 16.971" along the run, which is the 17"
 * read across the front elevation.
 */

export const BASE_ANGLE_END_SIDE_IN = 24;
export const BASE_ANGLE_END_DOOR_IN = 17;
export const BASE_ANGLE_END_TOE_KICK_IN = 4.5;
export const BASE_ANGLE_END_TOE_RECESS_IN = 3;
export const BASE_ANGLE_END_COUNTER_OVERHANG_IN = 1.5;

/** Face chord that closes two perpendicular 24" sides at a 45° door pitch. */
export const BASE_ANGLE_END_FACE_IN = 2 * BASE_ANGLE_END_SIDE_IN * Math.sin(Math.PI / 8);

export type PlanPoint = { x: number; z: number };
export type BaseAngleEndHand = "left" | "right";

export type BaseAngleEndFields = {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  graphicType?: string | null;
  customProfile?: string | null;
};

const FAMILY_CODES = new Set(["BA24", "BEC24", "BAC24"]);

export function baseAngleEndCode(masterCode: string | null | undefined): string {
  return (masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True for the BA-24 / BEC24 / BAC24 quarter-octagon end cabinet, not a diagonal corner. */
export function isBaseAngleEndCabinet(cabinet: BaseAngleEndFields): boolean {
  const hay = `${cabinet.description ?? ""} ${cabinet.subCategory ?? ""} ${cabinet.graphicType ?? ""} ${cabinet.customProfile ?? ""}`.toLowerCase();
  if (/diagonal/.test(hay)) return false;
  if (FAMILY_CODES.has(baseAngleEndCode(cabinet.masterCode))) return true;
  if (/quarter[-\s]?octagon/.test(hay)) return true;
  if (/base angle.*end of run/.test(hay)) return true;
  if (/base-end-quarter-octagon/.test(hay)) return true;
  return false;
}

function add(a: PlanPoint, b: PlanPoint): PlanPoint {
  return { x: a.x + b.x, z: a.z + b.z };
}
function sub(a: PlanPoint, b: PlanPoint): PlanPoint {
  return { x: a.x - b.x, z: a.z - b.z };
}
function mul(a: PlanPoint, scale: number): PlanPoint {
  return { x: a.x * scale, z: a.z * scale };
}
function lengthOf(a: PlanPoint): number {
  return Math.hypot(a.x, a.z);
}
function normalize(a: PlanPoint): PlanPoint {
  const length = lengthOf(a) || 1;
  return mul(a, 1 / length);
}
function dot(a: PlanPoint, b: PlanPoint): number {
  return a.x * b.x + a.z * b.z;
}
function cross(a: PlanPoint, b: PlanPoint): number {
  return a.x * b.z - a.z * b.x;
}

function outwardNormal(start: PlanPoint, end: PlanPoint, interior: PlanPoint): PlanPoint {
  const direction = normalize(sub(end, start));
  const right = { x: direction.z, z: -direction.x };
  const midpoint = mul(add(start, end), 0.5);
  return dot(right, sub(interior, midpoint)) > 0 ? mul(right, -1) : right;
}

function intersectLines(origin: PlanPoint, direction: PlanPoint, otherOrigin: PlanPoint, otherDirection: PlanPoint): PlanPoint {
  const determinant = cross(direction, otherDirection);
  if (Math.abs(determinant) < 1e-9) return origin;
  const distance = cross(sub(otherOrigin, origin), otherDirection) / determinant;
  return add(origin, mul(direction, distance));
}

export type BaseAngleEndFace = {
  id: "end" | "front";
  start: PlanPoint;
  end: PlanPoint;
  length: number;
  midpoint: PlanPoint;
  outward: PlanPoint;
  /** Three.js rotation.y that aims local +Z along the outward normal. */
  rotationY: number;
  /** +1 when local +X, after rotationY, points toward the door meeting. */
  meetingSign: 1 | -1;
  /** Absolute span of this face along the wall run. */
  runSpanIn: number;
  doorWidthIn: number;
};

export type BaseAngleEndPlan = {
  hand: BaseAngleEndHand;
  sideIn: number;
  faceIn: number;
  doorWidthIn: number;
  stileIn: number;
  doorPitchDegrees: number;
  doorInteriorAngleDegrees: number;
  toeKickIn: number;
  toeRecessIn: number;
  vertices: PlanPoint[];
  wallSide: { start: PlanPoint; end: PlanPoint; length: number };
  neighborSide: { start: PlanPoint; end: PlanPoint; length: number };
  doorFaces: BaseAngleEndFace[];
  toeKickVertices: PlanPoint[];
  countertopVertices: PlanPoint[];
};

/** Positive inset moves the door faces toward the wall/neighbor corner. */
function offsetDoorFaces(vertices: PlanPoint[], inset: number): PlanPoint[] {
  const [inner, wallEnd, meet, neighborEnd] = vertices;
  if (!inner || !wallEnd || !meet || !neighborEnd) return vertices;
  const endNormal = outwardNormal(wallEnd, meet, inner);
  const frontNormal = outwardNormal(meet, neighborEnd, inner);
  const endDirection = normalize(sub(meet, wallEnd));
  const frontDirection = normalize(sub(neighborEnd, meet));
  const endLine = add(wallEnd, mul(endNormal, -inset));
  const frontLine = add(meet, mul(frontNormal, -inset));
  return [
    inner,
    intersectLines(wallEnd, normalize(sub(wallEnd, inner)), endLine, endDirection),
    intersectLines(endLine, endDirection, frontLine, frontDirection),
    intersectLines(neighborEnd, normalize(sub(neighborEnd, inner)), frontLine, frontDirection),
  ];
}

export function baseAngleEndPlan(options?: {
  sideIn?: number;
  hand?: BaseAngleEndHand;
  doorWidthIn?: number;
  toeRecessIn?: number;
  counterOverhangIn?: number;
}): BaseAngleEndPlan {
  const sideIn = options?.sideIn && options.sideIn > 0 ? options.sideIn : BASE_ANGLE_END_SIDE_IN;
  const hand: BaseAngleEndHand = options?.hand ?? "right";
  const requestedDoor = options?.doorWidthIn ?? BASE_ANGLE_END_DOOR_IN;
  const toeRecessIn = options?.toeRecessIn ?? BASE_ANGLE_END_TOE_RECESS_IN;
  const counterOverhangIn = options?.counterOverhangIn ?? BASE_ANGLE_END_COUNTER_OVERHANG_IN;
  const half = sideIn / 2;
  const faceIn = 2 * sideIn * Math.sin(Math.PI / 8);
  const sign = hand === "right" ? 1 : -1;
  const inner = { x: -sign * half, z: -half };
  const wallEnd = { x: sign * half, z: -half };
  const neighborEnd = { x: inner.x, z: half };
  const meet = {
    x: inner.x + sign * sideIn * Math.SQRT1_2,
    z: inner.z + sideIn * Math.SQRT1_2,
  };
  const vertices = [inner, wallEnd, meet, neighborEnd];
  const rawFaces: Array<{ id: "end" | "front"; start: PlanPoint; end: PlanPoint }> = [
    { id: "end", start: wallEnd, end: meet },
    { id: "front", start: meet, end: neighborEnd },
  ];
  const doorWidthIn = Math.min(requestedDoor, faceIn);
  const doorFaces: BaseAngleEndFace[] = rawFaces.map((face) => {
    const delta = sub(face.end, face.start);
    const faceLength = lengthOf(delta);
    const midpoint = mul(add(face.start, face.end), 0.5);
    const outward = outwardNormal(face.start, face.end, inner);
    const rotationY = Math.atan2(outward.x, outward.z);
    const localX = { x: Math.cos(rotationY), z: -Math.sin(rotationY) };
    const meetingSign: 1 | -1 = dot(normalize(delta), localX) >= 0 ? 1 : -1;
    return {
      id: face.id,
      start: face.start,
      end: face.end,
      length: faceLength,
      midpoint,
      outward,
      rotationY,
      meetingSign,
      runSpanIn: Math.abs(face.end.x - face.start.x),
      doorWidthIn,
    };
  });
  const endDirection = sub(meet, wallEnd);
  const frontDirection = sub(neighborEnd, meet);
  const turn = Math.atan2(Math.abs(cross(endDirection, frontDirection)), dot(endDirection, frontDirection)) * (180 / Math.PI);
  return {
    hand,
    sideIn,
    faceIn,
    doorWidthIn,
    stileIn: Math.max(0, (faceIn - doorWidthIn) / 2),
    doorPitchDegrees: turn,
    doorInteriorAngleDegrees: 180 - turn,
    toeKickIn: BASE_ANGLE_END_TOE_KICK_IN,
    toeRecessIn,
    vertices,
    wallSide: { start: inner, end: wallEnd, length: lengthOf(sub(wallEnd, inner)) },
    neighborSide: { start: inner, end: neighborEnd, length: lengthOf(sub(neighborEnd, inner)) },
    doorFaces,
    toeKickVertices: offsetDoorFaces(vertices, toeRecessIn),
    countertopVertices: offsetDoorFaces(vertices, -counterOverhangIn),
  };
}

/**
 * Interior angle at which two equal chords meet between the outer ends of two
 * perpendicular sides. Returns null when the chords are too short to connect.
 */
export function equalChordInteriorAngleDegrees(sideIn: number, faceIn: number): number | null {
  const span = sideIn * Math.SQRT2;
  if (faceIn * 2 < span - 1e-9) return null;
  const cosine = 1 - (span * span) / (2 * faceIn * faceIn);
  if (cosine < -1 - 1e-6 || cosine > 1 + 1e-6) return null;
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * (180 / Math.PI);
}

/** The carcass, toe kick, and countertop stay on the cabinet's side of the neighbor. */
export function baseAngleEndClearsNeighbor(plan: BaseAngleEndPlan): boolean {
  const limit = plan.hand === "right" ? -plan.sideIn / 2 : plan.sideIn / 2;
  const crosses = (point: PlanPoint) => plan.hand === "right"
    ? point.x < limit - 1e-6
    : point.x > limit + 1e-6;
  return [plan.vertices, plan.toeKickVertices, plan.countertopVertices]
    .every((polygon) => polygon.every((point) => !crosses(point)));
}

/** CSS clip in the cabinet's local plan box. The wall is the top edge. */
export function baseAngleEndClipPath(hand: BaseAngleEndHand = "right"): string {
  const plan = baseAngleEndPlan({ sideIn: BASE_ANGLE_END_SIDE_IN, hand, counterOverhangIn: 0, toeRecessIn: 0 });
  const half = plan.sideIn / 2;
  const points = plan.vertices.map((point) => {
    const x = ((point.x + half) / plan.sideIn) * 100;
    const y = ((point.z + half) / plan.sideIn) * 100;
    const trim = (value: number) => Math.round(value * 1000) / 1000;
    return `${trim(x)}% ${trim(y)}%`;
  });
  return `polygon(${points.join(", ")})`;
}

/**
 * Countertop outline in the cabinet's local plan frame: x along the run from
 * the left side of the 24" box, y from the wall into the room.
 */
export function baseAngleEndCountertopLocalPoints(
  hand: BaseAngleEndHand = "right",
  overhangIn = BASE_ANGLE_END_COUNTER_OVERHANG_IN,
): Array<{ x: number; y: number }> {
  const plan = baseAngleEndPlan({ sideIn: BASE_ANGLE_END_SIDE_IN, hand, counterOverhangIn: overhangIn });
  const half = plan.sideIn / 2;
  return plan.countertopVertices.map((point) => ({
    x: point.x + half,
    y: point.z + half,
  }));
}
