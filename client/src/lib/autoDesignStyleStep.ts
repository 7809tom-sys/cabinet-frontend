/**
 * Auto-Design asks for the cabinet vendor and the door style/color first.
 *
 * Every Auto-Design opener (room layout popup, phone/tablet top actions, the
 * fullscreen canvas buttons) goes through the same step: the existing
 * "Choose your cabinet vendor and color" popup opens with the plan's current
 * vendor and door style already selected, so continuing is one click. Only a
 * confirmed choice opens the Auto-Design questions. Cancel, Escape, the X or
 * an outside tap close it without opening Auto-Design.
 *
 * The Auto-Design build already draws its base and wall cabinet pools from the
 * selected door style (Color 1), so the line chosen here is the line it builds.
 */

/** Why the vendor / door-style popup is open. `null` is every other opener. */
export type CabinetStylePopupPurpose = "auto-design" | null;

/** Wording the vendor / door-style popup uses when Auto-Design opened it. */
export const AUTO_DESIGN_STYLE_STEP_COPY = {
  description: "Before Auto-Design draws your kitchen, choose the cabinet vendor, then the door style/color. Auto-Design builds with these cabinets.",
  confirmLabel: "Continue to Auto-Design",
  dismissLabel: "Cancel",
} as const;

/**
 * The vendor the step should show as selected when it opens: the vendor
 * behind the plan's selected door style, so the selected door stays visible
 * and Continue is one click; otherwise the plan's one-line lock, then the
 * vendor already in the Catalog picker. `null` leaves the dropdown on its prompt.
 */
export function autoDesignStepVendor(input: {
  catalogDistributorId: number | null;
  lockedDistributorId: number | null;
  selectedStyleDistributorId: number | null;
}): number | null {
  return input.selectedStyleDistributorId ?? input.lockedDistributorId ?? input.catalogDistributorId ?? null;
}

/** Confirming the step with a vendor and door style opens Auto-Design. Nothing else does. */
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
