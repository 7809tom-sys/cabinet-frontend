import { describe, expect, it } from "vitest";
import { wallPlacementAt, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";
import { buildMandatoryFourAnchorRefrigeratorBay } from "./fourAnchorRefrigeratorBay";
import catalogFixture from "./__fixtures__/fourAnchorRealCatalog.json";

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

describe("mandatory Four-anchor refrigerator bay", () => {
  it("creates exactly two source-priced panels and a matching 36-inch cabinet above with no filler", () => {
    const result = buildMandatoryFourAnchorRefrigeratorBay({
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
    const result = buildMandatoryFourAnchorRefrigeratorBay({
      refrigerator: refrigerator(),
      room,
      caps: [source({ id: 200, masterCode: "W3624", width: "36", height: "24", depth: "24" })],
      // This real S2496 sheet-panel representation stores its 24-inch installed
      // depth in width and its 3/4-inch thickness in depth. The Four-anchor bay
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

  it("rejects a Four-anchor refrigerator width other than the mandatory 36-inch bay", () => {
    const result = buildMandatoryFourAnchorRefrigeratorBay({
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

describe("Four-anchor refrigerator cabinet above: always the 24-inch-deep refrigerator box", () => {
  const panel = () => source({ id: 201, masterCode: "REP2496", category: "Panel", subCategory: "Refrigerator End Panel", width: "0.75", height: "96", depth: "24", placement: "tall", numberOfDoors: 0 });
  const build = (caps: DesignCabinet[]) => buildMandatoryFourAnchorRefrigeratorBay({
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
  it("refuses with a plain message instead of silently using a 12-inch-deep box", () => {
    const result = build([source({ id: 1, masterCode: "W3612", width: "36", height: "12", depth: "12" })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/24-inch-deep/i);
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

