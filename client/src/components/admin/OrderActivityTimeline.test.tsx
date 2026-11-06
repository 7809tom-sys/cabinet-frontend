// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import OrderActivityTimeline from "./OrderActivityTimeline";
import type { OrderTimelineSource } from "@/lib/orderTimeline";

afterEach(cleanup);

const order: OrderTimelineSource = {
  id: 18,
  requestNumber: "CD-20261022-OLOUT",
  customerName: "Tom Reaves",
  originatorEmail: "tom@example.com",
  createdAt: "2026-11-06T00:40:00.000Z",
  orderReceivedEmailSentAt: "2026-11-06T00:45:00.000Z",
  orderReceivedEmailTo: "tom@example.com",
  distributorEmailSentAt: "2026-11-06T01:05:00.000Z",
  distributorEmailSentBy: "Selena Ortiz <selena@cabinetdealz.com>",
  distributorEmailTo: "orders@ashford.com",
  orderVerifiedAt: "2026-11-06T01:02:00.000Z",
  orderVerifiedBy: "Selena Ortiz <selena@cabinetdealz.com>",
  orderShippedAt: "2026-11-06T18:00:00.000Z",
  orderShippedBy: "Rick Alvarez <rick@cabinetdealz.com>",
  shipmentCarrier: "FedEx",
  shipmentTracking: "1Z999",
  orderSignedAt: "2026-11-08T19:00:00.000Z",
  orderSignedBy: "Rick Alvarez <rick@cabinetdealz.com>",
  signerName: "Tom Reaves",
};

describe("order activity timeline", () => {
  it("lists each action as a plain sentence with a named actor and a CT time", () => {
    render(<OrderActivityTimeline order={order} />);
    const purchased = screen.getByTestId("order-activity-purchased");
    expect(purchased.textContent).toContain("Tom Reaves");
    expect(purchased.textContent).toContain("bought cabinets");
    expect(purchased.textContent).toContain("Nov 5, 2026, 6:40 PM CT");
  });

  it("shows the verified and distributor lines with the admin's name", () => {
    render(<OrderActivityTimeline order={order} />);
    expect(screen.getByTestId("order-activity-verified").textContent).toContain("Selena Ortiz approved the order");
    expect(screen.getByTestId("order-activity-distributor_emailed").textContent).toContain("Selena Ortiz sent the order to the distributor");
    expect(screen.getByTestId("order-activity-distributor_emailed").textContent).toContain("orders@ashford.com");
  });

  it("shows shipped with the carrier and signed with who signed", () => {
    render(<OrderActivityTimeline order={order} />);
    expect(screen.getByTestId("order-activity-shipped").textContent).toContain("Rick Alvarez shipped the order (FedEx · 1Z999)");
    expect(screen.getByTestId("order-activity-signed").textContent).toContain("recorded delivery signed for by Tom Reaves");
  });

  it("marks derived lines so nobody mistakes a backfill for a logged action", () => {
    render(<OrderActivityTimeline order={order} />);
    expect(within(screen.getByTestId("order-activity-verified")).getByTestId("order-activity-derived")).toBeTruthy();
  });

  it("shows logged events from the append-only table, including a resend", () => {
    render(<OrderActivityTimeline
      order={order}
      events={[
        { id: 1, orderRequestId: 18, action: "distributor_email_resent", actorName: "Selena Ortiz", detail: "orders@ashford.com", createdAt: "2026-11-06T03:00:00.000Z" },
      ]}
    />);
    const resent = screen.getByTestId("order-activity-distributor_email_resent");
    expect(resent.textContent).toContain("Selena Ortiz resent the order to the distributor");
  });

  it("says System for an automatic action", () => {
    render(<OrderActivityTimeline order={order} />);
    expect(screen.getByTestId("order-activity-order_received_email").textContent).toContain("System");
  });

  it("says Customer when the buyer has no name", () => {
    render(<OrderActivityTimeline order={{ ...order, customerName: null, originatorEmail: null }} />);
    expect(screen.getByTestId("order-activity-purchased").textContent).toContain("Customer bought cabinets");
  });

  it("explains an empty timeline", () => {
    render(<OrderActivityTimeline order={{ id: 2 }} />);
    expect(screen.getByTestId("order-activity-empty").textContent).toContain("Nothing has happened on this order yet");
  });

  it("does not show the empty message while it is still loading", () => {
    render(<OrderActivityTimeline order={{ id: 2 }} loading />);
    expect(screen.queryByTestId("order-activity-empty")).toBeNull();
    expect(screen.getByTestId("order-activity-loading")).toBeTruthy();
  });

  it("groups the lines by day", () => {
    render(<OrderActivityTimeline order={order} />);
    const days = screen.getAllByText(/^(Thursday|Friday|Sunday),/);
    expect(days.length).toBeGreaterThan(1);
  });
});
