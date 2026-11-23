/**
 * Flat center of a photographed shaker door. The stiles, rails and bevel sit
 * outside this window. Image coordinates, origin at the top-left.
 * About 40% of the width and 70% of the height.
 */
export const WOOD_PANEL_WINDOW = { x: 0.3, y: 0.15, width: 0.4, height: 0.7 } as const;

/**
 * The photograph is one door. Fifteen inches across the picture is the nominal
 * real width; the height follows the photo's own aspect. The center window is
 * that fraction of the door, so one tile is real wood, not a stretched slice.
 */
export const WOOD_PHOTO_DOOR_WIDTH_IN = 15;

export const WOOD_PANEL_SAMPLE_IN = woodPanelSampleInches(15, 30);

/** Three.js UV origin is the bottom of the image when flipY is on. */
export function woodPanelPreviewUv() {
  return {
    offsetX: WOOD_PANEL_WINDOW.x,
    offsetY: 1 - WOOD_PANEL_WINDOW.y - WOOD_PANEL_WINDOW.height,
    repeatX: WOOD_PANEL_WINDOW.width,
    repeatY: WOOD_PANEL_WINDOW.height,
  };
}

export function woodPanelSourceRect(imageWidth: number, imageHeight: number) {
  const width = Math.max(1, Math.round(imageWidth * WOOD_PANEL_WINDOW.width));
  const height = Math.max(1, Math.round(imageHeight * WOOD_PANEL_WINDOW.height));
  const x = Math.min(Math.round(imageWidth * WOOD_PANEL_WINDOW.x), Math.max(0, imageWidth - width));
  const y = Math.min(Math.round(imageHeight * WOOD_PANEL_WINDOW.y), Math.max(0, imageHeight - height));
  return { x, y, width, height };
}

export function woodPanelSampleInches(imageWidth: number, imageHeight: number) {
  const doorWidth = WOOD_PHOTO_DOOR_WIDTH_IN;
  const doorHeight = doorWidth * (imageHeight / Math.max(1, imageWidth));
  return {
    width: doorWidth * WOOD_PANEL_WINDOW.width,
    height: doorHeight * WOOD_PANEL_WINDOW.height,
  };
}

export type WoodGrainAxis = "vertical" | "horizontal";

/** Drawer fronts, rails, toe kicks and fillers run the grain along their length. */
export function woodMeshGrain(userData: Record<string, unknown> | null | undefined): WoodGrainAxis {
  if (!userData) return "vertical";
  if (userData.grainPiece === "rail" || userData.grainPiece === "horizontal") return "horizontal";
  if (userData.cabinetDrawerFront || userData.falseDrawerFront) return "horizontal";
  if (userData.baseToeKick) return "horizontal";
  if (userData.baseFillerFace || userData.ovenTowerFiller) return "horizontal";
  return "vertical";
}

type Vec3 = { x: number; y: number; z: number };

function lengthOf(v: Vec3) {
  return Math.hypot(v.x, v.y, v.z);
}

