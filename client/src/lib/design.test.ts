import { describe, it, expect } from "vitest";
import { findSmallGapFillerOpportunity } from "./smallGapFiller";
import {
	  isCornerCabinet, isAngledWallCabinet, isProtectedCornerCabinet, requiresRoomCornerPlacement, cornerClipPath, centerDistance, formatInches,
  isApplianceCode, applianceAsDesignCabinet, elevationBox, APPLIANCES,
  conflictingUids, isSinkBaseCabinet, isFarmSinkBasePaletteItem, isSinkAppliance, makeSinkForCabinet, STD,
  appliancesForRoom, ROOM_TYPES,
  makeOpening, clampOpening, wallLength, OPENINGS,
	  snapToWall, snapWallCabinetToOwningWall, feetInchesToInches, inchesToFeetInches, clampRoomInches,
  ROOM_MIN_IN, ROOM_MAX_IN,
  nextFreeSpotOnWall, clampCabinetToRoom, clampCabinetsToRoom,
  clampIslandToRoom, WALL_LABELS, resizeRoomByWall,
  crownLinearInches, toeKickLinearInches, trimPiecesNeeded,
  miteredTrimInches, cabinetWall, countertopArea,
  MITER_ALLOWANCE_IN, COUNTERTOP_DEPTH_IN,
  doorPanelKind, wallSpanMeasure, wallCabinetFitMeasure,
  countertopSurfaces, countertopMaterial, makeSink, COUNTERTOP_DEPTH_IN as CT_DEPTH, bearsCountertop, peninsulaCornerCabinetSupportsCountertop, countertopSurfacePlanPolygon, countertopPolygonSelfIntersects, lCornerCountertopWorldPolygon,
  wallCabinetTopLine, roomCeiling, ceilingFitViolations, DEFAULT_CEILING_HEIGHT, ordinaryWallMountBottom,
	  wallCeiling, wallCeilingIsSloped, wallCeilingMin, wallCeilingAt, wallCabinetVerticalMoveLimit, repairWallCabinetPlanSeamForVerticalMove, clampCeilingHeight,
	  freeSegmentsOnWall, magneticAvailableWallStart, nearestAvailableWallStart, firstCollisionFreeWallPlacement, wallPlacementAt, wallRunOffset, wallGapFitPreview, wallGaps, paletteActiveWallPlacement, kneeDrawerWallPlacement, refrigeratorAdjacentOpeningPlacement, nextAvailableRoomCornerPlacement, customWallTrueCornerPlacement, adjoiningWallRunMountBottom, selectedSinkBaseWallPlacement, sinkBaseWindowPlacement, selectedLowerCabinetWallPlacement, matchingLowerCabinetWallPlacement, continuousWallApplianceSnapInfo,
  rangeOvenClearanceViolations, RANGE_CLEARANCE_FILLER_IN, autoPlaceRangeFillers,
  wallOpeningClearanceViolations, WALL_OPENING_CLEARANCE_IN, bridgeMountBottomAboveWindow, overSinkWindowStart, overSinkWallMountBottom, overSinkWindowClearanceMeasure, overSinkWindowClearanceBlocked, normalizeOverSinkWallMounts, OVER_SINK_WALL_MOUNT_BOTTOM,
	  blindCornerSpecViolations, blindCornerViolations, blindPullRange, blindCornerPullPlacement, resolveBaseBlindCornerFillerSnap,
	  blindCornerAutoFiller, blindCornerRearCountertopExtensionIn,
			  isStacker, glassStackerParentPlacement, glassStackerFrontFlushSpot, glassStackerFrontSnapTarget, normalizeGlassStackersToParentFronts, isWd18CountertopDrawerCabinet, wd18CountertopFaceLayout, normalizeWd18CountertopMounts, normalizeStandardWallMounts,
  isDiagonalCorner, footprintDepth,
  isLCornerCabinet, cornerLegRatioForPlaced, placedCornerGeometryKind, placedFootprint, normalizeLCornerDepths,
	  baseOpeningOverlaps, blocksFloorRun, missingCornerBaseViolations, isWindowBelowCountertop, windowVerticallyOverlapsCabinet,
  snapPosition, snapCabinetSeamOverlap, CABINET_CONFLICT_LOCK_IN, orientToWall, hasCollision, collisionReason, cabinetPlacementCollisionDetail, wallCabinetPlacementReason, removeOverlappingPlacements, shouldBlockPlacementCollision, isHoodOverRangePair,
  resolveSwing, cycleSwing, swingLabel, swingText, hasDoorSwing, type DoorSwing,
  isCustomWidth, isCustomHeight, isCustomDepth, isCustomSize, customSizeNote, customSizeFee, CUSTOM_SIZE_FEE, dimLabel,
		  cabinetAttrNote, cabinetHardwarePositionPatch, isCabinetDoorHardwareEligible, applyCabinetDoorHardwareToAll, cabinetWallDragPreview, cabinetWallMovePreview, isWallRunDraggable, wallGapFreehandPreview, roomWithPersistedEntities, potFillerMountedRange, restoredSavedDesignStyle, clearForeignSavedStyleOverrides, pricingStyleId, normalizeRefrigeratorBayUppers, refrigeratorSurroundElevation,
  	  type PlacedCabinet, type RoomData, type WallOpening, isFillerItem, fillerWidthRange, normalizeFloatingShelfPlacement, normalizeWallOpenShelfPlacement, isFloatingShelfItem, isWallOpenShelfCabinet, isKneeDrawerItem, isPlaceableAccessory, accessoryPlacement, kitchenCrestGenericOpenEndShelfCount, isDishwasherPanel, normalizeDishwasherPanelPlacement,
} from "./design";

const ROOM_12x10: RoomData = { width: 144, depth: 120 };

describe("wall cabinet flush mounting", () => {
  it("reseats a moved wall cabinet against its rotation-owned wall while preserving its along-wall coordinate", () => {
    const floating: PlacedCabinet = {
      uid: "floating-upper", cabinetId: 1, masterCode: "W-3624", description: "36 inch Wall Cabinet",
      placement: "wall", x: 42, y: 37, width: 36, depth: 12, height: 24, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0,
      depthPositionAdjusted: true,
    };
    const snapped = snapWallCabinetToOwningWall(floating, ROOM_12x10);
    expect(snapped).toMatchObject({ x: 42, y: 0, depthPositionAdjusted: false });
  });

  it("reseats a vertical wall cabinet against its left or right wall without changing its along-wall coordinate", () => {
    const floating: PlacedCabinet = {
      uid: "floating-side-upper", cabinetId: 2, masterCode: "W-2430", description: "24 inch Wall Cabinet",
      placement: "wall", x: 28, y: 54, width: 24, depth: 12, height: 30, rotation: 90, numberOfDoors: 2, numberOfDrawers: 0,
    };
    const snapped = snapWallCabinetToOwningWall(floating, ROOM_12x10);
    expect(snapped).toMatchObject({ x: 0, y: 54 });
  });
});

describe("floating-shelf legacy dimension repair", () => {
  it("normalizes an incorrectly imported FS48 or FS60 into a thin 12-inch-deep wall shelf", () => {
    const staleFs48: PlacedCabinet = {
      uid: "stale-fs48", cabinetId: 48, masterCode: "FS48", description: "48 inch Floating Shelf",
      placement: "base", x: 24, y: 0, width: 48, depth: 24, height: 34.5, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 0,
    };
    const normalized = normalizeFloatingShelfPlacement(staleFs48);
    expect(normalized).toMatchObject({ placement: "wall", width: 48, depth: 12, height: 2.06, numberOfDoors: 0, numberOfDrawers: 0 });
  });

  it("keeps WEOS0930 as a 9-by-30-by-12 wall-end shelf with two fixed shelves while retaining WOS0930's source attributes", () => {
    const staleWeos0930: PlacedCabinet = {
      uid: "stale-weos0930", cabinetId: 930, masterCode: "WEOS0930", description: "Versa Shaker Wall End Shelf",
      placement: "base", x: 0, y: 0, width: 9, depth: 24, height: 2.06, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 0,
    };
    const normalized = normalizeWallOpenShelfPlacement(staleWeos0930);
    expect(isFloatingShelfItem(staleWeos0930)).toBe(false);
    expect(isWallOpenShelfCabinet(staleWeos0930)).toBe(true);
    expect(isPlaceableAccessory(staleWeos0930)).toBe(true);
    expect(accessoryPlacement(staleWeos0930)).toBe("wall");
    expect(normalized).toMatchObject({
      placement: "wall", width: 9, height: 30, depth: 12,
      numberOfDoors: 0, numberOfDrawers: 0, fixedShelfCount: 2,
    });
    expect(normalizeWallOpenShelfPlacement({ ...staleWeos0930, masterCode: "WOS0930" })).toMatchObject({ width: 9, height: 30, depth: 12 });
  });

  it("uses the supplied KitchenCrest OE6 square-shelf count only when the source description confirms the form", () => {
    const oe630: PlacedCabinet = {
      uid: "oe630", cabinetId: 630, masterCode: "OE630", description: '6" x 30" Open End Shelf Wall Cabinet',
      placement: "wall", x: 0, y: 0, width: 6, depth: 12, height: 30, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 0, fixedShelfCount: 3,
    };
    expect(kitchenCrestGenericOpenEndShelfCount(oe630)).toBe(2);
    expect(normalizeWallOpenShelfPlacement(oe630)).toMatchObject({ fixedShelfCount: 2, width: 6, height: 30, depth: 12 });
    expect(kitchenCrestGenericOpenEndShelfCount({ ...oe630, masterCode: "OE636", height: 36 })).toBe(3);
    expect(kitchenCrestGenericOpenEndShelfCount({ ...oe630, description: "Oven End Cabinet" })).toBeNull();
  });
});

describe("knee drawer mounting", () => {
  const kneeDrawer: PlacedCabinet = {
    uid: "knee-drawer", cabinetId: 36, masterCode: "SW-VKD36", description: "Knee Drawer - 36 inch wide", category: "Accessory", subCategory: "Drawer",
    placement: "baseTop", x: 36, y: 0, width: 36, depth: 21, height: 7, rotation: 0, numberOfDoors: 0, numberOfDrawers: 1,
  };

  it("recognizes a catalog knee drawer as a placeable base-top item", () => {
    expect(isKneeDrawerItem(kneeDrawer)).toBe(true);
    expect(isPlaceableAccessory(kneeDrawer)).toBe(true);
    expect(accessoryPlacement(kneeDrawer)).toBe("baseTop");
  });

  it("recognizes the DKD30 catalog code as a raised knee drawer even when imported as a base item", () => {
    const dkd30 = {
      masterCode: "DKD30",
      description: "30 inch x 6 inch Knee Drawer Base Cabinet",
      category: "Base",
      subCategory: "Knee Drawer",
    };
    expect(isKneeDrawerItem(dkd30)).toBe(true);
    expect(accessoryPlacement(dkd30)).toBe("baseTop");
  });

  it("defaults to 30 inches and constrains custom knee-drawer mounting height to 24–30 inches", () => {
    expect(elevationBox(kneeDrawer, ROOM_12x10)).toEqual({ bottom: 30, height: 7 });
    expect(elevationBox({ ...kneeDrawer, mountBottom: 24 }, ROOM_12x10)).toEqual({ bottom: 24, height: 7 });
    expect(elevationBox({ ...kneeDrawer, mountBottom: 20 }, ROOM_12x10)).toEqual({ bottom: 24, height: 7 });
    expect(elevationBox({ ...kneeDrawer, mountBottom: 36 }, ROOM_12x10)).toEqual({ bottom: 30, height: 7 });
  });

  it("targets the first measured base-cabinet knee-space void rather than placing above a base cabinet", () => {
    const bases: PlacedCabinet[] = [
      { uid: "left-base", cabinetId: 1, masterCode: "B36", description: "Base", placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0 },
      { uid: "right-base", cabinetId: 2, masterCode: "B36", description: "Base", placement: "base", x: 72, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0 },
    ];
    expect(kneeDrawerWallPlacement("top", ROOM_12x10, bases, [], 36, 21)).toMatchObject({ x: 36, y: 0, rotation: 0 });
    expect(kneeDrawerWallPlacement("top", ROOM_12x10, bases, [], 42, 21)).toBeNull();
  });
});

describe("Wall mode isolation from island faces", () => {
  it("does not let an island base shorten a right-wall SB-36 opening", () => {
    const room: RoomData = { width: 144, depth: 120 };
    const rightWallSb36: PlacedCabinet = {
      uid: "right-wall-sb36", cabinetId: 36, masterCode: "SB36", description: "36 inch Sink Base",
      placement: "base", x: 120, y: 0, width: 36, depth: 24, height: 34.5, rotation: 90,
      numberOfDoors: 2, numberOfDrawers: 0,
    };
    const islandBase: PlacedCabinet = {
      uid: "island-base-near-right-wall", cabinetId: 24, masterCode: "B24", description: "24 inch Base Cabinet",
      placement: "base", x: 96, y: 40, width: 24, depth: 24, height: 34.5, rotation: 90,
      islandFace: "right", islandOffset: 0, numberOfDoors: 1, numberOfDrawers: 1,
    };
    const fit = wallCabinetFitMeasure(rightWallSb36, room, [islandBase], [], "right", 0);
    expect(fit).toMatchObject({ availableSpan: 120, requiredSpan: 36, status: "fits" });
  });
});

