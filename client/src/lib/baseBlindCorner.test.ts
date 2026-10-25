import { describe, expect, it } from "vitest";
import { blindCornerPullPlacement, blindCornerSpecViolations, isBaseBlindCorner, type PlacedCabinet, type RoomData } from "./design";

describe("configured base blind-corner rule", () => {
  it("applies pull and mandatory-filler behavior to a base blind corner", () => {
    expect(isBaseBlindCorner({
      masterCode: "BBC36",
      description: '36" Blind Corner Base Cabinet',
      placement: "base",
    })).toBe(true);
  });

  it("does not apply the base blind-corner pull or filler rule to a wall blind cabinet", () => {
    const wallBlind = {
      uid: "wbc-27-42",
      masterCode: "WBC-27-42",
      description: '27" Blind Corner Wall Cabinet',
      placement: "wall",
      x: 0,
      y: 0,
      width: 27,
      depth: 12,
      height: 42,
      rotation: 0,
      numberOfDoors: 1,
      numberOfDrawers: 0,
      pullMin: 3,
      pullMax: 6,
    } as PlacedCabinet;
    const room = { width: 144, depth: 120 } as RoomData;

    expect(isBaseBlindCorner(wallBlind)).toBe(false);
    expect(blindCornerPullPlacement(wallBlind, room, 3)).toBeNull();
    expect(blindCornerSpecViolations([wallBlind])).toEqual(new Map());
  });
});
