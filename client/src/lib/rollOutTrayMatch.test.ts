import { describe, it, expect } from "vitest";
import {
  isRollOutEligible,
  MAX_ROLLOUT_TRAYS_PER_CABINET,
  matchRollOutTray,
	  normalizedRollOutTrayQty,
	  rollOutTrayCartItems,
  targetWidth,
  type TrayOption,
  type TrayTarget,
} from "./rollOutTrayMatch";

// The shelf widths the catalog actually carries (RS-15 .. RS-36). Tests pass a
// per-line subset to mimic same-line filtering done server-side.
const ALL_TRAYS: TrayOption[] = [
  { cabinetId: 1, masterCode: "RS-15", width: 15 },
  { cabinetId: 2, masterCode: "RS-18", width: 18 },
  { cabinetId: 3, masterCode: "RS-21", width: 21 },
  { cabinetId: 4, masterCode: "RS-24", width: 24 },
  { cabinetId: 5, masterCode: "RS-27", width: 27 },
  { cabinetId: 6, masterCode: "RS-30", width: 30 },
  { cabinetId: 7, masterCode: "RS-33", width: 33 },
  { cabinetId: 8, masterCode: "RS-36", width: 36 },
];

function base(partial: Partial<TrayTarget>): TrayTarget {
  return {
    placement: "base",
    category: "Base",
    subCategory: "Single Door Base",
    masterCode: "B18",
    numberOfDoors: 1,
    isCornerCabinet: false,
    nominalWidth: 18,
    width: 18,
    ...partial,
  };
}

describe("isRollOutEligible", () => {
  it("allows a base cabinet with a door", () => {
    expect(isRollOutEligible(base({}))).toBe(true);
  });

  it("allows a sink base (uses vary, dealer offers trays)", () => {
    expect(
      isRollOutEligible(base({ subCategory: "Sink Base", masterCode: "SB36", nominalWidth: 36, width: 36 })),
    ).toBe(true);
  });

  it("rejects wall cabinets", () => {
    expect(isRollOutEligible(base({ placement: "wall", subCategory: "Single Door Wall" }))).toBe(false);
  });

  it("allows eligible tall/pantry cabinets with doors", () => {
    expect(isRollOutEligible(base({ placement: "tall", subCategory: "Pantry / Utility", masterCode: "P2496", nominalWidth: 24, width: 24, numberOfDoors: 4 }))).toBe(true);
  });

  it("rejects appliance/opening towers even when they are tall and have doors", () => {
    expect(isRollOutEligible(base({ placement: "tall", subCategory: "Oven Cabinet", masterCode: "UOC3396", nominalWidth: 33, width: 33, numberOfDoors: 2 }))).toBe(false);
    expect(isRollOutEligible(base({ placement: "tall", subCategory: "Open Shelf Tower", masterCode: "OST2496", nominalWidth: 24, width: 24, numberOfDoors: 2 }))).toBe(false);
  });

  it("rejects corner cabinets", () => {
    expect(isRollOutEligible(base({ isCornerCabinet: true, subCategory: "Lazy Susan Base" }))).toBe(false);
  });

  it("rejects drawer-only bases (no door)", () => {
    expect(
      isRollOutEligible(base({ subCategory: "Drawer Base", masterCode: "DB18", numberOfDoors: 0 })),
    ).toBe(false);
  });

  it("rejects cabinets with no door", () => {
    expect(isRollOutEligible(base({ numberOfDoors: 0 }))).toBe(false);
  });

	it("rejects base cabinets narrower than 18 inches", () => {
	  expect(isRollOutEligible(base({ masterCode: "B17", nominalWidth: 17, width: 17 }))).toBe(false);
	  expect(isRollOutEligible(base({ masterCode: "B18", nominalWidth: 18, width: 18 }))).toBe(true);
	});

	it("limits base and pantry rollout eligibility to 18 through 36 inches", () => {
	  expect(isRollOutEligible(base({ masterCode: "B36", nominalWidth: 36, width: 36 }))).toBe(true);
	  expect(isRollOutEligible(base({ masterCode: "B39", nominalWidth: 39, width: 39 }))).toBe(false);
	  expect(isRollOutEligible(base({ placement: "tall", subCategory: "Pantry / Utility", masterCode: "P3696", nominalWidth: 36, width: 36, numberOfDoors: 4 }))).toBe(true);
	  expect(isRollOutEligible(base({ placement: "tall", subCategory: "Pantry / Utility", masterCode: "P3996", nominalWidth: 39, width: 39, numberOfDoors: 4 }))).toBe(false);
	});

  it("rejects fillers and panels", () => {
    expect(isRollOutEligible(base({ subCategory: "Base End Panel", masterCode: "BEP-3" }))).toBe(false);
    expect(isRollOutEligible(base({ subCategory: "Filler", masterCode: "BF3" }))).toBe(false);
  });

  it("rejects the roll-out shelf itself", () => {
    expect(
      isRollOutEligible(base({ subCategory: "Roll Out Shelf", masterCode: "RS-18", numberOfDoors: 0 })),
    ).toBe(false);
  });
});

