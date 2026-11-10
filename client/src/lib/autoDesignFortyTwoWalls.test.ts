/**
 * A 42" Auto Design uses 42" wall stock for every upper, including the cabinet
 * above the microwave. The cabinet above the refrigerator, and a hood or
 * bridge over a range that has no microwave, stay at their current heights.
 */
import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "@/lib/autoDesignLayout";
import { buildAutoDesignWallCabinets, enforceFortyTwoWallCabinets } from "@/lib/autoDesignWallCabinets";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import { wallPlacementAt, type DesignCabinet, type PlacedCabinet, type RoomData } from "@/lib/design";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const pack = (matrixCatalog as unknown as Record<string, Pack>)["330002"]!;

const ROOM: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

function wall(id: number, code: string, width: number, height: number, doors = 2): DesignCabinet {
  return {
    id, masterCode: code, description: `${code} wall`, category: "Wall", subCategory: "Wall",
    width: String(width), height: String(height), depth: "12", placement: "wall",
    numberOfDoors: doors, numberOfDrawers: 0,
  } as DesignCabinet;
}

function baseAt(code: string, width: number, along: number): PlacedCabinet {
  const spot = wallPlacementAt(along, width, 24, "top", ROOM)!;
  return {
    uid: code, cabinetId: 1, masterCode: code, description: code, category: "Base", placement: "base",
    ...spot, width, depth: 24, height: 34.5, rotation: spot.rotation,
  } as PlacedCabinet;
}

describe("42 inch wall cabinets", () => {
  it("uses a 42 inch SKU at the same width, and the closest 42 inch width within 3 inches when that width is not sold", () => {
    const base = baseAt("B33", 33, 0);
    const catalog = [
      wall(1, "W3330", 33, 30),
      wall(2, "W3042", 30, 42),
      wall(3, "W3642", 36, 42),
    ];
    const result = buildAutoDesignWallCabinets({
      placed: [base],
      room: ROOM,
      openings: [],
      catalog,
      wallCabinetHeightIn: 42,
      styleId: 7,
      makeUid: (() => { let n = 0; return () => `u-${++n}`; })(),
      closeSeams: false,
    });
    const uppers = result.additions.filter((item) => item.placement === "wall" && !item.fillerPieceGroupId);
    expect(uppers.length).toBeGreaterThan(0);
    expect(uppers.every((item) => item.height === 42)).toBe(true);
    expect(uppers.some((item) => item.masterCode === "W3330")).toBe(false);
    expect(result.substitutions.some((note) => note.includes("W3042") && note.includes("33"))).toBe(true);
  });

  it("seats the 42 inch diagonal corner, not the 30 inch one", () => {
    const corner = {
      ...baseAt("DCB36", 36, 0),
      description: "Diagonal corner base",
      cornerType: "diagonal",
      isCornerCabinet: true,
    } as PlacedCabinet;
    const catalog = [
      wall(1, "DCW2430", 24, 30),
      wall(2, "DCW2442", 24, 42),
      wall(3, "W1242", 12, 42, 1),
      wall(4, "W1230", 12, 30, 1),
    ];
    for (const row of catalog) {
      if (row.masterCode.startsWith("DCW")) {
        row.isCornerCabinet = true;
        row.cornerType = "diagonal";
        row.description = "24 inch Diagonal Corner Wall Cabinet";
        row.depth = "24";
      }
    }
    corner.description = "36 inch Diagonal Corner Base";
    corner.isCornerCabinet = true;
    corner.cornerType = "diagonal";
    const result = buildAutoDesignWallCabinets({
      placed: [corner],
      room: ROOM,
      openings: [],
      catalog,
      wallCabinetHeightIn: 42,
      styleId: 7,
      makeUid: (() => { let n = 0; return () => `c-${++n}`; })(),
      corners: [{ base: corner, point: { x: 0, y: 0, firstWallId: "top" } }],
    });
    expect(result.additions.some((item) => item.masterCode === "DCW2442")).toBe(true);
    expect(result.additions.some((item) => item.masterCode === "DCW2430" || item.masterCode === "W1230")).toBe(false);
  });

  it("makes the cabinet above the microwave 42 inches and leaves the refrigerator cap", () => {
    const bridge = {
      ...baseAt("W3024", 30, 40),
      placement: "wall" as const,
      depth: 12,
      height: 24,
      mountBottom: 72,
      overRangeMicrowaveBridge: true,
    };
    const range = {
      ...baseAt("RANGE-30", 30, 40),
      placement: "appliance" as const,
      height: 36,
      mountBottom: 0,
      description: "Range",
    };
    const microwave = {
      ...baseAt("MW-30", 30, 40),
      placement: "appliance" as const,
      depth: 18,
      height: 18,
      mountBottom: 54,
      description: "Microwave",
    };
    const cap = {
      ...baseAt("W362424", 36, 0),
      placement: "wall" as const,
      depth: 24,
      height: 24,
      mountBottom: 72,
      refrigeratorAssemblyRole: "bridge" as const,
      refrigeratorAssemblyId: "fridge",
    };
    const short = {
      ...baseAt("W3030", 30, 80),
      placement: "wall" as const,
      depth: 12,
      height: 30,
      mountBottom: 54,
    };
    const result = enforceFortyTwoWallCabinets({
      placed: [range, microwave, bridge, cap, short],
      catalog: [wall(2, "W3042", 30, 42), wall(9, "W3024", 30, 24), wall(8, "W362424", 36, 24)],
      nominalIn: 42,
      room: ROOM,
    });
    const overMicrowave = result.placed.find((item) => item.uid === bridge.uid);
    expect(overMicrowave?.masterCode).toBe("W3042");
    expect(overMicrowave?.height).toBe(42);
    expect(overMicrowave?.overRangeMicrowaveBridge).toBe(false);
    expect(result.placed.find((item) => item.uid === microwave.uid)?.mountBottom).toBe(54);
    expect(result.placed.find((item) => item.refrigeratorAssemblyRole === "bridge")?.height).toBe(24);
    expect(result.notes.some((note) => note.includes("18") && /range/i.test(note))).toBe(true);
    expect(result.placed.find((item) => item.uid === short.uid)?.masterCode).toBe("W3042");
    const bridgeOnly = enforceFortyTwoWallCabinets({
      placed: [range, bridge, cap],
      catalog: [wall(2, "W3042", 30, 42), wall(9, "W3024", 30, 24), wall(8, "W362424", 36, 24)],
      nominalIn: 42,
      room: ROOM,
    });
    expect(bridgeOnly.placed.find((item) => item.uid === bridge.uid)?.masterCode).toBe("W3024");
    expect(bridgeOnly.placed.find((item) => item.uid === bridge.uid)?.height).toBe(24);
  });
});

