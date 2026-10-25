/**
 * Administrators may inspect an existing saved design without entering the
 * public lead-capture flow. New/unsaved designer sessions retain that gate.
 */
export function canAdminReviewSavedDesign(isAdmin: boolean, loadDesignId: number | null) {
  return isAdmin && loadDesignId != null;
}
