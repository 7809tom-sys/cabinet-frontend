import { describe, expect, it } from "vitest";
import { countertopInvoiceErrorMessage, countertopInvoiceGate, type CountertopQuoteInvoiceOption } from "./countertopInvoiceGate";

const LINE = { description: "Corian countertop, 2 slabs, 32.5 sq ft needed, at $450.00 per slab = $900.00", amount: 900, kind: "charge" as const };
const quote = (overrides: Partial<CountertopQuoteInvoiceOption> = {}): CountertopQuoteInvoiceOption => ({
  id: 7001, contactEmail: "ana@example.com", status: "won", material: "Corian", squareFeet: "32.50",
  line: LINE, slabs: 2, slabSizeWarning: null, blockedReason: null, ...overrides,
});

describe("countertopInvoiceGate", () => {
  it("allows an invoice with no countertop quote picked", () => {
    expect(countertopInvoiceGate({ quoteId: null, quotes: undefined, shippingOnFile: false })).toEqual({ ok: true, line: null });
  });

  it("blocks the slab line when shipping info is missing", () => {
    const gate = countertopInvoiceGate({ quoteId: 7001, quotes: [quote()], shippingOnFile: false });
    expect(gate).toMatchObject({ ok: false, reason: "missing_shipping" });
    expect(!gate.ok && gate.message).toContain("Shipping info is required");
  });

  it("allows the slab line once shipping is on file", () => {
    expect(countertopInvoiceGate({ quoteId: 7001, quotes: [quote()], shippingOnFile: true })).toEqual({ ok: true, line: LINE });
  });

  it("blocks a quote with no line and passes the reason through", () => {
    const gate = countertopInvoiceGate({ quoteId: 7001, quotes: [quote({ line: null, slabs: null, blockedReason: "No square feet on this quote" })], shippingOnFile: true });
    expect(gate).toEqual({ ok: false, reason: "missing_line", message: "No square feet on this quote" });
  });

  it("maps the server's missing_shipping refusal to an admin message", () => {
    expect(countertopInvoiceErrorMessage("missing_shipping")).toContain("shipping address");
    expect(countertopInvoiceErrorMessage("disabled")).toBeNull();
  });
});
