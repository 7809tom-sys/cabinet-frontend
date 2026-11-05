// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const markShipped = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ orders: { adminListWithPoSkus: { invalidate } } }),
    qbo: { syncOrder: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    orders: {
      confirm: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      resendDistributorEmail: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      markVerified: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      markShipped: { useMutation: (options?: { onSuccess?: () => void }) => ({ mutate: (input: unknown) => { markShipped(input); options?.onSuccess?.(); }, isPending: false }) },
      markSigned: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      adminMarkPaid: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import AdminOrderDetailPage from "./AdminOrderDetailPage";
import type { AdminOrderRow } from "@/lib/adminOrderRow";

function order(overrides: Partial<AdminOrderRow> = {}): AdminOrderRow {
  return {
    id: 18,
    requestNumber: "CD-3DB18",
    originatorName: "Jamie Carter",
    originatorEmail: "jamie@example.com",
    originatorPhone: "555-0100",
    customerName: "Jamie Carter",
    status: "confirmed",
    tier: "Homeowner",
    styleName: "Shaker",
    totalAmount: "449.00",
    taxAmount: "24.00",
    shippingAmount: "47.00",
    invoiceTotal: "520.00",
    itemCount: 1,
    notes: null,
    createdAt: new Date("2026-10-27T12:00:00.000Z"),
    orderVerifiedAt: "2026-10-28T12:00:00.000Z",
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
  } as AdminOrderRow;
}

afterEach(() => {
  cleanup();
  markShipped.mockReset();
  invalidate.mockReset();
});

describe("full-page admin order view", () => {
  it("renders the whole order on one page instead of a dialog", () => {
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    const page = screen.getByTestId("admin-order-full-page");
    expect(page.className).toContain("min-h-[100dvh]");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(page).getByTestId("admin-order-stripe-breakdown")).toBeTruthy();
    expect(within(page).getByText("usd-sw-3db18")).toBeTruthy();
  });

  it("offers the four carriers plus any carrier already saved on the order", () => {
    render(<AdminOrderDetailPage order={order({ shipmentCarrier: "UPS", shipmentTracking: "1Z999" })} onBack={vi.fn()} />);
    const trigger = screen.getByTestId("admin-order-carrier");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(["FedEx", "Skyline", "Worldwide Express", "US Cabinet Depot", "UPS"]));
  });

  it("accepts typing in the tracking input and saves it through markShipped", () => {
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    const tracking = screen.getByTestId("admin-order-tracking") as HTMLInputElement;
    expect(tracking.disabled).toBe(false);
    fireEvent.change(tracking, { target: { value: "1Z999AA10123456784" } });
    expect(tracking.value).toBe("1Z999AA10123456784");
    fireEvent.click(screen.getByTestId("admin-order-save-shipment"));
    expect(markShipped).toHaveBeenCalledWith({ id: 18, carrier: undefined, tracking: "1Z999AA10123456784" });
  });

  it("keeps the fields locked until the order is verified, then editable after it ships", () => {
    const { unmount } = render(<AdminOrderDetailPage order={order({ orderVerifiedAt: null })} onBack={vi.fn()} />);
    expect((screen.getByTestId("admin-order-tracking") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId("admin-order-shipment-locked")).toBeTruthy();
    unmount();

    render(<AdminOrderDetailPage order={order({ orderShippedAt: "2026-11-02T15:00:00.000Z", shipmentCarrier: "Skyline", shipmentTracking: "SK-1" })} onBack={vi.fn()} />);
    const tracking = screen.getByTestId("admin-order-tracking") as HTMLInputElement;
    expect(tracking.disabled).toBe(false);
    expect(tracking.value).toBe("SK-1");
    expect(screen.getByTestId("admin-order-save-shipment").textContent).toContain("Save shipment details");
  });

  it("prompts for the pallet photo after the order is marked shipped and allows skipping", () => {
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    expect(screen.queryByTestId("pallet-photo-prompt")).toBeNull();
    fireEvent.change(screen.getByTestId("admin-order-tracking"), { target: { value: "1Z999AA10123456784" } });
    fireEvent.click(screen.getByTestId("admin-order-save-shipment"));
    const prompt = screen.getByTestId("pallet-photo-prompt");
    expect(within(prompt).getByTestId("pallet-photo-camera-input").getAttribute("capture")).toBe("environment");
    expect(within(prompt).getByTestId("pallet-photo-camera-input").getAttribute("accept")).toBe("image/*");
    fireEvent.click(within(prompt).getByTestId("pallet-photo-skip"));
    expect(screen.queryByTestId("pallet-photo-prompt")).toBeNull();
  });

  it("shows the saved tracking with a carrier link only when the URL format already exists", () => {
    const { unmount } = render(
      <AdminOrderDetailPage order={order({ orderShippedAt: "2026-11-02T15:00:00.000Z", shipmentCarrier: "FedEx", shipmentTracking: "1Z999AA10123456784" })} onBack={vi.fn()} />,
    );
    const link = within(screen.getByTestId("admin-order-saved-tracking")).getByRole("link");
    expect(link.getAttribute("href")).toBe("https://www.fedex.com/fedextrack/?trknbr=1Z999AA10123456784");
    unmount();

    render(
      <AdminOrderDetailPage order={order({ orderShippedAt: "2026-11-02T15:00:00.000Z", shipmentCarrier: "Skyline", shipmentTracking: "SK-4417" })} onBack={vi.fn()} />,
    );
    const saved = screen.getByTestId("admin-order-saved-tracking");
    expect(saved.textContent).toContain("SK-4417");
    expect(within(saved).queryByRole("link")).toBeNull();
  });

  it("labels the tracking field as the order number for US Cabinet Depot", () => {
    render(<AdminOrderDetailPage order={order({ shipmentCarrier: "US Cabinet Depot" })} onBack={vi.fn()} />);
    expect(screen.getByText("Order number", { selector: "label" })).toBeTruthy();
  });
});
