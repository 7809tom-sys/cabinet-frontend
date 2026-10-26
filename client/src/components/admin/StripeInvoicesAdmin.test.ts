import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("Stripe Invoices admin", () => {
  it("adds an admin tab and reuses the same history on affiliate invoices", () => {
    const tabs = source("client/src/components/admin/AdminGroupedTabs.tsx");
    const affiliate = source("client/src/components/admin/AffiliateInvoicesAdmin.tsx");
    const stripe = source("client/src/components/admin/StripeInvoicesAdmin.tsx");
    expect(tabs).toContain('{ value: "stripe-invoices", label: "Stripe Invoices" }');
    expect(tabs).toContain("<StripeInvoicesAdmin />");
    expect(affiliate).toContain("<StripeInvoicesAdmin");
    expect(affiliate).toContain("lockAffiliate");
    expect(affiliate).toContain("Affiliate billing history");
    expect(stripe).toContain("receipt_email");
    expect(stripe).toContain("Sync from Stripe");
    expect(stripe).toContain("stripeInvoices.adminList");
    expect(stripe).toContain("stripeInvoices.syncFromStripe");
    expect(stripe).not.toContain("myMembership");
  });
});
