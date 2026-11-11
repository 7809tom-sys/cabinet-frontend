import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HardwareOverlay } from "./ElevationView";
import { IslandHardwareOverlay } from "./IslandElevationView";

function tops(markup: string) {
  return (markup.match(/<div\b[^>]*>/g) ?? [])
    .filter((attributes) => attributes.includes('data-cabinet-hardware="drawer-pull"'))
    .map((attributes) => {
      const style = attributes.match(/\sstyle="([^"]*)"/)?.[1] ?? "";
      const top = style.match(/(?:^|;)top:([-+]?\d*\.?\d+)%/);
      expect(top, attributes).not.toBeNull();
      expect(attributes).toContain('data-hardware-orientation="horizontal"');
      expect(attributes).toContain('data-hardware-position="center"');
      return Number(top![1]);
    });
}

describe("drawer-base hardware in elevation and island views", () => {
  it("centers a horizontal pull on each stacked 2DB, 3DB, and 4DB front", () => {
    const elevation = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 0,
      drawers: 2,
      doorPiece: "none",
      drawerPiece: "pull",
      accent: "#1a2744",
      hardwarePosition: "top-center",
      isWall: false,
      faceWidthIn: 24,
      cabinetHeightIn: 34.5,
      masterCode: "2DB24",
    }));
    expect(tops(elevation)).toEqual([25, 75]);

    const three = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 0,
      drawers: 3,
      doorPiece: "none",
      drawerPiece: "pull",
      accent: "#1a2744",
      hardwarePosition: "left",
      isWall: false,
      faceWidthIn: 30,
      cabinetHeightIn: 34.5,
      masterCode: "3DB30",
    }));
    const threeTops = tops(three);
    expect(threeTops).toHaveLength(3);
    expect(threeTops[0]).toBeCloseTo(10, 5);
    expect(threeTops[1]).toBeCloseTo(40, 5);
    expect(threeTops[2]).toBeCloseTo(80, 5);

    const island = renderToStaticMarkup(createElement(IslandHardwareOverlay, {
      doors: 0,
      drawers: 4,
      doorPiece: "none",
      drawerPiece: "pull",
      accent: "#1a2744",
      hardwarePosition: "top-center",
      faceWidthIn: 30,
      faceHeightIn: 34.5,
      masterCode: "4DB30",
    }));
    const islandTops = tops(island);
    expect(islandTops).toHaveLength(4);
    expect(islandTops[0]).toBeCloseTo(12.5, 5);
    expect(islandTops[1]).toBeCloseTo(37.5, 5);
    expect(islandTops[2]).toBeCloseTo(62.5, 5);
    expect(islandTops[3]).toBeCloseTo(87.5, 5);
  });
});
