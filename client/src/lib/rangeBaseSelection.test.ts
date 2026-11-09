import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";
import {
  RANGE_BASE_CONFIG_OPTIONS,
  isFreestandingRangeUnit,
  isRangeTopRow,
  placeRangeTopOnBase,
  rangeBaseConfig,
  rangeBaseTopWidthIn,
  rangeTopOnBase,
  rangeTopRowDisabledReason,
  rangeTopRowFitsBase,
  rangeTopRowsForBase,
  rangeTopRowWidthIn,
} from "@/lib/rangeBaseSelection";
import { isRangeTopPlacement } from "@/lib/rangeTopDisplayOnly";

const room: RoomData = { width: 180, depth: 120, ceilingHeight: 108 };

function base(masterCode: string, offset: number, width: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", room);
  return {
    uid: "range-base",
    cabinetId: 2030,
    masterCode,
    description: `${width}" W × 34.75" H × 24" D Two Drawer Base with One False Front for a drop-in top`,
    category: "Base",
    subCategory: null,
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.75,
    numberOfDoors: 0,
    numberOfDrawers: 2,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  };
}

/** The eight catalog range tops, as the picker receives them. */
const rangeTops = [
  { id: 30001, pelicanCode: "SC-RT-GAS-30", name: 'Gas Range Top 30"', category: "Range Tops", size: '30"', imageUrl: "/a.jpg" },
  { id: 30002, pelicanCode: "SC-RT-GAS-36", name: 'Gas Range Top 36"', category: "Range Tops", size: '36"', imageUrl: "/b.jpg" },
  { id: 30003, pelicanCode: "SC-RT-ELEC-30", name: 'Electric Range Top 30"', category: "Range Tops", size: '30"', imageUrl: "/c.jpg" },
  { id: 30004, pelicanCode: "SC-RT-ELEC-36", name: 'Electric Range Top 36"', category: "Range Tops", size: '36"', imageUrl: "/d.jpg" },
  { id: 30005, pelicanCode: "SC-RT-SMOOTH-30", name: 'Smooth Top (Ceramic) 30"', category: "Range Tops", size: '30"', imageUrl: "/e.jpg" },
  { id: 30006, pelicanCode: "SC-RT-SMOOTH-36", name: 'Smooth Top (Ceramic) 36"', category: "Range Tops", size: '36"', imageUrl: "/f.jpg" },
  { id: 30007, pelicanCode: "SC-RT-INDUCTION-30", name: 'Induction Range Top 30"', category: "Range Tops", size: '30"', imageUrl: "/g.jpg" },
  { id: 30008, pelicanCode: "SC-RT-INDUCTION-36", name: 'Induction Range Top 36"', category: "Range Tops", size: '36"', imageUrl: "/h.jpg" },
];

