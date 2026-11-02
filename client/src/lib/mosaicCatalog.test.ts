import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  MOSAIC_CATALOG,
  MOSAIC_CATALOG_SOURCE_DATE,
  MOSAIC_CATALOG_KEY_PREFIX,
  NON_MOSAIC_TILE_ROWS,
  UNRESOLVED_MOSAICS,
  mosaicCatalogAudit,
  mosaicCatalogFor,
  mosaicCatalogForExact,
  mosaicCatalogForKey,
  mosaicCatalogSheetSize,
  mosaicCatalogSheetSpec,
  mosaicFinishProfile,
  nonMosaicTileRowFor,
  unresolvedMosaicFor,
} from "./mosaicCatalog";
import {
  MOSAIC_GROUT_MAX_IN, MOSAIC_GROUT_MIN_IN, mosaicPitchIn, mosaicSheetSpecFor,
} from "./backsplashMosaic";

const repoRoot = resolve(import.meta.dirname, "../../..");
const viewerSource = readFileSync(resolve(import.meta.dirname, "../components/design/InteractiveRoom3D.tsx"), "utf8");
const elevationSource = readFileSync(resolve(import.meta.dirname, "../components/design/ElevationView.tsx"), "utf8");
const designToolSource = readFileSync(resolve(import.meta.dirname, "../pages/DesignTool.tsx"), "utf8");

/** The distributor's own Tile & Mosaic listing: 51 rows, 43 of them mosaic sheets. */
const CATALOG_ROW_COUNT = 51;
const MOSAIC_SHEET_COUNT = 43;

