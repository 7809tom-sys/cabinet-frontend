import { describe, expect, it } from "vitest";
import { validateVendorReferral, type VendorReferralDraft } from "./vendorReferralForm";

const draft = (overrides: Partial<VendorReferralDraft> = {}): VendorReferralDraft => ({
  vendorName: "Northwind Cabinets",
  contactName: "",
  email: "",
  phone: "555-0100",
  notes: "",
  ...overrides,
});

describe("validateVendorReferral", () => {
  it("requires a vendor name", () => {
    const result = validateVendorReferral(draft({ vendorName: "   " }));
    expect(result).toEqual({ ok: false, message: "Enter the vendor name.", field: "vendorName" });
  });

  it("requires an email or a phone number", () => {
    const result = validateVendorReferral(draft({ email: "  ", phone: "" }));
    expect(result).toEqual({ ok: false, message: "Enter an email or a phone number.", field: "contact" });
  });

  it("rejects a malformed email", () => {
    const result = validateVendorReferral(draft({ email: "owner@northwind", phone: "" }));
    expect(result).toEqual({ ok: false, message: "Enter a valid email address.", field: "email" });
  });

  it("sends only the filled fields", () => {
    const result = validateVendorReferral(draft({
      vendorName: "  Northwind Cabinets ",
      contactName: " Ada ",
      email: " ada@northwind.example ",
      phone: "",
      notes: "  Ships unfinished boxes. ",
    }));
    expect(result).toEqual({
      ok: true,
      value: {
        vendorName: "Northwind Cabinets",
        contactName: "Ada",
        email: "ada@northwind.example",
        notes: "Ships unfinished boxes.",
      },
    });
  });

  it("keeps a phone number when email is blank", () => {
    const result = validateVendorReferral(draft({ email: "", phone: " 555-0100 " }));
    expect(result).toEqual({
      ok: true,
      value: { vendorName: "Northwind Cabinets", phone: "555-0100" },
    });
  });
});
