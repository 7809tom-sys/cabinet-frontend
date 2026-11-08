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
 * Alcove tubs are three-wall fixtures.
 *
 * PL-02849 / PL-02850 / PL-02851 are not freestanding: they slot into an alcove
 * where the back and BOTH ends sit against walls and only the front apron is
 * exposed. So the only correct plan position for one is a bay — a wall whose two
 * ends each meet another wall — with the tub's length spanning that bay exactly.
 *
 * On the model itself only the apron is finished. The back and both ends are raw
 * flanges carrying a ~1" tiling lip, which is what the walls close against; they
 * are not meant to be seen.
 *
 * Everything here is advisory about the TUB ONLY. Nothing in this module moves,
 * nudges or deletes another item: a tub that does not fit a bay is still placed
 * (so the customer can see and fix it) and reports a warning.
 */

/** How far a bay may differ from the tub length and still count as a fit. */
export const ALCOVE_BAY_TOLERANCE_IN = 2;

/**
 * The shortest alcove opening Pelican sells is a 60" tub, so a wall shorter than
 * that cannot be an alcove tub's bay. Without this, the 36" end walls of a
 * 60 x 36 room would each count as a bay and a 60" tub would be seated across
 * the room's depth.
 */
export const ALCOVE_MIN_BAY_IN = 60;

/** Rotation is a quarter turn, so only axis-aligned bay walls can carry a tub. */
const AXIS_EPSILON = 0.01;

export type PlanPoint = { x: number; y: number };

export type AlcoveBay = {
  id: string;
  /** Back wall, in plan inches, in its own direction order. */
  start: PlanPoint;
  end: PlanPoint;
  /** Unit vector from `start` to `end`. */
  tangent: PlanPoint;
  /** Unit normal pointing out of the wall into the room — the way the apron faces. */
  inward: PlanPoint;
  /** Clear length along the back wall, i.e. the alcove opening. */
  spanIn: number;
  /** Quarter turn that puts this tub's back on the wall with its apron facing in. */
  rotation: 0 | 90 | 180 | 270;
};

export type AlcoveTubFit = {
  /** True when this model is an alcove tub and the bay logic applies. */
  applies: boolean;
  bay: AlcoveBay | null;
  /** Human-readable problems, empty when the tub sits correctly in its bay. */
  warnings: string[];
  /** True when the tub length matches the bay within tolerance. */
  lengthMatches: boolean;
  /** True when both ends of the tub land on the end walls. */
  endsMeetWalls: boolean;
  /** True when the tub's depth fits between the back wall and the room. */
  depthFits: boolean;
  /** Where the drain sits along the bay, seen from in front of the apron. */
  drainEnd: "left" | "right" | "center";
};

type WallSegment = { id: string; start: PlanPoint; end: PlanPoint; inward: PlanPoint };

function lengthOf(a: PlanPoint, b: PlanPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The four walls of a classic rectangular room, wound clockwise from (0,0). */
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

/** A polygon room's own measured walls, with the inward normal of each. */
function polygonWalls(room: RoomData): WallSegment[] {
  const vertices = room.vertices ?? [];
  const walls = room.customWalls ?? [];
  if (!vertices.length || !walls.length) return [];
  const byId = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  const segments: WallSegment[] = [];
  // Signed area tells us the winding, so the inward normal points into the room.
  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index]!;
    const b = vertices[(index + 1) % vertices.length]!;
    twiceArea += a.x * b.y - b.x * a.y;
  }
  const clockwise = twiceArea > 0;
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
    // For a clockwise ring the interior lies to the wall's left, so the inward
    // normal is the tangent turned a quarter turn that way.
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
 * The quarter turn that puts a tub's back on a wall and its apron into the room.
 *
 * The mesh is authored with its apron on -X and its length on Z, and the plan
 * maps x→X and y→Z. Under `rotation` the apron direction is
 * `(-cos(-r), sin(-r))` in plan terms, hence this table.
 */