describe("a measured 42 inch kitchen", () => {
  it("keeps every ordinary upper at 42 and leaves the microwave, refrigerator, and range pieces", () => {
    let uid = 0;
    const run = runAutoDesignLayout({
      input: {
        layoutType: "l-shape",
        originCorner: "left",
        runDirection: "right",
        wallCabinetHeightIn: 42,
        sink: { wallLabel: "Wall 2", centerOffsetIn: 72 },
        sinkBaseWidthIn: 36,
        sinkBaseKind: "regular",
        stove: { wallLabel: "Wall 1", centerOffsetIn: 44 },
        dishwasher: null,
        dishwasherSide: "right",
        refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 112 },
        refrigeratorWidthIn: 36,
        refrigeratorPanels: "both",
        refrigeratorEnclosure: "cabinet-above",
        overRangeAnswer: "microwave-bridge",
        kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      } as AutoDesignInputs,
      room: ROOM,
      openings: [],
      baseCatalog: pack.base,
      wallCatalog: pack.wall,
      fillers: pack.accessory,
      appliancePalette: [
        appliance("RANGE-30", 30, 25, 36),
        appliance("DW-24", 24, 24, 34.5),
        appliance("FRIDGE-36", 36, 30, 70),
        appliance("MW-30", 30, 18, 18),
        appliance("HOOD-30", 30, 18, 18),
      ],
      refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, []),
      refrigeratorEndPanels: pack.surround?.endPanels ?? [],
      styleId: 330002,
      makeUid: () => `h42-${++uid}`,
    });
    if (!run.ok) throw new Error(run.message);

    const walls = run.placed.filter((item) => item.placement === "wall" && !item.fillerPieceGroupId);
    const exceptions = walls.filter((item) => item.overRangeMicrowaveBridge === true
      || item.refrigeratorAssemblyRole === "bridge"
      || /hood/i.test(`${item.masterCode} ${item.description ?? ""}`));
    const ordinary = walls.filter((item) => !exceptions.includes(item));
    expect(ordinary.length).toBeGreaterThan(5);
    for (const item of ordinary) {
      expect(item.height, item.masterCode).toBeCloseTo(42, 1);
    }
    const overMicrowave = walls.find((item) => item.masterCode.replace(/[^A-Z0-9]/g, "") === "W3042"
      && Math.abs((item.wallOffset ?? 0) - 44 + 15) < 20);
    const microwave = run.placed.find((item) => /^MW-/i.test(item.masterCode));
    const range = run.placed.find((item) => /RANGE/i.test(item.masterCode));
    const rangeTop = (Number(range?.mountBottom) || 0) + (Number(range?.height) || 0);
    const microwaveBottom = Number(microwave?.mountBottom) || 0;
    expect(overMicrowave?.height).toBeCloseTo(42, 1);
    expect(microwaveBottom - rangeTop).toBeCloseTo(18, 1);
    const fridgeCap = walls.find((item) => item.refrigeratorAssemblyRole === "bridge");
    expect(fridgeCap?.height).toBeLessThan(42);
    expect(fridgeCap?.masterCode).toMatch(/W36/);
    const singleDoor = ordinary.filter((item) => (item.numberOfDoors ?? 0) === 1);
    for (const item of singleDoor) {
      expect(item.width).toBeLessThanOrEqual(21);
    }
    expect(ordinary.some((item) => Math.abs(item.width - 24) <= 0.05 && (item.numberOfDoors ?? 0) === 1)).toBe(false);
  });
});
