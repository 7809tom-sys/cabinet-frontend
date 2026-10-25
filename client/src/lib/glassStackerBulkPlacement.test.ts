import { describe, expect, it } from "vitest";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";
import { applyGlassStackerBulkPlacement, glassStackerBulkCeilingBlocksAtHeight, glassStackerBulkHeightOptions, glassStackerBulkPlacementCandidates, glassStackerUidsForRemoval } from "./glassStackerBulkPlacement";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function wall(uid: string, masterCode: string, width: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid,
    cabinetId: 1,
    masterCode,
    description: "Wall cabinet",
    placement: "wall",
    x: 0,
    y: 0,
    width,
    depth: 12,
    height: 30,
    rotation: 0,
    ...extra,
  };
}

function catalog(masterCode: string, width: number, height = 12): DesignCabinet {
  return {
    id: width,
    masterCode,
    description: "Glass stacker cabinet",
    placement: "wall",
    width,
    depth: 12,
    height,
  } as DesignCabinet;
}

describe("glass stacker bulk placement", () => {
  it("finds matching catalog glass stackers for other eligible wall cabinets", () => {
    const firstParent = wall("parent-30", "W3030", 30, { x: 0 });
    const secondParent = wall("parent-24", "W2430", 24, { x: 30 });
    const source = wall("source", "W3012GD", 30, {
      description: "Glass stacker cabinet",
      x: 0,
      height: 12,
      glassDoor: true,
      mountBottom: 84,
      stackedOnCabinetUid: firstParent.uid,
    });
    const candidates = glassStackerBulkPlacementCandidates(
      [firstParent, secondParent, source],
      source.uid,
      room,
      [catalog("W3012GD", 30), catalog("W2412GD", 24)],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      parentUid: secondParent.uid,
      parentCode: "W2430",
      stacker: { masterCode: "W2412GD", x: 30, mountBottom: 84, stackedOnCabinetUid: secondParent.uid, glassDoor: true },
    });
  });

  it("skips wall cabinets that already have a stacker, are open units, or have no matching glass stacker", () => {
    const firstParent = wall("first", "W3030", 30, { x: 0 });
    const existingStacker = wall("existing", "W3012GD", 30, { description: "Glass stacker cabinet", height: 12, glassDoor: true, mountBottom: 84, stackedOnCabinetUid: firstParent.uid });
    const openUnit = wall("open", "W2430", 24, { x: 30, noDoor: true });
    expect(glassStackerBulkPlacementCandidates([firstParent, existingStacker, openUnit], existingStacker.uid, room, [catalog("W3012GD", 30)])).toEqual([]);
  });

  it("uses the placed stacker as a same-width catalog-safe fallback while the matching wall-cabinet pool is unavailable", () => {
    const firstParent = wall("first", "W2430", 24, { x: 0 });
    const secondParent = wall("second", "W2430", 24, { x: 24 });
    const source = wall("source", "W2412GD", 24, {
      description: "Glass door wall cabinet",
      x: 0,
      height: 12,
      glassDoor: true,
      mountBottom: 84,
      stackedOnCabinetUid: firstParent.uid,
    });
    const candidates = glassStackerBulkPlacementCandidates([firstParent, secondParent, source], source.uid, room, []);
    expect(candidates).toEqual([
      expect.objectContaining({
        parentUid: secondParent.uid,
        stacker: expect.objectContaining({
          cabinetId: source.cabinetId,
          masterCode: source.masterCode,
          x: secondParent.x,
          mountBottom: 84,
          stackedOnCabinetUid: secondParent.uid,
        }),
      }),
    ]);
  });

  it("never copies a diagonal glass stacker above same-width straight wall cabinets", () => {
    const firstDiagonal = wall("diagonal-source-parent", "WDC2430", 24, { x: 0, depth: 24, cornerType: "diagonal" });
    const secondDiagonal = wall("diagonal-target-parent", "WDC2430", 24, { x: 36, depth: 24, cornerType: "diagonal" });
    const straightWall = wall("straight-target-parent", "W2430", 24, { x: 72 });
    const source = wall("diagonal-source", "DCW2412GD", 24, {
      description: "Diagonal corner wall glass stacker",
      x: 0,
      depth: 24,
      height: 12,
      glassDoor: true,
      mountBottom: 84,
      stackedOnCabinetUid: firstDiagonal.uid,
    });

    const candidates = glassStackerBulkPlacementCandidates(
      [firstDiagonal, secondDiagonal, straightWall, source],
      source.uid,
      room,
      [],
    );

    expect(candidates).toEqual([
      expect.objectContaining({
        parentUid: secondDiagonal.uid,
        stacker: expect.objectContaining({
          masterCode: "DCW2412GD",
          stackedOnCabinetUid: secondDiagonal.uid,
        }),
      }),
    ]);
    expect(candidates.some((candidate) => candidate.parentUid === straightWall.uid)).toBe(false);
  });

  it("uses the chosen catalog stacker's own geometry instead of leaking a diagonal source shape", () => {
    const sourceParent = wall("diagonal-source-parent", "WDC2430", 24, { x: 0, depth: 24, cornerType: "diagonal" });
    const straightParent = wall("straight-parent", "W2430", 24, { x: 36 });
    const source = wall("diagonal-source", "DCW2412GD", 24, {
      description: "Diagonal corner wall glass stacker",
      x: 0,
      depth: 24,
      height: 12,
      glassDoor: true,
      cornerType: "diagonal",
      isCornerCabinet: true,
      mountBottom: 84,
      stackedOnCabinetUid: sourceParent.uid,
    });
    const candidates = glassStackerBulkPlacementCandidates(
      [sourceParent, straightParent, source],
      source.uid,
      room,
      [catalog("W2412GD", 24)],
    );

    expect(candidates).toEqual([
      expect.objectContaining({
        parentUid: straightParent.uid,
        stacker: expect.objectContaining({
          masterCode: "W2412GD",
          cornerType: null,
          isCornerCabinet: null,
        }),
      }),
    ]);

    const applied = applyGlassStackerBulkPlacement([sourceParent, straightParent, source], candidates, () => "new-straight-stacker");
    expect(applied.find((cabinet) => cabinet.uid === "new-straight-stacker")).toMatchObject({
      masterCode: "W2412GD",
      cornerType: null,
      isCornerCabinet: false,
      stackedOnCabinetUid: straightParent.uid,
    });
  });

  it("clears stale diagonal geometry before applying a straight stacker candidate", () => {
    const parent = wall("straight-parent", "W2430", 24);
    const staleCandidate = {
      parentUid: parent.uid,
      parentCode: parent.masterCode,
      stacker: wall("stale-preview", "W2412GD", 24, {
        description: "Glass wall stacker",
        height: 12,
        glassDoor: true,
        cornerType: "diagonal",
        isCornerCabinet: true,
        stackedOnCabinetUid: parent.uid,
      }),
    };
    const applied = applyGlassStackerBulkPlacement([parent], [staleCandidate], () => "normalized-straight-stacker");
    expect(applied.find((cabinet) => cabinet.uid === "normalized-straight-stacker")).toMatchObject({
      masterCode: "W2412GD",
      cornerType: null,
      isCornerCabinet: false,
    });
  });

  it("offers only the selected vendor's 12-to-24-inch stacker heights that fit eligible wall cabinets", () => {
    const firstParent = wall("parent-30", "W3030", 30, { x: 0 });
    const secondParent = wall("parent-24", "W2430", 24, { x: 30 });
    const options = glassStackerBulkHeightOptions(
      [firstParent, secondParent],
      { ...room, ceilingHeight: 108 },
      [
        catalog("W3012GD", 30, 12),
        catalog("W2412GD", 24, 12),
        catalog("W3018GD", 30, 18),
        catalog("W2418GD", 24, 18),
        catalog("W3030GD", 30, 30),
      ],
    );
    expect(options.map((option) => option.height)).toEqual([12, 18]);
    expect(options.map((option) => option.candidates)).toEqual([
      [expect.objectContaining({ parentUid: firstParent.uid }), expect.objectContaining({ parentUid: secondParent.uid })],
      [expect.objectContaining({ parentUid: firstParent.uid }), expect.objectContaining({ parentUid: secondParent.uid })],
    ]);
  });

  it("offers a vendor-prefixed DCW diagonal stacker only above the matching WDC diagonal wall-corner cabinet", () => {
    const straightParent = wall("straight-24", "SW-W2430", 24, { x: 0 });
    const diagonalParent = wall("diagonal-24", "SW-WDC2430", 24, {
      x: 36,
      depth: 24,
      cornerType: "diagonal",
    });
    const options = glassStackerBulkHeightOptions(
      [straightParent, diagonalParent],
      { ...room, ceilingHeight: 108 },
      [catalog("SW-DCW2412-GD", 24, 12)],
    );
    expect(options).toEqual([
      expect.objectContaining({
        height: 12,
        candidates: [expect.objectContaining({
          parentUid: diagonalParent.uid,
          stacker: expect.objectContaining({
            masterCode: "SW-DCW2412-GD",
            stackedOnCabinetUid: diagonalParent.uid,
          }),
        })],
      }),
    ]);
  });

  it("explains when a diagonal WDC42 already reaches a 96-inch ceiling and cannot accept a 12-inch stacker", () => {
    const diagonalParent = wall("diagonal-42", "SW-WDC42PG", 24, {
      x: 36,
      depth: 24,
      height: 42,
      mountBottom: 54,
      cornerType: "diagonal",
    });
    expect(glassStackerBulkCeilingBlocksAtHeight(
      [diagonalParent],
      room,
      [catalog("SW-DCW2412-GD", 24, 12)],
      12,
    )).toEqual([{
      parentUid: diagonalParent.uid,
      parentCode: diagonalParent.masterCode,
      requiredTop: 108,
      ceiling: 96,
    }]);
  });

  it("includes ceiling-safe diagonal and refrigerator-top wall cabinets when their selected-vendor stackers are available", () => {
    const diagonalParent = wall("diagonal-42", "DCW2442", 24, {
      x: 36,
      depth: 24,
      height: 42,
      mountBottom: 54,
      cornerType: "diagonal",
    });
    const refrigeratorTop = wall("refrigerator-top", "WR3624", 36, {
      x: 72,
      height: 24,
      mountBottom: 72,
    });
    const options = glassStackerBulkHeightOptions(
      [diagonalParent, refrigeratorTop],
      { ...room, ceilingHeight: 120 },
      [catalog("DCW2412GD", 24, 12), catalog("W3612GD", 36, 12)],
    );
    expect(options).toEqual([
      expect.objectContaining({
        height: 12,
        candidates: expect.arrayContaining([
          expect.objectContaining({ parentUid: diagonalParent.uid, stacker: expect.objectContaining({ masterCode: "DCW2412GD", stackedOnCabinetUid: diagonalParent.uid, mountBottom: 96 }) }),
          expect.objectContaining({ parentUid: refrigeratorTop.uid, stacker: expect.objectContaining({ masterCode: "W3612GD", stackedOnCabinetUid: refrigeratorTop.uid, mountBottom: 96 }) }),
        ]),
      }),
    ]);
  });

  it("adds one new stacker per still-unoccupied parent and gives each a fresh uid", () => {
    const parent = wall("parent", "W2430", 24, { x: 30 });
    const candidate = {
      parentUid: parent.uid,
      parentCode: parent.masterCode,
      stacker: wall("preview", "W2412GD", 24, { x: 30, description: "Glass stacker cabinet", height: 12, glassDoor: true, mountBottom: 84, stackedOnCabinetUid: parent.uid }),
    };
    expect(applyGlassStackerBulkPlacement([parent], [candidate], () => "new-stacker")).toEqual([
      parent,
      expect.objectContaining({ uid: "new-stacker", masterCode: "W2412GD", stackedOnCabinetUid: parent.uid }),
    ]);
  });

  it("selects only parent-owned glass stackers for removal and preserves wall cabinets and ordinary glass uppers", () => {
    const parent = wall("parent", "W2430", 24);
    const stacker = wall("stacker", "W2412GD", 24, {
      description: "Glass stacker cabinet",
      height: 12,
      glassDoor: true,
      stackedOnCabinetUid: parent.uid,
    });
    const ordinaryGlassUpper = wall("glass-upper", "W2442GD", 24, {
      description: "Glass door wall cabinet",
      height: 42,
      glassDoor: true,
    });
    expect(glassStackerUidsForRemoval([parent, stacker, ordinaryGlassUpper])).toEqual([stacker.uid]);
  });
});
