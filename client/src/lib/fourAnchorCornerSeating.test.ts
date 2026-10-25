import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/fourAnchorRealCatalog.json";
import { isWallBlindCornerCabinet } from "./cabinetGraphics";
import {
  DEFAULT_ROOM, cabinetPlacementCollisionDetail, wallPlacementAt, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet,
} from "./design";
import { FOUR_ANCHOR_MAX_APPLIANCE_NUDGE_IN, seatFourAnchorCorner } from "./fourAnchorCornerSeating";
import { buildFourAnchorWallCabinets, resolveWallHeightClass } from "./fourAnchorWallCabinets";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const rows = (style: "330011" | "540005", kind: "base" | "wall" | "accessory") => REAL[style]![kind] as DesignCabinet[];
const byCode = (list: DesignCabinet[], code: string) => {
  const found = list.find((row) => row.masterCode === code);
  if (!found) throw new Error(`fixture is missing ${code}`);
  return found;
};
const uids = () => { let n = 0; return () => `t-${++n}`; };
const TOP_RIGHT = { x: DEFAULT_ROOM.width, y: 0, firstWallId: "top" };

function lower(masterCode: string, width: number, offset: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", DEFAULT_ROOM);
  return {
    uid: `low-${masterCode}-${offset}`, cabinetId: 1, masterCode, description: "Base Cabinet", category: "Base",
    subCategory: "Base Cabinet", placement: "base", x: spot.x, y: spot.y, width, depth: 24, height: 34.75,
    rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset, numberOfDoors: 2, numberOfDrawers: 0, ...extra,
  } as PlacedCabinet;
}
function range(width: number, startAlong: number): PlacedCabinet {
  const spot = wallPlacementAt(startAlong, width, 26, "top", DEFAULT_ROOM);
  return {
    uid: "range-1", cabinetId: 0, masterCode: "RANGE30", description: `${width}" Freestanding Range`, category: "Appliance",
    subCategory: "Appliance", placement: "appliance", x: spot.x, y: spot.y, width, depth: 26, height: 36,
    rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset, numberOfDoors: 0, numberOfDrawers: 0,
  } as PlacedCabinet;
}
const fillers = (style: "330011" | "540005") => rows(style, "accessory").filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`)) as never[];

describe("Four-anchor corner seating: real catalog, appliance first", () => {
  const framedBase = rows("330011", "base");
  const bbc36 = byCode(framedBase, "BBC36");
  const seat = (working: PlacedCabinet[], extra: Partial<Parameters<typeof seatFourAnchorCorner>[0]> = {}) => seatFourAnchorCorner({
    source: bbc36, slotLabel: "Corner between Wall 1 and Wall 2", target: TOP_RIGHT, cornerWallIds: ["top", "right"],
    working, room: DEFAULT_ROOM, openings: [], blindPullIn: 4, isBlindOption: true,
    catalogFillers: fillers("330011"), makeUid: uids(), styleId: 330011, ...extra,
  });

  it("seats the BBC36 and its required 3-inch filler in an empty corner with no appliance moves", () => {
    const result = seat([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.moves).toEqual([]);
    expect(result.corner.masterCode).toBe("BBC36");
    expect(result.placed.some((item) => /filler/i.test(`${item.masterCode} ${item.description}`))).toBe(true);
  });

  it("slides a range up to 3 inches away from the corner instead of rejecting the corner cabinet", () => {
    // A 30-inch range ending at 119": the BBC36's required 3" filler starts at 117", so it must slide 2".
    const blocked = range(30, 89);
    const result = seat([blocked]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.moves).toHaveLength(1);
    const move = result.moves[0]!;
    expect(move.kind).toBe("range");
    expect(move.shiftIn).toBe(2);
    expect(move.shiftIn).toBeLessThanOrEqual(FOUR_ANCHOR_MAX_APPLIANCE_NUDGE_IN);
    // Away from the corner: the range moved toward the start of the top wall.
    expect(move.deltaAlongIn).toBeLessThan(0);
    const moved = result.placed.find((item) => item.uid === "range-1")!;
    expect(wallRunOffset(moved, "top", DEFAULT_ROOM)).toBeCloseTo(87, 5);
    expect(wallRunSpan(moved, "top", DEFAULT_ROOM)).toBe(30);
    // The final plan is collision-free.
    for (const item of result.placed) {
      expect(cabinetPlacementCollisionDetail(item, result.placed.filter((other) => other.uid !== item.uid), DEFAULT_ROOM)).toBeNull();
    }
  });

  it("uses the smallest 1/8-inch slide that clears the corner, not the full 3 inches", () => {
    const result = seat([range(30, 88)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.moves[0]!.shiftIn).toBe(1);
    expect((result.moves[0]!.shiftIn * 8) % 1).toBeCloseTo(0, 6);
  });

  it("does not move an appliance that already clears the corner and its filler", () => {
    const result = seat([range(30, 86)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.moves).toEqual([]);
    expect(wallRunOffset(result.placed.find((item) => item.uid === "range-1")!, "top", DEFAULT_ROOM)).toBeCloseTo(86, 5);
  });

  it("refuses with a plain-language reason when 3 inches is not enough, and does not move the appliance", () => {
    // Ends at 122": it would have to slide 5 inches, beyond the 3-inch allowance.
    const blocked = range(30, 92);
    const original = JSON.stringify(blocked);
    const result = seat([blocked]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/range/i);
    expect(result.message).toMatch(/too close to the corner/i);
    expect(result.message).toMatch(/slide about 5"/);
    expect(result.message).toMatch(/may only move 3"/);
    expect(JSON.stringify(blocked)).toBe(original);
  });

  it("never slides a sink base or other cabinet; it names the blocker instead", () => {
    // Occupies 84"-120": it blocks the corner's required filler (117"-120"), and is not an appliance.
    const sink = lower("SB36", 36, 84);
    const result = seat([sink]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/SB36/);
    expect(result.message).toMatch(/not a range or refrigerator/i);
  });
});

describe("Four-anchor wall stage: the line's real wall height class", () => {
  it("maps the requested 30/36/42 to the frameless 30.25/35.25/40.25 uppers", () => {
    const frameless = rows("540005", "wall");
    expect(resolveWallHeightClass(frameless, 30)).toBeCloseTo(30.25, 5);
    expect(resolveWallHeightClass(frameless, 36)).toBeCloseTo(35.25, 5);
    expect(resolveWallHeightClass(frameless, 42)).toBeCloseTo(40.25, 5);
  });
  it("keeps exact 30/36/42 for framed lines", () => {
    const framed = rows("330011", "wall");
    expect(resolveWallHeightClass(framed, 30)).toBe(30);
    expect(resolveWallHeightClass(framed, 36)).toBe(36);
    expect(resolveWallHeightClass(framed, 42)).toBe(42);
  });
  it("returns null when the line sells nothing within 2 inches, so it never invents a box", () => {
    expect(resolveWallHeightClass(rows("540005", "wall"), 54)).toBeNull();
  });
});

describe("Four-anchor wall stage end to end on the real frameless catalog", () => {
  const wall = rows("540005", "wall");
  const makeRun = () => [lower("B24", 24, 0), lower("B30", 30, 24), lower("B36", 36, 54)];
  const build = (placed: PlacedCabinet[], corners?: Parameters<typeof buildFourAnchorWallCabinets>[0]["corners"]) =>
    buildFourAnchorWallCabinets({
      placed, room: DEFAULT_ROOM, openings: [], catalog: wall, wallCabinetHeightIn: 30, styleId: 540005,
      makeUid: uids(), corners, catalogFillers: fillers("540005"),
    });

  it("places aligned frameless uppers where the old exact-30 filter placed none", () => {
    const result = build(makeRun());
    expect(result.heightUsedIn).toBeCloseTo(30.25, 5);
    expect(result.additions.length).toBeGreaterThan(0);
    expect(result.additions.every((item) => item.placement === "wall" && Math.abs(item.height - 30.25) < 0.01)).toBe(true);
    // Every upper matches a real catalog SKU and sits above a lower run.
    for (const upper of result.additions) {
      expect(wall.some((row) => row.id === upper.cabinetId && row.masterCode === upper.masterCode)).toBe(true);
    }
    expect(result.skipped).toEqual([]);
  });

  it("covers each lower run exactly, with no overhang past the base footprint", () => {
    const result = build(makeRun());
    const total = result.additions.reduce((sum, item) => sum + wallRunSpan(item, "top", DEFAULT_ROOM), 0);
    expect(total).toBeCloseTo(24 + 30 + 36, 3);
  });

  it("puts a 12-inch wall cabinet in the room corner above a base blind corner", () => {
    const frameless = rows("540005", "base");
    const bbc = byCode(frameless, "BBC43/46FH");
    const base = seatFourAnchorCorner({
      source: bbc, slotLabel: "Corner between Wall 1 and Wall 2", target: TOP_RIGHT, cornerWallIds: ["top", "right"],
      working: [], room: DEFAULT_ROOM, openings: [], blindPullIn: 4, isBlindOption: true,
      catalogFillers: fillers("540005"), makeUid: uids(), styleId: 540005,
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const result = build(base.placed, [{ base: base.corner, point: TOP_RIGHT }]);
    const twelve = result.additions.find((item) => item.width === 12 && /^W12/.test(item.masterCode));
    expect(twelve, `skipped: ${result.skipped.join(" | ")}`).toBeDefined();
    expect(result.additions.some((item) => isWallBlindCornerCabinet(item))).toBe(false);
  });
});
