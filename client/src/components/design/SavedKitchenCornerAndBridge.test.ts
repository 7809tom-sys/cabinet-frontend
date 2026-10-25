import { describe, expect, it } from "vitest";
import { threeDCrownPerimeterSegments } from "./InteractiveRoom3D";
import {
  countertopSurfacePlanPolygon,
  countertopSurfaces,
  crownEligibleCabinets,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";

/**
 * Regression for the two 3D defects reported from the saved "carbon frost
 * 12x16" kitchen (Oct 2026 screenshot):
 *  1. The ERB36 corner countertop rendered as a 36x36 square plug with no
 *     front overhang, projecting past the neighbouring 25.5-inch run slabs.
 *  2. The over-refrigerator bridge (WR3624 at 72" over a 70" fridge, top at
 *     the 96" ceiling) received no crown, so the neighbouring W-2442's return
 *     crown ran THROUGH the bridge body to the wall instead of stopping at it
 *     and continuing along the bridge top.
 */
const room: RoomData = { width: 192, depth: 144, ceilingHeight: 96 };

const cab = (overrides: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "x", cabinetId: 1, masterCode: "B24", description: "", placement: "base",
  x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0,
  ...overrides,
});

const pantry = cab({ uid: "pantry", masterCode: "U249624", description: "Utility Pantry", placement: "tall", x: 0, y: 0, width: 24, depth: 24, height: 96, mountBottom: 0, wallId: "top", wallOffset: 0 });
const fridge = cab({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance", x: 24, y: 0, width: 36, depth: 30, height: 70, mountBottom: 0, wallId: "top", wallOffset: 24 });
const bridge = cab({ uid: "bridge", masterCode: "WR3624(W362424)", description: "Refrigerator Wall Cabinet", placement: "wall", x: 24, y: 0, width: 36, depth: 24, height: 24, mountBottom: 72, refrigeratorAssemblyId: "fridge", refrigeratorAssemblyRole: "bridge", wallId: "top", wallOffset: 24 });
const upperNextToBridge = cab({ uid: "w2442", masterCode: "W-2442", description: "Wall Cabinet", placement: "wall", x: 60, y: 0, width: 24, depth: 12, height: 42, mountBottom: 54, wallId: "top", wallOffset: 60 });
const erb36 = cab({ uid: "erb36", masterCode: "ERB36", description: "36 Easy Reach Base Cabinet with Lazy Susan", placement: "base", x: 156, y: 0, width: 36, depth: 36, height: 34.5, rotation: 90, cornerType: "lazy-susan", isCornerCabinet: true, wallId: "right", wallOffset: 0 });
const b21 = cab({ uid: "b21", masterCode: "B21", placement: "base", x: 135, y: 0, width: 21, depth: 24, height: 34.5 });
const b12 = cab({ uid: "b12", masterCode: "B12", placement: "base", x: 168, y: 36, width: 12, depth: 24, height: 34.5, rotation: 90 });

describe("saved-kitchen 3D regression: fridge bridge crown + corner countertop", () => {
  it("crowns the refrigerator bridge on its own top and stops the neighbour's return at the bridge", () => {
    const placed = [pantry, fridge, bridge, upperNextToBridge];
    expect(crownEligibleCabinets(placed, room).map((cabinet) => cabinet.uid)).toEqual(["bridge", "w2442"]);

    const segments = threeDCrownPerimeterSegments(placed, room);
    const bridgeSegments = segments.filter((segment) => segment.ownerUid === "bridge");
    const upperSegments = segments.filter((segment) => segment.ownerUid === "w2442");

    // Bridge: a front rail across its 36-inch face at the 96-inch top, and a
    // right return from the shared 12-inch upper depth out to its own 24-inch depth.
    expect(bridgeSegments.some((segment) => segment.kind === "front" && Math.abs(segment.top - 96) < 1e-6)).toBe(true);
    expect(bridgeSegments.some((segment) => segment.kind === "right-return")).toBe(true);
    // The pantry is a blocker on the bridge's left, so no left return.
    expect(bridgeSegments.some((segment) => segment.kind === "left-return")).toBe(false);

    // Neighbour upper: its left side is fully covered by the deeper bridge, so
    // no left-return rail may run into the bridge body. (Its right side is the
    // open end of this fixture's run, so an ordinary right return remains.)
    expect(upperSegments.some((segment) => segment.kind === "front")).toBe(true);
    expect(upperSegments.some((segment) => segment.kind === "left-return")).toBe(false);
  });

  it("gives the ERB36 corner a true-L top whose fronts meet the adjoining 25.5-inch run slabs", () => {
    const surfaces = countertopSurfaces([erb36, b21, b12], room);
    const corner = surfaces.find((surface) => surface.x === 156 && surface.y === 0 && surface.polygon)!;
    expect(corner).toBeDefined();
    const outline = countertopSurfacePlanPolygon(corner);
    expect(outline).toHaveLength(6);
    // Wall-side edges flush with the top wall (y = 0) and right wall (x = 192).
    expect(outline.filter((point) => point.y === 0)).toHaveLength(2);
    expect(outline.filter((point) => point.x === 192)).toHaveLength(2);
    // Front edges at 25.5 inches from each wall — the same line the B21 (top
    // wall) and B12 (right wall) run slabs finish on. No 36-inch square plug.
    expect(outline.some((point) => Math.abs(point.y - 25.5) < 1e-6)).toBe(true);
    expect(outline.some((point) => Math.abs(point.x - (192 - 25.5)) < 1e-6)).toBe(true);
    expect(outline.some((point) => Math.abs(point.x - 156) < 1e-6 && Math.abs(point.y - 36) < 1e-6)).toBe(false);
    expect(corner.areaInches).toBeCloseTo(36 * 36 - 10.5 * 10.5, 6);
  });

  it("never draws crown below the top of a taller neighbour: a lower bridge beside a ceiling pantry has no return along the pantry side", () => {
    // Bridge top 84" (60" + 24") beside the 96" pantry: the bridge's left return
    // would run along the pantry's exposed side 12" below the pantry top.
    const lowBridge = { ...bridge, mountBottom: 60 };
    const placed = [pantry, fridge, lowBridge, upperNextToBridge];
    const segments = threeDCrownPerimeterSegments(placed, room);
    const bridgeSegments = segments.filter((segment) => segment.ownerUid === "bridge");
    expect(bridgeSegments.some((segment) => segment.kind === "front" && Math.abs(segment.top - 84) < 1e-6)).toBe(true);
    expect(bridgeSegments.some((segment) => segment.kind === "left-return")).toBe(false);
    // No crown segment of any owner may lie below the top of a body it runs along.
    for (const segment of segments) {
      if (segment.ownerUid === "bridge") expect(segment.top).toBeCloseTo(84, 6);
      else expect(segment.top).toBeCloseTo(96, 6);
    }
    // The taller W-2442 (top 96") beside the lower bridge keeps its own left
    // return above the bridge: a lower body never blocks a higher rail.
    const upperSegments = segments.filter((segment) => segment.ownerUid === "w2442");
    expect(upperSegments.some((segment) => segment.kind === "left-return")).toBe(true);
  });
});
