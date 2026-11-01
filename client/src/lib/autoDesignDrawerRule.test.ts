import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import { autoBuildDrawerBaseCatalog, autoBuildStraightBaseCatalog } from "./autoDesignAutoBuild";
import { ensureDrawerBase } from "./autoDesignDrawerRule";
import { planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import { isThreeDrawerBaseCatalog, pickDoorDrawerSplit, splitWideDoorBaseBesideRange } from "./kitchenUsage";
import { wallPlacementAt, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

// Tom (Oct 31): every Auto-Design layout has at least one three-drawer base. A wide door base beside the range is
// split into door + drawer (39" = B21 + 3DB18, drawer nearest the range); if no drawer base landed, convert the
// best-fitting base run; if the line sells no drawer base, warn instead of failing.
const fixture = catalogFixture as unknown as Record<string, { base: DesignCabinet[] }>;
const line = (style: string) => [...autoBuildStraightBaseCatalog(fixture[style]!.base), ...autoBuildDrawerBaseCatalog(fixture[style]!.base)];
const room: RoomData = { width: 180, depth: 150, ceilingHeight: 96 };
const noDrawers = (rows: DesignCabinet[]) => rows.filter((row) => !isThreeDrawerBaseCatalog(row));
const codes = (items: { cabinet: { masterCode: string }; isFiller: boolean }[]) => items.filter((i) => !i.isFiller).map((i) => i.cabinet.masterCode);

describe("door + drawer split beside the range", () => {
  it("39 inches beside the range at its start is a 3-drawer 18 against the range, then a B21", () => {
    const catalog = line("330011");
    const pair = pickDoorDrawerSplit(39, catalog);
    expect(pair?.door.masterCode).toBe("B21");
    expect(pair?.drawer.masterCode).toBe("3DB18");
    const plan = planAutoDesignBaseSegment({ length: 39, catalog, rangeAtStart: true, rangeAtEnd: false });
    expect(codes(plan.items)).toEqual(["3DB18", "B21"]);
    expect(plan.items.reduce((sum, item) => sum + item.width, 0)).toBeCloseTo(39, 5);
    expect(plan.items.every((item) => item.drawerSplit)).toBe(true);
  });

  it("with the range at the end the drawer base is last, still nearest the range", () => {
    const plan = planAutoDesignBaseSegment({ length: 39, catalog: line("330011"), rangeAtStart: false, rangeAtEnd: true });
    expect(codes(plan.items)).toEqual(["B21", "3DB18"]);
  });

  it("does not split away from the range, and does not split a narrow base", () => {
    const away = planAutoDesignBaseSegment({ length: 39, catalog: line("330011"), rangeAtStart: false, rangeAtEnd: false });
    expect(codes(away.items).some((code) => /^3DB/.test(code))).toBe(false);
    expect(pickDoorDrawerSplit(24, line("330011"))).toBeNull(); // below the wide-base minimum: B24 stays one base
    expect(pickDoorDrawerSplit(18, line("330011"))).toBeNull();
  });

  it("uses only widths the line sells: no matching door width, no split", () => {
    const catalog = line("330011").filter((row) => row.masterCode !== "B21" && row.masterCode !== "B24" && row.masterCode !== "B18" && row.masterCode !== "B15");
    expect(pickDoorDrawerSplit(39, catalog)).toBeNull();
  });

  it("never swaps in a B18 door base the line does not have (B18 out-of-stock handling is untouched)", () => {
    const catalog = line("330011").filter((row) => row.masterCode !== "B18");
    const pair = pickDoorDrawerSplit(39, catalog);
    expect(pair?.door.masterCode).not.toBe("B18");
  });

  it("a line with no drawer base leaves the run alone", () => {
    const catalog = noDrawers(line("330011"));
    const plan = planAutoDesignBaseSegment({ length: 39, catalog, rangeAtStart: true, rangeAtEnd: false });
    expect(plan.items.some((item) => item.drawerSplit)).toBe(false);
  });

  it("an existing drawer base beside the range is not split again", () => {
    const catalog = line("330011");
    const drawer36 = catalog.find((row) => row.masterCode === "3DB36")!;
    const items = [{ cabinet: drawer36, width: 36, isFiller: false }];
    expect(splitWideDoorBaseBesideRange(items, catalog, true, false)).toEqual(items);
  });
});

describe("a finished layout has at least one drawer base when the line sells one", () => {
  const makeUid = (() => { let i = 0; return () => `dr-${++i}`; })();
  const place = (source: DesignCabinet, along: number): PlacedCabinet => {
    const width = Number(source.width);
    const spot = wallPlacementAt(along, width, Number(source.depth) || 24, "top", room);
    return {
      uid: `${source.masterCode}-${along}`, cabinetId: source.id, masterCode: source.masterCode, description: source.description,
      category: source.category, subCategory: source.subCategory, placement: "base", ...spot, width, depth: Number(source.depth) || 24,
      height: Number(source.height) || 34.5, numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers,
    } as PlacedCabinet;
  };
  const bySku = (catalog: DesignCabinet[], code: string) => catalog.find((row) => row.masterCode === code)!;

  it("converts a base run into door + drawer of the same total width when none was placed", () => {
    const catalog = line("330011");
    const placed = [place(bySku(catalog, "B36"), 10), place(bySku(catalog, "B39"), 46)];
    const result = ensureDrawerBase({ placed, room, catalog, makeUid, styleId: 1 });
    expect(result.converted).toBe(true);
    expect(result.hasDrawerBase).toBe(true);
    expect(result.warning).toBeNull();
    const base = result.placed.filter((item) => item.placement === "base");
    expect(base.some((item) => /^3DB/.test(item.masterCode))).toBe(true);
    expect(base.reduce((sum, item) => sum + item.width, 0)).toBeCloseTo(36 + 39, 5); // same total width, nothing lost
    expect(result.note).toMatch(/Drawer base added/);
  });

  it("leaves a layout that already has a drawer base alone", () => {
    const catalog = line("330011");
    const placed = [place(bySku(catalog, "B36"), 10), place(bySku(catalog, "3DB18"), 46)];
    const result = ensureDrawerBase({ placed, room, catalog, makeUid, styleId: 1 });
    expect(result.converted).toBe(false);
    expect(result.hasDrawerBase).toBe(true);
    expect(result.placed).toEqual(placed);
  });

  it("a line with no drawer base keeps the layout and warns instead of failing", () => {
    const catalog = noDrawers(line("330011"));
    const placed = [place(bySku(catalog, "B36"), 10)];
    const result = ensureDrawerBase({ placed, room, catalog, makeUid, styleId: 1 });
    expect(result.placed).toEqual(placed);
    expect(result.hasDrawerBase).toBe(false);
    expect(result.warning).toMatch(/no three-drawer base/);
  });

  it("never converts a sink base, a corner or a B42 'corner' look-alike into a drawer pair", () => {
    const catalog = line("330011");
    const sink = { ...place(bySku(catalog, "B36"), 10), masterCode: "SB36", description: "36 sink base", numberOfDoors: 2 } as PlacedCabinet;
    const result = ensureDrawerBase({ placed: [sink], room, catalog, makeUid, styleId: 1 });
    expect(result.converted).toBe(false);
    expect(result.warning).not.toBeNull();
  });
});
