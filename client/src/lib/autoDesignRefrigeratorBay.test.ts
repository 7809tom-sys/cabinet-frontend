import { describe, expect, it } from "vitest";
import { wallPlacementAt, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";
import { buildMandatoryAutoDesignRefrigeratorBay } from "./autoDesignRefrigeratorBay";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function source(overrides: Partial<DesignCabinet>): DesignCabinet {
  return {
    id: 1,
    masterCode: "W3624",
    description: "36 inch Refrigerator Wall Cabinet",
    category: "Wall",
    subCategory: "Refrigerator Cabinet",
    width: "36",
    height: "24",
    depth: "24",
    placement: "wall",
    numberOfDoors: 2,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    ...overrides,
  };
}

function refrigerator(): PlacedCabinet {
  const spot = wallPlacementAt(48, 36, 30, "top", room);
  return {
    uid: "fridge-36",
    cabinetId: 100,
    masterCode: "FRIDGE-36",
    description: '36″ Refrigerator',
    category: "Appliance",
    subCategory: "Refrigerator",
    placement: "appliance",
    applianceRole: "base-height",
    ...spot,
    width: 36,
    depth: 30,
    height: 70,
    rotation: spot.rotation,
  };
}

describe("mandatory Auto-Design refrigerator bay", () => {
  it("creates exactly two source-priced panels and a matching 36-inch cabinet above with no filler", () => {
    const result = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: refrigerator(),
      room,
      caps: [source({ id: 200, masterCode: "W3624", width: "36", height: "24", depth: "24" })],
      endPanels: [source({ id: 201, masterCode: "REP2496", description: "Refrigerator End Panel", category: "Panel", subCategory: "Refrigerator End Panel", width: "0.75", height: "96", depth: "24", placement: "tall", numberOfDoors: 0 })],
      styleId: 9,
      makeUid: (() => { let index = 0; return () => `bay-${++index}`; })(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.additions.map((item) => item.refrigeratorAssemblyRole)).toEqual(["bridge", "left-panel", "right-panel"]);
    expect(result.additions.map((item) => item.masterCode)).toEqual(["W3624", "REP2496", "REP2496"]);
    expect(result.additions.some((item) => /filler/i.test(item.masterCode) || /filler/i.test(item.refrigeratorAssemblyRole ?? ""))).toBe(false);
    expect(result.reservation).toMatchObject({ wall: "top", start: 46.75, end: 85.25 });
  });

  it("uses a source-priced sheet panel when the catalog stores its thin face in depth", () => {
    const result = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: refrigerator(),
      room,
      caps: [source({ id: 200, masterCode: "W3624", width: "36", height: "24", depth: "24" })],
      // This real S2496 sheet-panel representation stores its 24-inch installed
      // depth in width and its 3/4-inch thickness in depth. The Auto-Design bay
      // must not call the exact source-priced panel missing.
      endPanels: [source({ id: 201, masterCode: "S2496", description: "Tall Panel — 24 in. W × 96 in. H × 3/4 in. D", category: "Tall", subCategory: "Tall Panels", width: "24", height: "96", depth: "0.75", placement: "tall", numberOfDoors: 0 })],
      styleId: 9,
      makeUid: (() => { let index = 0; return () => `sheet-panel-${++index}`; })(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const panels = result.additions.filter((item) => item.refrigeratorAssemblyRole?.endsWith("panel"));
    expect(panels).toHaveLength(2);
    expect(panels).toEqual(expect.arrayContaining([
      expect.objectContaining({ masterCode: "S2496", width: 0.75, depth: 24 }),
    ]));
  });

  it("cuts a 30 inch refrigerator end panel to a shallower 24 inch refrigerator and remembers the stock depth", () => {
    const result = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: { ...refrigerator(), depth: 24 },
      room,
      caps: [source({ id: 200 })],
      endPanels: [source({ id: 201, masterCode: "REPV3096", description: "Refrigerator End Panel", category: "Panel", subCategory: "Refrigerator End Panel", width: "0.75", height: "96", depth: "30", placement: "tall", numberOfDoors: 0 })],
      styleId: 9,
      makeUid: (() => { let index = 0; return () => `cut-panel-${++index}`; })(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const panels = result.additions.filter((item) => item.refrigeratorAssemblyRole?.endsWith("panel"));
    expect(panels).toEqual([
      expect.objectContaining({ masterCode: "REPV3096", depth: 24, refrigeratorPanelStockDepth: 30 }),
      expect.objectContaining({ masterCode: "REPV3096", depth: 24, refrigeratorPanelStockDepth: 30 }),
    ]);
  });

  it("rejects an Auto-Design refrigerator width other than the mandatory 36-inch bay", () => {
    const result = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: { ...refrigerator(), masterCode: "FRIDGE-33", width: 33 },
      room,
      caps: [source({ id: 200 })],
      endPanels: [source({ id: 201, masterCode: "REP2496", category: "Panel", subCategory: "Refrigerator End Panel", width: "0.75", height: "96", depth: "24", placement: "tall", numberOfDoors: 0 })],
      styleId: 9,
      makeUid: () => "unused",
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("36") });
  });
});

describe("Auto-Design refrigerator cabinet above: always the 24-inch-deep refrigerator box", () => {
  const panel = () => source({ id: 201, masterCode: "REP2496", category: "Panel", subCategory: "Refrigerator End Panel", width: "0.75", height: "96", depth: "24", placement: "tall", numberOfDoors: 0 });
  const build = (caps: DesignCabinet[]) => buildMandatoryAutoDesignRefrigeratorBay({
    refrigerator: refrigerator(), room, caps, endPanels: [panel()], styleId: 9, makeUid: (() => { let index = 0; return () => `cap-${++index}`; })(),
  });
  it("never picks a 12-inch-deep 36-inch wall cabinet even when it is listed first", () => {
    // Real catalog order: the ordinary 12-deep W3612 comes before W361224.
    const shallow = source({ id: 1, masterCode: "W3612", description: "36 x 12 x 12 Wall Cabinet", subCategory: "Wall Cabinet", width: "36", height: "12", depth: "12" });
    const deep = source({ id: 2, masterCode: "W361224", width: "36", height: "12", depth: "24" });
    const result = build([shallow, deep]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cap = result.additions[0];
    expect(cap.masterCode).toBe("W361224");
    expect(cap.depth).toBe(24);
  });
  it("falls back to a 12-inch-deep bridge when the line has no 24-inch-deep box and notes the swap", () => {
    const result = build([source({ id: 1, masterCode: "W3612", description: "36 x 12 Wall", width: "36", height: "12", depth: "12" })]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.additions[0].masterCode).toBe("W3612");
    expect(result.additions[0].depth).toBe(12);
    expect(result.additions[0].fieldModificationNote).toContain('Over-fridge 36x24 not in line; used W3612 (12" H)');
    expect(result.additions[0].fieldModificationNote).toContain("pulled forward flush");
    expect(result.additions[0].depthPositionAdjusted).toBe(true);
    expect(result.notes[0]).toBe('Over-fridge 36x24 not in line; used W3612 (12" H)');
  });
  it("refuses with a plain message when the line has no bridge under 30 inches", () => {
    const result = build([source({ id: 1, masterCode: "W363024", width: "36", height: "30", depth: "24" })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/24-inch-deep/i);
    expect(result.message).toMatch(/under 30/i);
  });
  it("chooses the height that tops out at the wall-cabinet line (54 + 30 = 84), not the first row", () => {
    // Fridge top 70 + 2 clearance = 72, so a 12-inch box reaches 84 exactly.
    const caps = [
      source({ id: 3, masterCode: "W362424", width: "36", height: "24", depth: "24" }),
      source({ id: 4, masterCode: "W361224", width: "36", height: "12", depth: "24" }),
      source({ id: 5, masterCode: "W361824", width: "36", height: "18", depth: "24" }),
    ];
    const result = build(caps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.additions[0].masterCode).toBe("W361224");
    expect(result.additions[0].mountBottom! + result.additions[0].height).toBeCloseTo(84, 1);
  });
  it("pairs a frameless 40.25-inch wall with W362324 and does not take a shallower or shorter box", () => {
    const caps = [
      source({ id: 11, masterCode: "W3623", width: "36", height: "22.625", depth: "13.5" }),
      source({ id: 12, masterCode: "W361824", width: "36", height: "17.625", depth: "24" }),
      source({ id: 13, masterCode: "W362324", width: "36", height: "22.63", depth: "24" }),
      source({ id: 14, masterCode: "W362424", width: "36", height: "24", depth: "24" }),
    ];
    const result = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: refrigerator(), room, caps, endPanels: [panel()], styleId: 9,
      makeUid: () => "forty", wallCabinetHeightIn: 40.25,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.additions[0].masterCode).toBe("W362324");
    expect(result.additions[0].depth).toBe(24);
  });

  it("uses the tallest under-30 bridge when the frameless 22.625 by 24-inch cap is missing", () => {
    const result = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: refrigerator(), room,
      caps: [
        source({ id: 15, masterCode: "W361824", width: "36", height: "18", depth: "24" }),
        source({ id: 19, masterCode: "W363024", width: "36", height: "30", depth: "24" }),
        source({ id: 20, masterCode: "W362275", width: "36", height: "22.75", depth: "13.5" }),
      ],
      endPanels: [panel()], styleId: 9, makeUid: () => "missing", wallCabinetHeightIn: 40,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.additions[0].masterCode).toBe("W361824");
    expect(result.additions[0].fieldModificationNote).toBe('Over-fridge 36x24 not in line; used W361824 (18" H)');
  });

  it("treats a framed 40 inch wall as a wall-line match, not the frameless 22.625 box", () => {
    const caps = [
      source({ id: 17, masterCode: "W362424", width: "36", height: "24", depth: "24" }),
      source({ id: 18, masterCode: "W362275", width: "36", height: "22.75", depth: "24" }),
    ];
    const result = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: refrigerator(), room, caps, endPanels: [panel()], styleId: 9,
      makeUid: () => "framed-forty", wallCabinetHeightIn: 40, framelessLine: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Wall line is 94. The 22.75 box tops at 94.75, closer than 24 at 96 or 22.625 at 94.625.
    expect(result.additions[0].masterCode).toBe("W362275");
    expect(result.notes).toEqual([]);
  });

  it("keeps a framed 42-inch wall on the 24-inch cap", () => {
    const caps = [
      source({ id: 16, masterCode: "W362324", width: "36", height: "22.625", depth: "24" }),
      source({ id: 17, masterCode: "W362424", width: "36", height: "24", depth: "24" }),
    ];
    const result = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: refrigerator(), room, caps, endPanels: [panel()], styleId: 9,
      makeUid: () => "framed", wallCabinetHeightIn: 42,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.additions[0].masterCode).toBe("W362424");
  });

  it("keeps the wall-line 36 by 24 box when one exists and does not note a substitution", () => {
    const caps = [
      source({ id: 21, masterCode: "W301824", width: "30", height: "18", depth: "24" }),
      source({ id: 22, masterCode: "W362275", width: "36", height: "22.75", depth: "24" }),
      source({ id: 23, masterCode: "W361824", width: "36", height: "18", depth: "24" }),
      source({ id: 24, masterCode: "W363024", width: "36", height: "30", depth: "24" }),
      source({ id: 25, masterCode: "W3623", width: "36", height: "22.75", depth: "12" }),
    ];
    const result = build(caps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Fridge top 72, wall line 84. The 18 inch box lands at 90, closer than 22.75 at 94.75.
    expect(result.additions[0].masterCode).toBe("W361824");
    expect(result.notes).toEqual([]);
    expect(result.additions[0].fieldModificationNote).toBeUndefined();
  });

  it("when no 24-inch-deep box exists, the fallback keeps 36 inch width, then the closest depth, and the tallest under 30", () => {
    const caps = [
      source({ id: 31, masterCode: "W332275", width: "33", height: "22.75", depth: "24" }),
      source({ id: 32, masterCode: "W3612", width: "36", height: "12", depth: "12" }),
      source({ id: 33, masterCode: "W362275S", width: "36", height: "22.75", depth: "13.5" }),
      source({ id: 34, masterCode: "W3636", width: "36", height: "36", depth: "13.5" }),
    ];
    const result = build(caps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.additions[0].masterCode).toBe("W362275S");
    expect(result.additions[0].fieldModificationNote).toContain("W362275S");
    expect(result.additions[0].fieldModificationNote).toContain('22.75" H');
    expect(result.additions[0].depthPositionAdjusted).toBe(true);
  });

  it("on the real framed and frameless catalogs the cap is the 24-inch-deep refrigerator cabinet", () => {
    for (const style of ["330011", "540005"] as const) {
      const wall = (catalogFixture as unknown as Record<string, { wall: DesignCabinet[] }>)[style]!.wall;
      const caps = wall.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 12 && /refrigerator|W36\d{2}24$|^WR36/i.test(`${row.masterCode} ${row.description}`) || (Number(row.width) === 36 && Number(row.depth) <= 13));
      const result = build(caps);
      expect(result.ok, style).toBe(true);
      if (!result.ok) continue;
      expect(result.additions[0].depth, style).toBe(24);
      expect(result.additions[0].masterCode, style).toMatch(/24$|^WR36/);
    }
  });
});

