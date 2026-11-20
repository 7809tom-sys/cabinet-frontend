import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { ECONOMIC_CORNER_BASE_NOTE, ECONOMIC_CORNER_LABEL, ECONOMIC_CORNER_WALL_NOTE, isEconomicCornerFiller } from "./autoDesignEconomyCorner";
import { applyDesignerLayoutRules } from "./designerLayoutRules";
import { auditFillerPlacements, fillerRuleViolation } from "./fillerPlacementRule";
import { threeDRenderPlacements } from "@/components/design/InteractiveRoom3D";
import {
  appliancesForRoom, applianceAsDesignCabinet, countertopSurfacePlanPolygon, countertopSurfaces, wallPlacementAt,
  wallRunOffset, wallRunSpan, DEFAULT_ROOM,
  type CountertopSurface, type PlacedCabinet, type RoomData, type WallOpening,
} from "./design";

// Budget economic corner (Tom, chat, Nov 19 2026, 5:49 PM CT, "please make a pr"). The engine seats a 24" void + one 3" mitered filler per leg
// (base and upper). fillerRuleViolation used to flag the board that faces the open void as "on-open-side-face", so applyDesignerLayoutRules
// and the 3D render deleted it, and the countertop then stopped at the filler edge (no top over the corner, no miter).
const pack = (matrix as any)["330014"];
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
const WINDOW: WallOpening = { uid: "w1", kind: "window", label: "Window", side: "right", offset: 60, width: 36, height: 48, sill: 42 } as WallOpening;

