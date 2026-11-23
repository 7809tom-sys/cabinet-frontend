import { describe, expect, it } from "vitest";
import {
  WOOD_PANEL_SAMPLE_IN,
  WOOD_PANEL_WINDOW,
  woodPanelGrainRepeat,
  woodPanelPreviewUv,
  woodPanelSourceRect,
} from "./woodPanelGrain";

describe("wood panel grain", () => {
  it("crops the flat center, inside the stiles and rails", () => {
    const rect = woodPanelSourceRect(454, 715);
    expect(rect.x).toBeGreaterThan(454 * 0.2);
    expect(rect.x + rect.width).toBeLessThan(454 * 0.8);
    expect(rect.y).toBeGreaterThan(715 * 0.15);
    expect(rect.y + rect.height).toBeLessThan(715 * 0.85);
    expect(rect.width / rect.height).toBeLessThan(1);
  });

  it("previews that window in bottom-left UV", () => {
    const uv = woodPanelPreviewUv();
    expect(uv.repeatX).toBe(WOOD_PANEL_WINDOW.width);
    expect(uv.repeatY).toBe(WOOD_PANEL_WINDOW.height);
    expect(uv.offsetX).toBe(WOOD_PANEL_WINDOW.x);
    expect(uv.offsetY).toBeCloseTo(1 - WOOD_PANEL_WINDOW.y - WOOD_PANEL_WINDOW.height);
    expect(uv.repeatX).toBeLessThan(1);
    expect(uv.offsetX).toBeGreaterThan(0);
  });

  it("keeps grain scale in inches and turns rails sideways", () => {
    const stile = woodPanelGrainRepeat(3, 24, "vertical");
    expect(stile.rotation).toBe(0);
    expect(stile.repeatX).toBeCloseTo(3 / WOOD_PANEL_SAMPLE_IN.width);
    expect(stile.repeatY).toBeCloseTo(24 / WOOD_PANEL_SAMPLE_IN.height);
    const rail = woodPanelGrainRepeat(24, 3, "horizontal");
    expect(rail.rotation).toBe(Math.PI / 2);
    expect(rail.repeatX).toBeCloseTo(24 / WOOD_PANEL_SAMPLE_IN.height);
    expect(rail.repeatY).toBeCloseTo(3 / WOOD_PANEL_SAMPLE_IN.width);
    // A short drawer is not one stretched copy of a tall door.
    const drawer = woodPanelGrainRepeat(30, 6, "vertical");
    expect(drawer.repeatX).toBeGreaterThan(1);
    expect(drawer.repeatX / drawer.repeatY).not.toBeCloseTo(30 / 6, 0);
  });
});
