import { describe, expect, it } from "vitest";
import { GOOGLE_REVIEW_URL, isGoogleReviewUrlConfigured } from "./googleReviewLink";

describe("GOOGLE_REVIEW_URL", () => {
  it("is empty by default so the footer link stays hidden", () => {
    expect(GOOGLE_REVIEW_URL).toBe("");
    expect(isGoogleReviewUrlConfigured()).toBe(false);
  });
});
