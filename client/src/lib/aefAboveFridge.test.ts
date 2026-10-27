import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { compatibleWallCabinetAlternatives, type DesignCabinet } from "./design";
import { framelessAboveFridgeHeight, isFramelessFortyWallHeight } from "./aefAboveFridge";

describe("frameless 40-inch above-fridge height", () => {
  it("pairs 40 and 40.25 with 22.625 and leaves 42 alone", () => {
    expect(isFramelessFortyWallHeight(40)).toBe(true);
    expect(isFramelessFortyWallHeight(40.25)).toBe(true);
    expect(framelessAboveFridgeHeight(40.25)).toBe(22.625);
    expect(isFramelessFortyWallHeight(42)).toBe(false);
    expect(framelessAboveFridgeHeight(42)).toBeNull();
    expect(framelessAboveFridgeHeight(30)).toBeNull();
  });

  it("offers the next narrower frameless wall at the printed 22.625 height", () => {
    const requested = { masterCode: "W3623", width: 36, height: 22.625, depth: 13.5, placement: "wall" as const, constructionMethod: AEF_PRINTED_GEOMETRY_MARKER };
    const narrower = {
      id: 2,
      masterCode: "W3023",
      description: "Wall",
      width: "30",
      height: "22.63",
      depth: "13.5",
      placement: "wall" as const,
      constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
    } as DesignCabinet;
    const options = compatibleWallCabinetAlternatives(requested, 33, [narrower]);
    expect(options.map((option) => option.cabinet.masterCode)).toContain("W3023");
  });
});
