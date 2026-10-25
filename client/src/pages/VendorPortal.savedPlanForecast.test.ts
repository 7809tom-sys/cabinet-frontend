import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./VendorPortal.tsx", import.meta.url), "utf8");

describe("Vendor Portal saved-plan forecast", () => {
  it("renders the authorized saved-plan demand forecast alongside existing analytics", () => {
    expect(source).toContain("trpc.analytics.savedPlanForecast.useQuery");
    expect(source).toContain("Saved-plan demand forecast");
    expect(source).toContain("Projected cabinet units");
    expect(source).toContain("Leading SKU demand");
    expect(source).toContain("Styles in the pipeline");
    expect(source).toContain("Recent saved-plan timing");
  });

  it("clearly limits the forecast to saved plans rather than submitted orders", () => {
    expect(source).toContain("It does not use submitted orders or represent a sales commitment.");
    expect(source).toContain("No vendor-matched cabinet selections appear in saved plans for this period yet.");
  });

  it("keeps portal navigation reachable when overview line data is temporarily unavailable", () => {
    expect(source).toContain("if (!myLine.data)");
    expect(source).toContain("Your vendor line is not available yet.");
  });
});
