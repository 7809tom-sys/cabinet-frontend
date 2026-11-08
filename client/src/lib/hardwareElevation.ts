// ─── Elevation drawing spec for real catalog hardware ───────────────────────
// The 2D elevations used to draw one generic proxy per hardware STYLE (a dot, a
// bar, a half-moon). A customer who picks a real Hardware Resources item should
// see THAT item: its family (bar, arch, T-bar, tab/edge, cup, round or square
// knob) and its real size, read from the catalog configuration label.
//
// Everything here is pure and deterministic so the drawing rules can be tested
// without a browser. No size is ever invented: when a label carries no parseable
// measurement the caller keeps today's proportional stand-in.

import type { CatalogHardwareSelection } from "./hardware";

/** Straight-on handle families the elevation can draw. */
export type HardwareFamily =
  | "bar-pull"
  | "arch-pull"
  | "t-bar"
  | "edge-pull"
  | "cup-pull"
  | "round-knob"
  | "square-knob";

export interface ParsedHardwareDimensions {
  /** Overall length in inches ("4-13/16" Overall Length"), when stated. */
  overallLengthIn: number | null;
  /** Hole spacing in inches ("96 mm center-to-center"), when unambiguous. */
  centerToCenterIn: number | null;
  /** Diameter in inches — a knob body, or a bar's tube diameter. */
  diameterIn: number | null;
  /** True when the label lists two different hole spacings ("double tapped for 3" and 96 mm"). */
  centerToCenterAmbiguous: boolean;
}

export interface HardwareDrawSpec {
  family: HardwareFamily;
  /** True for knobs: the long dimension is the diameter, not a pull length. */
  knob: boolean;
  /**
   * The real long dimension in inches — overall length for a pull/cup, body
   * diameter for a knob. null means the catalog label carried no usable size.
   */
  lengthIn: number | null;
  /** Across-the-piece thickness in inches (tube diameter, knob diameter). */
  thicknessIn: number;
  /** Post/hole spacing in inches when the catalog states it. */
  centerToCenterIn: number | null;
  /** True when lengthIn came from the catalog label. */
  measured: boolean;
  /** Where thicknessIn came from; "default" is a drawing fallback, never a catalog claim. */
  thicknessSource: "catalog" | "default";
  /** True when the label's dimensions could not be read at all. */
  unparseable: boolean;
}

const MM_PER_IN = 25.4;
const CM_PER_IN = 2.54;

/** Default tube/knob thickness in inches when the label never states one. */
export const DEFAULT_BAR_THICKNESS_IN = 0.44;
export const DEFAULT_KNOB_DIAMETER_IN = 1.25;

type Token = { valueIn: number; unit: "mm" | "cm" | "in" | null; start: number; end: number };

const MEASURE_RE = /(\d+\s*-\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*(mm|cm|"|”|″|inches\b|inch\b|in\b)?/gi;

function fractionOrDecimal(raw: string): number | null {
  const text = raw.replace(/\s+/g, "");
  const mixed = text.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (!denominator) return null;
    return whole + numerator / denominator;
  }
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (!denominator) return null;
    return numerator / denominator;
  }
  const plain = Number(text);
  return Number.isFinite(plain) ? plain : null;
}

function unitOf(raw: string | undefined): Token["unit"] {
  const unit = (raw ?? "").toLocaleLowerCase();
  if (unit === "mm") return "mm";
  if (unit === "cm") return "cm";
  if (unit === '"' || unit === "”" || unit === "″" || unit === "in" || unit === "inch" || unit === "inches") return "in";
  return null;
}

function toInches(value: number, unit: Token["unit"]): number {
  if (unit === "mm") return value / MM_PER_IN;
  if (unit === "cm") return value / CM_PER_IN;
  return value;
}

function measureTokens(text: string): Token[] {
  const tokens: Token[] = [];
  const re = new RegExp(MEASURE_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) != null) {
    const value = fractionOrDecimal(match[1]);
    if (value == null) continue;
    const start = match.index;
    tokens.push({
      valueIn: toInches(value, unitOf(match[2])),
      unit: unitOf(match[2]),
      start,
      end: start + match[0].length,
    });
  }
  return tokens;
}

