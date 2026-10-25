import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cabinetDrawingType } from "@/lib/cabinetGraphics";
import { DoorDrawerDiagram } from "./DoorDrawerDiagram";

const bec24 = {
  masterCode: "BEC-24",
  description: '30" × 34.5" × 24" Base End Cabinet — 45° Angled End, 1 Door',
  category: "Base",
  subCategory: "Base End Cabinet",
  graphicType: "base_end_return",
  width: 30,
  height: 34.5,
  depth: 24,
  numberOfDoors: 1,
  numberOfDrawers: 0,
};

describe("DoorDrawerDiagram BEC-24 source-truth detail contract", () => {
  it("does not render the retired two-face 24-inch return profile", () => {
    const markup = renderToStaticMarkup(createElement(DoorDrawerDiagram, { cabinet: bec24, width: 220 }));

    expect(cabinetDrawingType(bec24)).toBe("end-angle");
    expect(markup).not.toContain('data-bec-end-return-detail="true"');
    expect(markup).not.toContain('data-bec-left-return-face="true"');
    expect(markup).not.toContain('data-bec-right-return-face="true"');
    expect(markup).not.toContain("24×24 end return");
  });
});
