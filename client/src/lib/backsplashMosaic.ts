import {
  cabinetWall, wallLength, wallRunOffset, wallRunSpan, elevationBox,
  type PlacedCabinet, type RoomData, type WallOpening,
} from "./design";

/**
 * Interlocking mosaic backsplash (3D and elevation).
 *
 * The catalog photos show a whole sheet including the fork-shaped fingers that stick out past the sheet's repeat
 * spacing (the "pitch"). Repeating that photo at its OUTER size leaves the fingers beside each other instead of
 * inside each other, which is the jagged, uneven seam. Each sheet is instead repeated at its interlock pitch: the
 * photo is cropped to one repeating unit, and one even grout line (1/16 to 1/8 inch) is drawn at every joint.
 *
 * ESTIMATE WARNING: the overhang values below (outer size minus pitch) are estimates, not measurements of the
 * product photos. They are kept in this one table so a real measurement is a one-line change.
 */
export const MOSAIC_GROUT_MIN_IN = 1 / 16;
export const MOSAIC_GROUT_MAX_IN = 1 / 8;
export const MOSAIC_GROUT_DEFAULT_IN = 3 / 32;

export function clampMosaicGroutIn(value: number | null | undefined): number {
  const v = Number.isFinite(value) ? Number(value) : MOSAIC_GROUT_DEFAULT_IN;
  return Math.min(MOSAIC_GROUT_MAX_IN, Math.max(MOSAIC_GROUT_MIN_IN, v));
}

export type MosaicInterlockSpec = {
  key: string;
  /** Lowercase name used by the 2D elevation, which has a product name but not the 3D key. */
  name: string;
  outerWidthIn: number;
  outerHeightIn: number;
  /** How far the fingers stick out past the repeat spacing, per axis (estimate, see warning above). */
  overhangXIn: number;
  overhangYIn: number;
  groutIn: number;
  /** Matched grout color. Null means "derive it from the photo" (darkened mean of the sheet). */
  groutColor: string | null;
  measured: boolean;
};

const spec = (key: string, name: string, w: number, h: number, overhang: number): MosaicInterlockSpec => ({
  key, name, outerWidthIn: w, outerHeightIn: h, overhangXIn: overhang, overhangYIn: overhang,
  groutIn: MOSAIC_GROUT_DEFAULT_IN, groutColor: null, measured: false,
});
/** Grout colors matched to each product's tone. ESTIMATES from the catalog names/photos, not measured. */
const GROUT_COLOR_BY_NAME: Record<string, string> = {
  "desert clay": "#8c7a68", "arctic vail": "#8f9496", "carbon hex": "#4a4a4c",
  "concord square": "#9a9a98", "glacier shift": "#8b9291", "golden trace": "#8a7f6e",
};

export const MOSAIC_INTERLOCK_SPECS: readonly MosaicInterlockSpec[] = [
  spec("desert-clay-11.81in-interlocking-mosaic", "desert clay", 11.81, 11.81, 0.3125),
  spec("arctic-vail-10.71in-interlocking-hex-mosaic", "arctic vail", 10.71, 10.55, 0.3125),
  spec("carbon-hex-12.80in-marble-hex-mosaic", "carbon hex", 12.8, 11.1, 0.3125),
  spec("concord-square-11.81in-glass-marble-mosaic", "concord square", 11.81, 11.81, 0.3125),
  spec("glacier-shift-12.05in-recycled-glass-herringbone", "glacier shift", 12.05, 12.05, 0.3125),
  spec("golden-trace-11.81in-marble-aluminum-mosaic", "golden trace", 11.81, 11.81, 0.3125),
].map((item) => ({ ...item, groutColor: GROUT_COLOR_BY_NAME[item.name] ?? null }));

export const mosaicInterlockSpecForKey = (key: string | null | undefined) =>
  MOSAIC_INTERLOCK_SPECS.find((item) => item.key === key) ?? null;
export const mosaicInterlockSpecForName = (name: string | null | undefined) => {
  const normalized = (name ?? "").trim().toLowerCase();
  return normalized ? MOSAIC_INTERLOCK_SPECS.find((item) => normalized.includes(item.name)) ?? null : null;
};

/** The distance at which the sheet repeats, so the fingers of one sheet sit inside the next. */
export function mosaicPitchIn(item: MosaicInterlockSpec) {
  return { x: item.outerWidthIn - item.overhangXIn, y: item.outerHeightIn - item.overhangYIn };
}

/**
 * Crop plan for one repeating unit. The photo is cropped evenly on every side by half the overhang, so the cut
 * seam of two neighbouring sheets falls under the grout line, which is at least as wide as the cut allows.
 * `grout*Px` is the grout line drawn along the unit's top and right edge, so each joint carries exactly one line.
 */
