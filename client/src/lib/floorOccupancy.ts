/**
 * Floor footprints for bathroom fixtures and the cabinets that stand on the floor.
 * A tub, toilet, vanity, tall cabinet, or freestanding filler owns its real
 * width × depth. Edges may touch. Interiors may not.
 */
import {
  COLLISION_EPSILON_IN,
  FURNITURE_CATALOG,
  WALL_MOUNT_BOTTOM,
  elevationBox,
  furnitureFootprint,
  placedFootprint,
  type PlacedCabinet,
  type PlacedFurniture,
  type RoomData,
} from "./design";
import { type ActiveFloorObstacle } from "./floorOccupancyState";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";
import { tubFillerMayShareFloorWith } from "./tubFillerFloor";

export type FloorRect = {
  uid: string;
  x: number;
  y: number;
  w: number;
  d: number;
  label: string;
};

export function floorRectsOverlap(a: FloorRect, b: Pick<FloorRect, "x" | "y" | "w" | "d">): boolean {
  return a.x < b.x + b.w - COLLISION_EPSILON_IN
    && a.x + a.w > b.x + COLLISION_EPSILON_IN
    && a.y < b.y + b.d - COLLISION_EPSILON_IN
    && a.y + a.d > b.y + COLLISION_EPSILON_IN;
}

/** Base, tall, and floor appliances own the slab. Wall cabinets hang above it. */
export function cabinetOwnsFloor(cabinet: PlacedCabinet): boolean {
  if (cabinet.floorOccupancyObstacle) return false;
  if (cabinet.placement === "base" || cabinet.placement === "tall") return true;
  if (cabinet.placement !== "appliance") return false;
  return elevationBox(cabinet).bottom <= 0.5;
}

export function cabinetFloorRectangle(cabinet: PlacedCabinet): FloorRect | null {
  if (!cabinetOwnsFloor(cabinet)) return null;
  const footprint = placedFootprint(cabinet);
  if (footprint.w <= COLLISION_EPSILON_IN || footprint.d <= COLLISION_EPSILON_IN) return null;
  return {
    uid: cabinet.uid,
    x: cabinet.x,
    y: cabinet.y,
    w: footprint.w,
    d: footprint.d,
    label: cabinet.masterCode,
  };
}

export function bathroomFixtureFloorRectangle(item: PlacedFurniture): FloorRect | null {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
  if (!definition || definition.category !== "bathroom-fixture") return null;
  const footprint = furnitureFootprint(item, definition);
  if (footprint.w <= COLLISION_EPSILON_IN || footprint.d <= COLLISION_EPSILON_IN) return null;
  const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition.pelicanCode);
  return {
    uid: item.uid,
    x: item.x,
    y: item.y,
    w: footprint.w,
    d: footprint.d,
    label: profile?.name ?? definition.name,
  };
}

/**
 * Synthetic floor bodies so cabinet collision, snapping, and wall free-segments
 * treat a fixture's measured envelope as occupied. The stored width and depth
 * are already the axis-aligned footprint, including a rotated tub.
 */
export function fixtureFloorCabinets(furniture: readonly PlacedFurniture[]): ActiveFloorObstacle[] {
  const obstacles: ActiveFloorObstacle[] = [];
  for (const item of furniture) {
    const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
    if (!definition || definition.category !== "bathroom-fixture") continue;
    const footprint = furnitureFootprint(item, definition);
    const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition.pelicanCode);
    const height = profile?.heightIn ?? 30;
    const reachesWallCabinets = height > WALL_MOUNT_BOTTOM + 0.01
      || profile?.kind === "shower-wall"
      || profile?.kind === "shower-door"
      || profile?.kind === "tub-door";
    obstacles.push({
      uid: `floor-obstacle:${item.uid}`,
      cabinetId: -1,
      masterCode: profile?.pelicanCode ?? definition.pelicanCode ?? definition.id,
      description: profile?.name ?? definition.name,
      placement: reachesWallCabinets ? "tall" : "base",
      x: item.x,
      y: item.y,
      width: footprint.w,
      depth: footprint.d,
      height,
      rotation: 0,
      floorOccupancyObstacle: true,
    });
  }
  return obstacles;
}

