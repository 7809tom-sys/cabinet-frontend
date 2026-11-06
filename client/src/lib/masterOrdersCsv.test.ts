// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { buildOrderStatusRow } from "./orderStatusReport";
import {
  MASTER_ORDERS_CSV_COLUMNS,
  csvMoney,
  downloadMasterOrdersCsv,
  masterOrdersCsv,
  masterOrdersCsvFileName,
} from "./masterOrdersCsv";

const row = buildOrderStatusRow({
  id: 18,
  requestNumber: "CD-20261022-OLOUT",
  customerName: "Tom Reaves",
  originatorEmail: "tom@example.com",
  distributorName: "Ashford",
  affiliateName: "Reaves Way Cabinet Shop",
  affiliateHostname: "reaves-way.cabinetdealz.com",
  dealerName: "Reaves Way LLC",
  createdAt: "2026-10-22T12:00:00.000Z",
  invoiceTotal: "449.34",
  totalAmount: "449.34",
  taxAmount: "24.40",
  shippingAmount: "47.00",
  paidAt: "2026-10-22T13:00:00.000Z",
  deliveryMethod: "ship",
  lineItems: [{ unitPrice: 449.34, linePrice: 449.34, qty: 1, distributorUnitCost: 284.39, distributorLineCost: 284.39 }],
  distributorEmailStatus: "sent",
  distributorEmailSentAt: "2026-10-22T14:00:00.000Z",
  distributorEmailSentBy: "Selena Ortiz",
  distributorEmailTo: "orders@ashford.com",
  orderVerifiedAt: "2026-10-24T15:00:00.000Z",
  orderVerifiedBy: "Selena Ortiz",
  orderShippedAt: "2026-10-28T16:00:00.000Z",
  orderShippedBy: "Rick Alvarez",
  shipmentCarrier: "FedEx",
  shipmentTracking: "1Z999",
});

const direct = buildOrderStatusRow({
  id: 1,
  requestNumber: "CD-1",
  customerName: "Ada Chen",
  createdAt: "2026-10-20T12:00:00.000Z",
  invoiceTotal: "100.00",
  totalAmount: "100.00",
  taxAmount: "0",
  shippingAmount: "0",
  deliveryMethod: "ship",
  lineItems: [{ unitPrice: 100, linePrice: 100, qty: 2 }],
  paidAt: null,
});

describe("master orders CSV", () => {
  it("writes the same columns as the table", () => {
    const rows = masterOrdersCsv([row]).split("\r\n");
    expect(rows[0]).toBe(MASTER_ORDERS_CSV_COLUMNS.map((column) => column).join(","));
    const header = rows[0].split(",");
    expect(header).toEqual(expect.arrayContaining([
      "Order #", "Date", "Affiliate", "Affiliate site", "Customer", "Dealer",
      "Distributor", "Items", "Customer total", "Distributor cost", "Margin", "Payment", "Status",
    ]));
  });

  it("writes money as plain numbers and the affiliate and dealer separately", () => {
    const cells = masterOrdersCsv([row]).split("\r\n")[1].split(",");
    expect(cells[0]).toBe("CD-20261022-OLOUT");
    expect(cells[2]).toBe("Reaves Way Cabinet Shop");
    expect(cells[3]).toBe("reaves-way.cabinetdealz.com");
    expect(cells[5]).toBe("Reaves Way LLC");
    expect(cells[8]).toBe("520.74");
    expect(cells[9]).toBe("284.39");
    expect(cells[10]).toBe("236.35");
    expect(cells[11]).toBe("paid");
  });

  it("leaves the affiliate cells blank for a direct order and never guesses", () => {
    const cells = masterOrdersCsv([direct]).split("\r\n")[1].split(",");
    expect(cells[2]).toBe("");
    expect(cells[3]).toBe("");
    expect(cells[5]).toBe("");
    expect(cells[11]).toBe("unpaid");
  });

  it("records who and when for each status step", () => {
    const cells = masterOrdersCsv([row]).split("\r\n")[1].split(",");
    // Verified / shipped cells carry the Central timestamp and the actor.
    const joined = cells.join(",");
    expect(joined).toContain("by Selena Ortiz");
    expect(joined).toContain("by Rick Alvarez");
    expect(joined).toContain("CT");
    expect(joined).toContain("FedEx · 1Z999");
  });

  it("leaves steps that have not happened blank", () => {
    const rows = masterOrdersCsv([direct]).split("\r\n");
    const cells = rows[1].split(",");
    expect(cells.slice(-5).every((cell) => cell === "")).toBe(true);
  });

  it("names the file with the Central date", () => {
    expect(masterOrdersCsvFileName(new Date("2026-11-06T12:00:00.000Z"))).toBe("master-orders-2026-11-06.csv");
  });

  it("formats cents for a spreadsheet", () => {
    expect(csvMoney(52074)).toBe("520.74");
    expect(csvMoney(-1234)).toBe("-12.34");
    expect(csvMoney(null)).toBe("");
  });

  it("downloads the filtered rows", () => {
    const createObjectURL = vi.fn(() => "blob:orders");
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const csv = downloadMasterOrdersCsv([direct], new Date("2026-11-06T12:00:00.000Z"));
    expect(click).toHaveBeenCalledOnce();
    expect(csv).toContain("CD-1");
    expect(csv.split("\r\n")).toHaveLength(2);
    click.mockRestore();
  });
});
