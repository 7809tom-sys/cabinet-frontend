import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESIGNER_OFF_REASON,
  activeDesignerOverride,
  designerFlagReason,
  designerOffAttribution,
  designerOffExpired,
  designerOffLabel,
  designerOffPayload,
  designerOverrideDecision,
  isDesignerTurnedOff,
  isOfferedInDesigner,
  savedDesignItemAvailability,
  designerReadyOverrideDecision,
  designerReadyOverrideNote,
  designerReadyOverridePayload,
  designerReadyUndoPayload,
  effectiveDesignerEligible,
  hasDesignerReadyOverride,
  resolveDesignerDimensions,
  type DesignerReadyCabinet,
} from "./designerReadyOverride";

/**
 * W3024 is the reported case: a 30 wide × 24 high × 12 deep wall cabinet on the
 * Clark and Son line. Its catalog row carries no usable dimensions, so the
 * Designer cannot build a box and the item is flagged — even though the SKU
 * states all three numbers.
 */
const w3024: DesignerReadyCabinet = {
  id: 481,
  masterCode: "W3024",
  description: '30" x 24" Wall Cabinet',
  category: "Wall",
  subCategory: "Wall Cabinet",
  width: null,
  height: null,
  depth: null,
  designerEligible: false,
};

const admin = { role: "admin" as const };

describe("the flag and its reason", () => {
  it("names the missing dimensions, which is why W3024 is red", () => {
    expect(designerFlagReason(w3024)).toBe("missing width, height, or depth");
  });

  it("reports the flag as satisfied once the dimensions are present", () => {
    // With a real box and a published price the catalog's own decision is yes.
    expect(designerFlagReason({ ...w3024, width: 30, height: 24, depth: 12 })).toContain("published price");
  });

  it("reports a missing price first", () => {
    expect(designerFlagReason(w3024, false)).toBe("no published supplier price");
  });

  it("is off until an override turns it on", () => {
    expect(effectiveDesignerEligible(w3024)).toBe(false);
    expect(effectiveDesignerEligible({ ...w3024, designerEligible: true })).toBe(true);
    expect(effectiveDesignerEligible({ ...w3024, designerReadyOverride: "ready" })).toBe(true);
    // Reset clears the override and falls back to the catalog's own answer.
    expect(effectiveDesignerEligible({ ...w3024, designerEligible: true, designerReadyOverride: null })).toBe(true);
    // "off" wins over a catalog that says yes.
    expect(effectiveDesignerEligible({ ...w3024, designerEligible: true, designerReadyOverride: "off" })).toBe(false);
  });

  it("reads the override from the stored enum, and ignores anything else", () => {
    expect(hasDesignerReadyOverride({ designerReadyOverride: "ready" })).toBe(true);
    expect(hasDesignerReadyOverride({ designerReadyOverride: "READY" })).toBe(true);
    expect(hasDesignerReadyOverride({ designerReadyOverride: "off" })).toBe(false);
    expect(hasDesignerReadyOverride({})).toBe(false);
    expect(hasDesignerReadyOverride({ designerReadyOverride: "yes" })).toBe(false);
  });
});

describe("deriving the box from the SKU", () => {
  it("derives W3024 as 30 × 24 × 12", () => {
    const geometry = resolveDesignerDimensions(w3024);
    expect(geometry.blocked).toBe(false);
    expect(geometry.dimensions).toEqual({ width: 30, height: 24, depth: 12 });
    expect(geometry.source).toBe("derived");
    expect(geometry.derived).toEqual({ width: 30, height: 24, depth: 12, from: "W3024" });
  });

  it("prefers the catalog numbers when they are present", () => {
    const geometry = resolveDesignerDimensions({ ...w3024, width: 31, height: 25, depth: 13 });
    expect(geometry.dimensions).toEqual({ width: 31, height: 25, depth: 13 });
    expect(geometry.source).toBe("catalog");
    expect(geometry.derived).toBeNull();
  });

  it("fills only the missing field from a partly-populated row", () => {
    const geometry = resolveDesignerDimensions({ ...w3024, width: 30, height: 24, depth: null });
    expect(geometry.dimensions).toEqual({ width: 30, height: 24, depth: 12 });
    expect(geometry.source).toBe("derived");
  });

  it("blocks, naming the field, when the SKU cannot be parsed", () => {
    const geometry = resolveDesignerDimensions({ ...w3024, masterCode: "WALL-30-CUSTOM" });
    expect(geometry.blocked).toBe(true);
    expect(geometry.reason).toContain("are missing");
    expect(geometry.reason).toContain('"WALL-30-CUSTOM" cannot be parsed');
    expect(geometry.reason).toContain("Fill the catalog dimensions");
    expect(geometry.missing).toEqual(["width", "height", "depth"]);
  });

  it("blocks with no SKU at all rather than guessing", () => {
    const geometry = resolveDesignerDimensions({ ...w3024, masterCode: null });
    expect(geometry.blocked).toBe(true);
    expect(geometry.reason).toContain("no SKU to parse");
  });
});