export function occupiedFloor(
  furniture: readonly PlacedFurniture[],
  cabinets: readonly PlacedCabinet[],
  ignoreUid?: string,
): FloorRect[] {
  return [
    ...furniture.flatMap((item) => {
      if (item.uid === ignoreUid) return [];
      const rect = bathroomFixtureFloorRectangle(item);
      return rect ? [rect] : [];
    }),
    ...cabinets.flatMap((cabinet) => {
      if (cabinet.uid === ignoreUid) return [];
      const rect = cabinetFloorRectangle(cabinet);
      return rect ? [rect] : [];
    }),
  ];
}

function insideRoom(rect: FloorRect, room: Pick<RoomData, "width" | "depth">): boolean {
  return rect.x >= -COLLISION_EPSILON_IN
    && rect.y >= -COLLISION_EPSILON_IN
    && rect.x + rect.w <= room.width + COLLISION_EPSILON_IN
    && rect.y + rect.d <= room.depth + COLLISION_EPSILON_IN;
}

function hitsAny(rect: FloorRect, occupied: readonly FloorRect[]): boolean {
  return occupied.some((body) => body.uid !== rect.uid && floorRectsOverlap(rect, body));
}

function overlapAmount(a: Pick<FloorRect, "x" | "y" | "w" | "d">, b: Pick<FloorRect, "x" | "y" | "w" | "d">, axis: "x" | "y"): number {
  return axis === "x"
    ? Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    : Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y);
}

/**
 * Slide to the nearest edge of one occupied body that stays in the room.
 * A wall on the nearer side does not trap the item inside the body; the far
 * side is used when it is the only clear one.
 */
function nearestEdgeClearOf(
  rect: FloorRect,
  body: FloorRect,
  room: Pick<RoomData, "width" | "depth">,
): { x: number; y: number } | null {
  const maxX = Math.max(0, room.width - rect.w);
  const maxY = Math.max(0, room.depth - rect.d);
  const options = [
    { x: body.x - rect.w, y: rect.y },
    { x: body.x + body.w, y: rect.y },
    { x: rect.x, y: body.y - rect.d },
    { x: rect.x, y: body.y + body.d },
  ];
  const scored = options.flatMap((option) => {
    const x = Math.max(0, Math.min(option.x, maxX));
    const y = Math.max(0, Math.min(option.y, maxY));
    const moved = { ...rect, x, y };
    if (overlapAmount(moved, body, "x") > COLLISION_EPSILON_IN && overlapAmount(moved, body, "y") > COLLISION_EPSILON_IN) return [];
    return [{ x, y, distance: (x - rect.x) ** 2 + (y - rect.y) ** 2 }];
  });
  scored.sort((left, right) => left.distance - right.distance);
  return scored[0] ?? null;
}

/** Push a rectangle out to the nearest in-room edge, repeating for each neighbor. */
export function pushFloorRectClear(
  rect: FloorRect,
  occupied: readonly FloorRect[],
  room: Pick<RoomData, "width" | "depth">,
): FloorRect | null {
  const maxX = Math.max(0, room.width - rect.w);
  const maxY = Math.max(0, room.depth - rect.d);
  let x = Math.max(0, Math.min(rect.x, maxX));
  let y = Math.max(0, Math.min(rect.y, maxY));
  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    for (const body of occupied) {
      if (body.uid === rect.uid) continue;
      const current = { ...rect, x, y };
      if (overlapAmount(current, body, "x") <= COLLISION_EPSILON_IN || overlapAmount(current, body, "y") <= COLLISION_EPSILON_IN) continue;
      const cleared = nearestEdgeClearOf(current, body, room);
      if (!cleared) continue;
      x = cleared.x;
      y = cleared.y;
      moved = true;
    }
    if (!moved) break;
  }
  const cleared = { ...rect, x, y };
  if (!insideRoom(cleared, room) || hitsAny(cleared, occupied)) return null;
  return cleared;
}

/**
 * Closest in-room spot whose footprint does not intersect occupied floor.
 * The room center is tried first so an empty room stays centered.
 */
