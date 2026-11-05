/**
 * The WalzCraft wizard's color model.
 *
 * Two independent wheels, both from Sherwin-Williams' published data:
 *   - stain: light maple to dark smoke over the published stain colors, keeping the grain
 *   - paint: light to dark over the published paint chips, opaque solid
 *
 * A pick produces the hex/grain save the door editor already understands (PR 225):
 *   renderHex      the chosen hex
 *   woodSpecies    the grain name for a stain, null for paint
 *   grainDirection the grain direction for a stain, "none" for paint
 *
 * Nothing here snaps a color onto the brand palette. The chosen Sherwin-Williams hex is
 * sent exactly as published (paint) or exactly as measured from the published swatch (stain).
 */
import { type GrainOrientation, type MatchSavePatch } from "./wizardDoorMatch";
import { colorNamePosition, positionForHex } from "./colorNamePosition";
import {
  SHERWIN_WILLIAMS_PAINT_COLORS,
  SHERWIN_WILLIAMS_PAINT_SOURCE,
  exactPaintHex,
  normalizePaintCode,
  nearestPaintColor,
  paintAtPosition,
  paintColorByCode,
  paintLabel,
  paintPositionOf,
  paintLightness,
  type SherwinWilliamsPaintColor,
} from "./sherwinWilliamsPaint";
import {
  PAINT_FINISH,
  SHERWIN_WILLIAMS_STAIN_WHEEL,
  SHERWIN_WILLIAMS_STAINS,
  STAIN_FINISH,
  STAIN_WHEEL_ENDS,
  normalizeStainCode,
  nearestStain,
  stainAtPosition,
  stainByCode,
  stainLabel,
  stainLightness,
  stainPositionOf,
  type SherwinWilliamsStain,
  type WizardFinish,
} from "./sherwinWilliamsStain";

export {
  PAINT_FINISH,
  STAIN_FINISH,
  STAIN_WHEEL_ENDS,
  SHERWIN_WILLIAMS_PAINT_SOURCE,
  type WizardFinish,
  type SherwinWilliamsStain,
  type SherwinWilliamsPaintColor,
};

export const SHERWIN_WILLIAMS_ATTRIBUTION =
  `Stain and paint colors, names and codes come from Sherwin-Williams' published data. Paint hexes: ${SHERWIN_WILLIAMS_PAINT_SOURCE.document} (${SHERWIN_WILLIAMS_PAINT_SOURCE.url}). Stain hexes are measured from the swatch image each published Sherwin-Williams stain page serves.`;

export type WizardColorKey =
  | { finish: typeof STAIN_FINISH; code: string }
  | { finish: typeof PAINT_FINISH; code: string };

export type WizardColor =
  | {
      finish: typeof STAIN_FINISH;
      hex: string;
      code: string;
      name: string;
      /** Display label: `MW230 Early American`. */
      label: string;
      /** Stain keeps the grain. */
      keepsGrain: true;
      source: string;
    }
  | {
      finish: typeof PAINT_FINISH;
      hex: string;
      code: string;
      name: string;
      /** Display label: `SW 7005 Pure White`. */
      label: string;
      /** Paint is an opaque solid. */
      keepsGrain: false;
      source: string;
    };

function stainColor(stain: SherwinWilliamsStain): WizardColor {
  return {
    finish: STAIN_FINISH,
    hex: stain.hex,
    code: stain.code,
    name: stain.name,
    label: stainLabel(stain),
    keepsGrain: true,
    source: stain.page,
  };
}

function paintColor(color: SherwinWilliamsPaintColor): WizardColor {
  return {
    finish: PAINT_FINISH,
    hex: color.hex,
    code: color.code,
    name: color.name,
    label: paintLabel(color),
    keepsGrain: false,
    source: SHERWIN_WILLIAMS_PAINT_SOURCE.url,
  };
}

/** Stain at a 0..1 slider position, lightest published stain first. */
export function stainAt(position: number): WizardColor {
  return stainColor(stainAtPosition(position));
}

/** Paint at a 0..1 slider position, lightest published chip first. */
export function paintAt(position: number): WizardColor {
  return paintColor(paintAtPosition(position));
}

export function wizardColorByStainCode(value: string | null | undefined): WizardColor | null {
  const stain = stainByCode(value);
  return stain ? stainColor(stain) : null;
}

