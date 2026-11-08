import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addFurniture } from "@/components/design/InteractiveRoom3D";
import { FURNITURE_CATALOG, makeFurniture, type PlacedFurniture } from "./design";
import {
  SHOWER_BAY_TOLERANCE_IN,
  SHOWER_MIN_BAY_IN,
  findShowerBays,
  isShowerPanFurniture,
  isWallMountedShowerFixture,
  placeShowerPanInBay,
  seatShowerPanInBay,
  showerPanFit,
  showerRotationForInward,
} from "./showerPlacement";

/**
 * A shower pan installs in a three-wall alcove, exactly like an alcove tub: the
 * back and both ends against walls, the front lip exposed, length spanning the
 * opening. These tests pin that, and pin that nothing else on the floor is ever
 * moved to make room.
 */

/** A 60 x 36 shower alcove — the PL-016036's own bay. */
const SHOWER_ROOM = { width: 60, depth: 36 } as const;

const PAN_CODES = [
  "pelican-shower-pan-pl-016036c",
  "pelican-shower-pan-pl-016030l",
  "pelican-shower-pan-pl-016030r",
  "pelican-shower-pan-pl-smc6032c",
  "pelican-shower-pan-pl-014836c",
];

function pan(id = "pelican-shower-pan-pl-016036c"): PlacedFurniture {
  return makeFurniture(id, 0, 0);
}

