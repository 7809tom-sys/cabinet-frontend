import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoorFront } from "./ElevationView";
import { DoorDrawerDiagram } from "./DoorDrawerDiagram";

const faceProps = {
  kind: "shaker" as const,
  edge: "#796f61",
  face: "#e8dfcf",
  cabinetType: "pantry" as const,
  cabinetHeightIn: 79.5,
  cabinetWidthIn: 18,
  category: "Tall",
  placementType: "tall",
};

function elevationMarkup(input: {
  masterCode: string;
  graphicType: string;
  description: string;
  doors: number;
  drawers: number;
  width?: number;
  height?: number;
}) {
  return renderToStaticMarkup(createElement(DoorFront, {
    ...faceProps,
    ...input,
    cabinetWidthIn: input.width ?? 18,
    cabinetHeightIn: (input.height ?? 84) - 4.5,
    doors: input.doors,
    drawers: input.drawers,
    numberOfDoors: input.doors,
    numberOfDrawers: input.drawers,
  }));
}

function diagramMarkup(input: {
  masterCode: string;
  graphicType: string;
  description: string;
  doors: number;
  drawers: number;
  width?: number;
  height?: number;
}) {
  return renderToStaticMarkup(createElement(DoorDrawerDiagram, {
    cabinet: {
      masterCode: input.masterCode,
      graphicType: input.graphicType,
      description: input.description,
      category: "Tall",
      placementType: "tall",
      width: input.width ?? 18,
      height: input.height ?? 84,
      numberOfDoors: input.doors,
      numberOfDrawers: input.drawers,
    },
    width: 180,
  }));
}

const pantryCases = [
  {
    masterCode: "T2DB1884",
    graphicType: "tall_2door_2drawer",
    description: '18" W × 84" H × 24" D Tall Two Door Cabinet with Two Drawers',
    doors: 1,
    drawers: 2,
  },
  {
    masterCode: "T3DB3084",
    graphicType: "tall_2door_3drawer",
    description: '30" W × 84" H × 24" D Tall Two Door Cabinet with Three Drawers',
    doors: 2,
    drawers: 3,
    width: 30,
  },
  {
    masterCode: "VT3DB1884",
    graphicType: "tall_1door_3drawer",
    description: '18" W × 84" H × 21" D Tall One Door Vanity Utility Cabinet with Three Drawers',
    doors: 1,
    drawers: 3,
  },
  {
    masterCode: "T2DB2494",
    graphicType: "tall_2door_2drawer",
    description: '24" W × 94" H × 24" D Tall Two Door Cabinet with Two Drawers',
    doors: 1,
    drawers: 2,
    width: 24,
    height: 94,
  },
] as const;

describe("pantry bottom drawer parity", () => {
  it.each(pantryCases)("keeps $masterCode upper doors above $drawers manufacturer drawer fronts in both views", (pantry) => {
    const elevation = elevationMarkup(pantry);
    const diagram = diagramMarkup(pantry);

    expect(elevation.match(/data-pantry-upper-doors="true"/g)).toHaveLength(pantry.doors);
    expect(elevation.match(/data-pantry-bottom-drawer="true"/g)).toHaveLength(pantry.drawers);
    expect(diagram.match(/data-pantry-upper-doors="true"/g)).toHaveLength(pantry.doors);
    expect(diagram.match(/data-pantry-bottom-drawer="true"/g)).toHaveLength(pantry.drawers);

    const elevationFirstDrawer = elevation.indexOf('data-pantry-bottom-drawer="true"');
    const elevationUpperDoor = elevation.indexOf('data-pantry-upper-doors="true"');
    const diagramFirstDrawer = diagram.indexOf('data-pantry-bottom-drawer="true"');
    const diagramUpperDoor = diagram.indexOf('data-pantry-upper-doors="true"');
    expect(elevationUpperDoor).toBeLessThan(elevationFirstDrawer);
    expect(diagramUpperDoor).toBeLessThan(diagramFirstDrawer);
  });

  it("uses manufacturer source fallback front heights for two- and three-drawer pantry families", () => {
    const twoDrawer = elevationMarkup(pantryCases[0]);
    const threeDrawer = elevationMarkup(pantryCases[1]);
    expect(twoDrawer.match(/data-pantry-drawer-height-in="15"/g)).toHaveLength(2);
    expect(threeDrawer.match(/data-pantry-drawer-height-in="7\.375"/g)).toHaveLength(2);
    expect(threeDrawer.match(/data-pantry-drawer-height-in="15"/g)).toHaveLength(1);
  });

  it("does not apply pantry-bottom markers to ordinary base or oven fronts", () => {
    const base = renderToStaticMarkup(createElement(DoorFront, {
      ...faceProps,
      cabinetType: "standard-door",
      masterCode: "B30",
      graphicType: "base_2door_1drawer",
      category: "Base",
      placementType: "base",
      description: '30" Double Door Base Cabinet with One Drawer',
      doors: 2,
      drawers: 1,
      numberOfDoors: 2,
      numberOfDrawers: 1,
    }));
    const oven = renderToStaticMarkup(createElement(DoorDrawerDiagram, {
      cabinet: {
        masterCode: "O309024",
        category: "Tall",
        placementType: "tall",
        description: '30" Tall Oven Cabinet',
        width: 30,
        height: 84,
        numberOfDoors: 2,
        numberOfDrawers: 2,
        openingType: "middle",
      },
      width: 180,
    }));

    expect(base).not.toContain("data-pantry-bottom-drawer");
    expect(base).not.toContain("data-pantry-upper-doors");
    expect(oven).not.toContain("data-pantry-bottom-drawer");
    expect(oven).not.toContain("data-pantry-upper-doors");
  });
});
