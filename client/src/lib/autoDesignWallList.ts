/**
 * Auto Design wall-list shape model (Tom, owner voice, Nov 24 2026, 12:50 PM CT).
 *
 * 1. Every wall segment is listed in drawing order (Wall 1, Wall 2, ...), each tagged with the
 *    inside angle it makes with the next wall, so a 45° turn shows up as a corner between two
 *    walls. The every-angle filler check and the corner backsplash check read corners from here.
 * 2. The shape label comes from the real geometry ("L with 45° corner", "five-wall U with
 *    chamfers", "galley", "single wall"); the fixed L-shape / galley / U-shape labels stay as a
 *    fallback for UI copy.
 * 3. A wall with no cabinets stays in the list as an empty run and still counts toward the wall
 *    total. Nothing here filters or renumbers walls by contents.
 *
 * Read-only geometry: nothing here moves a wall or a cabinet.
 */
import { type PlacedCabinet, type RoomData, wallRunFrame } from "./design";

export type AutoDesignWallEntry = {
  /** 1-based position in the list. */
  index: number;
  label: string;
  wallId: string;
  lengthIn: number;
  /** Cabinets, appliances and fillers whose wall is this one. */
  itemCount: number;
  /** True for a wall with nothing on it; it is still listed and still counted. */
  empty: boolean;
  /** Next wall in the chain (null at the open end of a run). */
  nextWallId: string | null;
  /** Inside angle to the next wall in degrees (90 = square corner, 135 = 45° turn); null at an open end. */
  angleToNextDeg: number | null;
  /** How far the run turns at that corner (180 - inside angle): 90 at a square corner, 45 at a chamfer. */
  turnToNextDeg: number | null;
  /** Shared vertex id with the next wall (drawn walls), for corner checks. */
  vertexToNextId: string | null;
};

export type AutoDesignCorner = {
  key: string;
  vertexId: string | null;
  wallId: string;
  /** Which end of `wallId` the corner is on. */
  wallAt: "start" | "end";
  neighborWallId: string;
  neighborAt: "start" | "end";
  angleDeg: number;
  turnDeg: number;
  /** The cabinets sit on the inside of the turn (a real inside corner, not an outside nose). */
  inside: boolean;
};

const CARDINAL_ORDER = ["top", "right", "bottom", "left"] as const;

