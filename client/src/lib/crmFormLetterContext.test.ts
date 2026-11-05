import { describe, expect, it } from "vitest";
import {
  ADMIN_CRM_SENDER_PROFILE,
  affiliateCrmSenderProfile,
  contractorCrmSenderProfile,
} from "@shared/crmFormLetters";

/**
 * The hook itself is a thin tRPC wrapper; what it must guarantee is that each
 * role reads its identity from the record that actually exists.
 */
describe("CRM form-letter sender identity per role", () => {
  it("signs affiliate letters with the store record the storefront already shows", () => {
    const profile = affiliateCrmSenderProfile({
      storeName: "Reaves Way Cabinet Shop",
      publicAddress: "1200 Main St, Sarasota, FL",
      serviceArea: "Sarasota & Manatee County, FL",
      publicPhone: "941-555-0100",
      publicEmail: "hello@reavesway.test",
    });
    expect(profile).toEqual({
      role: "affiliate",
      companyName: "Reaves Way Cabinet Shop",
      location: "1200 Main St, Sarasota, FL",
      phone: "941-555-0100",
      email: "hello@reavesway.test",
    });
  });

  it("falls back to the service area when the store has no public address", () => {
    expect(affiliateCrmSenderProfile({
      storeName: "Harbor Cabinets",
      serviceArea: "Naples & Bonita Springs",
      publicPhone: "239-555-0134",
    }).location).toBe("Naples & Bonita Springs");
  });

  it("uses only contractor fields that exist and leaves the rest blank for brackets", () => {
    const profile = contractorCrmSenderProfile({ businessName: "Hale Builds", phone: "941-555-0177" });
    expect(profile.companyName).toBe("Hale Builds");
    expect(profile.phone).toBe("941-555-0177");
    expect(profile.location).toBeNull();
    expect(profile.email).toBeNull();
  });

  it("keeps house letters on the Cabinet Dealz brand", () => {
    expect(ADMIN_CRM_SENDER_PROFILE).toMatchObject({ role: "admin", companyName: "Cabinet Dealz" });
  });
});