describe("3D same-wall cabinet drag", () => {
  const cabinet = (uid: string, x: number, y: number, width: number, rotation = 0): PlacedCabinet => ({
    uid,
    cabinetId: Number(uid.replace(/\D/g, "")) || 1,
    masterCode: `B-${width}`,
    description: `${width} inch Base Cabinet`,
    placement: "base",
    x,
    y,
    width,
    depth: 24,
    height: 34.5,
    rotation,
    numberOfDoors: width >= 21 ? 2 : 1,
    numberOfDrawers: 1,
  });

  it("keeps a freely dragged B-12 at the pointer position instead of jumping to a distant wall edge", () => {
    const moving = cabinet("free-moving-b12", 0, 0, 12);
    const preview = cabinetWallDragPreview(moving, ROOM_12x10, [moving], [], 66)!;

    expect(preview.candidate).toMatchObject({ x: 60, y: 0 });
    expect(preview.fit).toMatchObject({ snapStart: 60, snapEnd: 72, before: 60, after: 72, status: "valid" });
  });

	  it("snaps within three inches of a neighbor seam but preserves a farther valid pointer position", () => {
    const moving = cabinet("threshold-b12", 0, 0, 12);
    const neighbor = cabinet("threshold-neighbor", 45, 0, 24);

    const withinThree = cabinetWallDragPreview(moving, ROOM_12x10, [moving, neighbor], [], 36.5)!;
    expect(withinThree.candidate).toMatchObject({ x: 33, y: 0 });
    expect(neighbor.x - (withinThree.candidate!.x + placedFootprint(withinThree.candidate!).w)).toBe(0);

    const beyondThree = cabinetWallDragPreview(moving, ROOM_12x10, [moving, neighbor], [], 35.875)!;
    expect(beyondThree.candidate).toMatchObject({ x: 29.875, y: 0 });
	    expect(neighbor.x - (beyondThree.candidate!.x + placedFootprint(beyondThree.candidate!).w)).toBe(3.125);
	  });

	  it("holds Shift for exact pointer placement without seam attraction while retaining zero overlap", () => {
	    const moving = cabinet("freehand-b12", 0, 0, 12);
	    const neighbor = cabinet("freehand-neighbor", 45, 0, 24);
	    const freehand = cabinetWallDragPreview(moving, ROOM_12x10, [moving, neighbor], [], 36.5, { disableSnapping: true })!;

	    expect(freehand).toMatchObject({ freehand: true, snapped: false, candidate: { x: 30.5, y: 0 } });
	    expect(neighbor.x - (freehand.candidate!.x + placedFootprint(freehand.candidate!).w)).toBe(2.5);
	    const collision = cabinetWallDragPreview(moving, ROOM_12x10, [moving, neighbor], [], 42, { disableSnapping: true })!;
	    expect(collision.candidate).toBeNull();
	    expect(collision.fit.status).toBe("invalid");
	  });

	it("computes a catalog freehand drop at the pointer without moving it to the opening edge", () => {
	  const gaps = [{ side: "top", layer: "base", start: 30, length: 30, center: 45, isStandardSize: true, isFillerSize: false }] as const;
	  expect(wallGapFreehandPreview([...gaps], 46.5, 12)).toMatchObject({ status: "valid", snapStart: 40.5, snapEnd: 52.5, before: 10.5, after: 7.5 });
	  expect(wallGapFreehandPreview([...gaps], 58, 12)).toMatchObject({ status: "invalid", snapStart: 52, snapEnd: 64 });
	});

	it("recognizes every standard cabinet width through a full 36-inch clear opening", () => {
	  const gaps = [{ side: "top", layer: "base", start: 45, length: 36, center: 63, isStandardSize: true, isFillerSize: false }] as const;
	  [9, 12, 15, 18, 21, 24, 27, 30, 33, 36].forEach((width) => {
	    const preview = wallGapFitPreview([...gaps], 63, width)!;
	    expect(preview).toMatchObject({ status: "valid", availableSpan: 36, requiredSpan: width });
	    expect(preview.snapStart).toBeGreaterThanOrEqual(45);
	    expect(preview.snapEnd).toBeLessThanOrEqual(81);
	  });
	});

  it("fits B-12 between two objects and leaves the measured three-inch remainder for the filler workflow", () => {
    const moving = cabinet("bounded-b12", 90, 0, 12);
    const left = cabinet("bounded-left", 0, 0, 30);
    const right = cabinet("bounded-right", 45, 0, 24);
    const preview = cabinetWallDragPreview(moving, ROOM_12x10, [left, moving, right], [], 37.5)!;

    expect(preview.candidate).toMatchObject({ x: 30, y: 0 });
    expect(preview.fit).toMatchObject({ availableSpan: 15, requiredSpan: 12, before: 0, after: 3, status: "valid" });
    expect(hasCollision(preview.candidate!, [left, right])).toBe(false);
  });

  it("does not advertise an occupied perpendicular corner as a valid B-12 drop target", () => {
    const moving = cabinet("corner-b12", 60, 0, 12);
    const rightWallCorner = cabinet("right-wall-corner", 120, 0, 36, 90);
    const preview = cabinetWallDragPreview(moving, ROOM_12x10, [moving, rightWallCorner], [], 132)!;

    expect(preview.candidate).toBeNull();
    expect(preview.ghostCandidate).toMatchObject({ x: 126, y: 0 });
    expect(hasCollision(preview.ghostCandidate!, [rightWallCorner])).toBe(true);
  });

  it("snaps B-12 to the physical edge of a perpendicular corner cabinet when released within three inches", () => {
    const moving = cabinet("corner-seam-b12", 60, 0, 12);
    const rightWallCorner = cabinet("right-wall-seam", 120, 0, 36, 90);
    const preview = cabinetWallDragPreview(moving, ROOM_12x10, [moving, rightWallCorner], [], 112)!;

    expect(preview.snapped).toBe(true);
    expect(preview.candidate).toMatchObject({ x: 108, y: 0 });
    expect(rightWallCorner.x - (preview.candidate!.x + placedFootprint(preview.candidate!).w)).toBe(0);
    expect(hasCollision(preview.candidate!, [rightWallCorner])).toBe(false);
  });

  it("keeps LS3612 off an invalid middle-of-wall drag and snaps it only to a valid room corner", () => {
    const moving = cabinet("moving-ls3612", 0, 0, 36);
    moving.masterCode = "LS3612";
    moving.description = "36 inch Lazy Susan Corner Base";
    moving.depth = 36;
    moving.cornerType = "lazy-susan";

    const middle = cabinetWallDragPreview(moving, ROOM_12x10, [moving], [], 72)!;
    expect(middle.candidate).toBeNull();

    const topRight = cabinetWallDragPreview(moving, ROOM_12x10, [moving], [], 126)!;
    expect(topRight.snapped).toBe(true);
    expect(topRight.candidate).toMatchObject({ x: 108, y: 0, rotation: 90, width: 36, depth: 36 });
    expect(hasCollision(topRight.candidate!, [])).toBe(false);
  });

  it("moves an AW wall-end cabinet along the selected wall without rotating or snapping it to a room corner", () => {
    const moving = cabinet("moving-aw1230", 0, 0, 12);
    moving.masterCode = "AW1230";
    moving.description = '12" × 30" × 12" Angled Wall End Cabinet';
    moving.placement = "wall";
    moving.depth = 12;
    moving.height = 30;
    moving.wallId = "top";
    moving.wallOffset = 0;

    const preview = cabinetWallDragPreview(moving, ROOM_12x10, [moving], [], 72)!;
    expect(preview.candidate).toMatchObject({ x: 66, y: 0, rotation: 0, wallId: "top" });
    expect(preview.fit).toMatchObject({ snapStart: 66, snapEnd: 78, status: "valid" });
  });

  it("rejects a true corner-cabinet snap when the destination corner is occupied", () => {
    const moving = cabinet("moving-corner-occupied", 0, 0, 36);
    moving.masterCode = "LS3612";
    moving.description = "36 inch Lazy Susan Corner Base";
    moving.depth = 36;
    moving.cornerType = "lazy-susan";
    const blocker = cabinet("occupied-top-right", 108, 0, 24);

    const preview = cabinetWallDragPreview(moving, ROOM_12x10, [moving, blocker], [], 126)!;
    expect(preview.candidate).toBeNull();
    expect(preview.ghostCandidate).toMatchObject({ x: 108, y: 0, rotation: 90 });
    expect(hasCollision(preview.ghostCandidate!, [blocker])).toBe(true);
  });

  it("right-drags a tall refrigerator end panel as a physical wall-run object", () => {
    const panel: PlacedCabinet = {
      ...cabinet("end-panel", 30, 0, 0.75),
      masterCode: "REPV-96",
      description: "Refrigerator End Panel",
      placement: "tall",
      customProfile: "refrigerator-end-panel",
      depth: 27,
      height: 96,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    const preview = cabinetWallDragPreview(panel, ROOM_12x10, [panel], [], 48)!;

    expect(isWallRunDraggable(panel, ROOM_12x10)).toBe(true);
    expect(preview?.candidate).toMatchObject({ x: 47.625, y: 0, placement: "tall" });
  });

  it("snaps a top-wall B-15 to exact contact with the next base and leaves zero gap and zero overlap", () => {
    const moving = cabinet("moving-15", 92, 0, 15);
    const neighbor = cabinet("neighbor-35", 109, 0, 35);
    const preview = cabinetWallDragPreview(moving, ROOM_12x10, [moving, neighbor], [], 101)!;

    expect(preview.wall).toBe("top");
    expect(preview.fit).toMatchObject({ snapStart: 94, snapEnd: 109, before: 94, after: 0, status: "valid" });
    expect(preview.candidate).toMatchObject({ x: 94, y: 0 });
    expect(hasCollision(preview.candidate!, [neighbor])).toBe(false);
    expect(neighbor.x - (preview.candidate!.x + placedFootprint(preview.candidate!).w)).toBe(0);
  });

  it("uses the vertical wall run axis and rejects an opening that is truly too small", () => {
    const room: RoomData = { width: 144, depth: 145 };
    const moving = cabinet("moving-right-15", 120, 92, 15, 90);
    const neighbor = cabinet("neighbor-right-36", 120, 109, 36, 90);
    const valid = cabinetWallDragPreview(moving, room, [moving, neighbor], [], 102.5)!;
    expect(valid.wall).toBe("right");
    expect(valid.candidate).toMatchObject({ x: 120, y: 94 });
    expect(neighbor.y - (valid.candidate!.y + placedFootprint(valid.candidate!).d)).toBe(0);

    const blocker = cabinet("blocker-right-12", 120, 12, 36, 90);
    const invalid = cabinetWallDragPreview(moving, room, [moving, blocker], [], 6)!;
    expect(invalid.fit).toMatchObject({ availableSpan: 12, requiredSpan: 15, shortage: 3, status: "invalid" });
    expect(invalid.candidate).toBeNull();
  });

  it("moves a floor range on the base run and seats it exactly against the next cabinet", () => {
    const range: PlacedCabinet = {
      uid: "range-30",
      cabinetId: 9001,
      masterCode: "RANGE-30",
      description: "30 inch Range",
      placement: "appliance",
      x: 0,
      y: 0,
      width: 30,
      depth: 25,
      height: 36,
      mountBottom: 0,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    const neighbor = cabinet("neighbor-15", 60, 0, 15);
    const preview = cabinetWallDragPreview(range, ROOM_12x10, [range, neighbor], [], 45)!;

    expect(isWallRunDraggable(range, ROOM_12x10)).toBe(true);
    expect(preview.fit).toMatchObject({ snapStart: 30, snapEnd: 60, after: 0, status: "valid" });
    expect(preview.candidate).toMatchObject({ uid: "range-30", masterCode: "RANGE-30", placement: "appliance", x: 30, y: 0 });
    expect(hasCollision(preview.candidate!, [neighbor])).toBe(false);
    expect(neighbor.x - (preview.candidate!.x + placedFootprint(preview.candidate!).w)).toBe(0);
  });

  it("moves a rotated range on the right-wall run and keeps exact edge contact on the vertical axis", () => {
    const room: RoomData = { width: 144, depth: 145 };
    const range: PlacedCabinet = {
      uid: "range-right-30",
      cabinetId: 9003,
      masterCode: "RANGE-30",
      description: "30 inch Range",
      placement: "appliance",
      x: 119,
      y: 0,
      width: 30,
      depth: 25,
      height: 36,
      mountBottom: 0,
      rotation: 90,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    const neighbor = cabinet("right-neighbor-15", 120, 60, 15, 90);
    const preview = cabinetWallDragPreview(range, room, [range, neighbor], [], 45)!;

    expect(preview.wall).toBe("right");
    expect(preview.fit).toMatchObject({ snapStart: 30, snapEnd: 60, after: 0, status: "valid" });
    expect(preview.candidate).toMatchObject({ x: 119, y: 30, rotation: 90, placement: "appliance" });
    expect(neighbor.y - (preview.candidate!.y + placedFootprint(preview.candidate!).d)).toBe(0);
  });

  it("keeps a range on its selected peninsula face instead of crossing to a nearer exterior wall", () => {
    const room: RoomData = {
      width: 144,
      depth: 120,
      peninsulaRuns: [{
        id: "range-peninsula",
        parentWall: "top",
        startOffset: 30,
        turn: 90,
        direction: "right",
        length: 84,
        height: 34.5,
        cabinetSide: "right",
      }],
    };
    const seated = wallPlacementAt(36, 30, 25, "range-peninsula" as any, room, "right");
    const range: PlacedCabinet = {
      uid: "range-on-peninsula", cabinetId: 9004, masterCode: "RANGE-30", description: "30 inch Range",
      placement: "appliance", x: seated.x, y: seated.y, width: 30, depth: 25, height: 36,
      mountBottom: 0, rotation: seated.rotation, wallId: seated.wallId, wallOffset: seated.wallOffset,
      peninsulaSide: seated.peninsulaSide, numberOfDoors: 0, numberOfDrawers: 0,
    };

    // This body is still within the 18½-inch (range half-depth + magnet) reach
    // of the peninsula but is seven inches closer to the left exterior wall.
    // The old resolver ignored the peninsula and therefore crossed the wall.
    const preview = cabinetWallMovePreview(
      { ...range, x: -0.75, y: 36 },
      { x: -0.75, y: 36 },
      room,
      [],
      [],
      { magnet: true },
    );

    expect(preview.failure).toBeNull();
    expect(preview.wall).toBe("range-peninsula");
    expect(preview.candidate).toMatchObject({
      wallId: "range-peninsula",
      peninsulaSide: "right",
      rotation: seated.rotation,
      x: seated.x,
      y: seated.y,
    });
  });

  it("allows floor appliances and mounted range hoods while excluding unrelated raised appliances from wall-run dragging", () => {
    const appliance = (uid: string, masterCode: string, width: number, depth: number, height: number, mountBottom: number): PlacedCabinet => ({
      uid,
      cabinetId: 9100 + width,
      masterCode,
      description: masterCode,
      placement: "appliance",
      x: 0,
      y: 0,
      width,
      depth,
      height,
      mountBottom,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    });

    expect(isWallRunDraggable(appliance("fridge", "FRIDGE-36", 36, 30, 70, 0), ROOM_12x10)).toBe(true);
    expect(isWallRunDraggable(appliance("dishwasher", "DW-24", 24, 24, 34.5, 0), ROOM_12x10)).toBe(true);
    expect(isWallRunDraggable(appliance("hood", "HOOD-30", 30, 18, 18, 66), ROOM_12x10)).toBe(true);
  });

  it("right-drags a mounted range hood through the wall layer while preserving its 66-inch elevation", () => {
    const hood: PlacedCabinet = {
      uid: "hood",
      cabinetId: 9201,
      masterCode: "HOOD-30",
      description: "30 inch Range Hood",
      placement: "appliance",
      x: 30,
      y: 0,
      width: 30,
      depth: 18,
      height: 18,
      mountBottom: 66,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    const leftWall: PlacedCabinet = {
      ...hood,
      uid: "left-wall",
      cabinetId: 9202,
      masterCode: "W-30-30",
      description: "30 inch Wall Cabinet",
      placement: "wall",
      x: 0,
      depth: 12,
      height: 30,
      mountBottom: 54,
      numberOfDoors: 2,
    };
    const preview = cabinetWallDragPreview(hood, ROOM_12x10, [leftWall, hood], [], 45)!;

    expect(preview.wall).toBe("top");
    expect(preview.fit).toMatchObject({ snapStart: 30, snapEnd: 60, before: 0, status: "valid" });
    expect(preview.candidate).toMatchObject({ x: 30, y: 0, mountBottom: 66, placement: "appliance" });
    expect(preview.ghostCandidate).toMatchObject({ x: 30, y: 0, mountBottom: 66 });
  });

  it("keeps an invalid range-hood snap as a measured ghost target without committing a candidate", () => {
    const hood: PlacedCabinet = {
      uid: "hood-invalid",
      cabinetId: 9211,
      masterCode: "HOOD-30",
      description: "30 inch Range Hood",
      placement: "appliance",
      x: 30,
      y: 0,
      width: 30,
      depth: 18,
      height: 18,
      mountBottom: 66,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    const leftWall = { ...hood, uid: "left-wall-62", cabinetId: 9212, masterCode: "W-62-30", placement: "wall" as const, x: 0, width: 62, depth: 12, height: 30, mountBottom: 54, numberOfDoors: 2 };
    const rightWall = { ...leftWall, uid: "right-wall-62", cabinetId: 9213, x: 82 };
    const preview = cabinetWallDragPreview(hood, ROOM_12x10, [leftWall, rightWall, hood], [], 72)!;

    expect(preview.fit).toMatchObject({ status: "invalid", availableSpan: 20, requiredSpan: 30, shortage: 10 });
    expect(preview.candidate).toBeNull();
    expect(preview.ghostCandidate).toMatchObject({ x: 57, y: 0, mountBottom: 66 });
  });

  it("does not right-drag a raised over-range microwave through the floor appliance path", () => {
    const microwave: PlacedCabinet = {
      uid: "microwave",
      cabinetId: 9002,
      masterCode: "MW-30",
      description: "Over the Range Microwave",
      placement: "appliance",
      x: 30,
      y: 0,
      width: 30,
      depth: 15,
      height: 17,
      mountBottom: 54,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };

    expect(isWallRunDraggable(microwave, ROOM_12x10)).toBe(false);
    expect(cabinetWallDragPreview(microwave, ROOM_12x10, [microwave], [], 45)).toBeNull();
  });
});

describe("bulk cabinet door hardware", () => {
  const cabinet = (uid: string, numberOfDoors: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet => ({
    uid,
    cabinetId: Number(uid.replace(/\D/g, "")) || 1,
    masterCode: `B-${uid}`,
    description: "Base Cabinet",
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    depth: 24,
    height: 34.5,
    rotation: 0,
    numberOfDoors,
    numberOfDrawers: 0,
    styleId: 330001,
    discountPct: -5,
    ...extra,
  });

  it("applies one door position to eligible cabinets without changing drawers, appliances, panels, open units, or unrelated attributes", () => {
    const doubleDoor = cabinet("1", 2);
    const singleDoor = cabinet("2", 1);
    const drawerOnly = cabinet("3", 0, { masterCode: "DB-24-3", description: "Three Drawer Base", numberOfDrawers: 3 });
    const appliance = cabinet("4", 0, { placement: "appliance", masterCode: "DW-24", description: "Dishwasher" });
    const panel = cabinet("5", 0, { placement: "tall", masterCode: "REPV-96", description: "Refrigerator End Panel" });
    const open = cabinet("6", 1, { noDoor: true });
    const placed = [doubleDoor, singleDoor, drawerOnly, appliance, panel, open];

    expect(cabinetHardwarePositionPatch("right")).toEqual({ hardwarePosition: "right", handleSide: "right" });
    expect(cabinetHardwarePositionPatch("center")).toEqual({ hardwarePosition: null, handleSide: null });
    expect(placed.map((item) => isCabinetDoorHardwareEligible(item, "right"))).toEqual([true, true, false, false, false, false]);

    const updated = applyCabinetDoorHardwareToAll(placed, "right");
    expect(updated[0]).toMatchObject({ hardwarePosition: "right", handleSide: "right", styleId: 330001, discountPct: -5 });
    expect(updated[1]).toMatchObject({ hardwarePosition: "right", handleSide: "right", styleId: 330001, discountPct: -5 });
    expect(updated.slice(2)).toEqual(placed.slice(2));
  });

  it("limits Paired doors to two-door fronts while Automatic remains available to all eligible doors", () => {
    const doubleDoor = cabinet("7", 2, { hardwarePosition: "left", handleSide: "left" });
    const singleDoor = cabinet("8", 1, { hardwarePosition: "right", handleSide: "right" });
    const paired = applyCabinetDoorHardwareToAll([doubleDoor, singleDoor], "paired");
    expect(paired[0]).toMatchObject({ hardwarePosition: "paired", handleSide: null });
    expect(paired[1]).toBe(singleDoor);

    const automatic = applyCabinetDoorHardwareToAll(paired, "auto");
    expect(automatic).toEqual([
      expect.objectContaining({ hardwarePosition: null, handleSide: null }),
      expect.objectContaining({ hardwarePosition: null, handleSide: null }),
    ]);
  });
});

describe("universal cooking-surface geometry", () => {
  it("keeps every range and cooktop burner surface at the 36-inch finished countertop line", () => {
    expect(STD.RANGE_COOKING_SURFACE_HEIGHT).toBe(36);
    expect(STD.RANGE_COOKING_SURFACE_HEIGHT).toBe(STD.BASE_HEIGHT + STD.COUNTERTOP_THICKNESS);
  });
});

describe("persisted 2D entity parity", () => {
  it("keeps every non-cabinet visible 2D entity with the saved room", () => {
    const saved = roomWithPersistedEntities(ROOM_12x10, {
      openings: [{ uid: "window", kind: "window", side: "top", offset: 24, width: 36, height: 30, sillHeight: 36 }],
      sinks: [{ uid: "sink", type: "single", x: 24, y: 0, width: 33, depth: 22, faucet: true }],
      island: { x: 48, y: 48, width: 60, depth: 30, countertopOverhang: 3.125 },
      furniture: [],
      ponyWalls: [],
    });
    expect(saved.persistedEntities).toMatchObject({
      openings: [{ uid: "window", offset: 24, width: 36 }],
      sinks: [{ uid: "sink", faucet: true, width: 33 }],
      island: { x: 48, y: 48, width: 60, depth: 30, countertopOverhang: 3.125 },
    });
  });

  it("retains a pot filler only on its associated range wall, never a sink or island", () => {
    const range = {
      uid: "range", cabinetId: 1, masterCode: "RANGE-30", description: "30 inch Range",
      placement: "appliance", x: 36, y: 0, width: 30, depth: 24, height: 36, rotation: 0, wallId: "top",
    } as PlacedCabinet;
    const fixture = {
      uid: "pf", rangeUid: "range", mountingWallId: "top", pelicanProductId: 790,
      pelicanCode: "PL-8369-BG", pelicanProductName: "Fountain Series Kitchen Pot Filler - Brushed Gold",
      pelicanProfileId: "pelican-pl-8369-bg-fountain-wall-pot-filler", finish: "brushed-gold",
      mountHeightAboveCooktopIn: 24, spoutReachIn: 24, overallSpanIn: 26.1875,
      armDatumIn: 13, fixtureHeightIn: 3.15625, outletDatumIn: 1.875,
      maximumFlowGpmAt60Psi: 2.2, installation: "wall-mounted-in-wall-cold-water",
      requiresProjectSpecificMountHeight: true,
    } as const;
    expect(potFillerMountedRange(fixture, [range], ROOM_12x10)?.uid).toBe("range");
    expect(potFillerMountedRange({ ...fixture, mountingWallId: "bottom" }, [range], ROOM_12x10)).toBeNull();
    expect(potFillerMountedRange(fixture, [{ ...range, masterCode: "SB-36", description: "Sink Base" }], ROOM_12x10)).toBeNull();
    expect(potFillerMountedRange(fixture, [{ ...range, wallId: undefined }], ROOM_12x10)).toBeNull();
    expect(potFillerMountedRange(fixture, [{ ...range, islandFace: "front" }], ROOM_12x10, { x: 24, y: 0, width: 72, depth: 36 })).toBeNull();
  });
});

describe("saved design style restoration", () => {
  it("restores database-style field names when legacy client aliases are absent", () => {
    expect(restoredSavedDesignStyle({ selectedStyleId: 330001, selectedDistributorId: 210001 }))
      .toEqual({ styleId: 330001, distributorId: 210001 });
  });

  it("clears a stale cabinet finish from another distributor so it inherits the selected plan style and price source", () => {
    const cabinet = { uid: "foreign-style", styleId: 330003 };
    const distributors = new Map([[330003, 210001], [390019, 180001]]);
    expect(clearForeignSavedStyleOverrides([cabinet], 180001, distributors)).toEqual([{ uid: "foreign-style", styleId: null }]);
    expect(clearForeignSavedStyleOverrides([{ uid: "two-tone", styleId: 390019 }], 180001, distributors))
      .toEqual([{ uid: "two-tone", styleId: 390019 }]);
  });

  it("prices a stale foreign override at the active plan style before saved-plan normalization completes", () => {
    const distributors = new Map([[330003, 210001], [390019, 180001], [390020, 180001]]);
    expect(pricingStyleId({ styleId: 330003 }, 390019, 180001, distributors)).toBe(390019);
    expect(pricingStyleId({ styleId: 390020 }, 390019, 180001, distributors)).toBe(390020);
    expect(pricingStyleId({ styleId: 777777 }, 390019, 180001, distributors)).toBe(777777);
  });
});

function cab(partial: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "u",
    cabinetId: 1,
    masterCode: "B-24",
    description: "Base 24",
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    depth: 24,
    rotation: 0,
    ...partial,
  };
}

describe("base end-return shared 2D geometry", () => {
  it("keeps canonical BEC-24 and legacy BA-24 as 24-by-24 floor end returns", () => {
    for (const masterCode of ["BEC-24", "BA-24"]) {
      const endReturn = cab({
        masterCode,
        description: '24" Base End Cabinet',
        placement: "base",
        width: 24,
        depth: 24,
        height: 34.5,
        customProfile: "base_end_return",
      });
      expect(placedCornerGeometryKind(endReturn)).toBe("base-end");
      expect(placedFootprint(endReturn)).toEqual({ w: 24, d: 24 });
      expect(elevationBox(endReturn, ROOM_12x10)).toMatchObject({ bottom: 0, height: 34.5 });
    }
  });
});

describe("refrigerator surround enclosure", () => {
  it("shares one 96-inch cap between a 72-inch refrigerator cabinet and its floor-to-cap side panels", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
    const enclosure = refrigeratorSurroundElevation(room, 70, 24);

    expect(enclosure).toEqual({ mountBottom: 72, top: 96 });
    expect(enclosure.top).toBe(96);
  });

  it("holds the same 72-inch refrigerator upper datum under a taller ceiling", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 120 };
    expect(refrigeratorSurroundElevation(room, 70, 24)).toEqual({ mountBottom: 72, top: 96 });
  });
});

describe("per-wall ceiling (flat + sloped)", () => {
  it("falls back to the room default when a wall has no override", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
    expect(wallCeiling(room, "top")).toEqual({ high: 108, low: 108 });
    expect(wallCeilingIsSloped(room, "top")).toBe(false);
    expect(wallCeilingMin(room, "top")).toBe(108);
  });

  it("uses a flat per-wall override", () => {
    const room: RoomData = {
      width: 144, depth: 120, ceilingHeight: 96,
      wallCeilings: { left: { high: 120, low: 120 } },
    };
    expect(wallCeiling(room, "left")).toMatchObject({ high: 120, low: 120 });
    expect(wallCeilingMin(room, "left")).toBe(120);
    // other walls still track the default
    expect(wallCeilingMin(room, "right")).toBe(96);
  });

	  it("allows W-36-24 to move above the global 96-inch cap when its actual right wall is 108 inches high", () => {
	    const room: RoomData = {
	      width: 144, depth: 120, ceilingHeight: 96,
	      wallCeilings: { right: { high: 108, low: 108 } },
	    };
	    const w3624 = cab({ uid: "right-w3624", masterCode: "W-36-24", placement: "wall", x: 132, y: 48, width: 36, depth: 12, height: 24, rotation: 90, mountBottom: 72 });
	    expect(wallCabinetVerticalMoveLimit(w3624, room)).toMatchObject({ side: "right", ceiling: 108, maxBottom: 84 });
	  });

	  it("uses the lowest ceiling across the cabinet footprint on a sloped wall", () => {
	    const room: RoomData = {
	      width: 120, depth: 120, ceilingHeight: 96,
	      wallCeilings: { top: { high: 120, low: 96, slopeFrom: "start" } },
	    };
	    const w3624 = cab({ uid: "slope-w3624", masterCode: "W-36-24", placement: "wall", x: 0, y: 0, width: 36, depth: 12, height: 24, mountBottom: 72 });
	    expect(wallCabinetVerticalMoveLimit(w3624, room)).toMatchObject({ side: "top", ceiling: 112.8, maxBottom: 88.8 });
	  });

	  it("repairs the reported one-inch W-36-24 and W-21-42 seam before an upward move creates vertical overlap", () => {
	    const room: RoomData = { width: 144, depth: 127, ceilingHeight: 108 };
	    const left = cab({ uid: "repair-left", masterCode: "W-36-42", placement: "wall", x: 132, y: 24, width: 36, depth: 12, height: 42, rotation: 90, mountBottom: 54 });
	    const right = cab({ uid: "repair-right", masterCode: "W-21-42", placement: "wall", x: 132, y: 96, width: 21, depth: 12, height: 42, rotation: 90, mountBottom: 54 });
	    const moving = cab({ uid: "repair-moving", masterCode: "W-36-24", placement: "wall", x: 132, y: 61, width: 36, depth: 12, height: 24, rotation: 90, mountBottom: 72.25 });

	    const repaired = repairWallCabinetPlanSeamForVerticalMove(moving, room, [left, right], []);
	    expect(repaired).toMatchObject({ x: 132, y: 60, rotation: 90, mountBottom: 72.25 });
	    expect(hasCollision(repaired!, [left, right])).toBe(false);
	  });

	  it("does not move a wall cabinet across the run when the nearest valid seam repair exceeds three inches", () => {
	    const room: RoomData = { width: 144, depth: 127, ceilingHeight: 108 };
	    const blocker = cab({ uid: "far-blocker", masterCode: "W-21-42", placement: "wall", x: 132, y: 96, width: 21, depth: 12, height: 42, rotation: 90, mountBottom: 54 });
	    const moving = cab({ uid: "far-moving", masterCode: "W-36-24", placement: "wall", x: 132, y: 64, width: 36, depth: 12, height: 24, rotation: 90, mountBottom: 72.25 });
	    expect(repairWallCabinetPlanSeamForVerticalMove(moving, room, [blocker], [])).toBeNull();
	  });

  it("normalizes a sloped override so high >= low", () => {
    const room: RoomData = {
      width: 144, depth: 120, ceilingHeight: 96,
      wallCeilings: { top: { high: 90, low: 120, slopeFrom: "start" } },
    };
    const wc = wallCeiling(room, "top");
    expect(wc.high).toBe(120);
    expect(wc.low).toBe(90);
    expect(wallCeilingIsSloped(room, "top")).toBe(true);
    expect(wallCeilingMin(room, "top")).toBe(90);
  });

  it("interpolates height along a sloped wall (high at start)", () => {
    const room: RoomData = {
      width: 120, depth: 120, ceilingHeight: 96,
      wallCeilings: { top: { high: 120, low: 96, slopeFrom: "start" } },
    };
    expect(wallCeilingAt(room, "top", 0)).toBeCloseTo(120); // high end (left)
    expect(wallCeilingAt(room, "top", 1)).toBeCloseTo(96); // low end (right)
    expect(wallCeilingAt(room, "top", 0.5)).toBeCloseTo(108); // midpoint
  });

  it("interpolates height along a sloped wall (high at end)", () => {
    const room: RoomData = {
      width: 120, depth: 120, ceilingHeight: 96,
      wallCeilings: { top: { high: 120, low: 96, slopeFrom: "end" } },
    };
    expect(wallCeilingAt(room, "top", 0)).toBeCloseTo(96); // low end (left)
    expect(wallCeilingAt(room, "top", 1)).toBeCloseTo(120); // high end (right)
  });

  it("clamps ceiling heights into the allowed range", () => {
    expect(clampCeilingHeight(40)).toBe(84); // below MIN
    expect(clampCeilingHeight(999)).toBe(144); // above MAX
    expect(clampCeilingHeight(100.4)).toBe(100); // rounds
    expect(clampCeilingHeight(undefined)).toBe(DEFAULT_CEILING_HEIGHT);
  });

  it("flags a tall cabinet that exceeds a low sloped wall via ceilingFitViolations", () => {
    // Back wall slopes down to 84" on its low side; a 90" tall pantry on that
    // wall should be flagged.
    const room: RoomData = {
      width: 144, depth: 120, ceilingHeight: 108,
      wallCeilings: { top: { high: 108, low: 84, slopeFrom: "start" } },
    };
    const tall = cab({ uid: "t1", placement: "tall", x: 0, y: 0, width: 24, depth: 24, height: 90 });
    const bad = ceilingFitViolations([tall], room);
    expect(bad.has("t1")).toBe(true);
  });

  it("does NOT flag a tall cabinet that fits under the wall's low point", () => {
    const room: RoomData = {
      width: 144, depth: 120, ceilingHeight: 108,
      wallCeilings: { top: { high: 108, low: 96, slopeFrom: "start" } },
    };
    const tall = cab({ uid: "t2", placement: "tall", x: 0, y: 0, width: 24, depth: 24, height: 90 });
    const bad = ceilingFitViolations([tall], room);
    expect(bad.has("t2")).toBe(false);
  });
});

describe("placedFootprint — honors real depth, never lets a real cabinet vanish", () => {
  it("keeps a genuinely shallow 12-inch base at 12 inches (e.g. spice pull-out)", () => {
    const p = cab({ masterCode: "SPB-9", description: '9" Spice Pull-Out Base', width: 12, depth: 12 });
    expect(placedFootprint(p).d).toBe(12);
  });

  it("keeps a 21-inch vanity base at 21 inches", () => {
    const p = cab({ masterCode: "VA-30", description: '30" Vanity Sink Base', width: 30, depth: 21 });
    expect(placedFootprint(p).d).toBe(21);
  });

  it("keeps a standard 24-inch base at 24 inches", () => {
    const p = cab({ masterCode: "B-24", description: '24" Base', width: 24, depth: 24 });
    expect(placedFootprint(p).d).toBe(24);
  });

  it("floors a garbage 0.75-inch base depth to a visible minimum so it cannot disappear", () => {
    const p = cab({ masterCode: "BS-24-35", description: '24" Base Cabinet with Shelf', width: 24, depth: 0.75 });
    expect(placedFootprint(p).d).toBeGreaterThanOrEqual(6);
  });

  it("floors a zero width/depth so a real cabinet always has a visible footprint", () => {
    const p = cab({ masterCode: "B-24", description: '24" Base', width: 0, depth: 0 });
    const fp = placedFootprint(p);
    expect(fp.w).toBeGreaterThanOrEqual(6);
    expect(fp.d).toBeGreaterThanOrEqual(6);
  });

  it("does NOT inflate intentionally-thin flat stock (end panel stays slim)", () => {
    const p = cab({ masterCode: "BEP", description: "Base End Panel", subCategory: "End Panel", width: 24, depth: 0.75 });
    expect(placedFootprint(p).d).toBeCloseTo(0.75, 2);
  });

  it("respects rotation while still flooring the visible size", () => {
    const p = cab({ masterCode: "B-24", description: '24" Base', width: 24, depth: 24, rotation: 90 });
    const fp = placedFootprint(p);
    expect(fp.w).toBeGreaterThanOrEqual(6);
    expect(fp.d).toBeGreaterThanOrEqual(6);
  });
});

describe("corner cabinet detection", () => {
  it("detects corner cabinets by master-code prefix", () => {
    expect(isCornerCabinet("BBC-36")).toBe(true); // blind corner base
    expect(isCornerCabinet("WBC-24-30")).toBe(true); // wall blind corner
    expect(isCornerCabinet("LSB36")).toBe(true); // lazy susan
    expect(isCornerCabinet("BEC-24")).toBe(false); // base END cabinet, NOT a corner
    expect(isCornerCabinet("ERB-33")).toBe(true); // easy reach corner base
    expect(isCornerCabinet("BER-36")).toBe(true); // Skyline easy reach corner base alias
    expect(isCornerCabinet("BES-12")).toBe(false); // base end shelf is NOT a corner
    expect(isCornerCabinet("CSB-36")).toBe(true); // corner sink base
  });

  it("detects corner cabinets by description when code is generic", () => {
    expect(isCornerCabinet("X-99", "36in Lazy Susan corner")).toBe(true);
    expect(isCornerCabinet("X-99", "Easy Reach corner base")).toBe(true);
  });

  it("does not flag ordinary cabinets as corners", () => {
    expect(isCornerCabinet("B-24", "Base 24 inch")).toBe(false);
    expect(isCornerCabinet("SB-36", "Sink Base 36")).toBe(false);
    expect(isCornerCabinet("W-30-30", "Wall 30x30")).toBe(false);
  });
});

describe("angled wall cabinets are NOT corner cabinets (palette tab routing)", () => {
  it("flags AW-* angled wall cabinets", () => {
    for (const code of ["AW1230", "AW1236", "AW1242", "AW-12-30", "AW-12-36", "AW-12-42"]) {
      expect(isAngledWallCabinet(code, "Angled Wall End Cabinet")).toBe(true);
      expect(isCornerCabinet(code, "Angled Wall End Cabinet")).toBe(false);
    }
    expect(isAngledWallCabinet("X-9", "24in Angled Wall unit")).toBe(true);
    expect(isCornerCabinet("X-9", "12in Angled Wall End Cabinet")).toBe(false);
  });
  it("does NOT flag true corner / diagonal / other cabinets as angled wall", () => {
    expect(isAngledWallCabinet("DCW-24-30", "Diagonal Corner Wall")).toBe(false);
    expect(isAngledWallCabinet("RHC-06-30", "Range Hood Corner Cabinet")).toBe(false);
    expect(isAngledWallCabinet("OE-6-30", "Wall Open End Shelf")).toBe(false);
    expect(isAngledWallCabinet("W-30-30", "Wall 30x30")).toBe(false);
    expect(isAngledWallCabinet("BES-12", "Base End Shelf")).toBe(false);
  });
  it("an angled wall cabinet is still drawn diagonally (rendering unchanged)", () => {
    // Routing to the Wall tab must NOT change its canvas footprint.
    expect(isDiagonalCorner("AW-12-30", "12x30 Angled Wall End Cabinet")).toBe(false);
  });

  it("does not force AW aliases into protected room-corner placement or movement locks", () => {
    for (const masterCode of ["AW1230", "AW1236", "AW1242", "AW-12-30", "AW-12-36", "AW-12-42"]) {
      expect(isProtectedCornerCabinet(masterCode, '12" Angled Wall End Cabinet')).toBe(false);
      expect(requiresRoomCornerPlacement({ masterCode, description: '12" Angled Wall End Cabinet', placement: "wall" })).toBe(false);
    }
    expect(isProtectedCornerCabinet("WDC2430", "Wall Diagonal Corner Cabinet")).toBe(true);
    expect(requiresRoomCornerPlacement({ masterCode: "WDC2430", description: "Wall Diagonal Corner Cabinet", placement: "wall" })).toBe(true);
    expect(requiresRoomCornerPlacement({ masterCode: "BBC42", description: "Blind Corner Base Cabinet", placement: "base" })).toBe(false);
  });
});

describe("corner clip path", () => {
  it("produces a 6-point L-shaped polygon for every rotation", () => {
    for (const rot of [0, 90, 180, 270]) {
      const path = cornerClipPath(rot);
      expect(path.startsWith("polygon(")).toBe(true);
      // An L-shape has 6 vertices.
      const points = path.replace(/polygon\(|\)/g, "").split(",");
      expect(points).toHaveLength(6);
    }
  });

  it("normalizes out-of-range rotation", () => {
    expect(cornerClipPath(360)).toBe(cornerClipPath(0));
    expect(cornerClipPath(-90)).toBe(cornerClipPath(270));
  });
});

describe("appliances", () => {
  it("defines the core kitchen appliances", () => {
    const codes = APPLIANCES.map((a) => a.masterCode);
    expect(codes).toContain("RANGE-30");
    expect(codes).toContain("FRIDGE-30");
    expect(codes).toContain("FRIDGE-36");
    expect(codes).toContain("DW-24");
    expect(codes).toContain("SINK-33");
    expect(codes).toContain("HOOD-30");
  });

  it("offers both a 30in and a 36in refrigerator, each 30in deep", () => {
    const f30 = APPLIANCES.find((a) => a.masterCode === "FRIDGE-30")!;
    const f36 = APPLIANCES.find((a) => a.masterCode === "FRIDGE-36")!;
    expect(f30.width).toBe(30);
    expect(f36.width).toBe(36);
    expect(f30.depth).toBe(30);
    expect(f36.depth).toBe(30);
  });

  it("detects appliance + fixture master codes", () => {
    expect(isApplianceCode("RANGE-30")).toBe(true);
    expect(isApplianceCode("FRIDGE-36")).toBe(true);
    expect(isApplianceCode("FIX-WASHER-27")).toBe(true);
    expect(isApplianceCode("FIX-TOILET")).toBe(true);
    expect(isApplianceCode("B-24")).toBe(false);
  });

  it("filters appliances/fixtures by room type", () => {
    const kitchen = appliancesForRoom("kitchen").map((a) => a.masterCode);
    expect(kitchen).toContain("RANGE-30");
    expect(kitchen).toContain("FRIDGE-30");
    expect(kitchen).not.toContain("FIX-TOILET");

    const bath = appliancesForRoom("bathroom").map((a) => a.masterCode);
    expect(bath).toContain("FIX-SHOWER-36");
    expect(bath).toContain("FIX-TUB-60");
    expect(bath).toContain("FIX-TOILET");
    expect(bath).not.toContain("RANGE-30");

    const laundry = appliancesForRoom("laundry").map((a) => a.masterCode);
    expect(laundry).toContain("FIX-WASHER-27");
    expect(laundry).toContain("FIX-DRYER-27");
    expect(laundry).toContain("FIX-LAUNDRYTUB-25");

    // Closet and Other have no fixtures of their own.
    expect(appliancesForRoom("closet")).toHaveLength(0);
    expect(appliancesForRoom("other")).toHaveLength(0);
  });

  it("exposes five room types", () => {
    expect(ROOM_TYPES.map((r) => r.value)).toEqual([
      "kitchen", "bathroom", "laundry", "closet", "other",
    ]);
  });

  it("gives bath/laundry fixtures a usable elevation box", () => {
    for (const code of ["FIX-SHOWER-36", "FIX-TUB-60", "FIX-WASHER-27"]) {
      const fx: PlacedCabinet = cab({ masterCode: code, placement: "appliance", cabinetId: 0 });
      const box = elevationBox(fx);
      expect(box.height).toBeGreaterThan(0);
    }
  });

  it("converts an appliance to a placeable design cabinet with id 0", () => {
    const range = APPLIANCES.find((a) => a.key === "range-black-gas")!;
    const dc = applianceAsDesignCabinet(range);
    expect(dc.id).toBe(0); // unpriced
    expect(dc.placement).toBe("appliance");
    expect(dc.masterCode).toBe("RANGE-30");
  });

  it("gives appliances their own elevation box", () => {
    const hood: PlacedCabinet = cab({ masterCode: "HOOD-30", placement: "appliance", cabinetId: 0 });
    const box = elevationBox(hood);
    expect(box.bottom).toBeGreaterThan(0); // hood is mounted high
  });
});

describe("distance + formatting helpers", () => {
  it("measures center-to-center distance in inches", () => {
    const a = cab({ x: 0, y: 0, width: 24, depth: 24 }); // center 12,12
    const b = cab({ x: 36, y: 0, width: 24, depth: 24 }); // center 48,12
    expect(Math.round(centerDistance(a, b))).toBe(36);
  });

  it("accounts for rotation when measuring", () => {
    const a = cab({ x: 0, y: 0, width: 24, depth: 12, rotation: 0 }); // center 12,6
    const b = cab({ x: 0, y: 24, width: 24, depth: 12, rotation: 0 }); // center 12,30
    expect(Math.round(centerDistance(a, b))).toBe(24);
  });

  it("formats inches as feet and inches", () => {
    expect(formatInches(11)).toBe('11"');
    expect(formatInches(12)).toBe("1'");
    expect(formatInches(30)).toBe(`2' 6"`);
  });
});

describe("wall openings (doors & windows)", () => {
  const room = { width: 120, depth: 96 };

  it("wallLength returns width for top/bottom and depth for left/right", () => {
    expect(wallLength("top", room)).toBe(120);
    expect(wallLength("bottom", room)).toBe(120);
    expect(wallLength("left", room)).toBe(96);
    expect(wallLength("right", room)).toBe(96);
  });

  it("centers a new opening on its wall", () => {
    const def = OPENINGS.find((o) => o.key === "entry-door")!;
    const o = makeOpening(def, "bottom", room);
    expect(o.kind).toBe("door");
    expect(o.width).toBe(36);
    // centered: (120 - 36) / 2 = 42
    expect(o.offset).toBe(42);
  });

  it("creates the dedicated over-sink window at 36 by 48 inches and a 42-inch sill", () => {
    const def = OPENINGS.find((o) => o.key === "window-over-sink")!;
    const o = makeOpening(def, "top", { width: 144, depth: 120, ceilingHeight: 96 });
    expect(o).toMatchObject({ kind: "window", width: 36, height: 48, sill: 42 });
  });

  it("clamps offset so the opening stays within the wall", () => {
    const def = OPENINGS.find((o) => o.key === "window-std")!;
    const o = makeOpening(def, "top", room);
    const pushed = clampOpening({ ...o, offset: 1000 }, room);
    expect(pushed.offset).toBeLessThanOrEqual(room.width - pushed.width);
    expect(pushed.offset).toBeGreaterThanOrEqual(0);
  });

  it("clamps width so it never exceeds the wall length", () => {
    const def = OPENINGS.find((o) => o.key === "patio-door")!;
    const o = makeOpening(def, "left", room);
    const wide = clampOpening({ ...o, width: 500 }, room);
    expect(wide.width).toBeLessThanOrEqual(wallLength("left", room));
  });

  it("keeps a custom width within bounds and re-clamps offset to fit (resize editor path)", () => {
    const def = OPENINGS.find((o) => o.key === "window-std")!;
    const o = makeOpening(def, "top", room); // centered 36" window on a 120" wall
    // User types a wider 84" width: width is accepted (<= wall) and the offset
    // is pulled back so left+width still fits inside the wall.
    const resized = clampOpening({ ...o, width: 84 }, room);
    expect(resized.width).toBe(84);
    expect(resized.offset).toBeLessThanOrEqual(room.width - resized.width);
    expect(resized.offset).toBeGreaterThanOrEqual(0);
  });

  it("floors opening width at the 6in minimum", () => {
    const def = OPENINGS.find((o) => o.key === "interior-door")!;
    const o = makeOpening(def, "top", room);
    const tiny = clampOpening({ ...o, width: 1 }, room);
    expect(tiny.width).toBe(6);
  });

  it("windows have a non-zero sill height; doors sit on the floor", () => {
    const win = OPENINGS.find((o) => o.kind === "window")!;
    const door = OPENINGS.find((o) => o.kind === "door")!;
    expect(win.sill).toBeGreaterThan(0);
    expect(door.sill).toBe(0);
  });
});

describe("cased openings (pass-through / doorway, no door)", () => {
  const room: RoomData = { width: 120, depth: 96 };

  it("OPENINGS includes at least one cased 'opening' kind with floor-level sill", () => {
    const cased = OPENINGS.filter((o) => o.kind === "opening");
    expect(cased.length).toBeGreaterThanOrEqual(1);
    const floorCased = cased.find((o) => o.sill === 0);
    expect(floorCased).toBeTruthy();
    // a cased opening is a full-height pass-through: tall and reasonably wide
    expect(floorCased!.height).toBeGreaterThanOrEqual(78);
    expect(floorCased!.width).toBeGreaterThanOrEqual(30);
  });

  it("makeOpening preserves the 'opening' kind and its dimensions", () => {
    const def = OPENINGS.find((o) => o.kind === "opening" && o.sill === 0)!;
    const o = makeOpening(def, "bottom", room);
    expect(o.kind).toBe("opening");
    expect(o.height).toBe(def.height);
    expect(o.sill).toBe(0);
  });

  it("blocksFloorRun: doors and cased openings block the floor run, windows do not", () => {
    expect(blocksFloorRun("door")).toBe(true);
    expect(blocksFloorRun("opening")).toBe(true);
    expect(blocksFloorRun("window")).toBe(false);
  });

  it("flags a base cabinet that crosses a cased opening on the same wall", () => {
    // Base cabinet on the bottom wall, run-axis [40, 64].
    const base = cab({ placement: "base", x: 40, y: room.depth - 24, width: 24, depth: 24 });
    const opening: WallOpening = {
      uid: "op1", kind: "opening", side: "bottom", offset: 50, width: 48, height: 80, sill: 0, label: "Cased Opening",
    };
    const bad = baseOpeningOverlaps([base], [opening], room);
    expect(bad.has(base.uid)).toBe(true);
  });

  it("does NOT flag a wall cabinet hung above a cased opening", () => {
    const wall = cab({ uid: "w1", placement: "wall", x: 50, y: room.depth - 12, width: 24, depth: 12 });
    const opening: WallOpening = {
      uid: "op2", kind: "opening", side: "bottom", offset: 50, width: 48, height: 80, sill: 0, label: "Cased Opening",
    };
    const bad = baseOpeningOverlaps([wall], [opening], room);
    expect(bad.has("w1")).toBe(false);
  });

  it("does NOT flag a base cabinet sitting under a window (windows don't block the floor)", () => {
    const base = cab({ uid: "b1", placement: "base", x: 40, y: room.depth - 24, width: 24, depth: 24 });
    const win: WallOpening = {
      uid: "win1", kind: "window", side: "bottom", offset: 40, width: 36, height: 36, sill: 42, label: "Window",
    };
    const bad = baseOpeningOverlaps([base], [win], room);
    expect(bad.has("b1")).toBe(false);
  });

  it("does NOT flag a base cabinet clear of the opening (no run-axis overlap)", () => {
    const base = cab({ uid: "b2", placement: "base", x: 0, y: room.depth - 24, width: 24, depth: 24 });
    const opening: WallOpening = {
      uid: "op3", kind: "opening", side: "bottom", offset: 60, width: 48, height: 80, sill: 0, label: "Cased Opening",
    };
    const bad = baseOpeningOverlaps([base], [opening], room);
    expect(bad.has("b2")).toBe(false);
  });
});

import {
  finishColors, DEFAULT_FINISH_COLORS,
  crownLinearInches, toeKickLinearInches, lightRailLinearInches, lightRailTakeoff, inchesToLinearFeet,
  battenLinearInches, BATTEN_WIDTH_IN, BATTEN_THICKNESS_IN,
} from "./design";

describe("finishColors", () => {
  it("maps white-family styles to a light face", () => {
    expect(finishColors("Arctic White Shaker").face.toLowerCase()).toBe("#f3f1ec");
  });
  it("maps navy styles to a blue face with light label", () => {
    const f = finishColors("Ocean Navy");
    expect(f.face.toLowerCase()).toBe("#3b4d63");
    expect(f.label.toLowerCase()).toBe("#f8fafc");
  });
  it("maps grey styles to a grey face", () => {
    expect(finishColors("Pewter Grey").face.toLowerCase()).toBe("#9aa0a6");
  });
  it("derives the finish from the paint color even when the brand name is abstract", () => {
    // "Aero Obsidian" brand word isn't a color, but its paint color is black.
    expect(finishColors("Aero Obsidian", "SW 6258 Tricorn Black").face.toLowerCase()).toBe("#2f2f2f");
  });
  it("returns a deterministic, non-default color for unmatched names", () => {
    const a = finishColors("Zorptacular");
    const b = finishColors("Zorptacular");
    // Stable across calls for the same input.
    expect(a).toEqual(b);
    // Always a valid hex face.
    expect(a.face).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it("gives two different unmatched names a chance to differ (no global collapse)", () => {
    // Not a strict guarantee for every pair, but these two hash to different buckets.
    const a = finishColors("Quibblefoo");
    const b = finishColors("Wozzlebkdj");
    expect(a.face === b.face && a.edge === b.edge).toBe(false);
  });
  it("handles null/empty input safely (returns the default finish)", () => {
    expect(finishColors(null)).toEqual(DEFAULT_FINISH_COLORS);
    expect(finishColors("")).toEqual(DEFAULT_FINISH_COLORS);
  });
});

describe("trim linear footage", () => {
  it("crown sums only wall cabinet widths", () => {
    const placed = [
      cab({ placement: "wall", width: 30 }),
      cab({ placement: "wall", width: 24 }),
      cab({ placement: "base", width: 36 }),
      cab({ placement: "appliance", width: 30, cabinetId: 0 }),
    ];
    // 30 + 24 = 54 run, + 3in miter allowance = 57.
    expect(crownLinearInches(placed)).toBe(57);
  });
  it("toe kick sums base and tall widths, not wall or appliance", () => {
    const placed = [
      cab({ placement: "base", width: 36 }),
      cab({ placement: "tall", width: 24 }),
      cab({ placement: "wall", width: 30 }),
    ];
    expect(toeKickLinearInches(placed)).toBe(60);
  });
  it("converts inches to linear feet rounded up to 0.1", () => {
    expect(inchesToLinearFeet(54)).toBe(4.5);
    expect(inchesToLinearFeet(13)).toBeCloseTo(1.1, 5);
  });
  it("counts catalog width, not the rotated plan AABB, for crown", () => {
    const placed = [cab({ placement: "wall", width: 30, depth: 12, rotation: 90 })];
    // catalog width 30 + 3in miter allowance = 33.
    expect(crownLinearInches(placed)).toBe(33);
  });
  it("takes a standalone W1230 from its front and two exposed depth returns plus four inches", () => {
    const placed = [cab({ uid: "w1230", placement: "wall", masterCode: "W1230", description: "12 inch by 30 inch wall cabinet", width: 12, depth: 12, x: 36, y: 0, height: 30 })];
    // 12" front + 12" left return + 12" right return + 4" installation allowance.
    expect(lightRailLinearInches(placed, ROOM_12x10)).toBe(40);
    expect(lightRailTakeoff(placed, ROOM_12x10)).toEqual({
      exposedLinearInches: 36,
      installationAllowanceInches: 4,
      totalLinearInches: 40,
      assemblies: 1,
    });
    expect(trimPiecesNeeded(lightRailLinearInches(placed, ROOM_12x10)).measuredFeet).toBe(3.3);
  });
  it("counts a continuous adjacent upper run without double-counting its shared side", () => {
    const placed = [
      cab({ uid: "w12-left", placement: "wall", width: 12, depth: 12, x: 36, y: 0, height: 30 }),
      cab({ uid: "w12-right", placement: "wall", width: 12, depth: 12, x: 48, y: 0, height: 30 }),
      cab({ uid: "tall", placement: "tall", width: 24, x: 80, y: 0 }),
      cab({ uid: "base", placement: "base", width: 36, x: 0, y: 0 }),
    ];
    // 24" front + two exposed 12" returns + one 4" continuous-run allowance.
    expect(lightRailLinearInches(placed, ROOM_12x10)).toBe(52);
  });
  it("adds the installation allowance once for each disconnected light-rail assembly", () => {
    const placed = [
      cab({ uid: "left-w12", placement: "wall", width: 12, depth: 12, x: 24, y: 0, height: 30 }),
      cab({ uid: "right-w12", placement: "wall", width: 12, depth: 12, x: 60, y: 0, height: 30 }),
    ];
    // Two standalone 36" exposed perimeters + two 4" installation allowances.
    expect(lightRailTakeoff(placed, ROOM_12x10)).toMatchObject({
      exposedLinearInches: 72,
      installationAllowanceInches: 8,
      totalLinearInches: 80,
      assemblies: 2,
    });
  });
  it("excludes island and floor-seated wall cabinets from light rail", () => {
    const placed = [
      cab({ uid: "island-wall", placement: "wall", width: 30, depth: 12, x: 36, y: 36, islandFace: "front", mountBottom: 4.5 }),
      cab({ uid: "floor-wall", placement: "wall", width: 30, depth: 12, x: 72, y: 0, mountBottom: 4.5 }),
    ];
    expect(lightRailLinearInches(placed, ROOM_12x10)).toBe(0);
  });
  it("light rail is zero when there are no wall cabinets", () => {
    const placed = [cab({ placement: "base", width: 36 }), cab({ placement: "tall", width: 24 })];
    expect(lightRailLinearInches(placed)).toBe(0);
  });
});

import { isBlindCorner, blindCornerFillers, BLIND_CORNER_FILLER_WIDTH_IN } from "./design";

describe("blind corner fillers", () => {
  it("detects blind corner base/wall codes", () => {
    expect(isBlindCorner("BBC-36")).toBe(true);
    expect(isBlindCorner("WBC-24-30")).toBe(true);
    expect(isBlindCorner("BBL-42")).toBe(true);
    expect(isBlindCorner("W-30-30")).toBe(false);
    expect(isBlindCorner("B-24")).toBe(false);
  });

  it("detects blind corner by description", () => {
    expect(isBlindCorner("X-1", "36in Blind Corner Base")).toBe(true);
    expect(isBlindCorner("X-2", "Lazy Susan Corner")).toBe(false);
  });

  it("adds one base filler per blind base corner", () => {
    const f = blindCornerFillers([cab({ masterCode: "BBC-36", placement: "base" }), cab({ masterCode: "B-24", placement: "base" })]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: "base", count: 1, width: BLIND_CORNER_FILLER_WIDTH_IN });
  });

  it("splits base and wall blind-corner fillers", () => {
    const f = blindCornerFillers([
      cab({ masterCode: "BBC-36", placement: "base" }),
      cab({ masterCode: "WBC-24-30", placement: "wall" }),
      cab({ masterCode: "WBC-24-30", placement: "wall" }),
    ]);
    expect(f.find((x) => x.kind === "base")?.count).toBe(1);
    expect(f.find((x) => x.kind === "wall")?.count).toBe(2);
  });

  it("returns no fillers when there are no blind corners", () => {
    expect(blindCornerFillers([cab({ masterCode: "B-24", placement: "base" }), cab({ masterCode: "W-30-30", placement: "wall" })])).toHaveLength(0);
  });
});

describe("snapToWall — explicit wall placement", () => {
  const room = { width: 144, depth: 120 };

  it("snaps to the top wall (y=0) keeping x", () => {
    const r = snapToWall(cab({ x: 40, y: 60, width: 24, depth: 24 }), "top", room);
    expect(r.y).toBe(0);
    expect(r.x).toBe(40);
  });

  it("snaps to the bottom wall flush against the far edge", () => {
    const r = snapToWall(cab({ x: 40, y: 10, width: 24, depth: 24 }), "bottom", room);
    expect(r.y).toBe(120 - 24);
  });

  it("snaps to the left wall (x=0)", () => {
    const r = snapToWall(cab({ x: 80, y: 30, width: 24, depth: 24 }), "left", room);
    expect(r.x).toBe(0);
  });

  it("snaps to the right wall flush against the far edge", () => {
    const r = snapToWall(cab({ x: 10, y: 30, width: 24, depth: 24 }), "right", room);
    expect(r.x).toBe(144 - 24);
  });

  it("respects rotation when computing the flush position", () => {
    // rotated 90° => footprint w/d swap (width 36 becomes depth)
    const r = snapToWall(cab({ x: 0, y: 0, width: 36, depth: 12, rotation: 90 }), "right", room);
    // rotated width is the original depth (12), so flush right is 144-12
    expect(r.x).toBe(144 - 12);
  });

  it("keeps the cabinet inside the room when its along-wall pos is out of range", () => {
    const r = snapToWall(cab({ x: 200, y: 30, width: 24, depth: 24 }), "top", room);
    expect(r.x).toBe(144 - 24);
    expect(r.y).toBe(0);
  });
});

describe("orientToWall (auto-rotate to face the room)", () => {
  const room: RoomData = { width: 144, depth: 120 };

  it("turns a wrongly-rotated cabinet to 0 at the top wall", () => {
    // A cabinet currently at 90 (vertical) dragged flush to the top wall should
    // become 0 so its back is to the back wall.
    const p = cab({ x: 40, y: 0, width: 24, depth: 24, rotation: 90 });
    expect(orientToWall(p, room)).toBe(0);
  });

  it("turns a wrongly-rotated cabinet to 90 at the left wall", () => {
    const p = cab({ x: 0, y: 40, width: 24, depth: 24, rotation: 0 });
    expect(orientToWall(p, room)).toBe(90);
  });

  it("turns to 90 at the right wall", () => {
    // 24x24 box flush to the right wall (x so right edge ~= room width).
    const p = cab({ x: 144 - 24, y: 40, width: 24, depth: 24, rotation: 0 });
    expect(orientToWall(p, room)).toBe(90);
  });

  it("returns null when already correctly oriented for that wall", () => {
    const p = cab({ x: 40, y: 0, width: 24, depth: 24, rotation: 0 });
    expect(orientToWall(p, room)).toBeNull();
  });

  it("returns null when the cabinet is out in the middle of the room", () => {
    const p = cab({ x: 60, y: 50, width: 24, depth: 24, rotation: 0 });
    expect(orientToWall(p, room)).toBeNull();
  });
});

describe("room dimension helpers", () => {
  it("converts feet + inches to total inches", () => {
    expect(feetInchesToInches(10, 0)).toBe(120);
    expect(feetInchesToInches(10, 6)).toBe(126);
    expect(feetInchesToInches(12, 0)).toBe(144);
  });

  it("converts inches back to feet + inches", () => {
    expect(inchesToFeetInches(120)).toEqual({ feet: 10, inches: 0 });
    expect(inchesToFeetInches(126)).toEqual({ feet: 10, inches: 6 });
  });

  it("clamps to the allowed kitchen range", () => {
    expect(clampRoomInches(10)).toBe(ROOM_MIN_IN);
    expect(clampRoomInches(9999)).toBe(ROOM_MAX_IN);
    expect(clampRoomInches(144)).toBe(144);
  });

  it("clamps when converting feet/inches out of range", () => {
    expect(feetInchesToInches(0, 1)).toBe(ROOM_MIN_IN); // too small -> min
    expect(feetInchesToInches(99, 0)).toBe(ROOM_MAX_IN); // too big -> max
  });
});


describe("active-wall placement", () => {
  const room = { width: 144, depth: 120 };

  it("places first item flush to the back (top) wall at the start corner", () => {
    const spot = nextFreeSpotOnWall(24, 24, "base", "top", room, []);
    expect(spot).toMatchObject({ x: 0, y: 0, rotation: 0 });
  });

  it("places first item flush to the front (bottom) wall", () => {
    const spot = nextFreeSpotOnWall(24, 24, "base", "bottom", room, []);
    expect(spot.y).toBe(room.depth - 24); // 96
    expect(spot.x).toBe(0);
    expect(spot.rotation).toBe(0);
  });

  it("rotates items 90deg on the left/right walls so depth faces into the room", () => {
    const left = nextFreeSpotOnWall(24, 24, "base", "left", room, []);
    expect(left).toMatchObject({ x: 0, y: 0, rotation: 90 });
    const right = nextFreeSpotOnWall(30, 24, "base", "right", room, []);
    // 30 wide cabinet rotated -> 24 deep faces into room from the right wall
    expect(right.x).toBe(room.width - 24); // 120
    expect(right.rotation).toBe(90);
  });

  it("marches subsequent items along the wall, packing flush", () => {
    const first: PlacedCabinet = cab({ uid: "a", x: 0, y: 0, width: 24, depth: 24 });
    const spot = nextFreeSpotOnWall(30, 24, "base", "top", room, [first]);
    expect(spot.x).toBe(24); // packed right after the 24" cabinet
    expect(spot.y).toBe(0);
  });

  it("ignores items on other walls when packing", () => {
    const onFront: PlacedCabinet = cab({ uid: "f", x: 0, y: 96, width: 24, depth: 24 });
    const spot = nextFreeSpotOnWall(24, 24, "base", "top", room, [onFront]);
    expect(spot.x).toBe(0); // back wall is empty
  });

  it("clamps to the wall end when the wall is full", () => {
    const wide: PlacedCabinet = cab({ uid: "w", x: 0, y: 0, width: 140, depth: 24 });
    const spot = nextFreeSpotOnWall(24, 24, "base", "top", room, [wide]);
    // 140 + 24 > 144 -> clamp to wallLen - width = 120
    expect(spot.x).toBe(room.width - 24);
  });

  it("exposes friendly wall labels", () => {
    expect(WALL_LABELS.top).toBe("Back");
    expect(WALL_LABELS.bottom).toBe("Front");
    expect(WALL_LABELS.left).toBe("Left");
    expect(WALL_LABELS.right).toBe("Right");
  });
});

describe("in-bounds clamping after resize", () => {
  it("pulls a cabinet back inside a shrunken room", () => {
    const p = cab({ x: 130, y: 110, width: 24, depth: 24 });
    const clamped = clampCabinetToRoom(p, { width: 120, depth: 100 });
    expect(clamped.x).toBe(120 - 24); // 96
    expect(clamped.y).toBe(100 - 24); // 76
  });

  it("leaves an in-bounds cabinet unchanged (same reference)", () => {
    const p = cab({ x: 10, y: 10, width: 24, depth: 24 });
    const clamped = clampCabinetToRoom(p, { width: 144, depth: 120 });
    expect(clamped).toBe(p);
  });

  it("accounts for rotation when clamping", () => {
    // 36 wide x 24 deep, rotated 90 -> occupies 24 wide x 36 deep
    const p = cab({ x: 130, y: 110, width: 36, depth: 24, rotation: 90 });
    const clamped = clampCabinetToRoom(p, { width: 120, depth: 100 });
    expect(clamped.x).toBe(120 - 24); // 96
    expect(clamped.y).toBe(100 - 36); // 64
  });

  it("clamps a list of cabinets", () => {
    const out = clampCabinetsToRoom(
      [cab({ uid: "a", x: 200, y: 0 }), cab({ uid: "b", x: 0, y: 200 })],
      { width: 100, depth: 100 }
    );
    expect(out[0].x).toBe(100 - 24);
    expect(out[1].y).toBe(100 - 24);
  });

  it("clamps the island zone inside the room", () => {
    const island = clampIslandToRoom({ x: 90, y: 90, width: 60, depth: 40 }, { width: 120, depth: 100 });
    expect(island).not.toBeNull();
    expect(island!.width).toBeLessThanOrEqual(120);
    expect(island!.x + island!.width).toBeLessThanOrEqual(120);
    expect(island!.y + island!.depth).toBeLessThanOrEqual(100);
  });

  it("returns null for a null island", () => {
    expect(clampIslandToRoom(null, { width: 120, depth: 100 })).toBeNull();
  });
});


describe("resize room by dragging a wall", () => {
  const room = { width: 144, depth: 120 };

  it("grows width when dragging the right wall outward", () => {
    expect(resizeRoomByWall(room, "right", 24).width).toBe(168);
    expect(resizeRoomByWall(room, "right", 24).depth).toBe(120);
  });

  it("shrinks width when dragging the right wall inward", () => {
    expect(resizeRoomByWall(room, "right", -24).width).toBe(120);
  });

  it("grows width when dragging the left wall outward (negative delta)", () => {
    expect(resizeRoomByWall(room, "left", -24).width).toBe(168);
  });

  it("changes depth for the front (bottom) wall", () => {
    expect(resizeRoomByWall(room, "bottom", 12).depth).toBe(132);
    expect(resizeRoomByWall(room, "bottom", 12).width).toBe(144);
  });

  it("changes depth for the back (top) wall (negative delta grows)", () => {
    expect(resizeRoomByWall(room, "top", -12).depth).toBe(132);
  });

  it("clamps to the sane room range", () => {
    expect(resizeRoomByWall(room, "right", 9999).width).toBe(ROOM_MAX_IN);
    expect(resizeRoomByWall(room, "right", -9999).width).toBe(ROOM_MIN_IN);
  });
});


describe("trim: crown miter allowance per wall", () => {
  it("adds the 3in miter allowance once per wall run", () => {
    // Two wall cabinets on the back wall (top): 30 + 30 = 60, +3 = 63.
    const a = cab({ placement: "wall", width: 30, depth: 12, x: 0, y: 0, rotation: 0 });
    const b = cab({ placement: "wall", width: 30, depth: 12, x: 30, y: 0, rotation: 0 });
    expect(crownLinearInches([a, b], ROOM_12x10)).toBe(63);
  });

  it("a 12in wall run needs a 15in cut", () => {
    const a = cab({ placement: "wall", width: 12, depth: 12, x: 0, y: 0, rotation: 0 });
    expect(crownLinearInches([a], ROOM_12x10)).toBe(15);
  });

  it("adds the allowance separately for cabinets on different walls", () => {
    // back wall: 30 along the wall (+3) = 33.
    // right wall: the 30-inch catalog width runs along the wall (30 + 3).
    // Combined with back wall 30 + 3, total = 66.
    const back = cab({ placement: "wall", width: 30, depth: 12, x: 0, y: 0, rotation: 0 });
    const right = cab({ placement: "wall", width: 30, depth: 12, x: 144 - 12, y: 40, rotation: 90 });
    expect(crownLinearInches([back, right], ROOM_12x10)).toBe(66);
  });

  it("returns 0 with no wall cabinets", () => {
    const base = cab({ placement: "base", width: 24, depth: 24 });
    expect(crownLinearInches([base], ROOM_12x10)).toBe(0);
  });

  it("MITER_ALLOWANCE_IN is 3", () => {
    expect(MITER_ALLOWANCE_IN).toBe(3);
  });
});

describe("trim: toe kick is continuous (no miter allowance)", () => {
  it("sums base + tall widths with no extra", () => {
    const a = cab({ placement: "base", width: 24, depth: 24 });
    const b = cab({ placement: "tall", width: 24, depth: 24 });
    expect(toeKickLinearInches([a, b])).toBe(48);
  });
});

describe("trim: batten molding (BAM) covers cabinet seams", () => {
  it("counts one seam between two flush base cabinets (base height 34.5)", () => {
    const a = cab({ placement: "base", width: 24, depth: 24, x: 0, y: 0 });
    const b = cab({ placement: "base", width: 24, depth: 24, x: 24, y: 0 });
    expect(battenLinearInches([a, b], ROOM_12x10)).toBe(34.5);
  });

  it("counts two seams across three flush cabinets", () => {
    const a = cab({ placement: "base", width: 24, depth: 24, x: 0, y: 0 });
    const b = cab({ placement: "base", width: 24, depth: 24, x: 24, y: 0 });
    const c = cab({ placement: "base", width: 24, depth: 24, x: 48, y: 0 });
    expect(battenLinearInches([a, b, c], ROOM_12x10)).toBe(69);
  });

  it("ignores cabinets that are not edge-to-edge (gap > tolerance)", () => {
    const a = cab({ placement: "base", width: 24, depth: 24, x: 0, y: 0 });
    const b = cab({ placement: "base", width: 24, depth: 24, x: 30, y: 0 });
    expect(battenLinearInches([a, b], ROOM_12x10)).toBe(0);
  });

  it("returns 0 for a single cabinet", () => {
    const a = cab({ placement: "base", width: 24, depth: 24, x: 0, y: 0 });
    expect(battenLinearInches([a], ROOM_12x10)).toBe(0);
  });

  it("batten profile is 3/4in x 3/16in", () => {
    expect(BATTEN_WIDTH_IN).toBe(0.75);
    expect(BATTEN_THICKNESS_IN).toBe(0.1875);
  });
});

describe("cabinetWall inference", () => {
  it("detects the wall a flush cabinet sits on", () => {
    const top = cab({ placement: "wall", width: 30, depth: 12, x: 10, y: 0, rotation: 0 });
    expect(cabinetWall(top, ROOM_12x10)).toBe("top");
    const right = cab({ placement: "wall", width: 30, depth: 12, x: 144 - 12, y: 40, rotation: 90 });
    expect(cabinetWall(right, ROOM_12x10)).toBe("right");
  });

  // Corner cabinets are flush against TWO walls at once. Orientation must decide
  // which wall (elevation) they belong to, so a vertically-oriented range in a
  // corner is NOT mis-drawn on the Front (bottom) elevation. Regression guard
  // for the reported bug where left-wall cabinets appeared on the Front view.
  it("assigns a vertical cabinet in the bottom-left corner to the LEFT wall (not bottom)", () => {
    // rotation 90 => vertical; rotatedSize => w:24 (into room), d:30 (along wall)
    // Seated in the bottom-left corner: flush to left (x=0) AND bottom (y+d=depth).
    const range = cab({ placement: "base", width: 30, depth: 24, x: 0, y: 120 - 30, rotation: 90 });
    expect(cabinetWall(range, ROOM_12x10)).toBe("left");
  });

  it("assigns a horizontal cabinet in the bottom-left corner to the BOTTOM wall", () => {
    // rotation 0 => horizontal; flush to bottom (y+depth=depth) AND left (x=0).
    const base = cab({ placement: "base", width: 30, depth: 24, x: 0, y: 120 - 24, rotation: 0 });
    expect(cabinetWall(base, ROOM_12x10)).toBe("bottom");
  });

  it("assigns a vertical cabinet in the top-right corner to the RIGHT wall", () => {
    // rotation 270 => vertical; flush to right (x+w=width) AND top (y=0).
    const wallCab = cab({ placement: "wall", width: 30, depth: 12, x: 144 - 12, y: 0, rotation: 270 });
    expect(cabinetWall(wallCab, ROOM_12x10)).toBe("right");
  });

  it("assigns a horizontal cabinet in the top-right corner to the TOP wall", () => {
    const wallCab = cab({ placement: "wall", width: 30, depth: 12, x: 144 - 30, y: 0, rotation: 0 });
    expect(cabinetWall(wallCab, ROOM_12x10)).toBe("top");
  });

  it("assigns a vertical cabinet in the bottom-right corner to the RIGHT wall (not bottom)", () => {
    const range = cab({ placement: "base", width: 30, depth: 24, x: 144 - 24, y: 120 - 30, rotation: 90 });
    expect(cabinetWall(range, ROOM_12x10)).toBe("right");
  });
});

describe("trimPiecesNeeded (stick rounding)", () => {
  it("rounds a 63in run up to one 8ft stick", () => {
    const t = trimPiecesNeeded(63);
    expect(t.pieces).toBe(1);
    expect(t.orderedFeet).toBe(8);
  });

  it("rounds just over one stick (with waste) up to two sticks", () => {
    // 90in * 1.1 = 99in > 96 -> 2 sticks
    const t = trimPiecesNeeded(90);
    expect(t.pieces).toBe(2);
    expect(t.orderedFeet).toBe(16);
  });

  it("returns 0 pieces for an empty run", () => {
    expect(trimPiecesNeeded(0).pieces).toBe(0);
  });
});

describe("countertopArea", () => {
  it("measures base run x standard depth", () => {
    const a = cab({ placement: "base", width: 36, depth: 24 });
    const b = cab({ placement: "base", width: 36, depth: 24 });
    const m = countertopArea([a, b]);
    expect(m.runInches).toBe(72);
    expect(m.linearFeet).toBe(6);
    // 72 * 25.5 / 144 = 12.75 -> ceil to 0.1 = 12.8
    expect(m.squareFeet).toBeCloseTo(12.8, 1);
	    expect(m.perimeterSquareFeet).toBeCloseTo(12.8, 1);
	    expect(m.islandSquareFeet).toBe(0);
    expect(m.hasIsland).toBe(false);
  });

  it("uses a 22.5-inch finished countertop over a source 21-inch bathroom vanity", () => {
    const vanity = cab({
      masterCode: "VSD42",
      description: '42" Vanity Combo',
      category: "Vanity",
      placement: "base",
      width: 42,
      depth: 21,
      x: 0,
      y: 0,
    });
    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
    const [surface] = countertopSurfaces([vanity], room);

    expect(surface).toMatchObject({ x: 0, y: 0, width: 42, depth: 22.5, supportWallId: "top" });
    // 42 × 22.5 ÷ 144 = 6.5625, rounded up to the Designer's 0.1 sq ft.
    expect(countertopArea([vanity])).toMatchObject({ runInches: 42, squareFeet: 6.6, perimeterSquareFeet: 6.6 });
  });

  it("keeps a standard 24-inch kitchen base on its existing 25.5-inch countertop rule", () => {
    const kitchenBase = cab({ masterCode: "B36", description: '36" Base Cabinet', placement: "base", width: 36, depth: 24 });
    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
    expect(countertopSurfaces([kitchenBase], room)[0]).toMatchObject({ depth: 25.5 });
    expect(countertopArea([kitchenBase]).squareFeet).toBe(6.4);
  });

  it("ignores wall and tall cabinets", () => {
    const wall = cab({ placement: "wall", width: 30, depth: 12 });
    const tall = cab({ placement: "tall", width: 24, depth: 24 });
    expect(countertopArea([wall, tall]).runInches).toBe(0);
  });

	  it("adds one automatic island slab over real island cabinets", () => {
	    const island = { x: 50, y: 40, width: 48, depth: 24 };
	    const base = cab({ placement: "base", width: 36, depth: 24, x: 50, y: 40, islandFace: "back", islandOffset: 0 });
	    const m = countertopArea([base], island);
	    expect(m.hasIsland).toBe(true);
	    expect(m.squareFeet).toBeCloseTo(7.4, 1);
	  });

	  it("uses exact rendered island slab dimensions for countertop square footage", () => {
	    const island = { x: 50, y: 40, width: 48, depth: 24, countertopOverhang: 3 };
	    const base = cab({ placement: "base", width: 36, depth: 24, x: 50, y: 40, islandFace: "back", islandOffset: 0 });
	    const m = countertopArea([base], island, [{ width: 42, depth: 30 }]);
	    expect(m.hasIsland).toBe(true);
	    expect(m.squareFeet).toBe(8.8);
	    expect(m.perimeterSquareFeet).toBe(0);
	    expect(m.islandSquareFeet).toBe(8.8);
	  });

	  it("reports wall-run and island countertop areas independently while preserving the combined total", () => {
	    const island = { x: 50, y: 40, width: 48, depth: 24 };
	    const wallBase = cab({ placement: "base", width: 36, depth: 24, x: 0, y: 0 });
	    const islandBase = cab({ placement: "base", width: 36, depth: 24, x: 50, y: 40, islandFace: "back", islandOffset: 0 });
	    const m = countertopArea([wallBase, islandBase], island, [{ width: 42, depth: 30 }]);
	    expect(m.perimeterSquareFeet).toBeCloseTo(6.4, 1);
	    expect(m.islandSquareFeet).toBe(8.8);
	    expect(m.squareFeet).toBeCloseTo(15.2, 1);
	  });

  it("COUNTERTOP_DEPTH_IN is 25.5", () => {
    expect(COUNTERTOP_DEPTH_IN).toBe(25.5);
  });
});


describe("doorPanelKind", () => {
  it("maps door-style families to the correct panel treatment", () => {
    expect(doorPanelKind("Shaker")).toBe("shaker");
    expect(doorPanelKind("Slim Shaker")).toBe("slim-shaker");
    expect(doorPanelKind("Narrow Shaker")).toBe("slim-shaker");
    expect(doorPanelKind("Slim-Frame Shaker")).toBe("slim-shaker");
    expect(doorPanelKind("Double Shaker")).toBe("double-shaker");
    expect(doorPanelKind("Raised Panel")).toBe("raised");
    expect(doorPanelKind("Cathedral Arch")).toBe("raised");
    expect(doorPanelKind("Slab")).toBe("slab");
    expect(doorPanelKind("Contemporary")).toBe("slab");
    expect(doorPanelKind("Euro Flat")).toBe("slab");
    expect(doorPanelKind("Beaded")).toBe("beaded");
    expect(doorPanelKind("Inset")).toBe("inset");
  });

  it("defaults to shaker for unknown or empty styles", () => {
    expect(doorPanelKind(null)).toBe("shaker");
    expect(doorPanelKind(undefined)).toBe("shaker");
    expect(doorPanelKind("Mystery Style")).toBe("shaker");
  });

  it("prioritizes 'double' over plain shaker", () => {
    expect(doorPanelKind("Double Slim Shaker")).toBe("double-shaker");
  });
});


import { addOnRecommendations, baseCabinetCount, wallCabinetCount, exposedSideCount } from "./design";

describe("add-on recommendations (don't forget this)", () => {
  it("counts base cabinets only", () => {
    const placed = [
      cab({ uid: "a", placement: "base" }),
      cab({ uid: "b", placement: "base" }),
      cab({ uid: "c", placement: "wall" }),
      cab({ uid: "d", placement: "tall" }),
    ];
    expect(baseCabinetCount(placed)).toBe(2);
  });

  it("always recommends the touch-up kit first, even with no cabinets", () => {
    const recs = addOnRecommendations([]);
    expect(recs.length).toBe(1);
    expect(recs[0].kind).toBe("touch-up-kit");
    expect(recs[0].suggestCode).toBe("TUK");
    expect(recs[0].always).toBe(true);
  });

  it("adds a roll-out tray recommendation once base cabinets are placed", () => {
    const recs = addOnRecommendations([cab({ placement: "base" })]);
    const kinds = recs.map((r) => r.kind);
    expect(kinds).toContain("touch-up-kit");
    expect(kinds).toContain("roll-out-tray");
    // touch-up kit stays first in display order.
    expect(recs[0].kind).toBe("touch-up-kit");
  });

  it("does NOT recommend roll-out trays when only wall/tall cabinets are placed", () => {
    const recs = addOnRecommendations([
      cab({ placement: "wall" }),
      cab({ placement: "tall" }),
    ]);
    expect(recs.map((r) => r.kind)).not.toContain("roll-out-tray");
  });

  it("recommends an end panel once any base/wall/tall cabinet is placed", () => {
    expect(addOnRecommendations([]).map((r) => r.kind)).not.toContain("end-panel");
    const recs = addOnRecommendations([cab({ placement: "base" })]);
    const ep = recs.find((r) => r.kind === "end-panel");
    expect(ep).toBeTruthy();
    expect(ep!.suggestCode).toBe("BDEP");
  });

  it("recommends crown molding only when wall cabinets are present", () => {
    expect(addOnRecommendations([cab({ placement: "base" })]).map((r) => r.kind)).not.toContain(
      "crown-molding",
    );
    const recs = addOnRecommendations([cab({ placement: "wall" })]);
    const crown = recs.find((r) => r.kind === "crown-molding");
    expect(crown).toBeTruthy();
    expect(crown!.suggestCode).toBe("CM-8");
  });

  it("counts wall cabinets and exposed sides correctly", () => {
    const placed = [
      cab({ uid: "a", placement: "base" }),
      cab({ uid: "b", placement: "wall" }),
      cab({ uid: "c", placement: "tall" }),
    ];
    expect(wallCabinetCount(placed)).toBe(1);
    expect(exposedSideCount(placed)).toBe(3);
  });
});


describe("wallSpanMeasure (live drag tape, both sides)", () => {
  const room: RoomData = { width: 144, depth: 120 };

  it("measures to the walls on both sides when alone on the back wall", () => {
    // 24" cabinet placed 59" from the left, on the top (back) wall.
    const c = cab({ uid: "m", x: 59, y: 0, width: 24, depth: 24 });
    const m = wallSpanMeasure(c, room, [c], "top");
    expect(Math.round(m.before)).toBe(59); // left wall -> cabinet
    expect(Math.round(m.after)).toBe(144 - 59 - 24); // cabinet -> right wall = 61
    expect(m.beforeIsCabinet).toBe(false);
    expect(m.afterIsCabinet).toBe(false);
  });

  it("measures to a neighbor cabinet on the side where one exists", () => {
    const neighbor = cab({ uid: "n", x: 0, y: 0, width: 30, depth: 24 }); // ends at 30
    const moving = cab({ uid: "m", x: 50, y: 0, width: 24, depth: 24 }); // starts at 50
    const m = wallSpanMeasure(moving, room, [neighbor, moving], "top");
    expect(Math.round(m.before)).toBe(20); // 50 - 30 gap to neighbor
    expect(m.beforeIsCabinet).toBe(true);
    expect(Math.round(m.after)).toBe(144 - 74); // to right wall = 70
    expect(m.afterIsCabinet).toBe(false);
  });

  it("uses the nearest neighbor when several are on the same wall", () => {
    const a = cab({ uid: "a", x: 0, y: 0, width: 24, depth: 24 }); // ends 24
    const b = cab({ uid: "b", x: 30, y: 0, width: 12, depth: 24 }); // ends 42
    const moving = cab({ uid: "m", x: 60, y: 0, width: 24, depth: 24 }); // starts 60
    const m = wallSpanMeasure(moving, room, [a, b, moving], "top");
    expect(Math.round(m.before)).toBe(18); // nearest is b (ends 42): 60-42
    expect(m.beforeIsCabinet).toBe(true);
  });

	  it("works on a vertical (left) wall using the depth axis", () => {
	    // On the left wall, cabinets are rotated; run axis is Y.
	    const moving = cab({ uid: "m", x: 0, y: 40, width: 24, depth: 24, rotation: 90 });
	    const m = wallSpanMeasure(moving, room, [moving], "left");
	    // rotated: along-wall span = original width (24); start y=40
	    expect(Math.round(m.before)).toBe(40);
	    expect(Math.round(m.after)).toBe(120 - 40 - 24); // 56
	  });

	  it("counts a legacy top-right WDC42 on the adjoining right wall so the installed W-36-24 reports 36 inches, not 60, to its left", () => {
	    const reportedRoom: RoomData = { width: 144, depth: 119, ceilingHeight: 96 };
	    const wdc42 = cab({ uid: "reported-wdc42", masterCode: "WDC42", description: "24-inch Diagonal Wall Corner Cabinet", placement: "wall", cornerType: "diagonal", x: 132, y: 0, width: 24, depth: 12, height: 42, rotation: 0, mountBottom: 54 });
	    const installedW3624 = cab({ uid: "installed-w3624", masterCode: "W-36-24", placement: "wall", x: 132, y: 60, width: 36, depth: 12, height: 24, rotation: 90, mountBottom: 72 });
	    const measure = wallSpanMeasure(installedW3624, reportedRoom, [wdc42, installedW3624], "right");

	    expect(measure).toMatchObject({ before: 36, after: 23, beforeIsCabinet: true, afterIsCabinet: false });
	  });
	});

	describe("wallCabinetFitMeasure (3D placement guide)", () => {
  const room: RoomData = { width: 96, depth: 120 };

	  it("accepts a WR3624 in an exact 36-inch opening with edge contact on both sides", () => {
	    const left = cab({ uid: "left", placement: "wall", masterCode: "W-1242", x: 0, y: 0, width: 12, depth: 12, height: 42, mountBottom: 54 });
	    const wr = cab({ uid: "wr", placement: "wall", masterCode: "WR3624", x: 12, y: 0, width: 36, depth: 24, height: 24, mountBottom: 70 });
	    const right = cab({ uid: "right", placement: "wall", masterCode: "W-4842", x: 48, y: 0, width: 48, depth: 12, height: 42, mountBottom: 54 });
	    const measure = wallCabinetFitMeasure(wr, room, [left, wr, right], [], "top");
	    expect(measure).toMatchObject({ requiredSpan: 36, availableSpan: 36, before: 0, after: 0, leftOverlap: 0, rightOverlap: 0, status: "fits" });
	  });

	  it("places W-36-42 in the exact 36-inch right-wall span between legacy WDC42 and the installed over-sink W-36-24", () => {
	    const reportedRoom: RoomData = { width: 144, depth: 119, ceilingHeight: 96 };
	    const wdc42 = cab({ uid: "fit-wdc42", masterCode: "WDC42", description: "24-inch Diagonal Wall Corner Cabinet", placement: "wall", cornerType: "diagonal", x: 132, y: 0, width: 24, depth: 12, height: 42, rotation: 0, mountBottom: 54 });
	    const installedW3624 = cab({ uid: "fit-installed-w3624", masterCode: "W-36-24", placement: "wall", x: 132, y: 60, width: 36, depth: 12, height: 24, rotation: 90, mountBottom: 72 });
	    const spot = paletteActiveWallPlacement("right", reportedRoom, [wdc42, installedW3624], [], 36, 12, "wall", true);

	    expect(spot).toMatchObject({ x: 132, y: 24, rotation: 90 });
	    const w3642 = cab({ uid: "fit-w3642", masterCode: "W-36-42", placement: "wall", ...spot!, width: 36, depth: 12, height: 42, rotation: 90, mountBottom: 54 });
	    expect(hasCollision(w3642, [wdc42, installedW3624])).toBe(false);
	    expect(wallCabinetFitMeasure(w3642, reportedRoom, [wdc42, installedW3624], [], "right")).toMatchObject({ requiredSpan: 36, availableStart: 24, availableEnd: 60, availableSpan: 36, before: 0, after: 0, status: "fits" });
	  });

  it("reports the measurable overlap instead of converting it to zero open space", () => {
    const left = cab({ uid: "left", placement: "wall", masterCode: "W-1242", x: 0, y: 0, width: 12, depth: 12, height: 42, mountBottom: 54 });
    const wr = cab({ uid: "wr", placement: "wall", masterCode: "WR3624", x: 11.75, y: 0, width: 36, depth: 24, height: 24, mountBottom: 70 });
    const measure = wallCabinetFitMeasure(wr, room, [left, wr], [], "top");
    expect(measure.status).toBe("overlap");
    expect(measure.leftOverlap).toBeCloseTo(0.25);
    expect(measure.rightOverlap).toBe(0);
  });

  it("reports a 33-inch clear segment when a 36-inch cabinet intrudes three inches into its right neighbor", () => {
    const left = cab({ uid: "left", placement: "wall", x: 0, y: 0, width: 12, depth: 12, height: 42, mountBottom: 54 });
    const right = cab({ uid: "right", placement: "wall", x: 45, y: 0, width: 51, depth: 12, height: 42, mountBottom: 54 });
    const wr = cab({ uid: "wr", placement: "wall", masterCode: "WR3624", x: 12, y: 0, width: 36, depth: 24, height: 24, mountBottom: 70 });
    const measure = wallCabinetFitMeasure(wr, room, [left, wr, right], [], "top");
    expect(measure.availableSpan).toBe(33);
    expect(measure.requiredSpan).toBe(36);
    expect(measure.status).toBe("overlap");
    expect(measure.rightOverlap).toBe(3);
  });
});

describe("countertopSurfaces", () => {
  it("creates a slab for each base cabinet pinned to its wall", () => {
    const back = cab({ uid: "a", placement: "base", width: 36, depth: 24, x: 0, y: 0 });
    const surfaces = countertopSurfaces([back], ROOM_12x10);
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]).toMatchObject({ x: 0, y: 0, width: 36, depth: CT_DEPTH, kind: "base" });
  });

  it("ignores wall and tall cabinets (no top)", () => {
    const wall = cab({ placement: "wall", width: 30 });
    const tall = cab({ placement: "tall", width: 24 });
    expect(countertopSurfaces([wall, tall], ROOM_12x10)).toHaveLength(0);
  });

  it("covers a sink base (counter-bearing even though the top is cut)", () => {
    const sb = cab({ uid: "sb", masterCode: "SB-36", description: "36in Sink Base", placement: "base", width: 36, depth: 24, x: 0, y: 0 });
    expect(countertopSurfaces([sb], ROOM_12x10)).toHaveLength(1);
  });

  it.each([
    ["3DB24", "24 inch Three Drawer Base", 24, 24],
    ["ERB36", "36 inch Easy Reach Corner Base", 36, 36],
    ["LSB36", "36 inch Lazy Susan Corner Base", 36, 36],
    ["BEC24", "24 inch Base End Angle", 24, 24],
    ["BBC36", "36 inch Blind Corner Base", 36, 24],
  ])("covers the %s base family without requiring a separate countertop action", (masterCode, description, width, depth) => {
    const cabinet = cab({ uid: `counter-${masterCode}`, masterCode, description, placement: "base", width, depth, x: 0, y: 0 });
    expect(bearsCountertop(cabinet)).toBe(true);
    expect(countertopSurfaces([cabinet], ROOM_12x10)).toMatchObject([{ kind: "base" }]);
  });

  it("follows the true L footprint of an LSB36 top with both fronts overhanging in an ordinary 90-degree room", () => {
    const corner = cab({
      uid: "counter-lsb36", masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base",
      placement: "base", width: 36, depth: 24, x: 0, y: 0, rotation: 0, cornerType: "lazy-susan",
    });
    // 36x36 corner box, two 24-inch legs, 1½-inch front overhang on both
    // room-facing fronts (24 + 1.5 = 25.5) — the same finished line as the
    // adjoining 25.5-inch straight-run slabs. No square plug into the floor.
    const expected = [
      { x: 0, y: 0 }, { x: 36, y: 0 }, { x: 36, y: 25.5 },
      { x: 25.5, y: 25.5 }, { x: 25.5, y: 36 }, { x: 0, y: 36 },
    ];
    expect(lCornerCountertopWorldPolygon(corner)).toEqual(expected);
    const [surface] = countertopSurfaces([corner], ROOM_12x10);
    expect(countertopSurfacePlanPolygon(surface!)).toEqual(expected);
    expect(surface!.areaInches).toBeCloseTo(1296 - 10.5 * 10.5, 6);
    expect(countertopPolygonSelfIntersects(countertopSurfacePlanPolygon(surface!))).toBe(false);
  });

  it("keeps a Lazy Susan top inside both cabinet-supported legs on a continuous-wall room", () => {
    const drawnRoom: RoomData = {
      ...ROOM_12x10,
      vertices: [
        { id: "nw", x: 0, y: 0 }, { id: "ne", x: 144, y: 0 },
        { id: "se", x: 144, y: 120 }, { id: "sw", x: 0, y: 120 },
      ],
      customWalls: [
        { id: "drawn-top", startVertexId: "nw", endVertexId: "ne" },
        { id: "drawn-right", startVertexId: "ne", endVertexId: "se" },
        { id: "drawn-bottom", startVertexId: "se", endVertexId: "sw" },
        { id: "drawn-left", startVertexId: "sw", endVertexId: "nw" },
      ],
    };
    const corner = cab({
      uid: "drawn-lsb36", masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base",
      placement: "base", width: 36, depth: 36, x: 0, y: 0, rotation: 0,
      cornerType: "lazy-susan", wallId: "drawn-top", wallOffset: 0,
    });
    const [surface] = countertopSurfaces([corner], drawnRoom);
    const outline = countertopSurfacePlanPolygon(surface!);
    expect(outline).toEqual(lCornerCountertopWorldPolygon(corner));
    expect(outline).toHaveLength(6);
    expect(outline.every((point) => point.x >= 0 && point.y >= 0 && point.x <= 36 && point.y <= 36)).toBe(true);
    // The open floor corner of the 36x36 box is NOT covered by stone.
    expect(outline).not.toContainEqual({ x: 36, y: 36 });
    expect(countertopPolygonSelfIntersects(outline)).toBe(false);
  });

  it("keeps an LSB36 countertop on the complete rotated L footprint in a continuous-wall room", () => {
    const drawnRoom: RoomData = {
      ...ROOM_12x10,
      vertices: [
        { id: "a", x: 0, y: 0 }, { id: "b", x: 144, y: 144 },
        { id: "c", x: 0, y: 144 },
      ],
      customWalls: [
        { id: "drawn-45", startVertexId: "a", endVertexId: "b", lockedAngle: 45 },
        { id: "drawn-return", startVertexId: "b", endVertexId: "c" },
      ],
    };
    const corner = cab({
      uid: "drawn-45-lsb36", masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base",
      placement: "base", width: 36, depth: 36, x: 34.5441559, y: 34.5441559, rotation: 45,
      cornerType: "lazy-susan", wallId: "drawn-45", wallOffset: 0,
    });
    const [surface] = countertopSurfaces([corner], drawnRoom);
    const outline = countertopSurfacePlanPolygon(surface!);
    const expected = lCornerCountertopWorldPolygon(corner);
    expect(surface).toMatchObject({ kind: "base", customWallId: "drawn-45" });
    expect(outline).toHaveLength(expected.length);
    outline.forEach((point, index) => {
      expect(point.x).toBeCloseTo(expected[index]!.x, 6);
      expect(point.y).toBeCloseTo(expected[index]!.y, 6);
    });
    expect(surface!.polygon).toHaveLength(6);
    expect(surface!.areaInches).toBeCloseTo(1185.75, 6);
    expect(countertopPolygonSelfIntersects(outline)).toBe(false);
  });

  it.each([
    [0, { x: 36, y: 36 }],
    [90, { x: 0, y: 36 }],
    [180, { x: 0, y: 0 }],
    [270, { x: 36, y: 0 }],
  ] as const)("keeps the true-L corner countertop aligned at %s degrees", (rotation, openFloorCorner) => {
    const corner = cab({
      uid: `counter-lsb36-${rotation}`, masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base",
      placement: "base", width: 36, depth: 24, x: 0, y: 0, rotation, cornerType: "lazy-susan",
    });
    const [surface] = countertopSurfaces([corner], ROOM_12x10);
    const outline = countertopSurfacePlanPolygon(surface!);
    expect(outline).toHaveLength(6);
    expect(outline.every((point) => point.x >= -1e-9 && point.y >= -1e-9 && point.x <= 36 + 1e-9 && point.y <= 36 + 1e-9)).toBe(true);
    // The three wall-side box corners stay covered; the open floor corner is
    // cut back to the two overhanging fronts (24 + 1.5 inches from each wall).
    const corners = [{ x: 0, y: 0 }, { x: 36, y: 0 }, { x: 36, y: 36 }, { x: 0, y: 36 }];
    const has = (target: { x: number; y: number }) => outline.some((point) => Math.abs(point.x - target.x) < 1e-6 && Math.abs(point.y - target.y) < 1e-6);
    corners.forEach((candidate) => {
      expect(has(candidate)).toBe(candidate.x !== openFloorCorner.x || candidate.y !== openFloorCorner.y);
    });
    const notch = { x: openFloorCorner.x === 36 ? 25.5 : 10.5, y: openFloorCorner.y === 36 ? 25.5 : 10.5 };
    expect(has(notch)).toBe(true);
    expect(surface!.areaInches).toBeCloseTo(1296 - 10.5 * 10.5, 6);
    expect(countertopPolygonSelfIntersects(outline)).toBe(false);
  });

  it("does NOT cover a base-zone decorative end panel or refrigerator panel", () => {
    const endPanel = cab({ uid: "ep", masterCode: "BDEP", description: "Base Decorative End Panel", placement: "base", width: 24, depth: 24, x: 0, y: 0 });
    const fridgePanel = cab({ uid: "rp", masterCode: "DWR-3", description: "Refrigerator End Panel", placement: "base", width: 3, depth: 24, x: 30, y: 0 });
    expect(countertopSurfaces([endPanel, fridgePanel], ROOM_12x10)).toHaveLength(0);
  });

  it("does NOT cover a filler / scribe strip placed in the base zone", () => {
    const filler = cab({ uid: "f", masterCode: "FILL-3", description: '3" Filler / Scribe Strip', subCategory: "Filler", placement: "base", width: 3, depth: 24, x: 0, y: 0 });
    expect(countertopSurfaces([filler], ROOM_12x10)).toHaveLength(0);
  });

	it("continues the countertop over both physical pieces of a confirmed split base filler", () => {
    const left = cab({ uid: "fill-left", masterCode: "FILL-3", description: '3" Filler', subCategory: "Filler", placement: "base", width: 1.25, depth: 24, x: 24, y: 0, fillerPieceGroupId: "fill-group", fillerTotalWidth: 2.5, fillerPlacementMode: "split" });
    const right = cab({ uid: "fill-right", masterCode: "FILL-3", description: '3" Filler', subCategory: "Filler", placement: "base", width: 1.25, depth: 24, x: 40.25, y: 0, fillerPieceGroupId: "fill-group", fillerTotalWidth: 2.5, fillerPlacementMode: "split" });
    // Void filling: nothing stands in the hole between the two filler pieces,
    // so the top runs continuously across it (24 -> 41.5) instead of stopping.
    expect(countertopSurfaces([left, right], ROOM_12x10)).toMatchObject([
      { x: 24, y: 0, width: 17.5, depth: CT_DEPTH, kind: "base" },
    ]);
	});

		it("merges touching bases into one countertop per run and stops at refrigerator bay panels", () => {
		  const leftA = cab({ uid: "left-a", masterCode: "B24", placement: "base", width: 24, depth: 24, x: 0, y: 0 });
	  const leftB = cab({ uid: "left-b", masterCode: "B30", placement: "base", width: 30, depth: 24, x: 24, y: 0 });
	  const refrigerator = cab({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance", width: 36, depth: 24, x: 54, y: 0 });
	  const leftPanel = cab({ uid: "fridge-left-panel", masterCode: "REPV2496", description: "Refrigerator End Panel", placement: "tall", width: 0.75, depth: 25.5, x: 53.25, y: 0, refrigeratorAssemblyId: "fridge", refrigeratorAssemblyRole: "left-panel" });
	  const rightPanel = cab({ uid: "fridge-right-panel", masterCode: "REPV2496", description: "Refrigerator End Panel", placement: "tall", width: 0.75, depth: 25.5, x: 90.5, y: 0, refrigeratorAssemblyId: "fridge", refrigeratorAssemblyRole: "right-panel" });
	  const right = cab({ uid: "right", masterCode: "B24", placement: "base", width: 24, depth: 24, x: 91.25, y: 0 });
	  expect(countertopSurfaces([leftA, leftB, refrigerator, leftPanel, rightPanel, right], ROOM_12x10)).toMatchObject([
	    { x: 0, y: 0, width: 54, depth: CT_DEPTH, cabinetRunId: "wall:top:0-54" },
	    { x: 91.25, y: 0, width: 24, depth: CT_DEPTH, cabinetRunId: "wall:top:91.25-115.25" },
		  ]);
		});

		it("keeps a rotated left-wall run continuous when its last cabinet reaches the bottom corner", () => {
		  const upper = cab({ uid: "left-upper", masterCode: "SB36", placement: "base", width: 36, depth: 24, x: 0, y: 51, rotation: 90 });
		  // This cabinet touches the left AND bottom room edges. Its rotation means
		  // it belongs to the left-wall run; treating the AABB as a bottom-wall run
		  // used to split the supported countertop at this corner.
		  const cornerEnd = cab({ uid: "left-corner-end", masterCode: "B33", placement: "base", width: 33, depth: 24, x: 0, y: 87, rotation: 90 });
		  expect(countertopSurfaces([upper, cornerEnd], ROOM_12x10)).toMatchObject([
		    { x: 0, y: 51, width: CT_DEPTH, depth: 69, cabinetRunId: "wall:left:51-120" },
		  ]);
		});

		it("runs countertop flush to both sides of a range without bridging its appliance opening", () => {
		  const left = cab({ uid: "range-left", masterCode: "B24", placement: "base", width: 24, depth: 24, x: 0, y: 0 });
		  const range = cab({ uid: "range", masterCode: "RANGE-30", description: "30 inch Gas Range", placement: "appliance", width: 30, depth: 25, height: 36, x: 24, y: 0 });
		  const right = cab({ uid: "range-right", masterCode: "B27", placement: "base", width: 27, depth: 24, x: 54, y: 0 });
		  expect(countertopSurfaces([left, range, right], ROOM_12x10)).toMatchObject([
		    { x: 0, y: 0, width: 24, depth: CT_DEPTH, cabinetRunId: "wall:top:0-24" },
		    { x: 54, y: 0, width: 27, depth: CT_DEPTH, cabinetRunId: "wall:top:54-81" },
		  ]);
		});

		it("pins a front-wall slab to the bottom of the room", () => {
    const front = cab({ placement: "base", width: 24, depth: 24, x: 10, y: 96 });
    const [s] = countertopSurfaces([front], ROOM_12x10);
    expect(s.y).toBe(ROOM_12x10.depth - CT_DEPTH);
    expect(s.width).toBe(24);
  });

	  it("adds an automatic island slab over its real cabinet support", () => {
	    const base = cab({ placement: "base", width: 24, depth: 24, x: 50, y: 40, islandFace: "back", islandOffset: 0 });
	    const surfaces = countertopSurfaces([base], ROOM_12x10, { x: 50, y: 40, width: 48, depth: 24 });
	    const island = surfaces.find((s) => s.kind === "island");
	    expect(island).toMatchObject({ x: 48.5, y: 38.5, width: 27, depth: 27 });
	  });

  it("runs the countertop to the wall over a pulled blind corner (top wall, left corner)", () => {
    // Blind base pulled 6" off the left corner: cabinet starts at x=6, width 36.
    // The slab should extend back to x=0 and be 6" wider to cover the dead corner
    // (default pull max is 6").
    const blind = cab({ uid: "bc", masterCode: "BBC-36", placement: "base", width: 36, depth: 24, x: 6, y: 0 });
    const [s] = countertopSurfaces([blind], ROOM_12x10);
    expect(s.x).toBe(0);
    expect(s.width).toBe(42); // 36 + 6" default pull max
  });

  it("clamps an obsolete overwide pull spec to the six-inch blind-corner maximum", () => {
    // Older imports could carry a 9" pull. BBC physical geometry is always 3–6".
    const blind = cab({ uid: "bc", masterCode: "BBC-36", placement: "base", width: 36, depth: 24, x: 6, y: 0, pullMin: 3, pullMax: 9 });
    const [s] = countertopSurfaces([blind], ROOM_12x10);
    expect(s.x).toBe(0);
    expect(s.width).toBe(42); // 36 + 6" trade maximum
  });

  it("uses an ERB36 at a 45-degree peninsula bend to support the unified countertop on both connected runs", () => {
    const parent = { id: "erb-counter-parent", parentWall: "top" as const, startOffset: 72, turn: 90 as const, direction: "right" as const, length: 48, height: 34.5, cabinetSide: "right" as const };
    const child = { id: "erb-counter-child", parentRunId: parent.id, startOffset: 0, turn: 45 as const, direction: "left" as const, length: 36, height: 34.5, cabinetSide: "right" as const };
    const room: RoomData = { ...ROOM_12x10, peninsulaRuns: [parent, child] };
    const spot = wallPlacementAt(12, 36, 36, parent.id as never, room, "right");
    const erb = cab({
      uid: "erb36-45-bend", masterCode: "ERB36", description: "36 inch Easy Reach Corner Base",
      placement: "base", ...spot, width: 36, depth: 36, height: 34.5,
      wallId: parent.id, wallOffset: 12,
    });
    const returnBaseSpot = wallPlacementAt(0, 24, 24, child.id as never, room, "right");
    const returnBase = cab({
      uid: "erb36-45-return-base", masterCode: "B24", description: "24 inch Base Cabinet",
      placement: "base", ...returnBaseSpot, width: 24, depth: 24, height: 34.5,
      wallId: child.id, wallOffset: 0,
    });

    expect(peninsulaCornerCabinetSupportsCountertop(erb, parent, room)).toBe(true);
    expect(peninsulaCornerCabinetSupportsCountertop(erb, child, room)).toBe(true);
    const surfaces = countertopSurfaces([erb, returnBase], room);
    expect(surfaces).toHaveLength(1);
    expect(surfaces).toMatchObject([{
      kind: "base", peninsulaRunId: parent.id, peninsulaRunIds: [parent.id, child.id],
    }]);
    const polygon = countertopSurfacePlanPolygon(surfaces[0]!);
    // The usual 25½-inch peninsula run reaches only x=97.5 here. The ERB's
    // real exterior L leg ends at x=108 and carries the standard 1½-inch edge;
    // its full cabinet-supported footprint must survive the shared 45° union.
    expect(polygon.some((point) => Math.abs(point.x - 109.5) < 1e-6 && point.y >= 24 && point.y <= 48)).toBe(true);
    expect(countertopPolygonSelfIntersects(polygon)).toBe(false);
	  // The ERB supports its real cabinet legs and the joined return, but not a
	  // decorative slab across the unused remainder of either configured run.
	  expect(surfaces[0]!.areaInches).toBeGreaterThan(1700);
	  expect(surfaces[0]!.areaInches).toBeLessThan(1872);
	  });

	  it("makes a single cabinet-supported countertop outline through a 90-degree return", () => {
	    const parent = { id: "square-counter-parent", parentWall: "top" as const, startOffset: 72, turn: 90 as const, direction: "right" as const, length: 48, height: 34.5, cabinetSide: "right" as const };
	    const child = { id: "square-counter-child", parentRunId: parent.id, startOffset: 0, turn: 90 as const, direction: "left" as const, length: 36, height: 34.5, cabinetSide: "right" as const };
	    const room: RoomData = { ...ROOM_12x10, peninsulaRuns: [parent, child] };
	    const parentSpot = wallPlacementAt(12, 36, 24, parent.id as never, room, "right");
	    const childSpot = wallPlacementAt(0, 24, 24, child.id as never, room, "right");
	    const parentBase = cab({ uid: "square-parent-base", masterCode: "B36", description: "36 inch Base Cabinet", placement: "base", ...parentSpot, width: 36, depth: 24, height: 34.5, wallId: parent.id, wallOffset: 12 });
	    const childBase = cab({ uid: "square-child-base", masterCode: "B24", description: "24 inch Base Cabinet", placement: "base", ...childSpot, width: 24, depth: 24, height: 34.5, wallId: child.id, wallOffset: 0 });
	    const surfaces = countertopSurfaces([parentBase, childBase], room);
	    expect(surfaces).toHaveLength(1);
	    expect(surfaces[0]).toMatchObject({ kind: "base", peninsulaRunId: parent.id, peninsulaRunIds: [parent.id, child.id] });
	    expect(countertopPolygonSelfIntersects(countertopSurfacePlanPolygon(surfaces[0]!))).toBe(false);
	  });
});

describe("bearsCountertop", () => {
  it("is true for standard, drawer, and sink bases", () => {
    expect(bearsCountertop({ placement: "base", masterCode: "B-24", description: "Base 24" })).toBe(true);
    expect(bearsCountertop({ placement: "base", masterCode: "DB-24-3", description: "Drawer Base 24" })).toBe(true);
    expect(bearsCountertop({ placement: "base", masterCode: "SB-36", description: "36in Sink Base" })).toBe(true);
    expect(bearsCountertop({ placement: "base", masterCode: "VSD-36", description: "Vanity Sink Base" })).toBe(true);
  });
  it("is false for tall, wall, and appliances", () => {
    expect(bearsCountertop({ placement: "tall", masterCode: "U-24-84" })).toBe(false);
    expect(bearsCountertop({ placement: "wall", masterCode: "W-30-30" })).toBe(false);
    expect(bearsCountertop({ placement: "appliance", masterCode: "FRIDGE-36" })).toBe(false);
    expect(bearsCountertop({ placement: "base", masterCode: "STOVE-30", description: "30 inch gas stove" })).toBe(false);
  });
  it("is false for base-zone panels, skins, fillers, and decorative legs", () => {
    expect(bearsCountertop({ placement: "base", masterCode: "BDEP", description: "Base Decorative End Panel" })).toBe(false);
    expect(bearsCountertop({ placement: "base", masterCode: "DWR-3", description: "Refrigerator End Panel" })).toBe(false);
    expect(bearsCountertop({ placement: "base", masterCode: "WS-12-42", description: "Wall Skin", subCategory: "Skin" })).toBe(false);
    expect(bearsCountertop({ placement: "base", masterCode: "FILL-3", description: '3" Filler / Scribe Strip', subCategory: "Filler" })).toBe(false);
    for (const masterCode of ["FLDL", "CLDL", "SCDL", "SQDL"]) {
      expect(bearsCountertop({ placement: "base", masterCode, description: "Legacy accessory import" })).toBe(false);
    }
  });
  it("is true only for a base filler carrying confirmed small-gap installation metadata", () => {
    expect(bearsCountertop({ placement: "base", masterCode: "FILL-3", description: '3" Filler', subCategory: "Filler", fillerPieceGroupId: "fill-group", fillerTotalWidth: 2.5, fillerPlacementMode: "split" })).toBe(true);
    expect(bearsCountertop({ placement: "base", masterCode: "BF3", description: '3" Base Filler', subCategory: "Filler", fillerPieceGroupId: "supplier-fill-group", fillerTotalWidth: 3, fillerPlacementMode: "right" })).toBe(true);
    expect(bearsCountertop({ placement: "base", masterCode: "BF3", description: '3" Base Filler', subCategory: "Filler" })).toBe(false);
    expect(bearsCountertop({ placement: "base", masterCode: "F396", description: '3" Tall Filler', subCategory: "Filler", fillerPieceGroupId: "miter-group", fillerTotalWidth: 22, fillerPlacementMode: "left", fillerTransitionKind: "front-miter-pair" })).toBe(false);
    expect(bearsCountertop({ placement: "wall", masterCode: "FILL-3", description: '3" Filler', subCategory: "Filler", fillerPieceGroupId: "fill-group", fillerTotalWidth: 2.5, fillerPlacementMode: "split" })).toBe(false);
  });

  it("merges a confirmed supplier filler into the same 25½-inch framed-base countertop run", () => {
    const base = cab({ uid: "base-24", masterCode: "B24", description: "24 inch Base Cabinet", x: 0, y: 0, width: 24, depth: 24, height: 34.5 });
    const supplierFiller = cab({
      uid: "supplier-bf3",
      masterCode: "BF3",
      description: "3 inch Base Filler",
      subCategory: "Filler",
      x: 24,
      y: 0,
      width: 3,
      depth: 24,
      height: 34.5,
      fillerPieceGroupId: "supplier-fill-group",
      fillerTotalWidth: 3,
      fillerPlacementMode: "right",
      fillerForCabinetUid: base.uid,
    });
    const surfaces = countertopSurfaces([base, supplierFiller], ROOM_12x10);
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]).toMatchObject({ x: 0, y: 0, width: 27, depth: COUNTERTOP_DEPTH_IN, kind: "base" });
  });
});

