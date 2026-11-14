import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { DoorFront, ElevationView } from "./ElevationView";

function markup(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(DoorFront, {
      kind: "shaker",
      edge: "#1a2744",
      face: "#d8d4c8",
      cabinetType: "sink-base",
      cabinetWidthIn: 30,
      cabinetHeightIn: 34.5,
      doors: 2,
      drawers: 0,
      masterCode: "SB30",
      ...overrides,
    } as never),
  );
}

function elementsWith(html: string, attribute: string) {
  return html.match(new RegExp(`<div[^>]*${attribute}[^>]*>`, "g")) ?? [];
}

describe("sink base elevation false fronts", () => {
  it("draws two side-by-side false fronts on SB30, each half the 30-inch width, in one top row", () => {
    const html = markup();
    expect(elementsWith(html, 'data-sink-base-false-front="true"')).toHaveLength(2);
    expect(elementsWith(html, 'data-sink-base-drawer-col="1"')).toHaveLength(1);
    expect(elementsWith(html, 'data-sink-base-drawer-col="2"')).toHaveLength(1);
    const fronts = elementsWith(html, "data-sink-base-false-front");
    expect(fronts.every((tag) => /width:\s*50%/.test(tag))).toBe(true);
    expect(fronts.some((tag) => /left:\s*0%/.test(tag))).toBe(true);
    expect(fronts.some((tag) => /left:\s*50%/.test(tag))).toBe(true);
    // Both fronts share the same top band (not stacked up and down).
    expect(fronts.every((tag) => /top:\s*0%/.test(tag))).toBe(true);
  });

  it("draws two side-by-side false fronts on an unconfigured SB36", () => {
    const html = markup({ masterCode: "SB36", cabinetWidthIn: 36 });
    expect(elementsWith(html, 'data-sink-base-false-front="true"')).toHaveLength(2);
    expect(elementsWith(html, 'data-sink-base-drawer-row="1"')).toHaveLength(2);
    expect(html).not.toContain('data-sink-base-drawer-row="2"');
  });

  it("keeps an authored single false front full width", () => {
    const html = markup({ masterCode: "SB36", cabinetWidthIn: 36, drawers: 1, numberOfDrawers: 1 });
    expect(elementsWith(html, 'data-sink-base-false-front="true"')).toHaveLength(1);
    expect(elementsWith(html, 'data-sink-base-false-front')[0]).toMatch(/width:\s*100%/);
  });
});

function elevationMarkup(cabinet: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(ElevationView, {
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        cabinets: [{
          uid: "sb", cabinetId: 1, category: "Base", placement: "base",
          x: 0, y: 0, height: 34.5, depth: 24, rotation: 0, numberOfDoors: 2, ...cabinet,
        }] as never,
        selectedUid: null,
        onSelect: () => undefined,
        wall: "back",
        countertopMaterialId: "white-quartz",
        hardwareStyleId: "bar-pull",
      } as never),
    ),
  );
}

describe("sink base elevation false fronts are not working drawers", () => {
  it("draws SB30 and SB36 false fronts without drawer pulls, even if numberOfDrawers is 2", () => {
    for (const cabinet of [
      { masterCode: "SB30", width: 30, description: '30" Sink Base Cabinet', subCategory: "Sink Base", numberOfDrawers: 2 },
      { masterCode: "SB36", width: 36, description: '36" Sink Base Cabinet', subCategory: "Sink Base", numberOfDrawers: 0 },
    ]) {
      const html = elevationMarkup(cabinet);
      expect(elementsWith(html, 'data-sink-base-false-front="true"'), cabinet.masterCode).toHaveLength(2);
      expect(elementsWith(html, 'data-cabinet-hardware="drawer-pull"'), cabinet.masterCode).toHaveLength(0);
      expect(elementsWith(html, 'data-cabinet-hardware="door-pull"'), cabinet.masterCode).toHaveLength(2);
    }
  });
});