export function alcoveRotationForInward(inward: PlanPoint): 0 | 90 | 180 | 270 | null {
  if (Math.abs(inward.x) > 1 - AXIS_EPSILON) return inward.x > 0 ? 180 : 0;
  if (Math.abs(inward.y) > 1 - AXIS_EPSILON) return inward.y > 0 ? 270 : 90;
  return null;
}

/** True when the wall runs along X (so a tub seated on it runs along X too). */
function runsAlongX(tangent: PlanPoint): boolean {
  return Math.abs(tangent.x) > Math.abs(tangent.y);
}

/**
 * Every bay a tub could be seated in.
 *
 * A bay is one wall whose two ends each meet another wall, which is what makes
 * an alcove: back wall plus two end walls. The opening is that wall's own clear
 * length, so a 60" tub needs a 60" run between the two returns.
 */
export function findAlcoveTubBays(room: RoomData): AlcoveBay[] {
  const walls = wallsOf(room);
  const bays: AlcoveBay[] = [];
  for (const wall of walls) {
    const spanIn = lengthOf(wall.start, wall.end);
    // Too short to be an alcove opening, so it is not a bay.
    if (spanIn < ALCOVE_MIN_BAY_IN - ALCOVE_BAY_TOLERANCE_IN) continue;
    const rotation = alcoveRotationForInward(wall.inward);
    if (rotation === null) continue;
    const tangent = {
      x: (wall.end.x - wall.start.x) / spanIn,
      y: (wall.end.y - wall.start.y) / spanIn,
    };
    // Both ends of this wall must be closed by another wall; otherwise there is
    // no alcove here, just a run of wall with a gap at one end.
    const closedAt = (point: PlanPoint) => walls.some((other) => other.id !== wall.id
      && (lengthOf(other.start, point) < ALCOVE_BAY_TOLERANCE_IN
        || lengthOf(other.end, point) < ALCOVE_BAY_TOLERANCE_IN));
    if (!closedAt(wall.start) || !closedAt(wall.end)) continue;
    bays.push({
      id: wall.id,
      start: wall.start,
      end: wall.end,
      tangent,
      inward: wall.inward,
      spanIn,
      rotation,
    });
  }
  return bays;
}

/** The bay whose centre is closest to a point, or null when there are none. */
export function nearestAlcoveTubBay(bays: readonly AlcoveBay[], point: PlanPoint): AlcoveBay | null {
  let best: { bay: AlcoveBay; distance: number } | null = null;
  for (const bay of bays) {
    const cx = (bay.start.x + bay.end.x) / 2;
    const cy = (bay.start.y + bay.end.y) / 2;
    const distance = (cx - point.x) ** 2 + (cy - point.y) ** 2;
    if (!best || distance < best.distance) best = { bay, distance };
  }
  return best?.bay ?? null;
}

/**
 * The bay this tub is actually seated in, if any.
 *
 * Nearest-centre is not good enough: a tub against the 60" back wall of a
 * 60×30 alcove has its centre 18" from one long wall and 12" from the other, so
 * a centre-distance test would report the wrong wall. Score how closely the tub
 * matches being seated in each bay instead — a tub that is flat on that wall
 * with the right quarter turn wins over one that merely sits nearby.
 */
export function seatedAlcoveTubBay(
  bays: readonly AlcoveBay[],
  tub: PlacedFurniture,
  definition: { w: number; d: number },
): AlcoveBay | null {
  let best: { bay: AlcoveBay; error: number } | null = null;
  for (const bay of bays) {
    const seated = alcoveTubInBayFor(tub, bay, definition);
    const rotationCost = ((tub.rotation % 360) + 360) % 360 === bay.rotation ? 0 : 1000;
    const error = rotationCost
      + Math.abs(seated.x - tub.x)
      + Math.abs(seated.y - tub.y);
    if (!best || error < best.error) best = { bay, error };
  }
  return best?.bay ?? null;
}

export function isAlcoveTubFurniture(item: Pick<PlacedFurniture, "defId" | "pelicanCode">): boolean {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition?.pelicanCode);
  return profile?.kind === "alcove-tub";
}

