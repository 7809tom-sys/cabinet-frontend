/**
 * Plan-style review status "Authorized price alternative found for this cabinet".
 *
 * The server review (`design.planSwitchPricingReview`) already returns this as
 * `alternative_available`: the cabinet is still pending and a ranked, priced
 * alternative exists for the target door style. The Designer used to make the
 * reviewer pick each cabinet by hand, and an empty select value made that
 * choice revert. Finish (this cabinet) could retarget one door. This module
 * applies that same finish, using the top-ranked alternative, to every
 * applicable cabinet in the open review.
 */

export const AUTHORIZED_PRICE_ALTERNATIVE_FOUND_STATUS = "alternative_available" as const;

export const AUTHORIZED_PRICE_ALTERNATIVE_FOUND_LABEL =
  "Authorized price alternative found for this cabinet";

export type PlanSwitchReviewStatus = "priced" | "alternative_available" | "no_priced_alternative";

export type AuthorizedPriceAlternative = {
  cabinetId: number;
  masterCode: string;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  width: number;
  height: number;
  depth: number;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  isCornerCabinet?: boolean;
  customerPrice: number;
};

export type AuthorizedAlternativeReviewItem = {
  uid: string;
  status: PlanSwitchReviewStatus;
  alternatives: readonly AuthorizedPriceAlternative[];
};

/**
 * Applicable cabinets for one status action.
 *
 * Same review batch and same target door style: the caller passes only the
 * items from the open plan-style review. Still pending, and a price
 * alternative is already present: status `alternative_available` with at
 * least one alternative. This review has no separate conflict-reason field;
 * that status is the shared reason. Already priced cabinets, and cabinets
 * with no authorized alternative, are not included.
 */
export function applicableAlternativeCabinets<T extends AuthorizedAlternativeReviewItem>(
  items: readonly T[],
): T[] {
  return items.filter((item) => item.status === AUTHORIZED_PRICE_ALTERNATIVE_FOUND_STATUS && item.alternatives.length > 0);
}

/** Top-ranked alternative for each applicable cabinet. The server already ranks them. */
export function summarizeApplicableCodes(codes: readonly string[], limit = 12): string {
  const shown = codes.slice(0, limit).filter((code) => code.trim() !== "");
  if (shown.length === 0) return "";
  const extra = codes.length - shown.length;
  return extra > 0 ? `${shown.join(", ")} and ${extra} more` : shown.join(", ");
}

export function authorizedAlternativeConfirmText(count: number): { title: string; action: string } {
  const noun = count === 1 ? "cabinet" : "cabinets";
  return {
    title: `Apply this status to ${count} ${noun}?`,
    action: `Apply to ${count} ${noun}`,
  };
}

export function topAlternativeChoices(
  items: readonly AuthorizedAlternativeReviewItem[],
): Map<string, AuthorizedPriceAlternative> {
  const choices = new Map<string, AuthorizedPriceAlternative>();
  for (const item of applicableAlternativeCabinets(items)) {
    const top = item.alternatives[0];
    if (top) choices.set(item.uid, top);
  }
  return choices;
}

type PlacedAlternativeTarget = {
  uid: string;
  cabinetId: number;
  masterCode: string;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  width: number;
  height: number;
  depth: number;
  nominalWidth?: number;
  nominalHeight?: number;
  nominalDepth?: number;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  isCornerCabinet?: boolean;
  styleId?: number | null;
};

/**
 * Swap each chosen cabinet onto its authorized alternative.
 * `targetStyleId` finishes those cabinets in the selected door style, the
 * same per-cabinet result as Finish (this cabinet). Pass null when the
 * design default itself is about to change.
 */
export function applyAuthorizedPriceAlternatives<T extends PlacedAlternativeTarget>(
  cabinets: readonly T[],
  choices: ReadonlyMap<string, AuthorizedPriceAlternative>,
  targetStyleId: number | null,
): { cabinets: T[]; updatedCount: number } {
  let updatedCount = 0;
  const next = cabinets.map((cabinet) => {
    const alternative = choices.get(cabinet.uid);
    if (!alternative) return cabinet;
    updatedCount += 1;
    return {
      ...cabinet,
      cabinetId: alternative.cabinetId,
      masterCode: alternative.masterCode,
      description: alternative.description ?? cabinet.description,
      category: alternative.category ?? cabinet.category,
      subCategory: alternative.subCategory ?? cabinet.subCategory,
      isCornerCabinet: alternative.isCornerCabinet ?? cabinet.isCornerCabinet,
      width: alternative.width > 0 ? alternative.width : cabinet.width,
      nominalWidth: alternative.width > 0 ? alternative.width : cabinet.nominalWidth,
      height: alternative.height > 0 ? alternative.height : cabinet.height,
      nominalHeight: alternative.height > 0 ? alternative.height : cabinet.nominalHeight,
      depth: alternative.depth > 0 ? alternative.depth : cabinet.depth,
      nominalDepth: alternative.depth > 0 ? alternative.depth : cabinet.nominalDepth,
      numberOfDoors: alternative.numberOfDoors ?? cabinet.numberOfDoors,
      numberOfDrawers: alternative.numberOfDrawers ?? cabinet.numberOfDrawers,
      ...(targetStyleId != null ? { styleId: targetStyleId } : {}),
    };
  });
  return { cabinets: next, updatedCount };
}
