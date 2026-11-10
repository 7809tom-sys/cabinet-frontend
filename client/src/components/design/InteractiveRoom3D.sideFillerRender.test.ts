/**
 * The 3D view must never draw a filler across the outside face of a tall
 * refrigerator end panel.
 *
 * The reported symptom: white horizontal strips on the panel's front/side skin.
 * The board behind them was a wall filler on the bridge's 72-inch datum, 12
 * inches tall, cut to close a gap the designer measured straight through the
 * 24-inch-deep, 84-inch-tall panel (see fillerPlacementRule.ts). Saving the plan
 * kept the record, so every re-open re-rendered the strip.
 */
import { describe, expect, it } from "vitest";
import { threeDRenderPlacements } from "@/components/design/InteractiveRoom3D";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";

const ROOM = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function seat(
  partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "width"> & { placement?: PlacedCabinet["placement"] },
  start: number,
  depthOverride?: number,
): PlacedCabinet {
  const placement = partial.placement ?? "base";
  const depth = depthOverride ?? (placement === "wall" ? 12 : 24);
  const spot = wallPlacementAt(start, partial.width, depth, "top", ROOM);
  return {
    cabinetId: 1, masterCode: "X", description: "", category: "Base", subCategory: "Standard Base",
    height: placement === "wall" ? 30 : placement === "tall" ? 84 : 34.5,
    numberOfDoors: 2, numberOfDrawers: 0, mountBottom: placement === "wall" ? 54 : 0,
    ...partial, placement, width: partial.width, depth, ...spot,
  } as PlacedCabinet;
}

function enclosure() {
  const leftPanel = seat({
    uid: "left-panel", masterCode: "S2496", description: "Tall End Panel for Refrigerator",
    placement: "tall", width: 0.75, height: 84, category: "Panel",
    refrigeratorAssemblyRole: "left-panel", refrigeratorAssemblyId: "fridge",
  }, 4.25);
  const refrigerator = seat({
    uid: "fridge", masterCode: "FRIDGE-36", description: "36 inch Refrigerator",
    placement: "appliance", width: 36, height: 70, category: "Appliance",
  }, 5.5);
  const rightPanel = seat({
    uid: "right-panel", masterCode: "S2496", description: "Tall End Panel for Refrigerator",
    placement: "tall", width: 0.75, height: 84, category: "Panel",
    refrigeratorAssemblyRole: "right-panel", refrigeratorAssemblyId: "fridge",
  }, 41.5);
  const bridge = seat({
    uid: "bridge", masterCode: "W361224", description: '36" Refrigerator Wall Cabinet',
    placement: "wall", width: 36, height: 12, mountBottom: 72,
    refrigeratorAssemblyRole: "bridge", refrigeratorAssemblyId: "fridge",
  }, 5.5, 24);
  return { leftPanel, refrigerator, rightPanel, bridge };
}

function savedSideFiller(): PlacedCabinet {
  return {
    ...seat({
      uid: "legacy-side-filler", masterCode: "FOL630", description: 'Filler 6" stock, cut to 4.25"',
      placement: "wall", width: 4.25, height: 12, mountBottom: 72, category: "Filler", subCategory: "Filler",
    }, 0, 24),
    fillerPieceGroupId: "filler-group-legacy",
    fillerBillingRole: "primary",
    fillerTotalWidth: 4.25,
    fillerPlacementMode: "right",
    fillerForCabinetUid: "bridge",
  } as PlacedCabinet;
}

describe("3D render repairs a saved side filler", () => {
  it("drops the board that crosses the refrigerator end panel", () => {
    const { leftPanel, refrigerator, rightPanel, bridge } = enclosure();
    const placed = [leftPanel, refrigerator, rightPanel, bridge, savedSideFiller()];
    const rendered = threeDRenderPlacements(placed, ROOM, []);
    expect(rendered.some((item) => item.uid === "legacy-side-filler")).toBe(false);
    expect(rendered.map((item) => item.uid).sort()).toEqual(["bridge", "fridge", "left-panel", "right-panel"]);
  });

  it("never draws a board over the panel envelope, at any height", () => {
    const { leftPanel, refrigerator, rightPanel, bridge } = enclosure();
    const placed = [leftPanel, refrigerator, rightPanel, bridge, savedSideFiller()];
    const rendered = threeDRenderPlacements(placed, ROOM, []);
    const panelStart = 4.25;
    const panelEnd = 5;
    for (const board of rendered.filter((item) => Boolean(item.fillerPieceGroupId))) {
      const start = Number(board.x) || 0;
      const end = start + (Number(board.width) || 0);
      expect(Math.min(end, panelEnd) - Math.max(start, panelStart)).toBeLessThanOrEqual(0.02);
    }
  });

  it("keeps a legal cabinet-to-cabinet board through the render path", () => {
    const left = seat({ uid: "left", masterCode: "B24", width: 24 }, 0);
    const right = seat({ uid: "right", masterCode: "B24", width: 24 }, 27);
    const board = {
      ...seat({ uid: "seam", masterCode: "BF3", description: '3" Base Filler', placement: "base", width: 3, category: "Filler", subCategory: "Filler" }, 24),
      fillerPieceGroupId: "filler-group-seam", fillerBillingRole: "primary", fillerTotalWidth: 3, fillerPlacementMode: "right", fillerForCabinetUid: "left",
    } as PlacedCabinet;
    const rendered = threeDRenderPlacements([left, right, board], ROOM, []);
    expect(rendered.some((item) => item.uid === "seam")).toBe(true);
  });

  it("leaves the source plan untouched", () => {
    const { leftPanel, refrigerator, rightPanel, bridge } = enclosure();
    const board = savedSideFiller();
    const placed = [leftPanel, refrigerator, rightPanel, bridge, board];
    threeDRenderPlacements(placed, ROOM, []);
    expect(placed).toHaveLength(5);
    expect(placed.some((item) => item.uid === "legacy-side-filler")).toBe(true);
  });
});
