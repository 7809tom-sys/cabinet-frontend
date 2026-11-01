import { describe, expect, it } from "vitest";
import { cabinetWall, wallPlacementAt, wallCabinetFitMeasure, type PlacedCabinet, type RoomData } from "./design";
import { normalizeOverApplianceWallMounts, overApplianceWallMount } from "./overApplianceMount";

const room: RoomData = { width: 200, depth: 120, ceilingHeight: 96 };

function item(over: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "placement" | "width" | "height">, start: number, depth = 24): PlacedCabinet {
  const spot = wallPlacementAt(start, over.width, depth, "top", room);
  return { cabinetId: 1, description: over.masterCode, category: "x", subCategory: null, ...spot, depth, rotation: spot.rotation, ...over } as PlacedCabinet;
}
const fridge = (h = 70) => item({ uid: "f", masterCode: "FRIDGE-36", placement: "appliance", width: 36, height: h }, 40, 30);
const range = () => item({ uid: "r", masterCode: "RANGE-30", placement: "appliance", width: 30, height: 36 }, 40, 25);
const upper = (code: string, h: number, w = 36) => item({ uid: `u${h}`, masterCode: code, placement: "wall", width: w, height: h }, 40, 24);

describe("fridge and range cabinets mount at 72 inches", () => {
  for (const h of [12, 15, 18, 24]) {
    it(`a ${h} in cabinet dropped by hand over a 70 in fridge lands at 72 and joins the fridge assembly`, () => {
      const mount = overApplianceWallMount(upper(`W36${h}24`, h), [fridge()], room);
      expect(mount).toMatchObject({ kind: "refrigerator", mountBottom: 72, refrigeratorUid: "f", warning: null });
    });
    it(`a ${h} in cabinet over a range lands at 72`, () => {
      expect(overApplianceWallMount(upper(`W30${h}`, h, 30), [range()], room)).toMatchObject({ kind: "range", mountBottom: 72 });
    });
  }

  it("goes above a fridge taller than 72 in, and warns (without clipping) when that passes the ceiling", () => {
    expect(overApplianceWallMount(upper("W362424", 24), [fridge(74)], room)).toMatchObject({ mountBottom: 76 });
    const tallRoom = { ...room, ceilingHeight: 96 };
    const mount = overApplianceWallMount(upper("W362424", 24), [fridge(74)], tallRoom)!;
    expect(mount.mountBottom + 24).toBeGreaterThan(96);
    expect(mount.warning).toMatch(/past the 96" ceiling/);
  });

  it("sits on top of an over-the-range microwave", () => {
    const mw = item({ uid: "mw", masterCode: "MW-30", placement: "appliance", width: 30, height: 16, mountBottom: 56 }, 40, 15);
    expect(overApplianceWallMount(upper("W301524", 15, 30), [range(), mw], room)).toMatchObject({ kind: "microwave", mountBottom: 72 });
    const highMw = { ...mw, mountBottom: 62 };
    expect(overApplianceWallMount(upper("W301524", 15, 30), [range(), highMw], room)).toMatchObject({ kind: "microwave", mountBottom: 78 });
  });

  it("leaves hoods and hood fronts with their own mounting", () => {
    const hood = item({ uid: "h", masterCode: "HOOD-30", placement: "appliance", width: 30, height: 18, mountBottom: 66 }, 40, 18);
    expect(overApplianceWallMount(upper("W301524", 15, 30), [range(), hood], room)).toBeNull();
    expect(overApplianceWallMount(upper("RHF30", 18, 30), [range()], room)).toBeNull();
  });

  it("an ordinary upper keeps the 54 inch default, as do uppers not over a fridge or range", () => {
    expect(overApplianceWallMount(upper("W3030", 30), [fridge()], room)).toBeNull();
    expect(overApplianceWallMount(upper("W361224", 12), [], room)).toBeNull();
    const far = item({ uid: "far", masterCode: "W3024", placement: "wall", width: 30, height: 24 }, 120, 24);
    expect(overApplianceWallMount(far, [fridge(), range()], room)).toBeNull();
  });

  it("normalizing a plan fixes a hand-placed cabinet and respects a customer-set mount", () => {
    const hand = { ...upper("W362424", 24), mountBottom: 54 };
    const out = normalizeOverApplianceWallMounts([fridge(), hand], room);
    expect(out.find((p) => p.uid === hand.uid)).toMatchObject({ mountBottom: 72, refrigeratorAssemblyId: "f", refrigeratorAssemblyRole: "bridge" });
    const set = { ...hand, mountBottomAdjusted: true };
    expect(normalizeOverApplianceWallMounts([fridge(), set], room).find((p) => p.uid === hand.uid)!.mountBottom).toBe(54);
  });

  it("snap advice never points a bridge still at the default mount back at the fridge", () => {
    const hand = { ...upper("W362424", 24), description: "36 inch Refrigerator Wall Cabinet", mountBottom: 54 } as PlacedCabinet;
    const other = item({ uid: "w2", masterCode: "W2142", placement: "wall", width: 21, height: 42 }, 100, 12);
    const measure = wallCabinetFitMeasure({ ...hand, x: hand.x + 4 }, room, [fridge(), other], []);
    const fridgeEnd = 40 + 36;
    // The clear opening starts after the fridge, so neither it nor the snap range reaches back over it.
    expect(measure.availableStart).toBeGreaterThanOrEqual(fridgeEnd - 0.01);
    expect(measure.snapStart).toBeGreaterThanOrEqual(fridgeEnd - 0.01);
  });
});
