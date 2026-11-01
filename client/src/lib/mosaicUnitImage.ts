import { mosaicInterlockUnitPlan, type MosaicInterlockSpec } from "./backsplashMosaic";
import { canvasWithoutBakedCheckerboard, drawableHasTransparency } from "./mosaicCheckerboard";
import { analyzeMosaicPhoto, measuredMosaicOverhangIn, type MosaicPhotoAnalysis } from "./mosaicPhotoAnalysis";

export type MosaicUnitImage = {
  image: HTMLCanvasElement;
  analysis: MosaicPhotoAnalysis;
  /** Overhang measured from this photo, or null when the detection was implausible and the spec estimate was used. */
  measuredOverhangIn: { overhangXIn: number; overhangYIn: number } | null;
};

/** One pitch of a transparent sheet: flush core, with neighbour fingers drawn into the edge recesses. */
function drawNestedTransparentSheet(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  core: { x: number; y: number; width: number; height: number },
  destWidth: number,
  destHeight: number,
) {
  if (core.width < 1 || core.height < 1) return;
  const scaleX = destWidth / core.width;
  const scaleY = destHeight / core.height;
  const draw = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) => {
    if (sw < 1 || sh < 1) return;
    context.drawImage(source, sx, sy, sw, sh, dx, dy, sw * scaleX, sh * scaleY);
  };
  const coreRight = core.x + core.width;
  const coreBottom = core.y + core.height;
  draw(core.x, core.y, core.width, core.height, 0, 0);
  draw(coreRight, 0, sourceWidth - coreRight, sourceHeight, 0, -core.y * scaleY);
  draw(0, 0, core.x, sourceHeight, (core.width - core.x) * scaleX, -core.y * scaleY);
  draw(core.x, coreBottom, core.width, sourceHeight - coreBottom, 0, 0);
  draw(core.x, 0, core.width, core.y, 0, (core.height - core.y) * scaleY);
}

/**
 * Builds the one repeating unit of any mosaic straight from its product photo: the photo border is found and cut
 * away automatically, the flush repeat is measured from the sheet itself, and one even grout line is painted along
 * the unit's top and right edge. A transparent sheet is drawn over a grout fill instead, so the gaps read as grout.
 * Returns null (caller keeps its fallback) when the photo cannot be read or analysed, for example a cross-origin
 * image that taints the canvas.
 */
export function buildMosaicUnitImage(
  source: HTMLImageElement | HTMLCanvasElement,
  item: MosaicInterlockSpec,
  maxUnitPx: number,
): MosaicUnitImage | null {
  if (typeof document === "undefined") return null;
  const prepared = canvasWithoutBakedCheckerboard(source) ?? source;
  const width = (prepared as HTMLImageElement).naturalWidth || prepared.width;
  const height = (prepared as HTMLImageElement).naturalHeight || prepared.height;
  if (!width || !height) return null;
  const transparentSheet = drawableHasTransparency(prepared);
  try {
    const probe = document.createElement("canvas");
    probe.width = width;
    probe.height = height;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    if (!probeContext) return null;
    probeContext.drawImage(prepared, 0, 0, width, height);
    const analysis = analyzeMosaicPhoto(probeContext.getImageData(0, 0, width, height).data, width, height);
    if (!analysis) return null;
    const measured = measuredMosaicOverhangIn(analysis, item.outerWidthIn, item.outerHeightIn);
    // Plan inside the border-free box. With a plausible measurement the unit is the measured flush core;
    // otherwise the box is cropped by the spec's estimated overhang.
    const plan = mosaicInterlockUnitPlan(
      item, analysis.box.width, analysis.box.height, maxUnitPx,
      measured ? { x: analysis.core.x - analysis.box.x, y: analysis.core.y - analysis.box.y, width: analysis.core.width, height: analysis.core.height } : null,
    );
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    context.fillStyle = item.groutColor ?? "#8a8782";
    if (transparentSheet) {
      // Gaps in a transparent sheet are grout. Ragged ends are drawn into the neighbor's recesses
      // so a linear interlock does not get a straight cut through every strip.
      context.fillRect(0, 0, plan.width, plan.height);
      drawNestedTransparentSheet(context, prepared, width, height, analysis.core, plan.width, plan.height);
    } else {
      context.drawImage(
        prepared,
        analysis.box.x + plan.source.x, analysis.box.y + plan.source.y, plan.source.width, plan.source.height,
        0, 0, plan.width, plan.height,
      );
      context.fillStyle = item.groutColor ?? "#8a8782";
      context.fillRect(0, 0, plan.width, plan.groutYPx);
      context.fillRect(plan.width - plan.groutXPx, 0, plan.groutXPx, plan.height);
    }
    return { image: canvas, analysis, measuredOverhangIn: measured };
  } catch {
    return null;
  }
}
