import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ORDER_NOT_AVAILABLE,
  ADMIN_ORDER_RECEIPT_EMAILED,
  ADMIN_ORDER_RECEIPT_NOT_SENT,
  buildAdminOrderBreakdown,
  describeAdminOrderList,
} from "./adminOrderReconciliation";

/**
 * Owner's example, used only as a fixture. 3% of $520 is $15.60, so the
 * payout is $504.40. The fee is not part of the customer total.
 */
function ownerExample(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Jamie Carter",
    totalAmount: "449.00",
    taxAmount: "24.00",
    shippingAmount: "47.00",
    carrier: "UPS",
    stripeChargeAmount: "520.00",
    stripeFeeAmount: "15.60",
    stripeNetAmount: "504.40",
    shippingAddress: "123 Oak Street",
    shippingCity: "Austin",
    shippingState: "TX",
    shippingZip: "78701",
    receiptSentAt: "2026-10-27T15:00:00.000Z",
    lineItems: [{
      masterCode: "3DB18",
      description: "3-drawer base 18",
      qty: 1,
      unitPrice: 449,
      linePrice: 449,
      distributorUnitCost: 210,
    }],
    ...overrides,
  };
}

describe("admin order stripe reconciliation", () => {
  it("reconciles the owner example at $520 and keeps the stripe fee out of the total", () => {
    const breakdown = buildAdminOrderBreakdown(ownerExample());
    expect(breakdown.subtotalCents).toBe(44900);
    expect(breakdown.shippingCents).toBe(4700);
    expect(breakdown.shippingCarrier).toBe("UPS");
    expect(breakdown.taxCents).toBe(2400);
    expect(breakdown.orderTotalCents).toBe(52000);
    expect(breakdown.stripeChargeCents).toBe(52000);
    expect(breakdown.stripeFeeCents).toBe(1560);
    expect(breakdown.stripeNetCents).toBe(50440);
    expect(breakdown.orderTotalCents).not.toBe(52000 + 1560);
    expect(breakdown.reconciliation).toEqual({ status: "reconciled" });
    expect(breakdown.lines[0]).toMatchObject({
      code: "3DB18",
      customerCents: 44900,
      distributorCostCents: 21000,
      marginCents: 23900,
    });
  });

  it("computes subtotal + shipping + tax - discounts when the backend total is missing", () => {
    const breakdown = buildAdminOrderBreakdown(ownerExample({ discountAmount: "10.00" }));
    expect(breakdown.orderTotalSource).toBe("computed");
    expect(breakdown.discountCents).toBe(1000);
    expect(breakdown.orderTotalCents).toBe(51000);
    expect(breakdown.reconciliation).toEqual({ status: "mismatch", differenceCents: 1000 });
  });

  it("prefers the backend invoice total over the cabinet subtotal", () => {
    const breakdown = buildAdminOrderBreakdown(ownerExample({ invoiceTotal: "520.00", shippingAmount: undefined }));
    expect(breakdown.orderTotalSource).toBe("backend");
    expect(breakdown.orderTotalCents).toBe(52000);
    expect(breakdown.orderTotalCents).not.toBe(44900);
    expect(breakdown.reconciliation).toEqual({ status: "reconciled" });
  });

  it("flags a stripe charge that does not match the order total", () => {
    const breakdown = buildAdminOrderBreakdown(ownerExample({ stripeChargeAmount: "530.00" }));
    expect(breakdown.reconciliation).toEqual({ status: "mismatch", differenceCents: 1000 });
  });

  it("shows a missing distributor cost as unavailable and still prices the line", () => {
    const breakdown = buildAdminOrderBreakdown(ownerExample({
      lineItems: [{ masterCode: "3DB18", description: "3-drawer base 18", qty: 1, unitPrice: 449, linePrice: 449 }],
    }));
    expect(breakdown.lines[0].distributorCostCents).toBeNull();
    expect(breakdown.lines[0].marginCents).toBeNull();
    expect(breakdown.lines[0].customerCents).toBe(44900);
  });

  it("records missing shipping as $0.00 and warns by leaving it unrecorded", () => {
    const breakdown = buildAdminOrderBreakdown(ownerExample({
      shippingAmount: undefined,
      carrier: undefined,
      invoiceTotal: undefined,
    }));
    expect(breakdown.shippingRecorded).toBe(false);
    expect(breakdown.shippingCents).toBe(0);
    expect(breakdown.orderTotalCents).toBe(47300);
    expect(breakdown.reconciliation).toEqual({ status: "mismatch", differenceCents: 4700 });
  });

  it("does not treat an explicit free-shipping amount as missing", () => {
    const breakdown = buildAdminOrderBreakdown(ownerExample({ shippingAmount: "0.00", invoiceTotal: "473.00", stripeChargeAmount: "473.00" }));
    expect(breakdown.shippingRecorded).toBe(true);
    expect(breakdown.shippingCents).toBe(0);
    expect(breakdown.reconciliation).toEqual({ status: "reconciled" });
  });

  it("places the customer and ship-to beside the order and truncates a long location", () => {
    const identity = describeAdminOrderList(ownerExample());
    expect(identity.customerName).toBe("Jamie Carter");
    expect(identity.shippingLocation).toBe("123 Oak Street, Austin, TX 78701");
    expect(identity.shippingLocationDisplay).toBe("123 Oak Street, Austin, TX 78701");
    expect(identity.receiptLabel).toBe(ADMIN_ORDER_RECEIPT_EMAILED);

    const longStreet = "9876 Extremely Long Industrial Parkway Suite 400 Building C";
    const truncated = describeAdminOrderList(ownerExample({ shippingAddress: longStreet }));
    expect(truncated.shippingLocation).toContain(longStreet);
    expect(truncated.shippingLocation).toContain("Austin, TX 78701");
    expect(truncated.shippingLocationDisplay?.endsWith("…")).toBe(true);
    expect((truncated.shippingLocationDisplay ?? "").length).toBeLessThan(truncated.shippingLocation?.length ?? 0);
  });

  it("reads a nested shipping address and falls back to the originator name", () => {
    const identity = describeAdminOrderList({
      originatorName: "Originator Name",
      shippingAddress: { line1: "9 Pine Ave", city: "Denver", state: "CO", zip: "80202" },
    });
    expect(identity.customerName).toBe("Originator Name");
    expect(identity.shippingLocation).toBe("9 Pine Ave, Denver, CO 80202");
    expect(identity.receiptLabel).toBe(ADMIN_ORDER_RECEIPT_NOT_SENT);
  });

  it("does not use the cabinet subtotal when tax is missing", () => {
    const breakdown = buildAdminOrderBreakdown({ totalAmount: "449.00", lineItems: [] });
    expect(breakdown.orderTotalCents).toBeNull();
    expect(breakdown.orderTotalSource).toBe("missing");
    expect(breakdown.taxCents).toBeNull();
    expect(formatUnavailable(breakdown.taxCents)).toBe(ADMIN_ORDER_NOT_AVAILABLE);
  });
});

function formatUnavailable(cents: number | null): string {
  return cents == null ? ADMIN_ORDER_NOT_AVAILABLE : "";
}

describe("distributor cost stays off customer pages", () => {
  it("does not render the admin stripe breakdown outside incoming orders", () => {
    const files = [
      "client/src/pages/CheckoutSuccess.tsx",
      "client/src/components/order/OrderReview.tsx",
      "client/src/pages/Cart.tsx",
      "client/src/pages/OrderBuilder.tsx",
    ];
    for (const file of files) {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(text).not.toContain("AdminOrderStripeBreakdown");
      expect(text).not.toContain("Reconciled with Stripe");
      expect(text).not.toContain("Distributor cost");
      expect(text).not.toContain("admin-order-distributor-cost");
    }
  });
});
