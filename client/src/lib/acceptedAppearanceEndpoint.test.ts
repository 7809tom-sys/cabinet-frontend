/**
 * Tom's rule, at the wire: the accepted render comes from
 * `doorStyles.acceptedAppearance`, and when that endpoint is not deployed yet
 * (it answers NOT_FOUND) the kitchen still renders the door's real color.
 *
 * The failure mode this guards against is specific and expensive: before this
 * work, Shaker Honey fell back to `#c8a040`, a nearest paint-chip match that was
 * never the door's color. A missing endpoint must not reproduce that.
 */
import { describe, expect, it } from "vitest";
import {
  acceptedAppearanceUnavailable,
  doorColorFallbackHex,
  hasAcceptedAppearanceRow,
  resolveKitchenDoorColor,
  shouldRetryAcceptedAppearance,
  withAcceptedAppearance,
  type AcceptedAppearanceRow,
} from "./acceptedDoorAppearance";
import { toAcceptedAppearanceRows } from "./acceptedAppearanceQuery";

/** Shaker Honey as the catalog row comes back today. */
const SH_ROW = {
  id: 330021,
  styleCode: "SH",
  ourName: "Shaker Honey",
  aliasName: "Honey Core (Madison)",
  doorStyle: "Shaker",
  woodSpecies: "Solid Birch frame / veneered center panel",
  // The paint-match hex still stored on the row.
  color: "#c8a040",
  doorSampleImageUrl: "/manus-storage/sh-sample.jpg",
};

/** The accepted audit run Tom approved: texture plus the tone derived from it. */
const ACCEPTED_ROW: AcceptedAppearanceRow = {
  styleId: 330021,
  colorHex: "#d6bb92",
  textureUrl: "/manus-storage/door-rendering-audit/sh-accepted-2517.png",
  approvedVersionId: 2517,
};

/** The color the door rendered in before the paint match. */
const PRE_PAINT_MATCH = "#d1ba8f";

describe("the endpoint's row becomes the door's accepted appearance", () => {
  it("merges the accepted color, texture and acceptance marker onto the style", () => {
    const merged = withAcceptedAppearance(SH_ROW, ACCEPTED_ROW)!;
    expect(merged.renderHex).toBe("#d6bb92");
    expect(merged.approvedReferenceImageUrl).toBe(ACCEPTED_ROW.textureUrl);
    expect(merged.approvedVersionId).toBe(2517);
  });

  it("renders the accepted color and never the paint match", () => {
    const merged = withAcceptedAppearance(SH_ROW, ACCEPTED_ROW)!;
    const decision = resolveKitchenDoorColor(merged);
    expect(decision.appliedHex).toBe("#d6bb92");
    expect(decision.appliedSource).toBe("accepted-render");
    expect(decision.appliedHex).not.toBe("#c8a040");
  });

  it("carries the accepted texture through to the face plan", () => {
    const merged = withAcceptedAppearance(SH_ROW, ACCEPTED_ROW)!;
    // The kitchen draws the signed-off render itself, not the catalog sample.
    expect(merged.approvedReferenceImageUrl).toBe("/manus-storage/door-rendering-audit/sh-accepted-2517.png");
    expect(merged.doorSampleImageUrl).toBe("/manus-storage/sh-sample.jpg");
  });

  it("keeps the style's own wood species and finish, so the grain category survives", () => {
    const merged = withAcceptedAppearance(SH_ROW, ACCEPTED_ROW)!;
    expect(merged.woodSpecies).toBe("Solid Birch frame / veneered center panel");
    expect(merged.ourName).toBe("Shaker Honey");
  });
});

describe("a missing endpoint falls back to the pre-paint-match original", () => {
  it("treats NOT_FOUND as 'not deployed yet', not as a failure", () => {
    expect(acceptedAppearanceUnavailable({ data: { code: "NOT_FOUND" } })).toBe(true);
    expect(acceptedAppearanceUnavailable({ shape: { data: { code: "NOT_FOUND" } } })).toBe(true);
    expect(acceptedAppearanceUnavailable(new Error("No procedure found on path doorStyles.acceptedAppearance"))).toBe(true);
  });

  it("does not swallow a real failure", () => {
    expect(acceptedAppearanceUnavailable({ data: { code: "INTERNAL_SERVER_ERROR" } })).toBe(false);
    expect(acceptedAppearanceUnavailable({ message: "Database is down" })).toBe(false);
    expect(acceptedAppearanceUnavailable(null)).toBe(false);
  });

  it("does not retry a route that does not exist, and retries a real failure", () => {
    expect(shouldRetryAcceptedAppearance(0, { data: { code: "NOT_FOUND" } })).toBe(false);
    expect(shouldRetryAcceptedAppearance(0, { data: { code: "TIMEOUT" } })).toBe(true);
    expect(shouldRetryAcceptedAppearance(9, { data: { code: "TIMEOUT" } })).toBe(false);
  });

  it("leaves the style untouched when there is no row at all", () => {
    const merged = withAcceptedAppearance(SH_ROW, null)!;
    expect(merged.renderHex).toBeUndefined();
    expect(merged.approvedVersionId).toBeUndefined();
  });

  it("ignores a row that carries no accepted version", () => {
    // The endpoint returns a row for every id it was asked about, with nulls when
    // nothing is approved. That must not be read as an approval.
    const empty: AcceptedAppearanceRow = { styleId: 330021, colorHex: null, textureUrl: null, approvedVersionId: null };
    expect(hasAcceptedAppearanceRow(empty)).toBe(false);
    const merged = withAcceptedAppearance(SH_ROW, empty)!;
    expect(merged.renderHex).toBeUndefined();
  });

  it("renders the pre-paint-match original, never #c8a040", () => {
    const merged = withAcceptedAppearance(SH_ROW, null)!;
    const decision = resolveKitchenDoorColor(merged);
    expect(decision.appliedHex).toBe(PRE_PAINT_MATCH);
    expect(decision.appliedHex).not.toBe("#c8a040");
    expect(decision.usesGrain).toBe(true);
  });

  it("reports the same fallback through the explicit helper", () => {
    expect(doorColorFallbackHex(SH_ROW)).toBe(PRE_PAINT_MATCH);
    expect(doorColorFallbackHex(null)).toBeNull();
  });

  it("still falls back safely for a style that was never paint-matched", () => {
    // No accepted run and no paint match: the style's own color decides.
    const other = { id: 330020, ourName: "Shaker Black", doorStyle: "Shaker", color: "#1a1a1a" };
    expect(resolveKitchenDoorColor(other).appliedHex).toBe("#1a1a1a");
  });
});

describe("the query's data is normalised to a list", () => {
  it("wraps a single row and passes a list through", () => {
    expect(toAcceptedAppearanceRows(ACCEPTED_ROW)).toEqual([ACCEPTED_ROW]);
    expect(toAcceptedAppearanceRows([ACCEPTED_ROW])).toEqual([ACCEPTED_ROW]);
    expect(toAcceptedAppearanceRows(undefined)).toEqual([]);
    expect(toAcceptedAppearanceRows(null)).toEqual([]);
  });
});
