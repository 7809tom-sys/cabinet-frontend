/**
 * Tom, Nov 20 2026 (owner voice, 1:31 PM CT): a Wall Builder five-wall kitchen
 * names its walls `cw_*`, not top/bottom/left/right. The mandatory over-range
 * bridge (and the glass stacker on it) must still hang above the OTR microwave.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { isGlassBridgeParent } from "./autoDesignFormOptions";
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
    styleId: Number(STYLE), makeUid: () => `cw-range-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe("Auto Design over-range bridge on a Wall Builder cw_* kitchen", () => {
  it("places W3012 and a W3012PG glass stacker above the OTR microwave, with no range-bridge-blocked finding", () => {
    const room = wallBuilderFiveWallRoom();
    const { placed, reviewFindings } = build();

    const range = placed.find((item) => item.masterCode === "RANGE-30");
    expect(range, "the range sits on Wall 3").toBeDefined();
    expect(cabinetWall(range!, room)).toBe("cw_k6x_3");
    expect(range!.wallId).toBe("cw_k6x_3");

    expect(placed.some((item) => item.masterCode === "MW-30" && cabinetWall(item, room) === "cw_k6x_3")).toBe(true);

    const blocked = (reviewFindings ?? []).filter((finding) => finding.code === "range-bridge-blocked");
    expect(blocked, blocked.map((finding) => finding.detail).join(" | ")).toEqual([]);

    const bridge = placed.find((item) => item.overRangeMicrowaveBridge === true);
    expect(bridge, "the mandatory W3012 bridge hangs over the microwave").toBeDefined();
    expect(bridge!.masterCode).toBe("W3012");
    expect(cabinetWall(bridge!, room)).toBe("cw_k6x_3");
    expect(Number(bridge!.mountBottom)).toBeCloseTo(72, 5);
    expect(Number(bridge!.height)).toBeCloseTo(12, 5);
    expect(isGlassBridgeParent(bridge!)).toBe(true);

    const stacker = placed.find((item) => isStacker(item) && item.stackedOnCabinetUid === bridge!.uid);
    expect(stacker, "glass-by-width puts W3012PG on the microwave bridge").toBeDefined();
    expect(stacker!.masterCode).toBe("W3012PG");
    expect(cabinetWall(stacker!, room)).toBe("cw_k6x_3");
    expect(Number(stacker!.mountBottom)).toBeCloseTo(84, 5);
    expect(Number(stacker!.height)).toBeCloseTo(12, 5);
  });
});
