import {
  FURNITURE_CATALOG,
  furnitureFootprint,
  type PlacedCabinet,
  type PlacedFurniture,
  type RoomData,
} from "./design";
import { floorRectsOverlap, occupiedFloor, type FloorRect } from "./floorOccupancy";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";

/**
 * Shower placement: pans are three-wall fixtures, everything else is a wall
 * fitting.
 *
 * A shower pan sits on the floor inside an alcove or corner — the back and both
 * ends against walls, the front lip exposed — so the only correct plan position
 * is a bay whose opening is the pan's own length. That is the same rule an
 * alcove tub follows, and it lives here rather than being imported so the shower
 * designer stays independent of the tub work.
 *
 * Surrounds, shower systems, niches and soap trays are wall fittings: they hold
 * no floor, so they never block anything and never become floor bodies.
 *
 * Everything here is advisory about the shower fixture alone. Nothing in this
 * module moves, nudges or deletes another item.
 */

/** How far a bay may differ from the pan length and still count as a fit. */
export const SHOWER_BAY_TOLERANCE_IN = 2;

/** The shortest pan Pelican sells is 48", so a bay has to be at least that. */
export const SHOWER_MIN_BAY_IN = 48;

const AXIS_EPSILON = 0.01;

export type PlanPoint = { x: number; y: number };

export type ShowerBay = {
  id: string;
  start: PlanPoint;
  end: PlanPoint;
  tangent: PlanPoint;
  /** Unit normal out of the wall into the room — the way the front lip faces. */
  inward: PlanPoint;
  spanIn: number;
  /** Quarter turn that puts this pan's back on the wall and its lip into the room. */
  rotation: 0 | 90 | 180 | 270;
};

export type ShowerFit = {
  applies: boolean;
  bay: ShowerBay | null;
  warnings: string[];
  lengthMatches: boolean;
  depthFits: boolean;
  endsMeetWalls: boolean;
};

type WallSegment = { id: string; start: PlanPoint; end: PlanPoint; inward: PlanPoint };

function lengthOf(a: PlanPoint, b: PlanPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function rectangleWalls(room: Pick<RoomData, "width" | "depth">): WallSegment[] {
  const W = room.width;
  const D = room.depth;
  return [
    { id: "top", start: { x: 0, y: 0 }, end: { x: W, y: 0 }, inward: { x: 0, y: 1 } },
    { id: "right", start: { x: W, y: 0 }, end: { x: W, y: D }, inward: { x: -1, y: 0 } },
    { id: "bottom", start: { x: W, y: D }, end: { x: 0, y: D }, inward: { x: 0, y: -1 } },
    { id: "left", start: { x: 0, y: D }, end: { x: 0, y: 0 }, inward: { x: 1, y: 0 } },
  ];
}

function polygonWalls(room: RoomData): WallSegment[] {
  const vertices = room.vertices ?? [];
  const walls = room.customWalls ?? [];
  if (!vertices.length || !walls.length) return [];
  const byId = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index]!;
    const b = vertices[(index + 1) % vertices.length]!;
    twiceArea += a.x * b.y - b.x * a.y;
  }
  const clockwise = twiceArea > 0;
  const segments: WallSegment[] = [];
  for (const wall of walls) {
    const a = byId.get(wall.startVertexId);
    const b = byId.get(wall.endVertexId);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;
    const tx = dx / length;
    const ty = dy / length;
    const inward = clockwise ? { x: -ty, y: tx } : { x: ty, y: -tx };
    segments.push({ id: wall.id, start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y }, inward });
  }
  return segments;
}

function wallsOf(room: RoomData): WallSegment[] {
  if (room.vertices?.length && room.customWalls?.length) return polygonWalls(room);
  return rectangleWalls(room);
}

/**
 * The quarter turn that puts a pan's back on a wall with its lip into the room.
 *
 * The pan mesh is authored with its front lip on -X and its length on Z, and the
 * plan maps x to X and y to Z, so the lip faces (-cos(-r), sin(-r)).
 */
