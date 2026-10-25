import { describe, expect, it } from "vitest";
import { buildReviewedPlanImage, initializePlanImageReview, missingPlanImageDimensions, type PlanImageInterpretation } from "./planImageReview";

const interpretation: PlanImageInterpretation = {
  roomWidthInches: 0,
  roomDepthInches: 144,
  cabinets: [
    { label: "30 upper", cabinetType: "wall cabinet", widthInches: 30, wall: "Back", confidence: 0.93 },
    { label: "unclear base", cabinetType: "base cabinet", widthInches: 24, wall: "Left", confidence: 0.51 },
  ],
  appliances: ["Range", "Refrigerator"],
  reviewNotes: ["Verify the room width."],
};

describe("plan image review", () => {
  it("pre-approves only high-confidence cabinets and pre-populates editable appliance walls", () => {
    const review = initializePlanImageReview(interpretation);
    expect([...review.approvedCabinetIndexes]).toEqual([0]);
    expect(review.reviewedAppliances).toEqual([
      { label: "Range", wall: "Back" },
      { label: "Refrigerator", wall: "Back" },
    ]);
    expect([...review.approvedApplianceIndexes]).toEqual([0, 1]);
  });

  it("applies only the explicitly approved reviewed cabinets and appliances", () => {
    const review = initializePlanImageReview(interpretation);
    review.approvedCabinetIndexes.add(1);
    review.approvedApplianceIndexes.delete(1);
    review.reviewedAppliances[0] = { label: "Range", wall: "Right" };
    const plan = buildReviewedPlanImage(
      interpretation,
      review.reviewedCabinets,
      review.approvedCabinetIndexes,
      review.reviewedAppliances,
      review.approvedApplianceIndexes,
    );

    expect(plan.cabinets).toHaveLength(2);
    expect(plan.appliances).toEqual([{ label: "Range", wall: "Right" }]);
  });

  it("identifies each missing room dimension separately so the current designer measurement can be retained", () => {
    expect(missingPlanImageDimensions(interpretation)).toEqual({ width: true, depth: false });
  });
});
