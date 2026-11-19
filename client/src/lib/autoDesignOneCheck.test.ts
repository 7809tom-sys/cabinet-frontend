/**
 * Tom, voice, Nov 18 2026, 6:06-6:07 PM CT: one check over a complete Auto Design.
 * Passing and failing fixtures for each of the ten checks, the bathroom scope, the
 * "only NEW problems fail" baseline, and the 170 x 170 L Aero Solstice case.
 */
import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import {
  DEFAULT_ROOM, applianceAsDesignCabinet, appliancesForRoom, isStacker, wallPlacementAt,
  type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening,
} from "./design";
import {
  ONE_CHECK_IDS, catalogAdaHook, formatOneCheckReport, oneCheckBaselineKeys, runOneCheck, type OneCheckOptions,
} from "./autoDesignOneCheck";

const STYLE = 390009;
const ROOM = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function seat(p: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "width">, start: number, wallId = "top"): PlacedCabinet {
  const placement = p.placement ?? "base";
  const depth = placement === "wall" ? 12 : 24;
  const spot = wallPlacementAt(start, p.width, depth, wallId as never, ROOM);
  return {
    cabinetId: 1, masterCode: "B", description: "", category: placement === "wall" ? "Wall" : "Base", subCategory: "Standard Base",
    height: placement === "wall" ? 30 : placement === "tall" ? 96 : 34.5, numberOfDoors: 2, numberOfDrawers: 0,
    mountBottom: placement === "wall" ? 54 : 0, styleId: STYLE, ...p, placement, depth, ...spot,
  } as PlacedCabinet;
}
const base = (uid: string, code: string, width: number, start: number, extra: Partial<PlacedCabinet> = {}) => seat({ uid, width, masterCode: code, ...extra }, start);
const upper = (uid: string, code: string, width: number, start: number, extra: Partial<PlacedCabinet> = {}) => seat({ uid, width, masterCode: code, placement: "wall", ...extra }, start);
const range = (start: number) => seat({ uid: "range", width: 30, masterCode: "RANGE-30", description: "Range", category: "Appliance", subCategory: "Appliance", placement: "appliance", height: 36, numberOfDoors: 0 }, start);
const filler = (uid: string, width: number, start: number, extra: Partial<PlacedCabinet> = {}) =>
  seat({ uid, width, masterCode: "BF3", description: "Base Filler", category: "Filler", subCategory: "Filler", numberOfDoors: 0, ...extra }, start);
const panel = (uid: string, start: number) =>
  seat({ uid, width: 0.75, masterCode: "BEP2435", description: "Base End Panel", category: "Panels", subCategory: "End Panel", numberOfDoors: 0 }, start);

/** A clean 144 in kitchen run: bases and uppers on the same seams, drawer bank beside the range, one style, one top. */
function cleanKitchen(): PlacedCabinet[] {
  return [
    base("b1", "B24", 24, 0), base("b2", "B36", 36, 24), range(60), base("b3", "3DB15", 15, 90, { numberOfDoors: 0, numberOfDrawers: 3 }),
    base("b4", "B24", 24, 105), base("b5", "B15", 15, 129),
    upper("u1", "W2430", 24, 0), upper("u2", "W3630", 36, 24),
    upper("u3", "W3012", 30, 60, { height: 12, mountBottom: 72, description: "Bridge cabinet over the range" }),
    upper("u4", "W1530", 15, 90), upper("u5", "W2430", 24, 105), upper("u6", "W1530", 15, 129),
  ];
}
const check = (placed: readonly PlacedCabinet[], extra: Partial<OneCheckOptions> = {}) =>
  runOneCheck({ placed, room: ROOM, expectedStyleId: STYLE, ...extra });
const codes = (result: ReturnType<typeof runOneCheck>) => result.problems.map((p) => p.code);
const without = (placed: PlacedCabinet[], uid: string) => placed.filter((p) => p.uid !== uid);
const swap = (placed: PlacedCabinet[], uid: string, next: PlacedCabinet) => placed.map((p) => (p.uid === uid ? next : p));

describe("one check: the clean kitchen passes", () => {
  it("passes with no problems and runs the kitchen checks", () => {
    const result = check(cleanKitchen());
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/^PASS/);
    expect(result.checksRun).toEqual(expect.arrayContaining(["bases-present", "uppers-square-over-bases", "no-filler-outside-panel", "corner-filler", "one-door-style", "one-crown-height", "drawer-banks"]));
    // glass has nothing to check (none asked for), island has no island, ADA is off.
    expect(result.checksSkipped.map((s) => s.check).sort()).toEqual(["ada-styles-offered", "glass-stackers", "island-aisle", "no-39-where-glass"]);
  });
});

