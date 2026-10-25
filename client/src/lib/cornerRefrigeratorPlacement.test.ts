import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, wallRunFrame, wallRunJoinAt } from "./design";
import { placeCornerRefrigerator, validatePlacedCornerRefrigerator } from "./cornerRefrigeratorPlacement";

const refrigerator = {
  masterCode: "FRIDGE-36",
  description: "36 inch Refrigerator",
  placement: "appliance" as const,
  width: 36,
  depth: 24,
};

function request(overrides: Partial<Parameters<typeof placeCornerRefrigerator>[0]> = {}) {
  return {
    refrigerator,
    room: DEFAULT_ROOM,
    wallLabel: "Wall 1" as const,
    centerOffsetIn: 18,
    originCorner: "left" as const,
    runDirection: "right" as const,
    cornerEnd: "start" as const,
    ...overrides,
  };
}

describe("corner refrigerator placement", () => {
  it("maps Wall 1 to the top run and seats the refrigerator at the selected start corner", () => {
    const result = placeCornerRefrigerator(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.wallId).toBe("top");
    expect(result.alongStart).toBe(0);
    expect(result.spot.wallId).toBe("top");
    expect(result.requiredCornerHoldIn).toBe(0);
  });

  it("supports the opposite endpoint using the same wall-relative measurement contract", () => {
    const frame = wallRunFrame("top", DEFAULT_ROOM)!;
    const result = placeCornerRefrigerator(request({ centerOffsetIn: frame.length - 18, cornerEnd: "end" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alongStart).toBe(frame.length - 36);
  });

  it("rejects a refrigerator that is measured away from the requested corner", () => {
    expect(placeCornerRefrigerator(request({ centerOffsetIn: 48 }))).toEqual({ ok: false, reason: "wrong-corner" });
  });

  it("rejects a refrigerator cabinet shallower than the 24-inch refrigerator depth rule", () => {
    expect(placeCornerRefrigerator(request({ refrigerator: { ...refrigerator, depth: 12 } }))).toEqual({ ok: false, reason: "insufficient-depth" });
  });

  it("rejects a non-refrigerator appliance instead of applying the corner rule by SKU guess", () => {
    expect(placeCornerRefrigerator(request({ refrigerator: { ...refrigerator, masterCode: "RANGE-30" } }))).toEqual({ ok: false, reason: "not-refrigerator" });
  });

  it("rejects physical overlap with an existing cabinet", () => {
    const blocker = {
      uid: "blocker",
      cabinetId: 1,
      masterCode: "B36",
      description: "Base cabinet",
      placement: "base" as const,
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    };
    expect(placeCornerRefrigerator(request({ placed: [blocker] }))).toEqual({ ok: false, reason: "collision" });
  });

  it("uses the shared join helper for a measured corner rather than inventing corner geometry", () => {
    const frame = wallRunFrame("top", DEFAULT_ROOM)!;
    expect(wallRunJoinAt(frame, "start", DEFAULT_ROOM)?.frame.id).toBe("left");
  });

  it("is callable from the normal placement transaction and leaves a non-corner refrigerator alone", () => {
    const spot = wallPlacementAt(48, 36, 24, "top", DEFAULT_ROOM);
    const candidate = { ...refrigerator, uid: "fridge", cabinetId: 0, x: spot.x, y: spot.y, rotation: spot.rotation, height: 84, numberOfDoors: 2, numberOfDrawers: 0 };
    expect(validatePlacedCornerRefrigerator(candidate, DEFAULT_ROOM, [])).toBeNull();
  });

  it("rejects a corner refrigerator collision before generic magnetic recovery can move it", () => {
    const spot = wallPlacementAt(0, 36, 24, "top", DEFAULT_ROOM);
    const candidate = { ...refrigerator, uid: "fridge", cabinetId: 0, x: spot.x, y: spot.y, rotation: spot.rotation, height: 84, numberOfDoors: 2, numberOfDrawers: 0 };
    const blocker = { ...candidate, uid: "blocker", masterCode: "B36", description: "Base cabinet", placement: "base" as const };
    expect(validatePlacedCornerRefrigerator(candidate, DEFAULT_ROOM, [blocker])).toEqual({ ok: false, reason: "collision" });
  });
});
