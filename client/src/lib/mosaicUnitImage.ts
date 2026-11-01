import { mosaicInterlockUnitPlan, type MosaicInterlockSpec } from "./backsplashMosaic";
import { analyzeMosaicPhoto, measuredMosaicOverhangIn, type MosaicPhotoAnalysis } from "./mosaicPhotoAnalysis";

export type MosaicUnitImage = {
  image: HTMLCanvasElement;
  analysis: MosaicPhotoAnalysis;
  /** Overhang measured from this photo, or null when the detection was implausible and the spec estimate was used. */
  measuredOverhangIn: { overhangXIn: number; overhangYIn: number } | null;
};

/**
 * Builds the one repeating unit of any mosaic straight from its product photo: the photo border is found and cut
 * away automatically, the flush repeat is measured from the sheet itself, and one even grout line is painted along
 * the unit's top and right edge. Returns null (caller keeps its fallback) when the photo cannot be read or analysed,
 * for example a cross-origin image that taints the canvas.
 */
export function buildMosaicUnitImage(
  source: HTMLImageElement | HTMLCanvasElement,
  item: MosaicInterlockSpec,
  maxUnitPx: number,
): MosaicUnitImage | null {
  if (typeof document === "undefined") return null;
  const width = (source as HTMLImageElement).naturalWidth || source.width;
  const height = (source as HTMLImageElement).naturalHeight || source.height;
  if (!width || !height) return null;
  try {
    const probe = document.createElement("canvas");
    probe.width = width;
    probe.height = height;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    if (!probeContext) return null;
    probeContext.drawImage(source, 0, 0, width, height);
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
    context.drawImage(
      source,
      analysis.box.x + plan.source.x, analysis.box.y + plan.source.y, plan.source.width, plan.source.height,
      0, 0, plan.width, plan.height,
    );
    context.fillStyle = item.groutColor ?? "#8a8782";
    context.fillRect(0, 0, plan.width, plan.groutYPx);
    context.fillRect(plan.width - plan.groutXPx, 0, plan.groutXPx, plan.height);
    return { image: canvas, analysis, measuredOverhangIn: measured };
  } catch {
    return null;
  }
}
