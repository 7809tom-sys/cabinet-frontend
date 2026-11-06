// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
const adminList = vi.hoisted(() => vi.fn());
const exportCsv = vi.hoisted(() => vi.fn());

vi.mock("wouter", () => ({ useLocation: () => ["/admin?tab=master-orders", navigate] }));
vi.mock("@/lib/trpc", () => ({
  trpc: { orders: { adminListWithPoSkus: { useQuery: () => adminList() } } },
}));
vi.mock("@/lib/masterOrdersCsv", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/masterOrdersCsv")>();
  return { ...actual, downloadMasterOrdersCsv: (rows: unknown, now?: Date) => { exportCsv(rows, now); return ""; } };
});

import MasterOrders from "./MasterOrders";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 18,
    requestNumber: "CD-20261022-OLOUT",
    customerName: "Tom Reaves",
    originatorName: "Tom Reaves",
    originatorEmail: "tom@example.com",
    distributorName: "Ashford",
    createdAt: "2026-10-22T12:00:00.000Z",
    totalAmount: "449.34",
    invoiceTotal: "449.34",
    taxAmount: "24.40",
    shippingAmount: "47.00",
    deliveryMethod: "ship",
    paidAt: "2026-10-22T13:00:00.000Z",
    lineItems: [{ unitPrice: 449.34, linePrice: 449.34, qty: 1, distributorUnitCost: 284.39, distributorLineCost: 284.39 }],
    ...overrides,
  };
}

const direct = order({ id: 1, requestNumber: "CD-1", customerName: "Ada Chen", affiliateName: null, createdAt: "2026-10-20T12:00:00.000Z", totalAmount: "100.00", invoiceTotal: "100.00", taxAmount: "0", shippingAmount: "0", lineItems: [{ unitPrice: 100, linePrice: 100, qty: 2, distributorUnitCost: 40, distributorLineCost: 80 }] });
const affiliateOrder = order({
  id: 2,
  requestNumber: "CD-2",
  customerName: "Raj Patel",
  affiliateName: "Reaves Way Cabinet Shop",
  affiliateSlug: "reaves-way",
  affiliateHostname: "reaves-way.cabinetdealz.com",
  dealerName: "Reaves Way LLC",
  distributorName: "Madison",
  createdAt: "2026-10-25T12:00:00.000Z",
  orderVerifiedAt: "2026-10-26T15:00:00.000Z",
  orderVerifiedBy: "Selena Ortiz <selena@cabinetdealz.com>",
});
const shipped = order({ id: 3, requestNumber: "CD-3", createdAt: "2026-10-26T12:00:00.000Z", orderVerifiedAt: "2026-10-26T15:00:00.000Z", orderShippedAt: "2026-10-27T18:00:00.000Z", orderShippedBy: "Rick <rick@cabinetdealz.com>", shipmentCarrier: "FedEx", shipmentTracking: "1Z999", saleRefundedAt: "2026-10-30T12:00:00.000Z" });
const signed = order({ id: 4, requestNumber: "CD-4", createdAt: "2026-10-27T12:00:00.000Z", orderVerifiedAt: "2026-10-27T15:00:00.000Z", orderShippedAt: "2026-10-28T18:00:00.000Z", orderSignedAt: "2026-10-29T20:00:00.000Z" });

beforeEach(() => {
  adminList.mockReturnValue({ data: [direct, affiliateOrder, shipped, signed], isLoading: false, error: null });
});

afterEach(() => {
  cleanup();
  navigate.mockReset();
  adminList.mockReset();
  exportCsv.mockReset();
});

