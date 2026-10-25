import { describe, expect, it } from "vitest";
import { canAdminReviewSavedDesign } from "@/lib/designAccess";

describe("canAdminReviewSavedDesign", () => {
  it("allows a signed-in administrator to open an existing saved design without the public lead gate", () => {
    expect(canAdminReviewSavedDesign(true, 8190001)).toBe(true);
  });

  it("does not bypass lead capture for public visitors or unsaved designs", () => {
    expect(canAdminReviewSavedDesign(false, 8190001)).toBe(false);
    expect(canAdminReviewSavedDesign(true, null)).toBe(false);
  });
});
