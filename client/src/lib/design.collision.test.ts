import { describe, expect, it } from "vitest";
import { appendCollisionFreePlacements, appendRefrigeratorEnclosurePlacements, DEFAULT_ROOM, elevationBox, fixtureIsOnCabinetFootprint, hasCollision, isMicrowaveOverRangePair, makeSinkForCabinet, mountedMicrowaveOverRangeSpot, nearestCollisionFreeMountBottom, normalizeRefrigeratorPanelSeams, normalizeSinkFixturesToBases, overRangeMicrowaveAttachment, placedFootprint, preferredRangeForOverRangeMicrowave, refrigeratorEndPanelConflict, refrigeratorEndPanelConflictDetail, removeOverlappingPlacements, snapPosition, wallPlacementAt, type PlacedCabinet, type RoomData } from "./design";

function placed(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "item",
    cabinetId: 1,
    masterCode: "B33",
    description: "Base cabinet",
    placement: "base",
    x: 0,
    y: 0,
    width: 33,
    depth: 24,
    height: 34.5,
    rotation: 0,
    ...overrides,
  } as PlacedCabinet;
}

describe("design placement collision prevention", () => {
  it("rejects a 3DB15 drawer base that overlaps a B33 footprint", () => {
    const b33 = placed({ uid: "b33", masterCode: "B33", x: 0 });
    const drawerBase = placed({ uid: "3db15", masterCode: "3DB15", x: 18, width: 15 });
    expect(hasCollision(drawerBase, [b33])).toBe(true);
  });

  it("allows cabinet runs that merely butt edge-to-edge", () => {
    const b33 = placed({ uid: "b33", masterCode: "B33", x: 0 });
    const drawerBase = placed({ uid: "3db15", masterCode: "3DB15", x: 33, width: 15 });
    expect(hasCollision(drawerBase, [b33])).toBe(false);
  });

  it("snaps DB18 flush to either edge of a freestanding 30-inch range", () => {
    const range = placed({ uid: "range", masterCode: "RANGE-30", description: '30" Freestanding Range', placement: "appliance", x: 36, y: 0, width: 30, depth: 25, height: 36 });
    const rightPreview = placed({ uid: "db18-right", masterCode: "DB18", description: '18" Drawer Base', x: 68, y: 0, width: 18, depth: 24, height: 34.5 });
    const leftPreview = placed({ uid: "db18-left", masterCode: "DB18", description: '18" Drawer Base', x: 16, y: 0, width: 18, depth: 24, height: 34.5 });

    expect(snapPosition(rightPreview, DEFAULT_ROOM, [range])).toMatchObject({ x: 66, y: 0, snappedCabinet: true });
    expect(snapPosition(leftPreview, DEFAULT_ROOM, [range])).toMatchObject({ x: 18, y: 0, snappedCabinet: true });
  });

  it("rounds a free-floating drag to the shared one-eighth-inch grid", () => {
    const preview = placed({ uid: "grid-preview", x: 43.07, y: 47.94, width: 18, depth: 24 });
    expect(snapPosition(preview, DEFAULT_ROOM, [])).toMatchObject({
      x: 43.125,
      y: 48,
      snappedGrid: true,
    });
  });

  it("allows separate floating shelves on the same wall span only when their mounted heights do not overlap", () => {
    const lowerShelf = placed({ uid: "shelf-54", masterCode: "FS36", description: "Floating shelf", placement: "wall", width: 36, depth: 12, height: 0.75, mountBottom: 54, mountBottomAdjusted: true });
    const upperShelf = placed({ uid: "shelf-66", masterCode: "FS36", description: "Floating shelf", placement: "wall", width: 36, depth: 12, height: 0.75, mountBottom: 66, mountBottomAdjusted: true });
    const overlappingShelf = { ...upperShelf, uid: "shelf-overlap", mountBottom: 54.5 };
    expect(hasCollision(upperShelf, [lowerShelf])).toBe(false);
    expect(hasCollision(overlappingShelf, [lowerShelf])).toBe(true);
  });

  it("snaps an overlapping floating shelf duplicate to the nearest clear 1/8-inch height", () => {
    const originalShelf = placed({ uid: "shelf-54", masterCode: "FS36", description: "Floating shelf", placement: "wall", width: 36, depth: 12, height: 0.75, mountBottom: 54, mountBottomAdjusted: true });
    const preview = { ...originalShelf, uid: "preview-shelf", mountBottom: 54 };
    expect(nearestCollisionFreeMountBottom(preview, [originalShelf], 54, 95.25)).toBe(53.25);
  });

  it("identifies sinks attached to a sink base while leaving standalone sinks independent", () => {
    const sinkBase = placed({ uid: "sb36", masterCode: "SB36", description: "Sink Base 36", x: 24, y: 0, width: 36, depth: 24 });
    expect(fixtureIsOnCabinetFootprint({ x: 34, y: 5, width: 20, depth: 18 }, sinkBase)).toBe(true);
    expect(fixtureIsOnCabinetFootprint({ x: 80, y: 40, width: 20, depth: 18 }, sinkBase)).toBe(false);
  });

  it("centers and turns a sink lengthwise within a right-wall sink base", () => {
    const rightSinkBase = placed({ uid: "right-sb36", masterCode: "SB36", description: "Sink Base 36", x: 120, y: 42, width: 36, depth: 24, rotation: 90 });
    const installed = makeSinkForCabinet("single", rightSinkBase, DEFAULT_ROOM);
    expect(installed.wallSide).toBe("right");
    expect(installed.width).toBe(18);
    expect(installed.depth).toBe(25);
    expect(installed.cabinetUid).toBe("right-sb36");
    const normalized = normalizeSinkFixturesToBases([{ ...installed, wallSide: undefined, width: 25, depth: 18, sourceWidth: undefined, sourceDepth: undefined }], [rightSinkBase], DEFAULT_ROOM);
    expect(normalized[0]).toMatchObject({ wallSide: "right", width: 18, depth: 25, cabinetUid: "right-sb36" });
  });

  it("centers and rotates an attached sink with its exact 45-degree peninsula SB36", () => {
    const room: RoomData = {
      width: 144,
      depth: 144,
      ceilingHeight: 96,
      peninsulaRuns: [{
        id: "sink-parent-run",
        parentWall: "top",
        startOffset: 72,
        turn: 90,
        direction: "right",
        length: 36,
        height: 34.5,
        cabinetSide: "left",
      }, {
        id: "sink-45-run",
        parentRunId: "sink-parent-run",
        startOffset: 0,
        turn: 45,
        direction: "left",
        length: 72,
        height: 34.5,
        cabinetSide: "left",
      }],
    };
    const spot = wallPlacementAt(12, 36, 24, "sink-45-run" as never, room, "left");
    const sinkBase = placed({
      uid: "angled-sb36",
      masterCode: "SB36",
      description: "Sink Base 36",
      x: spot.x,
      y: spot.y,
      width: 36,
      depth: 24,
      rotation: spot.rotation,
      wallId: spot.wallId,
      wallOffset: spot.wallOffset,
      peninsulaSide: spot.peninsulaSide,
    });
    const installed = makeSinkForCabinet("single", sinkBase, room, { width: 31, depth: 20 });
    const footprint = placedFootprint(sinkBase);
    expect(installed).toMatchObject({ cabinetUid: "angled-sb36", wallSide: "sink-45-run", planRotation: 45 });
    expect(installed.x + installed.width / 2).toBeCloseTo(sinkBase.x + footprint.w / 2, 6);
    expect(installed.y + installed.depth / 2).toBeCloseTo(sinkBase.y + footprint.d / 2, 6);

    const normalized = normalizeSinkFixturesToBases([{ ...installed, x: 0, y: 0, planRotation: 0 }], [sinkBase], room);
    expect(normalized[0]).toMatchObject({ x: installed.x, y: installed.y, planRotation: 45, cabinetUid: "angled-sb36" });
  });

  it("puts an island sink faucet at the side opposite the user-facing cabinet front", () => {
    const frontSinkBase = placed({ uid: "island-front-sb", masterCode: "SB36", description: "Sink Base 36", x: 36, y: 60, width: 36, depth: 24, islandFace: "front", rotation: 0 });
    const backSinkBase = placed({ uid: "island-back-sb", masterCode: "SB36", description: "Sink Base 36", x: 36, y: 36, width: 36, depth: 24, islandFace: "back", rotation: 180 });

    expect(makeSinkForCabinet("single", frontSinkBase, DEFAULT_ROOM).wallSide).toBe("top");
    expect(makeSinkForCabinet("single", backSinkBase, DEFAULT_ROOM).wallSide).toBe("bottom");
  });

  it("preserves source-verified asymmetric double-bowl widths when a farmhouse sink is normalized to its owning base", () => {
    const topFarmhouseBase = placed({ uid: "fsb36", masterCode: "FSB-36", description: "Farmhouse Sink Base 36", x: 36, y: 0, width: 36, depth: 24 });
    const installed = makeSinkForCabinet("farmhouse", topFarmhouseBase, DEFAULT_ROOM, { width: 33, depth: 21 });
    const normalized = normalizeSinkFixturesToBases([{
      ...installed,
      pelicanProfileId: "pelican-pl-ha136-r15-stainless-asymmetric-double-bowl-farmhouse",
      bowlWidth: 17,
      bowlWidths: [17, 12] as const,
      bowlDepth: 16,
      bowlHeight: 10,
      bowlCount: 2,
      exteriorHeight: 10,
      apronFront: true,
      surfaceFinish: "gunmetal-black" as const,
    }], [topFarmhouseBase], DEFAULT_ROOM);
    expect(normalized[0]).toMatchObject({
      cabinetUid: "fsb36",
      pelicanProfileId: "pelican-pl-ha136-r15-stainless-asymmetric-double-bowl-farmhouse",
      bowlWidths: [17, 12],
      bowlCount: 2,
      surfaceFinish: "gunmetal-black",
    });
  });

  it("preserves source-verified asymmetric double-bowl widths and depths when a standard sink is normalized to its owning base", () => {
    const topStandardBase = placed({ uid: "sb36", masterCode: "SB36", description: "Sink Base 36", x: 36, y: 0, width: 36, depth: 24 });
    const installed = makeSinkForCabinet("single", topStandardBase, DEFAULT_ROOM, { width: 31.25, depth: 20.5 });
    const normalized = normalizeSinkFixturesToBases([{
      ...installed,
      pelicanProfileId: "pelican-pl-ha126-r0-stainless-asymmetric-double-bowl-undermount",
      bowlWidth: 14,
      bowlWidths: [14, 13.5] as const,
      bowlDepth: 18,
      bowlDepths: [18, 16] as const,
      bowlHeight: 10,
      bowlHeights: [10, 8] as const,
      bowlCount: 2,
      exteriorHeight: 10,
      apronFront: false,
    }], [topStandardBase], DEFAULT_ROOM);
    expect(normalized[0]).toMatchObject({
      cabinetUid: "sb36",
      pelicanProfileId: "pelican-pl-ha126-r0-stainless-asymmetric-double-bowl-undermount",
      bowlWidths: [14, 13.5],
      bowlDepths: [18, 16],
      bowlHeights: [10, 8],
      bowlCount: 2,
    });
  });

  it("preserves source-verified stepped double-bowl dimensions and heights when PL-VS7030 is normalized to its owning base", () => {
    const topStandardBase = placed({ uid: "sb36", masterCode: "SB36", description: "Sink Base 36", x: 36, y: 0, width: 36, depth: 24 });
    const installed = makeSinkForCabinet("single", topStandardBase, DEFAULT_ROOM, { width: 31.5, depth: 20.5 });
    const normalized = normalizeSinkFixturesToBases([{
      ...installed,
      pelicanProfileId: "pelican-pl-vs7030-stainless-stepped-double-bowl-undermount",
      bowlWidth: 17.75,
      bowlWidths: [17.75, 10.625] as const,
      bowlDepth: 18.5,
      bowlDepths: [18.5, 16] as const,
      bowlHeight: 9,
      bowlHeights: [9, 7] as const,
      bowlCount: 2,
      exteriorHeight: 9,
      apronFront: false,
    }], [topStandardBase], DEFAULT_ROOM);
    expect(normalized[0]).toMatchObject({
      cabinetUid: "sb36",
      pelicanProfileId: "pelican-pl-vs7030-stainless-stepped-double-bowl-undermount",
      bowlWidths: [17.75, 10.625],
      bowlDepths: [18.5, 16],
      bowlHeights: [9, 7],
      bowlCount: 2,
    });
  });

  it("preserves a source-verified rear-right drain offset when a standard sink is normalized to its owning base", () => {
    const topStandardBase = placed({ uid: "sb36", masterCode: "SB36", description: "Sink Base 36", x: 36, y: 0, width: 36, depth: 24 });
    const installed = makeSinkForCabinet("single", topStandardBase, DEFAULT_ROOM, { width: 31.25, depth: 18 });
    const normalized = normalizeSinkFixturesToBases([{
      ...installed,
      pelicanProfileId: "pelican-pl-ha119-r19-stainless-offset-drain-undermount",
      bowlWidth: 29.25,
      bowlDepth: 16,
      bowlHeight: 9.5,
      drainInsetRight: 5,
      drainInsetBack: 5,
      exteriorHeight: 10,
      apronFront: false,
    }], [topStandardBase], DEFAULT_ROOM);
    expect(normalized[0]).toMatchObject({
      cabinetUid: "sb36",
      pelicanProfileId: "pelican-pl-ha119-r19-stainless-offset-drain-undermount",
      drainInsetRight: 5,
      drainInsetBack: 5,
    });
  });

  it("rejects an appliance overlapping a base cabinet but preserves the sink-over-sink-base exception", () => {
    const b33 = placed({ uid: "b33", masterCode: "B33", x: 0 });
    const range = placed({ uid: "range", masterCode: "RANGE-30", placement: "appliance", x: 4, width: 30 });
    const sinkBase = placed({ uid: "sb36", masterCode: "SB36", description: "Sink Base 36", x: 0, width: 36 });
    const sink = placed({ uid: "sink", masterCode: "SINK-33", description: "Single bowl sink", placement: "appliance", x: 0, width: 33 });
    expect(hasCollision(range, [b33])).toBe(true);
    expect(hasCollision(sink, [sinkBase])).toBe(false);
  });

  it("allows a mounted over-range microwave above a range but still blocks the same microwave at floor height", () => {
    const range = placed({ uid: "range", masterCode: "RANGE-30", description: '30" Black Gas Range', placement: "appliance", x: 30, y: 0, width: 30, depth: 25, height: 36, mountBottom: 0 });
    const mountedMicrowave = placed({ uid: "mw-mounted", masterCode: "MW-30", description: '30" Over-Range Microwave', placement: "appliance", x: 30, y: 0, width: 30, depth: 15, height: 17, mountBottom: 54 });
    const floorMicrowave = { ...mountedMicrowave, uid: "mw-floor", mountBottom: 16 };
    const misalignedMicrowave = { ...mountedMicrowave, uid: "mw-misaligned", x: 35 };

    expect(elevationBox(range)).toEqual({ bottom: 0, height: 36 });
    expect(elevationBox(mountedMicrowave)).toEqual({ bottom: 54, height: 17 });
    expect(isMicrowaveOverRangePair(mountedMicrowave, range)).toBe(true);
    expect(hasCollision(mountedMicrowave, [range])).toBe(false);
    expect(hasCollision(floorMicrowave, [range])).toBe(true);
    expect(isMicrowaveOverRangePair(misalignedMicrowave, range)).toBe(false);
    expect(hasCollision(misalignedMicrowave, [range])).toBe(true);
  });

  it("allows the same centered mounted MW-30 pair on a rotated right-wall range", () => {
    const range = placed({ uid: "range-right", masterCode: "RANGE-30", description: '30" Black Gas Range', placement: "appliance", x: 120, y: 40, width: 30, depth: 25, height: 36, mountBottom: 0, rotation: 90 });
    const microwave = placed({ uid: "mw-right", masterCode: "MW-30", description: '30" Over-Range Microwave', placement: "appliance", x: 129, y: 40, width: 30, depth: 15, height: 17, mountBottom: 54, rotation: 90 });
    expect(isMicrowaveOverRangePair(microwave, range)).toBe(true);
    expect(hasCollision(microwave, [range])).toBe(false);
  });

  it("pins a new MW-30 to the exact range center on top and right walls", () => {
    const topRange = placed({ uid: "top-range", masterCode: "RANGE-30", placement: "appliance", x: 42, y: 0, width: 30, depth: 25, height: 34.5, rotation: 0 });
    const rightRange = placed({ uid: "right-range", masterCode: "RANGE-30", placement: "appliance", x: 119, y: 42, width: 30, depth: 25, height: 34.5, rotation: 90 });
    expect(mountedMicrowaveOverRangeSpot({ width: 30, depth: 15 }, topRange, DEFAULT_ROOM)).toMatchObject({ x: 42, y: 0, rotation: 0 });
    expect(mountedMicrowaveOverRangeSpot({ width: 30, depth: 15 }, rightRange, DEFAULT_ROOM)).toMatchObject({ x: 129, y: 42, rotation: 90 });
  });

  it("attaches a palette-added MW-30 to the selected range before considering a floating canvas drop point", () => {
    const topRange = placed({ uid: "top-range", masterCode: "RANGE-30", placement: "appliance", x: 42, y: 0, width: 30, depth: 25, height: 34.5, rotation: 0 });
    const rightRange = placed({ uid: "right-range", masterCode: "RANGE-30", placement: "appliance", x: 119, y: 42, width: 30, depth: 25, height: 34.5, rotation: 90 });
    const selected = preferredRangeForOverRangeMicrowave([topRange, rightRange], DEFAULT_ROOM, "top", "top-range", { x: 60, y: 60 });
    const activeWall = preferredRangeForOverRangeMicrowave([topRange, rightRange], DEFAULT_ROOM, "top", null, { x: 60, y: 60 });
    expect(selected?.uid).toBe("top-range");
    expect(activeWall?.uid).toBe("top-range");
    expect(mountedMicrowaveOverRangeSpot({ width: 30, depth: 15 }, selected!, DEFAULT_ROOM)).toMatchObject({ x: 42, y: 0, rotation: 0 });
    expect(overRangeMicrowaveAttachment([topRange, rightRange], DEFAULT_ROOM, "top", "top-range", { x: 60, y: 60 }, { width: 30, depth: 15 })).toMatchObject({ range: topRange, spot: { x: 42, y: 0, rotation: 0 } });
    expect(overRangeMicrowaveAttachment([], DEFAULT_ROOM, "top", null, { x: 60, y: 60 }, { width: 30, depth: 15 })).toBeNull();
  });

  it("does not append a base cabinet into an existing refrigerator opening", () => {
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", x: 24, width: 36, height: 70 });
    const b24 = placed({ uid: "b24", masterCode: "B-24", x: 24, width: 24 });
    const result = appendCollisionFreePlacements([fridge], [b24]);
    expect(result.placed).toEqual([fridge]);
    expect(result.rejected).toEqual([b24]);
  });

  it("preserves left and right refrigerator enclosure panels beside the appliance", () => {
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance", x: 24, width: 36, height: 70 });
    const leftBase = placed({ uid: "left-base", masterCode: "B-24", description: "Base Cabinet 24", placement: "base", x: 0, width: 24, height: 34.5 });
    const leftPanel = placed({ uid: "left-panel", masterCode: "REPV-96", description: "Refrigerator End Panel 96\"H", placement: "tall", customProfile: "refrigerator-end-panel", x: 23.25, width: 0.75, depth: 27, height: 96 });
    const rightPanel = placed({ uid: "right-panel", masterCode: "REPV-96", description: "Refrigerator End Panel 96\"H", placement: "tall", customProfile: "refrigerator-end-panel", x: 60, width: 0.75, depth: 27, height: 96 });
    const result = appendCollisionFreePlacements([leftBase, fridge], [leftPanel, rightPanel]);
    expect(result.placed).toEqual([leftBase, fridge, leftPanel, rightPanel]);
    expect(result.rejected).toEqual([]);
  });

  it("never re-seats earlier saved cabinets around refrigerator panel seams", () => {
    const leftBase = placed({ uid: "left-base", masterCode: "B-12", x: 36, width: 12, height: 34.5 });
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", x: 48, width: 36, depth: 25, height: 70 });
    const leftPanel = placed({ uid: "left-panel", masterCode: "REPV-96", description: "Refrigerator End Panel", placement: "tall", x: 46.5, width: 1.5, depth: 25, height: 96 });
    const rightPanel = placed({ uid: "right-panel", masterCode: "REPV-96", description: "Refrigerator End Panel", placement: "tall", x: 84, width: 1.5, depth: 25, height: 96 });
    const rightBase = placed({ uid: "right-base", masterCode: "3-DB24", x: 84, width: 24, height: 34.5 });
    const normalized = normalizeRefrigeratorPanelSeams([leftBase, fridge, leftPanel, rightPanel, rightBase], DEFAULT_ROOM);
    expect(normalized.find((item) => item.uid === "left-base")?.x).toBe(36);
    expect(normalized.find((item) => item.uid === "right-base")?.x).toBe(84);
    expect(normalized.find((item) => item.uid === "left-panel")?.x).toBe(46.5);
    expect(normalized.find((item) => item.uid === "right-panel")?.x).toBe(84);
  });

  it("preserves the earlier cabinet and rejects a later colliding refrigerator during restore", () => {
    const b24 = placed({ uid: "b24", masterCode: "B-24", x: 24, width: 24 });
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", x: 24, width: 36, height: 70 });
    const result = removeOverlappingPlacements([b24, fridge]);
    expect(result.placed).toEqual([b24]);
    expect(result.rejected).toEqual([fridge]);
  });

  it("rejects a refrigerator end panel that would cover a neighboring cabinet while allowing exact edge contact", () => {
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", x: 24, width: 36, height: 70 });
    const leftBase = placed({ uid: "left-base", masterCode: "B-24", x: 0, width: 24 });
    const overlappingPanel = placed({ uid: "panel-overlap", masterCode: "REPV-96", description: "Refrigerator End Panel", placement: "tall", customProfile: "refrigerator-end-panel", x: 23.25, width: 1.5, depth: 24, height: 96 });
    const flushPanel = placed({ ...overlappingPanel, uid: "panel-flush", x: 24, width: 0.75 });
    expect(refrigeratorEndPanelConflict(overlappingPanel, [leftBase, fridge], fridge.uid)).toBe(leftBase);
    expect(refrigeratorEndPanelConflict(flushPanel, [leftBase, fridge], fridge.uid)).toBeNull();
  });

  it("preserves an earlier B-18 exactly and rejects only the new overlapping refrigerator panel", () => {
    const b18 = placed({ uid: "b18", masterCode: "B-18", placement: "base", x: 0, width: 18, depth: 24, height: 34.5 });
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator 36", placement: "appliance", x: 18, width: 36, depth: 30, height: 70 });
    const leftPanel = placed({ uid: "left-panel", masterCode: "REPV-96", description: "Refrigerator End Panel", placement: "tall", customProfile: "refrigerator-end-panel", x: 17.25, width: 0.75, depth: 30, height: 96 });
    const rightPanel = placed({ uid: "right-panel", masterCode: "REPV-96", description: "Refrigerator End Panel", placement: "tall", customProfile: "refrigerator-end-panel", x: 54, width: 0.75, depth: 30, height: 96 });
    const result = appendRefrigeratorEnclosurePlacements([b18, fridge], [leftPanel, rightPanel], fridge.uid);
    expect(result.placed).toEqual([b18, fridge, rightPanel]);
    expect(result.rejected).toEqual([leftPanel]);
    expect(result.placed.find((item) => item.uid === b18.uid)).toBe(b18);
    expect(result.panelConflicts).toHaveLength(1);
    expect(result.panelConflicts[0]?.cabinet).toBe(b18);
    expect(result.panelConflicts[0]?.overlapIn).toBeCloseTo(0.75, 6);
    expect(refrigeratorEndPanelConflictDetail(leftPanel, [b18, fridge], fridge.uid)?.overlapIn).toBeCloseTo(0.75, 6);
  });

  it("preserves B-18 through saved-design cleanup and rejects the later conflicting panel on restore", () => {
    const b18 = placed({ uid: "b18-restore", masterCode: "B-18", placement: "base", x: 0, width: 18, depth: 24, height: 34.5 });
    const fridge = placed({ uid: "fridge-restore", masterCode: "FRIDGE-36", placement: "appliance", x: 18, width: 36, depth: 30, height: 70 });
    const leftPanel = placed({ uid: "left-panel-restore", masterCode: "REPV-96", description: "Refrigerator End Panel", placement: "tall", customProfile: "refrigerator-end-panel", x: 17.25, width: 0.75, depth: 30, height: 96 });
    const rightPanel = placed({ uid: "right-panel-restore", masterCode: "REPV-96", description: "Refrigerator End Panel", placement: "tall", customProfile: "refrigerator-end-panel", x: 54, width: 0.75, depth: 30, height: 96 });
    const restored = removeOverlappingPlacements([b18, fridge, leftPanel, rightPanel]);
    expect(restored.placed.map((item) => item.uid)).toEqual([b18.uid, fridge.uid, rightPanel.uid]);
    expect(restored.rejected.map((item) => item.uid)).toEqual([leftPanel.uid]);
    expect(restored.placed.find((item) => item.uid === b18.uid)).toBe(b18);
    expect(restored.placed.find((item) => item.uid === b18.uid)?.x).toBe(0);
  });

  it("allows a base cabinet to butt against the refrigerator opening", () => {
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", x: 24, width: 36, height: 70 });
    const b24 = placed({ uid: "b24", masterCode: "B-24", x: 0, width: 24 });
    expect(appendCollisionFreePlacements([fridge], [b24]).placed).toEqual([fridge, b24]);
  });

  it("snaps a cabinet flush to a refrigerator edge without creating a collision", () => {
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", x: 24, width: 36, height: 70 });
    const b24 = placed({ uid: "b24", masterCode: "B-24", x: 1, width: 24 });
    const snapped = snapPosition(b24, DEFAULT_ROOM, [fridge]);
    const aligned = { ...b24, x: snapped.x, y: snapped.y };
    expect(snapped.snappedCabinet || snapped.snappedWall).toBe(true);
    expect(aligned.x + aligned.width).toBe(fridge.x);
    expect(hasCollision(aligned, [fridge])).toBe(false);
  });

  it("snaps a cabinet flush to an adjacent cabinet edge without changing its perpendicular position", () => {
    const b24 = placed({ uid: "b24", masterCode: "B-24", x: 24, y: 12, width: 24 });
    const b18 = placed({ uid: "b18", masterCode: "B-18", x: 7, y: 12, width: 18 });
    const snapped = snapPosition(b18, DEFAULT_ROOM, [b24]);
    expect(snapped.snappedCabinet).toBe(true);
    expect(snapped.x + b18.width).toBe(b24.x);
    expect(snapped.y).toBe(12);
  });
});
