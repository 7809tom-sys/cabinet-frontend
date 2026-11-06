// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPoDocument } from "@shared/poDocument";
import {
  downloadPoCsv,
  downloadPoPdf,
  poCsvFileName,
  poPdfBasisNote,
  poPdfFileName,
  poPdfLineRows,
  poPdfSummaryRows,
  renderPoPdf,
} from "./poDocumentExport";

const doc = buildPoDocument({
  orderNumber: "CD-20261022-OLOUT",
  orderDate: "2026-10-22",
  customerName: "Tom Reaves",
  styleName: "Carmel Shaker",
  distributorName: "Ashford",
  shipping: 47,
  tax: 24.4,
  lines: [{
    sku: "CS-DB18",
    description: '18" 3 Drawer Base Cabinet',
    doorStyle: "Carmel Shaker",
    qty: 1,
    distributorUnitCost: 284.39,
    unitPrice: 449.34,
  }],
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubBlobUrls(): void {
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:po"), configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true });
}

describe("PO PDF rows", () => {
  it("prints a unit price and a line total for every item", () => {
    expect(poPdfLineRows(doc)).toEqual([
      '1 × CS-DB18 — 18" 3 Drawer Base Cabinet · Carmel Shaker',
      "    Unit $284.39 × 1 = Line total $284.39",
    ]);
  });

  it("prints subtotal, shipping, tax and the corrected total", () => {
    expect(poPdfSummaryRows(doc)).toEqual([
      "Subtotal: $284.39",
      "Shipping: $47.00",
      "Sales tax: $24.40",
      "Total: $355.79",
    ]);
  });

  it("states which price basis the PO uses", () => {
    expect(poPdfBasisNote(doc)).toBe("Prices shown are Cabinet Dealz distributor cost.");
  });

  it("names the downloaded files after the order", () => {
    expect(poCsvFileName(doc)).toBe("PO-CD-20261022-OLOUT.csv");
    expect(poPdfFileName(doc)).toBe("PO-CD-20261022-OLOUT.pdf");
  });

  it("renders a real PDF document", () => {
    const rendered = renderPoPdf(doc);
    const blob = rendered.output();
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe("application/pdf");
  });
});

describe("PO downloads", () => {
  it("writes the CSV with unit price, line total and the summary", () => {
    stubBlobUrls();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const csv = downloadPoCsv(doc);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(csv).toContain("Unit Price,Line Total");
    expect(csv).toContain("284.39,284.39");
    expect(csv).toContain("Total,,,,,355.79");
  });

  it("downloads the PDF", () => {
    stubBlobUrls();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadPoPdf(doc);
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
