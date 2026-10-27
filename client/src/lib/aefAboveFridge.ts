/**
 * Frameless (AEF / AltaEuro Spec Book V8.2) wall heights have no 42" cabinet.
 * The sold 40" class is the 40 1/4" box (nominal "40"). The cabinet that tops
 * out with that run, including above a refrigerator, is the 22 5/8" box
 * (nominal "23"): prefer the 24"-deep W<w>2324, otherwise the 13 1/2"-deep W<w>23.
 *
 * 42" is a framed height. It must not be treated as this class.
 * Spec: wall heights PDF pp. 43–45 / printed pp. 25–27; 24"-deep refrigerator
 * walls in 12 / 15 / 18 / 23 heights, PDF pp. 46–48 / printed pp. 28–30.
 */
export const FRAMELESS_FORTY_WALL_HEIGHT_IN = 40.25;
export const FRAMELESS_ABOVE_FRIDGE_HEIGHT_IN = 22.625;
/** 24" deep first, then the standard 13 1/2" wall. */
export const FRAMELESS_ABOVE_FRIDGE_DEPTHS_IN = [24, 13.5] as const;

const FORTY_MATCH_TOLERANCE_IN = 0.3;

export function isFramelessFortyWallHeight(height: number | null | undefined): boolean {
  if (height == null || !Number.isFinite(height)) return false;
  // 40 and 40.25 are the same sold class. 42 is a different, framed height.
  if (Math.abs(height - 42) <= 0.05) return false;
  return Math.abs(height - FRAMELESS_FORTY_WALL_HEIGHT_IN) <= FORTY_MATCH_TOLERANCE_IN
    || Math.abs(height - 40) <= 0.05;
}

/** The above-fridge box height for a frameless 40" run, or null for every other line. */
export function framelessAboveFridgeHeight(wallHeightIn: number | null | undefined): number | null {
  return isFramelessFortyWallHeight(wallHeightIn) ? FRAMELESS_ABOVE_FRIDGE_HEIGHT_IN : null;
}
