import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import type { PlacedCabinet, RoomData, WallOpening } from "./design";
import { aefWindowEndPanelRequirements } from "./aefWindowEndPanels";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const window: WallOpening = {
  uid: "window-1",
  kind: "window",
  side: "top",
  offset: 48,
  width: 36,
  sill: 42,
  height: 36,
};

function wall(uid: string, x: number, width = 24, height = 30.25, depth = 13.5): PlacedCabinet {
  return {
    uid,
    cabinetId: 1,
    masterCode: `W${width}30`,
    description: "Frameless Wall Cabinet",
    placement: "wall",
    x,
    y: 0,
    width,
    height,
    depth,
    rotation: 0,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  };
}

const panelCatalog = [
  { id: 101, masterCode: "WEP1523", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 102, masterCode: "WEP1530", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 103, masterCode: "WEP1535", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 104, masterCode: "WEP1542", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
] as const;

describe("AEF window-break wall end panels", () => {
  it("requires the 3/4-inch WEP panel at both upper ends adjoining a window", () => {
    const requirements = aefWindowEndPanelRequirements([
      wall("left-of-window", 24),
      wall("right-of-window", 84),
    ], [window], room, panelCatalog);

    expect(requirements).toHaveLength(2);
    expect(requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ cabinetUid: "left-of-window", end: "end", masterCode: "WEP1530", cabinetId: 102, pendingSku: false, stockWidth: 15.25, stockHeight: 30.25, stockThickness: 0.75, depth: 13.5 }),
      expect.objectContaining({ cabinetUid: "right-of-window", end: "start", masterCode: "WEP1530", cabinetId: 102, pendingSku: false, stockWidth: 15.25, stockHeight: 30.25, stockThickness: 0.75, depth: 13.5 }),
    ]));
    expect(requirements[0].description).toContain('15¼" W × 30¼" H stock');
  });

  it("selects the shortest source stock that covers the upper height", () => {
    const requirements = aefWindowEndPanelRequirements([
      wall("left-of-window", 24, 24, 22.625),
      wall("right-of-window", 84, 24, 40.25),
    ], [window], room, panelCatalog);
    expect(requirements.map((requirement) => requirement.masterCode).sort()).toEqual(["WEP1523", "WEP1542"]);
  });

  it("does not apply to framed wall cabinets, cabinets away from the window, or the frozen Wall Builder data model", () => {
    const framed = { ...wall("framed", 24), constructionMethod: "framed" };
    const distant = { ...wall("distant", 0), y: 106.5 };
    expect(aefWindowEndPanelRequirements([framed, distant], [window], room, panelCatalog)).toEqual([]);
  });

  it("does not duplicate a panel where the window is not between two upper runs", () => {
    const requirements = aefWindowEndPanelRequirements([
      wall("only-left", 24),
      wall("same-run", 0),
    ], [window], room, panelCatalog);
    expect(requirements).toEqual([
      expect.objectContaining({ cabinetUid: "only-left", end: "end", masterCode: "WEP1530" }),
    ]);
  });

  it("never invents an undersized WEP board for a 24-inch-deep wall cabinet", () => {
    const requirements = aefWindowEndPanelRequirements([wall("deep", 24, 24, 30.25, 24)], [window], room, panelCatalog);
    expect(requirements).toHaveLength(1);
    expect(requirements[0]).toMatchObject({ cabinetUid: "deep", masterCode: null, cabinetId: null, pendingSku: true, depth: 24 });
  });
});
