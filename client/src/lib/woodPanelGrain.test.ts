import { describe, expect, it } from "vitest";
import {
  WOOD_PANEL_SAMPLE_IN,
  WOOD_PANEL_WINDOW,
  woodGrainUv,
  woodMeshGrain,
  woodPanelPreviewUv,
  woodPanelSampleInches,
  woodPanelSourceRect,
} from "./woodPanelGrain";

describe("wood panel grain", () => {
  it("keeps the full-height center strip inside the frame", () => {
    const rect = woodPanelSourceRect(1017, 1928);
    expect(rect.width).toBeGreaterThan(300);
    expect(rect.height).toBeGreaterThan(1000);
    expect(rect.x).toBeGreaterThanOrEqual(Math.floor(1017 * WOOD_PANEL_WINDOW.x));
    expect(rect.x + rect.width).toBeLessThanOrEqual(Math.ceil(1017 * (WOOD_PANEL_WINDOW.x + WOOD_PANEL_WINDOW.width)) + 1);
    expect(WOOD_PANEL_WINDOW.width).toBeCloseTo(0.4);
    expect(WOOD_PANEL_WINDOW.height).toBeCloseTo(0.7);
  });

  it("sizes one tile from a 15 inch door, not from the piece", () => {
    expect(WOOD_PANEL_SAMPLE_IN.width).toBeCloseTo(6);
    expect(WOOD_PANEL_SAMPLE_IN.height).toBeCloseTo(21);
    const dawn = woodPanelSampleInches(1017, 1928);
    expect(dawn.width).toBeCloseTo(6);
    expect(dawn.height).toBeCloseTo(15 * (1928 / 1017) * 0.7, 1);
  });

  it("previews that window as one clamped copy before the photo loads", () => {
    const uv = woodPanelPreviewUv();
    expect(uv.repeatX).toBe(WOOD_PANEL_WINDOW.width);
    expect(uv.repeatY).toBe(WOOD_PANEL_WINDOW.height);
    expect(uv.repeatX).toBeLessThanOrEqual(1);
  });

  it("keeps the same inches per tile on a door, a tall end, and a wide drawer", () => {
    const sample = WOOD_PANEL_SAMPLE_IN;
    const doorA = woodGrainUv({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, "vertical", sample, 0);
    const doorB = woodGrainUv({ x: 12, y: 30, z: 0 }, { x: 0, y: 0, z: 1 }, "vertical", sample, 0);
    expect(Math.abs(doorB.u - doorA.u)).toBeCloseTo(12 / sample.width);
    expect(Math.abs(doorB.v - doorA.v)).toBeCloseTo(30 / sample.height);

    const endA = woodGrainUv({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, "vertical", sample, 0);
    const endB = woodGrainUv({ x: 0, y: 96, z: 24 }, { x: 1, y: 0, z: 0 }, "vertical", sample, 0);
    expect(Math.abs(endB.v - endA.v)).toBeCloseTo(96 / sample.height);
    expect(Math.abs(endB.u - endA.u)).toBeCloseTo(24 / sample.width);
    expect(96 / Math.abs(endB.v - endA.v)).toBeCloseTo(30 / Math.abs(doorB.v - doorA.v));

    const drawerA = woodGrainUv({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, "horizontal", sample, 0);
    const drawerB = woodGrainUv({ x: 30, y: 6, z: 0 }, { x: 0, y: 0, z: 1 }, "horizontal", sample, 0);
    expect(Math.abs(drawerB.v - drawerA.v)).toBeCloseTo(30 / sample.height);
    expect(Math.abs(drawerB.u - drawerA.u)).toBeCloseTo(6 / sample.width);
  });

  it("runs top grain along the cabinet width at the same scale", () => {
    const sample = WOOD_PANEL_SAMPLE_IN;
    const near = woodGrainUv({ x: 0, y: 40, z: 0 }, { x: 0, y: 1, z: 0 }, "vertical", sample, 0);
    const far = woodGrainUv({ x: 36, y: 40, z: 12 }, { x: 0, y: 1, z: 0 }, "vertical", sample, 0);
    expect(Math.abs(far.v - near.v)).toBeCloseTo(36 / sample.height);
    expect(Math.abs(far.u - near.u)).toBeCloseTo(12 / sample.width);
  });

  it("shifts neighboring pieces and keeps drawers horizontal", () => {
    const sample = WOOD_PANEL_SAMPLE_IN;
    const left = woodGrainUv({ x: 4, y: 10, z: 0 }, { x: 0, y: 0, z: 1 }, "vertical", sample, 0.1);
    const right = woodGrainUv({ x: 4, y: 10, z: 0 }, { x: 0, y: 0, z: 1 }, "vertical", sample, 0.8);
    expect(left.u).not.toBeCloseTo(right.u, 2);
    expect(woodMeshGrain({ cabinetDrawerFront: true })).toBe("horizontal");
    expect(woodMeshGrain({ falseDrawerFront: true })).toBe("horizontal");
    expect(woodMeshGrain({ grainPiece: "rail" })).toBe("horizontal");
    expect(woodMeshGrain({ baseToeKick: true })).toBe("horizontal");
    expect(woodMeshGrain({ refrigeratorEndPanel: true })).toBe("vertical");
    expect(woodMeshGrain({ selectedStyleSideSkin: true })).toBe("vertical");
  });
});
