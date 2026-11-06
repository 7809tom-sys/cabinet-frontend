import { describe, expect, it, vi } from "vitest";
import type { AdminOrderRow } from "@/lib/adminOrderRow";
import { poDocumentFromOrder, poInputFromOrder } from "./poOrderView";

function order(overrides: Partial<AdminOrderRow> = {}): AdminOrderRow {
  return {
    id: 18,
    requestNumber: "CD-20261022-OLOUT",
    originatorName: "Tom Reaves",
    originatorEmail: "tom@example.com",
    originatorPhone: null,
    customerName: "Tom Reaves",
    status: "confirmed",
    tier: "Dealer",
    styleName: "Carmel Shaker",
    distributorName: "Ashford",
    deliveryMethod: "ship",
    shippingAmount: "47.00",
    taxAmount: "24.40",
    itemCount: 1,
    notes: null,
    createdAt: new Date("2026-10-22T12:00:00.000Z"),
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
      poSku: "cs-cs-db18",
    }],
    ...overrides,
  } as AdminOrderRow;
}

describe("admin order → PO document", () => {
  it("maps the stored shipping, tax and distributor cost straight through", () => {
    const doc = poDocumentFromOrder(order());
    expect(doc.subtotalCents).toBe(28439);
    expect(doc.shippingCents).toBe(4700);
    expect(doc.taxCents).toBe(2440);
    expect(doc.totalCents).toBe(35579);
    expect(doc.basis).toBe("distributor_cost");
  });

  it("uses the PO SKU as the item and the color/finish as the door style", () => {
    const input = poInputFromOrder(order());
    expect(input.lines?.[0]).toMatchObject({ sku: "cs-db18", doorStyle: "Terra Shaker (Ashford)", qty: 1 });
  });

  it("falls back to the master code when the line has no PO SKU", () => {
    const input = poInputFromOrder(order({
      lineItems: [{
        cabinetId: 1,
        masterCode: "3DB18",
        description: "Base",
        qty: 1,
        unitPrice: null,
        linePrice: null,
        matched: false,
        poSku: null,
      }],
    }));
    expect(input.lines?.[0].sku).toBe("3DB18");
  });

  it("keeps a freight quote in the shipping line when that is all the order stores", () => {
    const doc = poDocumentFromOrder(order({ shippingAmount: undefined, freightQuoteCents: 4700, freightQuoteVerified: true }));
    expect(doc.shippingCents).toBe(4700);
    expect(doc.shippingRecorded).toBe(true);
    expect(doc.totalCents).toBe(35579);
  });

  it("uses the order date as the PO date", () => {
    expect(poDocumentFromOrder(order()).orderDate).toBe("2026-10-22");
  });

  it("does not invent a price for a line that has none", () => {    const doc = poDocumentFromOrder(order({
      lineItems: [{
        cabinetId: 1,
        masterCode: "3DB18",
        description: "Base",
        qty: 1,
        unitPrice: null,
        linePrice: null,
        matched: true,
        poSku: "cs-cs-db18",
      }],
    }));
    expect(doc.subtotalCents).toBe(0);
    expect(doc.completePricing).toBe(false);
    expect(doc.totalCents).toBe(7140);
  });
});

describe("PO SKU repair on an existing order", () => {
  it("collapses the repeated distributor and style prefix", () => {
    const doc = poDocumentFromOrder(order({
      lineItems: [{
        cabinetId: 1,
        masterCode: "3DB18",
        description: '18" 3 Drawer Base Cabinet',
        qty: 1,
        unitPrice: 449.34,
        linePrice: 449.34,
        distributorUnitCost: 284.39,
        distributorLineCost: 284.39,
        matched: true,
        poSku: "cs-cs-cs-db18",
      }],
    }));
    // The admin page was showing "cs-cs-cs-db18".
    expect(doc.lines[0].sku).toBe("cs-db18");
  });

  it("leaves a healthy SKU alone", () => {
    const doc = poDocumentFromOrder(order({
      lineItems: [{
        cabinetId: 1,
        masterCode: "3DB24",
        description: "Base",
        qty: 1,
        unitPrice: null,
        linePrice: null,
        matched: true,
        poSku: "usd-sw-3db24",
      }],
    }));
    expect(doc.lines[0].sku).toBe("usd-sw-3db24");
  });
});

describe("PO unit price source", () => {
  it("prices the line at distributor cost, never the customer price", () => {
    const doc = poDocumentFromOrder(order());
    // The screenshot showed Unit $449.34 (customer price) on the PO table.
    expect(doc.lines[0].unitPriceCents).toBe(28439);
    expect(doc.lines[0].unitPriceCents).not.toBe(44934);
    expect(doc.lines[0].basis).toBe("distributor_cost");
  });

  it("uses the extended cost when only that is stored", () => {
    const doc = poDocumentFromOrder(order({
      lineItems: [{
        cabinetId: 1,
        masterCode: "3DB18",
        description: "Base",
        qty: 2,
        unitPrice: 449.34,
        linePrice: 898.68,
        distributorLineCost: 568.78,
        matched: true,
        poSku: "cs-db18",
      }],
    }));
    expect(doc.subtotalCents).toBe(56878);
    expect(doc.lines[0].unitPriceCents).toBe(28439);
  });
});