/**
 * Only the descriptive part of a configuration label states dimensions. The
 * packaging sentence ("Packaged with two 8-32 x 1" screws") must never be read
 * as a pull length, so the text is cut there before measuring.
 */
function describeOnly(label: string): string {
  return label.split(/\bpackaged\b|\bwith two\b|\bwith four\b|\bbreak[\s-]?away\b|\bscrews?\b/i)[0] ?? label;
}

const OVERALL_KEYWORDS = /overall\s+length|overall\s+size|overall\s+width/i;
const DIAMETER_KEYWORDS = /\bdiameter\b|\bdia\.?\b|\bwidth\b/i;
const CC_KEYWORD = /center[\s-]*to[\s-]*center|\bc\/c\b|\bctc\b|\bon[\s-]*center\b/i;

/** Nearest measurement written immediately before a keyword, allowing a unit conversion in parentheses. */
function tokensBeforeKeyword(text: string, tokens: Token[], keywordStart: number): Token[] {
  return tokens.filter((token) => token.end <= keywordStart && keywordStart - token.end <= 26);
}

function tokensAfterKeyword(tokens: Token[], keywordEnd: number): Token[] {
  return tokens.filter((token) => token.start >= keywordEnd && token.start - keywordEnd <= 20);
}

/** Pick the most trustworthy of several candidate measurements for the same slot. */
function chooseMeasure(candidates: Token[]): { value: number | null; ambiguous: boolean } {
  if (candidates.length === 0) return { value: null, ambiguous: false };
  if (candidates.length === 1) return { value: candidates[0].valueIn, ambiguous: false };
  // "48 mm (1-7/8")" states the same dimension twice; the inch figure wins.
  const inchTokens = candidates.filter((token) => token.unit === "in");
  const pool = inchTokens.length > 0 ? inchTokens : candidates;
  const first = pool[0].valueIn;
  const disagree = pool.some((token) => Math.abs(token.valueIn - first) > Math.max(0.03, first * 0.02));
  if (disagree) return { value: null, ambiguous: true };
  return { value: first, ambiguous: false };
}

function keywordsWithIndex(text: string, pattern: RegExp): Array<{ start: number; end: number }> {
  const found: Array<{ start: number; end: number }> = [];
  const re = new RegExp(pattern.source, pattern.flags.includes("i") ? "gi" : "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) != null) {
    const start = match.index;
    found.push({ start, end: start + match[0].length });
  }
  return found;
}

/**
 * Read the real dimensions out of a catalog configuration label. Supports
 * millimetres ("96 mm"), decimals, fractions and mixed fractions ("4-13/16""),
 * and both phrasings of hole spacing ("96 mm Center to Center", "Holes are 3"
 * center-to-center"). Ambiguous double-tapped spacings are reported, not guessed.
 */