function round(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

type Endpoint = { x: number; y: number };

function endpoints(wallId: string, room: RoomData): { start: Endpoint; end: Endpoint; startId: string | null; endId: string | null } | null {
  const custom = room.customWalls?.find((wall) => wall.id === wallId);
  if (custom && room.vertices) {
    const start = room.vertices.find((vertex) => vertex.id === custom.startVertexId);
    const end = room.vertices.find((vertex) => vertex.id === custom.endVertexId);
    if (!start || !end) return null;
    return { start, end, startId: custom.startVertexId, endId: custom.endVertexId };
  }
  const frame = wallRunFrame(wallId, room);
  if (!frame) return null;
  return { start: frame.start, end: frame.end, startId: null, endId: null };
}

function insideAngleDeg(a: Endpoint, vertex: Endpoint, b: Endpoint): number {
  const u = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v = { x: b.x - vertex.x, y: b.y - vertex.y };
  const lu = Math.hypot(u.x, u.y);
  const lv = Math.hypot(v.x, v.y);
  if (lu < 1e-6 || lv < 1e-6) return 180;
  const cos = Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (lu * lv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Wall ids in drawing order: drawn walls follow the vertex chain; a standard room goes around. */
export function autoDesignOrderedWallIds(room: RoomData): string[] {
  const walls = room.customWalls ?? [];
  if (walls.length > 0 && room.vertices) {
    const byStart = new Map(walls.map((wall) => [wall.startVertexId, wall]));
    const ends = new Set(walls.map((wall) => wall.endVertexId));
    // An open run starts at the wall whose start no other wall ends on; a closed loop keeps the drawn first wall.
    const first = walls.find((wall) => !ends.has(wall.startVertexId)) ?? walls[0];
    const ordered: string[] = [];
    const seen = new Set<string>();
    let current: (typeof walls)[number] | undefined = first;
    while (current && !seen.has(current.id)) {
      ordered.push(current.id);
      seen.add(current.id);
      current = byStart.get(current.endVertexId);
    }
    // Any wall not on the chain (a separate segment) is still listed, never dropped.
    for (const wall of walls) if (!seen.has(wall.id)) ordered.push(wall.id);
    return ordered;
  }
  return [...CARDINAL_ORDER];
}

function nextInChain(wallId: string, ordered: string[], room: RoomData): { id: string; vertexId: string | null } | null {
  const custom = room.customWalls?.find((wall) => wall.id === wallId);
  if (custom) {
    const next = room.customWalls?.find((wall) => wall.id !== wallId && wall.startVertexId === custom.endVertexId);
    return next ? { id: next.id, vertexId: custom.endVertexId } : null;
  }
  const index = ordered.indexOf(wallId);
  if (index < 0) return null;
  return { id: ordered[(index + 1) % ordered.length], vertexId: null };
}

export function autoDesignWallList(room: RoomData, placed: readonly PlacedCabinet[] = []): AutoDesignWallEntry[] {
  const ordered = autoDesignOrderedWallIds(room);
  return ordered.map((wallId, position) => {
    const ends = endpoints(wallId, room);
    const frame = wallRunFrame(wallId, room);
    const lengthIn = frame?.length ?? (ends ? Math.hypot(ends.end.x - ends.start.x, ends.end.y - ends.start.y) : 0);
    const next = nextInChain(wallId, ordered, room);
    let angle: number | null = null;
    if (next && ends) {
      const nextEnds = endpoints(next.id, room);
      if (nextEnds) angle = round(insideAngleDeg(ends.start, ends.end, nextEnds.end), 0.5);
    }
    const itemCount = placed.filter((item) => item.wallId === wallId).length;
    return {
      index: position + 1,
      label: `Wall ${position + 1}`,
      wallId,
      lengthIn,
      itemCount,
      empty: itemCount === 0,
      nextWallId: next?.id ?? null,
      angleToNextDeg: angle,
      turnToNextDeg: angle == null ? null : round(180 - angle, 0.5),
      vertexToNextId: next?.vertexId ?? null,
    };
  });
}

/**
 * Every corner between two consecutive walls, with its inside angle and whether the cabinet side
 * of the walls is on the inside of the turn. Straight joins (about 180°) are not corners.
 */
export function autoDesignCorners(room: RoomData): AutoDesignCorner[] {
  const list = autoDesignWallList(room);
  const corners: AutoDesignCorner[] = [];
  for (const entry of list) {
    if (entry.nextWallId == null || entry.angleToNextDeg == null) continue;
    if (entry.angleToNextDeg > 178) continue;
    const frame = wallRunFrame(entry.wallId, room);
    const nextFrame = wallRunFrame(entry.nextWallId, room);
    let inside = true;
    if (frame && nextFrame) {
      // Away from the shared vertex along the next wall; inside when that heads toward this wall's cabinet side.
      const away = { x: nextFrame.end.x - nextFrame.start.x, y: nextFrame.end.y - nextFrame.start.y };
      inside = away.x * frame.inward.x + away.y * frame.inward.y > 0.01;
    }
    corners.push({
      key: entry.vertexToNextId ?? `${entry.wallId}>${entry.nextWallId}`,
      vertexId: entry.vertexToNextId,
      wallId: entry.wallId,
      wallAt: "end",
      neighborWallId: entry.nextWallId,
      neighborAt: "start",
      angleDeg: entry.angleToNextDeg,
      turnDeg: round(180 - entry.angleToNextDeg, 0.5),
      inside,
    });
  }
  return corners;
}

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Fallback label from the three fixed layouts, for UI copy that still needs one. */
export type AutoDesignFixedShape = "single-wall" | "galley" | "l-shape" | "u-shape";

/**
 * Shape label from the real walls and turns. `walls` is the list of walls the kitchen uses
 * (empty runs included). Labels: single wall, galley, L-shape, U-shape, or a derived name such
 * as "L with 45° corner", "five-wall U with chamfers", "angled L (120° corner)".
 */
export function autoDesignShapeLabel(walls: readonly AutoDesignWallEntry[], options: { parallelSeparate?: boolean } = {}): string {
  const n = walls.length;
  if (n === 0) return "no walls";
  if (n === 1) return "single wall";
  if (options.parallelSeparate && n === 2) return "galley";
  const turns = walls.slice(0, -1).map((wall) => wall.turnToNextDeg).filter((turn): turn is number => turn != null && turn > 2);
  if (turns.length === 0) return n === 2 ? "galley" : `${COUNT_WORDS[n] ?? n}-wall straight run`;
  const total = turns.reduce((sum, turn) => sum + turn, 0);
  const square = turns.filter((turn) => Math.abs(turn - 90) <= 2).length;
  const chamfers = turns.filter((turn) => Math.abs(turn - 45) <= 2).length;
  const odd = turns.length - square - chamfers;
  const family = Math.abs(total - 90) <= 4 ? "L" : Math.abs(total - 180) <= 6 ? "U" : Math.abs(total - 270) <= 8 ? "G" : null;
  if (odd === 0 && chamfers === 0 && family) return family === "L" ? "L-shape" : family === "U" ? "U-shape" : "G-shape";
  if (family === "L" && chamfers > 0 && odd === 0 && n === 3) return "L with 45° corner";
  if (n === 2 && odd === 1) return `angled L (${Math.round(180 - turns[0])}° corner)`;
  const prefix = `${COUNT_WORDS[n] ?? n}-wall`;
  if (family) {
    const extra = chamfers > 0 ? " with chamfers" : "";
    const oddNote = odd > 0 ? `${extra ? " and" : " with"} ${odd} angled corner${odd === 1 ? "" : "s"}` : "";
    return `${prefix} ${family}${extra}${oddNote}`;
  }
  return `${prefix} run with ${turns.length} corners`;
}

/** Map the derived label back to the fixed UI layout, for older copy. */
export function autoDesignFixedShapeFallback(label: string): AutoDesignFixedShape {
  if (/single wall|straight run/.test(label)) return "single-wall";
  if (/galley/.test(label)) return "galley";
  if (/\bU\b|U-shape/.test(label)) return "u-shape";
  return "l-shape";
}
