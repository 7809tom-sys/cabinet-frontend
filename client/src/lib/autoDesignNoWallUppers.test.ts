import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { buildAutoDesignWallCabinets } from "./autoDesignWallCabinets";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import {
  cabinetHasWallOrPeninsulaSupport, cabinetInsideBounds, dropWallCabinetsWithoutWall,
} from "./designerBounds";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetRestsOnRealWall, cabinetWall, glassStackerParentPlacement, peninsulaRunById,
  DEFAULT_ROOM, type PlacedCabinet, type RoomData,
} from "./design";

// Tom, owner voice, Nov 20 2026 ("All"): an upper needs a real wall behind it. The first Auto Design pass keeps the peninsula free of uppers,
// but the second pass (DesignTool continue / corner stage) re-runs buildAutoDesignWallCabinets once the peninsula bases exist, and it put a
// wall cabinet over every base, the peninsula included, floating with no wall.
const pack = (matrix as any)["330014"];
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function build(opts: { budget: boolean; layoutType?: string; peninsula: boolean }) {
  let uid = 0;
  return runAutoDesignLayout({
    input: { layoutType: opts.layoutType ?? "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36, stove: { wallLabel: "Wall 1", centerOffsetIn: 82 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 78 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular", dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: opts.budget ? ["budget-friendly"] : [],
        islandOrPeninsula: opts.peninsula ? "peninsula" : "none", peninsulaSide: opts.peninsula ? "left" : null,
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } } } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])], styleId: 330014, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

/** What DesignTool.tsx does on the continue path: the room now owns the peninsula runs, the uppers are rebuilt from the lowers. */
function secondPass(result: any) {
  const room = { ...DEFAULT_ROOM, ...ROOM, peninsulaRuns: result.peninsulaRuns } as RoomData;
  let uid = 9000;
  const upper = buildAutoDesignWallCabinets({
    placed: result.placed, room, openings: [], catalog: pack.wall, wallCabinetHeightIn: 30, styleId: 330014,
    makeUid: () => `u-${++uid}`, closeSeams: true,
  });
  return { room, upper };
}

const onPeninsula = (item: PlacedCabinet, room: RoomData) => item.placement === "wall" && (
  !!peninsulaRunById(room, item.wallId) || !!item.peninsulaSide || !!item.islandFace);

