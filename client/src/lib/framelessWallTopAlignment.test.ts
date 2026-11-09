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

describe("frameless wall top alignment (issue #354 item 7)", () => {
  it("measures the 40-1/4 inch datum from the standard 54 inch bottom", () => {
    expect(FRAMELESS_TOP_WALL_HEIGHT_IN).toBe(40.25);
    expect(framelessWallTopDatumIn()).toBe(94.25);
    expect(framelessWallHeightClass(30)).toBe(30.25);
    expect(framelessWallHeightClass(36)).toBe(35.25);
    expect(framelessWallHeightClass(42)).toBe(40.25);
  });

  it("raises a 30-1/4 upper so its top meets the 40-1/4 top line", () => {
    const tall = wall("tall", "W2440", 0, 24, 40.25, 54);
    const short = wall("short", "W3030", 24, 30, 30.25, 54);
    const result = alignFramelessWallCabinetTops({ placed: [tall, short], room });
    const aligned = result.placed.find((item) => item.uid === "short")!;
    expect(topOf(aligned)).toBeCloseTo(94.25, 5);
    expect(aligned.mountBottom).toBeCloseTo(64, 5);
    expect(result.aligned).toEqual([{ uid: "short", masterCode: "W3030", from: 54, to: 64 }]);
    // The reference box itself does not move.
    expect(result.placed.find((item) => item.uid === "tall")?.mountBottom).toBe(54);
  });

  it("raises a run of nothing but 30-1/4 inch boxes to the one 94-1/4 inch line", () => {
    // Tom's decision (Nov 9 2026): no 30-1/4-only-run exemption. Every frameless
    // wall cabinet top finishes at 94-1/4".
    const a = wall("a", "W3030", 0, 30, 30.25, 54);
    const b = wall("b", "W2430", 30, 24, 30.25, 54);
    const result = alignFramelessWallCabinetTops({ placed: [a, b], room });
    expect(topOf(result.placed.find((item) => item.uid === "a")!)).toBeCloseTo(94.25, 5);
    expect(topOf(result.placed.find((item) => item.uid === "b")!)).toBeCloseTo(94.25, 5);
    expect(result.aligned.map((entry) => entry.masterCode).sort()).toEqual(["W2430", "W3030"]);
  });

  it("leaves the 72 inch microwave bridge exactly where the bridge rule put it", () => {
    const bridge = wall("bridge", "W3012", 0, 30, 12, 72, { overRangeMicrowaveBridge: true, mountBottomAdjusted: true });
    const neighbour = wall("neighbour", "W2440", 30, 24, 40.25, 54);
    const result = alignFramelessWallCabinetTops({ placed: [bridge, neighbour], room });
    const after = result.placed.find((item) => item.uid === "bridge")!;
    expect(after.mountBottom).toBe(72);
    expect(result.aligned.some((entry) => entry.uid === "bridge")).toBe(false);
    // The bridge never sets the run line either: the 40-1/4" box does.
    expect(framelessWallTopLineFor(result.placed, room, "top")).toBeCloseTo(94.25, 5);
  });

  it("names the bridge when its own bottom cannot reach the line", () => {
    // Tom's decision: a bridge is never exempt. Its bottom stays on its fixed
    // datum, so a 12" W3012 tops at 84" — 10-1/4" short of 94-1/4" — and that
    // shortfall is reported rather than left silent.
    const bridge = wall("bridge", "W3012", 0, 30, 12, 72, { overRangeMicrowaveBridge: true });
    const neighbour = wall("neighbour", "W3030", 30, 30, 30.25, 54);
    const result = alignFramelessWallCabinetTops({ placed: [bridge, neighbour], room });
    expect(result.placed.find((item) => item.uid === "bridge")?.mountBottom).toBe(72);
    expect(topOf(result.placed.find((item) => item.uid === "neighbour")!)).toBeCloseTo(94.25, 5);
    expect(result.warnings.join(" ")).toContain("W3012");
    expect(result.warnings.join(" ")).toContain("10.25");
  });

  it("leaves a bridge that already tops out on the line alone and reports nothing", () => {
    // The frameless bridge picker now chooses W3023 (22-5/8"): 72 + 22.625 = 94.625.
    const bridge = wall("bridge", "W3023", 0, 30, 22.625, 72, { overRangeMicrowaveBridge: true });
    const neighbour = wall("neighbour", "W3030", 30, 30, 30.25, 54);
    const result = alignFramelessWallCabinetTops({ placed: [bridge, neighbour], room });
    expect(result.placed.find((item) => item.uid === "bridge")?.mountBottom).toBe(72);
    expect(result.warnings).toEqual([]);
    expect(result.aligned.some((entry) => entry.uid === "bridge")).toBe(false);
  });

  it("never pulls a box down, so the over-range clearance and window minimums survive", () => {
    // A 40-1/4" box tops exactly on the line; a box already hung higher than the
    // line (an over-range upper on its 72" cooking clearance) is left alone. The
    // rule raises a top to the line; lowering one would break the clearance.
    const onLine = wall("on-line", "W2440", 0, 24, 40.25, 54);
    const over = wall("over", "W3030", 24, 30, 30.25, 72);
    const result = alignFramelessWallCabinetTops({ placed: [onLine, over], room });
    expect(topOf(result.placed.find((item) => item.uid === "on-line")!)).toBeCloseTo(94.25, 5);
    const after = result.placed.find((item) => item.uid === "over")!;
    expect(after.mountBottom).toBe(72);
    expect(after.mountBottom!).toBeGreaterThanOrEqual(72);
  });

  it("raises a whole 30-1/4 inch kitchen to 94-1/4 with no 40-1/4 box present", () => {
    const a = wall("a", "W3030", 0, 30, 30.25, 54);
    const result = alignFramelessWallCabinetTops({ placed: [a], room });
    expect(topOf(result.placed[0]!)).toBeCloseTo(94.25, 5);
    expect(result.placed[0]!.mountBottom).toBeCloseTo(64, 5);
  });

  it("keeps a cabinet the customer moved by hand", () => {
    const tall = wall("tall", "W2440", 0, 24, 40.25, 54);
    const moved = wall("moved", "W3030", 24, 30, 30.25, 50, { mountBottomAdjusted: true });
    const result = alignFramelessWallCabinetTops({ placed: [tall, moved], room });
    expect(result.placed.find((item) => item.uid === "moved")?.mountBottom).toBe(50);
  });

  it("names a box the ceiling will not let join the line instead of hiding it", () => {
    // A 40-1/4" run needs its 30-1/4" neighbour to start at 64". On a 96"
    // ceiling that is the classic 84" line with room to spare, so force the
    // conflict with a shorter ceiling: the box cannot rise without its top
    // crossing the ceiling.
    const lowRoom: RoomData = { ...room, ceilingHeight: 90 };
    const tall = wall("tall", "W2440", 0, 24, 40.25, 54);
    const short = wall("short", "W3030", 24, 30, 30.25, 54);
    const result = alignFramelessWallCabinetTops({ placed: [tall, short], room: lowRoom });
    // The 40-1/4" box already crosses a 90" ceiling, so the run can still only
    // be measured from it; the shorter box must not be raised past the ceiling.
    expect(result.warnings.join(" ")).toContain("W3030");
  });

  it("does nothing at all to a framed line", () => {
    const a = wall("a", "W3030", 0, 30, 30, 54, { constructionMethod: "Framed" });
    const b = wall("b", "W2442", 30, 24, 42, 54, { constructionMethod: "Framed" });
    const result = alignFramelessWallCabinetTops({ placed: [a, b], room });
    expect(result.placed).toEqual([a, b]);
    expect(result.aligned).toEqual([]);
    expect(isFramelessLine(a)).toBe(false);
  });

  it("reads the frameless line and style from the same markers the rest of the app uses", () => {
    expect(isFramelessLine({ constructionMethod: AEF_PRINTED_GEOMETRY_MARKER })).toBe(true);
    expect(isFramelessStyle({ name: "Torino TDW", isFrameless: true })).toBe(true);
    expect(isFramelessStyle({ name: "Shaker White", woodSpecies: "Maple" })).toBe(false);
    expect(isFramelessStyle(null)).toBe(false);
  });

  it("reports the wall line the plan was aligned to", () => {
    const tall = wall("tall", "W2440", 0, 24, 40.25, 54);
    const short = wall("short", "W3030", 24, 30, 30.25, 54);
    expect(framelessWallTopLineFor([tall, short], room, "top")).toBeCloseTo(94.25, 5);
    expect(framelessWallTopLineFor([], room, "top")).toBeNull();
  });

  it("restricts the rewrite to the uids the caller owns", () => {
    const tall = wall("tall", "W2440", 0, 24, 40.25, 54);
    const short = wall("short", "W3030", 24, 30, 30.25, 54);
    const result = alignFramelessWallCabinetTops({ placed: [tall, short], room, eligible: ["tall"] });
    expect(result.placed.find((item) => item.uid === "short")?.mountBottom).toBe(54);
  });
});
