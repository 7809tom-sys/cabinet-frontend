import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("mobile and tablet Designer attributes", () => {
  it("keeps a visible, touch-safe Attributes command in the mobile action strip", () => {
    expect(source).toContain('testId="mobile-designer-attributes"');
    expect(source).toContain('label="Attributes"');
    expect(source).toContain("onClick={openMobileAttributes}");
    expect(source).toContain('data-testid={testId}');
  });

  it("routes each touch selection to the same authoritative desktop property editor", () => {
    expect(source).toContain("const openMobileAttributes = useCallback(() => {");
    expect(source).toContain("openAttributes(selectedUid);");
    expect(source).toContain('if (opening?.kind === "window")');
    expect(source).toContain("openWindowAttributes(opening.uid);");
    expect(source).toContain("openWallSettings(opening.side);");
    expect(source).toContain("setIslandAttributesOpen(true);");
    expect(source).toContain("openWallSettings(activeWall);");
  });

  it("opens the complete responsive cabinet dialog rather than a reduced quick-edit sheet", () => {
    const attributesHandler = source.slice(
      source.indexOf("const openAttributes = useCallback"),
      source.indexOf("const openMobileAttributes = useCallback"),
    );

    expect(attributesHandler).toContain("setAttrOpen(true);");
    expect(attributesHandler).toContain("setCabEditSheetOpen(false);");
    expect(attributesHandler).toContain("exact\n\t    // wall position, corner clearance");
    expect(source).toContain("<CabinetAttributesDialog");
  });
});
