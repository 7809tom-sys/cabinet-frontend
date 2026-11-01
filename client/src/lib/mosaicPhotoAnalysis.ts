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
/** More than this fraction of pixels with alpha below MIN_ALPHA is real transparency, not antialiasing. */
const MEANINGFUL_TRANSPARENCY = 0.03;

/**
 * True when the image has real clear pixels, not just a soft edge.
 * A sheet whose strips run to the border can be only ~30% clear in the outer ring
 * and still be a transparent upload. Callers must not invent a solid background colour from it.
 */
export function imageHasMeaningfulTransparency(data: ArrayLike<number>, width: number, height: number): boolean {
  if (width < 1 || height < 1 || data.length < width * height * 4) return false;
  const limit = width * height * MEANINGFUL_TRANSPARENCY;
  let transparent = 0;
  const pixels = width * height;
  for (let index = 0; index < pixels; index += 1) {
    if (data[index * 4 + 3]! < MIN_ALPHA) {
      transparent += 1;
      if (transparent > limit) return true;
    }
  }
  return false;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

type Background = { transparent: boolean; r: number; g: number; b: number };

function ringBackground(data: ArrayLike<number>, width: number, height: number): Background {
  // Strips that touch the image edge make the border ring look mostly solid. Any real
  // transparency in the image still means the background is clear — never a median of tile pixels.
  if (imageHasMeaningfulTransparency(data, width, height)) return { transparent: true, r: 255, g: 255, b: 255 };
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

function coverageEdge(counts: Uint32Array, other: number, step: 1 | -1, minimum: number) {
  const start = step === 1 ? 0 : counts.length - 1;
  const end = step === 1 ? counts.length - 1 : 0;
  for (let index = start; index !== end + step; index += step) {
    if (counts[index]! / other >= minimum) return index;
  }
  return -1;
}

/** Sheet bounds from the full-resolution alpha mask. The downscaled mask rounds the far edge down. */
function fullResolutionAlphaBox(data: ArrayLike<number>, width: number, height: number): PhotoBox | null {
  const col = new Uint32Array(width);
  const row = new Uint32Array(height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! < MIN_ALPHA) continue;
      col[x]! += 1;
      row[y]! += 1;
    }
  }
  const left = coverageEdge(col, height, 1, EDGE_COVERAGE);
  const right = coverageEdge(col, height, -1, EDGE_COVERAGE);
  const top = coverageEdge(row, width, 1, EDGE_COVERAGE);
  const bottom = coverageEdge(row, width, -1, EDGE_COVERAGE);
  if (left < 0 || top < 0 || right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Gaps plus overlaps when the full-resolution alpha mask is repeated at (sx, sy).
 * `stride` samples the period; the shift itself stays in source pixels.
 */
function scoreFullResolutionShift(sub: Uint8Array, boxW: number, boxH: number, sx: number, sy: number, stride: number) {
  const originX = Math.floor((boxW - sx) / 2);
  const originY = Math.floor((boxH - sy) / 2);
  let empty = 0;
  let collision = 0;
  let total = 0;
  const hit = (ix: number, iy: number) => (ix >= 0 && iy >= 0 && ix < boxW && iy < boxH && sub[iy * boxW + ix] ? 1 : 0);
  for (let y = 0; y < sy; y += stride) {
    const py = originY + y;
    const y1 = py + sy;
    const y2 = py - sy;
    for (let x = 0; x < sx; x += stride) {
      const px = originX + x;
      const x1 = px + sx;
      const x2 = px - sx;
      let covered = hit(px, py) + hit(x1, py) + hit(x2, py)
        + hit(px, y1) + hit(x1, y1) + hit(x2, y1)
        + hit(px, y2) + hit(x1, y2) + hit(x2, y2);
      total += 1;
      if (covered === 0) empty += 1;
      else if (covered > 1) collision += 1;
    }
  }
  const denom = Math.max(1, total);
  return empty / denom + 4 * (collision / denom);
}

/**
 * After the coarse downscaled search, compare the real alpha mask around that guess.
 * The window is ±2 downscale-steps. The lowest gaps+overlaps wins; a numerical tie keeps the larger period.
 */
function refineFullResolutionRepeat(
  data: ArrayLike<number>,
  width: number,
  box: PhotoBox,
  guessX: number,
  guessY: number,
  factor: number,
): { x: number; y: number; value: number; fullValue: number } | null {
  const boxW = box.width;
  const boxH = box.height;
  if (boxW < 8 || boxH < 8) return null;
  const sub = new Uint8Array(boxW * boxH);
  for (let y = 0; y < boxH; y += 1) {
    const srcRow = (box.y + y) * width + box.x;
    for (let x = 0; x < boxW; x += 1) {
      sub[y * boxW + x] = data[(srcRow + x) * 4 + 3]! >= MIN_ALPHA ? 1 : 0;
    }
  }
  const radius = Math.max(2, factor * 2);
  const search = (centerX: number, centerY: number, rad: number, step: number, stride: number) => {
    let minValue = Number.POSITIVE_INFINITY;
    let chosen = { x: centerX, y: centerY, area: 0 };
    const consider = (sx: number, sy: number) => {
      if (sx < 8 || sy < 8 || sx > boxW || sy > boxH) return;
      const value = scoreFullResolutionShift(sub, boxW, boxH, sx, sy, stride);
      const area = sx * sy;
      if (value < minValue - 1e-6) {
        minValue = value;
        chosen = { x: sx, y: sy, area };
        return;
      }
      // Tie against the best score only. Raising the reference would walk toward a larger, worse period.
      if (value <= minValue + 0.0005 && area > chosen.area) chosen = { x: sx, y: sy, area };
    };
    consider(centerX, centerY);
    for (let sy = centerY - rad; sy <= centerY + rad; sy += step) {
      for (let sx = centerX - rad; sx <= centerX + rad; sx += step) consider(sx, sy);
    }
    return { x: chosen.x, y: chosen.y, value: minValue };
  };
  const guess = {
    x: Math.min(boxW, Math.max(8, Math.round(guessX))),
    y: Math.min(boxH, Math.max(8, Math.round(guessY))),
  };
  const step = Math.max(2, Math.round(factor / 2));
  const coarse = search(guess.x, guess.y, radius, step, 6);
  const mid = search(coarse.x, coarse.y, Math.max(4, factor), 1, 2);
  const fine = search(mid.x, mid.y, 2, 1, 1);
  if (!Number.isFinite(fine.value)) return null;
  const fullValue = scoreFullResolutionShift(sub, boxW, boxH, boxW, boxH, 4);
  return { x: fine.x, y: fine.y, value: fine.value, fullValue };
}

export type TransparentSheetRepeat = {
  /** Sheet bounds the repeat was measured inside (image pixels). */
  box: PhotoBox;
  /** One interlocking period, in image pixels. */
  core: PhotoBox;
  pitchFractionX: number;
  pitchFractionY: number;
};

/**
 * Repeat of a transparent Designer sheet, measured from the pixels.
 *
 * Fork, hex, diamond and staggered-subway sheets leave transparent notches where the
 * next sheet's fingers belong. The full-coverage rectangle is not that period (it is
 * only the overlap of the staggered rows). This searches shifts that nest those notches
 * and returns the sheet-sized period, or null when the photo is opaque or the search
 * cannot nest it. Callers then keep their estimate.
 */
export function measureTransparentSheetRepeat(
  data: ArrayLike<number>,
  width: number,
  height: number,
): TransparentSheetRepeat | null {
  if (width < 24 || height < 24 || data.length < width * height * 4) return null;
  let transparent = 0;
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 48));
  let seen = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      seen += 1;
      if (data[(y * width + x) * 4 + 3]! < 16) transparent += 1;
    }
  }
  // Antialiased edges are not notches. A real interlocking sheet is several percent clear.
  if (seen === 0 || transparent / seen < 0.05) return null;

  const factor = Math.max(1, Math.ceil(Math.max(width, height) / 200));
  const maskW = Math.floor(width / factor);
  const maskH = Math.floor(height / factor);
  if (maskW < 16 || maskH < 16) return null;
  const mask = new Uint8Array(maskW * maskH);
  for (let y = 0; y < maskH; y += 1) {
    for (let x = 0; x < maskW; x += 1) {
      const ox = x * factor;
      const oy = y * factor;
      let on = 0;
      for (let dy = 0; dy < factor && !on; dy += 1) {
        const row = (oy + dy) * width + ox;
        for (let dx = 0; dx < factor; dx += 1) {
          if (data[(row + dx) * 4 + 3]! >= 16) { on = 1; break; }
        }
      }
      mask[y * maskW + x] = on;
    }
  }
  const col = new Array<number>(maskW).fill(0);
  const row = new Array<number>(maskH).fill(0);
  for (let y = 0; y < maskH; y += 1) {
    for (let x = 0; x < maskW; x += 1) {
      if (!mask[y * maskW + x]) continue;
      col[x] += 1;
      row[y] += 1;
    }
  }
  const left = firstAtLeast(col.map((count) => count / maskH), 0, maskW - 1, 1, EDGE_COVERAGE);
  const right = firstAtLeast(col.map((count) => count / maskH), maskW - 1, 0, -1, EDGE_COVERAGE);
  const top = firstAtLeast(row.map((count) => count / maskW), 0, maskH - 1, 1, EDGE_COVERAGE);
  const bottom = firstAtLeast(row.map((count) => count / maskW), maskH - 1, 0, -1, EDGE_COVERAGE);
  if (left < 0 || top < 0 || right - left < 12 || bottom - top < 12) return null;
  const boxW = right - left + 1;
  const boxH = bottom - top + 1;
  const sub = new Uint8Array(boxW * boxH);
  for (let y = 0; y < boxH; y += 1) {
    for (let x = 0; x < boxW; x += 1) sub[y * boxW + x] = mask[(top + y) * maskW + left + x]!;
  }
  const score = (sx: number, sy: number) => {
    const originX = Math.floor((boxW - sx) / 2);
    const originY = Math.floor((boxH - sy) / 2);
    let empty = 0;
    let collision = 0;
    let total = 0;
    const step = sx * sy > 8000 ? 2 : 1;
    for (let y = 0; y < sy; y += step) {
      for (let x = 0; x < sx; x += step) {
        total += 1;
        let covered = 0;
        for (const shiftX of [0, sx, -sx]) {
          for (const shiftY of [0, sy, -sy]) {
            const ix = originX + shiftX + x;
            const iy = originY + shiftY + y;
            if (ix < 0 || iy < 0 || ix >= boxW || iy >= boxH) continue;
            if (sub[iy * boxW + ix]) covered += 1;
          }
        }
        if (covered === 0) empty += 1;
        else if (covered > 1) collision += 1;
      }
    }
    // Open notches raise `empty`. Chips stacked on chips raise `collision`.
    // A tie goes to the larger period so the whole sheet repeats, not one chip.
    return { value: empty / Math.max(1, total) + 4 * (collision / Math.max(1, total)), area: sx * sy };
  };

  let minValue = Number.POSITIVE_INFINITY;
  let best = { value: Number.POSITIVE_INFINITY, area: 0, x: boxW, y: boxH };
  const consider = (sx: number, sy: number) => {
    const next = score(sx, sy);
    if (next.value < minValue - 1e-9) {
      minValue = next.value;
      best = { value: next.value, area: next.area, x: sx, y: sy };
      return;
    }
    // Larger period wins only against the true minimum. Moving the reference up
    // would walk from a good nest to the full sheet one small step at a time.
    if (next.value <= minValue + 0.004 && next.area > best.area) {
      best = { value: minValue, area: next.area, x: sx, y: sy };
    }
  };
  const xStart = Math.max(8, Math.floor(boxW * 0.74));
  const yStart = Math.max(8, Math.floor(boxH * 0.74));
  for (let sy = yStart; sy <= boxH; sy += 2) consider(boxW, sy);
  for (let sx = xStart; sx <= boxW; sx += 2) {
    for (let sy = yStart; sy <= boxH; sy += 2) consider(sx, sy);
  }
  consider(boxW, boxH);
  for (let sy = Math.max(yStart, best.y - 3); sy <= Math.min(boxH, best.y + 3); sy += 1) {
    for (let sx = Math.max(xStart, best.x - 3); sx <= Math.min(boxW, best.x + 3); sx += 1) consider(sx, sy);
  }
  // A flat sheet scores near zero. A jagged hex or running-bond sheet can sit higher and
  // still beat tiling the outer rectangle, which is what leaves grey blocks in the notches.
  const fullSheet = score(boxW, boxH);
  const coarseNests = best.x < boxW - 1 || best.y < boxH - 1;
  const coarseOk = best.value < 0.12 || (coarseNests && best.value < 0.36 && best.value + 0.05 < fullSheet.value);
  if (!coarseOk) return null;
  const fullBox = fullResolutionAlphaBox(data, width, height);
  if (!fullBox) return null;
  // The coarse period is in downscaled pixels. Full-res search stays within ±2 of those steps.
  const refined = refineFullResolutionRepeat(data, width, fullBox, best.x * factor, best.y * factor, factor);
  const refinedNests = !!refined && (refined.x < fullBox.width - 1 || refined.y < fullBox.height - 1);
  const refinedOk = !!refined && (refined.value < 0.12 || (refinedNests && refined.value < 0.36 && refined.value + 0.05 < refined.fullValue));
  if (!refined || !refinedOk) return null;
  const originX = Math.floor((fullBox.width - refined.x) / 2);
  const originY = Math.floor((fullBox.height - refined.y) / 2);
  const coreW = refined.x;
  const coreH = refined.y;
  if (coreW < 8 || coreH < 8 || originX < 0 || originY < 0) return null;
  return {
    box: fullBox,
    core: { x: fullBox.x + originX, y: fullBox.y + originY, width: coreW, height: coreH },
    pitchFractionX: coreW / fullBox.width,
    pitchFractionY: coreH / fullBox.height,
  };
}

