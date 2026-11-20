/**
 * Tom, Nov 20 2026 (owner voice, 12:38 / 1:31 PM CT): at a 135° join the glass
 * row must connect to the next glass cabinet with a 45° angled filler. The first
 * repairMissingAngledWallFillers pass runs before applyGlassUpperPreference, so
 * it only seats the 30 in upper pair. A second pass after glass (and after
 * normalizeBridgeBoards) seats the matching pair at stacker height.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import {
  cabinetWall,
  isStacker,
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

/** Tom's five-wall kitchen with Wall Builder `cw_*` wall ids. */
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

function build(): AutoDesignLayoutSuccess {
  const room = wallBuilderFiveWallRoom();
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
    openings: [{
      uid: "tom-sink-window", kind: "window", label: "Window 36\"", side: "cw_k6x_2",
      offset: 20, width: 36, height: 42, sill: 42,
    } as WallOpening],
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
  return result;
}

function isFrontMiter(item: { fillerTransitionKind?: string | null }): boolean {
  return item.fillerTransitionKind === "front-miter-pair";
}

describe("Auto Design 45° fillers in the glass row at 135° joins", () => {
  it("seats F642 front-miter pairs at mount 84, height 12, connecting glass to the next glass cabinet", () => {
    const room = wallBuilderFiveWallRoom();
    const { placed } = build();

    const stackers = placed.filter((item) => isStacker(item));
    expect(stackers.length).toBeGreaterThan(0);

    const glassFillers = placed.filter((item) => (
      item.placement === "wall"
      && isFrontMiter(item)
      && Math.abs((Number(item.mountBottom) || 0) - 84) <= 0.2
      && Math.abs(Number(item.height) - 12) <= 0.2
    ));
    expect(glassFillers.length, "a 45° filler pair at stacker height on each 135° join beside the range wall").toBeGreaterThanOrEqual(4);
    expect(glassFillers.every((item) => item.masterCode === "F642")).toBe(true);
    expect(glassFillers.every((item) => item.fillerMiterAngle === 22.5)).toBe(true);

    const walls = new Set(glassFillers.map((item) => cabinetWall(item, room) || item.wallId));
    expect(walls.has("cw_k6x_2")).toBe(true);
    expect(walls.has("cw_k6x_3")).toBe(true);
    expect(walls.has("cw_k6x_4")).toBe(true);

    const ownerUids = new Set(glassFillers.flatMap((item) => [item.fillerForCabinetUid, item.fillerTransitionNeighborUid].filter(Boolean)));
    const owners = placed.filter((item) => ownerUids.has(item.uid));
    expect(owners.every((item) => isStacker(item)), "each stacker-height filler is cut between glass cabinets").toBe(true);

    // The 30 in upper pair stays; this pass does not replace or widen it.
    const upperFillers = placed.filter((item) => (
      item.placement === "wall"
      && isFrontMiter(item)
      && Math.abs((Number(item.mountBottom) || 0) - 54) <= 0.2
    ));
    expect(upperFillers.length).toBeGreaterThanOrEqual(4);
  });
});
