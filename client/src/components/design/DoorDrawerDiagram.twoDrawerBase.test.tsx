import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoorDrawerDiagram } from "./DoorDrawerDiagram";

describe("DoorDrawerDiagram 2-DB family", () => {
  it("renders 2-DB30 as two equal drawer zones despite stale unequal saved rows", () => {
    const markup = renderToStaticMarkup(createElement(DoorDrawerDiagram, {
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
        drawerLayout: JSON.stringify([{ count: 1, height: 6 }, { count: 1, height: 23 }]),
      },
      width: 200,
    }));

    const drawerHeights = Array.from(markup.matchAll(/height="([^"]+)"[^>]*fill="#f59e0b"/g))
      .map((match) => Number(match[1]))
      .filter((height) => height > 20);
    expect(drawerHeights).toHaveLength(2);
    expect(drawerHeights[0]).toBeCloseTo(drawerHeights[1]!, 12);
  });

  it("renders active 3-DB30 as one shallow top drawer over two equal deeper drawers", () => {
    const markup = renderToStaticMarkup(createElement(DoorDrawerDiagram, {
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
      width: 200,
    }));

    const drawerHeights = Array.from(markup.matchAll(/height="([^"]+)"[^>]*fill="#f59e0b"/g))
      .map((match) => Number(match[1]))
      .filter((height) => height > 20);
    expect(drawerHeights).toHaveLength(3);
    expect(drawerHeights[0]).toBeLessThan(drawerHeights[1]!);
    expect(drawerHeights[1]).toBeCloseTo(drawerHeights[2]!, 12);
  });
});