describe("targetWidth", () => {
  it("prefers nominal width", () => {
    expect(targetWidth(base({ nominalWidth: 18, width: 19.5 }))).toBe(18);
  });
  it("falls back to live width when no nominal", () => {
    expect(targetWidth(base({ nominalWidth: null, width: 22 }))).toBe(22);
  });
});

describe("matchRollOutTray", () => {
  it("matches exact width: B18 -> RS-18", () => {
    const t = matchRollOutTray(base({ nominalWidth: 18, width: 18 }), ALL_TRAYS);
    expect(t?.masterCode).toBe("RS-18");
  });

  it("matches B24 -> RS-24", () => {
    const t = matchRollOutTray(base({ masterCode: "B24", nominalWidth: 24, width: 24 }), ALL_TRAYS);
    expect(t?.masterCode).toBe("RS-24");
  });

  it("matches B36 -> RS-36", () => {
    const t = matchRollOutTray(
      base({ masterCode: "B36", subCategory: "Sink Base", nominalWidth: 36, width: 36 }),
      ALL_TRAYS,
    );
    expect(t?.masterCode).toBe("RS-36");
  });

  it("returns null below the 18-inch cabinet eligibility threshold even when a smaller shelf exists", () => {
    const t = matchRollOutTray(base({ masterCode: "B17", nominalWidth: 17, width: 17 }), ALL_TRAYS);
    expect(t).toBeNull();
  });

  it("picks largest shelf that fits: B23 -> RS-21", () => {
    const t = matchRollOutTray(base({ masterCode: "B23", nominalWidth: 23, width: 23 }), ALL_TRAYS);
    expect(t?.masterCode).toBe("RS-21");
  });

  it("returns null when the cabinet is narrower than every shelf (B12, smallest is 15)", () => {
    const t = matchRollOutTray(base({ masterCode: "B12", nominalWidth: 12, width: 12 }), ALL_TRAYS);
    expect(t).toBeNull();
  });

  it("returns null for ineligible cabinets", () => {
    expect(matchRollOutTray(base({ placement: "wall" }), ALL_TRAYS)).toBeNull();
  });

  it("returns null when this line carries no shelves (can't mix lines)", () => {
    expect(matchRollOutTray(base({ nominalWidth: 24, width: 24 }), [])).toBeNull();
  });

  it("respects same-line subset: line without RS-18 falls back to RS-15 for a B18", () => {
    const lineWithout18: TrayOption[] = ALL_TRAYS.filter((t) => t.masterCode !== "RS-18");
    const t = matchRollOutTray(base({ nominalWidth: 18, width: 18 }), lineWithout18);
    expect(t?.masterCode).toBe("RS-15");
  });

  it("absorbs decimal rounding: 24.00 still matches RS-24", () => {
    const t = matchRollOutTray(base({ nominalWidth: 24.0, width: 24.0 }), ALL_TRAYS);
    expect(t?.masterCode).toBe("RS-24");
  });
});

import { buildRollOutLines, type TrayOptionForStyle, type TrayPlaced } from "./rollOutTrayMatch";

function styleOpts(styleId: number, widths: number[]): TrayOptionForStyle[] {
  return widths.map((w, i) => ({
    cabinetId: styleId * 100 + i,
    masterCode: `RS-${w}`,
    width: w,
    styleId,
    description: `Roll-Out Shelf ${w}"`,
    unitPrice: 40 + w,
  }));
}

function placedBase(partial: Partial<TrayPlaced>): TrayPlaced {
  return {
    placement: "base",
    category: "Base",
    subCategory: "Single Door Base",
    masterCode: "B18",
    numberOfDoors: 1,
    isCornerCabinet: false,
    nominalWidth: 18,
    width: 18,
    effectiveStyleId: 1,
    rolloutQty: 1,
    ...partial,
  };
}

