import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pantryDrawerFrontLayout } from "@/lib/pantryDrawerLayout";
import { HardwareOverlay } from "./ElevationView";

type PantryLayout = NonNullable<ReturnType<typeof pantryDrawerFrontLayout>>;

function layoutFor(input: Parameters<typeof pantryDrawerFrontLayout>[0], faceHeightIn: number): PantryLayout {
  const layout = pantryDrawerFrontLayout(input, faceHeightIn);
  expect(layout).not.toBeNull();
  return layout!;
}

function renderHardware({
  doors,
  drawers,
  pantryLayout,
  doorPiece = "pull",
  drawerPiece = "pull",
  raisedDoorPullOnRail = false,
}: {
  doors: number;
  drawers: number;
  pantryLayout?: PantryLayout | null;
  doorPiece?: "pull" | "none";
  drawerPiece?: "pull" | "none";
  raisedDoorPullOnRail?: boolean;
}) {
  return renderToStaticMarkup(createElement(HardwareOverlay, {
    doors,
    drawers,
    doorPiece,
    drawerPiece,
    accent: "#1a2744",
    hardwarePosition: "auto",
    swing: doors > 1 ? "double" : "left",
    isWall: false,
    faceWidthIn: 30,
    cabinetHeightIn: pantryLayout ? pantryLayout.doorHeight + pantryLayout.drawerHeight : undefined,
    frameRailIn: 3,
    raisedDoorPullOnRail,
    pantryLayout,
  }));
}

/** Extract top percentages from individual rendered hardware div attributes; no DOM is needed. */
function hardwareTops(markup: string, hardware: "drawer-pull" | "door-pull") {
  return (markup.match(/<div\b[^>]*>/g) ?? [])
    .filter((attributes) => attributes.includes(`data-cabinet-hardware="${hardware}"`))
    .map((attributes) => {
      const style = attributes.match(/\sstyle="([^"]*)"/)?.[1] ?? "";
      const top = style.match(/(?:^|;)top:([-+]?\d*\.?\d+)%/);
      expect(top, attributes).not.toBeNull();
      return Number(top![1]);
    });
}

function drawerCenters(layout: PantryLayout, faceHeightIn: number) {
  let topIn = layout.doorHeight;
  return layout.rows.flatMap((row) => {
    const center = ((topIn + row.height / 2) / faceHeightIn) * 100;
    topIn += row.height;
    return Array.from({ length: row.count }, () => center);
  });
}

function doorBoundary(layout: PantryLayout, faceHeightIn: number) {
  return (layout.doorHeight / faceHeightIn) * 100;
}

function expectPercentagesToMatch(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((top, index) => expect(top).toBeCloseTo(expected[index], 8));
}

