import { isClosetPart } from "@/lib/closet";
import { effectiveStyleId } from "@/lib/design";

/**
 * A door-style price review is required only for sellable cabinets that are
 * actually assigned to the slot being replaced. Opening a review for another
 * slot (or for an unassigned legacy cabinet) creates an empty, non-actionable
 * dialog and prevents a designer from changing the selected door style.
 */
export function planStyleReviewCandidates<
  Cabinet extends { cabinetId: number; masterCode: string; styleId?: number | null; locked?: boolean | null },
>(
  cabinets: Cabinet[],
  formerStyleId: number | null,
  designDefaultStyleId: number | null,
): Cabinet[] {
  if (formerStyleId == null) return [];
  return cabinets.filter(
    (cabinet) =>
      cabinet.cabinetId > 0 &&
      cabinet.locked !== true &&
      !isClosetPart(cabinet.masterCode) &&
      effectiveStyleId(cabinet, designDefaultStyleId) === formerStyleId,
  );
}

/** A dialog may commit immediately when no placed sellable item uses its slot. */
export function canCommitPlanStyleSwitchWithoutReview(reviewCandidates: readonly unknown[]): boolean {
  return reviewCandidates.length === 0;
}
