import { describe, expect, it } from "vitest";
import {
  CORNER_BAND_LAZY_PLUS_NINE_MIN_IN,
  CORNER_BAND_LAZY_SUSAN_MIN_IN,
  CORNER_BAND_PULL_OUT_MIN_IN,
  CORNER_BAND_ROTATED_BLIND_MIN_IN,
  NINE_INCH_COMPANION_IN,
  cornerBandForAvailableIn,
  cornerOptionsInTypeOrder,
  decideAutoDesignCornerTypeOrder,
  pickNineInchCompanion,
} from "./autoDesignCornerDecision";
import { autoDesignCornerFamily, isPullOutCornerCabinet } from "./autoDesignCornerStage";
import { DEFAULT_ROOM, wallPlacementAt, type DesignCabinet, type PlacedCabinet } from "./design";

const TOP_RIGHT = { x: DEFAULT_ROOM.width, y: 0 };

function option(code: string, width: string, extras: Partial<DesignCabinet> = {}): DesignCabinet {
  return {
    id: Math.abs(Array.from(code).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) + Number(width) * 10,
    masterCode: code,
    description: extras.description ?? code,
    placement: extras.placement ?? "base",
    width,
    height: extras.height ?? "34.5",
    depth: extras.depth ?? "24",
    ...extras,
  } as DesignCabinet;
}

function appliance(code: string, width: number, start: number, wall: "top" | "right" = "top"): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 26, wall, DEFAULT_ROOM);
  return {
    uid: `${code}-${start}`,
    cabinetId: 0,
    masterCode: code,
    description: `${width} inch appliance`,
    category: "Appliance",
    subCategory: "Appliance",
    placement: "appliance",
    ...spot,
    width,
    depth: 26,
    height: 36,
  } as PlacedCabinet;
}

/** Place a 30 in range on the top wall so `availableIn` inches remain to the top-right corner. */
function rangeLeaving(availableIn: number): PlacedCabinet {
  const end = DEFAULT_ROOM.width - availableIn;
  return appliance("RANGE-30", 30, end - 30);
}

const CATALOG = [option("DCB36", "36"), option("LSB36", "36"), option("LSB33", "33"), option("BBC36", "36")];
const NINE_BASE = option("BT9", "9", { description: '9" Tray Base Cabinet', placement: "base" });

function decide(availableIn: number, extras: Parameters<typeof decideAutoDesignCornerTypeOrder>[0] extends infer T ? Partial<T> : never = {}) {
  return decideAutoDesignCornerTypeOrder({
    room: DEFAULT_ROOM,
    cornerWallIds: ["top", "right"],
    corner: TOP_RIGHT,
    placed: [rangeLeaving(availableIn)],
    options: CATALOG,
    ...extras,
  });
}

describe("corner measurement bands", () => {
  it("maps the available run to Tom's type bands, not to hardcoded SKU widths", () => {
    expect(cornerBandForAvailableIn(45)).toBe("lazy-susan");
    expect(cornerBandForAvailableIn(44.9)).toBe("pull-out");
    expect(cornerBandForAvailableIn(CORNER_BAND_PULL_OUT_MIN_IN)).toBe("pull-out");
    expect(cornerBandForAvailableIn(42)).toBe("lazy-susan-plus-nine");
    expect(cornerBandForAvailableIn(41.9)).toBe("catalog-fit");
    expect(cornerBandForAvailableIn(33)).toBe("catalog-fit");
    expect(cornerBandForAvailableIn(32.9)).toBe("rotated-blind");
    expect(cornerBandForAvailableIn(CORNER_BAND_ROTATED_BLIND_MIN_IN)).toBe("rotated-blind");
    expect(cornerBandForAvailableIn(26.9)).toBe("blocked");
  });

  it("at 45 in or more, picks a lazy Susan from the catalog", () => {
    const decision = decide(CORNER_BAND_LAZY_SUSAN_MIN_IN);
    expect(decision.band).toBe("lazy-susan");
    expect(decision.availableIn).toBeCloseTo(45, 5);
    expect(decision.order[0]).toBe("lazy-susan");
    expect(decision.blocked).toBe(false);
    expect(decision.companionNine).toBe(false);
  });

  it("at 43.5 in, prefers a pull-out / sliding corner, then the next valid type", () => {
    const decision = decide(CORNER_BAND_PULL_OUT_MIN_IN);
    expect(decision.band).toBe("pull-out");
    expect(decision.order[0]).toBe("pull-out");
    expect(decision.order.slice(0, 3)).toEqual(["pull-out", "blind", "lazy-susan"]);
  });

  it("at 42 in, picks a lazy Susan plus a 9 in companion when the catalog can supply both", () => {
    const decision = decide(CORNER_BAND_LAZY_PLUS_NINE_MIN_IN, { companionCatalog: [NINE_BASE] });
    expect(decision.band).toBe("lazy-susan-plus-nine");
    expect(decision.companionNine).toBe(true);
    expect(decision.order[0]).toBe("lazy-susan");
    expect(pickNineInchCompanion([NINE_BASE])?.masterCode).toBe("BT9");
  });

  it("around 36 in, uses a catalog lazy Susan that fits, or a blind if none does", () => {
    const with33 = decide(36);
    expect(with33.band).toBe("catalog-fit");
    expect(with33.order[0]).toBe("lazy-susan"); // LSB33 fits
    const noSmall = decide(36, { options: [option("LSB36", "36"), option("BBC36", "36")] });
    expect(noSmall.band).toBe("catalog-fit");
    expect(noSmall.order[0]).toBe("lazy-susan"); // 36 still fits a 36 in run
    const tight = decide(34, { options: [option("LSB36", "36"), option("BBC36", "36")] });
    expect(tight.band).toBe("catalog-fit");
    expect(tight.order[0]).toBe("blind");
  });

  it("at 30 in and at 27 in, requires a turned blind; under 27 in the square stays blocked", () => {
    const at30 = decide(30);
    expect(at30.band).toBe("rotated-blind");
    expect(at30.rotateBlind).toBe(true);
    expect(at30.order[0]).toBe("blind");
    expect(at30.blocked).toBe(false);
    const at27 = decide(27);
    expect(at27.band).toBe("rotated-blind");
    expect(at27.rotateBlind).toBe(true);
    const at26 = decide(26);
    expect(at26.band).toBe("blocked");
    expect(at26.blocked).toBe(true);
    expect(at26.order).toEqual([]);
  });

  it("subtracts the 15 in fridge landing from the available run", () => {
    // Fridge ends 50 in from the top-right corner (start 64, width 36 → 64–100; 144-100=44).
    // Landing 15 in makes the available run 29 in → turned blind, not the 43.5 in pull-out band.
    const decision = decideAutoDesignCornerTypeOrder({
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [appliance("FRIDGE-36", 36, 64)],
      options: CATALOG,
    });
    expect(decision.availableIn).toBeCloseTo(29, 5);
    expect(decision.band).toBe("rotated-blind");
  });
});

