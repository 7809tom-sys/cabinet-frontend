import { describe, it, expect } from "vitest";
import { autoFillSpan, candidatesForMode, makeFiller } from "./autofill";
import type { DesignCabinet } from "./design";

function cab(masterCode: string, width: number, placement: DesignCabinet["placement"] = "base", extra: Partial<DesignCabinet> = {}): DesignCabinet {
  return {
    id: 1,
    masterCode,
    description: `${width}" ${masterCode}`,
    category: placement === "base" ? "Base" : "Tall",
    subCategory: null,
    width: String(width),
    height: "34.5",
    depth: "24",
    placement,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    catalogImageUrl: null,
    ...extra,
  };
}

// A representative kitchen base catalog with common standard widths.
const KITCHEN: DesignCabinet[] = [
  cab("B-12", 12),
  cab("B-15", 15),
  cab("B-18", 18),
  cab("B-24", 24),
  cab("B-30", 30),
  cab("B-36", 36),
  // Items that must be EXCLUDED from straight-run fill:
  cab("BBC-45", 45, "base", { isCornerCabinet: true, description: "45\" Blind Corner Base Cabinet" }),
  cab("BEP-3", 3, "base", { description: "3\" Base Decorative End Panel", subCategory: "Filler" }),
  { ...cab("RANGE-30", 30), placement: "appliance", masterCode: "RANGE-30" },
];

describe("candidatesForMode", () => {
  it("excludes corners, panels, fillers, and appliances from a kitchen run", () => {
    const c = candidatesForMode("kitchen", KITCHEN);
    const codes = c.map((x) => x.masterCode);
    expect(codes).toContain("B-24");
    expect(codes).not.toContain("BBC-45"); // corner
    expect(codes).not.toContain("BEP-3"); // filler/panel
    expect(codes).not.toContain("RANGE-30"); // appliance
  });

  it("sorts candidates widest first", () => {
    const c = candidatesForMode("kitchen", KITCHEN);
    const widths = c.map((x) => parseFloat(x.width!));
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i - 1]).toBeGreaterThanOrEqual(widths[i]);
    }
  });
});

