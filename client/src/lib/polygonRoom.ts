/**
 * Polygon Room Geometry
 *
 * Provides types and helpers for non-rectangular (polygon) room shapes.
 * When a RoomData has `vertices` and `customWalls`, the room is treated as
 * a polygon; otherwise it falls back to the classic rectangle model.
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

/** A vertex (corner) of the room polygon, in inches from the top-left origin. */
export interface RoomVertex {
  id: string;
  x: number;
  y: number;
}

/** A wall segment connecting two vertices. */
export interface CustomWall {
  id: string;
  startVertexId: string;
  endVertexId: string;
  /** User-facing label, e.g. "Back wall 1" */
  label?: string;
  /** Deliberate v1 diagonal direction; no free-form angle is persisted. */
  lockedAngle?: 45 | -45;
  /** Optional finished height for this selected wall segment in inches. */
  height?: number;
}

export type WallBuilderTurn = "start" | "straight" | "left45" | "right45" | "left90" | "right90";

/** One measured wall in the continuous room-outline builder. */
export interface WallBuilderSegment {
  lengthIn: number;
  /** Absolute plan heading in degrees; always one of the eight 45-degree bearings. */
  headingDeg: number;
  /** The deliberate turn made from the prior wall. */
  turn: WallBuilderTurn;
}

export interface WallBuilderGeometry {
  points: Array<{ x: number; y: number }>;
  closed: boolean;
  error: string | null;
}

export interface WallBuilderRoomGeometry {
  vertices: RoomVertex[];
  customWalls: CustomWall[];
  width: number;
  depth: number;
  openWallPath: boolean;
}

export interface WallBuilderMetrics {
  perimeterIn: number;
  areaSqFt: number | null;
  closed: boolean;
}

export const WALL_BUILDER_MIN_WALL_IN = 6;
const WALL_BUILDER_EPSILON = 0.01;

// ─── ID Generation ──────────────────────────────────────────────────────────────

let _counter = 0;
export function genVertexId(): string {
  return `v_${Date.now().toString(36)}_${(++_counter).toString(36)}`;
}
export function genWallId(): string {
  return `cw_${Date.now().toString(36)}_${(++_counter).toString(36)}`;
}

// ─── Rectangle → Polygon Conversion ────────────────────────────────────────────

/**
 * Convert a simple width×depth rectangle into a polygon (4 vertices, 4 walls).
 * Vertex order: clockwise starting from top-left.
 *   v0 (0,0) ─── v1 (width,0)
 *    │                │
 *   v3 (0,depth) ── v2 (width,depth)
 *
 * Wall mapping to classic WallSide:
 *   top    = v0 → v1
 *   right  = v1 → v2
 *   bottom = v2 → v3
 *   left   = v3 → v0
 */
export function rectToPolygon(width: number, depth: number): {
  vertices: RoomVertex[];
  customWalls: CustomWall[];
} {
  const v0: RoomVertex = { id: genVertexId(), x: 0, y: 0 };
  const v1: RoomVertex = { id: genVertexId(), x: width, y: 0 };
  const v2: RoomVertex = { id: genVertexId(), x: width, y: depth };
  const v3: RoomVertex = { id: genVertexId(), x: 0, y: depth };

  const vertices = [v0, v1, v2, v3];
  const customWalls: CustomWall[] = [
    { id: genWallId(), startVertexId: v0.id, endVertexId: v1.id, label: "Back" },
    { id: genWallId(), startVertexId: v1.id, endVertexId: v2.id, label: "Right" },
    { id: genWallId(), startVertexId: v2.id, endVertexId: v3.id, label: "Front" },
    { id: genWallId(), startVertexId: v3.id, endVertexId: v0.id, label: "Left" },
  ];

  return { vertices, customWalls };
}

// ─── Geometry Helpers ───────────────────────────────────────────────────────────

/** Distance between two points. */
export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Finished framed/drywall wall thickness used by both standard and measured room shells. */
export const ROOM_WALL_THICKNESS_IN = 4.5;

export type WallOutlinePoint = { x: number; y: number };

/** A centre-line segment supplied by either the classic room or Continuous Wall Builder. */
export type WallOutlineCenterLine = {
  id: string;
  start: WallOutlinePoint;
  end: WallOutlinePoint;
};

/**
 * A finite-thickness wall segment. Corners are clockwise around its footprint:
 * start-left, end-left, end-right, start-right. Adjacent mitered segments
 * share their corresponding vertices exactly.
 */
export type MiteredWallOutline = WallOutlineCenterLine & {
  corners: [WallOutlinePoint, WallOutlinePoint, WallOutlinePoint, WallOutlinePoint];
  miteredStart: boolean;
  miteredEnd: boolean;
};

const WALL_OUTLINE_EPSILON = 1e-7;

function sameWallOutlinePoint(a: WallOutlinePoint, b: WallOutlinePoint, epsilon = WALL_OUTLINE_EPSILON) {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

function wallOutlineNormal(segment: WallOutlineCenterLine): WallOutlinePoint | null {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= WALL_OUTLINE_EPSILON) return null;
  return { x: -dy / length, y: dx / length };
}

function offsetWallOutlinePoint(point: WallOutlinePoint, normal: WallOutlinePoint, amount: number): WallOutlinePoint {
  return { x: point.x + normal.x * amount, y: point.y + normal.y * amount };
}

