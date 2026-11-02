import { describe, expect, it } from "vitest";
import {
  asContinuousVerticalFiller,
  cabinetTopWithTopper,
  continuousVerticalFiller,
  normalizeContinuousVerticalFillers,
} from "./verticalFiller";
import {
  DEFAULT_ROOM,
  wallPlacementAt,
  type PlacedCabinet,
} from "./design";

function item(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode">): PlacedCabinet {
  return {
    cabinetId: 1,
    description: partial.masterCode,
    category: "Base",
    subCategory: "Base",
    placement: "base",
    x: 0,
    y: 0,
    width: 18,
    depth: 24,
    height: 34.5,
    rotation: 0,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    ...partial,
  } as PlacedCabinet;
}

const at = (width: number, start: number, wall: "top" | "bottom" = "top") => wallPlacementAt(start, width, 24, wall, DEFAULT_ROOM);

describe("vertical filler is one continuous piece", () => {
  it("runs a base filler from the floor to the top of the upper cabinet above it", () => {
    const base = item({ uid: "b18", masterCode: "B18", ...at(18, 0), place: undefined } as never);
    const upper = item({
      uid: "w1830", masterCode: "W1830", placement: "wall", mountBottom: 54, height: 30, depth: 12, width: 18,
      ...wallPlacementAt(0, 18, 12, "top", DEFAULT_ROOM),
    } as never);
    const spec = continuousVerticalFiller({
      wallId: "top", startIn: 18, widthIn: 3, placed: [base, upper], room: DEFAULT_ROOM, owner: base,
    });
    expect(spec.bottomIn).toBe(0);
    expect(spec.topIn).toBeCloseTo(84, 5);
    expect(spec.heightIn).toBeCloseTo(84, 5);
    expect(spec.reason).toBe("floor-to-upper-top");
  });

  it("reaches the top of a glass stacker above the upper", () => {
    const base = item({ uid: "b18", masterCode: "B18", ...at(18, 0) } as never);
    const upper = item({
      uid: "w1830", masterCode: "W1830", placement: "wall", mountBottom: 54, height: 30, depth: 12, width: 18,
      ...wallPlacementAt(0, 18, 12, "top", DEFAULT_ROOM),
    } as never);
    const stacker = item({
      uid: "gs1830", masterCode: "GS-1830", placement: "wall", mountBottom: 84, height: 12, depth: 12, width: 18,
      stackedOnCabinetUid: "w1830", ...wallPlacementAt(0, 18, 12, "top", DEFAULT_ROOM),
    } as never);
    const spec = continuousVerticalFiller({
      wallId: "top", startIn: 18, widthIn: 3, placed: [base, upper, stacker], room: DEFAULT_ROOM, owner: upper,
    });
    expect(spec.topIn).toBeCloseTo(96, 5);
    expect(spec.topIn).toBeCloseTo(cabinetTopWithTopper(upper, [base, upper, stacker]), 5);
    expect(spec.reason).toBe("floor-to-stacker-top");
  });

  it("writes one board instead of a base-height sliver", () => {
    const base = item({ uid: "b18", masterCode: "B18", ...at(18, 0) } as never);
    const upper = item({
      uid: "w1830", masterCode: "W1830", placement: "wall", mountBottom: 54, height: 30, depth: 12, width: 18,
      ...wallPlacementAt(0, 18, 12, "top", DEFAULT_ROOM),
    } as never);
    const filler = item({
      uid: "fill-1", masterCode: "BF3", category: "Filler", subCategory: "Filler", width: 3, height: 34.5,
      placement: "base", fillerPieceGroupId: "g1", fillerTotalWidth: 3, fillerForCabinetUid: "b18",
      ...wallPlacementAt(18, 3, 24, "top", DEFAULT_ROOM),
    } as never);
    const updated = asContinuousVerticalFiller(filler, [base, upper, filler], DEFAULT_ROOM, base);
    expect(updated.mountBottom).toBe(0);
    expect(updated.height).toBeCloseTo(84, 5);
    expect(updated.fillerContinuousVertical).toBe(true);
    expect(updated.fillerMatchesFullOwnerEnvelope).toBe(true);
    // The purchased SKU and finish identity are untouched.
    expect(updated.masterCode).toBe("BF3");
    expect(updated.fillerPieceGroupId).toBe("g1");
  });

  it("normalizes every installed filler on the plan in one pass", () => {
    const base = item({ uid: "b18", masterCode: "B18", ...at(18, 0) } as never);
    const upper = item({
      uid: "w1830", masterCode: "W1830", placement: "wall", mountBottom: 54, height: 30, depth: 12, width: 18,
      ...wallPlacementAt(0, 18, 12, "top", DEFAULT_ROOM),
    } as never);
    const filler = item({
      uid: "fill-1", masterCode: "BF3", category: "Filler", subCategory: "Filler", width: 3, height: 34.5,
      placement: "base", fillerPieceGroupId: "g1", fillerTotalWidth: 3, fillerForCabinetUid: "b18",
      ...wallPlacementAt(18, 3, 24, "top", DEFAULT_ROOM),
    } as never);
    const result = normalizeContinuousVerticalFillers([base, upper, filler], DEFAULT_ROOM);
    expect(result.changed).toBe(true);
    expect(result.placed.find((entry) => entry.uid === "fill-1")!.height).toBeCloseTo(84, 5);
    // Idempotent: a second pass changes nothing.
    const again = normalizeContinuousVerticalFillers(result.placed, DEFAULT_ROOM);
    expect(again.changed).toBe(false);
  });

  it("leaves a filler with nothing beside it at the base box top", () => {
    const filler = item({
      uid: "fill-1", masterCode: "BF3", category: "Filler", subCategory: "Filler", width: 3, height: 34.5,
      placement: "base", ...wallPlacementAt(40, 3, 24, "top", DEFAULT_ROOM),
    } as never);
    const spec = continuousVerticalFiller({
      wallId: "top", startIn: 40, widthIn: 3, placed: [filler], room: DEFAULT_ROOM, owner: null,
    });
    expect(spec.reason).toBe("floor-to-base-top");
    expect(spec.topIn).toBeCloseTo(34.5, 5);
  });
});
