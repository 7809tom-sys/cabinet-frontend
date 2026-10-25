import { describe, expect, it } from "vitest";
import { countertopSurfaces, type PlacedCabinet, type RoomData } from "@/lib/design";

const room: RoomData = { width: 192, depth: 144, ceilingHeight: 96 };
const base = (uid: string, x: number, w: number, depth = 24, extra: Record<string, unknown> = {}) => ({
  uid, cabinetId: 1, masterCode: `B${w}`, description: "Base", category: "Base Cabinets", placement: "base",
  x, y: 0, width: w, depth, height: 34.5, rotation: 0, ...extra,
} as PlacedCabinet);
const slabs = (placed: PlacedCabinet[]) => countertopSurfaces(placed, room, null).filter((s) => s.kind === "base");

describe("countertop void filling on a straight wall run", () => {
  it("one slab when cabinets touch", () => {
    expect(slabs([base("a", 0, 24), base("b", 24, 24), base("c", 48, 24)])).toHaveLength(1);
  });
  it("closes a 1/8 inch seam between cabinets", () => {
    const s = slabs([base("a", 0, 24), base("b", 24.125, 24), base("c", 48.25, 24)]);
    expect(s).toHaveLength(1);
    expect(s[0]!.width).toBeCloseTo(72.25, 2);
  });
  it("closes a 1 inch and a 6 inch empty void with no appliance in it", () => {
    expect(slabs([base("a", 0, 24), base("b", 25, 24), base("c", 49, 24)])).toHaveLength(1);
    const wide = slabs([base("a", 0, 24), base("b", 30, 24), base("c", 60, 24)]);
    expect(wide).toHaveLength(1);
    expect(wide[0]!.width).toBeCloseTo(84, 2);
  });
  it("joins cabinets whose depths differ slightly instead of stopping the run", () => {
    expect(slabs([base("a", 0, 24), base("b", 24, 24, 24.75), base("c", 48, 24)])).toHaveLength(1);
  });
  it("still breaks the run where a range stands in the gap", () => {
    const range = base("r", 24, 30, 25, { masterCode: "RANGE30", description: "30\" Freestanding Range", category: "Appliances" });
    expect(slabs([base("a", 0, 24), range, base("c", 54, 24)])).toHaveLength(2);
  });
});