describe("an upper needs a real wall behind it (no uppers over a peninsula)", () => {
  // Engine runs use budget mode: main's standard mode currently throws "inches is not defined" (autoDesignLayout.ts:2437, the
  // refrigerator-opening finding) on this room, which is fixed on its own branch. The second pass under test (buildAutoDesignWallCabinets)
  // does not read the mode, so the budget run exercises exactly the same code as standard.
  for (const budget of [true]) {
    it(`${budget ? "budget" : "standard"} L-shape with a peninsula: the rebuilt uppers never land on the peninsula run`, () => {
      const result = build({ budget, peninsula: true });
      expect(result.ok).toBe(true);
      expect(result.peninsulaRuns.length).toBeGreaterThan(0);
      const { room, upper } = secondPass(result);
      expect(result.placed.some((item: PlacedCabinet) => item.placement === "base" && !!peninsulaRunById(room, item.wallId))).toBe(true);
      expect(upper.additions.filter((item) => onPeninsula(item, room))).toEqual([]);
      expect(upper.placed.filter((item) => onPeninsula(item, room))).toEqual([]);
      expect(upper.placed.filter((item) => item.placement === "wall" && !cabinetInsideBounds(item, room))).toEqual([]);
    });
  }

  it("budget U-shape with a peninsula: the rebuilt uppers never land on the peninsula run", () => {
    const result = build({ budget: true, layoutType: "u-shape", peninsula: true });
    expect(result.ok).toBe(true);
    const { room, upper } = secondPass(result);
    expect(upper.additions.filter((item) => onPeninsula(item, room))).toEqual([]);
    expect(upper.placed.filter((item) => onPeninsula(item, room))).toEqual([]);
  });

  it("the engine's own result has no upper over the peninsula and nothing out of bounds (budget)", () => {
    for (const budget of [true]) {
      const result = build({ budget, peninsula: true });
      const room = { ...DEFAULT_ROOM, ...ROOM, peninsulaRuns: result.peninsulaRuns } as RoomData;
      for (const item of result.placed as PlacedCabinet[]) {
        if (item.placement === "wall") expect(cabinetHasWallOrPeninsulaSupport(item, room), `${budget} ${item.masterCode} ${item.wallId}`).toBe(true);
        expect(cabinetInsideBounds(item, room), `${budget} ${item.masterCode} ${item.wallId}`).toBe(true);
      }
    }
  });

  it("a free-standing peninsula base has no upper projected over it, while the same base on a wall does", () => {
    const result = build({ budget: true, peninsula: true });
    const room = { ...DEFAULT_ROOM, ...ROOM, peninsulaRuns: result.peninsulaRuns } as RoomData;
    const peninsulaBase = (result.placed as PlacedCabinet[]).find((item) => item.placement === "base" && !!peninsulaRunById(room, item.wallId))!;
    const wallBase = (result.placed as PlacedCabinet[]).find((item) => item.placement === "base" && item.wallId && !peninsulaRunById(room, item.wallId))!;
    expect(cabinetRestsOnRealWall(peninsulaBase, room)).toBe(false);
    expect(cabinetRestsOnRealWall(wallBase, room)).toBe(true);
    expect(cabinetHasWallOrPeninsulaSupport(peninsulaBase, room)).toBe(true);
    const upper = buildAutoDesignWallCabinets({
      placed: [peninsulaBase], room, openings: [], catalog: pack.wall, wallCabinetHeightIn: 30, styleId: 330014, makeUid: () => "x", closeSeams: true,
    });
    expect(upper.additions).toEqual([]);
  });

  it("dropWallCabinetsWithoutWall removes only the floating upper, never a base, and reports it", () => {
    const result = build({ budget: true, peninsula: true });
    const room = { ...DEFAULT_ROOM, ...ROOM, peninsulaRuns: result.peninsulaRuns } as RoomData;
    const placed = result.placed as PlacedCabinet[];
    const peninsulaBase = placed.find((item) => item.placement === "base" && !!peninsulaRunById(room, item.wallId))!;
    const realUpper = placed.find((item) => item.placement === "wall")!;
    const floating = { ...realUpper, uid: "floating", wallId: peninsulaBase.wallId, wallOffset: peninsulaBase.wallOffset, peninsulaSide: peninsulaBase.peninsulaSide, x: peninsulaBase.x, y: peninsulaBase.y, rotation: peninsulaBase.rotation } as PlacedCabinet;
    const out = dropWallCabinetsWithoutWall([...placed, floating], room);
    expect(out.dropped.map((item) => item.uid)).toEqual(["floating"]);
    expect(out.placed.some((item) => item.uid === peninsulaBase.uid)).toBe(true);
    expect(out.placed.filter((item) => item.placement === "wall").length).toBe(placed.filter((item) => item.placement === "wall").length);
    // The kept list is the same list when nothing is floating.
    expect(dropWallCabinetsWithoutWall(placed, room).dropped).toEqual([]);
  });

  it("a wall cabinet that left the room is not supported (the out-of-bounds glass stacker case)", () => {
    const result = build({ budget: true, peninsula: false });
    const room = { ...DEFAULT_ROOM, ...ROOM } as RoomData;
    const upper = (result.placed as PlacedCabinet[]).find((item) => item.placement === "wall")!;
    expect(cabinetHasWallOrPeninsulaSupport(upper, room)).toBe(true);
    const out = { ...upper, uid: "oob", x: room.width + 40, y: -60 } as PlacedCabinet;
    expect(cabinetHasWallOrPeninsulaSupport(out, room)).toBe(false);
    expect(dropWallCabinetsWithoutWall([upper, out], room).dropped.map((item) => item.uid)).toEqual(["oob"]);
  });

  it("a glass stacker never takes a peninsula upper as its parent", () => {
    const result = build({ budget: true, peninsula: true });
    const room = { ...DEFAULT_ROOM, ...ROOM, peninsulaRuns: result.peninsulaRuns } as RoomData;
    const placed = result.placed as PlacedCabinet[];
    const peninsulaBase = placed.find((item) => item.placement === "base" && !!peninsulaRunById(room, item.wallId))!;
    const realUpper = placed.find((item) => item.placement === "wall" && item.width >= 12)!;
    const floatingParent = { ...realUpper, uid: "floating-parent", wallId: peninsulaBase.wallId, wallOffset: peninsulaBase.wallOffset, peninsulaSide: peninsulaBase.peninsulaSide, x: peninsulaBase.x, y: peninsulaBase.y, rotation: peninsulaBase.rotation } as PlacedCabinet;
    const stacker = { ...realUpper, uid: "stk", masterCode: "WDC1218GD", description: "Glass stacker", height: 12 } as PlacedCabinet;
    const res = glassStackerParentPlacement(stacker, [floatingParent], room, null, { anyWall: true });
    expect(res.ok && (res as any).parent?.uid === "floating-parent").toBe(false);
    expect(cabinetWall(floatingParent, room)).toBe(peninsulaBase.wallId);
  });
});
