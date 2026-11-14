import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignMatrixCatalog.json";
import {
  DEFAULT_ROOM,
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
} from "./design";
import {
  emptyAutoDesignIntake,
  intakeMissing,
  togglePreference,
  lockedAnchorKinds,
  anchorWiggleIn,
  landingGaps,
  sinkBaseDownsizeSteps,
  fifteenRuleFindings,
  continuousWallRuns,
  unpairedOvenCabinets,
  fillerCount,
  FRIDGE_ASK_TEXT,
  FRIDGE_RECOMMEND_TEXT,
  type AutoDesignIntake,
} from "./autoDesignFifteenRules";

const base = (catalogFixture as any)["330002"].base as DesignCabinet[];

function lower(
  masterCode: string,
  width: number,
  offset: number,
  kind: "base" | "appliance" = "base",
  subCategory = "Base Cabinet",
): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", DEFAULT_ROOM);
  return {
    uid: `low-${masterCode}-${offset}`,
    cabinetId: kind === "appliance" ? 0 : 1,
    masterCode,
    description: masterCode.startsWith("SB")
      ? `${width}" Sink Base`
      : kind === "appliance"
        ? "Kitchen appliance"
        : "Base Cabinet",
    category: kind === "appliance" ? "Appliance" : "Base",
    subCategory,
    placement: kind,
    ...spot,
    width,
    depth: 24,
    height: 34.5,
    numberOfDoors: 2,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

function wallCabinet(
  masterCode: string,
  width: number,
  offset: number,
  wallId: "top" | "right" | "bottom" | "left" = "top",
): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 12, wallId, DEFAULT_ROOM);
  return {
    uid: `wall-${masterCode}-${offset}`,
    cabinetId: 2,
    masterCode,
    description: "Wall Cabinet",
    category: "Wall",
    subCategory: "Wall Cabinet",
    placement: "wall",
    ...spot,
    width,
    depth: 12,
    height: 30,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    mountBottom: 54,
  } as PlacedCabinet;
}

