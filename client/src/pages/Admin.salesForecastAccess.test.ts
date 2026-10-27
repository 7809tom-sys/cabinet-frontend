import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("company sales forecast access", () => {
  const admin = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
  const forecast = readFileSync(resolve(process.cwd(), "client/src/components/admin/SalesForecastAdmin.tsx"), "utf8");
  const portal = readFileSync(resolve(process.cwd(), "client/src/pages/VendorPortal.tsx"), "utf8");
  const nav = readFileSync(resolve(process.cwd(), "client/src/components/TopNav.tsx"), "utf8");

  it("gives designer and sales_rep the company forecast without the rest of admin", () => {
    expect(admin).toContain('const isDesigner = user.role === "designer"');
    expect(admin).toContain('const isSalesRep = user.role === "sales_rep"');
    expect(admin).toContain('<TabsTrigger value="sales-forecast">Sales Forecast</TabsTrigger>');
    expect(admin.split("<SalesForecastAdmin />").length - 1).toBe(2);
    expect(admin.indexOf("<AdminGroupedTabs />")).toBeGreaterThan(admin.indexOf("if (isDesigner)"));
    expect(nav).toContain('href="/admin?tab=sales-forecast"');
  });

  it("shows vendor cost, vendor percentage, and the product editor, with brackets reserved for admin", () => {
    expect(forecast).toContain("companyForecastProductPath");
    expect(forecast).toContain("Edit product");
    expect(forecast).toContain("Weighted vendor cost");
    expect(forecast).toContain("formatVendorCost(row.vendorCost)");
    expect(forecast).toContain("Vendor forecast percentages");
    expect(forecast).toContain("Sales can view these percentages and cannot change them.");
    expect(forecast).toContain("{isAdmin && <Card>");
    expect(forecast).toContain("trpc.salesForecast.brackets.useQuery(undefined, { enabled: isAdmin })");
    expect(forecast).toContain("trpc.salesForecast.setVendorRate.useMutation");
  });

  it("opens the existing catalog editor for internal sales and keeps a bare vendor visit closed", () => {
    expect(portal).toContain("catalogEditorEntry");
    expect(portal).toContain("isInternalSalesRole(user.role)");
    expect(portal).toContain("function SalesProductEditor");
    expect(portal).toContain("does not open another vendor");
    expect(portal).toContain('data-testid="cabinet-vendor-cost"');
    expect(portal).toContain("cabinetVendorCostLabel(item.vendorWholesale)");
  });
});
