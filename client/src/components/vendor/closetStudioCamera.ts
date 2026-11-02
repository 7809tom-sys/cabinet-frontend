/** World-space feet. The closet scene uses 1 unit = 1 foot. */
export type ClosetAabb = {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
};

export type ClosetCameraView = "angle" | "front" | "overhead";

export type ClosetCameraFrame = {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
  distance: number;
  /** OrbitControls polar angle (radians from +Y) that keeps this framing. */
  polarAngle: number;
};

type Vec3 = { x: number; y: number; z: number };

/** Screen padding, as a fraction of NDC half-extent. Top and bottom stay equal. */
export const CLOSET_FRAME_PADDING = 0.12;

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const length = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: Vec3): Vec3 => {
  const span = length(a) || 1;
  return mul(a, 1 / span);
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const centerOf = (box: ClosetAabb): Vec3 => ({
  x: (box.minX + box.maxX) / 2,
  y: (box.minY + box.maxY) / 2,
  z: (box.minZ + box.maxZ) / 2,
});

/** Azimuth 0 looks from +Z (the open side). Elevation is radians above horizontal. */
function directionFromAngles(azimuth: number, elevation: number): Vec3 {
  const horizontal = Math.cos(elevation);
  return {
    x: Math.sin(azimuth) * horizontal,
    y: Math.sin(elevation),
    z: Math.cos(azimuth) * horizontal,
  };
}

type Silhouette = {
  minX: number; maxX: number; minY: number; maxY: number; minDepth: number;
  topGap: number; bottomGap: number; leftGap: number; rightGap: number;
};

function silhouetteOf(
  box: ClosetAabb,
  aspect: number,
  direction: Vec3,
  distance: number,
  fovDeg: number,
  target: Vec3,
): Silhouette {
  const frame: ClosetCameraFrame = {
    position: add(target, mul(norm(direction), distance)),
    target,
    near: 0.05,
    far: 500,
    minDistance: distance,
    maxDistance: distance,
    distance,
    polarAngle: 0,
  };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minDepth = Infinity;
  for (const corner of closetCabinetCorners(box)) {
    const point = projectClosetPoint(corner, frame, aspect, fovDeg);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    minDepth = Math.min(minDepth, point.depth);
  }
  return {
    minX, maxX, minY, maxY, minDepth,
    topGap: 1 - maxY,
    bottomGap: minY + 1,
    leftGap: minX + 1,
    rightGap: 1 - maxX,
  };
}

/**
 * Smallest distance along `direction` (from the tower center toward the camera)
 * that keeps every cabinet corner inside the padding. Zoom must not go closer.
 */
export function closetFitDistance(
  box: ClosetAabb,
  aspect: number,
  direction: Vec3,
  options?: { padding?: number; fovDeg?: number; target?: Vec3 },
): number {
  const padding = options?.padding ?? CLOSET_FRAME_PADDING;
  const fovDeg = options?.fovDeg ?? 40;
  const safeAspect = Math.min(3.2, Math.max(0.35, Number.isFinite(aspect) && aspect > 0 ? aspect : 1));
  const margin = Math.max(0.06, Math.min(0.28, padding));
  const target = options?.target ?? centerOf(box);
  const halfD = Math.max(0.25, (box.maxZ - box.minZ) / 2);
  const inside = (distance: number) => {
    const silhouette = silhouetteOf(box, safeAspect, direction, distance, fovDeg, target);
    return silhouette.minDepth > 0.2
      && silhouette.leftGap >= margin - 1e-3
      && silhouette.rightGap >= margin - 1e-3
      && silhouette.topGap >= margin - 1e-3
      && silhouette.bottomGap >= margin - 1e-3;
  };
  let low = Math.max(halfD + 0.8, 1.5);
  let high = low;
  for (let guard = 0; guard < 28 && !inside(high); guard += 1) high *= 1.32;
  for (let step = 0; step < 22; step += 1) {
    const mid = (low + high) / 2;
    if (inside(mid)) high = mid;
    else low = mid;
  }
  return high;
}

/**
 * Places the closet camera on the room-interior side of the cabinet (+Z) and
 * dollies until the cabinet box — floor included — fits. The look-at target
 * stays the bounding-box center. Pitch is chosen so the on-screen padding
 * above the tower equals the padding below it.
 */
export function frameClosetStudioCamera(
  box: ClosetAabb,
  aspect: number,
  options?: { view?: ClosetCameraView; padding?: number; fovDeg?: number },
): ClosetCameraFrame {
  const view = options?.view ?? "angle";
  const padding = options?.padding ?? CLOSET_FRAME_PADDING;
  const fovDeg = options?.fovDeg ?? 40;
  const safeAspect = Math.min(3.2, Math.max(0.35, Number.isFinite(aspect) && aspect > 0 ? aspect : 1));
  const center = centerOf(box);
  const azimuth = view === "front" ? 0.035 : view === "overhead" ? 0.12 : 0.5;
  // Overhead stays high enough to look down on the tower. A steep plan view
  // magnifies the near top, so its padding cannot match a level front view.
  const [elevLo, elevHi] = view === "overhead" ? [1.0, 1.2] : [0.05, 0.48];
  // A steep look-down foreshortens the tower, so top/bottom balance matters
  // far less than keeping the tower horizontally centered.
  const verticalWeight = view === "overhead" ? 0.25 : 1;
  let bestDirection = directionFromAngles(azimuth, (elevLo + elevHi) / 2);
  let bestDistance = closetFitDistance(box, safeAspect, bestDirection, { padding, fovDeg, target: center });
  let bestScore = Number.POSITIVE_INFINITY;
  const consider = (elevation: number) => {
    const direction = directionFromAngles(azimuth, elevation);
    const distance = closetFitDistance(box, safeAspect, direction, { padding, fovDeg, target: center });
    const silhouette = silhouetteOf(box, safeAspect, direction, distance, fovDeg, center);
    const score = Math.abs(silhouette.topGap - silhouette.bottomGap) * verticalWeight
      + Math.abs(silhouette.leftGap - silhouette.rightGap) * 0.35;
    if (score < bestScore) {
      bestScore = score;
      bestDirection = direction;
      bestDistance = distance;
    }
  };
  const samples = 16;
  for (let index = 0; index <= samples; index += 1) consider(elevLo + (elevHi - elevLo) * (index / samples));
  const winner = Math.asin(clamp(bestDirection.y, -1, 1));
  const step = (elevHi - elevLo) / samples;
  for (let index = 0; index <= 8; index += 1) consider(clamp(winner - step + (2 * step * index) / 8, elevLo, elevHi));

  const distance = bestDistance;
  const position = add(center, mul(bestDirection, distance));
  const polarAngle = Math.acos(clamp(bestDirection.y, -1, 1));
  return {
    position,
    target: center,
    near: 0.05,
    far: Math.max(90, distance * 10),
    // Full tower always fits: zoom cannot move inside this distance.
    minDistance: distance,
    maxDistance: Math.max(36, distance * 3.2),
    distance,
    polarAngle,
  };
}

/** Normalized device coordinates of a point in a frame. y is up. */
export function projectClosetPoint(
  point: Vec3,
  frame: ClosetCameraFrame,
  aspect: number,
  fovDeg = 40,
): { x: number; y: number; depth: number } {
  const safeAspect = Math.min(3.2, Math.max(0.35, aspect));
  const halfFovV = (fovDeg * Math.PI) / 180 / 2;
  const halfFovH = Math.atan(Math.tan(halfFovV) * safeAspect);
  const back = norm(sub(frame.position, frame.target));
  let right = norm(cross({ x: 0, y: 1, z: 0 }, back));
  if (length(cross({ x: 0, y: 1, z: 0 }, back)) < 1e-6) right = { x: 1, y: 0, z: 0 };
  const up = cross(back, right);
  const rel = sub(point, frame.position);
  const camX = dot(rel, right);
  const camY = dot(rel, up);
  const camZ = dot(rel, back);
  const depth = -camZ;
  return {
    x: (camX / Math.max(depth, 1e-4)) / Math.tan(halfFovH),
    y: (camY / Math.max(depth, 1e-4)) / Math.tan(halfFovV),
    depth,
  };
}

export function closetCabinetCorners(box: ClosetAabb): Vec3[] {
  const xs = [box.minX, box.maxX];
  const ys = [box.minY, box.maxY];
  const zs = [box.minZ, box.maxZ];
  const corners: Vec3[] = [];
  for (const x of xs) for (const y of ys) for (const z of zs) corners.push({ x, y, z });
  return corners;
}
