import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CabinetDrawing } from "./CabinetDrawing";

describe("CabinetDrawing microwave-base Cabinet Config contract", () => {
  it("renders BMC30 as a top opening and one drawer, without inferred doors", () => {
    const markup = renderToStaticMarkup(
      createElement(CabinetDrawing, {
        cabinet: {
          masterCode: "BMC30",
          description: '30" Microwave Base Cabinet',
          category: "Base",
          subCategory: "Microwave Base Cabinet",
          width: 30,
          height: 34.5,
          numberOfDoors: 0,
          numberOfDrawers: 1,
          openingType: "top",
          drawerHeight: 12,
        },
      }),
    );

    expect(markup).toContain('data-cabinet-drawing="microwave-base"');
    expect(markup).toContain('data-config-microwave-opening="true"');
    expect(markup).toContain('data-config-microwave-drawer="true"');
    expect(markup).not.toContain('data-config-microwave-door="true"');
  });
});
