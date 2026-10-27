import { describe, expect, it } from "vitest";
import {
  AUTO_DESIGN_REFRIGERATOR_NOTE,
  autoDesignControlState,
  autoDesignShouldTurnOffForRefrigerator,
  isRefrigeratorAppliance,
  refrigeratorBlocksAutoDesign,
} from "./autoDesignAvailability";

describe("Auto-Design refrigerator gate", () => {
  it("treats panel-ready and built-in refrigerators as the appliance", () => {
    expect(isRefrigeratorAppliance({ masterCode: "FRIDGE-36", placement: "appliance" })).toBe(true);
    expect(isRefrigeratorAppliance({
      masterCode: "PNL-36",
      description: "Panel-ready built-in refrigerator",
      placement: "appliance",
    })).toBe(true);
    expect(isRefrigeratorAppliance({ masterCode: "FRIDGE-36", placement: "tall", description: "Legacy refrigerator" })).toBe(true);
  });

  it("does not treat refrigerator cabinets, bridges, or end panels as the appliance", () => {
    expect(isRefrigeratorAppliance({ masterCode: "W3618", description: "Wall cabinet above refrigerator", placement: "wall" })).toBe(false);
    expect(isRefrigeratorAppliance({ masterCode: "WSC30", description: "Bridge cabinet", placement: "wall" })).toBe(false);
    expect(isRefrigeratorAppliance({ masterCode: "REP3", description: "Refrigerator end panel", placement: "tall" })).toBe(false);
    expect(isRefrigeratorAppliance({ masterCode: "B36", description: "Base cabinet", placement: "base" })).toBe(false);
  });

  it("grays the control out while a refrigerator is in the layout and leaves it off after the refrigerator is removed", () => {
    const blocked = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: 4,
      hasRefrigerator: true,
    });
    expect(blocked.enabled).toBe(false);
    expect(blocked.shown).toBe(true);
    expect(blocked.refrigeratorNote).toBe(AUTO_DESIGN_REFRIGERATOR_NOTE);

    const cleared = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: 3,
      hasRefrigerator: false,
    });
    expect(cleared.enabled).toBe(false);
    expect(cleared.refrigeratorNote).toBeNull();
    expect(cleared.title).toContain("empty Designer");

    const ready = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: 0,
      hasRefrigerator: false,
    });
    expect(ready.enabled).toBe(true);
  });

  it("turns an open session off for a user refrigerator and leaves the Auto-Design anchor refrigerator in place", () => {
    const items = [
      { uid: "anchor-fridge", masterCode: "FRIDGE-36", placement: "appliance" },
      { uid: "user-fridge", masterCode: "FRIDGE-30", placement: "appliance" },
    ];
    expect(refrigeratorBlocksAutoDesign(items, new Set(["anchor-fridge"]))).toBe(true);
    expect(refrigeratorBlocksAutoDesign(items.slice(0, 1), new Set(["anchor-fridge"]))).toBe(false);
    expect(autoDesignShouldTurnOffForRefrigerator({
      blockedByRefrigerator: true,
      dialogOpen: true,
      cornerStageActive: false,
    })).toBe(true);
    expect(autoDesignShouldTurnOffForRefrigerator({
      blockedByRefrigerator: false,
      dialogOpen: true,
      cornerStageActive: true,
    })).toBe(false);
  });
});
