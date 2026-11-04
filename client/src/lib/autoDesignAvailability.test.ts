import { describe, expect, it } from "vitest";
import {
  AUTO_DESIGN_EMPTY_PLAN_NOTE,
  AUTO_DESIGN_REFRIGERATOR_NOTE,
  autoDesignControlState,
  autoDesignShouldTurnOffForRefrigerator,
  isRefrigeratorAppliance,
  isSinkBasePlacement,
  refrigeratorBlocksAutoDesign,
  type AutoDesignPlacedLike,
} from "./autoDesignAvailability";

/** Mirrors the Designer: only non-sink placements count as hand-placed work. */
function blockingCount(items: readonly AutoDesignPlacedLike[]): number {
  return items.filter((item) => !isSinkBasePlacement(item)).length;
}

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
    expect(blocked.blockedNote).toBe(AUTO_DESIGN_REFRIGERATOR_NOTE);

    const cleared = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: 3,
      hasRefrigerator: false,
    });
    expect(cleared.enabled).toBe(false);
    expect(cleared.refrigeratorNote).toBeNull();
    expect(cleared.title).toContain("empty Designer");
    // The visible reason is the shared empty-plan sentence, so no surface has to
    // invent its own copy of why the control is grayed out.
    expect(cleared.blockedNote).toBe(AUTO_DESIGN_EMPTY_PLAN_NOTE);

    const ready = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: 0,
      hasRefrigerator: false,
    });
    expect(ready.enabled).toBe(true);
    expect(ready.blockedNote).toBeNull();
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

describe("a pushed sink must not break Auto-Design", () => {
  const pushedSinkBase = { uid: "sink-base-1", masterCode: "SB36", description: '36" Sink Base', subCategory: "Sink Base", placement: "base" };
  const farmBase = { uid: "farm-base-1", masterCode: "FSB36", description: '36" Farm Sink Base', subCategory: "Sink Base", placement: "base" };

  it("recognizes a sink base in every shape the catalog uses", () => {
    expect(isSinkBasePlacement(pushedSinkBase)).toBe(true);
    expect(isSinkBasePlacement(farmBase)).toBe(true);
    expect(isSinkBasePlacement({ masterCode: "SB30FH", description: "Sink Base", placement: "base" })).toBe(true);
    expect(isSinkBasePlacement({ masterCode: "CSB36", description: "Corner Sink Base", placement: "base" })).toBe(true);
    expect(isSinkBasePlacement({ masterCode: "B36", description: '36" Base Cabinet', placement: "base" })).toBe(false);
    expect(isSinkBasePlacement({ masterCode: "W3630", description: '36" Wall Cabinet', placement: "wall" })).toBe(false);
  });

  it("leaves Auto-Design enabled when the only thing on the plan is the pushed sink", () => {
    const onPlan = [pushedSinkBase];
    const control = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: blockingCount(onPlan),
      hasRefrigerator: false,
    });
    expect(control.enabled).toBe(true);
    // The old behavior is what broke: counting the sink base grayed the control out.
    expect(autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: onPlan.length,
      hasRefrigerator: false,
    }).enabled).toBe(false);
  });

  it("still stops for real hand-placed cabinet work beside a pushed sink", () => {
    const onPlan = [pushedSinkBase, { uid: "b-1", masterCode: "B24", description: '24" Base Cabinet', placement: "base" }];
    expect(autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: blockingCount(onPlan),
      hasRefrigerator: false,
    }).enabled).toBe(false);
  });
});
