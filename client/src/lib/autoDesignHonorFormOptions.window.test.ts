import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { cabinetWall, isSinkBaseCabinet, wallRunOffset, wallRunSpan, type DesignCabinet, type RoomData, type WallOpening } from "./design";

// Tom, Nov 14 2026: on an L-shape the sink "window" check mark seemed to do
// nothing, and a window drawn on the sink wall was not respected.
type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const PACK = (matrixCatalog as unknown as Record<string, Pack>)["510004"]!;
const appliance = (code: string, w: number, d: number, h: number) => ({ id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance", width: String(w), depth: String(d), height: String(h), placement: "appliance" }) as DesignCabinet;
const PALETTE = [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70), appliance("HOOD-30", 30, 18, 18)];
const ROOM = { width: 132, depth: 132, ceilingHeight: 96 } as RoomData;

function build(sinkWindow: boolean, openings: WallOpening[]) {
  let uid = 0;
  const input = {
    layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 2", centerOffsetIn: 66 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: 80 }, dishwasher: null, dishwasherSide: "none", skipDishwasher: true,
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
    refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above",
    sinkWindowCenter: sinkWindow ? { wallLabel: "Wall 2", centerOffsetIn: 66 } : null,
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    intake: { ...emptyAutoDesignIntake(), construction: "new" },
  } as AutoDesignInputs;
  const run = runAutoDesignLayout({
    input, room: ROOM, openings, baseCatalog: PACK.base, wallCatalog: PACK.wall, fillers: PACK.accessory,
    appliancePalette: PALETTE, refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(PACK.wall, PACK.surround?.deepAbove ?? []),
    refrigeratorEndPanels: PACK.surround?.endPanels ?? [], panelCatalog: [...PACK.accessory, ...(PACK.surround?.endPanels ?? [])],
    styleId: 510004, makeUid: () => `w-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return run;
}
const clearOfWindow = (run: ReturnType<typeof build>, window: { side: string; offset: number; width: number }) =>
  run.placed.filter((item) => item.placement === "wall" && cabinetWall(item, ROOM) === window.side).every((item) => {
    const start = wallRunOffset(item, window.side, ROOM);
    const end = start + wallRunSpan(item, window.side, ROOM);
    return end <= window.offset + 0.01 || start >= window.offset + window.width - 0.01;
  });

describe("Auto Design sink window on an L-shape", () => {
  it("the check mark alone adds a window over the sink on Wall 2 and keeps uppers off it", () => {
    const run = build(true, []);
    const sink = run.placed.find((item) => item.placement === "base" && isSinkBaseCabinet(item))!;
    const wall = cabinetWall(sink, ROOM) as string;
    expect(run.sinkWindow).not.toBeNull();
    expect(run.sinkWindow!.side).toBe(wall);
    expect(run.openings.some((opening) => opening.uid === run.sinkWindow!.uid)).toBe(true);
    expect(clearOfWindow(run, run.sinkWindow!)).toBe(true);
  });

  it("a window already drawn on the sink wall is used: the sink centers under it and no second window is made", () => {
    const sinkWallRun = build(false, []);
    const sinkWall = cabinetWall(sinkWallRun.placed.find((item) => isSinkBaseCabinet(item))!, ROOM) as string;
    const drawn = { uid: "drawn-window", kind: "window", label: "Window", side: sinkWall, offset: 60, width: 36, height: 48, sill: 42 } as WallOpening;
    const run = build(true, [drawn]);
    const sink = run.placed.find((item) => item.placement === "base" && isSinkBaseCabinet(item))!;
    const start = wallRunOffset(sink, sinkWall, ROOM);
    expect(start + wallRunSpan(sink, sinkWall, ROOM) / 2).toBeCloseTo(78, 1);
    expect(run.sinkWindow).toBeNull();
    expect(run.openings.filter((opening) => opening.kind === "window")).toHaveLength(1);
    expect(clearOfWindow(run, drawn)).toBe(true);
  });
});