describe("HardwareOverlay pantry drawer hardware", () => {
  const t3FaceHeightIn = 79.5;
  const t3 = layoutFor({
    masterCode: "T3DB3084",
    placementType: "tall",
    numberOfDoors: 2,
    numberOfDrawers: 3,
  }, t3FaceHeightIn);

  it("centers T3DB3084 drawer pulls on the authoritative, bottom-anchored source rows", () => {
    const tops = hardwareTops(renderHardware({ doors: 2, drawers: 3, pantryLayout: t3 }), "drawer-pull");
    expectPercentagesToMatch(tops, drawerCenters(t3, t3FaceHeightIn));
  });

  it("keeps every T3DB3084 drawer pull below the source door boundary", () => {
    const tops = hardwareTops(renderHardware({ doors: 2, drawers: 3, pantryLayout: t3 }), "drawer-pull");
    const boundary = doorBoundary(t3, t3FaceHeightIn);
    expect(tops).toHaveLength(3);
    tops.forEach((top) => expect(top).toBeGreaterThan(boundary));
  });

  it("keeps the full vertical pantry pull inside the upper door when a legacy raised-rail position is present", () => {
    const markup = renderHardware({ doors: 2, drawers: 3, pantryLayout: t3, raisedDoorPullOnRail: true });
    const boundary = doorBoundary(t3, t3FaceHeightIn);
    const pullDivs = (markup.match(/<div\b[^>]*>/g) ?? []).filter(attributes => attributes.includes('data-cabinet-hardware="door-pull"'));
    expect(pullDivs).toHaveLength(2);
    for (const attributes of pullDivs) {
      const style = attributes.match(/\sstyle="([^"]*)"/)![1];
      const center = Number(style.match(/(?:^|;)top:([-+]?\d*\.?\d+)%/)![1]);
      const height = Number(style.match(/(?:^|;)height:([-+]?\d*\.?\d+)%/)![1]);
      expect(center - height / 2).toBeGreaterThanOrEqual(0);
      expect(center + height / 2).toBeLessThanOrEqual(boundary);
      expect(height).toBeLessThan(24);
    }
  });

  it("keeps T3DB3084's two automatic door pulls above the source door boundary", () => {
    const tops = hardwareTops(renderHardware({ doors: 2, drawers: 3, pantryLayout: t3 }), "door-pull");
    const boundary = doorBoundary(t3, t3FaceHeightIn);
    expect(tops).toHaveLength(2);
    tops.forEach((top) => expect(top).toBeLessThan(boundary));
  });

  it("uses the two T2DB2494 source drawer centers in the bottom zone at 89.5 inches", () => {
    const faceHeightIn = 89.5;
    const layout = layoutFor({
      masterCode: "T2DB2494",
      placementType: "tall",
      numberOfDoors: 1,
      numberOfDrawers: 2,
    }, faceHeightIn);
    const tops = hardwareTops(renderHardware({ doors: 1, drawers: 2, pantryLayout: layout }), "drawer-pull");
    expectPercentagesToMatch(tops, drawerCenters(layout, faceHeightIn));
    tops.forEach((top) => expect(top).toBeGreaterThan(doorBoundary(layout, faceHeightIn)));
  });

  it("uses the VT3DB1884 three-row source layout rather than equal top drawers", () => {
    const faceHeightIn = 79.5;
    const layout = layoutFor({
      masterCode: "VT3DB1884",
      placementType: "tall",
      numberOfDoors: 1,
      numberOfDrawers: 3,
    }, faceHeightIn);
    const tops = hardwareTops(renderHardware({ doors: 1, drawers: 3, pantryLayout: layout }), "drawer-pull");
    expectPercentagesToMatch(tops, drawerCenters(layout, faceHeightIn));
  });

  it("preserves authored 5/10/15-inch pantry row centers", () => {
    const faceHeightIn = 79.5;
    const layout = layoutFor({
      masterCode: "T3DB3084",
      placementType: "tall",
      numberOfDoors: 1,
      numberOfDrawers: 3,
      drawerLayout: JSON.stringify([{ count: 1, height: 5 }, { count: 1, height: 10 }, { count: 1, height: 15 }]),
    }, faceHeightIn);
    const tops = hardwareTops(renderHardware({ doors: 1, drawers: 3, pantryLayout: layout }), "drawer-pull");
    expect(layout.rows.map((row) => row.height)).toEqual([5, 10, 15]);
    expectPercentagesToMatch(tops, drawerCenters(layout, faceHeightIn));
  });

  it("retains the legacy top drawer band for an ordinary base without a pantry layout", () => {
    const tops = hardwareTops(renderHardware({ doors: 1, drawers: 2 }), "drawer-pull");
    expectPercentagesToMatch(tops, [11.25, 33.75]);
  });

  it("renders no tagged handles when pantry door and drawer hardware are both none", () => {
    const markup = renderHardware({
      doors: 2,
      drawers: 3,
      pantryLayout: t3,
      doorPiece: "none",
      drawerPiece: "none",
    });
    expect(hardwareTops(markup, "drawer-pull")).toEqual([]);
    expect(hardwareTops(markup, "door-pull")).toEqual([]);
  });
});
