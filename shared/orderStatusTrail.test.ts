import { describe, expect, it } from "vitest";
import { buildOrderStatusTrail } from "./orderStatusTrail";

describe("order status trail", () => {
  it("shows email sent from the distributor email stamp and address", () => {
    const steps = buildOrderStatusTrail({
      distributorEmailStatus: "sent",
      distributorEmailSentAt: "2026-10-27T15:04:00.000Z",
      distributorEmailTo: "orders@mill.com",
    });
    expect(steps.map((step) => step.label)).toEqual([
      "Email sent",
      "Order verified",
      "Order shipped",
      "Order signed",
    ]);
    expect(steps[0]).toMatchObject({ done: true, at: "2026-10-27T15:04:00.000Z", detail: "orders@mill.com" });
    expect(steps.slice(1).every((step) => !step.done)).toBe(true);
  });

  it("explains a missing distributor email without marking the step done", () => {
    const [email] = buildOrderStatusTrail({ distributorEmailStatus: "no_email" });
    expect(email.done).toBe(false);
    expect(email.detail).toBe("No order email set");
  });

  it("uses a shipment row when the order shipped columns are empty", () => {
    const steps = buildOrderStatusTrail({
      shipments: [{ status: "shipped", shippedAt: "2026-10-27T18:00:00.000Z", carrier: "UPS", trackingNumber: "1Z999", shippedBy: "Vendor dist:4" }],
    });
    expect(steps[2]).toMatchObject({ done: true, actor: "Vendor dist:4", detail: "UPS · 1Z999" });
  });

  it("marks signed from a delivery signature even without a manual stamp", () => {
    const steps = buildOrderStatusTrail({
      shipments: [{ status: "shipped", shippedAt: "2026-10-27T18:00:00.000Z", deliveredWithSignature: true, signatureName: "A. Rivera" }],
    });
    expect(steps[3]).toMatchObject({ done: true, actor: "Delivery signature", detail: "A. Rivera" });
  });

  it("keeps the verifier and signer names on the completed steps", () => {
    const steps = buildOrderStatusTrail({
      orderVerifiedAt: "2026-10-27T16:00:00.000Z",
      orderVerifiedBy: "Dana Admin",
      orderSignedAt: "2026-10-28T12:00:00.000Z",
      orderSignedBy: "Dana Admin",
      signerName: "Jamie Carter",
    });
    expect(steps[1]).toMatchObject({ done: true, actor: "Dana Admin" });
    expect(steps[3]).toMatchObject({ done: true, actor: "Dana Admin", detail: "Jamie Carter" });
  });
});