describe("countertopMaterial + makeSink", () => {
  it("looks up a material by id and falls back to the first", () => {
    expect(countertopMaterial("black-granite").name).toBe("Black Granite");
    expect(countertopMaterial("nope").name).toBe(countertopMaterial(undefined).name);
  });

  it("builds a sink from a preset with a faucet on by default", () => {
    const sink = makeSink("double", 12, 4);
    expect(sink).toMatchObject({ type: "double", x: 12, y: 4, width: 33, faucet: true });
    expect(sink.uid).toMatch(/^sink-/);
  });
});

function opening(partial: Partial<WallOpening>): WallOpening {
  return {
    uid: "o",
    kind: "door",
    label: "Door",
    side: "top",
    offset: 0,
    width: 36,
    height: 80,
    sill: 0,
    ...partial,
  };
}

describe("freeSegmentsOnWall (break the run around openings)", () => {
  it("resolves SB-36 palette placement to the active wall opening and never to the room center", () => {
    const openSpot = paletteActiveWallPlacement("top", ROOM_12x10, [], [], 36, 24, "base");
    expect(openSpot).toMatchObject({ x: 0, y: 0, rotation: 0 });

    const filledTopRun = [cab({ uid: "base-run", x: 0, y: 0, width: 144, depth: 24, placement: "base" })];
    expect(paletteActiveWallPlacement("top", ROOM_12x10, filledTopRun, [], 36, 24, "base")).toBeNull();
  });

  it("fills the earliest valid selected-wall opening instead of jumping past later floor-run items", () => {
    const existing = [
      cab({ uid: "base-a", placement: "base", x: 24, y: 0, width: 30, depth: 24 }),
      cab({ uid: "base-b", placement: "base", x: 54, y: 0, width: 18, depth: 24 }),
    ];
    expect(paletteActiveWallPlacement("top", ROOM_12x10, existing, [], 24, 24, "base"))
      .toMatchObject({ x: 0, y: 0, rotation: 0 });
  });

  it("keeps wall and floor runs independent while tall cabinets reserve both sequences", () => {
    const baseOnly = cab({ uid: "base", placement: "base", x: 0, y: 0, width: 48, depth: 24 });
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [baseOnly], [], 30, 12, "wall"))
      .toMatchObject({ x: 0, y: 0, rotation: 0 });

    const wallOnly = cab({ uid: "wall", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 30 });
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [wallOnly], [], 24, 24, "base"))
      .toMatchObject({ x: 0, y: 0, rotation: 0 });

    const tall = cab({ uid: "tall", placement: "tall", x: 0, y: 0, width: 24, depth: 24, height: 84 });
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [tall], [], 30, 12, "wall"))
      .toMatchObject({ x: 24, y: 0, rotation: 0 });
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [tall], [], 30, 24, "base"))
      .toMatchObject({ x: 24, y: 0, rotation: 0 });

    const splitRuns = [
      cab({ uid: "base-long", placement: "base", x: 0, y: 0, width: 42, depth: 24 }),
      cab({ uid: "wall-long", placement: "wall", x: 0, y: 0, width: 60, depth: 12, height: 30 }),
    ];
    expect(paletteActiveWallPlacement("top", ROOM_12x10, splitRuns, [], 24, 24, "tall"))
      .toMatchObject({ x: 60, y: 0, rotation: 0 });
  });

  it("places W-30-24 after the current upper run instead of jumping over a matching stove", () => {
    const upper = cab({ uid: "upper", masterCode: "W-30-30", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 30 });
    const stove = cab({ uid: "range", masterCode: "RANGE-30", placement: "appliance", x: 72, y: 0, width: 30, depth: 24, height: 36 });
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [upper, stove], [], 30, 12, "wall"))
      .toMatchObject({ x: 30, y: 0, rotation: 0 });
  });

  it("places W-24-42 immediately to the right of a wall-mounted range hood with zero overlap", () => {
    const leftUpper = cab({ uid: "left-upper", masterCode: "W-24-42", placement: "wall", x: 0, y: 0, width: 48, depth: 12, height: 42 });
    const hood = cab({ uid: "wall-hood", masterCode: "HOOD-30", description: "30 inch Wall Mount Range Hood", placement: "appliance", x: 48, y: 0, width: 30, depth: 20, height: 18, mountBottom: 66 });
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [leftUpper, hood], [], 24, 12, "wall", true))
      .toMatchObject({ x: 78, y: 0, rotation: 0 });
  });

  it("keeps B-12 on the base layer while W-1242 back-fills the clear upper opening after the hood", () => {
    const leftUpper = cab({ uid: "left-upper", masterCode: "W-4842", placement: "wall", x: 0, y: 0, width: 48, depth: 12, height: 42, mountBottom: 54 });
    const hood = cab({ uid: "hood", masterCode: "HOOD-30", description: "30 inch Wall Mount Range Hood", placement: "appliance", x: 48, y: 0, width: 30, depth: 18, height: 18, mountBottom: 66 });
    const corner = cab({ uid: "right-corner", masterCode: "WDC2442", description: "24 inch Diagonal Corner Wall Cabinet", placement: "wall", x: 120, y: 0, width: 24, depth: 24, height: 42, mountBottom: 54 });
    const w1242Spot = paletteActiveWallPlacement("top", ROOM_12x10, [leftUpper, hood, corner], [], 12, 12, "wall", true);
    expect(w1242Spot).toMatchObject({ x: 78, y: 0, rotation: 0 });
    expect(hasCollision(cab({ uid: "w1242", masterCode: "W-1242", placement: "wall", ...w1242Spot!, width: 12, depth: 12, height: 42, mountBottom: 54 }), [leftUpper, hood, corner])).toBe(false);

    const fullBaseRun = [cab({ uid: "full-base", masterCode: "B-144", placement: "base", x: 0, y: 0, width: 144, depth: 24, height: 34.5 })];
    expect(paletteActiveWallPlacement("top", ROOM_12x10, fullBaseRun, [], 12, 24, "base")).toBeNull();
  });

  it("treats a wall-mounted hood as occupied upper-wall space even without a special reserve flag", () => {
    const hood = cab({ uid: "universal-wall-hood", masterCode: "HOOD-30", description: "30 inch Wall Mount Range Hood", placement: "appliance", x: 48, y: 0, width: 30, depth: 18, height: 18, mountBottom: 66 });
    expect(freeSegmentsOnWall("top", ROOM_12x10, [hood], [], 0, 0, "wall")).toEqual([
      { start: 0, length: 48 },
      { start: 78, length: 66 },
    ]);
    const wdc = cab({ uid: "wdc2442-on-hood", masterCode: "WDC2442", description: "24 inch Diagonal Corner Wall Cabinet", placement: "wall", x: 48, y: 0, width: 24, depth: 24, height: 42, mountBottom: 54 });
    expect(hasCollision(wdc, [hood])).toBe(true);
  });

  it("places WDC2442 at the next clear room corner instead of on a hood", () => {
    const hood = cab({ uid: "corner-blocking-hood", masterCode: "HOOD-30", description: "30 inch Wall Mount Range Hood", placement: "appliance", x: 0, y: 0, width: 30, depth: 18, height: 18, mountBottom: 66 });
    const wdc = cab({ uid: "new-wdc2442", masterCode: "WDC2442", description: "24 inch Diagonal Corner Wall Cabinet", placement: "wall", x: 0, y: 0, width: 24, depth: 24, height: 42, mountBottom: 54 });
    expect(nextAvailableRoomCornerPlacement(wdc, "top", ROOM_12x10, [hood])).toMatchObject({ x: 120, y: 0 });
  });

  it("reports no WDC corner when every physical room corner is already occupied", () => {
    const wdc = cab({ uid: "blocked-wdc2442", masterCode: "WDC2442", description: "24 inch Diagonal Corner Wall Cabinet", placement: "wall", x: 0, y: 0, width: 24, depth: 24, height: 42, mountBottom: 54 });
    const occupied = [
      cab({ uid: "top-left", placement: "wall", x: 0, y: 0, width: 24, depth: 24, height: 42, mountBottom: 54 }),
      cab({ uid: "top-right", placement: "wall", x: 120, y: 0, width: 24, depth: 24, height: 42, mountBottom: 54 }),
      cab({ uid: "bottom-right", placement: "wall", x: 120, y: 96, width: 24, depth: 24, height: 42, mountBottom: 54 }),
      cab({ uid: "bottom-left", placement: "wall", x: 0, y: 96, width: 24, depth: 24, height: 42, mountBottom: 54 }),
    ];
    expect(nextAvailableRoomCornerPlacement(wdc, "top", ROOM_12x10, occupied)).toBeNull();
  });

  it("seats ERB33 beside a Four-anchor appliance exactly 33 inches from the shared corner, while ERB36 remains blocked", () => {
    const rightRunAnchor = cab({
      uid: "four-anchor-right-run-range",
      masterCode: "RANGE-30",
      description: "30 inch Range",
      placement: "appliance",
      applianceRole: "base-height",
      x: ROOM_12x10.width - 24,
      y: 33,
      width: 24,
      depth: 24,
      height: 36,
      mountBottom: 0,
      rotation: 90,
      wallId: "right",
      wallOffset: 33,
    });
    const erb33 = cab({
      uid: "four-anchor-erb33",
      masterCode: "ERB33",
      description: '33" Easy Reach Base Cabinet with Lazy Susan',
      placement: "base",
      width: 33,
      depth: 24,
      height: 34.5,
    });
    const erb36 = { ...erb33, uid: "four-anchor-erb36", masterCode: "ERB36", width: 36, description: '36" Easy Reach Base Cabinet with Lazy Susan' };

    expect(placedFootprint(erb33)).toEqual({ w: 33, d: 33 });
    expect(nextAvailableRoomCornerPlacement(erb33, "top", ROOM_12x10, [rightRunAnchor], { x: ROOM_12x10.width, y: 0 }))
      .toMatchObject({ x: 111, y: 0, rotation: 90, wallId: "right", wallOffset: 0 });
    expect(nextAvailableRoomCornerPlacement(erb36, "top", ROOM_12x10, [rightRunAnchor], { x: ROOM_12x10.width, y: 0 })).toBeNull();
  });

  it("places a normal W-30-42 in the first valid upper opening to the right of a full-height refrigerator", () => {
    const leftUpper = cab({ uid: "left-upper", masterCode: "W-24-42", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 42 });
    const refrigerator = cab({ uid: "fridge", masterCode: "FRIDGE-36", description: "36 inch Refrigerator", placement: "appliance", x: 42, y: 0, width: 36, depth: 30, height: 70 });
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [leftUpper, refrigerator], [], 30, 12, "wall", true))
      .toMatchObject({ x: 78, y: 0, rotation: 0 });
  });

  it("still permits a dedicated refrigerator wall cabinet to share the refrigerator span", () => {
    const leftUpper = cab({ uid: "left-upper", masterCode: "W-24-42", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 42 });
    const refrigerator = cab({ uid: "fridge", masterCode: "FRIDGE-36", description: "36 inch Refrigerator", placement: "appliance", x: 42, y: 0, width: 36, depth: 30, height: 70 });
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [leftUpper, refrigerator], [], 36, 24, "wall", false))
      .toMatchObject({ x: 24, y: 0, rotation: 0 });
  });

  it("centers W-30-24 above an explicitly selected sink base instead of using the generic wall sequence", () => {
    const sinkBase = cab({ uid: "selected-sink-base", masterCode: "SB-36", description: "36-inch Sink Base", placement: "base", x: 48, y: 0, width: 36, depth: 24, height: 34.5 });
    const spot = selectedSinkBaseWallPlacement(sinkBase, ROOM_12x10, 30, 12, 24);
    expect(spot).toMatchObject({ x: 51, y: 0, rotation: 0 });
    const w3024 = cab({ uid: "over-sink-w3024", masterCode: "W-30-24", placement: "wall", ...spot!, width: 30, depth: 12, height: 24 });
    expect(overSinkWindowStart(w3024, [sinkBase], [], ROOM_12x10)).toBe(51);
    expect(overSinkWallMountBottom(w3024, [sinkBase], [], ROOM_12x10)).toBe(70);
    expect(hasCollision(w3024, [sinkBase])).toBe(false);
  });

  it("uses normal sequence placement when the selected lower cabinet is not a sink, while any wall height may target a selected sink", () => {
    const ordinaryBase = cab({ uid: "selected-ordinary-base", masterCode: "B-36", description: "36-inch Base", placement: "base", x: 48, y: 0, width: 36, depth: 24, height: 34.5 });
    const sinkBase = cab({ uid: "selected-sink-for-tall-upper", masterCode: "SB-36", description: "36-inch Sink Base", placement: "base", x: 48, y: 0, width: 36, depth: 24, height: 34.5 });
    expect(selectedSinkBaseWallPlacement(ordinaryBase, ROOM_12x10, 30, 12, 24)).toBeNull();
    const tallWallSpot = selectedSinkBaseWallPlacement(sinkBase, ROOM_12x10, 30, 12, 42);
    expect(tallWallSpot).toMatchObject({ x: 51, y: 0, rotation: 0 });
    const tallWall = cab({ uid: "over-sink-w3042", masterCode: "W-30-42", placement: "wall", ...tallWallSpot!, width: 30, depth: 12, height: 42 });
    expect(elevationBox(tallWall, ROOM_12x10)).toEqual({ bottom: 54, height: 42 });
  });

  it.each([12, 18, 24, 30, 36, 42])("allows a %i-inch wall cabinet to use the selected sink opening regardless of neighboring heights", (height) => {
    const sinkBase = cab({ uid: `sink-${height}`, masterCode: "SB-36", description: "36-inch Sink Base", placement: "base", x: 48, y: 0, width: 36, depth: 24, height: 34.5 });
    const leftUpper = cab({ uid: `left-${height}`, masterCode: "W-30-42", placement: "wall", x: 21, y: 0, width: 30, depth: 12, height: 42 });
    const rightUpper = cab({ uid: `right-${height}`, masterCode: "W-30-30", placement: "wall", x: 81, y: 0, width: 30, depth: 12, height: 30 });
    const spot = selectedSinkBaseWallPlacement(sinkBase, ROOM_12x10, 30, 12, height);
    expect(spot).toMatchObject({ x: 51, y: 0, rotation: 0 });
    const candidate = cab({ uid: `selected-height-${height}`, masterCode: `W-30-${height}`, placement: "wall", ...spot!, width: 30, depth: 12, height });
    expect(hasCollision(candidate, [leftUpper, rightUpper, sinkBase])).toBe(false);
  });

	  it("snaps W-36-24 into the exact 36-inch selected-sink opening instead of reporting only the 24-inch overlap remainder", () => {
    const sinkBase = cab({ uid: "selected-sink-36", masterCode: "SB-36", description: "36-inch Sink Base", placement: "base", x: 24, y: 0, width: 36, depth: 24, height: 34.5 });
    const leftUpper = cab({ uid: "left-boundary", masterCode: "W-12-42", placement: "wall", x: 0, y: 0, width: 12, depth: 12, height: 42 });
    const rightUpper = cab({ uid: "right-boundary", masterCode: "W-12-42", placement: "wall", x: 48, y: 0, width: 12, depth: 12, height: 42 });
    const spot = selectedSinkBaseWallPlacement(
      sinkBase,
      ROOM_12x10,
      36,
      12,
      24,
      [leftUpper, sinkBase, rightUpper],
      [],
    );
    expect(spot).toMatchObject({ x: 12, y: 0, rotation: 0 });
    const candidate = cab({ uid: "exact-fit-w3624", masterCode: "W-36-24", placement: "wall", ...spot!, width: 36, depth: 12, height: 24, mountBottom: 70 });
    expect(hasCollision(candidate, [leftUpper, sinkBase, rightUpper])).toBe(false);
    const fit = wallCabinetFitMeasure(candidate, ROOM_12x10, [leftUpper, sinkBase, rightUpper], []);
	    expect(fit).toMatchObject({ availableStart: 12, availableEnd: 48, availableSpan: 36, before: 0, after: 0, status: "fits" });
	  });

	  it("rejects the live selected-sink W-36-24 target when W-36-42 leaves only a 24-inch opening and would overlap it by 12 inches", () => {
	    const room: RoomData = { width: 144, depth: 127, ceilingHeight: 96 };
	    const sinkBase = cab({ uid: "live-right-sink-36", masterCode: "SB-36", description: "36-inch Sink Base", placement: "base", x: 120, y: 0, width: 36, depth: 24, height: 34.5, rotation: 90 });
	    const occupiedUpper = cab({ uid: "live-right-w3642", masterCode: "W-36-42", placement: "wall", x: 132, y: 24, width: 36, depth: 12, height: 42, rotation: 90 });

	    expect(selectedSinkBaseWallPlacement(sinkBase, room, 36, 12, 24, [sinkBase, occupiedUpper], [])).toBeNull();
	    const blockedCandidate = cab({ uid: "live-right-w3624", masterCode: "W-36-24", placement: "wall", x: 132, y: 0, width: 36, depth: 12, height: 24, rotation: 90, mountBottom: 72 });
	    expect(wallCabinetFitMeasure(blockedCandidate, room, [sinkBase, occupiedUpper], [])).toMatchObject({
	      availableStart: 0,
	      availableEnd: 24,
	      availableSpan: 24,
	      shortage: 12,
	      status: "overlap",
	    });
	  });

  it("aligns W-36-24 to a targeted 36-inch lower cabinet on the right wall instead of the earlier 24-inch upper gap", () => {
    const room: RoomData = { width: 144, depth: 127, ceilingHeight: 96 };
    const earlierUpper = cab({ uid: "right-w3642", masterCode: "W-36-42", placement: "wall", x: 132, y: 24, width: 36, depth: 12, height: 42, rotation: 90 });
    const lowerTarget = cab({ uid: "right-sb36", masterCode: "SB-36", description: "36-inch Sink Base", placement: "base", x: 120, y: 60, width: 36, depth: 24, height: 34.5, rotation: 90 });
    const spot = selectedLowerCabinetWallPlacement(lowerTarget, room, 36, 12, 24, [earlierUpper, lowerTarget], []);

    expect(spot).toMatchObject({ x: 132, y: 60, rotation: 90 });
    const candidate = cab({ uid: "right-w3624", masterCode: "W-36-24", placement: "wall", ...spot!, width: 36, depth: 12, height: 24, rotation: 90 });
    expect(hasCollision(candidate, [earlierUpper, lowerTarget])).toBe(false);
    expect(adjoiningWallRunMountBottom(candidate, room, [earlierUpper, lowerTarget])).toBe(72);
    expect(elevationBox({ ...candidate, mountBottom: 72 }, room)).toEqual({ bottom: 72, height: 24 });
  });

  it("does not shift a targeted W-36-24 away from its lower cabinet when that exact upper projection is occupied", () => {
    const room: RoomData = { width: 144, depth: 127, ceilingHeight: 96 };
    const lowerTarget = cab({ uid: "right-lower-occupied", masterCode: "B-36", placement: "base", x: 120, y: 60, width: 36, depth: 24, height: 34.5, rotation: 90 });
    const occupiedUpper = cab({ uid: "right-upper-occupied", masterCode: "W-36-42", placement: "wall", x: 132, y: 60, width: 36, depth: 12, height: 42, rotation: 90 });
    expect(selectedLowerCabinetWallPlacement(lowerTarget, room, 36, 12, 24, [lowerTarget, occupiedUpper], [])).toBeNull();
  });

  it("allows a matching upper over a floor dishwasher but rejects a range and refrigerator target", () => {
    const room: RoomData = { width: 144, depth: 127, ceilingHeight: 96 };
    const dishwasher = cab({ uid: "right-dw24", masterCode: "DW-24", description: "24 inch Dishwasher", placement: "appliance", x: 120, y: 36, width: 24, depth: 24, height: 34.5, rotation: 90 });
    const range = cab({ uid: "right-range30", masterCode: "RANGE-30", description: "30 inch Range", placement: "appliance", x: 119, y: 60, width: 30, depth: 25, height: 36, rotation: 90 });
    const refrigerator = cab({ uid: "right-fridge36", masterCode: "FRIDGE-36", description: "36 inch Refrigerator", placement: "appliance", x: 114, y: 90, width: 36, depth: 30, height: 70, rotation: 90 });

    expect(selectedLowerCabinetWallPlacement(dishwasher, room, 24, 12, 30, [dishwasher, range, refrigerator], [])).toMatchObject({ x: 132, y: 36, rotation: 90 });
    expect(selectedLowerCabinetWallPlacement(range, room, 30, 12, 30, [dishwasher, range, refrigerator], [])).toBeNull();
    expect(selectedLowerCabinetWallPlacement(refrigerator, room, 36, 24, 24, [dishwasher, range, refrigerator], [])).toBeNull();
  });

  it("uses the nearest clear opening beside a refrigerator and leaves a three-inch remainder for the existing filler flow", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
    const refrigerator = cab({ uid: "top-fridge-36", masterCode: "FRIDGE-36", description: "36 inch Refrigerator", placement: "appliance", x: 60, y: 0, width: 36, depth: 24, height: 70, rotation: 0 });
    const spot = refrigeratorAdjacentOpeningPlacement("top", room, [refrigerator], [], 45, 24, "base");
    expect(spot).toMatchObject({ x: 96, y: 0, rotation: 0 });
    const placedBase = cab({ uid: "top-adjacent-b45", masterCode: "B-45", placement: "base", ...spot!, width: 45, depth: 24, height: 34.5, rotation: 0 });
    expect(findSmallGapFillerOpportunity(room, [refrigerator, placedBase], [], placedBase.uid)).toMatchObject({ remaining: 3, layer: "base" });
  });

  it("blocks a matching upper that violates the three-inch wall-opening clearance", () => {
    const room: RoomData = { width: 144, depth: 127, ceilingHeight: 96 };
    const base = cab({ uid: "window-base-36", masterCode: "B-36", placement: "base", x: 120, y: 48, width: 36, depth: 24, height: 34.5, rotation: 90 });
    const window = opening({ uid: "right-window", kind: "window", side: "right", offset: 48, width: 36, height: 30, sill: 44 });

    expect(selectedLowerCabinetWallPlacement(base, room, 36, 12, 24, [base], [window])).toBeNull();
  });

  it("keeps standard matching uppers at the 54-inch bottom while short uppers share an adjacent run top", () => {
    const room: RoomData = { width: 144, depth: 127, ceilingHeight: 96 };
    const firstLower = cab({ uid: "right-base-36-a", masterCode: "B-36", placement: "base", x: 120, y: 24, width: 36, depth: 24, height: 34.5, rotation: 90 });
    const secondLower = cab({ uid: "right-base-36-b", masterCode: "B-36", placement: "base", x: 120, y: 60, width: 36, depth: 24, height: 34.5, rotation: 90 });
    const standardSpot = selectedLowerCabinetWallPlacement(firstLower, room, 36, 12, 42, [firstLower, secondLower], []);
    expect(standardSpot).toMatchObject({ x: 132, y: 24, rotation: 90 });
    const standardUpper = cab({ uid: "right-standard-upper", masterCode: "W-36-42", placement: "wall", ...standardSpot!, width: 36, depth: 12, height: 42, rotation: 90 });
    expect(elevationBox(standardUpper, room)).toEqual({ bottom: 54, height: 42 });

    const shortSpot = selectedLowerCabinetWallPlacement(secondLower, room, 36, 12, 24, [firstLower, secondLower, standardUpper], []);
    expect(shortSpot).toMatchObject({ x: 132, y: 60, rotation: 90 });
    const shortUpper = cab({ uid: "right-short-upper", masterCode: "W-36-24", placement: "wall", ...shortSpot!, width: 36, depth: 12, height: 24, rotation: 90 });
    expect(adjoiningWallRunMountBottom(shortUpper, room, [standardUpper])).toBe(72);
    expect(elevationBox({ ...shortUpper, mountBottom: 72 }, room)).toEqual({ bottom: 72, height: 24 });
  });

  it("click-to-add finds the first clear same-width lower run when no lower cabinet is selected", () => {
    const room: RoomData = { width: 144, depth: 127, ceilingHeight: 96 };
    const earlierUpper = cab({ uid: "click-right-w3642", masterCode: "W-36-42", placement: "wall", x: 132, y: 24, width: 36, depth: 12, height: 42, rotation: 90 });
    const coveredLower = cab({ uid: "click-covered-b36", masterCode: "B-36", placement: "base", x: 120, y: 24, width: 36, depth: 24, height: 34.5, rotation: 90 });
    const clearLower = cab({ uid: "click-clear-sb36", masterCode: "SB-36", description: "36-inch Sink Base", placement: "base", x: 120, y: 60, width: 36, depth: 24, height: 34.5, rotation: 90 });

    expect(matchingLowerCabinetWallPlacement("right", room, 36, 12, 24, [earlierUpper, coveredLower, clearLower], [])).toMatchObject({
      targetUid: "click-clear-sb36",
      spot: { x: 132, y: 60, rotation: 90, wallId: "right", wallOffset: 60 },
    });
  });

  it("matches an upper cabinet to the true measured span of a 45-degree wall base", () => {
    const diagonalRoom: RoomData = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      vertices: [
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 84, y: 84 },
        { id: "v3", x: 84, y: 180 },
        { id: "v4", x: 0, y: 180 },
      ],
      customWalls: [
        { id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 },
        { id: "straight", startVertexId: "v2", endVertexId: "v3" },
        { id: "return", startVertexId: "v3", endVertexId: "v4" },
        { id: "close", startVertexId: "v4", endVertexId: "v1" },
      ],
    };
    const lowerSpot = wallPlacementAt(24, 36, 24, "diagonal", diagonalRoom);
    const lower = cab({
      uid: "diagonal-b36",
      masterCode: "B-36",
      placement: "base",
      ...lowerSpot,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: lowerSpot.rotation,
      wallId: "diagonal",
      wallOffset: lowerSpot.wallOffset,
    });

    const expected = wallPlacementAt(24, 36, 12, "diagonal", diagonalRoom);
    expect(selectedLowerCabinetWallPlacement(lower, diagonalRoom, 36, 12, 42, [lower], [])).toEqual(expected);
    expect(matchingLowerCabinetWallPlacement("diagonal", diagonalRoom, 36, 12, 42, [lower], [])).toEqual({
      targetUid: lower.uid,
      spot: expected,
    });
  });

  it("keeps a same-width upper at the exact selected-base offset beside a 45-degree corner hold", () => {
    const room: RoomData = {
      width: 168,
      depth: 96,
      ceilingHeight: 96,
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 120, y: 0 },
        { id: "c", x: 168, y: 48 },
        { id: "d", x: 120, y: 96 },
        { id: "e", x: 0, y: 96 },
      ],
      customWalls: [
        { id: "top", startVertexId: "a", endVertexId: "b" },
        { id: "wall-45", startVertexId: "b", endVertexId: "c", lockedAngle: 45 },
        { id: "wall-135", startVertexId: "c", endVertexId: "d", lockedAngle: -45 },
        { id: "bottom", startVertexId: "d", endVertexId: "e" },
        { id: "left", startVertexId: "e", endVertexId: "a" },
      ],
    };
    // This base predates the generic first-cabinet 11-inch corner reserve but
    // is physically seated on Wall 2 at offset 10. A selected 15-inch upper
    // must project directly above it rather than shift to offset 11.
    const lowerSpot = wallPlacementAt(10, 15, 24, "wall-45", room);
    const lower = cab({
      uid: "selected-b15", masterCode: "B15", placement: "base", ...lowerSpot,
      width: 15, depth: 24, height: 34.5, rotation: lowerSpot.rotation,
      wallId: "wall-45", wallOffset: lowerSpot.wallOffset,
    });
    expect(selectedLowerCabinetWallPlacement(lower, room, 15, 12, 42, [lower], [])).toEqual(
      wallPlacementAt(10, 15, 12, "wall-45", room),
    );
  });

  it("keeps both shallow uppers and deep bases back-flush to 45° and 135° walls", () => {
    const room: RoomData = {
      width: 168,
      depth: 96,
      ceilingHeight: 96,
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 120, y: 0 },
        { id: "c", x: 168, y: 48 },
        { id: "d", x: 120, y: 96 },
        { id: "e", x: 0, y: 96 },
      ],
      customWalls: [
        { id: "top", startVertexId: "a", endVertexId: "b" },
        { id: "wall-45", startVertexId: "b", endVertexId: "c", lockedAngle: 45 },
        { id: "wall-135", startVertexId: "c", endVertexId: "d", lockedAngle: -45 },
        { id: "bottom", startVertexId: "d", endVertexId: "e" },
        { id: "left", startVertexId: "e", endVertexId: "a" },
      ],
    };
    for (const wallId of ["wall-45", "wall-135"] as const) {
      const wall = room.customWalls!.find((entry) => entry.id === wallId)!;
      const start = room.vertices!.find((vertex) => vertex.id === wall.startVertexId)!;
      const end = room.vertices!.find((vertex) => vertex.id === wall.endVertexId)!;
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const tangent = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
      const inward = { x: -tangent.y, y: tangent.x }; // closed clockwise room
      for (const depth of [12, 24]) {
        const spot = wallPlacementAt(10, 15, depth, wallId, room);
        const bound = {
          w: Math.abs(15 * tangent.x) + Math.abs(depth * inward.x),
          h: Math.abs(15 * tangent.y) + Math.abs(depth * inward.y),
        };
        const center = { x: spot.x + bound.w / 2, y: spot.y + bound.h / 2 };
        // Center is exactly depth/2 inside the line, therefore the physical back
        // edge (center minus its depth half-vector) is exactly on the wall.
        const inwardDistance = (center.x - start.x) * inward.x + (center.y - start.y) * inward.y;
        expect(inwardDistance).toBeCloseTo(depth / 2, 6);
      }
    }
  });

  it("recognizes the reported 54-inch opening, places W-30-24 at exact edge contact, and leaves 24 inches open", () => {
    const previous = cab({ uid: "previous-upper", masterCode: "W-30-42", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 42 });
    const laterTall = cab({ uid: "later-tall", masterCode: "T-24-96", placement: "tall", x: 84, y: 0, width: 24, depth: 24, height: 96 });
    const spot = paletteActiveWallPlacement("top", ROOM_12x10, [previous, laterTall], [], 30, 12, "wall");
    expect(spot).toMatchObject({ x: 30, y: 0, rotation: 0 });
    const w3024 = cab({ uid: "w3024-open-run", masterCode: "W-30-24", placement: "wall", ...spot!, width: 30, depth: 12, height: 24 });
    expect(hasCollision(w3024, [previous, laterTall])).toBe(false);
    expect(w3024.x - (previous.x + previous.width)).toBe(0);
    expect(laterTall.x - (w3024.x + w3024.width)).toBe(24);
    expect(adjoiningWallRunMountBottom(w3024, ROOM_12x10, [previous, laterTall])).toBe(72);
  });

  it("does not let a perpendicular corner cabinet consume the selected wall's open run", () => {
    const leftWallTall = cab({ uid: "left-corner-tall", placement: "tall", x: 0, y: 0, width: 24, depth: 24, height: 96, rotation: 90 });
    expect(cabinetWall(leftWallTall, ROOM_12x10)).toBe("left");
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [leftWallTall], [], 30, 12, "wall"))
      .toMatchObject({ x: 0, y: 0, rotation: 0 });
  });

	  it("reserves LS3612's physical leg on the adjoining right-wall base run for DW-24 and 3-DB18 catalog placement", () => {
    const ls3612 = cab({
      uid: "ls3612-top-right",
      masterCode: "LS3612",
      description: "36 inch Lazy Susan Corner Base",
      placement: "base",
      x: 108,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
    });
    expect(cabinetWall(ls3612, ROOM_12x10)).toBe("top");
    expect(placedFootprint(ls3612)).toEqual({ w: 36, d: 36 });
    expect(freeSegmentsOnWall("right", ROOM_12x10, [ls3612], [], 0.5, 0, "appliance"))
      .toEqual([{ start: 36, length: 84 }]);

    const dishwasherSpot = paletteActiveWallPlacement("right", ROOM_12x10, [ls3612], [], 24, 24, "appliance");
    expect(dishwasherSpot).toMatchObject({ x: 120, y: 36, rotation: 90 });
    const dishwasher = cab({ uid: "dw24", masterCode: "DW-24", description: "24 inch Dishwasher", placement: "appliance", ...dishwasherSpot!, width: 24, depth: 24, height: 34.5 });
    expect(hasCollision(dishwasher, [ls3612])).toBe(false);

    const drawerBaseSpot = paletteActiveWallPlacement("right", ROOM_12x10, [ls3612], [], 18, 24, "base");
    expect(drawerBaseSpot).toMatchObject({ x: 120, y: 36, rotation: 90 });
    const drawerBase = cab({ uid: "3db18", masterCode: "3-DB18", description: "18 inch Three Drawer Base", placement: "base", ...drawerBaseSpot!, width: 18, depth: 24, height: 34.5 });
	    expect(hasCollision(drawerBase, [ls3612])).toBe(false);
	  });

	  it("reserves BBC-36's physical 24-inch body on the adjoining wall and places DW-24 immediately after it", () => {
	    const blind = cab({
	      uid: "bbc36-top-left",
	      masterCode: "BBC-36",
	      description: "36 inch Blind Corner Base Cabinet",
	      placement: "base",
	      x: 0,
	      y: 0,
	      width: 36,
	      depth: 24,
	      height: 34.5,
	      rotation: 0,
	      swing: "right",
	      cornerType: "blind-corner",
	    });

	    expect(freeSegmentsOnWall("left", ROOM_12x10, [blind], [], 0.5, 0, "appliance"))
	      .toEqual([{ start: 24, length: 96 }]);
	    const dishwasherSpot = paletteActiveWallPlacement("left", ROOM_12x10, [blind], [], 24, 24, "appliance");
	    expect(dishwasherSpot).toMatchObject({ x: 0, y: 24, rotation: 90 });
	    const dishwasher = cab({
	      uid: "dw24-beside-bbc",
	      masterCode: "DW-24",
	      description: "24 inch Dishwasher",
	      placement: "appliance",
	      ...dishwasherSpot!,
	      width: 24,
	      depth: 24,
	      height: 34.5,
	    });
	    expect(cabinetPlacementCollisionDetail(dishwasher, [blind], ROOM_12x10)).toBeNull();
	  });

	  it("reserves the BBC's 24-inch adjoining-wall body plus its fixed 3-inch filler, so the next base begins at 27 inches", () => {
	    const blind = cab({
	      uid: "bbc36-top-left-with-filler",
	      masterCode: "BBC-36",
	      description: "36 inch Blind Corner Base Cabinet",
	      placement: "base",
	      x: 0,
	      y: 0,
	      width: 36,
	      depth: 24,
	      height: 34.5,
	      rotation: 0,
	      swing: "right",
	      cornerType: "blind-corner",
	    });
	    const fixedFiller = cab({
	      uid: "bbc36-required-filler",
	      masterCode: "BF-3",
	      description: '3 inch Required BBC Clearance Filler',
	      placement: "base",
	      x: 0,
	      y: 24,
	      width: 3,
	      depth: 24,
	      height: 34.5,
	      rotation: 90,
	      fillerForCabinetUid: blind.uid,
	      fillerPieceGroupId: `bbc-required-filler-${blind.uid}`,
	    });
	    const b15AtCorner = cab({
	      uid: "b15-corner-drop",
	      masterCode: "B15",
	      description: "15 inch Base Cabinet",
	      placement: "base",
	      ...wallPlacementAt(0, 15, 24, "left", ROOM_12x10),
	      width: 15,
	      depth: 24,
	      height: 34.5,
	    });

	    expect(freeSegmentsOnWall("left", ROOM_12x10, [blind, fixedFiller], [], 0.5, 0, "base"))
	      .toEqual([{ start: 27, length: 93 }]);
	    expect(paletteActiveWallPlacement("left", ROOM_12x10, [blind, fixedFiller], [], 15, 24, "base"))
	      .toMatchObject({ x: 0, y: 27, rotation: 90, wallOffset: 27 });

	    const fit = wallCabinetFitMeasure(b15AtCorner, ROOM_12x10, [blind, fixedFiller], []);
	    expect(fit).toMatchObject({ availableStart: 27, snapStart: 27, snapEnd: 42 });
	    expect(wallCabinetPlacementReason(b15AtCorner, ROOM_12x10, [blind, fixedFiller], []))
	      .toContain('snap the cabinet to 27"–42"');
	  });

	  it("reserves the adjoining BBC39 leg after a configured 3-inch pull, so DW-24 begins after the fixed 3-inch filler", () => {
	    // This is the real layout reported in the Designer: the BBC is pulled
	    // three inches along its owning top wall, while the linked filler stays
	    // fixed on the adjoining left wall at 24–27 inches.
	    const pulledBlind = cab({
	      uid: "bbc39-top-left-pulled",
	      masterCode: "BBC39",
	      description: "39 inch Blind Corner Base Cabinet",
	      placement: "base",
	      x: 3,
	      y: 0,
	      width: 39,
	      depth: 24,
	      height: 34.5,
	      rotation: 0,
	      swing: "right",
	      cornerType: "blind-corner",
	      pullMin: 3,
	      pullMax: 6,
	      blindPull: 3,
	      wallId: "top",
	      wallOffset: 3,
	    });
	    const fixedFiller = cab({
	      uid: "bbc39-required-filler",
	      masterCode: "BF3",
	      description: '3 inch Required BBC Clearance Filler',
	      placement: "base",
	      x: 0,
	      y: 24,
	      width: 3,
	      depth: 24,
	      height: 34.5,
	      rotation: 90,
	      fillerForCabinetUid: pulledBlind.uid,
	      fillerPieceGroupId: `bbc-required-filler-${pulledBlind.uid}`,
	    });
	    const assembly = [pulledBlind, fixedFiller];

	    expect(freeSegmentsOnWall("left", ROOM_12x10, assembly, [], 0.5, 0, "appliance"))
	      .toEqual([{ start: 27, length: 93 }]);
	    const dishwasherSpot = paletteActiveWallPlacement("left", ROOM_12x10, assembly, [], 24, 24, "appliance");
	    expect(dishwasherSpot).toMatchObject({ x: 0, y: 27, rotation: 90, wallOffset: 27 });
	    const dishwasher = cab({
	      uid: "dw24-after-pulled-bbc39",
	      masterCode: "DW-24",
	      description: "24 inch Dishwasher",
	      placement: "appliance",
	      ...dishwasherSpot!,
	      width: 24,
	      depth: 24,
	      height: 34.5,
	    });
	    expect(cabinetPlacementCollisionDetail(dishwasher, assembly, ROOM_12x10)).toBeNull();
	  });

	  it("offers the same LS3612-bounded right-wall opening to drag-to-add", () => {
    const ls3612 = cab({ uid: "ls3612-drag", masterCode: "LS3612", description: "36 inch Lazy Susan Corner Base", placement: "base", x: 108, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0 });
    const segments = freeSegmentsOnWall("right", ROOM_12x10, [ls3612], [], 0.5, 0, "base");
    const gaps = segments.map((segment) => ({ side: "right" as const, layer: "base" as const, start: segment.start, length: segment.length, center: segment.start + segment.length / 2, isStandardSize: true, isFillerSize: false }));
    const preview = wallGapFitPreview(gaps, 48, 24);
    expect(preview).toMatchObject({ status: "valid", containsTarget: true, snapStart: 36, availableSpan: 84 });
    const spot = wallPlacementAt(preview!.snapStart, 24, 24, "right", ROOM_12x10);
    const dishwasher = cab({ uid: "dw24-drag", masterCode: "DW-24", placement: "appliance", ...spot, width: 24, depth: 24, height: 34.5 });
    expect(hasCollision(dishwasher, [ls3612])).toBe(false);
  });

  it("advances the wall run past a door or window clearance instead of jumping into an earlier occupied or unrelated opening", () => {
    const existing = cab({ uid: "wall-a", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 30 });
    const window = opening({ uid: "window", kind: "window", side: "top", offset: 48, width: 36, height: 36, sill: 42 });
    expect(paletteActiveWallPlacement("top", ROOM_12x10, [existing], [window], 30, 12, "wall"))
      .toMatchObject({ x: 87, y: 0, rotation: 0 });
  });

  it("uses cabinet width as the run span on vertical walls and continues downward from the wall start", () => {
    const first = cab({ uid: "left-wall-a", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 30, rotation: 90 });
    expect(paletteActiveWallPlacement("left", ROOM_12x10, [first], [], 24, 12, "wall"))
      .toMatchObject({ x: 0, y: 30, rotation: 90 });
  });

  it("returns the whole wall when nothing blocks it", () => {
    const segs = freeSegmentsOnWall("top", ROOM_12x10, [], [], 9);
    expect(segs).toEqual([{ start: 0, length: 144 }]);
  });

  it("splits the wall into two segments around a centered door", () => {
    // 144" wall, 36" door centered at offset 54 → [0..54] and [90..144].
    const door = opening({ side: "top", offset: 54, width: 36 });
    const segs = freeSegmentsOnWall("top", ROOM_12x10, [], [door], 9);
    expect(segs.length).toBe(2);
    expect(segs[0]).toMatchObject({ start: 0, length: 54 });
    expect(segs[1]).toMatchObject({ start: 90, length: 54 });
  });

  it("subtracts existing base cabinets on the wall", () => {
    const existing = cab({ placement: "base", x: 0, y: 0, width: 48, depth: 24 });
    const segs = freeSegmentsOnWall("top", ROOM_12x10, [existing], [], 9);
    expect(segs.length).toBe(1);
    expect(segs[0]).toMatchObject({ start: 48, length: 96 });
  });

  it("drops segments narrower than minLen", () => {
    // Door leaves only 5" on the left, which is < minLen 9 → dropped.
    const door = opening({ side: "top", offset: 5, width: 36 });
    const segs = freeSegmentsOnWall("top", ROOM_12x10, [], [door], 9);
    expect(segs.every((s) => s.length >= 9)).toBe(true);
    expect(segs.some((s) => s.start === 0)).toBe(false);
  });

  it("works on a vertical (left) wall using the depth axis", () => {
    const door = opening({ side: "left", offset: 40, width: 30 });
    const segs = freeSegmentsOnWall("left", ROOM_12x10, [], [door], 9);
    // 120" deep wall, door 30 at 40 → [0..40] and [70..120].
    expect(segs[0]).toMatchObject({ start: 0, length: 40 });
    expect(segs[1]).toMatchObject({ start: 70, length: 50 });
  });

  // Regression: wall cabinets hang ABOVE base cabinets, so a fully base-filled
  // wall must still offer the whole run to a WALL cabinet. Previously the run
  // was blocked by bases regardless of layer, stranding new wall cabinets in
  // the room center (and dropping them from the Front-View elevation).
  it("ignores base cabinets when tiling the WALL layer", () => {
    const bases = [
      cab({ placement: "base", x: 0, y: 0, width: 48, depth: 24 }),
      cab({ placement: "base", x: 48, y: 0, width: 48, depth: 24 }),
      cab({ placement: "base", x: 96, y: 0, width: 48, depth: 24 }),
    ];
    const segs = freeSegmentsOnWall("top", ROOM_12x10, bases, [], 9, 0, "wall");
    expect(segs).toEqual([{ start: 0, length: 144 }]);
  });

  it("blocks the WALL layer only with other wall cabinets", () => {
    const wallCab = cab({ placement: "wall", x: 0, y: 0, width: 30, depth: 12 });
    const segs = freeSegmentsOnWall("top", ROOM_12x10, [wallCab], [], 9, 0, "wall");
    expect(segs).toEqual([{ start: 30, length: 114 }]);
  });

  it("tall cabinets block BOTH layers (floor-to-ceiling)", () => {
    const tall = cab({ placement: "tall", x: 0, y: 0, width: 24, depth: 24 });
    const wallSegs = freeSegmentsOnWall("top", ROOM_12x10, [tall], [], 9, 0, "wall");
    const baseSegs = freeSegmentsOnWall("top", ROOM_12x10, [tall], [], 9, 0, "base");
    expect(wallSegs).toEqual([{ start: 24, length: 120 }]);
    expect(baseSegs).toEqual([{ start: 24, length: 120 }]);
  });

  it("reserves wall-cabinet spans when finding a segment for a full-height refrigerator", () => {
    const wall = cab({ uid: "wall", placement: "wall", x: 0, y: 0, width: 36, depth: 12, height: 30 });
    const baseLayer = freeSegmentsOnWall("top", ROOM_12x10, [wall], [], 9, 0, "appliance");
    const refrigeratorLayer = freeSegmentsOnWall("top", ROOM_12x10, [wall], [], 9, 0, "appliance", true);

    expect(baseLayer).toEqual([{ start: 0, length: 144 }]);
    expect(refrigeratorLayer).toEqual([{ start: 36, length: 108 }]);
  });
});

