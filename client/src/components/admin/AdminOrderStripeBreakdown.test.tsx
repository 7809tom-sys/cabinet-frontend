// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminOrderStripeBreakdown, { AdminOrderListIdentity, AdminOrderListTotal } from "./AdminOrderStripeBreakdown";

const adminList = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ orders: { adminListWithPoSkus: { invalidate: vi.fn() } } }),
    qbo: { syncOrder: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    orders: {
      confirm: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      sendToDistributor: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      resendDistributorEmail: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      markVerified: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      markShipped: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      markSigned: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      adminMarkPaid: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      backfillCrmSales: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      exportQBO: { useQuery: () => ({ data: null, isFetching: false }) },
      adminListWithPoSkus: { useQuery: () => adminList() },
      adminDelete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      adminDeleteAll: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import IncomingOrdersAdmin from "./IncomingOrdersAdmin";

function ownerOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 18,
    requestNumber: "CD-3DB18",
    originatorName: "Old Name",
    originatorEmail: "jamie@example.com",
    originatorPhone: "555-0100",
    customerName: "Jamie Carter",
    status: "confirmed" as const,
    tier: "Homeowner",
    styleName: "Shaker",
    totalAmount: "449.00",
    taxAmount: "24.00",
    taxState: "TX",
    shippingAmount: "47.00",
    carrier: "UPS",
    shippingAddress: "123 Oak Street",
    shippingCity: "Austin",
    shippingState: "TX",
    shippingZip: "78701",
    stripeChargeAmount: "520.00",
    stripeFeeAmount: "15.60",
    stripeNetAmount: "504.40",
    invoiceTotal: "520.00",
    receiptSentAt: "2026-10-27T15:00:00.000Z",
    itemCount: 1,
    notes: null,
    createdAt: new Date("2026-10-27T12:00:00.000Z"),
    lineItems: [{
      cabinetId: 1,
      masterCode: "3DB18",
      description: "3-drawer base 18",
      qty: 1,
      unitPrice: 449,
      linePrice: 449,
      distributorUnitCost: 210,
      matched: true,
      poSku: "usd-sw-3db18",
    }],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  adminList.mockReset();
});

function text(element: Element | null | undefined): string {
  return element?.textContent ?? "";
}

describe("admin order breakdown", () => {
  it("reconciles the owner fixture at $520 and does not add the stripe fee", () => {
    render(<AdminOrderStripeBreakdown order={ownerOrder()} />);
    expect(text(screen.getByTestId("admin-order-total"))).toContain("$520.00");
    expect(text(screen.getByTestId("admin-order-total"))).not.toContain("$535.60");
    expect(text(screen.getByTestId("admin-order-detail-shipping"))).toContain("$47.00");
    expect(text(screen.getByTestId("admin-order-detail-shipping"))).toContain("UPS");
    expect(text(screen.getByText("Sales tax").parentElement)).toContain("$24.00");
    expect(text(screen.getByTestId("admin-stripe-charge"))).toContain("$520.00");
    expect(text(screen.getByTestId("admin-stripe-fee"))).toContain("$15.60");
    expect(text(screen.getByTestId("admin-stripe-net"))).toContain("$504.40");
    expect(text(screen.getByTestId("admin-stripe-reconciled"))).toContain("Reconciled with Stripe");
    expect(text(screen.getByTestId("admin-order-distributor-cost"))).toContain("$210.00");
    expect(screen.getByText("Admin only. Distributor cost is our true cost and is already included in the customer price. It is not an extra charge.")).toBeTruthy();
    expect(text(screen.getByTestId("admin-order-detail-receipt"))).toContain("Receipt emailed");
  });

  it("shows a red warning with the difference when stripe does not match", () => {
    render(<AdminOrderStripeBreakdown order={ownerOrder({ stripeChargeAmount: "530.00" })} />);
    const warning = screen.getByRole("alert");
    expect(warning.textContent).toContain("differ by $10.00");
    expect(warning.className).toContain("text-red-700");
    expect(screen.queryByTestId("admin-stripe-reconciled")).toBeNull();
  });

  it("shows not available when the distributor cost is missing", () => {
    render(<AdminOrderStripeBreakdown order={ownerOrder({
      lineItems: [{
        cabinetId: 1,
        masterCode: "3DB18",
        description: "3-drawer base 18",
        qty: 1,
        unitPrice: 449,
        linePrice: 449,
        matched: true,
        poSku: null,
      }],
    })} />);
    expect(text(screen.getByTestId("admin-order-distributor-cost"))).toContain("not available");
    expect(text(screen.getByTestId("admin-order-margin"))).toContain("not available");
    expect(screen.getByText("3DB18")).toBeTruthy();
  });

  it("shows $0.00 and not recorded, with a warning, when shipping is missing", () => {
    render(<AdminOrderStripeBreakdown order={ownerOrder({ shippingAmount: undefined, carrier: undefined, invoiceTotal: undefined })} />);
    expect(text(screen.getByTestId("admin-order-detail-shipping"))).toContain("$0.00");
    expect(text(screen.getByTestId("admin-order-detail-shipping"))).toContain("not recorded");
    expect(text(screen.getByTestId("admin-order-detail-shipping-warning"))).toContain("Warning");
    expect(screen.getByRole("alert").textContent).toContain("differ by $47.00");
  });

  it("shows receipt not sent when the backend has no receipt timestamp", () => {
    render(<AdminOrderStripeBreakdown order={ownerOrder({ receiptSentAt: null })} />);
    expect(text(screen.getByTestId("admin-order-detail-receipt"))).toContain("Receipt not sent");
  });
});

