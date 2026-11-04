import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Designer mosaic floor pattern", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

  it("asks for a pattern when a floor mosaic is chosen and saves it with the design", () => {
    expect(source).toContain("MosaicFloorPatternDialog");
    expect(source).toContain("setMosaicFloorPrompt(item)");
    expect(source).toContain("mosaicFloorPattern: mosaicFloorPatternOrStraight(mosaicFloorPattern)");
    expect(source).toContain('data-testid="mosaic-floor-material-controls"');
    expect(source).toContain("mosaicFloor={mosaicFloorView}");
    expect(source).toContain("onMosaicFloorPatternChange={setMosaicFloorPattern}");
    expect(source).toContain("isMosaicFloorPattern");
  });

  it("uses the mosaic picture for a floor mosaic and keeps plank photos off the floor", () => {
    // A mosaic marked "use as floor" renders from its verified catalog texture (lib/mosaicCatalog.ts),
    // falling back to its own backsplash picture when it is not a catalog product.
    expect(source).toContain("if (isMosaicFloorProduct(selected)) {");
    expect(source).toContain("if (mosaicFloorEntry) return selected?.materialImageUrl?.trim() || mosaicFloorEntry.texture;");
    expect(source).toContain("return selectedBacksplashTextureUrl(selected).url;");
    expect(source).toContain("flooringSceneTextureUrl(selected, approvedFlooringSwatchByProductId)");
    expect(source).not.toContain("activeFlooringSurface?.materialImageUrl ?? activeFlooringSurface?.imageUrl");
  });
});
