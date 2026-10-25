import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, appendCollisionFreePlacements, cabinetPlacementCollisionDetail, STD, type PlacedCabinet, wallLength, wallPlacementAt } from "@/lib/design";
import { buildDesignCabinetCartLines, buildDesignPreviewPricingLines } from "@/lib/designCartLines";
import { automaticAngledWallFiller, angledWallTransitionFootprint, measuredAngledWallTransition, repairMissingAngledWallFillers } from "./angledWallFiller";

const room = {
  ...DEFAULT_ROOM,
  width: 180,
  depth: 180,
  vertices: [
    { id: "v1", x: 0, y: 0 },
    { id: "v2", x: 60, y: 60 },
    { id: "v3", x: 60, y: 180 },
    { id: "v4", x: 0, y: 180 },
  ],
  customWalls: [
    { id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 as const },
    { id: "straight", startVertexId: "v2", endVertexId: "v3" },
    { id: "return", startVertexId: "v3", endVertexId: "v4" },
    { id: "close", startVertexId: "v4", endVertexId: "v1" },
  ],
};

function cabinet(uid: string, wallId: string, offset: number, placement: "wall" | "base" | "tall" = "wall", width = 24): PlacedCabinet {
  const depth = placement === "wall" ? 12 : 24;
  const height = placement === "wall" ? 42 : placement === "tall" ? 96 : 34.5;
  const spot = wallPlacementAt(offset, width, depth, wallId as any, room);
  return {
    uid,
    cabinetId: 10,
    masterCode: placement === "wall" ? "W-2442" : placement === "tall" ? "T-2496" : "B-24",
    description: placement === "wall" ? '24" x 42" Wall Cabinet' : placement === "tall" ? '24" x 96" Tall Cabinet' : '24" Base Cabinet',
    placement,
    x: spot.x,
    y: spot.y,
    width,
    depth,
    height,
    rotation: spot.rotation,
    wallId,
    wallOffset: spot.wallOffset,
    mountBottom: placement === "wall" ? 54 : 0,
    numberOfDoors: 2,
    numberOfDrawers: placement === "wall" ? 0 : 1,
  };
}

const wallFiller = {
  id: 99,
  masterCode: "WF1242",
  description: '12" x 42" Wall Filler',
  category: "Filler",
  subCategory: "Filler",
  width: "12",
  height: "42",
  depth: "12",
  catalogImageUrl: null,
};

const baseFiller = {
  id: 199,
  masterCode: "BF-12",
  description: '12" x 34.5" Base Filler',
  category: "Filler",
  subCategory: "Filler",
  width: "12",
  height: "34.5",
  depth: "24",
  catalogImageUrl: null,
};

const baseFiller3 = {
  ...baseFiller,
  id: 200,
  masterCode: "BF3",
  description: '3" x 34.5" Base Filler',
  width: "3",
};

const tallCuttableFiller = {
  id: 299,
  masterCode: "F396",
  description: '3" x 96" Tall Filler',
  category: "Filler",
  subCategory: "Filler",
  width: "3",
  height: "96",
  depth: null,
  catalogImageUrl: null,
};

const tallWideCuttableFiller = {
  ...tallCuttableFiller,
  id: 300,
  masterCode: "F1296",
  description: '12" x 96" Tall Filler',
  width: "12",
};

