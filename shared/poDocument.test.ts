import { describe, expect, it } from "vitest";
import {
  buildPoCsv,
  buildPoDocument,
  buildPoText,
  formatPoUsd,
  parsePoCents,
  poPricingWarning,
  poSummaryRows,
  resolvePoLine,
  type PoDocumentInput,
} from "./poDocument";

/**
 * CD-20261022-OLOUT is the order that exposed the bug: the emailed PO, its PDF
 * and its CSV showed only "Shipping $47.00 / Tax $24.40 / Total $71.40" because
 * no line carried a price into the document.
 *
 * Tom confirmed the real numbers for its single line:
 *   1 x CS-DB18  18" 3 Drawer Base Cabinet, Carmel Shaker (vendor CS)
 *   distributor cost $284.39   (customer price $449.34)
 *   shipping $47.00   tax $24.40   → PO total $355.79
 * Those values are pinned here as the expected fixture.
 */
export const ORDER_CD_20261022_OLOUT: PoDocumentInput = {
  orderNumber: "CD-20261022-OLOUT",
  orderDate: "2026-10-22",
  customerName: "Tom Reaves",
  styleName: "Carmel Shaker",
  distributorName: "Clark and Son",
  deliveryMethod: "ship",
  shipping: "47.00",
  tax: "24.40",
  lines: [{
    sku: "CS-DB18",
    masterCode: "3DB18",
    description: '18" 3 Drawer Base Cabinet',
    doorStyle: "Carmel Shaker",
    qty: 1,
    // Distributor cost is what a distributor PO shows.
    distributorUnitCost: "284.39",
    distributorLineCost: "284.39",
    // Customer price is stored too; it must not leak onto the PO.
    unitPrice: "449.34",
    linePrice: "449.34",
  }],
};

