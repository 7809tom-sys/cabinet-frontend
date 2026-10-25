import { describe, expect, it } from "vitest";
import { countertopSurfaceCoversCabinet, threeDStandardCountertopSurfaces } from "./InteractiveRoom3D";
import { countertopSurfaces, type PlacedCabinet, type RoomData } from "@/lib/design";

/**
 * Regression (Oct 3 2026 screenshot): free-standing base cabinets in the
 * middle of an empty room lost their tops in 3D and a stray slab floated on
 * the nearest wall. The shared surface builder snaps run-less cabinets to a
 * wall; the 3D view must only trust a shared slab that really covers the box.
 */
const room: RoomData = { width: 192, depth: 144, ceilingHeight: 96 };
const cab = (o: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "x", cabinetId: 1, masterCode: "B24", description: "Base", placement: "base",
  x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, ...o,
});

describe("free-standing base countertops in 3D", () => {
  const freestanding = [
    cab({ uid: "a", x: 40, y: 70 }), cab({ uid: "b", x: 64, y: 70 }), cab({ uid: "c", x: 88, y: 70 }),
    cab({ uid: "d", x: 114, y: 74, rotation: 45 }),
  ];
  it("gives free-standing cabinets their own mitered chain slab and never a wall-snapped one", () => {
    const surfaces = countertopSurfaces(freestanding, room);
    // No slab is parked on a wall: every surface sits down in the room where the cabinets are.
    for (const surface of surfaces) {
      expect(surface.y).toBeGreaterThan(5);
      expect(surface.x + surface.width).toBeLessThan(room.width - 5);
    }
    // The three touching bases share ONE chain slab; the loose 45° box (not flush yet) gets its own.
    const chainSlabs = surfaces.filter((s) => s.freestandingMemberUids?.length);
    expect(chainSlabs.length).toBeGreaterThanOrEqual(1);
    expect(chainSlabs.some((s) => ["a", "b", "c"].every((uid) => s.freestandingMemberUids!.includes(uid)))).toBe(true);
    // The 3D view trusts those slabs because each really covers its cabinets.
    const shared = threeDStandardCountertopSurfaces(room, freestanding);
    expect(shared.length).toBe(surfaces.length);
    for (const cabinet of freestanding) {
      expect(surfaces.some((s) => countertopSurfaceCoversCabinet(s, cabinet))).toBe(true);
    }
  });
  it("still uses one shared slab for a seated wall run", () => {
    const seated = [
      cab({ uid: "a", x: 0, y: 0, wallId: "top", wallOffset: 0 }),
      cab({ uid: "b", x: 24, y: 0, wallId: "top", wallOffset: 24 }),
    ];
    const shared = threeDStandardCountertopSurfaces(room, seated);
    expect(shared).toHaveLength(1);
    expect(shared[0]!.width).toBe(48);
    for (const cabinet of seated) expect(countertopSurfaceCoversCabinet(shared[0]!, cabinet)).toBe(true);
  });
});
