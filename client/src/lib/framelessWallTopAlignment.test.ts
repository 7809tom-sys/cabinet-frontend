import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import type { PlacedCabinet, RoomData } from "@/lib/design";
import {
  FRAMELESS_TOP_WALL_HEIGHT_IN,
  alignFramelessWallCabinetTops,
  framelessWallHeightClass,
  framelessWallTopDatumIn,
  framelessWallTopLineFor,
  isFramelessLine,
  isFramelessStyle,
} from "@/lib/framelessWallTopAlignment";

const room: RoomData = { width: 180, depth: 120, ceilingHeight: 108 };

function wall(uid: string, masterCode: string, offset: number, width: number, height: number, mountBottom: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid,
    cabinetId: 1,
    masterCode,
    description: masterCode,
    category: "Wall",
    placement: "wall",
    x: offset,
    y: 0,
    rotation: 0,
    wallId: "top",
    wallOffset: offset,
    width,
    depth: 13.5,
    height,
    mountBottom,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
    ...extra,
  };
}

const topOf = (cabinet: PlacedCabinet) => (cabinet.mountBottom ?? 0) + (cabinet.height ?? 0);

// Tom (Nov 15 2026, 7:13 PM CT) replaced the Nov 9 issue #354 rule: frameless
// wall cabinets keep the standard 54" bottom like framed ones and are never
// lifted to meet a 40-1/4" box's top. The pass now moves nothing; it only names a
// bridge that misses the wall's real top line.
describe("frameless wall cabinets keep the standard 54 inch bottom", () => {
  it("keeps the 40-1/4 inch datum and the book's height classes", () => {
    expect(FRAMELESS_TOP_WALL_HEIGHT_IN).toBe(40.25);
    expect(framelessWallTopDatumIn()).toBe(94.25);
    expect(framelessWallHeightClass(30)).toBe(30.25);
    expect(framelessWallHeightClass(36)).toBe(35.25);
    expect(framelessWallHeightClass(42)).toBe(40.25);
  });

  it("never raises a 30-1/4 upper beside a 40-1/4 one", () => {
    const tall = wall("tall", "W2440", 0, 24, 40.25, 54);
    const short = wall("short", "W3030", 24, 30, 30.25, 54);
    const input = [tall, short];
    const result = alignFramelessWallCabinetTops({ placed: input, room });
    expect(result.placed).toBe(input);
    expect(result.aligned).toEqual([]);
    expect(result.placed.find((item) => item.uid === "short")!.mountBottom).toBe(54);
  });

  it("leaves a run of nothing but 30-1/4 inch boxes at 54, topping out at 84-1/4", () => {
    const a = wall("a", "W3030", 0, 30, 30.25, 54);
    const b = wall("b", "W2430", 30, 24, 30.25, 54);
    const result = alignFramelessWallCabinetTops({ placed: [a, b], room });
    expect(result.placed.map(topOf)).toEqual([84.25, 84.25]);
    expect(framelessWallTopLineFor(result.placed, room, "top")).toBeCloseTo(84.25, 5);
  });

  it("reports the wall's real top line: the tallest ordinary frameless box", () => {
    const tall = wall("tall", "W2440", 0, 24, 40.25, 54);
    const short = wall("short", "W3030", 24, 30, 30.25, 54);
    expect(framelessWallTopLineFor([tall, short], room, "top")).toBeCloseTo(94.25, 5);
    expect(framelessWallTopLineFor([], room, "top")).toBeNull();
    expect(framelessWallTopLineFor([wall("f", "W3030", 0, 30, 30, 54, { constructionMethod: "Framed" })], room, "top")).toBeNull();
  });

  it("leaves the 72 inch microwave bridge alone and names it only when it misses the wall's line", () => {
    const bridge = wall("bridge", "W3012", 0, 30, 12, 72, { overRangeMicrowaveBridge: true, mountBottomAdjusted: true });
    const thirty = wall("n", "W2430", 30, 24, 30.25, 54);
    const ok = alignFramelessWallCabinetTops({ placed: [bridge, thirty], room });
    expect(ok.placed.find((item) => item.uid === "bridge")!.mountBottom).toBe(72);
    expect(ok.warnings).toEqual([]);
    const forty = wall("n40", "W2440", 30, 24, 40.25, 54);
    const short = alignFramelessWallCabinetTops({ placed: [bridge, forty], room });
    expect(short.warnings.join(" ")).toMatch(/W3012 finishes at 84″/);
  });

  it("does nothing at all to a framed line", () => {
    const framed = [wall("f1", "W3030", 0, 30, 30, 54, { constructionMethod: "Framed" }), wall("f2", "W3042", 30, 30, 42, 54, { constructionMethod: "Framed" })];
    const result = alignFramelessWallCabinetTops({ placed: framed, room });
    expect(result.placed).toBe(framed);
    expect(result.warnings).toEqual([]);
  });

  it("reads the frameless line and style from the same markers the rest of the app uses", () => {
    expect(isFramelessLine({ constructionMethod: AEF_PRINTED_GEOMETRY_MARKER })).toBe(true);
    expect(isFramelessLine({ constructionMethod: "Framed" })).toBe(false);
    expect(isFramelessStyle({ isFrameless: true } as never)).toBe(true);
    expect(isFramelessStyle(null)).toBe(false);
  });
});