describe("wallPlacementAt", () => {
  it("selects the nearest left or right collision-free position on a wall run", () => {
    const segments = [{ start: 0, length: 30 }, { start: 54, length: 42 }];
    expect(nearestAvailableWallStart(segments, 36, 24)).toBe(54);
    expect(nearestAvailableWallStart(segments, 20, 24)).toBe(6);
    expect(nearestAvailableWallStart([{ start: 0, length: 18 }], 0, 24)).toBeNull();
  });

  it("pins to the back wall and keeps the run-axis offset (top)", () => {
    const p = wallPlacementAt(24, 36, 24, "top", ROOM_12x10);
    expect(p).toMatchObject({ x: 24, y: 0, rotation: 0 });
  });
  it("pins to the front wall accounting for depth (bottom)", () => {
    const p = wallPlacementAt(24, 36, 24, "bottom", ROOM_12x10);
    expect(p).toMatchObject({ x: 24, y: 120 - 24, rotation: 0 });
  });
  it("rotates 90 and pins to the left wall (vertical run)", () => {
    const p = wallPlacementAt(40, 36, 24, "left", ROOM_12x10);
    expect(p).toMatchObject({ x: 0, y: 40, rotation: 90 });
  });

  it("restores an ERB36 at its complete measured 90-degree corner instead of seating only one leg after refresh", () => {
    const room: RoomData = {
      width: 144,
      depth: 120,
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 144, y: 0 },
        { id: "c", x: 144, y: 120 },
        { id: "d", x: 0, y: 120 },
      ],
      customWalls: [
        { id: "top", startVertexId: "a", endVertexId: "b" },
        { id: "right", startVertexId: "b", endVertexId: "c" },
        { id: "bottom", startVertexId: "c", endVertexId: "d" },
        { id: "left", startVertexId: "d", endVertexId: "a" },
      ],
    };
    // Pre-fix records owned the top run at its right endpoint. Reseating only
    // that one run retained a 0° L shape, leaving its right-wall leg outside.
    const staleErb = cab({
      uid: "saved-erb36", masterCode: "ERB36", description: "36 inch Easy Reach Corner Base",
      cornerType: "lazy-susan", placement: "base", width: 36, depth: 36, height: 34.5,
      x: 108, y: 0, rotation: 0, wallId: "top", wallOffset: 108,
    });

    const restored = clampCabinetToRoom(staleErb, room);

    // Both legs now use the top/right shared vertex. The saved owner may become
    // the right run, but the cabinet envelope stays completely inside the walls.
    expect(restored).toMatchObject({ x: 108, y: 0, rotation: 90, wallId: "right", wallOffset: 0 });
    expect(placedFootprint(restored)).toEqual({ w: 36, d: 36 });
  });
});

