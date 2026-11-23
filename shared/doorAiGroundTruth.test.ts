import { describe, expect, it } from "vitest";
import { doorGroundTruthBlock, promptWithDoorGroundTruth } from "./doorAiGroundTruth";
import { AI_DOOR_PROMPTS } from "./aiDoorPrompts";

const HONEY = { ourName: "Honey Core", distributorName: "Shaker Honey", doorStyle: "Shaker", woodSpecies: "Solid Birch", color: "SW 3122 Honey", finish: "UV Coated Natural Interior" };

describe("door AI ground truth", () => {
  it("states the DL Shaker blueprint for a plain shaker", () => {
    const text = promptWithDoorGroundTruth(AI_DOOR_PROMPTS.claude, HONEY);
    for (const part of ["GROUND TRUTH", "Honey Core", "Shaker Honey", "Solid Birch", "SW 3122 Honey", "UV Coated Natural Interior", "uses the DL Shaker blueprint", "single recessed flat center panel, two stiles and two rails", "standard 3 inch rail", "must not contradict"]) {
      expect(text).toContain(part);
    }
    expect(promptWithDoorGroundTruth(text, HONEY)).toBe(text);
  });
  it("says the DL blueprint does not apply to slab, slim and double", () => {
    expect(doorGroundTruthBlock({ ourName: "Arctic", doorStyle: "Slab" })).toContain("DL Shaker blueprint does not apply");
    expect(doorGroundTruthBlock({ doorStyle: "Slim Shaker" })).toContain("slim shaker");
    expect(doorGroundTruthBlock({ doorStyle: "Double Shaker" })).toContain("double shaker");
    expect(doorGroundTruthBlock({ doorStyle: "Slab" })).not.toContain("uses the DL Shaker blueprint");
  });
});
