import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer plan-switch pricing compliance", () => {
  it("requires a server-backed price review before an existing plan changes style", () => {
    expect(source).toContain("trpc.design.planSwitchPricingReview.useQuery");
    expect(source).toContain("Review priced cabinet alternatives");
    expect(source).toContain("Apply reviewed plan change");
  });

  it("requires explicit alternatives and blocks a switch with no authorized priced replacement", () => {
    expect(source).toContain('item.status === "no_priced_alternative"');
    expect(source).toContain("Choose a priced alternative for every unpriced cabinet");
    expect(source).toContain("Door and drawer configuration differences are shown");
  });

  it("lets an unused color slot change directly instead of displaying an empty disabled review", () => {
    expect(source).toContain("planStyleReviewCandidates");
    expect(source).toContain("plan-style-switch-no-review-needed");
    expect(source).toContain("No cabinet pricing review is needed.");
    expect(source).toContain("Change door style");
    expect(source).toContain("canCommitPlanStyleSwitchWithoutReview");
    expect(source).toContain("All placed cabinets have an authorized price in this door style.");
    expect(source).toContain("Retry price review");
  });
});
