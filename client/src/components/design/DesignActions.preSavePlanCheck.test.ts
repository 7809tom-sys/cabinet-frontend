import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignActions.tsx", import.meta.url), "utf8");

describe("DesignActions pre-save plan check", () => {
  it("opens the plan check from every parent save signal before opening the existing save dialog", () => {
    const signalHandlerStart = source.indexOf("useEffect(() => {");
    const reviewOpen = source.indexOf("setPlanCheckOpen(true);", signalHandlerStart);
    const saveDialog = source.indexOf("{/* Save dialog */}");

    expect(signalHandlerStart).toBeGreaterThan(-1);
    expect(reviewOpen).toBeGreaterThan(signalHandlerStart);
    expect(reviewOpen).toBeLessThan(saveDialog);
    expect(source).toContain("Plan check before saving");
    expect(source).toContain("Nothing changes until you choose an action.");
  });

  it("offers explicit review and skip choices for each finding before a shopper proceeds to save", () => {
    expect(source).toContain("onReviewPlanFinding?.(finding)");
    expect(source).toContain("Skip for now");
    expect(source).toContain("Save without changes");
    expect(source).toContain("Continue to save");
  });
});
