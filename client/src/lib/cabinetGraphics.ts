// Pure helpers that map a cabinet record to a 2D drawing type, an SEO-friendly
// image slug, and descriptive alt text. Kept framework-free so it is unit-testable.
import { parseCatalogNomenclature } from "@shared/catalogNomenclature";

export type CabinetDrawingType =
  | "standard-door" // 1+ door box (base/wall/tall)
  | "drawer-base" // stacked drawer fronts
  | "microwave-base" // microwave opening over one configured drawer
  | "sink-base" // false tilt-out top panel + sink cutout indication
  | "appliance-garage" // tambour roll-up slats
  | "blind-corner" // L-shaped footprint (blind corner cabinets)
  | "diagonal-corner" // 45° room-corner front face (DCW, WDC, DCB, AG)
  | "wall-end-angle" // AW: regular wall-run end with one 45° exposed face
  | "l-corner" // L-shaped corner with doors on angled face (LS, ER, CSB)
  | "corner-drawer-base" // L-shaped corner with stacked drawers on the main face (CDB-*)
  | "vanity" // vanity door/drawer combo
  | "ada" // ADA-height unit
  | "lazy-susan-tray" // shelf-mounted Chrome Tray insert for ERB easy-reach cabinets
  | "wall-microwave-kit" // WMS: open wall microwave cabinet kit with shelf insert
  | "shelf-insert" // WMSSHELF: individual WMS kit shelf insert
  | "accessory-strip" // moldings, fillers, shelves (thin)
  | "panel" // flat panels: skin panels, end panels, plywood panels (grain direction)
  | "decorative-door" // decorative door panels: match door style, go on island backs / cabinet sides
  | "glass-door" // glass-front wall cabinet
  | "pantry" // tall pantry: 4 doors split at 54" (2 bottom, 2 top)
  | "oven-tall" // tall oven cabinet: 2 upper doors + appliance opening + drawers
  | "triangle-corner" // right-triangle corner cabinet (WTC/BTC): single door on hypotenuse face
  | "end-angle" // end-of-run cabinet with an angled outer face, not a room corner
  | "end-return" // 24x24 base end-corner with two 12-inch return faces, not a room corner
  | "range-hood-front" // RHF: shallow sloped two-door cabinet hood front, not a metal appliance
  | "face-pattern"; // specialty open-front cabinet with slats / criss-cross / lattice / open pattern

export interface CabinetLike {
  masterCode?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  isCornerCabinet?: boolean | null;
  placementType?: string | null;
  catalogImageUrl?: string | null;
  /** User-toggled in the design tool: render as open box with no door panels */
  noDoor?: boolean | null;
  /** Appliance opening position set in admin: 'top' | 'middle' | 'bottom' | null */
  openingType?: string | null;
  /** Door height in inches (used with openingType to calculate opening size) */
  doorHeight?: number | string | null;
  /** Drawer height in inches (height of each drawer front) */
  drawerHeight?: number | string | null;
  /** Door orientation: 'side-by-side' | 'stacked' | null */
  doorOrientation?: string | null;
  /** Corner type from admin config: 'triangle' | 'diagonal' | 'lazy-susan' | etc. */
  cornerType?: string | null;
  /** Explicit doors-per-row count for side-by-side rendering (null = auto) */
  doorsPerRow?: number | null;
  /** Drawer layout: 'stacked' (full-width, one above another) | 'side-by-side' (next to each other) | null */
  drawerLayout?: string | null;
  /** Oven type selected by user: 'single' | 'double' | null */
  ovenType?: "single" | "double" | null;
  /** Grain direction for panels: 'vertical' | 'horizontal' | null */
  grainDirection?: string | null;
  /** Whether this panel uses the door style image (decorative door panel) */
  isDecorativeDoor?: boolean | null;
  /** Face pattern for specialty open-front cabinets: 'slats' | 'criss-cross' | 'lattice' | 'open' | null */
  facePattern?: "slats" | "criss-cross" | "lattice" | "open" | null;
  /** Cabinet Config graphic type copied into a placed cabinet as customProfile. */
  graphicType?: string | null;
}

export type VanityComboFaceLayout = {
  kind: "double-drawer-stack";
  sideDrawerCount: 3;
  centerDoorCount: 2;
  hasLongDrawerFront: true;
};

/**
 * Explicit face contract for the sourced VDDB48 vanity combo. VDB48 remains a
 * different master SKU and must not inherit this combo layout.
 */
