import { describe, expect, it } from "vitest";
import { fixtureBelongsToCabinet, makeSinkForCabinet, type DesignCabinet, type PlacedCabinet } from "./design";
import { matchingFarmSinkBase, swapStandardSinkBaseForFarmSink } from "./farmSinkBaseSwap";

const room = { width: 144, depth: 120, ceilingHeight: 96 };
const standard = {
  uid: "sb36", cabinetId: 10, masterCode: "SB36", description: "Sink Base Cabinet", placement: "base",
  x: 40, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0, wallId: "top", wallOffset: 40,
} as PlacedCabinet;
const fsb = (id: number, code: string, width: string): DesignCabinet => ({
  id, masterCode: code, description: "Farm Sink Base Cabinet", category: "Base", subCategory: "Sink Base",
  width, height: "34.5", depth: "24", placement: "base", numberOfDoors: 2, numberOfDrawers: 0, isCornerCabinet: false,
});

describe("standard sink base to farm sink base swap", () => {
  it("uses the exact-width catalog FSB and never a different size", () => {
    const pool = [fsb(1, "FSB33", "33"), fsb(2, "FSB36", "36"), fsb(3, "FSB30", "30")];
    expect(matchingFarmSinkBase(standard, pool)?.masterCode).toBe("FSB36");
    expect(matchingFarmSinkBase({ ...standard, width: 42 }, pool)).toBeNull();
  });

  it("keeps wall ownership and position and seats a 33 inch apron-front sink flush to the face", () => {
    const sink = makeSinkForCabinet("single", standard, room);
    const result = swapStandardSinkBaseForFarmSink(standard, [fsb(2, "FSB36", "36")], [sink], room, fixtureBelongsToCabinet);
    if (!result.ok) throw new Error(result.reason);
    expect(result.toCode).toBe("FSB36");
    expect(result.cabinet).toMatchObject({ uid: "sb36", x: 40, y: 0, wallId: "top", wallOffset: 40, width: 36, depth: 24 });
    expect(result.removedSinkUids).toEqual([sink.uid]);
    expect(result.sink).toMatchObject({ type: "farmhouse", apronFront: true, width: 33, cabinetUid: "sb36" });
    expect(result.sink.y + result.sink.depth).toBeCloseTo(24, 3);
    expect(fixtureBelongsToCabinet(result.sink, result.cabinet)).toBe(true);
  });

  it("refuses rather than substituting when the line has no matching FSB or the base is too narrow", () => {
    const none = swapStandardSinkBaseForFarmSink(standard, [fsb(1, "FSB33", "33")], [], room, fixtureBelongsToCabinet);
    expect(none).toMatchObject({ ok: false });
    const narrow = swapStandardSinkBaseForFarmSink({ ...standard, width: 30 }, [fsb(3, "FSB30", "30")], [], room, fixtureBelongsToCabinet);
    expect(narrow).toMatchObject({ ok: false });
  });

  it("leaves an existing farm sink base alone", () => {
    const farm = { ...standard, masterCode: "FSB36", description: "Farm Sink Base Cabinet" } as PlacedCabinet;
    expect(swapStandardSinkBaseForFarmSink(farm, [fsb(2, "FSB36", "36")], [], room, fixtureBelongsToCabinet)).toMatchObject({ ok: false });
  });
});
