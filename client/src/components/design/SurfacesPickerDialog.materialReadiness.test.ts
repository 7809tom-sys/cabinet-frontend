import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchesCountertopSwatchFilter } from "./SurfacesPickerDialog";

const source = readFileSync(new URL("./SurfacesPickerDialog.tsx", import.meta.url), "utf8");

describe("Surfaces picker 3D material readiness", () => {
  it("keeps shopper photos display-only and clearly reports whether a 3D surface has an approved material swatch", () => {
    expect(source).toContain("const hasThreeDMaterialRole");
    expect(source).toContain("const hasApprovedMaterialSwatch = Boolean(p.materialImageUrl?.trim())");
    expect(source).toContain('data-testid={`surface-material-readiness-${p.id}`}');
    expect(source).toContain('"3D material swatch ready"');
    expect(source).toContain('"3D material swatch pending — neutral preview"');
    expect(source).toContain("imageUrl: p.imageUrl");
    expect(source).toContain("materialImageUrl: p.materialImageUrl");
  });

  it("keeps every active, priced countertop available for selection while reserving exact 3D rendering for approved swatches", () => {
    expect(source).toContain("return matchesCountertopSwatchFilter(item, countertopSwatchFilter);");
    expect(source).toContain('data-testid="countertop-selection-availability"');
    expect(source).toContain("All active, source-priced countertop products are available to select and quote.");
    expect(source).toContain("becomes a texture. Flooring and tile keep the stricter swatch rule.");
  });

  it("filters countertop selections by exact swatch readiness without hiding either set from the full palette", () => {
    const swatchReady = { category: "Quartz Slabs (Countertops)", materialImageUrl: "/manus-storage/approved-slab.webp" };
    const swatchPending = { category: "Quartz Slabs (Countertops)", materialImageUrl: null };

    expect(matchesCountertopSwatchFilter(swatchReady, "all")).toBe(true);
    expect(matchesCountertopSwatchFilter(swatchPending, "all")).toBe(true);
    expect(matchesCountertopSwatchFilter(swatchReady, "swatch-ready")).toBe(true);
    expect(matchesCountertopSwatchFilter(swatchPending, "swatch-ready")).toBe(false);
    expect(matchesCountertopSwatchFilter(swatchReady, "swatch-pending")).toBe(false);
    expect(matchesCountertopSwatchFilter(swatchPending, "swatch-pending")).toBe(true);
    expect(source).toContain('data-testid="countertop-swatch-filter"');
    expect(source).toContain("3D material swatch ready ({countertopSwatchCounts.ready})");
    expect(source).toContain("Neutral preview — swatch pending ({countertopSwatchCounts.pending})");
  });

  it("resolves saved favorites through the same verified Designer source rather than stale browser data", () => {
    expect(source).toContain("trpc.surfaces.designerByIds.useQuery");
    expect(source).toContain("const preferredIds = useMemo");
    expect(source).toContain("pelicanCode: product.pelicanCode");
    expect(source).toContain("No saved products currently meet the verified Designer gate.");
    expect(source).toContain("Saved favorites remain in your catalog list.");
  });

  it("requests the server's complete verified palette rather than retaining a 60-item first-page cap", () => {
    expect(source).toContain("const PAGE_LIMIT = 200");
    expect(source).toContain("verified sink/faucet choices");
  });
});