describe("check 1: no missing bases", () => {
  it("flags a missing base spot", () => {
    const result = check(without(cleanKitchen(), "b2"));
    expect(result.ok).toBe(false);
    expect(result.problems.find((p) => p.code === "base-spot-missing")?.message).toMatch(/36″ spot at 24″–60″/);
  });
  it("flags an open gap with no filler, and accepts the filler", () => {
    const small = [base("a", "B24", 24, 0), base("b", "B24", 24, 26), range(50)];
    expect(codes(check(small))).toContain("base-gap-unfilled");
    const filled = [base("a", "B24", 24, 0), filler("f", 2, 24), base("b", "B24", 24, 26), range(50)];
    expect(codes(check(filled))).not.toContain("base-gap-unfilled");
  });
});

describe("check 3: uppers sized base-first and square over the base below", () => {
  it("flags an upper whose end is not on a base seam", () => {
    const result = check(swap(cleanKitchen(), "u2", upper("u2", "W3330", 33, 24)));
    expect(result.problems.find((p) => p.code === "upper-edge-off-base-seam")?.cabinetCode).toBe("W3330");
  });
  it("accepts two 21s tiling one 42 base", () => {
    const placed = [base("a", "B42", 42, 0), base("b", "B42", 42, 42), base("c", "B30", 30, 84), base("d", "B30", 30, 114), upper("u1", "W2130", 21, 0), upper("u2", "W2130", 21, 21), upper("u3", "W4230", 42, 42)];
    expect(check(placed).problems).toEqual([]);
  });
  it("flags an upper hanging over bare wall", () => {
    const placed = [base("a", "B24", 24, 0), upper("u1", "W2430", 24, 0), upper("u2", "W2430", 24, 40)];
    expect(codes(check(placed))).toContain("upper-over-bare-wall");
  });
  it("flags an upper turned off its wall", () => {
    const turned = { ...upper("u1", "W2430", 24, 0), rotation: 90 } as PlacedCabinet;
    expect(codes(check(swap(cleanKitchen(), "u1", turned)))).toContain("upper-not-square");
  });
});

describe("check 4: no filler outside an exposed panel or fridge panel", () => {
  it("flags a filler on the outside of a panel and keeps one between cabinets", () => {
    const outside = [base("c", "B30", 30, 40), panel("p", 70), filler("f", 3, 70.75)];
    expect(codes(check(outside))).toContain("filler-outside-panel");
    const between = [base("a", "B30", 30, 0), filler("m", 1.5, 30), base("b", "B30", 30, 31.5)];
    expect(codes(check(between))).not.toContain("filler-outside-panel");
  });
  it("accepts a filler INSIDE a fridge panel and flags one outside it", () => {
    const fridge = (start: number) => seat({ uid: "fr", width: 36, masterCode: "FRIDGE-36", description: "Refrigerator", category: "Appliance", subCategory: "Appliance", placement: "appliance", height: 70 }, start);
    const fpanel = (uid: string, start: number) => seat({ uid, width: 0.75, masterCode: "REPV2496", description: "Refrigerator end panel", category: "Panels", subCategory: "Refrigerator End Panel", placement: "tall", numberOfDoors: 0, height: 84, refrigeratorAssemblyRole: "left-panel" }, start);
    expect(codes(check([base("a", "B30", 30, 0), fpanel("p", 30), filler("f", 2, 30.75), fridge(32.75)]))).not.toContain("filler-outside-panel");
    expect(codes(check([base("a", "B30", 30, 0), filler("f", 1, 30), fpanel("p", 31), fridge(31.75)]))).toContain("filler-outside-panel");
  });
});

