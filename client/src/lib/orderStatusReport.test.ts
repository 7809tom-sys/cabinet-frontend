import { describe, expect, it } from "vitest";
import {
  DIRECT_ONLY_AFFILIATE,
  buildOrderStatusRow,
  buildOrderStatusSteps,
  countOrderStatuses,
  filterOrderStatusRows,
  furthestStep,
  isOrderStuck,
  orderStatusBucket,
  orderStatusDistributors,
  orderStatusStepCaption,
  nextMasterOrderSort,
  orderStatusAffiliates,
  paginateMasterOrders,
  reportOrderTotalCents,
  sortMasterOrders,
  type OrderStatusSource,
} from "./orderStatusReport";

const NOW = new Date("2026-11-06T15:00:00.000Z");

function order(overrides: Partial<OrderStatusSource> = {}): OrderStatusSource {
  return {
    id: 18,
    requestNumber: "CD-20261022-OLOUT",
    customerName: "Tom Reaves",
    originatorEmail: "tom@example.com",
    distributorName: "Ashford",
    createdAt: "2026-10-22T12:00:00.000Z",
    totalAmount: "449.34",
    invoiceTotal: "520.74",
    taxAmount: "24.40",
    shippingAmount: "47.00",
    deliveryMethod: "ship",
    lineItems: [{ unitPrice: 449.34, linePrice: 449.34, qty: 1 }],
    ...overrides,
  };
}

const fullyDone: Partial<OrderStatusSource> = {
  orderReceivedEmailSentAt: "2026-10-22T13:00:00.000Z",
  orderReceivedEmailTo: "tom@example.com",
  distributorEmailStatus: "sent",
  distributorEmailSentAt: "2026-10-22T14:00:00.000Z",
  distributorEmailSentBy: "Dana Reaves <dana@cabinetdealz.com>",
  distributorEmailTo: "orders@ashford.com",
  orderVerifiedAt: "2026-10-24T15:00:00.000Z",
  orderVerifiedBy: "Dana Reaves <dana@cabinetdealz.com>",
  orderShippedAt: "2026-10-28T16:00:00.000Z",
  orderShippedBy: "Rick Alvarez <rick@cabinetdealz.com>",
  shipmentCarrier: "FedEx",
  shipmentTracking: "1Z999",
  orderSignedAt: "2026-11-02T17:00:00.000Z",
  orderSignedBy: "Rick Alvarez <rick@cabinetdealz.com>",
  signerName: "Tom Reaves",
};

describe("order status chain", () => {
  it("has five steps in order", () => {
    const steps = buildOrderStatusSteps(order());
    expect(steps.map((step) => step.key)).toEqual([
      "order_received_email", "distributor_email", "verified", "shipped", "signed",
    ]);
    expect(steps.every((step) => !step.done)).toBe(true);
    expect(furthestStep(steps)).toBe("none");
  });

  it("records who and when for every step that has happened", () => {
    const steps = buildOrderStatusSteps(order(fullyDone));
    expect(steps.every((step) => step.done)).toBe(true);
    const by = Object.fromEntries(steps.map((step) => [step.key, step.by]));
    expect(by.verified).toBe("Dana Reaves");
    expect(by.distributor_email).toBe("Dana Reaves <dana@cabinetdealz.com>");
    expect(by.shipped).toBe("Rick Alvarez");
    expect(by.signed).toBe("Rick Alvarez");
    expect(steps.find((step) => step.key === "signed")?.detail).toBe("Tom Reaves");
    expect(furthestStep(steps)).toBe("signed");
  });

  it("shows carrier and tracking on the shipped step", () => {
    const shipped = buildOrderStatusSteps(order(fullyDone)).find((step) => step.key === "shipped");
    expect(shipped?.detail).toBe("FedEx · 1Z999");
  });

  it("measures furthest by chain order, not by timestamp", () => {
    // Shipped stamped but never verified: still stops at shipped, not signed.
    const steps = buildOrderStatusSteps(order({
      orderShippedAt: "2026-10-28T16:00:00.000Z",
      orderSignedAt: "2026-10-29T16:00:00.000Z",
    }));
    expect(furthestStep(steps)).toBe("signed");
    const verifiedMissing = buildOrderStatusSteps(order({ orderVerifiedAt: null, orderShippedAt: "2026-10-28T16:00:00.000Z" }));
    expect(verifiedMissing.find((step) => step.key === "verified")?.done).toBe(false);
  });

  it("writes a caption for done and waiting steps", () => {
    expect(orderStatusStepCaption({ key: "verified", label: "Order verified", done: false, at: null, by: null, detail: null })).toBe("Waiting");
    expect(orderStatusStepCaption({
      key: "verified",
      label: "Order verified",
      done: true,
      at: "2026-11-05T19:47:00.000Z",
      by: "Dana Reaves",
      detail: null,
    })).toBe("Order verified by Dana Reaves · Nov 5, 2026, 1:47 PM CT");
  });
});

