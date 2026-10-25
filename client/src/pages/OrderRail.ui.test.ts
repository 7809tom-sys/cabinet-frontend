import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const affiliate = readFileSync(new URL("./AffiliateDashboard.tsx", import.meta.url), "utf8");
const distributor = readFileSync(new URL("./DistributorPortal.tsx", import.meta.url), "utf8");

describe("official order rail interfaces", () => {
  it("shows only the appropriate affiliate review and invoice approval actions", () => {
    expect(affiliate).toContain("Approve for inventory");
    expect(affiliate).toContain("Approve fulfillment");
    expect(affiliate).toContain("Waiting for distributor");
    expect(affiliate).toContain("Fulfillment authorized");
  });

  it("lets a distributor provide an updated invoice after its inventory check", () => {
    expect(distributor).toContain("Updated invoice #");
    expect(distributor).toContain("Confirm inventory");
    expect(distributor).toContain("confirmInventoryAndInvoice");
  });
});