describe("incoming orders list", () => {
  it("shows the customer, ship-to, shipping line, and full invoice total beside the order number", () => {
    adminList.mockReturnValue({ data: [ownerOrder()], isLoading: false, error: null, refetch: vi.fn() });
    render(<IncomingOrdersAdmin />);
    const header = screen.getByText("CD-3DB18").closest("div.flex") as HTMLElement;
    expect(header.className).toContain("w-full");
    expect(text(within(header).getByTestId("admin-order-customer"))).toContain("Jamie Carter");
    const shipTo = within(header).getByTestId("admin-order-ship-to");
    expect(shipTo.textContent).toContain("123 Oak Street, Austin, TX 78701");
    expect(shipTo.getAttribute("title")).toBe("123 Oak Street, Austin, TX 78701");
    expect(text(within(header).getByTestId("admin-order-list-shipping"))).toContain("Shipping $47.00 · UPS");
    expect(text(within(header).getByTestId("admin-order-list-total"))).toContain("$520.00");
    expect(text(within(header).getByTestId("admin-order-list-total"))).not.toContain("$449.00");
    expect(text(within(header).getByTestId("admin-stripe-reconciled"))).toContain("Reconciled with Stripe");
    expect(text(within(header).getByTestId("admin-order-list-receipt"))).toContain("Receipt emailed");
    expect(header.textContent).not.toContain("$449.00");
  });

  it("truncates a long shipping location and keeps the full address on the tooltip", () => {
    const street = "9876 Extremely Long Industrial Parkway Suite 400 Building C";
    adminList.mockReturnValue({
      data: [ownerOrder({ shippingAddress: street, receiptSentAt: null })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<IncomingOrdersAdmin />);
    const shipTo = screen.getByTestId("admin-order-ship-to");
    expect(shipTo.textContent?.endsWith("…")).toBe(true);
    expect(shipTo.getAttribute("title")).toContain(street);
    expect(shipTo.getAttribute("title")).toContain("Austin, TX 78701");
    expect(text(screen.getByTestId("admin-order-list-receipt"))).toContain("Receipt not sent");
  });

  it("warns on the list when shipping was not recorded and still prefers a backend invoice total", () => {
    adminList.mockReturnValue({
      data: [ownerOrder({ shippingAmount: undefined, carrier: undefined })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<IncomingOrdersAdmin />);
    expect(text(screen.getByTestId("admin-order-list-shipping"))).toContain("$0.00 · not recorded");
    expect(text(screen.getByTestId("admin-order-list-shipping-warning"))).toContain("Warning");
    expect(text(screen.getByTestId("admin-order-list-total"))).toContain("$520.00");
    expect(text(screen.getByTestId("admin-order-list-total"))).not.toContain("$449.00");
  });

  it("opens the detail breakdown with the same $520 reconciliation", () => {
    adminList.mockReturnValue({ data: [ownerOrder()], isLoading: false, error: null, refetch: vi.fn() });
    render(<IncomingOrdersAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const detail = screen.getByTestId("admin-order-stripe-breakdown");
    expect(text(within(detail).getByTestId("admin-order-total"))).toContain("$520.00");
    expect(text(within(detail).getByTestId("admin-order-detail-shipping"))).toContain("$47.00 · UPS");
    expect(within(detail).getByText("3DB18")).toBeTruthy();
    expect(text(within(detail).getByTestId("admin-stripe-reconciled"))).toContain("Reconciled with Stripe");
  });
});

describe("list identity truncation", () => {
  it("renders the name in the flexible middle of the row", () => {
    render(<AdminOrderListIdentity order={ownerOrder()} />);
    expect(screen.getByTestId("admin-order-list-identity").className).toContain("flex-1");
    render(<AdminOrderListTotal order={ownerOrder({ stripeChargeAmount: "500.00" })} />);
    expect(screen.getByRole("alert").textContent).toContain("differ by $20.00");
  });
});