export function nearestClearFloorPosition(
  footprint: { w: number; d: number },
  occupied: readonly FloorRect[],
  room: Pick<RoomData, "width" | "depth">,
  prefer?: { x: number; y: number },
): { x: number; y: number } | null {
  if (footprint.w > room.width + COLLISION_EPSILON_IN || footprint.d > room.depth + COLLISION_EPSILON_IN) return null;
  const preferred = prefer ?? {
    x: Math.max(0, (room.width - footprint.w) / 2),
    y: Math.max(0, (room.depth - footprint.d) / 2),
  };
  const maxX = Math.max(0, room.width - footprint.w);
  const maxY = Math.max(0, room.depth - footprint.d);
  const raw: Array<{ x: number; y: number }> = [
    preferred,
    { x: (room.width - footprint.w) / 2, y: (room.depth - footprint.d) / 2 },
    { x: 0, y: 0 },
    { x: maxX, y: 0 },
    { x: 0, y: maxY },
    { x: maxX, y: maxY },
    { x: (room.width - footprint.w) / 2, y: 0 },
    { x: (room.width - footprint.w) / 2, y: maxY },
    { x: 0, y: (room.depth - footprint.d) / 2 },
    { x: maxX, y: (room.depth - footprint.d) / 2 },
  ];
  for (const body of occupied) {
    raw.push(
      { x: body.x - footprint.w, y: body.y },
      { x: body.x + body.w, y: body.y },
      { x: body.x, y: body.y - footprint.d },
      { x: body.x, y: body.y + body.d },
      { x: body.x + (body.w - footprint.w) / 2, y: body.y - footprint.d },
      { x: body.x + (body.w - footprint.w) / 2, y: body.y + body.d },
      { x: body.x - footprint.w, y: body.y + (body.d - footprint.d) / 2 },
      { x: body.x + body.w, y: body.y + (body.d - footprint.d) / 2 },
    );
  }
  const step = 6;
  for (let y = 0; y <= maxY + COLLISION_EPSILON_IN; y += step) raw.push({ x: 0, y: Math.min(maxY, y) });
  for (let x = 0; x <= maxX + COLLISION_EPSILON_IN; x += step) {
    for (let y = 0; y <= maxY + COLLISION_EPSILON_IN; y += step) {
      raw.push({ x: Math.min(maxX, x), y: Math.min(maxY, y) });
    }
  }
  const seen = new Set<string>();
  const candidates = raw.flatMap((position) => {
    const x = Math.max(0, Math.min(position.x, maxX));
    const y = Math.max(0, Math.min(position.y, maxY));
    const key = `${Math.round(x * 8)}:${Math.round(y * 8)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ x, y }];
  });
  candidates.sort((left, right) => {
    const leftDistance = (left.x - preferred.x) ** 2 + (left.y - preferred.y) ** 2;
    const rightDistance = (right.x - preferred.x) ** 2 + (right.y - preferred.y) ** 2;
    return leftDistance - rightDistance;
  });
  for (const position of candidates) {
    const rect: FloorRect = { uid: "candidate", x: position.x, y: position.y, w: footprint.w, d: footprint.d, label: "" };
    if (insideRoom(rect, room) && !hitsAny(rect, occupied)) return position;
  }
  return null;
}

/** Drag a fixture to the requested point, or to the nearest clear edge.
 * Returns null when every correction still intersects occupied floor; the
 * caller keeps the last clear position. */
export function resolveFurnitureMove(
  item: PlacedFurniture,
  x: number,
  y: number,
  room: Pick<RoomData, "width" | "depth">,
  furniture: readonly PlacedFurniture[],
  cabinets: readonly PlacedCabinet[],
): PlacedFurniture | null {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
  const footprint = definition ? furnitureFootprint({ ...item, x, y }, definition) : { w: 24, d: 24 };
  const clamped = {
    ...item,
    x: Math.max(0, Math.min(x, Math.max(0, room.width - footprint.w))),
    y: Math.max(0, Math.min(y, Math.max(0, room.depth - footprint.d))),
  };
  if (!definition || definition.category !== "bathroom-fixture") return clamped;
  // A tub filler follows its own floor-space rule (`lib/tubFillerFloor`): it may
  // share the tub it fills, and nothing else. Every other fixture owns its floor.
  const occupied = occupiedFloor(furniture, cabinets, item.uid)
    .filter((other) => !tubFillerMayShareFloorWith({ filler: item, other, furniture }));
  const current: FloorRect = {
    uid: item.uid,
    x: clamped.x,
    y: clamped.y,
    w: footprint.w,
    d: footprint.d,
    label: definition.name,
  };
  if (!hitsAny(current, occupied)) return clamped;
  const cleared = pushFloorRectClear(current, occupied, room);
  return cleared ? { ...item, x: cleared.x, y: cleared.y } : null;
}
