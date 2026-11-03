/**
 * Tom's door-color rule: the ACCEPTED render is the source of truth.
 *
 * The owner rule, in full:
 *   - the latest ACCEPTED door-rendering run for a style is the authority: its
 *     derived color and its approved render drive the kitchen, texture included;
 *   - the style's own saved catalog color comes next;
 *   - a hand-set render hex is an explicit correction and is honoured;
 *   - the hardcoded tables are a last resort;
 *   - a nearest paint-chip match is NEVER the door's color. Shaker Honey's
 *     `#c8a040` was such a match, and Tom confirmed it was not the door.
 *
 * These tests pin that precedence so a stale table or a paint match can never
 * beat a real decision again.
 */
import { describe, expect, it } from "vitest";
import { PRE_PAINT_MATCH_ORIGINALS, resolveDoorColor, type DoorColorInput } from "./doorColorResolve";

/** Madison Shaker Honey: the style Tom checked, with its audited values. */
const MADISON: DoorColorInput = {
  id: 330021,
  styleCode: "SH",
  ourName: "Shaker Honey",
  aliasName: "Honey Core (Madison)",
  distributorName: "Madison",
  woodSpecies: "Solid Birch frame / veneered center panel",
  doorStyle: "Shaker",
  // The paint-match hex the kitchen wrongly rendered flat, still stored on the row.
  color: "#c8a040",
};

/** Madison's own catalog finish for SH. The door is a stain, not an opaque paint. */
const SH_CATEGORY = "stain";

/** The tone measured from the accepted audit render (light natural tan birch). */
const ACCEPTED_TONE = "#d9c9a3";

/** The pre-paint-match original: what the door rendered in before the paint match. */
const PRE_PAINT_MATCH = PRE_PAINT_MATCH_ORIGINALS[330021]!.hex;

function accepted(overrides: Partial<DoorColorInput> = {}): DoorColorInput {
  return { ...MADISON, approvedVersionId: 4102, renderHex: ACCEPTED_TONE, ...overrides };
}

describe("the accepted render is the door's color and texture", () => {
  it("uses the accepted render over the paint match, the saved hex and every table", () => {
    const decision = resolveDoorColor(accepted());
    expect(decision.appliedHex).toBe(ACCEPTED_TONE);
    expect(decision.appliedSource).toBe("accepted-render");
    expect(decision.candidateSource).toBe("accepted-render");
    // The paint match must not win anywhere in the decision.
    expect(decision.appliedHex).not.toBe("#c8a040");
    expect(decision.pre209Hex).toBe(PRE_PAINT_MATCH);
  });

  it("keeps the accepted render even when the name estimator disagrees", () => {
    // A strongly contradictory name ("Black") forces a disagreement, and the
    // accepted render still wins: it is a decision, not a guess.
    const decision = resolveDoorColor(accepted({ ourName: "Shaker Black", aliasName: "Black" }));
    expect(decision.appliedHex).toBe(ACCEPTED_TONE);
    expect(decision.layers.acceptedRender?.hex).toBe(ACCEPTED_TONE);
    expect(decision.review.keptBecause).toBe("accepted-render");
    // Flagged for a human, but still the approved color.
    expect(decision.review.needsColorReview).toBe(true);
  });

  it("does not snap the accepted tone to the brand palette", () => {
    for (const tone of ["#d9c9a3", "#e8dcc0", "#cbb894"]) {
      expect(resolveDoorColor(accepted({ renderHex: tone })).appliedHex).toBe(tone);
    }
  });

  it("follows a newly accepted render with no other change to the style", () => {
    const before = resolveDoorColor(accepted());
    const after = resolveDoorColor(accepted({ renderHex: "#e6d9b8" }));
    expect(before.appliedHex).toBe(ACCEPTED_TONE);
    expect(after.appliedHex).toBe("#e6d9b8");
    expect(after.appliedSource).toBe("accepted-render");
  });

  it("carries the accepted door image through for the kitchen's face texture", () => {
    const decision = resolveDoorColor(accepted({
      approvedReferenceImageUrl: "/manus-storage/door-rendering-audit/sh-approved.png",
    }));
    expect(decision.appliedHex).toBe(ACCEPTED_TONE);
    expect(decision.appliedSource).toBe("accepted-render");
  });
});

describe("a nearest paint match is never the door's color", () => {
  it("falls to the pre-paint-match original after a revoke, never to #c8a040", () => {
    // After a revoke the style has no accepted run and its saved color is the
    // paint match. The door takes the color it had before the paint match.
    const decision = resolveDoorColor({ ...MADISON, renderHex: null, approvedVersionId: null });
    expect(decision.appliedHex).toBe(PRE_PAINT_MATCH);
    expect(decision.appliedHex).not.toBe("#c8a040");
    expect(decision.pre209Hex).toBe(PRE_PAINT_MATCH);
  });

  it("treats the paint-match hex as a stain, because SH is a stained birch door", () => {
    const decision = resolveDoorColor({ ...MADISON, renderHex: null });
    expect(decision.appliedCategory).toBe(SH_CATEGORY);
    expect(decision.usesGrain).toBe(true);
  });

  it("ignores the demoted swatch row entirely", () => {
    const decision = resolveDoorColor({ ...MADISON, color: null });
    // The swatch row for 330021 is the paint match and is demoted, so it is not
    // a candidate. The pre-paint-match original speaks instead.
    expect(decision.layers.swatch).toBeNull();
    expect(decision.appliedHex).toBe(PRE_PAINT_MATCH);
  });

  it("never applies a demoted row even when it would otherwise be the only layer", () => {
    const decision = resolveDoorColor({ id: 330021, ourName: "Shaker Honey", doorStyle: "Shaker" });
    expect(decision.appliedHex).not.toBe("#c8a040");
    expect(decision.layers.swatch).toBeNull();
  });

  it("still lets a saved color win when the saved color is NOT the paint match", () => {
    // An admin's own saved color is a decision and outranks the tables.
    const decision = resolveDoorColor({ ...MADISON, color: "#cbb894", renderHex: null });
    expect(decision.appliedHex).toBe("#cbb894");
    expect(decision.appliedSource).toBe("catalog-color");
    // The estimator agreed with this tone, so it is not flagged for review.
    expect(decision.review.keptBecause).toBe("agreed");
  });
});

describe("a render hex typed without accepting a run is a hand edit", () => {
  it("is applied, but is not called an accepted render", () => {
    const typed = resolveDoorColor({ ...MADISON, renderHex: ACCEPTED_TONE, approvedVersionId: null });
    expect(typed.appliedHex).toBe(ACCEPTED_TONE);
    expect(typed.appliedSource).toBe("render-hex");
    expect(typed.layers.acceptedRender).toBeNull();
  });

  it("never falls back to the paint match when the typed hex is malformed", () => {
    const broken = resolveDoorColor({ ...MADISON, renderHex: "light tan", approvedVersionId: 9 });
    expect(broken.appliedHex).not.toBe("#c8a040");
    expect(broken.appliedHex).toBe(PRE_PAINT_MATCH);
  });
});