function normalise(v: Vec3): Vec3 {
  const length = lengthOf(v) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function reject(v: Vec3, n: Vec3): Vec3 {
  const amount = dot(v, n);
  return { x: v.x - n.x * amount, y: v.y - n.y * amount, z: v.z - n.z * amount };
}

/**
 * Inches of a point on a face, in the texture's across-grain (u) and
 * along-grain (v) directions. Tops run the grain along the cabinet width.
 * The caller divides by the sample size, so every face shares one scale.
 */
export function woodGrainAxes(normal: Vec3, grain: WoodGrainAxis): { along: Vec3; across: Vec3 } {
  const n = normalise(normal);
  if (Math.abs(n.y) > 0.65) {
    return { along: { x: 1, y: 0, z: 0 }, across: { x: 0, y: 0, z: 1 } };
  }
  if (grain === "horizontal") {
    let along = cross({ x: 0, y: 1, z: 0 }, n);
    if (lengthOf(along) < 0.2) along = { x: 1, y: 0, z: 0 };
    along = normalise(along);
    return { along, across: normalise(cross(n, along)) };
  }
  let along = reject({ x: 0, y: 1, z: 0 }, n);
  if (lengthOf(along) < 0.2) along = { x: 1, y: 0, z: 0 };
  along = normalise(along);
  return { along, across: normalise(cross(n, along)) };
}

/**
 * Door and drawer pieces (the slab, the rails, the stiles, a drawer or false
 * front) take one crop. Sides, ends, tops, toe kicks and fillers are large
 * faces and tile along the grain.
 */
export function woodGrainFaceKind(userData: Record<string, unknown> | null | undefined): "piece" | "large" {
  if (!userData) return "large";
  if (userData.decorativeEndPanel || userData.refrigeratorEndPanel) return "large";
  if (userData.physicalRail || userData.cabinetDrawerFront || userData.falseDrawerFront) return "piece";
  if (userData.cabinetFront) return "piece";
  return "large";
}

/**
 * Inches of the center-panel photo that cover this piece at the photo's real
 * scale. A piece larger than the photo keeps its aspect and uses the largest
 * crop that still fits, so the grain is never stretched one way.
 */
export function woodPieceCropInches(
  pieceAcrossIn: number,
  pieceAlongIn: number,
  sample: { width: number; height: number } = WOOD_PANEL_SAMPLE_IN,
) {
  const across = Math.max(0.05, pieceAcrossIn);
  const along = Math.max(0.05, pieceAlongIn);
  const scale = Math.min(1, sample.width / across, sample.height / along);
  return { across: across * scale, along: along * scale, scale };
}

/** Top-left of a crop inside the center window. The salt slides it; it never leaves the window. */
export function woodPieceCropOrigin(
  rect: { x: number; y: number; width: number; height: number },
  cropWidth: number,
  cropHeight: number,
  salt: { u: number; v: number },
) {
  const slackX = Math.max(0, rect.width - cropWidth);
  const slackY = Math.max(0, rect.height - cropHeight);
  const u = Math.min(1, Math.max(0, salt.u));
  const v = Math.min(1, Math.max(0, salt.v));
  return {
    x: rect.x + Math.round(u * slackX),
    y: rect.y + Math.round(v * slackY),
  };
}

/**
 * One crop for a door or drawer piece. Horizontal grain is rotated so the
 * photo's vertical grain runs along the piece. Returns null without a canvas.
 */
export function woodPieceCropCanvas(
  image: CanvasImageSource & { width: number; height: number },
  pieceAcrossIn: number,
  pieceAlongIn: number,
  salt: { u: number; v: number },
  grain: WoodGrainAxis,
): HTMLCanvasElement | null {
  if (typeof document === "undefined" || image.width < 4 || image.height < 4) return null;
  const sample = woodPanelSampleInches(image.width, image.height);
  const rect = woodPanelSourceRect(image.width, image.height);
  const fitted = woodPieceCropInches(pieceAcrossIn, pieceAlongIn, sample);
  const cropW = Math.max(1, Math.min(rect.width, Math.round(fitted.across * (rect.width / sample.width))));
  const cropH = Math.max(1, Math.min(rect.height, Math.round(fitted.along * (rect.height / sample.height))));
  const origin = woodPieceCropOrigin(rect, cropW, cropH, salt);
  const canvas = document.createElement("canvas");
  const horizontal = grain === "horizontal";
  canvas.width = horizontal ? cropH : cropW;
  canvas.height = horizontal ? cropW : cropH;
  const context = canvas.getContext("2d");
  if (!context) return null;
  if (horizontal) {
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(Math.PI / 2);
    context.drawImage(image, origin.x, origin.y, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);
  } else {
    context.drawImage(image, origin.x, origin.y, cropW, cropH, 0, 0, cropW, cropH);
  }
  return canvas;
}

/** Stable 0–1 offsets so neighboring doors do not repeat the same figure. */
export function woodGrainPieceOffset(seed: string): { u: number; v: number } {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  const u = (hash >>> 0) / 4294967296;
  const v = (Math.imul(hash ^ 0x85ebca6b, 0xc2b2ae35) >>> 0) / 4294967296;
  return { u, v };
}

/**
 * Keep a piece that fits in one tile inside that tile, so the mirror repeat
 * never starts. A larger piece is shifted by a fraction of a tile.
 */
export function placeWoodGrainCoordinate(values: number[], salt: number): number[] {
  if (!values.length) return values;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span <= 1) {
    const start = Math.min(1, Math.max(0, salt)) * (1 - span);
    return values.map((value) => value - min + start);
  }
  const shift = Math.min(0.999, Math.max(0, salt));
  return values.map((value) => value + shift);
}

export function woodGrainUv(
  pointIn: Vec3,
  normal: Vec3,
  grain: WoodGrainAxis,
  sample = WOOD_PANEL_SAMPLE_IN,
  salt = 0,
) {
  const { along, across } = woodGrainAxes(normal, grain);
  return {
    u: dot(pointIn, across) / sample.width + salt,
    v: dot(pointIn, along) / sample.height + salt * 0.37,
  };
}

export function centerPanelGrainCanvas(image: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement | null {
  if (typeof document === "undefined" || image.width < 4 || image.height < 4) return null;
  const rect = woodPanelSourceRect(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return canvas;
}