describe("buildRollOutLines", () => {
  const optionsByStyle = new Map<number, TrayOptionForStyle[]>([
    [1, styleOpts(1, [15, 18, 21, 24, 30, 36])],
    [2, styleOpts(2, [18, 24])], // a different line with fewer widths
  ]);

  it("returns nothing when no cabinet has trays", () => {
    const lines = buildRollOutLines([placedBase({ rolloutQty: 0 })], optionsByStyle);
    expect(lines).toEqual([]);
  });

  it("creates one line for a single B18 with qty 2", () => {
    const lines = buildRollOutLines([placedBase({ rolloutQty: 2 })], optionsByStyle);
    expect(lines).toHaveLength(1);
    expect(lines[0].masterCode).toBe("RS-18");
    expect(lines[0].qty).toBe(2);
    expect(lines[0].styleId).toBe(1);
    expect(lines[0].unitPrice).toBe(58);
  });

  it("caps each cabinet at five trays before aggregation and preserves the priced SKU", () => {
    const lines = buildRollOutLines(
      [placedBase({ rolloutQty: 99 }), placedBase({ rolloutQty: 8, masterCode: "B18b" })],
      optionsByStyle,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ masterCode: "RS-18", qty: 10, unitPrice: 58 });
  });

  it("builds a priced rollout line for an eligible pantry", () => {
    const lines = buildRollOutLines(
      [placedBase({ placement: "tall", subCategory: "Pantry / Utility", masterCode: "P2496", nominalWidth: 24, width: 24, numberOfDoors: 4, rolloutQty: 5 })],
      optionsByStyle,
    );
    expect(lines[0]).toMatchObject({ masterCode: "RS-24", qty: 5, unitPrice: 64 });
  });

  it("aggregates two same-size same-line cabinets into one line", () => {
    const lines = buildRollOutLines(
      [placedBase({ rolloutQty: 1 }), placedBase({ rolloutQty: 3, masterCode: "B18b" })],
      optionsByStyle,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(4);
  });

  it("keeps different sizes as separate lines", () => {
    const lines = buildRollOutLines(
      [
        placedBase({ rolloutQty: 1, nominalWidth: 18, width: 18 }),
        placedBase({ rolloutQty: 1, nominalWidth: 24, width: 24, masterCode: "B24" }),
      ],
      optionsByStyle,
    );
    const codes = lines.map((l) => l.masterCode).sort();
    expect(codes).toEqual(["RS-18", "RS-24"]);
  });

  it("does NOT mix lines: a style-2 cabinet uses style-2 shelves only", () => {
    const lines = buildRollOutLines(
      [placedBase({ rolloutQty: 1, effectiveStyleId: 2, nominalWidth: 24, width: 24, masterCode: "B24" })],
      optionsByStyle,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].styleId).toBe(2);
    expect(lines[0].cabinetId).toBe(styleOpts(2, [18, 24])[1].cabinetId);
  });

  it("falls back to largest fitting shelf in a sparse line (style-2 B21 -> RS-18)", () => {
    const lines = buildRollOutLines(
      [placedBase({ rolloutQty: 1, effectiveStyleId: 2, nominalWidth: 21, width: 21, masterCode: "B21" })],
      optionsByStyle,
    );
    expect(lines[0].masterCode).toBe("RS-18");
  });

  it("skips ineligible cabinets even if rolloutQty is set", () => {
    const lines = buildRollOutLines(
      [placedBase({ rolloutQty: 2, placement: "wall" })],
      optionsByStyle,
    );
    expect(lines).toEqual([]);
  });

  it("skips cabinets whose line has no fitting shelf (B12, smallest is 15)", () => {
    const lines = buildRollOutLines(
      [placedBase({ rolloutQty: 2, nominalWidth: 12, width: 12, masterCode: "B12" })],
      optionsByStyle,
    );
    expect(lines).toEqual([]);
  });
});

describe("normalizedRollOutTrayQty", () => {
  it("supports zero/remove and integer quantities one through five", () => {
    expect(normalizedRollOutTrayQty(0)).toBe(0);
    expect(normalizedRollOutTrayQty(1)).toBe(1);
    expect(normalizedRollOutTrayQty(5)).toBe(MAX_ROLLOUT_TRAYS_PER_CABINET);
  });

  it("floors decimals and caps all oversized quantities at five", () => {
    expect(normalizedRollOutTrayQty(3.9)).toBe(3);
    expect(normalizedRollOutTrayQty(6)).toBe(5);
    expect(normalizedRollOutTrayQty(999)).toBe(5);
    expect(normalizedRollOutTrayQty("bad")).toBe(0);
  });
});

describe("rollOutTrayCartItems", () => {
  it("creates the exact priced RS cart payload and excludes unpriced tray rows", () => {
    const items = rollOutTrayCartItems({
      lines: [
        { cabinetId: 4, masterCode: "RS-24", description: "Roll-Out Shelf 24 inch", styleId: 11, width: 24, qty: 5, unitPrice: 64 },
        { cabinetId: 5, masterCode: "RS-30", description: "Roll-Out Shelf 30 inch", styleId: 11, width: 30, qty: 2, unitPrice: null },
      ],
      styleNameById: new Map([[11, "Aura Cream"]]),
      distributorId: 7,
      tier: "homeowner",
    });
    expect(items).toEqual([{
      masterCode: "RS-24",
      name: "Roll-Out Shelf 24 inch",
      styleId: 11,
      styleLabel: "Aura Cream",
      distributorId: 7,
      tier: "homeowner",
      unitPrice: 64,
      qty: 5,
    }]);
    expect(items.reduce((total, item) => total + item.unitPrice * item.qty, 0)).toBe(320);
  });
});
