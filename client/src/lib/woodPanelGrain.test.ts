import { describe, expect, it } from "vitest";
import { WOOD_PANEL_WINDOW, largeFacePositionUvs, largeWoodFaceGrain, woodPanelPieceCrop, woodPanelPieceUv, woodPanelPreviewUv, woodPanelSampleInches, woodPanelSourceRect } from "./woodPanelGrain";

describe("wood panel grain", () => {
  it("keeps the full-height center strip inside the frame", () => {
    const rect = woodPanelSourceRect(454, 715);
    expect(rect.x).toBeGreaterThanOrEqual(Math.floor(454 * WOOD_PANEL_WINDOW.x));
    expect(rect.x + rect.width).toBeLessThanOrEqual(Math.ceil(454 * (WOOD_PANEL_WINDOW.x + WOOD_PANEL_WINDOW.width)));
    expect(rect.y).toBeGreaterThanOrEqual(Math.floor(715 * WOOD_PANEL_WINDOW.y));
    expect(rect.y + rect.height).toBeLessThanOrEqual(Math.ceil(715 * (WOOD_PANEL_WINDOW.y + WOOD_PANEL_WINDOW.height)));
    expect(WOOD_PANEL_WINDOW.width).toBeCloseTo(0.4);
    expect(WOOD_PANEL_WINDOW.height).toBeCloseTo(0.7);
  });

  it("previews that window as one clamped copy", () => {
    const uv = woodPanelPreviewUv();
    expect(uv.repeatX).toBeLessThanOrEqual(1);
    expect(uv.repeatY).toBeLessThanOrEqual(1);
    expect(uv.repeatX).toBe(WOOD_PANEL_WINDOW.width);
    expect(uv.offsetX).toBe(WOOD_PANEL_WINDOW.x);
    expect(uv.offsetY).toBeCloseTo(1 - WOOD_PANEL_WINDOW.y - WOOD_PANEL_WINDOW.height);
  });

  it("crops one copy to the piece aspect and never repeats", () => {
    const panel = woodPanelPieceUv(14, 24, "vertical", 0.2);
    expect(panel.repeatX).toBeLessThanOrEqual(1);
    expect(panel.repeatY).toBeLessThanOrEqual(1);
    expect(panel.rotation).toBe(0);
    expect(panel.repeatX / panel.repeatY).toBeCloseTo(14 / 24, 1);
    const rail = woodPanelPieceCrop(24, 2.75, "horizontal", 0.4);
    expect(rail.rotation).toBe(Math.PI / 2);
    expect(rail.width / rail.height).toBeCloseTo(2.75 / 24, 1);
    expect(rail.x).toBeGreaterThanOrEqual(WOOD_PANEL_WINDOW.x);
    expect(rail.y).toBeGreaterThanOrEqual(WOOD_PANEL_WINDOW.y);
    expect(rail.x + rail.width).toBeLessThanOrEqual(WOOD_PANEL_WINDOW.x + WOOD_PANEL_WINDOW.width + 0.001);
    expect(rail.y + rail.height).toBeLessThanOrEqual(WOOD_PANEL_WINDOW.y + WOOD_PANEL_WINDOW.height + 0.001);
  });

  it("keeps one real-inch scale on large faces and does not mirror across the grain", () => {
    const sample = woodPanelSampleInches(1017, 1928);
    expect(sample.width).toBeCloseTo(6);
    expect(sample.height).toBeCloseTo(15 * (1928 / 1017) * 0.7, 2);
    // A side face: X is the normal, Y is height, Z is depth.
    const side = (height: number, depth: number) => largeFacePositionUvs([
      { x: 0, y: 0, z: 0 }, { x: 0, y: height, z: 0 }, { x: 0, y: height, z: depth },
      { x: 0, y: 0, z: 0 }, { x: 0, y: height, z: depth }, { x: 0, y: 0, z: depth },
    ], "vertical", sample, 0.2);
    const span = (uvs: Array<{ u: number; v: number }>, key: "u" | "v") => {
      const values = uvs.map((uv) => uv[key]);
      return Math.max(...values) - Math.min(...values);
    };
    const door = side(30, 12);
    const tall = side(96, 24);
    // One V cycle is the crop plus its mirror, so the unmirrored tile is twice the V span.
    expect(30 / (span(door, "v") * 2)).toBeCloseTo(sample.height, 2);
    expect(96 / (span(tall, "v") * 2)).toBeCloseTo(sample.height, 2);
    expect(96 / span(tall, "v")).toBeCloseTo(30 / span(door, "v"), 2);
    for (const uv of tall) {
      expect(uv.u).toBeGreaterThanOrEqual(0);
      expect(uv.u).toBeLessThanOrEqual(1);
    }
    // 24 inches across is wider than the 6 inch crop, so the face uses the whole crop once.
    expect(span(tall, "u")).toBeCloseTo(1, 2);
    // Narrower than the crop: a fixed-scale window, still not mirrored.
    const narrow = side(40, 4);
    expect(span(narrow, "u")).toBeCloseTo(4 / sample.width, 2);
    expect(span(narrow, "u")).toBeLessThan(1);
  });

  it("runs top grain along the width and toe-kick grain along the length", () => {
    const sample = { width: 6, height: 20 };
    const top = largeFacePositionUvs([
      { x: 0, y: 40, z: 0 }, { x: 36, y: 40, z: 0 }, { x: 36, y: 40, z: 12 },
      { x: 0, y: 40, z: 0 }, { x: 36, y: 40, z: 12 }, { x: 0, y: 40, z: 12 },
    ], "vertical", sample, 0);
    const v = top.map((uv) => uv.v);
    expect(Math.max(...v) - Math.min(...v)).toBeCloseTo(36 / (sample.height * 2), 2);
    const kick = largeFacePositionUvs([
      { x: 0, y: 0, z: 0 }, { x: 36, y: 0, z: 0 }, { x: 36, y: 4.5, z: 0 },
      { x: 0, y: 0, z: 0 }, { x: 36, y: 4.5, z: 0 }, { x: 0, y: 4.5, z: 0 },
    ], "along-length", sample, 0);
    const kickV = kick.map((uv) => uv.v);
    expect(Math.max(...kickV) - Math.min(...kickV)).toBeCloseTo(36 / (sample.height * 2), 2);
    expect(largeWoodFaceGrain({ cabinetFront: true, grainPiece: "rail" })).toBeNull();
    expect(largeWoodFaceGrain({ cabinetDrawerFront: true })).toBeNull();
    expect(largeWoodFaceGrain({ cabinetFaceFrame: true })).toBeNull();
    expect(largeWoodFaceGrain({ decorativeEndPanel: true })).toBe("vertical");
    expect(largeWoodFaceGrain({ baseToeKick: true })).toBe("along-length");
    expect(largeWoodFaceGrain({ baseFillerFace: true })).toBe("along-length");
    expect(largeWoodFaceGrain({ carcassShell: true, selectedStyleSideSkin: true })).toBe("vertical");
  });

  it("shifts neighboring pieces onto different patches", () => {
    const left = woodPanelPieceCrop(2.75, 24, "vertical", 0.05);
    const right = woodPanelPieceCrop(2.75, 24, "vertical", 0.85);
    expect(left.x).not.toBeCloseTo(right.x, 2);
    expect(left.width).toBeCloseTo(right.width);
  });
});
