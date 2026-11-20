/**
 * Tom, Nov 20 2026 (owner voice, 4:09 / 4:33 PM CT): glass-row 45° fillers must
 * stay at stacker height (mount 84, height 12). DesignTool always runs
 * normalizeStandardWallMounts after Auto Design commits; without an exemption
 * those F642 front-miter pairs were rehung as ordinary short uppers at 72.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { alignFramelessWallCabinetTops } from "./framelessWallTopAlignment";
import {
  isStacker,
  normalizeGlassStackersToParentFronts,
  normalizeOverSinkWallMounts,
  normalizeStandardWallMounts,
  normalizeWd18CountertopMounts,
  normalizeWallOpenShelfMounts,
  type DesignCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const ACCESSORIES = REAL[STYLE]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORIES.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

function wallBuilderFiveWallRoom(): RoomData {
  const L = 138;
  return {
    width: 204, depth: 210, ceilingHeight: 96, openWallPath: true,
    vertices: [
      { id: "v1", x: 0, y: 0 }, { id: "v2", x: L, y: 0 }, { id: "v3", x: L + 66, y: 66 },
      { id: "v4", x: L + 66, y: 144 }, { id: "v5", x: L, y: 210 }, { id: "v6", x: 40, y: 210 },
    ],
    customWalls: [
      { id: "cw_k6x_1", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
      { id: "cw_k6x_2", label: "Wall 2", startVertexId: "v2", endVertexId: "v3", lockedAngle: 45 },
      { id: "cw_k6x_3", label: "Wall 3", startVertexId: "v3", endVertexId: "v4" },
      { id: "cw_k6x_4", label: "Wall 4", startVertexId: "v4", endVertexId: "v5", lockedAngle: 45 },
      { id: "cw_k6x_5", label: "Wall 5", startVertexId: "v5", endVertexId: "v6" },
    ],
  } as RoomData;
}

function build(): { result: AutoDesignLayoutSuccess; room: RoomData; openings: WallOpening[] } {
  const room = wallBuilderFiveWallRoom();
  const openings = [{
    uid: "tom-sink-window", kind: "window", label: "Window 36\"", side: "cw_k6x_2",
    offset: 20, width: 36, height: 42, sill: 42,
  } as WallOpening];
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 2", centerOffsetIn: 36 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 3", centerOffsetIn: 39 },
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 },
      dishwasher: { wallLabel: "Wall 2", centerOffsetIn: 70.34 }, dishwasherSide: "right", skipDishwasher: false,
      tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", islandOrPeninsula: "none", preferences: ["glass-uppers", "dishwasher"] },
    } as AutoDesignInputs,
    room,
    openings,
    baseCatalog: BASES, wallCatalog: WALLS, fillers: FILLERS,
    appliancePalette: [
      appliance("RANGE-30", 30, 25, 36),
      appliance("DW-24", 24, 24, 34.5),
      appliance("FRIDGE-36", 36, 30, 70),
      appliance("MW-30", 30, 15, 16),
    ],
    refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: ACCESSORIES.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    panelCatalog: ACCESSORIES.filter((row) => /end panel|DWR|WEP|BEP/i.test(`${row.masterCode} ${row.description}`)),
    styleId: Number(STYLE), makeUid: () => `cw-glass-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return { result, room, openings };
}

/** The same remount sequence DesignTool runs whenever `placed` changes. */
function applyDesignerMounts(
  placed: AutoDesignLayoutSuccess["placed"],
  room: RoomData,
  openings: WallOpening[],
) {
  return normalizeGlassStackersToParentFronts(
    normalizeWallOpenShelfMounts(
      alignFramelessWallCabinetTops({
        placed: normalizeStandardWallMounts(
          normalizeWd18CountertopMounts(normalizeOverSinkWallMounts(placed, openings, room)),
          openings,
          room,
        ),
        room,
      }).placed,
      room,
    ),
    room,
  );
}

function isFrontMiter(item: { fillerTransitionKind?: string | null }): boolean {
  return item.fillerTransitionKind === "front-miter-pair";
}

describe("Glass-row 45° fillers keep mount 84 through the DesignTool remount chain", () => {
  it("does not rehang F642 front-miter pairs from 84 to 72", () => {
    const { result, room, openings } = build();
    const before = result.placed.filter((item) => (
      item.placement === "wall"
      && isFrontMiter(item)
      && Math.abs((Number(item.mountBottom) || 0) - 84) <= 0.2
      && Math.abs(Number(item.height) - 12) <= 0.2
    ));
    expect(before.length, "layout should seat glass-row 45° fillers at mount 84").toBeGreaterThanOrEqual(4);
    expect(before.every((item) => item.masterCode === "F642")).toBe(true);

    const remounted = applyDesignerMounts(result.placed, room, openings);
    const after = remounted.filter((item) => before.some((filler) => filler.uid === item.uid));
    expect(after).toHaveLength(before.length);
    for (const item of after) {
      expect(Number(item.mountBottom), `${item.masterCode} ${item.uid} stayed at stacker height`).toBeCloseTo(84, 1);
      expect(Number(item.height)).toBeCloseTo(12, 1);
    }
    const stackers = remounted.filter((item) => isStacker(item));
    expect(stackers.length).toBeGreaterThan(0);
    expect(stackers.every((item) => Math.abs((Number(item.mountBottom) || 0) - 84) <= 0.2)).toBe(true);
  });
});
