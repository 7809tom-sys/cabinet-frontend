/**
 * Hard rule: nothing extends past a refrigerator end panel.
 *
 * The panel's outer face (the face away from the refrigerator) and its front
 * face are a hard stop. A filler, trim run, cabinet, countertop, or any other
 * span may meet that face and may sit inside the bay, but it may not cross the
 * face by any measurable amount. Floating-point noise is the only tolerance.
 */

export const REFRIGERATOR_PANEL_LIMIT_EPSILON_IN = 1e-6;

/** Fillers shorter than this after a cut are dropped rather than left as a sliver. */
export const REFRIGERATOR_PANEL_FILLER_MIN_IN = 0.125;

export type PanelOuterStop = {
  wallId: string;
  /** Along-wall coordinate of the face away from the refrigerator. */
  edge: number;
  /** Outside the bay is toward smaller along-wall numbers when "below". */
  outside: "below" | "above";
  bodyStart: number;
  bodyEnd: number;
  faceDepth: number;
  top: number;
  refrigeratorUid: string | null;
  panelUid: string;
};

export type PanelStopInput = {
  panelUid: string;
  refrigeratorUid: string | null;
  wallId: string;
  start: number;
  end: number;
  faceDepth: number;
  top: number;
  /** Null when the side is unknown: both faces of the panel are then outer stops. */
  side: "left" | "right" | null;
};

export function panelOuterStops(panels: readonly PanelStopInput[]): PanelOuterStop[] {
  const stops: PanelOuterStop[] = [];
  for (const panel of panels) {
    if (!(panel.end > panel.start)) continue;
    const sides: Array<"left" | "right"> = panel.side == null ? ["left", "right"] : [panel.side];
    for (const side of sides) {
      stops.push({
        wallId: panel.wallId,
        edge: side === "left" ? panel.start : panel.end,
        outside: side === "left" ? "below" : "above",
        bodyStart: panel.start,
        bodyEnd: panel.end,
        faceDepth: panel.faceDepth,
        top: panel.top,
        refrigeratorUid: panel.refrigeratorUid,
        panelUid: panel.panelUid,
      });
    }
  }
  return stops;
}

/**
 * Cut a span so it does not cross an outer face. The side that holds the span's
 * center is kept. Returns null when nothing measurable is left, or when a
 * filler/trim remainder is below `minKeep`.
 */
export function clampSpanToPanelOuterFaces(
  start: number,
  end: number,
  stops: readonly PanelOuterStop[],
  minKeep: number,
): { start: number; end: number } | null {
  const EPS = REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  let a = start;
  let b = end;
  for (let pass = 0; pass < stops.length + 2; pass += 1) {
    let changed = false;
    for (const stop of stops) {
      if (!(a < stop.edge - EPS && b > stop.edge + EPS)) continue;
      const center = (a + b) / 2;
      const keepBelow = stop.outside === "below" ? center <= stop.edge : center < stop.edge;
      if (keepBelow) b = stop.edge;
      else a = stop.edge;
      changed = true;
    }
    if (!changed) break;
  }
  if (!(b - a > EPS)) return null;
  if (b - a < minKeep - EPS) return null;
  return { start: a, end: b };
}

function subtractOpen(
  part: { start: number; end: number },
  cutStart: number,
  cutEnd: number,
): Array<{ start: number; end: number }> {
  const EPS = REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  if (cutEnd <= part.start + EPS || cutStart >= part.end - EPS) return [part];
  const parts: Array<{ start: number; end: number }> = [];
  if (cutStart > part.start + EPS) parts.push({ start: part.start, end: Math.min(part.end, cutStart) });
  if (cutEnd < part.end - EPS) parts.push({ start: Math.max(part.start, cutEnd), end: part.end });
  return parts;
}

