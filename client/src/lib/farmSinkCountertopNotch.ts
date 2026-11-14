/**
 * Apron-front (farm) sink countertop notch.
 *
 * A farm sink's apron and top rim are the front of the run. Stone stops at the
 * sink's left and right sides and continues only behind it. Undermount and
 * drop-in sinks are not notched: their bowls stay openings inside a full slab.
 *
 * Every slab keeps one outline with that bite removed, so area, plan, and 3D
 * stay on the same geometry.
 */

export type ApronNotchPoint = { x: number; y: number };

export type ApronNotchSink = {
  type?: string | null;
  apronFront?: boolean | null;
  x: number;
  y: number;
  width: number;
  depth: number;
  wallSide?: string | null;
};

export type ApronNotchSurface = {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation?: number;
  polygon?: ApronNotchPoint[];
  areaInches?: number;
  linearInches?: number;
  raisedBar?: boolean;
  kind?: string;
  peninsulaRunId?: string;
};

type Rect = { x: number; y: number; width: number; depth: number };

const EPS = 1e-4;
/** How far the bite is extended past the sink front so it clears any overhang. */
const FRONT_REACH_IN = 48;

export function isApronFrontSink(sink: ApronNotchSink): boolean {
  return sink.apronFront === true || sink.type === "farmhouse";
}

/** World rectangle removed from the counter: the sink footprint, extended out the room-facing side. */
export function apronFrontNotchRect(sink: ApronNotchSink): Rect | null {
  if (!isApronFrontSink(sink)) return null;
  if (!(sink.width > EPS) || !(sink.depth > EPS)) return null;
  switch (sink.wallSide) {
    case "bottom":
      return { x: sink.x, y: sink.y - FRONT_REACH_IN, width: sink.width, depth: sink.depth + FRONT_REACH_IN };
    case "left":
      return { x: sink.x, y: sink.y, width: sink.width + FRONT_REACH_IN, depth: sink.depth };
    case "right":
      return { x: sink.x - FRONT_REACH_IN, y: sink.y, width: sink.width + FRONT_REACH_IN, depth: sink.depth };
    case "top":
      return { x: sink.x, y: sink.y, width: sink.width, depth: sink.depth + FRONT_REACH_IN };
    default:
      return null;
  }
}

function polygonArea(points: readonly ApronNotchPoint[]): number {
  if (points.length < 3) return 0;
  const signed = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
  return Math.abs(signed);
}

function surfaceWorldPolygon(surface: ApronNotchSurface): ApronNotchPoint[] {
  const local = surface.polygon?.length
    ? surface.polygon
    : [
      { x: 0, y: 0 },
      { x: surface.width, y: 0 },
      { x: surface.width, y: surface.depth },
      { x: 0, y: surface.depth },
    ];
  const radians = ((surface.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centerX = surface.x + surface.width / 2;
  const centerY = surface.y + surface.depth / 2;
  return local.map((point) => {
    const localX = point.x - surface.width / 2;
    const localY = point.y - surface.depth / 2;
    return {
      x: centerX + localX * cos - localY * sin,
      y: centerY + localX * sin + localY * cos,
    };
  });
}

function worldToLocal(surface: ApronNotchSurface, point: ApronNotchPoint): ApronNotchPoint {
  const radians = ((surface.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centerX = surface.x + surface.width / 2;
  const centerY = surface.y + surface.depth / 2;
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  return {
    x: dx * cos + dy * sin + surface.width / 2,
    y: -dx * sin + dy * cos + surface.depth / 2,
  };
}

function strictlyInside(point: ApronNotchPoint, rect: Rect): boolean {
  return point.x > rect.x + EPS
    && point.x < rect.x + rect.width - EPS
    && point.y > rect.y + EPS
    && point.y < rect.y + rect.depth - EPS;
}

function segmentHit(a: ApronNotchPoint, b: ApronNotchPoint, c: ApronNotchPoint, d: ApronNotchPoint): { t: number; point: ApronNotchPoint } | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qpx = c.x - a.x;
  const qpy = c.y - a.y;
  const t = (qpx * sy - qpy * sx) / den;
  const u = (qpx * ry - qpy * rx) / den;
  if (t <= EPS || t >= 1 - EPS || u < -EPS || u > 1 + EPS) return null;
  return { t, point: { x: a.x + t * rx, y: a.y + t * ry } };
}

function insertRectCrossings(polygon: ApronNotchPoint[], rect: Rect): ApronNotchPoint[] {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.depth;
  const edges: [ApronNotchPoint, ApronNotchPoint][] = [
    [{ x: x0, y: y0 }, { x: x1, y: y0 }],
    [{ x: x1, y: y0 }, { x: x1, y: y1 }],
    [{ x: x1, y: y1 }, { x: x0, y: y1 }],
    [{ x: x0, y: y1 }, { x: x0, y: y0 }],
  ];
  const out: ApronNotchPoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    out.push(start);
    const hits = edges
      .map((edge) => segmentHit(start, end, edge[0], edge[1]))
      .filter((hit): hit is { t: number; point: ApronNotchPoint } => hit != null)
      .sort((left, right) => left.t - right.t);
    let previousT = 0;
    for (const hit of hits) {
      if (hit.t - previousT <= EPS) continue;
      previousT = hit.t;
      out.push(hit.point);
    }
  }
  return out;
}

function pointInPolygon(point: ApronNotchPoint, polygon: readonly ApronNotchPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index]!;
    const b = polygon[previous]!;
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-12) + a.x;
    if (crosses) inside = !inside;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const distance = Math.abs((point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)) / length;
    const along = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (length * length);
    if (distance <= 0.02 && along >= -0.01 && along <= 1.01) return true;
  }
  return inside;
}

