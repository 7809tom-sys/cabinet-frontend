import { mosaicInterlockUnitPlan, mosaicPitchIn, type MosaicInterlockSpec } from "./backsplashMosaic";
import { canvasWithoutBakedCheckerboard } from "./mosaicCheckerboard";
import {
  analyzeMosaicPhoto, bleedTransparentEdgeColor, clearBakedSheetGrout, imageHasMeaningfulTransparency, measureTransparentSheetRepeat,
  runningBondSeams,
  trimTransparentEdgeSlivers,
  measuredMosaicOverhangIn, sampleSheetTileHex, type MosaicPhotoAnalysis, type TransparentSheetRepeat,
} from "./mosaicPhotoAnalysis";

/** Hand-coded pitch is a sanity bound. A real stagger can sit inside a generic full-size spec. */
const REPEAT_SANITY_FRACTION = 0.28;

export function transparentRepeatInches(item: MosaicInterlockSpec, repeat: TransparentSheetRepeat) {
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return {
    x: round(item.outerWidthIn * (repeat.core.width / Math.max(1, repeat.box.width))),
    y: round(item.outerHeightIn * (repeat.core.height / Math.max(1, repeat.box.height))),
  };
}

/** A measured transparent period wins when it nests near the spec. Otherwise the spec stays the backup. */
export function acceptTransparentRepeat(item: MosaicInterlockSpec, repeat: TransparentSheetRepeat | null): TransparentSheetRepeat | null {
  if (!repeat || !(repeat.box.width > 0) || !(repeat.box.height > 0) || !(repeat.core.width > 0) || !(repeat.core.height > 0)) return null;
  const measured = transparentRepeatInches(item, repeat);
  const backup = mosaicPitchIn(item);
  const axis = (value: number, expected: number, outer: number) =>
    value > 0
    && value <= outer * 1.02
    && value >= outer * 0.7
    && Math.abs(value - expected) <= Math.max(0.35, expected * REPEAT_SANITY_FRACTION);
  if (!axis(measured.x, backup.x, item.outerWidthIn) || !axis(measured.y, backup.y, item.outerHeightIn)) return null;
  return repeat;
}

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
 * the unit's top and right edge. A transparent Designer upload is measured even when the coverage pass finds no
 * flush core, and its notches are filled with chip colour rather than grey or the spec's grout. Returns null
 * (caller keeps its fallback) when the photo cannot be read, for example a cross-origin image that taints the canvas.
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
  try {
    const probe = document.createElement("canvas");
    probe.width = width;
    probe.height = height;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    if (!probeContext) return null;
    probeContext.drawImage(prepared, 0, 0, width, height);
    const pixels = probeContext.getImageData(0, 0, width, height).data;
    const transparentSheet = imageHasMeaningfulTransparency(pixels, width, height);
    // Photo grout is a straight grey joint. Clearing it lets stepped ends slide together
    // and keeps that grey from sitting under the Designer's own grout line. Opaque catalog
    // photos are not transparent, so they skip this and keep the old crop.
    if (transparentSheet) {
      // A 1px semi-transparent halo at the top or bottom repeats as a bright line.
      trimTransparentEdgeSlivers(pixels, width, height);
      clearBakedSheetGrout(pixels, width, height);
    }
    const analysis = analyzeMosaicPhoto(pixels, width, height);
    // Every transparent Designer upload is measured, including sheets whose hand-coded spec
    // is already marked measured. The spec pitch is only the backup when this score is poor.
    const photoRepeat = transparentSheet ? measureTransparentSheetRepeat(pixels, width, height) : null;
    const accepted = transparentSheet ? acceptTransparentRepeat(item, photoRepeat) : null;
    if (!analysis && !accepted) return null;
    const sheetBox = accepted?.box ?? analysis?.box;
    if (!sheetBox) return null;
    const measured = !accepted && analysis && !item.measured
      ? measuredMosaicOverhangIn(analysis, item.outerWidthIn, item.outerHeightIn)
      : null;
    const repeatCore = accepted
      ? {
          x: accepted.core.x - sheetBox.x,
          y: accepted.core.y - sheetBox.y,
          width: accepted.core.width,
          height: accepted.core.height,
        }
      : measured && analysis
        ? { x: analysis.core.x - analysis.box.x, y: analysis.core.y - analysis.box.y, width: analysis.core.width, height: analysis.core.height }
        : null;
    const plan = mosaicInterlockUnitPlan(
      item, sheetBox.width, sheetBox.height, maxUnitPx,
      repeatCore && repeatCore.width > 0 && repeatCore.height > 0 ? repeatCore : null,
    );
    const nestCore = {
      x: sheetBox.x + plan.source.x,
      y: sheetBox.y + plan.source.y,
      width: plan.source.width,
      height: plan.source.height,
    };
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    let drawSource: CanvasImageSource = prepared;
    if (transparentSheet) {
      bleedTransparentEdgeColor(pixels, width, height);
      probeContext.putImageData(new ImageData(pixels, width, height), 0, 0);
      drawSource = probe;
    }
    const groutLine = item.groutColor ?? "#8a8782";
    if (transparentSheet) {
      // Notches are the next sheet's fingers. A leftover clear pixel takes the chip colour.
      // Grey #8a8782 and a spec's dark grout are the joint line only, never the notch fill.
      // The sheet seam is not a bar around the rectangle: on a running bond it follows each row's brick end.
      const tileFill = sampleSheetTileHex(pixels, width, height);
      const blocked = tileFill?.toLowerCase() === "#8a8782" || tileFill?.toLowerCase() === (item.groutColor ?? "").toLowerCase();
      if (tileFill && !blocked) {
        context.fillStyle = tileFill;
        context.fillRect(0, 0, plan.width, plan.height);
      }
      drawNestedTransparentSheet(context, drawSource, width, height, nestCore, plan.width, plan.height);
      const seams = runningBondSeams(pixels, width, height);
      if (seams && nestCore.width > 0) {
        const scaleX = plan.width / nestCore.width;
        const scaleY = plan.height / nestCore.height;
        const thickness = Math.max(1, plan.groutXPx);
        context.fillStyle = groutLine;
        for (const row of seams) {
          const wrapped = ((row.seamX - nestCore.x) % nestCore.width + nestCore.width) % nestCore.width;
          const x = Math.round(wrapped * scaleX - thickness / 2);
          const y0 = Math.max(0, Math.round((row.y0 - nestCore.y) * scaleY));
          const y1 = Math.min(plan.height, Math.round((row.y1 + 1 - nestCore.y) * scaleY));
          if (y1 <= y0) continue;
          context.fillRect(Math.max(0, x), y0, thickness, y1 - y0);
        }
      }
    } else {
      context.drawImage(
        drawSource,
        nestCore.x, nestCore.y, nestCore.width, nestCore.height,
        0, 0, plan.width, plan.height,
      );
      context.fillStyle = groutLine;
      context.fillRect(0, 0, plan.width, plan.groutYPx);
      context.fillRect(plan.width - plan.groutXPx, 0, plan.groutXPx, plan.height);
    }
    const repeatIn = accepted
      ? transparentRepeatInches(item, accepted)
      : item.measured
        ? mosaicPitchIn(item)
        : null;
    const measuredOverhangIn = accepted
      ? {
          overhangXIn: Math.round((item.outerWidthIn - (repeatIn?.x ?? item.outerWidthIn)) * 1000) / 1000,
          overhangYIn: Math.round((item.outerHeightIn - (repeatIn?.y ?? item.outerHeightIn)) * 1000) / 1000,
        }
      : item.measured
        ? { overhangXIn: item.overhangXIn, overhangYIn: item.overhangYIn }
        : measured;
    const resolvedAnalysis: MosaicPhotoAnalysis = analysis ?? {
      box: accepted!.box,
      core: accepted!.core,
      overhangXPx: Math.max(0, accepted!.box.width - accepted!.core.width),
      overhangYPx: Math.max(0, accepted!.box.height - accepted!.core.height),
      background: "transparent",
      frameLineTrimmed: false,
    };
    return { image: canvas, analysis: resolvedAnalysis, measuredOverhangIn, measuredRepeatIn: repeatIn };
  } catch {
    return null;
  }
}
