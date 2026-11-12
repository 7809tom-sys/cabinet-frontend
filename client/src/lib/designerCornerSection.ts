/**
 * The Design Tool's Corner Cabinets section (Corner Base and Corner Wall tabs)
 * is the catalog source of truth for what counts as a corner cabinet. Auto
 * Design reads these same predicates so a normal Corner Base item is not
 * treated as a blind corner just because of a stored cornerType, and so a
 * Corner Wall diagonal can be seated above it.
 *
 * These match the classifiers in DesignTool.tsx (Corner tab): angled wall
 * ends and WD-* vanity walls stay out of Corner Wall; accessories, trim,
 * BA-* end-of-run bases, and undersized slivers stay out of Corner Base.
 */
import { isAngledWallCabinet, isCornerCabinet, isPlainBaseCode } from "./design";

export type CornerSectionCabinet = {
  masterCode: string;
  description?: string | null;
  subCategory?: string | null;
  placement?: string | null;
  width?: string | number | null;
  height?: string | number | null;
  isCornerCabinet?: boolean | null;
  cornerType?: string | null;
};

/**
 * A true blind corner from its master code only: BBC, WBC, BBL, BBR, WBL,
 * WBR, or BLIND in the code. A stored cornerType of "blind-corner" is not
 * enough — that is how a normal Corner Base was being misread as blind.
 */
export function isTrueBlindCornerCode(masterCode: string | null | undefined): boolean {
  const code = (masterCode || "").toUpperCase();
  if (!code || isPlainBaseCode(code)) return false;
  return /^(BBC|WBC|BBL|BBR|WBL|WBR)/.test(code) || /(?:-BLIND|BLIND)/.test(code);
}

/** Same rule as the Designer's dedicated "Corner Wall" section. */
export function isDesignerCornerWall(cabinet: CornerSectionCabinet): boolean {
  if (isAngledWallCabinet(cabinet.masterCode, cabinet.description || undefined)) return false;
  const code = (cabinet.masterCode || "").toUpperCase();
  // WD-* (tall 48"-60" diagonal corner wall cabinets) are vanity/bathroom
  // items — they do not belong in the Kitchen corner wall section.
  if (code.startsWith("WD-")) return false;
  const sub = (cabinet.subCategory || "").toLowerCase();
  return (
    cabinet.isCornerCabinet === true
    || sub.includes("corner")
    || isCornerCabinet(cabinet.masterCode, cabinet.description || undefined)
  );
}

/** Same rule as the Designer's dedicated "Corner Base" section. */
export function isDesignerCornerBase(cabinet: CornerSectionCabinet): boolean {
  const sub = (cabinet.subCategory || "").toLowerCase();
  const code = (cabinet.masterCode || "").toUpperCase();
  const placement = (cabinet.placement || "").toLowerCase();
  // A plain B/SB/DB/3DB code is never a corner, even if the Corner tab flag or
  // subcategory says otherwise. That is the same rule as isCornerCabinet.
  if (isPlainBaseCode(cabinet.masterCode)) return false;
  if (placement === "wall") return false;
  if (placement.includes("accessory") || placement.includes("trim")) return false;
  if (/trim|moulding|molding|end panel|hardware|filler|tray|floor/.test(sub)) return false;
  if (code.startsWith("BA-")) return false;
  if (/TRAY|FILLER|-FILL|CBT|DCFF|^CM-|^BCM|^OCM|^ACM|^RCM|^COV/.test(code)) return false;
  const width = Number(cabinet.width) || 0;
  const height = Number(cabinet.height) || 0;
  // Size gates match the Designer tab when dimensions are present. A catalog
  // row that has not yet published height must still be eligible, or Auto
  // Design would drop real Corner Base SKUs the palette already lists.
  if (width > 0 && width < 9) return false;
  if (height > 0 && height < 24) return false;
  return (
    cabinet.isCornerCabinet === true
    || sub.includes("corner")
    || sub.includes("lazy susan")
    || sub.includes("easy reach")
    || isCornerCabinet(cabinet.masterCode, cabinet.description || undefined)
  );
}

/** A Corner Wall item that can connect upper runs — not a wall blind. */
export function isDesignerCornerWallUpper(cabinet: CornerSectionCabinet): boolean {
  const placement = (cabinet.placement || "").toLowerCase();
  if (placement && placement !== "wall") return false;
  return isDesignerCornerWall(cabinet) && !isTrueBlindCornerCode(cabinet.masterCode);
}

/** A Corner Base item whose code is a true blind (BBC / BLIND). */
export function isDesignerTrueBlindCornerBase(cabinet: CornerSectionCabinet): boolean {
  return isDesignerCornerBase(cabinet) && isTrueBlindCornerCode(cabinet.masterCode);
}
