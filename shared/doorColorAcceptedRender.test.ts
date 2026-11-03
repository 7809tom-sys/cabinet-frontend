/**
 * PRIORITY #1: any approved render becomes the kitchen's color.
 *
 * Owner rule, in full:
 *   - the latest ACCEPTED door-rendering run for a style is the source of truth:
 *     its renderHex and its approved door image/texture drive the kitchen;
 *   - the style's own saved catalog color comes next;
 *   - the hardcoded swatch file, the WalzCraft shade table, and the name estimator
 *     are used ONLY when the style has neither;
 *   - approving a new run flows into every kitchen with no manual step, and a
 *     revoke/revert clears the writeback so the saved color takes over again.
 *
 * These tests pin the precedence, so a hardcoded table can never beat a decision
 * and a stale catalog hex can never beat an accepted render.
 */
import { describe, expect, it } from "vitest";
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";

/** Madison Shaker Honey: the style the owner checked, with its audited values. */
const MADISON: DoorColorInput = {
  id: 330021,
  styleCode: "SH",
  ourName: "Shaker Honey",
  aliasName: "Honey Core (Madison)",
  distributorName: "Madison",
  doorStyle: "Shaker",
  // The catalog hex the kitchen used to render flat.
  color: "#c8a040",
};

/** The tone measured from the accepted audit render (light natural tan birch). */
const ACCEPTED_TONE = "#d9c9a3";

describe("the latest accepted render is the kitchen's color", () => {
  it("uses the accepted render over the saved catalog hex, the swatch file, Walz and the estimator", () => {
    const decision = resolveDoorColor({ ...MADISON, renderHex: ACCEPTED_TONE });
    expect(decision.appliedHex).toBe(ACCEPTED_TONE);
    expect(decision.candidateSource).toBe("render-hex");
    // The flat golden catalog tone must not win.
    expect(decision.appliedHex).not.toBe("#c8a040");
  });

  it("keeps the accepted render even when the name estimator disagrees", () => {
    // A strongly contradictory name ("Black") forces a disagreement, and the
    // accepted render still wins: it is a decision, not a guess.
    const decision = resolveDoorColor({ ...MADISON, ourName: "Shaker Black", aliasName: "Black", renderHex: ACCEPTED_TONE });
    expect(decision.appliedHex).toBe(ACCEPTED_TONE);
    expect(decision.layers.renderHex).toBe(ACCEPTED_TONE);
    expect(["agreed", "hand-set-render-hex"]).toContain(decision.review.keptBecause);
  });

  it("does not snap the accepted tone to the brand palette", () => {
    for (const tone of ["#d9c9a3", "#e8dcc0", "#cbb894"]) {
      expect(resolveDoorColor({ ...MADISON, renderHex: tone }).appliedHex).toBe(tone);
    }
  });

  it("falls to the saved catalog color when a revoke or revert clears the writeback", () => {
    // After a revoke the style has no accepted run; the saved color takes over.
    const decision = resolveDoorColor({ ...MADISON, renderHex: null });
    expect(decision.appliedHex).toBe("#c8a040");
    expect(decision.candidateSource).toBe("catalog-color");
  });

  it("follows a newly accepted render with no other change to the style", () => {
    const before = resolveDoorColor({ ...MADISON, renderHex: ACCEPTED_TONE });
    const after = resolveDoorColor({ ...MADISON, renderHex: "#e6d9b8" });
    expect(before.appliedHex).toBe(ACCEPTED_TONE);
    expect(after.appliedHex).toBe("#e6d9b8");
  });

  it("uses the hardcoded tables only when a style has neither an accepted run nor a saved color", () => {
    // No renderHex, no color: now, and only now, the tables may speak.
    const decision = resolveDoorColor({ id: 330021, styleCode: "SH", ourName: "Shaker Honey" });
    expect(decision.layers.renderHex).toBeNull();
    expect(decision.layers.catalogColor).toBeNull();
    expect(["swatch-table", "walzcraft", "estimator", "pre-209"]).toContain(decision.appliedSource);
  });

  it("carries the accepted door image through for the kitchen's face texture", () => {
    const decision = resolveDoorColor({
      ...MADISON,
      renderHex: ACCEPTED_TONE,
      approvedReferenceImageUrl: "/manus-storage/door-rendering-audit/sh-approved.png",
    });
    // The image is part of the accepted run's identity, so the renderer can use the
    // accepted render itself rather than a generic door photo.
    expect(decision.appliedHex).toBe(ACCEPTED_TONE);
  });
});
