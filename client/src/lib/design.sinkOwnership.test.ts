import { describe, expect, it } from "vitest";
import { fixtureBelongsToCabinet, makeDefaultSinkForCabinet, makeSinkForCabinet, type PlacedCabinet, DEFAULT_ROOM } from "./design";

describe("sink fixture cabinet ownership", () => {
  const sinkBase = {
    uid: "sink-base-36",
    cabinetId: 1,
    masterCode: "SB-36",
    placement: "base",
    x: 24,
    y: 0,
    width: 36,
    depth: 24,
    height: 34.5,
    rotation: 0,
  } as PlacedCabinet;

  it("retains exact sink-base ownership when a linked fixture projects beyond the cabinet footprint", () => {
    const attached = { ...makeSinkForCabinet("farmhouse", sinkBase, { width: 120, depth: 120, ceilingHeight: 96 }), x: 21 };
    expect(fixtureBelongsToCabinet(attached, sinkBase)).toBe(true);
  });

  it("keeps the footprint check only as a fallback for a legacy unlinked fixture", () => {
    const legacy = { ...makeSinkForCabinet("single", sinkBase, { width: 120, depth: 120, ceilingHeight: 96 }), cabinetUid: undefined };
    expect(fixtureBelongsToCabinet(legacy, sinkBase)).toBe(true);
  });

  it("creates a centered editable default fixture with the faucet enabled", () => {
    const fixture = makeDefaultSinkForCabinet(sinkBase, DEFAULT_ROOM, "double");
    expect(fixture.cabinetUid).toBe(sinkBase.uid);
    expect(fixture.type).toBe("double");
    expect(fixture.faucet).toBe(true);
    expect(fixtureBelongsToCabinet(fixture, sinkBase)).toBe(true);
  });

  it("keeps a linked standard fixture owned by its sink base even after its valid rear-deck setback moves it off the old footprint center", () => {
    const fixture = makeSinkForCabinet("single", sinkBase, DEFAULT_ROOM, { width: 25, depth: 18 });
    const movedBase = { ...sinkBase, x: sinkBase.x + 12 };

    expect(fixture.cabinetUid).toBe(sinkBase.uid);
    expect(fixtureBelongsToCabinet(fixture, movedBase)).toBe(true);
  });
});
