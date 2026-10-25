import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./VendorPortal.tsx", import.meta.url), "utf8");

describe("Vendor Portal inventory forecast report", () => {
  it("provides the requested report, filter windows, and CSV export", () => {
    expect(source).toContain("Design → Inventory forecast");
    expect(source).toContain('value="30">Last 30 days');
    expect(source).toContain('value="90">Last 90 days');
    expect(source).toContain('value="180">Last 180 days');
    expect(source).toContain("Export CSV");
  });

  it("shows master and vendor SKU plus demand, stock, and status fields", () => {
    expect(source).toContain("Master SKU");
    expect(source).toContain("Vendor ordering SKU");
    expect(source).toContain("Projected sell-through");
    expect(source).toContain("Suggested stock");
    expect(source).toContain("On hand");
    expect(source).toContain("Demand only");
  });

  it("makes dead designs visible without counting them and keeps rates administrator-managed", () => {
    expect(source).toContain("View dead designs");
    expect(source).toContain("Dead designs — excluded from forecast");
    expect(source).toContain("Administrator forecast rate");
    expect(source).toContain("Close-rate factor");
  });

  it("lets a vendor supply optional current inventory without treating a blank feed as zero", () => {
    expect(source).toContain("On hand");
    expect(source).toContain("Set on-hand inventory");
    expect(source).toContain("No inventory feed");
    expect(source).toContain("updateOnHandInventory");
  });
});
