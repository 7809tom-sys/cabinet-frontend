import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const cartLines = read("client/src/lib/surfaceCartLines.ts");
const cartPage = read("client/src/pages/Cart.tsx");
const designTool = read("client/src/pages/DesignTool.tsx");

describe("mosaic backsplash waste is wired into the cart, not just defined", () => {
  it("applies the rule inside the one place backsplash square footage becomes cart quantity", () => {
    expect(cartLines).toContain("isMosaicBacksplashPick, mosaicBacksplashWasteFactor, mosaicSheetSquareFeet");
    expect(cartLines).toContain("const mosaicBacksplash = isBacksplash && isMosaicBacksplashPick(s);");
    expect(cartLines).toContain("? mosaicBacksplashWasteFactor()");
    expect(cartLines).toContain("mosaicSheetSquareFeet(s)");
    expect(cartLines).toContain("if (mosaicBacksplash) qtyNote += ` (${MOSAIC_BACKSPLASH_WASTE_NOTE})`;");
  });

  it("keeps the flooring and countertop branches reachable, so the rule is scoped to backsplash", () => {
    expect(cartLines).toContain("const factor = isFlooring");
    expect(cartLines).toContain("const isCountertop = cat.includes(\"countertop\") || cat.includes(\"quartz slab\");");
  });

  it("still builds the surface lines from the measured backsplash area, unchanged by this rule", () => {
    expect(designTool).toContain("backsplashSqFt,");
    expect(designTool).toContain("buildSurfaceCartLines(selectedPlanSurfaces");
  });

  it("shows the same waste note in the Designer's own cart drawer", () => {
    expect(designTool).toContain('import { mosaicBacksplashWasteInNote } from "@/lib/mosaicBacksplashWaste"');
    expect(designTool).toContain('data-testid="designer-mosaic-backsplash-waste"');
  });

  it("shows the waste note on the cart line as its own labelled element", () => {
    expect(cartPage).toContain('import { cartNoteWithoutMosaicWaste, mosaicBacksplashWasteInNote } from "@/lib/mosaicBacksplashWaste"');
    expect(cartPage).toContain('data-testid="cart-mosaic-backsplash-waste"');
    expect(cartPage).toContain("Mosaic backsplash quantity {mosaicBacksplashWasteInNote(item.qtyNote)}");
    // The waste sentence is lifted out of the generic note so the row never prints it twice.
    expect(cartPage).toContain("cartNoteWithoutMosaicWaste(item.qtyNote)");
  });
});
