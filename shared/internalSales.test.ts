import { describe, expect, it } from "vitest";
import { catalogEditorEntry, isCompanySalesForecastRole, isInternalSalesRole } from "./internalSales";

describe("company sales roles", () => {
  it("treats admin, designer, and sales_rep as the company forecast audience", () => {
    expect(isCompanySalesForecastRole("admin")).toBe(true);
    expect(isCompanySalesForecastRole("designer")).toBe(true);
    expect(isCompanySalesForecastRole("sales_rep")).toBe(true);
    for (const role of ["user", "distributor", "dealer", "partner", "contractor", "sales", ""]) {
      expect(isCompanySalesForecastRole(role)).toBe(false);
    }
    expect(isInternalSalesRole("designer")).toBe(true);
    expect(isInternalSalesRole("sales_rep")).toBe(true);
    expect(isInternalSalesRole("admin")).toBe(false);
  });

  it("opens the product editor only from an explicit catalog link", () => {
    expect(catalogEditorEntry(new URLSearchParams("section=catalog&catalog=pelican&edit=9")).kind).toBe("pelican");
    expect(catalogEditorEntry(new URLSearchParams("section=catalog&catalog=cabinet&sku=B24&as=12"))).toEqual({
      kind: "cabinet",
      distributorId: 12,
    });
    expect(catalogEditorEntry(new URLSearchParams("section=catalog&edit=9")).kind).toBe("unspecified");
    expect(catalogEditorEntry(new URLSearchParams("section=catalog&catalog=cabinet&sku=B24")).kind).toBe("unspecified");
    expect(catalogEditorEntry(new URLSearchParams("section=orders&catalog=pelican")).kind).toBe("unspecified");
  });
});
