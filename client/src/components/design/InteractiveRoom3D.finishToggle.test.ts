import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextThreeDCabinetFinishPreviewId } from "./InteractiveRoom3D";

const roomSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
const designToolSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");

describe("3D cabinet finish color check", () => {
  const options = [
    { id: "101", name: "Antique White", color: "#eee9dd" },
    { id: "202", name: "Sage", color: "#73816f" },
  ];

  it("cycles Plan colors through each real finish and back to Plan colors", () => {
    expect(nextThreeDCabinetFinishPreviewId(options, null)).toBe("101");
    expect(nextThreeDCabinetFinishPreviewId(options, "101")).toBe("202");
    expect(nextThreeDCabinetFinishPreviewId(options, "202")).toBeNull();
  });

  it("does not invent a preview option when no selected catalog finish exists", () => {
    expect(nextThreeDCabinetFinishPreviewId([], null)).toBeNull();
  });

  it("exposes the quick toggle on desktop, mobile, and the finish panel", () => {
    expect(roomSource).toContain('data-testid="three-d-cabinet-color-toggle"');
    expect(roomSource).toContain('data-testid="three-d-mobile-cabinet-color-toggle"');
    expect(roomSource).toContain('aria-label="Cabinet color check choices"');
    expect(roomSource).toContain("rear filler matches · not saved");
  });

  it("uses selected catalog styles and applies the preview color to rear fillers and crown", () => {
    expect(designToolSource).toContain("styleA ?? styleId");
    expect(designToolSource).toContain("styleB,");
    expect(designToolSource.match(/cabinetFinishPreviewOptions=\{threeDCabinetFinishPreviewOptions\}/g)).toHaveLength(2);
    expect(roomSource).toContain("visibleCabinetFinishOverrides = selectedCabinetPreviewFinish ? undefined : cabinetFinishOverrides");
    expect(roomSource).toContain("addThreeDGlassStackerRearSupports(catalogRoot, placed, room, visibleCabinetFinishOverrides, finish)");
    expect(roomSource).toContain("addThreeDCrownMolding(catalogRoot, placed, room, visibleCabinetFinishOverrides, finish)");
  });
});