describe("PO document money", () => {
  it("builds the corrected CD-20261022-OLOUT PO at distributor cost", () => {
    const doc = buildPoDocument(ORDER_CD_20261022_OLOUT);
    expect(doc.lines).toHaveLength(1);
    expect(doc.lines[0]).toMatchObject({
      sku: "CS-DB18",
      qty: 1,
      unitPriceCents: 28439,
      lineTotalCents: 28439,
      basis: "distributor_cost",
      priced: true,
    });
    expect(doc.basis).toBe("distributor_cost");
    expect(doc.subtotalCents).toBe(28439);
    expect(doc.shippingCents).toBe(4700);
    expect(doc.taxCents).toBe(2440);
    expect(doc.totalCents).toBe(35579);
    expect(doc.completePricing).toBe(true);
    expect(formatPoUsd(doc.totalCents)).toBe("$355.79");
  });

  it("never drops a line's unit price or line total from the body", () => {
    const text = buildPoText(buildPoDocument(ORDER_CD_20261022_OLOUT));
    expect(text).toContain("1 x CS-DB18 — 18\" 3 Drawer Base Cabinet · Carmel Shaker");
    expect(text).toContain("Unit $284.39 × 1 = Line total $284.39");
    expect(text).toContain("Subtotal: $284.39");
    expect(text).toContain("Shipping: $47.00");
    expect(text).toContain("Sales tax: $24.40");
    expect(text).toContain("Total: $355.79");
    expect(text).not.toContain("449.34");
    // The old body only had the order total, which is what hid the missing line.
    expect(text).not.toContain("Total: $71.40");
  });

  it("totals subtotal + shipping + tax for a multi-line order", () => {
    const doc = buildPoDocument({
      orderNumber: "CD-1",
      shipping: 47,
      tax: 24.4,
      lines: [
        { sku: "A", qty: 2, unitCost: 100 },
        { sku: "B", qty: 1, unitCost: 50.5 },
      ],
    });
    expect(doc.subtotalCents).toBe(25050);
    expect(doc.totalCents).toBe(25050 + 4700 + 2440);
  });

  it("subtracts an order discount from the total", () => {
    const doc = buildPoDocument({
      orderNumber: "CD-2",
      shipping: 10,
      tax: 5,
      discount: 20,
      lines: [{ sku: "A", qty: 1, unitCost: 100 }],
    });
    expect(doc.totalCents).toBe(10000 + 1000 + 500 - 2000);
  });

  it("derives a unit price from an extended cost and back again", () => {
    expect(resolvePoLine({ qty: 2, distributorLineCost: 568.78 })).toMatchObject({
      unitPriceCents: 28439,
      lineTotalCents: 56878,
    });
    expect(resolvePoLine({ qty: 2, distributorUnitCost: 284.39 })).toMatchObject({
      unitPriceCents: 28439,
      lineTotalCents: 56878,
    });
  });

  it("falls back to the customer price only when no cost is stored, and says so", () => {
    const doc = buildPoDocument({
      orderNumber: "CD-3",
      shipping: 0,
      tax: 0,
      lines: [{ sku: "A", qty: 1, unitPrice: 449.34 }],
    });
    expect(doc.basis).toBe("customer_price");
    expect(doc.lines[0].unitPriceCents).toBe(44934);
    expect(buildPoText(doc)).toContain("customer price (no distributor cost is stored on this order)");
  });

  it("keeps an unpriced line visible and warns instead of hiding it", () => {
    const doc = buildPoDocument({
      orderNumber: "CD-20261022-OLOUT",
      shipping: 47,
      tax: 24.4,
      lines: [{ sku: "CS-DB18", description: '18" 3 Drawer Base Cabinet', qty: 1 }],
    });
    // This is the shape of the reported bug: the line has no price at all.
    expect(doc.subtotalCents).toBe(0);
    expect(doc.totalCents).toBe(7140);
    expect(doc.completePricing).toBe(false);
    expect(doc.basis).toBe("unpriced");
    expect(poPricingWarning(doc)).toContain("1 line has no price");
    const text = buildPoText(doc);
    expect(text).toContain("Unit no price × 1 = Line total no price");
    expect(text).toContain("WARNING: 1 line has no price");
  });

  it("treats a pickup order with no freight as recorded free shipping", () => {
    const doc = buildPoDocument({ orderNumber: "CD-4", deliveryMethod: "pickup", tax: 0, lines: [{ sku: "A", qty: 1, unitCost: 10 }] });
    expect(doc.shippingRecorded).toBe(true);
    expect(doc.shippingAssumedZero).toBe(false);
    expect(doc.totalCents).toBe(1000);
  });

  it("flags shipping that was never recorded rather than pretending it is zero", () => {
    const doc = buildPoDocument({ orderNumber: "CD-5", tax: 0, lines: [{ sku: "A", qty: 1, unitCost: 10 }] });
    expect(doc.shippingCents).toBe(0);
    expect(doc.shippingRecorded).toBe(false);
    expect(doc.shippingAssumedZero).toBe(true);
    const shippingRow = poSummaryRows(doc).find((row) => row.key === "shipping");
    expect(shippingRow).toMatchObject({ cents: 0, recorded: false });
  });

  it("lists subtotal, shipping, tax and total in that order, with the total last", () => {
    const rows = poSummaryRows(buildPoDocument(ORDER_CD_20261022_OLOUT));
    expect(rows.map((row) => row.key)).toEqual(["subtotal", "shipping", "tax", "total"]);
    expect(rows.at(-1)).toMatchObject({ key: "total", cents: 35579, emphasized: true });
  });

  it("writes unit price and line total into the PO CSV, then the summary rows", () => {
    const csv = buildPoCsv(buildPoDocument(ORDER_CD_20261022_OLOUT));
    const rows = csv.split("\r\n");
    expect(rows[0]).toBe("PO Number,Order Date,Item,Description,Door Style,Quantity,Unit Price,Line Total");
    expect(rows[1]).toBe('CD-20261022-OLOUT,2026-10-22,CS-DB18,"18"" 3 Drawer Base Cabinet",Carmel Shaker,1,284.39,284.39');
    expect(rows[2]).toBe("CD-20261022-OLOUT,2026-10-22,Subtotal,,,,,284.39");
    expect(rows).toContain("CD-20261022-OLOUT,2026-10-22,Shipping,,,,,47.00");
    expect(rows).toContain("CD-20261022-OLOUT,2026-10-22,Sales tax,,,,,24.40");
    expect(rows.at(-1)).toBe("CD-20261022-OLOUT,2026-10-22,Total,,,,,355.79");
  });

  it("can emit line rows only for a NetSuite import", () => {
    const rows = buildPoCsv(buildPoDocument(ORDER_CD_20261022_OLOUT), { includeSummary: false }).split("\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain("284.39,284.39");
  });

  it("reads dollars as numbers, currency strings, and rejects junk", () => {
    expect(parsePoCents("$1,234.56")).toBe(123456);
    expect(parsePoCents(47)).toBe(4700);
    expect(parsePoCents("47.00")).toBe(4700);
    expect(parsePoCents("")).toBeNull();
    expect(parsePoCents("n/a")).toBeNull();
    expect(parsePoCents(Number.NaN)).toBeNull();
  });

  it("marks a mixed-basis PO instead of averaging two kinds of price", () => {
    const doc = buildPoDocument({
      orderNumber: "CD-6",
      shipping: 0,
      tax: 0,
      lines: [
        { sku: "A", qty: 1, unitCost: 100 },
        { sku: "B", qty: 1, unitPrice: 200 },
      ],
    });
    expect(doc.basis).toBe("mixed");
    expect(buildPoText(doc)).toContain("mix distributor cost and customer price");
  });
});
