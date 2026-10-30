import { describe, expect, it } from "vitest";
import { portalSignInHref } from "./portalSignIn";

describe("portal sign-in links", () => {
  it("keeps a referral code when leaving the affiliate landing", () => {
    expect(portalSignInHref({
      portal: "contractor",
      pathname: "/affiliate",
      search: "?ref=FIRSTCLASS",
    })).toBe("/contractor/login?portal=contractor&returnTo=%2Fcontractor&ref=FIRSTCLASS");
    expect(portalSignInHref({
      portal: "customer",
      pathname: "/affiliate",
      search: "",
      storedRef: "REAVES",
    })).toBe("/signin?portal=customer&returnTo=%2Fcustomer&ref=REAVES");
    expect(portalSignInHref({
      portal: "affiliate",
      pathname: "/affiliate",
      search: "?ref=FIRSTCLASS",
    })).toBe("/signin?portal=affiliate&returnTo=%2Faffiliate&ref=FIRSTCLASS");
  });

  it("stays on the affiliate store sign-in page and scopes each role to that store", () => {
    expect(portalSignInHref({
      portal: "customer",
      pathname: "/store/firstclass/signin",
      search: "",
      storedRef: "FIRSTCLASS",
    })).toBe("/store/firstclass/signin?portal=customer&returnTo=%2Fstore%2Ffirstclass%2Faccount&ref=FIRSTCLASS");
    expect(portalSignInHref({
      portal: "contractor",
      pathname: "/store/reaves-way-cabinet-shop/signin",
      search: "",
    })).toBe("/store/reaves-way-cabinet-shop/signin?portal=contractor&returnTo=%2Fcontractor%3Fstore%3Dreaves-way-cabinet-shop");
    expect(portalSignInHref({
      portal: "affiliate",
      pathname: "/store/reaves-way-cabinet-shop/signin",
      search: "",
      affiliateId: 5730001,
    })).toBe("/store/reaves-way-cabinet-shop/signin?portal=affiliate&returnTo=%2Faffiliate%3FviewAs%3D5730001");
  });
});