describe("master orders", () => {
  it("is titled Master Orders and says it covers every affiliate, dealer and distributor", () => {
    render(<MasterOrders />);
    expect(screen.getByText("Master Orders")).toBeTruthy();
    expect(screen.getByTestId("master-orders").textContent).toContain("all affiliates, dealers and distributors");
    expect(screen.getByTestId("master-orders-total").textContent).toContain("4 orders");
  });

  it("shows the columns in the requested order", () => {
    render(<MasterOrders />);
    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent?.trim());
    expect(headers).toEqual([
      "Order #", "Date", "Affiliate", "Customer", "Dealer", "Distributor",
      "Total", "Cost", "Margin", "Payment", "Status",
    ]);
  });

  it("shows affiliate name and site in its own column, separate from dealer", () => {
    render(<MasterOrders />);
    const cell = screen.getByTestId("master-orders-affiliate-cell-2");
    expect(cell.textContent).toContain("Reaves Way Cabinet Shop");
    expect(cell.textContent).toContain("reaves-way.cabinetdealz.com");
    expect(screen.getByTestId("master-orders-dealer-2").textContent).toBe("Reaves Way LLC");
  });

  it("prints an em dash for an order with no affiliate source instead of guessing", () => {
    render(<MasterOrders />);
    expect(screen.getByTestId("master-orders-affiliate-cell-1").textContent).toBe("—");
    expect(screen.getByTestId("master-orders-dealer-1").textContent).toBe("—");
  });

  it("shows customer total, distributor cost and margin", () => {
    render(<MasterOrders />);
    // CD-20261022-OLOUT's numbers: $449.34 + $47.00 shipping + $24.40 tax.
    expect(screen.getByTestId("master-orders-total-2").textContent).toBe("$520.74");
    expect(screen.getByTestId("master-orders-cost-2").textContent).toBe("$284.39");
    expect(screen.getByTestId("master-orders-margin-2").textContent).toBe("$236.35");
    // Computed from the line when no cost snapshot exists.
    expect(screen.getByTestId("master-orders-cost-1").textContent).toBe("$80.00");
  });

  it("shows the payment status, including refunded", () => {
    render(<MasterOrders />);
    expect(screen.getByTestId("master-orders-payment-2").textContent).toBe("paid");
    expect(screen.getByTestId("master-orders-payment-3").textContent).toBe("refunded");
    expect(screen.getByTestId("master-orders-payment-4").textContent).toBe("paid");
  });

  it("shows the who/when status chain", () => {
    render(<MasterOrders />);
    const row = screen.getByTestId("master-orders-row-2");
    expect(within(row).getByTestId("status-dot-verified").getAttribute("data-done")).toBe("true");
    expect(within(row).getByTestId("status-dot-sub-verified").textContent).toContain("Selena Ortiz");
    expect(within(row).getByTestId("status-dot-sub-verified").textContent).toContain("CT");
    expect(within(row).getByTestId("status-dot-shipped").getAttribute("data-done")).toBe("false");
    expect(within(row).getByTestId("status-dot-sub-shipped").textContent).toBe("Waiting");
  });

  it("shows carrier and tracking once shipped", () => {
    render(<MasterOrders />);
    const row = screen.getByTestId("master-orders-row-3");
    expect(within(row).getByTestId("status-dot-sub-shipped").textContent).toContain("FedEx · 1Z999");
  });

  it("counts each order into exactly one tile", () => {
    render(<MasterOrders />);
    expect(screen.getByTestId("master-orders-tile-awaiting_verification").textContent).toContain("1");
    expect(screen.getByTestId("master-orders-tile-verified_not_shipped").textContent).toContain("1");
    expect(screen.getByTestId("master-orders-tile-shipped_not_signed").textContent).toContain("1");
    expect(screen.getByTestId("master-orders-tile-signed").textContent).toContain("1");
  });

  it("filters to a bucket on tile click and clears on a second click", () => {
    render(<MasterOrders />);
    fireEvent.click(screen.getByTestId("master-orders-tile-verified_not_shipped"));
    expect(screen.getByTestId("master-orders-row-2")).toBeTruthy();
    expect(screen.queryByTestId("master-orders-row-1")).toBeNull();
    fireEvent.click(screen.getByTestId("master-orders-tile-verified_not_shipped"));
    expect(screen.getByTestId("master-orders-row-1")).toBeTruthy();
  });

  it("searches order number, customer, affiliate and dealer", () => {
    render(<MasterOrders />);
    for (const [term, expected] of [["raj", 2], ["cd-3", 3], ["reaves way", 2]] as const) {
      fireEvent.change(screen.getByTestId("master-orders-search"), { target: { value: term } });
      expect(screen.getByTestId(`master-orders-row-${expected}`)).toBeTruthy();
      expect(screen.queryAllByTestId(/^master-orders-row-/)).toHaveLength(1);
    }
  });

  it("filters by date range", () => {
    render(<MasterOrders />);
    fireEvent.change(screen.getByTestId("master-orders-from"), { target: { value: "2026-10-23" } });
    expect(screen.queryByTestId("master-orders-row-1")).toBeNull();
    expect(screen.getByTestId("master-orders-row-2")).toBeTruthy();
  });

  it("filters to orders with no step in N days", () => {
    render(<MasterOrders />);
    fireEvent.change(screen.getByTestId("master-orders-stuck"), { target: { value: "400" } });
    expect(screen.getByTestId("master-orders-empty")).toBeTruthy();
    fireEvent.change(screen.getByTestId("master-orders-stuck"), { target: { value: "1" } });
    expect(screen.getByTestId("master-orders-row-1")).toBeTruthy();
    expect(screen.queryByTestId("master-orders-row-4")).toBeNull();
  });

  it("marks a stuck row with its age", () => {
    render(<MasterOrders />);
    fireEvent.change(screen.getByTestId("master-orders-stuck"), { target: { value: "10" } });
    expect(screen.getByTestId("master-orders-stuck-1").textContent).toMatch(/\d+d/);
  });

  it("sorts by a column and flips direction on a second click", () => {
    render(<MasterOrders />);
    // Default is newest first: CD-4 (Oct 27) before CD-1 (Oct 20).
    expect(screen.getAllByTestId(/^master-orders-row-/)[0].getAttribute("data-testid")).toBe("master-orders-row-4");
    fireEvent.click(screen.getByTestId("master-orders-sort-orderNumber"));
    expect(screen.getAllByTestId(/^master-orders-row-/)[0].getAttribute("data-testid")).toBe("master-orders-row-1");
    fireEvent.click(screen.getByTestId("master-orders-sort-orderNumber"));
    expect(screen.getAllByTestId(/^master-orders-row-/)[0].getAttribute("data-testid")).toBe("master-orders-row-4");
  });

  it("marks the sorted column with aria-sort", () => {
    render(<MasterOrders />);
    expect(screen.getByTestId("master-orders-sort-createdAt").getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(screen.getByTestId("master-orders-sort-marginCents"));
    expect(screen.getByTestId("master-orders-sort-marginCents").getAttribute("aria-sort")).toBe("ascending");
  });

  it("pages 50 orders at a time", () => {
    const many = Array.from({ length: 120 }, (_, index) => order({ id: index + 1, requestNumber: `CD-${index + 1}` }));
    adminList.mockReturnValue({ data: many, isLoading: false, error: null });
    render(<MasterOrders />);
    expect(screen.getAllByTestId(/^master-orders-row-/)).toHaveLength(50);
    expect(screen.getByTestId("master-orders-page-label").textContent).toContain("Page 1 of 3");
    expect(screen.getByTestId("master-orders-visible-count").textContent).toContain("1–50 of 120");

    fireEvent.click(screen.getByTestId("master-orders-next"));
    expect(screen.getByTestId("master-orders-page-label").textContent).toContain("Page 2 of 3");
    expect(screen.getByTestId("master-orders-visible-count").textContent).toContain("51–100 of 120");

    fireEvent.click(screen.getByTestId("master-orders-next"));
    expect(screen.getAllByTestId(/^master-orders-row-/)).toHaveLength(20);
    expect((screen.getByTestId("master-orders-next") as HTMLButtonElement).disabled).toBe(true);
  });

  it("goes back to page 1 when a filter changes", () => {
    const many = Array.from({ length: 120 }, (_, index) => order({ id: index + 1, requestNumber: `CD-${index + 1}` }));
    adminList.mockReturnValue({ data: many, isLoading: false, error: null });
    render(<MasterOrders />);
    fireEvent.click(screen.getByTestId("master-orders-next"));
    expect(screen.getByTestId("master-orders-page-label").textContent).toContain("Page 2");
    fireEvent.change(screen.getByTestId("master-orders-search"), { target: { value: "CD-1" } });
    expect(screen.getByTestId("master-orders-page-label").textContent).toContain("Page 1");
  });

  it("exports exactly the filtered and sorted rows", () => {
    render(<MasterOrders />);
    fireEvent.change(screen.getByTestId("master-orders-search"), { target: { value: "raj" } });
    fireEvent.click(screen.getByTestId("master-orders-export"));
    expect(exportCsv).toHaveBeenCalledOnce();
    const exported = exportCsv.mock.calls[0][0] as Array<{ orderNumber: string }>;
    expect(exported.map((row) => row.orderNumber)).toEqual(["CD-2"]);
  });

  it("opens the order when a row is clicked", () => {
    render(<MasterOrders />);
    fireEvent.click(screen.getByTestId("master-orders-row-2"));
    expect(navigate).toHaveBeenCalledWith("/admin/orders/2?tab=master-orders");
  });

  it("clears every filter at once", () => {
    render(<MasterOrders />);
    fireEvent.click(screen.getByTestId("master-orders-tile-signed"));
    fireEvent.change(screen.getByTestId("master-orders-search"), { target: { value: "zzz" } });
    expect(screen.getByTestId("master-orders-empty")).toBeTruthy();
    fireEvent.click(screen.getByTestId("master-orders-clear"));
    expect(screen.getByTestId("master-orders-row-1")).toBeTruthy();
  });

  it("shows an error instead of a blank table when the list fails", () => {
    adminList.mockReturnValue({ data: undefined, isLoading: false, error: { message: "Order status columns are missing" } });
    render(<MasterOrders />);
    expect(screen.getByTestId("master-orders-error").textContent).toContain("Order status columns are missing");
  });

  it("shows a spinner while loading", () => {
    adminList.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<MasterOrders />);
    expect(screen.queryByTestId("master-orders")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

describe("master orders affiliate filter", () => {
  it("lists the affiliates that appear plus a Direct bucket", () => {
    render(<MasterOrders />);
    const trigger = screen.getByTestId("master-orders-affiliate");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toContain("Reaves Way Cabinet Shop");
    expect(options).toContain("Direct (no affiliate)");
  });
});
