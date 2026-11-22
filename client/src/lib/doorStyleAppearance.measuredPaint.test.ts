/**
 * Aura Cream (Ashford, 330002) is a Shaker the measured swatch table lists as paint,
 * but its catalog record has no paint text. It must still render as a solid front,
 * not as a door photo whose frame edges draw nested lines over the door.
 */
import { describe, expect, it } from "vitest";
import { designerCatalogDoorProfile } from "./doorStyleAppearance";

const AURA_CREAM = {
  id: 330002,
  distributorId: 210001,
  styleCode: "CC",
  ourName: "Classic Cream",
  aliasName: "Aura Cream (Ashford)",
  color: "#F2E8D0",
  renderHex: "#eae5d6",
  finish: "Aura Cream (Ashford)",
  doorStyle: "Shaker",
};

describe("designerCatalogDoorProfile measured paint swatch", () => {
  it("renders Aura Cream as a solid painted front", () => {
    expect(designerCatalogDoorProfile(AURA_CREAM as never)?.paintedFinish).toBe(true);
  });

  it("leaves a stain-category swatch on its grain", () => {
    const honey = { id: 330021, ourName: "Shaker Honey", doorStyle: "Shaker", finish: "Stained" };
    expect(designerCatalogDoorProfile(honey as never)?.paintedFinish).toBe(false);
  });
});
