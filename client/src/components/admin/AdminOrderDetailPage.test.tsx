// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const markShipped = vi.hoisted(() => vi.fn());
const markVerified = vi.hoisted(() => vi.fn());
const markSigned = vi.hoisted(() => vi.fn());
const sendOrderReceivedEmail = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ orders: { adminListWithPoSkus: { invalidate } } }),
    qbo: { syncOrder: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    orders: {
      confirm: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      resendDistributorEmail: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      markVerified: {
        useMutation: (options?: { onSuccess?: () => void }) => ({
          mutate: (input: unknown) => { markVerified(input); options?.onSuccess?.(); },
          isPending: false,
        }),
      },
      markShipped: { useMutation: (options?: { onSuccess?: () => void }) => ({ mutate: (input: unknown) => { markShipped(input); options?.onSuccess?.(); }, isPending: false }) },
      markSigned: {
        useMutation: (options?: { onSuccess?: () => void }) => ({
          mutate: (input: unknown) => { markSigned(input); options?.onSuccess?.(); },
          isPending: false,
        }),
      },
      adminMarkPaid: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      sendOrderReceivedEmail: {
        useMutation: (options?: { onSuccess?: (value: unknown) => void }) => ({
          mutate: (input: unknown) => {
            sendOrderReceivedEmail(input);
            options?.onSuccess?.({ sentTo: "tom@example.com", sentAt: "2026-11-06T12:00:00.000Z" });
          },
          isPending: false,
        }),
      },
      orderEvents: { useQuery: () => ({ data: [], isLoading: false }) },
    },
  },
}));

import AdminOrderDetailPage from "./AdminOrderDetailPage";
import type { AdminOrderRow } from "@/lib/adminOrderRow";

/**
 * CD-20261022-OLOUT as the admin page receives it: the stored distributor cost
 * ($284.39) and customer price ($449.34) are both on the line, with $47.00
 * shipping and $24.40 tax on the order.
 */
function order(overrides: Partial<AdminOrderRow> = {}): AdminOrderRow {
  return {
    id: 18,
    requestNumber: "CD-20261022-OLOUT",
    originatorName: "Tom Reaves",
    originatorEmail: "tom@example.com",
    originatorPhone: "555-0100",
    customerName: "Tom Reaves",
    status: "confirmed",
    tier: "Dealer",
    styleName: "Carmel Shaker",
    distributorName: "Ashford",
    totalAmount: "449.34",
    taxAmount: "24.40",
    shippingAmount: "47.00",
    invoiceTotal: "520.74",
    itemCount: 1,
    notes: null,
    createdAt: new Date("2026-10-22T12:00:00.000Z"),
    orderVerifiedAt: "2026-10-28T12:00:00.000Z",
    lineItems: [{
      cabinetId: 1,
      masterCode: "3DB18",
      description: '18" 3 Drawer Base Cabinet',
      qty: 1,
      unitPrice: 449.34,
      linePrice: 449.34,
      distributorUnitCost: 284.39,
      distributorLineCost: 284.39,
      colorFinish: "Terra Shaker (Ashford)",
      matched: true,
      // Stored the way the bug left it: the CS prefix repeated three times.
      poSku: "cs-cs-cs-db18",
    }],
    ...overrides,
  } as AdminOrderRow;
}

let confirmSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  confirmSpy = vi.fn(() => true);
  vi.spyOn(window, "confirm").mockImplementation(confirmSpy as unknown as (message?: string) => boolean);
});

afterEach(() => {
  cleanup();
  markShipped.mockReset();
  markVerified.mockReset();
  markSigned.mockReset();
  sendOrderReceivedEmail.mockReset();
  invalidate.mockReset();
  confirmSpy.mockRestore();
});