describe("order total on the report", () => {
  it("adds shipping and tax when the stored amount is the merchandise subtotal", () => {
    expect(reportOrderTotalCents(order())).toBe(52074);
  });

  it("uses a stored grand total as-is", () => {
    expect(reportOrderTotalCents(order({ invoiceTotal: "355.79", totalAmount: "284.39" }))).toBe(35579);
  });

  it("computes from the lines when no total is stored", () => {
    expect(reportOrderTotalCents(order({ invoiceTotal: undefined }))).toBe(52074);
  });

  it("says it does not know rather than printing $0.00", () => {
    expect(reportOrderTotalCents(order({ invoiceTotal: undefined, totalAmount: undefined, lineItems: null, taxAmount: undefined }))).toBeNull();
  });
});

describe("count tiles", () => {
  const rows = [
    buildOrderStatusRow(order({ id: 1, requestNumber: "CD-1" })),
    buildOrderStatusRow(order({ id: 2, requestNumber: "CD-2", orderVerifiedAt: "2026-10-24T15:00:00.000Z" })),
    buildOrderStatusRow(order({ id: 3, requestNumber: "CD-3", orderVerifiedAt: "2026-10-24T15:00:00.000Z", orderShippedAt: "2026-10-28T16:00:00.000Z" })),
    buildOrderStatusRow(order({ id: 4, requestNumber: "CD-4", ...fullyDone })),
  ];

  it("puts each order in exactly one bucket", () => {
    expect(rows.map(orderStatusBucket)).toEqual([
      "awaiting_verification", "verified_not_shipped", "shipped_not_signed", "signed",
    ]);
  });

  it("counts every bucket", () => {
    expect(countOrderStatuses(rows)).toEqual({
      awaiting_verification: 1,
      verified_not_shipped: 1,
      shipped_not_signed: 1,
      signed: 1,
    });
  });

  it("counts an empty board as all zeroes", () => {
    expect(countOrderStatuses([])).toEqual({
      awaiting_verification: 0, verified_not_shipped: 0, shipped_not_signed: 0, signed: 0,
    });
  });
});

describe("report filters", () => {
  const base = [
    buildOrderStatusRow(order({ id: 1, requestNumber: "CD-1", distributorName: "Ashford", customerName: "Tom Reaves" })),
    buildOrderStatusRow(order({ id: 2, requestNumber: "CD-2", distributorName: "Madison", customerName: "Ada Chen", orderVerifiedAt: "2026-11-05T15:00:00.000Z" })),
    buildOrderStatusRow(order({ id: 3, requestNumber: "CD-3", distributorName: "Ashford", customerName: "Raj Patel", ...fullyDone })),
  ];

  it("filters by distributor", () => {
    expect(filterOrderStatusRows(base, { distributor: "Ashford" }, NOW).map((row) => row.id)).toEqual([1, 3]);
  });

  it("filters by status bucket, matching a tile click", () => {
    expect(filterOrderStatusRows(base, { status: "verified_not_shipped" }, NOW).map((row) => row.id)).toEqual([2]);
    expect(filterOrderStatusRows(base, { status: "all" }, NOW)).toHaveLength(3);
  });

  it("filters by date range on the order date", () => {
    const inRange = filterOrderStatusRows(base, { from: "2026-10-22", to: "2026-10-22" }, NOW);
    expect(inRange).toHaveLength(3);
    expect(filterOrderStatusRows(base, { from: "2026-10-23" }, NOW)).toHaveLength(0);
    expect(filterOrderStatusRows(base, { to: "2026-10-01" }, NOW)).toHaveLength(0);
  });

  it("searches order number, customer and distributor", () => {
    expect(filterOrderStatusRows(base, { search: "cd-2" }, NOW).map((row) => row.id)).toEqual([2]);
    expect(filterOrderStatusRows(base, { search: "ada" }, NOW).map((row) => row.id)).toEqual([2]);
    expect(filterOrderStatusRows(base, { search: "ashford" }, NOW).map((row) => row.id)).toEqual([1, 3]);
    expect(filterOrderStatusRows(base, { search: "   " }, NOW)).toHaveLength(3);
  });

  it("combines filters", () => {
    expect(filterOrderStatusRows(base, { distributor: "Ashford", status: "signed" }, NOW).map((row) => row.id)).toEqual([3]);
  });

  it("lists the distributors that actually appear", () => {
    expect(orderStatusDistributors(base)).toEqual(["Ashford", "Madison"]);
  });
});

