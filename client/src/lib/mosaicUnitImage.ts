import { GENERIC_MOSAIC_GROUT_COLOR, mosaicInterlockUnitPlan, mosaicPitchIn, type MosaicInterlockSpec } from "./backsplashMosaic";
import { canvasWithoutBakedCheckerboard, drawableHasTransparency } from "./mosaicCheckerboard";
import { analyzeMosaicPhoto, measureTransparentSheetRepeat, measuredMosaicOverhangIn, sampleSheetGroutHex, type MosaicPhotoAnalysis } from "./mosaicPhotoAnalysis";

export type MosaicUnitImage = {
  image: HTMLCanvasElement;
  analysis: MosaicPhotoAnalysis;
  /** Overhang measured from this photo, or null when the detection was implausible and the spec estimate was used. */
  measuredOverhangIn: { overhangXIn: number; overhangYIn: number } | null;
  /**
   * Inches of one nested repeat, when the photo itself was measured. The 3D view
   * repeats the unit at this pitch. Null when the spec estimate was kept.
   */
  measuredRepeatIn: { x: number; y: number } | null;
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
    const pixels = probeContext.getImageData(0, 0, width, height).data;
    const analysis = analyzeMosaicPhoto(pixels, width, height);
    if (!analysis) return null;
    // A measured spec already knows the sheet period as a fraction of this photo's content box.
    // The coverage rectangle is the overlap of staggered rows, which is smaller than that period
    // and would double a row of chips if it were used as the repeat.
    const photoRepeat = !item.measured && transparentSheet ? measureTransparentSheetRepeat(pixels, width, height) : null;
    const repeatCore = item.measured
      ? null
      : photoRepeat
        ? { x: photoRepeat.core.x - analysis.box.x, y: photoRepeat.core.y - analysis.box.y, width: photoRepeat.core.width, height: photoRepeat.core.height }
        : null;
    const measured = item.measured || photoRepeat
      ? null
      : measuredMosaicOverhangIn(analysis, item.outerWidthIn, item.outerHeightIn);
    // Plan inside the border-free box. A measured sheet or a nested transparent photo supplies the
    // repeat rectangle. Otherwise a plausible coverage core wins, then the spec estimate.
    const plan = mosaicInterlockUnitPlan(
      item, analysis.box.width, analysis.box.height, maxUnitPx,
      repeatCore && repeatCore.width > 0 && repeatCore.height > 0
        ? repeatCore
        : measured
          ? { x: analysis.core.x - analysis.box.x, y: analysis.core.y - analysis.box.y, width: analysis.core.width, height: analysis.core.height }
          : null,
    );
    const nestCore = {
      x: analysis.box.x + plan.source.x,
      y: analysis.box.y + plan.source.y,
      width: plan.source.width,
      height: plan.source.height,
    };
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    // Generic sheets ship with a neutral grey. On a transparent upload that grey is the notch
    // fill, so sample the sheet's own grout instead of painting grey blocks.
    const sampledGrout = transparentSheet && (!item.groutColor || item.groutColor === GENERIC_MOSAIC_GROUT_COLOR)
      ? sampleSheetGroutHex(pixels, width, height)
      : null;
    const groutFill = sampledGrout ?? item.groutColor ?? "#8a8782";
    context.fillStyle = groutFill;
    if (transparentSheet) {
      // Gaps in a transparent sheet are grout. Ragged ends are drawn into the neighbor's recesses
      // so a linear interlock does not get a straight cut through every strip. The rectangle is the
      // real repeat, not the coverage overlap, so a notch is filled by the next sheet's finger.
      context.fillRect(0, 0, plan.width, plan.height);
      drawNestedTransparentSheet(context, prepared, width, height, nestCore, plan.width, plan.height);
    } else {
      context.drawImage(
        prepared,
        nestCore.x, nestCore.y, nestCore.width, nestCore.height,
        0, 0, plan.width, plan.height,
      );
      context.fillStyle = groutFill;
      context.fillRect(0, 0, plan.width, plan.groutYPx);
      context.fillRect(plan.width - plan.groutXPx, 0, plan.groutXPx, plan.height);
    }
    const repeatIn = item.measured
      ? mosaicPitchIn(item)
      : photoRepeat
        ? {
            x: Math.round(item.outerWidthIn * (photoRepeat.core.width / Math.max(1, photoRepeat.box.width)) * 10000) / 10000,
            y: Math.round(item.outerHeightIn * (photoRepeat.core.height / Math.max(1, photoRepeat.box.height)) * 10000) / 10000,
          }
        : null;
    const measuredOverhangIn = item.measured
      ? { overhangXIn: item.overhangXIn, overhangYIn: item.overhangYIn }
      : photoRepeat
        ? {
            overhangXIn: Math.round((item.outerWidthIn - (repeatIn?.x ?? item.outerWidthIn)) * 1000) / 1000,
            overhangYIn: Math.round((item.outerHeightIn - (repeatIn?.y ?? item.outerHeightIn)) * 1000) / 1000,
          }
        : measured;
    return { image: canvas, analysis, measuredOverhangIn, measuredRepeatIn: repeatIn };
  } catch {
    return null;
  }
}
