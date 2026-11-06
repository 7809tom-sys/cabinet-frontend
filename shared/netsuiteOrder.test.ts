import { describe, expect, it } from "vitest";
import { buildNetsuiteOrderCsv, buildOrderEmailText, NETSUITE_CSV_COLUMNS } from "./netsuiteOrder";

const header = {
  orderNumber: "CD-20261022-OLOUT",
  customerName: "Tom Reaves",
  styleName: "Carmel Shaker",
  deliveryMethod: "ship" as const,
  orderDate: "2026-10-22T15:00:00.000Z",
};

const lines = [{
  poSku: "cs-cs-db18",
  masterCode: "3DB18",
  description: '18" 3 Drawer Base Cabinet',
  qty: 1,
  distributorUnitCost: 284.39,
  distributorLineCost: 284.39,
  unitPrice: 449.34,
  linePrice: 449.34,
}];

describe("NetSuite PO CSV", () => {
  it("keeps the NetSuite column mapping", () => {
    expect(NETSUITE_CSV_COLUMNS).toEqual([
      "External ID", "PO Number", "Order Date", "Customer", "Fulfillment",
      "Door Style", "Item", "Description", "Quantity", "Rate", "Amount",
    ]);
  });

  it("writes distributor cost as Rate and Amount, not the customer price", () => {
    const rows = buildNetsuiteOrderCsv(header, lines).split("\r\n");
    expect(rows).toHaveLength(2);
    const cells = rows[1].split(",");
    expect(cells).toContain("cs-cs-db18");
    expect(cells).toContain("284.39");
    expect(cells).not.toContain("449.34");
    // Quantity 1, Rate 284.39, Amount 284.39 are the last three columns.
    expect(cells.slice(-3)).toEqual(["1", "284.39", "284.39"]);
  });

  it("leaves Rate and Amount blank when a line genuinely has no price", () => {
    const rows = buildNetsuiteOrderCsv(header, [{ poSku: "cs-cs-db18", description: "Base", qty: 1 }]).split("\r\n");
    expect(rows[1].split(",").slice(-3)).toEqual(["1", "", ""]);
  });

  it("carries the line price into the email body it sends with the CSV", () => {
    const text = buildOrderEmailText(header, lines, { distributorName: "Clark and Son", totals: { shipping: 47, tax: 24.4 } });
    expect(text).toContain("Distributor: Clark and Son");
    expect(text).toContain("Unit $284.39 × 1 = Line total $284.39");
    expect(text).toContain("Subtotal: $284.39");
    expect(text).toContain("Total: $355.79");
    expect(text).toContain("A NetSuite-ready CSV of this order is attached.");
  });
});
