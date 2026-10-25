import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  autoPlaceRangeFillers,
  rangeOvenClearanceViolations,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/**
 * A built-in oven cabinet carries its oven INSIDE a 24"-deep box: the oven door
 * and handle live inside the cabinet opening and can never reach a neighbor, so
 * the free-standing range "handle clearance" filler rule must never apply to it
 * (user rule, 2026-10-19). Real catalog rows from the framed (330011) and
 * frameless (540005) lines are used so the SKU naming is the production naming.
 */
interface Row {
  masterCode: string; description: string; width: string; height: string; depth: string;
  placement: string; styleId: number;
}
const rows: Row[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "client/src/lib/__fixtures__/ovenCabinetRows.json"), "utf8"),
);
const row = (code: string): Row => {
  const found = rows.find((r) => r.masterCode === code);
  if (!found) throw new Error(`fixture row ${code} missing`);
  return found;
};
const ROOM: RoomData = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function placedFromRow(code: string, over: Partial<PlacedCabinet>): PlacedCabinet {
  const r = row(code);
  return {
    uid: over.uid ?? code,
    cabinetId: 1,
    masterCode: r.masterCode,
    description: r.description,
    placement: r.placement as PlacedCabinet["placement"],
    x: 0, y: 0,
    width: parseFloat(r.width),
    depth: parseFloat(r.depth),
    height: parseFloat(r.height),
    rotation: 0,
    ...over,
  } as PlacedCabinet;
}
const base = (over: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "b", cabinetId: 2, masterCode: "B30", description: '30" Base Cabinet',
  placement: "base", x: 0, y: 0, width: 30, depth: 24, height: 34.5, rotation: 0, ...over,
} as PlacedCabinet);
const freestandingRange = (over: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "r", cabinetId: 3, masterCode: "RANGE-30", description: '30" Stainless Gas Range',
  placement: "appliance", x: 0, y: 0, width: 30, depth: 25, height: 36, rotation: 0, ...over,
} as PlacedCabinet);

const OVEN_CABINETS = [
  "O338424", "O339624", "UOC3390(O339024)",       // framed line oven pantries
  "TOS2DB3084", "TOS3DB3089", "TOD3094",          // frameless single / double oven towers
];

describe("built-in oven cabinets never need the range-handle clearance filler", () => {
  it.each(OVEN_CABINETS)("%s in the left corner beside a base cabinet is not a conflict", (code) => {
    const r = row(code);
    expect(r.placement).toBe("tall"); // it is a cabinet, not a free-standing appliance
    const oven = placedFromRow(code, { uid: "oven", x: 0 });
    const w = parseFloat(r.width);
    const neighbor = base({ x: w, width: 30 }); // butts the oven cabinet, no filler
    expect(rangeOvenClearanceViolations([oven, neighbor], ROOM).size).toBe(0);
  });

  it.each(OVEN_CABINETS)("%s in the right-hand corner beside a base cabinet is not a conflict", (code) => {
    const r = row(code);
    const w = parseFloat(r.width);
    const oven = placedFromRow(code, { uid: "oven", x: ROOM.width - w });
    const neighbor = base({ x: ROOM.width - w - 30, width: 30 });
    expect(rangeOvenClearanceViolations([oven, neighbor], ROOM).size).toBe(0);
  });

  it("an oven cabinet on a rotated (left/right wall) run is not a conflict either", () => {
    const oven = placedFromRow("O339624", { uid: "oven", x: 0, y: 0, rotation: 90 });
    const neighbor = base({ x: 0, y: 33, rotation: 90, width: 30 });
    expect(rangeOvenClearanceViolations([oven, neighbor], ROOM).size).toBe(0);
  });

  it("a Range Base cabinet (a base box under a cooktop) is not a free-standing range either", () => {
    const rb = placedFromRow("RB2DB30", { uid: "rb", x: 0 });
    expect(rb.placement).toBe("base");
    const neighbor = base({ x: 30, width: 24 });
    expect(rangeOvenClearanceViolations([rb, neighbor], ROOM).size).toBe(0);
  });

  it("auto filler placement leaves an oven cabinet run untouched (same array reference)", () => {
    const oven = placedFromRow("TOS2DB3084", { uid: "oven", x: 0 });
    const input = [oven, base({ x: 30, width: 30 })];
    const { placed, added } = autoPlaceRangeFillers(input, ROOM);
    expect(added).toHaveLength(0);
    expect(placed).toBe(input);
  });

  it("an oven cabinet beside a free-standing range never adds a filler requirement for the oven cabinet side", () => {
    // range in the corner, oven cabinet butting it: nothing to flag (user: never a filler beside an oven cabinet)
    const range = freestandingRange({ x: 0 });
    const oven = placedFromRow("O339624", { uid: "oven", x: 30 });
    expect(rangeOvenClearanceViolations([range, oven], ROOM).size).toBe(0);
  });
});

describe("the free-standing range rule is unchanged", () => {
  it("still flags a free-standing range in the corner butting a base cabinet", () => {
    const bad = rangeOvenClearanceViolations([freestandingRange({ x: 0 }), base({ x: 30, width: 24 })], ROOM);
    expect(bad.has("r")).toBe(true);
  });
  it("still flags it at the right-hand corner", () => {
    const bad = rangeOvenClearanceViolations(
      [freestandingRange({ x: ROOM.width - 30 }), base({ x: ROOM.width - 30 - 24, width: 24 })],
      ROOM,
    );
    expect(bad.has("r")).toBe(true);
  });
  it("is satisfied by the 3-inch filler and auto placement still inserts it", () => {
    const input = [freestandingRange({ x: 0 }), base({ x: 30, width: 24 })];
    const { placed, added } = autoPlaceRangeFillers(input, ROOM);
    expect(added).toHaveLength(1);
    expect(rangeOvenClearanceViolations(placed, ROOM).size).toBe(0);
  });
});