describe("full-page admin order view", () => {
  it("renders the whole order on one page instead of a dialog", () => {
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    const page = screen.getByTestId("admin-order-full-page");
    expect(page.className).toContain("min-h-[100dvh]");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(page).getByTestId("admin-order-stripe-breakdown")).toBeTruthy();
    // The stored SKU has the prefix repeated; the page shows it repaired.
    expect(within(page).getByText("cs-db18")).toBeTruthy();
    expect(within(page).queryByText("cs-cs-cs-db18")).toBeNull();
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

describe("admin order PO view prices", () => {
  it("shows unit price, line total, subtotal, shipping, tax and the corrected total", () => {
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    const po = screen.getByTestId("admin-order-po-view");
    expect(within(po).getByTestId("admin-order-po-unit-0").textContent).toBe("$284.39");
    expect(within(po).getByTestId("admin-order-po-line-total-0").textContent).toBe("$284.39");
    expect(within(po).getByTestId("admin-order-po-summary-subtotal").textContent).toContain("$284.39");
    expect(within(po).getByTestId("admin-order-po-summary-shipping").textContent).toContain("$47.00");
    expect(within(po).getByTestId("admin-order-po-summary-tax").textContent).toContain("$24.40");
    expect(within(po).getByTestId("admin-order-po-summary-total").textContent).toContain("$355.79");
    expect(within(po).queryByTestId("admin-order-po-pricing-warning")).toBeNull();
  });

  it("shows the customer price nowhere on the distributor PO", () => {
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    const po = screen.getByTestId("admin-order-po-view");
    expect(po.textContent).not.toContain("449.34");
    expect(within(po).getByTestId("admin-order-po-basis").textContent).toContain("distributor cost");
  });

  it("says the total is wrong when a line carries no price, instead of hiding it", () => {
    render(<AdminOrderDetailPage order={order({
      lineItems: [{
        cabinetId: 1,
        masterCode: "3DB18",
        description: '18" 3 Drawer Base Cabinet',
        qty: 1,
        unitPrice: null,
        linePrice: null,
        matched: true,
        poSku: "cs-cs-db18",
      }],
    })} onBack={vi.fn()} />);
    const po = screen.getByTestId("admin-order-po-view");
    expect(within(po).getByTestId("admin-order-po-line-unpriced")).toBeTruthy();
    expect(within(po).getByTestId("admin-order-po-pricing-warning").textContent).toContain("1 line has no price");
    // The old behaviour: $47.00 + $24.40 = $71.40 with no cabinet value at all.
    expect(within(po).getByTestId("admin-order-po-summary-total").textContent).toContain("$71.40");
  });

  it("falls back to the customer price and flags it when no cost is stored", () => {
    render(<AdminOrderDetailPage order={order({
      lineItems: [{
        cabinetId: 1,
        masterCode: "3DB18",
        description: '18" 3 Drawer Base Cabinet',
        qty: 1,
        unitPrice: 449.34,
        linePrice: 449.34,
        matched: true,
        poSku: "cs-cs-db18",
      }],
    })} onBack={vi.fn()} />);
    const po = screen.getByTestId("admin-order-po-view");
    expect(within(po).getByTestId("admin-order-po-unit-0").textContent).toBe("$449.34");
    expect(within(po).getByTestId("admin-order-po-basis").textContent).toContain("customer price");
  });
});

describe("clickable order status trail", () => {
  it("marks the order verified after confirming, and that sends the thank-you email", () => {
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    const verify = screen.getByTestId("order-step-action-verified");
    expect(verify.textContent).toContain("Mark Order verified");
    fireEvent.click(verify);
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(confirmSpy.mock.calls[0][0]).toContain("thank-you");
    expect(markVerified).toHaveBeenCalledWith({ id: 18 });
  });

  it("does nothing when the administrator cancels the confirmation", () => {
    confirmSpy.mockReturnValue(false);
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId("order-step-action-verified"));
    expect(markVerified).not.toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalledOnce();
  });

  it("warns that the order is already verified before stamping it again", () => {
    render(<AdminOrderDetailPage order={order({ orderVerifiedAt: "2026-10-28T12:00:00.000Z" })} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId("order-step-action-verified"));
    expect(confirmSpy.mock.calls[0][0]).toContain("already verified");
  });

  it("keeps shipped locked until the order is verified", () => {
    render(<AdminOrderDetailPage order={order({ orderVerifiedAt: null })} onBack={vi.fn()} />);
    const shipped = screen.getByTestId("order-step-action-shipped") as HTMLButtonElement;
    expect(shipped.disabled).toBe(true);
    fireEvent.click(shipped);
    expect(markShipped).not.toHaveBeenCalled();
    expect(screen.getByTestId("order-step-shipped").textContent).toContain("Verify the order first.");
  });

  it("marks shipped from the trail once verified", () => {
    render(<AdminOrderDetailPage order={order({ orderVerifiedAt: "2026-10-28T12:00:00.000Z" })} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId("order-step-action-shipped"));
    expect(confirmSpy.mock.calls[0][0]).toContain("Mark order CD-20261022-OLOUT shipped");
    expect(markShipped).toHaveBeenCalledWith({ id: 18, carrier: undefined, tracking: undefined });
  });

  it("keeps signed locked until the order has shipped, then marks it", () => {
    const { unmount } = render(<AdminOrderDetailPage order={order({ orderVerifiedAt: "2026-10-28T12:00:00.000Z" })} onBack={vi.fn()} />);
    expect((screen.getByTestId("order-step-action-signed") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("order-step-signed").textContent).toContain("Mark the order shipped first.");
    unmount();

    render(<AdminOrderDetailPage order={order({
      orderVerifiedAt: "2026-10-28T12:00:00.000Z",
      orderShippedAt: "2026-11-02T15:00:00.000Z",
      shipmentCarrier: "FedEx",
      shipmentTracking: "1Z999AA10123456784",
    })} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId("order-step-action-signed"));
    expect(markSigned).toHaveBeenCalledWith({ id: 18, signerName: undefined });
  });

  it("does not make the email step clickable", () => {
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    expect(screen.queryByTestId("order-step-action-email_sent")).toBeNull();
  });
});

describe("send order received email", () => {
  it("sits beside the receipt status and asks before sending", () => {
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    const button = screen.getByTestId("admin-order-send-received-email");
    expect(button.textContent).toContain("Send order received email");
    fireEvent.click(button);
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(confirmSpy.mock.calls[0][0]).toContain("Tom Reaves");
    expect(sendOrderReceivedEmail).toHaveBeenCalledWith({ id: 18 });
  });

  it("does not send when the confirmation is cancelled", () => {
    confirmSpy.mockReturnValue(false);
    render(<AdminOrderDetailPage order={order()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId("admin-order-send-received-email"));
    expect(sendOrderReceivedEmail).not.toHaveBeenCalled();
  });

  it("shows the sent timestamp and asks again before a second send", () => {
    render(<AdminOrderDetailPage order={order({ orderReceivedEmailSentAt: "2026-11-05T18:47:41.000Z", orderReceivedEmailTo: "tom@example.com" })} onBack={vi.fn()} />);
    const sent = screen.getByTestId("admin-order-received-email-sent");
    expect(sent.textContent).toContain("to tom@example.com");
    const button = screen.getByTestId("admin-order-send-received-email");
    expect(button.textContent).toContain("again");
    fireEvent.click(button);
    expect(confirmSpy.mock.calls[0][0]).toContain("already sent");
  });

  it("keeps the received note separate from the verified note", () => {
    render(<AdminOrderDetailPage order={order({ orderReceivedEmailSentAt: "2026-11-05T18:47:41.000Z", orderVerifiedAt: null })} onBack={vi.fn()} />);
    // The verified step is still waiting: only the verified action can stamp it.
    expect(screen.getByTestId("order-step-verified").getAttribute("data-done")).toBe("false");
    expect(screen.getByTestId("admin-order-received-email-sent")).toBeTruthy();
  });
});

describe("status attribution on the order page", () => {
  it("shows who verified, shipped and signed, with the CT time", () => {
    render(<AdminOrderDetailPage order={order({
      orderVerifiedAt: "2026-11-05T19:02:00.000Z",
      orderVerifiedBy: "Selena Ortiz <selena@cabinetdealz.com>",
      orderShippedAt: "2026-11-06T18:00:00.000Z",
      orderShippedBy: "Rick Alvarez <rick@cabinetdealz.com>",
      orderSignedAt: "2026-11-08T19:00:00.000Z",
      orderSignedBy: "Rick Alvarez <rick@cabinetdealz.com>",
    })} onBack={vi.fn()} />);
    expect(screen.getByTestId("admin-order-actor-verified").textContent)
      .toBe("Verified by Selena Ortiz · Nov 5, 2026, 1:02 PM CT");
    expect(screen.getByTestId("admin-order-actor-shipped").textContent)
      .toContain("Shipped by Rick Alvarez");
    expect(screen.getByTestId("admin-order-actor-signed").textContent)
      .toContain("Signed by Rick Alvarez");
  });

  it("keeps the email address in the tooltip", () => {
    render(<AdminOrderDetailPage order={order({
      orderVerifiedAt: "2026-11-05T19:02:00.000Z",
      orderVerifiedBy: "Selena Ortiz <selena@cabinetdealz.com>",
    })} onBack={vi.fn()} />);
    expect(screen.getByTestId("admin-order-actor-verified").getAttribute("title"))
      .toBe("Selena Ortiz · selena@cabinetdealz.com");
  });

  it("says waiting for a step that has not happened", () => {
    render(<AdminOrderDetailPage order={order({ orderVerifiedAt: null })} onBack={vi.fn()} />);
    expect(screen.getByTestId("admin-order-actor-verified").textContent).toContain("waiting");
  });

  it("shows who emailed the distributor", () => {
    render(<AdminOrderDetailPage order={order({
      distributorEmailSentAt: "2026-11-05T19:05:00.000Z",
      distributorEmailSentBy: "Selena Ortiz <selena@cabinetdealz.com>",
    })} onBack={vi.fn()} />);
    expect(screen.getByTestId("admin-order-actor-distributor-email").textContent)
      .toContain("Distributor emailed by Selena Ortiz");
  });

  it("renders the activity timeline", () => {
    render(<AdminOrderDetailPage order={order({
      orderVerifiedAt: "2026-11-05T19:02:00.000Z",
      orderVerifiedBy: "Selena Ortiz <selena@cabinetdealz.com>",
    })} onBack={vi.fn()} />);
    expect(screen.getByTestId("order-activity-timeline")).toBeTruthy();
    expect(screen.getByTestId("order-activity-verified").textContent).toContain("Selena Ortiz approved the order");
    expect(screen.getByTestId("order-activity-purchased").textContent).toContain("Tom Reaves bought cabinets");
  });
});
