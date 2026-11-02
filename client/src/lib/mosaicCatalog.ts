import {
  GENERIC_MOSAIC_GROUT_COLOR,
  clampMosaicGroutIn,
  type MosaicInterlockSpec,
} from "./backsplashMosaic";
import {
  MOSAIC_CATALOG,
  MOSAIC_CATALOG_SOURCE_DATE,
  NON_MOSAIC_TILE_ROWS,
  UNRESOLVED_MOSAICS,
  type MosaicCatalogEntry,
  type MosaicPatternKind,
  type MosaicSurfaceFinish,
} from "./mosaicCatalog.data";

/**
 * The authoritative map from a Pelican Tile & Mosaic catalog row to the way that
 * exact product is rendered.
 *
 * Every value here comes from one of two sources, never from a guess:
 *
 *  - the distributor's own storefront record (name, SKU, sheet size, material family,
 *    product page), and
 *  - that product's own product photo, which supplies the tileable texture, the chip
 *    palette and (where the joints are legible) the grout colour.
 *
 * A mosaic the distributor lists but does not publish source data for is NOT given a
 * fallback pattern. It stays in `UNRESOLVED_MOSAICS`, resolves to null here, and the
 * Designer draws the existing "no image" state instead of inventing a product.
 *
 * Grout width is the one field still marked unmeasured (`groutInMeasured: false`), because
 * Pelican publishes sheet size only. It is held inside the codebase's own
 * MOSAIC_GROUT_MIN_IN..MOSAIC_GROUT_MAX_IN rule so every sheet reads the same at a joint.
 */

export {
  MOSAIC_CATALOG,
  NON_MOSAIC_TILE_ROWS,
  UNRESOLVED_MOSAICS,
  MOSAIC_CATALOG_SOURCE_DATE,
};
export type { MosaicCatalogEntry, MosaicPatternKind, MosaicSurfaceFinish };

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** The catalog row's SKU is the product name on this distributor's storefront. */
const BY_SKU = new Map(MOSAIC_CATALOG.map((entry) => [normalize(entry.sku), entry]));
const BY_SLUG = new Map(MOSAIC_CATALOG.map((entry) => [entry.slug, entry]));

/**
 * Product names arrive decorated ("Golden Trace Mosaic 11.81", "Misty Coast 11.81 x
 * 11.81"). Match on the longest catalog name the string contains, so a decoration never
 * selects a different product.
 */
const SORTED_NAMES = [...MOSAIC_CATALOG]
  .map((entry) => ({ entry, key: normalize(entry.sku) }))
  .sort((a, b) => b.key.length - a.key.length);

const UNRESOLVED_NAMES = UNRESOLVED_MOSAICS.map((item) => normalize(item.name)).sort(
  (a, b) => b.length - a.length,
);
const NON_MOSAIC_NAMES = NON_MOSAIC_TILE_ROWS.map((item) => normalize(item.name));

export type MosaicLookupInput = {
  sku?: string | null;
  /** Saved designs carry the SKU under `pelicanCode`. */
  pelicanCode?: string | null;
  name?: string | null;
  slug?: string | null;
  category?: string | null;
  subCategory?: string | null;
  size?: string | null;
};

function isTileOrMosaicCategory(input: MosaicLookupInput): boolean {
  return /tile|mosaic/i.test(`${input.category ?? ""} ${input.subCategory ?? ""}`);
}

/** Exact match on SKU, pelican code or slug. Never a fuzzy match. */
export function mosaicCatalogForExact(input: MosaicLookupInput | null | undefined): MosaicCatalogEntry | null {
  if (!input) return null;
  for (const value of [input.sku, input.pelicanCode]) {
    const key = normalize(value);
    if (key && BY_SKU.has(key)) return BY_SKU.get(key)!;
  }
  const slug = normalize(input.slug);
  if (slug && BY_SLUG.has(slug)) return BY_SLUG.get(slug)!;
  return null;
}

/**
 * Resolve a Designer Tile & Mosaic row to the product it actually is.
 *
 * Exact SKU wins. A decorated name then falls back to the longest catalog name it
 * contains. A row in the Tile category that is not a mosaic sheet (a vanity top or a
 * prefab slab) resolves to null so it can never pick up a mosaic texture.
 */
export function mosaicCatalogFor(input: MosaicLookupInput | null | undefined): MosaicCatalogEntry | null {
  if (!input) return null;
  const exact = mosaicCatalogForExact(input);
  if (exact) return exact;
  const name = normalize(input.name);
  if (!name) return null;
  if (NON_MOSAIC_NAMES.some((value) => value && name.includes(value))) return null;
  const unresolved = UNRESOLVED_NAMES.find((value) => value && name.includes(value));
  if (unresolved) return null;
  const hit = SORTED_NAMES.find(({ key }) => key && name.includes(key));
  if (hit) return hit.entry;
  // Last resort: a Tile & Mosaic row whose name is not in the catalog is left unresolved.
  return null;
}

/** True when the distributor sells this mosaic but publishes no data to render it from. */
export function unresolvedMosaicFor(input: MosaicLookupInput | null | undefined): (typeof UNRESOLVED_MOSAICS)[number] | null {
  const name = normalize(input?.name) || normalize(input?.sku) || normalize(input?.pelicanCode);
  if (!name) return null;
  return UNRESOLVED_MOSAICS.find((item) => name.includes(normalize(item.name))) ?? null;
}

