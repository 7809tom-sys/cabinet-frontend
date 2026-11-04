/**
 * HARD RULE (Tom, Nov 1 2026): ALL 2.75 in and 3 in shaker doors start from the DL Shaker
 * blueprint as the base template. Geometry (rail/stile frame, sharp square corners, flat
 * center slab, notch) is proven and must not be changed per style. Only texture/color varies.
 *
 * Color (Tom, Nov 2 2026): the door keeps its own hex. Precedence is the latest ACCEPTED
 * render, then a hand-set renderHex, then the style's saved catalog color, then a
 * WalzCraft ColorPatterns primary shade, then a name/photo estimate, then the pre-209
 * catalog hex or name. A nearest-brand snap (sample cream, cream, green, gold) is what
 * turned Stone Gray into cream and Slate Rift into green, and a nearest paint-chip match
 * is what painted Shaker Honey #c8a040. Neither is applied. Paint is an opaque solid.
 * Stain keeps the grain and a tint toward the door's own hex. Rail and stile WIDTH stay
 * the style's own 2.75 or 3 inches. Depth, square corners, the flat center slab, and the
 * notch are shared.
 */
import { CABINET_NAME_COLORS, matchCabinetColorName } from "./cabinetColorNames";
import { deltaE2000Hex } from "./ciede2000";
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import { doorProfileConstructionText, doorProfileIsSlabOrGlass, doorProfileNameText, type DoorProfileIdentityInput } from "./doorProfileIdentity";
import { DLC_FR26_CATALOG, type DlcFr26CatalogEntry } from "./dlcFr26Catalog.generated";
import { DLC_FRAME_DETAIL } from "./dlcFr26Textures";
import { findDlcFinishForStyle, type DlcStyleInput } from "./dlcFr26Mapping";
import type { CabinetFacePlan } from "./doorFaceRecognition";

/** Brand palette. Used for UI tints AND on shaker door surfaces. */
export const SHAKER_BRAND_UI_PALETTE = ["#fffdf9", "#f6f3ed", "#244338", "#d7a46c"] as const;

/** Door-surface color measured from the uploaded Faircrest Classic Cream door sample photo. */
export const FAIRCREST_CLASSIC_CREAM_SAMPLE_HEX = "#dedac6";

/** Old brand-surface list. Reported so a review can show the snap that is no longer applied. */
export const SHAKER_BRAND_DOOR_SURFACE_PALETTE = [FAIRCREST_CLASSIC_CREAM_SAMPLE_HEX, ...SHAKER_BRAND_UI_PALETTE] as const;

/**
 * Nearest brand swatch. Not painted on a door. Stone Gray and other grays used to
 * land on cream or green through this function.
 */
export function brandDoorSurfaceHex(ownColor: string): string {
  let best: string = SHAKER_BRAND_DOOR_SURFACE_PALETTE[0];
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const hex of SHAKER_BRAND_DOOR_SURFACE_PALETTE) {
    const delta = deltaE2000Hex(ownColor, hex) ?? Number.POSITIVE_INFINITY;
    if (delta < bestDelta) { best = hex; bestDelta = delta; }
  }
  return best;
}

/** Designer default when a plain Shaker record does not store a rail width. */
export const STANDARD_SHAKER_RAIL_IN = 3;

export const DL_SHAKER_GEOMETRY = {
  corners: "square",
  center: "flat-slab",
  notch: "shared-shaker-notch",
  railDepth: DLC_FRAME_DETAIL.railDepth,
} as const;

/** Named standard shakers in the DLC finish catalog. Slim is not included. */
export const STANDARD_DL_SHAKER_SLUGS = ["white-shaker", "grey-shaker", "versa-shaker", "expresso-shaker"] as const;

export type DlShakerSlug = (typeof STANDARD_DL_SHAKER_SLUGS)[number];
export type ShakerFinishFamily = "painted" | "wood";

export type ShakerStyleInput = DoorColorInput & {
  doorPanelType?: string | null;
  profileDescription?: string | null;
  profileNotes?: string | null;
  color?: string | null;
  renderHex?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
  distributorName?: string | null;
  supplierBrandName?: string | null;
  railWidth?: string | number | null;
  stileWidth?: string | number | null;
};

export type DlShakerReference = {
  slug: DlShakerSlug;
  name: string;
  color: string;
  grain: string;
  family: ShakerFinishFamily;
  grainPaleSoftened: boolean;
  entry: DlcFr26CatalogEntry;
};

export type ShakerAdoption =
  | {
      adopted: true;
      reference: DlShakerReference;
      ownColor: string;
      /** Hex actually rendered. Never a nearest brand swatch. */
      surfaceColor: string;
      family: ShakerFinishFamily;
      railIn: number;
      deltaE: number;
      tintHex: string;
      tintClamped: boolean;
      grain: string;
      reason: string;
    }
  | {
      adopted: false;
      reason: string;
      railIn: number | null;
    };

