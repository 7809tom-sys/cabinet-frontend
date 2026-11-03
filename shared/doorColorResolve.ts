/**
 * Door color, without brand snapping.
 *
 * Precedence, highest first (owner rule: the accepted render is the source of
 * truth for a door's color):
 * 0. The latest ACCEPTED door-rendering run for this style — its derived color
 *    and its approved door image/texture. An admin approving a render changes
 *    every kitchen on the next read.
 * 1. A hand-set render hex on the style (an explicit correction).
 * 2. The style's own saved catalog color (the color an admin saved on the style).
 * 3. WalzCraft ColorPatterns primary shade (data/door-colors/ColorPatterns_*.csv),
 *    matched by distributor plus style code or door name.
 * 4. A hex estimator (name / color type, or the DL door-photo solid when the name
 *    is silent). A guide only. It never overrides layers 0–3.
 * 5. The color the door rendered with before PR 209: a DL finish solid, otherwise
 *    the catalog hex, then the name table (main at 8df3a43, resolveDoorFinishHex).
 *
 * The measured swatch table (cabinet-backend PR 72, data/door-colors/swatch-hex.json)
 * sits at layer 2, but a row an operator marks `demoted` is never a candidate. Tom
 * found that the Shaker Honey row was a nearest paint-chip match (#c8a040), not the
 * door's original color, and that a paint match was painting doors instead of the
 * door itself. A demoted row is reported for review and never applied.
 *
 * After a layer picks a hex, an independent estimator concurs or objects. A
 * disagreement never replaces an accepted render, a hand-set hex, or a saved
 * color; every other disagreement keeps the pre-209 color and sets
 * needsColorReview. Nothing is snapped to cream, green, or gold.
 *
 * Geometry is not decided here.
 */
import { CABINET_NAME_COLORS, matchCabinetColorName } from "./cabinetColorNames";
import { deltaE2000Hex, parseHex } from "./ciede2000";
import { isAspenCharcoalIdentity } from "./doorRenderIdentity";
import { findDlcFinishForStyle, type DlcStyleInput } from "./dlcFr26Mapping";
import swatchRows from "../data/door-colors/swatch-hex.json";
import walzRows from "../data/door-colors/walzcraft-color-patterns.json";

export const DOOR_COLOR_AGREE_DELTA_E = 10;

/** Aspen Charcoal stain. Same value resolveDoorFinishHex used before PR 209. */
const ASPEN_CHARCOAL_STAIN = "#2a211c";

/**
 * Colors a style rendered in before the Nov 2 2026 paint match, for the styles
 * whose saved catalog color that patch overwrote with a nearest paint-chip match.
 *
 * These are what the kitchen falls back to when no accepted render exists yet, and
 * what the resolver uses in place of a paint-matched saved color.
 *
 * Shaker Honey (330021, SH, Madison) is the case that exposed this. The door is a
 * solid birch shaker with a clear stained finish (`finish: "Stained"` in the
 * Madison catalog), so it is a grain, not an opaque paint. Before the paint match
 * it rendered the name table's `honey -> natural` tone `#d1ba8f`; the paint match
 * replaced that with the flat golden `#c8a040`, which is not a color this door was
 * ever measured in and which the name estimator still rejects (ΔE 12.3).
 */
export const PRE_PAINT_MATCH_ORIGINALS: Readonly<Record<number, { hex: string; category: FinishCategory }>> = {
  330021: { hex: "#d1ba8f", category: "stain" },
};

export type FinishCategory = "paint" | "stain";
export type DoorColorSource = "accepted-render" | "render-hex" | "catalog-color" | "swatch-table" | "walzcraft" | "estimator" | "pre-209";
export type HueFamily = "neutral" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "brown";

/**
 * What the audit accepted for a style: the run's derived color and the approved
 * render an operator signed off on. `doorStyles.acceptedAppearance` returns this
 * shape, and it is the one source allowed to outrank everything else.
 *
 * The client's concrete row type is `AcceptedAppearanceRow` in
 * `client/src/lib/acceptedDoorAppearance.ts`; this is the shared contract.
 */
export type AcceptedDoorAppearance = {
  colorHex?: string | null;
  /** The accepted render itself, used as the door's texture. */
  textureUrl?: string | null;
  approvedVersionId?: number | null;
};