describe("the admin decision", () => {
  it("allows an admin to approve W3024 and says what it derived", () => {
    const decision = designerReadyOverrideDecision(w3024, admin);
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error("expected allowed");
    expect(decision.source).toBe("derived");
    expect(decision.note).toBe('Dimensions 30″ × 24″ × 12″ derived from W3024');
  });

  it("refuses anyone who is not an administrator", () => {
    for (const role of ["user", "distributor", "dealer", null]) {
      const decision = designerReadyOverrideDecision(w3024, { role });
      expect(decision.allowed).toBe(false);
      if (decision.allowed) throw new Error("unreachable");
      expect(decision.reason).toContain("administrator");
    }
  });

  it("still allows approval when the catalog flag is on but the box is unbuildable", () => {
    // The flag alone is not proof: W3024 has no dimensions, so "ready" is real work.
    const decision = designerReadyOverrideDecision({ ...w3024, designerEligible: true }, admin);
    expect(decision.allowed).toBe(true);
  });

  it("refuses to re-approve an item that is already forced ready", () => {
    const decision = designerReadyOverrideDecision({ ...w3024, designerReadyOverride: "ready" }, admin);
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("unreachable");
    expect(decision.reason).toContain("already available");
  });

  it("refuses when there is no published price, because the Designer would still hide it", () => {
    const decision = designerReadyOverrideDecision(w3024, { role: "admin", hasPublishedPrice: false });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("unreachable");
    expect(decision.reason).toContain("no published supplier price");
  });

  it("blocks an unparseable SKU and names the missing field", () => {
    const decision = designerReadyOverrideDecision({ ...w3024, masterCode: "??" }, admin);
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("unreachable");
    expect(decision.reason).toContain("cannot be parsed");
    expect(decision.reason).toContain("Fill the catalog dimensions");
  });

  it("refuses an item type the Designer cannot draw even with dimensions", () => {
    const decision = designerReadyOverrideDecision({
      ...w3024,
      masterCode: "CR",
      description: "Crown moulding",
      category: "Trim",
      subCategory: "Crown",
      width: null,
      height: null,
      depth: null,
    }, admin);
    expect(decision.allowed).toBe(false);
  });

  it("uses the catalog dimensions when they are complete", () => {
    const decision = designerReadyOverrideDecision({ ...w3024, width: 30, height: 24, depth: 12 }, admin);
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error("unexpected");
    expect(decision.source).toBe("catalog");
    expect(decision.note).toContain("catalog dimensions");
  });
});

describe("what gets stored", () => {
  it("records who and when, and the derivation", () => {
    const decision = designerReadyOverrideDecision(w3024, admin);
    if (!decision.allowed) throw new Error("unexpected");
    const payload = designerReadyOverridePayload(decision, { name: "Dana Reaves", email: "dana@cabinetdealz.com" }, new Date("2026-11-06T02:00:00.000Z"));
    expect(payload).toMatchObject({
      designerReadyOverride: "ready",
      designerReadyOverrideBy: "Dana Reaves <dana@cabinetdealz.com>",
      designerReadyOverrideAt: "2026-11-06T02:00:00.000Z",
      designerReadyDerivedFrom: "W3024",
      width: 30,
      height: 24,
      depth: 12,
    });
  });

  it("does not overwrite complete catalog dimensions with derived ones", () => {
    const decision = designerReadyOverrideDecision({ ...w3024, width: 30, height: 24, depth: 12 }, admin);
    if (!decision.allowed) throw new Error("unexpected");
    const payload = designerReadyOverridePayload(decision, { name: "Dana" });
    expect(payload.width).toBeNull();
    expect(payload.designerReadyDerivedFrom).toBeNull();
  });

  it("undo clears the flag and the stamps", () => {
    expect(designerReadyUndoPayload()).toEqual({
      designerReadyOverride: null,
      designerReadyOverrideBy: null,
      designerReadyOverrideAt: null,
      designerReadyDerivedFrom: null,
      designerOffReason: null,
      designerOffUntil: null,
    });
  });
});