describe("Shower pans are three-wall fixtures", () => {
  it("recognises shower pans and the wall-mounted shower fittings", () => {
    for (const id of PAN_CODES) expect(isShowerPanFurniture(pan(id)), id).toBe(true);
    expect(isShowerPanFurniture(pan("pelican-tub-pl-02146-59"))).toBe(false);
    expect(isWallMountedShowerFixture(pan("pelican-shower-surround-pl-483696-marble"))).toBe(true);
    expect(isWallMountedShowerFixture(pan("pelican-shower-niche-pl-sn1614"))).toBe(true);
    expect(isWallMountedShowerFixture(pan("pelican-shower-pan-pl-016036c"))).toBe(false);
  });

  it("finds a bay only where a wall is closed at both ends and long enough", () => {
    // Only the 60" walls can take a 48"-plus pan; the 36" returns cannot.
    const bays = findShowerBays({ width: 60, depth: 36 });
    expect(bays.map((bay) => bay.id).sort()).toEqual(["bottom", "top"]);
    expect(bays.every((bay) => bay.spanIn >= SHOWER_MIN_BAY_IN)).toBe(true);
  });

  it("rejects a closed wall shorter than the shortest pan", () => {
    expect(findShowerBays({ width: 44, depth: 36 }).map((bay) => bay.id)).not.toContain("top");
  });

  it("rejects a run that is open at one end", () => {
    const openRoom = {
      width: 120,
      depth: 96,
      vertices: [
        { id: "v0", x: 0, y: 0 },
        { id: "v1", x: 120, y: 0 },
        { id: "v2", x: 120, y: 96 },
      ],
      customWalls: [
        { id: "w0", startVertexId: "v0", endVertexId: "v1" },
        { id: "w1", startVertexId: "v1", endVertexId: "v2" },
      ],
    };
    expect(findShowerBays(openRoom).map((bay) => bay.id)).not.toContain("w1");
  });

  it.each(PAN_CODES)("%s seats in a bay with its lip into the room", (id) => {
    const placed = placeShowerPanInBay(pan(id), [], SHOWER_ROOM);
    expect(placed).not.toBeNull();
    const fit = placed!.fit;
    expect(fit.applies).toBe(true);
    expect(fit.bay).not.toBeNull();
    // The pan's long axis spans the opening, so it matches a 60" alcove if it is
    // a 60" pan; a 48" pan is seated centred with a gap warning, not silently fit.
    const definition = FURNITURE_CATALOG.find((entry) => entry.id === pan(id).defId)!;
    const along = Math.max(definition.w, definition.d);
    expect(fit.lengthMatches).toBe(Math.abs(60 - along) <= SHOWER_BAY_TOLERANCE_IN);
  });

  it("puts a 60 x 36 pan tight against the back and both end walls", () => {
    const placed = placeShowerPanInBay(pan(), [], SHOWER_ROOM)!;
    // Measure the built geometry, not just the stored coordinates. The pan turns
    // so its 60" length spans the 60" opening, which puts the length on Z.
    const root = new THREE.Group();
    addFurniture(root, placed.placement);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const inch = (value: number) => value * 12;
    // Span: wall to wall across the 60" opening.
    expect(inch(box.min.x) - 0).toBeCloseTo(0, 1);
    expect(60 - inch(box.max.x)).toBeCloseTo(0, 1);
    // Depth: back flush on the wall it sits against, and inside the room.
    expect(inch(box.min.z) - 0).toBeCloseTo(0, 1);
    expect(inch(box.max.z)).toBeCloseTo(36, 1);
    expect(placed.fit.warnings).toEqual([]);
  });

  it("warns when the alcove is not the pan's length, without resizing the pan", () => {
    const wide = { width: 66, depth: 36 };
    const placed = placeShowerPanInBay(pan(), [], wide)!;
    expect(placed.fit.lengthMatches).toBe(false);
    expect(placed.fit.warnings.join(" ")).toMatch(/gap/i);
    // The product keeps its own envelope; the warning is the only consequence.
    const definition = FURNITURE_CATALOG.find((entry) => entry.id === pan().defId)!;
    expect(definition.d).toBe(36);
  });

  it("warns when the pan is deeper than the room in front of the wall", () => {
    const shallow = { width: 60, depth: 30 };
    const placed = placeShowerPanInBay(pan(), [], shallow)!;
    expect(placed.fit.depthFits).toBe(false);
    expect(placed.fit.warnings.join(" ")).toMatch(/deep/i);
  });

  it("warns, without moving anything, when another item blocks the pan", () => {
    const seated = placeShowerPanInBay(pan(), [], SHOWER_ROOM)!.placement;
    const intruder = makeFurniture("pelican-toilet-pl-12005", 24, 6);
    const fit = showerPanFit(seated, SHOWER_ROOM, { furniture: [seated, intruder] });
    expect(fit.warnings.join(" ")).toMatch(/overlaps/i);
    // The other item is untouched.
    expect(intruder.x).toBe(24);
    expect(intruder.y).toBe(6);
  });

  it("warns when the room has no bay at all, and still explains itself", () => {
    const openRoom = {
      width: 140,
      depth: 100,
      vertices: [{ id: "v0", x: 0, y: 0 }, { id: "v1", x: 140, y: 0 }],
      customWalls: [{ id: "only", startVertexId: "v0", endVertexId: "v1" }],
    };
    expect(placeShowerPanInBay(pan(), [], openRoom)).toBeNull();
    const fit = showerPanFit(pan(), openRoom);
    expect(fit.bay).toBeNull();
    expect(fit.warnings.join(" ")).toMatch(/three walls/i);
  });

  it("centres a pan that is short for its bay instead of jamming a return", () => {
    // A 64" alcove takes a 60" pan with 2" either side, so a centred pan starts
    // 2" in from the wall's start end.
    const wide = { width: 64, depth: 36 };
    const seated = placeShowerPanInBay(pan(), [], wide)!.placement;
    expect(seated.x).toBeCloseTo(2, 1);
  });

  it("prefers a matching bay over a nearer one that does not fit", () => {
    // 60 x 36: the 60" walls both match and are equidistant, so a match wins.
    const placed = placeShowerPanInBay(pan(), [], { width: 60, depth: 36 })!;
    expect(placed.fit.lengthMatches).toBe(true);
  });

  it("does not apply bay rules to a non-pan fixture", () => {
    const freestanding = makeFurniture("pelican-tub-pl-02563-59", 0, 0);
    expect(showerPanFit(freestanding, SHOWER_ROOM).applies).toBe(false);
    expect(placeShowerPanInBay(freestanding, [], SHOWER_ROOM)).toBeNull();
  });

  it.each([
    [{ x: 0, y: 1 }, 180],
    [{ x: 0, y: -1 }, 0],
    [{ x: -1, y: 0 }, 90],
    [{ x: 1, y: 0 }, 270],
  ] as const)("maps an inward wall %o to quarter turn %i", (inward, rotation) => {
    expect(showerRotationForInward(inward)).toBe(rotation);
  });

  it("seats the pan against every wall so the lip faces the room", () => {
    // Pin the table against the built mesh rather than a hand-written rotation.
    // For each wall, seat the pan and confirm its back edge sits on that wall
    // while the rest of it lies inside the room — that is what "lip into the
    // room" means, and it does not depend on getting a sign convention right.
    const room = { width: 60, depth: 36 };
    const bays = findShowerBays(room);
    expect(bays.length).toBe(2);
    for (const bay of bays) {
      const seated = seatShowerPanInBay(pan(), bay);
      const definition = FURNITURE_CATALOG.find((entry) => entry.id === pan().defId)!;
      const footprint = definition.w === 60 && (seated.rotation === 0 || seated.rotation === 180)
        ? { w: 60, d: 36 }
        : { w: 36, d: 60 };
      // The pan's back edge is on the bay's own wall line. Which plan edge that
      // is depends on the wall's inward normal, so take the near and far edges
      // and assert that one of them is exactly on the wall.
      const alongX = Math.abs(bay.tangent.x) > Math.abs(bay.tangent.y);
      const wallLine = alongX ? bay.start.y : bay.start.x;
      const nearEdge = alongX ? seated.y : seated.x;
      const farEdge = alongX ? seated.y + footprint.d : seated.x + footprint.w;
      const onWall = Math.min(
        Math.abs(nearEdge - wallLine),
        Math.abs(farEdge - wallLine),
      );
      expect(onWall, "the pan is not flush on its wall").toBeLessThan(0.02);
      // And it stays inside the room on the far side.
      const limit = alongX ? room.depth : room.width;
      expect(farEdge).toBeLessThanOrEqual(limit + 0.01);
    }
  });

  it("seats a pan directly in a named bay", () => {
    const bay = findShowerBays(SHOWER_ROOM).find((entry) => entry.id === "top")!;
    const seated = seatShowerPanInBay(pan(), bay);
    expect(seated.rotation).toBe(bay.rotation);
    expect(seated.y).toBeCloseTo(0, 3);
  });
});