describe("stuck orders", () => {
  it("counts days since the furthest step", () => {
    const row = buildOrderStatusRow(order({ orderVerifiedAt: "2026-11-01T15:00:00.000Z" }));
    expect(isOrderStuck(row, 3, NOW)).toBe(true);
    expect(isOrderStuck(row, 8, NOW)).toBe(false);
  });

  it("falls back to the order date when nothing has happened", () => {
    const row = buildOrderStatusRow(order({ createdAt: "2026-10-01T15:00:00.000Z" }));
    expect(isOrderStuck(row, 14, NOW)).toBe(true);
  });

  it("never calls a signed order stuck", () => {
    const row = buildOrderStatusRow(order({ ...fullyDone, orderSignedAt: "2026-10-01T15:00:00.000Z" }));
    expect(orderStatusBucket(row)).toBe("signed");
    expect(isOrderStuck(row, 1, NOW)).toBe(false);
  });

  it("is off at zero or negative days", () => {
    const row = buildOrderStatusRow(order({ createdAt: "2020-01-01T00:00:00.000Z" }));
    expect(isOrderStuck(row, 0, NOW)).toBe(false);
    expect(filterOrderStatusRows([row], { stuckDays: 0 }, NOW)).toHaveLength(1);
  });

  it("filters to only the stuck orders", () => {
    const fresh = buildOrderStatusRow(order({ id: 1, orderVerifiedAt: "2026-11-05T15:00:00.000Z" }));
    const stale = buildOrderStatusRow(order({ id: 2, orderVerifiedAt: "2026-10-20T15:00:00.000Z" }));
    expect(filterOrderStatusRows([fresh, stale], { stuckDays: 7 }, NOW).map((row) => row.id)).toEqual([2]);
  });
});

describe("row identity", () => {
  it("carries what the table columns need", () => {
    const row = buildOrderStatusRow(order());
    expect(row).toMatchObject({
      id: 18,
      orderNumber: "CD-20261022-OLOUT",
      customer: "Tom Reaves",
      distributor: "Ashford",
      totalCents: 52074,
    });
  });

  it("falls back to the originator when no customer name is stored", () => {
    const row = buildOrderStatusRow(order({ customerName: null, originatorName: "Walk-in" }));
    expect(row.customer).toBe("Walk-in");
    expect(buildOrderStatusRow(order({ customerName: null, originatorName: null })).customer).toBeNull();
  });
});

describe("master order fields", () => {
  it("carries affiliate, dealer, items, cost and margin", () => {
    const row = buildOrderStatusRow(order({
      affiliateName: "Reaves Way Cabinet Shop",
      affiliateHostname: "reaves-way.cabinetdealz.com",
      dealerName: "Reaves Way LLC",
      lineItems: [{ unitPrice: 449.34, linePrice: 449.34, qty: 1, distributorUnitCost: 284.39, distributorLineCost: 284.39 }],
    }));
    expect(row.affiliate).toBe("Reaves Way Cabinet Shop · reaves-way.cabinetdealz.com");
    expect(row.affiliateName).toBe("Reaves Way Cabinet Shop");
    expect(row.affiliateSite).toBe("reaves-way.cabinetdealz.com");
    expect(row.dealer).toBe("Reaves Way LLC");
    expect(row.itemCount).toBe(1);
    expect(row.distributorCostCents).toBe(28439);
    expect(row.marginCents).toBe(52074 - 28439);
  });

  it("leaves the affiliate null for a direct order rather than guessing", () => {
    const row = buildOrderStatusRow(order());
    expect(row.affiliate).toBeNull();
    expect(row.affiliateName).toBeNull();
    expect(row.affiliateSite).toBeNull();
    expect(row.dealer).toBeNull();
  });

  it("does not invent an affiliate site from a slug", () => {
    const row = buildOrderStatusRow(order({ affiliateSlug: "reaves-way" }));
    expect(row.affiliate).toBe("reaves-way");
    expect(row.affiliateSite).toBeNull();
  });

  it("refuses to total a partial distributor cost", () => {
    const row = buildOrderStatusRow(order({
      lineItems: [
        { unitPrice: 10, linePrice: 10, qty: 1, distributorUnitCost: 5 },
        { unitPrice: 20, linePrice: 20, qty: 1 },
      ],
    }));
    expect(row.distributorCostCents).toBeNull();
    expect(row.marginCents).toBeNull();
  });

  it("reads payment status from paid, refund and status", () => {
    expect(buildOrderStatusRow(order({ paidAt: "2026-11-05T00:00:00.000Z" })).paymentStatus).toBe("paid");
    expect(buildOrderStatusRow(order({ paidAt: null })).paymentStatus).toBe("unpaid");
    expect(buildOrderStatusRow(order({ paidAt: "2026-11-05T00:00:00.000Z", saleRefundedAt: "2026-11-06T00:00:00.000Z" })).paymentStatus).toBe("refunded");
    expect(buildOrderStatusRow(order({ paidAt: null, status: "refunded" })).paymentStatus).toBe("refunded");
  });
});