describe("the note under an approved item", () => {
  const format = (value: string | Date | null | undefined) => (value ? "Nov 5, 2026, 1:47 PM CT" : null);

  it("names the administrator and the time", () => {
    expect(designerReadyOverrideNote({
      designerReadyOverride: "ready",
      designerReadyOverrideBy: "Dana Reaves <dana@cabinetdealz.com>",
      designerReadyOverrideAt: "2026-11-05T19:47:00.000Z",
    }, format)).toBe("Manually approved by Dana Reaves · Nov 5, 2026, 1:47 PM CT");
  });

  it("drops the address from the visible note", () => {
    expect(designerReadyOverrideNote({
      designerReadyOverride: "ready",
      designerReadyOverrideBy: "Dana Reaves <dana@cabinetdealz.com>",
      designerReadyOverrideAt: null,
    }, format)).toBe("Manually approved by Dana Reaves");
  });

  it("says nothing when there is no override", () => {
    expect(designerReadyOverrideNote({ designerReadyOverride: null }, format)).toBeNull();
    expect(designerReadyOverrideNote({}, format)).toBeNull();
    expect(designerReadyOverrideNote({ designerReadyOverride: "off" }, format)).toBeNull();
  });

  it("still reads sensibly when the actor was not recorded", () => {
    expect(designerReadyOverrideNote({ designerReadyOverride: "ready" }, format)).toBe("Manually approved by an administrator");
  });
});

describe("forced off (out of stock)", () => {
  const healthy: DesignerReadyCabinet = { ...w3024, width: 30, height: 24, depth: 12, designerEligible: true };
  const NOW = new Date("2026-11-06T12:00:00.000Z");

  it("hides an item that passes every check", () => {
    const off = { ...healthy, designerReadyOverride: "off" as const, designerOffReason: "Out of stock" };
    expect(effectiveDesignerEligible(off, NOW)).toBe(false);
    expect(isOfferedInDesigner(off, NOW)).toBe(false);
    expect(isDesignerTurnedOff(off, NOW)).toBe(true);
  });

  it("needs no dimensions to turn an item off", () => {
    const decision = designerOverrideDecision(w3024, "off", { role: "admin", now: NOW });
    expect(decision.allowed).toBe(true);
  });

  it("records the reason and the return date", () => {
    const payload = designerOffPayload(
      { reason: "Out of stock", until: "2027-08-01" },
      { name: "Dana Reaves", email: "dana@cabinetdealz.com" },
      NOW,
    );
    expect(payload).toMatchObject({
      designerReadyOverride: "off",
      designerReadyOverrideBy: "Dana Reaves <dana@cabinetdealz.com>",
      designerReadyOverrideAt: NOW.toISOString(),
      designerOffReason: "Out of stock",
    });
    expect(payload.designerOffUntil?.slice(0, 10)).toBe("2027-08-01");
  });

  it("defaults the reason to Out of stock", () => {
    expect(designerOffPayload({}, { name: "Dana" }, NOW).designerOffReason).toBe("Out of stock");
    expect(designerOffPayload({ reason: "  " }, { name: "Dana" }, NOW).designerOffReason).toBe("Out of stock");
  });

  it("drops a return date in the past instead of turning it straight back on", () => {
    expect(designerOffPayload({ until: "2026-01-01" }, { name: "Dana" }, NOW).designerOffUntil).toBeNull();
  });

  it("is reversible with reset", () => {
    const off = { ...healthy, designerReadyOverride: "off" as const };
    expect(effectiveDesignerEligible(off, NOW)).toBe(false);
    const reset = { ...off, ...designerReadyUndoPayload() };
    expect(effectiveDesignerEligible(reset, NOW)).toBe(true);
  });

  it("refuses to turn off what is already off", () => {
    expect(designerOverrideDecision({ ...healthy, designerReadyOverride: "off" }, "off", { role: "admin", now: NOW }).allowed).toBe(false);
  });

  it("refuses a non-admin", () => {
    expect(designerOverrideDecision(healthy, "off", { role: "distributor", now: NOW }).allowed).toBe(false);
  });

  it("shows Off: <reason> until <date> on the listing", () => {
    const label = designerOffLabel(
      { designerReadyOverride: "off", designerOffReason: "Out of stock", designerOffUntil: "2027-08-01T00:00:00.000Z" },
      () => "Aug 1, 2027",
      NOW,
    );
    expect(label).toBe("Off: Out of stock until Aug 1, 2027");
  });

  it("omits the date when none was given", () => {
    expect(designerOffLabel({ designerReadyOverride: "off" }, () => null, NOW)).toBe("Off: Out of stock");
    expect(designerOffLabel({ designerReadyOverride: "ready" }, () => null, NOW)).toBeNull();
  });

  it("names who turned it off and when", () => {
    expect(designerOffAttribution({
      designerReadyOverride: "off",
      designerReadyOverrideBy: "Dana Reaves <dana@cabinetdealz.com>",
      designerReadyOverrideAt: "2026-11-05T19:47:00.000Z",
    }, () => "Nov 5, 2026, 1:47 PM CT", NOW)).toBe("Turned off by Dana Reaves · Nov 5, 2026, 1:47 PM CT");
  });
});

