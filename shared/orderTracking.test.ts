import { describe, expect, it } from "vitest";
import { buildCustomerOrderTimeline, orderVisibleToViewer, type OrderTrackingViewer } from "./orderTracking";

const customer: OrderTrackingViewer = {
  userId: 4,
  email: "ada@example.com",
  role: "user",
  affiliateId: null,
  affiliateCanSeeReferred: false,
};

describe("order visibility", () => {
  it("lets a customer see an order they placed or that uses their email", () => {
    expect(orderVisibleToViewer({ userId: 4, affiliateId: 9, originatorEmail: "other@example.com" }, customer)).toBe(true);
    expect(orderVisibleToViewer({ userId: 8, affiliateId: null, originatorEmail: "Ada@example.com" }, customer)).toBe(true);
    expect(orderVisibleToViewer({ userId: 8, affiliateId: 9, originatorEmail: "other@example.com" }, customer)).toBe(false);
  });

  it("lets an affiliate see referred orders only when CRM access allows it, plus their own", () => {
    const affiliate: OrderTrackingViewer = {
      userId: 3,
      email: "shop@example.com",
      role: "partner",
      affiliateId: 7,
      affiliateCanSeeReferred: true,
    };
    expect(orderVisibleToViewer({ userId: 90, affiliateId: 7, originatorEmail: "buyer@example.com" }, affiliate)).toBe(true);
    expect(orderVisibleToViewer({ userId: 3, affiliateId: null, originatorEmail: "shop@example.com" }, affiliate)).toBe(true);
    expect(orderVisibleToViewer({ userId: 90, affiliateId: 8, originatorEmail: "buyer@example.com" }, affiliate)).toBe(false);

    const noCrm = { ...affiliate, affiliateCanSeeReferred: false };
    expect(orderVisibleToViewer({ userId: 90, affiliateId: 7, originatorEmail: "buyer@example.com" }, noCrm)).toBe(false);
    expect(orderVisibleToViewer({ userId: 3, affiliateId: 8, originatorEmail: "other@example.com" }, noCrm)).toBe(true);
  });
});

describe("customer order timeline", () => {
  it("maps placed, distributor email, shipment, and the delivery signature", () => {
    const steps = buildCustomerOrderTimeline({
      status: "confirmed",
      createdAt: "2026-10-01T12:00:00.000Z",
      paidAt: "2026-10-01T12:05:00.000Z",
      distributorEmailStatus: "sent",
      distributorEmailSentAt: "2026-10-02T15:00:00.000Z",
      distributorEmailTo: "orders@mill.com",
      orderShippedAt: "2026-10-04T18:00:00.000Z",
      shipmentCarrier: "UPS",
      shipmentTracking: "1Z999",
      orderSignedAt: "2026-10-06T20:00:00.000Z",
      signerName: "Ada Lovelace",
    });
    expect(steps.map((step) => [step.key, step.label, step.done])).toEqual([
      ["placed", "Placed", true],
      ["sent_to_distributor", "Sent to distributor", true],
      ["shipped", "Shipped", true],
      ["delivered", "Delivered", true],
    ]);
    expect(steps[1].detail).toBe("orders@mill.com");
    expect(steps[2].detail).toContain("1Z999");
    expect(steps[3].detail).toBe("Ada Lovelace");
    expect(steps[0].at).toBe("2026-10-01T12:05:00.000Z");
  });

  it("leaves a draft unplaced", () => {
    const [placed] = buildCustomerOrderTimeline({ status: "draft", createdAt: "2026-10-01T12:00:00.000Z" });
    expect(placed.done).toBe(false);
    expect(placed.at).toBeNull();
  });
});