export type DoorColorInput = {
  id?: number | null;
  distributorId?: number | null;
  distributorName?: string | null;
  supplierBrandName?: string | null;
  styleCode?: string | null;
  code?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  name?: string | null;
  color?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
  doorStyle?: string | null;
  /**
   * The latest ACCEPTED door-rendering run's color for this style. Written back
   * onto the door style when an admin accepts a run, and cleared on revoke or
   * revert, so every kitchen follows the newest approved render with no manual
   * step. This is the highest-precedence source.
   */
  renderHex?: string | null;
  /** The accepted run's approved door image, used as the kitchen's face texture. */
  approvedReferenceImageUrl?: string | null;
  /** Non-null only when an admin actually accepted a run for this style. */
  approvedVersionId?: number | null;
};

type SwatchRow = {
  id: number;
  style: string;
  category: FinishCategory;
  hex: string;
  /**
   * True when this row is a nearest paint-chip match rather than a measurement
   * of a real door. A demoted row is never applied to a door, whatever layer it
   * would otherwise occupy.
   */
  demoted?: boolean;
};
type WalzRow = {
  distributor: string;
  code: string;
  doorName: string;
  colorType: string;
  category: FinishCategory | null;
  woodSpecies: string;
  primaryName: string;
  primaryHex: string | null;
  sourceFile: string;
};

type LayerHit = { hex: string; category: FinishCategory; source: DoorColorSource; via?: string; label?: string };

export type DoorColorReview = {
  needsColorReview: boolean;
  chosenHex: string;
  chosenSource: DoorColorSource;
  chosenCategory: FinishCategory;
  estimatorHex: string | null;
  estimatorCategory: FinishCategory | null;
  estimatorSource: string | null;
  deltaE: number | null;
  hueChosen: HueFamily | null;
  hueEstimator: HueFamily | null;
  keptBecause: "agreed" | "accepted-render" | "hand-set-render-hex" | "saved-catalog-color" | "estimator-disagreed" | "no-second-opinion";
};

export type DoorColorDecision = {
  appliedHex: string;
  appliedCategory: FinishCategory;
  appliedSource: DoorColorSource;
  /** Paint is an opaque solid. Stain keeps a grain texture tinted toward appliedHex. */
  usesGrain: boolean;
  candidateHex: string;
  candidateSource: DoorColorSource;
  candidateCategory: FinishCategory;
  pre209Hex: string;
  pre209Category: FinishCategory;
  review: DoorColorReview;
  layers: {
    /** The accepted run's color, when this style has one. */
    acceptedRender: LayerHit | null;
    renderHex: string | null;
    /** The style's own saved catalog color, when it has one. */
    catalogColor: LayerHit | null;
    swatch: LayerHit | null;
    walzcraft: LayerHit | null;
    estimator: LayerHit | null;
    pre209: LayerHit;
  };
};

const swatches = swatchRows as SwatchRow[];
const walz = walzRows as WalzRow[];

const swatchById = new Map(swatches.map((row) => [row.id, row]));
const swatchByName = new Map(swatches.map((row) => [normalizeName(row.style), row]));

function exactHex(value: string | null | undefined): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec((value ?? "").trim());
  return match ? `#${match[1]!.toLowerCase()}` : null;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\bgray\b/g, "grey")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value: string): string {
  return normalizeName(value).replace(/\s+/g, "");
}

function styleCodes(style: DoorColorInput): string[] {
  const codes: string[] = [];
  const push = (code: string) => {
    if (code && !codes.includes(code)) codes.push(code);
  };
  for (const raw of [style.styleCode, style.code]) {
    const code = (raw ?? "").trim().toUpperCase();
    if (!code) continue;
    push(code);
    push(code.replace(/^DL-/, ""));
  }
  return codes;
}

function textOf(style: DoorColorInput): string {
  return [style.ourName, style.aliasName, style.name, style.finish, style.color, style.woodSpecies, style.doorStyle]
    .filter(Boolean)
    .join(" ");
}

