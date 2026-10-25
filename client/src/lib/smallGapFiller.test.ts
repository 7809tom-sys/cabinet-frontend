import { describe, expect, it } from "vitest";
import { buildDesignCabinetCartLines, buildDesignPreviewPricingLines } from "@/lib/designCartLines";
import { DEFAULT_ROOM, adjacentCabinetForFiller, cabinetPlacementCollisionDetail, cabinetWallDragPreview, elevationBox, hasCollision, matchInstalledFillerToCabinet, nextAvailableRoomCornerPlacement, normalizeInstalledFillersToAdjacentCabinets, wallCabinetFitMeasure, wallLength, wallPlacementAt, type IslandFace, type IslandZone, type PlacedCabinet, type RoomData, type WallOpening } from "@/lib/design";
import { islandFacePlacement } from "@/lib/islandScene";
import {
	appendSmallGapFillerPlacement,
	automaticSmallGapFillerMode,
	canSplitSmallGapFiller,
	findSmallGapFillerOpportunity,
	findFirstCabinet45CornerFillerOpportunity,
	findPreferredSmallGapFillerOpportunity,
	findIslandSmallGapFillerOpportunity,
	installedFillerVerticalSpec,
	installedSmallGapFillerEditOpportunity,
	optimalSmallGapFillerCut,
	removePlacedCabinetGroup,
  smallGapFillerOpportunityFromDragPreview,
  smallGapFillerLayout,
  wallBlindCornerPreferredFillerMode,
} from "@/lib/smallGapFiller";

