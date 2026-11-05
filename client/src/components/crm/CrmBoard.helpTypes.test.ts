import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CrmBoard.tsx", import.meta.url), "utf8");

/** The deal drawer ends at the Delete deal action in the current source. */
function dealDrawerTail() {
  const start = source.indexOf("function DealDrawer(");
  return source.slice(start, source.indexOf("function QuickInvoiceDialog("));
}

describe("CRM customer help types", () => {
  it("labels each requested kind of help distinctly on the deal card", () => {
    expect(source).toContain("Needs Help Closing");
    expect(source).toContain("Needs Help Designing");
    expect(source).toContain("Needs Help Shipping Costs");
  });

  it("keeps the help flags readable from the deal row", () => {
    expect(source).toContain("needsHelpClosing?: boolean");
    expect(source).toContain("needsHelpDesigning?: boolean");
    expect(source).toContain("needsHelpShipping?: boolean");
  });

  it("no longer offers Request help buttons in the deal/order detail drawer", () => {
    const drawer = dealDrawerTail();
    expect(drawer).not.toContain("Request Help Closing");
    expect(drawer).not.toContain("Request Design Help");
    expect(drawer).not.toContain("Request Shipping Cost Help");
    expect(drawer).not.toContain("needsHelpClosing: !deal.needsHelpClosing");
    expect(drawer).not.toContain("needsHelpDesigning: !deal.needsHelpDesigning");
    expect(drawer).not.toContain("needsHelpShipping: !deal.needsHelpShipping");
  });
});