export function showerRotationForInward(inward: PlanPoint): 0 | 90 | 180 | 270 | null {
  // Measured off the built mesh, not hand-derived: at rotation 0 the pan's front
  // lip faces plan -Y, so a wall whose inward normal is +Y needs a half turn.
  // Each further quarter turn walks the lip one step round.
  if (Math.abs(inward.y) > 1 - AXIS_EPSILON) return inward.y > 0 ? 180 : 0;
  if (Math.abs(inward.x) > 1 - AXIS_EPSILON) return inward.x > 0 ? 270 : 90;
  return null;
}

/**
 * Every bay a shower pan could be seated in.
 *
 * A bay is one wall whose two ends each meet another wall and whose clear length
 * can take the shortest pan Pelican sells. Without that length floor the short
 * return of a small room would count as a bay and a 60" pan would be seated
 * across the room's depth.
 */
export function findShowerBays(room: RoomData): ShowerBay[] {
  const walls = wallsOf(room);
  const bays: ShowerBay[] = [];
  for (const wall of walls) {
    const spanIn = lengthOf(wall.start, wall.end);
    if (spanIn < SHOWER_MIN_BAY_IN - SHOWER_BAY_TOLERANCE_IN) continue;
    const rotation = showerRotationForInward(wall.inward);
    if (rotation === null) continue;
    const tangent = {
      x: (wall.end.x - wall.start.x) / spanIn,
      y: (wall.end.y - wall.start.y) / spanIn,
    };
    const closedAt = (point: PlanPoint) => walls.some((other) => other.id !== wall.id
      && (lengthOf(other.start, point) < SHOWER_BAY_TOLERANCE_IN
        || lengthOf(other.end, point) < SHOWER_BAY_TOLERANCE_IN));
    if (!closedAt(wall.start) || !closedAt(wall.end)) continue;
    bays.push({ id: wall.id, start: wall.start, end: wall.end, tangent, inward: wall.inward, spanIn, rotation });
  }
  return bays;
}

function footprintFor(definition: { w: number; d: number }, rotation: number): { w: number; d: number } {
  const quarter = ((rotation % 360) + 360) % 360;
  return quarter === 90 || quarter === 270
    ? { w: definition.d, d: definition.w }
    : { w: definition.w, d: definition.d };
}

/** Seat a pan in a bay: back on the wall, lip into the room, centred across it. */
function seatInBay(
  pan: PlacedFurniture,
  bay: ShowerBay,
  definition: { w: number; d: number },
): PlacedFurniture {
  // Work in the BAY's frame, not the definition's: after the quarter turn the
  // pan's length may run along X or along Z, so take each extent from the turned
  // footprint rather than assuming the definition's own w/d order.
  const footprint = footprintFor(definition, bay.rotation);
  const alongX = Math.abs(bay.tangent.x) > Math.abs(bay.tangent.y);
  // Extent measured along the wall, and the depth measured away from it.
  const alongIn = alongX ? footprint.w : footprint.d;
  const acrossIn = alongX ? footprint.d : footprint.w;
  // Centre of the run, then step off the wall by half the depth.
  const along = (bay.spanIn - alongIn) / 2 + alongIn / 2;
  const centre = {
    x: bay.start.x + bay.tangent.x * along + bay.inward.x * (acrossIn / 2),
    y: bay.start.y + bay.tangent.y * along + bay.inward.y * (acrossIn / 2),
  };
  return {
    ...pan,
    x: centre.x - footprint.w / 2,
    y: centre.y - footprint.d / 2,
    rotation: bay.rotation,
  };
}

export function seatShowerPanInBay(pan: PlacedFurniture, bay: ShowerBay): PlacedFurniture {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === pan.defId);
  if (!definition) return { ...pan, rotation: bay.rotation };
  return seatInBay(pan, bay, definition);
}

