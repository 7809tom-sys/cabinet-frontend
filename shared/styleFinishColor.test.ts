import { describe, expect, it } from "vitest";
import { STONE_GRAY_HEX, isFinishMatchedAccessory, styleFinishSearchText } from "./styleFinishColor";
import { finishColors } from "../client/src/lib/design";
import { resolveSwatch } from "../client/src/components/DoorStyleSwatch";
import { doorStyleFinishColors } from "../client/src/lib/doorStyleAppearance";

const stoneGray = {
  ourName: "Shaker Gray",
  aliasName: "Stone Gray (Preston)",
  color: "Gray",
  finish: "Cobalt Abyss (Preston)",
  doorStyle: "Shaker",
};

describe("Stone Gray finish selection", () => {
  it("drops a conflicting cobalt finish label so Stone Gray stays gray", () => {
    const text = styleFinishSearchText(stoneGray);
    expect(text.toLowerCase()).toContain("stone gray");
    expect(text.toLowerCase()).not.toContain("cobalt");
    expect(text.toLowerCase()).not.toContain("abyss");
  });

  it("switches the designer swatch and the elevation fill to Stone Gray", () => {
    expect(resolveSwatch(stoneGray).face.toLowerCase()).toBe(STONE_GRAY_HEX);
    expect(finishColors(styleFinishSearchText(stoneGray)).face.toLowerCase()).toBe(STONE_GRAY_HEX);
    expect(doorStyleFinishColors(stoneGray).face.toLowerCase()).toBe(STONE_GRAY_HEX);
  });

  it("still lets an explicit hex win", () => {
    expect(resolveSwatch({ ...stoneGray, color: "#112233" }).face.toLowerCase()).toBe("#112233");
  });

  it("recognizes spray paint and touch-up kits as finish-matched accessories", () => {
    expect(isFinishMatchedAccessory({ masterCode: "SPRAYPAINT", description: "Spray Paint Touch-Up" })).toBe(true);
    expect(isFinishMatchedAccessory({ masterCode: "TUK", description: "Touch Up Kit" })).toBe(true);
    expect(isFinishMatchedAccessory({ masterCode: "B24", description: "Base cabinet" })).toBe(false);
  });
});
