import { describe, expect, it } from "vitest";
import { confirmPlacedItemRemoval, placedItemRemovalMessage } from "./placedItemRemoval";

describe("placed item removal", () => {
  it("asks before removing a cabinet, panel, filler, or appliance and names undo", () => {
    expect(placedItemRemovalMessage("REPV2496")).toBe("Remove REPV2496 from the plan? You can undo this.");
    expect(placedItemRemovalMessage("  ")).toBe("Remove this item from the plan? You can undo this.");
    expect(confirmPlacedItemRemoval("F3", () => false)).toBe(false);
    expect(confirmPlacedItemRemoval("FRIDGE-36", (message) => message.includes("FRIDGE-36"))).toBe(true);
  });
});