function bayEnclosures(stops: readonly PanelOuterStop[]): Array<{ low: number; high: number }> {
  const byFridge = new Map<string, { low: number; high: number }>();
  for (const stop of stops) {
    if (!stop.refrigeratorUid) continue;
    const row = byFridge.get(stop.refrigeratorUid) ?? { low: Number.POSITIVE_INFINITY, high: Number.NEGATIVE_INFINITY };
    if (stop.outside === "below") row.low = Math.min(row.low, stop.edge);
    else row.high = Math.max(row.high, stop.edge);
    byFridge.set(stop.refrigeratorUid, row);
  }
  return Array.from(byFridge.values()).filter((row) => row.high > row.low);
}

/**
 * Countertop runs stop at the outer face. A run that crosses a panel is cut
 * there; the piece that would lie inside the closed refrigerator bay is dropped
 * so the slab cannot bridge the appliance.
 */
export function clipCountertopSpan(
  start: number,
  end: number,
  stops: readonly PanelOuterStop[],
): Array<{ start: number; end: number }> {
  const EPS = REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  if (!(end > start)) return [];
  const panels = new Map<string, PanelOuterStop>();
  for (const stop of stops) panels.set(stop.panelUid, stop);
  let parts = [{ start, end }];
  for (const panel of Array.from(panels.values())) {
    parts = parts.flatMap((part) => subtractOpen(part, panel.bodyStart, panel.bodyEnd));
  }
  const enclosures = bayEnclosures(stops);
  return parts.filter((part) => {
    if (!(part.end - part.start > EPS)) return false;
    return !enclosures.some((bay) => part.start > bay.low + EPS && part.end < bay.high - EPS);
  });
}

/** Front-face and top limit for a span that occupies the panel or the bay between its outer faces. */
export function faceLimitForSpan(
  start: number,
  end: number,
  stops: readonly PanelOuterStop[],
): { faceDepth: number; top: number } | null {
  const EPS = REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  if (!stops.length || !(end > start)) return null;
  let faceDepth = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let hit = false;
  const panels = new Map<string, PanelOuterStop>();
  for (const stop of stops) panels.set(stop.panelUid, stop);
  for (const panel of Array.from(panels.values())) {
    const overlapsBody = start < panel.bodyEnd - EPS && end > panel.bodyStart + EPS;
    if (!overlapsBody) continue;
    hit = true;
    faceDepth = Math.min(faceDepth, panel.faceDepth);
    top = Math.min(top, panel.top);
  }
  const byFridge = new Map<string, { low: number; high: number; face: number; top: number }>();
  for (const stop of stops) {
    if (!stop.refrigeratorUid) continue;
    const row = byFridge.get(stop.refrigeratorUid) ?? {
      low: Number.POSITIVE_INFINITY,
      high: Number.NEGATIVE_INFINITY,
      face: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
    };
    if (stop.outside === "below") row.low = Math.min(row.low, stop.edge);
    else row.high = Math.max(row.high, stop.edge);
    row.face = Math.min(row.face, stop.faceDepth);
    row.top = Math.min(row.top, stop.top);
    byFridge.set(stop.refrigeratorUid, row);
  }
  for (const row of Array.from(byFridge.values())) {
    if (!(row.high > row.low)) continue;
    if (!(start < row.high - EPS && end > row.low + EPS)) continue;
    hit = true;
    faceDepth = Math.min(faceDepth, row.face);
    top = Math.min(top, row.top);
  }
  return hit && Number.isFinite(faceDepth) ? { faceDepth, top } : null;
}

export type PanelLimitPiece = {
  uid: string;
  wallId: string;
  start: number;
  end: number;
  depth: number;
  /** Distance from the wall to the front face. */
  front: number;
  bottom: number;
  top: number;
  kind: "panel" | "filler" | "trim" | "refrigerator" | "cabinet";
};

export type PanelLimitEdit = {
  uid: string;
  drop: boolean;
  changed: boolean;
  start: number;
  end: number;
  depth: number;
  /** Front face the piece must not pass. Null when the front already fits. */
  maxFront: number | null;
  /** New top when the piece rises past the panel. Undefined when the top already fits. */
  top?: number;
};