describe("check 5: corner fillers are horizontal clearance fillers with a reason", () => {
  const lead = (extra: Partial<PlacedCabinet>) => [filler("cf", 1, 0, extra), base("b", "B30", 30, 1), base("c", "B30", 30, 31)];
  it("flags a corner filler with no written reason", () => {
    expect(codes(check(lead({})))).toContain("corner-filler-no-reason");
  });
  it("accepts a horizontal clearance filler that states why it is there", () => {
    const result = check(lead({ autoPlacedReason: "Door swing clearance beside the corner wall pantry" }));
    expect(result.problems.filter((p) => p.check === "corner-filler")).toEqual([]);
  });
  it("flags a vertical decorative corner strip even with a reason", () => {
    const result = check(lead({ fillerContinuousVertical: true, height: 84, autoPlacedReason: "Hides the gap at the corner" }));
    expect(codes(result)).toContain("corner-filler-vertical");
    expect(codes(result)).not.toContain("corner-filler-no-reason");
  });
  it("leaves a required miter filler vertical, but still wants its reason", () => {
    const result = check(lead({ fillerTransitionKind: "front-miter-pair", fillerContinuousVertical: true, height: 84 }));
    expect(codes(result)).toEqual(expect.arrayContaining(["corner-filler-no-reason"]));
    expect(codes(result)).not.toContain("corner-filler-vertical");
  });
  it("ignores a plain filler in the middle of a run", () => {
    const mid = [base("a", "B30", 30, 20), filler("m", 1.5, 50), base("b", "B30", 30, 51.5)];
    expect(check(mid).problems.filter((p) => p.check === "corner-filler")).toEqual([]);
  });
});

describe("check 6: one door style per kitchen", () => {
  it("passes when every cabinet carries the selected style (and when it is inherited)", () => {
    expect(check(cleanKitchen()).problems).toEqual([]);
    const inherited = cleanKitchen().map((p) => ({ ...p, styleId: undefined }) as PlacedCabinet);
    expect(runOneCheck({ placed: inherited, room: ROOM, defaultStyleId: STYLE, expectedStyleId: STYLE }).problems).toEqual([]);
  });
  it("flags a cabinet on another style, against the selected style", () => {
    const result = check(swap(cleanKitchen(), "u5", { ...upper("u5", "W2430", 24, 105), styleId: 390019 } as PlacedCabinet));
    expect(result.problems.find((p) => p.code === "door-style-mismatch")?.cabinetUid).toBe("u5");
  });
  it("with no selected style, flags the minority style", () => {
    const result = runOneCheck({ placed: swap(cleanKitchen(), "u5", { ...upper("u5", "W2430", 24, 105), styleId: 390019 } as PlacedCabinet), room: ROOM });
    expect(result.problems.map((p) => [p.code, p.cabinetUid])).toEqual([["door-style-mixed", "u5"]]);
  });
});

describe("check 7: one crown height", () => {
  it("flags an upper that tops out higher than the rest", () => {
    const result = check(swap(cleanKitchen(), "u1", upper("u1", "W2430", 24, 0, { mountBottom: 60 })));
    expect(result.problems.find((p) => p.code === "crown-height-split")?.cabinetUid).toBe("u1");
  });
  it("warns, without failing, when a bridge stops below the line", () => {
    const result = check(swap(cleanKitchen(), "u3", upper("u3", "W3012", 30, 60, { height: 12, mountBottom: 60, description: "Bridge cabinet over the range" })));
    expect(result.problems.map((p) => [p.code, p.severity])).toEqual([["bridge-below-crown-line", "warning"]]);
    expect(result.ok).toBe(true);
  });
});

describe("check 8: drawer banks only beside the range", () => {
  it("flags a drawer bank away from the range", () => {
    const result = check(swap(cleanKitchen(), "b1", base("b1", "3DB24", 24, 0, { numberOfDoors: 0, numberOfDrawers: 3 })));
    expect(result.problems.find((p) => p.code === "drawer-bank-not-by-range")?.cabinetCode).toBe("3DB24");
  });
  it("flags a drawer in an upper run", () => {
    const result = check(swap(cleanKitchen(), "u4", upper("u4", "WD1530", 15, 90, { numberOfDrawers: 2 })));
    expect(codes(result)).toContain("drawer-in-upper-run");
  });
});

