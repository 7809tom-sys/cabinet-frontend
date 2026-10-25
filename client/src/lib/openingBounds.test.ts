import { describe, expect, it } from "vitest";
import { clampOpening, type RoomData, type WallOpening } from "./design";

describe("window wall and ceiling bounds", () => {
  const room: RoomData = {
    width: 144,
    depth: 120,
    ceilingHeight: 96,
    wallCeilings: { top: { high: 90, low: 90 } },
  };
  const window: WallOpening = {
    uid: "window-1",
    kind: "window",
    label: "Kitchen Window",
    side: "top",
    offset: 30,
    width: 36,
    height: 36,
    sill: 42,
  };

  it("keeps the complete window within its wall run", () => {
    expect(clampOpening({ ...window, offset: -12 }, room).offset).toBe(0);
    expect(clampOpening({ ...window, offset: 130 }, room).offset).toBe(108);
  });

  it("keeps the complete window between the floor and its owning wall ceiling", () => {
    expect(clampOpening({ ...window, sill: -8 }, room).sill).toBe(0);
    expect(clampOpening({ ...window, sill: 72 }, room).sill).toBe(54);
  });
});
