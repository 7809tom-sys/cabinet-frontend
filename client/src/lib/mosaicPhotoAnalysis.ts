/**
 * Reads a mosaic product photo and finds (1) the real sheet inside the photo, however the border is made (white,
 * off-white, light grey, transparent, a thin frame line) and (2) the sheet's repeat, i.e. the span that tiles
 * flush, as opposed to the fork-shaped fingers that stick out past it. Pure pixel math, no DOM, so it is testable.
 *
 * Why: the fixed crop only removed pure-white margins, so off-white or framed photos kept a border that showed up
 * as a square at every sheet; and the repeat was an estimate. Anything this cannot decide returns null and the
 * caller keeps the spec estimate. It never guesses.
 */
export type PhotoBox = { x: number; y: number; width: number; height: number };

export type MosaicPhotoAnalysis = {
  /** The sheet including any fingers, border removed. */
  box: PhotoBox;
  /** The part of the sheet that tiles flush (full-coverage columns/rows), inside `box` coordinates of the photo. */
  core: PhotoBox;
  /** Fingers beyond the core, in photo pixels. 0 for a straight-edge sheet. */
  overhangXPx: number;
  overhangYPx: number;
  /** What was found around the sheet. */
  background: "transparent" | "color";
  frameLineTrimmed: boolean;
};

const CONTENT_DIFF = 28;
const MIN_ALPHA = 16;
const EDGE_COVERAGE = 0.12;
const CORE_COVERAGE = 0.97;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

type Background = { transparent: boolean; r: number; g: number; b: number };

function ringBackground(data: ArrayLike<number>, width: number, height: number): Background {
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.01));
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  let transparent = 0;
  let total = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= ring && x < width - ring && y >= ring && y < height - ring) { x = width - ring - 1; continue; }
      const index = (y * width + x) * 4;
      total += 1;
      if (data[index + 3] < MIN_ALPHA) { transparent += 1; continue; }
      reds.push(data[index]!); greens.push(data[index + 1]!); blues.push(data[index + 2]!);
    }
  }
  if (total === 0 || transparent / total > 0.5 || reds.length === 0) return { transparent: true, r: 255, g: 255, b: 255 };
  return { transparent: false, r: median(reds), g: median(greens), b: median(blues) };
}

function isContent(data: ArrayLike<number>, index: number, bg: Background) {
  if (data[index + 3]! < MIN_ALPHA) return false;
  if (bg.transparent) return true;
  return Math.max(Math.abs(data[index]! - bg.r), Math.abs(data[index + 1]! - bg.g), Math.abs(data[index + 2]! - bg.b)) > CONTENT_DIFF;
}

function firstAtLeast(profile: number[], from: number, to: number, step: 1 | -1, minimum: number) {
  for (let i = from; i !== to + step; i += step) if (profile[i]! >= minimum) return i;
  return -1;
}

/**
 * A thin full-length line (a photo frame) separated from the sheet by background: move the edge past it.
 * `start` is the index of the first content line seen from that side; `step` points into the photo.
 */
function trimFrameLine(profile: number[], start: number, step: 1 | -1, limit: number, dimension: number) {
  const maxLine = Math.max(1, Math.round(dimension * 0.02));
  let i = start;
  let line = 0;
  while (i !== limit + step && profile[i]! >= CORE_COVERAGE && line <= maxLine) { i += step; line += 1; }
  if (line === 0 || line > maxLine) return start;
  let gap = 0;
  while (i !== limit + step && profile[i]! < 0.05) { i += step; gap += 1; }
  if (gap === 0 || i === limit + step) return start;
  return i;
}

