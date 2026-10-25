import { describe, expect, it } from "vitest";
import type { RoomData, PlacedCabinet } from "./design";
import { alternateWallPlacementRecommendation, cabinetWallMovePreview,
  hasCollision, blindCornerSnapInfo, cabinetCollisionDetail, cabinetCornerPlacementInfo, cabinetPlacementCollisionDetail, cabinetWallRunLength, cabinetWallRunSegment, clampCabinetsToRoom, clampCabinetToRoom, collisionReason, containCabinetOnDrawnWalls, countertopArea, COUNTERTOP_DEPTH_IN, countertopPolygonSelfIntersects, countertopRunFaceNormal, countertopSurfacePlanPolygon, countertopSurfaces, customWallTrueCornerPlacement, DEFAULT_ROOM, firstCollisionFreePeninsulaPlacement, freeSegmentsOnWall, isCustomRoomWall, miteredPeninsulaCountertopSurfaces, nextAvailablePeninsulaCornerPlacement, nextAvailableRoomCornerPlacement, normalizeLegacyPeninsulaCabinets, paletteActiveWallPlacement, PENINSULA_INSIDE_CORNER_CLEARANCE_IN, peninsulaAutomaticStartOffset, peninsulaCountertopPonyWallBackExtensionIn, peninsulaCountertopPonyWallBarOverhang, peninsulaCountertopSeatingOverhang, peninsulaCountertopSurface, peninsulaCountertopWaterfallEnd, peninsulaRootRunId, peninsulaRunAssemblyLocked, peninsulaRunEndpoints, peninsulaRunHitAtPoint, peninsulaRunMaxLength, peninsulaRunOffsetAtPoint, peninsulaRunStartOffsetAtPoint, placedFootprint, removePeninsulaRun, retainedWallSegmentForSplit, selectedCornerBaseWallPlacement, shouldBlockPlacementCollision, snapWallCabinetToOwningWall, STD, wallGapFitPreview, wallLength, wallPlacementAt } from "./design";
import { buildDesignCabinetCartLines } from "./designCartLines";
import { buildMaterialsListRows } from "./designMaterialsList";
import { buildSurfaceCartLines } from "./surfaceCartLines";

/** Shared engine magnet from the body's current position (same call the Designer's moveCabinet makes). */
function magnetSnap(moving: PlacedCabinet, room: RoomData, peers: PlacedCabinet[], openings: WallOpening[]): PlacedCabinet | null {
  const preview = cabinetWallMovePreview(moving, { x: moving.x, y: moving.y }, room, peers, openings, { magnet: true });
  return preview.candidate ?? null;
}


const angledRoom: RoomData = {
  width: 240,
  depth: 180,
  ceilingHeight: 96,
  vertices: [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 120, y: 120 },
    { id: "c", x: 240, y: 120 },
    { id: "d", x: 240, y: 180 },
    { id: "e", x: 0, y: 180 },
  ],
  customWalls: [
    { id: "diag", startVertexId: "a", endVertexId: "b", label: "Angled wall", lockedAngle: 45 },
  ],
};

const builderRoom: RoomData = {
  width: 120,
  depth: 96,
  ceilingHeight: 96,
  vertices: [
    { id: "builder-a", x: 0, y: 0 },
    { id: "builder-b", x: 120, y: 0 },
    { id: "builder-c", x: 120, y: 96 },
    { id: "builder-d", x: 0, y: 96 },
  ],
  customWalls: [
    { id: "builder-top", startVertexId: "builder-a", endVertexId: "builder-b", label: "Wall 1" },
    { id: "builder-right", startVertexId: "builder-b", endVertexId: "builder-c", label: "Wall 2" },
    { id: "builder-bottom", startVertexId: "builder-c", endVertexId: "builder-d", label: "Wall 3" },
    { id: "builder-left", startVertexId: "builder-d", endVertexId: "builder-a", label: "Wall 4" },
  ],
};

const peninsulaRoom: RoomData = {
  width: 144,
  depth: 144,
  ceilingHeight: 96,
  peninsulaRuns: [{
    id: "peninsula-90-right",
    parentWall: "top",
    startOffset: 48,
    turn: 90,
    direction: "right",
    length: 96,
    height: 34.5,
    label: "Peninsula · 90° right",
  }],
};

function peninsulaCabinet(uid: string, offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, 30, 24, "peninsula-90-right" as any, peninsulaRoom);
  return {
    uid,
    cabinetId: 2,
    masterCode: "B-30",
    description: "Peninsula base cabinet",
    placement: "base",
    x: spot.x,
    y: spot.y,
    width: 30,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
  };
}

function angledCabinet(uid: string, offset: number, placement: "base" | "wall" = "base"): PlacedCabinet {
  const width = 36;
  const depth = placement === "wall" ? 12 : 24;
  const spot = wallPlacementAt(offset, width, depth, "diag" as any, angledRoom);
  return {
    uid,
    cabinetId: 1,
    masterCode: placement === "wall" ? "W-36-30" : "B-36",
    description: "Angled run cabinet",
    placement,
    x: spot.x,
    y: spot.y,
    width,
    depth,
    height: placement === "wall" ? 30 : 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
  };
}

describe("locked 45-degree cabinet wall placement", () => {
  it("places base and wall cabinets with the exact locked rotation and wall identity", () => {
    const base = angledCabinet("base", 0, "base");
    const wall = angledCabinet("wall", 0, "wall");
    expect(base).toMatchObject({ rotation: 45, wallId: "diag", wallOffset: 0 });
    expect(wall).toMatchObject({ rotation: 45, wallId: "diag", wallOffset: 0 });
  });

  it("allows edge-to-edge angled cabinets and rejects a real along-run overlap", () => {
    const first = angledCabinet("one", 0);
    const butted = angledCabinet("two", 36);
    const overlap = angledCabinet("three", 35);
    expect(cabinetCollisionDetail(butted, [first])).toBeNull();
    expect(cabinetCollisionDetail(overlap, [first])?.penetration).toBeCloseTo(1);
  });

  it("reserves the 11-inch face-clearance only where a measured run meets a locked 45-degree wall", () => {
    const joinedRoom: RoomData = {
      ...DEFAULT_ROOM,
      width: 180,
      depth: 180,
      vertices: [
        { id: "j1", x: 0, y: 0 },
        { id: "j2", x: 60, y: 60 },
        { id: "j3", x: 60, y: 180 },
      ],
      customWalls: [
        { id: "join-45", startVertexId: "j1", endVertexId: "j2", lockedAngle: 45 },
        { id: "join-straight", startVertexId: "j2", endVertexId: "j3" },
      ],
    };
    expect(freeSegmentsOnWall("join-straight" as any, joinedRoom, [], [], 0.5, 0, "base")).toEqual([
      { start: PENINSULA_INSIDE_CORNER_CLEARANCE_IN, length: 109 },
    ]);
    expect(freeSegmentsOnWall("builder-right" as any, builderRoom, [], [], 0.5, 0, "base")).toEqual([
      { start: 0, length: 96 },
    ]);

    const diagonalNinetyRoom: RoomData = {
      ...DEFAULT_ROOM,
      width: 180,
      depth: 180,
      vertices: [
        { id: "d1", x: 0, y: 0 },
        { id: "d2", x: 60, y: 60 },
        { id: "d3", x: 120, y: 0 },
      ],
      customWalls: [
        { id: "d45-a", startVertexId: "d1", endVertexId: "d2", lockedAngle: 45 },
        // Two diagonal walls can form a physical 90° turn. Despite one being
        // locked at 45° to the canvas, cabinet faces sit flush at this join.
        { id: "d45-b", startVertexId: "d2", endVertexId: "d3" },
      ],
    };
    expect(freeSegmentsOnWall("d45-b" as any, diagonalNinetyRoom, [], [], 0.5, 0, "base")).toEqual([
      { start: 0, length: 84.85 },
    ]);

    const diagonalLength = wallLength("join-45" as any, joinedRoom);
    const diagonalSpot = wallPlacementAt(diagonalLength - 35, 24, 24, "join-45" as any, joinedRoom);
    const seatedDiagonalBase: PlacedCabinet = {
      uid: "join-diagonal-base",
      cabinetId: 24,
      masterCode: "B24",
      description: "24 inch Base Cabinet",
      placement: "base",
      ...diagonalSpot,
      width: 24,
      depth: 24,
      height: 34.5,
      wallId: "join-45",
      wallOffset: diagonalLength - 35,
    };
    expect(paletteActiveWallPlacement("join-straight" as any, joinedRoom, [seatedDiagonalBase], [], 24, 24, "base")).toMatchObject({
      wallId: "join-straight",
      wallOffset: PENINSULA_INSIDE_CORNER_CLEARANCE_IN,
    });
  });

  it("releases an exact void after removal so the same cabinet can be returned", () => {
    const first = angledCabinet("one", 0);
    const second = angledCabinet("two", 36);
    const withRun = freeSegmentsOnWall("diag" as any, angledRoom, [first, second], [], 0.5, 0, "base");
    expect(withRun.some((segment) => segment.start === 36 && segment.length >= 36)).toBe(false);

    const afterRemoval = freeSegmentsOnWall("diag" as any, angledRoom, [first], [], 0.5, 0, "base");
    const releasedVoid = afterRemoval.find((segment) => segment.start <= 36 && segment.start + segment.length >= 72);
    expect(releasedVoid).toBeDefined();
    expect(releasedVoid!.length).toBeGreaterThanOrEqual(36);
  });

  it("keeps an angled cabinet in the same price and materials workflow as a straight cabinet", () => {
    const base = angledCabinet("priced-angle", 0);
    const lines = buildDesignCabinetCartLines({
      placed: [base],
      styleId: 77,
      distributorId: 11,
      tier: "homeowner",
      styleNameById: new Map([[77, "Test finish"]]),
      unitPriceFor: () => 250,
    });
    expect(lines).toEqual([expect.objectContaining({ masterCode: "B-36", qty: 1, unitPrice: 250 })]);
    expect(buildMaterialsListRows({ buildRows: [], pricingLines: lines })).toEqual([
      expect.objectContaining({ code: "B-36", qty: 1, unitPrice: 250, section: "cabinet" }),
    ]);
  });
});

