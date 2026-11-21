/**
 * Base end open shelf (BES12 and Cabinet Config `curved-open-shelf`).
 *
 * The catalog graphic type already names this form: an open, doorless end
 * unit with a quarter-round front corner on the exposed side, a finished
 * closed side against the neighboring run, a top, a bottom deck, a recessed
 * toe kick, and the configured number of interior shelves. It is not a BA/BEC
 * angled end cabinet and must never inherit that family's doors or 45° face.
 *
 * The BES12 spec drawing is 12"W × 24"D × 34½"H with three interior shelves
 * (five horizontal surfaces counting the top and the bottom deck). Price,
 * availability, and the sellable SKU are never changed here.
 */

export type CurvedOpenShelfLike = {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  graphicType?: string | null;
  customProfile?: string | null;
  fixedShelfCount?: number | null;
  numberOfFixedShelves?: number | null;
  width?: unknown;
  depth?: unknown;
};

export function curvedOpenShelfCode(source: string | null | undefined): string {
  return `${source ?? ""}`.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function profileToken(value: string | null | undefined): string {
  return `${value ?? ""}`.trim().toLowerCase().replace(/_/g, "-");
}

/** Cabinet Config / placed-cabinet graphic for this open curved end unit. */
export function hasCurvedOpenShelfGraphic(cabinet: CurvedOpenShelfLike): boolean {
  return profileToken(cabinet.graphicType) === "curved-open-shelf"
    || profileToken(cabinet.customProfile) === "curved-open-shelf";
}

/**
 * True for a base end open shelf — the BES family and any row whose Cabinet
 * Config graphic is `curved-open-shelf`, or whose description names a base end
 * shelf / open curved end unit. A BA24 / BEC24 angled end is not this.
 */
export function isCurvedOpenShelfCabinet(cabinet: CurvedOpenShelfLike): boolean {
  const code = curvedOpenShelfCode(cabinet.masterCode);
  const hay = `${cabinet.description ?? ""} ${cabinet.subCategory ?? ""}`.toLowerCase();
  // Wall open-end shelves (OE / WEOS) share the curved-open-shelf graphic on
  // some rows but are a different, wall-mounted family.
  if (/^OE\d+$/.test(code) || /^W(?:E)?OS\d+$/.test(code)) return false;
  if (/\bopen\s+end\s+shelf\s+wall\b|\bwall\s+(?:end\s+)?open\s+shelf\b/.test(hay)) return false;
  if (hasCurvedOpenShelfGraphic(cabinet)) return true;
  if (/base end (?:corner|angle)(?!\s+shelf)/.test(hay) && !/end shelf|open curved/.test(hay)) {
    return false;
  }
  if (/^BES\d+$/.test(code) && /end shelf|open curved/.test(hay)) return true;
  return /base end shelf|\bopen curved\b/.test(hay);
}

/**
 * Interior fixed shelves, not counting the top or the bottom deck.
 *
 * Authority: the cabinet's own edit config, then the BES source drawing (3).
 * A configured 0 stays 0.
 */
export function curvedOpenShelfShelfCount(cabinet: CurvedOpenShelfLike): {
  count: number;
  source: "config" | "bes-source" | "none";
} {
  const configured = Number(cabinet.fixedShelfCount ?? cabinet.numberOfFixedShelves);
  if (Number.isFinite(configured) && configured >= 0) {
    return { count: Math.min(8, Math.round(configured)), source: "config" };
  }
  const code = curvedOpenShelfCode(cabinet.masterCode);
  if (/^BES\d+$/.test(code) || hasCurvedOpenShelfGraphic(cabinet)) {
    return { count: 3, source: "bes-source" };
  }
  return { count: 0, source: "none" };
}

/**
 * Quarter-round radius of the open front corner, in inches. On the BES12
 * drawing the radius equals the cabinet width (12"), so the front is a true
 * quarter circle and the 24" depth is a 12" straight closed-side run plus
 * that arc.
 */
export function curvedOpenShelfRadiusIn(widthIn: number, depthIn: number): number {
  const width = Number(widthIn);
  const depth = Number(depthIn);
  if (!(width > 0) || !(depth > 0)) return 0;
  return Math.min(width, depth);
}

/** An open end shelf never has a door or a drawer face. */
export function curvedOpenShelfFaceCounts(): { doors: number; drawers: number } {
  return { doors: 0, drawers: 0 };
}
