import { describe, expect, it } from "vitest";
import {
  activitySummary,
  affiliateCanMutateCustomerProject,
  canDeleteCustomerDesign,
  canEditCustomerProject,
  customersToCsv,
  decideAssistAccess,
  decideDirectoryAccess,
  filterCustomers,
  mergeCustomers,
  type RawCustomerRecord,
  type UnifiedCustomer,
} from "./customerDirectory";

const seen = "2026-10-01T12:00:00.000Z";
const later = "2026-10-20T12:00:00.000Z";

function row(partial: Partial<RawCustomerRecord> & Pick<RawCustomerRecord, "source">): RawCustomerRecord {
  return { affiliateId: 7, seenAt: seen, ...partial };
}

describe("customer directory", () => {
  it("merges the same person across email, phone, and user id", () => {
    const customers = mergeCustomers([
      row({ source: "design", userId: 4, email: "Ada@Example.com", name: "Ada", designId: 1, designName: "Kitchen", unfinishedDesign: true }),
      row({ source: "quote", email: "ada@example.com", phone: "(555) 111-2222", orderId: 9, orderStatus: "submitted", orderTotal: 1200 }),
      row({ source: "order", phone: "5551112222", orderId: 10, orderStatus: "confirmed", orderTotal: 800, activityAt: later }),
      row({ source: "crm", email: "ada@example.com", dealId: 3, dealStage: "quoted", followUpAt: "2026-10-21T12:00:00.000Z" }),
      row({ source: "estimate", userId: 4, estimateId: 2, estimateTotal: 400 }),
      row({ source: "storefront", userId: 4, projectId: 6 }),
    ]);
    expect(customers).toHaveLength(1);
    const customer = customers[0];
    expect(customer.key).toBe("user:4");
    expect(customer.designCount).toBe(1);
    expect(customer.quoteCount).toBe(1);
    expect(customer.orderCount).toBe(1);
    expect(customer.projectCount).toBe(1);
    expect(customer.totalValue).toBe(2400);
    expect(customer.status).toBe("quoted");
    expect(customer.dealId).toBe(3);
    expect(customer.unfinishedDesignCount).toBe(1);
    expect(customer.openQuoteCount).toBe(1);
  });

  it("keeps another affiliate's customer out of this store", () => {
    const customers = mergeCustomers([
      row({ source: "lead", email: "ada@example.com", name: "Ada" }),
      row({ source: "lead", affiliateId: 8, email: "bea@example.com", name: "Bea" }),
    ]);
    expect(customers.map((customer) => customer.email).sort()).toEqual(["ada@example.com", "bea@example.com"]);
    expect(customers.find((customer) => customer.email === "bea@example.com")?.affiliateId).toBe(8);
  });

  it("limits the directory to the caller's store and CRM permission", () => {
    const team = { affiliateId: 7, isOwner: false, accessCrm: true, accessDesigner: false };
    expect(decideDirectoryAccess({ role: "user", access: team }, 7).ok).toBe(true);
    expect(decideDirectoryAccess({ role: "user", access: team }, 8)).toMatchObject({ ok: false });
    expect(decideDirectoryAccess({ role: "user", access: { ...team, accessCrm: false } }, 7)).toMatchObject({ ok: false });
    expect(decideDirectoryAccess({ role: "admin", access: null }, null)).toMatchObject({ ok: true, affiliateId: null });
    expect(decideAssistAccess({ role: "user", access: team, designAffiliateId: 7 })).toMatchObject({ ok: false });
    expect(decideAssistAccess({ role: "user", access: { ...team, accessDesigner: true }, designAffiliateId: 8 })).toMatchObject({ ok: false });
    expect(decideAssistAccess({ role: "admin", access: null, designAffiliateId: 8 })).toEqual({ ok: true });
  });

  it("lets only the owner edit or delete their project and design", () => {
    expect(canEditCustomerProject(4, 4)).toBe(true);
    expect(canEditCustomerProject(9, 4)).toBe(false);
    expect(affiliateCanMutateCustomerProject()).toBe(false);
    expect(canDeleteCustomerDesign(4, 4)).toBe(true);
    expect(canDeleteCustomerDesign(9, 4)).toBe(false);
  });

  it("filters follow-ups and exports csv", () => {
    const customer = mergeCustomers([
      row({ source: "crm", email: "ada@example.com", name: "Ada", dealStage: "contacted", followUpAt: "2020-01-01T00:00:00.000Z" }),
    ])[0] as UnifiedCustomer;
    expect(filterCustomers([customer], { followUpsDue: true, sort: "name" })).toHaveLength(1);
    expect(filterCustomers([{ ...customer, status: "won" }], { followUpsDue: true })).toHaveLength(0);
    expect(customersToCsv([customer])).toContain("ada@example.com");
  });

  it("builds the CRM activity summary", () => {
    const now = new Date("2026-10-26T18:00:00.000Z");
    const text = activitySummary({
      designCount: 1,
      quoteCount: 2,
      projectCount: 1,
      lastActivity: new Date(now.getTime() - 3 * 86_400_000).toISOString(),
    }, now);
    expect(text).toBe("1 design saved · 2 quotes · 1 project · last active 3 days ago");
  });
});