describe("autoFillSpan", () => {
  it("tiles an exact multiple with no filler (72\" = 2×36)", () => {
    const r = autoFillSpan(72, "kitchen", KITCHEN);
    expect(r.fillerInches).toBe(0);
    expect(r.leftoverInches).toBeCloseTo(0, 2);
    expect(r.usedInches).toBeCloseTo(72, 2);
    // Two 36" bases is the fewest-pieces exact cover for 72".
    expect(r.items.filter((i) => !i.isFiller).map((i) => i.cabinet.masterCode)).toEqual(["B-36", "B-36"]);
  });

  it("produces a VARIED mix of widths, not just the widest repeated (96\")", () => {
    const r = autoFillSpan(96, "kitchen", KITCHEN);
    const widths = r.items.filter((i) => !i.isFiller).map((i) => i.width);
    const distinct = new Set(widths);
    // 96 could be 2x48 (none here) or 3x32 — the engine should mix widths
    // (e.g. 36+30+24) rather than emitting the same width three times.
    expect(widths.length).toBeGreaterThanOrEqual(2);
    expect(distinct.size).toBeGreaterThanOrEqual(2);
    expect(r.usedInches + r.leftoverInches).toBeCloseTo(96, 1);
  });

  it("uses the largest compatible cabinets first when Four-anchor requests its narrow fill strategy", () => {
    const r = autoFillSpan(96, "kitchen", KITCHEN, { strategy: "largest-first" });
    expect(r.items.filter((i) => !i.isFiller).map((i) => i.width)).toEqual([36, 36, 24]);
    expect(r.fillerInches).toBe(0);
  });

  it("force-appends a clearance filler when requested (range/oven corner rule)", () => {
    const r = autoFillSpan(60, "kitchen", KITCHEN, { forceFiller: 3 });
    const fillers = r.items.filter((i) => i.isFiller);
    expect(fillers.some((f) => Math.abs(f.width - 3) < 0.01)).toBe(true);
    expect(r.fillerInches).toBeGreaterThanOrEqual(3);
  });

  it("covers the full span; used + leftover never exceeds span", () => {
    for (const span of [40, 59, 83, 96, 100, 121, 137]) {
      const r = autoFillSpan(span, "kitchen", KITCHEN);
      expect(r.usedInches).toBeLessThanOrEqual(span + 0.01);
      expect(r.usedInches + r.leftoverInches).toBeCloseTo(span, 1);
    }
  });

  it("adds a filler only when real cabinets can't close the gap tighter", () => {
    // The varied planner prefers a tighter all-cabinet cover (24+15 ⇒ ~1" reveal)
    // over forcing a filler, but when the only good cover leaves a 1.5"–6" gap a
    // filler IS inserted. Use a catalog whose smallest box is 24 so a 28" span
    // can only be covered by 24 + 4" filler.
    const BIG: DesignCabinet[] = [cab("B-24", 24), cab("B-30", 30), cab("B-36", 36)];
    const r = autoFillSpan(28, "kitchen", BIG);
    const fillers = r.items.filter((i) => i.isFiller);
    expect(fillers.length).toBe(1);
    expect(r.fillerInches).toBeCloseTo(4, 2);
    expect(r.leftoverInches).toBeCloseTo(0, 2);
  });

  it("absorbs a sub-threshold leftover as reveal, no filler (37\" → 36, ~1 reveal)", () => {
    const r = autoFillSpan(37, "kitchen", KITCHEN);
    expect(r.items.filter((i) => i.isFiller).length).toBe(0);
    expect(r.fillerInches).toBe(0);
    expect(r.leftoverInches).toBeCloseTo(1, 2);
  });

  it("only ever places valid catalog widths for real cabinets", () => {
    const validWidths = new Set(candidatesForMode("kitchen", KITCHEN).map((c) => parseFloat(c.width!)));
    const r = autoFillSpan(123, "kitchen", KITCHEN);
    for (const it of r.items) {
      if (!it.isFiller) expect(validWidths.has(it.width)).toBe(true);
    }
  });

  it("returns nothing for a span smaller than the smallest filler", () => {
    const r = autoFillSpan(1, "kitchen", KITCHEN);
    expect(r.items.length).toBe(0);
    expect(r.usedInches).toBe(0);
  });

  it("falls back to base/tall for closets when no closet parts exist", () => {
    const r = autoFillSpan(48, "closet", KITCHEN);
    expect(r.items.filter((i) => !i.isFiller).length).toBeGreaterThan(0);
  });
});

describe("makeFiller", () => {
  it("produces an orderable filler with a code and width", () => {
    const f = makeFiller(3.5);
    expect(f.masterCode).toBe("FILL-3.5");
    expect(parseFloat(f.width!)).toBeCloseTo(3.5, 2);
    expect(f.isCornerCabinet).toBe(false);
  });

  it("defaults to a base-depth filler (manual palette drop)", () => {
    const f = makeFiller(3);
    expect(f.placement).toBe("base");
    expect(parseFloat(f.depth!)).toBeCloseTo(24, 2);
    expect(f.numberOfDoors).toBe(0);
    expect(f.numberOfDrawers).toBe(0);
  });

  it("makes a shallow wall filler when placed on a wall run", () => {
    const f = makeFiller(2, "wall");
    expect(f.placement).toBe("wall");
    expect(parseFloat(f.depth!)).toBeCloseTo(12, 2);
  });

  it("rounds odd widths to one decimal so the code/width stay tidy", () => {
    const f = makeFiller(2.46);
    expect(f.masterCode).toBe("FILL-2.5");
    expect(parseFloat(f.width!)).toBeCloseTo(2.5, 2);
  });
});
