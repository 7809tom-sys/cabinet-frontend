import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CrmBoard.tsx", import.meta.url), "utf8");

describe("CRM customer help types", () => {
  it("labels each requested kind of help distinctly on the deal card", () => {
    expect(source).toContain("Needs Help Closing");
    expect(source).toContain("Needs Help Designing");
    expect(source).toContain("Needs Help Shipping Costs");
  });

  it("lets staff independently request or clear closing, design, and shipping-cost help", () => {
    expect(source).toContain("needsHelpClosing?: boolean");
    expect(source).toContain("needsHelpDesigning?: boolean");
    expect(source).toContain("needsHelpShipping?: boolean");
    expect(source).toContain("needsHelpClosing: !deal.needsHelpClosing");
    expect(source).toContain("needsHelpDesigning: !deal.needsHelpDesigning");
    expect(source).toContain("needsHelpShipping: !deal.needsHelpShipping");
    expect(source).toContain("Request Design Help");
    expect(source).toContain("Request Shipping Cost Help");
  });
});
