/**
 * Fake transparency checkerboards on Designer sheet photos.
 *
 * A mosaic sheet exported from an editor often has the transparency grid baked
 * in as opaque gray/white squares. Repeating that photo paints a box around
 * every sheet. This module finds that grid when the file has no real alpha,
 * clears the border-connected squares, and trims to the opaque sheet.
 * Catalog photos and room scenes do not use it.
 */

export const MOSAIC_NO_TRANSPARENCY_WARNING =
  "This image has no transparency - mosaic edges may show seams";

export type RgbaImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type CheckerboardCleanup = {
  /** True when a border-connected checkerboard was cleared and the sheet was trimmed. */
  cleaned: boolean;
  /** Set when the file is fully opaque and no checkerboard was found. */
  warning: string | null;
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type Rgb = { r: number; g: number; b: number };

const NEUTRAL_SPREAD = 24;
const LIGHT_MIN = 170;
const COLOR_TOLERANCE = 30;
const MIN_COLOR_GAP = 28;

function luminance(r: number, g: number, b: number) {
  return (r + g + b) / 3;
}

function spread(r: number, g: number, b: number) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function channelDistance(r: number, g: number, b: number, color: Rgb) {
  return Math.max(Math.abs(r - color.r), Math.abs(g - color.g), Math.abs(b - color.b));
}

function hasRealAlpha(data: Uint8ClampedArray, pixelCount: number) {
  const limit = Math.max(24, Math.floor(pixelCount * 0.002));
  let transparent = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index]! < 128) {
      transparent += 1;
      if (transparent > limit) return true;
    }
  }
  return false;
}

function untouched(image: RgbaImage, warning: string | null): CheckerboardCleanup {
  return { cleaned: false, warning, width: image.width, height: image.height, data: image.data };
}

