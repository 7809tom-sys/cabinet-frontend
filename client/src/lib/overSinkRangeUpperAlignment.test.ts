import { describe, expect, it } from "vitest";
import {
  elevationBox,
  normalizeOverSinkWallMounts,
  normalizeStandardWallMounts,
  overSinkOrRangeNeighborAlignedMountBottom,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";
import { normalizeOverApplianceWallMounts, overApplianceWallMount } from "./overApplianceMount";
import { applyDesignerLayoutRules } from "./designerLayoutRules";

const room: RoomData = { width: 168, depth: 120, ceilingHeight: 96 };

function item(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode">): PlacedCabinet {
  return {
    cabinetId: 1, description: "", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 30, rotation: 0,
    ...partial,
  };
}

// Back wall: [W1542 36..51] [24" upper 51..75] [W1542 75..90], the upper centered on a 30" sink base or range (48..78).
const left = item({ uid: "left-42", masterCode: "W1542", description: "15x42 Wall Cabinet", x: 36, width: 15, height: 42 });
const right = item({ uid: "right-42", masterCode: "W1542", description: "15x42 Wall Cabinet", x: 75, width: 15, height: 42 });
const sinkBase = item({ uid: "sb30", masterCode: "SB30", description: "Sink Base 30", placement: "base", x: 48, width: 30, depth: 24, height: 34.5 });
const range = item({ uid: "range30", masterCode: "RANGE-30", description: "30 inch Range", placement: "appliance", x: 48, width: 30, depth: 26, height: 36 });
const upper = (height: number, x = 51, width = 24) =>
  item({ uid: `w${width}${height}`, masterCode: `W${width}${height}`, description: `${width}x${height} Wall Cabinet`, x, width, height });
const topOf = (cabinet: PlacedCabinet) => { const box = elevationBox(cabinet, room); return box.bottom + box.height; };

describe("upper over the sink or range joins its neighbour's top line (Tom, Nov 8)", () => {
  it("sink, tall: a W2430 between 42-inch uppers tops out at 96 instead of 84", () => {
    const w2430 = upper(30);
    expect(topOf(w2430)).toBe(84);
    const bottom = overSinkOrRangeNeighborAlignedMountBottom(w2430, [sinkBase, left, right], [], room);
    expect(bottom).toBe(66);
    expect(topOf({ ...w2430, mountBottom: bottom! })).toBe(topOf(left));
  });

  it("sink, short: a W2418 aligns to the 96-inch line instead of the 70-inch over-sink rule", () => {
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(18), [sinkBase, left, right], [], room)).toBe(78);
    const normalized = normalizeOverSinkWallMounts([sinkBase, left, upper(18), right], [], room);
    expect(normalized[2].mountBottom).toBeUndefined();
  });

  it("range: a bare-range upper tops out on its neighbours; over a microwave it sits on the 72-inch datum", () => {
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(18), [range, left, right], [], room)).toBe(78);
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(24), [range, left, right], [], room)).toBe(72);
    expect(overApplianceWallMount(upper(18), [range, left, right], room)).toMatchObject({ kind: "range", mountBottom: 78 });
    const microwave = item({ uid: "mw", masterCode: "MW-30", description: "Over the Range Microwave", placement: "appliance", x: 48, width: 30, depth: 16, height: 16, mountBottom: 56 });
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(24), [range, microwave, left, right], [], room)).toBe(72);
  });

  it("range: holds the cooking floor instead of dropping below it, and sets the rule aside over a hood", () => {
    // 72 + 30 passes the 96-inch ceiling; the cabinet still never drops below 72.
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(30), [range, left, right], [], room)).toBe(72);
    const hood = item({ uid: "hood", masterCode: "HOOD-30", description: "30 inch Range Hood", placement: "appliance", x: 48, width: 30, depth: 20, height: 10, mountBottom: 66 });
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(18), [range, hood, left, right], [], room)).toBeNull();
    const tallMicrowave = item({ uid: "mw", masterCode: "MW-30", description: "Over the Range Microwave", placement: "appliance", x: 48, width: 30, depth: 16, height: 17, mountBottom: 66 });
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(12), [range, tallMicrowave, left, right], [], room)).toBe(83);
  });

  it("an off-center upper does not count as over the sink or range", () => {
    // Center 2 in off the 63-inch sink center, still well inside the sink-base span.
    const offCenter = upper(30, 53);
    expect(overSinkOrRangeNeighborAlignedMountBottom(offCenter, [sinkBase, left, right], [], room)).toBeNull();
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(18, 53), [range, left, right], [], room)).toBeNull();
    // A 10-inch offset (the review case) is rejected too; 0.4 in is still centered.
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(30, 61), [sinkBase, left], [], room)).toBeNull();
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(30, 51.4), [sinkBase, left, right], [], room)).toBe(66);
  });

  it("every other upper keeps its normal 54-inch bottom, even beside 42-inch uppers", () => {
    const ordinary = upper(30);
    expect(overSinkOrRangeNeighborAlignedMountBottom(ordinary, [left, right], [], room)).toBeNull();
    const plan = [left, ordinary, right];
    expect(normalizeStandardWallMounts(plan, [], room).find((cabinet) => cabinet.uid === ordinary.uid)?.mountBottom).toBe(54);
  });

  it("keeps the ceiling and window clearance", () => {
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(30), [sinkBase, left, right], [], { ...room, ceilingHeight: 94 })).toBeNull();
    const window = { uid: "win", kind: "window", side: "top", offset: 48, width: 30, sill: 42, height: 24 } as WallOpening;
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(30), [sinkBase, left, right], [window], room)).toBeNull();
  });

  it("repairs a saved W2430 at 54 inches and leaves the repaired plan untouched on the next pass", () => {
    const saved = [sinkBase, { ...left, mountBottom: 54 }, { ...upper(30), mountBottom: 54 }, { ...right, mountBottom: 54 }];
    const repaired = normalizeStandardWallMounts(normalizeOverSinkWallMounts(saved, [], room), [], room);
    expect(repaired.find((cabinet) => cabinet.uid === "w2430")?.mountBottom).toBe(66);
    const again = normalizeStandardWallMounts(normalizeOverSinkWallMounts(repaired, [], room), [], room);
    expect(again).toBe(repaired);
  });

  it("a customer's own vertical move is not overridden", () => {
    const moved = { ...upper(30), mountBottom: 60, mountBottomAdjusted: true };
    const plan = [sinkBase, left, moved, right];
    expect(normalizeStandardWallMounts(plan, [], room)[2]).toBe(moved);
  });

  it("Auto Design's shared layout rules align the upper over the sink and over the range", () => {
    const run = (placed: PlacedCabinet[]) => applyDesignerLayoutRules({
      placed, room, openings: [], fillers: [], makeUid: () => "uid", styleId: null, allowAutoFillers: false,
    }).placed;
    expect(run([sinkBase, left, upper(30), right]).find((cabinet) => cabinet.uid === "w2430")?.mountBottom).toBe(66);
    expect(run([range, left, upper(18), right]).find((cabinet) => cabinet.uid === "w2418")?.mountBottom).toBe(78);
    const rangeOnly = normalizeOverApplianceWallMounts([range, left, upper(18), right], room);
    expect(rangeOnly[2].mountBottom).toBe(78);
  });
});
