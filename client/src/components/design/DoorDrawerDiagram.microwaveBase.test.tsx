import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cabinetTypeLabel } from "@/lib/cabinetGraphics";
import { DoorDrawerDiagram } from "./DoorDrawerDiagram";

const bmc27 = {
  masterCode: "BMC-27",
  description: '27" Base Microwave Cabinet',
  category: "Base",
  subCategory: "Microwave Base Cabinet",
  width: 27,
  height: 34.5,
  numberOfDoors: 0,
  numberOfDrawers: 1,
  openingType: "top" as const,
  doorHeight: 0,
  drawerHeight: 12,
};

describe("DoorDrawerDiagram microwave-base Cabinet Config contract", () => {
  it("renders BMC-27 as a zero-door top opening with one bottom drawer", () => {
    const markup = renderToStaticMarkup(createElement(DoorDrawerDiagram, { cabinet: bmc27, width: 200 }));

    expect(cabinetTypeLabel(bmc27)).toBe("Microwave Base Cabinet");
    expect(markup).toContain("Appliance Opening");
    expect(markup).toContain("Drawer 1");
    expect(markup).not.toContain("Left Door");
    expect(markup).not.toContain("Right Door");
  });

  it("does not infer doors or drawers when an open Cabinet Config explicitly sets both counts to zero", () => {
    const markup = renderToStaticMarkup(createElement(DoorDrawerDiagram, {
      cabinet: {
        masterCode: "OPEN-24",
        description: '24" Open Shelf Base Cabinet',
        category: "Base",
        width: 24,
        height: 34.5,
        numberOfDoors: 0,
        numberOfDrawers: 0,
        facePattern: "open" as const,
      },
      width: 200,
    }));

    expect(markup).not.toContain("Left Door");
    expect(markup).not.toContain("Right Door");
    expect(markup).not.toContain("Drawer 1");
  });
});