function medianChannel(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function medianColor(pixels: Array<[number, number, number]>): Rgb {
  return {
    r: medianChannel(pixels.map((pixel) => pixel[0])),
    g: medianChannel(pixels.map((pixel) => pixel[1])),
    b: medianChannel(pixels.map((pixel) => pixel[2])),
  };
}

/** Square size of a two-color run along one edge. Null when the edge is not a regular grid. */
function cellSizeFromLabels(labels: Array<"A" | "B" | null>): number | null {
  const runs: number[] = [];
  let current: "A" | "B" | null = null;
  let length = 0;
  const push = () => {
    if (current && length >= 4) runs.push(length);
  };
  for (const label of labels) {
    if (label === null) {
      push();
      current = null;
      length = 0;
      continue;
    }
    if (label === current) length += 1;
    else {
      push();
      current = label;
      length = 1;
    }
  }
  push();
  if (runs.length < 4) return null;
  const sorted = [...runs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  if (median < 4 || median > 48) return null;
  const stable = runs.filter((run) => Math.abs(run - median) <= 1).length;
  return stable / runs.length >= 0.45 ? median : null;
}

/**
 * Clears a baked-in transparency checkerboard.
 * A plain opaque photo is returned unchanged with `MOSAIC_NO_TRANSPARENCY_WARNING`.
 * An image that already has real alpha is returned unchanged and without a warning.
 */
export function removeBakedCheckerboard(image: RgbaImage): CheckerboardCleanup {
  const { data, width, height } = image;
  const pixelCount = width * height;
  if (width < 16 || height < 16 || data.length < pixelCount * 4) return untouched(image, null);
  if (hasRealAlpha(data, pixelCount)) return untouched(image, null);

  const border: Array<[number, number, number]> = [];
  const borderCount = width * 2 + Math.max(0, height - 2) * 2;
  const consider = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    const r = data[index]!;
    const g = data[index + 1]!;
    const b = data[index + 2]!;
    if (spread(r, g, b) <= NEUTRAL_SPREAD && luminance(r, g, b) >= LIGHT_MIN) border.push([r, g, b]);
  };
  for (let x = 0; x < width; x += 1) {
    consider(x, 0);
    consider(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    consider(0, y);
    consider(width - 1, y);
  }
  if (border.length < borderCount * 0.55) return untouched(image, MOSAIC_NO_TRANSPARENCY_WARNING);

  const lums = border.map((pixel) => luminance(pixel[0], pixel[1], pixel[2])).sort((a, b) => a - b);
  const low = lums[Math.floor(lums.length * 0.2)] ?? 0;
  const high = lums[Math.floor(lums.length * 0.8)] ?? 0;
  if (high - low < MIN_COLOR_GAP) return untouched(image, MOSAIC_NO_TRANSPARENCY_WARNING);
  const split = (low + high) / 2;
  const darkPixels = border.filter((pixel) => luminance(pixel[0], pixel[1], pixel[2]) < split);
  const lightPixels = border.filter((pixel) => luminance(pixel[0], pixel[1], pixel[2]) >= split);
  if (darkPixels.length < border.length * 0.15 || lightPixels.length < border.length * 0.15) {
    return untouched(image, MOSAIC_NO_TRANSPARENCY_WARNING);
  }
  const dark = medianColor(darkPixels);
  const light = medianColor(lightPixels);
  if (spread(dark.r, dark.g, dark.b) > 18 || spread(light.r, light.g, light.b) > 18) {
    return untouched(image, MOSAIC_NO_TRANSPARENCY_WARNING);
  }
  if (luminance(light.r, light.g, light.b) - luminance(dark.r, dark.g, dark.b) < MIN_COLOR_GAP) {
    return untouched(image, MOSAIC_NO_TRANSPARENCY_WARNING);
  }

  const labelAt = (x: number, y: number): "A" | "B" | null => {
    const index = (y * width + x) * 4;
    const r = data[index]!;
    const g = data[index + 1]!;
    const b = data[index + 2]!;
    if (spread(r, g, b) > NEUTRAL_SPREAD || luminance(r, g, b) < LIGHT_MIN) return null;
    const toDark = channelDistance(r, g, b, dark);
    const toLight = channelDistance(r, g, b, light);
    if (Math.min(toDark, toLight) > COLOR_TOLERANCE) return null;
    return toDark <= toLight ? "A" : "B";
  };

  const edgeLabels = (along: "row" | "column", at: number) => {
    const count = along === "row" ? width : height;
    const labels: Array<"A" | "B" | null> = [];
    for (let index = 0; index < count; index += 1) {
      labels.push(along === "row" ? labelAt(index, at) : labelAt(at, index));
    }
    return labels;
  };
  const cellCandidates = [
    cellSizeFromLabels(edgeLabels("row", 0)),
    cellSizeFromLabels(edgeLabels("row", height - 1)),
    cellSizeFromLabels(edgeLabels("column", 0)),
    cellSizeFromLabels(edgeLabels("column", width - 1)),
  ].filter((size): size is number => size != null);
  if (cellCandidates.length === 0) return untouched(image, MOSAIC_NO_TRANSPARENCY_WARNING);
  cellCandidates.sort((a, b) => a - b);
  const cell = cellCandidates[Math.floor(cellCandidates.length / 2)]!;
  const distances = [cell - 1, cell, cell + 1].filter((distance) => distance >= 4);

  const flips = (x: number, y: number, axis: "x" | "y") => {
    const label = labelAt(x, y);
    if (!label) return false;
    const other = label === "A" ? "B" : "A";
    for (const distance of distances) {
      const steps = axis === "x" ? [[distance, 0], [-distance, 0]] : [[0, distance], [0, -distance]];
      for (const [dx, dy] of steps) {
        const nextX = x + dx!;
        const nextY = y + dy!;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
        if (labelAt(nextX, nextY) === other) return true;
      }
    }
    return false;
  };

  const alternating = new Uint8Array(pixelCount);
  let alternatingCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (labelAt(x, y) && flips(x, y, "x") && flips(x, y, "y")) {
        alternating[y * width + x] = 1;
        alternatingCount += 1;
      }
    }
  }
  if (alternatingCount < pixelCount * 0.01) return untouched(image, MOSAIC_NO_TRANSPARENCY_WARNING);

  const mask = alternating.slice();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * width + x;
      if (mask[offset]) continue;
      const index = offset * 4;
      const r = data[index]!;
      const g = data[index + 1]!;
      const b = data[index + 2]!;
      if (spread(r, g, b) > 22 || luminance(r, g, b) < 175) continue;
      const nearGrid = labelAt(x, y) != null || Math.abs(luminance(r, g, b) - (luminance(dark.r, dark.g, dark.b) + luminance(light.r, light.g, light.b)) / 2) <= 40;
      if (!nearGrid) continue;
      if (
        (x > 0 && alternating[offset - 1]) ||
        (x + 1 < width && alternating[offset + 1]) ||
        (y > 0 && alternating[offset - width]) ||
        (y + 1 < height && alternating[offset + width])
      ) mask[offset] = 1;
    }
  }

  const seed = new Uint8Array(pixelCount);
  const onBorder = (x: number, y: number) => x <= 2 || y <= 2 || x >= width - 3 || y >= height - 3;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!onBorder(x, y) || labelAt(x, y) == null) continue;
      const alongX = y <= 2 || y >= height - 3;
      const alongY = x <= 2 || x >= width - 3;
      if ((alongX && flips(x, y, "x")) || (alongY && flips(x, y, "y")) || alternating[y * width + x] || mask[y * width + x]) {
        seed[y * width + x] = 1;
        mask[y * width + x] = 1;
      }
    }
  }

  const removed = new Uint8Array(pixelCount);
  const queue: number[] = [];
  let head = 0;
  const enqueue = (offset: number) => {
    if (removed[offset] || !mask[offset]) return;
    removed[offset] = 1;
    queue.push(offset);
  };
  for (let offset = 0; offset < pixelCount; offset += 1) if (seed[offset]) enqueue(offset);
  while (head < queue.length) {
    const offset = queue[head++]!;
    const x = offset % width;
    const y = (offset - x) / width;
    if (x > 0) enqueue(offset - 1);
    if (x + 1 < width) enqueue(offset + 1);
    if (y > 0) enqueue(offset - width);
    if (y + 1 < height) enqueue(offset + width);
  }

  let borderHit = 0;
  for (let x = 0; x < width; x += 1) {
    if (removed[x]) borderHit += 1;
    if (removed[(height - 1) * width + x]) borderHit += 1;
  }
  for (let y = 1; y < height - 1; y += 1) {
    if (removed[y * width]) borderHit += 1;
    if (removed[y * width + width - 1]) borderHit += 1;
  }
  const removedCount = queue.length;
  if (borderHit < borderCount * 0.6 || removedCount < pixelCount * 0.02 || removedCount > pixelCount * 0.85) {
    return untouched(image, MOSAIC_NO_TRANSPARENCY_WARNING);
  }

  // One-pixel neutral specks left between squares (compression blends) follow the cleared grid.
  for (let pass = 0; pass < 2; pass += 1) {
    const extra: number[] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = y * width + x;
        if (removed[offset]) continue;
        const touches =
          (x > 0 && removed[offset - 1]) ||
          (x + 1 < width && removed[offset + 1]) ||
          (y > 0 && removed[offset - width]) ||
          (y + 1 < height && removed[offset + width]);
        if (!touches) continue;
        const index = offset * 4;
        const r = data[index]!;
        const g = data[index + 1]!;
        const b = data[index + 2]!;
        if (spread(r, g, b) > 16 || luminance(r, g, b) < 175) continue;
        if (channelDistance(r, g, b, dark) <= COLOR_TOLERANCE + 4 || channelDistance(r, g, b, light) <= COLOR_TOLERANCE + 4) {
          extra.push(offset);
        }
      }
    }
    for (const offset of extra) removed[offset] = 1;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (removed[y * width + x]) continue;
      opaque += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || opaque < pixelCount * 0.12) return untouched(image, MOSAIC_NO_TRANSPARENCY_WARNING);
  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  const trimmed = new Uint8ClampedArray(trimmedWidth * trimmedHeight * 4);
  for (let y = 0; y < trimmedHeight; y += 1) {
    for (let x = 0; x < trimmedWidth; x += 1) {
      const source = ((y + minY) * width + (x + minX)) * 4;
      const target = (y * trimmedWidth + x) * 4;
      if (removed[(y + minY) * width + (x + minX)]) continue;
      trimmed[target] = data[source]!;
      trimmed[target + 1] = data[source + 1]!;
      trimmed[target + 2] = data[source + 2]!;
      trimmed[target + 3] = 255;
    }
  }
  return { cleaned: true, warning: null, width: trimmedWidth, height: trimmedHeight, data: trimmed };
}