describe("check 9: island aisle 42 in, 48 in for ADA", () => {
  const island = (y: number, extra: Partial<PlacedCabinet> = {}) => ({
    uid: "isl", cabinetId: 1, masterCode: "B36", description: "", placement: "base", category: "Base", x: 40, y, width: 36, depth: 24, rotation: 0, height: 34.5,
    islandFace: "front", styleId: STYLE, ...extra,
  }) as PlacedCabinet;
  const walls = cleanKitchen();
  it("passes at 42 in and fails under it", () => {
    expect(check([...walls, island(66)]).problems.filter((p) => p.check === "island-aisle" && p.severity === "error")).toEqual([]);
    const tight = check([...walls, island(60)]);
    expect(tight.ok).toBe(false);
    expect(tight.problems.find((p) => p.code === "island-aisle-short")?.message).toMatch(/36″ of aisle to the cabinets; the rule is 42″/);
  });
  it("needs 48 in when the design is ADA", () => {
    const ada = (y: number) => runOneCheck({ placed: [...walls, island(y)], room: ROOM, expectedStyleId: STYLE, ada: true, baseCatalog: [] });
    expect(ada(66).problems.some((p) => p.code === "island-aisle-short")).toBe(true);
    expect(ada(72).problems.some((p) => p.code === "island-aisle-short")).toBe(false);
  });
  it("names a requested island that was never built", () => {
    const result = check(cleanKitchen(), { islandExpected: true });
    expect(result.problems.map((p) => [p.code, p.severity])).toEqual([["island-missing", "warning"]]);
    expect(result.ok).toBe(true);
  });
});

describe("check 10: ADA only with ADA cabinets the catalog really offers", () => {
  const shaker = (matrix as unknown as Record<string, { base: DesignCabinet[] }>)["330014"].base;
  const aero = (live as unknown as { base: DesignCabinet[] }).base;
  it("reads the catalog's own marker (SKU code or ADA category), not a hard-coded line", () => {
    expect(shaker.filter((row) => catalogAdaHook.isAdaCabinet(row)).length).toBeGreaterThanOrEqual(21);
    expect(aero.filter((row) => catalogAdaHook.isAdaCabinet(row))).toEqual([]);
    expect(catalogAdaHook.isAdaCabinet({ masterCode: "ADA-B12" })).toBe(true);
    expect(catalogAdaHook.isAdaCabinet({ masterCode: "B12ADA" })).toBe(true);
    expect(catalogAdaHook.isAdaCabinet({ masterCode: "B12", category: "Base" })).toBe(false);
    expect(catalogAdaHook.isAdaCabinet({ masterCode: "B18ADA1RS", category: "ADA" })).toBe(true);
  });
  const ada = (placed: PlacedCabinet[], baseCatalog: DesignCabinet[], kind: "kitchen" | "bathroom" = "kitchen") =>
    runOneCheck({ placed, room: ROOM, kind, ada: true, baseCatalog, expectedStyleId: STYLE });
  it("fails a standard base when the line sells its ADA twin", () => {
    const result = ada([base("a", "B18", 18, 0)], shaker);
    expect(result.problems.find((p) => p.check === "ada-styles-offered")).toMatchObject({ code: "ada-base-not-ada", cabinetCode: "B18" });
    expect(result.ok).toBe(false);
  });
  it("fails a base the line sells no ADA version of", () => {
    expect(ada([base("a", "B42", 42, 0)], shaker).problems.find((p) => p.check === "ada-styles-offered")?.code).toBe("ada-no-version-offered");
  });
  it("passes when every counter base is an ADA cabinet the line sells", () => {
    const placed = [base("a", "B18ADA", 18, 0), base("b", "B24ADA", 24, 18), base("c", "3DB15ADA", 15, 42)];
    expect(ada(placed, shaker).problems.filter((p) => p.check === "ada-styles-offered")).toEqual([]);
  });
  it("fails the design when the line offers no ADA cabinets at all (data missing), never inventing one", () => {
    const result = ada([base("a", "B24", 24, 0)], aero);
    expect(result.problems.filter((p) => p.check === "ada-styles-offered").map((p) => p.code)).toEqual(["ada-line-offers-none"]);
    expect(result.ok).toBe(false);
  });
  it("is off unless the design is ADA", () => {
    const result = runOneCheck({ placed: [base("a", "B18", 18, 0)], room: ROOM, baseCatalog: shaker, expectedStyleId: STYLE });
    expect(result.problems.filter((p) => p.check === "ada-styles-offered")).toEqual([]);
    expect(result.checksSkipped).toContainEqual({ check: "ada-styles-offered", reason: "design is not set to ADA" });
  });
  it("one toggle covers a bathroom vanity run too", () => {
    const vanity = base("v", "3VDB15", 15, 0, { category: "Vanity" });
    expect(ada([vanity], shaker, "bathroom").problems.map((p) => p.code)).toEqual(["ada-base-not-ada"]);
    expect(ada([base("v", "3VDB15ADA", 15, 0, { category: "ADA" })], shaker, "bathroom").problems).toEqual([]);
  });
  it("accepts a caller-supplied ADA list through the hook", () => {
    const hook = { isAdaCabinet: (i: { masterCode?: string | null }) => i.masterCode === "B24", adaCoreCode: () => null };
    const result = runOneCheck({ placed: [base("a", "B24", 24, 0)], room: ROOM, ada: true, adaHook: hook, baseCatalog: [{ ...shaker[0], masterCode: "B24" }], expectedStyleId: STYLE });
    expect(result.problems.filter((p) => p.check === "ada-styles-offered")).toEqual([]);
  });
});

