import { describe, expect, it } from "vitest";
import {
  SIGN_IN_REDIRECT_LOOP_WINDOW_MS,
  decideSignInNavigation,
  isAdminReturnPath,
  loadSignInRedirectHistory,
  saveSignInRedirectHistory,
} from "./signInRedirect";

describe("sign-in redirect loop guard", () => {
  it("sends a new affiliate member to the server destination after they sign in", () => {
    const decision = decideSignInNavigation({
      role: "user",
      requestedReturn: "/affiliate",
      serverDestination: "/affiliate?viewAs=9",
      automatic: false,
      history: [],
      now: 1_000,
    });
    expect(decision.destination).toBe("/affiliate?viewAs=9");
  });

  it("does not auto-redirect back to the page that just sent a signed-in user to sign-in", () => {
    const signedIn = decideSignInNavigation({
      role: "user",
      requestedReturn: "/affiliate?viewAs=5",
      serverDestination: "/affiliate?viewAs=5",
      automatic: false,
      history: [],
      now: 1_000,
    });
    const bounce = decideSignInNavigation({
      role: "user",
      requestedReturn: "/affiliate?viewAs=5",
      serverDestination: "/affiliate?viewAs=5",
      automatic: true,
      history: signedIn.history,
      now: 2_000,
    });
    expect(bounce.destination).toBeNull();
  });

  it("treats a different viewAs query on the same path as the same redirect hop", () => {
    const signedIn = decideSignInNavigation({
      role: "user",
      requestedReturn: "/affiliate",
      serverDestination: "/affiliate?viewAs=5",
      automatic: false,
      history: [],
      now: 1_000,
    });
    const bounce = decideSignInNavigation({
      role: "user",
      requestedReturn: "/affiliate",
      serverDestination: "/affiliate?viewAs=8",
      automatic: true,
      history: signedIn.history,
      now: 3_000,
    });
    expect(bounce.destination).toBeNull();
  });

  it("still allows the first automatic redirect when Google returns with a session", () => {
    const decision = decideSignInNavigation({
      role: "user",
      requestedReturn: "/affiliate",
      serverDestination: "/affiliate?viewAs=3",
      automatic: true,
      history: [],
      now: 1_000,
    });
    expect(decision.destination).toBe("/affiliate?viewAs=3");
  });

  it("allows another automatic redirect after the loop window expires", () => {
    const signedIn = decideSignInNavigation({
      role: "user",
      requestedReturn: "/affiliate",
      serverDestination: "/affiliate?viewAs=5",
      automatic: false,
      history: [],
      now: 1_000,
    });
    const later = decideSignInNavigation({
      role: "user",
      requestedReturn: "/affiliate",
      serverDestination: "/affiliate?viewAs=5",
      automatic: true,
      history: signedIn.history,
      now: 1_000 + SIGN_IN_REDIRECT_LOOP_WINDOW_MS,
    });
    expect(later.destination).toBe("/affiliate?viewAs=5");
  });

  it("does not navigate an automatic redirect back onto the sign-in page", () => {
    const decision = decideSignInNavigation({
      role: "user",
      requestedReturn: "/account",
      serverDestination: "/signin?returnTo=%2Faccount",
      automatic: true,
      history: [],
      now: 1_000,
    });
    expect(decision.destination).toBeNull();
  });
});

describe("admin sign-in destination", () => {
  it("honors returnTo=/admin for an admin when the server picked an affiliate portal", () => {
    const decision = decideSignInNavigation({
      role: "admin",
      requestedReturn: "/admin?tab=cabinet-attention",
      serverDestination: "/affiliate?viewAs=5",
      automatic: true,
      history: [],
      now: 1_000,
    });
    expect(decision.destination).toBe("/admin?tab=cabinet-attention");
  });

  it("honors a nested admin return path", () => {
    expect(isAdminReturnPath("/admin/catalog-import")).toBe(true);
    expect(isAdminReturnPath("/administrator")).toBe(false);
    expect(isAdminReturnPath("/affiliate")).toBe(false);
  });

  it("does not send a non-admin to /admin just because that path was requested", () => {
    const decision = decideSignInNavigation({
      role: "user",
      requestedReturn: "/admin",
      serverDestination: "/affiliate?viewAs=3",
      automatic: false,
      history: [],
      now: 1_000,
    });
    expect(decision.destination).toBe("/affiliate?viewAs=3");
  });

  it("stops a second automatic hop from bouncing an admin between /admin and sign-in", () => {
    const first = decideSignInNavigation({
      role: "admin",
      requestedReturn: "/admin",
      serverDestination: "/affiliate?viewAs=5",
      automatic: true,
      history: [],
      now: 1_000,
    });
    expect(first.destination).toBe("/admin");
    const second = decideSignInNavigation({
      role: "admin",
      requestedReturn: "/admin",
      serverDestination: "/affiliate?viewAs=5",
      automatic: true,
      history: first.history,
      now: 2_000,
    });
    expect(second.destination).toBeNull();
  });
});

describe("sign-in redirect history storage", () => {
  it("round-trips recent hops and drops malformed entries", () => {
    const saved: { value: string | null } = { value: null };
    const storage = {
      getItem: () => saved.value,
      setItem: (_key: string, value: string) => {
        saved.value = value;
      },
    };
    saveSignInRedirectHistory(storage, [{ destination: "/affiliate?viewAs=5", at: 1_000 }]);
    expect(loadSignInRedirectHistory(storage, 1_500)).toEqual([{ destination: "/affiliate?viewAs=5", at: 1_000 }]);
    saved.value = JSON.stringify([{ destination: "/affiliate", at: 1_000 }, { nope: true }, "bad"]);
    expect(loadSignInRedirectHistory(storage, 1_500)).toEqual([{ destination: "/affiliate", at: 1_000 }]);
    saved.value = "not-json";
    expect(loadSignInRedirectHistory(storage, 1_500)).toEqual([]);
  });
});
