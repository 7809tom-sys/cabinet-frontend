/**
 * Window clearance in the 15-rule intake repack, and corner-first type
 * selection that never fills the inside-corner square with a plain B##.
 */
import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { emptyAutoDesignIntake, type AutoDesignIntake } from "./autoDesignFifteenRules";
import { isPlacedCornerCabinet } from "./autoDesignCornerGuard";
import { isTrueBlindCornerCode, isDesignerCornerBase } from "./designerCornerSection";
import { autoDesignCornerFamily } from "./autoDesignCornerStage";
import {
  applianceAsDesignCabinet,
  cabinetWall,
  isCornerCabinet,
  isFillerItem,
  isPlainBaseCode,
  isRangeHoodPlacement,
  wallRunOffset,
  wallRunSpan,
  WALL_OPENING_CLEARANCE_IN,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

type StylePack = {
  name: string;
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  surround: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] };
};

const matrix = catalogFixture as unknown as Record<string, StylePack>;
const STYLE = "330014";

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

const PALETTE = [
  appliance("RANGE-30", 30, 25, 36),
  appliance("DW-24", 24, 24, 34.5),
  appliance("FRIDGE-36", 36, 30, 70),
  appliance("HOOD-30", 30, 18, 18),
];

function roomOf(width: number, depth: number): RoomData {
  return { width, depth, ceilingHeight: 96 };
}

function newIntake(overrides: Partial<AutoDesignIntake> = {}): AutoDesignIntake {
  return {
    ...emptyAutoDesignIntake(),
    construction: "new",
    canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true },
    ...overrides,
  };
}

function screenshotInput(overrides: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "l-shape",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 22 },
    stove: { wallLabel: "Wall 1", centerOffsetIn: 87 },
    sink: { wallLabel: "Wall 2", centerOffsetIn: 60 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    dishwasherSide: "right",
    sinkWindowCenter: null,
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    ...overrides,
  };
}

function build(args: {
  room?: RoomData;
  input?: AutoDesignInputs;
  openings?: WallOpening[];
  baseCatalog?: DesignCabinet[];
  wallCatalog?: DesignCabinet[];
  fillers?: DesignCabinet[];
}): AutoDesignLayoutSuccess | { ok: false; message: string } {
  const pack = matrix[STYLE]!;
  let uid = 0;
  return runAutoDesignLayout({
    input: args.input ?? screenshotInput(),
    room: args.room ?? roomOf(144, 120),
    openings: args.openings ?? [],
    baseCatalog: args.baseCatalog ?? pack.base,
    wallCatalog: args.wallCatalog ?? pack.wall,
    fillers: args.fillers ?? pack.accessory,
    appliancePalette: PALETTE.map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround.endPanels ?? [],
    tallCatalog: [],
    styleId: Number(STYLE),
    makeUid: () => `t-${++uid}`,
  });
}

function midBackWindow(sill = 42, kind: WallOpening["kind"] = "window"): WallOpening {
  return {
    uid: `hand-${kind}-top`,
    kind,
    label: kind === "door" ? "Door 24\"" : "Window 24\"",
    side: "top",
    offset: 50,
    width: 16,
    height: kind === "door" ? 80 : 36,
    sill,
  };
}

function rightWallWindow(sill = 42): WallOpening {
  return {
    uid: "hand-window-right",
    kind: "window",
    label: "Window 24\"",
    side: "right",
    offset: 90,
    width: 24,
    height: 36,
    sill,
  };
}

function overlapsSpan(item: PlacedCabinet, side: string, start: number, end: number, room: RoomData, clearance = 0): boolean {
  if (cabinetWall(item, room) !== side) return false;
  const itemStart = wallRunOffset(item, side, room);
  const itemEnd = itemStart + wallRunSpan(item, side, room);
  return Math.min(itemEnd, end + clearance) - Math.max(itemStart, start - clearance) > 0.05;
}

function blockedLayer(item: PlacedCabinet): boolean {
  return item.placement === "wall" || item.placement === "tall" || isRangeHoodPlacement(item)
    || (item.placement === "appliance" && /fridge|refrigerator|hood/i.test(`${item.masterCode} ${item.description}`));
}

function upperHits(placed: readonly PlacedCabinet[], opening: WallOpening, room: RoomData): string[] {
  return placed
    .filter(blockedLayer)
    .filter((item) => overlapsSpan(item, opening.side, opening.offset, opening.offset + opening.width, room, WALL_OPENING_CLEARANCE_IN))
    .map((item) => `${item.placement}:${item.masterCode}`);
}