const DISTRIBUTOR_NAMES: Record<number, string> = {
  180001: "Preston",
  210001: "Ashford",
  210002: "Madison",
  270001: "Alta Euro",
  450001: "DL Cabinetry",
};

function hexOf(value: string | null | undefined): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec((value ?? "").trim());
  return match ? `#${match[1]!.toLowerCase()}` : null;
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}

/** sRGB relative luminance, 0 to 1. DL does not store light/medium/dark buckets. */
export function shakerSrgbLuminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function distributorLabel(id: number | null | undefined): string {
  if (id == null) return "Unknown";
  return DISTRIBUTOR_NAMES[id] ?? `Distributor ${id}`;
}

/**
 * The shaker family of a door style, case-insensitively.
 *
 * The construction fields (`doorStyle`, `doorPanelType`, profile notes) decide
 * first. Only when they never mention shaker does the style's own name decide, so
 * "Shaker Honey" with a blank `doorStyle` is a shaker, "SHAKER" and "shaker" are
 * the same style, and a name never overrules an explicit build.
 *
 * A style whose construction says slab or glass is never a shaker. Pass the whole
 * record where you have it; the bare `doorStyle` string still works for callers
 * that only hold that field.
 */
export function shakerDoorFamily(
  style: string | ShakerStyleInput | null | undefined,
): "shaker" | "slim-shaker" | "double-shaker" | "other" {
  const input: DoorProfileIdentityInput | null | undefined = typeof style === "string" || style == null
    ? { doorStyle: (style as string | null | undefined) ?? null }
    : style;
  const construction = doorProfileConstructionText(input);
  // The words that classify a shaker build, in the order they matter.
  const classify = (text: string): "shaker" | "slim-shaker" | "double-shaker" | "other" | null => {
    if (!/shaker/.test(text)) return null;
    if (/\b(?:slim|narrow|skinny|thin[\s-]?frame)\b/.test(text)) return "slim-shaker";
    if (/\bdouble\b/.test(text)) return "double-shaker";
    return "shaker";
  };
  const byConstruction = classify(construction);
  if (byConstruction) return byConstruction;
  // The construction fields spoke and did not say shaker: they win.
  if (construction) return "other";
  if (doorProfileIsSlabOrGlass(input)) return "other";
  return classify(doorProfileNameText(input)) ?? "other";
}

export function isStandardShakerRail(inches: number | null | undefined): boolean {
  if (inches == null || !Number.isFinite(inches)) return false;
  return Math.abs(inches - 2.75) < 0.02 || Math.abs(inches - STANDARD_SHAKER_RAIL_IN) < 0.02;
}

