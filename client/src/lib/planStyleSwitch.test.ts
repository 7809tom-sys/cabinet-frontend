import { describe, expect, it } from "vitest";
import { canCommitPlanStyleSwitchWithoutReview, planStyleReviewCandidates } from "./planStyleSwitch";

describe("plan style switch review eligibility", () => {
  const cabinets = [
    { cabinetId: 1, masterCode: "B12", styleId: null },
    { cabinetId: 2, masterCode: "W3030", styleId: 77 },
    { cabinetId: 0, masterCode: "CLOSET-SHELF", styleId: null },
  ];

  it("reviews only sellable cabinets that actually use the replaced default style", () => {
    expect(planStyleReviewCandidates(cabinets, 44, 44)).toEqual([
      { cabinetId: 1, masterCode: "B12", styleId: null },
    ]);
  });

  it("does not strand a designer in an empty review when changing an unused slot", () => {
    const candidates = planStyleReviewCandidates(cabinets, 66, 44);
    expect(candidates).toEqual([]);
    expect(canCommitPlanStyleSwitchWithoutReview(candidates)).toBe(true);
  });

  it("does not review closet parts or unsellable local items", () => {
    const candidates = planStyleReviewCandidates(cabinets, 44, 44);
    expect(candidates.map((cabinet) => cabinet.masterCode)).toEqual(["B12"]);
  });
  it("does not review or replace an individually locked cabinet", () => {
    const candidates = planStyleReviewCandidates([
      { cabinetId: 3, masterCode: "B36", styleId: 44, locked: true },
      { cabinetId: 4, masterCode: "B24", styleId: 44, locked: false },
    ], 44, 44);
    expect(candidates.map((cabinet) => cabinet.masterCode)).toEqual(["B24"]);
  });
});
