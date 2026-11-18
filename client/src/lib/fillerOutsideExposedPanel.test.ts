/**
 * Tom, voice, Nov 18 2026, 4:53 PM CT: "No filler outside exposed panels."
 * A filler never sits on the outside face of a panel. Fillers go between cabinets
 * or against walls, never past an exposed panel.
 */
import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import frameless from "./__fixtures__/uscdFramelessLiveCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { fillersOutsideExposedPanels, removeFillersOutsideExposedPanels } from "./fillerOutsideExposedPanel";
import {
  DEFAULT_ROOM, applianceAsDesignCabinet, appliancesForRoom, cabinetWall, isFillerItem, isPanelItem, wallPlacementAt, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

const ROOM = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function seat(p: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "width">, start: number, wallId = "top"): PlacedCabinet {
  const placement = p.placement ?? "base";
  const depth = placement === "wall" ? 12 : 24;
  const spot = wallPlacementAt(start, p.width, depth, wallId as never, ROOM);
  return {
    cabinetId: 1, masterCode: "B", description: "", category: "Base", subCategory: "Standard Base",
    height: placement === "wall" ? 30 : placement === "tall" ? 96 : 34.5, numberOfDoors: 2, numberOfDrawers: 0,
    mountBottom: placement === "wall" ? 54 : 0, ...p, placement, depth, ...spot,
  } as PlacedCabinet;
}
const cabinet = (uid: string, width: number, start: number, extra: Partial<PlacedCabinet> = {}) => seat({ uid, width, masterCode: `B${width}`, ...extra }, start);
const panel = (uid: string, start: number, extra: Partial<PlacedCabinet> = {}) =>
  seat({ uid, width: 0.75, masterCode: "BEP2435", description: "Base End Panel", category: "Panels", subCategory: "End Panel", numberOfDoors: 0, ...extra }, start);
const filler = (uid: string, width: number, start: number, extra: Partial<PlacedCabinet> = {}) =>
  seat({ uid, width, masterCode: "BF3", description: "Base Filler", category: "Filler", subCategory: "Filler", numberOfDoors: 0, ...extra }, start);

describe("fillersOutsideExposedPanels (pure)", () => {
  it("flags a filler between a panel and the wall (outside the panel)", () => {
    const placed = [filler("f", 3, 0), panel("p", 3), cabinet("c", 30, 3.75)];
    const hits = fillersOutsideExposedPanels({ placed, room: ROOM });
    expect(hits.map((h) => [h.filler.uid, h.panel.uid, h.farSide])).toEqual([["f", "p", "wall"]]);
  });

  it("flags a filler past a panel at an open run end", () => {
    const placed = [cabinet("c", 30, 40), panel("p", 70), filler("f", 3, 70.75)];
    const hits = fillersOutsideExposedPanels({ placed, room: ROOM });
    expect(hits.map((h) => [h.filler.uid, h.farSide])).toEqual([["f", "nothing"]]);
  });

  it("keeps a filler between two cabinets and a filler between a cabinet and the wall", () => {
    const placed = [filler("w", 2, 0), cabinet("a", 30, 2), filler("m", 1.5, 32), cabinet("b", 30, 33.5)];
    expect(fillersOutsideExposedPanels({ placed, room: ROOM })).toEqual([]);
  });

  it("keeps a filler that closes a cabinet-to-panel seam (the panel face is covered by that cabinet)", () => {
    const placed = [cabinet("a", 30, 0), filler("f", 1, 30), panel("p", 31), cabinet("b", 30, 31.75)];
    expect(fillersOutsideExposedPanels({ placed, room: ROOM })).toEqual([]);
  });

  it("never touches a required corner filler", () => {
    const placed = [filler("f", 3, 0, { fillerTransitionKind: "front-miter-pair" }), panel("p", 3), cabinet("c", 30, 3.75)];
    expect(fillersOutsideExposedPanels({ placed, room: ROOM })).toEqual([]);
  });

  it("removes the board and names it on the review list", () => {
    const placed = [filler("f", 3, 0), panel("p", 3), cabinet("c", 30, 3.75)];
    const out = removeFillersOutsideExposedPanels({ placed, room: ROOM });
    expect(out.placed.map((i) => i.uid)).toEqual(["p", "c"]);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0]).toMatchObject({ ruleId: "no-filler-outside-exposed-panel", severity: "warning", cabinetCode: "BEP2435" });
    expect(out.findings[0]!.detail).toMatch(/never past an exposed panel/);
  });
});

