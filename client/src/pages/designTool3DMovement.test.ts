import { describe, expect, it } from "vitest";
import { elevationBox, hasCollision, STD } from "@/lib/design";
import { commitThreeDCabinetCandidate, countertopMountedCabinet, threeDMeasuredWallMoveTarget, threeDPlanMoveDelta } from "./designTool3DMovement";

const room = { width: 144, depth: 120, ceilingHeight: 96 } as const;

describe("3D cabinet movement plan mapping", () => {
  it("moves along and into a back-wall cabinet using screen-relative controls", () => {
    const backWall = { uid: "back", masterCode: "W-30", description: "Wall cabinet", placement: "wall", x: 42, y: 0, width: 30, depth: 12, height: 30, rotation: 0 } as any;
    expect(threeDPlanMoveDelta(backWall, room as any, "left", 3)).toEqual({ x: -3, y: 0 });
    expect(threeDPlanMoveDelta(backWall, room as any, "right", 3)).toEqual({ x: 3, y: 0 });
    expect(threeDPlanMoveDelta(backWall, room as any, "in", 3)).toEqual({ x: 0, y: 3 });
    expect(threeDPlanMoveDelta(backWall, room as any, "out", 3)).toEqual({ x: 0, y: -3 });
  });

  it("reverses horizontal directions on the front wall and turns them on a side wall", () => {
    const frontWall = { uid: "front", masterCode: "W-30", description: "Wall cabinet", placement: "wall", x: 42, y: 108, width: 30, depth: 12, height: 30, rotation: 180 } as any;
    const leftWall = { uid: "left", masterCode: "W-30", description: "Wall cabinet", placement: "wall", x: 0, y: 42, width: 30, depth: 12, height: 30, rotation: 90 } as any;
    expect(threeDPlanMoveDelta(frontWall, room as any, "left", 1)).toEqual({ x: 1, y: 0 });
    expect(threeDPlanMoveDelta(frontWall, room as any, "in", 1)).toEqual({ x: 0, y: -1 });
    expect(threeDPlanMoveDelta(leftWall, room as any, "left", 6)).toEqual({ x: 0, y: 6 });
    expect(threeDPlanMoveDelta(leftWall, room as any, "in", 6)).toEqual({ x: 6, y: 0 });
  });

  it("uses a continuous wall's measured direction instead of treating it as the generic right wall", () => {
    const continuousRoom = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 120, y: 120 },
      ],
      customWalls: [{ id: "wall-45", startVertexId: "a", endVertexId: "b", lockedAngle: 45 }],
    } as const;
    const diagonalBase = {
      uid: "diagonal-base",
      masterCode: "B-30",
      description: "30 inch base",
      placement: "base",
      x: 0,
      y: 0,
      width: 30,
      depth: 24,
      height: 34.5,
      rotation: 45,
      wallId: "wall-45",
      wallOffset: 24,
    } as any;

    const right = threeDPlanMoveDelta(diagonalBase, continuousRoom as any, "right", 6);
    expect(right.x).toBeCloseTo(6 * Math.SQRT1_2, 10);
    expect(right.y).toBeCloseTo(6 * Math.SQRT1_2, 10);
    const left = threeDPlanMoveDelta(diagonalBase, continuousRoom as any, "left", 6);
    expect(left.x).toBeCloseTo(-6 * Math.SQRT1_2, 10);
    expect(left.y).toBeCloseTo(-6 * Math.SQRT1_2, 10);
  });

  it("re-seats a 3D continuous-wall move with its updated exact run offset and flush depth", () => {
    const continuousRoom = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 120, y: 120 },
      ],
      customWalls: [{ id: "wall-45", startVertexId: "a", endVertexId: "b", lockedAngle: 45 }],
    } as const;
    const diagonalBase = {
      uid: "diagonal-base",
      masterCode: "B-30",
      description: "30 inch base",
      placement: "base",
      x: 0,
      y: 0,
      width: 30,
      depth: 24,
      height: 34.5,
      rotation: 45,
      wallId: "wall-45",
      wallOffset: 24,
    } as any;

    const right = threeDMeasuredWallMoveTarget(diagonalBase, continuousRoom as any, "right", 6);
    expect(right).toMatchObject({ constrainedToWall: false, candidate: { wallId: "wall-45", wallOffset: 30, rotation: 45 } });
    expect(right!.candidate.x).toBeCloseTo(3 * Math.SQRT2, 8);
    expect(right!.candidate.y).toBeCloseTo(3 * Math.SQRT2 + 12 * Math.SQRT2, 8);

    // In/Out is the same generic depth move on every wall kind (a standard-room
    // cabinet may be pulled off its wall); the seated-run helper only owns
    // Left/Right, so it defers In/Out to the shared plan path.
    expect(threeDMeasuredWallMoveTarget(diagonalBase, continuousRoom as any, "in", 6)).toBeNull();
  });

	  it("allows a 30-inch depth move and limits oversized input to the controlled attributes range", () => {
	    const backWall = { uid: "back", masterCode: "W-30", description: "Wall cabinet", placement: "wall", x: 42, y: 0, width: 30, depth: 12, height: 30, rotation: 0 } as any;
	    expect(threeDPlanMoveDelta(backWall, room as any, "in", 30)).toEqual({ x: 0, y: 30 });
	    expect(threeDPlanMoveDelta(backWall, room as any, "out", 30)).toEqual({ x: 0, y: -30 });
	    expect(threeDPlanMoveDelta(backWall, room as any, "right", 999)).toEqual({ x: 120, y: 0 });
	  });

	  it("commits moved coordinates only to the exact selected UID and preserves unrelated cabinet identity", () => {
	    const selected = { uid: "selected", masterCode: "W-36-24", x: 12, y: 0, width: 36, depth: 12, height: 24 } as any;
	    const unrelated = { uid: "other", masterCode: "B-18", x: 60, y: 0, width: 18, depth: 24, height: 34.5 } as any;
	    const moved = { ...selected, x: 13 };
	    const result = commitThreeDCabinetCandidate([selected, unrelated], "selected", moved);
	    expect(result?.[0]).toEqual(moved);
	    expect(result?.[0]).not.toBe(selected);
	    expect(result?.[1]).toBe(unrelated);
	    expect(commitThreeDCabinetCandidate([selected, unrelated], "missing", moved)).toBeNull();
	    expect(commitThreeDCabinetCandidate([selected, unrelated], "selected", { ...moved, uid: "other" })).toBeNull();
	  });

	  it("drops a selected wall cabinet exactly onto the finished countertop while preserving its identity and plan position", () => {
	    const selected = {
	      uid: "selected-wall",
	      cabinetId: 3624,
	      distributorSkuId: 93624,
	      masterCode: "W-36-24",
	      description: "36-inch wall cabinet",
	      placement: "wall",
	      x: 48,
	      y: 0,
	      width: 36,
	      depth: 12,
	      height: 24,
	      rotation: 0,
	      mountBottom: 70,
	      styleId: 44,
	      price: 259.35,
	    } as any;
	    const candidate = countertopMountedCabinet(selected);
	    expect(candidate).toMatchObject({
	      uid: "selected-wall",
	      cabinetId: 3624,
	      distributorSkuId: 93624,
	      masterCode: "W-36-24",
	      placement: "wall",
	      x: 48,
	      y: 0,
	      width: 36,
	      depth: 12,
	      height: 24,
	      rotation: 0,
	      styleId: 44,
	      price: 259.35,
	      mountBottom: STD.COUNTERTOP_HEIGHT,
	      mountBottomAdjusted: true,
	    });
	    expect(elevationBox(candidate, room as any)).toEqual({ bottom: STD.COUNTERTOP_HEIGHT, height: 24 });
	  });

	  it("allows exact edge contact above a base run and detects a real cabinet overlap at countertop height", () => {
	    const base = { uid: "base", masterCode: "B-36", description: "Base cabinet", placement: "base", x: 48, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0 } as any;
	    const wall = { uid: "wall", masterCode: "W-36-24", description: "Wall cabinet", placement: "wall", x: 48, y: 0, width: 36, depth: 12, height: 24, rotation: 0, mountBottom: 70 } as any;
	    const candidate = countertopMountedCabinet(wall);
	    const blocker = { ...candidate, uid: "blocker", masterCode: "W-36-30" };
	    expect(hasCollision(candidate, [base])).toBe(false);
	    expect(hasCollision(candidate, [blocker])).toBe(true);
	  });
});
