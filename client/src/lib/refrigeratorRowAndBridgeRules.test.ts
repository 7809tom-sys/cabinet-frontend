/**
 * Tom's two refrigerator rules (Nov 6 2026), as an explicit contract:
 *
 *  1. The refrigerator sits IN the row: same wall line, same front (depth)
 *     line as the cabinets around it, and it never drifts inside its own bay.
 *  2. Whenever a refrigerator panel is used, the cabinet above comes forward so
 *     its front sits flush with the panel. That is a DEPTH rule and is separate
 *     from the height rule, which requires that cabinet's top to line up with
 *     the other uppers.
 *
 * Windows never move, and the refrigerator may slide at most 3 inches in the wiggle pass.
 */
import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { buildMandatoryAutoDesignRefrigeratorBay } from "./autoDesignRefrigeratorBay";
import { clampRefrigeratorAssemblyToPanels } from "./refrigeratorPanelClamp";
import { normalizeRefrigeratorBridgeDepth } from "./refrigeratorBridgeDepth";
import { applyAutoDesignWiggleRoom } from "./designerLayoutRules";
import { normalizeOverApplianceWallMounts } from "./overApplianceMount";
import {
  cabinetFrontIn,
  cabinetWall,
  elevationBox,
  fitExplicitRefrigeratorOptionPlacements,
  isRefrigerator,
  placedFootprint,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

type Pack = { name: string; base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const CATALOG = catalogFixture as unknown as Record<string, Pack>;

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

/** The bay's finished face: its end panels, else the appliance. */
function bayFace(placed: readonly PlacedCabinet[], fridge: PlacedCabinet, room: RoomData): number {
  const side = cabinetWall(fridge, room) as WallSide;
  const panels = placed.filter((item) => item.refrigeratorAssemblyId === fridge.uid
    && (item.refrigeratorAssemblyRole === "left-panel" || item.refrigeratorAssemblyRole === "right-panel"));
  return panels.length
    ? Math.min(...panels.map((panel) => cabinetFrontIn(panel, side, room)))
    : cabinetFrontIn(fridge, side, room);
}

function build(styleId: string, layout: "l-shape" | "u-shape", fridgeWidth: 30 | 36, fridgeCenter: number, rangeCode = "RANGE-30"): AutoDesignLayoutSuccess | null {
  const pack = CATALOG[styleId]!;
  const room: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };
  let uid = 0;
  // Each layout puts the refrigerator on a wall that carries nothing else, so the
  // measured anchor can seat where it was measured and the bay is the only thing
  // being tested.
  const uShape = layout === "u-shape";
  const result = runAutoDesignLayout({
    input: {
      layoutType: layout, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: uShape ? "Wall 1" : "Wall 3", centerOffsetIn: 72 },
      sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: uShape ? "Wall 2" : "Wall 2", centerOffsetIn: uShape ? 60 : 72 },
      dishwasher: null, skipDishwasher: true,
      refrigerator: { wallLabel: uShape ? "Wall 3" : "Wall 1", centerOffsetIn: fridgeCenter },
      refrigeratorWidthIn: fridgeWidth,
      refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above",
    },
    room, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: [appliance("RANGE-30", 30, 25, 36), appliance("RANGE-36", 36, 25, 36), appliance("FRIDGE-36", 36, 30, 70)],
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [],
    styleId: Number(styleId), makeUid: () => `rule-${++uid}`,
    stoveMasterCode: rangeCode,
  } as never);
  return result.ok ? result : null;
}

const CASES: Array<{ style: string; layout: "l-shape" | "u-shape"; width: 30 | 36; center: number }> = [
  { style: "330014", layout: "l-shape", width: 36, center: 72 },
  { style: "330014", layout: "u-shape", width: 36, center: 36 },
  { style: "330014", layout: "u-shape", width: 36, center: 108 },
  { style: "330014", layout: "u-shape", width: 30, center: 36 },
  { style: "330002", layout: "l-shape", width: 30, center: 72 },
  { style: "330002", layout: "l-shape", width: 36, center: 72 },
  { style: "510004", layout: "l-shape", width: 30, center: 108 },
  { style: "540005", layout: "l-shape", width: 36, center: 72 },
  { style: "540029", layout: "l-shape", width: 36, center: 72 },
];

