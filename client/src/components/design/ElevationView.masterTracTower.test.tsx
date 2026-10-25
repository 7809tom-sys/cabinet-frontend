import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { lightRailLinearInches, toeKickLinearInches, type RoomData } from "@/lib/design";
import { defaultTowerConfig, planMasterTracTower } from "@/lib/masterTracTower";
import { ElevationView } from "./ElevationView";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

describe("MasterTrac tower elevation", () => {
  it("renders the exact ¾-inch upright and shelf faces without generic kitchen treatments", () => {
    const planned = planMasterTracTower(defaultTowerConfig("Spiced Mahogany"), room, "top", 12, []);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const markup = renderToStaticMarkup(createElement(LanguageProvider, null, createElement(ElevationView, {
      room, cabinets: planned.plan.boards, wall: "top", selectedUid: null,
      onSelect: () => undefined, crown: true, toeKick: true, lightRail: true,
    })));
    expect(markup.match(/data-testid="mastertrac-elevation-board"/g)).toHaveLength(11);
    expect(markup.match(/height:348px/g)?.length).toBeGreaterThanOrEqual(3); // 87-inch uprights × 4px/in
    expect(markup).toContain("background-color:#6a4236");
    expect(markup).toContain("bottom:120px"); // 30-inch adjustable shelf × 4px/in
    expect(markup).not.toContain('data-testid="continuous-toe-kick-run"');
    expect(markup).not.toContain('data-testid="continuous-crown-run"');
    expect(markup).not.toContain('data-testid="light-rail-strip"');
    expect(markup).toContain('data-tower-id="tower-preview"');
    expect(toeKickLinearInches(planned.plan.boards)).toBe(0);
    expect(lightRailLinearInches(planned.plan.boards, room)).toBe(0);
  });
  it("draws the installed 22.5-inch cut shelf but keeps the purchased 24-inch stock SKU visible", () => {
    const config = defaultTowerConfig();
    config.bays[0] = { ...config.bays[0], stockWidthIn: 24, widthIn: 22.5 };
    const planned = planMasterTracTower(config, room, "top", 0, []);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const markup = renderToStaticMarkup(createElement(LanguageProvider, null, createElement(ElevationView, {
      room, cabinets: planned.plan.boards, wall: "top", selectedUid: null, onSelect: () => undefined,
    })));
    expect(markup).toContain("width:90px"); // 22.5 installed inches × 4px/in, not stock 24
    expect(markup).toContain("432529");
    expect(markup).toContain("installed cut from 24 inch stock");
  });
});
