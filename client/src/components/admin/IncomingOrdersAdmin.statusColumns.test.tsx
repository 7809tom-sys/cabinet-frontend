// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const adminList = vi.hoisted(() => vi.fn());

vi.mock("wouter", () => ({
  useLocation: () => ["/admin?tab=orders", vi.fn()],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ orders: { adminListWithPoSkus: { invalidate: vi.fn() } }, vendors: { pendingReview: { invalidate: vi.fn() } } }),
    qbo: { syncOrder: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    vendorInventory: { inboxCount: { useQuery: () => ({ data: { unread: 0 } }) } },
    orders: {
      confirm: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
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

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    requestNumber: "CD-3DB42",
    originatorName: "Jamie Carter",
    originatorEmail: "jamie@example.com",
    customerName: "Jamie Carter",
    status: "confirmed",
    tier: "Homeowner",
    styleName: "Shaker",
    shippingAddress: "123 Oak Street",
    shippingCity: "Austin",
    shippingState: "TX",
    shippingZip: "78701",
    shippingAmount: "47.00",
    invoiceTotal: "520.00",
    itemCount: 1,
    notes: null,
    createdAt: new Date("2026-10-27T12:00:00.000Z"),
    orderVerifiedAt: "2026-10-28T12:00:00.000Z",
    paidAt: "2026-10-28T13:00:00.000Z",
    orderShippedAt: "2026-11-02T15:00:00.000Z",
    shipmentCarrier: "FedEx",
    shipmentTracking: "1Z999AA10123456784",
    orderRailStatus: "fulfillment_authorized",
    lineItems: [{
      cabinetId: 1,
      masterCode: "3DB18",
      description: "3-drawer base 18",
      qty: 1,
      unitPrice: 449,
      linePrice: 449,
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

describe("incoming orders list status columns", () => {
  it("renders a labelled Status column with the order status badge", () => {
    adminList.mockReturnValue({ data: [order()], isLoading: false, error: null, refetch: vi.fn() });
    render(<IncomingOrdersAdmin />);
    const statusCell = screen.getByTestId("order-list-status");
    expect(within(statusCell).getByText("Status")).toBeTruthy();
    expect(statusCell.textContent).toContain("confirmed");
    // The rail status is shown in plain words when the backend sends it.
    expect(statusCell.textContent).toContain("fulfillment authorized");
  });

  it("shows verified and paid state", () => {
    adminList.mockReturnValue({ data: [order()], isLoading: false, error: null, refetch: vi.fn() });
    render(<IncomingOrdersAdmin />);
    const progress = screen.getByTestId("order-list-progress");
    expect(within(progress).getByTestId("order-list-verified").textContent).toBe("Verified");
    expect(within(progress).getByTestId("order-list-paid").textContent).toBe("Paid");
  });

  it("shows shipped state with carrier and a tracking link", () => {
    adminList.mockReturnValue({ data: [order()], isLoading: false, error: null, refetch: vi.fn() });
    render(<IncomingOrdersAdmin />);
    const shipmentCell = screen.getByTestId("order-list-shipment");
    expect(within(shipmentCell).getByTestId("order-list-shipped").textContent).toBe("Shipped");
    expect(within(shipmentCell).getByTestId("order-list-carrier").textContent).toBe("FedEx");
    expect(within(shipmentCell).getByTestId("order-list-tracking").getAttribute("href"))
      .toBe("https://www.fedex.com/fedextrack/?trknbr=1Z999AA10123456784");
  });

  it("shows the empty state instead of a broken link when nothing is recorded", () => {
    adminList.mockReturnValue({
      data: [order({ orderShippedAt: null, shipmentCarrier: null, shipmentTracking: null, orderVerifiedAt: null })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<IncomingOrdersAdmin />);
    expect(screen.getByTestId("order-list-shipped").textContent).toBe("Not shipped");
    expect(screen.getByTestId("order-list-carrier").textContent).toBe("No carrier");
    expect(screen.getByTestId("order-list-tracking").textContent).toBe("No tracking");
    expect(screen.getByTestId("order-list-verified").textContent).toBe("Not verified");
  });

  it("keeps the status columns visible (not hidden behind a breakpoint class)", () => {
    adminList.mockReturnValue({ data: [order()], isLoading: false, error: null, refetch: vi.fn() });
    render(<IncomingOrdersAdmin />);
    const row = screen.getByTestId("order-list-status-row-42");
    expect(row.className).not.toContain("hidden");
    expect(row.className).toContain("grid");
  });

  it("expands inline line items without leaving the list", () => {
    adminList.mockReturnValue({ data: [order()], isLoading: false, error: null, refetch: vi.fn() });
    render(<IncomingOrdersAdmin />);
    fireEvent.click(screen.getByText("CD-3DB42"));
    expect(screen.getByText("usd-sw-3db18")).toBeTruthy();
  });
});
