import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { applyGlassUpperPreference, isGlassBridgeParent } from "./autoDesignFormOptions";
import { emptyAutoDesignIntake, type AutoDesignIntake } from "./autoDesignFifteenRules";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { appliancesForRoom, applianceAsDesignCabinet, elevationBox, isStacker, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

/**
 * Glass over the bridge (Tom, Nov 20 2026, sample-drawing review). The glass parents filter only took
 * wall cabinets at the 30 in design height, so the short 12 / 15 / 18 in bridge over the microwave or
 * the refrigerator never got the W3012GD / W3015GD / W3018GD the line sells. Ordinary 30 in uppers
 * keep working exactly as before.
 */
const WALL = (matrixCatalog as unknown as Record<string, { wall: DesignCabinet[] }>)["330014"]!.wall;
const GLASS: AutoDesignIntake = { ...emptyAutoDesignIntake(), construction: "new", preferences: ["glass-uppers"] };
const row = (code: string) => {
  const found = WALL.find((item) => item.masterCode === code);
  if (!found) throw new Error(`fixture has no ${code}`);
  return found;
};

function cabinet(code: string, x: number, uid: string, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const r = row(code);
  return {
    uid, cabinetId: r.id, masterCode: r.masterCode, description: r.description ?? "",
    category: r.category ?? null, subCategory: r.subCategory ?? null,
    placement: "wall", x, y: 0, rotation: 0, wallId: "top",
    width: Number(r.width), depth: Number(r.depth), height: Number(r.height), mountBottom: 54,
    ...extra,
  } as PlacedCabinet;
}
const microwaveBridge = (code: string, x: number, uid = "mw") => cabinet(code, x, uid, { mountBottom: 72, overRangeMicrowaveBridge: true } as Partial<PlacedCabinet>);
const room = (ceilingHeight: number) => ({ width: 144, depth: 120, ceilingHeight }) as RoomData;
const stackerOn = (placed: readonly PlacedCabinet[], uid: string) => placed.filter((item) => isStacker(item) && item.stackedOnCabinetUid === uid);

describe("glass stacker on the bridge over the microwave", () => {
  it("108 in ceiling: the 12 in bridge at 72 in takes the 18 in W3018GD, top at 102 in", () => {
    const r = room(108);
    const result = applyGlassUpperPreference({ placed: [microwaveBridge("W3012", 36)], wallCatalog: WALL, intake: GLASS, room: r, wallHeightIn: 30 });
    const stackers = stackerOn(result.placed, "mw");
    expect(stackers.map((item) => item.masterCode)).toEqual(["W3018GD"]);
    const box = elevationBox(stackers[0]!, r);
    expect(box.bottom).toBeCloseTo(84, 2);
    expect(box.bottom + box.height).toBeCloseTo(102, 2);
    expect(result.findings.find((entry) => entry.code === "preference-glass-bridge")?.severity).toBe("info");
  });

  it("96 in ceiling: 84 + 12 = 96 fits exactly, so the bridge takes the W3012GD", () => {
    const r = room(96);
    const result = applyGlassUpperPreference({ placed: [microwaveBridge("W3012", 36)], wallCatalog: WALL, intake: GLASS, room: r, wallHeightIn: 30 });
    const stackers = stackerOn(result.placed, "mw");
    expect(stackers.map((item) => item.masterCode)).toEqual(["W3012GD"]);
    expect(elevationBox(stackers[0]!, r).bottom + elevationBox(stackers[0]!, r).height).toBeCloseTo(96, 2);
  });

  it("a 15 in and an 18 in bridge each take the stacker of their own width, ceiling permitting", () => {
    const fifteen = applyGlassUpperPreference({ placed: [microwaveBridge("W3015", 36)], wallCatalog: WALL, intake: GLASS, room: room(108), wallHeightIn: 30 });
    expect(stackerOn(fifteen.placed, "mw").map((item) => item.masterCode)).toEqual(["W3018GD"]);
    // 72 + 18 = 90; a 96 in ceiling leaves 6 in: no stacker fits, the bridge stays plain and is named.
    const eighteen = applyGlassUpperPreference({ placed: [microwaveBridge("W3018", 36)], wallCatalog: WALL, intake: GLASS, room: room(96), wallHeightIn: 30 });
    expect(stackerOn(eighteen.placed, "mw")).toEqual([]);
    expect(eighteen.findings.find((entry) => entry.code === "preference-glass-bridge")?.detail).toMatch(/Left plain: W3018 \(even the shortest stacker would reach/);
  });

  it("the refrigerator bridge (24 in deep) takes a stacker flush with its front", () => {
    const bridge = cabinet("W301224", 36, "fr", { mountBottom: 72, refrigeratorAssemblyRole: "bridge", refrigeratorAssemblyId: "fridge" } as Partial<PlacedCabinet>);
    const result = applyGlassUpperPreference({ placed: [bridge], wallCatalog: WALL, intake: GLASS, room: room(108), wallHeightIn: 30 });
    const stackers = stackerOn(result.placed, "fr");
    expect(stackers.map((item) => item.masterCode)).toEqual(["W3018GD"]);
    // flush with the 24 in bridge: the 12 in stacker is brought forward 12 in.
    expect(stackers[0]!.y).toBeCloseTo(12, 2);
  });

  it("the ordinary 30 in uppers beside the bridge still get glass, and the bridge is its own break in the run", () => {
    const placed = [cabinet("W3030", 0, "u1"), microwaveBridge("W3012", 30), cabinet("W3030", 60, "u2")];
    const result = applyGlassUpperPreference({ placed, wallCatalog: WALL, intake: GLASS, room: room(108), wallHeightIn: 30 });
    expect(result.stackers.map((item) => item.stackedOnCabinetUid).sort()).toEqual(["mw", "u1", "u2"]);
    expect(result.findings.filter((entry) => entry.severity === "warning")).toEqual([]);
  });

  it("only the flagged bridges: a loose 12 in cabinet, a 24 in bridge, or a filler gets no stacker", () => {
    const loose = cabinet("W3012", 36, "loose", { mountBottom: 72 });
    const tall = { ...microwaveBridge("W3024", 36, "tall"), height: 24 } as PlacedCabinet;
    expect(isGlassBridgeParent(loose)).toBe(false);
    expect(isGlassBridgeParent(tall)).toBe(false);
    expect(isGlassBridgeParent(microwaveBridge("W3012", 36))).toBe(true);
    const result = applyGlassUpperPreference({ placed: [loose, tall], wallCatalog: WALL, intake: GLASS, room: room(108), wallHeightIn: 30 });
    expect(result.stackers).toEqual([]);
  });

  it("no glass preference, no bridge stacker", () => {
    const result = applyGlassUpperPreference({ placed: [microwaveBridge("W3012", 36)], wallCatalog: WALL, intake: { ...GLASS, preferences: [] }, room: room(108), wallHeightIn: 30 });
    expect(result.stackers).toEqual([]);
  });
});

// Whole engine run: rect L, Aero Solstice, glass on, bridge over the microwave and over the refrigerator.
const LIVE = live as unknown as {
  base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[];
  surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] };
};
function engine(ceiling: number, glass = true): AutoDesignLayoutSuccess {
  const roomData = { width: 170, depth: 170, ceilingHeight: ceiling, openWallPath: false } as RoomData;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 85 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 54 }, refrigerator: { wallLabel: "Wall 2", centerOffsetIn: 100 }, refrigeratorWidthIn: 36,
      dishwasherSide: "right", skipDishwasher: false, tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      designQuestionDoorStyleId: 390019, designQuestionDoorStyleName: "Aero Solstice",
      intake: { ...emptyAutoDesignIntake(), construction: "new", islandOrPeninsula: "none", preferences: glass ? ["glass-uppers", "dishwasher"] : ["dishwasher"] },
    } as never,
    room: roomData,
    openings: [{ uid: "win", kind: "window", label: "w", side: "top", offset: 67, width: 36, height: 42, sill: 42 } as never],
    baseCatalog: LIVE.base, wallCatalog: LIVE.wall, fillers: LIVE.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(LIVE.wall, LIVE.surround.deepAbove ?? []),
    refrigeratorEndPanels: LIVE.surround.endPanels ?? [], tallCatalog: LIVE.tall, panelCatalog: LIVE.accessory,
    styleId: 390019, makeUid: () => `bg-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe("glass over the bridges in a whole Auto Design run (Aero Solstice, glass on)", () => {
  it.each([[108, 18], [96, 12]])("%i in ceiling: the microwave bridge and the refrigerator bridge each carry a %i in glass stacker of their width", (ceiling, stackerHeight) => {
    const { placed } = engine(ceiling);
    const bridges = placed.filter((item) => isGlassBridgeParent(item));
    expect(bridges.map((item) => item.overRangeMicrowaveBridge === true ? "microwave" : "refrigerator").sort()).toEqual(["microwave", "refrigerator"]);
    for (const bridge of bridges) {
      const stackers = stackerOn(placed, bridge.uid);
      expect(stackers, bridge.masterCode).toHaveLength(1);
      expect(stackers[0]!.masterCode).toBe(`W${String(Math.round(Number(bridge.width))).padStart(2, "0")}${stackerHeight}GD`);
      expect(Number(stackers[0]!.width)).toBeCloseTo(Number(bridge.width), 1);
    }
  });

  it("glass off: no stacker anywhere, bridges included", () => {
    const { placed } = engine(108, false);
    expect(placed.some((item) => isStacker(item))).toBe(false);
  });
});
