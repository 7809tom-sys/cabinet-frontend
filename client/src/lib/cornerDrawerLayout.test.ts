import { describe, expect, it } from "vitest";
import {
  cornerDrawerElevationSplit,
  cornerDrawerFrontLayout,
  cornerDrawerPanelPlanBox,
  cornerDrawerPanelsStayInFootprint,
  cornerDrawerRowHeightsIn,
  isCornerDrawerBaseCabinet,
} from "./cornerDrawerLayout";

const cdb36 = {
  bodyWidth: 36 / 12,
  bodyDepth: 36 / 12,
  bodyHeight: 30 / 12,
  legRatio: 24 / 36,
  drawerCount: 3,
};

describe("corner drawer base layout", () => {
  it("recognizes CDB36 and leaves other corner families alone", () => {
    expect(isCornerDrawerBaseCabinet({ masterCode: "CDB36", description: '36" Corner Drawer Base Cabinet', graphicType: "corner-drawer-base" })).toBe(true);
    expect(isCornerDrawerBaseCabinet({ masterCode: "CDB36-FLUSH", description: '36" Corner Drawer Base' })).toBe(true);
    expect(isCornerDrawerBaseCabinet({ masterCode: "LSB36", description: "Lazy Susan Base" })).toBe(false);
    expect(isCornerDrawerBaseCabinet({ masterCode: "BEC24", description: "Base End Cabinet" })).toBe(false);
    expect(isCornerDrawerBaseCabinet({ masterCode: "BBC36", description: "Blind Corner Base" })).toBe(false);
  });

  it("uses a shallow top drawer and two deeper equal rows", () => {
    expect(cornerDrawerRowHeightsIn(30, 3)).toEqual([6, 12, 12]);
    expect(cornerDrawerRowHeightsIn(34.5, 3)).toEqual([6, 14.25, 14.25]);
    const [top, middle, bottom] = cornerDrawerRowHeightsIn(30, 3);
    expect(top).toBeLessThan(middle!);
    expect(middle).toBeCloseTo(bottom!, 8);
  });

  it("splits a wall elevation into the 24-inch return and the 12-inch drawer face", () => {
    const split = cornerDrawerElevationSplit(36, 30, 3, 24);
    expect(split.returnIn).toBeCloseTo(24, 8);
    expect(split.faceIn).toBeCloseTo(12, 8);
    expect(split.rows).toEqual([6, 12, 12]);
    expect(split.returnPct + split.facePct).toBeCloseTo(100, 8);
  });

  it("builds two perpendicular panels per drawer on the lazy-Susan inside corner", () => {
    const layout = cornerDrawerFrontLayout(cdb36);
    expect(layout.panels).toHaveLength(6);
    expect(layout.insideX).toBeCloseTo(0.5, 8);
    expect(layout.insideZ).toBeCloseTo(0.5, 8);
    for (let row = 0; row < 3; row += 1) {
      const pair = layout.panels.filter((panel) => panel.row === row);
      expect(pair.map((panel) => panel.leg).sort()).toEqual(["back-leg", "side-leg"]);
      const back = pair.find((panel) => panel.leg === "back-leg")!;
      const side = pair.find((panel) => panel.leg === "side-leg")!;
      expect(back.rotationY).toBeCloseTo(0, 8);
      expect(side.rotationY).toBeCloseTo(Math.PI / 2, 8);
      expect(Math.abs(back.width * 12 - 12)).toBeLessThan(2);
      expect(Math.abs(side.width * 12 - 12)).toBeLessThan(2);
      const backBox = cornerDrawerPanelPlanBox(back);
      const sideBox = cornerDrawerPanelPlanBox(side);
      // The panels meet at the inside corner instead of crossing as one flat face.
      expect(Math.abs(backBox.minX - sideBox.maxX)).toBeLessThan(0.02);
      expect(Math.abs(backBox.maxZ - sideBox.minZ)).toBeLessThan(0.02);
    }
    const tops = layout.panels.filter((panel) => panel.row === 0);
    const lowers = layout.panels.filter((panel) => panel.row === 1);
    expect(tops[0]!.height).toBeLessThan(lowers[0]!.height);
    expect(tops[0]!.y).toBeGreaterThan(lowers[0]!.y);
  });

  it("keeps every drawer front inside the cabinet footprint and out of both neighboring runs", () => {
    const layout = cornerDrawerFrontLayout(cdb36);
    expect(cornerDrawerPanelsStayInFootprint(layout.panels, layout)).toBe(true);
    for (const panel of layout.panels) {
      const box = cornerDrawerPanelPlanBox(panel);
      // Leg ends are where the next base cabinet begins. A front past either
      // end intersects that neighbor.
      expect(box.maxX).toBeLessThanOrEqual(layout.right + 1e-6);
      expect(box.maxZ).toBeLessThanOrEqual(layout.front + 1e-6);
      expect(box.minX).toBeGreaterThanOrEqual(layout.left - 1e-6);
      expect(box.minZ).toBeGreaterThanOrEqual(layout.back - 1e-6);
      // The open notch beyond both finished faces belongs to the room, not a drawer.
      const entersNotch = box.maxX > layout.insideX + layout.faceProjection + 1e-4
        && box.maxZ > layout.insideZ + layout.faceProjection + 1e-4;
      expect(entersNotch).toBe(false);
    }

    // The previous straight front sat on the bounding-box face and ran across
    // the full width, through the notch and into the next cabinet.
    const straightFront = {
      x: 0,
      z: layout.front,
      width: cdb36.bodyWidth * 0.92,
      thickness: 0.052,
      rotationY: 0,
    };
    expect(cornerDrawerPanelsStayInFootprint([straightFront], layout)).toBe(false);
  });
});