function rectEdgeIndex(point: ApronNotchPoint, rect: Rect): number {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.depth;
  const onLeft = Math.abs(point.x - x0) <= 0.02;
  const onRight = Math.abs(point.x - x1) <= 0.02;
  const onBottom = Math.abs(point.y - y0) <= 0.02;
  const onTop = Math.abs(point.y - y1) <= 0.02;
  if (onLeft && !onTop && !onBottom) return 0;
  if (onTop && !onLeft && !onRight) return 1;
  if (onRight && !onTop && !onBottom) return 2;
  if (onBottom && !onLeft && !onRight) return 3;
  if (onLeft && onBottom) return 3;
  if (onLeft && onTop) return 0;
  if (onRight && onTop) return 1;
  if (onRight && onBottom) return 2;
  return 0;
}

/** Corners crossed walking the rectangle boundary from `entry` to `exit`. */
function boundaryCorners(entry: ApronNotchPoint, exit: ApronNotchPoint, rect: Rect, direction: 1 | -1): ApronNotchPoint[] {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.depth;
  const endCorner = [
    { x: x0, y: y1 },
    { x: x1, y: y1 },
    { x: x1, y: y0 },
    { x: x0, y: y0 },
  ];
  let edge = rectEdgeIndex(entry, rect);
  const target = rectEdgeIndex(exit, rect);
  if (edge === target) return [];
  const corners: ApronNotchPoint[] = [];
  for (let guard = 0; guard < 4 && edge !== target; guard += 1) {
    const cornerIndex = direction === 1 ? edge : (edge + 3) % 4;
    corners.push(endCorner[cornerIndex]!);
    edge = (edge + direction + 4) % 4;
  }
  return corners;
}

function bridge(entry: ApronNotchPoint, exit: ApronNotchPoint, rect: Rect, container: readonly ApronNotchPoint[]): ApronNotchPoint[] {
  const clockwise = boundaryCorners(entry, exit, rect, 1);
  const counter = boundaryCorners(entry, exit, rect, -1);
  const fits = (points: ApronNotchPoint[]) => points.every((point) => pointInPolygon(point, container));
  const clockwiseFits = fits(clockwise);
  const counterFits = fits(counter);
  if (clockwiseFits && !counterFits) return clockwise;
  if (counterFits && !clockwiseFits) return counter;
  return clockwise.length <= counter.length ? clockwise : counter;
}

function dedupe(points: ApronNotchPoint[]): ApronNotchPoint[] {
  const out: ApronNotchPoint[] = [];
  for (const point of points) {
    const previous = out[out.length - 1];
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) <= 0.02) continue;
    out.push(point);
  }
  if (out.length > 1) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(first.x - last.x, first.y - last.y) <= 0.02) out.pop();
  }
  return out;
}