/** Paint words win. A named wood (oak, hickory, walnut, and the rest) is a stain. */
export function finishCategoryFromNames(style: DoorColorInput): FinishCategory {
  // A style whose pre-paint-match original is stated also has its finish category
  // stated there, so the name guess cannot contradict it. Shaker Honey is a stained
  // birch shaker; reading its species text as "paint" flagged the door against
  // itself at ΔE 0.
  const known = style.id != null ? PRE_PAINT_MATCH_ORIGINALS[style.id] : undefined;
  if (known) return known.category;
  const name = `${style.ourName ?? ""} ${style.aliasName ?? ""} ${style.name ?? ""} ${style.finish ?? ""} ${style.color ?? ""}`.toLowerCase();
  const species = (style.woodSpecies ?? "").toLowerCase();
  if (/\bhickory\b/.test(name) || /\bhickory\b/.test(species)) return "stain";
  if (/\bpaint/.test(name) || /\bpaint/.test(species)) return "paint";
  if (/\b(?:hickory|oak|walnut|cherry|maple|pecan|rift)\b/.test(name)) return "stain";
  if (/\b(?:hickory|oak|walnut|cherry|maple|pecan)\b/.test(species)) return "stain";
  return "paint";
}

function dlcCategory(style: DoorColorInput): FinishCategory | null {
  const entry = findDlcFinishForStyle(style as DlcStyleInput);
  if (!entry) return null;
  if (finishCategoryFromNames(style) === "stain") return "stain";
  return entry.grainPaleSoftened ? "paint" : "stain";
}

/** Coarse hue. Low chroma is neutral, so a gray stays in the gray family. */
export function hueFamily(hex: string): HueFamily | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const chroma = max - min;
  if (chroma < 18) return "neutral";
  let hue = 0;
  if (max === rgb.r) hue = ((rgb.g - rgb.b) / chroma) % 6;
  else if (max === rgb.g) hue = (rgb.b - rgb.r) / chroma + 2;
  else hue = (rgb.r - rgb.g) / chroma + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  const lightness = (max + min) / 2;
  if ((hue < 50 || hue >= 345) && lightness < 150 && chroma < 90) return "brown";
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 170) return "green";
  if (hue < 255) return "blue";
  return "purple";
}

function nameEstimate(style: DoorColorInput): LayerHit | null {
  if (isAspenCharcoalIdentity(style)) {
    return { hex: ASPEN_CHARCOAL_STAIN, category: "stain", source: "estimator", via: "name", label: "Aspen Charcoal stain" };
  }
  const hex = matchCabinetColorName(textOf(style));
  if (!hex) return null;
  return { hex, category: finishCategoryFromNames(style), source: "estimator", via: "name", label: "name / color type" };
}

function dlcPhotoEstimate(style: DoorColorInput): LayerHit | null {
  const entry = findDlcFinishForStyle(style as DlcStyleInput);
  const category = dlcCategory(style);
  if (!entry || !category) return null;
  return { hex: entry.solidColor.toLowerCase(), category, source: "estimator", via: "dlc-photo", label: `DL photo ${entry.slug}` };
}

/** Independent of layers 0–2. Name first, then the DL door-photo solid. */
export function estimateDoorHex(style: DoorColorInput): LayerHit | null {
  return nameEstimate(style) ?? dlcPhotoEstimate(style);
}

function lookupSwatch(style: DoorColorInput): LayerHit | null {
  const byId = style.id != null ? swatchById.get(style.id) : undefined;
  const byOur = swatchByName.get(normalizeName(style.ourName));
  const byAlias = swatchByName.get(normalizeName(style.aliasName));
  const byName = swatchByName.get(normalizeName(style.name));
  const row = byId ?? byOur ?? byAlias ?? byName;
  // A demoted row is a paint match, not a measurement. It is never a candidate.
  if (!row || row.demoted) return null;
  return { hex: row.hex, category: row.category, source: "swatch-table", label: `${row.id} ${row.style}` };
}

/** A demoted swatch row for this style, reported for review only. Never applied. */
export function demotedSwatchRow(style: DoorColorInput): LayerHit | null {
  const byId = style.id != null ? swatchById.get(style.id) : undefined;
  const byOur = swatchByName.get(normalizeName(style.ourName));
  const row = byId ?? byOur;
  if (!row?.demoted) return null;
  return { hex: row.hex, category: row.category, source: "swatch-table", via: "demoted-paint-match", label: `${row.id} ${row.style}` };
}

/**
 * The color a door rendered in before the paint match, when its saved color was
 * overwritten by a nearest paint-chip match. Null for every other style, so the
 * ordinary layers decide.
 */
export function prePaintMatchOriginal(style: DoorColorInput): LayerHit | null {
  const original = style.id != null ? PRE_PAINT_MATCH_ORIGINALS[style.id] : undefined;
  if (!original) return null;
  return {
    hex: original.hex,
    category: original.category,
    source: "catalog-color",
    via: "pre-paint-match",
    label: "color before the paint match",
  };
}