export function isPelicanTileOrMosaicItem(item: { category?: string | null; subCategory?: string | null; name?: string | null } | null | undefined) {
  const category = `${item?.category ?? ""} ${item?.subCategory ?? ""}`.toLowerCase();
  if (/\btiles?\b|\bmosaics?\b/.test(category)) return true;
  return /\bmosaic\b/.test((item?.name ?? "").toLowerCase());
}

type CanvasSource = CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };

const cleanedSheetCache = new WeakMap<object, HTMLCanvasElement | null>();

function sourcePixelSize(source: CanvasSource) {
  const width = Number(source.naturalWidth || source.width || 0);
  const height = Number(source.naturalHeight || source.height || 0);
  return { width, height };
}

/** Reads a canvas or image. Returns null when the canvas is tainted or unavailable. */
export function readDrawableRgba(source: CanvasSource): RgbaImage | null {
  if (typeof document === "undefined") return null;
  const { width, height } = sourcePixelSize(source);
  if (!width || !height) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, width, height);
    return { data: context.getImageData(0, 0, width, height).data, width, height };
  } catch {
    return null;
  }
}

export function drawableHasTransparency(source: CanvasSource): boolean {
  const pixels = readDrawableRgba(source);
  if (!pixels) return false;
  for (let index = 3; index < pixels.data.length; index += 4) {
    if (pixels.data[index]! < 250) return true;
  }
  return false;
}