describe("bathrooms", () => {
  it("skips the kitchen-only checks and still runs filler, style, crown and ADA", () => {
    const broken = without(cleanKitchen(), "b2"); // a missing base is only a kitchen problem
    const result = check(broken, { kind: "bathroom" });
    expect(result.checksSkipped.map((s) => s.check)).toEqual(expect.arrayContaining(["bases-present", "glass-stackers", "no-39-where-glass", "uppers-square-over-bases", "drawer-banks", "island-aisle"]));
    expect(result.problems.filter((p) => p.check === "bases-present")).toEqual([]);
    expect(result.checksRun).toEqual(expect.arrayContaining(["no-filler-outside-panel", "corner-filler", "one-door-style", "one-crown-height"]));
    const mixed = check([...broken, { ...base("x", "VS30", 30, 100), styleId: 390019 } as PlacedCabinet], { kind: "bathroom" });
    expect(codes(mixed)).toContain("door-style-mismatch");
  });
  it("lists every check id once between run and skipped", () => {
    const result = check(cleanKitchen(), { kind: "bathroom", ada: true, baseCatalog: [] });
    const all = [...result.checksRun, ...result.checksSkipped.map((s) => s.check)].sort();
    expect(all).toEqual([...ONE_CHECK_IDS].sort());
  });
});

describe("only NEW problems fail", () => {
  it("lists baseline problems under known and does not count them", () => {
    const broken = swap(without(cleanKitchen(), "b2"), "u1", upper("u1", "W2430", 24, 0, { mountBottom: 60 }));
    const first = check(broken);
    expect(first.ok).toBe(false);
    const baseline = oneCheckBaselineKeys(first);
    const again = check(broken, { baseline });
    expect(again.ok).toBe(true);
    expect(again.problems).toEqual([]);
    expect(again.known.length).toBe(first.problems.length);
    expect(again.summary).toMatch(/known problem/);
  });
  it("still fails on a problem that is not in the baseline", () => {
    const baseline = oneCheckBaselineKeys(check(without(cleanKitchen(), "b2")));
    const worse = check(swap(without(cleanKitchen(), "b2"), "u5", { ...upper("u5", "W2430", 24, 105), styleId: 390019 } as PlacedCabinet), { baseline });
    expect(worse.ok).toBe(false);
    expect(codes(worse)).toEqual(["door-style-mismatch"]);
  });
  it("groups problems by cabinet", () => {
    const result = check(swap(cleanKitchen(), "u1", upper("u1", "W2430", 24, 0, { mountBottom: 60 })));
    expect(Object.keys(result.byCabinet)).toEqual(["u1"]);
    expect(formatOneCheckReport(result)).toMatch(/\[one-crown-height\]/);
  });
});

/* The engine case: 170 x 170 L, Aero Solstice (390019), glass stackers + crown + island requested. */
const LIVE = live as unknown as { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[]; surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] } };
const SINK_WINDOW = { uid: "w", kind: "window", label: "Window 36\"", side: "top", offset: 67, width: 36, height: 42, sill: 42 } as WallOpening;