export function isShowerPanFurniture(item: Pick<PlacedFurniture, "defId" | "pelicanCode">): boolean {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition?.pelicanCode);
  return profile?.kind === "shower-pan";
}

/** True for every shower fixture that lives on a wall rather than the floor. */
export function isWallMountedShowerFixture(item: Pick<PlacedFurniture, "defId" | "pelicanCode">): boolean {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition?.pelicanCode);
  return profile?.kind === "shower-surround"
    || profile?.kind === "shower-system"
    || profile?.kind === "shower-niche"
    || profile?.kind === "soap-tray"
    || profile?.kind === "shower-door"
    || profile?.kind === "tub-door";
}

/** The bay a pan is actually seated in, scored by how well it matches. */
function seatedBay(bays: readonly ShowerBay[], pan: PlacedFurniture, definition: { w: number; d: number }): ShowerBay | null {
  let best: { bay: ShowerBay; error: number } | null = null;
  for (const bay of bays) {
    const seated = seatInBay(pan, bay, definition);
    const rotationCost = ((pan.rotation % 360) + 360) % 360 === bay.rotation ? 0 : 1000;
    const error = rotationCost + Math.abs(seated.x - pan.x) + Math.abs(seated.y - pan.y);
    if (!best || error < best.error) best = { bay, error };
  }
  return best?.bay ?? null;
}

/**
 * Does this pan sit properly in a shower alcove?
 *
 * Reports problems instead of correcting them, and never touches another item.
 */
export function showerPanFit(
  pan: PlacedFurniture,
  room: RoomData,
  others: { furniture?: readonly PlacedFurniture[]; cabinets?: readonly PlacedCabinet[] } = {},
): ShowerFit {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === pan.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(pan.pelicanCode ?? definition?.pelicanCode);
  if (!definition || profile?.kind !== "shower-pan") {
    return { applies: false, bay: null, warnings: [], lengthMatches: true, depthFits: true, endsMeetWalls: true };
  }
  const label = profile.pelicanCode;
  const alongIn = Math.max(definition.w, definition.d);
  const acrossIn = Math.min(definition.w, definition.d);
  const bays = findShowerBays(room);
  const bay = seatedBay(bays, pan, definition);
  const warnings: string[] = [];

  if (!bay) {
    warnings.push(label + " is a shower pan: it needs three walls - a back wall with a wall at each end. No such alcove was found in this room, so this is only a floor-plan placeholder.");
    return { applies: true, bay: null, warnings, lengthMatches: false, depthFits: false, endsMeetWalls: false };
  }

  const gap = bay.spanIn - alongIn;
  const lengthMatches = Math.abs(gap) <= SHOWER_BAY_TOLERANCE_IN;
  if (!lengthMatches) {
    warnings.push(gap > 0
      ? "This shower alcove is " + round1(bay.spanIn) + "\" wide but " + label + " is " + round1(alongIn) + "\", leaving a " + round1(gap) + "\" gap. A pan has to span its alcove end to end."
      : "This shower alcove is " + round1(bay.spanIn) + "\" wide but " + label + " is " + round1(alongIn) + "\", so it overruns the end walls by " + round1(-gap) + "\".");
  }

  const clearDepth = depthAvailableFrom(bay, room, acrossIn);
  const depthFits = clearDepth >= acrossIn - SHOWER_BAY_TOLERANCE_IN;
  if (!depthFits) {
    warnings.push(label + " is " + round1(acrossIn) + "\" deep but only " + round1(Math.max(0, clearDepth)) + "\" is clear in front of this wall.");
  }

  const footprint = furnitureFootprint(pan, definition);
  const alongAxisX = Math.abs(bay.tangent.x) > Math.abs(bay.tangent.y);
  const panStart = alongAxisX ? pan.x : pan.y;
  const panSpan = alongAxisX ? footprint.w : footprint.d;
  const endsMeetWalls = panStart <= SHOWER_BAY_TOLERANCE_IN
    && Math.abs(panStart + panSpan - bay.spanIn) <= SHOWER_BAY_TOLERANCE_IN;
  if (!endsMeetWalls && lengthMatches) {
    warnings.push(label + " is not tight between the two end walls - move it so both ends touch.");
  }

  const body: FloorRect = { uid: pan.uid, x: pan.x, y: pan.y, w: footprint.w, d: footprint.d, label: profile.name };
  const occupied = occupiedFloor(others.furniture ?? [], others.cabinets ?? [], pan.uid);
  const blocker = occupied.find((other) => floorRectsOverlap(body, other));
  if (blocker) {
    warnings.push(blocker.label + " overlaps " + label + ". A shower pan owns its floor space, so nothing else can sit in it.");
  }

  return { applies: true, bay, warnings, lengthMatches, depthFits, endsMeetWalls };
}