function unchanged(piece: PanelLimitPiece): PanelLimitEdit {
  return {
    uid: piece.uid,
    drop: false,
    changed: false,
    start: piece.start,
    end: piece.end,
    depth: piece.depth,
    maxFront: null,
  };
}

/**
 * Decide how each piece must change. The refrigerator appliance keeps its
 * measured width (a too-wide box is reported by the fit check). Every other
 * piece is cut back to the outer face, and anything in the bay is held to the
 * panel's front face and top.
 */
/**
 * True when a trimmed span has ended up sitting in the refrigerator bay itself,
 * between the two end panels, rather than in a cabinet run beside it. The bay is
 * reserved for the refrigerator: a cabinet trimmed into it would overlap the
 * appliance, so the caller drops it instead.
 */
export function spanSitsInsideRefrigeratorBay(
  start: number,
  end: number,
  stops: readonly PanelOuterStop[],
): boolean {
  const EPS = REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  const left = stops.filter((stop) => stop.outside === "below");
  const right = stops.filter((stop) => stop.outside === "above");
  if (!left.length || !right.length) return false;
  const bayStart = Math.max(...left.map((stop) => stop.edge));
  const bayEnd = Math.min(...right.map((stop) => stop.edge));
  if (!(bayEnd > bayStart + EPS)) return false;
  return start >= bayStart - EPS && end <= bayEnd + EPS;
}

/**
 * How a span relates to the refrigerator bay: entirely inside it (between the
 * two panel faces), straddling one face, spanning the whole bay, or outside it.
 */
export type BayRelation = "inside" | "straddles-one" | "spans-both" | "outside";

export function bayRelation(
  start: number,
  end: number,
  stops: readonly PanelOuterStop[],
): BayRelation {
  const EPS = REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  const leftEdges = stops.filter((stop) => stop.outside === "below").map((stop) => stop.edge);
  const rightEdges = stops.filter((stop) => stop.outside === "above").map((stop) => stop.edge);
  if (!leftEdges.length && !rightEdges.length) return "outside";
  const bayStart = leftEdges.length ? Math.max(...leftEdges) : Number.NEGATIVE_INFINITY;
  const bayEnd = rightEdges.length ? Math.min(...rightEdges) : Number.POSITIVE_INFINITY;
  if (start >= bayStart - EPS && end <= bayEnd + EPS) return "inside";
  if (start < bayStart - EPS && end > bayEnd + EPS) return "spans-both";
  const crossesLeft = start < bayStart - EPS && end > bayStart + EPS;
  const crossesRight = start < bayEnd - EPS && end > bayEnd + EPS;
  return crossesLeft || crossesRight ? "straddles-one" : "outside";
}

/**
 * Trim a span so it stays on the cabinet-run side of the refrigerator end
 * panels.
 *
 * The bay between the two panels is reserved for the refrigerator, so a cabinet
 * that straddles a panel face belongs to the larger OUTSIDE portion, never the
 * portion inside the bay. The old code kept whichever half held the span's
 * center, which for a 30" upper starting before the left panel kept the piece
 * inside the bay — that is exactly the "uppers run through the tall panel"
 * report. A run piece too small to be a real cabinet after the cut is dropped.
 */
function trimToCabinetRun(
  start: number,
  end: number,
  stops: readonly PanelOuterStop[],
  minimumWidthIn: number,
): { start: number; end: number } | null {
  const EPS = REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  const leftEdges = stops.filter((stop) => stop.outside === "below").map((stop) => stop.edge);
  const rightEdges = stops.filter((stop) => stop.outside === "above").map((stop) => stop.edge);
  const outsidePieces: Array<{ start: number; end: number }> = [];
  // Outside the bay on the low side, up to the nearest left panel face.
  const leftLimit = leftEdges.length ? Math.max(...leftEdges) : Number.POSITIVE_INFINITY;
  if (start < leftLimit - EPS) outsidePieces.push({ start, end: Math.min(end, leftLimit) });
  // Outside the bay on the high side, from the nearest right panel face.
  const rightLimit = rightEdges.length ? Math.min(...rightEdges) : Number.NEGATIVE_INFINITY;
  if (end > rightLimit + EPS) outsidePieces.push({ start: Math.max(start, rightLimit), end });
  const best = outsidePieces
    .map((piece) => ({ ...piece, width: piece.end - piece.start }))
    .filter((piece) => piece.width > EPS)
    .sort((a, b) => b.width - a.width)[0];
  if (!best || best.width < minimumWidthIn - EPS) return null;
  return { start: best.start, end: best.end };
}

