import { describe, expect, it } from "vitest";
import { elevationBox, hasCollision, makeSinkForCabinet, type IslandZone, type PlacedCabinet, type RoomData } from "./design";
import {
	  ISLAND_COUNTERTOP_OVERHANG_IN,
	  applyCabinetFinishScope,
	  islandAfterCountertopSupportRemoval,
	  synchronizeIslandCountertopFootprint,
		  islandCountertopRect,
	  islandCountertopRects,
	  islandCountertopVisibleRects,
	  islandCountertopOverhangIn,
	  islandAssemblyBounds,
	  islandAssemblyClearance,
	  islandFaceCapacity,
	  islandFaceFitMeasure,
	  islandFacePlacement,
	  isIslandAssemblyMember,
	  islandFaceTransferOption,
	  autoAdjustIslandDepthForBackFace,
	  islandWithFaceSeatingOverhang,
	  normalizeIslandRangeRearPlanes,
  inferredIslandFace,
  moveIslandScene,
  nextIslandFacePlacement,
	  resizeIslandScene,
	  rotateIslandScene,
	  resolvedIslandCabinetStyleId,
} from "./islandScene";

const room: RoomData = { width: 144, depth: 120 };
const island: IslandZone = { x: 36, y: 36, width: 72, depth: 48, activeFace: "front" };
const cabinet = (overrides: Partial<PlacedCabinet> = {}): PlacedCabinet => ({
  uid: "cab",
  cabinetId: 101,
  masterCode: "B-24",
  description: "24 inch base cabinet",
  placement: "base",
  x: 0,
  y: 0,
  width: 24,
  depth: 24,
  height: 34.5,
  rotation: 0,
  ...overrides,
});

