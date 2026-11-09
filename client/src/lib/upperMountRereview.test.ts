import { describe, expect, it } from "vitest";
import {
  normalizeStandardWallMounts,
  overRangeCookingFloorIn,
  overSinkOrRangeNeighborAlignedMountBottom,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { normalizeUpperHeights } from "./designerFaceRules";
import { applyDesignerLayoutRules } from "./designerLayoutRules";

const room: RoomData = { width: 168, depth: 120, ceilingHeight: 96 };

function item(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode">): PlacedCabinet {
  return { cabinetId: 1, description: "", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 30, rotation: 0, ...partial };
}
const wall = (uid: string, x: number, height: number, extra: Partial<PlacedCabinet> = {}) =>
  item({ uid, masterCode: `W15${height}`, description: `15x${height} Wall Cabinet`, x, width: 15, height, ...extra });
const upper = (height: number, extra: Partial<PlacedCabinet> = {}) =>
  item({ uid: `w24${height}`, masterCode: `W24${height}`, description: `24x${height} Wall Cabinet`, x: 51, width: 24, height, ...extra });
const sinkBase = item({ uid: "sb30", masterCode: "SB30", description: "Sink Base 30", placement: "base", x: 48, width: 30, depth: 24, height: 34.5 });
const range = item({ uid: "range30", masterCode: "RANGE-30", description: "30 inch Range", placement: "appliance", x: 48, width: 30, depth: 26, height: 36 });
const layout = (placed: PlacedCabinet[]) => applyDesignerLayoutRules({
  placed, room, openings: [], fillers: [], makeUid: () => "uid", styleId: null, allowAutoFillers: false,
}).placed;

describe("re-review fixes for upper mounting", () => {
  it("1. a customer-moved upper keeps its height through the upper-height pass", () => {
    const moved = wall("moved", 100, 30, { mountBottom: 60, mountBottomAdjusted: true });
    expect(normalizeUpperHeights([moved])[0]).toBe(moved);
    expect(normalizeUpperHeights([moved], { room })[0]).toBe(moved);
    expect(layout([moved]).find((cabinet) => cabinet.uid === "moved")?.mountBottom).toBe(60);
  });

  it("2. an 18-inch range upper at 72 never drops below the cooking clearance", () => {
    const plan = [range, wall("left", 36, 30), upper(18, { mountBottom: 72 }), wall("right", 75, 30)];
    expect(normalizeStandardWallMounts(plan, [], room).find((cabinet) => cabinet.uid === "w2418")?.mountBottom).toBe(72);
    expect(normalizeUpperHeights(plan, { room }).find((cabinet) => cabinet.uid === "w2418")?.mountBottom).toBe(72);
    expect(layout(plan).find((cabinet) => cabinet.uid === "w2418")?.mountBottom).toBe(72);
    // Under a hood the rule is set aside, but the cabinet still holds the floor.
    const hood = item({ uid: "hood", masterCode: "HOOD-30", description: "30 inch Range Hood", placement: "appliance", x: 48, width: 30, depth: 20, height: 10, mountBottom: 66 });
    expect(overRangeCookingFloorIn(upper(18), [range, hood], room)).toBe(76);
    expect(normalizeStandardWallMounts([range, hood, upper(18)], [], room)[2].mountBottom).toBe(76);
    // An upper that is not over the sink or range hangs exactly as before (84 - 18).
    const elsewhere = wall("elsewhere", 120, 18);
    expect(overRangeCookingFloorIn(elsewhere, [range, elsewhere], room)).toBeNull();
    expect(normalizeStandardWallMounts([range, elsewhere], [], room)[1].mountBottom).toBe(66);
  });

  it("3. a wall-placed hood front (RHF30) sets the over-range rule aside like an appliance hood", () => {
    const rhf = item({ uid: "rhf", masterCode: "RHF30", description: "30 inch Range Hood Front", placement: "wall", x: 48, width: 30, depth: 12, height: 12, mountBottom: 60 });
    const plan = [range, wall("left", 36, 42), rhf, upper(18), wall("right", 75, 42)];
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(18), plan, [], room)).toBeNull();
    // Not re-hung to the 42-inch neighbours' line at 78; held at the 72-inch floor.
    expect(normalizeStandardWallMounts(plan, [], room).find((cabinet) => cabinet.uid === "w2418")?.mountBottom).toBe(72);
  });

  it("4. a right-face peninsula upper does not align to a left-face sink and neighbour", () => {
    const left = (cabinet: PlacedCabinet): PlacedCabinet => ({ ...cabinet, peninsulaSide: "left" });
    const right = (cabinet: PlacedCabinet): PlacedCabinet => ({ ...cabinet, peninsulaSide: "right" });
    const plan = [left(sinkBase), left(wall("left", 36, 42)), left(wall("right", 75, 42))];
    expect(overSinkOrRangeNeighborAlignedMountBottom(right(upper(30)), plan, [], room)).toBeNull();
    expect(overSinkOrRangeNeighborAlignedMountBottom(left(upper(30)), plan, [], room)).toBe(66);
  });

  it("5. an overlapping upper is not 'beside' the cabinet; only a real adjoining edge sets the line", () => {
    const overlapping = wall("overlap", 60, 42);
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(30), [sinkBase, overlapping], [], room)).toBeNull();
    // A 2-inch gap is not an adjoining edge; 1 inch is.
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(30), [sinkBase, wall("gap2", 34, 42)], [], room)).toBeNull();
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper(30), [sinkBase, wall("gap1", 35, 42)], [], room)).toBe(66);
  });
});
