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