describe("range tops on a range base, the way sinks go in a sink base", () => {
  it("offers the catalog range tops that fit the base width", () => {
    const thirty = rangeTopRowsForBase(rangeTops, base("RB3DB30", 60, 30));
    expect(thirty.map((row) => row.pelicanCode)).toEqual([
      "SC-RT-GAS-30", "SC-RT-ELEC-30", "SC-RT-SMOOTH-30", "SC-RT-INDUCTION-30",
    ]);
    const thirtySix = rangeTopRowsForBase(rangeTops, base("RB3DB36", 60, 36));
    expect(thirtySix.map((row) => row.pelicanCode)).toEqual([
      "SC-RT-GAS-36", "SC-RT-ELEC-36", "SC-RT-SMOOTH-36", "SC-RT-INDUCTION-36",
    ]);
  });

  it("recognises a range top row by category, item code or product id", () => {
    expect(isRangeTopRow(rangeTops[0]!)).toBe(true);
    expect(isRangeTopRow({ id: 30001, name: "x", category: null })).toBe(true);
    expect(isRangeTopRow({ id: 1, name: "x", category: "Sinks" })).toBe(false);
  });

  it("reads a row's published width, and fits it within the 3-inch step", () => {
    expect(rangeTopRowWidthIn({ size: '30"' })).toBe(30);
    expect(rangeTopRowWidthIn({ name: 'Gas Range Top 36"' })).toBe(36);
    expect(rangeTopRowWidthIn({ size: null, name: "Range top" })).toBeNull();
    const base30 = base("RB3DB30", 60, 30);
    expect(rangeTopRowFitsBase(rangeTops[0]!, base30)).toBe(true);
    expect(rangeTopRowFitsBase(rangeTops[1]!, base30)).toBe(false);
    expect(rangeTopRowDisabledReason(rangeTops[1]!, base30)).toMatch(/36″ .* does not fit this 30″ range base/);
  });

  it("exposes the same config surface a sink base has", () => {
    const config = rangeBaseConfig(base("RB3DB30", 60, 30));
    expect(config.selectable).toBe(true);
    expect(config.topWidthIn).toBe(30);
    expect(config.options).toEqual([...RANGE_BASE_CONFIG_OPTIONS]);
    expect(config.options).toContain("range-top");
    // A plain base has none of it.
    expect(rangeBaseConfig({ masterCode: "B24" }).options).toEqual([]);
    expect(rangeBaseTopWidthIn({ masterCode: "RB3DB36" })).toBe(36);
  });

  it("seats the chosen range top IN the base's countertop, like a sink in a sink base", () => {
    const host = base("RB3DB30", 60, 30);
    const result = placeRangeTopOnBase({ base: host, placed: [host], room, row: rangeTops[0]! });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.top.applianceRole).toBe("countertop-opening");
    expect(result.top.uid).toBe("range-base:cooktop");
    // Its top meets the finished 36" countertop line.
    expect(Number(result.top.mountBottom) + Number(result.top.height)).toBeCloseTo(36, 2);
    // Centered on the base, same wall and spot.
    expect(result.top.x).toBe(host.x);
    expect(result.top.width).toBe(30);
    // It is drawn, and it is display-only: no price ever travels with it.
    expect(isRangeTopPlacement(result.top)).toBe(true);
    expect(result.top.applianceCatalogPrice).toBeNull();
    expect(result.billable).toBe(false);
    expect(rangeTopOnBase(host, result.placed)?.masterCode).toBe("SC-RT-GAS-30");
  });

  it("replaces an earlier top on the same base instead of stacking two", () => {
    const host = base("RB3DB30", 60, 30);
    const first = placeRangeTopOnBase({ base: host, placed: [host], room, row: rangeTops[0]! });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = placeRangeTopOnBase({ base: host, placed: first.placed, room, row: rangeTops[2]! });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const tops = second.placed.filter((item) => isRangeTopPlacement(item));
    expect(tops).toHaveLength(1);
    expect(tops[0]!.masterCode).toBe("SC-RT-ELEC-30");
  });

  it("refuses a freestanding range as the thing on a range base", () => {
    const host = base("RB3DB30", 60, 30);
    const result = placeRangeTopOnBase({
      base: host,
      placed: [host],
      room,
      row: { id: 9001, name: '30" Freestanding Range', category: "Appliances", size: '30"' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/not a range top/);
    expect(result.reason).toMatch(/never a freestanding range/);
  });

  it("refuses a plain base, which is not a range base", () => {
    const plain: PlacedCabinet = { ...base("B30", 60, 30) };
    const result = placeRangeTopOnBase({ base: plain, placed: [plain], room, row: rangeTops[0]! });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/not a range base/);
  });

  it("tells a freestanding range unit apart from a range top", () => {
    const rangeTop = placeRangeTopOnBase({ base: base("RB3DB30", 60, 30), placed: [], room, row: rangeTops[0]! });
    expect(rangeTop.ok).toBe(true);
    if (!rangeTop.ok) return;
    expect(isFreestandingRangeUnit(rangeTop.top)).toBe(false);
    const freestanding: PlacedCabinet = {
      ...base("RANGE-30", 60, 30),
      placement: "appliance",
      applianceRole: "freestanding",
      description: "30 inch Freestanding Range",
    };
    expect(isFreestandingRangeUnit(freestanding)).toBe(true);
  });
});
