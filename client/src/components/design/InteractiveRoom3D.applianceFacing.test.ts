import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");

describe("Google render request carries appliance facing", () => {
  it("derives the facing from the locked 3D placement and the locked camera", () => {
    expect(source).toContain('import { buildRenderApplianceFacing } from "@/lib/renderApplianceFacing";');
    expect(source).toContain("applianceFacing: buildRenderApplianceFacing({");
    expect(source).toContain("camera: cameraSnapshot,");
    expect(source).toContain("rotationFor: (cabinet) => existingCabinetTransform(cabinet, renderRoom).rotation,");
  });

  it("puts the facing block inside the render specification, next to the appliance list", () => {
    const specification = source.slice(
      source.indexOf("const renderSpecification = {"),
      source.indexOf("const provenance = {"),
    );
    expect(specification).toContain("appliances:");
    expect(specification).toContain("applianceFacing:");
    expect(specification.indexOf("applianceFacing:")).toBeGreaterThan(specification.indexOf("appliances:"));
  });

  it("sends the same locked capture to Gemini, so image 1 is still the layout being preserved", () => {
    const handler = source.slice(source.indexOf("const startGeminiImageTest = async () =>"), source.indexOf("const openSavedGeminiImageTest"));
    expect(handler).toContain("compactGoogleImageTestInput(photoRenderDraft.sceneImageDataUrl)");
    expect(handler).toContain("sceneImageDataUrl: googleImageInput,");
    expect(handler).toContain("serializeGeminiImageTestProvenanceForWire(photoRenderDraft.provenance)");
  });

  it("does not snap door colors to the brand palette on this path", () => {
    expect(source).not.toContain("snapDoorColorToBrandPalette");
  });
});
