/**
 * Customer-controlled inventory substitutions.
 *
 * This module is deliberately pure: callers provide a read-only inventory
 * snapshot and receive suggestions. It never writes inventory, creates orders,
 * sends email, or changes the selected cabinet.
 */

export const SB36_B36_WORKAROUND_NOTE =
  "Workaround: uses a B36 base and only its drawer front (mounted as a false front). The drawer box is removed on site to make room for the sink.";

export type InventorySubstitutionCandidate = {
  masterCode: string;
  description?: string | null;
  width: number;
  placement: "base" | "wall" | "tall" | "accessory";
  doorStyleId: number;
  onHandQty: number | null;
  sinkReady?: boolean;
  customerPrice?: number | null;
};

export type InventorySubstitutionSuggestion = InventorySubstitutionCandidate & {
  note?: string;
};

/**
 * Return only same-style, same-width, positive-stock suggestions for an
 * out-of-stock SB36. The original selection is never included or modified.
 * B36 is explicitly promoted and carries the installation workaround note.
 */
export function sb36InventorySubstitutions(
  requested: Pick<InventorySubstitutionCandidate, "masterCode" | "width" | "doorStyleId" | "onHandQty">,
  candidates: readonly InventorySubstitutionCandidate[],
): InventorySubstitutionSuggestion[] {
  if (requested.masterCode.trim().toUpperCase() !== "SB36" || requested.onHandQty !== 0) return [];

  return candidates
    .filter((candidate) =>
      candidate.placement === "base" &&
      candidate.doorStyleId === requested.doorStyleId &&
      Math.abs(candidate.width - 36) <= 0.01 &&
      candidate.onHandQty != null &&
      candidate.onHandQty > 0 &&
      (candidate.sinkReady === true || candidate.masterCode.trim().toUpperCase() === "B36") &&
      candidate.masterCode.trim().toUpperCase() !== "SB36",
    )
    .map((candidate) => ({
      ...candidate,
      ...(candidate.masterCode.trim().toUpperCase() === "B36" ? { note: SB36_B36_WORKAROUND_NOTE } : {}),
    }))
    .sort((left, right) => {
      const leftIsB36 = left.masterCode.trim().toUpperCase() === "B36";
      const rightIsB36 = right.masterCode.trim().toUpperCase() === "B36";
      return Number(rightIsB36) - Number(leftIsB36) || left.masterCode.localeCompare(right.masterCode);
    });
}
