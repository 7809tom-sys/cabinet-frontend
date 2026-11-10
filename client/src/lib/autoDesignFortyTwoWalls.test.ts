/**
 * A 42" Auto Design uses 42" wall stock for every ordinary upper. The cabinet
 * above the microwave stays the 24" bridge (bottom at 72"). The refrigerator
 * cap and a hood stay at their own heights.
 */
import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "@/lib/autoDesignLayout";
import { widerSkuClosing } from "@/lib/autoDesignFillerConsolidation";
import { planRealCabinetFixes } from "@/lib/autoDesignRealCabinets";
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
  it("does not take the 30 inch W2130 and W2430 just because they are listed first", () => {
    const catalog = [
      wall(1, "W2130", 21, 30, 1),
      wall(2, "W2142", 21, 42, 1),
      wall(3, "W2430", 24, 30, 2),
      wall(4, "W2430S", 24, 30, 1),
      wall(5, "W2442", 24, 42, 2),
    ];
    const gap = planRealCabinetFixes({
      gapIn: 21,
      catalog,
      neighbors: [],
      room: ROOM,
      wallId: "top",
      layer: "wall",
      preferHeightIn: 42,
    });
    expect(gap[0]).toMatchObject({ kind: "seat", cabinet: expect.objectContaining({ masterCode: "W2142" }) });

    const twentyOne = {
      ...baseAt("W2142", 21, 0),
      placement: "wall" as const,
      depth: 12,
      height: 42,
      mountBottom: 54,
      numberOfDoors: 1,
    };
    const grown = widerSkuClosing({
      cabinet: twentyOne,
      extraIn: 3,
      layer: "wall",
      catalog,
      preferHeightIn: 42,
    });
    expect(grown?.replacement.masterCode).toBe("W2442");
    expect(grown?.replacement.numberOfDoors).toBe(2);
    expect(grown?.replacement.masterCode).not.toBe("W2430");
    expect(grown?.replacement.masterCode).not.toBe("W2430S");
  });

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

  it("places W2142 and two-door W2442 over a 21 inch base, a 24 inch base, and the dishwasher beside a window", () => {
    const result = buildAutoDesignWallCabinets({
      placed: [
        baseAt("B21", 21, 0),
        baseAt("B24", 24, 21),
        { ...baseAt("DW-24", 24, 45), placement: "appliance", description: "Dishwasher" },
      ],
      room: ROOM,
      openings: [{ uid: "win", kind: "window", label: "Window", side: "top", offset: 70, width: 30, height: 36, sill: 42 }],
      catalog: pack.wall,
      wallCabinetHeightIn: 42,
      styleId: 7,
      makeUid: (() => { let n = 0; return () => `win-${++n}`; })(),
      closeSeams: true,
    });
    const codes = result.additions.map((item) => item.masterCode);
    expect(codes).toContain("W2142");
    expect(codes).toContain("W2442");
    expect(codes).not.toContain("W2130");
    expect(codes).not.toContain("W2430");
    const twoDoor = result.additions.find((item) => item.masterCode === "W2442");
    expect(twoDoor?.numberOfDoors).toBe(2);
    expect(twoDoor?.height).toBe(42);
  });

  it("keeps the 24 inch bridge above the microwave and leaves the refrigerator cap", () => {
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
    const microwaveAfter = result.placed.find((item) => item.uid === microwave.uid);
    expect(overMicrowave?.masterCode).toBe("W3024");
    expect(overMicrowave?.height).toBe(24);
    expect(overMicrowave?.mountBottom).toBe(72);
    expect(overMicrowave?.overRangeMicrowaveBridge).toBe(true);
    expect(microwaveAfter?.mountBottom).toBe(54);
    expect((microwaveAfter?.mountBottom ?? 0) + (microwaveAfter?.height ?? 0)).toBeLessThanOrEqual((overMicrowave?.mountBottom ?? 0) + 0.05);
    expect(result.placed.find((item) => item.refrigeratorAssemblyRole === "bridge")?.height).toBe(24);
    expect(result.placed.find((item) => item.uid === short.uid)?.masterCode).toBe("W3042");
  });

  it("leaves the cabinet above a fridge, range, or hood alone and still raises the one above a dishwasher", () => {
    const fridge = { ...baseAt("FRIDGE-36", 36, 0), placement: "appliance" as const, depth: 30, height: 70, description: "Refrigerator" };
    const overFridge = {
      ...baseAt("W362424", 36, 0), placement: "wall" as const, depth: 24, height: 24, mountBottom: 72,
    };
    const hood = { ...baseAt("HOOD-30", 30, 40), placement: "appliance" as const, depth: 18, height: 18, mountBottom: 66, description: "Range hood" };
    const overHood = {
      ...baseAt("W3012", 30, 40), placement: "wall" as const, depth: 12, height: 12, mountBottom: 84,
    };
    const range = { ...baseAt("RANGE-30", 30, 76), placement: "appliance" as const, height: 36, mountBottom: 0, description: "Range" };
    const overRange = {
      ...baseAt("W3018", 30, 76), placement: "wall" as const, depth: 12, height: 18, mountBottom: 72,
    };
    const dishwasher = { ...baseAt("DW-24", 24, 112), placement: "appliance" as const, height: 34.5, description: "Dishwasher" };
    const overDishwasher = {
      ...baseAt("W2430", 24, 112), placement: "wall" as const, depth: 12, height: 30, mountBottom: 54, numberOfDoors: 2,
    };
    const result = enforceFortyTwoWallCabinets({
      placed: [fridge, overFridge, hood, overHood, range, overRange, dishwasher, overDishwasher],
      catalog: [wall(1, "W3042", 30, 42), wall(2, "W2442", 24, 42, 2), wall(3, "W362424", 36, 24), wall(4, "W2430", 24, 30, 2)],
      nominalIn: 42,
      room: ROOM,
    });
    expect(result.placed.find((item) => item.uid === overFridge.uid)?.masterCode).toBe("W362424");
    expect(result.placed.find((item) => item.uid === overFridge.uid)?.height).toBe(24);
    expect(result.placed.find((item) => item.uid === overHood.uid)?.masterCode).toBe("W3012");
    expect(result.placed.find((item) => item.uid === overHood.uid)?.height).toBe(12);
    expect(result.placed.find((item) => item.uid === overRange.uid)?.masterCode).toBe("W3018");
    expect(result.placed.find((item) => item.uid === overRange.uid)?.height).toBe(18);
    const aboveDishwasher = result.placed.find((item) => item.uid === overDishwasher.uid);
    expect(aboveDishwasher?.masterCode).toBe("W2442");
    expect(aboveDishwasher?.height).toBe(42);
    expect(aboveDishwasher?.numberOfDoors).toBe(2);
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
    const overMicrowave = walls.find((item) => item.overRangeMicrowaveBridge === true);
    const microwave = run.placed.find((item) => /^MW-/i.test(item.masterCode));
    expect(overMicrowave?.masterCode.replace(/[^A-Z0-9]/g, "")).toMatch(/^W3024$/);
    expect(overMicrowave?.height).toBeCloseTo(24, 1);
    expect(overMicrowave?.mountBottom).toBeCloseTo(72, 1);
    const microwaveTop = (Number(microwave?.mountBottom) || 0) + (Number(microwave?.height) || 0);
    const bridgeBottom = Number(overMicrowave?.mountBottom) || 0;
    const bridgeTop = bridgeBottom + (Number(overMicrowave?.height) || 0);
    expect(microwaveTop).toBeLessThanOrEqual(bridgeBottom + 0.05);
    expect(bridgeTop).toBeCloseTo(96, 1);
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
