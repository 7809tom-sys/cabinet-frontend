import { describe, expect, it } from "vitest";
import { toeKickHeightForElevation } from "./elevationToeKick";

describe("elevation toe-kick geometry", () => {
  it("always reserves the standard toe-kick zone for floor-level base cabinets", () => {
    expect(toeKickHeightForElevation("base", 0, 4.5)).toBe(4.5);
  });

  it("also reserves a toe kick for floor-level tall and floor-standing wall cabinets", () => {
    expect(toeKickHeightForElevation("tall", 0, 4.5)).toBe(4.5);
    expect(toeKickHeightForElevation("wall", 0, 4.5)).toBe(4.5);
  });

  it("does not add a toe kick to suspended wall cabinets, appliances, or raised cabinets", () => {
    expect(toeKickHeightForElevation("wall", 54, 4.5)).toBe(0);
    expect(toeKickHeightForElevation("appliance", 0, 4.5)).toBe(0);
    expect(toeKickHeightForElevation("base", 5, 4.5)).toBe(0);
  });
});