/** Live Aero Solstice and Palermo packs, the same plans the production visual check drives (plans a-d). */
type Plan = { pack: any; styleId: number; layout: string; w: number; d: number; height: number; sink: [string, number]; range: [string, number]; fridge: [string, number] };
const AERO = live as any;
const PALERMO = (frameless as any)["540004"];
function build(p: Plan, glass = true) {
  const room = { width: p.w, depth: p.d, ceilingHeight: 108, openWallPath: false } as RoomData;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: p.layout, originCorner: "left", runDirection: "right", wallCabinetHeightIn: p.height,
      sink: { wallLabel: p.sink[0], centerOffsetIn: p.sink[1] }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: p.range[0], centerOffsetIn: p.range[1] }, refrigerator: { wallLabel: p.fridge[0], centerOffsetIn: p.fridge[1] }, refrigeratorWidthIn: 36,
      dishwasherSide: "right", skipDishwasher: false, tallCabinets: null, overRangeAnswer: "microwave-bridge",
      refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] }, designQuestionDoorStyleId: p.styleId,
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: glass ? ["glass-uppers"] : [], islandOrPeninsula: "none" },
    } as never,
    room, openings: [], baseCatalog: p.pack.base, wallCatalog: p.pack.wall, fillers: p.pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(p.pack.wall, p.pack.surround.deepAbove ?? []),
    refrigeratorEndPanels: p.pack.surround.endPanels ?? [], tallCatalog: p.pack.tall ?? [], panelCatalog: p.pack.accessory,
    styleId: p.styleId, makeUid: () => `n-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return { result, room };
}
const PLAN_D: Plan = { pack: AERO, styleId: 390019, layout: "l-shape", w: 168, d: 120, height: 30, sink: ["Wall 2", 60], range: ["Wall 1", 120], fridge: ["Wall 1", 22] };
const PLAN_C: Plan = { pack: PALERMO, styleId: 540004, layout: "l-shape", w: 151.25, d: 117.75, height: 30, sink: ["Wall 2", 58], range: ["Wall 1", 95], fridge: ["Wall 1", 22] };
const PLAN_A: Plan = { pack: AERO, styleId: 390019, layout: "u-shape", w: 192, d: 144, height: 36, sink: ["Wall 1", 96], range: ["Wall 2", 72], fridge: ["Wall 1", 18] };

describe("Auto Design never places a filler outside an exposed panel", () => {
  it.each([["plan d (Aero L, fridge 3 in off the wall)", PLAN_D], ["plan c (Palermo L, fridge 3 in off the wall)", PLAN_C], ["plan a (Aero U)", PLAN_A]] as const)("%s", (_name, plan) => {
    const { result, room } = build(plan);
    expect(fillersOutsideExposedPanels({ placed: result.placed, room, openings: result.openings })).toEqual([]);
    // the fridge assembly's own 1/2 in boards (inside the panels) are untouched
    const panels = result.placed.filter((i) => isPanelItem(i) && !isFillerItem(i));
    expect(panels.length).toBeGreaterThan(0);
  });

  it("plan d: the 2 3/4 in board between the wall and the fridge panel is gone, on both layers, and named on the review list", () => {
    const { result, room } = build(PLAN_D);
    const top = result.placed.filter((i) => cabinetWall(i, room) === "top");
    const onWallStart = top.filter((i) => isFillerItem(i) && wallRunOffset(i, "top", room) < 2.75 - 0.01);
    expect(onWallStart).toEqual([]);
    const rep = top.find((i) => /^REPV/.test(i.masterCode) && wallRunOffset(i, "top", room) < 4)!;
    expect(wallRunOffset(rep, "top", room)).toBeCloseTo(2.75, 2);
    expect(result.reviewFindings.some((f) => f.code === "filler-outside-exposed-panel-removed" && f.cabinetCode === "REPV2496")).toBe(true);
  });

  it("keeps fillers that sit between cabinets (existing filler logic intact)", () => {
    const { result, room } = build(PLAN_D);
    const fillers = result.placed.filter(isFillerItem);
    expect(fillers.length).toBeGreaterThan(0);
    for (const f of fillers) {
      const wall = cabinetWall(f, room);
      const start = wallRunOffset(f, wall, room);
      expect(start + wallRunSpan(f, wall, room)).toBeGreaterThan(start);
    }
  });
});
