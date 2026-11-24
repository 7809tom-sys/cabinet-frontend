/**
 * The shared "Choose your cabinet vendor and color" step.
 *
 * Every designer start (kitchen, bathroom, closet, laundry, other) and every
 * Auto-Design opener use this one step. The door grid shows a real catalog
 * vendor's door sample photos. Confirming a non-Auto-Design start continues
 * into the cabinet catalog (and, on a fresh start, the room layout). Confirming
 * an Auto-Design start opens the existing Auto-Design questions. Cancel, Not
 * now, Escape, the X, or an outside tap close the step and do not open
 * Auto-Design.
 */

export type CabinetStylePopupPurpose = "auto-design" | null;

export const DESIGNER_STYLE_STEP_COPY = {
  description: "Choose the cabinet vendor, then the door style/color. Your design uses these cabinets.",
  confirmLabel: "Continue to cabinet catalog",
  dismissLabel: "Not now",
} as const;

/** Wording when Auto-Design opened the step. The measured-kitchen dialog is unchanged. */
export const AUTO_DESIGN_STYLE_STEP_COPY = {
  description: "Before Auto-Design draws your kitchen, choose the cabinet vendor, then the door style/color. Auto-Design builds with these cabinets.",
  confirmLabel: "Continue to Auto-Design",
  dismissLabel: "Cancel",
} as const;

export function cabinetStyleStepCopy(purpose: CabinetStylePopupPurpose) {
  return purpose === "auto-design" ? AUTO_DESIGN_STYLE_STEP_COPY : DESIGNER_STYLE_STEP_COPY;
}

/**
 * Vendor the step should show so the door-photo grid is filled from the catalog.
 *
 * Prefer the vendor behind the plan's selected door, then the plan's one-line
 * lock, then the vendor already chosen in the catalog picker. When none of
 * those exist, use the first vendor the catalog actually returned. Nothing
 * here invents a vendor name or a door style.
 */
export function styleStepVendor(input: {
  catalogDistributorId: number | null;
  lockedDistributorId: number | null;
  selectedStyleDistributorId: number | null;
  catalogVendorIds?: readonly number[];
}): number | null {
  const known = input.selectedStyleDistributorId
    ?? input.lockedDistributorId
    ?? input.catalogDistributorId
    ?? null;
  if (known != null) return known;
  const first = input.catalogVendorIds?.find((id) => typeof id === "number" && id > 0);
  return first ?? null;
}

/** Confirming the Auto-Design step with a vendor and a door style opens Auto-Design. Nothing else does. */
export function followUpAfterAutoDesignStyle(input: {
  action: "confirm" | "dismiss";
  purpose: CabinetStylePopupPurpose;
  distributorChosen: boolean;
  styleChosen: boolean;
}): "auto-design" | null {
  if (input.purpose !== "auto-design") return null;
  if (input.action !== "confirm") return null;
  if (!input.distributorChosen || !input.styleChosen) return null;
  return "auto-design";
}
