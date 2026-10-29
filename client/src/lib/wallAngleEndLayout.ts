/**
 * Right-triangle plan for a wall angle end cabinet
 * (WAC1230 / WAC1236 / WAC1242 and the AW1230 / AW-12-30 aliases).
 *
 * Shared by the 3D scene, the plan, and the elevation. This is not the
 * BA-24 / BEC24 quarter-octagon. That base cabinet keeps its own outline.
 *
 * Local frame, inches, origin at the box center:
 *   +x  viewer's right when facing the cabinet
 *   +z  into the room
 *   -z  the wall
 *
 * The back edge is the full width against the wall. The full-depth side butts
 * the neighboring cabinet. The hypotenuse is the single angled door, and it
 * tapers toward the open end of the run. "right" puts that open end on +x;
 * "left" mirrors it onto -x. The bounding box does not change.
 */

export type WallAngleEndHand = "left" | "right";
export type WallAngleEndPoint = { x: number; z: number };

export type WallAngleEndFields = {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  graphicType?: string | null;
  customProfile?: string | null;
};

export function wallAngleEndCode(masterCode: string | null | undefined): string {
  return (masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True for WAC/AW wall-end angle cabinets, not a diagonal room corner or BA-24. */
export function isWallAngleEndCabinet(cabinet: WallAngleEndFields): boolean {
  const code = wallAngleEndCode(cabinet.masterCode);
  const graphic = `${cabinet.graphicType ?? ""} ${cabinet.customProfile ?? ""}`.toLowerCase();
  const desc = `${cabinet.description ?? ""} ${cabinet.subCategory ?? ""}`.toLowerCase();
  if (/corner/.test(desc) && !/^(?:WAC|AW)\d{4}/.test(code)) return false;
  if (/(?:^|\s)wall_angle(?:\s|$)|angled-wall|wall-end-angle/.test(graphic)) return true;
  if (/^(?:WAC|AW)\d{4}/.test(code)) return true;
  if (/\b(?:angled wall|angle wall|wall angle(?:\s+cabinet)?)\b/.test(desc)) return true;
  return false;
}

function add(a: WallAngleEndPoint, b: WallAngleEndPoint): WallAngleEndPoint {
  return { x: a.x + b.x, z: a.z + b.z };
}
function sub(a: WallAngleEndPoint, b: WallAngleEndPoint): WallAngleEndPoint {
  return { x: a.x - b.x, z: a.z - b.z };
}
function mul(a: WallAngleEndPoint, scale: number): WallAngleEndPoint {
  return { x: a.x * scale, z: a.z * scale };
}
function lengthOf(a: WallAngleEndPoint): number {
  return Math.hypot(a.x, a.z);
}
function normalize(a: WallAngleEndPoint): WallAngleEndPoint {
  const length = lengthOf(a) || 1;
  return mul(a, 1 / length);
}
function dot(a: WallAngleEndPoint, b: WallAngleEndPoint): number {
  return a.x * b.x + a.z * b.z;
}

export type WallAngleEndFace = {
  start: WallAngleEndPoint;
  end: WallAngleEndPoint;
  length: number;
  midpoint: WallAngleEndPoint;
  /** Unit normal pointing out of the carcass, into the room. */
  outward: WallAngleEndPoint;
  /** Three.js rotation.y that aims local +Z along the outward normal. */
  rotationY: number;
  /** +1 when local +X, after rotationY, points toward the open end. */
  openSign: 1 | -1;
};

export type WallAngleEndPlan = {
  hand: WallAngleEndHand;
  widthIn: number;
  depthIn: number;
  vertices: WallAngleEndPoint[];
  wallSide: { start: WallAngleEndPoint; end: WallAngleEndPoint; length: number };
  neighborSide: { start: WallAngleEndPoint; end: WallAngleEndPoint; length: number };
  doorFace: WallAngleEndFace;
};

export function wallAngleEndPlan(options?: {
  widthIn?: number;
  depthIn?: number;
  hand?: WallAngleEndHand;
}): WallAngleEndPlan {
  const widthIn = options?.widthIn && options.widthIn > 0 ? options.widthIn : 12;
  const depthIn = options?.depthIn && options.depthIn > 0 ? options.depthIn : widthIn;
  const hand: WallAngleEndHand = options?.hand ?? "right";
  const halfW = widthIn / 2;
  const halfD = depthIn / 2;
  const sign = hand === "right" ? 1 : -1;
  const neighborBack = { x: -sign * halfW, z: -halfD };
  const neighborFront = { x: -sign * halfW, z: halfD };
  const wallOpen = { x: sign * halfW, z: -halfD };
  const vertices = [neighborBack, neighborFront, wallOpen];
  const delta = sub(wallOpen, neighborFront);
  const midpoint = mul(add(neighborFront, wallOpen), 0.5);
  const inward = sub(neighborBack, midpoint);
  const along = normalize(delta);
  const right = { x: along.z, z: -along.x };
  const outward = dot(right, inward) > 0 ? mul(right, -1) : right;
  const rotationY = Math.atan2(outward.x, outward.z);
  const localX = { x: Math.cos(rotationY), z: -Math.sin(rotationY) };
  const openSign: 1 | -1 = dot(normalize(sub(wallOpen, midpoint)), localX) >= 0 ? 1 : -1;
  return {
    hand,
    widthIn,
    depthIn,
    vertices,
    wallSide: { start: neighborBack, end: wallOpen, length: lengthOf(sub(wallOpen, neighborBack)) },
    neighborSide: { start: neighborBack, end: neighborFront, length: lengthOf(sub(neighborFront, neighborBack)) },
    doorFace: {
      start: neighborFront,
      end: wallOpen,
      length: lengthOf(delta),
      midpoint,
      outward,
      rotationY,
      openSign,
    },
  };
}

/**
 * Which end of the wall run is the open one, mapped into the cabinet's
 * viewer-right frame. Run "end" follows the wall tangent. Viewer-right follows
 * the wall's facing rotation, the same mirror the 3D scene uses.
 */
export function wallAngleEndHandFromRun(input: {
  openSide: "start" | "end";
  tangent: { x: number; y: number };
  facingRotation: number;
}): WallAngleEndHand {
  const facing = input.facingRotation * Math.PI / 180;
  const viewerRightX = Math.cos(facing);
  const viewerRightY = Math.sin(facing);
  const endIsViewerRight = input.tangent.x * viewerRightX + input.tangent.y * viewerRightY > 0;
  const openIsEnd = input.openSide === "end";
  return openIsEnd === endIsViewerRight ? "right" : "left";
}

/**
 * CSS clip for the plan div. Percentages are of that div, not of the triangle's
 * own bounds, so the cabinet keeps its rectangular footprint.
 * facingRotation 0 (or a CSS-rotated div) keeps +x to the right and +z downward.
 */
export function wallAngleEndClipPath(options: {
  hand?: WallAngleEndHand;
  widthIn?: number;
  depthIn?: number;
  divWidthIn?: number;
  divDepthIn?: number;
  facingRotation?: number;
}): string {
  const widthIn = options.widthIn && options.widthIn > 0 ? options.widthIn : 12;
  const depthIn = options.depthIn && options.depthIn > 0 ? options.depthIn : widthIn;
  const divWidthIn = options.divWidthIn && options.divWidthIn > 0 ? options.divWidthIn : widthIn;
  const divDepthIn = options.divDepthIn && options.divDepthIn > 0 ? options.divDepthIn : depthIn;
  const plan = wallAngleEndPlan({ widthIn, depthIn, hand: options.hand ?? "right" });
  const theta = -(options.facingRotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const trim = (value: number) => Math.round(value * 1000) / 1000;
  const points = plan.vertices.map((point) => {
    const worldX = cos * point.x + sin * point.z;
    const worldZ = -sin * point.x + cos * point.z;
    const x = (worldX / divWidthIn + 0.5) * 100;
    const y = (worldZ / divDepthIn + 0.5) * 100;
    return `${trim(x)}% ${trim(y)}%`;
  });
  return `polygon(${points.join(", ")})`;
}