function tallCabinet(
  masterCode: string,
  width: number,
  offset: number,
  wallId: "top" | "right" | "bottom" | "left" = "top",
  description = "Oven Cabinet",
): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, wallId, DEFAULT_ROOM);
  return {
    uid: `tall-${masterCode}-${offset}`,
    cabinetId: 3,
    masterCode,
    description,
    category: "Tall",
    subCategory: "Tall Cabinet",
    placement: "tall",
    ...spot,
    width,
    depth: 24,
    height: 96,
    numberOfDoors: 2,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

function intake(overrides: Partial<AutoDesignIntake> = {}): AutoDesignIntake {
  return { ...emptyAutoDesignIntake(), ...overrides };
}

describe("emptyAutoDesignIntake + intakeMissing", () => {
  it("starts empty with nothing answered", () => {
    const i = emptyAutoDesignIntake();
    expect(i.construction).toBeNull();
    expect(i.preferences).toEqual([]);
    expect(i.islandOrPeninsula).toBe("none");
    expect(i.peninsulaSide).toBeNull();
    expect(i.canMove).toEqual({
      electrical: null,
      plumbing: null,
      rangeHookup: null,
      sinkBase: null,
    });
  });

  it("requires construction before layout math", () => {
    const missing = intakeMissing(emptyAutoDesignIntake());
    expect(missing.length).toBe(1);
    expect(missing[0]).toMatch(/new construction or old construction/i);
  });

  it("requires a peninsula wall when peninsula is picked", () => {
    const i = intake({ construction: "new", islandOrPeninsula: "peninsula" });
    const missing = intakeMissing(i);
    expect(missing.length).toBe(1);
    expect(missing[0]).toMatch(/peninsula/i);
  });

  it("is satisfied once construction and peninsula wall are set", () => {
    const i = intake({
      construction: "old",
      islandOrPeninsula: "peninsula",
      peninsulaSide: "left",
    });
    expect(intakeMissing(i)).toEqual([]);
  });

  it("treats null intake as missing construction", () => {
    expect(intakeMissing(null).length).toBe(1);
  });
});

describe("togglePreference", () => {
  it("keeps blind-corner and lazy-susan mutually exclusive", () => {
    let i = emptyAutoDesignIntake();
    i = togglePreference(i, "blind-corner", true);
    expect(i.preferences).toEqual(["blind-corner"]);
    i = togglePreference(i, "lazy-susan", true);
    expect(i.preferences).toEqual(["lazy-susan"]);
    i = togglePreference(i, "blind-corner", true);
    expect(i.preferences).toEqual(["blind-corner"]);
  });

  it("keeps preference order stable regardless of toggle order", () => {
    let i = emptyAutoDesignIntake();
    i = togglePreference(i, "crown-molding", true);
    i = togglePreference(i, "budget-friendly", true);
    i = togglePreference(i, "lots-of-drawers", true);
    expect(i.preferences).toEqual(["budget-friendly", "lots-of-drawers", "crown-molding"]);
  });

  it("removes a preference when toggled off", () => {
    let i = emptyAutoDesignIntake();
    i = togglePreference(i, "dishwasher", true);
    i = togglePreference(i, "dishwasher", false);
    expect(i.preferences).toEqual([]);
  });
});

describe("lockedAnchorKinds / anchorWiggleIn", () => {
  it("locks nothing when nothing is answered", () => {
    expect(lockedAnchorKinds(emptyAutoDesignIntake())).toEqual([]);
    expect(lockedAnchorKinds(null)).toEqual([]);
  });

  it("sink base no locks sink and dishwasher to 0 in", () => {
    const i = intake({ canMove: { ...emptyAutoDesignIntake().canMove, sinkBase: false } });
    expect(lockedAnchorKinds(i)).toEqual(["sink", "dishwasher"]);
    expect(anchorWiggleIn(i, "sink")).toBe(0);
    expect(anchorWiggleIn(i, "dishwasher")).toBe(0);
    expect(anchorWiggleIn(i, "stove")).toBe(3);
    expect(anchorWiggleIn(i, "refrigerator")).toBe(3);
  });

  it("range hookup no locks the stove", () => {
    const i = intake({ canMove: { ...emptyAutoDesignIntake().canMove, rangeHookup: false } });
    expect(lockedAnchorKinds(i)).toEqual(["stove"]);
    expect(anchorWiggleIn(i, "stove")).toBe(0);
    expect(anchorWiggleIn(i, "sink")).toBe(3);
  });

  it("electrical no locks the refrigerator", () => {
    const i = intake({ canMove: { ...emptyAutoDesignIntake().canMove, electrical: false } });
    expect(lockedAnchorKinds(i)).toEqual(["refrigerator"]);
    expect(anchorWiggleIn(i, "refrigerator")).toBe(0);
  });

  it("old construction alone locks nothing", () => {
    const i = intake({ construction: "old" });
    expect(lockedAnchorKinds(i)).toEqual([]);
    expect(anchorWiggleIn(i, "sink")).toBe(3);
    expect(anchorWiggleIn(i, "refrigerator")).toBe(3);
  });
});

describe("landingGaps", () => {
  it("measures gaps between fridge, sink and dishwasher on a 100 in wall", () => {
    const placed = [
      lower("FRIDGE-36", 36, 0, "appliance"),
      lower("B12", 12, 36),
      lower("SB36", 36, 48),
      lower("DW-24", 24, 84, "appliance"),
    ];
    const gaps = landingGaps(placed, DEFAULT_ROOM);
    // Only the refrigerator and the sink base are anchors; the dishwasher and B12 are counter.
    expect(gaps.length).toBe(1);

    const fridgeToSink = gaps.find(
      (g) => g.from.role === "refrigerator" && g.to.role === "sink",
    );
    expect(fridgeToSink).toBeDefined();
    expect(fridgeToSink!.gapIn).toBe(12);
    expect(fridgeToSink!.status).toBe("short");

    const sinkToDw = gaps.find((g) => g.from.role === "sink" && g.to.role === "range");
    // DW-24 is an appliance but not a range; only sink/refrigerator/range are anchors.
    expect(sinkToDw).toBeUndefined();
  });

  it("classifies 18 in as ok and 16 in as tight", () => {
    const okPlaced = [lower("FRIDGE-36", 36, 0, "appliance"), lower("SB36", 36, 54)];
    const okGaps = landingGaps(okPlaced, DEFAULT_ROOM);
    expect(okGaps.length).toBe(1);
    expect(okGaps[0].gapIn).toBe(18);
    expect(okGaps[0].status).toBe("ok");

    const tightPlaced = [lower("FRIDGE-36", 36, 0, "appliance"), lower("SB36", 36, 52)];
    const tightGaps = landingGaps(tightPlaced, DEFAULT_ROOM);
    expect(tightGaps.length).toBe(1);
    expect(tightGaps[0].gapIn).toBe(16);
    expect(tightGaps[0].status).toBe("tight");
  });
});

describe("sinkBaseDownsizeSteps", () => {
  it("returns 33 then 30 in order and never mutates the catalog", () => {
    const before = JSON.stringify(base);
    const steps = sinkBaseDownsizeSteps(36, base);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].widthIn).toBe(33);
    if (steps.length > 1) {
      expect(steps[1].widthIn).toBe(30);
    }
    expect(JSON.stringify(base)).toBe(before);
  });

  it("substitutes a regular B33 when SB33 is removed", () => {
    const noSb33 = base.filter((row) => !/^SB33$/i.test(row.masterCode));
    const steps = sinkBaseDownsizeSteps(36, noSb33);
    expect(steps.length).toBeGreaterThan(0);
    const first = steps[0];
    expect(first.widthIn).toBe(33);
    expect(first.substitute).toBe(true);
    expect(first.masterCode).toBe("B33");
    expect(first.note).toMatch(/regular 33 in base cabinet/i);
  });
});