/**
 * Seat a tub in a bay: back flat on the back wall, apron into the room, and the
 * length centred across the opening.
 *
 * Centring keeps a tub that is a little shorter than its bay symmetrical instead
 * of jammed against one return, and the caller warns about the gap either way.
 * The maths runs along the bay's own tangent and inward normal, so it is the
 * same for all four walls and for a rotated polygon room.
 */
export function alcoveTubInBay(
  tub: PlacedFurniture,
  bay: AlcoveBay,
): PlacedFurniture {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === tub.defId);
  if (!definition) return { ...tub, rotation: bay.rotation };
  return alcoveTubInBayFor(tub, bay, definition);
}

/** The seating maths, with the definition passed in so it can be reused. */
function alcoveTubInBayFor(
  tub: PlacedFurniture,
  bay: AlcoveBay,
  definition: { w: number; d: number },
): PlacedFurniture {
  const rotation = bay.rotation;
  const acrossIn = Math.min(definition.w, definition.d);
  const alongIn = Math.max(definition.w, definition.d);
  // Distance along the wall to the tub's centre of length.
  const along = (bay.spanIn - alongIn) / 2 + alongIn / 2;
  const centre = {
    x: bay.start.x + bay.tangent.x * along + bay.inward.x * (acrossIn / 2),
    y: bay.start.y + bay.tangent.y * along + bay.inward.y * (acrossIn / 2),
  };
  const footprint = footprintFor(definition, rotation);
  return {
    ...tub,
    x: centre.x - footprint.w / 2,
    y: centre.y - footprint.d / 2,
    rotation,
  };
}

/** A rectangle's footprint after a quarter turn. */
function footprintFor(definition: { w: number; d: number }, rotation: number): { w: number; d: number } {
  const quarter = ((rotation % 360) + 360) % 360;
  return quarter === 90 || quarter === 270
    ? { w: definition.d, d: definition.w }
    : { w: definition.w, d: definition.d };
}

/**
 * The plan direction the model's own +Z axis points at a given quarter turn.
 *
 * The scene rotates by `-rotation` about Y and maps model z to plan y, so this
 * is the same transform `bathroomFurnitureTransform` applies.
 */
function modelForwardInPlan(rotation: number): PlanPoint {
  const radians = (-rotation * Math.PI) / 180;
  return { x: Math.sin(radians), y: Math.cos(radians) };
}

/**
 * Which end of the bay the drain sits at.
 *
 * The mesh puts a left-hand drain at -Z, so once the tub is seated the drain
 * points along the model's -Z axis; projecting that onto the bay's tangent says
 * whether that is the bay's start end or its end end. Reading it off the real
 * rotation keeps left and right honest on all four walls.
 */
export function alcoveDrainEnd(tub: PlacedFurniture, bay: AlcoveBay): "left" | "right" | "center" {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === tub.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(tub.pelicanCode ?? definition?.pelicanCode);
  const drain = profile?.drain;
  if (drain !== "left" && drain !== "right") return "center";
  const forward = modelForwardInPlan(tub.rotation);
  // A left-hand drain is at -Z; a right-hand drain is at +Z.
  const drainAxis = drain === "left" ? { x: -forward.x, y: -forward.y } : forward;
  // "Left" and "right" mean as the customer sees them standing at the apron.
  // Facing the tub, the viewer's right hand is `(-inward.y, inward.x)`, so the
  // sign of the drain along the bay tangent flips with the viewer's side.
  const viewerRight = { x: -bay.inward.y, y: bay.inward.x };
  const towardViewerRight = drainAxis.x * viewerRight.x + drainAxis.y * viewerRight.y;
  if (Math.abs(towardViewerRight) < 0.5) return "center";
  return towardViewerRight > 0 ? "right" : "left";
}

/**
 * Does this tub sit properly in a three-wall alcove?
 *
 * Reports problems instead of correcting them: the caller decides whether to
 * re-seat the tub, and nothing here ever touches another item.
 */