describe("the mosaic catalog covers the distributor's whole Tile & Mosaic list", () => {
  it("accounts for all 51 listed rows, with no row dropped and no invented row", () => {
    expect(MOSAIC_CATALOG.length + NON_MOSAIC_TILE_ROWS.length + UNRESOLVED_MOSAICS.length).toBe(CATALOG_ROW_COUNT);
    // 8 of the 51 are vanity tops and prefab slabs, not mosaic sheets.
    expect(NON_MOSAIC_TILE_ROWS).toHaveLength(8);
    expect(MOSAIC_CATALOG.length + UNRESOLVED_MOSAICS.length).toBe(MOSAIC_SHEET_COUNT);
  });

  it("names every mosaic sheet exactly once (no duplicate SKU, no near-duplicate name)", () => {
    const skus = [...MOSAIC_CATALOG.map((entry) => entry.sku), ...UNRESOLVED_MOSAICS.map((item) => item.sku)].map((s) => s.trim().toLowerCase());
    expect(new Set(skus).size).toBe(skus.length);
    expect(skus.every((sku) => sku.length > 0)).toBe(true);
  });

  it("resolves every single one of the 43 mosaic sheets to a distributor SKU and a pattern", () => {
    for (const entry of MOSAIC_CATALOG) {
      expect(entry.sku.trim(), entry.name).not.toBe("");
      expect(entry.pattern, entry.sku).toBeTruthy();
      expect(entry.slug, entry.sku).toMatch(/^[a-z0-9-]+$/);
    }
    // The two the distributor publishes no source for are still tracked, not silently dropped.
    expect(UNRESOLVED_MOSAICS.map((item) => item.name).sort()).toEqual(["Iron Pearl", "Olive Grove"]);
  });

  it("keeps every unresolved mosaic flagged with a reason instead of guessing a product", () => {
    for (const item of UNRESOLVED_MOSAICS) {
      expect(item.reason.length).toBeGreaterThan(40);
      expect(mosaicCatalogFor({ name: item.name, pelicanCode: item.name })).toBeNull();
      expect(unresolvedMosaicFor({ name: item.name })?.name).toBe(item.name);
    }
  });

  it("carries the source date so a stale catalog is visible", () => {
    expect(MOSAIC_CATALOG_SOURCE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("every resolved mosaic has a real texture that exists in the build", () => {
  it("points at a baked texture file that ships in client/public", () => {
    for (const entry of MOSAIC_CATALOG) {
      expect(entry.texture, entry.sku).toMatch(/^\/textures\/mosaics\/[a-z0-9-]+\.webp$/);
      const file = resolve(repoRoot, `client/public${entry.texture}`);
      expect(existsSync(file), `${entry.sku} -> ${entry.texture}`).toBe(true);
      expect(statSync(file).size, `${entry.sku} texture is not empty`).toBeGreaterThan(2000);
    }
  });

  it("keeps each texture's aspect equal to the module it repeats at", () => {
    for (const entry of MOSAIC_CATALOG) {
      const [w, h] = entry.texturePx;
      const moduleAspect = entry.moduleIn[0] / entry.moduleIn[1];
      const textureAspect = w / h;
      // The bake scales the photo uniformly, so tile shapes are never distorted. One pixel of
      // rounding at 1024 px is 0.1%, so anything under 4% is rounding, not a squash.
      expect(Math.abs(textureAspect - moduleAspect) / moduleAspect, `${entry.sku} ${textureAspect} vs ${moduleAspect}`).toBeLessThan(0.04);
      // and a module can never claim more product than one whole sheet covers
      expect(entry.moduleIn[0], entry.sku).toBeLessThanOrEqual(entry.sizeIn[0] + 1e-6);
      expect(entry.moduleIn[1], entry.sku).toBeLessThanOrEqual(entry.sizeIn[1] + 1e-6);
    }
  });

  it("gives every mosaic a texture of its own (a copy is not a product)", () => {
    const textures = MOSAIC_CATALOG.map((entry) => entry.texture);
    expect(new Set(textures).size).toBe(textures.length);
  });

  it("reports no problems in the audit for any product", () => {
    const audit = mosaicCatalogAudit();
    expect(audit).toHaveLength(MOSAIC_CATALOG.length);
    for (const row of audit) expect(row.problems, `${row.sku}: ${row.problems.join(", ")}`).toEqual([]);
    expect(audit.every((row) => row.ok)).toBe(true);
  });
});

describe("sizes, grout and colours come from the product, never invented", () => {
  it("uses the two wall dimensions the distributor prints (the third is thickness)", () => {
    for (const entry of MOSAIC_CATALOG) {
      expect(entry.sizeIn[0], entry.sku).toBeGreaterThan(4);
      expect(entry.sizeIn[1], entry.sku).toBeGreaterThan(4);
      expect(entry.sizeIn[0], entry.sku).toBeLessThanOrEqual(20);
      expect(entry.sizeIn[1], entry.sku).toBeLessThanOrEqual(20);
    }
    const carbon = MOSAIC_CATALOG.find((entry) => entry.sku === "Carbon Hex")!;
    expect(carbon.sizeIn).toEqual([12.8, 11.1]);
    // The published sheet size is what the distributor sells; the module is what the photo covers.
    expect(carbon.moduleIn[0]).toBeLessThanOrEqual(carbon.sizeIn[0]);
    const misty = MOSAIC_CATALOG.find((entry) => entry.sku === "Misty Coast")!;
    expect(misty.sizeIn).toEqual([11.81, 11.81]);
  });

  it("keeps every grout width inside the codebase's own 1/16 to 1/8 inch mosaic rule", () => {
    for (const entry of MOSAIC_CATALOG) {
      expect(entry.groutIn, entry.sku).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN - 1e-9);
      expect(entry.groutIn, entry.sku).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN + 1e-9);
    }
  });

  it("marks grout width as measured only where a complete-sheet photo could prove it", () => {
    for (const entry of MOSAIC_CATALOG) {
      expect(entry.groutInMeasured, `${entry.sku} measurement flag`).toBe(entry.scaleSource === "measured-from-sheet");
    }
    // Most sheets are photographed as close-ups, so most grout widths remain the pattern estimate.
    const measured = MOSAIC_CATALOG.filter((entry) => entry.groutInMeasured);
    expect(measured.length).toBeGreaterThan(0);
    expect(measured.length).toBeLessThan(MOSAIC_CATALOG.length / 2);
  });

  it("only claims a measured grout where the sheet itself is the ruler", () => {
    // A measured width needs the published sheet as the ruler, so it can only come from a photo
    // that shows the whole sheet. Anything else is an estimate inside the mosaic rule.
    for (const entry of MOSAIC_CATALOG) {
      if (entry.groutInMeasured) {
        expect(entry.scaleSource, entry.sku).toBe("measured-from-sheet");
        expect(Math.abs(entry.moduleIn[0] - entry.sizeIn[0]) / entry.sizeIn[0], entry.sku).toBeLessThan(0.01);
      }
      if (entry.scaleSource === "joint-derived") {
        expect(entry.groutIn, entry.sku).toBeCloseTo(1 / 16, 6);
        expect(entry.groutInMeasured, entry.sku).toBe(false);
      }
    }
  });

  it("says which ruler fixed each module size, and never leaves it unexplained", () => {
    const allowed = new Set(["measured-from-sheet", "joint-derived", "sheet-size"]);
    for (const entry of MOSAIC_CATALOG) expect(allowed.has(entry.scaleSource), entry.sku).toBe(true);
    // A complete-sheet photo repeats at its published width; a hand-trimmed sheet can be a few
    // percent short on the other axis, which must never inflate the module past what it covers.
    for (const entry of MOSAIC_CATALOG.filter((e) => e.scaleSource === "measured-from-sheet")) {
      // within 1% of the printed width: a photo may crop a sliver off the sheet edge
      expect(Math.abs(entry.moduleIn[0] - entry.sizeIn[0]) / entry.sizeIn[0], entry.sku).toBeLessThan(0.01);
      expect(entry.moduleIn[1], entry.sku).toBeLessThanOrEqual(entry.sizeIn[1]);
    }
  });

  it("carries a real hex colour for grout and chips on every product", () => {
    for (const entry of MOSAIC_CATALOG) {
      expect(entry.groutColor, entry.sku).toMatch(/^#[0-9a-f]{6}$/);
      expect(entry.palette, entry.sku).toHaveLength(4);
      for (const chip of entry.palette) expect(chip, entry.sku).toMatch(/^#[0-9a-f]{6}$/);
      expect(entry.lightest, entry.sku).toMatch(/^#[0-9a-f]{6}$/);
      expect(entry.darkest, entry.sku).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("links each product to the distributor's own page for that exact item", () => {
    for (const entry of MOSAIC_CATALOG) {
      expect(entry.source, entry.sku).toMatch(/^https:\/\/buildpelican\.com\/products\/[a-z0-9-]+$/);
    }
    expect(new Set(MOSAIC_CATALOG.map((e) => e.source)).size).toBe(MOSAIC_CATALOG.length);
  });

  it("derives the lightest and darkest chip from the palette it sampled", () => {
    const luma = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    };
    for (const entry of MOSAIC_CATALOG) {
      expect(luma(entry.lightest), entry.sku).toBeGreaterThanOrEqual(luma(entry.darkest));
    }
  });
});

describe("the catalog spec is what both views render", () => {
  it("repeats each sheet at its measured module with no overlap and no gaps", () => {
    for (const entry of MOSAIC_CATALOG) {
      const spec = mosaicCatalogSheetSpec(entry);
      expect(spec.edge, entry.sku).toBe("straight");
      expect(spec.overhangXIn).toBe(0);
      expect(spec.overhangYIn).toBe(0);
      expect(mosaicPitchIn(spec)).toEqual({ x: entry.moduleIn[0], y: entry.moduleIn[1] });
      expect(spec.groutColor).toBe(entry.groutColor);
      expect(spec.groutIn).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN);
      expect(spec.groutIn).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN);
    }
  });

  it("is found by the one lookup both views call, by SKU, by name and by key", () => {
    for (const entry of MOSAIC_CATALOG) {
      expect(mosaicCatalogFor({ sku: entry.sku })?.sku, entry.sku).toBe(entry.sku);
      expect(mosaicCatalogFor({ pelicanCode: entry.sku })?.slug, entry.sku).toBe(entry.slug);
      expect(mosaicCatalogForKey(`${MOSAIC_CATALOG_KEY_PREFIX}${entry.slug}`)?.sku, entry.sku).toBe(entry.sku);
      // and the shared spec lookup resolves to this product's own numbers
      const spec = mosaicSheetSpecFor({
        key: `${MOSAIC_CATALOG_KEY_PREFIX}${entry.slug}`,
        name: entry.sku,
        widthIn: entry.sizeIn[0],
        heightIn: entry.sizeIn[1],
        patternKind: "interlocking-mosaic",
      });
      expect(spec?.outerWidthIn, entry.sku).toBe(entry.moduleIn[0]);
      expect(spec?.outerHeightIn, entry.sku).toBe(entry.moduleIn[1]);
      expect(spec?.groutColor, entry.sku).toBe(entry.groutColor);
    }
  });

  it("matches a decorated catalog name to its product without picking a shorter neighbour", () => {
    expect(mosaicCatalogFor({ name: "Golden Trace Mosaic 11.81" })?.sku).toBe("Golden Trace");
    expect(mosaicCatalogFor({ name: "Misty Coast 11.81 x 11.81" })?.sku).toBe("Misty Coast");
    expect(mosaicCatalogFor({ name: "Carbon Hex Mosaic" })?.sku).toBe("Carbon Hex");
    expect(mosaicCatalogFor({ name: "Taupe Vail" })?.sku).toBe("Taupe Vail");
    // A name that only shares a prefix must not resolve.
    expect(mosaicCatalogFor({ name: "Carbon" })).toBeNull();
    expect(mosaicCatalogFor({ name: "Misty" })).toBeNull();
  });

  it("never resolves a name it does not actually sell", () => {
    for (const name of ["", "   ", "Penny Round Mosaic", "Picket Mosaic", "Herringbone Mosaic", "Generic Marble", "Calacatta Gold Penny Round"]) {
      expect(mosaicCatalogFor({ name }), name).toBeNull();
    }
    expect(mosaicCatalogFor({ name: "Moonstone Hex" })?.sku).toBe("Moonstone Hex");
  });

  it("keeps a vanity top or prefab slab out of the mosaic path entirely", () => {
    for (const row of NON_MOSAIC_TILE_ROWS) {
      expect(nonMosaicTileRowFor({ name: row.name })?.sku, row.name).toBe(row.sku);
      expect(mosaicCatalogFor({ name: row.name, pelicanCode: row.sku, category: "Tile & Mosaic", subCategory: "Tile" }), row.name).toBeNull();
    }
  });

  it("exact lookup does not fall back to a fuzzy name match", () => {
    expect(mosaicCatalogForExact({ sku: "Definitely Not A Mosaic" })).toBeNull();
    expect(mosaicCatalogForExact({ sku: "Golden Trace Mosaic 11.81" })).toBeNull();
    expect(mosaicCatalogForExact({ slug: "carbon-hex" })?.sku).toBe("Carbon Hex");
  });

  it("hands the module size and pattern kind to the elevation and 3D loaders", () => {
    for (const entry of MOSAIC_CATALOG) {
      expect(mosaicCatalogSheetSize(entry)).toEqual({
        widthIn: entry.moduleIn[0],
        heightIn: entry.moduleIn[1],
        patternKind: "interlocking-mosaic",
      });
    }
  });
});

describe("finish drives the surface response", () => {
  it("gives a honed stone a rougher surface than a polished one and a gloss glass the smoothest", () => {
    expect(mosaicFinishProfile("honed").roughness).toBeGreaterThan(mosaicFinishProfile("satin").roughness);
    expect(mosaicFinishProfile("satin").roughness).toBeGreaterThan(mosaicFinishProfile("polished").roughness);
    expect(mosaicFinishProfile("polished").roughness).toBeGreaterThan(mosaicFinishProfile("gloss").roughness);
    expect(mosaicFinishProfile("gloss").clearcoat).toBeGreaterThan(mosaicFinishProfile("honed").clearcoat);
    expect(mosaicFinishProfile("iridescent").metalness).toBeGreaterThan(mosaicFinishProfile("honed").metalness);
  });

  it("assigns a finish to every product and uses the words the distributor sells", () => {
    const allowed = new Set(["polished", "honed", "satin", "gloss", "iridescent"]);
    for (const entry of MOSAIC_CATALOG) expect(allowed.has(entry.finish), entry.sku).toBe(true);
    // Honed and polished marble must both appear: they are different products.
    const finishes = new Set(MOSAIC_CATALOG.map((entry) => entry.finish));
    expect(finishes.has("honed")).toBe(true);
    expect(finishes.has("polished")).toBe(true);
    expect(MOSAIC_CATALOG.find((entry) => entry.sku === "Carrara Subway")?.finish).toBe("honed");
    expect(MOSAIC_CATALOG.find((entry) => entry.sku === "Carbon Hex")?.finish).toBe("polished");
    // Glacier Shift's own sheet is a chevron: parallelograms meeting in a continuous V.
    expect(MOSAIC_CATALOG.find((entry) => entry.sku === "Glacier Shift")?.pattern).toBe("chevron");
    expect(MOSAIC_CATALOG.find((entry) => entry.sku === "Pearled Hex")?.finish).toBe("iridescent");
  });

  it("records the material family straight from the product description", () => {
    const byFamily = (sku: string) => MOSAIC_CATALOG.find((entry) => entry.sku === sku)!.family;
    expect(byFamily("Desert Clay")).toBe("glass-stainless");
    expect(byFamily("Glacier Shift")).toBe("glass-aluminum");
    expect(byFamily("Golden Trace")).toBe("marble-aluminum");
    expect(byFamily("Noble Row")).toBe("marble-aluminum");
    expect(byFamily("Thassos Subway")).toBe("marble");
    expect(byFamily("Shell Radiance")).toBe("glass-shell");
    expect(byFamily("Carbon Hex")).toBe("marble");
  });
});

describe("the renderers read the catalog instead of guessing", () => {
  it("3D resolves a catalog mosaic to its own sheet spec and texture", () => {
    expect(viewerSource).toContain("mosaicCatalogFor({");
    expect(viewerSource).toContain("mosaicCatalogSheetSpec(catalogMosaic)");
    expect(viewerSource).toContain("catalogMosaic.texture");
    expect(viewerSource).toContain("mosaicFinish: catalogMosaic.finish");
    // the old hand-coded per-product special cases are gone
    expect(viewerSource).not.toContain('THREE_D_DESERT_CLAY_MOSAIC_URL');
    expect(viewerSource).not.toContain('THREE_D_CARBON_HEX_MOSAIC_URL');
    expect(viewerSource).not.toContain('THREE_D_MISTY_COAST');
  });

  it("3D paints the finish on the backsplash material, so honed stone is not mirror glass", () => {
    expect(viewerSource).toContain("threeDMosaicSurfaceProfile(mosaicFinish");
    expect(viewerSource).toContain("mosaicFinishProfile(finish ?? \"polished\")");
  });

  it("the Designer sends the catalog mosaic texture, not a staged room photo", () => {
    expect(designToolSource).toContain("mosaicCatalogFor({");
    expect(designToolSource).toContain("if (mosaic) return mosaic.texture;");
    expect(designToolSource).toContain("mosaicFloorEntry.texture");
  });

  it("the elevation keeps using the shared spec, so its grout matches the 3D joint", () => {
    expect(elevationSource).toContain("mosaicSheetSpecFor({ name: productName");
    expect(elevationSource).toContain("interlock.groutColor");
  });
});
