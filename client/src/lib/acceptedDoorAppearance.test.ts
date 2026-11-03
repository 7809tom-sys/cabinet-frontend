/**
 * PRIORITY item 1: the frontend wiring for the accepted door appearance.
 *
 * The resolver is only half the fix. Two more things have to be true or an
 * approved render still will not reach a kitchen:
 *
 *   1. a color typed into the style editor must not masquerade as an approved
 *      render (that is what `approvedVersionId` is for), and
 *   2. a save or an approval must clear the caches the KITCHEN reads, not only the
 *      admin lists, or an open Designer keeps rendering the old color.
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
import { KITCHEN_DOOR_STYLE_QUERIES, invalidateDoorStyleCaches } from "./doorStyleCacheInvalidation";

const MADISON = {
  id: 330021,
  styleCode: "SH",
  ourName: "Shaker Honey",
  aliasName: "Honey Core (Madison)",
  doorStyle: "Shaker",
  color: "#c8a040",
  doorSampleImageUrl: "/manus-storage/sh-sample.jpg",
};

describe("only an accepted run drives the kitchen", () => {
  it("uses the accepted run's color and image", () => {
    const style = { ...MADISON, renderHex: "#d9c9a3", approvedVersionId: 42, approvedReferenceImageUrl: "/audit/sh-approved.png" };
    expect(hasAcceptedDoorAppearance(style)).toBe(true);
    expect(resolveKitchenDoorColor(style).appliedHex).toBe("#d9c9a3");
    expect(kitchenAcceptedFaceImage(style)).toBe("/audit/sh-approved.png");
  });

  it("ignores a renderHex typed into the editor with no accepted run", () => {
    // An admin can type a color without ever accepting a render. That must not
    // claim to be approved, or a hand edit would silently outrank the catalog.
    const style = { ...MADISON, renderHex: "#d9c9a3", approvedVersionId: null };
    expect(hasAcceptedDoorAppearance(style)).toBe(false);
    expect(doorColorInputFor(style).renderHex).toBeNull();
    expect(resolveKitchenDoorColor(style).appliedHex).toBe("#c8a040");
    expect(kitchenAcceptedFaceImage(style)).toBeNull();
  });

  it("falls back to the style's saved color and its own sample photo after a revoke", () => {
    const revoked = { ...MADISON, renderHex: null, approvedVersionId: null, approvedReferenceImageUrl: null };
    const decision = resolveKitchenDoorColor(revoked);
    expect(decision.appliedHex).toBe("#c8a040");
    expect(decision.candidateSource).toBe("catalog-color");
    // No approved image, so the caller keeps the sample photo.
    expect(kitchenAcceptedFaceImage(revoked)).toBeNull();
    expect(styleSampleFaceImage(revoked)).toBe("/manus-storage/sh-sample.jpg");
  });

  it("rejects a malformed render hex even when a version is approved", () => {
    const broken = { ...MADISON, renderHex: "light tan", approvedVersionId: 7 };
    expect(hasAcceptedDoorAppearance(broken)).toBe(false);
    expect(resolveKitchenDoorColor(broken).appliedHex).toBe("#c8a040");
  });

  it("never snaps an accepted tone to the palette", () => {
    for (const tone of ["#d9c9a3", "#cbb894", "#efe6cd"]) {
      const style = { ...MADISON, renderHex: tone, approvedVersionId: 1 };
      expect(resolveKitchenDoorColor(style).appliedHex).toBe(tone);
    }
  });

  it("handles a style that is missing or has no color at all", () => {
    expect(hasAcceptedDoorAppearance(null)).toBe(false);
    expect(hasAcceptedDoorAppearance(undefined)).toBe(false);
    expect(doorColorInputFor(null)).toEqual({});
    expect(() => resolveKitchenDoorColor(null)).not.toThrow();
    expect(styleSampleFaceImage(null)).toBeNull();
  });
});

describe("a save or approval clears the caches the kitchen reads", () => {
  it("invalidates doorStyles.list and acceptedAppearance, not just the admin lists", () => {
    const invalidate = () => vi.fn();
    const utils = {
      doorStyles: {
        list: { invalidate: invalidate() },
        acceptedAppearance: { invalidate: invalidate() },
        byId: { invalidate: invalidate() },
        listForAdmin: { invalidate: invalidate() },
        featured: { invalidate: invalidate() },
        skuCountsByStyle: { invalidate: invalidate() },
      },
      design: { placeableCabinets: { invalidate: invalidate() } },
    };
    const cleared = invalidateDoorStyleCaches(utils);
    for (const query of KITCHEN_DOOR_STYLE_QUERIES) expect(cleared).toContain(query);
    expect(utils.doorStyles.list.invalidate).toHaveBeenCalled();
    expect(utils.doorStyles.acceptedAppearance.invalidate).toHaveBeenCalled();
    expect(utils.doorStyles.listForAdmin.invalidate).toHaveBeenCalled();
  });

  it("tolerates a screen that has only some of the queries", () => {
    const list = { invalidate: vi.fn() };
    expect(invalidateDoorStyleCaches({ doorStyles: { list } })).toEqual(["doorStyles.list"]);
    expect(list.invalidate).toHaveBeenCalled();
    expect(invalidateDoorStyleCaches(null)).toEqual([]);
    expect(invalidateDoorStyleCaches(undefined)).toEqual([]);
  });

  it("never throws when a query is unmounted or its invalidate fails", () => {
    const utils = {
      doorStyles: {
        list: { invalidate: () => { throw new Error("unmounted"); } },
        acceptedAppearance: { invalidate: vi.fn() },
      },
    };
    expect(() => invalidateDoorStyleCaches(utils)).not.toThrow();
    expect(utils.doorStyles.acceptedAppearance.invalidate).toHaveBeenCalled();
  });
});

describe("one query can cover a whole plan", () => {
  it("collects the design style and every cabinet override without duplicates", () => {
    expect(designStyleIds({ designStyleId: 330011, cabinetStyleIds: [330011, 540005, null, 0, 540005] }))
      .toEqual([330011, 540005]);
    expect(designStyleIds({})).toEqual([]);
    expect(designStyleIds({ cabinetStyleIds: [null, undefined] })).toEqual([]);
  });
});
