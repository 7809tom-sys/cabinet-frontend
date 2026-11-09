/**
 * Above the range: the BRIDGE is mandatory, the rest is add-only.
 *
 * Owner HARD RULE (Nov 5 2026): every build places a real bridge wall cabinet above
 * the range, matched to the range width and picked to clear the wall's ceiling. It
 * is not optional, not skippable by the pop-up answer, and not skippable by the
 * fallback chain. A microwave and a hood are then added by the existing add-only
 * logic.
 *
 * These tests hold that rule across range widths, with and without a microwave, and
 * prove an existing bridge is never deleted or moved.
 */
import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import {
  APPLIANCES,
  DEFAULT_ROOM,
  applianceAsDesignCabinet,
  isMicrowaveOverRangePair,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import {
  OVER_RANGE_ANSWERS,
  existingOverRangeBridge,
  existingOverRangeHood,
  existingOverRangeMicrowave,
  fillOverRangeAnswer,
  isOverRangeAnswer,
  overRangeAnswerToPersist,
  overRangeHasBridge,
  overRangeIsOccupied,
  placeMandatoryOverRangeBridges,
  rangesInPlan,
  readOverRangeAnswer,
} from "./overRangeFill";
import { isBridgeOverRangeCabinet, overRangeBridgeFor } from "./overRangeCompanion";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const wallRows = (style: string) => REAL[style]!.wall as DesignCabinet[];
const appliancePalette = APPLIANCES.map(applianceAsDesignCabinet);
const BRIDGE_CODE = /^W(\d{2})(12|15|18|21|24)$/;

function range(start: number, width = 30): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 26, "bottom", DEFAULT_ROOM);
  return {
    uid: "range-1",
    cabinetId: 0,
    masterCode: "RANGE-30",
    description: "30 inch range",
    category: "Appliance",
    subCategory: "Appliance",
    placement: "appliance",
    ...spot,
    width,
    depth: 26,
    height: 36,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

function bridges(placed: readonly PlacedCabinet[]) {
  return placed.filter((item) => item.placement === "wall" && BRIDGE_CODE.test((item.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")));
}

function fill(overrides: Partial<Parameters<typeof fillOverRangeAnswer>[0]> = {}) {
  let n = 0;
  return fillOverRangeAnswer({
    placed: [range(60)],
    room: DEFAULT_ROOM,
    appliancePalette,
    wallCatalog: wallRows("330011"),
    wallCabinetHeightIn: 30,
    styleId: 330011,
    makeUid: () => `uid-${++n}`,
    ...overrides,
  });
}

describe("the bridge is mandatory, whatever the answer", () => {
  it("places a bridge with no answer saved", () => {
    const result = fill();
    expect(result.added).toBe(true);
    expect(result.everyRangeBridged).toBe(true);
    expect(result.placed.filter((item) => item.overRangeMicrowaveBridge === true)).toHaveLength(1);
  });

  it("places a bridge when the answer is 'open'", () => {
    // A hard rule is not skippable by the pop-up answer.
    const result = fill({ answer: "open" });
    expect(result.added).toBe(true);
    expect(result.everyRangeBridged).toBe(true);
    const bridge = bridges(result.placed);
    expect(bridge).toHaveLength(1);
    // Nothing else above the range: "open" still means no microwave and no hood.
    expect(result.placed.some((item) => /^MW-/.test(item.masterCode))).toBe(false);
    expect(result.placed.some((item) => /^HOOD-/.test(item.masterCode))).toBe(false);
  });

  it("places a bridge when the answer is 'hood'", () => {
    const result = fill({ answer: "hood" });
    expect(result.everyRangeBridged).toBe(true);
    expect(bridges(result.placed)).toHaveLength(1);
    expect(result.placed.some((item) => /^HOOD-/.test(item.masterCode))).toBe(true);
  });

  it("places a bridge when the answer is 'microwave-bridge'", () => {
    const result = fill({ answer: "microwave-bridge" });
    expect(result.everyRangeBridged).toBe(true);
    expect(bridges(result.placed)).toHaveLength(1);
    expect(result.placed.some((item) => /^MW-/.test(item.masterCode))).toBe(true);
  });

  it("seats the bridge at the 72 inch datum, centered on the range", () => {
    const result = fill();
    const bridge = bridges(result.placed)[0]!;
    expect(bridge.mountBottom).toBe(72);
    const center = wallRunOffset(range(60), "bottom", DEFAULT_ROOM) + wallRunSpan(range(60), "bottom", DEFAULT_ROOM) / 2;
    const wall = (bridge.wallId ?? "bottom") as "bottom";
    const bridgeCenter = wallRunOffset(bridge, wall, DEFAULT_ROOM) + wallRunSpan(bridge, wall, DEFAULT_ROOM) / 2;
    expect(bridgeCenter).toBeCloseTo(center, 3);
  });

  it("is idempotent: a second pass adds nothing and keeps the same bridge", () => {
    const first = fill();
    const again = fill({ placed: first.placed });
    expect(again.added).toBe(false);
    expect(again.placed).toEqual(first.placed);
    expect(again.everyRangeBridged).toBe(true);
  });
});

describe("the bridge is matched to the range width", () => {
  it("takes the 36 inch bridge for a 36 inch range", () => {
    const wide = range(60, 36);
    wide.uid = "range-36";
    const result = fill({ placed: [wide] });
    const bridge = bridges(result.placed)[0]!;
    expect(Number(bridge.width)).toBeCloseTo(36, 3);
    expect(bridge.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "")).toMatch(/^W36/);
  });

  it("takes the 30 inch bridge for a 30 inch range", () => {
    const result = fill();
    const bridge = bridges(result.placed)[0]!;
    expect(Number(bridge.width)).toBeCloseTo(30, 3);
  });

  it("covers every range width the matrix builds", () => {
    for (const width of [30, 33, 36, 42]) {
      const r = range(60, width);
      r.uid = `range-${width}`;
      const result = fill({ placed: [r], wallCatalog: wallRows("330011") });
      expect(result.everyRangeBridged, `width ${width}`).toBe(true);
      const bridge = result.placed.find((item) => item.placement === "wall" && isBridgeOverRangeCabinet(item, r, DEFAULT_ROOM));
      expect(bridge, `width ${width}`).toBeDefined();
      // Never narrower: 330011 has no W42xx, so the 42" range takes a single-door
      // W1x42 turned horizontal, which is 42" wide.
      expect(Number(bridge!.width), `width ${width}`).toBeCloseTo(width, 3);
      expect(bridge!.turnedSideways === true, `width ${width}`).toBe(width === 42);
    }
  });

  it("picks a bridge that clears a low ceiling", () => {
    const lowRoom = { ...DEFAULT_ROOM, ceilingHeight: 88 } as RoomData;
    const result = fill({ room: lowRoom, wallCabinetHeightIn: 42 });
    expect(result.everyRangeBridged).toBe(true);
    const bridge = bridges(result.placed)[0]!;
    expect(72 + Number(bridge.height)).toBeLessThanOrEqual(88 + 0.5);
  });
});

describe("the microwave and hood stay add-only on top of the bridge", () => {
  it("adds the matching microwave when no answer was saved", () => {
    const result = fill();
    expect(result.source).toBe("mandatory-bridge-fallback");
    const microwave = result.placed.find((item) => /^MW-/.test(item.masterCode))!;
    const r = result.placed.find((item) => item.uid === "range-1")!;
    expect(isMicrowaveOverRangePair(microwave, r)).toBe(true);
  });

  it("does not add a microwave when the answer is 'open'", () => {
    const result = fill({ answer: "open" });
    expect(result.source).toBe("mandatory-bridge");
    expect(result.placed.some((item) => /^MW-/.test(item.masterCode))).toBe(false);
  });

  it("keeps a manually placed microwave and does not duplicate it", () => {
    const manualMicrowave = {
      ...range(60),
      uid: "mw-manual",
      masterCode: "MW-30",
      height: 16,
      mountBottom: 56,
      depth: 15,
    } as PlacedCabinet;
    const result = fill({ placed: [range(60), manualMicrowave], answer: "microwave-bridge" });
    expect(result.placed.filter((item) => /^MW-/.test(item.masterCode))).toHaveLength(1);
    expect(result.placed.some((item) => item.uid === "mw-manual")).toBe(true);
    // The bridge is still mandatory.
    expect(result.everyRangeBridged).toBe(true);
  });

  it("keeps an existing hood and still places the bridge", () => {
    const hood = { ...range(60), uid: "hood-1", masterCode: "HOOD-30", mountBottom: 54, depth: 18, height: 18 } as PlacedCabinet;
    const result = fill({ placed: [range(60), hood] });
    expect(result.placed.some((item) => item.uid === "hood-1")).toBe(true);
    expect(result.everyRangeBridged).toBe(true);
    expect(result.placed.some((item) => /^MW-/.test(item.masterCode))).toBe(false);
  });
});

describe("an existing bridge is never deleted, replaced, or moved", () => {
  it("keeps the exact box already over the range", () => {
    const existing = {
      ...range(60),
      uid: "bridge-existing",
      masterCode: "W3012",
      placement: "wall",
      mountBottom: 72,
      width: 30,
      depth: 12,
      height: 12,
      overRangeMicrowaveBridge: true,
    } as PlacedCabinet;
    const result = fill({ placed: [range(60), existing] });
    const kept = result.placed.find((item) => item.uid === "bridge-existing")!;
    expect(kept).toEqual(existing);
    expect(bridges(result.placed)).toHaveLength(1);
    expect(existingOverRangeBridge(result.placed, result.placed.find((item) => item.uid === "range-1")!, DEFAULT_ROOM)?.uid).toBe("bridge-existing");
  });

  it("recognises an unflagged W30 box hung over the range as the bridge", () => {
    const legacy = {
      ...range(60),
      uid: "bridge-legacy",
      masterCode: "W3012",
      placement: "wall",
      mountBottom: 72,
      width: 30,
      depth: 12,
      height: 12,
    } as PlacedCabinet;
    const result = fill({ placed: [range(60), legacy] });
    expect(result.placed.filter((item) => item.uid === "bridge-legacy")).toHaveLength(1);
    expect(bridges(result.placed)).toHaveLength(1);
  });

  it("does not mistake an ordinary W3024 elsewhere in the run for the bridge", () => {
    const elsewhere = {
      ...range(60),
      uid: "w3024-elsewhere",
      masterCode: "W3024",
      placement: "wall",
      x: 0,
      y: 0,
      wallOffset: 0,
      mountBottom: 54,
      width: 30,
      depth: 12,
      height: 24,
    } as PlacedCabinet;
    const r = range(60);
    expect(isBridgeOverRangeCabinet(elsewhere, r, DEFAULT_ROOM)).toBe(false);
    const result = fill({ placed: [r, elsewhere] });
    expect(result.everyRangeBridged).toBe(true);
    // The mandatory bridge is a second, centered box.
    expect(bridges(result.placed)).toHaveLength(2);
  });
});

describe("a bridge that cannot seat is reported, never silently skipped", () => {
  it("names a blocking reason when the line sells no bridge", () => {
    // Drop the 30"-tall single-door uppers too, or a W1830 would be turned horizontal.
    const noBridge = wallRows("330011").filter((row) => {
      const code = (row.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return !BRIDGE_CODE.test(code) && !/^W(12|15|18|21)30$/.test(code);
    });
    const result = fill({ wallCatalog: noBridge });
    expect(result.everyRangeBridged).toBe(false);
    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0]!;
    expect(finding.code).toBe("range-bridge-blocked");
    expect(finding.severity).toBe("warning");
    expect(finding.detail).toContain("sells no 30″-wide bridge (W3012–W3024) and no single-door W1230–W2130 to turn horizontal");
    expect(finding.detail.length).toBeGreaterThan(20);
  });

  it("names a blocking reason when the ceiling leaves no room for any bridge", () => {
    // The lowest legal ceiling is 84". The bridge hangs at the 72" datum, so only a
    // 12" bridge fits — and only when the line sells one. A line whose shortest
    // bridge is 18" cannot dress an 84" wall at all.
    const tinyRoom = { ...DEFAULT_ROOM, ceilingHeight: 84 } as RoomData;
    const noTwelveInchBridge = wallRows("330011").filter((row) => {
      const normalized = (row.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return !/^W\d{2}12$/.test(normalized);
    });
    const result = fill({ room: tinyRoom, wallCatalog: noTwelveInchBridge });
    expect(result.everyRangeBridged).toBe(false);
    expect(result.findings[0]!.detail).toMatch(/ceiling/i);
  });

  it("names a blocking reason when the span above the range is occupied", () => {
    const blocker = {
      ...range(60),
      uid: "blocker",
      masterCode: "W3042",
      placement: "wall",
      mountBottom: 72,
      width: 30,
      depth: 12,
      height: 42,
    } as PlacedCabinet;
    const result = fill({ placed: [range(60), blocker] });
    // The blocker is not a bridge family box, so the bridge is attempted and found blocked.
    expect(result.everyRangeBridged).toBe(false);
    expect(result.findings[0]!.detail).toMatch(/occupied|clear upper wall/i);
    expect(result.placed.some((item) => item.uid === "blocker")).toBe(true);
  });

  it("is a no-op when there is no range in the plan", () => {
    const result = fill({ placed: [] });
    expect(result.added).toBe(false);
    expect(result.source).toBe("none");
    expect(result.placed).toEqual([]);
    expect(result.findings).toEqual([]);
  });
});

describe("the answer is still remembered with the layout", () => {
  it("accepts only the three answers the dialog offers", () => {
    for (const answer of OVER_RANGE_ANSWERS) expect(isOverRangeAnswer(answer)).toBe(true);
    expect(isOverRangeAnswer("nothing")).toBe(false);
    expect(isOverRangeAnswer(null)).toBe(false);
    expect(readOverRangeAnswer("hood")).toBe("hood");
    expect(readOverRangeAnswer("something")).toBeNull();
  });

  it("persists the chosen answer and never overwrites a saved one with a fallback", () => {
    expect(overRangeAnswerToPersist(null, "hood")).toBe("hood");
    expect(overRangeAnswerToPersist("open", "microwave-bridge")).toBe("microwave-bridge");
    expect(overRangeAnswerToPersist("hood", null)).toBe("hood");
    expect(overRangeAnswerToPersist(null, undefined)).toBeNull();
  });
});

describe("helpers keep the existing pair rules", () => {
  it("finds the existing microwave, bridge, and hood over a range", () => {
    const r = range(60);
    const microwave = { ...r, uid: "mw", masterCode: "MW-30", height: 16, mountBottom: 56, depth: 15 } as PlacedCabinet;
    const hood = { ...r, uid: "hood", masterCode: "HOOD-30", height: 18, mountBottom: 54, depth: 18 } as PlacedCabinet;
    const bridge = { ...r, uid: "bridge", masterCode: "W3012", placement: "wall", height: 12, mountBottom: 72, depth: 12 } as PlacedCabinet;
    expect(existingOverRangeMicrowave([r, microwave], r)?.uid).toBe("mw");
    expect(existingOverRangeMicrowave([r, hood], r)).toBeNull();
    expect(existingOverRangeHood([r, hood], r)?.uid).toBe("hood");
    expect(existingOverRangeHood([r, microwave], r)).toBeNull();
    expect(existingOverRangeBridge([r, bridge], r, DEFAULT_ROOM)?.uid).toBe("bridge");
    expect(overRangeHasBridge([r, bridge], r, DEFAULT_ROOM)).toBe(true);
  });

  it("counts only a hood, bridge, or microwave as covering the range", () => {
    const r = range(60);
    expect(overRangeIsOccupied([r], r, DEFAULT_ROOM)).toBe(false);
    const bridge = { ...r, uid: "bridge", masterCode: "W3012", placement: "wall", height: 12, mountBottom: 72, depth: 12 } as PlacedCabinet;
    expect(overRangeIsOccupied([r, bridge], r, DEFAULT_ROOM)).toBe(true);
  });

  it("finds every range in the plan", () => {
    expect(rangesInPlan([range(60), range(0, 36)])).toHaveLength(2);
    expect(rangesInPlan([])).toEqual([]);
  });

  it("uses the bridge family the catalog really sells", () => {
    const bridge = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 30, wallCatalog: wallRows("330011") });
    expect(bridge).not.toBeNull();
    expect(BRIDGE_CODE.test((bridge!.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""))).toBe(true);
  });
});

/**
 * Owner bug (Nov 6 2026): "the wall (bridge) cabinet over the range should be 12
 * inches but the designer did not apply that size."
 *
 * The bridge height is not a free choice. It hangs from the fixed 72" microwave
 * datum, so its height is whatever lands its top on the same line as the uppers
 * beside it: 30" uppers finish at 84", which makes the bridge 12" — W3012 over a
 * 30" range. A 42" run finishes at 96", which makes it 24".
 */
describe("the bridge is 12 inches over 30 inch uppers, not 24", () => {
  it("places a 12 inch bridge whose top lands on the 84 inch upper line", () => {
    for (const styleId of ["330011", "540005"]) {
      const bridge = overRangeBridgeFor({
        rangeWidthIn: 30, wallCabinetHeightIn: 30, wallCatalog: wallRows(styleId),
      });
      expect(bridge, styleId).not.toBeNull();
      expect(Number(bridge!.masterCode?.replace(/^W/, "").slice(2)), `${styleId} SKU height`).toBe(12);
      expect(Number(bridge!.height), `${styleId} height`).toBeLessThanOrEqual(12.75);
      // The top lands on the 30" upper line, within the catalog's own rounding.
      expect(72 + Number(bridge!.height), `${styleId} top`).toBeLessThanOrEqual(84.75);
    }
  });

  it("scales the bridge with the upper run instead of always using 24 inches", () => {
    const expected: Array<[30 | 36 | 42, number]> = [[30, 12], [36, 18], [42, 24]];
    for (const [uppers, height] of expected) {
      const bridge = overRangeBridgeFor({
        rangeWidthIn: 30, wallCabinetHeightIn: uppers, wallCatalog: wallRows("330011"),
      });
      expect(Number(bridge!.height), `${uppers}" uppers`).toBeCloseTo(height, 0);
    }
  });

  it("keeps a frameless bridge on its 72 inch datum and reaches the 94-1/4 inch line", () => {
    // Tom's decision (Nov 9 2026, issue #354 item 5): the frameless line has one
    // wall top line, 94-1/4", and the bridge must reach it from the fixed 72"
    // datum. So the pick is the frameless 22-5/8" box (W30xx23), not the old 12"
    // W3012 that topped out at 84-1/4". Its bottom never moves off 72".
    const room = { ...DEFAULT_ROOM, ceilingHeight: 108 } as RoomData;
    const seated = placeMandatoryOverRangeBridges({
      placed: [range(60)],
      room,
      wallCatalog: wallRows("540005"),
      wallCabinetHeightIn: 30,
      styleId: 540005,
      makeUid: () => "frameless-bridge",
    });
    const bridge = seated.placed.find((item) => item.overRangeMicrowaveBridge === true)!;
    expect(bridge.mountBottom).toBe(72);
    expect(Number(bridge.height)).toBeGreaterThan(20);
    expect(72 + Number(bridge.height)).toBeCloseTo(94.63, 1);
    expect(seated.findings).toEqual([]);
  });
});