function depthAvailableFrom(bay: ShowerBay, room: RoomData, fallback: number): number {
  const isPolygon = Boolean(room.vertices?.length && room.customWalls?.length);
  if (!isPolygon) {
    const onHorizontalWall = Math.abs(bay.tangent.x) > Math.abs(bay.tangent.y);
    return onHorizontalWall ? room.depth : room.width;
  }
  const start = {
    x: bay.start.x + bay.tangent.x * (bay.spanIn / 2),
    y: bay.start.y + bay.tangent.y * (bay.spanIn / 2),
  };
  let distance = 0;
  const step = 0.5;
  const limit = Math.max(room.width, room.depth) + 1;
  while (distance < limit) {
    const point = {
      x: start.x + bay.inward.x * (distance + step),
      y: start.y + bay.inward.y * (distance + step),
    };
    if (!pointInside(room, point)) break;
    distance += step;
  }
  return distance || fallback;
}

function pointInside(room: RoomData, point: PlanPoint): boolean {
  const vertices = room.vertices ?? [];
  if (vertices.length < 3) return true;
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
    const a = vertices[index]!;
    const b = vertices[previous]!;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Where a shower pan goes: into a bay, preferring one that matches its length
 * and is clear. Returns null when the room has no bay at all.
 */
export function placeShowerPanInBay(
  pan: PlacedFurniture,
  furniture: readonly PlacedFurniture[],
  room: RoomData,
  cabinets: readonly PlacedCabinet[] = [],
  near?: { x: number; y: number },
): { placement: PlacedFurniture; fit: ShowerFit } | null {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === pan.defId);
  if (!definition || !isShowerPanFurniture(pan)) return null;
  const bays = findShowerBays(room);
  if (!bays.length) return null;
  const alongIn = Math.max(definition.w, definition.d);
  const occupied = occupiedFloor(furniture, cabinets, pan.uid);
  const target = near ?? { x: room.width / 2, y: room.depth / 2 };
  const scored = bays.map((bay) => {
    const seated = seatInBay(pan, bay, definition);
    const footprint = furnitureFootprint(seated, definition);
    const body: FloorRect = { uid: pan.uid, x: seated.x, y: seated.y, w: footprint.w, d: footprint.d, label: definition.name };
    const clear = !occupied.some((other) => floorRectsOverlap(body, other));
    const centre = { x: seated.x + footprint.w / 2, y: seated.y + footprint.d / 2 };
    return {
      seated,
      clear,
      matches: Math.abs(bay.spanIn - alongIn) <= SHOWER_BAY_TOLERANCE_IN,
      distance: (centre.x - target.x) ** 2 + (centre.y - target.y) ** 2,
    };
  });
  scored.sort((left, right) => {
    if (left.clear !== right.clear) return left.clear ? -1 : 1;
    if (left.matches !== right.matches) return left.matches ? -1 : 1;
    return left.distance - right.distance;
  });
  const chosen = scored[0]!;
  return { placement: chosen.seated, fit: showerPanFit(chosen.seated, room, { furniture, cabinets }) };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