function polygonArea(points: Array<{ x: number; y: number }>) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function pair(placement: "wall" | "base" | "tall") {
  const diagonalLength = wallLength("diagonal" as any, room);
  const neighbor = cabinet(`${placement}-neighbor`, "diagonal", diagonalLength - 24, placement);
  const newlyPlaced = cabinet(`${placement}-new`, "straight", 3, placement);
  return { neighbor, newlyPlaced };
}

	describe("automaticAngledWallFiller", () => {
	  it("builds the two-board pair only after a second cabinet completes the 45-degree turn", () => {
	    const { neighbor, newlyPlaced } = pair("wall");
	    const provisional: PlacedCabinet = {
	      ...cabinet("first-corner-provisional", "straight", 10, "wall", 1),
	      masterCode: "WF1242",
	      fillerPieceGroupId: "filler-group-first-corner",
	      fillerTransitionKind: "corner-provisional",
	      fillerForCabinetUid: neighbor.uid,
	    };
	    let number = 0;
	    const resolution = automaticAngledWallFiller(newlyPlaced, room, [neighbor, provisional, newlyPlaced], [wallFiller], () => `completed-pair-${++number}`, 7)!;
	    expect(resolution.fillers).toHaveLength(2);
	    expect(resolution.fillers.map((filler) => filler.fillerTransitionPiece)).toEqual(["owner", "neighbor"]);
	    expect(resolution.fillers.every((filler) => filler.fillerTransitionKind === "front-miter-pair")).toBe(true);
	  });

  it.each([
    ["base", STD.BASE_DEPTH],
    ["wall", STD.WALL_DEPTH],
  ] as const)("anchors a %s 45° miter at its %d-inch cabinet-front datum even when source depth is stale", (placement, expectedFrontDatum) => {
    const { neighbor, newlyPlaced } = pair(placement);
    // The stored plan coordinates intentionally retain their initial standard
    // placement, while a stale import reports the wrong nominal depth. The
    // physical 45° front must still be 24″ from a base back and 12″ from a wall
    // back—the installer-facing datum supplied by the owner.
    const ownerWithStaleDepth = { ...newlyPlaced, depth: 6 };
    const neighborWithStaleDepth = { ...neighbor, depth: 6 };
    const measurement = measuredAngledWallTransition(ownerWithStaleDepth, room, [neighborWithStaleDepth, ownerWithStaleDepth]);

    expect(measurement).toMatchObject({ depthIn: expectedFrontDatum });
    expect(Math.hypot(
      measurement!.ownerFace.front.x - measurement!.ownerFace.rear.x,
      measurement!.ownerFace.front.y - measurement!.ownerFace.rear.y,
    )).toBeCloseTo(expectedFrontDatum, 8);
  });

  it("builds two front-only, 45°-mitered wall-filler pieces instead of a deep wedge at the rear of the run", () => {
    const { neighbor, newlyPlaced } = pair("wall");
    const measurement = measuredAngledWallTransition(newlyPlaced, room, [neighbor, newlyPlaced]);
    expect(measurement).toMatchObject({
      rearGapIn: 3,
      neighborRearGapIn: 0,
      frontGapIn: 6.5,
      ownerFrontCutIn: 2,
      neighborFrontCutIn: 5,
      requiredStockWidthIn: 5,
      depthIn: 12,
      neighborUid: "wall-neighbor",
    });

    let number = 0;
    const resolution = automaticAngledWallFiller(newlyPlaced, room, [neighbor, newlyPlaced], [wallFiller], () => `front-wall-${++number}`, 7)!;
    expect(resolution).toMatchObject({ ownerGapIn: 2, neighborGapIn: 5, miterAt: "start" });
    expect(resolution.fillers.map((filler) => ({
      cabinetId: filler.cabinetId,
      masterCode: filler.masterCode,
      placement: filler.placement,
      nominalWidth: filler.nominalWidth,
      fillerTransitionKind: filler.fillerTransitionKind,
      fillerBillingRole: filler.fillerBillingRole,
      fillerMiterAngle: filler.fillerMiterAngle,
      fillerTransitionPiece: filler.fillerTransitionPiece,
    }))).toEqual([
      { cabinetId: 99, masterCode: "WF1242", placement: "wall", nominalWidth: 12, fillerTransitionKind: "front-miter-pair", fillerBillingRole: "primary", fillerMiterAngle: 22.5, fillerTransitionPiece: "owner" },
      { cabinetId: 99, masterCode: "WF1242", placement: "wall", nominalWidth: 12, fillerTransitionKind: "front-miter-pair", fillerBillingRole: "primary", fillerMiterAngle: 22.5, fillerTransitionPiece: "neighbor" },
    ]);
    expect(resolution.fillers[0].width).toBeCloseTo(1.9705627485, 8);
    expect(resolution.fillers[1].width).toBeCloseTo(4.9705627485, 8);
    for (const filler of resolution.fillers) {
      const footprint = angledWallTransitionFootprint(filler, room, [neighbor, newlyPlaced, ...resolution.fillers]);
      expect(footprint).toHaveLength(4);
      // A 3/4-inch-deep 45° board stays at the cabinet front; it never uses
      // the full 12-inch wall depth.
      expect(polygonArea(footprint!)).toBeGreaterThan(0);
      expect(polygonArea(footprint!)).toBeLessThan(filler.width * 0.75);
      expect(cabinetPlacementCollisionDetail(filler, [neighbor, newlyPlaced], room)).toBeNull();
    }
    expect(appendCollisionFreePlacements([neighbor, newlyPlaced], resolution.fillers, room).rejected).toEqual([]);
  });

	  it("uses the same two-piece, front-only miter rule for base cabinets", () => {
    const { neighbor, newlyPlaced } = pair("base");
    let number = 0;
    const resolution = automaticAngledWallFiller(newlyPlaced, room, [neighbor, newlyPlaced], [baseFiller], () => `front-base-${++number}`, 7)!;
    expect(resolution).toMatchObject({ ownerGapIn: 7, neighborGapIn: 10 });
    expect(resolution.fillers.map((filler) => ({
      placement: filler.placement,
      masterCode: filler.masterCode,
      height: filler.height,
      depth: filler.depth,
      fillerTransitionKind: filler.fillerTransitionKind,
      fillerTransitionPiece: filler.fillerTransitionPiece,
    }))).toEqual([
      { placement: "base", masterCode: "BF-12", height: 34.5, depth: 24, fillerTransitionKind: "front-miter-pair", fillerTransitionPiece: "owner" },
      { placement: "base", masterCode: "BF-12", height: 34.5, depth: 24, fillerTransitionKind: "front-miter-pair", fillerTransitionPiece: "neighbor" },
    ]);
    expect(resolution.fillers[0].width).toBeCloseTo(6.941125497, 8);
    expect(resolution.fillers[1].width).toBeCloseTo(9.941125497, 8);
    for (const filler of resolution.fillers) {
      const footprint = angledWallTransitionFootprint(filler, room, [neighbor, newlyPlaced, ...resolution.fillers]);
      expect(polygonArea(footprint!)).toBeGreaterThan(0);
      expect(polygonArea(footprint!)).toBeLessThan(filler.width * 0.75);
      expect(cabinetPlacementCollisionDetail(filler, [neighbor, newlyPlaced], room)).toBeNull();
    }
	    expect(appendCollisionFreePlacements([neighbor, newlyPlaced], resolution.fillers, room).rejected).toEqual([]);
	  });

  it("uses two real cabinet-height tall filler pieces for any tall-cabinet 45-degree transition", () => {
    const { neighbor, newlyPlaced } = pair("tall");
    let number = 0;
    const resolution = automaticAngledWallFiller(
      newlyPlaced,
      room,
      [neighbor, newlyPlaced],
      [tallWideCuttableFiller],
      () => `front-tall-${++number}`,
      7,
    )!;
    expect(resolution.fillers).toHaveLength(2);
    expect(resolution.fillers).toEqual(expect.arrayContaining([
      expect.objectContaining({ placement: "tall", masterCode: "F1296", height: 96, nominalHeight: 96, fillerMiterAngle: 22.5 }),
    ]));
    expect(resolution.fillers.every((filler) => filler.fillerBillingRole === "primary")).toBe(true);
    expect(resolution.fillers.every((filler) => filler.description.includes("22.5° miter (forms 45° turn)"))).toBe(true);
    expect(appendCollisionFreePlacements([neighbor, newlyPlaced], resolution.fillers, room).rejected).toEqual([]);
  });

  it("automatically closes an 11-inch measured-wall 45-degree hold with two cabinet-height 3-inch source fillers", () => {
    const diagonalLength = wallLength("diagonal" as any, room);
    const neighbor = cabinet("base-45-neighbor", "diagonal", diagonalLength - 24 - 11, "base");
    const owner = cabinet("base-45-owner", "straight", 11, "base");
    const measurement = measuredAngledWallTransition(owner, room, [neighbor, owner]);
    expect(measurement).toMatchObject({
      rearGapIn: 11,
      neighborRearGapIn: 11,
      ownerFrontCutIn: 1,
      neighborFrontCutIn: 1,
    });
    let number = 0;
    const resolution = automaticAngledWallFiller(owner, room, [neighbor, owner], [baseFiller3], () => `base-45-${++number}`, 7)!;
    expect(resolution.fillers).toHaveLength(2);
    for (const filler of resolution.fillers) {
      expect(filler).toMatchObject({
        cabinetId: 200,
        masterCode: "BF3",
        placement: "base",
        height: 34.5,
        fillerTransitionKind: "front-miter-pair",
        fillerTransitionStockWidthIn: 3,
      });
      const footprint = angledWallTransitionFootprint(filler, room, [neighbor, owner, ...resolution.fillers])!;
      // The diagonal miter makes projected area slightly larger than a plain
      // width × 3/4-inch rectangle, but it remains a narrow front board—not a
      // 24-inch-deep panel or a fabricated corner wedge.
      expect(polygonArea(footprint)).toBeLessThan(filler.width * 2);
    }
    expect(appendCollisionFreePlacements([neighbor, owner], resolution.fillers, room).rejected).toEqual([]);
  });

	  it("closes a 45-degree peninsula return with two source-stock front fillers and no visible face void", () => {
	    const parent = { id: "peninsula-parent", parentWall: "right" as const, startOffset: 84, turn: 90 as const, direction: "right" as const, length: 120, height: 34.5, cabinetSide: "left" as const, locked: true };
	    const child = { id: "peninsula-child", parentRunId: parent.id, startOffset: 0, turn: 45 as const, direction: "right" as const, length: 36, height: 34.5, cabinetSide: "left" as const, locked: true };
	    const peninsulaRoom = { ...DEFAULT_ROOM, width: 180, depth: 180, peninsulaRuns: [parent, child] };
	    const parentSpot = wallPlacementAt(100, 9, 24, parent.id as any, peninsulaRoom, "left");
	    const childSpot = wallPlacementAt(11, 24, 24, child.id as any, peninsulaRoom, "left");
	    const parentBase: PlacedCabinet = {
	      ...cabinet("peninsula-parent-base", "straight", 0, "base", 9),
	      ...parentSpot,
	      masterCode: "SPB9",
	      wallId: parent.id,
	      wallOffset: 100,
	      peninsulaSide: "left",
	    };
	    const childBase: PlacedCabinet = {
	      ...cabinet("peninsula-child-base", "straight", 0, "base", 24),
	      ...childSpot,
	      masterCode: "3DB24",
	      wallId: child.id,
	      wallOffset: 11,
	      peninsulaSide: "left",
	    };
	    const measurement = measuredAngledWallTransition(childBase, peninsulaRoom, [parentBase, childBase]);
	    expect(measurement).toMatchObject({
	      wallId: child.id,
	      neighborWallId: parent.id,
	      rearGapIn: 11,
	      neighborRearGapIn: 11,
	    });
	    expect(measurement!.ownerFrontCutIn).toBeGreaterThanOrEqual(0.5);
	    expect(measurement!.neighborFrontCutIn).toBeGreaterThanOrEqual(0.5);

	    let number = 0;
	    const repaired = repairMissingAngledWallFillers(
	      [parentBase, childBase],
	      peninsulaRoom,
	      [tallCuttableFiller],
	      () => `peninsula-filler-${++number}`,
	      7,
	    );
	    expect(repaired.added).toHaveLength(2);
	    expect(repaired.added.every((filler) => filler.masterCode === "F396" && filler.height === 34.5)).toBe(true);
	    const [leftFootprint, rightFootprint] = repaired.added.map((filler) => angledWallTransitionFootprint(filler, peninsulaRoom, repaired.placed)!);
	    const sharedMiterVertices = leftFootprint.filter((left) => rightFootprint.some((right) => Math.hypot(left.x - right.x, left.y - right.y) < 1e-6));
	    expect(sharedMiterVertices).toHaveLength(2);
	    expect(appendCollisionFreePlacements([parentBase, childBase], repaired.added, peninsulaRoom).rejected).toEqual([]);
	  });

	  it("keeps real source filler boards visible when their selected-line price is missing", () => {
	    const { neighbor, newlyPlaced } = pair("base");
	    let number = 0;
	    const repaired = repairMissingAngledWallFillers(
	      [neighbor, newlyPlaced],
	      room,
	      [baseFiller],
	      () => `unpriced-front-filler-${++number}`,
	      7,
	    );
	    expect(repaired.added).toHaveLength(2);
	    expect(repaired.added.every((filler) => filler.masterCode === baseFiller.masterCode)).toBe(true);
	    expect(appendCollisionFreePlacements([neighbor, newlyPlaced], repaired.added, room).rejected).toEqual([]);
	  });

	  it("price-locks both real front filler pieces at the authoritative selected-line unit price", () => {
    const { neighbor, newlyPlaced } = pair("wall");
    let number = 0;
    const resolution = automaticAngledWallFiller(newlyPlaced, room, [neighbor, newlyPlaced], [wallFiller], () => `front-price-${++number}`, 7)!;
    const common = {
      placed: resolution.fillers,
      styleId: 7,
      distributorId: 21,
      tier: "homeowner" as const,
      styleNameById: new Map([[7, "Selected line"]]),
      unitPriceFor: (placed: PlacedCabinet) => placed.cabinetId === wallFiller.id ? 88.5 : null,
    };
    expect(buildDesignCabinetCartLines(common)).toEqual([
      expect.objectContaining({ masterCode: "WF1242", qty: 2, unitPrice: 88.5, priceLocked: true }),
    ]);
    expect(buildDesignPreviewPricingLines(common)).toEqual([
      expect.objectContaining({ masterCode: "WF1242", qty: 2, unitPrice: 88.5, placementUids: ["front-price-1", "front-price-2"] }),
    ]);
  });

  it("closes a physically drawn 45-degree turn even when it was not tagged as locked", () => {
    const ninetyRoom = { ...room, customWalls: room.customWalls.map((wall) => wall.id === "diagonal" ? { ...wall, lockedAngle: undefined } : wall) };
    const diagonalLength = wallLength("diagonal" as any, ninetyRoom);
    const neighbor = cabinet("neighbor", "diagonal", diagonalLength - 24);
    const newlyPlaced = cabinet("new", "straight", 3);
    const resolution = automaticAngledWallFiller(newlyPlaced, ninetyRoom, [neighbor, newlyPlaced], [wallFiller], () => "front-pair", null);
    expect(resolution?.fillers).toHaveLength(2);
    expect(resolution?.fillers.every((filler) => filler.fillerTransitionKind === "front-miter-pair")).toBe(true);
  });

  it("does not fabricate a pair at a physical 90-degree wall join", () => {
    const neighbor = cabinet("ninety-neighbor", "straight", wallLength("straight" as any, room) - 24);
    const newlyPlaced = cabinet("ninety-new", "return", 0);
    expect(automaticAngledWallFiller(newlyPlaced, room, [neighbor, newlyPlaced], [wallFiller], () => "front-pair", null)).toBeNull();
  });

  it("does not invent a pair when the selected line lacks stock for either measured front cut", () => {
    const { neighbor, newlyPlaced } = pair("wall");
    const undersized = { ...wallFiller, id: 100, masterCode: "WF-4", width: "4", description: '4" x 42" Wall Filler' };
    expect(automaticAngledWallFiller(newlyPlaced, room, [neighbor, newlyPlaced], [undersized], () => "front-pair", null)).toBeNull();
  });
});
