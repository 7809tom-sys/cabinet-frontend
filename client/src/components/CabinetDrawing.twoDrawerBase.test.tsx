import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CabinetDrawing } from "./CabinetDrawing";

describe("CabinetDrawing 2-DB family", () => {
  it("renders active 2-DB30 as exactly two equal-height drawer fronts", () => {
    const markup = renderToStaticMarkup(createElement(CabinetDrawing, {
      cabinet: {
        masterCode: "2-DB30",
        description: '30" 2 Drawer Base Cabinet',
        category: "Base",
        subCategory: "Drawer Base",
        width: 30,
        height: 34.5,
        numberOfDoors: 0,
        numberOfDrawers: 2,
        drawerHeight: 14.5,
      },
    }));

    expect(markup).toContain('data-cabinet-drawing="drawer-base"');
    const heights = Array.from(markup.matchAll(/data-drawer-front-height="([^"]+)"/g))
      .map((match) => Number(match[1]));
    expect(heights).toHaveLength(2);
    expect(heights[0]).toBeCloseTo(heights[1]!, 12);
  });

  it("renders active 3-DB30 with a shallow top drawer and two equal deeper drawers", () => {
    const markup = renderToStaticMarkup(createElement(CabinetDrawing, {
      cabinet: {
        masterCode: "3-DB30",
        description: '30" 3 Drawer Base Cabinet',
        category: "Base",
        subCategory: "Drawer Base",
        width: 30,
        height: 34.5,
        numberOfDoors: 0,
        numberOfDrawers: 3,
        drawerHeight: null,
        drawerLayout: null,
      },
    }));

    const heights = Array.from(markup.matchAll(/data-drawer-front-height="([^"]+)"/g)).map((match) => Number(match[1]));
    expect(heights).toHaveLength(3);
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeCloseTo(heights[2]!, 12);
  });
});