describe("rangeOvenClearanceViolations (corner filler rule)", () => {
  it("flags a range butting a cabinet at a wall corner with no filler", () => {
    // Range at the left corner (x=0), cabinet immediately to its right.
    const range = cab({ uid: "r", masterCode: "RANGE-30", placement: "appliance", x: 0, y: 0, width: 30, depth: 25 });
    const base = cab({ uid: "b", masterCode: "B-24", placement: "base", x: 30, y: 0, width: 24, depth: 24 });
    const bad = rangeOvenClearanceViolations([range, base], ROOM_12x10);
    expect(bad.has("r")).toBe(true);
  });

  it("does NOT flag when a clearance filler separates them", () => {
    const range = cab({ uid: "r", masterCode: "RANGE-30", placement: "appliance", x: 0, y: 0, width: 30, depth: 25 });
    // 3" gap (a filler would sit here) before the cabinet.
    const base = cab({ uid: "b", masterCode: "B-24", placement: "base", x: 33, y: 0, width: 24, depth: 24 });
    const bad = rangeOvenClearanceViolations([range, base], ROOM_12x10);
    expect(bad.has("r")).toBe(false);
  });

  it("does NOT flag a range in the middle of a wall (not at a corner)", () => {
    const range = cab({ uid: "r", masterCode: "RANGE-30", placement: "appliance", x: 60, y: 0, width: 30, depth: 25 });
    const base = cab({ uid: "b", masterCode: "B-24", placement: "base", x: 90, y: 0, width: 24, depth: 24 });
    const bad = rangeOvenClearanceViolations([range, base], ROOM_12x10);
    expect(bad.has("r")).toBe(false);
  });

  it("exposes a 3\" standard clearance filler width", () => {
    expect(RANGE_CLEARANCE_FILLER_IN).toBe(3);
  });
});

describe("autoPlaceRangeFillers (corner filler auto-placement)", () => {
  it("inserts a 3\" filler between a corner range and the adjacent cabinet", () => {
    const range = cab({ uid: "r", masterCode: "RANGE-30", placement: "appliance", x: 0, y: 0, width: 30, depth: 25 });
    const base = cab({ uid: "b", masterCode: "B-24", placement: "base", x: 30, y: 0, width: 24, depth: 24 });
    const { placed, added } = autoPlaceRangeFillers([range, base], ROOM_12x10);
    expect(added).toHaveLength(1);
    const filler = added[0];
    expect(filler.width).toBe(RANGE_CLEARANCE_FILLER_IN);
    expect(filler.placement).toBe("base");
    // The filler sits at the range's interior end (x = 30).
    expect(filler.x).toBe(30);
    // The previously-touching base was pushed out by 3".
    const movedBase = placed.find((p) => p.uid === "b")!;
    expect(movedBase.x).toBe(33);
    // The result no longer violates the clearance rule.
    expect(rangeOvenClearanceViolations(placed, ROOM_12x10).size).toBe(0);
  });

  it("handles a range at the far (end) corner, placing the filler on the interior side", () => {
    // Range at the right corner of a 144" wall (ends at x=144); cabinet to its left.
    const range = cab({ uid: "r", masterCode: "RANGE-30", placement: "appliance", x: 114, y: 0, width: 30, depth: 25 });
    const base = cab({ uid: "b", masterCode: "B-24", placement: "base", x: 90, y: 0, width: 24, depth: 24 });
    const { placed, added } = autoPlaceRangeFillers([range, base], ROOM_12x10);
    expect(added).toHaveLength(1);
    // Interior end of the range is x=114; filler sits just before it (114 - 3).
    expect(added[0].x).toBe(111);
    // The adjacent base was pulled left by 3" to open the gap.
    expect(placed.find((p) => p.uid === "b")!.x).toBe(87);
    expect(rangeOvenClearanceViolations(placed, ROOM_12x10).size).toBe(0);
  });

  it("is a no-op (same array reference) when there are no violations", () => {
    const range = cab({ uid: "r", masterCode: "RANGE-30", placement: "appliance", x: 0, y: 0, width: 30, depth: 25 });
    const base = cab({ uid: "b", masterCode: "B-24", placement: "base", x: 33, y: 0, width: 24, depth: 24 });
    const input = [range, base];
    const { placed, added } = autoPlaceRangeFillers(input, ROOM_12x10);
    expect(added).toHaveLength(0);
    expect(placed).toBe(input);
  });

  it("places a filler for each of two corner ranges on different walls", () => {
    // One range in the top-left corner, one in the left-wall top corner.
    const r1 = cab({ uid: "r1", masterCode: "RANGE-30", placement: "appliance", x: 0, y: 0, width: 30, depth: 25 });
    const b1 = cab({ uid: "b1", masterCode: "B-24", placement: "base", x: 30, y: 0, width: 24, depth: 24 });
    // Left-wall corner range (rotation 90 => vertical, so it belongs to the LEFT
    // wall). With rot90 the along-wall span is rotatedSize.d = the cabinet's
    // WIDTH (25), so r2 occupies y:0..25 flush in the top-left corner. b2 butts
    // its interior end at y=25 (gap 0 < 3") and is also vertical on the left
    // wall -> triggers a filler.
    const r2 = cab({ uid: "r2", masterCode: "RANGE-30", placement: "appliance", x: 0, y: 0, width: 25, depth: 30, rotation: 90 });
    const b2 = cab({ uid: "b2", masterCode: "B-24", placement: "base", x: 0, y: 25, width: 24, depth: 24, rotation: 90 });
    const { placed, added } = autoPlaceRangeFillers([r1, b1, r2, b2], ROOM_12x10);
    expect(added).toHaveLength(2);
    expect(rangeOvenClearanceViolations(placed, ROOM_12x10).size).toBe(0);
  });
});

	describe("wall cabinet elevation rules", () => {
	  it.each([
	    ["W3012", 12], ["W3015", 15], ["W3018", 18], ["W3021", 21], ["W3024", 24],
	    ["W-30-12", 12], ["W-30-15", 15], ["W-30-18", 18], ["W-30-21", 21], ["W-30-24", 24],
	  ] as const)("starts the 30-inch short upper %s at 72 inches", (masterCode, height) => {
	    const cabinet = cab({ placement: "wall", masterCode, width: 30, height });
    expect(ordinaryWallMountBottom(cabinet)).toBe(72);
    expect(elevationBox(cabinet)).toEqual({ bottom: 72, height });
  });

	  it("keeps the top-aligned default for other short wall cabinets", () => {
	    expect(ordinaryWallMountBottom(cab({ placement: "wall", masterCode: "W2418", width: 24, height: 18 }))).toBe(66);
  });

	  it("restores a legacy 12-inch upper to the fixed 72-inch datum without touching manual, stacker, or refrigerator exceptions", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
	    const legacyShortUpper = cab({ uid: "legacy-short", placement: "wall", masterCode: "W-30-12", height: 12, mountBottom: 90 });
	    const manualUpper = cab({ uid: "manual-upper", placement: "wall", masterCode: "W-30-24", height: 24, mountBottom: 60, mountBottomAdjusted: true });
	    const stacker = cab({ uid: "stacker", placement: "wall", masterCode: "W-3012GD", height: 12, mountBottom: 84 });
	    const refrigeratorUpper = cab({ uid: "refrigerator-upper", placement: "wall", masterCode: "WR3624", height: 24, mountBottom: 84 });

	    const normalized = normalizeStandardWallMounts(
	      [legacyShortUpper, manualUpper, stacker, refrigeratorUpper],
	      [],
	      room,
	    );

	    expect(normalized.find((cabinet) => cabinet.uid === "legacy-short")?.mountBottom).toBe(72);
	    expect(normalized.find((cabinet) => cabinet.uid === "manual-upper")?.mountBottom).toBe(60);
	    expect(normalized.find((cabinet) => cabinet.uid === "stacker")?.mountBottom).toBe(84);
	    expect(normalized.find((cabinet) => cabinet.uid === "refrigerator-upper")?.mountBottom).toBe(72);
	    expect(elevationBox(normalized.find((cabinet) => cabinet.uid === "refrigerator-upper")!, room).bottom).toBe(72);
	  });

	  it("restores a legacy W3024 microwave bridge to 72 inches through ordinary-wall normalization", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
	    const range = cab({
	      uid: "range", placement: "appliance", masterCode: "RANGE-30", description: "30 inch range",
	      x: 42, y: 0, width: 30, depth: 25, height: 36, mountBottom: 0,
	    });
	    const microwave = cab({
	      uid: "mw-30", placement: "appliance", masterCode: "MW-30", description: "Over-Range Microwave 30",
	      x: 42, y: 0, width: 30, depth: 15, height: 16, mountBottom: 56,
	    });
	    const bridge = cab({
	      uid: "mw-bridge", placement: "wall", masterCode: "W3024", description: "30 x 24 Wall Cabinet",
	      x: 42, y: 0, width: 30, depth: 12, height: 24, mountBottom: 76,
	    });
	    const normalized = normalizeStandardWallMounts([range, microwave, bridge], [], room).find((item) => item.uid === bridge.uid)!;

	    expect(normalized.mountBottom).toBe(72);
	    expect(normalized.mountBottomAdjusted).toBe(true);
	    expect(normalized.overRangeMicrowaveBridge).toBe(true);
	    expect(elevationBox(normalized, room)).toEqual({ bottom: 72, height: 24 });
	    expect(elevationBox(normalized, room).bottom + elevationBox(normalized, room).height).toBe(96);
	  });

	  it("mounts the no-dash WD18 countertop cabinet family at 36 inches and leaves ordinary dashed wall cabinets at 54 inches", () => {
    for (const [masterCode, height] of [["WD1848", 48], ["WD1854", 54], ["WD1860", 60]] as const) {
      const countertopCabinet = cab({ placement: "wall", width: 18, height, masterCode, numberOfDoors: 1, numberOfDrawers: 2 });
      expect(isWd18CountertopDrawerCabinet(countertopCabinet)).toBe(true);
      expect(elevationBox(countertopCabinet)).toEqual({ bottom: 36, height });
    }
    expect(isWd18CountertopDrawerCabinet({ masterCode: "WD-18-60", placement: "wall" })).toBe(false);
    expect(elevationBox(cab({ placement: "wall", width: 18, height: 60, masterCode: "WD-18-60" })).bottom).toBe(54);
  });

  it("repairs only the stale 54-inch WD18 mount while preserving an intentional custom mount", () => {
    const stale = cab({ uid: "wd-stale", placement: "wall", width: 18, height: 60, masterCode: "WD1860", numberOfDoors: 1, numberOfDrawers: 2, mountBottom: 54 });
    const custom = cab({ uid: "wd-custom", placement: "wall", width: 18, height: 60, masterCode: "WD1860", numberOfDoors: 1, numberOfDrawers: 2, mountBottom: 42 });
    const ordinary = cab({ uid: "ordinary", placement: "wall", width: 18, height: 60, masterCode: "WD-18-60", mountBottom: 54 });
    const normalized = normalizeWd18CountertopMounts([stale, custom, ordinary]);
    expect(normalized.map((item) => item.mountBottom)).toEqual([36, 42, 54]);
  });

  it("defines one tall upper door and two six-inch bottom drawers for every WD18 height", () => {
    expect(wd18CountertopFaceLayout({ masterCode: "WD1860", placement: "wall", numberOfDrawers: 2 }, 60)).toEqual({
      doorHeight: 48,
      drawerHeights: [6, 6],
    });
    expect(wd18CountertopFaceLayout({ masterCode: "WD1848", placement: "wall", numberOfDrawers: 2 }, 48)).toEqual({
      doorHeight: 36,
      drawerHeights: [6, 6],
    });
  });

  it("a standard 30in wall cabinet tops at 84in (bottom 54)", () => {
    const box = elevationBox(cab({ placement: "wall", width: 30, height: 30 }));
    expect(box.bottom).toBe(54);
    expect(box.bottom + box.height).toBe(84);
  });

	  it("a 12in ordinary wall cabinet starts at the owner-confirmed 72in datum", () => {
	    const box = elevationBox(cab({ placement: "wall", width: 30, height: 12, masterCode: "W-30-12", description: "30x12 Bridge Wall Cabinet" }));
	    expect(box.bottom).toBe(72);
	    expect(box.bottom + box.height).toBe(84);
  });

  it("a tall 36in wall cabinet is bottom-anchored at 54in (tops at 90)", () => {
    const box = elevationBox(cab({ placement: "wall", width: 30, height: 36, masterCode: "W-30-36", description: "30x36 Wall Cabinet" }));
    expect(box.bottom).toBe(54);
    expect(box.bottom + box.height).toBe(90);
  });

  it("a 42in wall cabinet is bottom-anchored at 54in (tops at 96)", () => {
    const box = elevationBox(cab({ placement: "wall", width: 30, height: 42, masterCode: "W-30-42", description: "30x42 Wall Cabinet" }));
    expect(box.bottom).toBe(54);
    expect(box.bottom + box.height).toBe(96);
  });

  it("a glass stacker sits ON TOP of the wall cabinet below (bottom at 84in)", () => {
    const box = elevationBox(cab({ placement: "wall", width: 30, height: 12, masterCode: "W-30-12GD", description: "30x12 Stacker Wall Cabinet with Glass Door" }));
    expect(box.bottom).toBe(84);
    expect(box.height).toBe(12);
  });

  it("a user mountBottom override always wins over the default rule", () => {
    const box = elevationBox(cab({ placement: "wall", width: 30, height: 30, mountBottom: 60 }));
    expect(box.bottom).toBe(60);
  });

  it("base cabinets always sit on the floor (bottom 0)", () => {
    expect(elevationBox(cab({ placement: "base", width: 24, height: 34.5 })).bottom).toBe(0);
  });

  it("a floor-dropped wall cabinet (base + mountBottom 4.5) stands on the toe kick", () => {
    // dropToFloor converts a wall cabinet to a base and stores mountBottom = 4.5,
    // so the box sits on a standard toe kick instead of flat on the slab.
    const box = elevationBox(cab({ placement: "base", width: 30, height: 30, mountBottom: 4.5 }));
    expect(box.bottom).toBe(4.5);
    expect(box.bottom + box.height).toBe(34.5);
  });

		  it("isStacker detects stacker cabinets and ignores plain wall cabinets", () => {
		    expect(isStacker({ description: "30x12 Stacker Wall Cabinet with Glass Door" })).toBe(true);
		    expect(isStacker({ masterCode: "GS-3012", height: 12 })).toBe(true);
		    for (const height of [12, 15, 18, 21, 24]) {
		      expect(isStacker({ masterCode: `W30${height}GD`, description: `30x${height} Glass Door Wall Cabinet`, height })).toBe(true);
		    }
		    expect(isStacker({ masterCode: "2412WDCGD", description: "24x12 WDC Glass Door Wall Cabinet", height: 12 })).toBe(true);
		    expect(isDiagonalCorner("SW-DCW2412-GD", "24x12 Diagonal Corner Wall Glass Door Cabinet")).toBe(true);
		    expect(isStacker({ masterCode: "WDC42PG", description: "24 inch Glass Door Wall Cabinet", height: 42 })).toBe(false);
		    expect(isStacker({ masterCode: "W-3024", description: "30 by 24 Double Door Wall Cabinet", subCategory: "Bridge / Stacker", height: 24 })).toBe(false);
		    expect(isStacker({ description: "30\" x 12\" Bridge Wall Cabinet" })).toBe(false);
		  });

	  it("stacks 2412WDCGD on its selected 2430WDC parent without changing the 24-inch width", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
	    const standardParent = cab({ uid: "standard-parent", placement: "wall", masterCode: "W2430", description: "24x30 Wall Cabinet", x: 12, y: 0, width: 24, depth: 12, height: 30, rotation: 0 });
	    const wdcParent = cab({ uid: "wdc-parent", placement: "wall", masterCode: "2430WDC", description: "24x30 Diagonal Corner Wall Cabinet", x: 72, y: 0, width: 24, depth: 24, height: 30, rotation: 0 });
	    const stacker = cab({ uid: "wdc-stacker", placement: "wall", masterCode: "2412WDCGD", description: "24x12 WDC Glass Door Wall Cabinet", x: 70, y: 0, width: 24, depth: 12, height: 12, rotation: 0 });
	    const resolved = glassStackerParentPlacement(stacker, [standardParent, wdcParent], room, "wdc-parent");

	    expect(resolved).toEqual({ ok: true, x: 72, y: 12, rotation: 0, mountBottom: 84, parentUid: "wdc-parent", parentCode: "2430WDC" });
	    if (resolved.ok) {
	      const placedStacker = { ...stacker, x: resolved.x, y: resolved.y, rotation: resolved.rotation, mountBottom: resolved.mountBottom, stackedOnCabinetUid: resolved.parentUid };
	      expect(placedStacker.width).toBe(24);
	      expect(elevationBox(placedStacker, room).bottom).toBe(84);
	      expect(hasCollision(placedStacker, [wdcParent])).toBe(false);
	    }
	  });

	  it("brings a 12-inch-deep glass stacker flush to the face of a 24-inch-deep upper and repairs old wall-flush saves", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
	    const parent = cab({ uid: "deep-parent", placement: "wall", masterCode: "WR3612", description: "36 inch Refrigerator Wall Cabinet", x: 30, y: 0, width: 36, depth: 24, height: 12, rotation: 0, mountBottom: 72 });
	    const legacyStacker = cab({ uid: "glass-stacker", placement: "wall", masterCode: "W3612GD", description: "36 inch Glass Door Stacker", x: 30, y: 0, width: 36, depth: 12, height: 12, rotation: 0, mountBottom: 84, stackedOnCabinetUid: parent.uid, glassDoor: true });

	    expect(glassStackerFrontFlushSpot(legacyStacker, parent, room)).toMatchObject({ x: 30, y: 12, rotation: 0 });
		    expect(normalizeGlassStackersToParentFronts([parent, legacyStacker], room)[1]).toMatchObject({
		      x: 30,
		      y: 12,
		      mountBottom: 84,
		      stackedOnCabinetUid: parent.uid,
		      depthPositionAdjusted: true,
		    });
		    expect(glassStackerFrontSnapTarget(legacyStacker, [parent, legacyStacker], room)).toMatchObject({
		      x: 30,
		      y: 12,
		      parentUid: parent.uid,
		      parentCode: "WR3612",
		      gapDepth: 12,
		      alreadyAligned: false,
		    });
		    const snapped = normalizeGlassStackersToParentFronts([parent, legacyStacker], room)[1];
		    expect(glassStackerFrontSnapTarget(snapped, [parent, snapped], room)?.alreadyAligned).toBe(true);
		  });

	  it("does not move a glass stacker when it already has the same depth as its parent", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
	    const parent = cab({ uid: "corner-parent", placement: "wall", masterCode: "DCW2430", x: 0, y: 0, width: 24, depth: 24, height: 30, rotation: 0, mountBottom: 54 });
	    const stacker = cab({ uid: "corner-stacker", placement: "wall", masterCode: "DCW2412GD", description: "24 inch Diagonal Corner Glass Stacker", x: 0, y: 0, width: 24, depth: 24, height: 12, rotation: 0, mountBottom: 84, stackedOnCabinetUid: parent.uid, glassDoor: true });

		    expect(glassStackerFrontFlushSpot(stacker, parent, room)).toMatchObject({ x: 0, y: 0, rotation: 0 });
		    expect(normalizeGlassStackersToParentFronts([parent, stacker], room)[1]).toBe(stacker);
		    expect(glassStackerFrontSnapTarget(stacker, [parent, stacker], room)).toBeNull();
		  });

	  it("stacks each supported 12-, 15-, 18-, 21-, and 24-inch glass height on the same matching wall cabinet", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
	    const parent = cab({ uid: "parent", placement: "wall", masterCode: "W3030", description: "30x30 Wall Cabinet", x: 36, y: 0, width: 30, depth: 12, height: 30, rotation: 0 });

	    for (const height of [12, 15, 18, 21, 24]) {
	      const stacker = cab({ uid: `stacker-${height}`, placement: "wall", masterCode: `W30${height}GD`, description: `30x${height} Glass Door Wall Cabinet`, x: 34, y: 0, width: 30, depth: 12, height, rotation: 0 });
	      const resolved = glassStackerParentPlacement(stacker, [parent], room, "parent");
	      expect(resolved).toMatchObject({ ok: true, x: 36, y: 0, mountBottom: 84, parentUid: "parent", parentCode: "W3030" });
	      if (resolved.ok) {
	        expect(hasCollision({ ...stacker, ...resolved }, [parent])).toBe(false);
	      }
	    }
	  });

	  describe("catalog-click glass stacker on a 24-inch deep wall cabinet (false back rule)", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
	    const fridgeUpper = (extra: Partial<PlacedCabinet> = {}) => cab({ uid: "wr", cabinetId: 9390185, masterCode: "WR3612(W361224)", description: '36"X 12"Refrigerator Wall Cabinet Double Doors', placement: "wall", x: 54, y: 0, width: 36, depth: 24, height: 12, rotation: 0, mountBottom: 72, ...extra });
	    const stackerAt = (x: number, y: number, extra: Partial<PlacedCabinet> = {}) => cab({ uid: "glass-stacker-preview", cabinetId: 9360119, masterCode: "W3612GD", description: '36"x 12" Double Door Glass Door Wall Cabinet', category: "Wall", subCategory: "Standard Wall", placement: "wall", x, y, width: 36, depth: 12, height: 12, rotation: 0, ...extra });
	    it("is refused today when the placeholder spot falls to the room centre (Back wall row full)", () => {
	      // Reproduces the live toast: the add flow only has a placeholder spot, which reads as the Front wall.
	      const placeholder = stackerAt(54, 54);
	      expect(glassStackerParentPlacement(placeholder, [fridgeUpper()], room, "wr")).toEqual({ ok: false, reason: "no-matching-parent" });
	    });
	    it("snaps a 12-inch glass stacker on the selected 24-inch deep wall cabinet, flush with its face, on any wall", () => {
	      const placeholder = stackerAt(54, 54);
	      const resolved = glassStackerParentPlacement(placeholder, [fridgeUpper()], room, "wr", { anyWall: true, preferredSide: "top" });
	      expect(resolved).toEqual({ ok: true, x: 54, y: 12, rotation: 0, mountBottom: 84, parentUid: "wr", parentCode: "WR3612(W361224)" });
	      if (!resolved.ok) return;
	      // Stacker back is 12" off the wall and its face (y + 12) equals the parent face (0 + 24).
	      expect(resolved.y + 12).toBe(24);
	      const placed = { ...placeholder, x: resolved.x, y: resolved.y, rotation: resolved.rotation, mountBottom: resolved.mountBottom, stackedOnCabinetUid: resolved.parentUid, depthPositionAdjusted: true };
	      expect(elevationBox(placed, room).bottom).toBe(84);
	      expect(hasCollision(placed, [fridgeUpper()])).toBe(false);
	      // The 12" gap behind it is the false back.
	      expect(normalizeGlassStackersToParentFronts([fridgeUpper(), placed], room)[1]).toBe(placed);
	      expect(glassStackerFrontSnapTarget(placed, [fridgeUpper(), placed], room)?.alreadyAligned).toBe(true);
	    });
	    it("finds the parent on a side wall too, flush with that wall's room-facing face", () => {
	      const leftParent = fridgeUpper({ uid: "wr-left", x: 0, y: 40, rotation: 90 });
	      const placeholder = stackerAt(54, 54);
	      const resolved = glassStackerParentPlacement(placeholder, [leftParent], room, null, { anyWall: true, preferredSide: "top" });
	      expect(resolved).toMatchObject({ ok: true, parentUid: "wr-left", mountBottom: 84, rotation: 90 });
	      if (resolved.ok) expect(hasCollision({ ...placeholder, x: resolved.x, y: resolved.y, rotation: resolved.rotation, mountBottom: resolved.mountBottom }, [leftParent])).toBe(false);
	    });
	    it("puts a second glass cabinet on the next free matching cabinet, not on top of the first stacker", () => {
	      const first = fridgeUpper({ uid: "wr-a", x: 10 });
	      const second = fridgeUpper({ uid: "wr-b", x: 80 });
	      const stackedOnFirst = stackerAt(10, 12, { uid: "stk-a", mountBottom: 84, stackedOnCabinetUid: "wr-a", depthPositionAdjusted: true });
	      const resolved = glassStackerParentPlacement(stackerAt(54, 54), [first, second, stackedOnFirst], room, null, { anyWall: true, preferredSide: "top" });
	      expect(resolved).toMatchObject({ ok: true, parentUid: "wr-b", x: 80, y: 12 });
	    });
	    it("keeps the active wall first and still prefers the selected cabinet", () => {
	      const backParent = fridgeUpper({ uid: "wr-back", x: 10 });
	      const leftParent = fridgeUpper({ uid: "wr-left", x: 0, y: 40, rotation: 90 });
	      const placeholder = stackerAt(54, 54);
	      expect(glassStackerParentPlacement(placeholder, [leftParent, backParent], room, null, { anyWall: true, preferredSide: "top" })).toMatchObject({ ok: true, parentUid: "wr-back" });
	      expect(glassStackerParentPlacement(placeholder, [leftParent, backParent], room, "wr-left", { anyWall: true, preferredSide: "top" })).toMatchObject({ ok: true, parentUid: "wr-left" });
	    });
	    it("never matches a different family or width, and still reports the ceiling", () => {
	      expect(glassStackerParentPlacement(stackerAt(54, 54), [fridgeUpper({ width: 30 })], room, null, { anyWall: true })).toEqual({ ok: false, reason: "no-matching-parent" });
	      expect(glassStackerParentPlacement(stackerAt(54, 54), [fridgeUpper({ masterCode: "WDC3612" })], room, null, { anyWall: true })).toEqual({ ok: false, reason: "no-matching-parent" });
	      // Parent hung 6" higher than the datum: 78 + 12 = 90, so a 12" stacker would reach 102 on a 96" ceiling.
	      expect(glassStackerParentPlacement(stackerAt(54, 54), [fridgeUpper({ mountBottom: 78 })], room, null, { anyWall: true })).toMatchObject({ ok: false, reason: "ceiling", parentCode: "WR3612(W361224)", requiredTop: 102, ceiling: 96 });
	    });
	    it("without the option keeps the strict same-wall rule used by drag-drop and bulk placement", () => {
	      expect(glassStackerParentPlacement(stackerAt(54, 0), [fridgeUpper()], room, "wr")).toMatchObject({ ok: true, parentUid: "wr", y: 12 });
	      expect(glassStackerParentPlacement(stackerAt(54, 108), [fridgeUpper()], room, "wr")).toEqual({ ok: false, reason: "no-matching-parent" });
	    });
	  });
	  it("blocks a glass stacker when its matching parent would push it through the ceiling", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
	    const parent = cab({ uid: "parent", placement: "wall", masterCode: "W3042", description: "30x42 Wall Cabinet", x: 24, y: 0, width: 30, depth: 12, height: 42, rotation: 0 });
	    const stacker = cab({ uid: "stacker", placement: "wall", masterCode: "W3012GD", description: "30x12 Glass Door Wall Cabinet", x: 24, y: 0, width: 30, depth: 12, height: 12, rotation: 0 });

	    expect(glassStackerParentPlacement(stacker, [parent], room, "parent")).toEqual({
	      ok: false,
	      reason: "ceiling",
	      parentCode: "W3042",
	      requiredTop: 108,
	      ceiling: 96,
	    });
	  });

  // ── Taller-ceiling behavior ───────────────────────────────────────────────
	  it("keeps a 12in ordinary wall cabinet at 72in on a standard 8ft ceiling", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
	    const bridge = cab({ placement: "wall", width: 30, height: 12, masterCode: "W-30-12", description: "Bridge Wall" });
	    const box = elevationBox(bridge, room);
	    expect(box.bottom).toBe(72);
	    expect(box.bottom + box.height).toBe(84);
  });

	  it("keeps a 12in ordinary wall cabinet at its fixed 72in datum on a 10ft ceiling", () => {
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 120 };
	    const bridge = cab({ placement: "wall", width: 30, height: 12, masterCode: "W-30-12", description: "Bridge Wall" });
	    const box = elevationBox(bridge, room);
	    expect(box.bottom).toBe(72);
	    expect(box.bottom + box.height).toBe(84);
  });

  it("hangs a glass stacker from the higher top line on a 9ft ceiling", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
    // topLine = 108 - 12 = 96; stacker sits ON that line.
    const stacker = cab({ placement: "wall", width: 30, height: 12, masterCode: "W-30-12GD", description: "Stacker Wall Cabinet with Glass Door" });
    const box = elevationBox(stacker, room);
    expect(box.bottom).toBe(96);
    expect(box.bottom + box.height).toBe(108);
  });

  it("leaves a standard 30in upper bottom-anchored at 54in regardless of ceiling", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 120 };
    const std = cab({ placement: "wall", width: 30, height: 30, masterCode: "W-30-30", description: "30x30 Wall" });
    const box = elevationBox(std, room);
    expect(box.bottom).toBe(54);
    expect(box.bottom + box.height).toBe(84);
  });

  it("wallCabinetTopLine returns 84 for 8ft and rises with taller ceilings", () => {
    expect(wallCabinetTopLine({ ceilingHeight: 96 })).toBe(84);
    expect(wallCabinetTopLine({ ceilingHeight: 108 })).toBe(96);
    expect(wallCabinetTopLine({ ceilingHeight: 120 })).toBe(108);
    expect(wallCabinetTopLine(undefined)).toBe(84);
  });
});

