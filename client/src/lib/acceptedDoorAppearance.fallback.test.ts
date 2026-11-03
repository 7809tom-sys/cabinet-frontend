/**
 * What the merged frontend does when the backend `acceptedAppearance` writeback is
 * NOT applied yet.
 *
 * The owner asked this be confirmed rather than assumed. The backend patch that
 * writes `renderHex` / `approvedReferenceImageUrl` / `approvedVersionId` onto a door
 * style ships separately. If the frontend goes out first, every style arrives with
 * those fields absent (`undefined`) or null.
 *
 * The required behaviour: no error, no blank cabinet, no thrown exception — the
 * kitchen renders the style's own saved catalog color, exactly as it did before the
 * accepted-render feature existed. These tests pin that.
 */
import { describe, expect, it, vi } from "vitest";
import {
  designStyleIds,
  doorColorInputFor,
  hasAcceptedDoorAppearance,
  kitchenAcceptedFaceImage,
  resolveKitchenDoorColor,
  styleSampleFaceImage,
} from "./acceptedDoorAppearance";
import { invalidateDoorStyleCaches } from "./doorStyleCacheInvalidation";

/** A style row exactly as an un-patched backend returns it: no accepted fields. */
const UNPATCHED_STYLE = {
  id: 330021,
  styleCode: "SH",
  ourName: "Shaker Honey",
  doorStyle: "Shaker",
  color: "#c8a040",
  doorSampleImageUrl: "/manus-storage/sh-sample.jpg",
  // Note: approvedVersionId, renderHex and approvedReferenceImageUrl are ABSENT,
  // not null. That is what a query selecting only the old columns returns.
};

describe("no acceptedAppearance writeback yet: fall back, never error", () => {
  it("treats missing accepted fields as 'no accepted run' and does not throw", () => {
    expect(() => hasAcceptedDoorAppearance(UNPATCHED_STYLE)).not.toThrow();
    expect(hasAcceptedDoorAppearance(UNPATCHED_STYLE)).toBe(false);
    expect(doorColorInputFor(UNPATCHED_STYLE).renderHex).toBeNull();
  });

  it("resolves the style's own saved catalog color, exactly as before the feature", () => {
    const decision = resolveKitchenDoorColor(UNPATCHED_STYLE);
    expect(decision.appliedHex).toBe("#c8a040");
    expect(decision.candidateSource).toBe("catalog-color");
    // No accepted image, so the style's own sample photo is used.
    expect(kitchenAcceptedFaceImage(UNPATCHED_STYLE)).toBeNull();
    expect(styleSampleFaceImage(UNPATCHED_STYLE)).toBe("/manus-storage/sh-sample.jpg");
  });

  it("also survives explicit nulls, which a patched-but-empty backend returns", () => {
    const nulls = { ...UNPATCHED_STYLE, renderHex: null, approvedVersionId: null, approvedReferenceImageUrl: null };
    expect(hasAcceptedDoorAppearance(nulls)).toBe(false);
    expect(resolveKitchenDoorColor(nulls).appliedHex).toBe("#c8a040");
  });

  it("survives a backend that returns the fields on some rows but not others", () => {
    const mixed = [
      UNPATCHED_STYLE,
      { ...UNPATCHED_STYLE, id: 330011, styleCode: "RH", ourName: "Ashford Rustic Hickory", color: "#73482a" },
      { ...UNPATCHED_STYLE, id: 540005, styleCode: "LSA", color: "#f4f1ea" },
    ];
    for (const style of mixed) {
      expect(() => resolveKitchenDoorColor(style)).not.toThrow();
      expect(resolveKitchenDoorColor(style).appliedHex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("still collects the style ids the kitchen needs, so the wiring is harmless", () => {
    expect(designStyleIds({ designStyleId: 330021, cabinetStyleIds: [330021, 540005, null] }))
      .toEqual([330021, 540005]);
  });
});

describe("invalidating a query that does not exist on the old backend is harmless", () => {
  it("does not throw when acceptedAppearance is absent from the router", () => {
    // An un-patched backend has no doorStyles.acceptedAppearance, so the tRPC util
    // is undefined. The invalidation must tolerate that instead of breaking a save.
    const list = { invalidate: vi.fn() };
    const utils = { doorStyles: { list, listForAdmin: { invalidate: vi.fn() } } };
    expect(() => invalidateDoorStyleCaches(utils)).not.toThrow();
    expect(list.invalidate).toHaveBeenCalled();
  });
});