describe("fifteenRuleFindings", () => {
  const wallLabelOf = (wallId: string) => (wallId === "top" ? "Wall 1" : null);

  it("suggests a 30 in fridge with the RECOMMEND text when the gap is short", () => {
    const placed = [
      lower("FRIDGE-36", 36, 0, "appliance"),
      lower("B12", 12, 36),
      lower("SB36", 36, 48),
    ];
    const findings = fifteenRuleFindings({
      placed,
      room: DEFAULT_ROOM,
      baseCatalog: base,
      intake: intake({ construction: "new" }),
      wallLabelOf,
      peninsulaBuilt: false,
    });
    const fridge = findings.find((f) => f.code === "suggest-fridge-30");
    expect(fridge).toBeDefined();
    expect(fridge!.detail).toContain(FRIDGE_RECOMMEND_TEXT);
  });

  it("suggests a 30 in fridge with the ASK text when the gap is tight", () => {
    const placed = [lower("FRIDGE-36", 36, 0, "appliance"), lower("SB36", 36, 52)];
    const findings = fifteenRuleFindings({
      placed,
      room: DEFAULT_ROOM,
      baseCatalog: base,
      intake: intake({ construction: "new" }),
      wallLabelOf,
      peninsulaBuilt: false,
    });
    const fridge = findings.find((f) => f.code === "suggest-fridge-30");
    expect(fridge).toBeDefined();
    expect(fridge!.detail).toContain(FRIDGE_ASK_TEXT);
  });

  it("produces a sink base downsize suggestion", () => {
    const placed = [
      lower("FRIDGE-36", 36, 0, "appliance"),
      lower("B12", 12, 36),
      lower("SB36", 36, 48),
    ];
    const findings = fifteenRuleFindings({
      placed,
      room: DEFAULT_ROOM,
      baseCatalog: base,
      intake: intake({ construction: "new" }),
      wallLabelOf,
      peninsulaBuilt: false,
    });
    const sink = findings.find((f) => f.code === "suggest-sink-base-downsize");
    expect(sink).toBeDefined();
    expect(sink!.detail).toMatch(/suggestion only/i);
  });

  it("never mutates placed widths or codes (suggestions only)", () => {
    const placed = [
      lower("FRIDGE-36", 36, 0, "appliance"),
      lower("B12", 12, 36),
      lower("SB36", 36, 48),
    ];
    const snapshot = placed.map((c) => ({ uid: c.uid, width: c.width, code: c.masterCode }));
    fifteenRuleFindings({
      placed,
      room: DEFAULT_ROOM,
      baseCatalog: base,
      intake: intake({ construction: "new" }),
      wallLabelOf,
      peninsulaBuilt: false,
    });
    const after = placed.map((c) => ({ uid: c.uid, width: c.width, code: c.masterCode }));
    expect(after).toEqual(snapshot);
  });
});

describe("continuousWallRuns", () => {
  it("merges two wall cabinets 1 in apart into one run", () => {
    const placed = [wallCabinet("W30", 30, 0), wallCabinet("W30", 30, 31)];
    const runs = continuousWallRuns(placed, DEFAULT_ROOM);
    expect(runs.length).toBe(1);
    expect(runs[0].uids.length).toBe(2);
    expect(runs[0].startIn).toBe(0);
    expect(runs[0].endIn).toBe(61);
  });

  it("splits at a 6 in gap", () => {
    const placed = [wallCabinet("W30", 30, 0), wallCabinet("W30", 30, 36)];
    const runs = continuousWallRuns(placed, DEFAULT_ROOM);
    expect(runs.length).toBe(2);
    expect(runs[0].uids.length).toBe(1);
    expect(runs[1].uids.length).toBe(1);
  });
});

describe("unpairedOvenCabinets", () => {
  it("flags an oven cabinet on the left wall when the sink base is on the top wall", () => {
    const placed = [
      tallCabinet("O3396", 33, 0, "left", "Oven Cabinet"),
      lower("SB36", 36, 0),
    ];
    const unpaired = unpairedOvenCabinets(placed);
    expect(unpaired.length).toBe(1);
    expect(unpaired[0].masterCode).toBe("O3396");
  });

  it("does not flag when a sink base is on the same wall", () => {
    const placed = [
      tallCabinet("O3396", 33, 0, "left", "Oven Cabinet"),
      lower("SB36", 36, 0),
    ];
    // Move the sink base to the left wall.
    const sinkSpot = wallPlacementAt(40, 36, 24, "left", DEFAULT_ROOM);
    const sinkOnLeft = { ...placed[1], ...sinkSpot } as PlacedCabinet;
    const unpaired = unpairedOvenCabinets([placed[0], sinkOnLeft]);
    expect(unpaired).toEqual([]);
  });
});

describe("fillerCount", () => {
  it("counts F3 and BF3 fillers", () => {
    const placed = [
      lower("F3", 3, 0),
      lower("BF3", 3, 3),
      lower("B12", 12, 6),
    ];
    expect(fillerCount(placed)).toBe(2);
  });
});