/**
 * Drops straight, full-length grey grout that was baked into a sheet photo.
 * Marble veins are irregular and stay. Bright or warm metal strips (gold aluminum)
 * are not grey, so they stay too. Cleared pixels become transparent so the next
 * sheet's tiles can slide into the joint instead of stacking on a grey line.
 * Returns how many pixels were cleared.
 */
export function clearBakedSheetGrout(data: Uint8Array, width: number, height: number): number {
  if (width < 24 || height < 24 || data.length < width * height * 4) return 0;
  const count = width * height;
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 180));
  const lums: number[] = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4;
      if (data[index + 3]! < 200) continue;
      lums.push((data[index]! + data[index + 1]! + data[index + 2]!) / 3);
    }
  }
  if (lums.length < 24) return 0;
  lums.sort((a, b) => a - b);
  const tileLum = lums[Math.floor(lums.length / 2)] ?? 0;
  const grey = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    const index = i * 4;
    if (data[index + 3]! < 200) continue;
    const red = data[index]!;
    const green = data[index + 1]!;
    const blue = data[index + 2]!;
    const lum = (red + green + blue) / 3;
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    // Dark and neutral. A gold strip is warmer and much closer to the marble.
    if (spread <= 40 && lum <= tileLum - 55 && lum >= 20) grey[i] = 1;
  }
  const qual = new Uint8Array(height);
  for (let y = 0; y < height; y += 1) {
    let opaque = 0;
    let grout = 0;
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (data[(row + x) * 4 + 3]! < 200) continue;
      opaque += 1;
      grout += grey[row + x]!;
    }
    if (opaque >= width * 0.4 && grout >= opaque * 0.55) qual[y] = 1;
  }
  const maxThick = Math.max(16, Math.round(height * 0.015));
  const bands: Array<[number, number]> = [];
  let y = 0;
  while (y < height) {
    if (!qual[y]) { y += 1; continue; }
    const start = y;
    while (y < height && qual[y]) y += 1;
    if (y - start >= 2 && y - start <= maxThick) bands.push([start, y - 1]);
  }
  let cleared = 0;
  const clearAt = (pixel: number) => {
    if (!grey[pixel]) return;
    const index = pixel * 4;
    if (data[index + 3]! < 16) return;
    data[index + 3] = 0;
    grey[pixel] = 0;
    cleared += 1;
  };
  for (const [y0, y1] of bands) {
    for (let rowY = y0; rowY <= y1; rowY += 1) {
      const row = rowY * width;
      for (let x = 0; x < width; x += 1) clearAt(row + x);
    }
  }
  const cuts = [0, height];
  for (const [y0, y1] of bands) cuts.push(y0, y1 + 1);
  cuts.sort((a, b) => a - b);
  for (let cut = 0; cut < cuts.length - 1; cut += 1) {
    const y0 = cuts[cut]!;
    const y1 = cuts[cut + 1]!;
    if (y0 === y1 || y1 - y0 < 24) continue;
    const slabHeight = y1 - y0;
    const opaqueCount = new Uint32Array(width);
    const groutCount = new Uint32Array(width);
    for (let rowY = y0; rowY < y1; rowY += 1) {
      const row = rowY * width;
      for (let x = 0; x < width; x += 1) {
        if (data[(row + x) * 4 + 3]! < 200 && !grey[row + x]) continue;
        if (data[(row + x) * 4 + 3]! >= 200) opaqueCount[x]! += 1;
        groutCount[x]! += grey[row + x]!;
      }
    }
    const column = new Uint8Array(width);
    for (let x = 0; x < width; x += 1) {
      const opaque = opaqueCount[x]!;
      if (opaque >= slabHeight * 0.5 && groutCount[x]! >= opaque * 0.65) column[x] = 1;
    }
    let x = 0;
    while (x < width) {
      if (!column[x]) { x += 1; continue; }
      const start = x;
      while (x < width && column[x]) x += 1;
      const thick = x - start;
      if (thick < 2 || thick > 18) continue;
      for (let rowY = y0; rowY < y1; rowY += 1) {
        const row = rowY * width;
        for (let col = start; col < x; col += 1) clearAt(row + col);
      }
    }
  }
  return cleared;
}

