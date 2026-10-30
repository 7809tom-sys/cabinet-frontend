import { describe, expect, it } from "vitest";
import {
  invoiceEmailButtonDisabled,
  invoiceEmailSourceLabel,
  suggestedInvoiceEmail,
  usableInvoiceEmail,
} from "./crmInvoiceEmail";

describe("CRM homeowner invoice email", () => {
  it("accepts a real address and ignores a blank one", () => {
    expect(usableInvoiceEmail(" home@example.com ")).toBe("home@example.com");
    expect(usableInvoiceEmail("")).toBeNull();
    expect(usableInvoiceEmail("not-an-email")).toBeNull();
  });

  it("stays enabled when an address is present even if delivery readiness is unknown", () => {
    expect(invoiceEmailButtonDisabled({ recipient: "home@example.com", pending: false })).toBe(false);
    expect(invoiceEmailButtonDisabled({ recipient: "", pending: false })).toBe(true);
    expect(invoiceEmailButtonDisabled({ recipient: "not-an-email", pending: false })).toBe(true);
    expect(invoiceEmailButtonDisabled({ recipient: "home@example.com", pending: true })).toBe(true);
  });

  it("prefers the resolved recipient over a blank lead email and names the Stripe source", () => {
    expect(suggestedInvoiceEmail(null, {
      email: "checkout@example.com",
      source: "stripe_record",
      stripeLookup: "not_needed",
    })).toBe("checkout@example.com");
    expect(suggestedInvoiceEmail("lead@example.com", {
      email: "checkout@example.com",
      source: "stripe_record",
      stripeLookup: "not_needed",
    })).toBe("checkout@example.com");
    expect(suggestedInvoiceEmail("lead@example.com", null)).toBe("lead@example.com");
    expect(invoiceEmailSourceLabel("stripe_record", "en")).toBe("from Stripe checkout");
    expect(invoiceEmailSourceLabel("order", "es")).toBe("del pedido vinculado");
    expect(invoiceEmailSourceLabel(null, "en")).toBeNull();
  });
});