export function planRefrigeratorPanelLimit(
  pieces: readonly PanelLimitPiece[],
  stops: readonly PanelOuterStop[],
): PanelLimitEdit[] {
  const EPS = REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  return pieces.map((piece) => {
    if (piece.kind === "panel") return unchanged(piece);
    const wallStops = stops.filter((stop) => stop.wallId === piece.wallId);
    if (!wallStops.length) return unchanged(piece);
    let start = piece.start;
    let end = piece.end;
    if (piece.kind !== "refrigerator") {
      const minKeep = piece.kind === "filler" || piece.kind === "trim"
        ? REFRIGERATOR_PANEL_FILLER_MIN_IN
        : EPS;
      const relation = bayRelation(start, end, wallStops);
      // Inside the bay is where the refrigerator and its own cabinet above live.
      // A piece that is entirely in there keeps its span (its depth and top are
      // still held below); a piece that spans the whole bay is the cabinet above
      // the refrigerator and is clipped into the bay. Only a piece that straddles
      // ONE panel face is a run piece to trim outward — trimming that into the bay
      // is what left an upper running through the tall panel.
      if (relation === "straddles-one") {
        const clamped = clampSpanToPanelOuterFaces(start, end, wallStops, minKeep);
        const trimmed = clamped ? trimToCabinetRun(clamped.start, clamped.end, wallStops, minKeep) : null;
        if (!trimmed) {
          return { uid: piece.uid, drop: true, changed: true, start, end, depth: piece.depth, maxFront: null };
        }
        start = trimmed.start;
        end = trimmed.end;
      } else if (relation === "spans-both") {
        const clamped = clampSpanToPanelOuterFaces(start, end, wallStops, minKeep);
        if (!clamped) {
          return { uid: piece.uid, drop: true, changed: true, start, end, depth: piece.depth, maxFront: null };
        }
        start = clamped.start;
        end = clamped.end;
      }
    }
    const limit = faceLimitForSpan(start, end, wallStops);
    const maxFront = limit && piece.front > limit.faceDepth + EPS ? limit.faceDepth : null;
    const depth = maxFront != null ? Math.min(piece.depth, maxFront) : piece.depth;
    let top: number | undefined;
    if (limit && piece.top > limit.top + EPS && limit.top - piece.bottom > EPS) top = limit.top;
    const changed = Math.abs(start - piece.start) > EPS
      || Math.abs(end - piece.end) > EPS
      || maxFront != null
      || top != null;
    return { uid: piece.uid, drop: false, changed, start, end, depth, maxFront, ...(top != null ? { top } : {}) };
  });
}

export function clampTrimRunSpans<T extends { id: string; wallId: string; start: number; end: number }>(
  runs: readonly T[],
  stops: readonly PanelOuterStop[],
): T[] {
  const EPS = REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  const kept: T[] = [];
  for (const run of runs) {
    const wallStops = stops.filter((stop) => stop.wallId === run.wallId);
    if (!wallStops.length) {
      kept.push(run);
      continue;
    }
    const clamped = clampSpanToPanelOuterFaces(run.start, run.end, wallStops, EPS);
    if (!clamped) continue;
    if (Math.abs(clamped.start - run.start) <= EPS && Math.abs(clamped.end - run.end) <= EPS) kept.push(run);
    else kept.push({ ...run, start: clamped.start, end: clamped.end });
  }
  return kept;
}
