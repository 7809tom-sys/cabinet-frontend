import { describe, expect, it } from "vitest";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";
import { isSlabDoor, readSlabGrainChoice, slabGrainColorPlan, writeSlabGrainChoice } from "./slabGrainApply";

describe("slab grain and color", () => {
  it("covers a frameless slab with a repeating grain and its own color, without cropping a photo", () => {
    const whitePine = { id: 540001, ourName: "White Pine", styleCode: "TWP", doorStyle: "Slab", doorSampleImageUrl: "https://cdn.example/combined.jpg" };
    const greyWood = { id: 540002, ourName: "Grey Wood", styleCode: "TGW", doorStyle: "Slab", color: "#8d8f92" };
    expect(isSlabDoor(whitePine)).toBe(true);
    expect(isSlabDoor(greyWood)).toBe(true);
    const pine = slabGrainColorPlan(whitePine, { grainId: "versa-shaker", hex: "#e7d7b8" });
    const grey = slabGrainColorPlan(greyWood, { grainId: "grey-shaker", hex: "#8d8f92" });
    for (const plan of [pine, grey]) {
      expect(plan.sourceKind).not.toBe("combined");
      expect(plan.doorUrl).toMatch(/\/textures\/dlc-fr26\/grain\//);
      expect(plan.dlcCrop?.grainUrl).toBe(plan.doorUrl);
      expect(plan.doorUrl).not.toContain("combined");
    }
    expect(pine.dlcCrop?.solidColor).toBe("#e7d7b8");
    expect(grey.dlcCrop?.solidColor).toBe("#8d8f92");
    expect(grey.dlcCrop?.solidColor).not.toBe("#244338");
    expect(designerFacePlan(whitePine, "base")?.doorUrl).toBe("https://cdn.example/combined.jpg");
  });

  it("remembers an applied grain for that door only", () => {
    const memory = { value: "{}", getItem: () => memory.value, setItem: (_key: string, next: string) => { memory.value = next; } };
    writeSlabGrainChoice(540002, { grainId: "grey-shaker", hex: "#8d8f92" }, memory);
    expect(readSlabGrainChoice(540002, memory)).toEqual({ grainId: "grey-shaker", hex: "#8d8f92" });
    expect(readSlabGrainChoice(540001, memory)).toBeNull();
  });
});
