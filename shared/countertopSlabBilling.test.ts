import { describe, expect, it } from "vitest";
import {
  CORIAN_SHEET_SQ_FT,
  buildCountertopSlabInvoiceLine,
  countertopShippingOnFile,
  countertopSlabSize,
  slabsNeeded,
} from "./countertopSlabBilling";

describe("countertop slab billing", () => {
  it("uses the 30 x 144 in Corian sheet (30 sq ft) and rounds up to whole slabs", () => {
    expect(CORIAN_SHEET_SQ_FT).toBe(30);
    expect(slabsNeeded(32.5)).toBe(2);
    expect(slabsNeeded("32.50")).toBe(2);
    expect(slabsNeeded(30)).toBe(1);
    expect(slabsNeeded(30.01)).toBe(2);
    expect(slabsNeeded(0)).toBeNull();
    expect(slabsNeeded(null)).toBeNull();
    expect(slabsNeeded("abc")).toBeNull();
  });

  it("builds the Corian line with slab count, sq ft needed and price per slab", () => {
    const result = buildCountertopSlabInvoiceLine({ squareFeet: "32.50", material: "Corian", quotedPrice: "450.00" });
    expect(result).toMatchObject({ ok: true, slabs: 2, total: 900, pricePerSlab: 450 });
    if (!result.ok) throw new Error("expected a line");
    expect(result.line).toEqual({
      description: "Corian countertop, 2 slabs, 32.5 sq ft needed, at $450.00 per slab = $900.00",
      amount: 900,
      kind: "charge",
    });
  });

  it("bills a blank material as Corian", () => {
    const result = buildCountertopSlabInvoiceLine({ squareFeet: 20, material: null, quotedPrice: 500 });
    expect(result.ok && result.line.description).toBe("Corian countertop, 1 slab, 20 sq ft needed, at $500.00 per slab = $500.00");
  });

  it("does not block quartz or granite but flags the unconfirmed slab size", () => {
    expect(countertopSlabSize("White Quartz")).toMatchObject({ slabSqFt: 30, confirmed: false, warning: "slab size not confirmed for White Quartz" });
    const result = buildCountertopSlabInvoiceLine({ squareFeet: 45, material: "Granite", quotedPrice: 600 });
    expect(result.ok && result.line.description).toBe(
      "Granite countertop, 2 slabs, 45 sq ft needed, at $600.00 per slab = $1,200.00 (slab size not confirmed for Granite)",
    );
  });

  it("can treat quotedPrice as the whole-job total with the flag flipped", () => {
    const result = buildCountertopSlabInvoiceLine({ squareFeet: 32.5, material: "Corian", quotedPrice: 900 }, false);
    expect(result.ok && result.line).toEqual({
      description: "Corian countertop, 2 slabs, 32.5 sq ft needed, at $450.00 per slab = $900.00",
      amount: 900,
      kind: "charge",
    });
  });

  it("returns no line, with a clear message, for missing or zero sq ft or price", () => {
    expect(buildCountertopSlabInvoiceLine({ squareFeet: 0, quotedPrice: 450 })).toMatchObject({ ok: false, reason: "missing_area" });
    expect(buildCountertopSlabInvoiceLine({ squareFeet: null, quotedPrice: 450 })).toMatchObject({ ok: false, reason: "missing_area" });
    expect(buildCountertopSlabInvoiceLine({ squareFeet: 32.5, quotedPrice: null })).toMatchObject({ ok: false, reason: "missing_price" });
  });

  it("requires a real shipping address before billing", () => {
    expect(countertopShippingOnFile({ dealShippingAddress: null, order: null })).toBe(false);
    expect(countertopShippingOnFile({ dealShippingAddress: "  " })).toBe(false);
    expect(countertopShippingOnFile({ order: { zip: "32801" } })).toBe(false);
    expect(countertopShippingOnFile({ dealShippingAddress: "12 Oak St, Orlando, FL 32801" })).toBe(true);
    expect(countertopShippingOnFile({ order: { shippingAddressLine1: "12 Oak St", shippingCity: "Orlando", shippingState: "FL", zip: "32801" } })).toBe(true);
  });
});