export function analyzeMosaicPhoto(data: ArrayLike<number>, width: number, height: number): MosaicPhotoAnalysis | null {
  if (width < 16 || height < 16 || data.length < width * height * 4) return null;
  const bg = ringBackground(data, width, height);
  const colCount = new Array<number>(width).fill(0);
  const rowCount = new Array<number>(height).fill(0);
  const mask = new Uint8Array(width * height);
  let content = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isContent(data, (y * width + x) * 4, bg)) continue;
      mask[y * width + x] = 1;
      colCount[x]! += 1; rowCount[y]! += 1; content += 1;
    }
  }
  if (content < width * height * 0.05) return null;
  let colCov = colCount.map((count) => count / height);
  let rowCov = rowCount.map((count) => count / width);

  let left = firstAtLeast(colCov, 0, width - 1, 1, EDGE_COVERAGE);
  let right = firstAtLeast(colCov, width - 1, 0, -1, EDGE_COVERAGE);
  let top = firstAtLeast(rowCov, 0, height - 1, 1, EDGE_COVERAGE);
  let bottom = firstAtLeast(rowCov, height - 1, 0, -1, EDGE_COVERAGE);
  if (left < 0 || top < 0 || right <= left || bottom <= top) return null;

  const trimmed = { left, right, top, bottom };
  left = trimFrameLine(colCov, left, 1, right, width);
  right = trimFrameLine(colCov, right, -1, left, width);
  top = trimFrameLine(rowCov, top, 1, bottom, height);
  bottom = trimFrameLine(rowCov, bottom, -1, top, height);
  const frameLineTrimmed = left !== trimmed.left || right !== trimmed.right || top !== trimmed.top || bottom !== trimmed.bottom;
  if (right <= left || bottom <= top) return null;

  const box: PhotoBox = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  if (box.width < width * 0.2 || box.height < height * 0.2) return null;

  // Coverage again, over the sheet's own box only and only across its middle band (20% to 80%), so margins, shadow
  // specks and the fingers along the opposite axis no longer pull a flush column or row below full coverage.
  colCov = new Array<number>(box.width).fill(0);
  rowCov = new Array<number>(box.height).fill(0);
  const bandY0 = Math.floor(box.height * 0.2); const bandY1 = Math.ceil(box.height * 0.8);
  const bandX0 = Math.floor(box.width * 0.2); const bandX1 = Math.ceil(box.width * 0.8);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      if (!mask[(box.y + y) * width + box.x + x]) continue;
      if (y >= bandY0 && y < bandY1) colCov[x]! += 1;
      if (x >= bandX0 && x < bandX1) rowCov[y]! += 1;
    }
  }
  const longestRun = (profile: number[], total: number) => {
    let bestStart = 0; let bestLength = 0; let start = -1;
    for (let i = 0; i <= profile.length; i += 1) {
      const full = i < profile.length && profile[i]! / total >= CORE_COVERAGE;
      if (full && start < 0) start = i;
      if (!full && start >= 0) { if (i - start > bestLength) { bestStart = start; bestLength = i - start; } start = -1; }
    }
    return { start: bestStart, length: bestLength };
  };
  const columns = longestRun(colCov, bandY1 - bandY0);
  const rows = longestRun(rowCov, bandX1 - bandX0);
  // No flush core found (a photo with gaps, shadows, or a non-sheet picture): do not pretend to have measured it.
  if (columns.length < box.width * 0.5 || rows.length < box.height * 0.5) return null;
  const core: PhotoBox = { x: box.x + columns.start, y: box.y + rows.start, width: columns.length, height: rows.length };
  return {
    box, core,
    overhangXPx: box.width - core.width,
    overhangYPx: box.height - core.height,
    background: bg.transparent ? "transparent" : "color",
    frameLineTrimmed,
  };
}

/**
 * Turns pixel measurements into inches using the sheet's known outer size, and accepts them only when plausible:
 * an overhang above 20% of the sheet is a bad detection, not a finger. Returns null to keep the estimate.
 */
export function measuredMosaicOverhangIn(analysis: MosaicPhotoAnalysis | null, outerWidthIn: number, outerHeightIn: number) {
  if (!analysis || !(outerWidthIn > 0) || !(outerHeightIn > 0)) return null;
  const x = (analysis.overhangXPx / analysis.box.width) * outerWidthIn;
  const y = (analysis.overhangYPx / analysis.box.height) * outerHeightIn;
  if (x < 0 || y < 0 || x > outerWidthIn * 0.2 || y > outerHeightIn * 0.2) return null;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { overhangXIn: round(x), overhangYIn: round(y) };
}
