import { useEffect, useState } from "react";
import { mosaicPitchIn, mosaicSheetSpecFor } from "@/lib/backsplashMosaic";
import { parseBacksplashSheetInches } from "@/lib/backsplashProductMaterial";
import { buildMosaicUnitImage } from "@/lib/mosaicUnitImage";
import { mosaicFloorPatternDegrees, mosaicFloorPatternOrStraight, type MosaicFloorPattern } from "@/lib/mosaicFloorTile";
import { flooringPlanRotationLayerStyle } from "@/lib/flooringLayout";

export type MosaicFloorFieldInput = {
  imageUrl: string | null;
  name?: string | null;
  size?: string | null;
  category?: string | null;
  subCategory?: string | null;
  pattern: MosaicFloorPattern;
  pitchXIn: number;
  pitchYIn: number;
};

/** Sheet pitch for a mosaic floor, using the same continuous-field spec as the wall. */
export function mosaicFloorFieldPitch(input: {
  name?: string | null;
  size?: string | null;
  category?: string | null;
  subCategory?: string | null;
}): { x: number; y: number } {
  const sheet = parseBacksplashSheetInches(input);
  const spec = mosaicSheetSpecFor({
    name: input.name,
    widthIn: sheet.widthIn,
    heightIn: sheet.heightIn,
    patternKind: sheet.patternKind,
  });
  return spec ? mosaicPitchIn(spec) : { x: sheet.widthIn, y: sheet.heightIn };
}

/**
 * Repeating mosaic sheet for plan and elevation. The unit is the same seamless
 * sheet the 3D view builds. The parent rotates that repeat; sheet borders are
 * not drawn on top.
 */
export function MosaicFloorField({
  floor,
  widthPx,
  heightPx,
  pixelsPerInch,
  testId = "mosaic-floor-field",
}: {
  floor: MosaicFloorFieldInput;
  widthPx: number;
  heightPx: number;
  pixelsPerInch: number;
  testId?: string;
}) {
  const [repeatUrl, setRepeatUrl] = useState<string | null>(floor.imageUrl);
  useEffect(() => {
    if (!floor.imageUrl) {
      setRepeatUrl(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      const sheet = parseBacksplashSheetInches(floor);
      const spec = mosaicSheetSpecFor({
        name: floor.name,
        widthIn: sheet.widthIn,
        heightIn: sheet.heightIn,
        patternKind: sheet.patternKind,
      });
      const unit = spec ? buildMosaicUnitImage(image, spec, 512) : null;
      setRepeatUrl(unit ? unit.image.toDataURL("image/png") : floor.imageUrl);
    };
    image.onerror = () => {
      if (!cancelled) setRepeatUrl(floor.imageUrl);
    };
    image.src = floor.imageUrl;
    return () => {
      cancelled = true;
    };
  }, [floor.imageUrl, floor.name, floor.size, floor.category, floor.subCategory]);
  const pattern = mosaicFloorPatternOrStraight(floor.pattern);
  const degrees = mosaicFloorPatternDegrees(pattern);
  const layer = flooringPlanRotationLayerStyle(degrees, Math.max(widthPx, 1), Math.max(heightPx, 1));
  const tileW = Math.max(8, floor.pitchXIn * pixelsPerInch);
  const tileH = Math.max(8, floor.pitchYIn * pixelsPerInch);
  return (
    <div data-testid={testId} data-mosaic-floor-pattern={pattern} data-mosaic-floor-degrees={degrees} className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: layer.width,
          height: layer.height,
          transform: layer.transform,
          backgroundImage: repeatUrl ? `url("${repeatUrl}")` : undefined,
          backgroundRepeat: "repeat",
          backgroundSize: `${tileW}px ${tileH}px`,
        }}
      />
    </div>
  );
}