describe("island mini-scene geometry", () => {
  it.each([
    ["front", { x: 36, y: 60, rotation: 0 }],
    ["back", { x: 36, y: 36, rotation: 180 }],
    ["left", { x: 36, y: 36, rotation: 90 }],
    ["right", { x: 84, y: 36, rotation: 270 }],
  ] as const)("places the cabinet on the %s face with its door facing outward", (face, expected) => {
    expect(islandFacePlacement(cabinet(), island, face, 0)).toMatchObject({ ...expected, islandFace: face, islandOffset: 0 });
  });

	it.each([
	  ["front", { x: 36, y: 60, rotation: 0 }],
	  ["back", { x: 36, y: 30, rotation: 180 }],
	  ["left", { x: 30, y: 36, rotation: 90 }],
	  ["right", { x: 84, y: 36, rotation: 270 }],
	] as const)("keeps a 30-inch-deep range on the %s base-cabinet rear plane", (face, expected) => {
	  const base = islandFacePlacement(cabinet({ uid: `base-${face}` }), island, face, 0);
	  const range = islandFacePlacement(cabinet({
	    uid: `range-${face}`,
	    masterCode: "RANGE-30",
	    description: "30 inch range",
	    placement: "appliance",
	    width: 30,
	    depth: 30,
	    height: 36,
	  }), island, face, 0);
	  expect(range).toMatchObject({ ...expected, islandFace: face, islandOffset: 0 });
	  if (face === "front") expect(range.y).toBe(base.y);
	  if (face === "back") expect(range.y + 30).toBe(base.y + 24);
	  if (face === "left") expect(range.x + 30).toBe(base.x + 24);
	  if (face === "right") expect(range.x).toBe(base.x);
	});

	it("repairs a saved protruding range and its opposing wall cabinet to the shared zero-gap seam", () => {
	  const deeperIsland: IslandZone = { ...island, depth: 60 };
	  const frontBase = islandFacePlacement(cabinet({ uid: "front-base", width: 18 }), deeperIsland, "front", 0);
	  const legacyRange = {
	    ...cabinet({ uid: "legacy-range", masterCode: "RANGE-30", description: "30 inch range", placement: "appliance", width: 30, depth: 30, height: 36 }),
	    x: deeperIsland.x + 18,
	    y: deeperIsland.y + deeperIsland.depth - 30,
	    rotation: 0,
	    islandFace: "front" as const,
	    islandOffset: 18,
	  };
	  const legacyBackWall = {
	    ...cabinet({ uid: "legacy-back-wall", masterCode: "W-30-30", description: "30 inch wall cabinet", placement: "wall", width: 30, depth: 12, height: 30 }),
	    x: deeperIsland.x + 18,
	    y: legacyRange.y - 12,
	    rotation: 180,
	    islandFace: "back" as const,
	    islandOffset: 18,
	    islandCounterHeightWallCabinet: true,
	  };
	  const repaired = normalizeIslandRangeRearPlanes(deeperIsland, [frontBase, legacyRange, legacyBackWall], room);
	  const repairedRange = repaired.find((item) => item.uid === legacyRange.uid)!;
	  const repairedWall = repaired.find((item) => item.uid === legacyBackWall.uid)!;
	  expect(repairedRange.y).toBe(frontBase.y);
	  expect(repairedWall.y + 12).toBe(frontBase.y);
	  expect(hasCollision(repairedWall, [frontBase, repairedRange])).toBe(false);
	});

	it("retains the saved range position when rear-plane repair would collide with a real room object", () => {
	  const deeperIsland: IslandZone = { ...island, depth: 60 };
	  const legacyRange = {
	    ...cabinet({ uid: "blocked-range", masterCode: "RANGE-30", description: "30 inch range", placement: "appliance", width: 30, depth: 30, height: 36 }),
	    x: deeperIsland.x,
	    y: deeperIsland.y + deeperIsland.depth - 30,
	    rotation: 0,
	    islandFace: "front" as const,
	    islandOffset: 0,
	  };
	  const externalObject = cabinet({
	    uid: "room-object",
	    masterCode: "B-24",
	    x: deeperIsland.x,
	    y: legacyRange.y + legacyRange.depth,
	    width: 24,
	    depth: 24,
	  });
	  const repaired = normalizeIslandRangeRearPlanes(deeperIsland, [legacyRange, externalObject], room);
	  expect(repaired.find((item) => item.uid === legacyRange.uid)).toMatchObject({ x: legacyRange.x, y: legacyRange.y });
	});

  it("places a wall catalog cabinet at island floor level while preserving an explicit later elevation edit", () => {
    const wallCabinet = cabinet({ uid: "wfr2442", masterCode: "WFR2442", placement: "wall", depth: 12, height: 42, mountBottom: 54 });
    const floorPlaced = islandFacePlacement(wallCabinet, island, "front", 0);
    expect(floorPlaced).toMatchObject({ islandFace: "front", islandOffset: 0, mountBottom: 0 });
    expect(elevationBox(floorPlaced, room)).toEqual({ bottom: 0, height: 42 });

    const raised = islandFacePlacement({ ...floorPlaced, mountBottom: 6, mountBottomAdjusted: true }, island, "front", 0);
    expect(raised.mountBottom).toBe(6);
    expect(elevationBox(raised, room)).toEqual({ bottom: 6, height: 42 });
  });

	 it("snaps a shallow W-24-30 directly against the back of the opposing base run", () => {
    const backBase = islandFacePlacement(cabinet({ uid: "back-base" }), island, "back", 0);
    const frontWallCabinet = nextIslandFacePlacement(
      cabinet({ uid: "front-w2430", masterCode: "W-24-30", description: "24 inch by 30 inch wall cabinet", placement: "wall", depth: 12, height: 30 }),
      island,
      "front",
      [backBase],
    );
    expect(frontWallCabinet).toMatchObject({
      islandFace: "front",
      islandCounterHeightWallCabinet: true,
      mountBottom: 4.5,
      x: backBase.x,
		      y: backBase.y + 24,
    });
    expect(elevationBox(frontWallCabinet!, room)).toEqual({ bottom: 4.5, height: 30 });
    expect(hasCollision(frontWallCabinet!, [backBase])).toBe(false);
  });

  it("measures a selected island member along its owning face instead of the outer 144-inch room wall", () => {
    const first = islandFacePlacement(cabinet({ uid: "first" }), island, "front", 0);
    const selected = islandFacePlacement(cabinet({ uid: "selected" }), island, "front", 24);
    const measurement = islandFaceFitMeasure(selected, island, [first, selected]);
    expect(measurement).toMatchObject({
      seated: true,
      requiredSpan: 24,
      start: 24,
      end: 48,
      wallLen: 72,
      availableStart: 24,
      availableEnd: 72,
      availableSpan: 48,
      beforeBoundary: "B-24",
      afterBoundary: "island face end",
      snapBefore: 0,
      snapAfter: 24,
      status: "fits",
    });
    expect(measurement?.wallLen).not.toBe(room.width);
  });

	it("adds same-face cabinets left-to-right with edge contact and zero overlap", () => {
	  const first = nextIslandFacePlacement(cabinet({ uid: "a" }), island, "front", []);
	  const second = nextIslandFacePlacement(cabinet({ uid: "b" }), island, "front", [first!]);
	  expect(first).toMatchObject({ x: 36, islandOffset: 0 });
	  expect(second).toMatchObject({ x: 60, islandOffset: 24 });
	  expect(hasCollision(second!, [first!])).toBe(false);
	});

	it("accepts a W30 as an exact fit in a measured 30-inch island-face opening", () => {
	  const exactIsland: IslandZone = { x: 36, y: 36, width: 60, depth: 36, activeFace: "front" };
	  const existing = islandFacePlacement(cabinet({ uid: "front-b30", masterCode: "B-30", width: 30 }), exactIsland, "front", 0);
	  const incoming = cabinet({ uid: "front-w3030", masterCode: "W-30-30", placement: "wall", width: 30, depth: 12, height: 30 });
	  expect(islandFaceCapacity(exactIsland, "front", [existing])).toMatchObject({ largestOpenSpan: 30 });
	  expect(nextIslandFacePlacement(incoming, exactIsland, "front", [existing])).toMatchObject({
	    islandFace: "front",
	    islandOffset: 30,
	    width: 30,
	  });
	});

		it("reports a chosen Front length as full while leaving the opposing Back run available", () => {
		  const frontA = islandFacePlacement(cabinet({ uid: "front-a", width: 36 }), island, "front", 0);
		  const frontB = islandFacePlacement(cabinet({ uid: "front-b", width: 36 }), island, "front", 36);
		  const capacity = islandFaceCapacity(island, "front", [frontA, frontB]);
		  expect(capacity).toMatchObject({ length: 72, occupiedSpan: 72, largestOpenSpan: 0, isFull: true });
		  expect(nextIslandFacePlacement(cabinet({ uid: "back-next", width: 30 }), island, "back", [frontA, frontB])).toMatchObject({ islandFace: "back", islandOffset: 0 });
		});

		it("moves an island cabinet to the opposite face when that face has a clear run", () => {
		  const front = islandFacePlacement(cabinet({ uid: "front", width: 30 }), island, "front", 0);
		  expect(islandFaceTransferOption(front, island, [front])).toMatchObject({
		    targetFace: "back",
		    moved: { uid: "front", islandFace: "back", islandOffset: 0 },
		  });
		});

		it("swaps the nearest opposite-face cabinet when neither face has an open transfer run", () => {
		  const front = islandFacePlacement(cabinet({ uid: "front", width: 72 }), island, "front", 0);
		  const back = islandFacePlacement(cabinet({ uid: "back", width: 72 }), island, "back", 0);
		  expect(islandFaceTransferOption(front, island, [front, back])).toMatchObject({
		    targetFace: "back",
		    moved: { uid: "front", islandFace: "back" },
		    swapped: { uid: "back", islandFace: "front" },
		  });
		});

	  it("places SB36 after a legacy Farm Sink Base on the same island face", () => {
    const legacyFarmSinkBase = {
      ...islandFacePlacement(cabinet({ uid: "legacy-fsb36", masterCode: "FSB-36", description: "36 inch Farm Sink Base Cabinet", width: 36 }), island, "front", 0),
      islandFace: undefined,
      islandOffset: undefined,
    };
    const sinkBase = nextIslandFacePlacement(
      cabinet({ uid: "sb36", masterCode: "SB36", description: "36 inch Sink Base Cabinet", width: 36 }),
      island,
      "front",
      [legacyFarmSinkBase],
    );
	    expect(sinkBase).toMatchObject({ islandFace: "front", islandOffset: 36, x: 72, y: 60 });
	    expect(hasCollision(sinkBase!, [legacyFarmSinkBase])).toBe(false);
	  });

	  it("applies an island color without changing the perimeter run", () => {
	    const perimeter = cabinet({ uid: "perimeter", x: 0, y: 0, styleId: null });
	    const islandCabinet = islandFacePlacement(cabinet({ uid: "island-front", styleId: null }), island, "front", 0);
	    const result = applyCabinetFinishScope([perimeter, islandCabinet], island, 7, 99, "island");
	    expect(result.nextDefaultStyleId).toBe(7);
	    expect(result.island).toMatchObject({ cabinetStyleId: 99 });
	    expect(result.placed.find((item) => item.uid === "perimeter")?.styleId ?? null).toBeNull();
	    expect(result.placed.find((item) => item.uid === "island-front")?.styleId).toBe(99);
	    expect(result.changedCount).toBe(1);
	  });

	  it("changes non-island cabinets while freezing an inheriting island at its original color", () => {
	    const selectedPerimeter = cabinet({ uid: "selected-perimeter", x: 0, y: 0, styleId: 99 });
	    const otherPerimeter = cabinet({ uid: "other-perimeter", x: 24, y: 0, styleId: null });
	    const islandCabinet = islandFacePlacement(cabinet({ uid: "island-front", styleId: null }), island, "front", 0);
	    const result = applyCabinetFinishScope([selectedPerimeter, otherPerimeter, islandCabinet], island, 7, 99, "non-island");
	    expect(result.nextDefaultStyleId).toBe(99);
	    expect(result.island).toMatchObject({ cabinetStyleId: 7 });
	    expect(result.placed.find((item) => item.uid === "selected-perimeter")?.styleId ?? null).toBeNull();
	    expect(result.placed.find((item) => item.uid === "other-perimeter")?.styleId ?? null).toBeNull();
	    expect(result.placed.find((item) => item.uid === "island-front")?.styleId).toBe(7);
	    expect(result.changedCount).toBe(1);
	  });

	  it("includes island cabinets only when the user chooses the all-cabinet scope", () => {
	    const perimeter = cabinet({ uid: "perimeter", x: 0, y: 0, styleId: 99 });
	    const styledIsland = { ...island, cabinetStyleId: 7 };
	    const islandCabinet = islandFacePlacement(cabinet({ uid: "island-front", styleId: 7 }), styledIsland, "front", 0);
	    const result = applyCabinetFinishScope([perimeter, islandCabinet], styledIsland, 7, 99, "all");
	    expect(result.nextDefaultStyleId).toBe(99);
	    expect(result.island).toMatchObject({ cabinetStyleId: null });
	    expect(result.placed.map((item) => item.styleId ?? null)).toEqual([null, null]);
	    expect(result.changedCount).toBe(1);
	  });

	  it("uses the legacy in-zone fallback when an older island has no face metadata", () => {
	    const legacyIslandCabinet = { ...islandFacePlacement(cabinet({ uid: "legacy-island", styleId: 44 }), island, "front", 0), islandFace: undefined, islandOffset: undefined };
	    const perimeter = cabinet({ uid: "perimeter", x: 0, y: 0, styleId: null });
	    expect(resolvedIslandCabinetStyleId([legacyIslandCabinet, perimeter], island, 7)).toBe(44);
	    const result = applyCabinetFinishScope([legacyIslandCabinet, perimeter], island, 7, 55, "island");
	    expect(result.placed.find((item) => item.uid === "legacy-island")?.styleId).toBe(55);
	    expect(result.placed.find((item) => item.uid === "perimeter")?.styleId ?? null).toBeNull();
	  });

  it("keeps a sequential face run flush even when another face has members", () => {
    const rightSide = nextIslandFacePlacement(cabinet({ uid: "right-side" }), island, "right", []);
    const first = nextIslandFacePlacement(cabinet({ uid: "front-a" }), island, "front", [rightSide!]);
    const second = nextIslandFacePlacement(cabinet({ uid: "front-b" }), island, "front", [rightSide!, first!]);
    expect(first).toMatchObject({ islandFace: "front", islandOffset: 0 });
    expect(second).toMatchObject({ islandFace: "front", islandOffset: 24 });
  });

  it("supports 24-inch front and back cabinets touching back-to-back in a 48-inch zone", () => {
    const back = nextIslandFacePlacement(cabinet({ uid: "back" }), island, "back", []);
    const front = nextIslandFacePlacement(cabinet({ uid: "front" }), island, "front", [back!]);
    expect(back!.y + 24).toBe(front!.y);
    expect(hasCollision(front!, [back!])).toBe(false);
  });

	it("removes the internal void when a shallow Back wall cabinet opposes a Front base run in a deeper island zone", () => {
	  const deeperIsland: IslandZone = { ...island, depth: 60 };
	  const frontBase = islandFacePlacement(cabinet({ uid: "front-base", width: 30, depth: 24 }), deeperIsland, "front", 0);
	  const backWall = nextIslandFacePlacement(
	    cabinet({ uid: "back-wall", masterCode: "W-30-30", description: "30 inch wall cabinet", placement: "wall", width: 30, depth: 12, height: 30 }),
	    deeperIsland,
	    "back",
	    [frontBase],
	  );
	  expect(backWall).toMatchObject({ islandFace: "back", islandOffset: 0, y: frontBase.y - 12 });
	  expect(backWall!.y + 12).toBe(frontBase.y);
	  expect(hasCollision(backWall!, [frontBase])).toBe(false);
	  expect(inferredIslandFace(backWall!, deeperIsland)).toBe("back");
	  expect(islandFaceCapacity(deeperIsland, "back", [frontBase, backWall!])).toMatchObject({ occupiedSpan: 30, largestOpenSpan: 42 });

	  const resized = resizeIslandScene(deeperIsland, [frontBase, backWall!], room, deeperIsland.width, 72);
	  expect(resized.ok).toBe(true);
	  if (resized.ok) {
	    const resizedFront = resized.placed.find((item) => item.uid === frontBase.uid)!;
	    const resizedBack = resized.placed.find((item) => item.uid === backWall!.uid)!;
	    expect(resizedBack.y + 12).toBe(resizedFront.y);
	    expect(inferredIslandFace(resizedBack, resized.island)).toBe("back");
	  }
	});

  it("keeps opposing front and back runs aligned from the same island edge", () => {
    const front = nextIslandFacePlacement(cabinet({ uid: "front-a" }), island, "front", []);
    const back = nextIslandFacePlacement(cabinet({ uid: "back-a" }), island, "back", [front!]);
    expect(back).toMatchObject({ islandFace: "back", islandOffset: 0, x: front!.x });
    expect(hasCollision(back!, [front!])).toBe(false);
  });

  it("uses actual edge geometry when legacy front-run members carry stale Back-face labels", () => {
    const frontB12 = { ...islandFacePlacement(cabinet({ uid: "front-b12", masterCode: "B-12", width: 12 }), island, "front", 0), islandFace: "back", islandOffset: 0 };
    const frontRange = { ...islandFacePlacement(cabinet({ uid: "front-range", masterCode: "RANGE-30", placement: "appliance", width: 30, depth: 24, height: 36 }), island, "front", 12), islandFace: "back", islandOffset: 12 };
    const frontB18 = { ...islandFacePlacement(cabinet({ uid: "front-b18", masterCode: "B-18", width: 18 }), island, "front", 42), islandFace: "back", islandOffset: 42 };
    const existing = [frontB12, frontRange, frontB18];

    expect(existing.map((item) => inferredIslandFace(item, island))).toEqual(["front", "front", "front"]);
    const backWallCabinet = nextIslandFacePlacement(
      cabinet({ uid: "back-w3030", masterCode: "W-30-30", description: "30 inch wall cabinet", placement: "wall", width: 30, depth: 12, height: 30 }),
      island,
      "back",
      existing,
    );
		    expect(backWallCabinet).toMatchObject({ islandFace: "back", islandOffset: 0, x: island.x, y: island.y + 12 });
    expect(hasCollision(backWallCabinet!, existing)).toBe(false);
  });

	  it("protects an occupied front island run while preserving the empty Back face for a W-30-30", () => {
	    const frontB12 = islandFacePlacement(cabinet({ uid: "front-b12", masterCode: "B-12", width: 12 }), island, "front", 0);
	    const frontRange = islandFacePlacement(cabinet({ uid: "front-range", masterCode: "RANGE-30", placement: "appliance", width: 30, depth: 24, height: 36 }), island, "front", 12);
    const frontB18 = islandFacePlacement(cabinet({ uid: "front-b18", masterCode: "B-18", width: 18 }), island, "front", 42);
    const existing = [frontB12, frontRange, frontB18];
    const w3030 = cabinet({ uid: "w3030", masterCode: "W-30-30", description: "30 inch wall cabinet", placement: "wall", width: 30, depth: 12, height: 30 });

    expect(nextIslandFacePlacement(w3030, island, "front", existing)).toBeNull();
    expect(nextIslandFacePlacement(w3030, island, "back", existing)).toMatchObject({
      islandFace: "back",
      islandOffset: 0,
      x: island.x,
		      y: island.y + 12,
	    });
	  });

	  it("places a W-30-30 wall cabinet on the island Back after growing only the Back depth beside a 24-inch Front run", () => {
	    const compactIsland: IslandZone = { ...island, depth: 24 };
	    const frontB18 = islandFacePlacement(cabinet({ uid: "front-b18", masterCode: "B-18", width: 18 }), compactIsland, "front", 0);
	    const frontRange = islandFacePlacement(cabinet({ uid: "front-range", masterCode: "RANGE-30", placement: "appliance", width: 30, depth: 24, height: 36 }), compactIsland, "front", 18);
	    const frontB12 = islandFacePlacement(cabinet({ uid: "front-b12", masterCode: "B-12", width: 12 }), compactIsland, "front", 48);
	    const frontRun = [frontB18, frontRange, frontB12];
	    const w3030 = cabinet({ uid: "island-w3030", masterCode: "W-30-30", description: "30 inch wall cabinet", placement: "wall", width: 30, depth: 12, height: 30 });

	    const expansion = autoAdjustIslandDepthForBackFace(compactIsland, frontRun, room, w3030.depth);
	    expect(expansion).toMatchObject({ ok: true, island: { depth: 36 } });
	    if (!expansion.ok) throw new Error(expansion.reason);
	    const placedW30 = nextIslandFacePlacement(w3030, expansion.island, "back", expansion.placed);

	    expect(placedW30).toMatchObject({
	      islandFace: "back",
	      islandOffset: 0,
	      islandCounterHeightWallCabinet: true,
	      mountBottom: 4.5,
	      width: 30,
	      depth: 12,
	    });
	    expect(hasCollision(placedW30!, expansion.placed)).toBe(false);
	  });

	 it("snaps opposing front and back runs beside a usable end cabinet and fits one slab to the combined shape", () => {
	  const leftEnd = nextIslandFacePlacement(cabinet({ uid: "left-end" }), island, "left", []);
	  const back = nextIslandFacePlacement(cabinet({ uid: "back" }), island, "back", [leftEnd!]);
	  const front = nextIslandFacePlacement(cabinet({ uid: "front" }), island, "front", [leftEnd!, back!]);
	  expect(leftEnd).toMatchObject({ x: 36, y: 36, islandFace: "left", islandOffset: 0 });
	  expect(back).toMatchObject({ x: 60, y: 36, islandFace: "back", islandOffset: 24 });
	  expect(front).toMatchObject({ x: 36, y: 60, islandFace: "front", islandOffset: 0 });
	  expect(hasCollision(back!, [leftEnd!])).toBe(false);
	  expect(hasCollision(front!, [leftEnd!, back!])).toBe(false);
	  expect(islandCountertopRect(island, [leftEnd!, back!, front!])).toEqual({
	    x: 36 - ISLAND_COUNTERTOP_OVERHANG_IN,
	    y: 36 - ISLAND_COUNTERTOP_OVERHANG_IN,
	    width: 48 + ISLAND_COUNTERTOP_OVERHANG_IN * 2,
	    depth: 48 + ISLAND_COUNTERTOP_OVERHANG_IN * 2,
	  });
	});

  it("creates one automatic slab over opposing front and back cabinet runs", () => {
    const back = islandFacePlacement(cabinet({ uid: "back" }), island, "back", 0);
    const front = islandFacePlacement(cabinet({ uid: "front" }), island, "front", 0);
    expect(islandCountertopRect(island, [back, front])).toEqual({
      x: island.x - ISLAND_COUNTERTOP_OVERHANG_IN,
      y: island.y - ISLAND_COUNTERTOP_OVERHANG_IN,
      width: 24 + ISLAND_COUNTERTOP_OVERHANG_IN * 2,
      depth: 48 + ISLAND_COUNTERTOP_OVERHANG_IN * 2,
    });
  });

  it("preserves legacy 10-inch plans and supports the current 12-inch or 15-inch seating depths", () => {
    const backBase = islandFacePlacement(cabinet({ uid: "back-base" }), island, "back", 0);
    const frontWallCabinet = nextIslandFacePlacement(
      cabinet({ uid: "front-w2430", masterCode: "W-24-30", description: "24 inch by 30 inch wall cabinet", placement: "wall", depth: 12, height: 30 }),
      island,
      "front",
      [backBase],
    )!;
    const tenInch = islandWithFaceSeatingOverhang(island, [backBase, frontWallCabinet], "front", 10);
    const twelveInch = islandWithFaceSeatingOverhang(island, [backBase, frontWallCabinet], "front", 12);
    const fifteenInch = islandWithFaceSeatingOverhang(island, [backBase, frontWallCabinet], "front", 15);
	    expect(islandCountertopRect(tenInch, [backBase, frontWallCabinet])).toEqual({ x: 34.5, y: 34.5, width: 27, depth: 47.5 });
	    expect(islandCountertopRect(twelveInch, [backBase, frontWallCabinet])).toEqual({ x: 34.5, y: 34.5, width: 27, depth: 49.5 });
	    expect(islandCountertopRect(fifteenInch, [backBase, frontWallCabinet])).toEqual({ x: 34.5, y: 34.5, width: 27, depth: 52.5 });
    expect(twelveInch.countertopWidthAnchoredToZone).toBe(false);
    expect(twelveInch.countertopDepthAnchoredToZone).toBe(false);
  });

	  it.each([
	    ["front", "top"],
	    ["back", "bottom"],
	    ["left", "right"],
	    ["right", "left"],
	  ] as const)("places an island faucet opposite the user-facing cabinet front on the %s run", (face, wallSide) => {
    const sinkBase = islandFacePlacement(cabinet({ uid: `sink-${face}`, masterCode: "SB-36", description: "36 inch sink base", width: 36 }), island, face, 0);
    expect(makeSinkForCabinet("double", sinkBase, room, { width: 30, depth: 20 })).toMatchObject({ cabinetUid: sinkBase.uid, wallSide });
  });

  it("moves the island and all attached face members as one collision-safe assembly", () => {
    const attached = islandFacePlacement(cabinet(), island, "front", 12);
    const result = moveIslandScene(island, [attached], room, 6, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.island).toMatchObject({ x: 42, y: 39 });
      expect(result.placed[0]).toMatchObject({ x: attached.x + 6, y: attached.y + 3, islandFace: "front", islandOffset: 12 });
    }
  });

	  it("keeps the same W30 face capacity after translating the island across the room", () => {
	    const startingIsland: IslandZone = { x: 6, y: 30, width: 66, depth: 36, activeFace: "front" };
	    const frontB18 = islandFacePlacement(cabinet({ uid: "front-b18", masterCode: "3-DB18", width: 18 }), startingIsland, "front", 0);
	    const frontRange = islandFacePlacement(cabinet({ uid: "front-range", masterCode: "RANGE-30", placement: "appliance", width: 30, depth: 24, height: 36 }), startingIsland, "front", 18);
	    const frontDb12 = islandFacePlacement(cabinet({ uid: "front-db12", masterCode: "3-DB12", width: 12 }), startingIsland, "front", 48);
	    const existing = [frontB18, frontRange, frontDb12];
	    const moved = moveIslandScene(startingIsland, existing, room, 42, 18);
	    expect(moved.ok).toBe(true);
	    if (!moved.ok) return;

	    expect(islandFaceCapacity(startingIsland, "front", existing)).toMatchObject({ length: 66, largestOpenSpan: 6 });
	    expect(islandFaceCapacity(moved.island, "front", moved.placed)).toMatchObject({ length: 66, largestOpenSpan: 6 });
	    expect(moved.placed.map((item) => item.islandOffset)).toEqual(existing.map((item) => item.islandOffset));

	    const w3030 = cabinet({ uid: "back-w3030", masterCode: "W-30-30", placement: "wall", width: 30, depth: 12, height: 30 });
	    const before = nextIslandFacePlacement(w3030, startingIsland, "back", existing);
	    const after = nextIslandFacePlacement(w3030, moved.island, "back", moved.placed);
	    expect(before).toMatchObject({ islandFace: "back", islandOffset: 0 });
	    expect(after).toMatchObject({ islandFace: "back", islandOffset: 0 });
	    expect(after!.x - moved.island.x).toBe(before!.x - startingIsland.x);
	    expect(after!.y - moved.island.y).toBe(before!.y - startingIsland.y);
	  });

	  it("does not move an unrelated room-wall cabinet whose center happens to fall inside an explicit island zone", () => {
	    const attached = islandFacePlacement(cabinet({ uid: "attached" }), island, "front", 12);
	    const roomWallCabinet = cabinet({ uid: "room-wall", masterCode: "B-24", x: island.x + 48, y: island.y + 4, islandFace: undefined, islandOffset: undefined });
	    const result = moveIslandScene(island, [attached, roomWallCabinet], room, 6, 3);
	    expect(result.ok).toBe(true);
	    if (!result.ok) return;
	    expect(result.placed.find((item) => item.uid === "attached")).toMatchObject({ x: attached.x + 6, y: attached.y + 3 });
	    expect(result.placed.find((item) => item.uid === "room-wall")).toEqual(roomWallCabinet);
	  });

	  it("still rejects a translated island and names the real room object and overlap", () => {
	    const attached = islandFacePlacement(cabinet({ uid: "attached" }), island, "front", 12);
	    const roomObject = cabinet({ uid: "room-object", masterCode: "B-24", x: attached.x + 24, y: attached.y, islandFace: undefined, islandOffset: undefined });
	    const result = moveIslandScene(island, [attached, roomObject], room, 6, 0);
	    expect(result).toMatchObject({ ok: false });
	    if (result.ok) return;
	    expect(result.reason).toContain("B-24");
	    expect(result.reason).toContain("footprint overlap");
	  });

	  it("quarter-turns the island, every member, and custom slab as one assembly", () => {
	    const attached = islandFacePlacement(cabinet(), island, "front", 12);
	    const result = rotateIslandScene({ ...island, countertopWidth: 78, countertopDepth: 54, countertopOffsetX: 2, countertopOffsetY: -1 }, [attached], room);
	    expect(result.ok).toBe(true);
	    if (result.ok) {
	      expect(result.island).toMatchObject({ width: 72, depth: 48, activeFace: "front", rotation: 90, countertopWidth: 78, countertopDepth: 54, countertopOffsetX: 2, countertopOffsetY: -1 });
	      expect(result.placed[0]).toMatchObject({ islandFace: "front", rotation: 90, islandOffset: 12 });
	    }
	  });

	  it("quarter-turns an island by 45 degrees while retaining its measured local run and countertop", () => {
	    const attached = islandFacePlacement(cabinet({ uid: "angled-front" }), island, "front", 12);
	    const result = rotateIslandScene({ ...island, countertopWidth: 78, countertopDepth: 54 }, [attached], room, 45);
	    expect(result.ok).toBe(true);
	    if (!result.ok) return;
	    expect(result.island).toMatchObject({ width: 72, depth: 48, rotation: 45, countertopWidth: 78, countertopDepth: 54 });
	    expect(result.placed[0]).toMatchObject({ islandFace: "front", islandOffset: 12, rotation: 45 });
	    const bounds = islandAssemblyBounds(result.island);
	    expect(bounds.width).toBeGreaterThan(island.width);
	    expect(bounds.depth).toBeGreaterThan(island.depth);
	    const slabs = islandCountertopRects(result.island, result.placed);
	    expect(slabs).toHaveLength(1);
	    expect(slabs[0]).toMatchObject({ width: 78, depth: 54, rotation: 45 });
	  });

	  it("recalculates finished room clearances from the rotated slab and cabinet envelope", () => {
	    const centered = { ...island, x: 36, y: 30, countertopWidth: 78, countertopDepth: 54, countertopWidthAnchoredToZone: true, countertopDepthAnchoredToZone: true };
	    const attached = islandFacePlacement(cabinet({ uid: "clearance-front" }), centered, "front", 12);
	    const before = islandAssemblyClearance(centered, [attached], room);
	    const rotated = rotateIslandScene(centered, [attached], room, 45);
	    expect(rotated.ok).toBe(true);
	    if (!rotated.ok) return;
	    const after = islandAssemblyClearance(rotated.island, rotated.placed, room);
	    expect(after.rotationDegrees).toBe(45);
	    expect(after.nearestIn).not.toBe(before.nearestIn);
	    expect(after.leftIn).toBeGreaterThan(0);
	    expect(after.rightIn).toBeGreaterThan(0);
	    expect(after.backIn).toBeGreaterThan(0);
	    expect(after.frontIn).toBeGreaterThan(0);
	  });

	  it("rejects a resize that makes an occupied face too short", () => {
	    const attached = islandFacePlacement(cabinet({ width: 36 }), island, "front", 36);
	    expect(resizeIslandScene(island, [attached], room, 60, 48).ok).toBe(false);
	  });

	  it("names the exact room object and overlap when resizing is physically blocked", () => {
	    const attached = islandFacePlacement(cabinet({ uid: "attached", masterCode: "3-DB18", width: 18 }), island, "front", 0);
	    const blocker = cabinet({ uid: "room-blocker", masterCode: "B-24", x: attached.x, y: island.y + 12, islandFace: undefined, islandOffset: undefined });
	    const result = resizeIslandScene(island, [attached, blocker], room, island.width, 36);
	    expect(result).toMatchObject({ ok: false });
	    if (result.ok) return;
	    expect(result.reason).toContain("Resizing the island would make 3-DB18 overlap B-24");
	    expect(result.reason).toContain("footprint overlap");
	  });

	  it("grows only toward the Back for an incoming deeper Back cabinet while keeping the Front face fixed", () => {
	    const compactIsland = { ...island, depth: 36, y: 48, waterfallEnd: "both" as const, countertopDepth: 48, countertopDepthAnchoredToZone: true };
	    const front = islandFacePlacement(cabinet({ uid: "front", depth: 24, width: 30 }), compactIsland, "front", 0);
	    const result = autoAdjustIslandDepthForBackFace(compactIsland, [front], room, 24);
	    expect(result.ok).toBe(true);
	    if (result.ok) {
	      expect(result.island).toMatchObject({ depth: 48, y: 36, waterfallEnd: "both", countertopDepth: 60, countertopDepthAnchoredToZone: true });
	      expect(result.placed.find((item) => item.uid === "front")).toMatchObject({ x: front.x, y: front.y, islandFace: "front" });
	    }
	  });

	  it("automatically creates one continuous slab with standard overhang over the assembly", () => {
    const left = islandFacePlacement(cabinet({ uid: "left" }), island, "front", 0);
    const right = islandFacePlacement(cabinet({ uid: "right" }), island, "front", 24);
    expect(islandCountertopRect(island, [left, right])).toEqual({
      x: island.x - ISLAND_COUNTERTOP_OVERHANG_IN,
      y: island.y + island.depth - 24 - ISLAND_COUNTERTOP_OVERHANG_IN,
      width: 48 + ISLAND_COUNTERTOP_OVERHANG_IN * 2,
      depth: 24 + ISLAND_COUNTERTOP_OVERHANG_IN * 2,
    });
  });

	  it("applies an exact custom overhang to every edge of an automatic connected slab", () => {
	    const left = islandFacePlacement(cabinet({ uid: "left" }), island, "front", 0);
	    const right = islandFacePlacement(cabinet({ uid: "right" }), island, "front", 24);
	    const custom = { ...island, countertopOverhang: 3.125 };
	    expect(islandCountertopOverhangIn(custom)).toBe(3.125);
	    expect(islandCountertopRect(custom, [left, right])).toEqual({
	      x: island.x - 3.125,
	      y: island.y + island.depth - 24 - 3.125,
	      width: 54.25,
	      depth: 30.25,
	    });
	  });

	  it("uses the standard 1.5-inch overhang for legacy islands and clamps unsafe custom values", () => {
	    expect(islandCountertopOverhangIn(island)).toBe(ISLAND_COUNTERTOP_OVERHANG_IN);
	    expect(islandCountertopOverhangIn({ ...island, countertopOverhang: null })).toBe(ISLAND_COUNTERTOP_OVERHANG_IN);
	    expect(islandCountertopOverhangIn({ ...island, countertopOverhang: -4 })).toBe(0);
	    expect(islandCountertopOverhangIn({ ...island, countertopOverhang: 40 })).toBe(24);
	  });

	  it("does not let an automatic countertop bridge an unoccupied island gap", () => {
	    const left = islandFacePlacement(cabinet({ uid: "left" }), island, "front", 0);
	    const right = islandFacePlacement(cabinet({ uid: "right" }), island, "front", 48);
    expect(islandCountertopRects(island, [left, right])).toEqual([
      { x: island.x - ISLAND_COUNTERTOP_OVERHANG_IN, y: island.y + island.depth - 24 - ISLAND_COUNTERTOP_OVERHANG_IN, width: 24 + ISLAND_COUNTERTOP_OVERHANG_IN * 2, depth: 24 + ISLAND_COUNTERTOP_OVERHANG_IN * 2 },
      { x: island.x + 48 - ISLAND_COUNTERTOP_OVERHANG_IN, y: island.y + island.depth - 24 - ISLAND_COUNTERTOP_OVERHANG_IN, width: 24 + ISLAND_COUNTERTOP_OVERHANG_IN * 2, depth: 24 + ISLAND_COUNTERTOP_OVERHANG_IN * 2 },
	    ]);
	  });

	  it("cuts an island range footprint out of the rendered and priced countertop fragments", () => {
	    const leftBase = islandFacePlacement(cabinet({ uid: "left-base", width: 24 }), island, "front", 0);
	    const range = islandFacePlacement(cabinet({
	      uid: "island-range",
	      masterCode: "RANGE-24",
	      description: "24 inch island range",
	      placement: "appliance",
	      width: 24,
	      depth: 24,
	      height: 36,
	    }), island, "front", 24);
	    const rightBase = islandFacePlacement(cabinet({ uid: "right-base", width: 24 }), island, "front", 48);
	    const customSlab = { ...island, countertopWidth: 75, countertopDepth: 27, countertopOffsetX: 1.5 };

	    const visible = islandCountertopVisibleRects(customSlab, [leftBase, range, rightBase]);
	    expect(visible.reduce((area, rect) => area + rect.width * rect.depth, 0)).toBe(1449);
	    expect(visible.some((rect) => rect.x <= range.x && rect.x + rect.width >= range.x + range.width && rect.y <= range.y && rect.y + rect.depth >= range.y + range.depth)).toBe(false);
	  });

	  it("keeps a legacy base-layer stove as a true countertop opening", () => {
	    const leftBase = islandFacePlacement(cabinet({ uid: "legacy-left", width: 24 }), island, "front", 0);
	    const stove = islandFacePlacement(cabinet({
	      uid: "legacy-stove",
	      masterCode: "STOVE-24",
	      description: "24 inch gas stove",
	      placement: "base",
	      width: 24,
	      depth: 24,
	      height: 36,
	    }), island, "front", 24);
	    const rightBase = islandFacePlacement(cabinet({ uid: "legacy-right", width: 24 }), island, "front", 48);
	    const customSlab = { ...island, countertopWidth: 75, countertopDepth: 27, countertopOffsetX: 1.5 };

	    const visible = islandCountertopVisibleRects(customSlab, [leftBase, stove, rightBase]);
	    expect(visible.some((rect) => rect.x <= stove.x && rect.x + rect.width >= stove.x + stove.width && rect.y <= stove.y && rect.y + rect.depth >= stove.y + stove.depth)).toBe(false);
	  });

	  it("preserves a legacy island stove cutout after a counter-height wall cabinet adds face metadata", () => {
	    const legacyStove = {
	      ...islandFacePlacement(cabinet({
	        uid: "legacy-island-stove",
	        masterCode: "STOVE-24",
	        description: "24 inch gas stove",
	        placement: "base",
	        width: 24,
	        depth: 24,
	        height: 36,
	      }), island, "front", 24),
	      islandFace: undefined,
	      islandOffset: undefined,
	    };
	    const counterHeightWall = islandFacePlacement(cabinet({
	      uid: "island-wall-after-stove",
	      masterCode: "W-24-30",
	      description: "24 inch wall cabinet",
	      placement: "wall",
	      width: 24,
	      depth: 12,
	      height: 30,
	      islandCounterHeightWallCabinet: true,
	    }), island, "back", 0);
	    const afterWallPlacement = [legacyStove, counterHeightWall];
	    const customSlab = {
	      ...island,
	      countertopWidth: island.width,
	      countertopDepth: island.depth,
	      countertopWidthAnchoredToZone: true,
	      countertopDepthAnchoredToZone: true,
	    };

	    expect(isIslandAssemblyMember(legacyStove, island, afterWallPlacement)).toBe(true);
	    const visible = islandCountertopVisibleRects(customSlab, afterWallPlacement);
	    expect(visible.some((rect) => rect.x <= legacyStove.x && rect.x + rect.width >= legacyStove.x + legacyStove.width && rect.y <= legacyStove.y && rect.y + rect.depth >= legacyStove.y + legacyStove.depth)).toBe(false);
	  });

		  it("keeps custom standard overhang compatible with a selected seating-side depth", () => {
	    const customIsland = { ...island, countertopOverhang: 3 };
	    const backBase = islandFacePlacement(cabinet({ uid: "back-base" }), customIsland, "back", 0);
	    const frontWallCabinet = nextIslandFacePlacement(
	      cabinet({ uid: "front-w2430", masterCode: "W-24-30", description: "24 inch by 30 inch wall cabinet", placement: "wall", depth: 12, height: 30 }),
	      customIsland,
	      "front",
	      [backBase],
	    )!;
	    const seating = islandWithFaceSeatingOverhang(customIsland, [backBase, frontWallCabinet], "front", 10);
	    expect(islandCountertopRect(seating, [backBase, frontWallCabinet])).toEqual({ x: 33, y: 33, width: 30, depth: 49 });
	    expect(seating.countertopOverhang).toBe(3);
	  });

		  it("keeps exact custom slab dimensions and offsets while cabinet geometry stays authoritative", () => {
		    const attached = islandFacePlacement(cabinet(), island, "front", 0);
		    const custom = { ...island, countertopWidth: 60, countertopDepth: 30, countertopOffsetX: 2, countertopOffsetY: -1 };
		    expect(islandCountertopRect(custom, [attached])).toEqual({ x: 20, y: 56, width: 60, depth: 30 });
		  });

		  it("removes custom slab coverage over a deleted cabinet by rebuilding from remaining supports", () => {
		    const first = islandFacePlacement(cabinet({ uid: "first" }), island, "front", 0);
		    const second = islandFacePlacement(cabinet({ uid: "second" }), island, "front", 24);
		    const custom = {
		      ...island,
		      countertopMaterialId: "quartz-carrara",
		      countertopProductId: 101,
		      countertopOverhang: 3,
		      waterfallEnd: "right" as const,
		      countertopWidth: 72,
		      countertopDepth: 42,
		      countertopOffsetX: 5,
		      countertopOffsetY: -4,
		      countertopWidthAnchoredToZone: true,
		      countertopDepthAnchoredToZone: true,
		    };
		    const rebuilt = islandAfterCountertopSupportRemoval(custom, [first, second], [first]);

		    expect(rebuilt).toMatchObject({
		      countertopMaterialId: "quartz-carrara",
		      countertopProductId: 101,
		      countertopOverhang: 3,
		      waterfallEnd: "right",
		      countertopWidth: null,
		      countertopDepth: null,
		      countertopOffsetX: 0,
		      countertopOffsetY: 0,
		      countertopWidthAnchoredToZone: false,
		      countertopDepthAnchoredToZone: false,
		    });
		    expect(islandCountertopRect(rebuilt, [first])).toEqual({ x: 33, y: 57, width: 30, depth: 30 });
		  });

		  it("adds countertop coverage over a newly added countertop-bearing island cabinet", () => {
		    const first = islandFacePlacement(cabinet({ uid: "first" }), island, "front", 0);
		    const second = islandFacePlacement(cabinet({ uid: "second" }), island, "front", 24);
		    const configured = { ...island, countertopWidth: 30, countertopDepth: 30, countertopOffsetX: 0, countertopOffsetY: 0 };
		    const expanded = synchronizeIslandCountertopFootprint(configured, [first], [first, second]);

		    expect(islandCountertopRect(expanded, [first, second])).toEqual({ x: 34.5, y: 58.5, width: 51, depth: 27 });
		  });

		  it("clears a stale custom island slab when its final countertop support is deleted", () => {
		    const onlySupport = islandFacePlacement(cabinet({ uid: "only" }), island, "front", 0);
		    const custom = { ...island, countertopWidth: 60, countertopDepth: 42, countertopOffsetX: 3, countertopOffsetY: -2 };
		    const rebuilt = islandAfterCountertopSupportRemoval(custom, [onlySupport], []);

		    expect(rebuilt.countertopWidth).toBeNull();
		    expect(rebuilt.countertopDepth).toBeNull();
		    expect(islandCountertopRects(rebuilt, [])).toEqual([]);
		  });

		  it("retains a custom island slab when only a non-bearing island appliance is deleted", () => {
		    const support = islandFacePlacement(cabinet({ uid: "support" }), island, "front", 0);
		    const appliance = islandFacePlacement(cabinet({ uid: "range", placement: "appliance", masterCode: "RANGE-30", width: 30, depth: 24 }), island, "front", 24);
		    const custom = { ...island, countertopWidth: 60, countertopDepth: 42, countertopOffsetX: 3, countertopOffsetY: -2 };

		    expect(islandAfterCountertopSupportRemoval(custom, [support, appliance], [support])).toBe(custom);
		  });

	  it("keeps a guided 12-inch rear seating overhang anchored to the island work zone before a rear cabinet run exists", () => {
	    const workZone = { ...island, depth: 36 };
	    const frontOnly = islandFacePlacement(cabinet({ uid: "front-only" }), workZone, "front", 0);
	    const seatingIsland = {
	      ...workZone,
	      countertopDepth: 48,
	      countertopOffsetY: -6,
	      countertopDepthAnchoredToZone: true,
	    };
	    expect(islandCountertopRect(seatingIsland, [frontOnly])).toMatchObject({
	      y: workZone.y - 12,
	      depth: 48,
	    });
	  });

	  it("recovers a W-30-30 from a 6-inch Front remainder by expanding only toward Back", () => {
	    const compactIsland: IslandZone = { x: 36, y: 48, width: 66, depth: 24, activeFace: "front", autoAdjustDepthForBackFace: true };
	    const frontB18 = islandFacePlacement(cabinet({ uid: "front-b18", masterCode: "B-18", width: 18 }), compactIsland, "front", 0);
	    const frontRange = islandFacePlacement(cabinet({ uid: "front-range", masterCode: "RANGE-30", placement: "appliance", width: 30, depth: 24, height: 36 }), compactIsland, "front", 18);
	    const frontDb12 = islandFacePlacement(cabinet({ uid: "front-db12", masterCode: "3-DB12", width: 12 }), compactIsland, "front", 48);
	    const existing = [frontB18, frontRange, frontDb12];
	    const incoming = cabinet({ uid: "back-w3030", masterCode: "W-30-30", description: "30 inch wall cabinet", placement: "wall", width: 30, depth: 12, height: 30 });

	    expect(islandFaceCapacity(compactIsland, "front", existing).largestOpenSpan).toBe(6);
	    expect(nextIslandFacePlacement(incoming, compactIsland, "front", existing)).toBeNull();
    const adjustment = autoAdjustIslandDepthForBackFace(compactIsland, existing, room, incoming.depth);
    expect(adjustment.ok).toBe(true);
    if (!adjustment.ok) return;
    expect(adjustment.island).toMatchObject({ depth: 36, x: compactIsland.x, y: compactIsland.y - 12 });
	    expect(nextIslandFacePlacement(incoming, adjustment.island, "back", adjustment.placed)).toMatchObject({
	      islandFace: "back",
	      islandOffset: 0,
	      x: compactIsland.x,
	      y: compactIsland.y - 12,
	    });
	  });

		  it("uses the opposing seam in an oversized island while leaving room-wall cabinets outside the assembly", () => {
	    const staleIsland: IslandZone = { x: 24, y: 0, width: 66, depth: 96, activeFace: "front", autoAdjustDepthForBackFace: true };
	    const frontB18 = islandFacePlacement(cabinet({ uid: "front-b18", masterCode: "3-DB18", width: 18 }), staleIsland, "front", 0);
	    const frontRange = islandFacePlacement(cabinet({ uid: "front-range", masterCode: "RANGE-30", placement: "appliance", width: 30, depth: 24, height: 36 }), staleIsland, "front", 18);
	    const frontDb12 = islandFacePlacement(cabinet({ uid: "front-db12", masterCode: "3-DB12", width: 12 }), staleIsland, "front", 48);
	    const roomWallB24 = cabinet({ uid: "room-wall-b24", masterCode: "B-24", x: 24, y: 0, width: 24, depth: 24 });
	    const roomWallErb36 = cabinet({ uid: "room-wall-erb36", masterCode: "ERB36", x: 48, y: 0, width: 36, depth: 24 });
	    const existing = [frontB18, frontRange, frontDb12, roomWallB24, roomWallErb36];
	    const incoming = cabinet({ uid: "back-w3030", masterCode: "W-30-30", placement: "wall", width: 30, depth: 12, height: 30 });

	    expect(islandFaceCapacity(staleIsland, "front", existing).largestOpenSpan).toBe(6);
		    expect(nextIslandFacePlacement(incoming, staleIsland, "back", existing)).toMatchObject({
		      islandFace: "back",
		      islandOffset: 0,
		      x: 24,
		      y: 60,
		    });
	    const adjustment = autoAdjustIslandDepthForBackFace(staleIsland, existing, room, incoming.depth);
	    expect(adjustment.ok).toBe(true);
	    if (!adjustment.ok) return;
	    expect(adjustment.island).toMatchObject({ x: 24, y: 60, width: 66, depth: 36 });
	    expect(adjustment.placed.find((item) => item.uid === roomWallB24.uid)).toEqual(roomWallB24);
	    expect(adjustment.placed.find((item) => item.uid === roomWallErb36.uid)).toEqual(roomWallErb36);
	    expect(islandFaceCapacity(adjustment.island, "back", adjustment.placed).largestOpenSpan).toBe(66);
	    expect(nextIslandFacePlacement(incoming, adjustment.island, "back", adjustment.placed)).toMatchObject({
	      islandFace: "back",
	      islandOffset: 0,
	      x: 24,
	      y: 60,
	    });
	  });

	  it("preserves island face ownership and exact slab metadata through design save and restore", () => {
	    const attached = islandFacePlacement(cabinet({ uid: "saved-island-base" }), island, "right", 12);
	    const savedIsland = {
	      ...island,
	      activeFace: "right" as const,
	      cabinetStyleId: 99,
	      countertopWidth: 80,
	      countertopDepth: 54,
	      countertopOffsetX: 1.5,
	      countertopOffsetY: -0.5,
	      countertopDepthAnchoredToZone: true,
	    };
	    const restored = JSON.parse(JSON.stringify({ island: savedIsland, placed: [attached] })) as {
	      island: IslandZone;
	      placed: PlacedCabinet[];
	    };
	    expect(restored.island).toMatchObject(savedIsland);
	    expect(restored.placed[0]).toMatchObject({ uid: "saved-island-base", islandFace: "right", islandOffset: 12 });
	    expect(islandCountertopRect(restored.island, restored.placed)).toEqual(islandCountertopRect(savedIsland, [attached]));
	  });
	});