export function wizardColorByPaintCode(value: string | null | undefined): WizardColor | null {
  const color = paintColorByCode(value);
  return color ? paintColor(color) : null;
}

/** Look up either wheel from one typed value. Stain codes are tried before paint codes. */
export function wizardColorByCode(value: string | null | undefined): WizardColor | null {
  return wizardColorByStainCode(value) ?? wizardColorByPaintCode(value);
}

/**
 * Where a chosen color sits on its wheel, 0..1.
 *
 * A published chip code is exact. A brand color has no chip code, so this used to
 * return the start of the wheel and the marker jumped to an extreme. It now falls
 * back to the color's own hex (the nearest published chip) and finally to a
 * position inferred from its name. The color itself is never changed.
 */
export function wizardColorPosition(color: WizardColor | null): number {
  if (!color) return 0;
  if (color.finish === STAIN_FINISH) {
    const stain = stainByCode(color.code);
    if (stain) return stainPositionOf(stain);
    const byHex = positionForHex(color.hex, (hex) => {
      const hit = nearestStain(hex);
      return hit ? stainPositionOf(hit.stain) : null;
    });
    if (byHex != null) return byHex;
    return colorNamePosition(color.name, "stain") ?? 0.5;
  }
  const paint = paintColorByCode(color.code);
  if (paint) return paintPositionOf(paint);
  const byHex = positionForHex(color.hex, (hex) => {
    const hit = nearestPaintColor(hex);
    return hit ? paintPositionOf(hit) : null;
  });
  if (byHex != null) return byHex;
  return colorNamePosition(color.name, "paint") ?? 0.5;
}

export function wizardColorLightness(color: WizardColor): number {
  if (color.finish === STAIN_FINISH) {
    const stain = stainByCode(color.code);
    return stain ? stainLightness(stain) : 0;
  }
  const paint = paintColorByCode(color.code);
  return paint ? paintLightness(paint) : 0;
}

export const STAIN_WHEEL_SIZE = SHERWIN_WILLIAMS_STAIN_WHEEL.length;
export const PAINT_WHEEL_SIZE = SHERWIN_WILLIAMS_PAINT_COLORS.length;
export const STAIN_COUNT = SHERWIN_WILLIAMS_STAINS.length;

/**
 * Typed SW chip code, e.g. `SW 7005`, `sw7005`, `7005`.
 * Returns the published chip, or a plain "not published" result so the box can say so.
 */
export type PaintCodeResult =
  | { found: true; color: WizardColor; code: string }
  | { found: false; code: string; message: string };

export function readPaintCodeInput(value: string): PaintCodeResult {
  const code = normalizePaintCode(value);
  if (!code) {
    return { found: false, code: (value ?? "").trim(), message: "Type a Sherwin-Williams chip code such as SW 7005." };
  }
  const color = paintColorByCode(code);
  if (!color) {
    return { found: false, code, message: `${code} is not in the published Sherwin-Williams chart. No color is assumed.` };
  }
  return { found: true, color: paintColor(color), code };
}

/** Typed stain code, e.g. `MW230`. */
export function readStainCodeInput(value: string): PaintCodeResult {
  const code = normalizeStainCode(value);
  if (!code) {
    return { found: false, code: (value ?? "").trim(), message: "Type a Sherwin-Williams stain code such as MW230." };
  }
  const stain = stainByCode(code);
  if (!stain) {
    return { found: false, code, message: `${code} is not on a published Sherwin-Williams stain page. No color is assumed.` };
  }
  return { found: true, color: stainColor(stain), code };
}

/**
 * The save the door editor already performs.
 *
 * A stain keeps the grain: the wizard's grain name and direction are carried through.
 * Paint is an opaque solid: no wood species and grainDirection "none", which is the same
 * shape the existing doorStyles update accepts.
 */
export function wizardSavePatch(color: WizardColor, grain: { name: string | null; orientation: GrainOrientation | null } | null): MatchSavePatch | null {
  const hex = exactPaintHex(color.hex);
  if (!hex) return null;
  if (color.finish === PAINT_FINISH) {
    return { renderHex: hex, woodSpecies: null, grainDirection: "none" };
  }
  const name = grain?.name ?? null;
  if (!name) return null;
  return { renderHex: hex, woodSpecies: name, grainDirection: grain?.orientation ?? "vertical" };
}