export function parseHardwareDimensions(label: string | null | undefined): ParsedHardwareDimensions {
  const text = describeOnly(String(label ?? ""));
  const tokens = measureTokens(text);
  const result: ParsedHardwareDimensions = {
    overallLengthIn: null,
    centerToCenterIn: null,
    diameterIn: null,
    centerToCenterAmbiguous: false,
  };
  if (tokens.length === 0) return result;

  for (const keyword of keywordsWithIndex(text, OVERALL_KEYWORDS)) {
    if (result.overallLengthIn != null) break;
    const chosen = chooseMeasure(tokensBeforeKeyword(text, tokens, keyword.start));
    if (chosen.value != null) result.overallLengthIn = chosen.value;
  }
  for (const keyword of keywordsWithIndex(text, DIAMETER_KEYWORDS)) {
    if (result.diameterIn != null) break;
    const chosen = chooseMeasure(tokensBeforeKeyword(text, tokens, keyword.start));
    if (chosen.value != null) result.diameterIn = chosen.value;
  }
  // "Holes are double tapped for 3" and 96 mm center-to-center" offers two
  // different spacings on one part. Picking either would be a guess, so the
  // spacing is reported as ambiguous and the overall length is used instead.
  if (/double[\s-]*tapped/i.test(text)) {
    result.centerToCenterAmbiguous = keywordsWithIndex(text, CC_KEYWORD).length > 0;
  } else {
    for (const keyword of keywordsWithIndex(text, CC_KEYWORD)) {
      if (result.centerToCenterIn != null) break;
      const before = tokensBeforeKeyword(text, tokens, keyword.start);
      const candidates = before.length > 0 ? before : tokensAfterKeyword(tokens, keyword.end);
      const chosen = chooseMeasure(candidates);
      if (chosen.ambiguous) result.centerToCenterAmbiguous = true;
      else if (chosen.value != null) result.centerToCenterIn = chosen.value;
    }
  }
  // Some rows state the size without a keyword at all ("1-1/4" Cabinet Knob").
  // The descriptive text leads with one measurement, so that single leading
  // figure is the size; anything longer is left unread rather than guessed.
  if (result.overallLengthIn == null && result.diameterIn == null) {
    const leading = tokens.filter((token) => token.start <= 10);
    if (leading.length === 1 && measureTokens(text).length === 1) {
      result.overallLengthIn = leading[0].valueIn;
    }
  }
  return result;
}

const KNOWN_CABINET_TYPES = new Set(["knob", "t-knob", "cup pull", "pull", "bar pull", "tab pull"]);

/**
 * Map a catalog pick to a straight-on handle family. Product type decides first;
 * the product name only refines shape (square vs round knob, arch vs bar pull),
 * because collection names carry no geometry.
 */
export function hardwareFamilyFor(selection: CatalogHardwareSelection | null | undefined): HardwareFamily | null {
  if (!selection) return null;
  const type = String(selection.productType ?? "").trim().toLocaleLowerCase();
  if (!KNOWN_CABINET_TYPES.has(type)) return null;
  const name = `${selection.configurationLabel ?? ""}`.toLocaleLowerCase();
  const edgeShape = /\bedge\s+pull\b|\bfinger\s+pull\b|\bcup\s+pull\b/;
  if (type === "cup pull") return "cup-pull";
  if (type === "tab pull" || edgeShape.test(name)) return "edge-pull";
  if (type === "t-knob") return "t-bar";
  if (type === "knob") return /square|rectangle|rectangular|cube|box\b/.test(name) ? "square-knob" : "round-knob";
  // Pull / bar pull: the product name separates an arched (scroll/bow) bar from
  // a plain bar and from a T-shaped bar.
  if (/\bt[\s-]?bar\b/.test(name)) return "t-bar";
  if (/\barch\b|\bbow\b|\bscroll\b|\bbridge\b|\bcurved\b/.test(name)) return "arch-pull";
  return "bar-pull";
}

/** True when a family is a knob (drawn as a body, not a bar). */
export function isKnobFamily(family: HardwareFamily): boolean {
  return family === "round-knob" || family === "square-knob";
}

/**
 * Build the drawing spec for a catalog pick: family plus the real dimensions the
 * label states. Returns null when there is no usable cabinet-hardware pick.
 */
export function hardwareDrawSpec(selection: CatalogHardwareSelection | null | undefined): HardwareDrawSpec | null {
  const family = hardwareFamilyFor(selection);
  if (!family || !selection) return null;
  const parsed = parseHardwareDimensions(selection.configurationLabel);
  const knob = isKnobFamily(family);
  if (knob) {
    const diameter = parsed.diameterIn ?? parsed.overallLengthIn;
    const measured = diameter != null;
    return {
      family,
      knob: true,
      lengthIn: measured ? Math.round(diameter * 1000) / 1000 : null,
      thicknessIn: measured ? Math.round(diameter * 1000) / 1000 : DEFAULT_KNOB_DIAMETER_IN,
      centerToCenterIn: null,
      measured,
      thicknessSource: measured ? "catalog" : "default",
      unparseable: !measured,
    };
  }
  const lengthIn = parsed.overallLengthIn ?? parsed.centerToCenterIn;
  const measured = lengthIn != null;
  const catalogThickness = parsed.diameterIn;
  return {
    family,
    knob: false,
    lengthIn: measured ? Math.round(lengthIn * 1000) / 1000 : null,
    thicknessIn: catalogThickness != null && catalogThickness > 0
      ? Math.round(catalogThickness * 1000) / 1000
      : DEFAULT_BAR_THICKNESS_IN,
    centerToCenterIn: parsed.centerToCenterIn,
    measured,
    thicknessSource: catalogThickness != null && catalogThickness > 0 ? "catalog" : "default",
    unparseable: !measured,
  };
}