describe("continuous builder custom wall placement", () => {
	  it("keeps a DB24 and DW-24 preview-to-release valid beside a restored SB36 on a measured diagonal wall", () => {
	    const diagonalRoom: RoomData = {
	      width: 180,
	      depth: 180,
	      ceilingHeight: 96,
	      vertices: [
	        { id: "wall-start", x: 0, y: 0 },
	        { id: "wall-end", x: 120, y: 120 },
	      ],
	      customWalls: [{ id: "wall-45", startVertexId: "wall-start", endVertexId: "wall-end", lockedAngle: 45 }],
	    };
	    const seatedSinkSpot = wallPlacementAt(48, 36, 24, "wall-45" as any, diagonalRoom);
	    // This mirrors a draft saved before wallId/wallOffset were written. The
	    // renderer can show it on the diagonal wall, but a final drop must repair
	    // that ownership before using collision geometry.
	    const staleSink: PlacedCabinet = {
	      uid: "stale-sb36", cabinetId: 1, masterCode: "SB36", description: "36 inch Sink Base",
	      placement: "base", x: seatedSinkSpot.x, y: seatedSinkSpot.y, width: 36, depth: 24, height: 34.5,
	      rotation: seatedSinkSpot.rotation,
	    };
	    const [sink] = clampCabinetsToRoom([staleSink], diagonalRoom);
	    expect(sink).toMatchObject({ wallId: "wall-45", wallOffset: 48, rotation: 45 });

	    const gaps = freeSegmentsOnWall("wall-45" as any, diagonalRoom, [sink], [], 0.5, 0, "base")
	      .map((segment) => ({ side: "wall-45" as any, layer: "base" as const, start: segment.start, length: segment.length, center: segment.start + segment.length / 2, isStandardSize: false, isFillerSize: false }));
	    const preview = wallGapFitPreview(gaps, 96, 24);
	    expect(preview).toMatchObject({ status: "valid", snapStart: 84 });

	    for (const [uid, masterCode, placement] of [
	      ["db24-release", "3-DB24", "base"],
	      ["dw24-release", "DW-24", "appliance"],
	    ] as const) {
	      const spot = wallPlacementAt(preview!.snapStart, 24, 24, "wall-45" as any, diagonalRoom);
	      const released: PlacedCabinet = {
	        uid, cabinetId: 2, masterCode, description: masterCode === "DW-24" ? "Dishwasher 24 inch" : "24 inch drawer base",
	        placement, x: spot.x, y: spot.y, width: 24, depth: 24, height: 34.5, rotation: spot.rotation,
	        wallId: spot.wallId, wallOffset: preview!.snapStart,
	      };
	      expect(cabinetPlacementCollisionDetail(released, [sink], diagonalRoom)).toBeNull();

	      const positiveOverlap = { ...released, wallOffset: preview!.snapStart - 0.125, ...wallPlacementAt(preview!.snapStart - 0.125, 24, 24, "wall-45" as any, diagonalRoom) };
	      expect(cabinetPlacementCollisionDetail(positiveOverlap, [sink], diagonalRoom)).toMatchObject({ cabinet: sink });
	    }
	  });

  it("treats every straight generated wall as an explicit cabinet-ready run", () => {
    expect(isCustomRoomWall(builderRoom, "builder-top")).toBe(true);
    expect(isCustomRoomWall(builderRoom, "builder-right")).toBe(true);
    expect(wallLength("builder-bottom" as any, builderRoom)).toBe(120);
    expect(freeSegmentsOnWall("builder-left" as any, builderRoom, [], [], 0.5, 0, "base")).toEqual([{ start: 0, length: 96 }]);
  });

  it("places cabinets against all four custom wall bearings with exact wall ownership", () => {
    expect(wallPlacementAt(0, 30, 24, "builder-top" as any, builderRoom)).toMatchObject({ rotation: 0, wallId: "builder-top", wallOffset: 0 });
    expect(wallPlacementAt(0, 30, 24, "builder-right" as any, builderRoom)).toMatchObject({ rotation: 90, wallId: "builder-right", wallOffset: 0 });
    expect(wallPlacementAt(0, 30, 24, "builder-bottom" as any, builderRoom)).toMatchObject({ rotation: 180, wallId: "builder-bottom", wallOffset: 0 });
    expect(wallPlacementAt(0, 30, 24, "builder-left" as any, builderRoom)).toMatchObject({ rotation: 270, wallId: "builder-left", wallOffset: 0 });
  });

  it("reserves a seated ERB corner cabinet's adjoining custom-wall leg before placing a straight cabinet", () => {
    const topRightSpot = wallPlacementAt(84, 36, 24, "builder-top" as any, builderRoom);
    const erb: PlacedCabinet = {
      uid: "erb36-top-right",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      ...topRightSpot,
      rotation: 90,
      width: 36,
      depth: 24,
      height: 34.5,
      wallId: "builder-top",
      wallOffset: 84,
    };
    expect(freeSegmentsOnWall("builder-right" as any, builderRoom, [erb], [], 0.5, 0, "base")).toEqual([
      { start: 36, length: 60 },
    ]);

    const b12Spot = wallPlacementAt(0, 12, 24, "builder-right" as any, builderRoom);
    const b12: PlacedCabinet = {
      uid: "b12-over-erb",
      cabinetId: 12,
      masterCode: "B12",
      description: "12 inch Base Cabinet",
      placement: "base",
      ...b12Spot,
      width: 12,
      depth: 24,
      height: 34.5,
      wallId: "builder-right",
      wallOffset: 0,
    };
    expect(cabinetPlacementCollisionDetail(b12, [erb], builderRoom)?.cabinet.uid).toBe(erb.uid);
    expect(shouldBlockPlacementCollision(b12, [erb])).toBe(true);
  });

  it("exposes the true LSB36 leg edge so a DB24 or dishwasher seats flush without a false collision", () => {
    const topRightSpot = wallPlacementAt(84, 36, 24, "builder-top" as any, builderRoom);
    const lsb: PlacedCabinet = {
      uid: "lsb36-top-right",
      cabinetId: 36,
      masterCode: "LSB36",
      description: "Lazy Susan Base 36",
      placement: "base",
      ...topRightSpot,
      rotation: 90,
      width: 36,
      depth: 24,
      height: 34.5,
      wallId: "builder-top",
      wallOffset: 84,
    };
    const segments = freeSegmentsOnWall("builder-right" as any, builderRoom, [lsb], [], 0.5, 0, "base");
    // The exposed adjoining-wall edge is the 36-inch outer corner envelope.
    // Its 12-inch interior notch is not a second cabinet run.
    expect(segments).toEqual([{ start: 36, length: 60 }]);

    const db24Spot = wallPlacementAt(36, 24, 24, "builder-right" as any, builderRoom);
    const db24: PlacedCabinet = {
      uid: "db24-at-lsb-edge",
      cabinetId: 24,
      masterCode: "3DB24",
      description: "Drawer Base 24",
      placement: "base",
      ...db24Spot,
      width: 24,
      depth: 24,
      height: 34.5,
      wallId: "builder-right",
      wallOffset: 36,
    };
    expect(cabinetPlacementCollisionDetail(db24, [lsb], builderRoom)).toBeNull();
    expect(cabinetPlacementCollisionDetail({ ...db24, uid: "dw24-at-lsb-edge", masterCode: "DW24", description: "Dishwasher 24", placement: "appliance" }, [lsb], builderRoom)).toBeNull();
  });

  it("snaps an ERB corner cabinet to the first available right-angle vertex in advanced continuous-wall mode", () => {
    const moving: PlacedCabinet = {
      uid: "erb36-preview",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
    };
    expect(nextAvailableRoomCornerPlacement(moving, "builder-top" as any, { ...builderRoom, openWallPath: true }, [])).toMatchObject({
      wallId: "builder-top",
      wallOffset: 0,
      rotation: 0,
    });
  });

  it("keeps real-corner snapping when the continuous wall path is closed", () => {
    const moving: PlacedCabinet = {
      uid: "erb36-closed-room-preview",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
    };
    // Wall Builder uses openWallPath=false once a measured chain closes. The
    // height on each generated wall identifies it as the advanced authoring
    // model, not a beginner seeded polygon.
    const closedWallBuilderRoom: RoomData = {
      ...builderRoom,
      openWallPath: false,
      customWalls: builderRoom.customWalls.map((wall) => ({ ...wall, height: 96 })),
    };
    expect(nextAvailableRoomCornerPlacement(moving, "builder-top" as any, closedWallBuilderRoom, [])).toMatchObject({
      wallId: "builder-top",
      wallOffset: 0,
      rotation: 0,
    });
  });

  it("uses actual legacy custom walls even when old saved data has no mode or height metadata", () => {
    const moving: PlacedCabinet = {
      uid: "erb36-legacy-continuous-preview",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
    };
    // This is the shape produced by older saved Continuous Wall Builder plans:
    // explicit vertices/walls but no `openWallPath` and no stored wall heights.
    expect(nextAvailableRoomCornerPlacement(moving, "builder-top" as any, builderRoom, [])).toMatchObject({
      wallId: "builder-top",
      wallOffset: 0,
      x: 0,
      y: 0,
      rotation: 0,
    });

    const noTrueCorner: RoomData = {
      width: 144,
      depth: 120,
      vertices: [{ id: "a", x: 20, y: 20 }, { id: "b", x: 120, y: 20 }],
      customWalls: [{ id: "legacy-single-wall", startVertexId: "a", endVertexId: "b", label: "Wall 1" }],
    };
    // Never invent a graph-boundary corner when the user has drawn only one wall.
    expect(nextAvailableRoomCornerPlacement(moving, "legacy-single-wall" as any, noTrueCorner, [])).toBeNull();
  });

  it("lets a dragged corner cabinet target the nearest open real corner rather than its old wall", () => {
    const moving: PlacedCabinet = {
      uid: "erb36-drag-preview",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "builder-top",
      wallOffset: 0,
    };
    const room = { ...builderRoom, openWallPath: true };
    expect(nextAvailableRoomCornerPlacement(moving, "builder-top" as any, room, [], { x: 120, y: 96 })).toMatchObject({
      // The lower wall is the local +X leg and the right wall is local +Y.
      // This keeps the shared vertex at the actual L body corner rather than
      // merely preserving whichever incident wall was selected before dragging.
      wallId: "builder-bottom",
      wallOffset: 0,
      rotation: 180,
    });
    expect(nextAvailableRoomCornerPlacement(moving, "builder-top" as any, room, [], { x: 60, y: 48 })).toBeNull();
  });

  it("snaps an ERB to a real 90-degree vertex made from diagonal continuous walls without an 11-inch gap", () => {
    const diagonalRightAngleRoom: RoomData = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "diagonal-a", x: 0, y: 0 },
        { id: "diagonal-corner", x: 100, y: 100 },
        { id: "diagonal-b", x: 50, y: 150 },
      ],
      customWalls: [
        { id: "diagonal-first", startVertexId: "diagonal-a", endVertexId: "diagonal-corner", label: "Wall 1", lockedAngle: 45 },
        { id: "diagonal-second", startVertexId: "diagonal-corner", endVertexId: "diagonal-b", label: "Wall 2", lockedAngle: 45 },
      ],
    };
    const erb: PlacedCabinet = {
      uid: "diagonal-erb36-preview",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
    };
    const spot = nextAvailableRoomCornerPlacement(erb, "diagonal-second" as any, diagonalRightAngleRoom, []);
    expect(spot).toMatchObject({ wallId: "diagonal-second", wallOffset: 0 });
    // The real ERB36 body is a 36×36 physical corner envelope even though
    // catalog depth can be recorded as 24". Its rotated bounding box is placed
    // so the body—not just an abstract wall offset—reaches the vertex at 100,100.
    expect(spot!.x).toBeCloseTo(100 - 36 * Math.SQRT2, 8);
    expect(spot!.y).toBeCloseTo(100 - 36 * Math.SQRT2 / 2, 8);
    expect(spot!.rotation).toBe(135);
    expect(cabinetCornerPlacementInfo({ ...erb, ...spot!, wallId: spot!.wallId, wallOffset: spot!.wallOffset }, diagonalRightAngleRoom)).toEqual({
      angle: 90,
      placement: "flush",
      clearanceIn: 0,
    });
  });

  it("uses both wall rays to seat an ERB36 inside a downward V vertex", () => {
    const vCornerRoom: RoomData = {
      width: 180,
      depth: 220,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "left", x: 50, y: 150 },
        { id: "vertex", x: 100, y: 200 },
        { id: "right", x: 150, y: 150 },
      ],
      customWalls: [
        { id: "left-leg", startVertexId: "left", endVertexId: "vertex", label: "Wall 1", lockedAngle: 45 },
        { id: "right-leg", startVertexId: "vertex", endVertexId: "right", label: "Wall 2", lockedAngle: 45 },
      ],
    };
    const erb: PlacedCabinet = {
      uid: "erb36-v-corner", cabinetId: 36, masterCode: "ERB36", description: "Easy Reach Corner Base 36",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
    };
    const direct = customWallTrueCornerPlacement(erb, vCornerRoom.customWalls![1]!, vCornerRoom.customWalls![0]!, "vertex", vCornerRoom);
    expect(direct).toMatchObject({ wallId: "left-leg", wallOffset: 70.71067811865476 - 36, rotation: 225 });
    expect(direct!.x).toBeCloseTo(100 - 18 * Math.SQRT2, 8);
    expect(direct!.y).toBeCloseTo(200 - 36 * Math.SQRT2, 8);

    const snapped = nextAvailableRoomCornerPlacement(erb, "right-leg" as any, vCornerRoom, [], { x: 100, y: 200 });
    expect(snapped).toMatchObject({ wallId: "left-leg", rotation: 225 });
    expect(snapped!.x).toBeCloseTo(direct!.x, 8);
    expect(snapped!.y).toBeCloseTo(direct!.y, 8);
  });

  it("blocks a B12 from entering the adjoining diagonal leg reserved by a seated ERB36", () => {
    const diagonalRightAngleRoom: RoomData = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "diagonal-a", x: 0, y: 0 },
        { id: "diagonal-corner", x: 100, y: 100 },
        { id: "diagonal-b", x: 50, y: 150 },
      ],
      customWalls: [
        { id: "diagonal-first", startVertexId: "diagonal-a", endVertexId: "diagonal-corner", label: "Wall 1", lockedAngle: 45, height: 96 },
        { id: "diagonal-second", startVertexId: "diagonal-corner", endVertexId: "diagonal-b", label: "Wall 2", lockedAngle: 45, height: 96 },
      ],
    };
    const erbSeed: PlacedCabinet = {
      uid: "diagonal-erb36-seated",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
    };
    const erbSpot = nextAvailableRoomCornerPlacement(erbSeed, "diagonal-second" as any, diagonalRightAngleRoom, []);
    expect(erbSpot).toMatchObject({ wallId: "diagonal-second", wallOffset: 0 });
    const erb: PlacedCabinet = { ...erbSeed, ...erbSpot!, wallId: erbSpot!.wallId, wallOffset: erbSpot!.wallOffset };
    const b12Spot = wallPlacementAt(wallLength("diagonal-first" as any, diagonalRightAngleRoom) - 12, 12, 24, "diagonal-first" as any, diagonalRightAngleRoom);
    const b12: PlacedCabinet = {
      uid: "diagonal-b12-over-erb",
      cabinetId: 12,
      masterCode: "B12",
      description: "12 inch Base Cabinet",
      placement: "base",
      ...b12Spot,
      width: 12,
      depth: 24,
      height: 34.5,
      wallId: b12Spot.wallId,
      wallOffset: b12Spot.wallOffset,
    };
    expect(cabinetPlacementCollisionDetail(b12, [erb], diagonalRightAngleRoom)?.cabinet.uid).toBe(erb.uid);
    expect(shouldBlockPlacementCollision(b12, [erb], false, diagonalRightAngleRoom)).toBe(true);

    // The physically seated ERB36 reserves the diagonal's actual corner body;
    // leave the exact measured clear span before expecting a B12 to fit.
    const clearB12Spot = wallPlacementAt(wallLength("diagonal-first" as any, diagonalRightAngleRoom) - 72, 12, 24, "diagonal-first" as any, diagonalRightAngleRoom);
    const clearB12 = { ...b12, ...clearB12Spot, wallOffset: clearB12Spot.wallOffset };
    expect(shouldBlockPlacementCollision(clearB12, [erb], false, diagonalRightAngleRoom)).toBe(false);
  });

  it("lets a DB24 or dishwasher butt a diagonal LSB36 outer edge without a screen-envelope collision", () => {
    const diagonalRightAngleRoom: RoomData = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "diagonal-a", x: 0, y: 0 },
        { id: "diagonal-corner", x: 100, y: 100 },
        { id: "diagonal-b", x: 50, y: 150 },
      ],
      customWalls: [
        { id: "diagonal-first", startVertexId: "diagonal-a", endVertexId: "diagonal-corner", label: "Wall 1", lockedAngle: 45, height: 96 },
        { id: "diagonal-second", startVertexId: "diagonal-corner", endVertexId: "diagonal-b", label: "Wall 2", lockedAngle: 45, height: 96 },
      ],
    };
    const lsbSeed: PlacedCabinet = {
      uid: "diagonal-lsb36-seated", cabinetId: 36, masterCode: "LSB36", description: "Lazy Susan Base 36",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
    };
    const lsbSpot = nextAvailableRoomCornerPlacement(lsbSeed, "diagonal-second" as any, diagonalRightAngleRoom, []);
    expect(lsbSpot).toMatchObject({ wallId: "diagonal-second", wallOffset: 0 });
    const lsb = { ...lsbSeed, ...lsbSpot!, wallId: lsbSpot!.wallId, wallOffset: lsbSpot!.wallOffset };
    const firstWallLength = wallLength("diagonal-first" as any, diagonalRightAngleRoom);
    const outerEdgeSpot = wallPlacementAt(firstWallLength - 36 - 24, 24, 24, "diagonal-first" as any, diagonalRightAngleRoom);
    const db24: PlacedCabinet = {
      uid: "diagonal-db24-at-lsb-edge", cabinetId: 24, masterCode: "3DB24", description: "Drawer Base 24",
      placement: "base", ...outerEdgeSpot, width: 24, depth: 24, height: 34.5,
      wallId: outerEdgeSpot.wallId, wallOffset: outerEdgeSpot.wallOffset,
    };
    expect(cabinetPlacementCollisionDetail(db24, [lsb], diagonalRightAngleRoom)).toBeNull();
    expect(cabinetPlacementCollisionDetail({ ...db24, uid: "diagonal-dw24-at-lsb-edge", masterCode: "DW24", description: "Dishwasher 24", placement: "appliance" }, [lsb], diagonalRightAngleRoom)).toBeNull();

    const overlapSpot = wallPlacementAt(firstWallLength - 12, 12, 24, "diagonal-first" as any, diagonalRightAngleRoom);
    const overlap: PlacedCabinet = { ...db24, ...overlapSpot, uid: "diagonal-db24-over-lsb", width: 12, masterCode: "B12", wallOffset: overlapSpot.wallOffset };
    expect(cabinetPlacementCollisionDetail(overlap, [lsb], diagonalRightAngleRoom)?.cabinet.uid).toBe(lsb.uid);
  });

  it("gives ERB36 collision guidance and aligns a selected upper to the same measured corner", () => {
    const room: RoomData = {
      ...builderRoom,
      openWallPath: true,
      customWalls: builderRoom.customWalls.map((wall) => ({ ...wall, height: 96 })),
    };
    const erbSeed: PlacedCabinet = {
      uid: "erb36-upper-anchor",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
    };
    const erbSpot = nextAvailableRoomCornerPlacement(erbSeed, "builder-top" as any, room, []);
    expect(erbSpot).toMatchObject({ wallId: "builder-top", wallOffset: 0 });
    const erb: PlacedCabinet = { ...erbSeed, ...erbSpot!, wallId: erbSpot!.wallId, wallOffset: erbSpot!.wallOffset };
    const upperSpot = selectedCornerBaseWallPlacement(erb, room, 24, 12, 30, [erb], []);
    expect(upperSpot).toMatchObject({ x: 0, y: 0, rotation: 0, wallId: "builder-top", wallOffset: 0 });

    const b12: PlacedCabinet = {
      uid: "b12-over-erb",
      cabinetId: 12,
      masterCode: "B12",
      description: "12 inch Base Cabinet",
      placement: "base",
      x: 6,
      y: 0,
      width: 12,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "builder-top",
      wallOffset: 6,
    };
    expect(collisionReason(b12, [erb], room)).toContain("Corner protected: ERB36 is snapped into this corner.");
  });

  it.each([
    ["ERB33", "Easy Reach Corner Base 33", "l-shape"],
    ["ERB36", "Easy Reach Corner Base 36", "l-shape"],
    ["BBC36", "Blind Corner Base 36", "blind-corner"],
    ["LSB36", "Lazy Susan Base 36", "lazy-susan"],
  ] as const)("keeps a 34½-inch %s base-corner reservation out of the upper band in standard and Continuous Wall rooms", (masterCode, description, cornerType) => {
    const rooms: Array<{ label: string; room: RoomData; top: any; right: any }> = [
      { label: "standard", room: { ...DEFAULT_ROOM, width: 120, depth: 96, ceilingHeight: 96 }, top: "top", right: "right" },
      { label: "continuous", room: { ...builderRoom, openWallPath: true, ceilingHeight: 96 }, top: "builder-top", right: "builder-right" },
    ];

    for (const { label, room, top, right } of rooms) {
      const cornerStart = wallLength(top, room) - 36;
      const baseSpot = wallPlacementAt(cornerStart, 36, 24, top, room);
      const corner: PlacedCabinet = {
        uid: `${masterCode}-${label}-corner`, cabinetId: 36, masterCode, description,
        placement: "base", ...baseSpot, width: 36, depth: 24, height: 34.5,
        rotation: baseSpot.rotation, wallId: baseSpot.wallId, wallOffset: baseSpot.wallOffset,
        cornerType,
      };
      const upperSpot = wallPlacementAt(0, 24, 12, right, room);
      const upper: PlacedCabinet = {
        uid: `${masterCode}-${label}-upper`, cabinetId: 24, masterCode: "W2424", description: "24 inch Wall Cabinet",
        placement: "wall", ...upperSpot, width: 24, depth: 12, height: 24,
        rotation: upperSpot.rotation, wallId: upperSpot.wallId, wallOffset: upperSpot.wallOffset, mountBottom: 60,
      };

      // The plan outlines overlap at the shared vertex, but the upper begins at
      // 60 in and the base ends at 34½ in. It must be allowed in both engines.
      expect(cabinetPlacementCollisionDetail(upper, [corner], room)).toBeNull();
      expect(shouldBlockPlacementCollision(upper, [corner], false, room)).toBe(false);

      // The upper layer remains open from the vertex, while the base layer still
      // reserves the adjoining leg of the installed base corner.
      const wallSegments = freeSegmentsOnWall(right, room, [corner], [], 1, 0, "wall", false, upper);
      const baseSegments = freeSegmentsOnWall(right, room, [corner], [], 1, 0, "base");
      expect(wallSegments.some((segment) => segment.start <= 0.01)).toBe(true);
      expect(baseSegments.some((segment) => segment.start <= 0.01)).toBe(false);
    }
  });

  it("confirms a seated BBC42 blind corner and protects its cabinet body and filler zone", () => {
    const room: RoomData = { ...builderRoom, openWallPath: true };
    const bbc42: PlacedCabinet = {
      uid: "bbc42-corner-anchor",
      cabinetId: 42,
      masterCode: "BBC42",
      description: "42 inch Blind Corner Base Cabinet",
      placement: "base",
      x: 0,
      y: 0,
      width: 42,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "builder-top",
      wallOffset: 0,
      pullMin: 3,
      pullMax: 6,
    };
    expect(blindCornerSnapInfo(bbc42, room)).toEqual({ angle: 90, placement: "flush", clearanceIn: 0 });

    const b12: PlacedCabinet = {
      uid: "b12-over-bbc42",
      cabinetId: 12,
      masterCode: "B12",
      description: "12 inch Base Cabinet",
      placement: "base",
      x: 30,
      y: 0,
      width: 12,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "builder-top",
      wallOffset: 30,
    };
    expect(cabinetPlacementCollisionDetail(b12, [bbc42], room)?.cabinet.uid).toBe(bbc42.uid);
    expect(collisionReason(b12, [bbc42], room)).toContain("Corner protected: BBC42 is snapped into this blind corner.");
  });

  it("magnetically snaps a nearby cabinet to a straight custom wall instead of the polygon bounding box", () => {
    const moving: PlacedCabinet = {
      uid: "builder-moving",
      cabinetId: 9,
      masterCode: "B-30",
      description: "Builder wall base",
      placement: "base",
      x: 40,
      y: 3,
      width: 30,
      depth: 24,
      height: 34.5,
      rotation: 0,
    };
    expect(magnetSnap(moving, builderRoom, [], [])).toMatchObject({ wallId: "builder-top", rotation: 0 });
  });

	  it("recommends another user-drawn wall instead of an invisible graph boundary", () => {
	    const recommendation = alternateWallPlacementRecommendation(
	      "builder-top" as any,
	      builderRoom,
	      [],
	      [],
	      30,
	      24,
	      "base",
	    );
	    expect(recommendation).not.toBeNull();
	    expect(builderRoom.customWalls?.some((wall) => wall.id === recommendation!.side)).toBe(true);
	    expect(["top", "right", "bottom", "left"]).not.toContain(recommendation!.side);
	  });

  it("recovers a far-dragged cabinet onto its owning drawn wall and clamps it before the wall end", () => {
    const farDragged: PlacedCabinet = {
      uid: "far-dragged-db18",
      cabinetId: 18,
      masterCode: "3-DB18",
      description: "Drawer base 18",
      placement: "base",
      x: 500,
      y: 400,
      width: 18,
      depth: 24,
      height: 34.5,
      rotation: 270,
      wallId: "builder-top" as any,
      wallOffset: 500,
    };
    const contained = containCabinetOnDrawnWalls(farDragged, builderRoom);
    expect(contained).toMatchObject({
      wallId: "builder-top",
      wallOffset: 102,
      x: 102,
      y: 0,
      rotation: 0,
    });
  });

  it("replaces stale graph-square ownership with the closest real user-drawn wall", () => {
    const staleGraphCabinet: PlacedCabinet = {
      uid: "stale-graph-db18",
      cabinetId: 18,
      masterCode: "3-DB18",
      description: "Drawer base 18",
      placement: "base",
      x: -48,
      y: 30,
      width: 18,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "top",
    };
    const contained = clampCabinetToRoom(staleGraphCabinet, builderRoom);
    expect(builderRoom.customWalls?.some((wall) => wall.id === contained.wallId)).toBe(true);
    expect(["top", "right", "bottom", "left"]).not.toContain(contained.wallId);
    expect(contained.wallOffset).toBeGreaterThanOrEqual(0);
    expect((contained.wallOffset ?? 0) + contained.width).toBeLessThanOrEqual(wallLength(contained.wallId as any, builderRoom));
  });
});