export function alcoveTubFit(
  tub: PlacedFurniture,
  room: RoomData,
  others: { furniture?: readonly PlacedFurniture[]; cabinets?: readonly PlacedCabinet[] } = {},
): AlcoveTubFit {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === tub.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(tub.pelicanCode ?? definition?.pelicanCode);
  if (!definition || profile?.kind !== "alcove-tub") {
    return { applies: false, bay: null, warnings: [], lengthMatches: true, endsMeetWalls: true, depthFits: true, drainEnd: "center" };
  }
  const label = profile.pelicanCode;
  // The tub's length is its long axis; an alcove tub spans its bay with it.
  const alongIn = Math.max(definition.w, definition.d);
  const acrossIn = Math.min(definition.w, definition.d);
  const bays = findAlcoveTubBays(room);
  const bay = seatedAlcoveTubBay(bays, tub, definition);
  const warnings: string[] = [];

  if (!bay) {
    warnings.push(`${label} is an alcove tub: it needs three walls — a back wall with a wall at each end. No such alcove was found in this room, so this is only a floor-plan placeholder.`);
    return { applies: true, bay: null, warnings, lengthMatches: false, endsMeetWalls: false, depthFits: false, drainEnd: "center" };
  }

  // 1. The opening has to be the tub's length, wall to wall.
  const gap = bay.spanIn - alongIn;
  const lengthMatches = Math.abs(gap) <= ALCOVE_BAY_TOLERANCE_IN;
  if (!lengthMatches) {
    warnings.push(gap > 0
      ? `This alcove is ${round1(bay.spanIn)}" from wall to wall but ${label} is ${round1(alongIn)}" long, leaving a ${round1(gap)}" gap. An alcove tub has to span its alcove end to end.`
      : `This alcove is ${round1(bay.spanIn)}" from wall to wall but ${label} is ${round1(alongIn)}" long, so it overruns the end walls by ${round1(-gap)}". An alcove tub has to span its alcove.`);
  }

  // 2. The tub's depth has to fit between the back wall and the room.
  const seated = alcoveTubInBay(tub, bay);
  const seatedFootprint = footprintFor(definition, seated.rotation);
  // Measure the tub where it actually sits, not where it would sit if re-seated.
  const placedFootprint = furnitureFootprint(tub, definition);
  const acrossInRoom = depthAvailableFrom(bay, room, acrossIn);
  const depthFits = acrossInRoom >= acrossIn - ALCOVE_BAY_TOLERANCE_IN;
  if (!depthFits) {
    warnings.push(`${label} is ${round1(acrossIn)}" deep but only ${round1(Math.max(0, acrossInRoom))}" is clear in front of this wall, so the apron will not fit in the alcove.`);
  }

  // 3. Both ends have to land on the end walls, measured from the tub as placed.
  const tubAlongStart = alongCoordinateOf(tub, bay);
  const bayLow = 0;
  const bayHigh = bay.spanIn;
  const startGap = Math.abs(tubAlongStart - bayLow);
  const endGap = Math.abs(tubAlongStart + alongSpanOf(placedFootprint, bay) - bayHigh);
  const endsMeetWalls = startGap <= ALCOVE_BAY_TOLERANCE_IN && endGap <= ALCOVE_BAY_TOLERANCE_IN;
  if (!endsMeetWalls && lengthMatches) {
    warnings.push(`${label} is not tight between the two end walls — move it so both ends touch.`);
  }

  // 3b. And it has to stay inside the room; a tub that pokes through a wall is
  //     not installed in an alcove at all.
  const outsideRoom = tub.x < -ALCOVE_BAY_TOLERANCE_IN
    || tub.y < -ALCOVE_BAY_TOLERANCE_IN
    || tub.x + placedFootprint.w > room.width + ALCOVE_BAY_TOLERANCE_IN
    || tub.y + placedFootprint.d > room.depth + ALCOVE_BAY_TOLERANCE_IN;
  if (outsideRoom) {
    warnings.push(`${label} extends past a room wall. An alcove tub has to sit entirely inside its alcove.`);
  }
  void seatedFootprint;

  // 4. Nothing else may occupy the tub's floor space. Reported, never resolved
  //    by moving the other item.
  const body: FloorRect = {
    uid: tub.uid,
    x: tub.x,
    y: tub.y,
    w: placedFootprint.w,
    d: placedFootprint.d,
    label: profile.name,
  };
  const occupied = occupiedFloor(others.furniture ?? [], others.cabinets ?? [], tub.uid);
  const blocker = occupied.find((other) => floorRectsOverlap(body, other));
  if (blocker) {
    warnings.push(`${blocker.label} overlaps ${label}. An alcove tub owns its whole floor space, so nothing else can sit in it.`);
  }

  // 5. It has to actually be sitting in that bay, not floating in the middle.
  const onWall = Math.abs(seated.x - tub.x) <= ALCOVE_BAY_TOLERANCE_IN
    && Math.abs(seated.y - tub.y) <= ALCOVE_BAY_TOLERANCE_IN
    && ((tub.rotation % 360) + 360) % 360 === bay.rotation;
  if (!onWall) {
    warnings.push(`${label} is not seated against a wall. An alcove tub's back and both ends have to meet walls, with only the front apron exposed.`);
  }

  return {
    applies: true,
    bay,
    warnings,
    lengthMatches,
    endsMeetWalls,
    depthFits,
    drainEnd: alcoveDrainEnd(tub, bay),
  };
}