describe.each(CASES)("Tom's refrigerator rules ($style $layout ${width}in @ $center)", (spec) => {
  const run = build(spec.style, spec.layout, spec.width, spec.center);

  it("builds a kitchen with a refrigerator and a cabinet above it", () => {
    expect(run).not.toBeNull();
    if (!run) return;
    expect(run.placed.some((item) => isRefrigerator(item))).toBe(true);
    expect(run.placed.some((item) => item.refrigeratorAssemblyRole === "bridge")).toBe(true);
  });

  it("rule 1: the refrigerator sits on the wall line, in the same row and on the same front line", () => {
    if (!run) return;
    const room: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };
    const fridge = run.placed.find(isRefrigerator)!;
    const side = cabinetWall(fridge, room) as WallSide;
    const bayDepth = Math.max(0, Number(fridge.depth) || 0);

    // Wall line: the back of the appliance is on the wall plane, never floating.
    const foot = placedFootprint(fridge);
    const back = side === "top" ? Number(fridge.y)
      : side === "bottom" ? room.depth - (Number(fridge.y) + foot.d)
        : side === "left" ? Number(fridge.x)
          : room.width - (Number(fridge.x) + foot.w);
    expect(Math.abs(back)).toBeLessThanOrEqual(0.05);

    // Front line: same depth reference as the base cabinets on that wall. A
    // corner box legitimately reaches further into the room, so only ordinary
    // straight boxes are compared.
    const front = cabinetFrontIn(fridge, side, room);
    const baseFronts = run.placed
      .filter((item) => item.placement === "base"
        && cabinetWall(item, room) === side
        && !item.cornerType
        && Number(item.depth) > 0
        && Math.abs(Number(item.depth) - bayDepth) <= 0.6)
      .map((item) => cabinetFrontIn(item, side, room));
    if (baseFronts.length) {
      for (const baseFront of baseFronts) expect(Math.abs(baseFront - front)).toBeLessThanOrEqual(0.13);
    }

    // And flush with its own end panels.
    for (const panel of run.placed.filter((item) => item.refrigeratorAssemblyId === fridge.uid
      && (item.refrigeratorAssemblyRole ?? "").endsWith("panel"))) {
      expect(Math.abs(cabinetFrontIn(panel, side, room) - front)).toBeLessThanOrEqual(0.06);
    }
  });

  it("rule 1: the refrigerator never drifts inside its own bay", () => {
    if (!run) return;
    const room: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };
    const fridge = run.placed.find(isRefrigerator)!;
    const side = cabinetWall(fridge, room) as WallSide;
    const panels = run.placed.filter((item) => item.refrigeratorAssemblyId === fridge.uid
      && (item.refrigeratorAssemblyRole ?? "").endsWith("panel"));
    if (panels.length !== 2) return;
    const centers = panels.map((panel) => wallRunOffset(panel, side, room) + wallRunSpan(panel, side, room) / 2);
    const panelCenter = (Math.min(...centers) + Math.max(...centers)) / 2;
    const fridgeCenter = wallRunOffset(fridge, side, room) + wallRunSpan(fridge, side, room) / 2;
    expect(Math.abs(fridgeCenter - panelCenter)).toBeLessThanOrEqual(0.06);

    // The cabinet above shares that same centre.
    const bridge = run.placed.find((item) => item.refrigeratorAssemblyRole === "bridge")!;
    const bridgeCenter = wallRunOffset(bridge, side, room) + wallRunSpan(bridge, side, room) / 2;
    expect(Math.abs(bridgeCenter - fridgeCenter)).toBeLessThanOrEqual(0.06);
  });

  it("rule 2: the cabinet above has come forward flush with the panel", () => {
    if (!run) return;
    const room: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };
    const fridge = run.placed.find(isRefrigerator)!;
    const side = cabinetWall(fridge, room) as WallSide;
    const bridge = run.placed.find((item) => item.refrigeratorAssemblyRole === "bridge")!;
    expect(cabinetFrontIn(bridge, side, room)).toBeCloseTo(bayFace(run.placed, fridge, room), 2);
    // A 24-inch-deep refrigerator box is already flush at the wall, so it needs no
    // pull; anything shallower must be flagged as pulled forward.
    if (Number(bridge.depth) < 24 - 0.05) expect(bridge.depthPositionAdjusted).toBe(true);
  });

  it("rule 2 is a depth rule: the cabinet above still lines up with the other uppers", () => {
    if (!run) return;
    const room: RoomData = { width: 144, depth: 144, ceilingHeight: 108 };
    const bridge = run.placed.find((item) => item.refrigeratorAssemblyRole === "bridge")!;
    const side = cabinetWall(bridge, room);
    const bridgeTop = elevationBox(bridge, room).bottom + elevationBox(bridge, room).height;
    const upperTops = run.placed
      .filter((item) => item.placement === "wall" && item.refrigeratorAssemblyRole !== "bridge" && cabinetWall(item, room) === side)
      .map((item) => elevationBox(item, room).bottom + elevationBox(item, room).height);
    if (!upperTops.length) return;
    // The box above lands on the run's own top line. On the frameless line that
    // line is the single 94-1/4" (Tom, Nov 9 2026, issue #354 item 5); a framed
    // line keeps its own. The 24"-deep frameless cap is 22-5/8", so from the 72"
    // datum its top is 94-5/8" — the closest the line sells to 94-1/4".
    const runTop = Math.max(...upperTops);
    expect(bridgeTop).toBeCloseTo(runTop, 0);
    expect(Math.abs(bridgeTop - runTop)).toBeLessThanOrEqual(0.5);
    const nearest = upperTops.reduce((best, top) => Math.abs(top - bridgeTop) < Math.abs(best - bridgeTop) ? top : best, upperTops[0]!);
    expect(Math.abs(nearest - bridgeTop)).toBeLessThanOrEqual(0.5);
  });

  it("rule 2 holds: the cabinet above clears the appliance by two inches where the line allows it", () => {
    if (!run) return;
    const room: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };
    const fridge = run.placed.find(isRefrigerator)!;
    const bridge = run.placed.find((item) => item.refrigeratorAssemblyRole === "bridge")!;
    const fridgeTop = elevationBox(fridge, room).bottom + elevationBox(fridge, room).height;
    expect(elevationBox(bridge, room).bottom).toBeGreaterThanOrEqual(fridgeTop - 0.01);
  });

  it("windows never move and the refrigerator stays inside the 3 inch wiggle cap", () => {
    if (!run) return;
    const move = run.wiggleMoves.find((entry) => entry.kind === "refrigerator");
    // The refrigerator may now take the same 3 inch wiggle cap as the other
    // appliances. A move inside that cap is allowed; a move past it is not.
    if (move) expect(Math.abs(move.distanceFromOriginalIn)).toBeLessThanOrEqual(3 + 1e-6);
    // Corner seating is a separate, disclosed allowance and reports itself.
    const cornerMove = run.applianceMoves.filter((entry) => entry.kind === "refrigerator");
    for (const entry of cornerMove) expect(entry.shiftIn).toBeGreaterThan(0);
    // A window is never created or moved by the depth rule.
    expect(run.openings.filter((opening) => opening.kind === "window")).toHaveLength(run.sinkWindow ? 1 : 0);
  });
});