describe("parent-wall termination at a peninsula attachment", () => {
  it("previews the exact longer wall section before a Compass split commits", () => {
    expect(retainedWallSegmentForSplit("top", peninsulaRoom, 48)).toEqual({ start: 48, length: 96 });
    expect(retainedWallSegmentForSplit("top", peninsulaRoom, 120)).toEqual({ start: 0, length: 120 });
    expect(retainedWallSegmentForSplit("top", peninsulaRoom, 72)).toEqual({ start: 0, length: 72 });
  });

  it("keeps the full room span for attachment editing and retains the longer wall section after the Compass split", () => {
    expect(wallLength("top", peninsulaRoom)).toBe(144);
    expect(cabinetWallRunSegment("top", peninsulaRoom)).toEqual({ start: 48, length: 96 });
    expect(cabinetWallRunLength("top", peninsulaRoom)).toBe(96);
    expect(freeSegmentsOnWall("top", peninsulaRoom, [], [], 0.5, 0, "base")).toEqual([{ start: 48, length: 96 }]);
  });

  it("clamps new top-wall cabinets inside the retained longer segment instead of placing them in the removed short section", () => {
    const spot = wallPlacementAt(0, 30, 24, "top", peninsulaRoom);
    expect(spot).toMatchObject({ x: 48, y: 0, rotation: 0 });
  });

  it("retains the start-side section when it is longer than the end-side section", () => {
    const nearEnd: RoomData = {
      ...peninsulaRoom,
      peninsulaRuns: peninsulaRoom.peninsulaRuns?.map((run) => ({ ...run, startOffset: 120 })),
    };
    expect(cabinetWallRunSegment("top", nearEnd)).toEqual({ start: 0, length: 120 });
    expect(freeSegmentsOnWall("top", nearEnd, [], [], 0.5, 0, "base")).toEqual([{ start: 0, length: 120 }]);
  });

  it("retains the full parent wall when a primary run explicitly keeps it", () => {
    const retained: RoomData = {
      ...peninsulaRoom,
      peninsulaRuns: peninsulaRoom.peninsulaRuns?.map((run) => ({ ...run, terminatesParentWall: false })),
    };
    expect(cabinetWallRunSegment("top", retained)).toEqual({ start: 0, length: 144 });
    expect(cabinetWallRunLength("top", retained)).toBe(144);
  });
});