function aero170L(ceilingHeight: number) {
  const room = { width: 170, depth: 170, ceilingHeight, openWallPath: false } as RoomData;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 85 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 54 }, refrigerator: { wallLabel: "Wall 2", centerOffsetIn: 100 }, refrigeratorWidthIn: 36,
      dishwasherSide: "right", skipDishwasher: false, tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      designQuestionDoorStyleId: 390019, designQuestionDoorStyleName: "Aero Solstice",
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: ["glass-uppers", "crown-molding", "dishwasher"], islandOrPeninsula: "island" },
    } as never,
    room, openings: [SINK_WINDOW], baseCatalog: LIVE.base, wallCatalog: LIVE.wall, fillers: LIVE.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(LIVE.wall, LIVE.surround.deepAbove ?? []),
    refrigeratorEndPanels: LIVE.surround.endPanels ?? [], tallCatalog: LIVE.tall, panelCatalog: LIVE.accessory,
    styleId: 390019, makeUid: () => `one-${ceilingHeight}-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return { room, placed: result.placed };
}
const aeroOptions = (room: RoomData, placed: PlacedCabinet[]): OneCheckOptions => ({
  placed, room, openings: [SINK_WINDOW], wallCatalog: LIVE.wall, baseCatalog: LIVE.base, glassUppers: true, islandExpected: true, expectedStyleId: 390019,
});

/**
 * What the check says about this layout on main (864002d), Nov 18 2026, ceiling 108 in and 96 in alike.
 * These are the known layout issues the check is expected to flag; they are NOT fixed here (no layout code
 * changes in this branch). The baseline keeps them from failing the check while any new problem still does.
 */
const KNOWN_170L = [
  "uppers-square-over-bases|upper-edge-off-base-seam|W1230|right|66.75",
  "uppers-square-over-bases|upper-edge-off-base-seam|W2130|top|42",
  "uppers-square-over-bases|upper-edge-off-base-seam|W2730|top|107",
  "corner-filler|corner-filler-vertical|F342|right|167.25",
  "corner-filler|corner-filler-no-reason|F342|right|167.25",
  "one-crown-height|bridge-below-crown-line|W3012|right|36",
  "one-crown-height|bridge-below-crown-line|W361224|right|82",
  "island-aisle|island-missing|-|-|-",
];

describe.each([108, 96])("170 x 170 L Aero Solstice, %i in ceiling", (ceiling) => {
  const { room, placed } = aero170L(ceiling);
  it("runs the whole check on the engine output and returns a per-cabinet list", () => {
    const result = runOneCheck(aeroOptions(room, placed));
    expect(result.checksRun).toEqual(expect.arrayContaining(["bases-present", "glass-stackers", "no-39-where-glass", "uppers-square-over-bases", "no-filler-outside-panel", "corner-filler", "one-door-style", "one-crown-height", "drawer-banks", "island-aisle"]));
    expect(result.cabinetsChecked).toBeGreaterThan(30);
    // The engine's own work passes these checks today: bases complete, glass on every upper, one style, one top, no filler outside a panel.
    const clean = ["bases-present", "glass-stackers", "no-39-where-glass", "no-filler-outside-panel", "one-door-style", "one-crown-height", "drawer-banks"] as const;
    expect(result.problems.filter((p) => (clean as readonly string[]).includes(p.check) && p.severity === "error")).toEqual([]);
  });
  it("does not fail on the known issues, and fails on anything new", () => {
    const result = runOneCheck({ ...aeroOptions(room, placed), baseline: KNOWN_170L });
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    // A new problem on top of the known ones fails.
    const dropped = placed.filter((p) => !(isStacker(p) && p.stackedOnCabinetUid === placed.find((q) => isStacker(q))!.stackedOnCabinetUid));
    const worse = runOneCheck({ ...aeroOptions(room, dropped), baseline: KNOWN_170L });
    expect(worse.ok).toBe(false);
    expect(worse.problems.map((p) => p.code)).toContain("glass-stacker-missing");
  });
  it("flags a 39 in wall cabinet where glass is offered", () => {
    const upperRow = placed.find((p) => p.placement === "wall" && !isStacker(p) && p.height === 30)!;
    const with39 = [...placed, { ...upperRow, uid: "x39", masterCode: "W-39-30", width: 39 } as PlacedCabinet];
    const result = runOneCheck({ ...aeroOptions(room, with39), baseline: KNOWN_170L });
    expect(result.problems.map((p) => p.code)).toContain("wall-39-where-glass");
  });
  it("flags partial glass in a run that cannot be all glass", () => {
    const stackers = placed.filter((p) => isStacker(p));
    const gone = new Set(stackers.slice(0, 1).map((s) => s.uid));
    const result = runOneCheck({ ...aeroOptions(room, placed.filter((p) => !gone.has(p.uid))), baseline: KNOWN_170L });
    expect(result.ok).toBe(false);
  });
});
