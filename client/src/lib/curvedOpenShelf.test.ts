import { describe, expect, it } from "vitest";
import {
  curvedOpenShelfRadiusIn,
  curvedOpenShelfShelfCount,
  hasCurvedOpenShelfGraphic,
  isCurvedOpenShelfCabinet,
} from "./curvedOpenShelf";

const bes12 = {
  masterCode: "BES12",
  description: '12" Base End Shelf Cabinet - Open curved unit with 5 shelves (configurable left or right)',
  subCategory: "Base End Cabinet",
  graphicType: "curved-open-shelf",
  numberOfFixedShelves: 3,
  width: 12,
  depth: 24,
};

describe("curved open base end shelf", () => {
  it("recognizes BES12 from its Cabinet Config graphic, even though the subcategory is Base End Cabinet", () => {
    expect(hasCurvedOpenShelfGraphic(bes12)).toBe(true);
    expect(isCurvedOpenShelfCabinet(bes12)).toBe(true);
    expect(isCurvedOpenShelfCabinet({
      masterCode: "BES12",
      description: bes12.description,
      subCategory: "Base End Cabinet",
    })).toBe(true);
    expect(isCurvedOpenShelfCabinet({
      masterCode: "BEC24",
      description: "Base End Cabinet",
      subCategory: "Base End Cabinet",
      graphicType: "end-angle",
    })).toBe(false);
    expect(isCurvedOpenShelfCabinet({
      masterCode: "BA24",
      description: "Base Angle End of Run",
      graphicType: "base_end_return",
    })).toBe(false);
  });

  it("uses the configured interior shelf count and the 12-inch quarter-round radius from the spec", () => {
    expect(curvedOpenShelfShelfCount(bes12)).toEqual({ count: 3, source: "config" });
    expect(curvedOpenShelfShelfCount({ ...bes12, fixedShelfCount: 0, numberOfFixedShelves: undefined })).toEqual({
      count: 0,
      source: "config",
    });
    expect(curvedOpenShelfShelfCount({ masterCode: "BES12", description: bes12.description })).toEqual({
      count: 3,
      source: "bes-source",
    });
    expect(curvedOpenShelfRadiusIn(12, 24)).toBe(12);
  });

  it("does not treat wall OE open-end shelves as a base end shelf, even with the curved-open-shelf graphic", () => {
    expect(isCurvedOpenShelfCabinet({
      masterCode: "OE630",
      description: '6" x 30" Open End Shelf Wall Cabinet',
      subCategory: "Open Shelf",
      graphicType: "curved-open-shelf",
    })).toBe(false);
    expect(isCurvedOpenShelfCabinet({
      masterCode: "OE642",
      description: '6" x 42" Open End Shelf Wall Cabinet',
      subCategory: "Standard Wall",
      graphicType: "wall_0door",
    })).toBe(false);
  });
});