function parsedInches(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Plain Shaker with no stored rail uses the 3 inch Designer default. Slim and double do not. */
export function effectiveShakerRailIn(style: ShakerStyleInput): number | null {
  const stored = parsedInches(style.railWidth) ?? parsedInches(style.stileWidth);
  if (stored != null) return stored;
  return shakerDoorFamily(style) === "shaker" ? STANDARD_SHAKER_RAIL_IN : null;
}

export function styleOwnColor(style: ShakerStyleInput): string {
  return hexOf(style.renderHex)
    ?? hexOf(style.color)
    ?? matchCabinetColorName(`${style.ourName ?? ""} ${style.aliasName ?? ""} ${style.name ?? ""} ${style.finish ?? ""} ${style.color ?? ""}`)
    ?? CABINET_NAME_COLORS.default;
}

export function styleFinishFamily(style: ShakerStyleInput): ShakerFinishFamily {
  return resolveDoorColor(style).usesGrain ? "wood" : "painted";
}

function referenceFamily(slug: DlShakerSlug): ShakerFinishFamily {
  return slug === "versa-shaker" || slug === "expresso-shaker" ? "wood" : "painted";
}

export function standardDlShakerReferences(): DlShakerReference[] {
  return STANDARD_DL_SHAKER_SLUGS.map((slug) => {
    const entry = DLC_FR26_CATALOG.find((item) => item.slug === slug);
    if (!entry) throw new Error(`Missing DL shaker catalog entry ${slug}`);
    return {
      slug,
      name: entry.names[0] ?? slug,
      color: entry.solidColor,
      grain: entry.faceDoor,
      family: referenceFamily(slug),
      grainPaleSoftened: entry.grainPaleSoftened,
      entry,
    };
  });
}

export function retintGrain(referenceHex: string, targetHex: string): { tintHex: string; clamped: boolean } {
  const reference = rgb(referenceHex);
  const target = rgb(targetHex);
  let clamped = false;
  const channels = [0, 1, 2].map((index) => {
    const base = reference[index]!;
    const aim = target[index]!;
    const scaled = base <= 0 ? aim : Math.round((aim / base) * 255);
    if (scaled > 255 || scaled < 0) clamped = true;
    return Math.max(0, Math.min(255, scaled));
  });
  const tintHex = `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  return { tintHex, clamped };
}

/**
 * Single entry point for a 2.75 or 3 inch shaker face.
 * Returns null when the style is not that family, so slim, double, raised, and slab stay on their own paths.
 *
 * `wizardProfile: true` means the WalzCraft wizard saved a profile for this style
 * (the wizard lives only in the door editor). The wizard's own face then wins as
 * the caller would expect: this blueprint is the DEFAULT for a shaker with no
 * wizard record, never an override of one.
 */
export function matchStandardShakerToDl(
  style: ShakerStyleInput,
  options: { wizardProfile?: boolean } = {},
): ShakerAdoption {
  const family = shakerDoorFamily(style);
  const railIn = effectiveShakerRailIn(style);
  if (options.wizardProfile) {
    return { adopted: false, railIn, reason: "The WalzCraft wizard saved a profile for this style, so the wizard profile wins over the shaker blueprint." };
  }
  if (family === "slim-shaker") return { adopted: false, railIn, reason: "Slim Shaker keeps its own narrow frame and is not the 2.75/3 inch blueprint." };
  if (family === "double-shaker") return { adopted: false, railIn, reason: "Double Shaker is two panels, not the DL flat center slab." };
  if (family !== "shaker") return { adopted: false, railIn, reason: "Not a shaker door style." };
  if (isHickoryDoor(style)) {
    return { adopted: false, railIn, reason: "Hickory keeps its catalog door photo. A substitute grain, a flat swatch, and a guessed tint are not used." };
  }
  if (!isStandardShakerRail(railIn)) return { adopted: false, railIn, reason: `Rail ${railIn ?? "unset"} in is outside 2.75 and 3 inches.` };

  const ownColor = styleOwnColor(style);
  const decision = resolveDoorColor(style);
  const finishFamily: ShakerFinishFamily = decision.usesGrain ? "wood" : "painted";
  const pool = standardDlShakerReferences().filter((reference) => reference.family === finishFamily);
  let best = pool[0]!;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const reference of pool) {
    const delta = deltaE2000Hex(ownColor, reference.color) ?? Number.POSITIVE_INFINITY;
    if (delta < bestDelta) {
      best = reference;
      bestDelta = delta;
    }
  }
  const surfaceColor = decision.appliedHex;
  const tint = retintGrain(best.color, surfaceColor);
  const grainNote = best.grainPaleSoftened
    ? "near-flat painted grain"
    : finishFamily === "painted"
      ? "painted grain"
      : "wood grain";
  const clampNote = tint.clamped ? " Tint is clamped, so a darker grain cannot fully reach a lighter photo." : "";
  return {
    adopted: true,
    reference: best,
    ownColor,
    surfaceColor,
    family: finishFamily,
    railIn: railIn!,
    deltaE: bestDelta,
    tintHex: tint.tintHex,
    tintClamped: tint.clamped,
    grain: best.grain,
    reason: `${finishFamily}, ΔE ${bestDelta.toFixed(1)} to ${best.name}; inherited ${grainNote} ${best.grain}; tint ${tint.tintHex} retargets ${best.color} to the door color ${surfaceColor} (${decision.appliedSource}; own ${ownColor}).${clampNote}`,
  };
}

/** The one builder every 2.75/3 inch shaker face must use. Geometry stays the DL template. */
export function standardShakerDlFacePlan(
  style: ShakerStyleInput | null | undefined,
  placement: string | null | undefined,
  options: { wizardProfile?: boolean } = {},
): CabinetFacePlan | null {
  if (!style) return null;
  if (findDlcFinishForStyle(style as DlcStyleInput)) return null;
  const match = matchStandardShakerToDl(style, options);
  if (!match.adopted) return null;
  const wall = (placement ?? "").toLowerCase() === "wall";
  const entry = match.reference.entry;
  const paint = !matchUsesGrain(style);
  return {
    sourceKind: "split",
    doorUrl: paint ? null : entry.faceDoor,
    drawerUrl: paint || wall ? null : entry.faceDrawer,
    sections: wall ? 1 : 2,
    drawerTextureApplied: !paint && !wall,
    grainRotation: 0,
    dlcCrop: {
      slug: entry.slug,
      doorSize: entry.doorSize,
      drawerSize: entry.drawerSize,
      drawerSolidColor: null,
      solidColor: match.surfaceColor,
      grainUrl: paint ? null : (entry.grainFrameFree ? entry.grain : null),
      faceTileIn: entry.faceTileIn,
      faceTileDrawerIn: entry.faceTileDrawerIn,
      normalUrl: paint ? null : entry.faceNormal,
      tintHex: paint ? null : match.tintHex,
    },
  };
}

function matchUsesGrain(style: ShakerStyleInput): boolean {
  return resolveDoorColor(style).usesGrain;
}

/** Hickory has no measured grain of its own in the DL set, so a versa/espresso tint would be a guess. */
export function isHickoryDoor(style: ShakerStyleInput | null | undefined): boolean {
  const text = `${style?.woodSpecies ?? ""} ${style?.ourName ?? ""} ${style?.aliasName ?? ""} ${style?.finish ?? ""}`;
  return /\bhickory\b/i.test(text);
}