/** A Tile & Mosaic row that is not a mosaic sheet, so it must not get a mosaic texture. */
export function nonMosaicTileRowFor(input: MosaicLookupInput | null | undefined): (typeof NON_MOSAIC_TILE_ROWS)[number] | null {
  const name = normalize(input?.name) || normalize(input?.sku);
  if (!name) return null;
  return NON_MOSAIC_TILE_ROWS.find((item) => name.includes(normalize(item.name))) ?? null;
}

export const MOSAIC_CATALOG_SLUG = (entry: MosaicCatalogEntry) => `catalog-mosaic:${entry.slug}`;
export const MOSAIC_CATALOG_KEY_PREFIX = "catalog-mosaic:";

export function mosaicCatalogForKey(key: string | null | undefined): MosaicCatalogEntry | null {
  const value = (key ?? "").trim();
  if (!value.startsWith(MOSAIC_CATALOG_KEY_PREFIX)) return null;
  return BY_SLUG.get(value.slice(MOSAIC_CATALOG_KEY_PREFIX.length)) ?? null;
}

/**
 * The sheet spec for a verified catalog mosaic: straight edges, repeating at the module the
 * bake actually covers (`moduleIn`), with the product's own grout width and colour.
 *
 * `moduleIn` is the published sheet size when the photo shows the whole sheet. For a close-up
 * it is how much product the crop spans, derived from the grout width so the chips land at
 * true size — never more than one sheet. The tile shapes are never distorted either way.
 */
export function mosaicCatalogSheetSpec(entry: MosaicCatalogEntry): MosaicInterlockSpec {
  const groutIn = clampMosaicGroutIn(entry.groutIn);
  return {
    key: MOSAIC_CATALOG_SLUG(entry),
    name: normalize(entry.sku),
    outerWidthIn: entry.moduleIn[0],
    outerHeightIn: entry.moduleIn[1],
    overhangXIn: 0,
    overhangYIn: 0,
    internalGroutIn: groutIn,
    groutIn,
    groutColor: entry.groutColor || GENERIC_MOSAIC_GROUT_COLOR,
    measured: entry.groutInMeasured,
    edge: "straight",
    generic: false,
  };
}

/**
 * Surface finish the 3D material needs beyond the colour map: a polished marble is
 * smoother and more reflective than honed marble or gloss glass, and mother-of-pearl and
 * pearlescent glass need a sheen no flat texture can carry.
 */
export function mosaicFinishProfile(finish: MosaicSurfaceFinish): {
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
} {
  switch (finish) {
    case "polished":
      return { roughness: 0.18, metalness: 0.02, clearcoat: 0.85, clearcoatRoughness: 0.06 };
    case "gloss":
      return { roughness: 0.09, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 };
    case "iridescent":
      return { roughness: 0.14, metalness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 };
    case "satin":
      return { roughness: 0.38, metalness: 0.03, clearcoat: 0.45, clearcoatRoughness: 0.2 };
    case "honed":
    default:
      return { roughness: 0.58, metalness: 0.01, clearcoat: 0.12, clearcoatRoughness: 0.42 };
  }
}

/** Every sheet-size field the Designer reads for one resolved mosaic. */
export function mosaicCatalogSheetSize(entry: MosaicCatalogEntry) {
  return {
    widthIn: entry.moduleIn[0],
    heightIn: entry.moduleIn[1],
    patternKind: "interlocking-mosaic" as const,
  };
}

/**
 * The catalog audit: one row per catalog entry with the fields a renderer needs. A test
 * asserts this is complete, so a newly listed mosaic cannot ship without a texture and a
 * distributor SKU.
 */
export function mosaicCatalogAudit(): Array<{
  sku: string;
  texture: string;
  pattern: MosaicPatternKind;
  sizeIn: [number, number];
  groutIn: number;
  groutColor: string;
  ok: boolean;
  problems: string[];
}> {
  return MOSAIC_CATALOG.map((entry) => {
    const problems: string[] = [];
    if (!entry.sku.trim()) problems.push("missing distributor SKU");
    if (!entry.texture.startsWith("/textures/mosaics/")) problems.push("missing texture");
    if (!(entry.sizeIn[0] > 0) || !(entry.sizeIn[1] > 0)) problems.push("missing sheet size");
    if (!(entry.moduleIn[0] > 0) || !(entry.moduleIn[1] > 0)) problems.push("missing module size");
    if (entry.moduleIn[0] > entry.sizeIn[0] + 1e-6 || entry.moduleIn[1] > entry.sizeIn[1] + 1e-6) {
      problems.push("module larger than the sheet it comes from");
    }
    if (!entry.groutColor.match(/^#[0-9a-f]{6}$/i)) problems.push("missing grout colour");
    const groutIn = clampMosaicGroutIn(entry.groutIn);
    if (Math.abs(groutIn - entry.groutIn) > 1e-6) problems.push("grout outside the 1/16-1/8 in. rule");
    return {
      sku: entry.sku,
      texture: entry.texture,
      pattern: entry.pattern,
      sizeIn: entry.sizeIn,
      groutIn: entry.groutIn,
      groutColor: entry.groutColor,
      ok: problems.length === 0,
      problems,
    };
  });
}
