import { describe, expect, it } from "vitest";
import {
	appendRefrigeratorEnclosurePlacements,
  commitIndependentCabinetCandidate,
	fitExplicitRefrigeratorOptionPlacements,
  normalizeRefrigeratorBayUppers,
  type PlacedCabinet,
  type RoomData,
  wallPlacementAt,
	wallPlacementAtUnbounded,
	wallRunOffset,
} from "./design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function placed(
  uid: string,
  masterCode: string,
  width: number,
  depth: number,
  placement: PlacedCabinet["placement"],
  offset: number,
  extra: Partial<PlacedCabinet> = {},
): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, depth, "bottom", room);
  return {
    uid,
    cabinetId: 1,
    masterCode,
    description: masterCode,
    placement,
    x: spot.x,
    y: spot.y,
    width,
    depth,
    height: placement === "appliance" ? 70 : placement === "wall" ? 12 : 96,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    ...extra,
  };
}

describe("independent refrigerator parts", () => {
  it("moves only the refrigerator and keeps separately selected panels and cabinet-above fixed", () => {
    const fridge = placed("fridge", "FRIDGE-36", 36, 30, "appliance", 36, {
      refrigeratorPanelMode: "both",
      refrigeratorOptionsChosen: true,
    });
    const leftPanel = placed("left", "REPV2496", 0.75, 24, "tall", 35.25, {
      refrigeratorAssemblyId: "fridge",
      refrigeratorAssemblyRole: "left-panel",
    });
    const cap = placed("cap", "W3612", 36, 12, "wall", 36, {
      mountBottom: 72,
      refrigeratorAssemblyId: "fridge",
      refrigeratorAssemblyRole: "bridge",
    });
    const movedFridge = { ...fridge, ...wallPlacementAt(72, 36, 30, "bottom", room) };

    const result = commitIndependentCabinetCandidate([fridge, leftPanel, cap], movedFridge);

    expect(result.find((item) => item.uid === "fridge")?.wallOffset).toBe(72);
    expect(result.find((item) => item.uid === "left")).toMatchObject({
      wallOffset: 35.25,
      refrigeratorAssemblyId: "fridge",
    });
    expect(result.find((item) => item.uid === "cap")).toMatchObject({
      wallOffset: 36,
      mountBottom: 72,
    });
  });

  it("does not reconstruct, move, or create refrigerator panels during plan normalization", () => {
    const fridge = placed("fridge", "FRIDGE-36", 36, 30, "appliance", 36, {
      refrigeratorPanelMode: "right",
      refrigeratorOptionsChosen: true,
    });
    const independentlyPlacedPanel = placed("right", "REPV2496", 0.75, 24, "tall", 72.5, {
      refrigeratorAssemblyId: "fridge",
      refrigeratorAssemblyRole: "right-panel",
      height: 96,
      mountBottom: 0,
    });
    const ordinaryWallCabinet = placed("ordinary-w1842", "W1842", 18, 12, "wall", 54, {
      mountBottom: 54,
    });

    const result = normalizeRefrigeratorBayUppers([fridge, independentlyPlacedPanel, ordinaryWallCabinet], room);

    expect(result).toHaveLength(3);
    expect(result.find((item) => item.uid === "right")).toMatchObject({
      wallOffset: 72.5,
      refrigeratorAssemblyId: "fridge",
      refrigeratorAssemblyRole: "right-panel",
    });
    expect(result.find((item) => item.uid === "ordinary-w1842")).toMatchObject({
      wallOffset: 54,
      mountBottom: 54,
    });
  });

  it("rejects a selected panel at a wall end without shifting the refrigerator", () => {
    const shortRoom: RoomData = { width: 72, depth: 120, ceilingHeight: 96 };
    const fridgeSpot = wallPlacementAt(36, 36, 30, "bottom", shortRoom);
    const fridge: PlacedCabinet = {
      ...placed("corner-fridge", "FRIDGE-36", 36, 30, "appliance", 36),
      ...fridgeSpot,
      wallOffset: 36,
      refrigeratorPanelMode: "right",
      refrigeratorOptionsChosen: true,
    };
    const rightSpot = wallPlacementAt(71.25, 0.75, 24, "bottom", shortRoom);
    const rightPanel: PlacedCabinet = {
      ...placed("end-panel", "REPV2496", 0.75, 24, "tall", 71.25),
      ...rightSpot,
      // Preserve the requested run coordinate.  Its 3/4-in span extends beyond
      // the 72-in wall and therefore must not be silently clamped onto the fridge.
      wallOffset: 72,
      refrigeratorAssemblyId: "corner-fridge",
      refrigeratorAssemblyRole: "right-panel",
    };

    const result = appendRefrigeratorEnclosurePlacements([fridge], [rightPanel], fridge.uid, shortRoom);

    expect(result.placed).toEqual([fridge]);
    expect(result.rejected).toEqual([rightPanel]);
    expect(result.placed[0].wallOffset).toBe(36);
  });

  it("moves only a newly configured refrigerator and its selected parts inward at a wall edge", () => {
    const refrigerator = placed("fridge", "FRIDGE-36", 36, 30, "appliance", 0, {
      refrigeratorPanelMode: "both",
      refrigeratorOptionsChosen: true,
    });
    const cap = placed("cap", "WR3612", 36, 24, "wall", 0, {
      mountBottom: 72,
      refrigeratorAssemblyId: refrigerator.uid,
      refrigeratorAssemblyRole: "bridge",
    });
    const panel = (uid: string, along: number, role: "left-panel" | "right-panel") => {
      const spot = wallPlacementAtUnbounded(along, 0.75, 24, "bottom", room);
      return {
        ...placed(uid, "REPV3096", 0.75, 24, "tall", 0, {
          refrigeratorAssemblyId: refrigerator.uid,
          refrigeratorAssemblyRole: role,
          mountBottom: 0,
        }),
        ...spot,
        wallOffset: along,
      };
    };
    // The left panel begins 1.25" beyond the wall because it sits outside the
    // 1/2" finished opening.  B21 is an already placed neighbor and must not move.
    const left = panel("left", -1.25, "left-panel");
    const right = panel("right", 36.5, "right-panel");
    const fixedB21 = placed("fixed-b21", "B21", 21, 24, "base", 43);

    const fitted = fitExplicitRefrigeratorOptionPlacements(
      [refrigerator, fixedB21],
      [cap, left, right],
      refrigerator.uid,
      room,
    );
    const committed = appendRefrigeratorEnclosurePlacements(
      fitted.existing,
      fitted.additions,
      refrigerator.uid,
      room,
    );

    expect(fitted.shiftIn).toBe(1.25);
    expect(wallRunOffset(fitted.existing.find((item) => item.uid === refrigerator.uid)!, "bottom", room)).toBe(1.25);
    expect(wallRunOffset(fitted.existing.find((item) => item.uid === fixedB21.uid)!, "bottom", room)).toBe(43);
    expect(wallRunOffset(fitted.additions.find((item) => item.uid === "left")!, "bottom", room)).toBe(0);
    expect(wallRunOffset(fitted.additions.find((item) => item.uid === "right")!, "bottom", room)).toBe(37.75);
    expect(committed.rejected).toEqual([]);
  });

  it("clears a fixed base cabinet by shifting only the refrigerator and newly selected options", () => {
    const fixedBase = placed("fixed-b24", "B24", 24, 24, "base", 0);
    const refrigerator = placed("fridge-after-base", "FRIDGE-36", 36, 30, "appliance", 24, {
      refrigeratorPanelMode: "both",
      refrigeratorOptionsChosen: true,
    });
    const cap = placed("cap-after-base", "WR3612", 36, 24, "wall", 24, {
      mountBottom: 72,
      refrigeratorAssemblyId: refrigerator.uid,
      refrigeratorAssemblyRole: "bridge",
    });
    const panel = (uid: string, along: number, role: "left-panel" | "right-panel") => {
      const spot = wallPlacementAtUnbounded(along, 0.75, 24, "bottom", room);
      return {
        ...placed(uid, "REPV3096", 0.75, 24, "tall", 0, {
          refrigeratorAssemblyId: refrigerator.uid,
          refrigeratorAssemblyRole: role,
          mountBottom: 0,
        }),
        ...spot,
        wallOffset: along,
      };
    };
    const fitted = fitExplicitRefrigeratorOptionPlacements(
      [fixedBase, refrigerator],
      [cap, panel("left-after-base", 22.75, "left-panel"), panel("right-after-base", 60.5, "right-panel")],
      refrigerator.uid,
      room,
    );
    const committed = appendRefrigeratorEnclosurePlacements(fitted.existing, fitted.additions, refrigerator.uid, room);

    expect(fitted.shiftIn).toBe(1.25);
    expect(wallRunOffset(fitted.existing.find((item) => item.uid === fixedBase.uid)!, "bottom", room)).toBe(0);
    expect(wallRunOffset(fitted.existing.find((item) => item.uid === refrigerator.uid)!, "bottom", room)).toBe(25.25);
    expect(wallRunOffset(fitted.additions.find((item) => item.uid === "left-after-base")!, "bottom", room)).toBe(24);
    expect(committed.rejected).toEqual([]);
  });
});
