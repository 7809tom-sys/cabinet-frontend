import { describe, expect, it } from "vitest";
import { crownBlockingCabinets, crownEligibleCabinets, isCrownEligibleCabinet, type PlacedCabinet, type RoomData } from "./design";

/**
 * Crown over the refrigerator bay: neighbour uppers, two tall end panels, and the cabinet above the fridge.
 * `usesRaisedFloorWallDoorPull` is true for every full-height cabinet, and used to throw every tall cabinet (panels,
 * pantries) out of crown and out of the crown blockers, so the neighbouring upper's crown ran straight into the panel.
 */
const room = { width: 200, depth: 96, ceilingHeight: 96 } as RoomData;
const cabinet = (uid: string, placement: "wall" | "tall", x: number, width: number, height: number, depth: number, mountBottom: number, extra: Partial<PlacedCabinet> = {}) =>
  ({ uid, cabinetId: 1, masterCode: uid, description: uid, placement, x, y: 0, width, height, depth, rotation: 0, mountBottom, ...extra }) as PlacedCabinet;
const panel = (uid: string, x: number) => cabinet(uid, "tall", x, 0.75, 84, 24, 0, { masterCode: "REPV", description: "Refrigerator end panel" });
const bay = (capDepth: number, capHeight = 12) => [
  cabinet("left-upper", "wall", 0, 30, 30, 12, 54),
  panel("panel-left", 30),
  cabinet("cap", "wall", 30.75, 36, capHeight, capDepth, 72),
  panel("panel-right", 66.75),
  cabinet("right-upper", "wall", 67.5, 30, 30, 12, 54),
];

describe("crown over the refrigerator bay", () => {
  it("the tall end panels carry crown and block the neighbouring crown, like any other upper", () => {
    const placed = bay(24);
    expect(crownEligibleCabinets(placed, room).map((c) => c.uid).sort()).toEqual(["cap", "left-upper", "panel-left", "panel-right", "right-upper"]);
    expect(crownBlockingCabinets(placed, room).map((c) => c.uid).sort()).toEqual(["cap", "left-upper", "panel-left", "panel-right", "right-upper"]);
  });

  it.each([12, 24, 27])("a %s-inch-deep cabinet above the fridge keeps the panels in the crown set", (depth) => {
    const placed = bay(depth);
    expect(isCrownEligibleCabinet(placed[1]!, room)).toBe(true);
    expect(isCrownEligibleCabinet(placed[2]!, room)).toBe(true);
  });

  it("a taller cabinet above the fridge is still crown-eligible", () => {
    expect(isCrownEligibleCabinet(bay(24, 18)[2]!, room)).toBe(true);
  });

  it("island and floor-seated WALL cabinets stay out of crown, tall or not", () => {
    expect(isCrownEligibleCabinet(cabinet("island", "wall", 0, 30, 30, 12, 54, { islandFace: "Back" } as Partial<PlacedCabinet>), room)).toBe(false);
    expect(isCrownEligibleCabinet(cabinet("floor-wall", "wall", 0, 30, 30, 12, 4.5), room)).toBe(false);
    expect(crownBlockingCabinets([cabinet("island", "wall", 0, 30, 30, 12, 54, { islandFace: "Back" } as Partial<PlacedCabinet>)], room)).toEqual([]);
  });
});
