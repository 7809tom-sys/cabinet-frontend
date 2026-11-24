/**
 * Flat center of a photographed shaker door. The stiles, rails and bevel sit
 * outside this window. Image coordinates, origin at the top-left.
 * About 40% of the width and 70% of the height.
 */
export const WOOD_PANEL_WINDOW = { x: 0.3, y: 0.15, width: 0.4, height: 0.7 } as const;

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

function fraction(value: number) {
  return value - Math.floor(value);
}

/**
 * One crop of the center panel for a single piece.
 *
 * The crop's aspect matches the piece, so the grain is stretched onto that
 * piece once instead of being tiled. A long piece takes a taller (or, for a
 * rail, a longer) strip inside the same frame-free window. `salt` slides the
 * crop so neighboring doors are not the same patch. Nothing here repeats.
 */
export function woodPanelPieceCrop(
  widthIn: number,
  heightIn: number,
  grain: "vertical" | "horizontal",
  salt = 0,
) {
  const win = WOOD_PANEL_WINDOW;
  const pieceW = Math.max(widthIn, 0.5);
  const pieceH = Math.max(heightIn, 0.5);
  // A rail turns the crop a quarter turn, so the crop itself is tall when the
  // rail is long. Image aspect is width / height.
  const aspect = grain === "horizontal" ? pieceH / pieceW : pieceW / pieceH;
  const winAspect = win.width / win.height;
  let cropW: number;
  let cropH: number;
  if (aspect >= winAspect) {
    cropW = win.width;
    cropH = win.width / aspect;
  } else {
    cropH = win.height;
    cropW = win.height * aspect;
  }
  // Leave a little of the window unused so each piece can sit on a different
  // patch. The aspect stays the piece's aspect.
  const inset = 0.84;
  cropW = Math.min(win.width, Math.max(0.05, cropW * inset));
  cropH = Math.min(win.height, Math.max(0.05, cropH * inset));
  const slackX = Math.max(0, win.width - cropW);
  const slackY = Math.max(0, win.height - cropH);
  const x = win.x + slackX * fraction(salt * 0.618033 + 0.11);
  const y = win.y + slackY * fraction(salt * 0.414214 + 0.37);
  return {
    x,
    y,
    width: cropW,
    height: cropH,
    rotation: grain === "horizontal" ? Math.PI / 2 : 0,
  };
}

