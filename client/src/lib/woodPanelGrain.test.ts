import { describe, expect, it } from "vitest";
import { WOOD_PANEL_WINDOW, woodPanelPieceCrop, woodPanelPieceUv, woodPanelPreviewUv, woodPanelSourceRect } from "./woodPanelGrain";

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

  it("shifts neighboring pieces onto different patches", () => {
    const left = woodPanelPieceCrop(2.75, 24, "vertical", 0.05);
    const right = woodPanelPieceCrop(2.75, 24, "vertical", 0.85);
    expect(left.x).not.toBeCloseTo(right.x, 2);
    expect(left.width).toBeCloseTo(right.width);
  });
});
