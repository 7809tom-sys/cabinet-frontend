/**
 * Tom (Nov 15 2026, 7:13 PM CT), Palermo PGW / Torino TWP (USCD altaeuro frameless):
 *
 * 1. Frameless wall cabinets keep the standard 54" bottom like framed ones. A
 *    30-1/4" box is never lifted to a 94-1/4" top (that raise also fought the 54"
 *    reset in the Designer's mount effect, so `placed` never settled and the 3D
 *    view never showed a cabinet).
 * 2. The upper matches the base under it, any size; beside a window only the base
 *    the 3" clearance reaches gets a narrower stock box.
 * 3. 3/4" end panels on exposed ends, kept by the overlap repair, refused visibly
 *    (never a 0.75" overrun) when the run is already wall-length.
 *
 * Catalog rows are the live `design.placeableCabinets` / `design.surroundForFridge`
 * answers for styles 540004 (Palermo PGW) and 540001 (Torino TWP), Nov 15 2026.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/uscdFramelessLiveCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import {
  APPLIANCES,
  applianceAsDesignCabinet,
  cabinetWall,
  normalizeGlassStackersToParentFronts,
  normalizeOverSinkWallMounts,
  normalizeStandardWallMounts,
  normalizeWallOpenShelfMounts,
  normalizeWd18CountertopMounts,
  removeOverlappingPlacements,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import { alignFramelessWallCabinetTops, framelessWallTopLineFor } from "./framelessWallTopAlignment";
import { singleTopLineFor } from "./overRangeCompanion";
import { samePlacementsShallow } from "./samePlacements";
import {
  EXPOSED_SIDE_PANEL_REASON_PREFIX,
  exposedSidePanelNeeds,
  syncExposedSidePanelsForRun,
} from "./sidePanelForExposedSide";
import { catalogItemToExposedPanelStock, syncExposedSidePanels } from "./exposedSidePanels";
import {
  addCabinet,
  existingCabinetSku,
  existingCabinetTransform,
  shouldRenderSavedSceneCabinet,
  threeDRenderPlacements,
} from "@/components/design/InteractiveRoom3D";

type Pack = {
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  surround: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] };
};
const catalog = catalogFixture as unknown as Record<string, Pack>;
const STYLES = [["540004", "Palermo PGW"], ["540001", "Torino TWP"]] as const;
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
const SINK_WINDOW: WallOpening = { uid: "window", kind: "window", label: "Window", side: "right", offset: 42, width: 36, height: 36, sill: 42 } as WallOpening;
const PALETTE = APPLIANCES.filter((item) => /^(RANGE-30|DW-24|FRIDGE-36|MW-30|HOOD-30)$/.test(item.masterCode));

function build(styleId: string, window: boolean) {
  const pack = catalog[styleId]!;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 22 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 87 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 60 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: "none", skipDishwasher: true,
      sinkWindowCenter: window ? { wallLabel: "Wall 2", centerOffsetIn: 60 } : null,
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room: ROOM,
    openings: window ? [SINK_WINDOW] : [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: PALETTE.map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround.endPanels ?? [],
    panelCatalog: pack.accessory,
    tallCatalog: [],
    styleId: Number(styleId),
    makeUid: () => `${styleId}-${++uid}`,
  } as never) as { ok: boolean; message?: string; placed?: PlacedCabinet[]; openings?: WallOpening[] };
  expect(result.ok, result.message).toBe(true);
  return { placed: result.placed!, openings: result.openings ?? (window ? [SINK_WINDOW] : []) };
}

function row(placed: readonly PlacedCabinet[], wall: WallSide, layer: "base" | "wall") {
  return placed
    .filter((item) => item.placement === layer && cabinetWall(item, ROOM) === wall)
    .map((item) => ({ code: item.masterCode, start: wallRunOffset(item, wall, ROOM), width: wallRunSpan(item, wall, ROOM), bottom: item.mountBottom }))
    .sort((a, b) => a.start - b.start);
}

/** The Designer's mount effect (DesignTool) with its no-op bailout. */
function mountEffectLap(current: PlacedCabinet[], openings: WallOpening[]) {
  const next = normalizeGlassStackersToParentFronts(normalizeWallOpenShelfMounts(
    alignFramelessWallCabinetTops({
      placed: normalizeStandardWallMounts(normalizeWd18CountertopMounts(normalizeOverSinkWallMounts(current, openings, ROOM)), openings, ROOM),
      room: ROOM,
    }).placed, ROOM), ROOM);
  return samePlacementsShallow(current, next) ? current : next;
}

