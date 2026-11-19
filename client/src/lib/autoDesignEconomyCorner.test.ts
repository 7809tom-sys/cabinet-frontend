import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { ECONOMIC_CORNER_BASE_NOTE, enforceEconomyCornerFillers, isEconomicCornerFiller } from "./autoDesignEconomyCorner";
import { appliancesForRoom, applianceAsDesignCabinet, isCornerCabinet, wallPlacementAt, type PlacedCabinet, type RoomData } from "./design";

// Economy corner (Tom, voice, Nov 19 2026, 8:44 + 9:01 AM CT): 27" corner footprint = 24" square + a 3"
// filler claimed FIRST on each leg; the base beside it is sized to what is left (27 available -> B24).
const pack = (matrix as any)["330014"];
const ROOM = { width: 120, depth: 120, ceilingHeight: 96 } as RoomData;

function build(budget: boolean) {
  let uid = 0;
  return runAutoDesignLayout({
    input: { layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36, stove: { wallLabel: "Wall 1", centerOffsetIn: 60 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 66 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular", dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: budget ? ["budget-friendly"] : [], islandOrPeninsula: "none", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } } } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])], styleId: 330014, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

const at = (r: any, wallId: string, offset: number, layer: "base" | "wall" = "base") => r.placed.find((p: any) => p.wallId === wallId
  && (layer === "wall" ? p.placement === "wall" : p.placement !== "wall") && Math.abs(Number(p.wallOffset) - offset) < 0.05);

describe("economy corner, 10x10 L budget, 330014", () => {
  it("no corner cabinet; each leg: 24 in square, then the 3 in F342, then the base sized to what is left", () => {
    const r = build(true);
    expect(r.ok, r.message).toBe(true);
    expect(r.placed.some((p: any) => p.placement === "base" && isCornerCabinet(p.masterCode, p.description, p.cornerType ?? null))).toBe(false);
    // Right leg (corner at offset 0): F342 at 24-27, then the base starts at 27.
    expect(at(r, "right", 24)?.masterCode).toBe("F342");
    expect(at(r, "right", 27)).toBeTruthy();
    // Top leg (corner at its far end, 120 - 24 = 96): F342 at 93-96, base ends at 93.
    expect(at(r, "top", 93)?.masterCode).toBe("F342");
    expect(r.placed.some((p: any) => p.wallId === "right" && p.placement !== "wall" && Number(p.wallOffset) < 23.95)).toBe(false);
    expect(r.notes.some((n: string) => /economy corner — no corner cabinet/.test(n))).toBe(true);
  });

  it("labels the corner filler 'Economic corner' with the 45 degree miter instruction (Tom, Nov 19 2026, 11:53 AM CT)", () => {
    const r = build(true);
    expect(r.ok, r.message).toBe(true);
    const fillers = r.placed.filter((p: any) => isEconomicCornerFiller(p));
    const base = fillers.filter((p: any) => p.placement !== "wall");
    expect(base.length).toBe(2); // one per leg, both at the 24 in void edge
    for (const f of base) {
      expect(f.masterCode).toBe("F342");
      expect(f.fieldModificationNote).toBe(ECONOMIC_CORNER_BASE_NOTE);
      expect(f.fieldModificationNote).toMatch(/Economic corner/);
      expect(f.fieldModificationNote).toMatch(/MITER 45°/);
    }
    for (const f of fillers.filter((p: any) => p.placement === "wall")) expect(f.fieldModificationNote).toMatch(/Economic corner \(upper\).*MITER 45°/);
    // The old plain wording is gone.
    expect(r.placed.some((p: any) => /door-clearance filler claimed first/.test(p.fieldModificationNote ?? ""))).toBe(false);
  });

  it("a corner the engine skipped (appliance in the 27 in footprint) gets no economic-corner filler or label", () => {
    const r = runAutoDesignLayout({
      input: { layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
        refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36, stove: { wallLabel: "Wall 1", centerOffsetIn: 60 },
        sink: { wallLabel: "Wall 2", centerOffsetIn: 66 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular", dishwasherSide: "left", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
        kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
        intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: ["budget-friendly"], islandOrPeninsula: "none", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } } } as never,
      room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
      appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
      refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
      refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
      panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])], styleId: 330014, makeUid: (() => { let u = 0; return () => `k-${++u}`; })(),
    } as never) as any;
    expect(r.ok, r.message).toBe(true);
    // DW-24 lands inside the corner footprint on the right wall: the corner is skipped on that leg.
    expect(r.notes.some((n: string) => /economy corner skipped — DW-24 sits inside the 27″ corner footprint/.test(n))).toBe(true);
    expect(r.placed.some((p: any) => p.wallId === "right" && isEconomicCornerFiller(p))).toBe(false);
  });

  it("27 in available beside the corner -> F342 + B24 (not B27)", () => {
    const b27 = pack.base.find((row: any) => row.masterCode === "B27");
    const spot = wallPlacementAt(24, 27, 24, "right", ROOM, null, false);
    const placed = [{ ...b27, uid: "b27", placement: "base", width: 27, depth: 24, height: 34.5, x: spot.x, y: spot.y, rotation: spot.rotation, wallId: "right", wallOffset: 24 }] as unknown as PlacedCabinet[];
    let n = 0;
    const out = enforceEconomyCornerFillers({
      corners: [{ label: "Corner", wallIds: ["right"], corner: { x: 120, y: 0 } }],
      placed, room: ROOM, baseCatalog: pack.base, wallCatalog: pack.wall, catalogFillers: pack.accessory, makeUid: () => `e-${++n}`,
    });
    const base = out.placed.find((p) => p.uid === "b27")!;
    expect(base.masterCode).toBe("B24");
    expect(Number(base.wallOffset)).toBeCloseTo(27, 2);
    const filler = out.placed.find((p) => p.masterCode === "F342")!;
    expect(Number(filler.wallOffset)).toBeCloseTo(24, 2);
    expect(out.notes.join(" ")).toMatch(/B27 \(27″\) became B24 \(24″\)/);
  });

  it("non-budget builds keep the corner-cabinet decision", () => {
    const r = build(false);
    expect(r.ok, r.message).toBe(true);
    expect(r.notes.some((n: string) => /economy corner/.test(n))).toBe(false);
  });
});
