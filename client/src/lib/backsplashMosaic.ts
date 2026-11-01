import {
  cabinetWall, wallLength, wallRunOffset, wallRunSpan, elevationBox,
  type PlacedCabinet, type RoomData, type WallOpening,
} from "./design";

/**
 * HARD RULE (owner, not a preference): MOSAICS HAVE NO VISIBLE SHEET EDGES. THIS APPLIES TO EVERY MOSAIC PRODUCT.
 *
 * "Every mosaic" means every product in the catalog that is a mosaic of any pattern: hex, square, picket,
 * herringbone, penny, linear, subway/staggered sheets, Moonstone Hex, and any mosaic added later. It is not a short
 * list of names. Curated sheets have their own row in `MOSAIC_SHEET_SPECS`: Desert Clay, Arctic Vail, Carbon Hex,
 * Carrara Subway, Cloudline Marble, Concord Square, Glacier Shift, Golden Trace, Icestone Flux, Misty Coast,
 * Thassos Subway. Any other catalog mosaic gets a
 * `genericMosaicSheetSpec` built from its catalog size. There is no plain "tile with a border" path for a mosaic.
 * Only non-mosaics (field tile) use the plain fallback. Applies in the 3D view AND the elevation view.
 *
 *  1. Each sheet sits at its real repeat spacing (the pitch), flush against the next, so the only thing visible at
 *     any joint is one even grout line of 1/16 to 1/8 inch. The grout at a sheet edge is the same width and color as
 *     the grout inside the sheet (the product's own chip joint, `internalGroutIn`). Straight-edge sheets have
 *     overlap 0 (pitch = sheet size); fork-edged interlocking sheets have an overhang that is subtracted.
 *  2. No per-sheet brightness or tint change, no darker outline, no seam where sheets meet. The backsplash must
 *     read as one continuous tiled surface, never a grid of rectangles. Do not add per-sheet shading, vertex
 *     colors, sheet borders or any sheet-by-sheet variation to any mosaic.
 *  3. Any change here must keep `backsplashMosaic.test.ts` passing, including the test that fails when a catalog
 *     mosaic has no spec.
 *
 * Interlocking mosaic: repeat at the interlock pitch, not the photo's outer size.
 *
 * The catalog photos show a whole sheet including the fork-shaped fingers that stick out past the sheet's repeat
 * spacing (the "pitch"). Repeating that photo at its OUTER size leaves the fingers beside each other instead of
 * inside each other, which is the jagged, uneven seam. Each sheet is instead repeated at its pitch: the photo is
 * cropped to one repeating unit, and one even grout line (1/16 to 1/8 inch) is drawn at every joint.
 *
 * ESTIMATE WARNING: overhang, internal grout and grout color are ESTIMATES (`measured: false`) unless the row says
 * `measured: true`. A measured row was read from that product's transparent Designer sheet (hex or diamond centers,
 * or the staggered brick edges). The inches are the catalog sheet size; the repeat fraction comes from that photo's
 * own pixel box, so a later upload of the same sheet at another resolution keeps the same pitch.
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
  /** The product's own chip-to-chip joint inside the sheet (estimate). The sheet-edge grout is drawn at exactly this width. */
  internalGroutIn: number;
  /** Width of the grout line painted at every sheet joint. Always equal to `internalGroutIn`. */
  groutIn: number;
  /** Matched grout color. Null means "derive it from the photo" (darkened mean of the sheet). */
  groutColor: string | null;
  measured: boolean;
  /** "interlocking" = fork-edged sheet (overhang > 0); "straight" = straight-edge sheet (overlap 0). */
  edge: "interlocking" | "straight";
  /** True for a catalog mosaic with no curated row; spacing comes from the catalog size string. */
  generic: boolean;
};

