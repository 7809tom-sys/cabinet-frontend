/**
 * HARD RULE (Tom, Nov 1 2026): ALL 2.75 in and 3 in shaker doors start from the DL Shaker
 * blueprint as the base template. Geometry (rail/stile frame, sharp square corners, flat
 * center slab, notch) is proven and must not be changed per style. Only texture/color varies;
 * any applied color must be from the brand palette (cream #fffdf9/#f6f3ed, green #244338,
 * gold #d7a46c), never outside blue/teal/off-brand green. Deviation requires Tom's explicit override.
 *
 * Brand colors go ON the door surface, not just UI tints. The painted surface of every
 * 2.75/3 inch shaker is snapped (CIEDE2000) to the nearest brand door color: the uploaded
 * Faircrest Classic Cream door sample (#dedac6, averaged from CC_classic-cream_1.jpeg door
 * faces), cream #fffdf9/#f6f3ed, green #244338, or gold #d7a46c. The style's own catalog
 * color only picks the closest DL reference grain and which brand color it snaps to.
 * Rail and stile WIDTH stay the style's own 2.75 or 3 inches. Depth, square corners,
 * the flat center slab, and the notch are the shared blueprint.
 */
import { CABINET_NAME_COLORS, matchCabinetColorName } from "./cabinetColorNames";
import { deltaE2000Hex } from "./ciede2000";
import { DLC_FR26_CATALOG, type DlcFr26CatalogEntry } from "./dlcFr26Catalog.generated";
import { DLC_FRAME_DETAIL } from "./dlcFr26Textures";
import { findDlcFinishForStyle, type DlcStyleInput } from "./dlcFr26Mapping";
import type { CabinetFacePlan } from "./doorFaceRecognition";

/** Brand palette. Used for UI tints AND on shaker door surfaces. */
export const SHAKER_BRAND_UI_PALETTE = ["#fffdf9", "#f6f3ed", "#244338", "#d7a46c"] as const;

/** Door-surface color measured from the uploaded Faircrest Classic Cream door sample photo. */
export const FAIRCREST_CLASSIC_CREAM_SAMPLE_HEX = "#dedac6";

/** The only colors a 2.75/3 inch shaker door surface may render in. Sample first. */
export const SHAKER_BRAND_DOOR_SURFACE_PALETTE = [FAIRCREST_CLASSIC_CREAM_SAMPLE_HEX, ...SHAKER_BRAND_UI_PALETTE] as const;

/** Snap a style's own color to the nearest brand door-surface color. */
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

export type ShakerStyleInput = {
  id?: number | null;
  distributorId?: number | null;
  styleCode?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  name?: string | null;
  doorStyle?: string | null;
  color?: string | null;
  renderHex?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
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
      /** Brand/sample color actually rendered on the door surface. */
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

export function shakerDoorFamily(doorStyle: string | null | undefined): "shaker" | "slim-shaker" | "double-shaker" | "other" {
  const text = (doorStyle ?? "").toLowerCase();
  if (!text.includes("shaker")) return "other";
  if (text.includes("slim")) return "slim-shaker";
  if (text.includes("double")) return "double-shaker";
  return "shaker";
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
  return shakerDoorFamily(style.doorStyle) === "shaker" ? STANDARD_SHAKER_RAIL_IN : null;
}

export function styleOwnColor(style: ShakerStyleInput): string {
  return hexOf(style.renderHex)
    ?? hexOf(style.color)
    ?? matchCabinetColorName(`${style.ourName ?? ""} ${style.aliasName ?? ""} ${style.name ?? ""} ${style.finish ?? ""} ${style.color ?? ""}`)
    ?? CABINET_NAME_COLORS.default;
}

export function styleFinishFamily(style: ShakerStyleInput): ShakerFinishFamily {
  const text = `${style.woodSpecies ?? ""} ${style.ourName ?? ""} ${style.aliasName ?? ""} ${style.finish ?? ""}`.toLowerCase();
  if (/painted/.test(text)) return "painted";
  if (/oak|hickory|birch|maple|walnut|rift|cherry|pecan|veneer|\bwood\b/.test(text)) return "wood";
  const color = hexOf(style.renderHex) ?? hexOf(style.color);
  if (color) {
    const [r, g, b] = rgb(color);
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    if (chroma > 40) return "wood";
  }
  return "painted";
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
 */
export function matchStandardShakerToDl(style: ShakerStyleInput): ShakerAdoption {
  const family = shakerDoorFamily(style.doorStyle);
  const railIn = effectiveShakerRailIn(style);
  if (family === "slim-shaker") return { adopted: false, railIn, reason: "Slim Shaker keeps its own narrow frame and is not the 2.75/3 inch blueprint." };
  if (family === "double-shaker") return { adopted: false, railIn, reason: "Double Shaker is two panels, not the DL flat center slab." };
  if (family !== "shaker") return { adopted: false, railIn, reason: "Not a shaker door style." };
  if (!isStandardShakerRail(railIn)) return { adopted: false, railIn, reason: `Rail ${railIn ?? "unset"} in is outside 2.75 and 3 inches.` };

  const ownColor = styleOwnColor(style);
  const finishFamily = styleFinishFamily(style);
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
  const surfaceColor = brandDoorSurfaceHex(ownColor);
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
    reason: `${finishFamily}, ΔE ${bestDelta.toFixed(1)} to ${best.name}; inherited ${grainNote} ${best.grain}; tint ${tint.tintHex} retargets ${best.color} to brand surface ${surfaceColor} (own ${ownColor}).${clampNote}`,
  };
}

/** The one builder every 2.75/3 inch shaker face must use. Geometry stays the DL template. */
export function standardShakerDlFacePlan(
  style: ShakerStyleInput | null | undefined,
  placement: string | null | undefined,
): CabinetFacePlan | null {
  if (!style) return null;
  if (findDlcFinishForStyle(style as DlcStyleInput)) return null;
  const match = matchStandardShakerToDl(style);
  if (!match.adopted) return null;
  const wall = (placement ?? "").toLowerCase() === "wall";
  const entry = match.reference.entry;
  return {
    sourceKind: "split",
    doorUrl: entry.faceDoor,
    drawerUrl: wall ? null : entry.faceDrawer,
    sections: wall ? 1 : 2,
    drawerTextureApplied: !wall,
    grainRotation: 0,
    dlcCrop: {
      slug: entry.slug,
      doorSize: entry.doorSize,
      drawerSize: entry.drawerSize,
      drawerSolidColor: null,
      solidColor: match.surfaceColor,
      grainUrl: entry.grainFrameFree ? entry.grain : null,
      faceTileIn: entry.faceTileIn,
      faceTileDrawerIn: entry.faceTileDrawerIn,
      normalUrl: entry.faceNormal,
      tintHex: match.tintHex,
    },
  };
}