export function mosaicInterlockUnitPlan(item: MosaicInterlockSpec, imageWidthPx: number, imageHeightPx: number, maxUnitPx: number) {
  const pitch = mosaicPitchIn(item);
  const pxPerInX = imageWidthPx / item.outerWidthIn;
  const pxPerInY = imageHeightPx / item.outerHeightIn;
  const source = {
    x: (item.overhangXIn / 2) * pxPerInX,
    y: (item.overhangYIn / 2) * pxPerInY,
    width: pitch.x * pxPerInX,
    height: pitch.y * pxPerInY,
  };
  const scale = Math.min(1, maxUnitPx / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const groutIn = clampMosaicGroutIn(item.groutIn);
  return {
    source,
    width,
    height,
    pitchXIn: pitch.x,
    pitchYIn: pitch.y,
    groutIn,
    groutXPx: Math.max(1, Math.round((groutIn / pitch.x) * width)),
    groutYPx: Math.max(1, Math.round((groutIn / pitch.y) * height)),
  };
}

/** Real inches of grout the plan paints across the unit, so a test (and a reviewer) can check 1/16 to 1/8. */
export function mosaicPlanGroutIn(plan: ReturnType<typeof mosaicInterlockUnitPlan>) {
  return { x: (plan.groutXPx / plan.width) * plan.pitchXIn, y: (plan.groutYPx / plan.height) * plan.pitchYIn };
}

/**
 * Inside corner: both walls' tile grids start at the shared corner. A run whose only corner is at its end is
 * measured from that end, so the joints on the two walls meet at the corner instead of leaving a half-sheet seam.
 */
export function mosaicPhaseAnchorEdge(touchesStartCorner: boolean, touchesEndCorner: boolean): "start" | "end" {
  return !touchesStartCorner && touchesEndCorner ? "end" : "start";
}

export function mosaicAlongForTile(coordIn: number, wallLengthIn: number, anchor: "start" | "end") {
  return anchor === "end" ? wallLengthIn - coordIn : coordIn;
}

/** Texture coordinate of a wall point, measured in whole sheets: one repeat per pitch, grid anchored at the corner. */
export function mosaicUvForPoint(coordIn: number, elevationIn: number, pitchXIn: number, pitchYIn: number, wallLengthIn: number, anchor: "start" | "end") {
  return {
    u: mosaicAlongForTile(coordIn, wallLengthIn, anchor) / Math.max(0.125, pitchXIn),
    v: elevationIn / Math.max(0.125, pitchYIn),
  };
}

/** Deterministic per-sheet lot shade, +/-2.5% in brightness only (no hue shift), so a long run does not look stamped. */
export function mosaicSheetShade(cellU: number, cellV: number, seed: number): number {
  let h = (Math.imul(cellU | 0, 374761393) + Math.imul(cellV | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  const unit = ((h >>> 0) % 1000) / 999;
  return 1 + (unit - 0.5) * 0.05;
}

export type WallInterval = { start: number; end: number };

function mergeIntervals(list: WallInterval[]): WallInterval[] {
  const sorted = list.filter((item) => item.end - item.start > 0.001).sort((a, b) => a.start - b.start);
  const out: WallInterval[] = [];
  for (const item of sorted) {
    const last = out[out.length - 1];
    if (last && item.start <= last.end + 0.001) last.end = Math.max(last.end, item.end);
    else out.push({ ...item });
  }
  return out;
}

/**
 * Baseboard runs on one wall: only wall that is actually exposed. Nothing is run behind the toe kicks of base
 * cabinets, appliances, tall units, fillers or panels standing on the floor against the wall, and the baseboard
 * stops at door openings.
 */
export function baseboardSpans(
  placed: readonly PlacedCabinet[],
  openings: readonly WallOpening[],
  room: RoomData,
  side: string,
): WallInterval[] {
  const length = wallLength(side as never, room);
  if (!(length > 0)) return [];
  const blocked: WallInterval[] = [];
  for (const cabinet of placed) {
    if (cabinetWall(cabinet, room) !== side) continue;
    if (elevationBox(cabinet, room).bottom > 0.5) continue; // wall cabinets and raised units leave the wall exposed
    const start = wallRunOffset(cabinet, side, room);
    blocked.push({ start, end: start + wallRunSpan(cabinet, side, room) });
  }
  for (const opening of openings) {
    if (opening.side !== side || opening.kind !== "door") continue;
    blocked.push({ start: opening.offset, end: opening.offset + opening.width });
  }
  const merged = mergeIntervals(blocked);
  const free: WallInterval[] = [];
  let cursor = 0;
  for (const item of merged) {
    if (item.start > cursor + 0.001) free.push({ start: cursor, end: Math.min(item.start, length) });
    cursor = Math.max(cursor, item.end);
  }
  if (cursor < length - 0.001) free.push({ start: cursor, end: length });
  return free.filter((item) => item.end - item.start >= 1);
}

export type MosaicEdgeSegment = { side: string; start: number; end: number; bottom: number; top: number };

/** Which cut edges of a backsplash piece need a finished edge strip: not the counter, ceiling, wall ends, or a neighbouring piece. */
export function mosaicFinishedEdges(
  segment: MosaicEdgeSegment,
  all: readonly MosaicEdgeSegment[],
  wallLengthIn: number,
  ceilingIn: number,
  counterTopIn = 36,
): Array<"top" | "bottom" | "start" | "end"> {
  const tol = 0.35;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const sameWall = all.filter((other) => other !== segment && other.side === segment.side);
  const alongOverlap = (o: MosaicEdgeSegment) => o.end > segment.start + 0.1 && o.start < segment.end - 0.1;
  const upOverlap = (o: MosaicEdgeSegment) => o.top > segment.bottom + 0.1 && o.bottom < segment.top - 0.1;
  const edges: Array<"top" | "bottom" | "start" | "end"> = [];
  if (segment.top < ceilingIn - 0.5 && !sameWall.some((o) => near(o.bottom, segment.top) && alongOverlap(o))) edges.push("top");
  if (segment.bottom > counterTopIn + 0.5 && !sameWall.some((o) => near(o.top, segment.bottom) && alongOverlap(o))) edges.push("bottom");
  if (segment.start > tol && !sameWall.some((o) => near(o.end, segment.start) && upOverlap(o))) edges.push("start");
  if (segment.end < wallLengthIn - tol && !sameWall.some((o) => near(o.start, segment.end) && upOverlap(o))) edges.push("end");
  return edges;
}
