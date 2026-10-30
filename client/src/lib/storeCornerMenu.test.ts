import { describe, expect, it } from "vitest";
import { isRepeatedSignup } from "./accountAuth";
import { signInStayHref, storeAccountPath, storeAdminPath, storeCornerKind, storeSignInPath } from "./storeCornerMenu";

describe("store corner menu", () => {
  it("sends signed-out visitors to this store's sign-in and create-account pages", () => {
    expect(storeCornerKind({ signedIn: false, role: null, storeId: 7, ownedAffiliateId: null })).toBe("signed-out");
    expect(storeSignInPath("reaves-way-cabinet-shop")).toBe(
      "/store/reaves-way-cabinet-shop/signin?returnTo=%2Fstore%2Freaves-way-cabinet-shop%2Faccount",
    );
    expect(storeSignInPath("reaves-way-cabinet-shop", { createAccount: true })).toBe(
      "/store/reaves-way-cabinet-shop/signin?returnTo=%2Fstore%2Freaves-way-cabinet-shop%2Faccount&tab=signup",
    );
    expect(storeAccountPath("reaves-way-cabinet-shop")).toBe("/store/reaves-way-cabinet-shop/account");
  });

  it("gives every admin, and this store's affiliate, the store admin desk", () => {
    expect(storeCornerKind({ signedIn: true, role: "admin", storeId: 5730001, ownedAffiliateId: null })).toBe("store-admin");
    expect(storeCornerKind({ signedIn: true, role: "admin", storeId: null, ownedAffiliateId: null })).toBe("store-admin");
    expect(storeCornerKind({ signedIn: true, role: "partner", storeId: 5730001, ownedAffiliateId: 5730001 })).toBe("store-admin");
    expect(storeAdminPath(5730001)).toBe("/affiliate?viewAs=5730001");
    expect(storeAdminPath(5730001)).not.toContain("/admin");
  });

  it("gives a customer, contractor, or other store's affiliate the account page", () => {
    expect(storeCornerKind({ signedIn: true, role: "user", storeId: 5730001, ownedAffiliateId: null })).toBe("account");
    expect(storeCornerKind({ signedIn: true, role: "contractor", storeId: 5730001, ownedAffiliateId: null })).toBe("account");
    expect(storeCornerKind({ signedIn: true, role: "partner", storeId: 5730001, ownedAffiliateId: 8 })).toBe("account");
  });

  it("keeps an existing-account sign-in link on the current store page", () => {
    expect(signInStayHref("/store/reaves-way-cabinet-shop/signin", "?tab=signup&returnTo=%2Fstore%2Freaves-way-cabinet-shop%2Faccount")).toBe(
      "/store/reaves-way-cabinet-shop/signin?returnTo=%2Fstore%2Freaves-way-cabinet-shop%2Faccount",
    );
  });
});

describe("repeated signup", () => {
  it("detects Supabase's empty-identities response and ignores a real new account", () => {
    expect(isRepeatedSignup({ identities: [] })).toBe(true);
    expect(isRepeatedSignup({ identities: [{ id: "email" }] })).toBe(false);
    expect(isRepeatedSignup(null)).toBe(false);
    expect(isRepeatedSignup({})).toBe(false);
  });
});