function intersectWallOutlineLines(
  firstPoint: WallOutlinePoint,
  firstDirection: WallOutlinePoint,
  secondPoint: WallOutlinePoint,
  secondDirection: WallOutlinePoint,
): WallOutlinePoint | null {
  const determinant = firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x;
  if (Math.abs(determinant) <= WALL_OUTLINE_EPSILON) return null;
  const deltaX = secondPoint.x - firstPoint.x;
  const deltaY = secondPoint.y - firstPoint.y;
  const distance = (deltaX * secondDirection.y - deltaY * secondDirection.x) / determinant;
  return {
    x: firstPoint.x + firstDirection.x * distance,
    y: firstPoint.y + firstDirection.y * distance,
  };
}

/**
 * Produces a single mitered wall outline from ordered centre lines. The classic
 * room and Continuous Wall Builder intentionally call this same routine. A
 * connected joint intersects matching left/right offset lines; an intentional
 * free end keeps a square cap at its original centre-line endpoint.
 */
export function miteredWallOutlines(
  segments: WallOutlineCenterLine[],
  thickness: number = ROOM_WALL_THICKNESS_IN,
  closed = false,
): MiteredWallOutline[] {
  const halfThickness = Math.max(0, Number(thickness) || 0) / 2;
  if (segments.length === 0) return [];

  const normals = segments.map(wallOutlineNormal);
  const cornersFor = (index: number, side: 1 | -1, endpoint: "start" | "end") => {
    const segment = segments[index]!;
    const normal = normals[index];
    const anchor = endpoint === "start" ? segment.start : segment.end;
    if (!normal || halfThickness <= WALL_OUTLINE_EPSILON) return { point: { ...anchor }, mitered: false };

    const neighborIndex = endpoint === "start"
      ? (index > 0 ? index - 1 : closed ? segments.length - 1 : -1)
      : (index < segments.length - 1 ? index + 1 : closed ? 0 : -1);
    const neighbor = neighborIndex >= 0 ? segments[neighborIndex] : null;
    const neighborNormal = neighborIndex >= 0 ? normals[neighborIndex] : null;
    const expectedNeighborPoint = endpoint === "start" ? neighbor?.end : neighbor?.start;
    if (!neighbor || !neighborNormal || !expectedNeighborPoint || !sameWallOutlinePoint(anchor, expectedNeighborPoint)) {
      return { point: offsetWallOutlinePoint(anchor, normal, side * halfThickness), mitered: false };
    }

    const offsetAnchor = offsetWallOutlinePoint(anchor, normal, side * halfThickness);
    const neighborOffsetAnchor = offsetWallOutlinePoint(anchor, neighborNormal, side * halfThickness);
    const direction = { x: segment.end.x - segment.start.x, y: segment.end.y - segment.start.y };
    const neighborDirection = { x: neighbor.end.x - neighbor.start.x, y: neighbor.end.y - neighbor.start.y };
    const intersection = intersectWallOutlineLines(offsetAnchor, direction, neighborOffsetAnchor, neighborDirection);
    return { point: intersection ?? offsetAnchor, mitered: Boolean(intersection) };
  };

  return segments.flatMap((segment, index) => {
    const normal = normals[index];
    if (!normal) return [];
    const startLeft = cornersFor(index, 1, "start");
    const endLeft = cornersFor(index, 1, "end");
    const endRight = cornersFor(index, -1, "end");
    const startRight = cornersFor(index, -1, "start");
    return [{
      ...segment,
      corners: [startLeft.point, endLeft.point, endRight.point, startRight.point],
      miteredStart: startLeft.mitered && startRight.mitered,
      miteredEnd: endLeft.mitered && endRight.mitered,
    }];
  });
}

/**
 * Builds the same sharp, finite-thickness wall solids when the saved segment
 * denotes the **finished room-facing wall surface**, not a structural
 * centerline. Cabinet placement, openings, dimensions, and Wall Builder
 * measurements are authored to that finished surface: a cabinet back at a
 * saved wall coordinate must touch it, never disappear halfway through a
 * symmetric 4½-inch wall body.
 *
 * Each segment declares which side is the room interior. The helper keeps that
 * face at the supplied measured segment, offsets only the exterior face by the
 * full wall thickness, and intersects matching faces at every shared joint.
 * That preserves exact 45°/90° miter joints and square open ends without
 * moving the usable room boundary.
 */