/**
 * True when this style's saved catalog color is the paint-match value itself.
 * Its own saved color is then a paint match rather than a decision, so a higher
 * layer (or the pre-paint-match original) must win.
 */
export function savedColorIsPaintMatch(style: DoorColorInput): boolean {
  const original = style.id != null ? PRE_PAINT_MATCH_ORIGINALS[style.id] : undefined;
  const saved = exactHex(style.color);
  const demoted = demotedSwatchRow(style);
  if (!original || !saved) return false;
  const paintMatchValues = new Set([demoted?.hex.toLowerCase()].filter(Boolean));
  return saved !== original.hex && paintMatchValues.has(saved);
}

/**
 * Distributor ids in this catalog, and the ColorPatterns sheet that uses the
 * same style codes. Ashford's CC/WS/HS sheet is Faircrest. Madison's SW/SN
 * sheet is Kitchen Crest. Preston has no ColorPatterns file.
 */
function distributorKeys(style: DoorColorInput): string[] {
  const keys = [style.supplierBrandName, style.distributorName];
  if (style.distributorId === 450001) keys.push("DL Cabinetry");
  if (style.distributorId === 270001) keys.push("Alta Euro", "AltaEuro");
  if (style.distributorId === 210001) keys.push("Faircrest");
  if (style.distributorId === 210002) keys.push("Kitchen Crest");
  return keys.filter((key): key is string => Boolean(key && key.trim()));
}

function sameDistributor(csvDistributor: string, keys: string[]): boolean {
  const csvKey = compact(csvDistributor);
  return keys.some((key) => compact(key) === csvKey);
}

function lookupWalz(style: DoorColorInput): LayerHit | null {
  const keys = distributorKeys(style);
  if (keys.length === 0) return null;
  const codes = new Set(styleCodes(style));
  const names = new Set([style.ourName, style.aliasName, style.name].map((name) => normalizeName(name)).filter(Boolean));
  const rows = walz.filter((row) => row.primaryHex && row.category && sameDistributor(row.distributor, keys));
  const byCode = rows.find((row) => codes.has(row.code.toUpperCase()));
  const byName = rows.find((row) => names.has(normalizeName(row.doorName)));
  const row = byCode ?? byName;
  if (!row?.primaryHex || !row.category) return null;
  return {
    hex: row.primaryHex,
    category: row.category,
    source: "walzcraft",
    label: `${row.distributor} ${row.code} ${row.doorName}`,
  };
}

/**
 * Color that door used before PR 209's brand snap.
 * DL finishes rendered their catalog finish solid (resolveDoorFinishHex at 8df3a43
 * preferred that over a stale color column). Everyone else used a catalog hex,
 * then the name table, then the off-white default. Never a nearest brand swatch.
 *
 * A style whose saved color was overwritten by a nearest paint-chip match reports
 * its pre-paint-match value first, so a paint match can never stand in for the
 * door's own color again.
 */
export function pre209DoorColor(style: DoorColorInput): LayerHit {
  const original = prePaintMatchOriginal(style);
  if (original) return { ...original, source: "pre-209", via: "pre-paint-match" };
  const photo = dlcPhotoEstimate(style);
  if (photo) return { ...photo, source: "pre-209", via: "dlc-photo" };
  const aspen = isAspenCharcoalIdentity(style);
  const catalog = exactHex(style.color);
  if (catalog) {
    return { hex: catalog, category: aspen ? "stain" : finishCategoryFromNames(style), source: "pre-209", via: "catalog-hex" };
  }
  if (aspen) return { hex: ASPEN_CHARCOAL_STAIN, category: "stain", source: "pre-209", via: "aspen" };
  const named = matchCabinetColorName(textOf(style));
  if (named) return { hex: named, category: finishCategoryFromNames(style), source: "pre-209", via: "name" };
  return { hex: CABINET_NAME_COLORS.default, category: finishCategoryFromNames(style), source: "pre-209", via: "default" };
}

function candidateCategory(style: DoorColorInput, hit: LayerHit): FinishCategory {
  if (hit.source === "render-hex" || hit.source === "accepted-render") {
    return lookupSwatch(style)?.category ?? lookupWalz(style)?.category ?? finishCategoryFromNames(style);
  }
  if (/\bhickory\b/i.test(textOf(style))) return "stain";
  return hit.category;
}

