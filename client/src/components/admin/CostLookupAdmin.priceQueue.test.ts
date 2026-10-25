import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./CostLookupAdmin.tsx", import.meta.url), "utf8");

describe("Price Audit missing customer price queue", () => {
  it("uses the owner-only missing-price queue and explains its customer impact", () => {
    expect(source).toContain("trpc.pricing.adminMissingCustomerPriceQueue.useQuery");
    expect(source).toContain("Published products needing customer pricing");
    expect(source).toContain("They remain quote-only and cannot be added to cart");
  });

  it("keeps the missing-price list editable through the shared audited cabinet card", () => {
    expect(source).toContain("<CabinetCard");
    expect(source).toContain("onChanged={refetch}");
  });

  it("provides a correction CSV without supplier cost fields", () => {
    expect(source).toContain("Download correction CSV");
    expect(source).toContain("cabinetdealz-missing-customer-prices.csv");
    expect(source).toContain("Quote required — approved customer price missing");
    expect(source).not.toContain('"Your Cost", "List Price", "Wholesale"');
  });
});