/** Distance along the bay's tangent from the bay's start to a plan point. */
function alongCoordinate(point: PlanPoint, bay: AlcoveBay): number {
  return (point.x - bay.start.x) * bay.tangent.x + (point.y - bay.start.y) * bay.tangent.y;
}

/**
 * The tub's near edge measured along the bay tangent.
 *
 * The plan box's top-left corner is not necessarily the near edge once the tub
 * is turned, so take the minimum over all four corners.
 */
function alongCoordinateOf(tub: PlacedFurniture, bay: AlcoveBay): number {
  const footprint = footprintFor(
    FURNITURE_CATALOG.find((entry) => entry.id === tub.defId) ?? { w: 0, d: 0 },
    tub.rotation,
  );
  const corners = [
    { x: tub.x, y: tub.y },
    { x: tub.x + footprint.w, y: tub.y },
    { x: tub.x, y: tub.y + footprint.d },
    { x: tub.x + footprint.w, y: tub.y + footprint.d },
  ];
  return Math.min(...corners.map((corner) => alongCoordinate(corner, bay)));
}

/** The tub footprint's extent measured along the bay tangent. */
function alongSpanOf(footprint: { w: number; d: number }, bay: AlcoveBay): number {
  return Math.abs(bay.tangent.x) > Math.abs(bay.tangent.y) ? footprint.w : footprint.d;
}

/**
 * How much clear depth there is between a wall and whatever closes the room in
 * front of it. For a rectangular room that is the room's own other dimension;
 * for a polygon room it is the nearest other wall along the inward normal.
 */
function depthAvailableFrom(bay: AlcoveBay, room: RoomData, fallback: number): number {
  const probeStart = {
    x: bay.start.x + bay.tangent.x * (bay.spanIn / 2),
    y: bay.start.y + bay.tangent.y * (bay.spanIn / 2),
  };
  const isPolygon = Boolean(room.vertices?.length && room.customWalls?.length);
  if (!isPolygon) {
    // Rectangular: the room's other dimension, measured from the wall outward.
    const onHorizontalWall = Math.abs(bay.tangent.x) > Math.abs(bay.tangent.y);
    return onHorizontalWall ? room.depth : room.width;
  }
  // Polygon: march along the inward normal until we leave the room.
  let distance = 0;
  const step = 0.5;
  const limit = Math.max(room.width, room.depth) + 1;
  while (distance < limit) {
    const point = {
      x: probeStart.x + bay.inward.x * (distance + step),
      y: probeStart.y + bay.inward.y * (distance + step),
    };
    if (!roomPointInside(room, point)) break;
    distance += step;
  }
  return distance || fallback;
}

function roomPointInside(room: RoomData, point: PlanPoint): boolean {
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

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