describe("wall cabinet clearance from doors/windows", () => {
  const room: RoomData = { width: 144, depth: 120 };
  // A window centered on the top wall: 36" wide, centered -> offset 54..90.
  function topWindow(offset: number, width = 36): WallOpening {
    return { uid: "win", kind: "window", label: "Window", side: "top", offset, width, height: 36, sill: 40 };
  }

  it("flags a wall cabinet sitting within 3\" of a window", () => {
    // Window 54..90. Wall cabinet ending at 92 is 2" away -> violation.
    const wall = cab({ uid: "w1", placement: "wall", x: 92, y: 0, width: 30, depth: 12 });
    const bad = wallOpeningClearanceViolations([wall], [topWindow(54)], room);
    expect(bad.has("w1")).toBe(true);
  });

  it("passes a wall cabinet that keeps >= 3\" from the window", () => {
    // Window 54..90. Wall cabinet starting at 93 (3" clear) -> ok.
    const wall = cab({ uid: "w2", placement: "wall", x: 93, y: 0, width: 30, depth: 12 });
    const bad = wallOpeningClearanceViolations([wall], [topWindow(54)], room);
    expect(bad.has("w2")).toBe(false);
  });

  it("ignores base cabinets (only wall cabinets must clear openings)", () => {
    const base = cab({ uid: "b1", placement: "base", x: 91, y: 0, width: 24, depth: 24 });
    const bad = wallOpeningClearanceViolations([base], [topWindow(54)], room);
    expect(bad.has("b1")).toBe(false);
  });

  it("uses the standard 3\" clearance default", () => {
    expect(WALL_OPENING_CLEARANCE_IN).toBe(3);
  });

  it("pads openings by the clearance when computing wall free segments", () => {
    // Window 54..90 on a 144 wall. With 3" clearance the blocked band becomes
    // 51..93, so the right-hand free segment starts at 93 (not 90).
    const segs = freeSegmentsOnWall("top", room, [], [topWindow(54)], 9, WALL_OPENING_CLEARANCE_IN, "wall");
    const right = segs.find((s) => s.start >= 90);
    expect(right).toBeDefined();
    expect(right!.start).toBeCloseTo(93, 1);
  });

  it("allows a short bridge above a window when it is vertically clear", () => {
    const bridge = cab({ uid: "bridge", placement: "wall", x: 54, y: 0, width: 36, depth: 12, height: 18, mountBottom: 79 });
    const opening = topWindow(54);
    expect(wallOpeningClearanceViolations([bridge], [opening], room).has("bridge")).toBe(false);
    const segments = freeSegmentsOnWall("top", room, [], [opening], 9, WALL_OPENING_CLEARANCE_IN, "wall", false, bridge);
    expect(nearestAvailableWallStart(segments, 54, 36)).toBe(54);
  });

  it("continues to block a short wall cabinet that overlaps the window elevation", () => {
    const bridge = cab({ uid: "bridge-low", placement: "wall", x: 54, y: 0, width: 36, depth: 12, height: 18, mountBottom: 66 });
    expect(wallOpeningClearanceViolations([bridge], [topWindow(54)], room).has("bridge-low")).toBe(true);
  });

  it("centers a W-36-15 above its sink window without colliding with a neighboring upper", () => {
    const sinkBase = cab({ uid: "sink-base", masterCode: "SB-36", description: "Sink Base 36", placement: "base", x: 54, y: 0, width: 36, depth: 24, height: 34.5 });
    const leftUpper = cab({ uid: "w-12-42", masterCode: "W-12-42", description: "12x42 Wall", placement: "wall", x: 42, y: 0, width: 12, depth: 12, height: 42 });
    const candidate = cab({ uid: "w-36-15", masterCode: "W-36-15", description: "36x15 Double Door Wall", placement: "wall", x: 0, y: 0, width: 36, depth: 12, height: 15 });
    const opening = topWindow(54);

    expect(overSinkWindowStart(candidate, [sinkBase, leftUpper], [opening], room)).toBe(54);
    const mountBottom = bridgeMountBottomAboveWindow({ ...candidate, x: 54 }, [opening], room);
    expect(mountBottom).toBe(79);
    const mountedBridge = { ...candidate, x: 54, mountBottom: mountBottom! };
    expect(hasCollision(mountedBridge, [leftUpper])).toBe(false);
    const segments = freeSegmentsOnWall("top", room, [leftUpper], [opening], 9, WALL_OPENING_CLEARANCE_IN, "wall", false, mountedBridge);
    expect(nearestAvailableWallStart(segments, 54, 36)).toBe(54);
  });

  it("keeps a W-36-15 at the required 70-inch bottom above a sink without a window", () => {
    const sinkBase = cab({ uid: "sink-base", masterCode: "SB-36", description: "Sink Base 36", placement: "base", x: 54, y: 0, width: 36, depth: 24, height: 34.5 });
    const candidate = cab({ uid: "w-36-15", masterCode: "W-36-15", placement: "wall", x: 54, y: 0, width: 36, depth: 12, height: 15 });
    expect(overSinkWindowStart(candidate, [sinkBase], [], room)).toBe(54);
    expect(overSinkWallMountBottom(candidate, [sinkBase], [], room)).toBe(OVER_SINK_WALL_MOUNT_BOTTOM);
  });

  it("raises a short over-sink cabinet only to the window clearance height", () => {
    const sinkBase = cab({ uid: "sink-base", masterCode: "SB-36", description: "Sink Base 36", placement: "base", x: 54, y: 0, width: 36, depth: 24, height: 34.5 });
    const candidate = cab({ uid: "w-36-15", masterCode: "W-36-15", placement: "wall", x: 54, y: 0, width: 36, depth: 12, height: 15 });
    expect(overSinkWallMountBottom(candidate, [sinkBase], [topWindow(54)], room)).toBe(79);
  });

  it("rejects an over-sink cabinet when window clearance cannot fit below the ceiling", () => {
    const lowRoom: RoomData = { ...room, ceilingHeight: 90 };
    const sinkBase = cab({ uid: "sink-base", masterCode: "SB-36", description: "Sink Base 36", placement: "base", x: 54, y: 0, width: 36, depth: 24, height: 34.5 });
    const candidate = cab({ uid: "w-36-15", masterCode: "W-36-15", placement: "wall", x: 54, y: 0, width: 36, depth: 12, height: 15 });
    const highWindow = { ...topWindow(54), sill: 76, height: 10 };
    expect(overSinkWindowClearanceBlocked(candidate, [sinkBase], [highWindow], lowRoom)).toBe(true);
    expect(overSinkWindowClearanceMeasure(candidate, [sinkBase], [highWindow], lowRoom)).toMatchObject({ side: "top", openingTop: 86, clearance: 3, requiredBottom: 89, cabinetHeight: 15, requiredTop: 104, ceiling: 90, shortage: 14 });
    expect(overSinkWallMountBottom(candidate, [sinkBase], [highWindow], lowRoom)).toBe(OVER_SINK_WALL_MOUNT_BOTTOM);
  });

	  it("lowers a saved over-sink cabinet to 70 inches after its window is removed", () => {
    const sinkBase = cab({ uid: "sink-base", masterCode: "SB-36", description: "Sink Base 36", placement: "base", x: 54, y: 0, width: 36, depth: 24, height: 34.5 });
    const staleBridge = cab({ uid: "w-36-15", masterCode: "W-36-15", placement: "wall", x: 54, y: 0, width: 36, depth: 12, height: 15, mountBottom: 81 });
    const normalized = normalizeOverSinkWallMounts([sinkBase, staleBridge], [], room);
	    expect(normalized.find((cabinet) => cabinet.uid === "w-36-15")?.mountBottom).toBe(OVER_SINK_WALL_MOUNT_BOTTOM);
	  });

	  it("preserves the owner-reported manual W-36-24 D-pad move from bottom 70 to 71 instead of normalizing it back", () => {
	    const sinkBase = cab({ uid: "sink-base-manual", masterCode: "SB-36", description: "Sink Base 36", placement: "base", x: 54, y: 0, width: 36, depth: 24, height: 34.5 });
	    const manuallyRaised = cab({ uid: "w-36-24-manual", masterCode: "W-36-24", placement: "wall", x: 54, y: 0, width: 36, depth: 12, height: 24, mountBottom: 71, mountBottomAdjusted: true });
	    const placed = [sinkBase, manuallyRaised];
	    const normalized = normalizeOverSinkWallMounts(placed, [], room);
	    expect(normalized).toBe(placed);
	    expect(normalized[1]).toBe(manuallyRaised);
	    expect(normalized[1].mountBottom).toBe(71);
	  });

  it("still blocks a short cabinet that occupies the neighboring upper's elevation band", () => {
    const leftUpper = cab({ uid: "w-12-42", masterCode: "W-12-42", description: "12x42 Wall", placement: "wall", x: 54, y: 0, width: 36, depth: 12, height: 42 });
    const sameBand = cab({ uid: "same-band", masterCode: "W-36-15", placement: "wall", x: 54, y: 0, width: 36, depth: 12, height: 15, mountBottom: 69 });
    expect(hasCollision(sameBand, [leftUpper])).toBe(true);
  });
});

describe("blind corner pull spec", () => {
  it("pulls a BBC up to six inches from the corner while keeping its back on the wall", () => {
    const blind: PlacedCabinet = {
      uid: "bbc-pull", cabinetId: 1, masterCode: "BBC36", description: "36 inch Blind Corner Base",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
      wallId: "top", wallOffset: 0, numberOfDoors: 1, numberOfDrawers: 1,
    };
    const pulled = blindCornerPullPlacement(blind, ROOM_12x10, 6);
    expect(pulled).toMatchObject({ x: 6, y: 0, wallId: "top", wallOffset: 6, blindPull: 6 });
  });

  it("clamps a requested blind-corner pull to the three-to-six-inch trade range", () => {
    const blind = {
      uid: "bbc-pull", masterCode: "BBC36", description: "Blind Corner Base", placement: "base",
      x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0, wallId: "top", wallOffset: 0,
    } as PlacedCabinet;
    expect(blindCornerPullPlacement(blind, ROOM_12x10, 9)?.blindPull).toBe(6);
    expect(blindCornerPullPlacement(blind, ROOM_12x10, 1)?.blindPull).toBe(3);
  });

  it("blindPullRange defaults to 3-6 when spec missing", () => {
    // With the corrected behavior, blindPullRange always returns a value
    // (defaults to 3-6") so cabinets can always be placed.
    expect(blindPullRange({})).toEqual({ min: 3, max: 6 });
    expect(blindPullRange({ pullMin: 3 })).toEqual({ min: 3, max: 6 });
    expect(blindPullRange({ pullMax: 9 })).toEqual({ min: 3, max: 6 });
  });

  it("blindPullRange normalizes swapped min/max", () => {
    expect(blindPullRange({ pullMin: 9, pullMax: 3 })).toEqual({ min: 3, max: 6 });
    expect(blindPullRange({ pullMin: 3, pullMax: 9 })).toEqual({ min: 3, max: 6 });
  });

  it("does not flag missing-spec when defaults apply", () => {
    // Since defaults always apply (3-6"), no BBC is ever flagged as missing-spec.
    const v = blindCornerSpecViolations([
      cab({ uid: "bc", masterCode: "BBC-36", placement: "base", width: 36 }),
    ]);
    expect(v.has("bc")).toBe(false);
  });

  it("passes a blind corner whose installed pull is within [min,max]", () => {
    const v = blindCornerSpecViolations([
      cab({ uid: "bc", masterCode: "BBC-36", placement: "base", width: 37, pullMin: 3, pullMax: 9 }),
    ]);
    expect(v.has("bc")).toBe(false);
  });

  it("ignores non-blind cabinets", () => {
    const v = blindCornerSpecViolations([
      cab({ uid: "b", masterCode: "B-24", placement: "base", width: 24 }),
    ]);
    expect(v.size).toBe(0);
  });

  it("does not treat the owned 3-inch required filler as a BBC collision", () => {
    const room: RoomData = { width: 144, depth: 120 };
    const blind: PlacedCabinet = {
      uid: "bbc-owner", cabinetId: 1, masterCode: "BBC36", description: "Blind Corner Base",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
      numberOfDoors: 1, numberOfDrawers: 1,
    };
    const filler: PlacedCabinet = {
      uid: "bbc-filler", cabinetId: 2, masterCode: "F342", description: '3" Filler — required BBC clearance',
      category: "Filler", subCategory: "Filler", placement: "base", x: 0, y: 23.75,
      width: 3, nominalWidth: 3, depth: 24, height: 34.5, rotation: 90,
      numberOfDoors: 0, numberOfDrawers: 0, fillerForCabinetUid: blind.uid,
      fillerPieceGroupId: "bbc-required-filler-bbc-owner",
    };
    expect(cabinetPlacementCollisionDetail(filler, [blind], room)).toBeNull();
    expect(cabinetPlacementCollisionDetail({ ...filler, width: 3.25 }, [blind], room)).not.toBeNull();
    expect(cabinetPlacementCollisionDetail({ ...filler, fillerForCabinetUid: "other-bbc" }, [blind], room)).not.toBeNull();
  });
  it("does not flag a legacy 3-inch BBC filler with a quarter-inch boundary overlap", () => {
    const blind = cab({ uid: "bbc-owner", masterCode: "BBC36", description: "Blind Corner Base", placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5 });
    const legacyFiller = cab({ uid: "legacy-f342", masterCode: "F342", description: '3" Filler', category: "Filler", subCategory: "Filler", placement: "base", x: 0, y: 23.75, width: 3, depth: 24, height: 34.5, rotation: 90 });
    expect(cabinetPlacementCollisionDetail(legacyFiller, [blind], { width: 144, depth: 120 })).toBeNull();
    expect(blindCornerViolations([blind, legacyFiller])).not.toContain(blind.uid);
    expect(cabinetPlacementCollisionDetail({ ...legacyFiller, width: 4 }, [blind], { width: 144, depth: 120 })).not.toBeNull();
  });
	  it("does not turn the allowed legacy BBC/F342 seam into the exact-position rejection message", () => {
	    const blind = cab({ uid: "bbc-owner", masterCode: "BBC36", description: "Blind Corner Base", placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5 });
	    const legacyFiller = cab({ uid: "legacy-f342", masterCode: "F342", description: '3" Filler', category: "Filler", subCategory: "Filler", placement: "base", x: 0, y: 23.75, width: 3, depth: 24, height: 34.5, rotation: 90 });
	    expect(wallCabinetPlacementReason(blind, { width: 144, depth: 120 }, [legacyFiller], [])).toBeNull();
	  });

	  it("snaps a BBC36 to an adjacent F342 seam only when the selected pull leaves a full physical body span", () => {
	    const room: RoomData = { width: 144, depth: 120 };
	    const blind = cab({
	      uid: "bbc-snap", masterCode: "BBC36", description: "Blind Corner Base", placement: "base",
	      x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
	      wallId: "top", wallOffset: 0, blindPull: 3,
	    });
	    const correctlySpacedFiller = cab({
	      uid: "f342-at-39", masterCode: "F342", description: '3" Filler', category: "Filler", subCategory: "Filler",
	      placement: "base", x: 39, y: 0, width: 3, depth: 24, height: 34.5, rotation: 0, wallId: "top", wallOffset: 39,
	    });
	    expect(resolveBaseBlindCornerFillerSnap(blind, room, [correctlySpacedFiller], [])).toMatchObject({
	      x: 3, y: 0, rotation: 0, wallId: "top", wallOffset: 3,
	    });

	    const nominalOnlyOpening = { ...correctlySpacedFiller, uid: "f342-at-36", x: 36, wallOffset: 36 };
	    // A BBC body is 36 inches and must also retain its chosen three-inch pull;
	    // a 0–36 nominal gap is not silently treated as a valid 3–39 body span.
	    expect(resolveBaseBlindCornerFillerSnap(blind, room, [nominalOnlyOpening], [])).toBeNull();
	  });
});

describe("blindCornerAutoFiller — auto 3in filler opposite the pull", () => {
  const room: RoomData = { width: 144, depth: 120 };
  let n = 0;
  const uid = () => `f${n++}`;

  it("places a base filler just past a blind corner seated at the start corner of the top wall", () => {
    const blind = cab({ masterCode: "BBC-36", placement: "base", x: 0, y: 0, width: 33, depth: 24, rotation: 0 });
    const res = blindCornerAutoFiller(blind, room, uid);
	    expect(res.ambiguous).toBe(false);
	    expect(res.filler).not.toBeNull();
	    // The supplier row stores 33, but BBC-36's authoritative physical run is
	    // 36 inches; the filler begins at that real open-side edge.
	    expect(res.filler!.x).toBe(0);
    expect(res.filler!.y).toBe(24);
    expect(res.filler!.width).toBe(BLIND_CORNER_FILLER_WIDTH_IN);
    expect(res.filler!.placement).toBe("base");
  });

  it("places the filler before the cabinet when the blind corner is at the far end of the wall", () => {
    // cabinet's far end is flush with the right end of the top wall (144)
	    const blind = cab({ masterCode: "BBC-36", placement: "base", x: 144 - 36, y: 0, width: 33, depth: 24, rotation: 0 });
	    const res = blindCornerAutoFiller(blind, room, uid);
	    expect(res.ambiguous).toBe(false);
	    // filler sits just before the near end of the canonical 36-inch run.
	    expect(res.filler!.x).toBe(144 - STD.BASE_DEPTH);
	    expect(res.filler!.y).toBe(24);
	    expect(res.filler!.rotation).toBe(90);
  });

  it("is ambiguous (no filler) when the blind corner is not seated in a corner", () => {
    const blind = cab({ masterCode: "BBC-36", placement: "base", x: 60, y: 0, width: 33, depth: 24, rotation: 0 });
    const res = blindCornerAutoFiller(blind, room, uid);
    expect(res.ambiguous).toBe(true);
    expect(res.filler).toBeNull();
  });

  it("returns no filler for a non-blind cabinet", () => {
    const reg = cab({ masterCode: "B-24", placement: "base", x: 0, y: 0 });
    const res = blindCornerAutoFiller(reg, room, uid);
    expect(res.filler).toBeNull();
    expect(res.ambiguous).toBe(false);
  });
});


describe("diagonal corner footprint", () => {
  it("detects diagonal corner cabinets by code and description", () => {
    expect(isDiagonalCorner("DCW-2424")).toBe(true); // diagonal corner wall
    expect(isDiagonalCorner("WDC-24")).toBe(true);
    expect(isDiagonalCorner("DCB-36")).toBe(true); // diagonal corner base
    expect(isDiagonalCorner("AW-12")).toBe(false); // angled wall END, not a room corner
    expect(isDiagonalCorner("X-99", "Diagonal Corner Wall Cabinet")).toBe(true);
    expect(isDiagonalCorner("B-24", "Base 24 inch")).toBe(false); // ordinary base
    expect(isDiagonalCorner("BBC-36", "Blind Corner Base")).toBe(false); // blind, not diagonal
  });

  it("gives a diagonal corner wall cabinet a SQUARE footprint (depth == width), not the shallow 12\" wall depth", () => {
    const d = footprintDepth({
      id: 1, masterCode: "DCW-2424", description: "Diagonal Corner Wall",
      category: "Wall", subCategory: null, width: "24", height: "30", depth: "12",
      placement: "wall", numberOfDoors: 1, numberOfDrawers: 0, isCornerCabinet: true,
    });
    expect(d).toBe(24); // square bounding box, NOT the 12" wall depth
  });

  it("gives a diagonal corner BASE cabinet a square footprint matching its width", () => {
    const d = footprintDepth({
      id: 2, masterCode: "DCB-36", description: "Diagonal Corner Base",
      category: "Base", subCategory: null, width: "36", height: "34.5", depth: "24",
      placement: "base", numberOfDoors: 1, numberOfDrawers: 0, isCornerCabinet: true,
    });
    expect(d).toBe(36);
  });

  it("leaves ordinary wall/base cabinets at their normal shallow depth", () => {
    expect(footprintDepth({
      id: 3, masterCode: "W-2430", description: "Wall 24x30",
      category: "Wall", subCategory: null, width: "24", height: "30", depth: "12",
      placement: "wall", numberOfDoors: 1, numberOfDrawers: 0, isCornerCabinet: false,
    })).toBe(12);
    expect(footprintDepth({
      id: 4, masterCode: "B-24", description: "Base 24",
      category: "Base", subCategory: null, width: "24", height: "34.5", depth: "24",
      placement: "base", numberOfDoors: 1, numberOfDrawers: 0, isCornerCabinet: false,
    })).toBe(24);
  });
});


describe("door swing (hinge side)", () => {
  it("defaults a single-door base to a Left hinge", () => {
    const p = cab({ masterCode: "B-18", description: "Base 18 1 Door", numberOfDoors: 1 });
    expect(resolveSwing(p)).toBe("left");
  });

  it("keeps hinge editing available for a legacy B-15 placement with an explicit single-door description", () => {
    const p = cab({ masterCode: "B-15", description: '15" Single Door Single Drawer Base Cabinet with Adjustable Shelf', numberOfDoors: 0, numberOfDrawers: 1, swing: "none" });
    expect(hasDoorSwing(p)).toBe(true);
    expect(resolveSwing(p)).toBe("left");
  });

  it("defaults a two-door base to a double door (no single hinge side)", () => {
    const p = cab({ masterCode: "B-36", description: "Base 36 2 Door", numberOfDoors: 2 });
    expect(resolveSwing(p)).toBe("double");
  });

  it("reports no swing for drawer-only bases", () => {
    const p = cab({ masterCode: "DB-15", description: "Drawer Base 15", numberOfDoors: 0, numberOfDrawers: 3 });
    expect(resolveSwing(p)).toBe("none");
    expect(hasDoorSwing(p)).toBe(false);
  });

  it("reports no swing for appliances and panels", () => {
    const appliance = cab({ masterCode: "RANGE-30", description: "Range 30", placement: "appliance" });
    expect(resolveSwing(appliance)).toBe("none");
    const panel = cab({ masterCode: "BDEP", description: "Base/Dishwasher End Panel", numberOfDoors: 0 });
    expect(resolveSwing(panel)).toBe("none");
  });

  it("honors an explicit swing override over the default", () => {
    const p = cab({ masterCode: "B-18", description: "Base 18 1 Door", numberOfDoors: 1, swing: "right" });
    expect(resolveSwing(p)).toBe("right");
  });

  it("toggles a single-door swing Left <-> Right and leaves double/none untouched", () => {
    expect(cycleSwing("left")).toBe("right");
    expect(cycleSwing("right")).toBe("left");
    expect(cycleSwing("double")).toBe("double");
    expect(cycleSwing("none")).toBe("none");
  });

  it("renders short and full hinge labels", () => {
    const cases: [DoorSwing, string, string][] = [
      ["left", "L", "Left hinge"],
      ["right", "R", "Right hinge"],
      ["double", "LR", "Double door"],
      ["none", "", ""],
    ];
    for (const [s, short, full] of cases) {
      expect(swingLabel(s)).toBe(short);
      expect(swingText(s)).toBe(full);
    }
  });
});


describe("corner base palette classification", () => {
  // The Design Tool's "Corner Base" tab uses isCornerCabinet (code/description)
  // OR the DB isCornerCabinet flag. These assert the code-level detector keeps
  // genuine corner bases in and end/filler/accessory items out.
  it("includes genuine corner base families", () => {
    expect(isCornerCabinet("BBC-45")).toBe(true); // blind corner base
    expect(isCornerCabinet("LSB33")).toBe(true); // lazy susan base
    expect(isCornerCabinet("ERB-36")).toBe(true); // easy reach corner base
    expect(isCornerCabinet("CSB-36")).toBe(true); // diagonal corner sink base
    expect(isCornerCabinet("CB-9", "Corner Base")).toBe(true); // corner base by desc
  });
  it("excludes end cabinets, fillers, and ordinary bases from corner base", () => {
    expect(isCornerCabinet("BEC-24")).toBe(false); // base END cabinet
    expect(isCornerCabinet("BA-24", "24in angled base end")).toBe(false); // end-of-run angled base
    expect(isCornerCabinet("DCFF42")).toBe(false); // diagonal corner FILLER (by code) is not a cabinet
    expect(isCornerCabinet("B-36", "Base 36 inch")).toBe(false); // ordinary base
    expect(isCornerCabinet("SB-30", "Sink Base 30")).toBe(false); // ordinary sink base
  });
});