export function miteredWallOutlinesFromInteriorFaces(
  segments: Array<WallOutlineCenterLine & { interiorOnLeft: boolean }>,
  thickness: number = ROOM_WALL_THICKNESS_IN,
  closed = false,
): MiteredWallOutline[] {
  const resolvedThickness = Math.max(0, Number(thickness) || 0);
  const normals = segments.map(wallOutlineNormal);
  const facePoint = (
    segment: typeof segments[number],
    normal: WallOutlinePoint | null,
    side: 1 | -1,
    endpoint: "start" | "end",
  ) => {
    const anchor = endpoint === "start" ? segment.start : segment.end;
    if (!normal || resolvedThickness <= WALL_OUTLINE_EPSILON || (side === 1) === segment.interiorOnLeft) return { ...anchor };
    return offsetWallOutlinePoint(anchor, normal, side * resolvedThickness);
  };
  const cornerFor = (index: number, side: 1 | -1, endpoint: "start" | "end") => {
    const segment = segments[index]!;
    const normal = normals[index];
    const anchor = endpoint === "start" ? segment.start : segment.end;
    const neighborIndex = endpoint === "start"
      ? (index > 0 ? index - 1 : closed ? segments.length - 1 : -1)
      : (index < segments.length - 1 ? index + 1 : closed ? 0 : -1);
    const neighbor = neighborIndex >= 0 ? segments[neighborIndex] : null;
    const neighborNormal = neighborIndex >= 0 ? normals[neighborIndex] : null;
    const expectedNeighborPoint = endpoint === "start" ? neighbor?.end : neighbor?.start;
    const faceAnchor = facePoint(segment, normal, side, endpoint);
    if (!neighbor || !neighborNormal || !expectedNeighborPoint || !sameWallOutlinePoint(anchor, expectedNeighborPoint)) {
      return { point: faceAnchor, mitered: false };
    }
    const neighborFaceAnchor = facePoint(neighbor, neighborNormal, side, endpoint === "start" ? "end" : "start");
    const direction = { x: segment.end.x - segment.start.x, y: segment.end.y - segment.start.y };
    const neighborDirection = { x: neighbor.end.x - neighbor.start.x, y: neighbor.end.y - neighbor.start.y };
    const intersection = intersectWallOutlineLines(faceAnchor, direction, neighborFaceAnchor, neighborDirection);
    return { point: intersection ?? faceAnchor, mitered: Boolean(intersection) };
  };

  return segments.flatMap((segment, index) => {
    if (!normals[index]) return [];
    const startLeft = cornerFor(index, 1, "start");
    const endLeft = cornerFor(index, 1, "end");
    const endRight = cornerFor(index, -1, "end");
    const startRight = cornerFor(index, -1, "start");
    return [{
      id: segment.id,
      start: { ...segment.start },
      end: { ...segment.end },
      corners: [startLeft.point, endLeft.point, endRight.point, startRight.point],
      miteredStart: startLeft.mitered && startRight.mitered,
      miteredEnd: endLeft.mitered && endRight.mitered,
    }];
  });
}

/** Length of a wall segment in inches. */
export function wallSegmentLength(wall: CustomWall, vertices: RoomVertex[]): number {
  const start = vertices.find((v) => v.id === wall.startVertexId);
  const end = vertices.find((v) => v.id === wall.endVertexId);
  if (!start || !end) return 0;
  return dist(start, end);
}