function build(construction: "old" | "new") {
  let uid = 0;
  return runAutoDesignLayout({
    input: { layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36, stove: { wallLabel: "Wall 1", centerOffsetIn: 82 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 78 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular", dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction, preferences: ["budget-friendly"], islandOrPeninsula: "none", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } } } as never,
    room: ROOM, openings: [WINDOW], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])], styleId: 330014, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

function afterDesignerRules(placed: PlacedCabinet[]): PlacedCabinet[] {
  let uid = 5000;
  return (applyDesignerLayoutRules({ placed, room: ROOM, openings: [WINDOW], fillers: pack.accessory, makeUid: () => `d-${++uid}`, styleId: 330014 } as never) as any).placed;
}

const economy = (list: PlacedCabinet[]) => list.filter(isEconomicCornerFiller);
const key = (p: PlacedCabinet) => `${p.placement}/${p.wallId}${String(p.fillerPieceGroupId).endsWith(":wall") ? ":wall" : ""}`;

type Pt = { x: number; y: number };
const inside = (pt: Pt, poly: Pt[]) => {
  let hit = false;
  for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
    const a = poly[k]!, b = poly[m]!;
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};
function sample(tops: CountertopSurface[], x0: number, x1: number, y0: number, y1: number) {
  let holes = 0, overlaps = 0;
  for (let x = x0 + 0.25; x < x1; x += 0.5) for (let y = y0 + 0.25; y < y1; y += 0.5) {
    const n = tops.filter((s) => inside({ x, y }, countertopSurfacePlanPolygon(s))).length;
    if (n === 0) holes += 1;
    if (n > 1) overlaps += 1;
  }
  return { holes, overlaps };
}

describe("fillerRuleViolation: the economic corner filler is not an open-side board", () => {
  const seat = (over: Partial<PlacedCabinet>, start: number, wallId: string): PlacedCabinet => {
    const placement = over.placement ?? "base";
    const spot = wallPlacementAt(start, 3, placement === "wall" ? 12 : 24, wallId as never, { ...DEFAULT_ROOM, ...ROOM } as RoomData);
    return {
      cabinetId: 1, masterCode: "F342", description: '3" Filler', category: "Filler", subCategory: "Filler", width: 3, nominalWidth: 3,
      height: placement === "wall" ? 30 : 34.5, depth: placement === "wall" ? 12 : 24, placement, wallId, ...spot, ...over,
    } as PlacedCabinet;
  };
  const room = { ...DEFAULT_ROOM, ...ROOM } as RoomData;

  it("a lone 3 in board facing an open end is flagged, but not when it carries the economy-corner group id (base and upper)", () => {
    const plain = seat({ uid: "f0", fillerPieceGroupId: "filler-group-x" }, 24, "right");
    expect(fillerRuleViolation({ filler: plain, placed: [plain], room, openings: [] })?.code).toBe("on-open-side-face");
    const base = seat({ uid: "f1", fillerPieceGroupId: "economy-corner:Corner between Wall 1 and Wall 2:right", fillerMiterAngle: 45 }, 24, "right");
    expect(fillerRuleViolation({ filler: base, placed: [base], room, openings: [] })).toBeNull();
    const upper = seat({ uid: "f2", placement: "wall", fillerPieceGroupId: "economy-corner:Corner between Wall 1 and Wall 2:right:wall", fillerMiterAngle: 45 }, 24, "right");
    expect(fillerRuleViolation({ filler: upper, placed: [upper], room, openings: [] })).toBeNull();
  });
});

describe.each(["old", "new"] as const)("budget L kitchen, %s construction: the economic corner survives the designer rules and the 3D render", (construction) => {
  const result = build(construction);
  it("the engine builds the room", () => {
    expect(result.ok).toBe(true);
  });
  const engine: PlacedCabinet[] = result.ok ? result.placed : [];
  const kept = result.ok ? afterDesignerRules(engine) : [];

  it("the engine places one 3 in filler per leg, base and upper, labeled with the 45° miter instruction", () => {
    const eco = economy(engine);
    expect(eco.map(key).sort()).toEqual(["base/right", "base/top", "wall/right:wall", "wall/top:wall"]);
    for (const piece of eco) {
      expect(Number(piece.width)).toBe(3);
      expect(piece.fillerMiterAngle).toBe(45);
      expect(piece.fieldModificationNote).toContain(ECONOMIC_CORNER_LABEL);
      expect(piece.fieldModificationNote).toBe(piece.placement === "wall" ? ECONOMIC_CORNER_WALL_NOTE : ECONOMIC_CORNER_BASE_NOTE);
      expect(piece.fieldModificationNote).toMatch(/MITER 45°/);
    }
  });

  it("the front-face audit raises no violation on any economic corner board", () => {
    const flagged = auditFillerPlacements({ placed: engine, room: ROOM, openings: [WINDOW] }).filter((a: any) => isEconomicCornerFiller(a.filler));
    expect(flagged).toEqual([]);
  });

  it("applyDesignerLayoutRules keeps all four boards with their miter note and label", () => {
    const eco = economy(kept);
    expect(eco.map(key).sort()).toEqual(["base/right", "base/top", "wall/right:wall", "wall/top:wall"]);
    for (const piece of eco) {
      expect(piece.fillerMiterAngle).toBe(45);
      expect(piece.fieldModificationNote).toMatch(/Economic corner/);
      expect(piece.fieldModificationNote).toMatch(/MITER 45°/);
    }
  });

  it("the 3D render placements keep all four boards (same rule, no frozen 3D change)", () => {
    expect(economy(threeDRenderPlacements(kept, ROOM, [WINDOW])).map(key).sort()).toEqual(["base/right", "base/top", "wall/right:wall", "wall/top:wall"]);
  });

  it("no filler in the corner run is over 3 in, and the corner boards sit between the void and a cabinet, never between two cabinets", () => {
    const fillers = kept.filter((p) => p.placement !== "wall" && (p.fillerPieceGroupId || /^F\d/i.test(p.masterCode)));
    for (const piece of fillers) expect(Number(piece.width)).toBeLessThanOrEqual(3.01);
    for (const piece of economy(kept).filter((p) => p.placement === "base")) {
      const wallId = String(piece.wallId);
      const start = wallRunOffset(piece, wallId as never, ROOM);
      const end = start + wallRunSpan(piece, wallId as never, ROOM);
      const along = kept.filter((p) => p.placement === "base" && p.uid !== piece.uid && String(p.wallId) === wallId);
      const touches = (edge: number) => along.some((p) => {
        const s = wallRunOffset(p, wallId as never, ROOM);
        return Math.abs(s - edge) <= 0.06 || Math.abs(s + wallRunSpan(p, wallId as never, ROOM) - edge) <= 0.06;
      });
      // exactly one side touches a cabinet; the other faces the open 24 in void (nothing there)
      expect([touches(start), touches(end)].filter(Boolean)).toHaveLength(1);
    }
  });

  it("the 3/4 in countertop covers the 24 in void and the inside corner on a 45° miter, with no hole or overlap", () => {
    const tops = countertopSurfaces(kept.filter((p) => p.placement !== "wall"), ROOM, null);
    const mitered = tops.filter((s: any) => s.insideCornerMiterKey);
    expect(mitered.length).toBe(2);
    expect(mitered.some((s: any) => s.miteredStart || s.miteredEnd)).toBe(true);
    // void square: x 118.5-144 (25.5 in top), y 0-25.5 at the back-right corner
    const s = sample(tops, 118.5, 144, 0, 25.5);
    expect(s.holes).toBe(0);
    expect(s.overlaps).toBe(0);
    // and the engine's own data (before any designer pass) has the same top, so the plan and the 3D agree
    const engineTops = countertopSurfaces(engine.filter((p) => p.placement !== "wall"), ROOM, null);
    expect(sample(engineTops, 118.5, 144, 0, 25.5)).toEqual({ holes: 0, overlaps: 0 });
  });
});