/** Bottom-left UV for one clamped copy of `woodPanelPieceCrop`. Repeat never exceeds 1. */
export function woodPanelPieceUv(
  widthIn: number,
  heightIn: number,
  grain: "vertical" | "horizontal",
  salt = 0,
) {
  const crop = woodPanelPieceCrop(widthIn, heightIn, grain, salt);
  return {
    offsetX: crop.x,
    offsetY: 1 - crop.y - crop.height,
    repeatX: crop.width,
    repeatY: crop.height,
    rotation: crop.rotation,
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

/**
 * The photograph is one door. Fifteen inches across the picture is the nominal
 * real width; the height follows the photo's own aspect. The center window is
 * that fraction of the door, so one tile is the same wood the door shows, not
 * a stretched slice. Door and drawer pieces do not use this scale.
 */
export const WOOD_PHOTO_DOOR_WIDTH_IN = 15;

export const WOOD_LARGE_FACE_ANISOTROPY = 16;

export function woodPanelSampleInches(imageWidth: number, imageHeight: number) {
  const doorWidth = WOOD_PHOTO_DOOR_WIDTH_IN;
  const doorHeight = doorWidth * (imageHeight / Math.max(1, imageWidth));
  return {
    width: doorWidth * WOOD_PANEL_WINDOW.width,
    height: doorHeight * WOOD_PANEL_WINDOW.height,
  };
}

export type LargeFaceGrain = "vertical" | "along-length";

type Vec3 = { x: number; y: number; z: number };

function fractionOf(value: number) {
  return value - Math.floor(value);
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

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
 * Inches on a face, across the grain (u) and along it (v).
 * A horizontal face (top or bottom) runs the grain along cabinet width.
 */
export function woodGrainAxes(normal: Vec3, grain: "vertical" | "horizontal"): { along: Vec3; across: Vec3 } {
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

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return cross(sub(b, a), sub(c, a));
}

function projectSpan(points: Vec3[], axis: Vec3) {
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const value = dot(point, axis);
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max, span: max - min };
}

/**
 * Large wood faces only: carcass sides, end panels, tops, bottoms, fillers, toe kicks.
 * Door, drawer, rail, stile, and face-frame pieces stay on the clamped crop.
 */
export function largeWoodFaceGrain(userData: Record<string, unknown> | null | undefined): LargeFaceGrain | null {
  if (!userData) return null;
  if (
    userData.cabinetFaceFrame
    || userData.cabinetFront
    || userData.physicalRail
    || userData.grainPiece
    || userData.cabinetDrawerFront
    || userData.falseDrawerFront
    || userData.shakerNotch
    || userData.shakerFrameOutline
    || userData.cabinetHardware
    || userData.decorativeEndIsDoor
    || userData.lCornerDoor
    || userData.selectionOnly
    || userData.glassCabinetDoor
    || userData.refrigeratorNeutralShell
    || userData.neutralApplianceSidesAndTop
  ) return null;
  if (
    userData.baseToeKick
    || userData.floorStandingToeKick
    || userData.selectedToeKickFinishSkin
    || userData.baseFillerFace
    || userData.installedFillerFrontAligned
    || userData.ovenTowerFiller
    || userData.fullOwnerEnvelopeFiller
    || userData.angledWallMiteredFiller
    || userData.angledWallTransitionFiller
  ) return "along-length";
  if (
    userData.selectedStyleSideSkin
    || userData.selectedFinishSideSkin
    || userData.decorativeEndPanel
    || userData.decorativeEndToFloor
    || userData.cabinetSideToFloor
    || userData.carcassShell
    || userData.refrigeratorEndPanel
    || userData.selectedFinishStructuralSurface
  ) return "vertical";
  return null;
}

function axesForFace(normal: Vec3, grain: LargeFaceGrain, points: Vec3[]) {
  if (Math.abs(normalise(normal).y) > 0.65) return woodGrainAxes(normal, "vertical");
  if (grain === "vertical") return woodGrainAxes(normal, "vertical");
  const vertical = woodGrainAxes(normal, "vertical");
  const horizontal = woodGrainAxes(normal, "horizontal");
  return projectSpan(points, vertical.along).span >= projectSpan(points, horizontal.along).span
    ? vertical
    : horizontal;
}

/**
 * UVs for one non-indexed triangle list, in inches.
 *
 * Along the grain, one tile is `sample.height` inches (the center of the door
 * photo). The returned V covers a mirrored pair, so a full 0–1 cycle is two
 * tiles and a repeat meets itself. Across the grain, V stays inside 0–1: a
 * face wider than the tile uses the whole crop once and is never mirrored.
 */
export function largeFacePositionUvs(
  pointsInches: Vec3[],
  grain: LargeFaceGrain,
  sample: { width: number; height: number },
  salt = 0,
): Array<{ u: number; v: number }> {
  const uvs = pointsInches.map(() => ({ u: 0, v: 0 }));
  const groups = new Map<string, number[]>();
  for (let index = 0; index + 2 < pointsInches.length; index += 3) {
    const normal = faceNormal(pointsInches[index]!, pointsInches[index + 1]!, pointsInches[index + 2]!);
    if (lengthOf(normal) < 1e-8) continue;
    const unit = normalise(normal);
    const key = `${Math.round(unit.x * 10)},${Math.round(unit.y * 10)},${Math.round(unit.z * 10)}`;
    const list = groups.get(key) ?? [];
    list.push(index, index + 1, index + 2);
    groups.set(key, list);
  }
  for (const indices of groups.values()) {
    const normal = faceNormal(
      pointsInches[indices[0]!]!,
      pointsInches[indices[1]!]!,
      pointsInches[indices[2]!]!,
    );
    const points = indices.map((index) => pointsInches[index]!);
    const { along, across } = axesForFace(normal, grain, points);
    const alongSpan = projectSpan(points, along);
    const acrossSpan = projectSpan(points, across);
    const faceSalt = fractionOf(salt + normalise(normal).x * 0.17 + normalise(normal).y * 0.41 + normalise(normal).z * 0.73 + 0.05);
    const tile = Math.max(sample.height, 0.5);
    const acrossTile = Math.max(sample.width, 0.5);
    const useFullCrop = acrossSpan.span > acrossTile + 1e-6;
    const acrossUsed = useFullCrop ? 1 : Math.min(1, acrossSpan.span / acrossTile);
    const acrossOffset = useFullCrop ? 0 : (1 - acrossUsed) * fractionOf(faceSalt * 0.618033 + 0.17);
    for (const index of indices) {
      const point = pointsInches[index]!;
      const alongIn = dot(point, along) - alongSpan.min;
      const acrossIn = dot(point, across) - acrossSpan.min;
      const u = useFullCrop
        ? (acrossSpan.span > 1e-6 ? acrossIn / acrossSpan.span : 0)
        : acrossOffset + acrossIn / acrossTile;
      // The texture is the crop plus its mirror, so one V unit is two tiles.
      const v = alongIn / (tile * 2) + faceSalt;
      uvs[index] = {
        u: Math.min(1, Math.max(0, u)),
        v,
      };
    }
  }
  return uvs;
}

/**
 * Full-resolution center of the door photo, then the same crop flipped along
 * the grain. The join is the same row of pixels on both sides, so repeating
 * it does not draw a seam. Nothing here is mirrored across the grain.
 */
export function largeFaceGrainCanvas(image: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement | null {
  if (typeof document === "undefined" || image.width < 4 || image.height < 4) return null;
  const rect = woodPanelSourceRect(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height * 2;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  context.save();
  context.translate(0, canvas.height);
  context.scale(1, -1);
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  context.restore();
  return canvas;
}

/** One aspect-matched copy of the center grain. Rails are already turned. */
export function pieceGrainCanvas(
  image: CanvasImageSource & { width: number; height: number },
  widthIn: number,
  heightIn: number,
  grain: "vertical" | "horizontal",
  salt = 0,
): HTMLCanvasElement | null {
  if (typeof document === "undefined" || image.width < 4 || image.height < 4) return null;
  const crop = woodPanelPieceCrop(widthIn, heightIn, grain, salt);
  const sx = Math.round(image.width * crop.x);
  const sy = Math.round(image.height * crop.y);
  const sw = Math.max(1, Math.round(image.width * crop.width));
  const sh = Math.max(1, Math.round(image.height * crop.height));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  if (grain === "horizontal") {
    canvas.width = sh;
    canvas.height = sw;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(-Math.PI / 2);
    context.drawImage(image, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  } else {
    canvas.width = sw;
    canvas.height = sh;
    context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  }
  return canvas;
}