describe("automatic return on the back-in-stock date", () => {
  const off = {
    ...w3024,
    width: 30, height: 24, depth: 12,
    designerEligible: true,
    designerReadyOverride: "off" as const,
    designerOffReason: "Out of stock",
    designerOffUntil: "2027-08-01T00:00:00.000Z",
  };

  it("stays off before the date", () => {
    expect(effectiveDesignerEligible(off, new Date("2027-07-30T23:59:00.000Z"))).toBe(false);
  });

  it("returns to automatic on that Central calendar date, with no cron", () => {
    // "2027-08-01" means August 1 in Central. 2027-08-01T05:00:00Z is midnight CDT
    // on the 1st, which is the first instant it is back.
    const onTheDay = new Date("2027-08-01T05:00:00.000Z");
    expect(effectiveDesignerEligible(off, onTheDay)).toBe(true);
    expect(activeDesignerOverride(off, onTheDay)).toBeNull();
    expect(designerOffExpired(off, onTheDay)).toBe(true);
    // An hour earlier it is still July 31 in Central, so still off.
    expect(effectiveDesignerEligible(off, new Date("2027-08-01T04:00:00.000Z"))).toBe(false);
  });

  it("falls back to the catalog's own answer, not to 'on'", () => {
    const wasIneligible = { ...off, designerEligible: false };
    expect(effectiveDesignerEligible(wasIneligible, new Date("2027-08-01T05:00:00.000Z"))).toBe(false);
  });

  it("stays off forever when no date was given", () => {
    const noDate = { ...off, designerOffUntil: null };
    expect(effectiveDesignerEligible(noDate, new Date("2030-01-01T00:00:00.000Z"))).toBe(false);
    expect(designerOffExpired(noDate, new Date("2030-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("stops showing the Off label once it has expired", () => {
    expect(designerOffLabel(off, () => "Aug 1, 2027", new Date("2027-08-03T00:00:00.000Z"))).toBeNull();
  });
});

describe("saved designs that contain the item", () => {
  it("keeps the item and marks it unavailable while turned off", () => {
    expect(savedDesignItemAvailability({
      ...w3024,
      designerEligible: true,
      designerReadyOverride: "off",
      designerOffReason: "Out of stock",
    })).toEqual({ available: false, label: "Unavailable — Out of stock" });
  });

  it("leaves an available item alone", () => {
    expect(savedDesignItemAvailability({ ...w3024, width: 30, height: 24, depth: 12, designerEligible: true }))
      .toEqual({ available: true, label: null });
  });

  it("marks an item the rules never allowed, too", () => {
    expect(savedDesignItemAvailability(w3024)).toEqual({ available: false, label: "Unavailable — not designer ready" });
  });
});