describe("cabinet-supported peninsula runs", () => {
  it("anchors a 90-degree continuation at the measured parent-wall split point", () => {
    const run = peninsulaRoom.peninsulaRuns![0];
    expect(peninsulaRunEndpoints(run, peninsulaRoom)).toMatchObject({
      start: { x: 48, y: 0 },
      end: { x: 48, y: 96 },
    });
    expect(wallLength(run.id as any, peninsulaRoom)).toBe(96);
    expect(wallPlacementAt(0, 30, 24, run.id as any, peninsulaRoom)).toMatchObject({
      rotation: 90,
      wallId: run.id,
      wallOffset: 0,
    });
  });

  it("moves a joined peninsula endpoint only along its adjoining parent wall", () => {
    const run = peninsulaRoom.peninsulaRuns![0];
    expect(peninsulaRunStartOffsetAtPoint(run, peninsulaRoom, { x: 84.125, y: 36 })).toBe(84.125);
    expect(peninsulaRunStartOffsetAtPoint(run, peninsulaRoom, { x: -20, y: 36 })).toBe(0);
    expect(peninsulaRunStartOffsetAtPoint(run, peninsulaRoom, { x: 200, y: 36 })).toBe(138);
  });

  it("seats a cabinet back against either selected face of a two-sided peninsula", () => {
    const run = peninsulaRoom.peninsulaRuns![0];
    const left = wallPlacementAt(0, 30, 24, run.id as any, peninsulaRoom, "left");
    const right = wallPlacementAt(0, 30, 24, run.id as any, peninsulaRoom, "right");
    expect(left).toMatchObject({ x: 24, y: 0, rotation: 90, wallId: run.id, peninsulaSide: "left" });
    expect(right).toMatchObject({ x: 48, y: 0, rotation: 270, wallId: run.id, peninsulaSide: "right" });

    const rightDefaultRoom: RoomData = {
      ...peninsulaRoom,
      peninsulaRuns: [{ ...run, cabinetSide: "right" }],
    };
    expect(wallPlacementAt(0, 30, 24, run.id as any, rightDefaultRoom)).toMatchObject({ rotation: 270, peninsulaSide: "right" });
  });

  it("keeps exact 45-degree left and right continuations inside the room and bounds their pull", () => {
    const parent = { ...peninsulaRoom.peninsulaRuns![0], startOffset: 72, length: 36 };
    const right45 = { id: "right-45-end", parentRunId: parent.id, startOffset: 0, turn: 45 as const, direction: "right" as const, length: 36, height: 34.5 };
    const left45 = { ...right45, id: "left-45-end", direction: "left" as const };
    const rightRoom: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, right45] };
    const leftRoom: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, left45] };
    expect(peninsulaRunEndpoints(right45, rightRoom).end).toEqual({ x: 46.5, y: 61.5 });
    expect(peninsulaRunEndpoints(left45, leftRoom).end).toEqual({ x: 97.5, y: 61.5 });
    expect(peninsulaRunMaxLength(right45, rightRoom)).toBeLessThanOrEqual(102);
    expect(peninsulaRunMaxLength(left45, leftRoom)).toBeLessThanOrEqual(102);
  });

  it("anchors a connected return at its parent peninsula endpoint with a locked turn", () => {
    const parent = peninsulaRoom.peninsulaRuns![0];
    const returnRun = {
      id: "peninsula-return",
      parentRunId: parent.id,
      startOffset: 0,
      turn: 90 as const,
      direction: "right" as const,
      length: 42,
      height: 34.5,
      label: "Peninsula return",
    };
    const connectedRoom: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, returnRun] };
    expect(peninsulaRunEndpoints(returnRun, connectedRoom)).toMatchObject({
      start: { x: 48, y: 96 },
      end: { x: 6, y: 96 },
    });
    expect(wallPlacementAt(0, 30, 24, returnRun.id as any, connectedRoom)).toMatchObject({
      wallId: returnRun.id,
      wallOffset: 0,
      rotation: 180,
    });
    expect(wallPlacementAt(0, 30, 24, returnRun.id as any, connectedRoom, "right")).toMatchObject({
      wallId: returnRun.id,
      peninsulaSide: "right",
      rotation: 0,
    });
    expect(peninsulaRunHitAtPoint(connectedRoom, { x: 20, y: 96 }, 8)).toMatchObject({ run: { id: returnRun.id } });
  });

  it("ends a straight peninsula countertop at an unsupported 45-degree return", () => {
    const primary = {
      id: "wizard-straight-primary",
      parentWall: "top" as const,
      startOffset: 48,
      turn: 90 as const,
      direction: "right" as const,
      length: 72,
      height: 34.5,
      cabinetSide: "left" as const,
      countertopSeatingOverhang: 12 as const,
      label: "Peninsula · straight",
    };
    const angledEnd = {
      id: "wizard-angled-end",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 45 as const,
      direction: "right" as const,
      length: 36,
      height: 34.5,
      cabinetSide: "left" as const,
      countertopSeatingOverhang: 12 as const,
      label: "Peninsula end · 45° right",
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, angledEnd] };
    expect(peninsulaRunEndpoints(primary, room)).toMatchObject({
      start: { x: 48, y: 0 },
      end: { x: 48, y: 72 },
    });
    expect(peninsulaRunEndpoints(angledEnd, room)).toMatchObject({
      start: { x: 48, y: 72 },
      end: { x: 22.5, y: 97.5 },
    });
    const primarySpot = wallPlacementAt(0, 30, 24, primary.id as any, room, "left");
    const endSpot = wallPlacementAt(0, 24, 24, angledEnd.id as any, room, "left");
    const primaryCabinet = { ...peninsulaCabinet("wizard-primary-cabinet", 0), ...primarySpot, wallId: primary.id, wallOffset: 0 };
    const endCabinet = { ...peninsulaCabinet("wizard-end-cabinet", 0), ...endSpot, wallId: angledEnd.id, wallOffset: 0, width: 24 };
    const surfaces = countertopSurfaces([primaryCabinet, endCabinet], room);
    expect(surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ peninsulaRunId: primary.id, linearInches: 30 }),
      expect.objectContaining({ peninsulaRunId: angledEnd.id, linearInches: 24 }),
    ]));
    expect(surfaces).toHaveLength(2);
  });

  it("treats a legacy direct-45 primary peninsula as a straight first leg instead of a diamond cabinet path", () => {
    const legacyPrimary: PeninsulaRun = {
      id: "legacy-direct-45",
      parentWall: "left",
      startOffset: 48,
      turn: 45,
      direction: "right",
      length: 48,
      height: 34.5,
      label: "Peninsula · 45° right",
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [legacyPrimary] };
    expect(peninsulaRunEndpoints(legacyPrimary, room)).toMatchObject({
      start: { x: 0, y: 48 },
      end: { x: 48, y: 48 },
    });
    expect(wallPlacementAt(0, 18, 24, legacyPrimary.id as any, room, "left")).toMatchObject({
      wallId: legacyPrimary.id,
      wallOffset: 0,
      rotation: 0,
    });
    const savedDiamond = {
      ...peninsulaCabinet("legacy-diamond-b18", 0),
      wallId: legacyPrimary.id,
      wallOffset: 0,
      rotation: 45,
      x: 18,
      y: 48,
    };
    const normalized = normalizeLegacyPeninsulaCabinets([savedDiamond], room);
    expect(normalized[0]).toMatchObject({
      wallId: legacyPrimary.id,
      wallOffset: 0,
      rotation: 0,
    });
  });

  it("uses the selected primary-run side rather than a stale cabinet-side value when reseating a legacy cabinet", () => {
    const legacyPrimary: PeninsulaRun = {
      id: "legacy-side-authority",
      parentWall: "left",
      startOffset: 48,
      turn: 45,
      direction: "right",
      length: 48,
      height: 34.5,
      cabinetSide: "left",
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [legacyPrimary] };
    const staleRightSide = {
      ...peninsulaCabinet("legacy-right-side-b18", 0),
      wallId: legacyPrimary.id,
      wallOffset: 0,
      peninsulaSide: "right" as const,
      rotation: 45,
    };
    const normalized = normalizeLegacyPeninsulaCabinets([staleRightSide], room);
    expect(normalized[0].peninsulaSide).toBe("left");
    expect(normalized[0]).toMatchObject(wallPlacementAt(0, 18, 24, legacyPrimary.id as any, room, "left"));
  });

  it("reseats a refreshed B-18 with stale connected-run coordinates onto the exact highlighted segment", () => {
    const primary: PeninsulaRun = {
      id: "selected-straight-wall",
      parentWall: "left",
      startOffset: 48,
      turn: 90,
      direction: "right",
      length: 54,
      height: 34.5,
      cabinetSide: "left",
    };
    const nextWall: PeninsulaRun = {
      id: "selected-next-wall",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 45,
      direction: "right",
      length: 60,
      height: 34.5,
      cabinetSide: "right",
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, nextWall] };
    const staleB18 = {
      ...peninsulaCabinet("refreshed-b18", 12),
      wallId: nextWall.id,
      wallOffset: 12,
      peninsulaSide: "left" as const,
      rotation: 90,
      x: 36,
      y: 60,
    };
    const normalized = normalizeLegacyPeninsulaCabinets([staleB18], room);
    expect(normalized[0]).toMatchObject({
      ...wallPlacementAt(12, 30, 24, nextWall.id as any, room, "right"),
      wallId: nextWall.id,
      wallOffset: 12,
      peninsulaSide: "right",
    });
  });

  it("keeps a right-side B-18 wholly centered beside a 45-degree wall after its 180-degree face flip", () => {
    const primary: PeninsulaRun = {
      id: "straight-before-angle",
      parentWall: "left",
      startOffset: 48,
      turn: 90,
      direction: "right",
      length: 48,
      height: 34.5,
      cabinetSide: "left",
    };
    const angleWall: PeninsulaRun = {
      id: "right-side-45-wall",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 45,
      direction: "right",
      length: 60,
      height: 34.5,
      cabinetSide: "right",
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, angleWall] };
    const spot = wallPlacementAt(12, 18, 24, angleWall.id as any, room, "right");
    const cabinet: PlacedCabinet = {
      ...peninsulaCabinet("right-side-b18", 12),
      ...spot,
      width: 18,
      nominalWidth: 18,
      depth: 24,
      nominalDepth: 24,
      wallId: angleWall.id,
      wallOffset: 12,
      peninsulaSide: "right",
    };
    const footprint = placedFootprint(cabinet);
    const { start, radians } = peninsulaRunEndpoints(angleWall, room);
    const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
    const rightNormal = { x: Math.sin(radians), y: -Math.cos(radians) };
    const expectedCenter = {
      x: start.x + tangent.x * 21 + rightNormal.x * 12,
      y: start.y + tangent.y * 21 + rightNormal.y * 12,
    };
    expect(spot.rotation).toBe(225);
    expect(footprint.w).toBeCloseTo(42 * Math.SQRT1_2, 6);
    expect(footprint.d).toBeCloseTo(42 * Math.SQRT1_2, 6);
    expect(spot.x + footprint.w / 2).toBeCloseTo(expectedCenter.x, 6);
    expect(spot.y + footprint.d / 2).toBeCloseTo(expectedCenter.y, 6);
  });

  it("keeps the nominal cabinet back edge exactly flush to straight and 45-degree peninsula wall lines on either selected side", () => {
    const primary = { ...peninsulaRoom.peninsulaRuns![0], id: "flush-primary", length: 72 };
    const child: PeninsulaRun = {
      id: "flush-angle",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 45,
      direction: "right",
      length: 60,
      height: 34.5,
      cabinetSide: "right",
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, child] };
    for (const run of [primary, child]) {
      for (const side of ["left", "right"] as const) {
        const spot = wallPlacementAt(12, 18, 24, run.id as any, room, side);
        const footprint = placedFootprint({
          uid: `${run.id}-${side}`,
          cabinetId: 18,
          masterCode: "B-18",
          description: "Back-edge probe",
          placement: "base",
          ...spot,
          width: 18,
          depth: 24,
          height: 34.5,
        } as PlacedCabinet);
        const geometry = peninsulaRunEndpoints(run, room);
        const tangent = { x: Math.cos(geometry.radians), y: Math.sin(geometry.radians) };
        const leftNormal = { x: -Math.sin(geometry.radians), y: Math.cos(geometry.radians) };
        const faceNormal = side === "left" ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };
        const center = { x: spot.x + footprint.w / 2, y: spot.y + footprint.d / 2 };
        const backEdgeCenter = { x: center.x - faceNormal.x * 12, y: center.y - faceNormal.y * 12 };
        const wallPoint = { x: geometry.start.x + tangent.x * 21, y: geometry.start.y + tangent.y * 21 };
        expect(backEdgeCenter.x).toBeCloseTo(wallPoint.x, 6);
        expect(backEdgeCenter.y).toBeCloseTo(wallPoint.y, 6);
      }
    }
  });

  it("keeps an exact-width Wizard filler inside its measured peninsula void instead of searching another run location", () => {
    const run = peninsulaRoom.peninsulaRuns![0];
    const spot = firstCollisionFreePeninsulaPlacement(
      run.id as any,
      peninsulaRoom,
      [],
      30,
      24,
      "base",
      { start: 12, end: 12 },
    );
    expect(spot).toMatchObject({ wallId: run.id, wallOffset: 12 });
  });

  it("keeps 11 inches only on the 45-degree leg while the primary 90-degree run remains flush", () => {
    const primary = peninsulaRoom.peninsulaRuns![0];
    const child: PeninsulaRun = {
      id: "peninsula-next-wall",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 45,
      direction: "right",
      length: 48,
      height: 34.5,
      cabinetSide: "left",
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, child] };
    expect(firstCollisionFreePeninsulaPlacement(primary.id as any, room, [], 18, 24, "base")).toMatchObject({
      wallId: primary.id,
      wallOffset: 0,
    });
    expect(firstCollisionFreePeninsulaPlacement(child.id as any, room, [], 18, 24, "base")).toMatchObject({
      wallId: child.id,
      wallOffset: 11,
    });
    expect(freeSegmentsOnWall(primary.id as any, room, [], [], 1, 0, "base")).toEqual([
      { start: 0, length: primary.length - 11 },
    ]);
    expect(freeSegmentsOnWall(child.id as any, room, [], [], 1, 0, "base")).toEqual([
      { start: 11, length: child.length - 11 },
    ]);
    expect(PENINSULA_INSIDE_CORNER_CLEARANCE_IN).toBe(11);
  });

  it("auto-snaps a nearby cabinet flush to its straight peninsula wall with exact run ownership", () => {
    const run = peninsulaRoom.peninsulaRuns![0];
    const exact = wallPlacementAt(24, 12, 24, run.id as any, peninsulaRoom);
    const nearby: PlacedCabinet = {
      ...peninsulaCabinet("near-straight-wall", 24),
      masterCode: "B-12",
      width: 12,
      x: exact.x - 4,
      y: exact.y,
      wallId: undefined,
      wallOffset: undefined,
    };
    expect(magnetSnap(nearby, peninsulaRoom, [], [])).toMatchObject({
      x: exact.x,
      y: exact.y,
      rotation: exact.rotation,
      wallId: run.id,
      wallOffset: 24,
    });
    expect(magnetSnap({ ...nearby, x: exact.x - 7 }, peninsulaRoom, [], [])?.wallId).not.toBe(run.id);
  });

  it("auto-snaps a nearby cabinet flush to a selected-side 45-degree peninsula wall", () => {
    const primary = { ...peninsulaRoom.peninsulaRuns![0], id: "auto-snap-primary", length: 72 };
    const child: PeninsulaRun = {
      id: "auto-snap-45",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 45,
      direction: "right",
      length: 72,
      height: 34.5,
      cabinetSide: "right",
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, child] };
    const exact = wallPlacementAt(24, 12, 24, child.id as any, room, "right");
    const shift = 4 * Math.SQRT1_2;
    const nearby: PlacedCabinet = {
      ...peninsulaCabinet("near-45-wall", 24),
      masterCode: "B-12",
      width: 12,
      x: exact.x + shift,
      y: exact.y + shift,
      rotation: exact.rotation,
      wallId: undefined,
      wallOffset: undefined,
      peninsulaSide: undefined,
    };
    expect(magnetSnap(nearby, room, [], [])).toMatchObject({
      x: exact.x,
      y: exact.y,
      rotation: 315,
      wallId: child.id,
      wallOffset: 24,
      peninsulaSide: "right",
    });
  });

  it("does not auto-snap through a door opening or an occupied wall span", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
    const nearby: PlacedCabinet = {
      uid: "near-top-wall",
      cabinetId: 12,
      masterCode: "B-12",
      description: "12 inch base cabinet",
      placement: "base",
      x: 30,
      y: 4,
      width: 12,
      depth: 24,
      height: 34.5,
      rotation: 0,
    };
    const door = { uid: "door", kind: "door", label: "Door", side: "top", offset: 24, width: 36, height: 80, sill: 0 } as const;
    // The shared magnet never seats a cabinet inside a door opening or on an
    // occupied span; it lands on the nearest clear 1/8-inch position instead.
    const throughDoor = magnetSnap(nearby, room, [], [door]);
    expect(throughDoor).not.toBeNull();
    expect(throughDoor!.x + 12 <= door.offset || throughDoor!.x >= door.offset + door.width).toBe(true);
    const occupied = { ...nearby, uid: "occupied", x: 30, y: 0 };
    const besideOccupied = magnetSnap(nearby, room, [occupied], []);
    expect(besideOccupied).not.toBeNull();
    expect(hasCollision(besideOccupied!, [occupied])).toBe(false);
  });

  it("fits a 24-inch cabinet on a 36-inch one-corner segment with one inch remaining, but not between two reserved corners", () => {
    const parent = { ...peninsulaRoom.peninsulaRuns![0], id: "peninsula-parent", length: 48 };
    const oneCorner: PeninsulaRun = {
      id: "peninsula-36-free-end",
      parentRunId: parent.id,
      startOffset: 0,
      turn: 45,
      direction: "right",
      length: 36,
      height: 34.5,
      cabinetSide: "right",
    };
    const oneCornerRoom: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, oneCorner] };
    expect(freeSegmentsOnWall(oneCorner.id as any, oneCornerRoom, [], [], 1, 0, "base")).toEqual([
      { start: 11, length: 25 },
    ]);
    expect(firstCollisionFreePeninsulaPlacement(oneCorner.id as any, oneCornerRoom, [], 24, 24, "base")).toMatchObject({
      wallId: oneCorner.id,
      wallOffset: 11,
    });

    const turnAfter36: PeninsulaRun = {
      id: "peninsula-after-36",
      parentRunId: oneCorner.id,
      startOffset: 0,
      turn: 45,
      direction: "left",
      length: 48,
      height: 34.5,
      cabinetSide: "right",
    };
    const twoCornerRoom: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, oneCorner, turnAfter36] };
    expect(freeSegmentsOnWall(oneCorner.id as any, twoCornerRoom, [], [], 1, 0, "base")).toEqual([
      { start: 11, length: 14 },
    ]);
    expect(firstCollisionFreePeninsulaPlacement(oneCorner.id as any, twoCornerRoom, [], 24, 24, "base")).toBeNull();
    expect(firstCollisionFreePeninsulaPlacement(oneCorner.id as any, twoCornerRoom, [], 12, 24, "base")).toMatchObject({
      wallId: oneCorner.id,
      wallOffset: 11,
    });
  });

  it("does not move a selected peninsula cabinet onto another connected segment when its selected run lacks 11-inch clearance", () => {
    const primary = { ...peninsulaRoom.peninsulaRuns![0], length: 24 };
    const child: PeninsulaRun = {
      id: "long-adjoining-run",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 45,
      direction: "right",
      length: 72,
      height: 34.5,
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, child] };
    expect(firstCollisionFreePeninsulaPlacement(primary.id as any, room, [], 18, 24, "base")).toBeNull();
    expect(firstCollisionFreePeninsulaPlacement(child.id as any, room, [], 18, 24, "base")).toMatchObject({
      wallId: child.id,
      wallOffset: 11,
    });
  });

  it("projects a catalog drop onto the active peninsula run rather than an outside room wall", () => {
    const run = peninsulaRoom.peninsulaRuns![0];
    expect(peninsulaRunOffsetAtPoint(run, peninsulaRoom, { x: 48, y: 63 })).toBe(63);
    expect(peninsulaRunOffsetAtPoint(run, peninsulaRoom, { x: 48, y: 220 })).toBe(96);
  });

  it("recovers unambiguous legacy peninsula ownership before measuring the next edge-to-edge opening", () => {
    const legacy = { ...peninsulaCabinet("legacy-ber33", 30), wallId: undefined, wallOffset: undefined };
    const normalized = normalizeLegacyPeninsulaCabinets([legacy], peninsulaRoom);
    expect(normalized[0]).toMatchObject({ wallId: "peninsula-90-right", wallOffset: 30, peninsulaSide: "left", rotation: 90 });
    const next = wallPlacementAt(0, 30, 24, "peninsula-90-right" as any, peninsulaRoom);
    const candidate = { ...peninsulaCabinet("new-b12", 0), ...next, wallId: next.wallId, wallOffset: next.wallOffset };
    expect(cabinetCollisionDetail(candidate, normalized)).toBeNull();
    expect(freeSegmentsOnWall("peninsula-90-right" as any, peninsulaRoom, normalized, [], 0.5, 0, "base")).toContainEqual({ start: 0, length: 30 });
  });

  it("keeps the 11-inch installer clearance only for a connected 45-degree inside corner", () => {
    const primary = { ...peninsulaRoom.peninsulaRuns![0], id: "primary-90", length: 72 };
    const rightAngleChild: PeninsulaRun = {
      id: "right-angle-child",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 90,
      direction: "right",
      length: 48,
      height: 34.5,
    };
    const rightAngleRoom: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, rightAngleChild] };
    expect(firstCollisionFreePeninsulaPlacement(rightAngleChild.id as any, rightAngleRoom, [], 24, 24, "base")).toMatchObject({
      wallId: rightAngleChild.id,
      wallOffset: 0,
    });

    const diagonalChild = { ...rightAngleChild, id: "diagonal-child", turn: 45 as const };
    const diagonalRoom: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, diagonalChild] };
    expect(firstCollisionFreePeninsulaPlacement(diagonalChild.id as any, diagonalRoom, [], 24, 24, "base")).toMatchObject({
      wallId: diagonalChild.id,
      wallOffset: PENINSULA_INSIDE_CORNER_CLEARANCE_IN,
    });
  });

  it("butts standard 24-inch cabinet faces at a 90-degree return using physical depth instead of the 11-inch rule", () => {
    const primary = { ...peninsulaRoom.peninsulaRuns![0], id: "face-butt-primary", length: 96 };
    const rightAngleChild: PeninsulaRun = {
      id: "face-butt-child",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 90,
      direction: "right",
      length: 48,
      height: 34.5,
      cabinetSide: "left",
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, rightAngleChild] };
    const parentSpot = wallPlacementAt(primary.length - 24, 24, 24, primary.id as any, room, "left");
    const parentBase: PlacedCabinet = {
      uid: "face-butt-parent-base",
      cabinetId: 24,
      masterCode: "B24",
      description: "24 inch Base Cabinet",
      placement: "base",
      ...parentSpot,
      width: 24,
      depth: 24,
      height: 34.5,
      wallId: primary.id,
      wallOffset: primary.length - 24,
      peninsulaSide: "left",
    };
    const childSpot = firstCollisionFreePeninsulaPlacement(rightAngleChild.id as any, room, [parentBase], 24, 24, "base");

    expect(childSpot).toMatchObject({ wallId: rightAngleChild.id, wallOffset: 24 });
    expect(childSpot!.wallOffset).not.toBe(PENINSULA_INSIDE_CORNER_CLEARANCE_IN);
    const childBase: PlacedCabinet = { ...parentBase, uid: "face-butt-child-base", ...childSpot!, wallId: rightAngleChild.id, wallOffset: childSpot!.wallOffset };
    expect(cabinetPlacementCollisionDetail(childBase, [parentBase], room)).toBeNull();
  });

  it("uses the SB36's true physical edge at a 90-degree ERB peninsula join rather than a 45-degree clearance rule", () => {
    const room: RoomData = {
      ...peninsulaRoom,
      peninsulaRuns: [{ ...peninsulaRoom.peninsulaRuns![0], id: "sb36-90-join", length: 96 }],
    };
    const erb: PlacedCabinet = {
      uid: "erb-at-90-join", cabinetId: 36, masterCode: "ERB36", description: "Easy Reach Corner Base 36",
      placement: "base", x: 12, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0, wallId: "top",
    };
    const spot = firstCollisionFreePeninsulaPlacement("sb36-90-join" as any, room, [erb], 36, 24, "base");
    expect(spot).toMatchObject({ wallId: "sb36-90-join", wallOffset: 36 });
    // The seat is determined by the ERB's actual L legs, not the 11-inch 45° rule.
    expect(spot!.wallOffset).not.toBe(PENINSULA_INSIDE_CORNER_CLEARANCE_IN);
    const sb36: PlacedCabinet = { ...erb, uid: "sb36-at-90-join", masterCode: "SB36", description: "Sink Base 36", ...spot! };
    expect(cabinetPlacementCollisionDetail(sb36, [erb], room)).toBeNull();
  });

  it("snaps an ERB36 flush to the selected peninsula's true 90-degree bend", () => {
    const run = peninsulaRoom.peninsulaRuns![0];
    const erb: PlacedCabinet = {
      uid: "erb-peninsula-corner", cabinetId: 36, masterCode: "ERB36", description: "Easy Reach Corner Base 36",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
    };
    const spot = nextAvailablePeninsulaCornerPlacement(erb, run.id as any, peninsulaRoom, [], { x: 48, y: 0 });
    expect(spot).toMatchObject({ wallId: run.id, wallOffset: 0, rotation: 90 });
    const seated = { ...erb, ...spot };
    expect(placedFootprint(seated)).toEqual({ w: 36, d: 36 });
    expect(cabinetPlacementCollisionDetail(seated, [], peninsulaRoom)).toBeNull();
  });

  it("does not mistake an acute 45-degree peninsula return for a square ERB corner", () => {
    const primary = { ...peninsulaRoom.peninsulaRuns![0], id: "primary-for-45-corner", length: 72 };
    const return45: PeninsulaRun = {
      id: "return-45-corner", parentRunId: primary.id, startOffset: 0, turn: 45, direction: "right", length: 48, height: 34.5,
    };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [primary, return45] };
    const erb: PlacedCabinet = {
      uid: "erb-45-corner", cabinetId: 36, masterCode: "ERB36", description: "Easy Reach Corner Base 36",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
    };
    expect(nextAvailablePeninsulaCornerPlacement(erb, return45.id as any, room, [], peninsulaRunEndpoints(return45, room).start)).toBeNull();
  });

  it("recovers a legacy peninsula cabinet that still carries its original parent-wall owner", () => {
    const staleParentWallOwner = { ...peninsulaCabinet("legacy-parent-wall-ber33", 30), wallId: "top", wallOffset: undefined };
    const normalized = normalizeLegacyPeninsulaCabinets([staleParentWallOwner], peninsulaRoom);
    expect(normalized[0]).toMatchObject({ wallId: "peninsula-90-right", wallOffset: 30, peninsulaSide: "left", rotation: 90 });
    const opening = freeSegmentsOnWall("peninsula-90-right" as any, peninsulaRoom, normalized, [], 0.5, 0, "base");
    expect(opening).toContainEqual({ start: 0, length: 30 });
  });

  it("repairs a parent-wall peninsula cabinet whose saved rotation is still the old perimeter-wall rotation", () => {
    const staleRotation = { ...peninsulaCabinet("legacy-stale-rotation-ber33", 30), wallId: "top", wallOffset: undefined, rotation: 0 };
    const normalized = normalizeLegacyPeninsulaCabinets([staleRotation], peninsulaRoom);
    expect(normalized[0]).toMatchObject({ wallId: "peninsula-90-right", wallOffset: 30, peninsulaSide: "left", rotation: 90 });
    const next = wallPlacementAt(0, 30, 24, "peninsula-90-right" as any, peninsulaRoom);
    const candidate = { ...peninsulaCabinet("new-b12-after-stale-ber33", 0), ...next, wallId: next.wallId, wallOffset: next.wallOffset };
    expect(cabinetCollisionDetail(candidate, normalized)).toBeNull();
    expect(paletteActiveWallPlacement("peninsula-90-right" as any, peninsulaRoom, normalized, [], 30, 24, "base")).toMatchObject({
      wallId: "peninsula-90-right",
      wallOffset: 0,
      rotation: 90,
    });
  });

  it("allows 3-DB15 to begin on a 45-degree peninsula beside BER33 when only the L-corner screen box overlaps", () => {
    const fortyFiveRoom: RoomData = {
      ...peninsulaRoom,
      peninsulaRuns: [{
        id: "peninsula-45-join",
        parentWall: "top",
        startOffset: 36,
        turn: 45,
        direction: "left",
        length: 72,
        height: 34.5,
      }],
    };
    const ber33: PlacedCabinet = {
      uid: "ber33-parent-wall",
      cabinetId: 8,
      masterCode: "BER33",
      description: "Easy Reach Corner Base",
      placement: "base",
      x: 0,
      y: 0,
      width: 33,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "top",
    };
    const drawerBase: PlacedCabinet = {
      uid: "3-db15-peninsula",
      cabinetId: 9,
      masterCode: "3-DB15",
      description: "15 inch 3 Drawer Base",
      placement: "base",
      // The 45° body touches the BER legs at a point, while its axis-aligned
      // screen envelope overlaps the BER's 36-inch bounding square by 12 inches.
      x: 24,
      y: 24,
      width: 15,
      depth: 24,
      height: 34.5,
      rotation: 45,
      wallId: "peninsula-45-join",
      wallOffset: 0,
      peninsulaSide: "left",
    };
    expect(cabinetCollisionDetail(drawerBase, [ber33])).toMatchObject({ cabinet: ber33 });
    expect(cabinetPlacementCollisionDetail(drawerBase, [ber33], fortyFiveRoom)).toBeNull();
    const trulyOverlappingDrawer = { ...drawerBase, x: 20, y: 20 };
    expect(cabinetPlacementCollisionDetail(trulyOverlappingDrawer, [ber33], fortyFiveRoom)).toMatchObject({ cabinet: ber33 });
  });

  it("automatically starts the first 45-degree peninsula cabinet after a parent-wall corner's true body clearance", () => {
    const fortyFiveRoom: RoomData = {
      ...peninsulaRoom,
      peninsulaRuns: [{
        id: "peninsula-45-clearance",
        parentWall: "top",
        startOffset: 36,
        turn: 45,
        direction: "left",
        length: 72,
        height: 34.5,
      }],
    };
    const ber33: PlacedCabinet = {
      uid: "ber33-parent-wall-clearance",
      cabinetId: 8,
      masterCode: "BER33",
      description: "Easy Reach Corner Base",
      placement: "base",
      x: 0,
      y: 0,
      width: 33,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "top",
    };
    const normalized = normalizeLegacyPeninsulaCabinets([ber33], fortyFiveRoom);
    expect(normalized[0]).toMatchObject({ wallId: "top", rotation: 0 });
    const start = peninsulaAutomaticStartOffset("peninsula-45-clearance" as any, fortyFiveRoom, normalized, 15, 24, "base");
    const spot = paletteActiveWallPlacement("peninsula-45-clearance" as any, fortyFiveRoom, normalized, [], 15, 24, "base");
    expect(start).toBeGreaterThan(0);
    expect(spot).toMatchObject({ wallId: "peninsula-45-clearance", wallOffset: start });
    const candidate = {
      ...ber33,
      uid: "3-db15-after-ber33-clearance",
      cabinetId: 9,
      masterCode: "3-DB15",
      description: "15 inch 3 Drawer Base",
      width: 15,
      ...spot,
    };
    expect(cabinetPlacementCollisionDetail(candidate, normalized, fortyFiveRoom)).toBeNull();
  });

  it("uses the first physically clear peninsula location when a parent-wall B-24 blocks the join", () => {
    const fortyFiveRoom: RoomData = {
      ...peninsulaRoom,
      peninsulaRuns: [{
        id: "peninsula-45-b24-clearance",
        parentWall: "top",
        startOffset: 72,
        turn: 45,
        direction: "right",
        length: 72,
        height: 34.5,
      }],
    };
    const joinSpot = wallPlacementAt(0, 24, 24, "peninsula-45-b24-clearance" as any, fortyFiveRoom);
    const b24: PlacedCabinet = {
      uid: "b24-parent-wall-join",
      cabinetId: 10,
      masterCode: "B-24",
      description: "24 inch Base Cabinet",
      placement: "base",
      x: joinSpot.x,
      y: joinSpot.y,
      width: 24,
      depth: 24,
      height: 34.5,
      rotation: joinSpot.rotation,
      wallId: "top",
    };
    const firstClear = firstCollisionFreePeninsulaPlacement("peninsula-45-b24-clearance" as any, fortyFiveRoom, [b24], 15, 24, "base");
    const oneClick = paletteActiveWallPlacement("peninsula-45-b24-clearance" as any, fortyFiveRoom, [b24], [], 15, 24, "base");
    expect(firstClear).toMatchObject({ wallId: "peninsula-45-b24-clearance" });
    expect(firstClear!.wallOffset).toBeGreaterThan(0);
    expect(oneClick).toEqual(firstClear);
    const candidate: PlacedCabinet = {
      ...b24,
      uid: "3-db15-after-b24",
      cabinetId: 11,
      masterCode: "3-DB15",
      description: "15 inch 3 Drawer Base",
      width: 15,
      ...firstClear!,
    };
    expect(cabinetPlacementCollisionDetail(candidate, [b24], fortyFiveRoom)).toBeNull();
  });

  it("uses the visible peninsula line as the direct drop target and never reseats an owned upper on an outer wall", () => {
    const hit = peninsulaRunHitAtPoint(peninsulaRoom, { x: 49, y: 60 }, 12);
    expect(hit).toMatchObject({ run: { id: "peninsula-90-right" }, offset: 60 });
    const spot = wallPlacementAt(hit!.offset, 30, 12, hit!.run.id as any, peninsulaRoom);
    const upper: PlacedCabinet = {
      uid: "peninsula-upper",
      cabinetId: 3,
      masterCode: "W-30-30",
      description: "Peninsula upper",
      placement: "wall",
      x: spot.x,
      y: spot.y,
      width: 30,
      depth: 12,
      height: 30,
      rotation: spot.rotation,
      wallId: spot.wallId,
      wallOffset: spot.wallOffset,
    };
    expect(snapWallCabinetToOwningWall(upper, peninsulaRoom)).toEqual(upper);
  });

  it("keeps a peninsula run empty until cabinets are placed, then reopens an exact removed void", () => {
    const first = peninsulaCabinet("pen-one", 0);
    const second = peninsulaCabinet("pen-two", 30);
    expect(cabinetCollisionDetail(second, [first])).toBeNull();
    const occupied = freeSegmentsOnWall("peninsula-90-right" as any, peninsulaRoom, [first, second], [], 0.5, 0, "base");
    expect(occupied.some((segment) => segment.start <= 30 && segment.start + segment.length >= 60)).toBe(false);
    const released = freeSegmentsOnWall("peninsula-90-right" as any, peninsulaRoom, [first], [], 0.5, 0, "base");
    expect(released.some((segment) => segment.start <= 30 && segment.start + segment.length >= 60)).toBe(true);
  });

  it("keeps peninsula base cabinets in normal counter, price, and materials workflows", () => {
    const base = peninsulaCabinet("pen-priced", 0);
    expect(countertopSurfaces([base], peninsulaRoom)).toEqual([
      expect.objectContaining({ kind: "base", rotation: 90, peninsulaRunId: "peninsula-90-right", linearInches: 30, runStartIn: 0 }),
    ]);
    const lines = buildDesignCabinetCartLines({
      placed: [base],
      styleId: 77,
      distributorId: 11,
      tier: "homeowner",
      styleNameById: new Map([[77, "Test finish"]]),
      unitPriceFor: () => 250,
    });
    expect(lines).toEqual([expect.objectContaining({ masterCode: "B-30", qty: 1, unitPrice: 250 })]);
    expect(buildMaterialsListRows({ buildRows: [], pricingLines: lines })).toEqual([
      expect.objectContaining({ code: "B-30", qty: 1, section: "cabinet" }),
    ]);
  });

	it("ends a peninsula countertop at an unsupported void while keeping the cabinet front and seating correct", () => {
    const start = peninsulaCabinet("peninsula-start", 0);
    const end = peninsulaCabinet("peninsula-end", 66);
    const withSeating: RoomData = {
      ...peninsulaRoom,
      peninsulaRuns: [{ ...peninsulaRoom.peninsulaRuns![0], countertopSeatingOverhang: 12, countertopWaterfallEnd: true }],
    };
		const surfaces = countertopSurfaces([start, end], withSeating).filter((item) => item.peninsulaRunId === "peninsula-90-right");
    expect(surfaces).toHaveLength(2);
    expect(surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ linearInches: 30, runStartIn: 0, depth: 37.5, rotation: 90 }),
      expect.objectContaining({ linearInches: 30, runStartIn: 66, depth: 37.5, rotation: 90 }),
    ]));
	  const run = withSeating.peninsulaRuns![0]!;
	  const geometry = peninsulaRunEndpoints(run, withSeating);
	  const cabinetFace = countertopRunFaceNormal(geometry.radians, "left");
	  const faceProjections = countertopSurfacePlanPolygon(surfaces[0]!).map((point) => (
	    (point.x - geometry.start.x) * cabinetFace.x + (point.y - geometry.start.y) * cabinetFace.y
	  ));
	  // The selected cabinet face keeps the normal 24 + 1½ in. top. Seating is
	  // a bar on the far side of the peninsula, not extra depth in front of doors.
	  expect(Math.max(...faceProjections)).toBeCloseTo(25.5, 6);
	  expect(Math.min(...faceProjections)).toBeCloseTo(-12, 6);
	  expect(countertopSurfaces([], withSeating)).toEqual([]);
	});

		it("extends a bar countertop across the drywall pony wall before projecting past it", () => {
	  const barRoom: RoomData = {
	    ...peninsulaRoom,
	    peninsulaRuns: [{ ...peninsulaRoom.peninsulaRuns![0], cabinetSide: "left", countertopPonyWallBarOverhang: 12 }],
	  };
	  const spot = wallPlacementAt(0, 30, 24, "peninsula-90-right" as any, barRoom, "left");
	  const cabinet = { ...peninsulaCabinet("pony-wall-bar-support", 0), ...spot, wallId: spot.wallId, wallOffset: spot.wallOffset, peninsulaSide: "left" as const };
	  const run = barRoom.peninsulaRuns![0]!;
	  const surface = countertopSurfaces([cabinet], barRoom).find((item) => item.peninsulaRunId === run.id)!;

	  expect(peninsulaCountertopPonyWallBarOverhang(run, barRoom)).toBe(12);
	  expect(peninsulaCountertopPonyWallBackExtensionIn(run, barRoom)).toBe(16.5);
	  expect(surface).toMatchObject({ depth: 42, ponyWallBarOverhangIn: 12, ponyWallBackExtensionIn: 16.5 });
	  const geometry = peninsulaRunEndpoints(run, barRoom);
	  const cabinetFace = countertopRunFaceNormal(geometry.radians, "left");
	  const faceProjections = countertopSurfacePlanPolygon(surface).map((point) => (
	    (point.x - geometry.start.x) * cabinetFace.x + (point.y - geometry.start.y) * cabinetFace.y
	  ));
	  expect(Math.max(...faceProjections)).toBeCloseTo(25.5, 6);
		  expect(Math.min(...faceProjections)).toBeCloseTo(-16.5, 6);
		});

		it("keeps every 45-degree cabinet-facing miter at the 1½-inch front edge when a bar projects behind the cabinets", () => {
		  const parent = {
		    ...peninsulaRoom.peninsulaRuns![0],
		    id: "front-edge-parent",
		    length: 72,
		    cabinetSide: "left" as const,
		    countertopPonyWallBarOverhang: 12 as const,
		  };
		  const child = {
		    id: "front-edge-return",
		    parentRunId: parent.id,
		    startOffset: 0,
		    turn: 45 as const,
		    direction: "right" as const,
		    length: 48,
		    height: 34.5,
		    cabinetSide: "left" as const,
		  };
		  const room: RoomData = { ...peninsulaRoom, width: 180, depth: 180, peninsulaRuns: [parent, child] };
		  const parentSpot = wallPlacementAt(0, parent.length, 24, parent.id as any, room, "left");
		  const childSpot = wallPlacementAt(0, child.length, 24, child.id as any, room, "left");
		  const cabinets = [
		    { ...peninsulaCabinet("front-edge-parent-base", 0), ...parentSpot, width: parent.length, wallId: parent.id, wallOffset: 0, peninsulaSide: "left" as const },
		    { ...peninsulaCabinet("front-edge-return-base", 0), ...childSpot, width: child.length, wallId: child.id, wallOffset: 0, peninsulaSide: "left" as const },
		  ];
		  const [surface] = countertopSurfaces(cabinets, room).filter((candidate) => candidate.peninsulaRunId);
		  const mitered = miteredPeninsulaCountertopSurfaces([
		    peninsulaCountertopSurface(parent, room),
		    peninsulaCountertopSurface(child, room),
		  ], room);
		  const parentFrame = peninsulaRunEndpoints(parent, room);
		  const childFrame = peninsulaRunEndpoints(child, room);
		  const parentNormal = countertopRunFaceNormal(parentFrame.radians, "left");
		  const childNormal = countertopRunFaceNormal(childFrame.radians, "left");
		  const parentTangent = { x: Math.cos(parentFrame.radians), y: Math.sin(parentFrame.radians) };
		  const childTangent = { x: Math.cos(childFrame.radians), y: Math.sin(childFrame.radians) };
		  const cross = (left: { x: number; y: number }, right: { x: number; y: number }) => left.x * right.y - left.y * right.x;
		  const offsetPoint = (origin: { x: number; y: number }, normal: { x: number; y: number }, reach: number) => ({
		    x: origin.x + normal.x * reach,
		    y: origin.y + normal.y * reach,
		  });
		  const miterIntersection = (reach: number) => {
		    const parentFront = offsetPoint(parentFrame.end, parentNormal, reach);
		    const childFront = offsetPoint(childFrame.start, childNormal, reach);
		    const delta = { x: childFront.x - parentFront.x, y: childFront.y - parentFront.y };
		    const t = cross(delta, childTangent) / cross(parentTangent, childTangent);
		    return { x: parentFront.x + parentTangent.x * t, y: parentFront.y + parentTangent.y * t };
		  };
		  const expectedFrontMiter = miterIntersection(COUNTERTOP_DEPTH_IN);
		  const erroneousDeepMiter = miterIntersection(42);
		  const outline = countertopSurfacePlanPolygon(surface!);
		  const miteredOutlines = mitered.map(countertopSurfacePlanPolygon);

		  expect(surface).toMatchObject({ peninsulaRunIds: [parent.id, child.id] });
		  expect(mitered).toHaveLength(2);
		  expect(mitered.every((candidate) => candidate.depth === 42)).toBe(true);
		  expect(outline.some((point) => Math.hypot(point.x - expectedFrontMiter.x, point.y - expectedFrontMiter.y) < 1e-6)).toBe(true);
		  expect(miteredOutlines.every((miteredOutline) => miteredOutline.some((point) => Math.hypot(point.x - expectedFrontMiter.x, point.y - expectedFrontMiter.y) < 1e-6))).toBe(true);
		  // This is the old, incorrect join: it treated the 42-inch bar depth as
		  // door-side projection and pushed the front past every cabinet face.
			  expect(Math.hypot(expectedFrontMiter.x - erroneousDeepMiter.x, expectedFrontMiter.y - erroneousDeepMiter.y)).toBeGreaterThan(0.001);
			  expect(miteredOutlines.flat().some((point) => Math.hypot(point.x - erroneousDeepMiter.x, point.y - erroneousDeepMiter.y) < 1e-6)).toBe(false);
			});

			it.each([
			  ["left", "left", 0, 12],
			  ["left", "left", 12, 0],
			  ["left", "left", 12, 12],
			  ["left", "left", 15, 0],
			  ["left", "left", 15, 12],
			  ["right", "right", 0, 12],
			  ["right", "right", 12, 0],
			  ["right", "right", 12, 12],
			  ["right", "right", 15, 0],
			  ["right", "right", 15, 12],
			] as const)("keeps the %s-side inside %s 45-degree return non-crossing with %i-inch seating and %i-inch bar depth", (cabinetSide, direction, seating, bar) => {
			  const parent = {
			    ...peninsulaRoom.peninsulaRuns![0],
			    id: `inside-miter-parent-${cabinetSide}`,
			    length: 72,
			    cabinetSide,
			    countertopSeatingOverhang: seating,
			    countertopPonyWallBarOverhang: bar,
			  };
			  const child = {
			    id: `inside-miter-child-${cabinetSide}`,
			    parentRunId: parent.id,
			    startOffset: 0,
			    turn: 45 as const,
			    direction,
			    length: 48,
			    height: 34.5,
			    cabinetSide,
			  };
			  const room: RoomData = { ...peninsulaRoom, width: 220, depth: 220, peninsulaRuns: [parent, child] };
			  const parentSpot = wallPlacementAt(0, parent.length, 24, parent.id as any, room, cabinetSide);
			  const childSpot = wallPlacementAt(0, child.length, 24, child.id as any, room, cabinetSide);
			  const cabinets = [
			    { ...peninsulaCabinet(`inside-parent-${cabinetSide}`, 0), ...parentSpot, width: parent.length, wallId: parent.id, wallOffset: 0, peninsulaSide: cabinetSide },
			    { ...peninsulaCabinet(`inside-child-${cabinetSide}`, 0), ...childSpot, width: child.length, wallId: child.id, wallOffset: 0, peninsulaSide: cabinetSide },
			  ];
			  const surfaces = countertopSurfaces(cabinets, room).filter((surface) => surface.peninsulaRunId != null);
			  expect(surfaces).toHaveLength(1);
			  const outline = countertopSurfacePlanPolygon(surfaces[0]!);
			  expect(countertopPolygonSelfIntersects(outline)).toBe(false);
			  expect(surfaces[0]).toMatchObject({ peninsulaRunIds: [parent.id, child.id] });
			});

			it("prices the full bar-top coverage across the drywall pony wall, not the cabinet-depth-only slab", () => {
	  const standardRoom: RoomData = {
	    ...peninsulaRoom,
	    peninsulaRuns: [{ ...peninsulaRoom.peninsulaRuns![0], cabinetSide: "left" }],
	  };
	  const barRoom: RoomData = {
	    ...peninsulaRoom,
	    peninsulaRuns: [{ ...peninsulaRoom.peninsulaRuns![0], cabinetSide: "left", countertopPonyWallBarOverhang: 12 }],
	  };
	  const standardSpot = wallPlacementAt(0, 96, 24, "peninsula-90-right" as any, standardRoom, "left");
	  const standardCabinet = {
	    ...peninsulaCabinet("standard-priced-peninsula", 0),
	    ...standardSpot,
	    width: 96,
	    wallId: standardSpot.wallId,
	    wallOffset: standardSpot.wallOffset,
	    peninsulaSide: "left" as const,
	  };
	  const barSpot = wallPlacementAt(0, 96, 24, "peninsula-90-right" as any, barRoom, "left");
	  const barCabinet = {
	    ...standardCabinet,
	    uid: "bar-priced-peninsula",
	    ...barSpot,
	    wallId: barSpot.wallId,
	    wallOffset: barSpot.wallOffset,
	  };

	  const standardMeasurement = countertopArea([standardCabinet], null, null, standardRoom);
	  const barMeasurement = countertopArea([barCabinet], null, null, barRoom);
	  expect(standardMeasurement.perimeterSquareFeet).toBe(Math.ceil(((96 * 25.5) / 144) * 10) / 10);
	  expect(barMeasurement.perimeterSquareFeet).toBe(Math.ceil(((96 * 42) / 144) * 10) / 10);
	  expect(barMeasurement.perimeterSquareFeet).toBeGreaterThan(standardMeasurement.perimeterSquareFeet);

	  const slab = { id: 88, name: "Quoted quartz slab", category: "Quartz Slabs (Countertops)", size: '24" x 24"', sellPrice: 100, countertopScope: "perimeter" as const };
	  const standardLine = buildSurfaceCartLines([slab], "homeowner", {
	    backsplashSqFt: 0,
	    flooringSqFt: 0,
	    countertopSqFt: standardMeasurement.squareFeet,
	    perimeterCountertopSqFt: standardMeasurement.perimeterSquareFeet,
	    islandCountertopSqFt: 0,
	  })[0]!;
	  const barLine = buildSurfaceCartLines([slab], "homeowner", {
	    backsplashSqFt: 0,
	    flooringSqFt: 0,
	    countertopSqFt: barMeasurement.squareFeet,
	    perimeterCountertopSqFt: barMeasurement.perimeterSquareFeet,
	    islandCountertopSqFt: 0,
	  })[0]!;
	  expect(barLine.qty).toBeGreaterThan(standardLine.qty);
	  expect(barLine.qtyNote).toContain(`${barMeasurement.perimeterSquareFeet.toFixed(1)} sq ft wall-run`);
	  expect((barLine.unitPrice ?? 0) * barLine.qty).toBeGreaterThan((standardLine.unitPrice ?? 0) * standardLine.qty);
	});

		it("covers the joined peninsula bend only where its ERB corner base provides support", () => {
		  const parent = { ...peninsulaRoom.peninsulaRuns![0], id: "countertop-corner-parent", length: 48, countertopPonyWallBarOverhang: 12 as const };
	  const child = { id: "countertop-corner-return", parentRunId: parent.id, startOffset: 0, turn: 90 as const, direction: "right" as const, length: 42, height: 34.5, cabinetSide: "left" as const };
	  const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, child] };
	  const bend = peninsulaRunEndpoints(parent, room).end;
	  const erb36: PlacedCabinet = {
	    ...peninsulaCabinet("erb36-bend-support", 0),
	    masterCode: "ERB36",
	    description: "Easy Reach Corner Base 36",
	    width: 36,
	    depth: 36,
	    x: bend.x - 18,
	    y: bend.y - 18,
	    wallId: parent.id,
	    wallOffset: 12,
	  };

	  const surfaces = countertopSurfaces([erb36], room).filter((surface) => surface.peninsulaRunId);
		  expect(surfaces).toEqual([
		    expect.objectContaining({ peninsulaRunId: parent.id, peninsulaRunIds: [parent.id, child.id], ponyWallBarOverhangIn: 12 }),
		  ]);
		});

		it("miter-joins a 90-degree bar-top bend on two shared seam points, without a corner gap", () => {
		  const parent = { ...peninsulaRoom.peninsulaRuns![0], id: "ninety-bar-parent", length: 72, cabinetSide: "left" as const, countertopPonyWallBarOverhang: 12 as const };
		  const child = { id: "ninety-bar-return", parentRunId: parent.id, startOffset: 0, turn: 90 as const, direction: "right" as const, length: 72, height: 34.5, cabinetSide: "left" as const };
		  const room: RoomData = { ...peninsulaRoom, width: 180, depth: 180, peninsulaRuns: [parent, child] };
		  const parentSpot = wallPlacementAt(0, parent.length, 24, parent.id as any, room, "left");
		  const childSpot = wallPlacementAt(0, child.length, 24, child.id as any, room, "left");
		  const cabinets = [
		    { ...peninsulaCabinet("ninety-bar-parent-cabinet", 0), ...parentSpot, width: parent.length, wallId: parent.id, wallOffset: 0, peninsulaSide: "left" as const },
		    { ...peninsulaCabinet("ninety-bar-return-cabinet", 0), ...childSpot, width: child.length, wallId: child.id, wallOffset: 0, peninsulaSide: "left" as const },
		  ];
		  const surfaces = countertopSurfaces(cabinets, room).filter((surface) => surface.peninsulaRunId);
		  expect(surfaces).toHaveLength(1);
		  const [surface] = surfaces;
		  expect(surface).toMatchObject({ peninsulaRunIds: [parent.id, child.id], miteredEnd: true, miteredStart: true });
		  const polygon = countertopSurfacePlanPolygon(surface!);
		  expect(countertopPolygonSelfIntersects(polygon)).toBe(false);
		  expect(polygon.length).toBeGreaterThanOrEqual(6);
		});

		it("locks an entire peninsula assembly from either its root or connected return", () => {
		  const parent = { ...peninsulaRoom.peninsulaRuns![0], id: "locked-assembly-parent", locked: true };
		  const child = { id: "locked-assembly-return", parentRunId: parent.id, startOffset: 0, turn: 90 as const, direction: "right" as const, length: 36, height: 34.5 };
		  const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, child] };
		  expect(peninsulaRootRunId(child, room)).toBe(parent.id);
		  expect(peninsulaRunAssemblyLocked(parent, room)).toBe(true);
		  expect(peninsulaRunAssemblyLocked(child, room)).toBe(true);
		});

		it("does not leave a base-end angled drawer cabinet uncovered at a peninsula bend", () => {
	  const parent = { ...peninsulaRoom.peninsulaRuns![0], id: "bec-bend-parent", length: 48 };
	  const child = { id: "bec-bend-return", parentRunId: parent.id, startOffset: 0, turn: 90 as const, direction: "right" as const, length: 36, height: 34.5 };
	  const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, child] };
	  const bend = peninsulaRunEndpoints(parent, room).end;
	  const bec: PlacedCabinet = {
	    ...peninsulaCabinet("bec-drawer-base", 0),
	    masterCode: "BEC24",
	    description: "Angle Drawer Base Cabinet with Adjustable Shelf",
	    width: 24,
	    depth: 24,
	    x: bend.x - 12,
	    y: bend.y - 12,
	    wallId: parent.id,
	    wallOffset: 24,
	  };
	  expect(countertopSurfaces([bec], room).filter((surface) => surface.peninsulaRunId)).toEqual(expect.arrayContaining([
	    expect.objectContaining({ peninsulaRunId: parent.id }),
	    expect.objectContaining({ peninsulaRunId: child.id }),
	  ]));
	});

	it("inherits the root seating overhang across a legacy zero-overhang 45-degree return so the saved B24 corner remains covered", () => {
    const parent = {
      id: "peninsula_mu3bq5rw",
      parentWall: "top" as const,
      startOffset: 144.875,
      turn: 90 as const,
      direction: "left" as const,
      length: 90,
      height: 34.5,
      cabinetSide: "left" as const,
      countertopSeatingOverhang: 12 as const,
      countertopWaterfallEnd: true,
    };
    const child = {
      id: "peninsula_return_mu3bvzwj",
      parentRunId: parent.id,
      startOffset: 0,
      turn: 45 as const,
      direction: "right" as const,
      length: 36,
      height: 34.5,
      cabinetSide: "left" as const,
      countertopSeatingOverhang: 0 as const,
    };
    const room: RoomData = { width: 192, depth: 144, ceilingHeight: 96, peninsulaRuns: [parent, child] };
    const parentB15 = { ...peninsulaCabinet("saved-b15", 36), ...wallPlacementAt(36, 15, 24, parent.id as any, room, "left"), width: 15, wallId: parent.id, wallOffset: 36, peninsulaSide: "left" as const };
    const parentB27 = { ...peninsulaCabinet("saved-b27", 51), ...wallPlacementAt(51, 27, 24, parent.id as any, room, "left"), width: 27, wallId: parent.id, wallOffset: 51, peninsulaSide: "left" as const };
    const childB24 = { ...peninsulaCabinet("saved-b24", 12), ...wallPlacementAt(12, 24, 24, child.id as any, room, "left"), width: 24, wallId: child.id, wallOffset: 12, peninsulaSide: "left" as const };

    expect(peninsulaCountertopSeatingOverhang(parent, room)).toBe(12);
    expect(peninsulaCountertopSeatingOverhang(child, room)).toBe(12);
    expect(peninsulaCountertopWaterfallEnd(parent, room)).toBe(false);
    expect(peninsulaCountertopWaterfallEnd(child, room)).toBe(true);
    const surfaces = countertopSurfaces([parentB15, parentB27, childB24], room).filter((surface) => surface.peninsulaRunId);
    expect(surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ peninsulaRunId: parent.id, runStartIn: 36, linearInches: 42 }),
      expect.objectContaining({ peninsulaRunId: child.id, runStartIn: 12, linearInches: 24 }),
    ]));
    expect(surfaces).toHaveLength(3); // parent slab, return slab, and the void-fill bridge between them
    const visibleArea = surfaces.reduce((sum, surface) => sum + (surface.areaInches ?? surface.width * surface.depth), 0);
    const terminalWaterfallArea = STD.BASE_HEIGHT * 37.5;
    expect(countertopArea([parentB15, parentB27, childB24], null, null, room).squareFeet).toBe(Math.ceil(((visibleArea + terminalWaterfallArea) / 144) * 10) / 10);
  });

  it("gives each cabinet-supported connected run its own continuous countertop without inventing one for an empty return", () => {
    const parent = peninsulaRoom.peninsulaRuns![0];
    const child = { id: "return-with-counter", parentRunId: parent.id, startOffset: 0, turn: 90 as const, direction: "right" as const, length: 42, height: 34.5 };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, child] };
    const parentSpot = wallPlacementAt(66, 30, 24, parent.id as any, room);
    const childSpot = wallPlacementAt(0, 30, 24, child.id as any, room);
    const parentCabinet = { ...peninsulaCabinet("parent-joint", 66), ...parentSpot, wallOffset: 66, wallId: parent.id };
    const childCabinet = { ...peninsulaCabinet("child-joint", 0), ...childSpot, wallOffset: 0, wallId: child.id };
    expect(countertopSurfaces([parentCabinet], room)).toEqual([expect.objectContaining({ peninsulaRunId: parent.id })]);
    expect(countertopSurfaces([parentCabinet, childCabinet], room)).toEqual([
      expect.objectContaining({ peninsulaRunId: parent.id, peninsulaRunIds: [parent.id, child.id] }),
    ]);
  });

  it("retains continuous countertop coverage on a straight peninsula with a locked 45-degree end", () => {
    const parent = { ...peninsulaRoom.peninsulaRuns![0], id: "angled-parent", startOffset: 72, length: 36 };
    const child = { id: "angled-return", parentRunId: parent.id, startOffset: 0, turn: 45 as const, direction: "left" as const, length: 30, height: 34.5 };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, child] };
    const parentSpot = wallPlacementAt(6, 30, 24, parent.id as any, room);
    const childSpot = wallPlacementAt(0, 30, 24, child.id as any, room);
    const parentCabinet = { ...peninsulaCabinet("angled-parent-joint", 6), ...parentSpot, wallOffset: 6, wallId: parent.id };
    const childCabinet = { ...peninsulaCabinet("angled-child-joint", 0), ...childSpot, wallOffset: 0, wallId: child.id };
    expect(countertopSurfaces([parentCabinet, childCabinet], room)).toEqual([
      expect.objectContaining({
        peninsulaRunId: parent.id,
        peninsulaRunIds: [parent.id, child.id],
        rotation: 0,
      }),
    ]);
  });

  it("unifies the straight-to-45 countertop path into one mitered slab and charges only its visible area", () => {
    const parent = { ...peninsulaRoom.peninsulaRuns![0], id: "miter-parent", startOffset: 72, length: 48, cabinetSide: "right" as const };
    const child = { id: "miter-child", parentRunId: parent.id, startOffset: 0, turn: 45 as const, direction: "left" as const, length: 36, height: 34.5, cabinetSide: "right" as const };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, child] };
    const parentSpot = wallPlacementAt(0, 48, 24, parent.id as any, room, "right");
    const childSpot = wallPlacementAt(0, 36, 24, child.id as any, room, "right");
    const parentCabinet = { ...peninsulaCabinet("miter-parent-cabinet", 0), ...parentSpot, width: 48, wallId: parent.id, wallOffset: 0, peninsulaSide: "right" as const };
    const childCabinet = { ...peninsulaCabinet("miter-child-cabinet", 0), ...childSpot, width: 36, wallId: child.id, wallOffset: 0, peninsulaSide: "right" as const };
    const surfaces = countertopSurfaces([parentCabinet, childCabinet], room);
    expect(surfaces).toHaveLength(1);
    const surface = surfaces[0]!;
    expect(surface).toMatchObject({ peninsulaRunIds: [parent.id, child.id], rotation: 0 });
    expect(surface.polygon).toBeDefined();
    expect(countertopSurfacePlanPolygon(surface)).toHaveLength(6);
    expect(surface.areaInches).toBeLessThan(parent.length * 25.5 + child.length * 25.5);

    const visibleArea = surfaces.reduce((sum, surface) => sum + (surface.areaInches ?? surface.width * surface.depth), 0);
    const measurement = countertopArea([parentCabinet, childCabinet], null, null, room);
    expect(measurement.squareFeet).toBe(Math.ceil((visibleArea / 144) * 10) / 10);
  });

  it.each([
    ["right", "right", "left"],
    ["right", "left", "right"],
    ["left", "right", "left"],
    ["left", "left", "right"],
	  ] as const)("keeps the %s-side %s/%s straight-to-45-to-straight countertop within its physical depth", (cabinetSide, firstDirection, secondDirection) => {
	    const primary = { id: `projection-${cabinetSide}-${firstDirection}-primary`, parentWall: "left" as const, startOffset: 48, turn: 90 as const, direction: "right" as const, length: 30, height: 34.5, cabinetSide, countertopSeatingOverhang: 12 as const };
    const angle = { id: `projection-${cabinetSide}-${firstDirection}-angle`, parentRunId: primary.id, startOffset: 0, turn: 45 as const, direction: firstDirection, length: 42, height: 34.5, cabinetSide };
    const returning = { id: `projection-${cabinetSide}-${firstDirection}-return`, parentRunId: angle.id, startOffset: 0, turn: 45 as const, direction: secondDirection, length: 48, height: 34.5, cabinetSide };
    const room: RoomData = { ...peninsulaRoom, width: 180, depth: 150, peninsulaRuns: [primary, angle, returning] };
    const cabinets = room.peninsulaRuns!.map((run, index) => {
      const spot = wallPlacementAt(0, run.length, 24, run.id as any, room, cabinetSide);
      return { ...peninsulaCabinet(`${run.id}-cabinet`, 0), ...spot, cabinetId: index + 1, width: run.length, wallId: run.id, wallOffset: 0, peninsulaSide: cabinetSide };
    });
    const surfaces = countertopSurfaces(cabinets, room).filter((surface) => surface.peninsulaRunId);
    expect(surfaces).toHaveLength(1);
    const surface = surfaces[0]!;
    expect(surface).toMatchObject({
      peninsulaRunId: primary.id,
      peninsulaRunIds: [primary.id, angle.id, returning.id],
      peninsulaTerminalRunId: returning.id,
      rotation: 0,
      miteredStart: true,
      miteredEnd: true,
    });
    const outline = countertopSurfacePlanPolygon(surface);
    expect(outline.length).toBeGreaterThanOrEqual(8);
	    expect(outline.every((point, index) => {
	      const next = outline[(index + 1) % outline.length]!;
	      return Math.hypot(point.x - next.x, point.y - next.y) > 0.001;
	    })).toBe(true);
	    expect(countertopPolygonSelfIntersects(outline)).toBe(false);
	  });

  it("cuts the peninsula countertop around a stove without changing the connected 45-degree return", () => {
    const parent = { ...peninsulaRoom.peninsulaRuns![0], id: "stove-parent", startOffset: 72, length: 96 };
    const child = { id: "stove-angled-return", parentRunId: parent.id, startOffset: 0, turn: 45 as const, direction: "left" as const, length: 30, height: 34.5 };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, child] };
    const startSpot = wallPlacementAt(0, 24, 24, parent.id as any, room);
    const stoveSpot = wallPlacementAt(24, 30, 25, parent.id as any, room);
    const endSpot = wallPlacementAt(54, 42, 24, parent.id as any, room);
    const angledSpot = wallPlacementAt(0, 30, 24, child.id as any, room);
    const start = { ...peninsulaCabinet("stove-start", 0), ...startSpot, width: 24, wallId: parent.id, wallOffset: 0 };
    const stove = {
      ...peninsulaCabinet("range-opening", 24),
      ...stoveSpot,
      masterCode: "STOVE-30",
      description: "30 inch gas stove",
      placement: "appliance" as const,
      width: 30,
      depth: 25,
      height: 36,
      wallId: parent.id,
      wallOffset: 24,
    };
    const end = { ...peninsulaCabinet("stove-end", 54), ...endSpot, width: 42, wallId: parent.id, wallOffset: 54 };
    const angled = { ...peninsulaCabinet("stove-angle", 0), ...angledSpot, width: 30, wallId: child.id, wallOffset: 0 };

    const surfaces = countertopSurfaces([start, stove, end, angled], room);
    const parentSurfaces = surfaces.filter((surface) => surface.peninsulaRunId === parent.id);
    expect(parentSurfaces).toHaveLength(2);
    expect(parentSurfaces).toContainEqual(expect.objectContaining({ runStartIn: 0, linearInches: 24, rotation: 90 }));
    expect(parentSurfaces).toContainEqual(expect.objectContaining({
      peninsulaRunIds: [parent.id, child.id],
      rotation: 0,
    }));
    expect(parentSurfaces.filter((surface) => !surface.peninsulaRunIds).reduce((total, surface) => total + (surface.linearInches ?? 0), 0)).toBe(24);
  });

  it("deletes only the selected peninsula and its owned cabinets, clearing derived counter, price, and materials entries", () => {
    const owned = peninsulaCabinet("delete-peninsula", 0);
    const removed = removePeninsulaRun(peninsulaRoom, [owned], "peninsula-90-right");
    expect(removed.room.peninsulaRuns).toEqual([]);
    expect(removed.placed).toEqual([]);
    expect(removed.removedCabinetUids).toEqual(["delete-peninsula"]);
    expect(countertopSurfaces(removed.placed, removed.room)).toEqual([]);
    const lines = buildDesignCabinetCartLines({
      placed: removed.placed,
      styleId: 77,
      distributorId: 11,
      tier: "homeowner",
      styleNameById: new Map([[77, "Test finish"]]),
      unitPriceFor: () => 250,
    });
    expect(lines).toEqual([]);
    expect(buildMaterialsListRows({ buildRows: [], pricingLines: lines })).toEqual([]);
  });

  it("removes a selected return and its descendants without touching its parent run", () => {
    const parent = peninsulaRoom.peninsulaRuns![0];
    const child = { id: "return", parentRunId: parent.id, startOffset: 0, turn: 90 as const, direction: "left" as const, length: 24, height: 34.5 };
    const grandchild = { id: "return-two", parentRunId: child.id, startOffset: 0, turn: 90 as const, direction: "right" as const, length: 24, height: 34.5 };
    const room: RoomData = { ...peninsulaRoom, peninsulaRuns: [parent, child, grandchild] };
    const parentCabinet = peninsulaCabinet("parent-cabinet", 0);
    const childCabinet = { ...peninsulaCabinet("return-cabinet", 0), wallId: child.id };
    const grandchildCabinet = { ...peninsulaCabinet("return-two-cabinet", 0), wallId: grandchild.id };
    const removed = removePeninsulaRun(room, [parentCabinet, childCabinet, grandchildCabinet], child.id);
    expect(removed.room.peninsulaRuns).toEqual([parent]);
    expect(removed.placed.map((cabinet) => cabinet.uid)).toEqual(["parent-cabinet"]);
  });
});