export function resolvedVanityComboFaceLayout(
  cabinet: Pick<CabinetLike, "masterCode">,
): VanityComboFaceLayout | null {
  const code = String(cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code === "VDDB48"
    ? { kind: "double-drawer-stack", sideDrawerCount: 3, centerDoorCount: 2, hasLongDrawerFront: true }
    : null;
}

/**
 * Resolves face counts without ever overwriting an authored Cabinet Config value.
 * A configured zero is meaningful: it suppresses generic descriptive/width-based
 * door or drawer inference for appliance openings and custom cabinets.
 */
export function resolveConfiguredFaceCounts(input: {
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  hasConfiguredOpening?: boolean;
  inferredDoors: number;
  inferredDrawers: number;
}) {
  return {
    doors: input.numberOfDoors != null
      ? Math.max(0, input.numberOfDoors)
      : input.hasConfiguredOpening ? 0 : Math.max(0, input.inferredDoors),
    drawers: input.numberOfDrawers != null
      ? Math.max(0, input.numberOfDrawers)
      : input.hasConfiguredOpening ? 0 : Math.max(0, input.inferredDrawers),
  };
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Standard cabinet faces wider than 21 inches are split into two equal doors. */
export function standardDoorCountForFaceWidth(width: number | string | null | undefined): number {
  const measuredWidth = toNum(width);
  return measuredWidth !== null && measuredWidth > 21 ? 2 : 1;
}

function lc(v: string | null | undefined): string {
  return (v ?? "").toLowerCase();
}

/** The 2-DB family always has exactly two equal-height drawer fronts. */
export function isEqualHeightTwoDrawerBase(
  cabinet: Pick<CabinetLike, "masterCode" | "numberOfDrawers">,
  fallbackCount = 0,
): boolean {
  const code = String(cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const drawerCount = Math.max(0, Number(cabinet.numberOfDrawers) || fallbackCount);
  return /^2DB\d/.test(code) && drawerCount === 2;
}

/** WBC is the fixed-hand wall blind-corner family: blind panel left, door right. */
export function isWallBlindCornerCabinet(
  cabinet: Pick<CabinetLike, "masterCode" | "description">,
): boolean {
  const code = String(cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^WBC\d/.test(code)) return true;
  const description = String(cabinet.description ?? "").toLowerCase();
  return /(?:wall.*blind corner|blind corner.*wall)/.test(description);
}

/**
 * Standard 3-DB bases use one 6-inch utility drawer over two equal deeper
 * drawers. Active catalog rows intentionally leave drawerLayout/drawerHeight
 * empty, so this family fallback is the shared rendering contract.
 */
export function threeDrawerBaseRowHeights(
  cabinet: Pick<CabinetLike, "masterCode" | "numberOfDrawers">,
  availableFaceHeightIn: number,
  fallbackCount = 0,
): number[] | null {
  const code = String(cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const drawerCount = Math.max(0, Number(cabinet.numberOfDrawers) || fallbackCount);
  if (!/^3DB\d/.test(code) || drawerCount !== 3 || !(availableFaceHeightIn > 0)) return null;
  const top = Math.min(6, availableFaceHeightIn / 3);
  const lower = (availableFaceHeightIn - top) / 2;
  return [top, lower, lower];
}

const WORD_NUM: Record<string, number> = {
  single: 1, one: 1, two: 2, double: 2, three: 3, triple: 3,
  four: 4, five: 5, six: 6,
};

/** Exact BEC24 family only; neither BA nor AW shares this square end profile. */
export function isSquareDoubleDoorBaseEnd(cab: Pick<CabinetLike, "masterCode">): boolean {
  return String(cab.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "") === "BEC24";
}

export const BEC24_DISPLAY_NAME = "Square Double-Door Base End Cabinet";

/**
 * Resolve how many door panels and drawer fronts a cabinet should DRAW so that
 * the picture always agrees with the visible label. The catalog's numeric
 * `numberOfDoors` / `subCategory` fields are unreliable for some rows (e.g. a
 * 12" wall tagged "Double Door Wall" / doors=1 whose description clearly says
 * "Single Door"), so the human-readable DESCRIPTION is treated as the source of
 * truth, with numeric fields and width as fallbacks.
 */
export function resolveDoorDrawerCounts(cab: CabinetLike): {
  doors: number;
  drawers: number;
} {
  // If the user explicitly marked this cabinet as "no door", render as open box.
  if (cab.noDoor) return { doors: 0, drawers: 0 };

  const nomenclature = parseCatalogNomenclature(cab.masterCode ?? "");
  const desc = lc(cab.description);
  const sub = lc(cab.subCategory);
  const code = lc(cab.masterCode);
  const w = toNum(cab.width);

  // The owner-approved BEC24 is a 24×24 square END cabinet with two coplanar
  // doors and no drawer. Ignore stale angled/one-door Config face metadata.
  if (isSquareDoubleDoorBaseEnd(cab)) return { doors: 2, drawers: 0 };

  // Code owns the drawer contract for roll-out-shelf base families. A full-height
  // B##FH#RS cabinet has no utility drawer; a regular B###RS base keeps its one
  // drawer while the suffix records the shelf add-on count. Never infer a drawer
  // from generic width or stale source fields for either family.
  if (nomenclature.family === "base" && nomenclature.rollOutShelfCount != null) {
    const configuredDoors = Math.max(0, cab.numberOfDoors ?? 0);
    return {
      doors: configuredDoors > 0 ? configuredDoors : standardDoorCountForFaceWidth(w ?? nomenclature.expectedWidth),
      drawers: nomenclature.expectedDrawerCount ?? 0,
    };
  }

  // Microwave bases are an explicit Cabinet Config contract, not a generic
  // door-base inference. In particular BMC30 is configured as 0 doors and 1
  // drawer; never use the width fallback to invent two doors for it.
  if (/microwave base|base microwave/.test(`${desc} ${sub}`) || /^(?:bmc|mb|bmw)[-_]?\d/.test(code)) {
    return {
      doors: Math.max(0, cab.numberOfDoors ?? 0),
      drawers: Math.max(0, cab.numberOfDrawers ?? 1),
    };
  }

  // The exact B-12/B-15/B-18/... family is the standard base construction:
  // one centered top drawer and lower hinged door(s). Saved/imported face counts
  // must not turn the lower door into a second drawer, which would incorrectly
  // render a horizontal centered pull on the door panel. Specialty B-prefixed
  // families (BFH, BMC, blind, etc.) do not match this exact code contract.
  const standardBaseCode = code.match(/^b[-_]?(\d{1,2})$/);
  if (standardBaseCode && (w ?? Number(standardBaseCode[1])) >= 12) {
    return { doors: standardDoorCountForFaceWidth(w ?? standardBaseCode[1]), drawers: 1 };
  }

  // 0) Authored Cabinet Config is authoritative. Legacy supplier counts exist on
  // older rows too, so only a configuration signal promotes those values above
  // the legacy description parser. A configured zero then intentionally
  // suppresses all inferred panels.
  const hasAuthoredFaceConfig = cab.openingType != null
    || cab.graphicType != null
    || cab.cornerType != null
    || cab.facePattern != null
    || cab.drawerLayout != null
    || cab.doorHeight != null
    || cab.drawerHeight != null
    || cab.doorOrientation != null
    || cab.doorsPerRow != null;
  if (hasAuthoredFaceConfig) {
    return {
      doors: Math.max(0, cab.numberOfDoors ?? 0),
      drawers: Math.max(0, cab.numberOfDrawers ?? 0),
    };
  }

  // 1) Drawers from the description, e.g. "3 Drawer Base", "with 4 Drawers".
  let drawers = 0;
  const drawerNum = desc.match(/(\d+)\s*[- ]?drawer/);
  if (drawerNum) drawers = parseInt(drawerNum[1], 10);
  else {
    const drawerWord = desc.match(/\b(single|two|double|three|triple|four|five|six)\s*[- ]?drawer/);
    if (drawerWord) drawers = WORD_NUM[drawerWord[1]] ?? 0;
  }
  if (drawers === 0 && (cab.numberOfDrawers ?? 0) > 0 && /drawer/.test(`${desc} ${sub}`)) {
    drawers = cab.numberOfDrawers ?? 0;
  }

  // 2) Doors from the description first ("Single Door", "Double Door", "2 Door").
  let doors = 0;
  const doorNum = desc.match(/(\d+)\s*[- ]?door/);
  if (doorNum) doors = parseInt(doorNum[1], 10);
  else {
    const doorWord = desc.match(/\b(single|two|double|three|triple|four)\s*[- ]?door/);
    if (doorWord) doors = WORD_NUM[doorWord[1]] ?? 0;
  }

  // 3) If the description/subCategory clearly indicates a PURE drawer base
  //    (e.g. "Two Drawer Base", subCategory="Drawer Base"), force doors=0 so
  //    the cabinet is never mis-classified as a door box. The numberOfDoors
  //    field in the DB is sometimes wrong (e.g. 2DB24 has numberOfDoors=2).
  //    IMPORTANT: a cabinet like "Double Door Single Drawer Base Cabinet" is NOT
  //    a pure drawer base — it has both doors AND drawers. Only treat it as a
  //    pure drawer base when the description starts with a drawer count (e.g.
  //    "Two Drawer Base", "3 Drawer Base") OR the masterCode is a drawer-base
  //    code (2DB24, DB-24-3, BD-15-3) AND the description has no door mention.
  const hasDoorMentionInDesc = /\b(single|double|two|three|four|\d+)\s*[- ]?door/.test(desc);
  const isPureDrawerBase =
    drawers > 0 &&
    !hasDoorMentionInDesc &&
    (/^(?:drawer base|\d+\s*drawer base|\w+\s+drawer base)/.test(sub) ||
      /^(?:db|bd)[-_]\d/.test(lc(cab.masterCode ?? "")) ||
      /^\d+db\d/i.test(lc(cab.masterCode ?? "")));
  if (isPureDrawerBase) {
    return { doors: 0, drawers };
  }

  // 4) Fall back to positive numeric fields, then to the shared 21-inch standard
  // face rule. Specialty families resolve before this generic fallback.
  // A zero is not a reliable no-door flag because it is the schema default; open
  // fronts use the explicit `noDoor` signal above.
  if (doors === 0) {
    const n = cab.numberOfDoors ?? 0;
    if (n > 0) doors = n;
  }
  if (doors === 0 && drawers === 0) {
    doors = standardDoorCountForFaceWidth(w);
  }

  return { doors, drawers };
}

/**
 * Decide which 2D front drawing best represents this cabinet, based on the
 * real catalog data (category / subCategory / counts / corner flag).
 * Order matters: most specific specialty types are checked first.
 */
export function cabinetDrawingType(cab: CabinetLike): CabinetDrawingType {
  const cat = lc(cab.category);
  const sub = lc(cab.subCategory);
  const code = lc(cab.masterCode);
  const desc = lc(cab.description);
  const graphic = lc(cab.graphicType);
  const hay = `${sub} ${desc} ${code}`;
  const nomenclature = parseCatalogNomenclature(cab.masterCode ?? "");

  // Chrome Tray 33/36 are shelf-mounted lazy-Susan inserts for matching ERB
  // easy-reach corner cabinets. The normalized code defines the compatibility,
  // so render one neutral, reusable technical tray instead of generic trim.
  if (/^chrometray(?:33|36)$/.test(code.replace(/[^a-z0-9]/g, ""))) {
    return "lazy-susan-tray";
  }

  // WMSSHELF is the separately sold shelf insert for WMS3018. Its code is not
  // interchangeable with the full microwave cabinet kit.
  if (/^wmsshelf$/.test(code.replace(/[^a-z0-9]/g, ""))) {
    return "shelf-insert";
  }

  // WMS3018 is an open 30 × 18 × 12 wall microwave cabinet kit with an
  // individual shelf insert. It is not a two-door wall box; its code owns the
  // open frame and lower shelf platform.
  if (/^wms\d+$/.test(code.replace(/[^a-z0-9]/g, "")) || /wall microwave cabinet kit/.test(hay)) {
    return "wall-microwave-kit";
  }

  // RHF30/RHF36 are cataloged wall-cabinet hood fronts, not an appliance hood.
  // The supplied Ashford drawing defines their shallow 9/12-inch cabinet box,
  // sloped pair of wood doors, and lower fascia. Keep this distinct from a
  // stainless HOOD-* appliance and from an ordinary rectangular wall cabinet.
  if (/^rhf[-_]?\d+$/.test(code) || /range\s*hood\s*front/.test(hay)) {
    return "range-hood-front";
  }

  // BEC24 is a square end-of-run box, never a diagonal corner or an angled
  // end. The exact code must beat older graphicType/description overrides.
  if (isSquareDoubleDoorBaseEnd(cab)) return "standard-door";

  // Cabinet Config's explicitly authored graphic type takes precedence over
  // inconsistent supplier category or corner fields on saved placements.
  if (graphic === "wall_angle" || /^(?:aw[-_]?\d|aw[-_]?\d+-\d+)/.test(code) || /angle(?:d)? wall end cabinet/.test(hay)) {
    return "wall-end-angle";
  }
  if (graphic === "end-angle" || graphic === "base_end_angle") {
    return "end-angle";
  }
  // Canonical BEC24 is the source-specified 30 × 34½ × 24 end-of-run cabinet
  // with one 45-degree angled end and one door. Some already-saved records
  // still carry the historic `base_end_return` graphic token, which drew two
  // folded 12-inch faces. Reinterpret only this confirmed family as its one
  // physical angled end; leave generic end-return profiles for unrelated
  // Cabinet Config records.
  if (
    (/^(?:base_)?end[_-]?return$/.test(graphic) || graphic === "base_end_return")
    && (/^(?:bec|ba)[-_]?\d/.test(code) || /base end (?:cabinet|angle)/.test(`${sub} ${desc}`))
  ) {
    return "end-angle";
  }
  if (/^(?:base_)?end[_-]?return$/.test(graphic) || graphic === "base_end_return") {
    return "end-return";
  }

  // Face-pattern override: admin-set facePattern takes priority over all other detection.
  // Auto-detect by code prefix — only CONFIRMED rack/open-front codes:
  //   WRC (wine rack combo), WXR (wine cross rack), WWC (wine wall cabinet),
  //   LWR (lattice wine rack), PR (plate rack), WPR (wall plate rack).
  // NOTE: WR* is a WALL REFRIGERATOR cabinet — do NOT include it here.
  if (
    cab.facePattern ||
    /^(wrc[-_]?|wxr[-_]?|wwc[-_]?|lwr[-_]?|wpr[-_]?|pr[-_]?)\d/.test(code)
  ) {
    return "face-pattern";
  }

  // Real cabinet families are never accessory strips, even if their description
  // mentions words like "shelf" or "panel" (e.g. "...Base Cabinet with Adjustable Shelf").
  const isRealCabinetFamily = ["base", "wall", "tall", "vanity", "ada"].includes(cat);

  // Panels: skin panels, end panels, plywood panels, refrigerator panels.
  // Detected by subCategory/description keywords. Must be checked BEFORE accessory-strip.
  if (
    !isRealCabinetFamily &&
    /^(?:wsv|plyeb)[-_]?\d|skin(?:\s*\/\s*scribe)?\s*(?:veneer\s*)?panel|end panel|plywood(?:\s+edge-banded)?\s+(?:board|panel)|refrigerator panel|\bpanel\s*\d|\bwsp\b|\brsp\b|\brw\b|\bdep\b|\bbep\b/.test(hay)
  ) {
    // Check if it's a decorative door panel (has door style) vs flat plywood panel
    if (cab.isDecorativeDoor || /decorative|door panel|dec\s*end|dep-|bep-/.test(hay)) {
      return "decorative-door";
    }
    return "panel";
  }

  // Accessories: moldings, fillers, shelves, light/base rail, toe kick.
  // The keyword heuristic only applies as a fallback for items NOT already in a
  // real cabinet category; explicit category==="accessory" always wins.
  if (
    cat === "accessory" ||
    (!isRealCabinetFamily &&
      /molding|filler|shelf|light rail|base rail|toe kick|scribe|valance/.test(
        hay,
      ))
  ) {
    return "accessory-strip";
  }

  // Appliance garage (tambour roll-up). Check before generic wall/door.
  if (/appliance garage|tambour|garage/.test(hay)) {
    return "appliance-garage";
  }

  // Corner drawer base (CDB-*): L-shaped footprint with stacked drawers on the main face.
  // Must be detected BEFORE the generic blind-corner check.
  const { doors: _cdbDoors, drawers: _cdbDrawers } = resolveDoorDrawerCounts(cab);
  if (/^cdb[-_]?\d/.test(code) || (/corner.*drawer.*base|corner drawer base/.test(hay) && _cdbDrawers > 0 && _cdbDoors === 0)) {
    return "corner-drawer-base";
  }

  // BEC24 is the exact source-specified 30-inch base end cabinet. Its body
  // mates to a base run and its exposed end is one 45-degree angled panel with
  // a single 17½-inch door—never a room corner or two folded return faces.
  if (
    /base end corner|base end cabinet|end corner return|base end angle/.test(sub) ||
    /^(?:bec|ba)[-_]?\d/.test(code) ||
    /base end corner/.test(hay)
  ) {
    return "end-angle";
  }
  // Other base-angle products remain a one-face end-of-run angled cabinet.
  if (/base angle.*end of run|base end (?:angle|cabinet)/.test(hay)) {
    return "end-angle";
  }

  // Cabinet Config is the source of truth for intentionally configured corner
  // geometry. These settings must work even when a supplier uses a neutral SKU
  // or description that does not carry the usual corner prefix.
  if (cab.cornerType === "diagonal" || cab.cornerType === "pie-cut") return "diagonal-corner";
  if (cab.cornerType === "blind-corner") return "blind-corner";
  if (cab.cornerType === "l-shape" || cab.cornerType === "lazy-susan") {
    return "l-corner";
  }

  // Triangle corner cabinets: right-triangle footprint, single door on hypotenuse face (WTC/BTC)
  // Must be detected BEFORE diagonal-corner and l-corner checks.
  if (cab.cornerType === "triangle" || /^(wtc|btc)/.test(code)) {
    return "triangle-corner";
  }

  // Diagonal corner cabinets: 45° angled front face (DCW, WDC, KWD, DCB, DCFF, AW, AG, CAG).
  if (/^(dcw|wdc|kwd|dcb|dcff|aw[-\d]|ag[-\d]|cag)/.test(code) || code.includes("dcw") || code.includes("wdc") || /diagonal|angled (wall|corner)|appliance garage/.test(hay)) {
    return "diagonal-corner";
  }

  // LS lazy-Susan cabinets use the confirmed two-leg L-corner form: 36-inch
  // wall sides with one 12-inch return front on each exposed side. Easy-reach
  // cabinets use the same L-corner elevation contract.
  const isBlind = /^(bbc|wbc|bbl|bbr|wbl|wbr)/.test(code) || /-blind|blind/.test(code) || /blind\s*corner/.test(hay);
  // Explicit code-prefix detection for LS## (e.g. LS3612, LS3312), BER## (e.g. BER33, BER36),
  // and ERB## (e.g. ERB33, ERB36). These may not have isCornerCabinet=true in the DB.
  const isLazySusan = /^(lsb?)\d/.test(code) || /lazy\s*susan/.test(hay);
  if (isLazySusan) return "l-corner";
  const isBerOrErb = /^(ber|erb)\d/.test(code);
  if (!isBlind && (isBerOrErb || cab.isCornerCabinet || /corner|easy reach/.test(hay))) {
    return "l-corner";
  }

  // Blind corner cabinets: standard rectangular footprint with hidden portion
  if (isBlind || /blind corner/.test(hay)) {
    return "blind-corner";
  }

  // Sink base (false front tilt-out + sink cutout indication).
  if (/sink base|sink/.test(hay) && /base|vanity/.test(`${cat} ${sub} ${desc}`)) {
    return "sink-base";
  }

  // Microwave bases are a dedicated front: a microwave opening over the
  // configured drawer(s). They are not normal door bases, even where a supplier
  // description omits the cabinet's zero-door count.
  if (/microwave base|base microwave/.test(hay) || /^(?:bmc|mb|bmw)[-_]?\d/.test(code)) {
    return "microwave-base";
  }

  // ADA is a positional accessibility modifier, not a replacement face layout.
  // ADA-3DB15 and 3DB15ADA therefore use the same three-drawer elevation;
  // generic ADA bases still retain the neutral ADA-height door-box drawing below.
  if (
    nomenclature.isAdaAccessible
    && (nomenclature.adaProductKind === "three-drawer-base" || nomenclature.adaProductKind === "three-drawer-vanity-base")
  ) {
    return "drawer-base";
  }

  // Glass-front wall cabinets.
  if (/glass/.test(hay)) {
    return "glass-door";
  }

  // ADA units (shallower / lower) — only when not already a more specific type.
  if (cat === "ada" || /\bada\b/.test(hay)) {
    return "ada";
  }

  // Vanity units.
  if (cat === "vanity" || /vanity/.test(hay)) {
    return "vanity";
  }

  // Drawer base: all-drawer fronts (no doors). Use the description-driven
  // resolver so the type matches the label (e.g. "3 Drawer Base").
  const { doors, drawers } = resolveDoorDrawerCounts(cab);
  if (/drawer base/.test(`${sub} ${desc}`) && doors === 0) {
    return "drawer-base";
  }
  if (drawers > 0 && doors === 0) {
    return "drawer-base";
  }

  // Oven tall cabinets: O-code tall cabinets (e.g. O309024) — 2 upper doors +
  // appliance opening + drawers at bottom. Must be detected BEFORE the generic
  // pantry check so they don't fall through as a plain 4-door pantry.
  // Detection is intentionally broad: O-code pattern OR oven keyword in any field,
  // regardless of category value (some distributors store these as "Oven Cabinets",
  // "Tall Cabinets", or just "Tall" — all should render as oven-tall).
  const placementLc = lc(cab.placementType);
  const isTallPlacement = cat === "tall" || sub.includes("oven") || sub.includes("tower") || placementLc === "tall" || placementLc.includes("tall") || placementLc.includes("oven") || placementLc.includes("pantry");
  // Oven tall detection: O-code or zero-prefixed oven codes (e.g. 0309024),
  // OR subCategory/description contains oven tower/pantry keywords.
  // Note: some distributors use digit 0 instead of letter O in the master code.
  // UOC = "Upper Oven Cabinet" (e.g. UOC3390, UOC339024) — same oven-tall rendering.
  // DoorDrawerDiagram already handles UOC; keep both in sync.
  const isOvenCode = /^[o0]3\d{5}/.test(code) || /^uoc\d/.test(code); // o309024, 0309024, uoc3390
  const isOvenKeyword = /oven.*tower|oven.*pantry|oven.*tall|tall.*oven|oven.*cabinet/.test(hay);
  if (isOvenCode || (isOvenKeyword && isTallPlacement)) {
    return "oven-tall";
  }

  // Tall/pantry cabinets: 4-door split at 54" (2 bottom, 2 top).
  if (cat === "tall") {
    return "pantry";
  }

  // Default: a door box (with optional top drawer handled by the renderer).
  return "standard-door";
}

/**
 * Sub-grouping used by the designer's "Base" palette tab so floor cabinets are
 * organized logically instead of one long list. Five ordered buckets:
 *   1. base       — standard door base cabinets (the most common)
 *   2. drawer     — all-drawer drawer bases
 *   3. sink       — sink/farmhouse/vanity-sink fronts
 *   4. full-height — full-height door bases (BFH/B-FH/TFHB/HB families)
 *   5. specialty  — everything else that's still a base box (blind/lazy-susan
 *                   corners that land on the Base tab, microwave/oven/trash
 *                   bases, spice pull-outs, end/wine/desk specialty units, ADA)
 *
 * Pure + framework-free so it is unit-testable. Order of checks matters: the
 * sink signals win, then full-height identity, specialty, drawer, and plain base.
 */
export type BaseSubGroup = "base" | "drawer" | "sink" | "full-height" | "specialty";

export function baseSubGroup(cab: CabinetLike): BaseSubGroup {
  const code = lc(cab.masterCode);
  const sub = lc(cab.subCategory);
  const desc = lc(cab.description);
  const hay = `${sub} ${desc} ${code}`;
  const type = cabinetDrawingType(cab);

  // The BEC24 shape draws a rectangular body, but its role is a dedicated
  // two-door run END—not an interchangeable ordinary base cabinet.
  if (isSquareDoubleDoorBaseEnd(cab)) return "specialty";

  // 1) Sink fronts/bases first — a sink base often also has drawers/doors, so it
  //    must be classified before the drawer/standard checks.
  if (
    type === "sink-base" ||
    /\bsink\b/.test(hay) ||
    /^(?:ada-)?f?sb[-_ ]?\d/.test(code) ||
    /^csb[-_ ]?\d/.test(code) ||
    /^(?:uv-)?sbf[-_ ]?\d/.test(code) ||
    /^(?:ada-)?vsd?[-_ ]?\d/.test(code)
  ) {
    return "sink";
  }

  // 2) Full-height door bases. The description and authored sub-category are
  // authoritative; code fallbacks cover common distributor forms including
  // BFH-12, B12FH/B12FHD/B12FHTD, TFHB-12, and HB-12. Sink stays first so a
  // full-height vanity sink cabinet remains in Sink Bases.
  if (
    /\bfull[-\s]?height\b/.test(hay) ||
    /^(?:bfh|tfhb|hb)[-_ ]?\d/.test(code) ||
    /^b\d+(?:fh|fhd|fhtd)/.test(code)
  ) {
    return "full-height";
  }

  // 3) Specialty bases: corners that fall on the Base tab, appliance bases
  //    (microwave/oven/trash/waste), spice pull-outs, blind/lazy-susan, ADA,
  //    end/wine/desk and other non-standard boxes.
  if (
    type === "blind-corner" ||
    type === "diagonal-corner" ||
    type === "l-corner" ||
    type === "corner-drawer-base" ||
    type === "appliance-garage" ||
    type === "ada" ||
    cab.isCornerCabinet ||
    /blind|lazy susan|easy reach|diagonal|corner/.test(hay) ||
    /microwave|\boven\b|trash|waste|recycl/.test(hay) ||
    /spice|pull[- ]?out|pullout|roll[- ]?out|tray base/.test(hay) ||
    /\bada\b/.test(hay) ||
    /end (?:shelf|panel|base)|angle|wine|desk|peninsula base|appliance base/.test(
      hay,
    )
  ) {
    return "specialty";
  }

  // 4) Drawer bases: ALL-drawer fronts only. We must NOT catch standard door
  //    bases that happen to include one drawer (e.g. B-24 = "Double Door Single
  //    Drawer Base Cabinet"): those are regular bases and belong in the "base"
  //    bucket. So classify as drawer ONLY when the drawing type is a drawer base,
  //    or the subCategory is exactly "Drawer Base" (the catalog's own all-drawer
  //    designation). The loose /drawer base/ description match is intentionally
  //    dropped because descriptions like "...Single Drawer Base Cabinet" contain
  //    that substring while still being door bases.
  //    Some catalog rows are mis-tagged subCategory="Drawer Base" while actually
  //    being single-door full-height bases (e.g. BFH-12/15/18, doors=1). A real
  //    drawer base has NO doors, so require a 0-door box before trusting the tag.
  const { doors: ddDoors, drawers: ddDrawers } = resolveDoorDrawerCounts(cab);
  if (
    type === "drawer-base" ||
    (/^drawer base$/.test(sub.trim()) && ddDoors === 0 && ddDrawers >= 1)
  ) {
    return "drawer";
  }

  // 5) Everything else is a standard door base.
  return "base";
}

/**
 * A short, shopper-facing type label that ALWAYS agrees with the drawing.
 * The catalog's `subCategory` is sometimes wrong (a single-door wall tagged
 * "Double Door Wall"), so when the description clearly states the door/drawer
 * count we derive the label from the description instead.
 */
export function cabinetTypeLabel(cab: CabinetLike): string {
  const cat = lc(cab.category);
  const sub = (cab.subCategory ?? "").trim();
  const desc = lc(cab.description);
  const type = cabinetDrawingType(cab);
  const { doors, drawers } = resolveDoorDrawerCounts(cab);

  if (isSquareDoubleDoorBaseEnd(cab)) return BEC24_DISPLAY_NAME;

  const placement =
    cat === "wall" ? "Wall" :
    cat === "tall" ? "Tall" :
    cat === "vanity" ? "Vanity" :
    cat === "ada" ? "ADA" :
    cat === "accessory" ? "Accessory" : "Base";

  if (type === "drawer-base") {
    return drawers > 0 ? `${drawers}-Drawer ${placement}` : `Drawer ${placement}`;
  }
  if (type === "microwave-base") return "Microwave Base Cabinet";
  if (type === "wall-microwave-kit") return "Wall Microwave Cabinet Kit";
  if (type === "shelf-insert") return "Microwave Cabinet Shelf Insert";
  if (type === "range-hood-front") return "Range Hood Front";
  if (type === "sink-base") return `Sink ${placement === "Vanity" ? "Vanity" : "Base"}`;
  if (type === "blind-corner") return `Blind Corner ${placement}`;
  if (type === "wall-end-angle") return "Angled Wall End Cabinet";
  if (type === "diagonal-corner") return `Diagonal Corner ${placement}`;
  if (type === "end-angle") return "Base End Cabinet — 45° Angled End";
  if (type === "end-return") return "Base End Corner Cabinet";
  if (type === "l-corner") return /lazy susan/.test(desc) ? `Lazy Susan ${placement}` : `Corner ${placement}`;
  if (type === "corner-drawer-base") return `Corner Drawer ${placement}`;
  if (type === "appliance-garage") return "Appliance Garage";
  if (type === "glass-door") return doors >= 2 ? `Double Glass Door ${placement}` : `Single Glass Door ${placement}`;
  if (type === "accessory-strip") return sub || "Trim / Accessory";
  if (type === "panel") {
    if (/skin/.test(desc)) return "Skin Panel";
    if (/end panel/.test(desc)) return "End Panel";
    if (/refrigerator/.test(desc)) return "Refrigerator Panel";
    return sub || "Flat Panel";
  }
  if (type === "decorative-door") {
    if (/end/.test(desc)) return "Decorative End Panel";
    return sub || "Decorative Door Panel";
  }

  // Standard door box: name by door count so it matches the drawing.
  if (type === "standard-door") {
    const doorWord = doors >= 2 ? "Double Door" : "Single Door";
    if (placement === "Vanity" || placement === "ADA") return `${doorWord} ${placement}`;
    return `${doorWord} ${placement}`;
  }
  return sub || `${placement} Cabinet`;
}

/** Slugify a string into an SEO-friendly, hyphenated token. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/["'']/g, "") // drop quotes/inch marks
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, "") // trim hyphens
    .replace(/-{2,}/g, "-"); // collapse repeats
}

/**
 * SEO-friendly image slug/key for a model, e.g.
 * "Drawer Base 12" + DB-12-3  ->  "drawer-base-12-db-12-3".
 * Uses the description (truncated) plus the unique master code so it is both
 * descriptive and unique.
 */
export function cabinetImageSlug(cab: CabinetLike): string {
  const descPart = slugify((cab.description ?? "").split(/[.,;]/)[0] ?? "").slice(0, 60);
  const codePart = slugify(cab.masterCode ?? "");
  const joined = [descPart, codePart].filter(Boolean).join("-");
  return joined || codePart || "cabinet";
}

/**
 * Human-readable alt text for accessibility + SEO, e.g.
 * 'Drawer Base 12" (DB-12-3) — 3-drawer base cabinet'.
 */
export function cabinetAltText(cab: CabinetLike): string {
  const code = cab.masterCode ?? "";
  if (isSquareDoubleDoorBaseEnd(cab)) {
    return `${BEC24_DISPLAY_NAME} (${code}) — 24 by 24 inch square end-of-run box with two doors on one flat front`;
  }
  const w = toNum(cab.width);
  const type = cabinetDrawingType(cab);
  const nomenclature = parseCatalogNomenclature(code);
  const { doors, drawers } = resolveDoorDrawerCounts(cab);

  const widthPart = w ? `${w}"` : "";
  const namePart = (cab.description ?? "").split(/[.,;]/)[0]?.trim() || cab.subCategory || "Cabinet";

  const bits: string[] = [];
  bits.push(namePart);
  if (widthPart && !namePart.includes(widthPart)) bits.push(widthPart);
  const head = bits.join(" ").trim();

  const detailMap: Record<CabinetDrawingType, string> = {
    "standard-door": doors > 0 ? `${doors}-door cabinet` : "cabinet",
    "drawer-base": drawers > 0 ? `${drawers}-drawer base cabinet` : "drawer base cabinet",
    "microwave-base": "microwave base cabinet with appliance opening and bottom drawer",
    "sink-base": "sink base cabinet with false tilt-out front",
    "appliance-garage": "appliance garage with tambour door",
    "blind-corner": "blind corner cabinet",
    "wall-end-angle": "angled wall end cabinet with one diagonal door",
    "diagonal-corner": "diagonal corner cabinet with angled front",
    "end-angle": "base end cabinet with angled outer face",
    "end-return": "24-by-24 base end-corner cabinet with two 12-inch return faces",
    "l-corner": "L-shaped corner cabinet",
    "corner-drawer-base": "corner drawer base cabinet",
    vanity: "vanity cabinet",
    ada: "ADA-compliant cabinet",
    "lazy-susan-tray": "shelf-mounted chrome tray insert for an easy-reach corner cabinet",
    "wall-microwave-kit": "open wall microwave cabinet kit with shelf insert",
    "shelf-insert": "individual shelf insert for a wall microwave cabinet kit",
    "range-hood-front": "shallow sloped two-door range hood front with lower fascia",
    "accessory-strip": "accessory / trim",
    "panel": "flat panel (skin panel / end panel)",
    "decorative-door": "decorative door panel",
    "glass-door": "glass-front wall cabinet",
    "pantry": "tall pantry cabinet with 4 doors",
    "oven-tall": "tall oven cabinet with appliance opening",
    "triangle-corner": "right-triangle corner cabinet with single door on angled face",
    "face-pattern": "specialty open-front cabinet",
  };

  let detail = detailMap[type];
  if (nomenclature.family === "base" && nomenclature.rollOutShelfCount != null) {
    const shelfLabel = `${nomenclature.rollOutShelfCount} roll-out ${nomenclature.rollOutShelfCount === 1 ? "shelf" : "shelves"}`;
    detail = nomenclature.isFullHeightBase
      ? `full-height base cabinet with no drawer and ${shelfLabel}`
      : `base cabinet with ${drawers} drawer${drawers === 1 ? "" : "s"} and ${shelfLabel}`;
  }
  // Corner cabinets share one L-shaped drawing, but the accessible label should
  // reflect the actual mechanism (lazy-Susan / easy-reach / corner sink) rather
  // than always saying "blind corner cabinet".
  if (type === "blind-corner" || type === "l-corner" || type === "diagonal-corner") {
    const hay = `${cab.description ?? ""} ${cab.subCategory ?? ""} ${cab.masterCode ?? ""}`.toLowerCase();
    if (/lazy\s*-?\s*susan|\blsb?\d/.test(hay)) detail = "lazy-Susan corner base cabinet with diagonal front";
    else if (/easy reach|easy-reach|\berb\b/.test(hay)) detail = "easy-reach corner base cabinet";
    else if (/corner sink|sink/.test(hay)) detail = "corner sink base cabinet";
    else if (/diagonal/.test(hay)) detail = "diagonal corner cabinet";
  }
  const codePart = code ? `(${code})` : "";
  return [head, codePart, "—", detail].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
