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
};

type Vec3 = { x: number; y: number; z: number };

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

/**
 * Places the closet camera on the room-interior side of the cabinet (+Z, in front
 * of the back wall) and dollies until the cabinet box — not the wall — fits the
 * canvas, with padding. A narrow middle column (small aspect) pushes the camera
 * back so the towers are not cropped; a wide canvas does not leave them tiny.
 */
export function frameClosetStudioCamera(
  box: ClosetAabb,
  aspect: number,
  options?: { view?: ClosetCameraView; padding?: number; fovDeg?: number },
): ClosetCameraFrame {
  const view = options?.view ?? "angle";
  const padding = options?.padding ?? 0.18;
  const safeAspect = Math.min(3.2, Math.max(0.35, Number.isFinite(aspect) && aspect > 0 ? aspect : 1));
  const center = {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
    z: (box.minZ + box.maxZ) / 2,
  };
  const halfD = Math.max(0.25, (box.maxZ - box.minZ) / 2);
  // +Z is the open side of the closet. Overhead stays far enough off vertical
  // that OrbitControls' polar limit does not shove the camera back to the horizon.
  const raw = view === "front"
    ? { x: 0.04, y: 0.16, z: 1 }
    : view === "overhead"
      ? { x: 0.08, y: 1, z: 0.28 }
      : { x: 0.46, y: 0.2, z: 1 };
  const towardCamera = norm(raw);
  const margin = Math.max(0.08, Math.min(0.35, padding));
  const inside = (distance: number) => {
    const trial: ClosetCameraFrame = {
      position: add(center, mul(towardCamera, distance)),
      target: center,
      near: 0.05,
      far: 500,
      minDistance: 1,
      maxDistance: 500,
      distance,
    };
    return closetCabinetCorners(box).every((corner) => {
      const point = projectClosetPoint(corner, trial, safeAspect, options?.fovDeg ?? 40);
      return point.depth > 0.2 && Math.abs(point.x) <= 1 - margin && Math.abs(point.y) <= 1 - margin;
    });
  };
  let low = Math.max(halfD + 1.2, 2);
  let high = low;
  for (let guard = 0; guard < 24 && !inside(high); guard += 1) high *= 1.35;
  for (let step = 0; step < 20; step += 1) {
    const mid = (low + high) / 2;
    if (inside(mid)) high = mid;
    else low = mid;
  }
  const distance = high;
  const position = add(center, mul(towardCamera, distance));
  const near = 0.05;
  const minDistance = Math.min(Math.max(1.35, halfD + 0.45), distance * 0.72);
  const maxDistance = Math.max(36, distance * 3.2);
  return {
    position,
    target: center,
    near,
    far: Math.max(90, distance * 10),
    minDistance,
    maxDistance,
    distance,
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
  if (length(right) < 1e-6) right = { x: 1, y: 0, z: 0 };
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
