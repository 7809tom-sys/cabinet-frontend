/**
 * Owner item 7 and the contradiction report:
 *
 *   "A 30in regular wall cabinet fits above a 30in range, but a 30in bridge
 *    cabinet + 30in over-the-range microwave in the same spot is flagged as not
 *    fitting."
 *
 * Above the range the owner rule is an over-the-range microwave with a BRIDGE
 * cabinet above it (kitchen rules: owner-bridge-cabinets). For width and fit
 * purposes that stack must behave exactly like the plain wall cabinet it
 * replaces: same span, same width check. Only the heights differ — the stack's
 * top lands on the upper run's top line.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";
import { bridgeHeightForWallHeight, cabinetWall, wallRunOffset, wallRunSpan } from "./design";
import {
  DEFAULT_OVER_RANGE_ANSWER,
  answerWantsMicrowaveBridge,
  bridgeStackFitsLikeWallCabinet,
  overRangeBridgeFor,
  planOverRangeCompanions,
} from "./overRangeCompanion";

type Pack = { base: unknown[]; wall: DesignCabinet[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const WALLS = REAL["330011"]!.wall;
const ROOM = { width: 150, depth: 150, ceilingHeight: 96, openWallPath: false } as RoomData;

const appliancePalette: DesignCabinet[] = [
  { id: 0, masterCode: "MW-30", description: '30" Over-Range Microwave', category: "Appliance", subCategory: "Appliance", width: "30", height: "16", depth: "15", placement: "appliance" } as DesignCabinet,
];

function range(width = 30, start = 60): PlacedCabinet {
  return {
    uid: "range", cabinetId: 0, masterCode: "RANGE-30", description: '30" Range',
    category: "Appliance", subCategory: "Appliance", placement: "appliance",
    x: start, y: 0, width, depth: 25, height: 36, rotation: 0, wallId: "top", wallOffset: start,
  } as PlacedCabinet;
}

describe("the default above the range is the microwave + bridge stack", () => {
  it("defaults to microwave + bridge, not a full-height wall cabinet", () => {
    expect(DEFAULT_OVER_RANGE_ANSWER).toBe("microwave-bridge");
    expect(answerWantsMicrowaveBridge(undefined)).toBe(true);
    expect(answerWantsMicrowaveBridge(null)).toBe(true);
    // An explicit other answer is still honored.
    expect(answerWantsMicrowaveBridge("hood")).toBe(false);
    expect(answerWantsMicrowaveBridge("open")).toBe(false);
  });

  it("sizes the bridge so its top lands on the upper line", () => {
    // 30" uppers -> 12" bridge sitting on the 72" microwave datum, topping at 84.
    expect(bridgeHeightForWallHeight(30)).toBe(12);
    expect(bridgeHeightForWallHeight(36)).toBe(18);
    expect(bridgeHeightForWallHeight(42)).toBe(24);
    const bridge = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 30, wallCatalog: WALLS });
    expect(bridge?.masterCode).toMatch(/^W30(?:12|15|18|21|24)$/);
    expect(Number(bridge?.height)).toBe(12);
  });
});

describe("a 30in microwave + 30in bridge fits wherever a W30xx would", () => {
  it("needs no more span than the wall cabinet it replaces", () => {
    const verdict = bridgeStackFitsLikeWallCabinet({
      availableSpanIn: 30,
      wallCabinetWidthIn: 30,
      bridgeWidthIn: 30,
      microwaveWidthIn: 30,
    });
    expect(verdict.fits).toBe(true);
    expect(verdict.requiredSpanIn).toBe(30);
    expect(verdict.reason).toBeNull();
  });

  it("still fits when the free span is exactly a wall cabinet's width", () => {
    for (const span of [30, 30.5, 33, 36]) {
      for (const cabinetWidth of [30, 33, 36]) {
        if (span + 0.01 < cabinetWidth) continue;
        expect(bridgeStackFitsLikeWallCabinet({
          availableSpanIn: span,
          wallCabinetWidthIn: cabinetWidth,
          bridgeWidthIn: Math.min(30, cabinetWidth),
          microwaveWidthIn: Math.min(30, cabinetWidth),
        }).fits).toBe(true);
      }
    }
  });

  it("does not fit only when the plain wall cabinet would not fit either", () => {
    const stack = bridgeStackFitsLikeWallCabinet({
      availableSpanIn: 24,
      wallCabinetWidthIn: 30,
      bridgeWidthIn: 30,
      microwaveWidthIn: 30,
    });
    expect(stack.fits).toBe(false);
    expect(stack.reason).toMatch(/30″ cabinet goes here/);
  });

  it("places the whole stack above a 30in range in the measured build", () => {
    const result = planOverRangeCompanions({
      answer: "microwave-bridge",
      placed: [range(30, 60)],
      room: ROOM,
      appliancePalette,
      wallCatalog: WALLS,
      wallCabinetHeightIn: 30,
    });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.findings)).toBe(true);
    if (!result.ok) return;
    const wall = cabinetWall(range(30, 60), ROOM);
    const bridgeStart = wallRunOffset({ ...range(30, 60), ...result.plan.bridgeSpot } as PlacedCabinet, wall, ROOM);
    // Centered over the range, 30 inches wide, exactly the span a W30xx takes.
    expect(Number(result.plan.bridge.width)).toBe(30);
    expect(bridgeStart).toBeCloseTo(60, 5);
    expect(Number(result.plan.microwave.width)).toBe(30);
    // The bridge top lands on the 84 inch upper line for 30 inch uppers.
    expect(result.plan.bridgeMountBottom + Number(result.plan.bridge.height)).toBeCloseTo(84, 5);
    void wallRunSpan;
  });

  it("never rejects the stack for a span that accepts a 30 inch wall cabinet", () => {
    // Same free span, compared directly: the wall cabinet and the stack agree.
    for (const available of [30, 33, 36, 42]) {
      const wallCabinetFits = available + 0.01 >= 30;
      const stackFits = bridgeStackFitsLikeWallCabinet({
        availableSpanIn: available,
        wallCabinetWidthIn: 30,
        bridgeWidthIn: 30,
        microwaveWidthIn: 30,
      }).fits;
      expect(stackFits).toBe(wallCabinetFits);
    }
  });
});