describe("lazy-Susan / L-corner footprint", () => {
  it("classifies lazy-Susan and easy-reach corners as L-corner (not diagonal or blind)", () => {
    expect(isLCornerCabinet("LSB36")).toBe(true);
    expect(isLCornerCabinet("LSB33")).toBe(true);
    expect(isLCornerCabinet("ERB-33", "Easy Reach Corner Base")).toBe(true);
    // Blind corners are NOT L-corners — they are rectangular boxes.
    expect(isLCornerCabinet("BBC-45", "Blind Corner Base")).toBe(false);
    // Diagonal corners are NOT L-corners (they get the angled-face clip instead).
    expect(isLCornerCabinet("DCW-2424", "Diagonal Corner Wall")).toBe(false);
    // Ordinary cabinets are never L-corners.
    expect(isLCornerCabinet("B-24", "Base 24")).toBe(false);
  });

  it("gives a lazy-Susan corner base a SQUARE bounding box (depth == width)", () => {
    const lsb36 = footprintDepth({
      id: 1, masterCode: "LSB36", description: '36" Base Lazy Susan Cabinet',
      category: "Base", subCategory: "Lazy Susan Base", width: "36", height: "34.5", depth: "24",
      placement: "base", numberOfDoors: 2, numberOfDrawers: 0, isCornerCabinet: true,
    });
    expect(lsb36).toBe(36); // 36x36 square, NOT the 24" base depth

    const lsb33 = footprintDepth({
      id: 2, masterCode: "LSB33", description: '33" Base Lazy Susan Cabinet',
      category: "Base", subCategory: "Lazy Susan Base", width: "33", height: "34.5", depth: "24",
      placement: "base", numberOfDoors: 2, numberOfDrawers: 0, isCornerCabinet: true,
    });
    expect(lsb33).toBe(33); // 33x33 square
  });

  it("keeps a 24\" leg on each wall: notch ratio = legDepth / boxWidth", () => {
    // 36" lazy-Susan: 24/36 = 0.667 -> inner 12x12 notch
    expect(cornerLegRatioForPlaced({ width: 36, placement: "base" })).toBeCloseTo(24 / 36, 3);
    // ERB33 keeps its true 33-inch square plan box: 24/33 = 0.727 -> 9x9 notch.
    expect(cornerLegRatioForPlaced({ width: 33, placement: "base" })).toBeCloseTo(24 / 33, 3);
    // Wall corner uses the 12" wall depth.
    expect(cornerLegRatioForPlaced({ width: 24, placement: "wall" })).toBeCloseTo(12 / 24, 3);
  });

  it("L clip-path with a custom ratio still yields a valid 6-vertex L", () => {
    const path = cornerClipPath(0, 24 / 36);
    expect(path.startsWith("polygon(")).toBe(true);
    const points = path.replace(/polygon\(|\)/g, "").split(",");
    expect(points).toHaveLength(6);
    // The notch keep-percentage should appear as ~67%.
    expect(path).toContain("67%");
  });

  it("placedFootprint squares an OLD lazy-Susan stored with a shallow depth", () => {
    // Regression: a saved LSB36 with the legacy 36x24 box must render as 36x36.
    const old = cab({ masterCode: "LSB36", description: '36" Base Lazy Susan Cabinet', width: 36, depth: 24, rotation: 0 });
    const fp = placedFootprint(old);
    expect(fp.w).toBe(36);
    expect(fp.d).toBe(36); // squared, NOT the stale 24
  });

  it("placedFootprint keeps a source-priced 33-inch L-corner at its actual square span", () => {
    // ERB33 occupies a 33-by-33 plan box with actual 24-inch cabinet legs. It
    // must not inherit a 36-inch CDB reservation and consume three imaginary
    // inches on both adjoining measured wall runs.
    const rotated = cab({ masterCode: "ERB33", description: '33" Easy Reach Base Cabinet with Lazy Susan', width: 33, depth: 24, rotation: 90 });
    const fp = placedFootprint(rotated);
    expect(fp.w).toBe(33);
    expect(fp.d).toBe(33);
  });

  it("derives a WDC2430 diagonal wall footprint from the same shared corner classifier used by 3D", () => {
    const wdc = cab({
      masterCode: "WDC2430",
      description: "24 inch Diagonal Wall Corner Cabinet",
      placement: "wall",
      width: 24,
      depth: 12,
      cornerType: null,
    });
    expect(placedCornerGeometryKind(wdc)).toBe("diagonal");
    expect(placedFootprint(wdc)).toEqual({ w: 24, d: 24 });
  });

  it("keeps AW1230 as the illustrated compact 12-by-12 angled wall cabinet instead of inflating it to a WDC footprint", () => {
    const aw = cab({
      masterCode: "AW1230",
      description: '12" Single Door Angled Wall Cabinet with 2 Adjustable Shelves',
      placement: "wall",
      width: 12,
      depth: 12,
      height: 30,
      customProfile: "wall_angle",
    });
    expect(placedCornerGeometryKind(aw)).toBe("standard");
    expect(placedFootprint(aw)).toEqual({ w: 12, d: 12 });
  });

  it("uses one shared persisted classifier across diagonal, triangle, blind, L-corner, and end-return families", () => {
    const cases = [
      { cabinet: cab({ masterCode: "WDC2430", description: "Diagonal Wall Corner", placement: "wall", width: 24, depth: 12 }), kind: "diagonal", footprint: { w: 24, d: 24 } },
      { cabinet: cab({ masterCode: "WTC2430", description: "Triangle Wall Corner", placement: "wall", width: 24, depth: 12 }), kind: "triangle", footprint: { w: 24, d: 12 } },
      { cabinet: cab({ masterCode: "BBC-36", description: "Blind Corner Base", width: 36, depth: 24 }), kind: "blind-corner", footprint: { w: 36, d: 24 } },
      { cabinet: cab({ masterCode: "LSB36", description: "Lazy Susan Base", width: 36, depth: 24 }), kind: "l-shape", footprint: { w: 36, d: 36 } },
      { cabinet: cab({ masterCode: "CDB36", description: "Corner Drawer Base", width: 36, depth: 24 }), kind: "corner-drawer", footprint: { w: 36, d: 36 } },
      { cabinet: cab({ masterCode: "BEC-24", description: "Base End Cabinet", width: 24, depth: 24 }), kind: "base-end", footprint: { w: 24, d: 24 } },
    ] as const;

    for (const { cabinet, kind, footprint } of cases) {
      expect(placedCornerGeometryKind(cabinet)).toBe(kind);
      expect(placedFootprint(cabinet)).toEqual(footprint);
    }
  });

  it("placedFootprint leaves ordinary cabinets as their rotated size", () => {
    const base = cab({ masterCode: "B-24", description: "Base 24", width: 24, depth: 24, rotation: 0 });
    expect(placedFootprint(base)).toEqual({ w: 24, d: 24 });
    const wall = cab({ masterCode: "W-3030", description: "Wall 30", width: 30, depth: 12, rotation: 90 });
    // Rotated 90deg: width/depth swap for a normal cabinet.
    expect(placedFootprint(wall)).toEqual({ w: 12, d: 30 });
  });

  it("normalizeLCornerDepths rewrites stale L-corner depth to a square box", () => {
    const input = [
      cab({ masterCode: "LSB36", description: '36" Base Lazy Susan Cabinet', width: 36, depth: 24 }),
      cab({ masterCode: "B-24", description: "Base 24", width: 24, depth: 24 }),
    ];
    const out = normalizeLCornerDepths(input);
    expect(out[0].width).toBe(36);
    expect(out[0].depth).toBe(36); // fixed
    // The ordinary cabinet is untouched.
    expect(out[1].depth).toBe(24);
  });

  it("normalizeLCornerDepths returns the SAME array reference when nothing changes", () => {
    const input = [
      cab({ masterCode: "LSB36", description: '36" Base Lazy Susan Cabinet', width: 36, depth: 36 }),
      cab({ masterCode: "B-24", description: "Base 24", width: 24, depth: 24 }),
    ];
    expect(normalizeLCornerDepths(input)).toBe(input);
  });
});


describe("corner cabinet routing (keep Corner Base & Corner Wall separate, none in plain Base/Wall)", () => {
  // Representative real catalog corner codes by family.
  const baseCorners = ["BBC-36", "BBC-39", "BBC-42", "BBC-45", "ERB-33", "ERB-36", "LSB33", "LSB36", "LSB36ADA"];
  const wallCorners = ["DCW2430", "WDC2430", "WER-24"];

  it("classifies every base + wall corner code as a corner cabinet", () => {
    for (const code of [...baseCorners, ...wallCorners]) {
      expect(isCornerCabinet(code), `${code} should be a corner cabinet`).toBe(true);
    }
  });

  it("treats L-corner base cabinets (lazy-susan/easy-reach) as L (not diagonal)", () => {
    for (const code of ["ERB-33", "LSB33", "LSB36", "LSB36ADA"]) {
      expect(isLCornerCabinet(code), `${code} should be an L-corner`).toBe(true);
      expect(isDiagonalCorner(code), `${code} should NOT be diagonal`).toBe(false);
    }
    // Blind corners are rectangular, NOT L-corners.
    expect(isLCornerCabinet("BBC-36")).toBe(false);
    expect(isDiagonalCorner("BBC-36")).toBe(false);
  });

  it("does NOT classify ordinary base/wall cabinets as corner cabinets", () => {
    for (const code of ["B-12", "B-24", "B-36", "SB-30", "DB-24-2", "W-2430", "W-3030"]) {
      expect(isCornerCabinet(code), `${code} should not be a corner cabinet`).toBe(false);
    }
  });
});