const cabinet: PlacedCabinet = {
  uid: "cabinet-1", cabinetId: 10, masterCode: "B-18", description: "18 inch base", placement: "base",
  x: 0, y: 0, width: 18, depth: 24, height: 34.5, rotation: 0,
};

	describe("small-gap filler placement", () => {
		it("offers one provisional filler when the first cabinet seats at a true 45-degree hold", () => {
			const cornerRoom: RoomData = {
				...DEFAULT_ROOM,
				width: 180,
				depth: 180,
				vertices: [{ id: "v1", x: 0, y: 0 }, { id: "v2", x: 60, y: 60 }, { id: "v3", x: 60, y: 180 }, { id: "v4", x: 0, y: 180 }],
				customWalls: [
					{ id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 },
					{ id: "straight", startVertexId: "v2", endVertexId: "v3" },
					{ id: "return", startVertexId: "v3", endVertexId: "v4" },
					{ id: "close", startVertexId: "v4", endVertexId: "v1" },
				],
			};
			// A 12-inch upper has half the 11-inch 45-degree hold of a 24-inch base.
			const spot = wallPlacementAt(5.5, 27, 12, "straight", cornerRoom);
			const firstUpper: PlacedCabinet = { ...cabinet, uid: "first-45-upper", masterCode: "B27FH", placement: "wall", width: 27, depth: 12, height: 42, mountBottom: 54, ...spot };
			// The dedicated protected-corner result must win over any generic seam.
			expect(findPreferredSmallGapFillerOpportunity(cornerRoom, [firstUpper], [], firstUpper.uid)).toMatchObject({
				cabinetUid: firstUpper.uid,
				remaining: 1,
				cornerMiterProvisional: { at: "start" },
			});
			expect(findFirstCabinet45CornerFillerOpportunity(cornerRoom, [firstUpper], firstUpper.uid)).toMatchObject({
				cabinetUid: firstUpper.uid,
				remaining: 1,
				preferredMode: "left",
				cornerMiterProvisional: { at: "start" },
			});
		});

		it("waits to offer an ERB36-side filler until a neighboring cabinet creates a real small seam", () => {
		  const erb36: PlacedCabinet = {
		    ...cabinet,
		    uid: "erb36-corner",
		    masterCode: "ERB36",
		    description: "Easy Reach Corner Base 36",
		    width: 36,
		    depth: 24,
		    rotation: 0,
		  };
		  const b18: PlacedCabinet = {
		    ...cabinet,
		    uid: "b18-next-to-erb36",
		    masterCode: "B18",
		    description: "18 inch Base Cabinet",
		    x: 38.5,
		    width: 18,
		  };
		  const room = { ...DEFAULT_ROOM, width: 144 };
		  expect(findSmallGapFillerOpportunity(room, [erb36], [], erb36.uid)).toBeNull();
		  expect(findSmallGapFillerOpportunity(room, [erb36, b18], [], b18.uid)).toMatchObject({
		    remaining: 2.5,
		    openingStart: 36,
		    openingLength: 20.5,
		    preferredMode: "left",
		  });
		});

		it("selects the correct one-click layout for split and one-sided small gaps", () => {
	  const baseOpportunity = {
	    cabinetUid: "cabinet-1",
	    wall: "top" as const,
	    layer: "base" as const,
	    cabinetStart: 1,
	    cabinetSpan: 18,
	    openingStart: 0,
	    openingLength: 20,
	    remaining: 2,
	  };
	  expect(automaticSmallGapFillerMode(baseOpportunity)).toBe("split");
		expect(automaticSmallGapFillerMode({ ...baseOpportunity, cabinetStart: 0.75, openingLength: 18.75, remaining: 0.75 })).toBe("split");
		expect(automaticSmallGapFillerMode({ ...baseOpportunity, cabinetStart: 0, openingLength: 18.75, remaining: 0.75 })).toBe("split");
		});

		it("recommends the full measured seam as the optimal filler cut", () => {
		  expect(optimalSmallGapFillerCut({ remaining: 6 })).toBe(6);
		  expect(optimalSmallGapFillerCut({ remaining: 2.375 })).toBe(2.375);
		  expect(optimalSmallGapFillerCut({ remaining: 0.125 })).toBe(0.125);
		  expect(optimalSmallGapFillerCut({ remaining: 0.625 })).toBe(0.625);
		  expect(optimalSmallGapFillerCut({ remaining: 6.125 })).toBeNull();
		});

		it("offers left or right placement for a source-backed sub-inch seam with no minimum cut", () => {
		  const subInchRoom = { ...DEFAULT_ROOM, width: 18.625 };
		  const subInchCabinet = { ...cabinet, uid: "sub-inch-right", width: 18 };
		  expect(findSmallGapFillerOpportunity(subInchRoom, [subInchCabinet], [], subInchCabinet.uid)).toMatchObject({
		    remaining: 0.625,
		    preferredMode: "right",
		  });
			expect(optimalSmallGapFillerCut({ remaining: 0.0625 })).toBe(0.0625);
			expect(canSplitSmallGapFiller({ remaining: 0.125 })).toBe(true);
			expect(canSplitSmallGapFiller({ remaining: 0.25 })).toBe(true);
			expect(canSplitSmallGapFiller({ remaining: 0.625 })).toBe(true);
		});

		it("prompts for a B18 half-inch seam immediately before a window opening", () => {
		  const b18: PlacedCabinet = { ...cabinet, uid: "b18-before-window", masterCode: "B18", x: 81.5, width: 18 };
		  const window: WallOpening = {
		    uid: "window-right-of-b18",
		    kind: "window",
		    label: "Window",
		    side: "top",
		    offset: 100,
		    width: 20,
		    height: 48,
		    sill: 42,
		  };
		  expect(findSmallGapFillerOpportunity({ ...DEFAULT_ROOM, width: 120 }, [b18], [window], b18.uid)).toMatchObject({
		    remaining: 0.5,
		    openingStart: 81.5,
		    openingLength: 18.5,
		    preferredMode: "right",
		  });
		});

		it("places a start-corner WBC-27-42 filler on the blind side, to the left of its door", () => {
		const wbc: PlacedCabinet = {
			...cabinet,
			uid: "wbc-start",
			masterCode: "WBC-27-42",
			description: "27 inch Blind Corner Wall Cabinet",
			placement: "wall",
			x: 0,
			y: 0,
			width: 27,
			depth: 12,
			height: 42,
			mountBottom: 54,
			rotation: 0,
			swing: "right",
			openingWidth: 12,
		};
		const opportunity = findSmallGapFillerOpportunity({ ...DEFAULT_ROOM, width: 30 }, [wbc], [], wbc.uid)!;
		expect(opportunity).toMatchObject({ remaining: 3, cabinetStart: 0, openingStart: 0 });
		expect(automaticSmallGapFillerMode(opportunity)).toBe("left");
	});

	it("mirrors the fixed left-of-door WBC filler into increasing run coordinates on the bottom wall", () => {
		const wbc: PlacedCabinet = {
			...cabinet,
			uid: "wbc-end",
			masterCode: "WBC-27-42",
			description: "27 inch Blind Corner Wall Cabinet",
			placement: "wall",
			x: 0,
			y: DEFAULT_ROOM.depth - 12,
			width: 27,
			depth: 12,
			height: 42,
			mountBottom: 54,
			rotation: 180,
			swing: "left",
			openingWidth: 12,
		};
		const opportunity = findSmallGapFillerOpportunity({ ...DEFAULT_ROOM, width: 30 }, [wbc], [], wbc.uid)!;
		expect(opportunity).toMatchObject({ remaining: 3, cabinetStart: 0, openingStart: 0 });
		expect(automaticSmallGapFillerMode(opportunity)).toBe("right");
	});

	it.each([
		["top", "left"],
		["bottom", "right"],
		["left", "right"],
		["right", "left"],
	] as const)("maps the WBC blind-left filler to the %s wall's %s run side", (wall, expectedMode) => {
		expect(wallBlindCornerPreferredFillerMode({
			masterCode: "WBC-27-42",
			description: "27 inch Blind Corner Wall Cabinet",
		}, wall)).toBe(expectedMode);
	});

  it("cuts a base filler to the adjoining cabinet height above the 4½-inch toe kick", () => {
    expect(installedFillerVerticalSpec("base", 34.5)).toEqual({
      storedHeight: 34.5,
      visibleBottom: 4.5,
      visibleHeight: 30,
      visibleTop: 34.5,
    });
    expect(installedFillerVerticalSpec("base", 36)).toEqual({
      storedHeight: 36,
      visibleBottom: 4.5,
      visibleHeight: 31.5,
      visibleTop: 36,
    });
  });

	  it("preserves the catalog height for wall fillers", () => {
	    expect(installedFillerVerticalSpec("wall", 42)).toEqual({
	      storedHeight: 42,
	      visibleBottom: 0,
	      visibleHeight: 42,
	      visibleTop: 42,
	    });
	  });

	  it("makes an ordinary base filler exactly match its adjacent cabinet", () => {
	    const owner: PlacedCabinet = { ...cabinet, uid: "custom-base", depth: 25, height: 36, mountBottom: 1 };
	    const filler: PlacedCabinet = {
	      ...cabinet,
	      uid: "base-filler",
	      masterCode: "F342",
	      description: "Base filler — cut to 2\"",
	      category: "Filler",
	      width: 2,
	      x: 18,
	      depth: 24,
	      height: 34.5,
	    };
	    expect(matchInstalledFillerToCabinet(filler, owner, DEFAULT_ROOM)).toMatchObject({
	      placement: "base",
	      depth: 25,
	      height: 36,
	      mountBottom: 1,
	      fillerForCabinetUid: owner.uid,
	    });
	  });

	  it("makes refrigerator-side fillers span exactly the refrigerator bottom and top", () => {
	    const refrigerator: PlacedCabinet = {
	      ...cabinet,
	      uid: "refrigerator",
	      masterCode: "FRIDGE-36",
	      description: "36 inch refrigerator",
	      placement: "appliance",
	      width: 36,
	      depth: 30,
	      height: 70,
	      mountBottom: 0,
	    };
	    const filler: PlacedCabinet = {
	      ...cabinet,
	      uid: "refrigerator-filler",
	      masterCode: "FILL-3",
	      description: "3 inch filler",
	      category: "Filler",
	      width: 3,
	      height: 84,
	      mountBottom: 0,
	    };

	    const matched = matchInstalledFillerToCabinet(filler, refrigerator, DEFAULT_ROOM);

	    expect(matched).toMatchObject({
	      placement: "base",
	      height: 70,
	      mountBottom: 0,
	      fillerForCabinetUid: refrigerator.uid,
	      fillerMatchesFullOwnerEnvelope: true,
	    });
	    expect(elevationBox(matched, DEFAULT_ROOM)).toEqual({ bottom: 0, height: 70 });
	  });

	  it("repairs a stale base-owner link when a refrigerator directly owns the filler edge", () => {
	    const base: PlacedCabinet = { ...cabinet, uid: "base-left-of-fridge", width: 18, x: 0 };
	    const refrigerator: PlacedCabinet = {
	      ...cabinet,
	      uid: "refrigerator-owning-edge",
	      masterCode: "FRIDGE-36",
	      description: "36 inch refrigerator",
	      placement: "appliance",
	      x: 21,
	      width: 36,
	      depth: 30,
	      height: 70,
	      mountBottom: 0,
	    };
	    const legacyFiller: PlacedCabinet = {
	      ...cabinet,
	      uid: "legacy-filler-against-fridge",
	      masterCode: "F342",
	      description: "3 inch Base Filler",
	      category: "Filler",
	      x: 18,
	      width: 3,
	      height: 34.5,
	      mountBottom: 0,
	      fillerForCabinetUid: base.uid,
	      fillerMatchesFullOwnerEnvelope: false,
	    };

	    const normalized = normalizeInstalledFillersToAdjacentCabinets(
	      [base, legacyFiller, refrigerator],
	      DEFAULT_ROOM,
	    );

	    expect(normalized[1]).toMatchObject({
	      fillerForCabinetUid: refrigerator.uid,
	      fillerMatchesFullOwnerEnvelope: true,
	      placement: "base",
	      depth: 30,
	      height: 70,
	      mountBottom: 0,
	    });
	    expect(elevationBox(normalized[1]!, DEFAULT_ROOM)).toEqual({ bottom: 0, height: 70 });
	  });

	  it("repairs a legacy refrigerator-cap filler to the bridge instead of stretching it from the floor", () => {
		    const refrigerator: PlacedCabinet = {
		      ...cabinet,
		      uid: "fridge-with-legacy-cap-filler",
		      masterCode: "FRIDGE-36",
		      description: "36 inch refrigerator",
		      placement: "appliance",
		      x: 20,
		      width: 36,
		      depth: 30,
		      height: 70,
		      mountBottom: 0,
		    };
		    const bridge: PlacedCabinet = {
		      ...cabinet,
		      uid: "refrigerator-bridge",
		      masterCode: "WR3612",
		      description: "Refrigerator cabinet above",
		      placement: "wall",
		      x: 20,
		      width: 36,
		      depth: 24,
		      height: 12,
		      mountBottom: 72,
		      refrigeratorAssemblyId: refrigerator.uid,
		      refrigeratorAssemblyRole: "bridge",
		    };
		    // A previously saved cap filler can retain its old base layer and no
		    // explicit bridge owner. Its refrigerator role remains authoritative.
		    const legacyCapFiller: PlacedCabinet = {
		      ...cabinet,
		      uid: "legacy-bridge-left-filler",
		      masterCode: "F342",
		      description: "Filler — cut to 1/2 inch",
		      category: "Filler",
		      subCategory: "Filler",
		      placement: "base",
		      x: 19.5,
		      width: 0.5,
		      depth: 24,
		      height: 70,
		      mountBottom: 0,
		      refrigeratorAssemblyId: refrigerator.uid,
		      refrigeratorAssemblyRole: "bridge-left-filler",
		    };

		    const normalized = normalizeInstalledFillersToAdjacentCabinets(
		      [refrigerator, bridge, legacyCapFiller],
		      DEFAULT_ROOM,
		    );

		    expect(normalized[2]).toMatchObject({
		      placement: "wall",
		      depth: 24,
		      height: 12,
		      mountBottom: 72,
		      fillerForCabinetUid: bridge.uid,
		      fillerMatchesFullOwnerEnvelope: false,
		    });
		    expect(elevationBox(normalized[2]!, DEFAULT_ROOM)).toEqual({ bottom: 72, height: 12 });
		  });

		  it("keeps a legacy cap filler linked to its refrigerator bridge at the bridge envelope even before assembly roles were stored", () => {
		    const refrigerator: PlacedCabinet = {
		      ...cabinet,
		      uid: "legacy-fridge",
		      masterCode: "FRIDGE-36",
		      description: "36 inch refrigerator",
		      placement: "appliance",
		      x: 20,
		      width: 36,
		      depth: 30,
		      height: 70,
		      mountBottom: 0,
		    };
		    const bridge: PlacedCabinet = {
		      ...cabinet,
		      uid: "legacy-refrigerator-bridge",
		      masterCode: "WR3612",
		      description: "Refrigerator cabinet above",
		      placement: "wall",
		      x: 20,
		      width: 36,
		      depth: 24,
		      height: 12,
		      mountBottom: 72,
		      refrigeratorAssemblyId: refrigerator.uid,
		      refrigeratorAssemblyRole: "bridge",
		    };
		    // This saved record predates refrigeratorAssemblyRole on cap fillers but
		    // still stores the authoritative bridge UID chosen by the user.
		    const legacyCapFiller: PlacedCabinet = {
		      ...cabinet,
		      uid: "legacy-cap-filler-by-bridge-uid",
		      masterCode: "F342",
		      description: "Filler — cut to 1/2 inch",
		      category: "Filler",
		      subCategory: "Filler",
		      placement: "base",
		      x: 19.5,
		      width: 0.5,
		      depth: 24,
		      height: 70,
		      mountBottom: 0,
		      fillerForCabinetUid: bridge.uid,
		    };

		    const normalized = normalizeInstalledFillersToAdjacentCabinets(
		      [refrigerator, bridge, legacyCapFiller],
		      DEFAULT_ROOM,
		    );

		    expect(normalized[2]).toMatchObject({
		      placement: "wall",
		      depth: 24,
		      height: 12,
		      mountBottom: 72,
		      fillerForCabinetUid: bridge.uid,
		      fillerMatchesFullOwnerEnvelope: false,
		    });
		    expect(elevationBox(normalized[2]!, DEFAULT_ROOM)).toEqual({ bottom: 72, height: 12 });
		  });

	  it("repairs a legacy wall filler from the exact cabinet touching its edge", () => {
	    const owner: PlacedCabinet = {
	      ...cabinet,
	      uid: "wall-30",
	      masterCode: "W1830",
	      placement: "wall",
	      width: 18,
	      depth: 12,
	      height: 30,
	      mountBottom: 54,
	    };
	    const filler: PlacedCabinet = {
	      ...cabinet,
	      uid: "legacy-wall-filler",
	      masterCode: "WF342",
	      description: "Wall filler — cut to 3\"",
	      category: "Filler",
	      placement: "wall",
	      x: 18,
	      width: 3,
	      depth: 12,
	      height: 42,
	      mountBottom: 0,
	    };
	    expect(adjacentCabinetForFiller(filler, [owner, filler], DEFAULT_ROOM)?.uid).toBe(owner.uid);
	    expect(normalizeInstalledFillersToAdjacentCabinets([owner, filler], DEFAULT_ROOM)[1]).toMatchObject({
	      height: 30,
	      mountBottom: 54,
	      depth: 12,
	      fillerForCabinetUid: owner.uid,
	    });
	  });

		  it("keeps a front-miter board shallow while matching its base cabinet face elevation", () => {
		    const special: PlacedCabinet = {
		      ...cabinet,
	      uid: "miter-filler",
	      masterCode: "F342",
	      description: "Filler transition",
	      category: "Filler",
	      width: 2,
	      depth: 0.75,
		      height: 30,
		      fillerTransitionKind: "front-miter-pair",
		      fillerForCabinetUid: cabinet.uid,
		    };
		    expect(normalizeInstalledFillersToAdjacentCabinets([cabinet, special], DEFAULT_ROOM)[1]).toMatchObject({
		      placement: "base",
		      depth: 0.75,
		      height: 34.5,
		      mountBottom: 0,
		      fillerForCabinetUid: cabinet.uid,
		      fillerTransitionKind: "front-miter-pair",
		    });
		  });

		  it("matches a tall filler exactly to a raised tall cabinet face", () => {
		    const owner: PlacedCabinet = {
		      ...cabinet,
		      uid: "raised-tall",
		      masterCode: "TP2484",
		      description: "84 inch Tall Pantry",
		      placement: "tall",
		      width: 24,
		      depth: 24,
		      height: 84,
		      mountBottom: 5,
		    };
		    const filler: PlacedCabinet = {
		      ...cabinet,
		      uid: "tall-filler",
		      masterCode: "TF342",
		      description: "Tall filler",
		      placement: "tall",
		      x: 24,
		      width: 3,
		      depth: 24,
		      height: 96,
		      mountBottom: 0,
		    };
		    expect(normalizeInstalledFillersToAdjacentCabinets([owner, filler], DEFAULT_ROOM)[1]).toMatchObject({
		      placement: "tall",
		      height: 84,
		      mountBottom: 5,
		      depth: 24,
		      fillerForCabinetUid: owner.uid,
		    });
		  });

	  it("detects a six-inch-or-smaller trailing opening after placement", () => {
    const opportunity = findSmallGapFillerOpportunity({ ...DEFAULT_ROOM, width: 20.5 }, [cabinet], [], cabinet.uid);
    expect(opportunity).toMatchObject({ cabinetUid: cabinet.uid, openingStart: 0, openingLength: 20.5, remaining: 2.5 });
  });

	  it("prompts for a six-inch cabinet-to-cabinet seam and retains left/right/split placement choices", () => {
    const left: PlacedCabinet = { ...cabinet, uid: "left-b18", masterCode: "B18", width: 18, x: 0 };
    const right: PlacedCabinet = { ...cabinet, uid: "right-b18", masterCode: "B18", width: 18, x: 24 };
    const opportunity = findSmallGapFillerOpportunity({ ...DEFAULT_ROOM, width: 96 }, [left, right], [], right.uid);
    expect(opportunity).toMatchObject({
      remaining: 6,
      openingStart: 18,
      openingLength: 24,
      preferredMode: "left",
    });
	    expect(canSplitSmallGapFiller(opportunity!)).toBe(true);
	  });

	  it("splits a six-inch opening into two exact three-inch pieces", () => {
	    const opportunity = {
	      cabinetUid: "six-inch-gap-cabinet",
	      wall: "top" as const,
	      layer: "wall" as const,
	      cabinetStart: 6,
	      cabinetSpan: 24,
	      openingStart: 0,
	      openingLength: 30,
	      remaining: 6,
	    };
	    expect(canSplitSmallGapFiller(opportunity)).toBe(true);
	    expect(smallGapFillerLayout(opportunity, "split").pieces.map((piece) => piece.width)).toEqual([3, 3]);
	  });

	  it("prompts for DB18 in a 21-inch opening but suppresses the prompt after an exact-fit DB21 replacement", () => {
	    const room = { ...DEFAULT_ROOM, width: 21 };
	    const db18 = { ...cabinet, uid: "db18", masterCode: "3-DB18", width: 18 };
	    const db21 = { ...cabinet, uid: "db21", masterCode: "3-DB21", width: 21 };
	    expect(findSmallGapFillerOpportunity(room, [db18], [], db18.uid)).toMatchObject({
	      cabinetUid: db18.uid,
	      openingLength: 21,
	      remaining: 3,
	    });
	    expect(findSmallGapFillerOpportunity(room, [db21], [], db21.uid)).toBeNull();
	  });

		  it("does not sell a filler for the protected one-inch pocket behind a 45-degree peninsula base", () => {
		    const parent = { id: "peninsula-filler-parent", parentWall: "top", startOffset: 48, turn: 90 as const, direction: "right" as const, length: 48, height: 34.5, cabinetSide: "left" as const };
		    const run = { id: "peninsula-filler-popup", parentRunId: parent.id, startOffset: 0, turn: 45 as const, direction: "right" as const, length: 60, height: 34.5, cabinetSide: "left" as const };
		    const room: RoomData = { ...DEFAULT_ROOM, peninsulaRuns: [parent, run] };
	    const placement = wallPlacementAt(12, 18, 24, run.id as never, room, "left");
	    const b18: PlacedCabinet = {
	      ...cabinet,
	      uid: "peninsula-b18-one-inch-filler",
	      masterCode: "B-18",
	      width: 18,
	      ...placement,
	    };

		    expect(findSmallGapFillerOpportunity(room, [b18], [], b18.uid)).toBeNull();
		  });

	  it("splits a bounded peninsula gap evenly between the two adjoining cabinet edges without moving either cabinet", () => {
	    const run = { id: "peninsula-two-cabinet-gap", parentWall: "top", startOffset: 48, turn: 90 as const, direction: "right" as const, length: 72, height: 34.5, cabinetSide: "left" as const };
	    const room: RoomData = { ...DEFAULT_ROOM, peninsulaRuns: [run] };
	    const leftPlacement = wallPlacementAt(12, 18, 24, run.id as never, room, "left");
	    const rightPlacement = wallPlacementAt(32, 18, 24, run.id as never, room, "left");
	    const leftCabinet: PlacedCabinet = { ...cabinet, uid: "bounded-left-b18", ...leftPlacement };
	    const rightCabinet: PlacedCabinet = { ...cabinet, uid: "bounded-right-b18", ...rightPlacement };
	    const opportunity = findSmallGapFillerOpportunity(room, [leftCabinet, rightCabinet], [], rightCabinet.uid)!;

	    expect(opportunity).toMatchObject({
	      remaining: 2,
	      preferredMode: "split",
	      boundedCabinetUids: [leftCabinet.uid, rightCabinet.uid],
	      boundedGapStart: 30,
	    });
	    expect(automaticSmallGapFillerMode(opportunity)).toBe("split");
	    expect(smallGapFillerLayout(opportunity, "split")).toEqual({
	      cabinetStart: 32,
	      leftWidth: 1,
	      rightWidth: 1,
	      pieces: [
	        { side: "left", start: 30, width: 1 },
	        { side: "right", start: 31, width: 1 },
	      ],
	    });
	  });

  it("converts a fitted right-drag opening into the same catalog filler choices for cabinets, panels, fillers, and appliances", () => {
    const preview = {
      wall: "top" as const,
      snapped: true,
      candidate: { ...cabinet, x: 30 },
      ghostCandidate: { ...cabinet, x: 30 },
      fit: {
        gap: { side: "top" as const, layer: "base" as const, start: 30, length: 15, center: 37.5, isStandardSize: true, isFillerSize: false },
        containsTarget: true,
        requiredSpan: 12,
        availableSpan: 15,
        shortage: 0,
        snapStart: 30,
        snapEnd: 42,
        before: 0,
        after: 3,
        status: "valid" as const,
      },
    };

    for (const uid of ["cabinet", "panel", "filler", "appliance"]) {
      expect(smallGapFillerOpportunityFromDragPreview(uid, preview)).toEqual({
        cabinetUid: uid,
        wall: "top",
        layer: "base",
        cabinetStart: 30,
        cabinetSpan: 12,
        openingStart: 30,
        openingLength: 15,
        remaining: 3,
      });
    }
  });

  it("offers a dragged-object filler through six inches and rejects larger remainders", () => {
    const preview = {
      wall: "top" as const,
      snapped: false,
      candidate: { ...cabinet, x: 30 },
      fit: {
        gap: { side: "top" as const, layer: "base" as const, start: 30, length: 16, center: 38, isStandardSize: false, isFillerSize: false },
        containsTarget: true,
        requiredSpan: 12,
        availableSpan: 16,
        shortage: 0,
        snapStart: 30,
        snapEnd: 42,
        before: 0,
        after: 4,
        status: "valid" as const,
      },
    };
    expect(smallGapFillerOpportunityFromDragPreview("cabinet", preview)).toMatchObject({ remaining: 4, openingLength: 16 });
    expect(smallGapFillerOpportunityFromDragPreview("cabinet", {
      ...preview,
      fit: { ...preview.fit, gap: { ...preview.fit.gap, length: 18.125 }, availableSpan: 18.125, after: 6.125 },
    })).toBeNull();
  });

  it("offers the exact two-and-a-half-inch filler remainder between a moved B-12 and a perpendicular corner cabinet", () => {
    // The BER36 must sit inside the 144" room (x 108..144); its full 36" corner leg is reserved on the top wall.
    const leftRun: PlacedCabinet = { ...cabinet, uid: "left-run", masterCode: "B-93.5", width: 93.5, x: 0 };
    const moving: PlacedCabinet = { ...cabinet, uid: "moving-b12", masterCode: "B-12", width: 12, x: 60 };
    const corner: PlacedCabinet = { ...cabinet, uid: "corner", masterCode: "BER36", description: "36 inch Easy Reach Corner", width: 36, depth: 24, x: 108, y: 0, rotation: 90 };
    const preview = cabinetWallDragPreview(moving, DEFAULT_ROOM, [leftRun, moving, corner], [], 100)!;

    expect(preview.candidate).toMatchObject({ x: 93.5, y: 0 });
    expect(preview.fit).toMatchObject({ gap: { start: 93.5, length: 14.5 }, before: 0, after: 2.5 });
    expect(smallGapFillerOpportunityFromDragPreview(moving.uid, preview)).toMatchObject({
      cabinetUid: moving.uid,
      openingStart: 93.5,
      openingLength: 14.5,
      remaining: 2.5,
    });
  });

  it("detects the measured two-and-a-half-inch opening between B-15 and an LS3612 corner cabinet", () => {
    const b15: PlacedCabinet = { ...cabinet, uid: "b15", masterCode: "B-15", width: 15, x: 0 };
    const lazySusan: PlacedCabinet = {
      ...cabinet,
      uid: "ls3612",
      masterCode: "LS3612",
      description: "Lazy Susan Corner Base",
      x: 17.5,
      width: 36,
      depth: 36,
    };
    expect(findSmallGapFillerOpportunity(DEFAULT_ROOM, [b15, lazySusan], [], b15.uid)).toMatchObject({
      cabinetUid: b15.uid,
      openingStart: 0,
      openingLength: 17.5,
      remaining: 2.5,
    });
  });

  it("detects the reported two-and-a-quarter-inch remainder beside a B-27 when the next run boundary is a tall cabinet", () => {
    const leftBase: PlacedCabinet = { ...cabinet, uid: "left-base", masterCode: "B-24", width: 24, x: 102.25 };
    const b27: PlacedCabinet = { ...cabinet, uid: "reported-b27", masterCode: "B-27", width: 27, x: 126.25 };
    const rightTall: PlacedCabinet = {
      ...cabinet,
      uid: "right-tall",
      masterCode: "T-2496",
      description: "Tall pantry cabinet",
      placement: "tall",
      width: 24,
      x: 155.5,
      height: 96,
    };

    expect(findSmallGapFillerOpportunity(
      { ...DEFAULT_ROOM, width: 204 },
      [leftBase, b27, rightTall],
      [],
      b27.uid,
    )).toMatchObject({
      cabinetUid: b27.uid,
      cabinetStart: 126.25,
      cabinetSpan: 27,
      openingStart: 126.25,
      openingLength: 29.25,
      remaining: 2.25,
    });
  });

  it("detects the same B-27 remainder when a floor appliance forms the next run boundary", () => {
    const leftBase: PlacedCabinet = { ...cabinet, uid: "appliance-left-base", masterCode: "B-24", width: 24, x: 102.25 };
    const b27: PlacedCabinet = { ...cabinet, uid: "appliance-b27", masterCode: "B-27", width: 27, x: 126.25 };
    const range: PlacedCabinet = {
      ...cabinet,
      uid: "right-range",
      masterCode: "RANGE-30",
      description: "30 inch range",
      placement: "appliance",
      width: 30,
      x: 155.5,
      height: 36,
    };

    expect(findSmallGapFillerOpportunity(
      { ...DEFAULT_ROOM, width: 204 },
      [leftBase, b27, range],
      [],
      b27.uid,
    )).toMatchObject({ openingStart: 126.25, openingLength: 29.25, remaining: 2.25 });
  });

  it("does not prompt for an exact-fit W-36-42 beside a refrigerator when its 36-inch bridge is inset one inch", () => {
    const w3642: PlacedCabinet = {
      ...cabinet,
      uid: "w3642",
      masterCode: "W-36-42",
      description: "36 inch Double Door Wall Cabinet",
      placement: "wall",
      x: 0,
      width: 36,
      depth: 12,
      height: 42,
      mountBottom: 54,
    };
    const refrigerator: PlacedCabinet = {
      ...cabinet,
      uid: "refrigerator",
      masterCode: "FRIDGE-36",
      description: "36 inch Refrigerator",
      placement: "appliance",
      x: 36,
      width: 36,
      depth: 30,
      height: 70,
    };
    const refrigeratorBridge: PlacedCabinet = {
      ...w3642,
      uid: "refrigerator-bridge",
      masterCode: "WFR3642",
      description: "36 inch Refrigerator Wall Cabinet",
      x: 37,
      width: 36,
      height: 24,
      mountBottom: 72,
      refrigeratorAssemblyId: refrigerator.uid,
      refrigeratorAssemblyRole: "bridge",
    };

    const room = { ...DEFAULT_ROOM, width: 144 };
    const placed = [w3642, refrigerator, refrigeratorBridge];
    expect(wallCabinetFitMeasure(w3642, room, placed, [], "top")).toMatchObject({
      availableStart: 0,
      availableEnd: 36,
      availableSpan: 36,
      before: 0,
      after: 0,
      afterBoundary: "FRIDGE-36",
    });
    expect(findSmallGapFillerOpportunity(room, placed, [], w3642.uid)).toBeNull();
  });

	 it("offers an automatic source-backed filler for the reported quarter-inch W-36-42 remainder", () => {
    const w3642: PlacedCabinet = {
      ...cabinet,
      uid: "reported-quarter-inch-w3642",
      masterCode: "W-36-42",
      description: "36 inch Double Door Wall Cabinet",
      placement: "wall",
      x: 0,
      width: 36,
      depth: 12,
      height: 42,
      mountBottom: 54,
    };
    const room = { ...DEFAULT_ROOM, width: 36.25 };
    expect(wallCabinetFitMeasure(w3642, room, [w3642], [], "top")).toMatchObject({
      availableSpan: 36.25,
      requiredSpan: 36,
      before: 0,
      after: 0.25,
    });
	    expect(findSmallGapFillerOpportunity(room, [w3642], [], w3642.uid)).toMatchObject({
	      remaining: 0.25,
	      preferredMode: "right",
	    });
  });

  it("prompts for the real one-sided W2442 seam even when the opposite side remains open for more cabinets", () => {
    const previousUpper: PlacedCabinet = {
      ...cabinet,
      uid: "previous-upper",
      masterCode: "W-24-42-PREV",
      placement: "wall",
      x: 36.75,
      y: 0,
      width: 24,
      depth: 12,
      height: 42,
      mountBottom: 54,
    };
    const w2442: PlacedCabinet = {
      ...previousUpper,
      uid: "w2442",
      masterCode: "W-24-42",
      x: 61.5,
    };
    expect(findSmallGapFillerOpportunity(
      { ...DEFAULT_ROOM, width: 145 },
      [previousUpper, w2442],
      [],
      w2442.uid,
    )).toMatchObject({
      remaining: 0.75,
      openingStart: 60.75,
      openingLength: 24.75,
      preferredMode: "left",
    });
  });

  it("does not prompt for an opening larger than six inches", () => {
    expect(findSmallGapFillerOpportunity({ ...DEFAULT_ROOM, width: 24.125 }, [cabinet], [], cabinet.uid)).toBeNull();
  });

	  it("places full-left, full-right, and split fillers with exact zero-overlap seams", () => {
	    const opportunity = findSmallGapFillerOpportunity({ ...DEFAULT_ROOM, width: 21 }, [cabinet], [], cabinet.uid)!;
    const left = smallGapFillerLayout(opportunity, "left");
    const right = smallGapFillerLayout(opportunity, "right");
    const split = smallGapFillerLayout(opportunity, "split");
    expect(left).toMatchObject({ cabinetStart: 3, leftWidth: 3, rightWidth: 0 });
    expect(right).toMatchObject({ cabinetStart: 0, leftWidth: 0, rightWidth: 3 });
    expect(split).toMatchObject({ cabinetStart: 1.5, leftWidth: 1.5, rightWidth: 1.5 });
    expect(split.pieces[0]!.start + split.pieces[0]!.width).toBe(split.cabinetStart);
    expect(split.cabinetStart + opportunity.cabinetSpan).toBe(split.pieces[1]!.start);
	    expect(split.pieces[1]!.start + split.pieces[1]!.width).toBe(opportunity.openingStart + opportunity.openingLength);
	  });

	  it("commits a five-eighths filler when the moved cabinet refreshes its shared wall offset", () => {
	    const room: RoomData = { width: 36.625, depth: 120, ceilingHeight: 96 };
	    const original = { ...cabinet, uid: "sub-inch-b36", masterCode: "B36", width: 36, wallId: "top" as const, wallOffset: 0 };
	    const opportunity = findSmallGapFillerOpportunity(room, [original], [], original.uid)!;
	    const layout = smallGapFillerLayout(opportunity, "left");
	    const cabinetSpot = wallPlacementAt(layout.cabinetStart, opportunity.cabinetSpan, original.depth, opportunity.wall, room);
	    const moved = {
	      ...original,
	      x: cabinetSpot.x,
	      y: cabinetSpot.y,
	      rotation: cabinetSpot.rotation,
	      wallId: cabinetSpot.wallId,
	      wallOffset: cabinetSpot.wallOffset,
	    };
	    const fillerSpot = wallPlacementAt(layout.pieces[0]!.start, layout.pieces[0]!.width, original.depth, opportunity.wall, room);
	    const filler = {
	      ...original,
	      uid: "sub-inch-f342",
	      cabinetId: 9360195,
	      masterCode: "F342",
	      description: '3" Filler — cut to 5/8"',
	      category: "Filler",
	      subCategory: "Filler",
	      x: fillerSpot.x,
	      y: fillerSpot.y,
	      width: layout.pieces[0]!.width,
	      nominalWidth: 3,
	      rotation: fillerSpot.rotation,
	      wallId: fillerSpot.wallId,
	      wallOffset: fillerSpot.wallOffset,
	      fillerBillingRole: "primary" as const,
	      fillerPieceGroupId: "sub-inch-filler-group",
	    };

	    const result = appendSmallGapFillerPlacement([original], moved, [filler]);
	    expect(moved.wallOffset).toBe(0.625);
	    expect(result.rejected).toEqual([]);
	    expect(result.placed.map((item) => item.uid)).toEqual([moved.uid, filler.uid]);
	  });

	  it("commits a 2DB24's exact 1¼-inch filler beside a measured diagonal ERB36 edge", () => {
	    const diagonalRoom: RoomData = {
	      width: 180,
	      depth: 180,
	      ceilingHeight: 96,
	      openWallPath: true,
	      vertices: [
	        { id: "a", x: 0, y: 0 },
	        { id: "corner", x: 100, y: 100 },
	        { id: "b", x: 50, y: 150 },
	      ],
	      customWalls: [
	        { id: "first", startVertexId: "a", endVertexId: "corner", lockedAngle: 45 },
	        { id: "second", startVertexId: "corner", endVertexId: "b", lockedAngle: 45 },
	      ],
	    };
	    const erbSeed: PlacedCabinet = {
	      ...cabinet,
	      uid: "diagonal-erb36",
	      masterCode: "ERB36",
	      description: "Easy Reach Corner Base 36",
	      width: 36,
	      depth: 24,
	    };
	    const erbSpot = nextAvailableRoomCornerPlacement(erbSeed, "second", diagonalRoom, []);
	    expect(erbSpot).not.toBeNull();
	    const erb = { ...erbSeed, ...erbSpot!, wallId: erbSpot!.wallId, wallOffset: erbSpot!.wallOffset };
	    const dbStart = wallLength("first", diagonalRoom) - 36 - 24 - 1.25;
	    const dbSpot = wallPlacementAt(dbStart, 24, 24, "first", diagonalRoom);
	    const drawerBase: PlacedCabinet = {
	      ...cabinet,
	      uid: "2db24-with-filler",
	      masterCode: "2DB24",
	      description: "24 inch Two Drawer Base",
	      ...dbSpot,
	      width: 24,
	      nominalWidth: 24,
	      depth: 24,
	      nominalDepth: 24,
	      wallId: dbSpot.wallId,
	      wallOffset: dbSpot.wallOffset,
	      numberOfDoors: 0,
	      numberOfDrawers: 2,
	    };
	    const opportunity: SmallGapFillerOpportunity = {
	      cabinetUid: drawerBase.uid,
	      wall: "first",
	      layer: "base",
	      cabinetStart: dbStart,
	      cabinetSpan: 24,
	      openingStart: dbStart,
	      openingLength: 25.25,
	      remaining: 1.25,
	    };
	    const layout = smallGapFillerLayout(opportunity, "right");
	    const fillerSegment = layout.pieces[0]!;
	    const fillerSpot = wallPlacementAt(fillerSegment.start, fillerSegment.width, 24, "first", diagonalRoom);
	    const filler: PlacedCabinet = {
	      ...drawerBase,
	      uid: "f342-cut-to-one-quarter",
	      masterCode: "F342",
	      description: '3 inch Filler — cut to 1¼ inch',
	      category: "Filler",
	      subCategory: "Filler",
	      ...fillerSpot,
	      width: fillerSegment.width,
	      nominalWidth: 3,
	      wallId: fillerSpot.wallId,
	      wallOffset: fillerSpot.wallOffset,
	      fillerPieceGroupId: "diagonal-2db24-filler",
	      fillerBillingRole: "primary",
	      fillerTotalWidth: 1.25,
	      fillerForCabinetUid: drawerBase.uid,
	    };

	    // The render envelopes overlap across this diagonal vertex, but the
	    // measured cabinet run and the filler both stop exactly at ERB36's edge.
	    expect(hasCollision(drawerBase, [erb])).toBe(true);
	    expect(hasCollision(filler, [erb])).toBe(true);
	    expect(cabinetPlacementCollisionDetail(drawerBase, [erb], diagonalRoom)).toBeNull();
	    expect(cabinetPlacementCollisionDetail(filler, [erb], diagonalRoom)).toBeNull();

	    const result = appendSmallGapFillerPlacement([erb, drawerBase], drawerBase, [filler], diagonalRoom);
	    expect(result.rejected).toEqual([]);
	    expect(result.placed.map((item) => item.uid)).toEqual([erb.uid, drawerBase.uid, filler.uid]);

	    const intrudingSpot = wallPlacementAt(wallLength("first", diagonalRoom) - 36 - 0.5, 1.25, 24, "first", diagonalRoom);
	    const intrudingFiller = {
	      ...filler,
	      uid: "f342-intrudes-on-erb36",
	      ...intrudingSpot,
	      wallId: intrudingSpot.wallId,
	      wallOffset: intrudingSpot.wallOffset,
	    };
	    expect(cabinetPlacementCollisionDetail(intrudingFiller, [erb], diagonalRoom)?.cabinet.uid).toBe(erb.uid);
	    expect(appendSmallGapFillerPlacement([erb, drawerBase], drawerBase, [intrudingFiller], diagonalRoom).rejected)
	      .toEqual([intrudingFiller]);
	  });

	  it("removes both physical halves as one purchased filler group", () => {
    const pieces: PlacedCabinet[] = [
      cabinet,
      { ...cabinet, uid: "fill-left", masterCode: "BF3", fillerPieceGroupId: "fill-group", fillerBillingRole: "primary" },
      { ...cabinet, uid: "fill-right", masterCode: "BF3", fillerPieceGroupId: "fill-group", fillerBillingRole: "secondary" },
    ];
    expect(removePlacedCabinetGroup(pieces, "fill-right").map((item) => item.uid)).toEqual([cabinet.uid]);
  });

  it("reopens an installed split filler as one editable purchased group", () => {
    const room = { ...DEFAULT_ROOM, width: 21 };
    const pieces: PlacedCabinet[] = [
      { ...cabinet, x: 1.5 },
      { ...cabinet, uid: "fill-left", masterCode: "BF3", description: "3 inch Base Filler", subCategory: "Filler", x: 0, width: 1.5, fillerPieceGroupId: "fill-group", fillerBillingRole: "primary", fillerTotalWidth: 3, fillerPlacementMode: "split", fillerForCabinetUid: cabinet.uid },
      { ...cabinet, uid: "fill-right", masterCode: "BF3", description: "3 inch Base Filler", subCategory: "Filler", x: 19.5, width: 1.5, fillerPieceGroupId: "fill-group", fillerBillingRole: "secondary", fillerTotalWidth: 3, fillerPlacementMode: "split", fillerForCabinetUid: cabinet.uid },
    ];
    expect(installedSmallGapFillerEditOpportunity(room, pieces, [], "fill-right")).toMatchObject({
      cabinetUid: cabinet.uid,
      openingStart: 0,
      openingLength: 21,
      remaining: 3,
      replacingFillerGroupId: "fill-group",
    });
  });

  it("reconstructs a legacy one-sided filler owner and refuses required BBC filler editing", () => {
    const room = { ...DEFAULT_ROOM, width: 21 };
    const legacy: PlacedCabinet[] = [
      cabinet,
      { ...cabinet, uid: "legacy-fill", masterCode: "BF3", description: "3 inch Base Filler", subCategory: "Filler", x: 18, width: 3, fillerPieceGroupId: "legacy-group", fillerBillingRole: "primary", fillerTotalWidth: 3, fillerPlacementMode: "right" },
    ];
    expect(installedSmallGapFillerEditOpportunity(room, legacy, [], "legacy-fill")).toMatchObject({ cabinetUid: cabinet.uid, replacingFillerGroupId: "legacy-group" });
    const required = [{ ...legacy[1], fillerPieceGroupId: `bbc-required-filler-${cabinet.uid}` }];
    expect(installedSmallGapFillerEditOpportunity(room, required, [], "legacy-fill")).toBeNull();
  });

  it.each(["front", "back", "left", "right"] as const)("measures a 2½-inch manual filler opening on the island %s face", (face: IslandFace) => {
    const island: IslandZone = { x: 36, y: 30, width: 72, depth: 48, activeFace: face };
    const faceLength = face === "front" || face === "back" ? island.width : island.depth;
    const islandCabinet = islandFacePlacement({ ...cabinet, uid: `island-${face}`, width: faceLength - 2.5 }, island, face, 0);
    expect(findIslandSmallGapFillerOpportunity(island, [islandCabinet], islandCabinet.uid)).toMatchObject({
      cabinetUid: islandCabinet.uid,
      islandFace: face,
      openingStart: 0,
      openingLength: faceLength,
      remaining: 2.5,
    });
  });

  it("reopens an installed island filler against its explicit owning cabinet", () => {
    const island: IslandZone = { x: 36, y: 30, width: 48, depth: 48, activeFace: "front" };
    const owner = islandFacePlacement({ ...cabinet, uid: "island-owner", width: 45 }, island, "front", 0);
    const filler = islandFacePlacement({
      ...cabinet,
      uid: "island-filler",
      masterCode: "BF3",
      description: "3 inch Base Filler",
      subCategory: "Filler",
      width: 3,
      fillerPieceGroupId: "island-fill-group",
      fillerBillingRole: "primary",
      fillerTotalWidth: 3,
      fillerPlacementMode: "right",
      fillerForCabinetUid: owner.uid,
    }, island, "front", 45);
    expect(installedSmallGapFillerEditOpportunity(DEFAULT_ROOM, [owner, filler], [], filler.uid, island)).toMatchObject({
      cabinetUid: owner.uid,
      islandFace: "front",
      remaining: 3,
      replacingFillerGroupId: "island-fill-group",
    });
  });

  it("preserves the refrigerator, its upper cabinet, panels, and every unrelated placement when filler pieces are added", () => {
    const b15 = { ...cabinet, uid: "b15", masterCode: "B-15", width: 15 };
    const refrigerator = { ...cabinet, uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance" as const, x: 30, width: 36, height: 70 };
    const refrigeratorUpper = { ...cabinet, uid: "fridge-upper", masterCode: "MW3042", placement: "wall" as const, x: 30, width: 30, height: 42, mountBottom: 72 };
    const panel = { ...cabinet, uid: "fridge-panel", masterCode: "REPV2496", placement: "tall" as const, x: 66, width: 0.75, height: 96 };
    const moved = { ...b15, x: 1.25 };
    const filler = { ...cabinet, uid: "filler", masterCode: "BF3", x: 0, y: 100, width: 1.25, fillerPieceGroupId: "filler-group", fillerTotalWidth: 1.25, fillerPlacementMode: "left" as const };
    const result = appendSmallGapFillerPlacement([b15, refrigerator, refrigeratorUpper, panel], moved, [filler]);

    expect(result.rejected).toEqual([]);
    expect(result.placed.map((item) => item.uid)).toEqual(["b15", "fridge", "fridge-upper", "fridge-panel", "filler"]);
  });

  it("bills and previews a split filler as one catalog quantity", () => {
    const placed: PlacedCabinet[] = [
      { ...cabinet, uid: "fill-left", cabinetId: 88, masterCode: "BF3", fillerPieceGroupId: "fill-group", fillerBillingRole: "primary" },
      { ...cabinet, uid: "fill-right", cabinetId: 88, masterCode: "BF3", fillerPieceGroupId: "fill-group", fillerBillingRole: "secondary" },
    ];
    const common = { placed, styleId: 7, distributorId: 2, tier: "homeowner" as const, styleNameById: new Map([[7, "Selected style"]]), unitPriceFor: () => 42 };
    expect(buildDesignCabinetCartLines(common)).toMatchObject([{ masterCode: "BF3", qty: 1, unitPrice: 42 }]);
    expect(buildDesignPreviewPricingLines(common)).toMatchObject([{ masterCode: "BF3", qty: 1, unitPrice: 42, placementUids: ["fill-left"] }]);
  });
});