const spec = (key: string, name: string, w: number, h: number, overhangX: number, overhangY = overhangX): MosaicInterlockSpec => ({
  key, name, outerWidthIn: w, outerHeightIn: h, overhangXIn: overhangX, overhangYIn: overhangY,
  internalGroutIn: MOSAIC_GROUT_DEFAULT_IN, groutIn: MOSAIC_GROUT_DEFAULT_IN, groutColor: null, measured: false,
  edge: overhangX > 0 || overhangY > 0 ? "interlocking" : "straight", generic: false,
});
/** Grout colors matched to each product's tone. ESTIMATES from the catalog names/photos, not measured. */
const GROUT_COLOR_BY_NAME: Record<string, string> = {
  "desert clay": "#8c7a68", "arctic vail": "#8f9496",
  // Measured from the white joints on the Carbon Hex designer sheet (median grout ~252).
  "carbon hex": "#f4f4f4",
  "concord square": "#9a9a98", "glacier shift": "#8b9291", "golden trace": "#8a7f6e",
  "carrara subway": "#9b9a96", "cloudline marble": "#a09f9c",
  // Light joint in the gray/blue glass strips. Estimate, same as the other rows.
  "misty coast": "#c5c3be",
  // Measured from the grout lines on the designer sheets (not the neutral grey fill).
  "icestone flux": "#675b4e",
  "thassos subway": "#5a534e",
};
/** Designer sheets whose pitch was measured from the uploaded photo. */
const MEASURED_SHEET_NAMES = new Set(["carbon hex", "icestone flux", "thassos subway"]);
/** Neutral grout for a catalog mosaic with no curated row (estimate). */
export const GENERIC_MOSAIC_GROUT_COLOR = "#8a8782";

export const MOSAIC_SHEET_SPECS: readonly MosaicInterlockSpec[] = [
  spec("desert-clay-11.81in-interlocking-mosaic", "desert clay", 11.81, 11.81, 0.3125),
  spec("arctic-vail-10.71in-interlocking-hex-mosaic", "arctic vail", 10.71, 10.55, 0.3125),
  // Measured on the 1621×1351 designer sheet. Content box 1618×1323. Four columns at 365.25 px
  // and four rows at 319 px: the nest period is 1461×1276 px, centered in that box.
  spec("carbon-hex-12.80in-marble-hex-mosaic", "carbon hex", 12.8, 11.1, 1.2418, 0.3943),
  spec("concord-square-11.81in-glass-marble-mosaic", "concord square", 11.81, 11.81, 0.3125),
  spec("glacier-shift-12.05in-recycled-glass-herringbone", "glacier shift", 12.05, 12.05, 0.3125),
  spec("golden-trace-11.81in-marble-aluminum-mosaic", "golden trace", 11.81, 11.81, 0.3125),
  // Measured on the 1625×1316 designer sheet. Content box 1570×1275. Diamond repeat 1410×1186 px.
  spec("icestone-flux-10.35in-diamond-mosaic", "icestone flux", 10.35, 11.73, 1.0548, 0.8187),
  // Pelican lists Misty Coast as 11.81 x 11.81 (8mm is thickness). Horizontal overhang is the ragged
  // strip ends that nest into the next sheet, about 22% of that sheet, estimated from the product photo
  // (measured stays false). Vertical stagger is only a hairline. The repeat is that face width minus the overhang.
  spec("misty-coast-11.81in-interlocking-linear-mosaic", "misty coast", 11.81, 11.81, 2.637, 0.266),
  // Straight-edge sheets: overlap 0, so the pitch is the sheet size.
  spec("carrara-subway-11.97in-running-bond-mosaic", "carrara subway", 11.97, 12.13, 0),
  spec("cloudline-marble-11.81in-staggered-glass-marble-mosaic", "cloudline marble", 11.81, 11.81, 0),
  // Measured on the 1646×1330 designer sheet. Content box 1644×1328. Two bricks per row, alternate
  // rows offset half a brick: the nest period is 1322×1326 px (vertical overhang is a hairline).
  spec("thassos-subway-11.97in-staggered-mosaic", "thassos subway", 11.97, 12.13, 2.3446, 0.0183),
].map((item) => {
  const measured = MEASURED_SHEET_NAMES.has(item.name);
  const groutIn = measured ? MOSAIC_GROUT_MAX_IN : item.groutIn;
  return {
    ...item,
    groutColor: GROUT_COLOR_BY_NAME[item.name] ?? null,
    measured,
    internalGroutIn: groutIn,
    groutIn,
  };
});

