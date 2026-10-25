import { describe, expect, it } from "vitest";
import { buildCrmQuickInvoiceHtml, crmQuickInvoiceTotal } from "./crmQuickInvoice";

describe("CRM quick invoice", () => {
  it("totals selected cabinet, design, labor, and shipping services without negative amounts", () => {
    expect(crmQuickInvoiceTotal([
      { description: "Cabinet Order", amount: 4200 },
      { description: "Kitchen Design", amount: 250 },
      { description: "Labor", amount: 1300 },
      { description: "Shipping", amount: 184.5 },
      { description: "Adjustment", amount: -20 },
    ])).toBe(5934.5);
  });

  it("recalculates the final amount when a preview price is edited before PDF generation", () => {
    const lines = [
      { description: "Cabinet Order", amount: 4200 },
      { description: "Kitchen Design", amount: 250 },
      { description: "Labor", amount: 1300 },
    ];
    const editedPreviewLines = lines.map((line) => line.description === "Labor" ? { ...line, amount: 1450 } : line);

    expect(crmQuickInvoiceTotal(editedPreviewLines)).toBe(5900);
  });

  it("shows imported design materials as included details without adding them again to total due", () => {
    const lines = [
      { description: "Kitchen Design — Aspin kitchen", amount: 4875.5 },
      { description: "Included material · 2 × 24 in Base Cabinet", amount: 0, kind: "included" as const },
      { description: "Included material · 1 × 30 in Wall Cabinet", amount: 0, kind: "included" as const },
    ];
    expect(crmQuickInvoiceTotal(lines)).toBe(4875.5);
    expect(buildCrmQuickInvoiceHtml({
      invoiceNumber: "CRM-42-20260814",
      issuedOn: "August 14, 2026",
      customerName: "Tom",
      lines,
    })).toContain("Included material · 2 × 24 in Base Cabinet");
  });

  it("adds a separately labeled shipping line once to the printable invoice total", () => {
    const lines = [
      { description: "Kitchen Design — Oak kitchen", amount: 4875.5 },
      { description: "Shipping", amount: 184.5 },
      { description: "Included material · 2 × 24 in Base Cabinet", amount: 0, kind: "included" as const },
    ];
    expect(crmQuickInvoiceTotal(lines)).toBe(5060);
    const html = buildCrmQuickInvoiceHtml({
      invoiceNumber: "CRM-43-20260924",
      issuedOn: "September 24, 2026",
      customerName: "Tom",
      lines,
    });
    expect(html).toContain("Shipping");
    expect(html).toContain("$184.50");
    expect(html).toContain("$5,060.00");
  });

  it("renders the customer, linked design, selected services, and notes safely into a printable invoice", () => {
    const html = buildCrmQuickInvoiceHtml({
      invoiceNumber: "CRM-42-20260814",
      issuedOn: "August 14, 2026",
      customerName: "Tom <Kitchen>",
      customerEmail: "tom@example.com",
      linkedDesignName: "Aspin kitchen",
      notes: "Cabinet order plus labor.",
      brand: { storeName: "Reaves Way Cabinet Shop", logoUrl: "https://example.com/reaves-way-logo.png", primaryColor: "#123456", accentColor: "#C79A4B" },
      lines: [
        { description: "Cabinet Order", amount: 4200 },
        { description: "Kitchen Design", amount: 250 },
        { description: "Labor", amount: 1300 },
      ],
    });

    expect(html).toContain("Tom &lt;Kitchen&gt;");
    expect(html).toContain("Aspin kitchen");
    expect(html).toContain("Cabinet Order");
    expect(html).toContain("Kitchen Design");
    expect(html).toContain("Labor");
    expect(html).toContain("$5,750.00");
    expect(html).toContain("Reaves Way Cabinet Shop");
    expect(html).toContain("reaves-way-logo.png");
  });
});
