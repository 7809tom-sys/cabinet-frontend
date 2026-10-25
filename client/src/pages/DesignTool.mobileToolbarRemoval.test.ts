import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("mobile Designer toolbar simplification", () => {
  it("keeps the compact desktop view group and removes the old redundant mobile mode group", () => {
    expect(source).toContain('className={`${isCompactWorkspace ? "hidden" : "hidden lg:flex"} items-center rounded-md');
    expect(source).not.toContain('className="lg:hidden flex shrink-0 items-center rounded-full');
    expect(source).not.toContain('title="Bird\'s-eye plan view"');
    expect(source).not.toContain('title="Front elevation view"');
    expect(source).not.toContain("3D+Plan");
  });

  it("moves Front and Lock to the top strip and removes duplicate Cart and Custom actions from the bottom strip", () => {
    expect(source).toContain('data-testid="mobile-designer-top-actions"');
    expect(source).toContain('title={viewMode === "elevation" ? "Plan view" : "Front view"}');
    expect(source.match(/title="3D view"/g)).toHaveLength(1);
    expect(source).toContain('aria-label="3D view"');
    expect(source).toContain('onClick={() => setViewMode("threeD")}');
    expect(source).toContain('title={cabinetsLocked ? "Unlock cabinets" : "Lock cabinets"}');
    expect(source).not.toContain('label="Cart"');
    expect(source).not.toContain('label="Custom"');
    expect(source).not.toContain('label={cabinetsLocked ? "Locked" : "Lock"}');
  });

  it("publishes the drawing count to the top cart and prevents the Walls sheet from auto-focusing an input", () => {
    expect(source).toContain("publishDesignerMobileCartCount(placed.length)");
    expect(source).toContain('registerDesignerMobileCartOpener(() => setMobilePanel("cart"))');
    expect(source).toContain("onOpenAutoFocus={preventMobileRoomSheetAutoFocus}");
  });
});