/**
 * Cached checkerboard cleanup for a texture that is already loaded.
 * Returns null when the image is unchanged (real alpha, no checkerboard, or unreadable).
 */
export function canvasWithoutBakedCheckerboard(source: CanvasSource): HTMLCanvasElement | null {
  if (typeof document === "undefined" || source == null) return null;
  const cached = cleanedSheetCache.get(source);
  if (cached !== undefined) return cached;
  const pixels = readDrawableRgba(source);
  if (!pixels) {
    cleanedSheetCache.set(source, null);
    return null;
  }
  const cleaned = removeBakedCheckerboard(pixels);
  if (!cleaned.cleaned) {
    cleanedSheetCache.set(source, null);
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = cleaned.width;
  canvas.height = cleaned.height;
  const context = canvas.getContext("2d");
  if (!context) {
    cleanedSheetCache.set(source, null);
    return null;
  }
  context.putImageData(new ImageData(cleaned.data, cleaned.width, cleaned.height), 0, 0);
  cleanedSheetCache.set(source, canvas);
  return canvas;
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The photo could not be read."));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be read."))), "image/png");
  });
}

export type DesignerTileUploadPrep = {
  cleaned: boolean;
  warning: string | null;
  previewDataUrl: string | null;
  pngBlob: Blob | null;
};

/** Designer/material uploads of tile and mosaic items. Catalog and room-scene files are not passed here. */
export async function prepareDesignerTileUpload(file: Blob): Promise<DesignerTileUploadPrep> {
  const unchanged = { cleaned: false, warning: null, previewDataUrl: null, pngBlob: null };
  if (typeof document === "undefined") return unchanged;
  try {
    const image = await loadImageElement(file);
    const pixels = readDrawableRgba(image);
    if (!pixels) return unchanged;
    const cleaned = removeBakedCheckerboard(pixels);
    if (!cleaned.cleaned) return { ...unchanged, warning: cleaned.warning };
    const canvas = document.createElement("canvas");
    canvas.width = cleaned.width;
    canvas.height = cleaned.height;
    const context = canvas.getContext("2d");
    if (!context) return { ...unchanged, warning: cleaned.warning };
    context.putImageData(new ImageData(cleaned.data, cleaned.width, cleaned.height), 0, 0);
    const pngBlob = await canvasToPngBlob(canvas);
    return {
      cleaned: true,
      warning: null,
      previewDataUrl: canvas.toDataURL("image/png"),
      pngBlob,
    };
  } catch {
    return unchanged;
  }
}
