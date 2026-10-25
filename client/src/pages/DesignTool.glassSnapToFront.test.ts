import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
const room3d = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");

describe("glass cabinet Snap to Front controls", () => {
  it("offers the action in desktop/compact and mobile selected-cabinet controls", () => {
    expect(designTool).toContain('data-testid="glass-stacker-snap-to-front"');
    expect(designTool).toContain('data-testid="mobile-glass-stacker-snap-to-front"');
    expect(designTool).toContain("glassStackerFrontSnapTarget(selectedCab, placed, room)");
    expect(designTool).toContain("depthPositionAdjusted: true");
  });

  it("offers the same action in the 3D cabinet inspector", () => {
    expect(room3d).toContain('data-testid="three-d-glass-stacker-snap-to-front"');
    expect(room3d).toContain("onSnapGlassCabinetToFront!(selectedCabinet.uid!)");
    expect(room3d).toContain("!preserveGlassStackerFrontDepth");
  });
});
