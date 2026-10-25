export type InterpretedPlanImageCabinet = {
  label: string;
  cabinetType: string;
  widthInches: number;
  wall: string;
  confidence: number;
};

export type PlanImageInterpretation = {
  roomWidthInches: number;
  roomDepthInches: number;
  cabinets: InterpretedPlanImageCabinet[];
  appliances: string[];
  reviewNotes: string[];
};

export type ReviewedPlanImageAppliance = { label: string; wall: string };

export type ReviewedPlanImage = Omit<PlanImageInterpretation, "cabinets" | "appliances"> & {
  cabinets: InterpretedPlanImageCabinet[];
  appliances: ReviewedPlanImageAppliance[];
};

export function initializePlanImageReview(interpretation: PlanImageInterpretation) {
  return {
    reviewedCabinets: interpretation.cabinets,
    approvedCabinetIndexes: new Set(
      interpretation.cabinets.flatMap((cabinet, index) => cabinet.confidence >= 0.8 ? [index] : []),
    ),
    reviewedAppliances: interpretation.appliances.map((label) => ({ label, wall: "Back" })),
    approvedApplianceIndexes: new Set(interpretation.appliances.map((_, index) => index)),
  };
}

export function buildReviewedPlanImage(
  interpretation: PlanImageInterpretation,
  reviewedCabinets: InterpretedPlanImageCabinet[],
  approvedCabinetIndexes: Set<number>,
  reviewedAppliances: ReviewedPlanImageAppliance[],
  approvedApplianceIndexes: Set<number>,
): ReviewedPlanImage {
  return {
    ...interpretation,
    cabinets: reviewedCabinets.filter((_, index) => approvedCabinetIndexes.has(index)),
    appliances: reviewedAppliances.filter((_, index) => approvedApplianceIndexes.has(index)),
  };
}

export function missingPlanImageDimensions(interpretation: Pick<PlanImageInterpretation, "roomWidthInches" | "roomDepthInches">) {
  return {
    width: interpretation.roomWidthInches <= 0,
    depth: interpretation.roomDepthInches <= 0,
  };
}