/** Remove one axis-aligned bite from a simple polygon. The bite must meet the outline. */
export function subtractRectFromPolygon(polygon: ApronNotchPoint[], rect: Rect): ApronNotchPoint[] {
  if (polygon.length < 3 || rect.width <= EPS || rect.depth <= EPS) return polygon;
  const split = insertRectCrossings(polygon, rect);
  const inside = split.map((point) => strictlyInside(point, rect));
  if (!inside.some(Boolean)) {
    const crosses = split.some((point, index) => strictlyInside({
      x: (point.x + split[(index + 1) % split.length]!.x) / 2,
      y: (point.y + split[(index + 1) % split.length]!.y) / 2,
    }, rect));
    if (!crosses) return polygon;
  }
  const result: ApronNotchPoint[] = [];
  const count = split.length;
  for (let index = 0; index < count; index += 1) {
    const current = split[index]!;
    const next = split[(index + 1) % count]!;
    const midpoint = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
    if (!inside[index]) result.push(current);
    if (!strictlyInside(midpoint, rect)) continue;
    let exit = (index + 1) % count;
    let guard = 0;
    while (guard < count && (inside[exit] || strictlyInside({
      x: (split[exit]!.x + split[(exit + 1) % count]!.x) / 2,
      y: (split[exit]!.y + split[(exit + 1) % count]!.y) / 2,
    }, rect))) {
      exit = (exit + 1) % count;
      guard += 1;
      if (exit === index) return [];
    }
    result.push(...bridge(current, split[exit]!, rect, polygon));
    const steps = (exit - index + count) % count;
    index += Math.max(0, steps - 1);
  }
  const cleaned = dedupe(result);
  return cleaned.length >= 3 ? cleaned : polygon;
}

function cutShapedSlab<T extends ApronNotchSurface>(surface: T, notches: Rect[]): T[] {
  let world = surfaceWorldPolygon(surface);
  const before = polygonArea(world);
  for (const notch of notches) world = subtractRectFromPolygon(world, notch);
  const after = polygonArea(world);
  if (after <= EPS) return [];
  if (Math.abs(before - after) <= 0.05) return [surface];
  return [{
    ...surface,
    polygon: world.map((point) => worldToLocal(surface, point)),
    areaInches: after,
  }];
}

/**
 * Cut every apron-front sink out of the finished counter slabs.
 * Surfaces that do not meet a farm sink are returned unchanged.
 */
export function applyApronFrontCountertopNotches<T extends ApronNotchSurface>(
  surfaces: readonly T[],
  sinks: readonly ApronNotchSink[],
): T[] {
  const notches = sinks.map(apronFrontNotchRect).filter((notch): notch is Rect => notch != null);
  if (notches.length === 0) return [...surfaces];
  return surfaces.flatMap((surface) => {
    if (surface.raisedBar) return [surface];
    if (!(surface.width > EPS) || !(surface.depth > EPS)) return [surface];
    return cutShapedSlab(surface, notches);
  });
}

export function apronFrontRemovedArea(surfaces: readonly ApronNotchSurface[], sinks: readonly ApronNotchSink[]): {
  straight: number;
  peninsula: number;
  island: number;
} {
  const removed = { straight: 0, peninsula: 0, island: 0 };
  if (!sinks.some(isApronFrontSink)) return removed;
  for (const surface of surfaces) {
    if (surface.raisedBar) continue;
    const before = surface.areaInches ?? surface.width * surface.depth;
    const after = applyApronFrontCountertopNotches([surface], sinks)
      .reduce((sum, piece) => sum + (piece.areaInches ?? piece.width * piece.depth), 0);
    const delta = Math.max(0, before - after);
    if (surface.kind === "island") removed.island += delta;
    else if (surface.peninsulaRunId) removed.peninsula += delta;
    else removed.straight += delta;
  }
  return removed;
}

/** Drop `gaps` out of each run. A gap that only trims an end shortens that piece. */
export function subtractRunIntervals(
  runs: readonly { start: number; end: number }[],
  gaps: readonly { start: number; end: number }[],
): { start: number; end: number }[] {
  let pieces = runs.map((run) => ({ start: run.start, end: run.end }));
  for (const gap of gaps) {
    const next: { start: number; end: number }[] = [];
    for (const piece of pieces) {
      if (gap.end <= piece.start + 0.05 || gap.start >= piece.end - 0.05) {
        next.push(piece);
        continue;
      }
      if (gap.start > piece.start + 0.05) next.push({ start: piece.start, end: Math.min(gap.start, piece.end) });
      if (gap.end < piece.end - 0.05) next.push({ start: Math.max(gap.end, piece.start), end: piece.end });
    }
    pieces = next;
  }
  return pieces.filter((piece) => piece.end - piece.start > 0.25);
}
