import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CrmBoard.tsx", import.meta.url), "utf8");

describe("CRM consolidated Labor selector", () => {
  it("provides a validated deal-level Labor dropdown next to linked designs", () => {
    expect(source).toContain('htmlFor="crm-labor-estimate"');
    expect(source).toContain("trpc.crm.setLaborEstimate.useMutation");
    expect(source).toContain('value === "none" ? null : Number(value)');
    expect(source).toContain("No eligible labor estimate is linked to this customer or order.");
  });

  it("carries the selected estimate into a separate Labor line in the Quick PDF invoice", () => {
    expect(source).toContain("laborAmount: string | number | null");
    expect(source).toContain('lineFor(labor.enabled, label("Labor", "Mano de obra"), labor.amount)');
    expect(source).toContain('id="invoice-labor"');
    expect(source).toContain("prefill?.laborSource");
  });
});
