/**
 * Door color, without brand snapping.
 *
 * Precedence, highest first:
 * 0. A hand-set renderHex always wins.
 * 1. Measured swatch hex from cabinet-backend PR 72 (data/door-colors/swatch-hex.json).
 * 2. WalzCraft ColorPatterns primary shade (data/door-colors/ColorPatterns_*.csv),
 *    matched by distributor plus style code or door name.
 * 3. A hex estimator (name / color type, or the DL door-photo solid when the name
 *    is silent). A guide only. It never overrides layers 0–2.
 * 4. The color the door rendered with before PR 209: a DL finish solid, otherwise
 *    the catalog hex, then the name table (main at 8df3a43, resolveDoorFinishHex).
 *
 * After a layer picks a hex, an independent estimator concurs or objects.
 * Agreement needs CIEDE2000 ≤ 10, the same paint-vs-stain category, and the same
 * hue family. A disagreement does not replace a hand-set renderHex. Every other
 * disagreement keeps the pre-209 color and sets needsColorReview. Nothing is
 * snapped to cream, green, or gold.
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

export type FinishCategory = "paint" | "stain";
export type DoorColorSource = "render-hex" | "swatch-table" | "walzcraft" | "estimator" | "pre-209";
export type HueFamily = "neutral" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "brown";

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
  renderHex?: string | null;
};

type SwatchRow = { id: number; style: string; category: FinishCategory; hex: string };
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
  keptBecause: "agreed" | "hand-set-render-hex" | "estimator-disagreed" | "no-second-opinion";
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
    renderHex: string | null;
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
  if (!row) return null;
  return { hex: row.hex, category: row.category, source: "swatch-table", label: `${row.id} ${row.style}` };
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
 */
export function pre209DoorColor(style: DoorColorInput): LayerHit {
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
  if (hit.source === "render-hex") {
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

export function resolveDoorColor(style: DoorColorInput | null | undefined): DoorColorDecision {
  const input = style ?? {};
  const renderHex = exactHex(input.renderHex);
  const swatch = lookupSwatch(input);
  const walzcraft = lookupWalz(input);
  const estimator = estimateDoorHex(input);
  const pre209 = pre209DoorColor(input);
  const candidate = renderHex
    ? { hex: renderHex, category: "paint" as FinishCategory, source: "render-hex" as DoorColorSource }
    : swatch ?? walzcraft ?? estimator ?? pre209;
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
    if (chosen.source === "render-hex") {
      keptBecause = "hand-set-render-hex";
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
    layers: { renderHex, swatch, walzcraft, estimator, pre209 },
  };
}

export type DoorColorCoverage = {
  doors: number;
  candidate: Record<DoorColorSource, number>;
  applied: Record<DoorColorSource, number>;
  layerPresent: Record<Exclude<DoorColorSource, "pre-209"> | "pre-209", number>;
  agreed: number;
  flagged: number;
  flaggedKeptRenderHex: number;
  flaggedKeptPre209: number;
  noSecondOpinion: number;
  swatchTableRows: number;
  walzRows: number;
  walzRowsWithHex: number;
};

export function summarizeDoorColors(styles: readonly DoorColorInput[]): DoorColorCoverage {
  const candidate: Record<DoorColorSource, number> = { "render-hex": 0, "swatch-table": 0, walzcraft: 0, estimator: 0, "pre-209": 0 };
  const applied: Record<DoorColorSource, number> = { ...candidate };
  const layerPresent = { "render-hex": 0, "swatch-table": 0, walzcraft: 0, estimator: 0, "pre-209": 0 };
  let agreed = 0;
  let flagged = 0;
  let flaggedKeptRenderHex = 0;
  let flaggedKeptPre209 = 0;
  let noSecondOpinion = 0;
  for (const style of styles) {
    const decision = resolveDoorColor(style);
    candidate[decision.candidateSource] += 1;
    applied[decision.appliedSource] += 1;
    if (decision.layers.renderHex) layerPresent["render-hex"] += 1;
    if (decision.layers.swatch) layerPresent["swatch-table"] += 1;
    if (decision.layers.walzcraft) layerPresent.walzcraft += 1;
    if (decision.layers.estimator) layerPresent.estimator += 1;
    layerPresent["pre-209"] += 1;
    if (decision.review.needsColorReview) {
      flagged += 1;
      if (decision.review.keptBecause === "hand-set-render-hex") flaggedKeptRenderHex += 1;
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
    flaggedKeptPre209,
    noSecondOpinion,
    swatchTableRows: swatches.length,
    walzRows: walz.length,
    walzRowsWithHex: walz.filter((row) => row.primaryHex).length,
  };
}

export const SWATCH_HEX_TABLE: readonly SwatchRow[] = swatches;
export const WALZCRAFT_COLOR_PATTERNS: readonly WalzRow[] = walz;