/** Midpoint of a wall segment. */
export function wallMidpoint(wall: CustomWall, vertices: RoomVertex[]): { x: number; y: number } {
  const start = vertices.find((v) => v.id === wall.startVertexId);
  const end = vertices.find((v) => v.id === wall.endVertexId);
  if (!start || !end) return { x: 0, y: 0 };
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

/** Angle of a wall segment in radians (from start to end). */
export function wallAngle(wall: CustomWall, vertices: RoomVertex[]): number {
  const start = vertices.find((v) => v.id === wall.startVertexId);
  const end = vertices.find((v) => v.id === wall.endVertexId);
  if (!start || !end) return 0;
  return Math.atan2(end.y - start.y, end.x - start.x);
}

/** True only for the explicit v1 45-degree controls. */
export function isLocked45Wall(wall: CustomWall | null | undefined): wall is CustomWall & { lockedAngle: 45 | -45 } {
  return wall?.lockedAngle === 45 || wall?.lockedAngle === -45;
}

/**
 * Rotate one selected polygon segment to an exact, persisted 45-degree direction
 * while preserving its measured length. This changes only the segment end vertex.
 */
export function lockWallToAngle(
  wallId: string,
  angle: 45 | -45,
  vertices: RoomVertex[],
  customWalls: CustomWall[],
): { vertices: RoomVertex[]; customWalls: CustomWall[] } | null {
  const wall = customWalls.find((candidate) => candidate.id === wallId);
  const start = wall ? vertices.find((vertex) => vertex.id === wall.startVertexId) : null;
  const end = wall ? vertices.find((vertex) => vertex.id === wall.endVertexId) : null;
  if (!wall || !start || !end) return null;
  const length = Math.max(6, wallSegmentLength(wall, vertices));
  const radians = angle * Math.PI / 180;
  const nextVertices = vertices.map((vertex) => vertex.id === end.id
    ? { ...vertex, x: Math.round((start.x + Math.cos(radians) * length) * 8) / 8, y: Math.round((start.y + Math.sin(radians) * length) * 8) / 8 }
    : vertex,
  );
  const nextWalls = customWalls.map((candidate) => candidate.id === wallId ? { ...candidate, lockedAngle: angle } : candidate);
  return { vertices: nextVertices, customWalls: nextWalls };
}

/**
 * Snaps one endpoint near a diagonal to an exact supported 45-degree direction.
 * Returning null preserves the editor's regular 6-inch grid move for all other angles.
 */
export function snapWallEndpointNear45(
  wall: CustomWall,
  movingVertexId: string,
  target: { x: number; y: number },
  vertices: RoomVertex[],
): { x: number; y: number; lockedAngle: 45 | -45 } | null {
  const anchorId = wall.startVertexId === movingVertexId ? wall.endVertexId : wall.endVertexId === movingVertexId ? wall.startVertexId : null;
  const anchor = anchorId ? vertices.find((vertex) => vertex.id === anchorId) : null;
  if (!anchor) return null;
  const deltaX = target.x - anchor.x;
  const deltaY = target.y - anchor.y;
  if (Math.abs(Math.abs(deltaX) - Math.abs(deltaY)) > 8 || Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return null;
  const run = Math.max(6, Math.round(((Math.abs(deltaX) + Math.abs(deltaY)) / 2) / 6) * 6);
  const x = anchor.x + (deltaX < 0 ? -run : run);
  const y = anchor.y + (deltaY < 0 ? -run : run);
  const directionX = wall.startVertexId === movingVertexId ? anchor.x - x : x - anchor.x;
  const directionY = wall.startVertexId === movingVertexId ? anchor.y - y : y - anchor.y;
  return { x, y, lockedAngle: directionX * directionY >= 0 ? 45 : -45 };
}

export type CompassWallAngle = 90 | 45 | -45;

export type CompassWallEdit = {
  /** Distance from this wall's start corner before the selected angled run begins. */
  angleStartIn: number;
  /** Measured length of the selected run after its angle begins. */
  lengthIn: number;
  /** Limited v1 geometry: existing straight bearing, +45°, or −45°. */
  angle: CompassWallAngle;
  /** Finished selected-wall height in inches, retained separately from room defaults. */
  heightIn: number;
};

/**
 * Edits one selected wall from the Compass dialog. A 45° edit preserves the
 * chosen wall's original maximum span, keeps its straight approach, and inserts
 * one diagonal transition into the adjoining wall. The shared corner moves with
 * that adjoining wall, so the room stays a closed shape instead of stretching
 * one endpoint across the plan.
 */
export function applyCompassWallEdit(
  wallId: string,
  edit: CompassWallEdit,
  vertices: RoomVertex[],
  customWalls: CustomWall[],
): { vertices: RoomVertex[]; customWalls: CustomWall[]; editedWallId: string } | null {
  const index = customWalls.findIndex((wall) => wall.id === wallId);
  const wall = customWalls[index];
  const start = wall ? vertices.find((vertex) => vertex.id === wall.startVertexId) : null;
  const end = wall ? vertices.find((vertex) => vertex.id === wall.endVertexId) : null;
  if (!wall || !start || !end) return null;

  // An open builder path has one more vertex than wall. Resizing one measured
  // wall moves its end and translates every following corner by the same delta,
  // preserving all downstream wall lengths, directions, and clean joins.
  if (customWalls.length < vertices.length) {
    const measuredLength = Math.max(6, Math.round((Number(edit.lengthIn) || wallSegmentLength(wall, vertices)) * 8) / 8);
    const currentBearing = Math.atan2(end.y - start.y, end.x - start.x);
    const currentDegrees = ((Math.round(currentBearing * 180 / Math.PI) % 360) + 360) % 360;
    const currentDiagonal: 45 | -45 | null = currentDegrees % 90 === 45
      ? ((Math.cos(currentBearing) * Math.sin(currentBearing) >= 0 ? 45 : -45) as 45 | -45)
      : null;
    const circularDistance = (left: number, right: number) => Math.abs((((left - right) % 360) + 540) % 360 - 180);
    const requestedDegrees = edit.angle === 90
      ? (currentDiagonal == null ? currentDegrees : Math.round(currentDegrees / 90) * 90)
      : edit.angle === currentDiagonal
      ? currentDegrees
      : (edit.angle === 45 ? [45, 225] : [135, 315]).reduce((best, candidate) => circularDistance(candidate, currentDegrees) < circularDistance(best, currentDegrees) ? candidate : best);
    const radians = requestedDegrees * Math.PI / 180;
    const nextEnd = {
      x: Math.round((start.x + Math.cos(radians) * measuredLength) * 10000) / 10000,
      y: Math.round((start.y + Math.sin(radians) * measuredLength) * 10000) / 10000,
    };
    const delta = { x: nextEnd.x - end.x, y: nextEnd.y - end.y };
    const endIndex = vertices.findIndex((vertex) => vertex.id === end.id);
    if (endIndex < 0) return null;
    const movedVertices = vertices.map((vertex, vertexIndex) => vertexIndex < endIndex
      ? vertex
      : { ...vertex, x: vertex.x + delta.x, y: vertex.y + delta.y });
    const normalized = normalizeVertices(movedVertices);
    const nextWalls = customWalls.map((candidate) => candidate.id === wall.id ? {
      ...candidate,
      ...(edit.angle === 90 ? { lockedAngle: undefined } : { lockedAngle: edit.angle }),
      height: Math.max(34.5, Math.min(144, Math.round((Number(edit.heightIn) || wall.height || 96) * 8) / 8)),
    } : candidate);
    return { vertices: normalized, customWalls: nextWalls, editedWallId: wall.id };
  }

  const existingLength = Math.max(6, wallSegmentLength(wall, vertices));
  // The Wall length field is the selected wall's measured envelope, never an
  // extension. A 144-inch wall can be shortened, but cannot become longer.
  const requestedLength = Math.round((Number(edit.lengthIn) || existingLength) * 8) / 8;
  const wallLength = Math.max(6, Math.min(existingLength, requestedLength));
  const startDistance = Math.max(0, Math.min(wallLength - 6, Math.round((Number(edit.angleStartIn) || 0) * 8) / 8));
  const cornerLeg = Math.max(6, wallLength - startDistance);
  const currentBearing = Math.atan2(end.y - start.y, end.x - start.x);
  const namedCardinalBearing: Record<string, number> = {
    Back: 0,
    Right: Math.PI / 2,
    Front: Math.PI,
    Left: -Math.PI / 2,
  };
  const matchingNamedBearing = Object.entries(namedCardinalBearing).find(([label]) => wall.label === label)?.[1];
  const cardinalBearing = matchingNamedBearing ?? Math.round(currentBearing / (Math.PI / 2)) * (Math.PI / 2);
  const straightBearing = edit.angle === 90 ? cardinalBearing : currentBearing;
  const nextWall = customWalls[(index + 1) % customWalls.length];
  const nextEnd = nextWall ? vertices.find((vertex) => vertex.id === nextWall.endVertexId) : null;
  if (!nextWall || !nextEnd) return null;
  const adjoiningBearing = Math.atan2(nextEnd.y - end.y, nextEnd.x - end.x);
  const prefixEnd = {
    x: Math.round((start.x + Math.cos(straightBearing) * startDistance) * 8) / 8,
    y: Math.round((start.y + Math.sin(straightBearing) * startDistance) * 8) / 8,
  };
  const virtualCorner = {
    x: Math.round((start.x + Math.cos(straightBearing) * wallLength) * 8) / 8,
    y: Math.round((start.y + Math.sin(straightBearing) * wallLength) * 8) / 8,
  };
  const expectedTurn = Math.sign(Math.sin(adjoiningBearing - straightBearing)) || 1;
  const requestedTurn = edit.angle === 45 ? 1 : -1;
  const followsInteriorCorner = requestedTurn === expectedTurn;
  const movedSharedCorner = edit.angle === 90
    ? virtualCorner
    : {
        x: Math.round((virtualCorner.x + Math.cos(adjoiningBearing) * cornerLeg * (followsInteriorCorner ? 1 : -1)) * 1000) / 1000,
        y: Math.round((virtualCorner.y + Math.sin(adjoiningBearing) * cornerLeg * (followsInteriorCorner ? 1 : -1)) * 1000) / 1000,
      };
  const editedWallId = edit.angle !== 90 && startDistance > 0.01 ? genWallId() : wall.id;
  const pivot = edit.angle !== 90 && startDistance > 0.01 ? { id: genVertexId(), ...prefixEnd } : null;
  const nextVertices = vertices
    .map((vertex) => vertex.id === end.id ? { ...vertex, ...movedSharedCorner } : vertex)
    .flatMap((vertex) => pivot && vertex.id === start.id ? [vertex, pivot] : [vertex]);
  const editedWall: CustomWall = {
    ...wall,
    id: editedWallId,
    startVertexId: pivot?.id ?? wall.startVertexId,
    lockedAngle: edit.angle === 90 ? undefined : edit.angle,
    height: Math.max(34.5, Math.min(144, Math.round((Number(edit.heightIn) || wall.height || 96) * 8) / 8)),
  };
  const nextWalls = customWalls.flatMap((candidate, candidateIndex) => {
    if (candidateIndex !== index) return [candidate];
    if (!pivot) return [editedWall];
    return [
      { id: wall.id, startVertexId: wall.startVertexId, endVertexId: pivot.id, label: `${wall.label ?? "Wall"} approach` },
      { ...editedWall, label: wall.label },
    ];
  });
  return { vertices: nextVertices, customWalls: nextWalls, editedWallId };
}

/** Inward normal of a wall segment (points toward the room interior).
 *  Assumes vertices are ordered clockwise. */
export function wallInwardNormal(wall: CustomWall, vertices: RoomVertex[]): { nx: number; ny: number } {
  const angle = wallAngle(wall, vertices);
  // For clockwise polygon, inward normal is 90° clockwise from the wall direction.
  return { nx: Math.sin(angle), ny: -Math.cos(angle) };
}

/** Compute the bounding box of a set of vertices. */
export function polygonBounds(vertices: RoomVertex[]): {
  minX: number; minY: number; maxX: number; maxY: number; width: number; height: number;
} {
  if (vertices.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Compute the area of the polygon (shoelace formula). Returns positive for CW. */
export function polygonArea(vertices: RoomVertex[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

/** Check if vertices are ordered clockwise (positive signed area = CW for screen coords). */
export function isClockwise(vertices: RoomVertex[]): boolean {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  // In screen coordinates (Y down), positive signed area = clockwise.
  return area > 0;
}

/** Ensure vertices are in clockwise order (for consistent inward normals). */
export function ensureClockwise(vertices: RoomVertex[]): RoomVertex[] {
  if (isClockwise(vertices)) return vertices;
  return [...vertices].reverse();
}

// ─── Continuous Wall Builder ───────────────────────────────────────────────────

function normalizeWallBuilderHeading(headingDeg: number): number {
  const snapped = Math.round(headingDeg / 45) * 45;
  return ((snapped % 360) + 360) % 360;
}

function wallBuilderTurnDegrees(turn: WallBuilderTurn): number {
  if (turn === "left45") return -45;
  if (turn === "right45") return 45;
  if (turn === "left90") return -90;
  if (turn === "right90") return 90;
  return 0;
}

function wallBuilderLength(lengthIn: number): number {
  return Math.round((Number(lengthIn) || 0) * 8) / 8;
}

function wallBuilderPointEqual(
  left: { x: number; y: number },
  right: { x: number; y: number },
  tolerance = WALL_BUILDER_EPSILON,
): boolean {
  return Math.abs(left.x - right.x) <= tolerance && Math.abs(left.y - right.y) <= tolerance;
}

function wallBuilderPointAt(
  start: { x: number; y: number },
  headingDeg: number,
  lengthIn: number,
): { x: number; y: number } {
  const radians = normalizeWallBuilderHeading(headingDeg) * Math.PI / 180;
  const x = Math.round((start.x + Math.cos(radians) * lengthIn) * 10000) / 10000;
  const y = Math.round((start.y + Math.sin(radians) * lengthIn) * 10000) / 10000;
  return {
    x: Math.abs(x) <= WALL_BUILDER_EPSILON ? 0 : x,
    y: Math.abs(y) <= WALL_BUILDER_EPSILON ? 0 : y,
  };
}

/** Adds one measured wall relative to the current run direction. */
export function appendWallBuilderSegment(
  segments: WallBuilderSegment[],
  lengthIn: number,
  turn: WallBuilderTurn = segments.length === 0 ? "start" : "straight",
): WallBuilderSegment[] {
  const measuredLength = wallBuilderLength(lengthIn);
  if (!Number.isFinite(measuredLength) || measuredLength < WALL_BUILDER_MIN_WALL_IN) return segments;
  const previousHeading = segments.length > 0 ? segments[segments.length - 1].headingDeg : 0;
  const effectiveTurn: WallBuilderTurn = segments.length === 0 ? "start" : turn === "start" ? "straight" : turn;
  const headingDeg = normalizeWallBuilderHeading(previousHeading + wallBuilderTurnDegrees(effectiveTurn));
  return [...segments, { lengthIn: measuredLength, headingDeg, turn: effectiveTurn }];
}

/** Returns the continuous path points, beginning at the fixed top-left origin. */
export function wallBuilderPoints(segments: WallBuilderSegment[]): Array<{ x: number; y: number }> {
  const points = [{ x: 0, y: 0 }];
  for (const segment of segments) {
    points.push(wallBuilderPointAt(points[points.length - 1], segment.headingDeg, segment.lengthIn));
  }
  return points;
}

function wallBuilderOrientation(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(cross) <= WALL_BUILDER_EPSILON) return 0;
  return cross > 0 ? 1 : -1;
}

function wallBuilderPointOnSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  return wallBuilderOrientation(start, end, point) === 0
    && point.x >= Math.min(start.x, end.x) - WALL_BUILDER_EPSILON
    && point.x <= Math.max(start.x, end.x) + WALL_BUILDER_EPSILON
    && point.y >= Math.min(start.y, end.y) - WALL_BUILDER_EPSILON
    && point.y <= Math.max(start.y, end.y) + WALL_BUILDER_EPSILON;
}

function wallBuilderSegmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
): boolean {
  const o1 = wallBuilderOrientation(a1, a2, b1);
  const o2 = wallBuilderOrientation(a1, a2, b2);
  const o3 = wallBuilderOrientation(b1, b2, a1);
  const o4 = wallBuilderOrientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && wallBuilderPointOnSegment(b1, a1, a2))
    || (o2 === 0 && wallBuilderPointOnSegment(b2, a1, a2))
    || (o3 === 0 && wallBuilderPointOnSegment(a1, b1, b2))
    || (o4 === 0 && wallBuilderPointOnSegment(a2, b1, b2));
}

function wallBuilderSelfIntersects(points: Array<{ x: number; y: number }>, closed: boolean): boolean {
  const segmentCount = points.length - 1;
  for (let left = 0; left < segmentCount; left += 1) {
    for (let right = left + 1; right < segmentCount; right += 1) {
      const adjacent = right === left + 1 || (closed && left === 0 && right === segmentCount - 1);
      if (adjacent) continue;
      if (wallBuilderSegmentsIntersect(points[left], points[left + 1], points[right], points[right + 1])) return true;
    }
  }
  return false;
}

/** Validates the live outline without changing any room or placed item. */
export function wallBuilderGeometry(segments: WallBuilderSegment[]): WallBuilderGeometry {
  const points = wallBuilderPoints(segments);
  const closed = points.length > 3 && wallBuilderPointEqual(points[0], points[points.length - 1], 0.05);
  if (segments.some((segment) => !Number.isFinite(segment.lengthIn) || segment.lengthIn < WALL_BUILDER_MIN_WALL_IN)) {
    return { points, closed, error: `Every wall must be at least ${WALL_BUILDER_MIN_WALL_IN} inches long.` };
  }
  const vertices = closed ? points.slice(0, -1) : points;
  for (let index = 0; index < vertices.length; index += 1) {
    for (let other = index + 1; other < vertices.length; other += 1) {
      if (wallBuilderPointEqual(vertices[index], vertices[other])) {
        return { points, closed, error: "Two corners occupy the same point. Undo the last wall and choose a different turn." };
      }
    }
  }
  if (wallBuilderSelfIntersects(points, closed)) {
    return { points, closed, error: "This wall crosses another wall. Undo the last wall and choose a different direction." };
  }
  if (closed) {
    const areaVertices = vertices.map((point, index) => ({ id: `preview-${index}`, ...point }));
    if (polygonArea(areaVertices) < 36) return { points, closed, error: "The closed room is too small to use." };
  }
  return { points, closed, error: null };
}

/** Live measured totals. Open paths have a wall-run perimeter but no enclosed area. */
export function wallBuilderMetrics(segments: WallBuilderSegment[]): WallBuilderMetrics {
  const geometry = wallBuilderGeometry(segments);
  const perimeterIn = Math.round(segments.reduce((sum, segment) => sum + segment.lengthIn, 0) * 8) / 8;
  const areaSqFt = geometry.closed && !geometry.error
    ? Math.round((polygonArea(geometry.points.slice(0, -1).map((point, index) => ({ id: `metric-${index}`, ...point }))) / 144) * 10) / 10
    : null;
  return { perimeterIn, areaSqFt, closed: geometry.closed };
}

/**
 * Confirms whether the user's own measured walls return to the starting point.
 * It never adds, changes, or infers a wall length.
 */
export function checkWallBuilderClosure(segments: WallBuilderSegment[]): { closed: boolean; error: string | null } {
  if (segments.length < 3) return { closed: false, error: "Enter at least three measured walls before checking the room." };
  const geometry = wallBuilderGeometry(segments);
  if (geometry.error) return { closed: false, error: geometry.error };
  if (geometry.closed) return { closed: true, error: null };
  const start = geometry.points[0];
  const end = geometry.points[geometry.points.length - 1];
  const remaining = Math.round(dist(start, end) * 8) / 8;
  return {
    closed: false,
    error: `The measured walls do not return to the starting point yet. The open end is ${remaining} inches away. Enter the next wall length and turn from your measurements.`,
  };
}

/** Converts the user's connected walls into the existing cabinet-ready custom wall model. */
export function wallBuilderRoomGeometry(
  segments: WallBuilderSegment[],
  wallHeightIn = 96,
): { room: WallBuilderRoomGeometry | null; error: string | null } {
  if (segments.length < 1) return { room: null, error: "Enter the first wall length before applying the room." };
  const geometry = wallBuilderGeometry(segments);
  if (geometry.error) return { room: null, error: geometry.error };

  const openWallPath = !geometry.closed;
  let outline = (geometry.closed ? geometry.points.slice(0, -1) : geometry.points)
    .map((point, index) => ({ id: `wall-builder-${index}`, ...point }));
  if (geometry.closed && !isClockwise(outline)) outline = [...outline].reverse();
  const normalized = normalizeVertices(outline).map((point) => ({ ...point, id: genVertexId() }));
  const height = Math.max(34.5, Math.min(144, Math.round((Number(wallHeightIn) || 96) * 8) / 8));
  const wallCount = openWallPath ? normalized.length - 1 : normalized.length;
  const customWalls = normalized.slice(0, wallCount).map((vertex, index) => {
    const end = normalized[(index + 1) % normalized.length];
    const dx = end.x - vertex.x;
    const dy = end.y - vertex.y;
    const diagonal = Math.abs(dx) > WALL_BUILDER_EPSILON && Math.abs(dy) > WALL_BUILDER_EPSILON;
    return {
      id: genWallId(),
      startVertexId: vertex.id,
      endVertexId: end.id,
      label: `Wall ${index + 1}`,
      ...(diagonal ? { lockedAngle: (dx * dy >= 0 ? 45 : -45) as 45 | -45 } : {}),
      height,
    };
  });
  const bounds = polygonBounds(normalized);
  return {
    room: {
      vertices: normalized,
      customWalls,
      width: Math.max(36, Math.round(bounds.width * 1000) / 1000),
      depth: Math.max(36, Math.round(bounds.height * 1000) / 1000),
      openWallPath,
    },
    error: null,
  };
}

/**
 * Remove exactly one drawn wall. The deleted segment becomes the intentional
 * gap; every remaining wall keeps its original endpoints, length, height, and
 * label. This never stretches an adjoining wall or silently changes a measure.
 */
export function deleteCustomWallSegment(
  wallId: string,
  vertices: RoomVertex[],
  customWalls: CustomWall[],
): WallBuilderRoomGeometry | null {
  const wallIndex = customWalls.findIndex((wall) => wall.id === wallId);
  if (wallIndex < 0 || customWalls.length <= 1) return null;
  const remainingWalls = customWalls.filter((wall) => wall.id !== wallId);
  const usedVertexIds = new Set(remainingWalls.flatMap((wall) => [wall.startVertexId, wall.endVertexId]));
  const remainingVertices = vertices.filter((vertex) => usedVertexIds.has(vertex.id));
  const bounds = polygonBounds(remainingVertices);
  return {
    vertices: remainingVertices,
    customWalls: remainingWalls,
    width: Math.max(36, Math.round(bounds.width * 1000) / 1000),
    depth: Math.max(36, Math.round(bounds.height * 1000) / 1000),
    openWallPath: true,
  };
}

// ─── Split Tool ─────────────────────────────────────────────────────────────────

/**
 * Split a wall segment at its midpoint, creating a new vertex and two new walls.
 * Returns the updated vertices and customWalls arrays.
 */
export function splitWall(
  wallId: string,
  vertices: RoomVertex[],
  customWalls: CustomWall[],
): { vertices: RoomVertex[]; customWalls: CustomWall[]; newVertexId: string } {
  const wallIdx = customWalls.findIndex((w) => w.id === wallId);
  if (wallIdx === -1) return { vertices, customWalls, newVertexId: "" };

  const wall = customWalls[wallIdx];
  const start = vertices.find((v) => v.id === wall.startVertexId);
  const end = vertices.find((v) => v.id === wall.endVertexId);
  if (!start || !end) return { vertices, customWalls, newVertexId: "" };

  // Create new vertex at midpoint.
  const newVertex: RoomVertex = {
    id: genVertexId(),
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  // Insert the new vertex into the vertices array (after the start vertex's index).
  const startIdx = vertices.findIndex((v) => v.id === wall.startVertexId);
  const newVertices = [...vertices];
  newVertices.splice(startIdx + 1, 0, newVertex);

  // Replace the original wall with two new walls.
  const wall1: CustomWall = {
    id: genWallId(),
    startVertexId: wall.startVertexId,
    endVertexId: newVertex.id,
    label: wall.label ? `${wall.label} (1)` : undefined,
  };
  const wall2: CustomWall = {
    id: genWallId(),
    startVertexId: newVertex.id,
    endVertexId: wall.endVertexId,
    label: wall.label ? `${wall.label} (2)` : undefined,
  };

  const newWalls = [...customWalls];
  newWalls.splice(wallIdx, 1, wall1, wall2);

  return { vertices: newVertices, customWalls: newWalls, newVertexId: newVertex.id };
}

// ─── Vertex Movement ────────────────────────────────────────────────────────────

/**
 * Move a vertex to a new position and recompute the bounding box.
 * Returns updated vertices and the new bounding box dimensions.
 */
export function moveVertex(
  vertexId: string,
  newX: number,
  newY: number,
  vertices: RoomVertex[],
): { vertices: RoomVertex[]; width: number; depth: number } {
  const updated = vertices.map((v) =>
    v.id === vertexId ? { ...v, x: newX, y: newY } : v,
  );
  const bounds = polygonBounds(updated);
  return { vertices: updated, width: bounds.width, depth: bounds.height };
}

/**
 * Normalize vertices so the minimum x/y is at (0,0).
 * This keeps the polygon anchored to the top-left origin.
 */
export function normalizeVertices(vertices: RoomVertex[]): RoomVertex[] {
  const bounds = polygonBounds(vertices);
  if (bounds.minX === 0 && bounds.minY === 0) return vertices;
  return vertices.map((v) => ({
    ...v,
    x: v.x - bounds.minX,
    y: v.y - bounds.minY,
  }));
}

// ─── Point-in-Polygon ───────────────────────────────────────────────────────────

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(px: number, py: number, vertices: RoomVertex[]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── SVG Path ───────────────────────────────────────────────────────────────────

/** Generate an SVG path string from the vertices (closed polygon). */
export function verticesToSvgPath(vertices: RoomVertex[], ppi: number): string {
  if (vertices.length < 3) return "";
  const parts = vertices.map((v, i) => {
    const cmd = i === 0 ? "M" : "L";
    return `${cmd} ${v.x * ppi} ${v.y * ppi}`;
  });
  return parts.join(" ") + " Z";
}

/** Generate SVG polygon points attribute from vertices. */
export function verticesToPoints(vertices: RoomVertex[], ppi: number): string {
  return vertices.map((v) => `${v.x * ppi},${v.y * ppi}`).join(" ");
}

// ─── Merge Walls (undo split) ───────────────────────────────────────────────────

/**
 * Merge two adjacent walls back into one by removing the shared vertex.
 * The first wall's start and the second wall's end become the merged wall's endpoints.
 */
export function mergeWalls(
  wallId1: string,
  wallId2: string,
  vertices: RoomVertex[],
  customWalls: CustomWall[],
): { vertices: RoomVertex[]; customWalls: CustomWall[] } | null {
  const w1 = customWalls.find((w) => w.id === wallId1);
  const w2 = customWalls.find((w) => w.id === wallId2);
  if (!w1 || !w2) return null;

  // They must share a vertex: w1.endVertexId === w2.startVertexId
  if (w1.endVertexId !== w2.startVertexId) return null;

  const sharedVertexId = w1.endVertexId;

  // Create merged wall.
  const merged: CustomWall = {
    id: genWallId(),
    startVertexId: w1.startVertexId,
    endVertexId: w2.endVertexId,
    label: w1.label?.replace(/ \(\d+\)$/, "") || w2.label?.replace(/ \(\d+\)$/, ""),
  };

  // Remove the shared vertex (only if it's not used by any other wall).
  const otherWalls = customWalls.filter((w) => w.id !== wallId1 && w.id !== wallId2);
  const vertexUsedElsewhere = otherWalls.some(
    (w) => w.startVertexId === sharedVertexId || w.endVertexId === sharedVertexId,
  );

  const newVertices = vertexUsedElsewhere
    ? vertices
    : vertices.filter((v) => v.id !== sharedVertexId);

  // Replace the two walls with the merged one (at the position of the first).
  const idx1 = customWalls.findIndex((w) => w.id === wallId1);
  const idx2 = customWalls.findIndex((w) => w.id === wallId2);
  const newWalls = [...customWalls];
  // Remove in reverse order to avoid index shift issues.
  if (idx1 < idx2) {
    newWalls.splice(idx2, 1);
    newWalls.splice(idx1, 1, merged);
  } else {
    newWalls.splice(idx1, 1);
    newWalls.splice(idx2, 1, merged);
  }

  return { vertices: newVertices, customWalls: newWalls };
}

// ─── Closest Wall to a Point ────────────────────────────────────────────────────

/** Find the closest wall segment to a given point (for cabinet assignment). */
export function closestWall(
  px: number,
  py: number,
  vertices: RoomVertex[],
  customWalls: CustomWall[],
): CustomWall | null {
  let minDist = Infinity;
  let closest: CustomWall | null = null;

  for (const wall of customWalls) {
    const start = vertices.find((v) => v.id === wall.startVertexId);
    const end = vertices.find((v) => v.id === wall.endVertexId);
    if (!start || !end) continue;

    const d = pointToSegmentDist(px, py, start.x, start.y, end.x, end.y);
    if (d < minDist) {
      minDist = d;
      closest = wall;
    }
  }

  return closest;
}

/** Distance from a point to a line segment. */
function pointToSegmentDist(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist({ x: px, y: py }, { x: x1, y: y1 });

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return dist({ x: px, y: py }, { x: projX, y: projY });
}

// ─── Position Along Wall ────────────────────────────────────────────────────────

/**
 * Project a point onto a wall segment and return the distance along the wall
 * from the start vertex (in inches). Used for cabinet placement on polygon walls.
 */
export function positionAlongWall(
  px: number,
  py: number,
  wall: CustomWall,
  vertices: RoomVertex[],
): number {
  const start = vertices.find((v) => v.id === wall.startVertexId);
  const end = vertices.find((v) => v.id === wall.endVertexId);
  if (!start || !end) return 0;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;

  const t = Math.max(0, Math.min(1, ((px - start.x) * dx + (py - start.y) * dy) / lenSq));
  return t * Math.sqrt(lenSq);
}
