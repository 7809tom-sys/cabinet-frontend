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
} from "./design";
import {
  OVER_RANGE_ANSWERS,
  existingOverRangeHood,
  existingOverRangeMicrowave,
  fillOverRangeAnswer,
  isOverRangeAnswer,
  overRangeAnswerToPersist,
  overRangeIsOccupied,
  readOverRangeAnswer,
} from "./overRangeFill";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const wallRows = (style: string) => REAL[style]!.wall as DesignCabinet[];
const appliancePalette = APPLIANCES.map(applianceAsDesignCabinet);

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

describe("the over-range answer is remembered with the layout", () => {
  it("accepts only the three answers the dialog offers", () => {
    for (const answer of OVER_RANGE_ANSWERS) expect(isOverRangeAnswer(answer)).toBe(true);
    expect(isOverRangeAnswer("nothing")).toBe(false);
    expect(isOverRangeAnswer(null)).toBe(false);
    expect(isOverRangeAnswer(undefined)).toBe(false);
    expect(readOverRangeAnswer("hood")).toBe("hood");
    expect(readOverRangeAnswer("something")).toBeNull();
  });

  it("persists the chosen answer and never overwrites a saved one with a fallback", () => {
    expect(overRangeAnswerToPersist(null, "hood")).toBe("hood");
    expect(overRangeAnswerToPersist("open", "microwave-bridge")).toBe("microwave-bridge");
    // No new answer: the saved one survives, so a load uses the same decision.
    expect(overRangeAnswerToPersist("hood", null)).toBe("hood");
    // A fallback (no answer) never invents one.
    expect(overRangeAnswerToPersist(null, undefined)).toBeNull();
  });

  it("leaves an answered-open range bare and says so", () => {
    const result = fill({ answer: "open" });
    expect(result.added).toBe(false);
    expect(result.placed).toHaveLength(1);
    expect(result.source).toBe("none");
    expect(result.notes.join(" ")).toMatch(/left open/i);
  });

  it("places the answered microwave and bridge above the range", () => {
    const result = fill({ answer: "microwave-bridge" });
    expect(result.source).toBe("answer");
    expect(result.added).toBe(true);
    const added = result.placed.filter((item) => item.uid !== "range-1");
    expect(added).toHaveLength(2);
    const bridge = added.find((item) => item.placement === "wall")!;
    const microwave = added.find((item) => item.placement === "appliance")!;
    expect(bridge.masterCode).toMatch(/^W30(?:12|15|18|21|24)$/);
    expect(bridge.overRangeMicrowaveBridge).toBe(true);
    expect(microwave.masterCode).toMatch(/^MW-/);
    expect(isMicrowaveOverRangePair(microwave, result.placed.find((item) => item.uid === "range-1")!)).toBe(true);
  });

  it("places the answered hood above the range", () => {
    const result = fill({ answer: "hood" });
    expect(result.source).toBe("answer");
    const hood = result.placed.find((item) => /^HOOD-/.test(item.masterCode))!;
    expect(hood).toBeDefined();
    expect(hood.mountBottom).toBe(54);
  });
});

describe("the add-only fallback chain", () => {
  it("uses a W30xx bridge and the matching microwave when no answer was saved", () => {
    const result = fill();
    expect(result.source).toBe("fallback-bridge");
    expect(result.added).toBe(true);
    const bridge = result.placed.find((item) => item.overRangeMicrowaveBridge === true)!;
    const microwave = result.placed.find((item) => /^MW-/.test(item.masterCode))!;
    expect(bridge.masterCode).toMatch(/^W30/);
    expect(Math.abs(Number(bridge.width) - 30)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(Number(microwave.width) - 30)).toBeLessThanOrEqual(0.01);
  });

  it("falls back to a HOOD- item when the selected line sells no bridge", () => {
    const result = fill({ wallCatalog: [] });
    expect(result.source).toBe("fallback-hood");
    expect(result.placed.some((item) => /^HOOD-/.test(item.masterCode))).toBe(true);
  });

  it("falls back to a HOOD- item when there is no matching over-range microwave", () => {
    const result = fill({ appliancePalette: APPLIANCES.filter((item) => !/^MW-/.test(item.masterCode)) });
    expect(result.source).toBe("fallback-hood");
  });

  it("never deletes or moves an existing bridge or microwave", () => {
    const first = fill();
    const withBridge = first.placed;
    const again = fill({ placed: withBridge });
    // The second pass adds nothing and returns exactly what it was given.
    expect(again.added).toBe(false);
    expect(again.placed).toEqual(withBridge);
    expect(overRangeIsOccupied(withBridge, withBridge.find((item) => item.uid === "range-1")!, DEFAULT_ROOM)).toBe(true);
  });

  it("keeps a manually placed microwave and only leaves it alone", () => {
    const manualMicrowave = {
      ...range(60),
      uid: "mw-manual",
      masterCode: "MW-30",
      height: 16,
      mountBottom: 56,
      depth: 15,
    } as PlacedCabinet;
    const placed = [range(60), manualMicrowave];
    const result = fill({ placed, answer: "microwave-bridge" });
    // The manual microwave is never duplicated or replaced.
    expect(result.placed.filter((item) => /^MW-/.test(item.masterCode))).toHaveLength(1);
    expect(result.placed.some((item) => item.uid === "mw-manual")).toBe(true);
  });

  it("is a no-op when there is no range in the plan", () => {
    const result = fill({ placed: [] });
    expect(result.added).toBe(false);
    expect(result.source).toBe("none");
    expect(result.placed).toEqual([]);
  });

  it("reports when nothing can be added instead of forcing a cabinet", () => {
    // No wall catalog and no hood in the palette: the chain has nowhere to go.
    const result = fill({
      wallCatalog: [],
      appliancePalette: APPLIANCES.filter((item) => !/^MW-/.test(item.masterCode) && !/^HOOD-/.test(item.masterCode)).map(applianceAsDesignCabinet),
    });
    expect(result.added).toBe(false);
    expect(result.notes.join(" ")).toMatch(/nothing could be added/i);
  });
});

describe("helpers keep the existing pair rules", () => {
  it("finds the existing microwave and hood over a range", () => {
    const r = range(60);
    const microwave = { ...r, uid: "mw", masterCode: "MW-30", height: 16, mountBottom: 56, depth: 15 } as PlacedCabinet;
    const hood = { ...r, uid: "hood", masterCode: "HOOD-30", height: 18, mountBottom: 54, depth: 18 } as PlacedCabinet;
    expect(existingOverRangeMicrowave([r, microwave], r)?.uid).toBe("mw");
    expect(existingOverRangeMicrowave([r, hood], r)).toBeNull();
    expect(existingOverRangeHood([r, hood], r)?.uid).toBe("hood");
    expect(existingOverRangeHood([r, microwave], r)).toBeNull();
  });
});
