import { describe, expect, it } from "vitest";
import {
  actorFromStoredLabel,
  backfillOrderEvents,
  buildOrderTimeline,
  groupTimelineByDay,
  orderEventText,
  resolveActorName,
  resolveCustomerName,
  sortTimeline,
  type OrderEventRecord,
  type OrderTimelineSource,
} from "./orderTimeline";

const order: OrderTimelineSource = {
  id: 18,
  requestNumber: "CD-20261022-OLOUT",
  customerName: "Tom Reaves",
  originatorEmail: "tom@example.com",
  createdAt: "2026-11-06T00:40:00.000Z", // Nov 5, 6:40 PM CST
  orderReceivedEmailSentAt: "2026-11-06T00:45:00.000Z",
  orderReceivedEmailTo: "tom@example.com",
  distributorEmailStatus: "sent",
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

describe("actor names", () => {
  it("prefers the display name, then the email, then the fallback", () => {
    expect(resolveActorName("Selena Ortiz", "selena@cabinetdealz.com")).toBe("Selena Ortiz");
    expect(resolveActorName(null, "selena@cabinetdealz.com")).toBe("selena@cabinetdealz.com");
    expect(resolveActorName("  ", "  ")).toBe("System");
  });

  it("calls the buyer Customer when we know nothing", () => {
    expect(resolveCustomerName(null, null)).toBe("Customer");
    expect(resolveCustomerName(null, "tom@example.com")).toBe("tom@example.com");
    expect(resolveCustomerName("Tom Reaves", null)).toBe("Tom Reaves");
  });

  it("reduces a stored 'Name <email>' label to the name", () => {
    expect(actorFromStoredLabel("Selena Ortiz <selena@cabinetdealz.com>")).toBe("Selena Ortiz");
    expect(actorFromStoredLabel("<selena@cabinetdealz.com>")).toBe("selena@cabinetdealz.com");
    expect(actorFromStoredLabel("Selena Ortiz")).toBe("Selena Ortiz");
    expect(actorFromStoredLabel(null)).toBe("System");
  });
});

describe("event wording", () => {
  it("uses plain sentences with the specifics in parentheses", () => {
    expect(orderEventText("purchased")).toBe("bought cabinets");
    expect(orderEventText("verified")).toBe("approved the order");
    expect(orderEventText("distributor_emailed", "orders@ashford.com")).toBe("sent the order to the distributor (orders@ashford.com)");
    expect(orderEventText("distributor_email_resent", "orders@ashford.com")).toBe("resent the order to the distributor (orders@ashford.com)");
    expect(orderEventText("shipped", "FedEx · 1Z999")).toBe("shipped the order (FedEx · 1Z999)");
    expect(orderEventText("signed", "Tom Reaves")).toBe("recorded delivery signed for by Tom Reaves");
    expect(orderEventText("order_received_email", "tom@example.com")).toBe("sent the order received email to tom@example.com");
    expect(orderEventText("receipt_sent", "tom@example.com")).toBe("sent the receipt to tom@example.com");
  });

  it("still says something for an unknown action", () => {
    expect(orderEventText("refunded", "card")).toBe("refunded (card)");
  });
});

describe("derived timeline for an order that predates the log", () => {
  const entries = backfillOrderEvents(order);

  it("writes the example sentences in Central time", () => {
    const sentences = entries.map((entry) => entry.sentence);
    expect(sentences).toContain("Tom Reaves bought cabinets · Nov 5, 2026, 6:40 PM CT");
    expect(sentences).toContain("Selena Ortiz approved the order · Nov 5, 2026, 7:02 PM CT");
    expect(sentences).toContain("Selena Ortiz sent the order to the distributor (orders@ashford.com) · Nov 5, 2026, 7:05 PM CT");
  });

  it("names the actor on every line", () => {
    expect(entries.every((entry) => entry.actor.trim().length > 0)).toBe(true);
  });

  it("covers received email, verified, shipped and signed", () => {
    expect(entries.map((entry) => entry.action)).toEqual([
      "purchased", "order_received_email", "distributor_emailed", "verified", "shipped", "signed",
    ]);
  });

  it("marks every derived line as derived", () => {
    expect(entries.every((entry) => entry.derived)).toBe(true);
  });

  it("says System for the automatic emails", () => {
    const received = entries.find((entry) => entry.action === "order_received_email");
    expect(received?.actor).toBe("System");
  });

  it("carries carrier and tracking on the shipped line", () => {
    const shipped = entries.find((entry) => entry.action === "shipped");
    expect(shipped?.text).toBe("shipped the order (FedEx · 1Z999)");
  });

  it("uses the payment moment for 'bought cabinets' when the card cleared later", () => {
    const paid = backfillOrderEvents({ ...order, paidAt: "2026-11-06T00:55:00.000Z" });
    const purchased = paid.find((entry) => entry.action === "purchased");
    expect(purchased?.at).toBe("2026-11-06T00:55:00.000Z");
    expect(paid.filter((entry) => entry.action === "purchased")).toHaveLength(1);
  });

  it("produces nothing for an order with no activity beyond creation", () => {
    expect(backfillOrderEvents({ id: 1, createdAt: null })).toEqual([]);
  });
});

describe("logged timeline", () => {
  const events: OrderEventRecord[] = [
    { id: 1, orderRequestId: 18, action: "purchased", actorName: "Tom Reaves", createdAt: "2026-11-06T00:40:00.000Z" },
    { id: 2, orderRequestId: 18, action: "verified", actorName: "Selena Ortiz", createdAt: "2026-11-06T01:02:00.000Z" },
    { id: 3, orderRequestId: 18, action: "distributor_email_resent", actorName: "Selena Ortiz", detail: "orders@ashford.com", createdAt: "2026-11-06T02:00:00.000Z" },
  ];

  it("shows every logged action, including a repeat", () => {
    const timeline = buildOrderTimeline({ ...order, distributorEmailSentAt: null }, events);
    const actions = timeline.map((entry) => entry.action);
    expect(actions).toContain("distributor_email_resent");
    expect(timeline.filter((entry) => entry.action === "distributor_email_resent")).toHaveLength(1);
  });

  it("does not repeat a step the log already covers", () => {
    const timeline = buildOrderTimeline(order, events);
    expect(timeline.filter((entry) => entry.action === "verified")).toHaveLength(1);
    expect(timeline.filter((entry) => entry.action === "purchased")).toHaveLength(1);
    expect(timeline.find((entry) => entry.action === "verified")?.derived).toBe(false);
  });

  it("falls back to a derived line only for steps the log is missing", () => {
    const timeline = buildOrderTimeline(order, events);
    expect(timeline.find((entry) => entry.action === "shipped")?.derived).toBe(true);
    expect(timeline.find((entry) => entry.action === "signed")?.derived).toBe(true);
  });

  it("ignores events belonging to another order", () => {
    const timeline = buildOrderTimeline({ ...order }, [{ id: 9, orderRequestId: 99, action: "verified", actorName: "Someone", createdAt: "2026-11-06T01:00:00.000Z" }]);
    expect(timeline.some((entry) => entry.actor === "Someone")).toBe(false);
  });

  it("names System when a logged event has no actor", () => {
    const timeline = buildOrderTimeline({ ...order }, [{ id: 5, orderRequestId: 18, action: "receipt_sent", actorName: null, createdAt: "2026-11-06T03:00:00.000Z" }]);
    expect(timeline.find((entry) => entry.action === "receipt_sent")?.actor).toBe("System");
  });

  it("attributes an unnamed purchase to the customer, not System", () => {
    const timeline = buildOrderTimeline({ ...order }, [{ id: 6, orderRequestId: 18, action: "purchased", actorName: null, createdAt: "2026-11-06T00:40:00.000Z" }]);
    expect(timeline.find((entry) => entry.action === "purchased")?.actor).toBe("Tom Reaves");
  });
});

describe("ordering and grouping", () => {
  const entries = backfillOrderEvents(order);

  it("reads oldest first", () => {
    const sorted = sortTimeline(entries);
    const times = sorted.map((entry) => Date.parse(entry.at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("groups by Central calendar day", () => {
    const groups = groupTimelineByDay(entries);
    expect(groups.length).toBeGreaterThan(1);
    expect(groups[0].day).toContain("Nov");
    expect(groups.flatMap((group) => group.entries)).toHaveLength(entries.length);
  });

  it("shows a fully empty order as an empty timeline", () => {
    expect(buildOrderTimeline({ id: 2 })).toEqual([]);
  });
});
