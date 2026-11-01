import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const viewer = read("../components/design/InteractiveRoom3D.tsx");
const elevation = read("../components/design/ElevationView.tsx");

describe("the 3D and elevation renderers use the interlock helpers", () => {
  it("3D: interlocking sheets repeat at the pitch, are cropped to one unit with grout, and keep crisp filtering", () => {
    expect(viewer).toContain("interlockedMosaicUnitImage(");
    expect(viewer).toContain("backsplashModuleIn: interlockSpec ? mosaicPitchIn(interlockSpec).x");
    expect(viewer).toContain("backsplashGroutJointIn: interlockSpec ? clampMosaicGroutIn(interlockSpec.groutIn)");
    expect(viewer).toContain("texture.generateMipmaps = true;");
    expect(viewer).toContain("texture.anisotropy = Math.min(anisotropyCap, renderer.capabilities.getMaxAnisotropy());");
  });
  it("3D: the inside corner is anchored, sheets get a lot shade, cut edges get a finished strip", () => {
    expect(viewer).toContain("mosaicPhaseAnchorEdge(touches.start, touches.end)");
    expect(viewer).toContain("threeDBacksplashSheetGeometry(");
    expect(viewer).toContain("mosaicFinishedEdges(segment, segments");
  });
  it("3D: baseboards come only from baseboardSpans (exposed wall), and the plank floor gets slight depth", () => {
    expect(viewer).toContain("baseboardSpans(placed, openings, room, side)");
    expect(viewer).toContain("addThreeDBaseboards(catalogRoot, renderedPlaced, openings, backsplashRoom)");
    expect(viewer).toContain("bumpMap: floorTexture");
  });
  it("elevation: interlocking mosaics use the pitch and the same grout width", () => {
    expect(elevation).toContain("mosaicInterlockSpecForName(productName)");
    expect(elevation).toContain("interlockGroutPx");
  });
});