function secondOpinion(style: DoorColorInput, candidate: LayerHit): LayerHit | null {
  const name = nameEstimate(style);
  const photo = dlcPhotoEstimate(style);
  if (candidate.source !== "estimator") return name ?? photo;
  if (candidate.via === "name" && photo && photo.hex !== candidate.hex) return photo;
  if (candidate.via === "dlc-photo" && name && name.hex !== candidate.hex) return name;
  return null;
}

function colorsAgree(chosen: LayerHit, estimate: LayerHit): { agree: boolean; deltaE: number | null } {
  const deltaE = deltaE2000Hex(chosen.hex, estimate.hex);
  const sameHue = hueFamily(chosen.hex) === hueFamily(estimate.hex);
  const sameCategory = chosen.category === estimate.category;
  const agree = deltaE != null && deltaE <= DOOR_COLOR_AGREE_DELTA_E && sameHue && sameCategory;
  return { agree, deltaE };
}

/** The style's own saved catalog color: what an admin saved on the style itself. */
function savedCatalogColor(style: DoorColorInput): LayerHit | null {
  const hex = exactHex(style.color);
  if (!hex) return null;
  // A saved color that IS the paint match is not a decision: it is what the
  // paint-match patch wrote. The pre-paint-match original speaks instead.
  if (savedColorIsPaintMatch(style)) return null;
  return { hex, category: finishCategoryFromNames(style), source: "catalog-color", via: "saved" };
}

/**
 * True when an admin actually accepted a door-rendering run for this style.
 * A `renderHex` alone is not proof: an admin can type a color into the style
 * editor without ever accepting a run, and that must not be called accepted.
 */
export function hasAcceptedRun(style: DoorColorInput | null | undefined): boolean {
  return Boolean(style && style.approvedVersionId != null);
}

/**
 * The accepted run's color: the color derived from the accepted render, which is
 * what the audit signed off on. Null when no run was accepted, so a hand-typed
 * hex never masquerades as one.
 */
function acceptedRenderColor(style: DoorColorInput): LayerHit | null {
  if (!hasAcceptedRun(style)) return null;
  const hex = exactHex(style.renderHex);
  if (!hex) return null;
  return { hex, category: finishCategoryFromNames(style), source: "accepted-render", via: "accepted-run", label: "accepted render" };
}

export function resolveDoorColor(style: DoorColorInput | null | undefined): DoorColorDecision {
  const input = style ?? {};
  // The accepted render is the source of truth for a door's color. Approving a
  // run writes its color and image onto the style, so an accepted render IS the
  // kitchen's color with no further step. A hand-set render hex is the next layer.
  const acceptedRender = acceptedRenderColor(input);
  const renderHex = exactHex(input.renderHex);
  const handSetRender = !acceptedRender && renderHex
    ? { hex: renderHex, category: "paint" as FinishCategory, source: "render-hex" as DoorColorSource }
    : null;
  const saved = savedCatalogColor(input);
  // The pre-paint-match original is stated knowledge about this door, so it is a
  // candidate in its own right: it sits above the guessed tables but below any
  // saved color or accepted render.
  const original = prePaintMatchOriginal(input);
  const swatch = lookupSwatch(input);
  const walzcraft = lookupWalz(input);
  const estimator = estimateDoorHex(input);
  const pre209 = pre209DoorColor(input);
  // The measured swatch table is still consulted, but a row marked `demoted` is a
  // nearest paint-chip match rather than a measurement of a door, so `lookupSwatch`
  // never returns it. Shaker Honey's `#c8a040` is exactly that case.
  const candidate = acceptedRender ?? handSetRender ?? saved ?? original ?? swatch ?? walzcraft ?? estimator ?? pre209;
  const chosen: LayerHit = { ...candidate, category: candidateCategory(input, candidate) };
  const opinion = secondOpinion(input, chosen);
  const compared = opinion ? colorsAgree(chosen, opinion) : null;

  let applied = chosen;
  let keptBecause: DoorColorReview["keptBecause"] = "agreed";
  let needsColorReview = false;
  if (!opinion) {
    keptBecause = "no-second-opinion";
  } else if (!compared?.agree) {
    needsColorReview = true;
    // An accepted render, a hand-set render hex, or the style's own saved catalog
    // color is a decision, not a guess: the estimator never overrides it. Only a
    // guessed layer can be replaced by the pre-209 color.
    if (chosen.source === "accepted-render") {
      keptBecause = "accepted-render";
    } else if (chosen.source === "render-hex") {
      keptBecause = "hand-set-render-hex";
    } else if (chosen.source === "catalog-color") {
      keptBecause = "saved-catalog-color";
    } else {
      applied = pre209;
      keptBecause = "estimator-disagreed";
    }
  }

  const hickory = /\bhickory\b/i.test(textOf(input));
  const appliedCategory: FinishCategory = hickory ? "stain" : applied.category;
  return {
    appliedHex: applied.hex,
    appliedCategory,
    appliedSource: applied.source,
    usesGrain: appliedCategory === "stain",
    candidateHex: chosen.hex,
    candidateSource: chosen.source,
    candidateCategory: chosen.category,
    pre209Hex: pre209.hex,
    pre209Category: pre209.category,
    review: {
      needsColorReview,
      chosenHex: chosen.hex,
      chosenSource: chosen.source,
      chosenCategory: chosen.category,
      estimatorHex: opinion?.hex ?? null,
      estimatorCategory: opinion?.category ?? null,
      estimatorSource: opinion?.via ?? null,
      deltaE: compared?.deltaE ?? null,
      hueChosen: hueFamily(chosen.hex),
      hueEstimator: opinion ? hueFamily(opinion.hex) : null,
      keptBecause,
    },
    layers: { acceptedRender, renderHex, catalogColor: saved, swatch, walzcraft, estimator, pre209 },
  };
}

