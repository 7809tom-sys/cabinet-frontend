/**
 * Selected backsplash → 3D material.
 *
 * A Designer tile or mosaic is stored on the saved design as one surface:
 * `id`, `pelicanCode` (the catalog SKU), `name`, `size`, `materialImageUrl`,
 * and `imageUrl`. The 3D backsplash used to read only `materialImageUrl`.
 * Products that only have a catalog picture — most of the Tile & Mosaic list —
 * therefore had no texture URL, and the renderer substituted a generic tile.
 *
 * An approved repeatable swatch still wins. Otherwise the product's own
 * picture is the texture, repeated at the sheet size printed on the product.
 */

export { BACKSPLASH_ROOM_SCENE_FIDELITY } from "@shared/photorealPrompt";

export const DEFAULT_BACKSPLASH_SHEET_IN = 12;

export type BacksplashImageSource = "approved-swatch" | "product-image" | "missing";

export type BacksplashPatternKind = "field-tile" | "interlocking-mosaic" | "subway-mosaic";

export type BacksplashSelection = {
  id?: number | null;
  name?: string | null;
  /** Catalog SKU. Saved designs store this as `pelicanCode`. */
  pelicanCode?: string | null;
  sku?: string | null;
  size?: string | null;
  category?: string | null;
  subCategory?: string | null;
  materialImageUrl?: string | null;
  imageUrl?: string | null;
};

export type BacksplashSheetSize = {
  widthIn: number;
  heightIn: number;
  patternKind: BacksplashPatternKind;
};

export type BacksplashMaterialMapping = {
  productId: number | null;
  name: string | null;
  sku: string | null;
  textureUrl: string | null;
  imageSource: BacksplashImageSource;
  widthIn: number;
  heightIn: number;
  patternKind: BacksplashPatternKind;
  /** Catalog backsplash pictures are never replaced by the neutral preview tile. */
  proceduralFallback: false;
  warning: string | null;
};

const CABINETDEALZ_ASSET_ORIGIN = "https://www.cabinetdealz.com";

function trimmed(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function safeHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

/** Swatch first, then the product picture the customer actually picked. */
export function selectedBacksplashTextureUrl(
  selection: Pick<BacksplashSelection, "materialImageUrl" | "imageUrl"> | null | undefined,
): { url: string | null; source: BacksplashImageSource } {
  const swatch = trimmed(selection?.materialImageUrl);
  if (swatch) return { url: swatch, source: "approved-swatch" };
  const photo = trimmed(selection?.imageUrl);
  if (photo) return { url: photo, source: "product-image" };
  return { url: null, source: "missing" };
}

/**
 * Sheet or tile size from the catalog `size` (and the name, when the size
 * string is the only place a dimension is written). A third number is
 * thickness or pieces-per-sheet and is not a wall dimension. Unknown sizes
 * repeat on a 12-inch module.
 */
export function parseBacksplashSheetInches(selection: Pick<BacksplashSelection, "name" | "size" | "category" | "subCategory"> | null | undefined): BacksplashSheetSize {
  // "Tile & Mosaic" is the catalog department, not the product pattern.
  // A field tile in that department must stay a field tile.
  const category = (selection?.category ?? "").replace(/tile\s*&\s*mosaic/gi, "");
  const identity = `${selection?.name ?? ""} ${selection?.subCategory ?? ""} ${category}`.toLowerCase();
  const patternKind: BacksplashPatternKind = /subway/.test(identity)
    ? "subway-mosaic"
    : /mosaic|\bhex\b/.test(identity)
      ? "interlocking-mosaic"
      : "field-tile";
  const raw = `${selection?.size ?? ""} ${selection?.name ?? ""}`;
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|["”])?\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  const widthIn = Number(match?.[1]);
  const heightIn = Number(match?.[2]);
  const plausible = Number.isFinite(widthIn) && Number.isFinite(heightIn)
    && widthIn >= 0.5 && heightIn >= 0.5
    && widthIn <= 96 && heightIn <= 96;
  if (!plausible) {
    return { widthIn: DEFAULT_BACKSPLASH_SHEET_IN, heightIn: DEFAULT_BACKSPLASH_SHEET_IN, patternKind };
  }
  return { widthIn, heightIn, patternKind };
}

export function backsplashTextureWarningMessage(productName: string | null | undefined, reason: "missing" | "failed"): string {
  const name = trimmed(productName) || "the selected backsplash";
  if (reason === "missing") {
    return `No product image is available for ${name}. A substitute tile is not being shown.`;
  }
  return `The image for ${name} did not load. A substitute tile is not being shown.`;
}

/** The fields a saved design already stores, turned into the 3D backsplash material. */
export function mapBacksplashSelectionToMaterial(selection: BacksplashSelection | null | undefined): BacksplashMaterialMapping {
  const texture = selectedBacksplashTextureUrl(selection);
  const sheet = parseBacksplashSheetInches(selection);
  const name = trimmed(selection?.name) || null;
  const sku = trimmed(selection?.sku) || trimmed(selection?.pelicanCode) || null;
  return {
    productId: selection?.id ?? null,
    name,
    sku,
    textureUrl: texture.url,
    imageSource: texture.source,
    widthIn: sheet.widthIn,
    heightIn: sheet.heightIn,
    patternKind: sheet.patternKind,
    proceduralFallback: false,
    warning: texture.url ? null : backsplashTextureWarningMessage(name, "missing"),
  };
}

/**
 * `/manus-storage/...` is same-origin on cabinetdealz.com. On any other host
 * it has to be loaded from the permanent asset origin, or the relative path
 * 404s and the backsplash would be left blank.
 */
export function resolveDesignerMaterialUrl(
  value: string | null | undefined,
  pageOrigin?: string | null,
): { url: string; crossOrigin: "anonymous" | null } | null {
  const raw = trimmed(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    const assetHost = safeHost(raw);
    const pageHost = pageOrigin ? safeHost(pageOrigin) : "";
    return { url: raw, crossOrigin: assetHost && pageHost && assetHost !== pageHost ? "anonymous" : null };
  }
  if (raw.startsWith("/manus-storage/")) {
    const pageHost = pageOrigin ? safeHost(pageOrigin) : "";
    const onCabinetDealz = !pageHost || /(^|\.)cabinetdealz\.com$/i.test(pageHost);
    if (onCabinetDealz) return { url: raw, crossOrigin: null };
    return { url: `${CABINETDEALZ_ASSET_ORIGIN}${raw}`, crossOrigin: "anonymous" };
  }
  return { url: raw, crossOrigin: null };
}