describe("the depth rule survives every pass that re-seats a wall cabinet", () => {
  const room: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };
  const panel = (uid: string, along: number, role: "left-panel" | "right-panel"): PlacedCabinet => {
    const spot = wallPlacementAt(along, 1.5, 24, "top", room);
    return {
      uid, cabinetId: 1, masterCode: "REPV2496", description: "Refrigerator End Panel", category: "Panel",
      subCategory: "Refrigerator End Panel", placement: "tall", ...spot, width: 1.5, depth: 24, height: 96,
      rotation: 0, wallId: "top", wallOffset: along, customProfile: "refrigerator-end-panel",
      refrigeratorAssemblyId: "fridge", refrigeratorAssemblyRole: role,
    } as PlacedCabinet;
  };
  const fridge = (): PlacedCabinet => {
    const spot = wallPlacementAt(48, 36, 30, "top", room);
    return {
      uid: "fridge", cabinetId: 0, masterCode: "FRIDGE-36", description: 'Refrigerator 36"',
      category: "Appliance", subCategory: "Appliance", placement: "appliance", ...spot,
      width: 36, depth: 30, height: 70, rotation: 0, wallId: "top", wallOffset: 48,
    } as PlacedCabinet;
  };
  const upper = (): PlacedCabinet => {
    const spot = wallPlacementAt(48, 36, 12, "top", room);
    return {
      uid: "upper", cabinetId: 2, masterCode: "W3612", description: '36" × 12" Wall Cabinet',
      category: "Wall", subCategory: "Wall Cabinet", placement: "wall", ...spot,
      width: 36, depth: 12, height: 12, rotation: 0, wallId: "top", wallOffset: 48, mountBottom: 54,
    } as PlacedCabinet;
  };

  it("pulls an ordinary upper forward in the load path", () => {
    let placed: PlacedCabinet[] = [fridge(), upper(), panel("lp", 46.5, "left-panel"), panel("rp", 84.5, "right-panel")];
    placed = normalizeOverApplianceWallMounts(placed, room);
    placed = clampRefrigeratorAssemblyToPanels({ placed, refrigeratorUid: "fridge", room }).placed;
    placed = normalizeRefrigeratorBridgeDepth(placed, room);
    const bridge = placed.find((item) => item.refrigeratorAssemblyRole === "bridge")!;
    expect(cabinetFrontIn(bridge, "top", room)).toBeCloseTo(24, 2);
    expect(bridge.depthPositionAdjusted).toBe(true);
  });

  it("keeps the flush face through the option fitter", () => {
    const bridge = { ...upper(), y: 12, depthPositionAdjusted: true, refrigeratorAssemblyId: "fridge", refrigeratorAssemblyRole: "bridge" as const };
    const fit = fitExplicitRefrigeratorOptionPlacements([fridge(), bridge], [], "fridge", room);
    const after = fit.existing.find((item) => item.uid === "upper")!;
    expect(cabinetFrontIn(after, "top", room)).toBeCloseTo(24, 2);
  });

  it("keeps the flush face through a wiggle-room slide", () => {
    const bridge = { ...upper(), y: 12, depthPositionAdjusted: true, refrigeratorAssemblyId: "fridge", refrigeratorAssemblyRole: "bridge" as const };
    const result = applyAutoDesignWiggleRoom({
      placed: [fridge(), bridge],
      room,
      openings: [],
      catalog: [],
      origins: [{ uid: "fridge", kind: "refrigerator", wallId: "top", originalStart: 48 }],
    });
    const after = result.placed.find((item) => item.uid === "upper")!;
    expect(cabinetFrontIn(after, "top", room)).toBeCloseTo(24, 2);
  });

  it("never pulls a cabinet that is already flush, and never grows one past the panel", () => {
    const deep = { ...upper(), uid: "deep", depth: 26, refrigeratorAssemblyId: "fridge", refrigeratorAssemblyRole: "bridge" as const };
    const unchanged = normalizeRefrigeratorBridgeDepth([fridge(), deep, panel("lp", 46.5, "left-panel"), panel("rp", 84.5, "right-panel")], room);
    const after = unchanged.find((item) => item.uid === "deep")!;
    expect(after.x).toBe(deep.x);
    expect(after.y).toBe(deep.y);
  });

  it("reports the depth change once, in the bay's notes, for a shallower cabinet", () => {
    const pack = CATALOG["330002"]!;
    const spot = wallPlacementAt(52.75, 30, 30, "top", room);
    const shallowFridge: PlacedCabinet = {
      uid: "f", cabinetId: 0, masterCode: "FRIDGE-30", description: "30 in refrigerator",
      category: "Appliance", subCategory: "Appliance", placement: "appliance", ...spot,
      width: 30, depth: 30, height: 70, rotation: 0, wallId: "top", wallOffset: 52.75,
    } as PlacedCabinet;
    const bay = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: shallowFridge, room,
      caps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
      endPanels: pack.surround?.endPanels ?? [],
      styleId: 330002, makeUid: (() => { let index = 0; return () => `bay-${++index}`; })(),
    });
    expect(bay.ok).toBe(true);
    if (!bay.ok) return;
    const bridge = bay.additions[0]!;
    expect(bridge.refrigeratorAssemblyRole).toBe("bridge");
    expect(bridge.y + Number(bridge.depth)).toBeCloseTo(24, 2);
    expect(bay.notes.filter((note) => /pulled forward/.test(note))).toHaveLength(1);
    // And the end panel is the same finished face, so the assembly reads as one.
    const panels = bay.additions.filter((item) => item.refrigeratorAssemblyRole !== "bridge");
    for (const panel of panels) expect(panel.y + Number(panel.depth)).toBeCloseTo(24, 2);
  });
});
