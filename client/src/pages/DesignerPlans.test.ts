import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./DesignerPlans.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("../components/SiteFooter.tsx", import.meta.url), "utf8");

describe("designer subscription plans page", () => {
  it("is routed at /plans and linked from the footer", () => {
    expect(app).toMatch(/<Route path="\/plans">[\s\S]*?<DesignerPlans \/>/);
    expect(footer).toContain('href: "/plans"');
  });

  it("takes every price from the shared tier constant, never a typed dollar amount", () => {
    expect(page).toContain("@shared/designerSubscriptionTiers");
    expect(page).not.toMatch(/\$1,?[15]99|\$1[15]\.99/);
  });

  it("is yearly copy only, never monthly", () => {
    expect(page).toContain("Billed yearly.");
    expect(page).not.toMatch(/\/month|billed monthly|paid month|month already paid/i);
  });

  it("never shows covered supplier names", () => {
    expect(page).not.toMatch(/pelican|us cabinet depot/i);
  });
});
