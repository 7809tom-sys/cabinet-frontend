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

  it("stays on the affiliate store sign-in page for every role", () => {
    const href = portalSignInHref({
      portal: "customer",
      pathname: "/store/firstclass/signin",
      search: "",
      storedRef: "FIRSTCLASS",
    });
    expect(href).toBe("/store/firstclass/signin?portal=customer&returnTo=%2Fcustomer&ref=FIRSTCLASS");
  });
});
