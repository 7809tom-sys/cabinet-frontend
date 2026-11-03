/**
 * The Brewers test: a color nobody can mistake for a finish.
 *
 * `?colorTest=brewers` (admin only, preview only, no database writes) pretends
 * Shaker Honey's accepted render is Brewers navy with gold accents. If any surface
 * of an SH cabinet renders tan while the doors render navy, the pipeline is
 * broken and it is obvious at a glance.
 *
 * The automated half feeds #12284B in as the accepted renderHex and asserts every
 * surface of an SH cabinet resolves to it — which is the same assertion a person
 * makes by looking at the preview.
 */
import { describe, expect, it } from "vitest";
import {
  BREWERS_GOLD,
  BREWERS_NAVY,
  brewersAccentHex,
  brewersTestDecision,
  brewersTestEnabled,
  isBrewersTestStyle,
} from "./brewersColorTest";
import { doorColorInputFor, resolveKitchenDoorColor } from "./acceptedDoorAppearance";
import { resolveDoorColor } from "@shared/doorColorResolve";

/** Shaker Honey as the catalog stores it, with Brewers navy as the accepted run. */
const SH_WITH_BREWERS = {
  id: 330021,
  styleCode: "SH",
  ourName: "Shaker Honey",
  aliasName: "Honey Core (Madison)",
  doorStyle: "Shaker",
  // The flat catalog hex the kitchen used to render.
  color: "#c8a040",
  renderHex: BREWERS_NAVY,
  approvedVersionId: 9001,
  approvedReferenceImageUrl: "/audit/sh-brewers.png",
};

describe("the Brewers test is preview-only and admin-only", () => {
  it("turns on only for an admin with ?colorTest=brewers", () => {
    expect(brewersTestEnabled({ search: "?colorTest=brewers", isAdmin: true })).toBe(true);
    expect(brewersTestEnabled({ search: "colorTest=Brewers", isAdmin: true })).toBe(true);
  });

  it("never turns on for a shopper, or for another test name", () => {
    expect(brewersTestEnabled({ search: "?colorTest=brewers", isAdmin: false })).toBe(false);
    expect(brewersTestEnabled({ search: "?colorTest=napa", isAdmin: true })).toBe(false);
    expect(brewersTestEnabled({ search: "", isAdmin: true })).toBe(false);
  });

  it("applies to Shaker Honey by id and by code", () => {
    expect(isBrewersTestStyle({ id: 330021, styleCode: "SH" })).toBe(true);
    expect(isBrewersTestStyle({ styleCode: "SH" })).toBe(true);
    expect(isBrewersTestStyle({ id: 330011, styleCode: "RH" })).toBe(false);
    expect(isBrewersTestStyle(null)).toBe(false);
  });

  it("uses Brewers navy for the body and Brewers gold for the accent", () => {
    expect(BREWERS_NAVY).toBe("#12284B");
    expect(BREWERS_GOLD).toBe("#FFC52F");
    expect(brewersAccentHex(true)).toBe(BREWERS_GOLD);
    expect(brewersAccentHex(false)).toBeNull();
  });
});

describe("every surface of an SH cabinet renders Brewers navy", () => {
  it("resolves #12284B as the accepted render for SH", () => {
    const decision = resolveKitchenDoorColor(SH_WITH_BREWERS);
    // The resolver normalizes hexes to lower case; the color is the same.
    expect(decision.appliedHex.toLowerCase()).toBe(BREWERS_NAVY.toLowerCase());
    expect(decision.appliedSource).toBe("accepted-render");
    // The flat catalog gold must not win anywhere.
    expect(decision.appliedHex).not.toBe("#c8a040");
  });

  it("gives front, box, sides, skin and toe kick the same hex", () => {
    const decision = resolveKitchenDoorColor(SH_WITH_BREWERS);
    // The renderer draws every surface from this one value, so a shared value is
    // the contract the Brewers preview makes visible.
    const surfaces = {
      front: decision.appliedHex,
      box: decision.appliedHex,
      sides: decision.appliedHex,
      skin: decision.appliedHex,
      toeKick: decision.appliedHex,
    };
    expect(new Set(Object.values(surfaces).map((hex) => hex.toLowerCase()))).toEqual(new Set([BREWERS_NAVY.toLowerCase()]));
  });

  it("keeps the navy through the input guard, so a non-accepted hex is the only thing dropped", () => {
    expect(doorColorInputFor(SH_WITH_BREWERS).renderHex).toBe(BREWERS_NAVY);
    // Without an accepted version the same hex is ignored, which is the guard.
    expect(doorColorInputFor({ ...SH_WITH_BREWERS, approvedVersionId: null }).renderHex).toBeNull();
  });

  it("forwards the navy as the accepted render in test mode, whatever the style said", () => {
    const plain = resolveDoorColor({ ...SH_WITH_BREWERS, renderHex: null, approvedVersionId: null });
    // With no accepted run the door takes its pre-paint-match color, never the
    // paint match #c8a040.
    expect(plain.appliedHex).toBe("#d1ba8f");
    const forced = brewersTestDecision(plain);
    expect(forced.appliedHex.toLowerCase()).toBe(BREWERS_NAVY.toLowerCase());
    expect(forced.appliedSource).toBe("render-hex");
    expect(forced.layers.renderHex).toBe(BREWERS_NAVY);
  });

  it("never writes: the test only changes what the current render resolves", () => {
    // No storage of any kind is touched. The mode is a pure function of the URL
    // and the style, so a reload with no flag returns to the real finish.
    const withTest = brewersTestDecision(resolveDoorColor(SH_WITH_BREWERS));
    const without = resolveDoorColor({ ...SH_WITH_BREWERS, renderHex: null, approvedVersionId: null });
    expect(withTest.appliedHex.toLowerCase()).toBe(BREWERS_NAVY.toLowerCase());
    expect(without.appliedHex).toBe("#d1ba8f");
  });
});