export type DoorColorCoverage = {
  doors: number;
  candidate: Record<DoorColorSource, number>;
  applied: Record<DoorColorSource, number>;
  layerPresent: Record<DoorColorSource, number>;
  agreed: number;
  flagged: number;
  flaggedKeptRenderHex: number;
  flaggedKeptAcceptedRender: number;
  flaggedKeptPre209: number;
  noSecondOpinion: number;
  swatchTableRows: number;
  walzRows: number;
  walzRowsWithHex: number;
};

export function summarizeDoorColors(styles: readonly DoorColorInput[]): DoorColorCoverage {
  const candidate: Record<DoorColorSource, number> = { "accepted-render": 0, "render-hex": 0, "catalog-color": 0, "swatch-table": 0, walzcraft: 0, estimator: 0, "pre-209": 0 };
  const applied: Record<DoorColorSource, number> = { ...candidate };
  const layerPresent: Record<DoorColorSource, number> = {
    "accepted-render": 0, "render-hex": 0, "catalog-color": 0, "swatch-table": 0, walzcraft: 0, estimator: 0, "pre-209": 0,
  };
  let agreed = 0;
  let flagged = 0;
  let flaggedKeptRenderHex = 0;
  let flaggedKeptAcceptedRender = 0;
  let flaggedKeptPre209 = 0;
  let noSecondOpinion = 0;
  for (const style of styles) {
    const decision = resolveDoorColor(style);
    candidate[decision.candidateSource] += 1;
    applied[decision.appliedSource] += 1;
    if (decision.layers.acceptedRender) layerPresent["accepted-render"] += 1;
    if (decision.layers.renderHex) layerPresent["render-hex"] += 1;
    if (decision.layers.catalogColor) layerPresent["catalog-color"] += 1;
    if (decision.layers.swatch) layerPresent["swatch-table"] += 1;
    if (decision.layers.walzcraft) layerPresent.walzcraft += 1;
    if (decision.layers.estimator) layerPresent.estimator += 1;
    layerPresent["pre-209"] += 1;
    if (decision.review.needsColorReview) {
      flagged += 1;
      if (decision.review.keptBecause === "accepted-render") flaggedKeptAcceptedRender += 1;
      if (decision.review.keptBecause === "hand-set-render-hex" || decision.review.keptBecause === "saved-catalog-color") flaggedKeptRenderHex += 1;
      if (decision.review.keptBecause === "estimator-disagreed") flaggedKeptPre209 += 1;
    } else if (decision.review.keptBecause === "no-second-opinion") noSecondOpinion += 1;
    else agreed += 1;
  }
  return {
    doors: styles.length,
    candidate,
    applied,
    layerPresent,
    agreed,
    flagged,
    flaggedKeptRenderHex,
    flaggedKeptAcceptedRender,
    flaggedKeptPre209,
    noSecondOpinion,
    swatchTableRows: swatches.length,
    walzRows: walz.length,
    walzRowsWithHex: walz.filter((row) => row.primaryHex).length,
  };
}

export const SWATCH_HEX_TABLE: readonly SwatchRow[] = swatches;
export const WALZCRAFT_COLOR_PATTERNS: readonly WalzRow[] = walz;
