import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { STD, wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";
import {
  EXPOSED_PANEL_THICKNESS_IN,
  layerAlignment,
  panelRunThicknessIn,
  runFitProblems,
  wallRunAccounting,
} from "@/lib/exposedSideRunAccounting";
import { exposedSidePanelNeeds, setExposedSidePanel } from "@/lib/sidePanelForExposedSide";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };

const catalog = [
  { id: 101, masterCode: "WEP1523", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 102, masterCode: "WEP1530", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 105, masterCode: "BEP2535", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
];

function cab(partial: {
  uid: string;
  masterCode: string;
  placement: PlacedCabinet["placement"];
  offset: number;
  width: number;
  height?: number;
  mountBottom?: number;
  depth?: number;
}): PlacedCabinet {
  const depth = partial.depth ?? (partial.placement === "wall" ? 13.5 : 24);
  const spot = wallPlacementAt(partial.offset, partial.width, depth, "top", room);
  return {
    uid: partial.uid,
    cabinetId: 1,
    masterCode: partial.masterCode,
    description: partial.masterCode,
    category: partial.placement === "wall" ? "Wall" : "Base",
    placement: partial.placement,
    ...spot,
    width: partial.width,
    depth,
    height: partial.height ?? (partial.placement === "wall" ? 30.25 : 34.75),
    mountBottom: partial.mountBottom,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  };
}

/** Slide every item from `fromIn` onward by `deltaIn`, the way a panel shifts a run. */
function shiftFrom(placed: PlacedCabinet[], fromIn: number, deltaIn: number): PlacedCabinet[] {
  return placed.map((item) => {
    const start = Number(item.wallOffset ?? 0);
    if (start < fromIn - 0.001) return item;
    const spot = wallPlacementAt(start + deltaIn, Number(item.width), Number(item.depth), "top", room);
    return { ...item, ...spot };
  });
}

function panel(uid: string, offset: number, masterCode = "BEP2535", height = 34.75): PlacedCabinet {
  const spot = wallPlacementAt(offset, EXPOSED_PANEL_THICKNESS_IN, 24, "top", room);
  return {
    uid,
    cabinetId: 105,
    masterCode,
    description: `${masterCode} 3/4" Frameless End Panel`,
    category: "Panels",
    subCategory: "End panel",
    placement: "base",
    ...spot,
    width: EXPOSED_PANEL_THICKNESS_IN,
    depth: 24,
    height,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  };
}

function filler(uid: string, offset: number, width: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", room);
  return {
    uid,
    cabinetId: 9,
    masterCode: "OF330",
    description: '3" Filler',
    category: "Base",
    subCategory: "Filler",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.75,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  };
}

describe("a 3/4-inch panel is real width in the run (Tom, Nov 9 2026)", () => {
  it("counts panels as real length: cabinets + panels + fillers = the run total", () => {
    // Two 24" bases on the left, a 3/4" panel, a 3" filler, then a 30" base.
    const left = cab({ uid: "b1", masterCode: "B24", placement: "base", offset: 0, width: 24 });
    const panelA = panel("p1", 24);
    const gap = filler("f1", 24.75, 3);
    const right = cab({ uid: "b2", masterCode: "B30", placement: "base", offset: 27.75, width: 30 });
    const placed = [left, panelA, gap, right];

    // The 30" base really starts after ALL of the 27.75" before it.
    expect(Number(right.wallOffset)).toBeCloseTo(27.75, 5);

    const accounting = wallRunAccounting({ placed, room, wallId: "top", layer: "base" });
    expect(accounting.cabinetIn).toBeCloseTo(54, 5);
    expect(accounting.panelIn).toBeCloseTo(0.75, 5);
    expect(accounting.fillerIn).toBeCloseTo(3, 5);
    expect(accounting.totalIn).toBeCloseTo(57.75, 5);
    // The pieces add up to the total with no drift.
    expect(accounting.totalIn).toBeCloseTo(
      accounting.cabinetIn + accounting.panelIn + accounting.fillerIn + accounting.applianceIn,
      5,
    );
    expect(accounting.wallLengthIn).toBe(144);
    expect(accounting.remainingIn).toBeCloseTo(86.25, 5);
  });

  it("adds a panel by sliding the run 3/4 inch, with no drift in the total", () => {
    // The host's right side is an open run end; 3/4" of free wall is there.
    const host = cab({ uid: "host", masterCode: "B24", placement: "base", offset: 6, width: 24 });
    const after = cab({ uid: "after", masterCode: "B30", placement: "base", offset: 34, width: 30 });
    const before = wallRunAccounting({ placed: [host, after], room, wallId: "top", layer: "base" });
    expect(before.panelIn).toBe(0);
    expect(before.totalIn).toBeCloseTo(54, 5);

    const result = setExposedSidePanel({
      placed: [host, after],
      hostUid: "host",
      side: "end",
      enabled: true,
      room,
      catalog,
      styleId: 540005,
      makeUid: () => "manual-panel",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const grown = wallRunAccounting({ placed: result.placed, room, wallId: "top", layer: "base" });
    expect(grown.panelIn).toBeCloseTo(0.75, 5);
    // One more 3/4" of real width, and the 30" cabinet moved with it.
    expect(grown.totalIn).toBeCloseTo(54.75, 5);
    // The board filled the free 3/4" at 33.25"-34", so the 30" base keeps its
    // position and the run is still exactly cabinets + panel.
    expect(grown.contributions.map((entry) => `${entry.kind}@${entry.startIn}`)).toEqual([
      "cabinet@6", "panel@30", "cabinet@34",
    ]);
  });

  it("keeps several panels from drifting: three panels still total cabinets + 2.25", () => {
    let placed: PlacedCabinet[] = [
      cab({ uid: "b1", masterCode: "B24", placement: "base", offset: 6, width: 24 }),
      cab({ uid: "b2", masterCode: "B24", placement: "base", offset: 30.75, width: 24 }),
      cab({ uid: "b3", masterCode: "B24", placement: "base", offset: 55.5, width: 24 }),
    ];
    placed = [panel("p1", 5.25), ...placed, panel("p2", 30), panel("p3", 54.75)];
    const accounting = wallRunAccounting({ placed, room, wallId: "top", layer: "base" });
    expect(accounting.cabinetIn).toBeCloseTo(72, 5);
    expect(accounting.panelIn).toBeCloseTo(2.25, 5);
    expect(accounting.totalIn).toBeCloseTo(74.25, 5);
    expect(accounting.overruns).toBe(false);
  });

  it("keeps the base and wall runs aligned at the same run end", () => {
    // A base panel and a wall panel at the same end, offset by the same amount.
    const base = cab({ uid: "base", masterCode: "B24", placement: "base", offset: 6, width: 24 });
    const upper = cab({ uid: "upper", masterCode: "W2430", placement: "wall", offset: 6, width: 24, mountBottom: 54 });
    const placed = [
      panel("bp", 5.25, "BEP2535"),
      base,
      { ...panel("wp", 5.25, "WEP1530", 30.25), placement: "wall" as const },
      upper,
    ];
    const alignment = layerAlignment({ placed, room, wallId: "top" });
    expect(alignment.basePanels).toEqual([5.25]);
    expect(alignment.wallPanels).toEqual([5.25]);
    expect(alignment.aligned).toBe(true);
    expect(alignment.mismatched).toEqual([]);
  });

  it("reports a run that no longer fits instead of overrunning the wall", () => {
    // 144" wall filled exactly, then a 3/4" panel pushes the run over.
    const a = cab({ uid: "a", masterCode: "B72", placement: "base", offset: 0, width: 72 });
    const b = cab({ uid: "b", masterCode: "B72", placement: "base", offset: 72, width: 72 });
    const exact = wallRunAccounting({ placed: [a, b], room, wallId: "top", layer: "base" });
    expect(exact.overruns).toBe(false);
    expect(exact.remainingIn).toBeCloseTo(0, 5);

    const problem = runFitProblems({ placed: [a, b, panel("p", 71.25)], room });
    expect(problem).toHaveLength(1);
    expect(problem[0]!.overrunIn).toBeCloseTo(0.75, 5);
    expect(problem[0]!.reason).toMatch(/panels 0\.75″/);
    expect(problem[0]!.reason).toMatch(/0\.75″ over/);
  });

  it("never measures a panel as zero or as a full cabinet depth", () => {
    expect(panelRunThicknessIn(panel("p", 0))).toBeCloseTo(STD.PANEL_THICKNESS, 5);
    expect(panelRunThicknessIn(cab({ uid: "c", masterCode: "B24", placement: "base", offset: 0, width: 24 }))).toBe(0);
  });

  it("measures the same numbers Auto Design sees when it tiles a run", () => {
    // Auto Design's exposed-side pass places the panel that faces a range; the
    // accounting then reads exactly that placed row, so both count the same 3/4".
    const host = cab({ uid: "host", masterCode: "B24", placement: "base", offset: 6, width: 24 });
    const range: PlacedCabinet = {
      ...cab({ uid: "range", masterCode: "RANGE-30", placement: "appliance", offset: 30, width: 30, depth: 25 }),
      description: "30 inch Freestanding Range",
    };
    const needs = exposedSidePanelNeeds({ placed: [host, range], room, catalog });
    expect(needs.length).toBeGreaterThan(0);
    const accounting = wallRunAccounting({ placed: [host, range], room, wallId: "top", layer: "base" });
    expect(accounting.totalIn).toBeCloseTo(accounting.cabinetIn + accounting.panelIn + accounting.fillerIn + accounting.applianceIn, 5);
  });
});
