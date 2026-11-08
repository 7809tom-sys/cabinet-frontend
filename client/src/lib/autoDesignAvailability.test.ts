import { describe, expect, it } from "vitest";
import {
  AUTO_DESIGN_EMPTY_PLAN_NOTE,
  AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE,
  autoDesignBlocksEmptyPlan,
  autoDesignControlState,
  autoDesignHandPlacedCount,
  isRefrigeratorAppliance,
  isSinkBasePlacement,
  layoutHasRefrigerator,
  type AutoDesignPlacedLike,
} from "./autoDesignAvailability";

/** Mirrors the Designer: only non-sink, non-refrigerator placements count as hand-placed work. */
function blockingCount(items: readonly AutoDesignPlacedLike[]): number {
  return items.filter(autoDesignBlocksEmptyPlan).length;
}

const userFridge: AutoDesignPlacedLike = { uid: "user-fridge", masterCode: "FRIDGE-36", placement: "appliance" };
const pushedSinkBase: AutoDesignPlacedLike = {
  uid: "sink-base-1",
  masterCode: "SB36",
  description: '36" Sink Base',
  subCategory: "Sink Base",
  placement: "base",
};
const handPlacedBase: AutoDesignPlacedLike = {
  uid: "base-1",
  masterCode: "B24",
  description: '24" Base Cabinet',
  subCategory: "Base Cabinets",
  placement: "base",
};

describe("Auto-Design and a refrigerator on the plan", () => {
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

  it("stays ENABLED with only a refrigerator on the plan and explains it as a fixed anchor", () => {
    const control = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: blockingCount([userFridge]),
      refrigeratorAnchor: layoutHasRefrigerator([userFridge]),
    });
    // The bug: a placed refrigerator used to gray the control out.
    expect(control.enabled).toBe(true);
    expect(control.shown).toBe(true);
    expect(control.blockedNote).toBeNull();
    expect(control.title).toBe("Auto-Design a kitchen around your refrigerator");
    expect(control.refrigeratorAnchorNote).toBe(AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE);
    // The old refusal is gone from every surface.
    expect(AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE).not.toMatch(/isn't available/i);
  });

  it("stays enabled for a refrigerator beside a pushed sink base", () => {
    const onPlan = [pushedSinkBase, userFridge];
    const control = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: blockingCount(onPlan),
      refrigeratorAnchor: layoutHasRefrigerator(onPlan),
    });
    expect(control.enabled).toBe(true);
    expect(control.refrigeratorAnchorNote).toBe(AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE);
  });

  it("keeps the empty-plan rule as the only reason to gray the control out", () => {
    const cleared = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: 3,
      refrigeratorAnchor: false,
    });
    expect(cleared.enabled).toBe(false);
    expect(cleared.title).toContain("empty Designer");
    // The visible reason is the shared empty-plan sentence, so no surface has to
    // invent its own copy of why the control is grayed out.
    expect(cleared.blockedNote).toBe(AUTO_DESIGN_EMPTY_PLAN_NOTE);
    expect(cleared.refrigeratorAnchorNote).toBeNull();

    const ready = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: 0,
      refrigeratorAnchor: false,
    });
    expect(ready.enabled).toBe(true);
    expect(ready.blockedNote).toBeNull();
    expect(ready.refrigeratorAnchorNote).toBeNull();
    expect(ready.title).toBe("Auto-Design a kitchen from four fixed fixture anchors");
  });

  it("hides every surface when the workspace does not offer Auto-Design", () => {
    const hidden = autoDesignControlState({
      audienceAllowed: false,
      layoutLocked: false,
      placedCount: 0,
      refrigeratorAnchor: true,
    });
    expect(hidden.shown).toBe(false);
    expect(hidden.enabled).toBe(false);
    expect(hidden.blockedNote).toBeNull();
    expect(hidden.refrigeratorAnchorNote).toBeNull();
  });

  it("counts a refrigerator and a pushed sink as zero hand-placed work, and a real base as one", () => {
    expect(autoDesignHandPlacedCount([])).toBe(0);
    expect(autoDesignHandPlacedCount([pushedSinkBase])).toBe(0);
    expect(autoDesignHandPlacedCount([userFridge])).toBe(0);
    expect(autoDesignHandPlacedCount([pushedSinkBase, userFridge])).toBe(0);
    expect(autoDesignHandPlacedCount([pushedSinkBase, userFridge, handPlacedBase])).toBe(1);
    expect(autoDesignBlocksEmptyPlan(handPlacedBase)).toBe(true);
    expect(autoDesignBlocksEmptyPlan(userFridge)).toBe(false);
  });
});

describe("a pushed sink must not break Auto-Design", () => {
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
      refrigeratorAnchor: false,
    });
    expect(control.enabled).toBe(true);
    // The old behavior is what broke: counting the sink base grayed the control out.
    expect(autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: onPlan.length,
      refrigeratorAnchor: false,
    }).enabled).toBe(false);
  });

  it("still stops for real hand-placed cabinet work beside a pushed sink", () => {
    const onPlan = [pushedSinkBase, handPlacedBase];
    expect(autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: blockingCount(onPlan),
      refrigeratorAnchor: false,
    }).enabled).toBe(false);
  });
});
