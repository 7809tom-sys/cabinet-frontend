/**
 * A photographed shaker door includes its own stiles, rails and bevel. The 3D
 * view already builds that frame, so the photograph must not be drawn on the
 * face. This window is the flat center panel only (inside the bevel).
 * Fractions of the source image.
 */
/**
 * Image coordinates, origin at the top-left. The flat panel of the Oxford
 * Toffee door and of its drawer photo both sit inside this window. The
 * stiles, rails and bevel sit outside it.
 */
export const WOOD_PANEL_WINDOW = { x: 0.3, y: 0.24, width: 0.4, height: 0.52 } as const;

/**
 * Inches of real wood inside WOOD_PANEL_WINDOW on a typical door photograph
 * (about a 15 in x 30 in door). Repeats use this so a wide drawer is not a
 * stretched copy of a tall door.
 */
export const WOOD_PANEL_SAMPLE_IN = { width: 9, height: 18 } as const;

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

/** How many times the center-panel sample covers a piece, without stretching. */
export function woodPanelGrainRepeat(widthIn: number, heightIn: number, grain: "vertical" | "horizontal") {
  const across = Math.max(0.25, widthIn / WOOD_PANEL_SAMPLE_IN.width);
  const along = Math.max(0.25, heightIn / WOOD_PANEL_SAMPLE_IN.height);
  if (grain === "horizontal") {
    // The photo's grain runs with the image height. A quarter turn lays it
    // along the rail. Repeat stays in inches, so the rail is not squashed.
    return {
      repeatX: Math.max(0.25, widthIn / WOOD_PANEL_SAMPLE_IN.height),
      repeatY: Math.max(0.25, heightIn / WOOD_PANEL_SAMPLE_IN.width),
      rotation: Math.PI / 2,
    };
  }
  return { repeatX: across, repeatY: along, rotation: 0 };
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