/**
 * Copies neighbouring opaque colour into partial-alpha and clear pixels.
 * Alpha stays put. A transparent pixel stored as black otherwise becomes a dark
 * sliver once the texture is mipmapped or drawn by an opaque material.
 */
export function bleedTransparentEdgeColor(data: Uint8ClampedArray, width: number, height: number): void {
  const count = width * height;
  if (width < 2 || height < 2 || data.length < count * 4) return;
  const seen = new Uint8Array(count);
  const qx = new Int32Array(count);
  const qy = new Int32Array(count);
  let tail = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (data[index * 4 + 3]! < 250) continue;
      seen[index] = 1;
      qx[tail] = x;
      qy[tail] = y;
      tail += 1;
    }
  }
  if (tail === 0 || tail === count) return;
  let head = 0;
  while (head < tail) {
    const x = qx[head]!;
    const y = qy[head]!;
    head += 1;
    const source = (y * width + x) * 4;
    const red = data[source]!;
    const green = data[source + 1]!;
    const blue = data[source + 2]!;
    const push = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const index = ny * width + nx;
      if (seen[index]) return;
      seen[index] = 1;
      const dest = index * 4;
      data[dest] = red;
      data[dest + 1] = green;
      data[dest + 2] = blue;
      qx[tail] = nx;
      qy[tail] = ny;
      tail += 1;
    };
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
}

function channelHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

/** Median colour of the opaque chips. Used to fill a leftover notch, never as a grout line. */
export function sampleSheetTileHex(data: ArrayLike<number>, width: number, height: number): string | null {
  if (width < 8 || height < 8 || data.length < width * height * 4) return null;
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 96));
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4;
      if (data[index + 3]! < 250) continue;
      reds.push(data[index]!);
      greens.push(data[index + 1]!);
      blues.push(data[index + 2]!);
    }
  }
  if (reds.length < 24) return null;
  const mid = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  return `#${channelHex(mid(reds))}${channelHex(mid(greens))}${channelHex(mid(blues))}`;
}

/** Opaque grout color between the chips. Null when the sheet has no separate grout pixels. */
export function sampleSheetGroutHex(data: ArrayLike<number>, width: number, height: number): string | null {
  if (width < 8 || height < 8 || data.length < width * height * 4) return null;
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 96));
  const lums: number[] = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4;
      if (data[index + 3]! < 200) continue;
      lums.push((data[index]! + data[index + 1]! + data[index + 2]!) / 3);
    }
  }
  if (lums.length < 24) return null;
  lums.sort((a, b) => a - b);
  const mid = lums[Math.floor(lums.length / 2)]!;
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4;
      if (data[index + 3]! < 200) continue;
      const lum = (data[index]! + data[index + 1]! + data[index + 2]!) / 3;
      const grout = mid >= 140 ? lum < mid - 36 && lum > 20 : lum > mid + 36 && lum < 250;
      if (!grout) continue;
      reds.push(data[index]!);
      greens.push(data[index + 1]!);
      blues.push(data[index + 2]!);
    }
  }
  if (reds.length < 12) return null;
  const channel = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  const hex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${hex(channel(reds))}${hex(channel(greens))}${hex(channel(blues))}`;
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
