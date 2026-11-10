import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";
import { wallRunAccounting, layerAlignment, runFitProblems } from "@/lib/exposedSideRunAccounting";
import { syncExposedSidePanelsForRun } from "@/lib/sidePanelForExposedSide";

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
  description?: string;
}): PlacedCabinet {
  const depth = partial.depth ?? (partial.placement === "wall" ? 13.5 : 24);
  const spot = wallPlacementAt(partial.offset, partial.width, depth, "top", room);
  return {
    uid: partial.uid,
    cabinetId: 1,
    masterCode: partial.masterCode,
    description: partial.description ?? partial.masterCode,
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

function range(offset: number, width = 30, uid = "range"): PlacedCabinet {
  return cab({
    uid,
    masterCode: "RANGE-30",
    placement: "appliance",
    offset,
    width,
    height: 36,
    depth: 25,
    description: "30 inch Freestanding Range",
  });
}

/** Let the real exposed-side pass settle, then report the plan it built. */
function settle(placed: PlacedCabinet[]) {
  let current = placed;
  let uid = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    const result = syncExposedSidePanelsForRun({
      placed: current,
      room,
      catalog,
      styleId: 540005,
      makeUid: () => `auto-panel-${uid += 1}`,
    });
    if (result.placed === current) break;
    current = result.placed;
  }
  return current;
}

describe("exposed-side panels wired into the real layout pass", () => {
  it("shifts the following cabinets by 3/4in and totals cabinets + panels", () => {
    // A base run beside a range. The range faces a base on each side, so the pass
    // adds a 3/4" BEP2535 panel on the exposed side of each flank cabinet.
    const left = cab({ uid: "left", masterCode: "B24", placement: "base", offset: 6, width: 24 });
    const right = cab({ uid: "right", masterCode: "B30", placement: "base", offset: 34, width: 30 });
    const settled = settle([left, range(30), right]);

    const accounting = wallRunAccounting({ placed: settled, room, wallId: "top", layer: "base" });
    // The panels are real rows with the line's 3/4" width.
    expect(accounting.panelIn).toBeGreaterThan(0);
    expect(accounting.totalIn).toBeCloseTo(
      accounting.cabinetIn + accounting.panelIn + accounting.fillerIn + accounting.applianceIn,
      5,
    );
    // Nothing landed on top of anything: every piece has a distinct span.
    const spans = accounting.contributions.map((entry) => `${entry.startIn}-${entry.endIn}`);
    expect(new Set(spans).size).toBe(spans.length);
    // The run still fits its wall.
    expect(accounting.overruns).toBe(false);
    expect(runFitProblems({ placed: settled, room })).toEqual([]);
  });

  it("keeps the base and wall runs aligned when both ends get a panel", () => {
    // Matching uppers over the same bases, with the same exposed run ends.
    const baseLeft = cab({ uid: "bl", masterCode: "B24", placement: "base", offset: 6, width: 24 });
    const baseRight = cab({ uid: "br", masterCode: "B30", placement: "base", offset: 34, width: 30 });
    const wallLeft = cab({ uid: "wl", masterCode: "W2430", placement: "wall", offset: 6, width: 24, mountBottom: 54 });
    const wallRight = cab({ uid: "wr", masterCode: "W3030", placement: "wall", offset: 34, width: 30, mountBottom: 54 });
    const settled = settle([baseLeft, range(30), baseRight, wallLeft, wallRight]);

    const alignment = layerAlignment({ placed: settled, room, wallId: "top" });
    // The base panel and the wall panel at the same end sit at the same offset,
    // so the elevation cannot drift off its lowers.
    expect(alignment.aligned).toBe(true);
    expect(alignment.mismatched).toEqual([]);
  });

  it("refuses visibly when the panels make the run too long for the wall", () => {
    // Two 72" bases already fill a 144" wall; a required panel pushes it over.
    const a = cab({ uid: "a", masterCode: "B72", placement: "base", offset: 0, width: 72 });
    const b = cab({ uid: "b", masterCode: "B72", placement: "base", offset: 72, width: 72 });
    const overrun = runFitProblems({ placed: [...settle([a, b]), ...[{
      ...cab({ uid: "p", masterCode: "BEP2535", placement: "base", offset: 71.25, width: 0.75 }),
      description: "BEP2535 3/4\" Frameless End Panel",
      category: "Panels",
      subCategory: "End panel",
    }]], room });
    expect(overrun).toHaveLength(1);
    expect(overrun[0]!.overrunIn).toBeCloseTo(0.75, 5);
    expect(overrun[0]!.reason).toMatch(/over/);
  });

  it("is idempotent: a second full pass changes nothing", () => {
    const left = cab({ uid: "left", masterCode: "B24", placement: "base", offset: 6, width: 24 });
    const right = cab({ uid: "right", masterCode: "B30", placement: "base", offset: 34, width: 30 });
    const first = settle([left, range(30), right]);
    const second = syncExposedSidePanelsForRun({
      placed: first,
      room,
      catalog,
      styleId: 540005,
      makeUid: () => "should-not-be-used",
    });
    expect(second.placed).toBe(first);
    expect(second.additions).toEqual([]);
  });
});
