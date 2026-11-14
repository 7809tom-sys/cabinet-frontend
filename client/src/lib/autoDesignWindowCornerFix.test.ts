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

  it("seats a blind corner when an appliance is near the corner, and a two-leg corner when both legs are open", () => {
    const room = roomOf(144, 120);
    const tight = build({ room, input: screenshotInput({ intake: newIntake() }) });
    expectOk(tight);
    expect(tight.seatedCorners.length).toBeGreaterThan(0);
    expect(tight.seatedCorners[0]!.family).toBe("blind");

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
    expect(["diagonal", "lazy-susan"]).toContain(open.seatedCorners[0]!.family);
  });

  it("still seats a BBC36 when the line has no priced 3 in filler and intake is on", () => {
    const pack = matrix[STYLE]!;
    const fillers = pack.accessory.filter((row) => !/fill/i.test(`${row.masterCode} ${row.description} ${row.subCategory}`));
    const room = roomOf(144, 120);
    const result = build({ room, input: screenshotInput({ intake: newIntake({ preferences: ["blind-corner"] }) }), fillers });
    expectOk(result);
    expect(result.seatedCorners.map((entry) => entry.masterCode)).toContain("BBC36");
    expect(result.placed.some((item) => isPlacedCornerCabinet(item) && item.masterCode === "BBC36")).toBe(true);
    expect(result.reviewFindings.some((finding) => finding.code === "filler-sku-missing")).toBe(true);
  });
});