/** Back-compat name for the table; it now holds every curated mosaic, interlocking or straight-edge. */
export const MOSAIC_INTERLOCK_SPECS = MOSAIC_SHEET_SPECS;

export const mosaicInterlockSpecForKey = (key: string | null | undefined) =>
  MOSAIC_SHEET_SPECS.find((item) => item.key === key) ?? null;
export const mosaicInterlockSpecForName = (name: string | null | undefined) => {
  const normalized = (name ?? "").trim().toLowerCase();
  return normalized ? MOSAIC_SHEET_SPECS.find((item) => normalized.includes(item.name)) ?? null : null;
};

export const MOSAIC_PATTERN_KINDS = ["interlocking-mosaic", "subway-mosaic"] as const;
export const isMosaicPatternKind = (kind: string | null | undefined) => kind === "interlocking-mosaic" || kind === "subway-mosaic";

/**
 * Spec for a catalog mosaic that has no curated row (Moonstone Hex and any mosaic added later). Straight-edge,
 * overlap 0, repeat = the catalog sheet size, default grout, neutral grout color. ESTIMATED (`measured: false`).
 */
export function genericMosaicSheetSpec(name: string, widthIn: number, heightIn: number): MosaicInterlockSpec {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mosaic";
  return { ...spec(`catalog-mosaic:${slug}`, name.trim().toLowerCase(), widthIn, heightIn, 0), groutColor: GENERIC_MOSAIC_GROUT_COLOR, generic: true };
}

/**
 * The one lookup every view uses. Any mosaic (by pattern kind) gets a spec: curated by key, then by name, then a
 * generic one from its catalog size. Only a non-mosaic returns null and may use the plain tile fallback.
 */
export function mosaicSheetSpecFor(input: {
  key?: string | null; name?: string | null; widthIn?: number | null; heightIn?: number | null; patternKind?: string | null;
}): MosaicInterlockSpec | null {
  const curated = mosaicInterlockSpecForKey(input.key) ?? mosaicInterlockSpecForName(input.name);
  if (curated) return curated;
  if (!isMosaicPatternKind(input.patternKind)) return null;
  const w = Number(input.widthIn);
  const h = Number(input.heightIn);
  return genericMosaicSheetSpec(input.name?.trim() || "mosaic", w > 0 ? w : 12, h > 0 ? h : (w > 0 ? w : 12));
}

/** The distance at which the sheet repeats, so the fingers of one sheet sit inside the next. */
export function mosaicPitchIn(item: MosaicInterlockSpec) {
  // Rounded to 1/10000 in. so float noise (11.81 - 0.3125) never leaks into markup or texture math.
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return { x: round(item.outerWidthIn - item.overhangXIn), y: round(item.outerHeightIn - item.overhangYIn) };
}

/**
 * Crop plan for one repeating unit. The photo is cropped evenly on every side by half the overhang, so the cut
 * seam of two neighbouring sheets falls under the grout line, which is at least as wide as the cut allows.
 * `grout*Px` is the grout line drawn along the unit's top and right edge, so each joint carries exactly one line.
 */
export function mosaicInterlockUnitPlan(
  item: MosaicInterlockSpec,
  imageWidthPx: number,
  imageHeightPx: number,
  maxUnitPx: number,
  /** A repeat measured from the photo itself (pixels). Wins over the estimated overhang; the output period stays the spec pitch. */
  measuredCore?: { x: number; y: number; width: number; height: number } | null,
) {
  const pitch = mosaicPitchIn(item);
  const pxPerInX = imageWidthPx / item.outerWidthIn;
  const pxPerInY = imageHeightPx / item.outerHeightIn;
  const source = measuredCore && measuredCore.width > 0 && measuredCore.height > 0
    ? { ...measuredCore }
    : {
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
