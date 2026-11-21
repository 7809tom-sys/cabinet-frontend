import { describe, expect, it } from "vitest";
import {
  DEMO_CATALOG,
  DEMO_DISTRIBUTOR,
  DEMO_ORDERS,
  DISTRIBUTOR_COMMISSION_RANGE,
  demoCommissionCents,
  demoDesignerPath,
  filterCatalogForDistributor,
  formatPercent,
  isDistributorPreviewSection,
  summarizeDemoOrders,
} from "./demoDistributor";

describe("demo distributor data", () => {
  it("filters the storefront catalog to the distributor's own products", () => {
    const own = filterCatalogForDistributor(DEMO_CATALOG, DEMO_DISTRIBUTOR.id);
    expect(own.length).toBeGreaterThan(0);
    expect(own.length).toBeLessThan(DEMO_CATALOG.length);
    expect(own.every((p) => p.distributorId === DEMO_DISTRIBUTOR.id)).toBe(true);
  });

  it("charges commission only on designer-assisted orders, never on direct CSV orders", () => {
    expect(demoCommissionCents(100_000, "designer", 0.03)).toBe(3_000);
    expect(demoCommissionCents(100_000, "designer", 0.04)).toBe(4_000);
    expect(demoCommissionCents(100_000, "csv", 0.04)).toBe(0);
  });

  it("keeps the demo commission inside the 3-4% range", () => {
    expect(DISTRIBUTOR_COMMISSION_RANGE).toEqual({ min: 0.03, max: 0.04 });
    expect(demoCommissionCents(100_000, "designer", 0.1)).toBe(4_000);
    expect(demoCommissionCents(100_000, "designer", 0.01)).toBe(3_000);
    expect(`${formatPercent(0.03)}–${formatPercent(0.04)}`).toBe("3%–4%");
  });

  it("summarises demo orders with commission from designer orders only", () => {
    const summary = summarizeDemoOrders(DEMO_ORDERS, 0.04);
    const designer = DEMO_ORDERS.filter((o) => o.channel === "designer").reduce((sum, o) => sum + o.totalCents, 0);
    expect(summary.designerCents).toBe(designer);
    expect(summary.totalCents).toBe(summary.designerCents + summary.csvCents);
    expect(summary.commissionCents).toBe(DEMO_ORDERS.filter((o) => o.channel === "designer").reduce((sum, o) => sum + Math.round(o.totalCents * 0.04), 0));
  });

  it("reuses the existing branded /store/:slug/design path for the designer", () => {
    expect(demoDesignerPath()).toBe("/store/sales-demo/design");
    expect(demoDesignerPath("demo-distributor")).toBe("/store/demo-distributor/design");
  });

  it("validates preview sections", () => {
    expect(isDistributorPreviewSection("dashboard")).toBe(true);
    expect(isDistributorPreviewSection("admin")).toBe(false);
    expect(isDistributorPreviewSection(undefined)).toBe(false);
  });

  it("uses clearly placeholder identities in all demo data", () => {
    expect(DEMO_DISTRIBUTOR.name).toBe("Demo Distributor");
    expect(DEMO_ORDERS.every((o) => o.id.startsWith("DEMO-") && o.customer.startsWith("Sample"))).toBe(true);
  });
});