/**
 * Overall drawn box of one piece, in inches, before clamping to the cabinet
 * front. Width runs along the bar, height down the face. Knobs are square.
 */
export function hardwareDrawnSizeIn(spec: HardwareDrawSpec): { widthIn: number; heightIn: number } {
  const thickness = Math.max(0.18, spec.thicknessIn);
  if (spec.knob) {
    const diameter = Math.max(0.3, spec.lengthIn ?? thickness);
    return { widthIn: diameter, heightIn: diameter };
  }
  const length = Math.max(0.5, spec.lengthIn ?? thickness * 3);
  switch (spec.family) {
    case "cup-pull":
      return { widthIn: length, heightIn: Math.min(1.75, Math.max(1.1, length * 0.45)) };
    case "edge-pull":
      return { widthIn: length, heightIn: Math.max(0.55, thickness * 1.6) };
    case "arch-pull":
      return { widthIn: length, heightIn: Math.max(0.7, thickness * 3) };
    case "t-bar":
      return { widthIn: length, heightIn: Math.max(0.6, thickness * 2.6) };
    case "bar-pull":
    default:
      return { widthIn: length, heightIn: Math.max(0.55, thickness * 2.4) };
  }
}

/** A cup/edge/bin pull mounts on the opening edge; every other family sits on the front face. */
export function isEdgeMountedFamily(family: HardwareFamily): boolean {
  return family === "edge-pull";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface HardwarePlacementIn {
  /** Center of the piece measured from the left of the face box, in inches. */
  centerFromLeftIn: number;
  /** Center of the piece measured from the top of the face box, in inches. */
  centerFromTopIn: number;
  /** Drawn width/height after fitting inside the available front space. */
  widthIn: number;
  heightIn: number;
  /** True when the real size had to shrink to fit the front. */
  clamped: boolean;
  /** True when the piece is pinned to the front's top edge (edge/finger pull). */
  edgeMounted: boolean;
}

/**
 * Place one measured piece on a cabinet front. The real size is preserved
 * whenever it physically fits; it only shrinks (and says so) when the catalog
 * part is wider/taller than the front it must sit on.
 */
export function placeHardwarePiece(input: {
  spec: HardwareDrawSpec;
  faceWidthIn: number;
  faceHeightIn: number;
  /** Center from the left of the face, inches. */
  centerFromLeftIn: number;
  /** Center from the top of the face, inches. */
  centerFromTopIn: number;
  /** Vertical pieces (door pulls) rotate the bar down the face. */
  vertical: boolean;
  /** Usable band, in inches from the top of the face, that the piece may occupy. */
  bandTopIn?: number;
  bandHeightIn?: number;
}): HardwarePlacementIn {
  const size = hardwareDrawnSizeIn(input.spec);
  const faceWidth = Math.max(0.25, input.faceWidthIn);
  const faceHeight = Math.max(0.25, input.faceHeightIn);
  const longSide = size.widthIn;
  const shortSide = size.heightIn;
  const maxWidth = Math.max(0.25, faceWidth * 0.92);
  const bandTop = input.bandTopIn ?? 0;
  const bandHeight = Math.max(0.25, input.bandHeightIn ?? faceHeight);
  const maxHeight = Math.max(0.25, bandHeight * 0.92);

  let widthIn = input.vertical ? shortSide : longSide;
  let heightIn = input.vertical ? longSide : shortSide;
  let clamped = false;
  if (widthIn > maxWidth) {
    const scale = maxWidth / widthIn;
    widthIn = maxWidth;
    heightIn *= scale;
    clamped = true;
  }
  if (heightIn > maxHeight) {
    const scale = maxHeight / heightIn;
    heightIn = maxHeight;
    widthIn *= scale;
    clamped = true;
  }

  const edgeMounted = isEdgeMountedFamily(input.spec.family);
  const centerFromLeft = clamp(input.centerFromLeftIn, widthIn / 2, faceWidth - widthIn / 2);
  const centerFromTop = edgeMounted
    // A finger/tab pull is screwed to the top edge of the front, so its top
    // edge is the front's top edge rather than a point mid-face.
    ? bandTop + heightIn / 2
    : clamp(input.centerFromTopIn, bandTop + heightIn / 2, bandTop + bandHeight - heightIn / 2);

  return { centerFromLeftIn: centerFromLeft, centerFromTopIn: centerFromTop, widthIn, heightIn, clamped, edgeMounted };
}

export interface MeasuredHardwareGeometry {
  /** All values are percentages of the cabinet front box, so they scale with zoom. */
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  /** True when the catalog size is smaller than the front and drawn as measured. */
  fullSize: boolean;
  /** True when the piece was pinned to the front's top edge. */
  edgeMounted: boolean;
  /** Body inches actually drawn, for tests and title text. */
  drawnWidthIn: number;
  drawnHeightIn: number;
}

/**
 * Convert a measured piece into front-relative percentages. The elevation draws
 * cabinets at a computed pixels-per-inch scale, but the hardware overlay is a
 * percentage-positioned layer inside the front box, so inches become percentages
 * of the front's own width and height. That keeps the part's real size while the
 * whole drawing zooms.
 */
export function measuredHardwareGeometry(input: {
  spec: HardwareDrawSpec;
  faceWidthIn: number;
  faceHeightIn: number;
  centerFromLeftIn: number;
  centerFromTopIn: number;
  bandTopPct: number;
  bandHeightPct: number;
  /** Door pulls stand vertical; drawer pulls and top-rail pulls lie flat. */
  vertical: boolean;
}): MeasuredHardwareGeometry {
  const faceWidth = Math.max(0.25, input.faceWidthIn);
  const faceHeight = Math.max(0.25, input.faceHeightIn);
  const bandTopPct = Math.min(100, Math.max(0, input.bandTopPct));
  const bandHeightPct = Math.min(100 - bandTopPct, Math.max(0.5, input.bandHeightPct));
  const placement = placeHardwarePiece({
    spec: input.spec,
    faceWidthIn: faceWidth,
    faceHeightIn: faceHeight,
    centerFromLeftIn: input.centerFromLeftIn,
    centerFromTopIn: input.centerFromTopIn,
    vertical: input.vertical,
    bandTopIn: (bandTopPct / 100) * faceHeight,
    bandHeightIn: (bandHeightPct / 100) * faceHeight,
  });
  return {
    leftPct: (placement.centerFromLeftIn / faceWidth) * 100,
    topPct: (placement.centerFromTopIn / faceHeight) * 100,
    widthPct: (placement.widthIn / faceWidth) * 100,
    heightPct: (placement.heightIn / faceHeight) * 100,
    fullSize: !placement.clamped,
    edgeMounted: placement.edgeMounted,
    drawnWidthIn: placement.widthIn,
    drawnHeightIn: placement.heightIn,
  };
}

/** Mix two #rrggbb colors; returns a hex string usable as an SVG stop-color. */
export function mixHexColor(from: string, to: string, amount: number): string {
  const parse = (hex: string): [number, number, number] => {
    const value = hex.trim().replace("#", "");
    const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
    const numeric = Number.parseInt(full.slice(0, 6), 16);
    if (!Number.isFinite(numeric)) return [200, 204, 208];
    return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
  };
  const a = parse(from);
  const b = parse(to);
  const t = clamp(amount, 0, 1);
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * t).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