describe("sink base + sink fixture handling (Design Tool fixes)", () => {
  it("detects a sink base by master code and by description/subCategory", () => {
    expect(isSinkBaseCabinet({ masterCode: "SB-36", description: "Sink Base 36" })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "SB36" })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "B-24", subCategory: "Sink Base" })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "B-24", description: "Base 24" })).toBe(false);
    expect(isSinkBaseCabinet({ masterCode: "DB-24-3", description: "Drawer Base" })).toBe(false);
  });

  it("detects the full range of sink-base / vanity-sink families from the catalog", () => {
    // Real catalog rows (code + description) that MUST be detected as sink bases:
    expect(isSinkBaseCabinet({ masterCode: "FSB-36", description: '36" Farmhouse Sink Base' })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "CSB-36", description: '36" Corner Sink Base Cabinet' })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "SBF-42-42", description: '42" x 42" Diagonal Sink Floor' })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "UV-SBF4242", description: '42" Diagonal Corner Sink Floor' })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "VSD-36", description: '36" Vanity Sink Base Cabinet' })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "VA-30", description: '30" Double Door Vanity Sink Base Cabinet' })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "ADA-VS-30", description: '30" Double Door ADA Vanity Sink Base Cabinet' })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "ADA-SB-33R", description: 'ADA Sink Base 33"' })).toBe(true);
    expect(isSinkBaseCabinet({ masterCode: "BFH-30", description: '30" Full Height Door Vanity Sink Cabinet' })).toBe(true);
  });

	  it("routes FSB farm sink bases through the active-wall palette resolver only", () => {
	    const farmSink = { masterCode: "FSB-36", description: '36" Farmhouse Sink Base' };
    expect(isFarmSinkBasePaletteItem(farmSink)).toBe(true);
    expect(isFarmSinkBasePaletteItem({ masterCode: "SB-36", description: "Sink Base 36" })).toBe(false);
    expect(isFarmSinkBasePaletteItem({ masterCode: "LSB36", description: "Base Easy Reach Lazy Susan" })).toBe(false);

    expect(paletteActiveWallPlacement("top", ROOM_12x10, [], [], 36, 24, "base"))
      .toMatchObject({ x: 0, y: 0, rotation: 0 });
	    const fullTopWall = [cab({ uid: "full-top", x: 0, y: 0, width: 144, depth: 24, placement: "base" })];
	    expect(paletteActiveWallPlacement("top", ROOM_12x10, fullTopWall, [], 36, 24, "base")).toBeNull();
	  });

	  it("seats a farmhouse sink at the countertop opening with its apron flush to the room-facing cabinet front", () => {
	    const base = cab({ masterCode: "FSB-36", description: '36" Farmhouse Sink Base', x: 24, y: 0, width: 36, depth: 24, rotation: 0, placement: "base" });
	    const sink = makeSinkForCabinet("farmhouse", base, ROOM_12x10, { width: 32.625, depth: 18 });
	    expect(sink.x).toBeCloseTo(25.6875, 8);
	    expect(sink.y + sink.depth).toBe(24);
	  });

  it("does NOT mistake look-alike non-sink families for sink bases", () => {
    // These share a prefix/letters with sink families but are NOT sinks:
    expect(isSinkBaseCabinet({ masterCode: "LSB36", description: '36" Base Easy Reach with Lazy Susan Cabinet' })).toBe(false);
    expect(isSinkBaseCabinet({ masterCode: "LSB36ADA", description: '36" Base Easy Reach Lazy Susan ADA Cabinet' })).toBe(false);
    expect(isSinkBaseCabinet({ masterCode: "VA-48", description: '48"W x 6"H Arched Valance - 3/4" Deep' })).toBe(false);
    expect(isSinkBaseCabinet({ masterCode: "BFH-18", description: '18" Full Height Single Door Base Cabinet' })).toBe(false);
    expect(isSinkBaseCabinet({ masterCode: "V-30-21TDR", description: '30" Vanity 3 Drawers Right' })).toBe(false);
    expect(isSinkBaseCabinet({ masterCode: "W3030", description: '30" Wall Cabinet' })).toBe(false);
  });

  it("detects the sink appliance/fixture", () => {
    expect(isSinkAppliance({ masterCode: "SINK-33", description: 'Sink 33"' })).toBe(true);
    expect(isSinkAppliance({ masterCode: "RANGE-30", description: "Range 30" })).toBe(false);
  });

  it("does NOT flag a sink appliance sitting over a sink base as a conflict", () => {
    // Sink drops INTO the sink base — this is the intended layout.
    const sb = cab({ uid: "sb", masterCode: "SB-36", description: "Sink Base 36", placement: "base", x: 0, y: 0, width: 36, depth: 24 });
    const sink = cab({ uid: "snk", masterCode: "SINK-33", description: 'Sink 33"', placement: "appliance", x: 1, y: 1, width: 33, depth: 22 });
    const conflicts = conflictingUids([sb, sink]);
    expect(conflicts.has("sb")).toBe(false);
    expect(conflicts.has("snk")).toBe(false);
  });

  it("centers an SB36 beneath the active wall's window before normal base-run sequencing", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
    const window: WallOpening = {
      uid: "sink-window", kind: "window", label: "Over-sink window", side: "top",
      offset: 54, width: 36, height: 36, sill: 36,
    };
    const spot = sinkBaseWindowPlacement("top", room, 36, 24, 34.5, [], [window]);

	    expect(spot).toMatchObject({ openingUid: "sink-window", spot: { x: 54, y: 0, rotation: 0 } });
  });

  it("keeps the same window-center measurement on a diagonal continuous wall", () => {
    const room: RoomData = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 120, y: 120 }],
      customWalls: [{ id: "diag", startVertexId: "a", endVertexId: "b", label: "Diagonal wall", lockedAngle: 45 }],
    };
    const window: WallOpening = {
      uid: "diagonal-sink-window", kind: "window", label: "Over-sink window", side: "diag" as any,
      offset: 60, width: 36, height: 36, sill: 36,
    };
    const spot = sinkBaseWindowPlacement("diag" as any, room, 36, 24, 34.5, [], [window]);

	    expect(spot?.openingUid).toBe("diagonal-sink-window");
    expect(spot?.spot.wallId).toBe("diag");
    expect(spot?.spot.wallOffset).toBeCloseTo(60, 8);
  });

  it("keeps a 24-inch dishwasher opening available below a window on a diagonal continuous wall", () => {
    const room: RoomData = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 120, y: 120 }],
      customWalls: [{ id: "diag", startVertexId: "a", endVertexId: "b", label: "Diagonal wall", lockedAngle: 45 }],
    };
    const sb36Spot = wallPlacementAt(0, 36, 24, "diag" as any, room);
    const db36Spot = wallPlacementAt(60, 36, 24, "diag" as any, room);
    const bases: PlacedCabinet[] = [
      cab({ uid: "sb36", masterCode: "SB36", description: "36 inch Sink Base", placement: "base", ...sb36Spot, width: 36, depth: 24, wallId: "diag", wallOffset: 0 }),
      cab({ uid: "db36", masterCode: "DB36", description: "36 inch Drawer Base", placement: "base", ...db36Spot, width: 36, depth: 24, wallId: "diag", wallOffset: 60 }),
    ];
    const window: WallOpening = {
      uid: "window-over-dw", kind: "window", label: "Window", side: "diag" as any,
      offset: 36, width: 24, height: 36, sill: 36,
    };

    const applianceSegments = freeSegmentsOnWall("diag" as any, room, bases, [window], 24, 0, "appliance");
    expect(applianceSegments).toContainEqual({ start: 36, length: 24 });
    expect(nearestAvailableWallStart(applianceSegments, 36, 24)).toBe(36);
    expect(wallGaps(room, bases, [window], 24)).toContainEqual(expect.objectContaining({
      side: "diag",
      layer: "base",
      start: 36,
      length: 24,
    }));

    const dishwasherSpot = wallPlacementAt(36, 24, 24, "diag" as any, room);
    const dishwasher = cab({
      uid: "dw24", masterCode: "DW-24", description: "24 inch Dishwasher", placement: "appliance",
      ...dishwasherSpot, width: 24, depth: 24, wallId: "diag", wallOffset: 36,
    });
	    expect(baseOpeningOverlaps([dishwasher], [window], room)).toEqual(new Set());
	    expect(conflictingUids([...bases, dishwasher], room)).toEqual(new Set());
	    expect(continuousWallApplianceSnapInfo(dishwasher, [...bases, dishwasher], room)).toMatchObject({
	      wallId: "diag",
	      before: { uid: "sb36", masterCode: "SB36" },
	      after: { uid: "db36", masterCode: "DB36" },
	    });

	    // A near miss must never earn the green flush indicator: it is a real
	    // positive overlap, even though the 45-degree screen bounds look similar.
	    const overlappingDishwasher = cab({
	      ...dishwasher,
	      uid: "dw24-overlap",
	      ...wallPlacementAt(35.5, 24, 24, "diag" as any, room),
	      wallOffset: 35.5,
	    });
	    expect(continuousWallApplianceSnapInfo(overlappingDishwasher, [...bases, overlappingDishwasher], room)).toBeNull();
	    expect(conflictingUids([...bases, overlappingDishwasher], room)).toEqual(new Set(["sb36", "dw24-overlap"]));

	    const floorDoor: WallOpening = {
      ...window, uid: "door-at-dw", kind: "door", label: "Door", sill: 0,
    };
    const doorSegments = freeSegmentsOnWall("diag" as any, room, bases, [floorDoor], 24, 0, "appliance");
    expect(doorSegments.some((segment) => segment.start <= 36 && segment.start + segment.length >= 60)).toBe(false);
  });

  it("STILL flags a range appliance overlapping an ordinary base cabinet", () => {
    // Regression guard: the exemption must NOT disable real appliance conflicts.
    const base = cab({ uid: "b", masterCode: "B-24", description: "Base 24", placement: "base", x: 0, y: 0, width: 24, depth: 24 });
    const range = cab({ uid: "r", masterCode: "RANGE-30", description: "Range 30", placement: "appliance", x: 1, y: 1, width: 30, depth: 25 });
    const conflicts = conflictingUids([base, range]);
    expect(conflicts.has("b")).toBe(true);
    expect(conflicts.has("r")).toBe(true);
  });

  it("keeps a 3DB18 flush beside a 30-inch range on a measured 45-degree wall without a false appliance conflict", () => {
    const room: RoomData = {
      width: 240,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [{ id: "start", x: 0, y: 0 }, { id: "end", x: 160, y: 160 }],
      customWalls: [{ id: "wall-45", startVertexId: "start", endVertexId: "end", lockedAngle: 45 }],
    };
    const rangeSpot = wallPlacementAt(48, 30, 25, "wall-45" as any, room);
    const range = cab({
      uid: "range", masterCode: "RANGE-30", description: '30" Freestanding Range', placement: "appliance",
      ...rangeSpot, width: 30, depth: 25, height: 36, wallId: "wall-45", wallOffset: 48,
    });
    const drawerSpot = wallPlacementAt(78, 18, 24, "wall-45" as any, room);
    const drawerBase = cab({
      uid: "3db18", masterCode: "3DB18", description: '18" Three Drawer Base Cabinet', placement: "base",
      ...drawerSpot, width: 18, depth: 24, wallId: "wall-45", wallOffset: 78,
    });

    // The visible 29.7-inch diagonal envelopes overlap, but the real 30" and
    // 18" wall spans meet precisely at 78". The Designer warning must follow
    // the same wall-aware rule used by plan and 3D placement.
    expect(conflictingUids([range, drawerBase])).toEqual(new Set(["range", "3db18"]));
    expect(conflictingUids([range, drawerBase], room)).toEqual(new Set());
    expect(dimLabel(drawerBase)).toBe('18"W × 34.5"H × 24"D');

    const overlappingSpot = wallPlacementAt(77, 18, 24, "wall-45" as any, room);
    const overlappingDrawerBase = { ...drawerBase, ...overlappingSpot, wallOffset: 77 };
    expect(conflictingUids([range, overlappingDrawerBase], room)).toEqual(new Set(["range", "3db18"]));
  });

  it("magnetically seats a 3DB18 at the exposed 30-inch range edge on a continuous wall", () => {
    const gaps = [{ start: 0, length: 48 }, { start: 78, length: 130 }];
    expect(magneticAvailableWallStart(gaps, 80.5, 18)).toBe(78);
    // The same helper preserves a deliberate position outside the 6-inch snap
    // capture range; turning off Designer snapping remains unnecessary for a
    // genuinely intentional larger gap.
    expect(magneticAvailableWallStart(gaps, 96, 18)).toBe(96);
  });

  it("flags a 70-inch refrigerator that overlaps a wall cabinet in the 54-inch upper zone", () => {
    const fridge = cab({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance", x: 0, y: 0, width: 36, depth: 24, height: 70 });
    const wall = cab({ uid: "wall", masterCode: "WR3624", description: "36 inch Wall Cabinet", placement: "wall", x: 0, y: 0, width: 36, depth: 12, height: 30, mountBottom: 54 });

    expect(hasCollision(fridge, [wall])).toBe(true);
    expect(conflictingUids([fridge, wall])).toEqual(new Set(["fridge", "wall"]));
  });

  it("keeps ordinary base appliances valid below a standard wall cabinet", () => {
    const dishwasher = cab({ uid: "dishwasher", masterCode: "DW-24", description: "Dishwasher 24", placement: "appliance", x: 0, y: 0, width: 24, depth: 24, height: 34.5 });
    const wall = cab({ uid: "wall", masterCode: "WR2424", description: "24 inch Wall Cabinet", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 30 });

    expect(hasCollision(dishwasher, [wall])).toBe(false);
    expect(conflictingUids([dishwasher, wall])).toEqual(new Set());
  });

  it("preserves a refrigerator wall cabinet's stored mounting choice", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
    const fridge = cab({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance", x: 0, y: 0, width: 36, depth: 24, height: 70 });
    const fridgeWall = cab({ uid: "wr", masterCode: "WR3624", description: "Refrigerator Wall 36", placement: "wall", x: 0, y: 0, width: 36, depth: 24, height: 24 });

    const normalized = normalizeRefrigeratorBayUppers([fridge, fridgeWall], room);
    const normalizedUpper = normalized.find((cabinet) => cabinet.uid === "wr");

    // A refrigerator upper is an explicit catalog choice. Loading a design must
    // never move it just because a refrigerator happens to sit below it.
    expect(normalizedUpper).toBe(fridgeWall);
    expect(normalizedUpper?.mountBottom).toBeUndefined();
  });

	  it("keeps a short WR3624 two inches above the selected refrigerator beside an adjoining wall-cabinet run", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
    const adjoining = cab({ uid: "left-wall", masterCode: "W-1242", description: "12 inch Wall Cabinet", placement: "wall", x: 0, y: 0, width: 12, depth: 12, height: 42, mountBottom: 54 });
    const fridge = cab({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance", x: 12, y: 0, width: 36, depth: 24, height: 68 });
    const fridgeWall = cab({ uid: "wr", masterCode: "WR3624", description: "Refrigerator Wall 36", placement: "wall", x: 12, y: 0, width: 36, depth: 24, height: 24, mountBottom: 70 });

    const normalized = normalizeRefrigeratorBayUppers([adjoining, fridge, fridgeWall], room);
    const normalizedUpper = normalized.find((cabinet) => cabinet.uid === "wr")!;
    const upperBox = elevationBox(normalizedUpper, room);

	    expect(normalizedUpper.mountBottom).toBe(70);
	    expect(upperBox).toEqual({ bottom: 70, height: 24 });
  });

  it("does not infer a refrigerator upper mount from a taller adjoining wall cabinet", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
    const adjoining = cab({ uid: "left-tall-wall", masterCode: "W-1248", description: "12 inch Wall Cabinet", placement: "wall", x: 0, y: 0, width: 12, depth: 12, height: 48, mountBottom: 54 });
    const fridge = cab({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance", x: 12, y: 0, width: 36, depth: 24, height: 70 });
    const fridgeWall = cab({ uid: "wr", masterCode: "WR3624", description: "Refrigerator Wall 36", placement: "wall", x: 12, y: 0, width: 36, depth: 24, height: 24 });

    const normalized = normalizeRefrigeratorBayUppers([adjoining, fridge, fridgeWall], room);
    const normalizedUpper = normalized.find((cabinet) => cabinet.uid === "wr")!;

    expect(elevationBox(adjoining, room)).toEqual({ bottom: 54, height: 48 });
    expect(normalizedUpper).toBe(fridgeWall);
    expect(normalizedUpper.mountBottom).toBeUndefined();
  });

  it("preserves a refrigerator end panel's selected source height", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
    const fridge = cab({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance", x: 24, y: 0, width: 36, depth: 24, height: 70 });
    const fridgeWall = cab({ uid: "wr", masterCode: "WR3624", description: "Refrigerator Wall 36", placement: "wall", x: 24, y: 0, width: 36, depth: 24, height: 24 });
    const sidePanel = cab({ uid: "panel", masterCode: "REPV2496", description: "Refrigerator End Panel", placement: "tall", x: 23.25, y: 0, width: 0.75, depth: 24, height: 94, mountBottom: 0 });

    const normalized = normalizeRefrigeratorBayUppers([fridge, fridgeWall, sidePanel], room);
    const normalizedPanel = normalized.find((cabinet) => cabinet.uid === "panel");

    expect(normalizedPanel).toBe(sidePanel);
    expect(normalizedPanel?.height).toBe(94);
    expect(elevationBox(normalizedPanel!, room)).toEqual({ bottom: 0, height: 94 });
  });

  it("keeps each refrigerator end panel on the floor at its selected source height", () => {
    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
    for (const uid of ["left-panel", "right-panel"]) {
      const panel = cab({
        uid,
        masterCode: "REPV2496",
        description: "Refrigerator End Panel",
        placement: "tall",
        x: uid === "left-panel" ? 23.25 : 60,
        y: 0,
        width: 0.75,
        depth: 24,
        height: 60,
        mountBottom: 36,
      });
      expect(elevationBox(panel, room)).toEqual({ bottom: 0, height: 60 });
    }
  });

  it("preserves stored refrigerator source-part offsets on a diagonal continuous wall", () => {
    const room: RoomData = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 120, y: 120 }],
      customWalls: [{ id: "diag", startVertexId: "a", endVertexId: "b", label: "Diagonal wall", lockedAngle: 45 }],
    };
    const fridgeSpot = wallPlacementAt(48, 36, 24, "diag" as any, room);
    const fridge = cab({
      uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance",
      ...fridgeSpot, width: 36, depth: 24, height: 70, wallId: "diag", wallOffset: 48,
      refrigeratorPanelMode: "both",
    });
    const bridge = cab({
      uid: "bridge", masterCode: "WR3624", description: "Refrigerator Wall 36", placement: "wall",
      ...wallPlacementAt(0, 36, 24, "diag" as any, room), width: 36, depth: 24, height: 24,
      refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "bridge", wallId: "diag", wallOffset: 0,
    });
    const left = cab({
      uid: "left-panel", masterCode: "REPV2496", description: "Refrigerator End Panel", placement: "tall",
      ...wallPlacementAt(0, 0.75, 24, "diag" as any, room), width: 0.75, depth: 24, height: 96,
      customProfile: "refrigerator-end-panel", refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "left-panel", wallId: "diag", wallOffset: 0,
    });
    const right = cab({
      uid: "right-panel", masterCode: "REPV2496", description: "Refrigerator End Panel", placement: "tall",
      ...wallPlacementAt(0, 0.75, 24, "diag" as any, room), width: 0.75, depth: 24, height: 96,
      customProfile: "refrigerator-end-panel", refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "right-panel", wallId: "diag", wallOffset: 0,
    });

    const normalized = normalizeRefrigeratorBayUppers([fridge, bridge, left, right], room);
    const byUid = new Map(normalized.map((item) => [item.uid, item]));
    expect(wallRunOffset(byUid.get("bridge")!, "diag", room)).toBeCloseTo(0, 8);
    expect(wallRunOffset(byUid.get("left-panel")!, "diag", room)).toBeCloseTo(0, 8);
    expect(wallRunOffset(byUid.get("right-panel")!, "diag", room)).toBeCloseTo(0, 8);
    expect(byUid.get("bridge")?.mountBottom).toBeUndefined();
  });
});

describe("wall cabinet dropped to floor keeps its own depth", () => {
  it("a 12-inch wall cabinet stays 12 inches deep after the dropToFloor depth rule", () => {
    // dropToFloor() now flips placement to "base" WITHOUT overriding depth.
    // footprintDepth() must therefore return the cabinet's stored 12", not 24".
    const droppedAsBase = {
      placement: "base" as const,
      width: "30",
      depth: "12", // original wall depth preserved
      masterCode: "W-30-30",
      description: "Wall 30x30",
    };
    expect(footprintDepth(droppedAsBase)).toBe(12);
    // Sanity: an ordinary base with no explicit depth still falls back to 24".
    expect(footprintDepth({ placement: "base", width: "24", depth: null, masterCode: "B-24", description: "Base 24" })).toBe(STD.BASE_DEPTH);
  });
});


import { effectiveStyleId, rebaseFormerDefaultStyleOverrides, distinctStyleIds, isMixedFinish } from "./design";

describe("effectiveStyleId (two-tone per-cabinet finish)", () => {
  it("uses the per-cabinet override when present", () => {
    expect(effectiveStyleId({ styleId: 42 }, 7)).toBe(42);
  });
  it("falls back to the design default when no override", () => {
    expect(effectiveStyleId({ styleId: null }, 7)).toBe(7);
    expect(effectiveStyleId({}, 7)).toBe(7);
  });
  it("allows two cabinets to resolve to different finishes (mix colors)", () => {
    const def = 7;
    const perimeter = effectiveStyleId({ styleId: null }, def); // default white
    const island = effectiveStyleId({ styleId: 99 }, def); // contrasting island
    expect(perimeter).toBe(7);
    expect(island).toBe(99);
    expect(perimeter).not.toBe(island);
  });
  it("returns null only when neither override nor default is set", () => {
    expect(effectiveStyleId({ styleId: null }, null)).toBeNull();
  });
});

describe("rebaseFormerDefaultStyleOverrides", () => {
  it("clears a stale former design default so a newly selected feature style applies to every legacy cabinet", () => {
    const cabinets = [{ uid: "a", styleId: 7 }, { uid: "b", styleId: 7 }];
    const rebased = rebaseFormerDefaultStyleOverrides(cabinets, 7, 390009, false);
    expect(rebased.map((cabinet) => effectiveStyleId(cabinet, 390009))).toEqual([390009, 390009]);
  });

  it("preserves explicit per-cabinet overrides when an intentional second color is active", () => {
    const cabinets = [{ uid: "upper", styleId: 7 }, { uid: "island", styleId: 99 }];
    expect(rebaseFormerDefaultStyleOverrides(cabinets, 7, 390009, true)).toEqual(cabinets);
  });

  it("clears ALL per-cabinet overrides in single-finish mode, not just those matching the former default", () => {
    // Cabinets placed under different styles during browsing (Natura Maple=7, Aura Cream=99)
    // must all inherit the new design default (Zenith Sage=390009) when Color 1 changes.
    const cabinets = [
      { uid: "a", styleId: 7 },    // was Natura Maple
      { uid: "b", styleId: 99 },   // was Aura Cream
      { uid: "c", styleId: null },  // already inheriting
      { uid: "d", styleId: 42 },   // was some other style
    ];
    const rebased = rebaseFormerDefaultStyleOverrides(cabinets, 7, 390009, false);
    // ALL overrides cleared — every cabinet now inherits the new default
    expect(rebased.map((c) => c.styleId)).toEqual([null, null, null, null]);
    expect(rebased.map((c) => effectiveStyleId(c, 390009))).toEqual([390009, 390009, 390009, 390009]);
  });
});

describe("distinctStyleIds + isMixedFinish (two-tone summary)", () => {
  it("lists just the default when no cabinet overrides", () => {
    const cabs = [{ styleId: null }, {}, { styleId: 7 }];
    expect(distinctStyleIds(cabs, 7)).toEqual([7]);
    expect(isMixedFinish(cabs, 7)).toBe(false);
  });
  it("puts the design default first, then distinct overrides in first-seen order", () => {
    const cabs = [{ styleId: null }, { styleId: 99 }, { styleId: 99 }, { styleId: 12 }];
    expect(distinctStyleIds(cabs, 7)).toEqual([7, 99, 12]);
    expect(isMixedFinish(cabs, 7)).toBe(true);
  });
  it("is mixed when overrides differ even if some match the default", () => {
    const cabs = [{ styleId: 7 }, { styleId: 99 }];
    expect(isMixedFinish(cabs, 7)).toBe(true);
    expect(distinctStyleIds(cabs, 7)).toEqual([7, 99]);
  });
  it("with no default, only cabinet styles count", () => {
    expect(distinctStyleIds([{ styleId: 5 }, { styleId: null }], null)).toEqual([5]);
    expect(distinctStyleIds([], null)).toEqual([]);
    expect(isMixedFinish([{ styleId: null }], null)).toBe(false);
  });
});

describe("mixed-finish pricing keys on the EFFECTIVE styleId", () => {
  // Mirrors the DesignTool price map keyed on `cabinetId:styleId`. A two-tone
  // design must price each cabinet by its resolved finish, not the default.
  it("resolves a different price-map key for an island override vs the perimeter", () => {
    const DEFAULT_STYLE = 7;
    const priceMap = new Map<string, number>([
      ["100:7", 200],   // cabinet 100 in white (default)
      ["100:99", 260],  // cabinet 100 in contrasting navy
      ["200:7", 150],
    ]);
    const perimeter = { cabinetId: 100, styleId: null };
    const island = { cabinetId: 100, styleId: 99 };
    const keyOf = (p: { cabinetId: number; styleId?: number | null }) =>
      `${p.cabinetId}:${effectiveStyleId(p, DEFAULT_STYLE)}`;
    expect(priceMap.get(keyOf(perimeter))).toBe(200);
    expect(priceMap.get(keyOf(island))).toBe(260);
    // The two finishes of the SAME cabinet model price differently.
    expect(priceMap.get(keyOf(perimeter))).not.toBe(priceMap.get(keyOf(island)));
  });
});

describe("two-tone state updates (DesignTool behavior, pure replicas)", () => {
  type Cab = { uid: string; styleId?: number | null };
  // Replica of effectiveStyleId render resolution.
  const eff = (c: Cab, def: number | null) => (c.styleId != null ? c.styleId : def);

  it("changing the DESIGN DEFAULT recolors only cabinets WITHOUT an override", () => {
    const cabs: Cab[] = [
      { uid: "a", styleId: null }, // perimeter, inherits default
      { uid: "b", styleId: null }, // perimeter, inherits default
      { uid: "c", styleId: 99 },   // island, explicit override
    ];
    const oldDefault = 7;
    const newDefault = 12;
    // Render finishes BEFORE the change.
    expect(cabs.map((c) => eff(c, oldDefault))).toEqual([7, 7, 99]);
    // Default change does NOT mutate per-cabinet styleId; only the default arg.
    expect(cabs.map((c) => eff(c, newDefault))).toEqual([12, 12, 99]);
    // The overridden island cabinet stayed navy through the default swap.
    expect(eff(cabs[2], newDefault)).toBe(99);
  });

  it("setting ONE cabinet's finish (override) does not touch the others", () => {
    const before: Cab[] = [
      { uid: "a", styleId: null },
      { uid: "b", styleId: null },
      { uid: "c", styleId: null },
    ];
    const selectedUid = "b";
    const after = before.map((p) => (p.uid === selectedUid ? { ...p, styleId: 99 } : p));
    expect(after.map((c) => eff(c, 7))).toEqual([7, 99, 7]);
  });

  it("assigning Color 2 to a selected cabinet preserves the default and every other cabinet", () => {
    const before: Cab[] = [
      { uid: "upper", styleId: null },
      { uid: "lower", styleId: null },
      { uid: "island", styleId: null },
    ];
    const designDefault = 7;
    const selectedUid = "upper";
    const colorTwo = 99;
    const after = before.map((cabinet) => (
      cabinet.uid === selectedUid ? { ...cabinet, styleId: colorTwo } : cabinet
    ));
    expect(after.map((cabinet) => eff(cabinet, designDefault))).toEqual([99, 7, 7]);
    expect(designDefault).toBe(7);
  });

  it("the explicit all-cabinet scope spreads the selected override to every other cabinet", () => {
    const placed: Cab[] = [
      { uid: "a", styleId: null },
      { uid: "b", styleId: 99 }, // selected with a navy override
      { uid: "c", styleId: null },
      { uid: "d", styleId: 12 },
    ];
    const selectedUid = "b";
    const sel = placed.find((p) => p.uid === selectedUid)!;
    const target = sel.styleId!;
    const after = placed.map((p) =>
      p.uid === selectedUid ? p : p.styleId !== target ? { ...p, styleId: target } : p
    );
    // Every cabinet now resolves to the navy override (one design, one color
    // again — the inverse operation of going two-tone).
    expect(after.map((c) => eff(c, 7))).toEqual([99, 99, 99, 99]);
  });
});

describe("two-color slot selector (DesignTool slot behavior, pure replicas)", () => {
  // Replica of the slot model: styleA mirrors the active style; switching the
  // active slot swaps the active style to that slot's style; new cabinets stamp
  // the active style ONLY when a second color (slot B) exists.
  type State = { styleId: number | null; styleA: number | null; styleB: number | null; activeSlot: "A" | "B" };
  const selectSlot = (s: State, slot: "A" | "B"): State => {
    const target = slot === "A" ? s.styleA : s.styleB;
    return { ...s, activeSlot: slot, styleId: target != null ? target : s.styleId };
  };
  // newCab.styleId stamp rule from addCabinet.
  const stamp = (s: State): number | null => (s.styleB != null ? s.styleId : null);

  it("single color (no slot B): new cabinets are NOT stamped (track the default)", () => {
    const s: State = { styleId: 7, styleA: 7, styleB: null, activeSlot: "A" };
    expect(stamp(s)).toBeNull();
  });

  it("selecting slot B makes B the active style and stamps B onto new cabinets", () => {
    let s: State = { styleId: 7, styleA: 7, styleB: 99, activeSlot: "A" };
    s = selectSlot(s, "B");
    expect(s.activeSlot).toBe("B");
    expect(s.styleId).toBe(99);
    expect(stamp(s)).toBe(99); // a cabinet dropped now keeps navy
  });

  it("switching back to slot A stamps A; perimeter+island keep their own colors", () => {
    // Consistent active-B state: styleId mirrors B because B is active.
    let s: State = { styleId: 99, styleA: 7, styleB: 99, activeSlot: "B" };
    // dropped an island cabinet in B (stamp captured at drop time)
    const islandStyle = stamp(s);
    s = selectSlot(s, "A");
    const perimeterStyle = stamp(s);
    expect(islandStyle).toBe(99);
    expect(perimeterStyle).toBe(7);
  });

  it("removing slot B reverts B-colored cabinets to the default (null override)", () => {
    const styleB = 99;
    const placed = [
      { uid: "a", styleId: null },
      { uid: "b", styleId: 99 }, // placed in B
      { uid: "c", styleId: 99 },
    ];
    const after = placed.map((p) => (p.styleId === styleB ? { ...p, styleId: null } : p));
    expect(after.map((p) => p.styleId)).toEqual([null, null, null]);
  });
});

describe("custom sizing (W/H/D)", () => {
  it("flags width as custom only when it differs from the captured nominal", () => {
    expect(isCustomWidth(cab({ width: 24, nominalWidth: 24 }))).toBe(false);
    expect(isCustomWidth(cab({ width: 27, nominalWidth: 24 }))).toBe(true);
    // No nominal captured (older designs) => never custom.
    expect(isCustomWidth(cab({ width: 27 }))).toBe(false);
    // Within rounding margin => not custom.
    expect(isCustomWidth(cab({ width: 24.1, nominalWidth: 24 }))).toBe(false);
  });

  it("flags height and depth independently", () => {
    expect(isCustomHeight(cab({ height: 34.5, nominalHeight: 34.5 }))).toBe(false);
    expect(isCustomHeight(cab({ height: 40, nominalHeight: 34.5 }))).toBe(true);
    expect(isCustomDepth(cab({ depth: 24, nominalDepth: 24 }))).toBe(false);
    expect(isCustomDepth(cab({ depth: 30, nominalDepth: 24 }))).toBe(true);
  });

  it("isCustomSize is true when ANY dimension is custom", () => {
    expect(isCustomSize(cab({ width: 24, depth: 24, height: 34.5, nominalWidth: 24, nominalDepth: 24, nominalHeight: 34.5 }))).toBe(false);
    expect(isCustomSize(cab({ width: 24, depth: 30, height: 34.5, nominalWidth: 24, nominalDepth: 24, nominalHeight: 34.5 }))).toBe(true);
  });

  it("customSizeNote lists only the changed dimensions", () => {
    expect(customSizeNote(cab({ width: 24, depth: 24, height: 34.5, nominalWidth: 24, nominalDepth: 24, nominalHeight: 34.5 }))).toBe("");
    const note = customSizeNote(cab({ width: 27, depth: 24, height: 40, nominalWidth: 24, nominalDepth: 24, nominalHeight: 34.5 }));
    expect(note).toContain("CUSTOM");
    expect(note).toContain('27"W');
    expect(note).toContain('40"H');
    expect(note).not.toContain('"D');
  });

  it("dimLabel appends a Custom marker when resized", () => {
    expect(dimLabel(cab({ width: 24, depth: 24, height: 34.5, nominalWidth: 24, nominalDepth: 24, nominalHeight: 34.5 }))).not.toContain("Custom");
    expect(dimLabel(cab({ width: 30, depth: 24, height: 34.5, nominalWidth: 24, nominalDepth: 24, nominalHeight: 34.5 }))).toContain("Custom");
  });
});

describe("custom size fee ($100)", () => {
  it("charges $0 for a stock (non-resized) cabinet", () => {
    expect(customSizeFee(cab({ width: 24, depth: 24, height: 34.5, nominalWidth: 24, nominalDepth: 24, nominalHeight: 34.5 }))).toBe(0);
  });
  it("charges a flat $100 once when any dimension is custom", () => {
    expect(customSizeFee(cab({ width: 27, depth: 24, height: 34.5, nominalWidth: 24, nominalDepth: 24, nominalHeight: 34.5 }))).toBe(CUSTOM_SIZE_FEE);
    expect(customSizeFee(cab({ width: 27, depth: 30, height: 40, nominalWidth: 24, nominalDepth: 24, nominalHeight: 34.5 }))).toBe(CUSTOM_SIZE_FEE);
    expect(CUSTOM_SIZE_FEE).toBe(100);
  });
  it("does not charge when no nominal was captured (older designs)", () => {
    expect(customSizeFee(cab({ width: 27, depth: 24 }))).toBe(0);
  });
});

describe("per-cabinet door/hardware attributes (right-click dialog)", () => {
  it("notes an open unit when the door is removed", () => {
    expect(cabinetAttrNote({ noDoor: true })).toBe("No door (open unit)");
  });

  it("open unit wins over a handle side (an open unit has no handle)", () => {
    expect(cabinetAttrNote({ noDoor: true, handleSide: "left" })).toBe(
      "No door (open unit)"
    );
  });

  it("notes legacy and explicit hardware placement when a door is present", () => {
    expect(cabinetAttrNote({ handleSide: "left" })).toBe("Hardware left");
    expect(cabinetAttrNote({ handleSide: "right" })).toBe("Hardware right");
    expect(cabinetAttrNote({ hardwarePosition: "center" })).toBe("");
    expect(cabinetAttrNote({ hardwarePosition: "paired" })).toBe("Hardware paired");
  });

  it("returns an empty note when nothing is set", () => {
    expect(cabinetAttrNote({})).toBe("");
    expect(cabinetAttrNote({ noDoor: false, handleSide: null })).toBe("");
  });

  it("accepts the new attribute fields on PlacedCabinet", () => {
    const p = cab({ noDoor: true, handleSide: "right", hardwarePosition: "center", rolloutQty: 2 });
    expect(p.noDoor).toBe(true);
    expect(p.handleSide).toBe("right");
    expect(p.hardwarePosition).toBe("center");
    expect(p.rolloutQty).toBe(2);
  });
});

import { isPlaceableAccessory, accessoryPlacement, isLooseTrimItem } from "./design";

describe("accessory placement (item 5: accessories into the drawing)", () => {
  it("treats panels, fillers, floating shelves, skins and appliance garages as placeable", () => {
    expect(isPlaceableAccessory({ masterCode: "BDEP", description: "Base Decorative End Panel", subCategory: "Decorative End Panels" })).toBe(true);
    expect(isPlaceableAccessory({ masterCode: "DWEP", description: "Dishwasher End Panel" })).toBe(true);
    expect(isPlaceableAccessory({ masterCode: "FILL-3", description: "3 inch Filler", subCategory: "Filler" })).toBe(true);
    expect(isPlaceableAccessory({ masterCode: "FS-30", description: "Floating Shelf 30 inch", subCategory: "Floating Shelf" })).toBe(true);
    expect(isPlaceableAccessory({ masterCode: "WS-12-42", description: "Wall Skin", subCategory: "Skin Panels" })).toBe(true);
    expect(isPlaceableAccessory({ masterCode: "AG-24", description: "Appliance Garage 24" })).toBe(true);
  });

  it("keeps loose by-the-foot trim and hardware as BOM-only (not placeable)", () => {
    expect(isPlaceableAccessory({ masterCode: "CM-8", description: "Crown Molding 8ft", subCategory: "Trim & Molding" })).toBe(false);
    expect(isPlaceableAccessory({ masterCode: "LR-8", description: "Light Rail Molding" })).toBe(false);
    expect(isPlaceableAccessory({ masterCode: "ROT-21", description: "Roll-Out Tray 21", subCategory: "Roll-Out Trays" })).toBe(false);
    expect(isPlaceableAccessory({ masterCode: "PULL-5", description: "Bar Pull Hardware" })).toBe(false);
    expect(isPlaceableAccessory({ masterCode: "TEP3096", description: "Tall End Panel for Refrigerator Bridge Cabinet", subCategory: "Refrigerator End Panel" })).toBe(false);
  });

  it("isLooseTrimItem flags molding/hardware/trays", () => {
    expect(isLooseTrimItem({ description: "Crown Molding" })).toBe(true);
    expect(isLooseTrimItem({ description: "Toe Kick" })).toBe(true);
    expect(isLooseTrimItem({ description: "Base Decorative End Panel" })).toBe(false);
  });

  it("assigns base placement to floor panels and wall placement to skins/garages", () => {
    expect(accessoryPlacement({ masterCode: "BDEP", description: "Base Decorative End Panel" })).toBe("base");
    expect(accessoryPlacement({ masterCode: "FS-30", description: "Floating Shelf 30 inch" })).toBe("wall");
    expect(accessoryPlacement({ masterCode: "WS-12-42", description: "Wall Skin" })).toBe("wall");
    expect(accessoryPlacement({ masterCode: "AG-24", description: "Appliance Garage" })).toBe("wall");
  });
});

describe("dishwasher/base end panel placement", () => {
  it("identifies dishwasher end panels without misclassifying decorative or refrigerator panels", () => {
    expect(isDishwasherPanel({ masterCode: "DWEP", description: "Dishwasher End Panel" })).toBe(true);
    expect(isDishwasherPanel({ masterCode: "BDEP", description: "Base Decorative End Panel" })).toBe(false);
    expect(isDishwasherPanel({ masterCode: "REPV2496", description: "Refrigerator End Panel" })).toBe(false);
  });

  it("normalizes a stale elevated dishwasher panel onto the base layer at floor level", () => {
    const elevated: PlacedCabinet = {
      uid: "dw-panel", cabinetId: 10, masterCode: "DWEP", description: "Dishwasher End Panel",
      category: "Panel", subCategory: "Dishwasher End Panel", placement: "wall", x: 24, y: 0,
      width: 24, depth: 0.75, height: 34.5, mountBottom: 18, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 0,
    };
    expect(normalizeDishwasherPanelPlacement(elevated)).toMatchObject({
      placement: "base",
      mountBottom: 1 / 3,
      mountBottomAdjusted: true,
    });
  });

  it("does not allow a dishwasher panel to remain elevated, even at one-third inch", () => {
    const panel: PlacedCabinet = {
      uid: "dw-panel-valid", cabinetId: 11, masterCode: "DW-PANEL", description: "Base End Panel",
      category: "Panel", subCategory: "Dishwasher Panel", placement: "base", x: 0, y: 0,
      width: 24, depth: 0.75, height: 34.5, mountBottom: 0.33, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 0,
    };
    expect(normalizeDishwasherPanelPlacement(panel)).toMatchObject({ placement: "base", mountBottom: 0.33, mountBottomAdjusted: true });
  });
});
describe("filler identity", () => {
  it("recognizes both compact F342 and FILL-3 catalog codes as trimmable fillers", () => {
    expect(isFillerItem({ masterCode: "F342", description: '3" x 42" Filler' })).toBe(true);
    expect(isFillerItem({ masterCode: "FILL-3", subCategory: "Filler" })).toBe(true);
    expect(isFillerItem({ masterCode: "B-24", description: "Base cabinet" })).toBe(false);
  });

  it("allows a 3-inch filler to trim in eighths while preserving a larger filler's catalog maximum", () => {
    expect(fillerWidthRange({ masterCode: "F342", width: 6, nominalWidth: 3 })).toEqual({ min: 0.125, max: 3 });
    expect(fillerWidthRange({ masterCode: "FILL-6", width: 6, nominalWidth: 6 })).toEqual({ min: 0.125, max: 6 });
  });
});

describe("snapPosition overlap prevention (drag butts against neighbors)", () => {
  const ROOM: RoomData = { width: 200, depth: 120 };

	it("pushes a dragged cabinet out so it butts flush to the right of a neighbor", () => {
	    // Neighbor occupies x:0..24 along the back wall. Drop a 24" cabinet mostly
	    // on top of it (x:10) but slightly to its right → should snap to x:24.
	    const neighbor = cab({ uid: "n1", placement: "base", x: 0, y: 0, width: 24, depth: 24 });
	    const moving = cab({ uid: "m1", placement: "base", x: 10, y: 0, width: 24, depth: 24 });
	    const res = snapPosition(moving, ROOM, [neighbor, moving]);
	    expect(res.x).toBe(24);
	    expect(res.y).toBe(0);
	    // No residual overlap.
	    expect(hasCollision({ ...moving, x: res.x, y: res.y }, [neighbor])).toBe(false);
	  });

	  it("prefers the nearest adjacent unit edge rather than the first saved unit edge", () => {
	    const farther = cab({ uid: "farther", placement: "base", x: 0, y: 0, width: 12, depth: 24 });
	    const nearer = cab({ uid: "nearer", placement: "base", x: 45, y: 0, width: 24, depth: 24 });
	    // The 24-inch cabinet is 3 inches from the nearer unit's left edge and 5
	    // inches from the farther unit's right edge; it must butt to the nearer unit.
	    const moving = cab({ uid: "moving", placement: "base", x: 18, y: 0, width: 24, depth: 24 });
	    const result = snapPosition(moving, ROOM, [farther, nearer]);
	    expect(result.x).toBe(21);
	    expect(result.snappedCabinet).toBe(true);
	    expect(hasCollision({ ...moving, x: result.x, y: result.y }, [farther, nearer])).toBe(false);
	  });

	it("pushes a dragged cabinet to the left when its center is left of the neighbor", () => {
    const neighbor = cab({ uid: "n2", placement: "base", x: 50, y: 0, width: 24, depth: 24 });
    // Moving cabinet center is left of the neighbor's center → push left to 26.
    const moving = cab({ uid: "m2", placement: "base", x: 40, y: 0, width: 24, depth: 24 });
    const res = snapPosition(moving, ROOM, [neighbor, moving]);
    expect(res.x).toBe(50 - 24);
    expect(hasCollision({ ...moving, x: res.x, y: res.y }, [neighbor])).toBe(false);
  });

  it("settles a cabinet between two neighbors without overlapping either", () => {
    const left = cab({ uid: "L", placement: "base", x: 0, y: 0, width: 24, depth: 24 });
    const right = cab({ uid: "R", placement: "base", x: 48, y: 0, width: 24, depth: 24 });
    // Exact 24" gap between them; drop a 24" cabinet roughly in the slot.
    const moving = cab({ uid: "M", placement: "base", x: 26, y: 0, width: 24, depth: 24 });
    const res = snapPosition(moving, ROOM, [left, right, moving]);
    expect(hasCollision({ ...moving, x: res.x, y: res.y }, [left, right])).toBe(false);
  });

  it("lets a wall cabinet share base plan space and butt flush to an adjacent wall cabinet", () => {
    const base = cab({ uid: "base", placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5 });
    const wall = cab({ uid: "wall", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 30, mountBottom: 54 });
    const movingWall = cab({ uid: "moving-wall", placement: "wall", x: 18, y: 0, width: 24, depth: 12, height: 30, mountBottom: 54 });
    const result = snapPosition(movingWall, ROOM, [base, wall]);
    expect(result.x).toBe(24);
    expect(result.y).toBe(0);
    expect(hasCollision({ ...movingWall, x: result.x, y: result.y }, [base, wall])).toBe(false);
  });

  it("explains a true same-category collision while preserving the allowed wall-over-base arrangement", () => {
    const base = cab({ uid: "base", placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5 });
    const wall = cab({ uid: "wall", placement: "wall", masterCode: "W-24", x: 0, y: 0, width: 24, depth: 12, height: 30, mountBottom: 54 });
    const movingWall = cab({ uid: "moving-wall", placement: "wall", masterCode: "W-18", x: 6, y: 0, width: 18, depth: 12, height: 30, mountBottom: 54 });
    expect(collisionReason(movingWall, [base])).toBeNull();
    expect(collisionReason(movingWall, [wall])).toBe('Cannot place W-18 here: it overlaps W-24, another wall cabinet, by 18". Edge-to-edge contact is allowed; physical overlap must be 0".');
  });

  it("uses one-sixteenth inch only to snap to exact zero overlap", () => {
    const wall = cab({ uid: "wall", placement: "wall", masterCode: "W-1242", x: 0, y: 0, width: 12, depth: 12, height: 42, mountBottom: 54 });
    const exact = cab({ uid: "exact", placement: "wall", masterCode: "WR3624", x: 12, y: 0, width: 36, depth: 24, height: 24, mountBottom: 70 });
    const seamTolerance = { ...exact, uid: "tolerance", x: 11.9375 };
    const trueOverlap = { ...exact, uid: "overlap", x: 11.875 };
    expect(hasCollision(exact, [wall])).toBe(false);
    expect(hasCollision(seamTolerance, [wall])).toBe(true);
    const snapped = snapCabinetSeamOverlap(seamTolerance, [wall]);
    expect(snapped.x).toBe(12);
    expect(snapped.x - (wall.x + wall.width)).toBe(0);
    expect(hasCollision(snapped, [wall])).toBe(false);
    expect(hasCollision(trueOverlap, [wall])).toBe(true);
    expect(collisionReason(trueOverlap, [wall])).toContain('by ⅛"');
  });

  it("uses the cabinet magnet conflict lock to seat a near one-inch same-run overlap at exact zero contact", () => {
    const left = cab({ uid: "locked-left", placement: "base", x: 0, y: 0, width: 24, depth: 24 });
    const moving = cab({ uid: "locked-moving", placement: "base", x: 23.125, y: 0, width: 18, depth: 24 });
    expect(hasCollision(moving, [left])).toBe(true);
    const locked = snapCabinetSeamOverlap(moving, [left], CABINET_CONFLICT_LOCK_IN);
    expect(locked.x).toBe(24);
    expect(hasCollision(locked, [left])).toBe(false);
  });

	  it("snaps a one-sixteenth-inch wall-cabinet gap to exact zero gap and zero overlap", () => {
    const left = cab({ uid: "left-wall", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 42, mountBottom: 54 });
    const right = cab({ uid: "right-wall", placement: "wall", x: 24.0625, y: 0, width: 18, depth: 12, height: 42, mountBottom: 54 });
    const snapped = snapCabinetSeamOverlap(right, [left]);
    expect(snapped.x).toBe(24);
    expect(snapped.x - (left.x + left.width)).toBe(0);
	    expect(hasCollision(snapped, [left])).toBe(false);
	  });

	  it("closes the common half-inch wall-cabinet hand-placement gap", () => {
	    const left = cab({ uid: "left-wall-half-inch", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 42, mountBottom: 54 });
	    const right = cab({ uid: "right-wall-half-inch", placement: "wall", x: 24.5, y: 0, width: 18, depth: 12, height: 42, mountBottom: 54 });
	    const snapped = snapCabinetSeamOverlap(right, [left]);
	    expect(snapped.x).toBe(24);
	    expect(snapped.x - (left.x + left.width)).toBe(0);
	    expect(hasCollision(snapped, [left])).toBe(false);
	  });

  it("seats a straight wall cabinet against the rotated envelope of a WDC2430 corner at exact zero overlap", () => {
    const wdc = cab({
      uid: "wdc-top-right",
      masterCode: "WDC2430",
      description: "24 inch Diagonal Wall Corner Cabinet",
      placement: "wall",
      x: 120,
      y: 0,
      width: 24,
      depth: 12,
      height: 30,
      rotation: 90,
      mountBottom: 54,
    });
    const nearSeam = cab({
      uid: "w1530-next-to-wdc",
      masterCode: "W-1530",
      description: "15 inch x 30 inch Wall Cabinet",
      placement: "wall",
      x: 105.125,
      y: 0,
      width: 15,
      depth: 12,
      height: 30,
      rotation: 0,
      mountBottom: 54,
    });

    expect(hasCollision(nearSeam, [wdc])).toBe(true);
    const snapped = snapCabinetSeamOverlap(nearSeam, [wdc], CABINET_CONFLICT_LOCK_IN);
    expect(snapped.x).toBe(105);
    expect(snapped.x + snapped.width).toBe(wdc.x);
    expect(hasCollision(snapped, [wdc])).toBe(false);
  });

	  it("seats W3042 against both exposed 24-inch legs of WDC2442 on diagonal measured walls", () => {
	    const room: RoomData = {
	      width: 200,
	      depth: 120,
	      ceilingHeight: 96,
	      openWallPath: true,
	      vertices: [
	        { id: "left", x: 0, y: 100 },
	        { id: "turn", x: 100, y: 0 },
	        { id: "right", x: 200, y: 100 },
	      ],
	      customWalls: [
	        { id: "down-left", startVertexId: "left", endVertexId: "turn", label: "Wall 5", lockedAngle: -45 },
	        { id: "down-right", startVertexId: "turn", endVertexId: "right", label: "Wall 6", lockedAngle: 45 },
	      ],
	    };
	    const wdcSource = cab({
	      uid: "measured-wdc2442",
	      masterCode: "WDC2442",
	      description: "24 inch Diagonal Corner Wall Cabinet",
	      placement: "wall",
	      width: 24,
	      depth: 24,
	      height: 42,
	      mountBottom: 54,
	      cornerType: "diagonal",
	    });
	    const cornerSpot = customWallTrueCornerPlacement(
	      wdcSource,
	      room.customWalls![0]!,
	      room.customWalls![1]!,
	      "turn",
	      room,
	    );
	    expect(cornerSpot).not.toBeNull();
	    const wdc2442 = { ...wdcSource, ...cornerSpot! };
	    const moving = cab({
	      uid: "measured-w3042",
	      masterCode: "W-3042",
	      description: "30 inch Wall Cabinet",
	      placement: "wall",
	      width: 30,
	      depth: 12,
	      height: 42,
	      mountBottom: 54,
	      rotation: 315,
	      wallId: "down-left",
	      wallOffset: 40,
	    });
	    const wallLengthIn = Math.hypot(100, 100);
	    const expectedStart = wallLengthIn - 24 - 30;
	    const preview = cabinetWallDragPreview(moving, room, [wdc2442, moving], [], expectedStart + 15);

	    expect(preview?.candidate).not.toBeNull();
	    expect(preview?.snapped).toBe(true);
	    expect(preview?.candidate?.wallId).toBe("down-left");
	    expect(preview?.candidate?.wallOffset).toBeCloseTo(expectedStart, 2);
	    expect(wallRunOffset(preview!.candidate!, "down-left" as never, room) + 30).toBeCloseTo(wallLengthIn - 24, 2);
	    expect(cabinetPlacementCollisionDetail(preview!.candidate!, [wdc2442], room)).toBeNull();

	    // The Floor Plan / catalog drag path uses cabinetWallMovePreview. The
	    // corner is owned by down-right at offset 0, so the straight W3042 must
	    // seat at offset 24 — never the old false one-inch AABB correction that
	    // pushed it back into the WDC body and rejected the move.
	    const rightSpot = wallPlacementAt(25, 30, 12, "down-right" as never, room);
	    const rightMoving = {
	      ...moving,
	      ...rightSpot,
	      rotation: rightSpot.rotation,
	      wallId: rightSpot.wallId,
	      wallOffset: rightSpot.wallOffset,
	    };
	    const rightPreview = cabinetWallMovePreview(
	      rightMoving,
	      { x: rightMoving.x, y: rightMoving.y },
	      room,
	      [wdc2442],
	      [],
	      { magnet: true, wallId: "down-right", seamToleranceIn: CABINET_CONFLICT_LOCK_IN },
	    );
	    expect(rightPreview.failure).toBeNull();
	    expect(rightPreview.candidate?.wallId).toBe("down-right");
	    expect(rightPreview.candidate?.wallOffset).toBe(24);
	    expect(cabinetPlacementCollisionDetail(rightPreview.candidate!, [wdc2442], room)).toBeNull();
	    // Catalog drops use the same final seam normalizer after their shared
	    // wall-run placement. It must retain the verified 24" run edge too.
		    const catalogSeam = snapCabinetSeamOverlap(rightPreview.candidate!, [wdc2442], CABINET_CONFLICT_LOCK_IN, room);
		    expect(catalogSeam.wallOffset).toBe(24);
		    expect(cabinetPlacementCollisionDetail(catalogSeam, [wdc2442], room)).toBeNull();

		    // A catalog drop first searches a collision-free run position before it
		    // commits the exact same W3042. Its preview must keep the real catalog
		    // dimensions/elevation and preserve this exposed WDC leg seam.
		    const catalogDrop = firstCollisionFreeWallPlacement(
		      "down-right" as never,
		      room,
		      [wdc2442],
		      30,
		      12,
		      "wall",
		      24,
		      24,
		      24,
		      {
		        cabinetId: 2,
		        masterCode: "W-3042",
		        description: "30 inch Wall Cabinet",
		        height: 42,
		        mountBottom: 54,
		      },
		    );
		    expect(catalogDrop?.wallId).toBe("down-right");
		    expect(catalogDrop?.wallOffset).toBe(24);
		  });

  it("moves a straight wall cabinet past the physical clearance at an adjoining measured 45-degree run", () => {
    const room: RoomData = {
      width: 180,
      depth: 120,
      openWallPath: true,
      vertices: [
        { id: "start", x: 0, y: 0 },
        { id: "turn", x: 120, y: 0 },
        { id: "angled-end", x: 180, y: 60 },
      ],
      customWalls: [
        { id: "back-run", startVertexId: "start", endVertexId: "turn", label: "Wall 1" },
        { id: "angle-run", startVertexId: "turn", endVertexId: "angled-end", label: "Wall 2", lockedAngle: 45 },
      ],
    };
    const firstSpot = wallPlacementAt(96, 24, 12, "back-run" as any, room);
    const backWallCabinet = cab({
      uid: "back-wall-cabinet", masterCode: "W-2442", description: "24 inch Wall Cabinet", placement: "wall", width: 24, depth: 12, height: 42, mountBottom: 54, ...firstSpot,
    });
    const secondSpot = paletteActiveWallPlacement("angle-run" as any, room, [backWallCabinet], [], 24, 12, "wall");
    expect(secondSpot).not.toBeNull();
    const angledWallCabinet = cab({
      uid: "angled-wall-cabinet", masterCode: "W-2442", description: "24 inch Wall Cabinet", placement: "wall", width: 24, depth: 12, height: 42, mountBottom: 54, ...secondSpot!,
    });

    // The visible 45° wall join is preserved, while its straight upper starts at
    // the first collision-free offset instead of being rejected at the vertex.
    expect(angledWallCabinet.wallOffset).toBeGreaterThan(0);
    expect(hasCollision(angledWallCabinet, [backWallCabinet])).toBe(false);
    expect(cabinetPlacementCollisionDetail(angledWallCabinet, [backWallCabinet], room)).toBeNull();
    expect(wallRunOffset(angledWallCabinet, "angle-run", room)).toBeGreaterThan(0);
  });

  it("enforces exact-zero adjacency for horizontal and rotated base-cabinet runs", () => {
    const horizontal = cab({ uid: "horizontal-base", placement: "base", x: 0, y: 0, width: 24, depth: 24, rotation: 0 });
    const horizontalMoving = cab({ uid: "horizontal-moving", placement: "base", x: 23.95, y: 0, width: 18, depth: 24, rotation: 0 });
    const horizontalSnapped = snapCabinetSeamOverlap(horizontalMoving, [horizontal]);
    expect(horizontalSnapped.x).toBe(24);
    expect(hasCollision(horizontalSnapped, [horizontal])).toBe(false);

    const vertical = cab({ uid: "vertical-base", placement: "base", x: 72, y: 0, width: 24, depth: 24, rotation: 90 });
    const verticalMoving = cab({ uid: "vertical-moving", placement: "base", x: 72, y: 23.95, width: 18, depth: 24, rotation: 90 });
    const verticalSnapped = snapCabinetSeamOverlap(verticalMoving, [vertical]);
    expect(verticalSnapped.y).toBe(24);
    expect(hasCollision(verticalSnapped, [vertical])).toBe(false);
  });

  it("restores a saved near-seam wall cabinet at exact zero overlap instead of removing it", () => {
    const wall = cab({ uid: "wall", placement: "wall", masterCode: "W-1242", x: 0, y: 0, width: 12, depth: 12, height: 42, mountBottom: 54 });
    const wr = cab({ uid: "wr", placement: "wall", masterCode: "WR3624", x: 11.9375, y: 0, width: 36, depth: 24, height: 24, mountBottom: 70 });
    const restored = removeOverlappingPlacements([wall, wr]);
    expect(restored.rejected).toEqual([]);
    expect(restored.placed.find((item) => item.uid === "wr")?.x).toBe(12);
    expect(hasCollision(restored.placed[1], [restored.placed[0]])).toBe(false);
  });

  it("never permits base/base or wall/wall overlap, even with explicit custom placement", () => {
    const existing = cab({ uid: "existing", placement: "base", masterCode: "B-24", x: 0, y: 0, width: 24, depth: 24 });
    const moving = cab({ uid: "moving", placement: "base", masterCode: "B-18", x: 6, y: 0, width: 18, depth: 24 });
    expect(shouldBlockPlacementCollision(moving, [existing])).toBe(true);
    expect(shouldBlockPlacementCollision(moving, [existing], true)).toBe(true);

    const existingWall = cab({ uid: "existing-wall", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 42, mountBottom: 54 });
    const movingWall = cab({ uid: "moving-wall", placement: "wall", x: 12, y: 0, width: 18, depth: 12, height: 42, mountBottom: 54 });
    expect(shouldBlockPlacementCollision(movingWall, [existingWall], true)).toBe(true);
  });

  it("retains the explicit custom-placement override for non-cabinet items", () => {
    const existing = cab({ uid: "existing-appliance", placement: "appliance", masterCode: "CUSTOM-A", x: 0, y: 0, width: 24, depth: 24 });
    const moving = cab({ uid: "moving-appliance", placement: "appliance", masterCode: "CUSTOM-B", x: 6, y: 0, width: 18, depth: 24 });
    expect(shouldBlockPlacementCollision(moving, [existing])).toBe(true);
    expect(shouldBlockPlacementCollision(moving, [existing], true)).toBe(false);
  });

  it("allows a range hood above its matching range while retaining appliance collision blocking for unrelated items", () => {
    const range = cab({ uid: "range", placement: "appliance", masterCode: "RANGE-30", description: "30 inch Range", x: 36, y: 0, width: 30, depth: 24, height: 34.5 });
    const hood = cab({ uid: "hood", placement: "appliance", masterCode: "HOOD-30", description: "30 inch Range Hood", x: 36, y: 0, width: 30, depth: 12, height: 30, mountBottom: 54 });
    const microwave = cab({ uid: "microwave", placement: "appliance", masterCode: "MICRO-30", description: "30 inch Microwave", x: 36, y: 0, width: 30, depth: 12, height: 17, mountBottom: 54 });
    expect(isHoodOverRangePair(hood, range)).toBe(true);
    expect(hasCollision(hood, [range])).toBe(false);
    expect(hasCollision(microwave, [range])).toBe(true);
  });
});

describe("ceiling height fit checks", () => {
  it("roomCeiling falls back to default for missing/out-of-range values", () => {
    expect(roomCeiling(undefined)).toBe(DEFAULT_CEILING_HEIGHT);
    expect(roomCeiling({})).toBe(DEFAULT_CEILING_HEIGHT);
    expect(roomCeiling({ ceilingHeight: 50 })).toBe(DEFAULT_CEILING_HEIGHT); // below MIN
    expect(roomCeiling({ ceilingHeight: 999 })).toBe(DEFAULT_CEILING_HEIGHT); // above MAX
    expect(roomCeiling({ ceilingHeight: 108 })).toBe(108); // 9ft honored
  });

  it("wallCabinetTopLine hangs uppers higher on taller ceilings, never below 84", () => {
    expect(wallCabinetTopLine({ ceilingHeight: 96 })).toBe(84); // 8ft unchanged
    expect(wallCabinetTopLine({ ceilingHeight: 84 })).toBe(84); // 7ft never below 84
    // 11ft (132") -> 132 - 12 reveal = 120, above the historical 84 line
    expect(wallCabinetTopLine({ ceilingHeight: 132 })).toBe(120);
  });

  it("flags a tall pantry that exceeds the ceiling but not under a taller ceiling", () => {
    const pantry = cab({ uid: "p1", placement: "tall", x: 0, y: 0, width: 24, depth: 24, height: 96 });
    // 8ft ceiling (96"): a 96" pantry just fits (<= ceil + 0.5).
    expect(ceilingFitViolations([pantry], { ceilingHeight: 96 }).has("p1")).toBe(false);
    // 7ft ceiling (84"): the 96" pantry does NOT fit.
    expect(ceilingFitViolations([pantry], { ceilingHeight: 84 }).has("p1")).toBe(true);
  });

  it("flags a tall wall cabinet whose hung top exceeds the ceiling", () => {
    // 42" upper bottom-anchored at 54" tops out at 96" -> needs > 96" ceiling.
    const upper = cab({ uid: "w1", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 42 });
    expect(ceilingFitViolations([upper], { ceilingHeight: 96 }).has("w1")).toBe(false); // exactly fits
    expect(ceilingFitViolations([upper], { ceilingHeight: 90 }).has("w1")).toBe(true); // 90" too low
  });

  it("never flags base or appliance cabinets", () => {
    const base = cab({ uid: "b1", placement: "base", x: 0, y: 0, width: 24, depth: 24, height: 34.5 });
    expect(ceilingFitViolations([base], { ceilingHeight: 84 }).size).toBe(0);
  });
});


describe("missingCornerBaseViolations (only flags a corner base when a door/opening is at that corner)", () => {
  // 10ft x 10ft room so the bottom-left corner is at (0, room.depth).
  const ROOM: RoomData = { width: 120, depth: 120 };

  // A plain 18" base sitting in the bottom-left corner: touches the LEFT wall
  // (x=0) and the BOTTOM wall (y + depth == room.depth).
  const cornerBase = (): PlacedCabinet =>
    cab({
      uid: "b18",
      masterCode: "B-18",
      description: "Base 18",
      placement: "base",
      x: 0,
      y: ROOM.depth - 24,
      width: 18,
      depth: 24,
      rotation: 0,
    });

  it("does NOT flag a standard base in a wall-only corner (no door there)", () => {
    const v = missingCornerBaseViolations([cornerBase()], ROOM, null, []);
    expect(v.has("b18")).toBe(false);
    expect(v.size).toBe(0);
  });

  it("does NOT flag when the only opening is far from the corner", () => {
    // A door in the MIDDLE of the bottom wall (offset 48..78 on a 120" wall).
    const door = makeOpening(
      OPENINGS.find((o) => o.key === "interior-door")!,
      "bottom",
      ROOM,
    );
    // makeOpening centers it; that's mid-wall, nowhere near the left corner.
    const v = missingCornerBaseViolations([cornerBase()], ROOM, null, [door]);
    expect(v.has("b18")).toBe(false);
  });

  it("DOES flag a standard base when a door reaches that corner", () => {
    // Door on the bottom wall pushed to the left corner (offset 0).
    const door: WallOpening = {
      uid: "d1",
      kind: "door",
      label: "Interior Door 30\"",
      side: "bottom",
      offset: 0,
      width: 30,
      height: 80,
      sill: 0,
    };
    const v = missingCornerBaseViolations([cornerBase()], ROOM, null, [door]);
    expect(v.has("b18")).toBe(true);
  });

  it("DOES flag when a door reaches the corner from the perpendicular (left) wall", () => {
    // Door on the LEFT wall pushed to its far end (bottom corner).
    const door: WallOpening = {
      uid: "d2",
      kind: "door",
      label: "Interior Door 30\"",
      side: "left",
      offset: ROOM.depth - 30,
      width: 30,
      height: 80,
      sill: 0,
    };
    const v = missingCornerBaseViolations([cornerBase()], ROOM, null, [door]);
    expect(v.has("b18")).toBe(true);
  });

  it("a WINDOW at the corner does NOT flag (windows don't block floor access)", () => {
    const win: WallOpening = {
      uid: "w1",
      kind: "window",
      label: "Window 36\"",
      side: "bottom",
      offset: 0,
      width: 36,
      height: 36,
      sill: 42,
    };
    const v = missingCornerBaseViolations([cornerBase()], ROOM, null, [win]);
    expect(v.has("b18")).toBe(false);
  });

  it("never flags a proper corner cabinet, including LS3612, even with a door at the corner", () => {
    const lazySusan = cab({
      uid: "ls3612",
      masterCode: "LS3612",
      description: "36-inch Lazy Susan Corner Base",
      placement: "base",
      x: 0,
      y: ROOM.depth - 24,
      width: 36,
      depth: 36,
    });
    const door: WallOpening = {
      uid: "d3", kind: "door", label: "d", side: "bottom", offset: 0, width: 30, height: 80, sill: 0,
    };
    const v = missingCornerBaseViolations([lazySusan], ROOM, null, [door]);
    expect(v.has("ls3612")).toBe(false);
  });
});

describe("filler conflict ownership", () => {
  const room: RoomData = { width: 144, depth: 120 };
  const window: WallOpening = {
    uid: "window-filler-test", kind: "window", label: "Window", side: "top",
    offset: 54, width: 36, height: 36, sill: 40,
  };

  it("does not flag a wall filler that borders a window seam", () => {
    const filler = cab({
      uid: "wall-filler", masterCode: "F342", description: '3" Filler',
      category: "Filler", subCategory: "Filler", placement: "wall",
      x: 90, y: 0, width: 3, depth: 12, height: 30,
    });
    expect(wallOpeningClearanceViolations([filler], [window], room).has(filler.uid)).toBe(false);
  });

  it("does not flag a floor filler crossing a cased opening", () => {
    const filler = cab({
      uid: "floor-filler", masterCode: "F342", description: '3" Filler',
      category: "Filler", subCategory: "Filler", placement: "base",
      x: 50, y: room.depth - 24, width: 3, depth: 24, height: 34.5,
    });
    const opening: WallOpening = {
      uid: "case-filler-test", kind: "opening", label: "Cased Opening", side: "bottom",
      offset: 50, width: 48, height: 80, sill: 0,
    };
    expect(baseOpeningOverlaps([filler], [opening], room).has(filler.uid)).toBe(false);
  });

  it("does not let an ordinary measured filler re-flag a blind-corner owner", () => {
    const blind = cab({
      uid: "blind-owner", masterCode: "BBC36", description: "Blind Corner Base", placement: "base",
      x: 0, y: 0, width: 36, depth: 24, height: 34.5,
    });
    const filler = cab({
      uid: "measured-filler", masterCode: "F600", description: '6" Filler',
      category: "Filler", subCategory: "Filler", placement: "base",
      x: 0, y: 23, width: 6, depth: 24, height: 34.5, rotation: 90,
    });
    expect(blindCornerViolations([blind, filler]).has(blind.uid)).toBe(false);
  });
});

describe("window sill-to-top clearance", () => {
  const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
  const raisedWindow = {
    uid: "over-sink-window", kind: "window", label: 'Over-Sink Window 30"',
    side: "top", offset: 54.25, width: 36, height: 48, sill: 44,
  } as WallOpening;

  it("keeps a base cabinet below a 44-inch sill while blocking upper, tall, and hood envelopes in the window zone", () => {
    const base = {
      uid: "base-under-window", masterCode: "B24", description: "24 inch Base Cabinet",
      placement: "base", x: 54.25, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0,
    } as PlacedCabinet;
    const wall = {
      uid: "wall-through-window", masterCode: "W3030", description: "30 inch Wall Cabinet",
      placement: "wall", x: 54.25, y: 0, width: 30, depth: 12, height: 30, rotation: 0, mountBottom: 54,
    } as PlacedCabinet;
    const tall = {
      uid: "tall-through-window", masterCode: "P2496", description: "Tall Pantry",
      placement: "tall", x: 54.25, y: 0, width: 24, depth: 24, height: 84, rotation: 0,
    } as PlacedCabinet;
    const hood = {
      uid: "hood-through-window", masterCode: "HOOD-30", description: "30 inch Range Hood",
      placement: "appliance", x: 54.25, y: 0, width: 30, depth: 18, height: 18, rotation: 0, mountBottom: 66,
    } as PlacedCabinet;

    expect(windowVerticallyOverlapsCabinet(base, raisedWindow, room)).toBe(false);
    expect(windowVerticallyOverlapsCabinet(wall, raisedWindow, room)).toBe(true);
    expect(windowVerticallyOverlapsCabinet(tall, raisedWindow, room)).toBe(true);
    expect(windowVerticallyOverlapsCabinet(hood, raisedWindow, room)).toBe(true);
    expect(baseOpeningOverlaps([base], [raisedWindow], room)).toEqual(new Set());
  });

  it("flags a window below the finished countertop and blocks the affected base run", () => {
    const lowWindow = { ...raisedWindow, uid: "low-window", sill: 30 };
    const base = {
      uid: "base-at-low-window", masterCode: "B24", description: "24 inch Base Cabinet",
      placement: "base", x: 54.25, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0,
    } as PlacedCabinet;

    expect(isWindowBelowCountertop(lowWindow)).toBe(true);
    expect(baseOpeningOverlaps([base], [lowWindow], room)).toEqual(new Set([base.uid]));
  });
});