function baseHits(placed: readonly PlacedCabinet[], opening: WallOpening, room: RoomData): string[] {
  return placed
    .filter((item) => item.placement === "base" || item.placement === "appliance")
    .filter((item) => overlapsSpan(item, opening.side, opening.offset, opening.offset + opening.width, room, 0))
    .map((item) => item.masterCode);
}

function nearInsideCorner(item: PlacedCabinet, room: RoomData): boolean {
  const boxRight = item.x + Math.max(item.width, 0);
  const gapX = Math.max(0, room.width - boxRight, item.x - room.width);
  const gapY = Math.max(0, -(item.y + Math.max(item.depth, 0)), item.y);
  return gapX <= 8 && gapY <= 8;
}

function expectOk(result: ReturnType<typeof build>): asserts result is AutoDesignLayoutSuccess {
  expect(result.ok, (result as { message?: string }).message).toBe(true);
}

describe("Auto Design: windows in the 15-rule intake repack", () => {
  it("keeps uppers, talls and hoods out of a mid-wall window plus 3 in clearance, and allows bases under a 42 in sill", () => {
    const room = roomOf(144, 120);
    const window = midBackWindow(42);
    const result = build({ room, openings: [window], input: screenshotInput({ intake: newIntake() }) });
    expectOk(result);
    expect(upperHits(result.placed, window, room), upperHits(result.placed, window, room).join(", ")).toEqual([]);
    expect(baseHits(result.placed, window, room).length).toBeGreaterThan(0);
  });

  it("blocks bases as well when the window sill is under 36 in", () => {
    const room = roomOf(144, 120);
    const window = midBackWindow(30);
    const result = build({ room, openings: [window], input: screenshotInput({ intake: newIntake() }) });
    expectOk(result);
    expect(upperHits(result.placed, window, room)).toEqual([]);
    expect(baseHits(result.placed, window, room), baseHits(result.placed, window, room).join(", ")).toEqual([]);
  });

  it("breaks both the base and wall layers at a door", () => {
    const room = roomOf(144, 120);
    const door = midBackWindow(0, "door");
    const result = build({ room, openings: [door], input: screenshotInput({ intake: newIntake() }) });
    expectOk(result);
    expect(upperHits(result.placed, door, room), upperHits(result.placed, door, room).join(", ")).toEqual([]);
    expect(baseHits(result.placed, door, room), baseHits(result.placed, door, room).join(", ")).toEqual([]);
  });

  it("keeps uppers out of a window on the L return wall", () => {
    const room = roomOf(144, 120);
    const window = rightWallWindow();
    const result = build({ room, openings: [window], input: screenshotInput({ intake: newIntake() }) });
    expectOk(result);
    expect(upperHits(result.placed, window, room), upperHits(result.placed, window, room).join(", ")).toEqual([]);
  });
});

