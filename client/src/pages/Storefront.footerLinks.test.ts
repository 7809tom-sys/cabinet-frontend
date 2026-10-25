import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { affiliateDashboardPath } from "@/lib/affiliateStorefrontUrl";

const source = readFileSync(new URL("./Storefront.tsx", import.meta.url), "utf8");

function block(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf("\n// ───", start);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("affiliate storefront footer links never reach the main admin", () => {
  it("never links to /admin anywhere in the storefront page", () => {
    expect(source).not.toMatch(/["'`]\/admin/);
  });

  it("the admin footer link opens this store's affiliate portal", () => {
    const admin = block("AdminFooterLink");
    expect(admin).toContain("affiliateDashboardPath(affiliateId)");
    expect(admin).not.toContain("/admin");
    expect(admin).toContain("!affiliateId");
  });

  it("the affiliate footer link opens the portal scoped to this store only", () => {
    const owner = block("AffiliateLoginFooterLink");
    expect(owner).toContain("affiliateDashboardPath(affiliateId)");
    expect(owner).not.toContain("/admin");
  });

  it("the portal address is the affiliate dashboard, not the platform admin", () => {
    expect(affiliateDashboardPath(7)).toBe("/affiliate?viewAs=7");
    expect(affiliateDashboardPath(7)).not.toContain("/admin");
  });
});
