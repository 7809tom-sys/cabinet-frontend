import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, latticeWineRackLayout } from "./InteractiveRoom3D";

describe("lattice wine rack 3D front", () => {
  it("lays out the WRC3015 / LWR3015 wall wine rack as an 11-bottle diamond lattice inside the opening", () => {
    // 30 × 15 box less 1¼" face frame on each side.
    const layout = latticeWineRackLayout(27.5, 12.5);
    expect(layout.rows).toBe(2);
    expect(layout.columns).toBe(4);
    expect(layout.bottles).toHaveLength(11);
    expect(layout.bottleRadius * 2).toBeGreaterThan(3.25);
    for (const bottle of layout.bottles) {
      expect(bottle.x - layout.cell / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(bottle.x + layout.cell / 2).toBeLessThanOrEqual(27.5 + 1e-9);
      expect(bottle.y - layout.cell / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(bottle.y + layout.cell / 2).toBeLessThanOrEqual(12.5 + 1e-9);
    }
    for (const bar of layout.bars) {
      const run = bar.length / Math.SQRT2 / 2;
      for (const end of [-1, 1]) {
        const x = bar.x + end * run;
        const y = bar.y + end * run * bar.slope;
        expect(x).toBeGreaterThanOrEqual(-1e-9);
        expect(x).toBeLessThanOrEqual(27.5 + 1e-9);
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeLessThanOrEqual(12.5 + 1e-9);
      }
    }
  });

  it("renders a lattice wine rack with a face frame and clipped bars in the door finish", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 614, masterCode: "WRC3015", description: "Wall Wine Rack Cabinet", placementType: "wall",
      width: 30, height: 15, depth: 12, facePattern: "lattice",
    } as never, "back", {}, 144, 120, "#b99a6b", "#f8f8f6");
    const parts: THREE.Mesh[] = [];
    root.traverse((object) => { if (object instanceof THREE.Mesh) parts.push(object); });
    const bars = parts.filter((mesh) => mesh.userData.wineRackLatticeBar);
    const frame = parts.filter((mesh) => mesh.userData.wineRackFaceFrame);
    expect(frame).toHaveLength(4);
    expect(bars.length).toBeGreaterThan(4);
    expect(bars[0].material).toBe(frame[0].material);
    const halfWidth = 15 / 12;
    for (const bar of bars) {
      const length = (bar.geometry as THREE.BoxGeometry).parameters.width;
      expect(Math.abs(bar.position.x) + (length / Math.SQRT2) / 2).toBeLessThanOrEqual(halfWidth + 1e-6);
    }
  });
});