function panelCatalog(styleId: string) {
  return catalog[styleId]!.accessory.map((item) => ({
    id: item.id,
    masterCode: item.masterCode,
    constructionMethod: (item as { constructionMethod?: string | null }).constructionMethod ?? null,
  }));
}

describe.each(STYLES)("%s (%s): frameless wall height, matching uppers, end panels", (styleId) => {
  it("keeps every ordinary frameless upper on the standard 54-inch bottom (no 94-1/4 raise)", () => {
    const { placed } = build(styleId, false);
    const uppers = placed.filter((item) => item.placement === "wall" && /^W\d/.test(item.masterCode) && !item.overRangeMicrowaveBridge && item.refrigeratorAssemblyRole !== "bridge" && !/24$/.test(item.masterCode));
    expect(uppers.length).toBeGreaterThan(3);
    for (const upper of uppers.filter((item) => Number(item.mountBottom) !== 72)) {
      expect(upper.mountBottom, `${upper.masterCode}`).toBe(54);
    }
    // The wall's top line is the run's real top (54 + 30-1/4), not a forced 94-1/4.
    expect(framelessWallTopLineFor(placed, ROOM, "right")).toBeCloseTo(84.25, 5);
    expect(singleTopLineFor({ wallCatalog: catalog[styleId]!.wall, wallCabinetHeightIn: 30 })).toBeCloseTo(84.25, 5);
    expect(singleTopLineFor({ wallCatalog: catalog[styleId]!.wall, wallCabinetHeightIn: 40 })).toBeCloseTo(94.25, 5);
  });

  it("never lifts a 30-1/4-inch frameless box, and lowers a saved 64-inch one back to 54", () => {
    const { placed, openings } = build(styleId, false);
    const raised = placed.map((item) => item.placement === "wall" && item.mountBottom === 54 ? { ...item, mountBottom: 64 } : item);
    const settled = mountEffectLap(raised, openings);
    expect(settled.filter((item) => item.mountBottom === 64)).toEqual([]);
    const aligned = alignFramelessWallCabinetTops({ placed: settled, room: ROOM });
    expect(aligned.placed).toBe(settled);
    expect(aligned.aligned).toEqual([]);
  });

  it("the Designer mount effect settles: a second lap returns the same array (no render loop)", () => {
    const { placed, openings } = build(styleId, true);
    const first = mountEffectLap(placed, openings);
    const second = mountEffectLap(first, openings);
    expect(second).toBe(first);
    expect(mountEffectLap(second, openings)).toBe(second);
  });

  it("matches the upper to the base under it (B30 -> W3030, B12 -> W1230)", () => {
    const { placed } = build(styleId, false);
    const uppers = row(placed, "right", "wall");
    expect(uppers.find((item) => item.start === 78)?.code).toBe("W3030");
    expect(uppers.find((item) => item.start === 108)?.code).toBe("W1230");
  });

  it("beside the sink window only the base the 3-inch clearance reaches gets a narrower box", () => {
    const { placed } = build(styleId, true);
    const uppers = row(placed, "right", "wall");
    // B30 @78 + B12 @108, window 42–78 with 3" clearance to 81.
    expect(uppers.find((item) => item.code === "W1230")?.start).toBe(108);
    expect(uppers.find((item) => item.code === "W2730")?.start).toBe(81);
    expect(uppers.some((item) => item.code === "W3030" || (item.code === "W0930" && item.start > 100))).toBe(false);
  });

  it("does not read a wider box on a side wall as a deeper one (no invented smaller-neighbour panel)", () => {
    const { placed } = build(styleId, false);
    const needs = exposedSidePanelNeeds({ placed, room: ROOM, catalog: panelCatalog(styleId) });
    const b30 = placed.find((item) => item.masterCode === "B30" && cabinetWall(item, ROOM) === "right");
    expect(b30).toBeTruthy();
    expect(needs.filter((need) => need.hostUid === b30!.uid)).toEqual([]);
    // No tall TEP sheet is ever chosen for an upper.
    expect(needs.filter((need) => need.placement === "wall" && /^TEP|^BP9/.test(need.selection.masterCode))).toEqual([]);
  });

  it("seats the line's 3/4-inch WEP panel on the open window side and keeps every auto board through the overlap repair", () => {
    const { placed, openings } = build(styleId, true);
    const settled = mountEffectLap(placed, openings);
    const style = { id: Number(styleId), styleCode: styleId === "540004" ? "PGW" : "TWP", ourName: styleId === "540004" ? "Palermo PGW" : "Torino TWP", isFrameless: true };
    const stock = catalog[styleId]!.accessory.flatMap((item) => {
      const entry = catalogItemToExposedPanelStock(item as never, 50);
      return entry ? [entry] : [];
    });
    // Qualified engine: open run ends and window sides.
    const qualified = syncExposedSidePanels({ placed: settled, room: ROOM, openings, catalog: stock, qualifiedOnly: true, doorStyleFor: () => style as never, pricesReady: true, priceFor: () => 50 } as never);
    const w2730 = settled.find((item) => item.masterCode === "W2730");
    const windowSide = qualified.placed.find((item) => item.autoPlacedForUid === w2730?.uid);
    expect(windowSide?.masterCode).toBe("WEP1530");
    // Exposed-side engine: a 40-1/4" box beside a 30-1/4" one on a side wall
    // shows 10" of side; that board carries its reason so nothing deletes it.
    const wall = catalog[styleId]!.wall;
    const pick = (code: string) => wall.find((item) => item.masterCode === code)!;
    let n = 0;
    const upper = (code: string, along: number): PlacedCabinet => {
      const r = pick(code);
      const width = Number(r.width);
      return {
        uid: `x${++n}`, cabinetId: r.id, masterCode: r.masterCode, description: r.description, placement: "wall",
        ...wallPlacementAt(along, width, Number(r.depth), "left", ROOM),
        width, depth: Number(r.depth), height: Number(r.height), mountBottom: 54,
        constructionMethod: (r as { constructionMethod?: string }).constructionMethod ?? null, styleId: Number(styleId),
      } as PlacedCabinet;
    };
    const sideWall = [upper("W3040", 30), upper("W3030", 60)];
    const plan = syncExposedSidePanelsForRun({ placed: sideWall, room: ROOM, catalog: panelCatalog(styleId), styleId: Number(styleId), makeUid: () => `panel-${++n}` });
    expect(plan.additions.length).toBe(1);
    for (const board of plan.additions) {
      expect(board.width).toBeCloseTo(0.75, 5);
      expect(board.autoPlacedReason).toBe(`${EXPOSED_SIDE_PANEL_REASON_PREFIX}smaller-neighbour`);
      expect(board.masterCode).toBe("WEP1542");
    }
    const repaired = removeOverlappingPlacements(plan.placed, ROOM);
    expect(repaired.placed.some((item) => item.uid === plan.additions[0]!.uid)).toBe(true);
    const qualifiedAgain = syncExposedSidePanels({ placed: [...repaired.placed, ...qualified.placed], room: ROOM, openings, catalog: stock, qualifiedOnly: true, doorStyleFor: () => style as never, pricesReady: true, priceFor: () => 50 } as never);
    expect(qualifiedAgain.placed.some((item) => item.uid === plan.additions[0]!.uid)).toBe(true);
    expect(qualifiedAgain.placed.some((item) => item.uid === windowSide!.uid)).toBe(true);
    // The Designer effects settle: a few passes later nothing more changes.
    let current = qualified.placed;
    let settledPass = -1;
    for (let pass = 0; pass < 4; pass += 1) {
      const next = syncExposedSidePanelsForRun({ placed: current, room: ROOM, catalog: panelCatalog(styleId), styleId: Number(styleId), makeUid: () => `again-${pass}` });
      if (next.placed === current) { settledPass = pass; break; }
      current = removeOverlappingPlacements(next.placed, ROOM).placed;
    }
    expect(settledPass).toBeGreaterThanOrEqual(0);
  });

  it("refuses a panel visibly instead of overrunning a wall-length run by 0.75 inch", () => {
    // A 120" right wall filled wall to wall with uppers and an exposed, shorter
    // neighbour in the middle: the board has nowhere to go.
    const wall = catalog[styleId]!.wall;
    const pick = (code: string) => wall.find((item) => item.masterCode === code)!;
    let n = 0;
    const upper = (code: string, along: number, height?: number): PlacedCabinet => {
      const r = pick(code);
      const width = Number(r.width);
      return {
        uid: `u${++n}`, cabinetId: r.id, masterCode: r.masterCode, description: r.description, placement: "wall",
        ...wallPlacementAt(along, width, Number(r.depth), "right", ROOM),
        width, depth: Number(r.depth), height: height ?? Number(r.height), mountBottom: 54,
        constructionMethod: (r as { constructionMethod?: string }).constructionMethod ?? null, styleId: Number(styleId),
      } as PlacedCabinet;
    };
    const run = [upper("W3640", 0), upper("W3030", 36), upper("W3040", 66), upper("W2440", 96)];
    const plan = syncExposedSidePanelsForRun({ placed: run, room: ROOM, catalog: panelCatalog(styleId), styleId: Number(styleId), makeUid: () => `p${++n}` });
    expect(plan.fitProblems).toEqual([]);
    expect(plan.additions).toEqual([]);
    expect(plan.skipped.length).toBeGreaterThan(0);
    expect(plan.skipped.some((entry) => /no free 3\/4″|already full length/.test(entry.why))).toBe(true);
  });

  it("builds every cabinet of the Auto Design kitchen in 3D", () => {
    for (const window of [false, true]) {
      const { placed, openings } = build(styleId, window);
      const settled = mountEffectLap(placed, openings);
      const rendered = threeDRenderPlacements(settled, ROOM, openings);
      const root = new THREE.Group();
      let drawn = 0;
      for (const cabinet of rendered) {
        if (!shouldRenderSavedSceneCabinet(cabinet, rendered)) continue;
        expect(() => addCabinet(root, existingCabinetSku(cabinet, ROOM, rendered), null, { back: 3, left: 3, right: 3, front: 3 }, ROOM.width, ROOM.depth, "#f2f0ea", "#e9e7e2", undefined, existingCabinetTransform(cabinet, ROOM, rendered)), cabinet.masterCode).not.toThrow();
        drawn += 1;
      }
      expect(drawn).toBeGreaterThan(15);
      expect(root.children.length).toBeGreaterThan(15);
    }
  }, 60000);
});

describe("samePlacementsShallow", () => {
  it("treats rebuilt-but-equal rows as the same and any changed field as different", () => {
    const a = [{ uid: "a", masterCode: "W3030", mountBottom: 54 } as PlacedCabinet];
    expect(samePlacementsShallow(a, [{ ...a[0]! }])).toBe(true);
    expect(samePlacementsShallow(a, [{ ...a[0]!, mountBottom: 64 }])).toBe(false);
    expect(samePlacementsShallow(a, [])).toBe(false);
  });
});