describe("affiliate filter and sorting", () => {
  const rows = [
    buildOrderStatusRow(order({ id: 1, requestNumber: "CD-1", affiliateName: null, totalCents: 1 } as never)),
    buildOrderStatusRow(order({ id: 2, requestNumber: "CD-2", affiliateName: "Reaves Way" })),
    buildOrderStatusRow(order({ id: 3, requestNumber: "CD-3", affiliateName: "Ace Kitchens", orderVerifiedAt: "2026-11-05T00:00:00.000Z" })),
  ];

  it("filters by affiliate", () => {
    expect(filterOrderStatusRows(rows, { affiliate: "Reaves Way" }, NOW).map((row) => row.id)).toEqual([2]);
  });

  it("has a Direct bucket for orders with no affiliate", () => {
    expect(filterOrderStatusRows(rows, { affiliate: DIRECT_ONLY_AFFILIATE }, NOW).map((row) => row.id)).toEqual([1]);
  });

  it("lists affiliates plus a direct bucket only when one exists", () => {
    expect(orderStatusAffiliates(rows)).toEqual(["Ace Kitchens", "Reaves Way", DIRECT_ONLY_AFFILIATE]);
    expect(orderStatusAffiliates(rows.slice(1))).toEqual(["Ace Kitchens", "Reaves Way"]);
  });

  it("sorts by a column and sinks missing values in both directions", () => {
    const noTotal = buildOrderStatusRow(order({ id: 4, requestNumber: "CD-4", invoiceTotal: undefined, totalAmount: undefined, lineItems: null, taxAmount: undefined, shippingAmount: undefined }));
    const list = [...rows, noTotal];
    expect(sortMasterOrders(list, { key: "orderNumber", direction: "asc" }).map((row) => row.id)).toEqual([1, 2, 3, 4]);
    expect(sortMasterOrders(list, { key: "orderNumber", direction: "desc" }).map((row) => row.id)).toEqual([4, 3, 2, 1]);
    expect(sortMasterOrders(list, { key: "totalCents", direction: "asc" }).at(-1)?.id).toBe(4);
    expect(sortMasterOrders(list, { key: "totalCents", direction: "desc" }).at(-1)?.id).toBe(4);
  });

  it("flips direction on the same column and starts ascending on a new one", () => {
    expect(nextMasterOrderSort({ key: "createdAt", direction: "desc" }, "createdAt")).toEqual({ key: "createdAt", direction: "asc" });
    expect(nextMasterOrderSort({ key: "createdAt", direction: "desc" }, "orderNumber")).toEqual({ key: "orderNumber", direction: "asc" });
    expect(nextMasterOrderSort({ key: "orderNumber", direction: "asc" }, "createdAt")).toEqual({ key: "createdAt", direction: "desc" });
  });
});

describe("paging", () => {
  const rows = Array.from({ length: 120 }, (_, index) => buildOrderStatusRow(order({ id: index + 1, requestNumber: `CD-${index + 1}` })));

  it("pages 50 at a time with 1-based numbers", () => {
    const first = paginateMasterOrders(rows, 1, 50);
    expect(first).toMatchObject({ page: 1, pageCount: 3, total: 120, from: 1, to: 50 });
    expect(first.rows).toHaveLength(50);
    const third = paginateMasterOrders(rows, 3, 50);
    expect(third).toMatchObject({ page: 3, from: 101, to: 120 });
    expect(third.rows).toHaveLength(20);
  });

  it("clamps an out-of-range page", () => {
    expect(paginateMasterOrders(rows, 99, 50).page).toBe(3);
    expect(paginateMasterOrders(rows, 0, 50).page).toBe(1);
  });

  it("handles an empty list", () => {
    expect(paginateMasterOrders([], 1, 50)).toMatchObject({ page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
  });
});