describe("catalog decides the SKU and size", () => {
  it("uses the line's published lazy Susan width, not a hardcoded 36", () => {
    const only33 = decide(45, { options: [option("LSB33", "33"), option("BBC36", "36")] });
    expect(only33.band).toBe("lazy-susan");
    const ordered = cornerOptionsInTypeOrder(
      [option("LSB33", "33"), option("BBC36", "36")],
      only33.order,
    );
    expect(ordered[0]!.masterCode).toBe("LSB33");
  });

  it("falls to the next valid type when the line sells no lazy Susan", () => {
    const none = decide(45, { options: [option("DCB36", "36"), option("BBC36", "36")] });
    expect(none.band).toBe("lazy-susan");
    const ordered = cornerOptionsInTypeOrder(
      [option("DCB36", "36"), option("BBC36", "36")],
      none.order,
    );
    expect(ordered.map((row) => row.masterCode)).toEqual(["DCB36", "BBC36"]);
    expect(autoDesignCornerFamily(ordered[0]!)).toBe("diagonal");
  });

  it("on the 42 in band, falls to catalog-fit when the line has no 9 in cabinet, or only a lazy Susan too wide to leave 9 in", () => {
    const noNine = decide(42, { companionCatalog: [option("B12", "12")], options: CATALOG });
    expect(noNine.band).toBe("catalog-fit");
    expect(noNine.companionNine).toBe(false);
    const only36 = decide(42, {
      companionCatalog: [NINE_BASE],
      options: [option("LSB36", "36"), option("BBC36", "36")],
    });
    expect(only36.band).toBe("catalog-fit");
  });

  it("prefers a 9 in base or tray over a 9 in tall, and never invents a SKU", () => {
    const tall = option("S9", "9", { placement: "tall", description: '9" Tall' });
    const tray = option("BT9", "9", { placement: "base", description: '9" Tray Base Cabinet' });
    expect(pickNineInchCompanion([tall, tray])?.masterCode).toBe("BT9");
    expect(pickNineInchCompanion([tall])?.masterCode).toBe("S9");
    expect(pickNineInchCompanion([option("B12", "12")])).toBeNull();
    expect(NINE_INCH_COMPANION_IN).toBe(9);
  });

  it("recognizes a pull-out corner from its type, and does not treat a spice-rack pull-out as one", () => {
    const corner = option("PCB36", "36", { cornerType: "pull-out", description: "Sliding corner base" });
    expect(isPullOutCornerCabinet(corner)).toBe(true);
    expect(autoDesignCornerFamily(corner)).toBe("pull-out");
    const spice = option("BT9PO", "9", { description: '9" Base with Spice Rack Pullout', placement: "base" });
    expect(isPullOutCornerCabinet(spice)).toBe(false);
  });
});