describe("Auto Design: corner type from the appliances and the math", () => {
  it("does not place a plain B## in an L-corner when the line sells no corner SKU, and raises the finding", () => {
    const pack = matrix[STYLE]!;
    const bases = pack.base.filter((row) => !isDesignerCornerBase(row) && !isCornerCabinet(row.masterCode, row.description, row.cornerType ?? null));
    const room = roomOf(144, 120);
    const result = build({
      room,
      input: screenshotInput({ intake: newIntake({ preferences: ["blind-corner"] }) }),
      baseCatalog: bases,
    });
    expectOk(result);
    expect(result.seatedCorners).toHaveLength(0);
    expect(result.reviewFindings.some((finding) => finding.code === "corner-cabinet-not-seated")).toBe(true);
    const plain = result.placed.filter((item) => (item.placement === "base" || item.placement === "appliance") && nearInsideCorner(item, room) && isPlainBaseCode(item.masterCode));
    expect(plain.map((item) => item.masterCode), plain.map((item) => item.masterCode).join(", ")).toEqual([]);
  });

  it("treats a lone BLB42 as a true blind and gives it its filler when a blind corner is needed", () => {
    const pack = matrix[STYLE]!;
    const template = pack.base.find((row) => isTrueBlindCornerCode(row.masterCode)) ?? pack.base[0]!;
    const blb: DesignCabinet = {
      ...template,
      id: 99001,
      masterCode: "BLB42",
      description: '42" Blind Corner Base',
      width: "42",
      isCornerCabinet: true,
      cornerType: null,
      subCategory: "Blind Corner Base",
      pullMin: 3,
      pullMax: 6,
    };
    const bases = [
      ...pack.base.filter((row) => !isDesignerCornerBase(row) && !isCornerCabinet(row.masterCode, row.description, row.cornerType ?? null)),
      blb,
    ];
    expect(autoDesignCornerFamily(blb)).toBe("blind");
    const room = roomOf(144, 120);
    const result = build({
      room,
      input: screenshotInput({ intake: newIntake({ preferences: ["blind-corner"] }) }),
      baseCatalog: bases,
    });
    expectOk(result);
    expect(result.seatedCorners.map((entry) => `${entry.masterCode}/${entry.family}`)).toEqual(["BLB42/blind"]);
    const corner = result.placed.find((item) => item.masterCode === "BLB42");
    expect(corner).toBeTruthy();
    const filler = result.placed.find((item) => isFillerItem(item) && (item.fillerForCabinetUid === corner!.uid || nearInsideCorner(item, room)));
    expect(filler, "expected the 3 in filler beside the BLB42").toBeTruthy();
  });

  /**
   * On a 144 in Wall 1, a 30 in range centered at `129 - availableIn` leaves
   * `availableIn` inches from the inside corner to the range.
   */
  function stoveCenterForAvailable(availableIn: number): number {
    return 129 - availableIn;
  }

  function buildLeaving(availableIn: number, extras: Parameters<typeof build>[0] = {}) {
    const room = extras.room ?? roomOf(144, 120);
    const incoming = extras.input ?? {};
    return build({
      ...extras,
      room,
      input: screenshotInput({
        ...incoming,
        // Lock the range so the measured gap is the available run. Keep the
        // Wall 2 sink far enough from the inside corner (and still leave room
        // for the dishwasher) that the band is decided by Wall 1.
        intake: incoming.intake ?? newIntake({ canMove: { electrical: true, plumbing: true, rangeHookup: false, sinkBase: true } }),
        stove: { wallLabel: "Wall 1", centerOffsetIn: stoveCenterForAvailable(availableIn) },
        sink: incoming.sink ?? { wallLabel: "Wall 2", centerOffsetIn: 72 },
      }),
    });
  }


  it("at 45 in or more, seats a lazy Susan from the catalog", () => {
    const result = buildLeaving(45);
    expectOk(result);
    expect(result.seatedCorners[0]?.family).toBe("lazy-susan");
  });

  it("at 43.5 in, seats a pull-out corner when the line sells one, otherwise the next valid type", () => {
    const pack = matrix[STYLE]!;
    const pull = {
      ...(pack.base.find((row) => isDesignerCornerBase(row)) ?? pack.base[0]!),
      id: 99011,
      masterCode: "PCB36",
      description: "Sliding pull-out corner base",
      width: "36",
      isCornerCabinet: true,
      cornerType: "pull-out" as const,
      subCategory: "Pull-Out Corner",
    };
    const withPull = buildLeaving(44, { baseCatalog: [...pack.base, pull] });
    expectOk(withPull);
    expect(withPull.seatedCorners[0]?.family).toBe("pull-out");
    expect(withPull.seatedCorners[0]?.masterCode).toBe("PCB36");

    const without = buildLeaving(44);
    expectOk(without);
    expect(without.seatedCorners.length).toBeGreaterThan(0);
    expect(["pull-out", "blind", "lazy-susan", "diagonal"]).toContain(without.seatedCorners[0]!.family);
  });

  it("at 42 in, seats a catalog lazy Susan plus a 9 in base, pull-out, or tray (not a wall, and a tall only if no base exists)", () => {
    const result = buildLeaving(42);
    expectOk(result);
    expect(result.seatedCorners[0]?.family).toBe("lazy-susan");
    const lazy = result.placed.find((item) => item.masterCode === result.seatedCorners[0]!.masterCode);
    expect(lazy).toBeTruthy();
    const nines = result.placed.filter((item) => Math.abs(Number(item.width) - 9) <= 0.2 && (item.placement === "base" || item.placement === "tall"));
    expect(nines.length, nines.map((item) => item.masterCode).join(", ")).toBeGreaterThan(0);
    expect(nines.some((item) => item.placement === "base")).toBe(true);
  });

  it("around 36 in, seats a catalog lazy Susan that fits, or a blind if none does", () => {
    const result = buildLeaving(36);
    expectOk(result);
    expect(["lazy-susan", "blind"]).toContain(result.seatedCorners[0]?.family);
    // This line sells LSB33 / BER33, which fit a 36 in run.
    expect(result.seatedCorners[0]?.family).toBe("lazy-susan");
  });

  it("at 30 in and at 27 in, seats a turned blind corner with its 3 in filler", () => {
    for (const available of [30, 27]) {
      const result = buildLeaving(available);
      expectOk(result);
      expect(result.seatedCorners[0]?.family, `${available} in`).toBe("blind");
      const corner = result.placed.find((item) => item.masterCode === result.seatedCorners[0]!.masterCode);
      expect(corner, `${available} in corner`).toBeTruthy();
      const filler = result.placed.find((item) => isFillerItem(item) && (item.fillerForCabinetUid === corner!.uid || nearInsideCorner(item, roomOf(144, 120))));
      expect(filler, `${available} in filler`).toBeTruthy();
    }
  });

  it("under 27 in, keeps the corner blocked, raises the finding, and never places a plain B## there", () => {
    const room = roomOf(144, 120);
    const result = buildLeaving(26, { room });
    expectOk(result);
    expect(result.seatedCorners).toHaveLength(0);
    expect(result.reviewFindings.some((finding) => finding.code === "corner-cabinet-not-seated")).toBe(true);
    const plain = result.placed.filter((item) => (item.placement === "base" || item.placement === "appliance") && nearInsideCorner(item, room) && isPlainBaseCode(item.masterCode));
    expect(plain.map((item) => item.masterCode), plain.map((item) => item.masterCode).join(", ")).toEqual([]);
  });

  it("sizes come from the catalog: a line with only LS33 still uses LS33; a line with no lazy Susan falls to the next valid type", () => {
    const pack = matrix[STYLE]!;
    const bases = pack.base.filter((row) => !isDesignerCornerBase(row) && !isCornerCabinet(row.masterCode, row.description, row.cornerType ?? null));
    const ls33 = pack.base.find((row) => row.masterCode === "LSB33") ?? pack.base.find((row) => /LSB?33/.test(row.masterCode));
    expect(ls33).toBeTruthy();
    const only33 = buildLeaving(45, { baseCatalog: [...bases, ls33!] });
    expectOk(only33);
    expect(only33.seatedCorners[0]?.masterCode).toBe(ls33!.masterCode);
    expect(only33.seatedCorners[0]?.family).toBe("lazy-susan");

    const bbc = pack.base.find((row) => row.masterCode === "BBC36") ?? pack.base.find((row) => isTrueBlindCornerCode(row.masterCode));
    expect(bbc).toBeTruthy();
    const noLazy = buildLeaving(45, { baseCatalog: [...bases, bbc!] });
    expectOk(noLazy);
    expect(noLazy.seatedCorners[0]?.family).not.toBe("lazy-susan");
    expect(["blind", "diagonal", "pull-out"]).toContain(noLazy.seatedCorners[0]?.family);
  });

  it("on a room with 45 in or more on both legs, seats a lazy Susan rather than defaulting to a blind at ~42 in", () => {
    const open = build({
      room: roomOf(180, 160),
      input: screenshotInput({
        intake: newIntake(),
        refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 22 },
        stove: { wallLabel: "Wall 1", centerOffsetIn: 90 },
        sink: { wallLabel: "Wall 2", centerOffsetIn: 90 },
      }),
    });
    expectOk(open);
    expect(open.seatedCorners.length).toBeGreaterThan(0);
    expect(open.seatedCorners[0]!.family).toBe("lazy-susan");
  });

  it("still seats a BBC36 when the line has no priced 3 in filler and intake is on", () => {
    const pack = matrix[STYLE]!;
    const fillers = pack.accessory.filter((row) => !/fill/i.test(`${row.masterCode} ${row.description} ${row.subCategory}`));
    const room = roomOf(144, 120);
    const result = buildLeaving(30, { room, fillers, input: { intake: newIntake({ preferences: ["blind-corner"] }) } as AutoDesignInputs });
    expectOk(result);
    expect(result.seatedCorners.map((entry) => entry.masterCode)).toContain("BBC36");
    expect(result.placed.some((item) => isPlacedCornerCabinet(item) && item.masterCode === "BBC36")).toBe(true);
    expect(result.reviewFindings.some((finding) => finding.code === "filler-sku-missing")).toBe(true);
  });
});
