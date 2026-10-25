import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");

describe("island-level waterfall rendering", () => {
  it("renders the selected physical end as a continuous full-height active-material panel", () => {
    expect(source).toContain('const waterfallEnd = island.waterfallEnd');
	    expect(source).toContain('waterfallEnd === "both"');
	    expect(source).toContain('waterfallEnds.forEach((end) =>');
    expect(source).toContain("waterfallSlabs.forEach((slab, slabIndex) =>");
    expect(source).toContain("new THREE.BoxGeometry(panelThickness, panelHeight, slab.depth * INCH)");
    expect(source).toContain("panel.rotation.y = slabRotation");
    expect(source).toContain("panel.translateX((end === \"left\" ? -1 : 1) * slab.width * INCH / 2)");
    expect(source).toContain("usesActiveCountertopMaterial: true");
  });
});
