import { describe, expect, it } from "vitest";
import {
  floorPlanWallDimensionChains,
  wallPlacementAt,
  wallRunCornerPlacement,
  wallRunFrame,
  wallSpanMeasure,
  type FloorPlanWallDimensionChain,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

const measuredRoom: RoomData = {
  width: 156.154,
  depth: 132,
  ceilingHeight: 96,
  openWallPath: true,
  vertices: [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 101, y: 0 },
    { id: "c", x: 156.154, y: 55.154 },
  ],
  customWalls: [
    { id: "wall-101", startVertexId: "a", endVertexId: "b", label: "101 in wall" },
    { id: "wall-78", startVertexId: "b", endVertexId: "c", label: "78 in diagonal", lockedAngle: 45 },
  ],
};

function seatedBase(uid: string, code: string, width: number, wallId: string, offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, wallId, measuredRoom);
  return {
    uid,
    cabinetId: 1,
    masterCode: code,
    description: code,
    placement: "base",
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    x: spot.x,
    y: spot.y,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
  };
}

describe("shared Floor Plan dimension chains", () => {
  it("shows catalog spans and the exact remaining gap on a 101-inch measured wall", () => {
    const cabinets = [
      seatedBase("lsb36", "LSB36", 36, "wall-101", 0),
      seatedBase("db12", "3DB12", 12, "wall-101", 36),
      seatedBase("range", "RANGE-30-1-16", 30.0625, "wall-101", 48),
      seatedBase("db18", "3DB18", 18, "wall-101", 78.0625),
    ];

    const chain = floorPlanWallDimensionChains(measuredRoom, cabinets)
      .find((candidate) => candidate.wallId === "wall-101" && candidate.layer === "base");

    expect(chain).toBeDefined();
    expect(chain!.length).toBeCloseTo(101, 6);
    expect(chain!.segments.map((segment) => segment.length)).toEqual([36, 12, 30.0625, 18, 4.9375]);
    expect(chain!.segments.reduce((total, segment) => total + segment.length, 0)).toBeCloseTo(chain!.length, 6);
  });

  it("uses true catalog width rather than a rotated envelope on a 45-degree wall", () => {
    const diagonalCabinet = seatedBase("diagonal-b36", "B36", 36, "wall-78", 0);
    const chain = floorPlanWallDimensionChains(measuredRoom, [diagonalCabinet])
      .find((candidate) => candidate.wallId === "wall-78" && candidate.layer === "base");

    expect(chain).toBeDefined();
    expect(chain!.segments.map((segment) => segment.length)).toEqual(expect.arrayContaining([36, expect.any(Number)]));
    expect(chain!.segments[1]!.length).toBeCloseTo(42, 3);
    expect(chain!.segments.reduce((total, segment) => total + segment.length, 0)).toBeCloseTo(chain!.length, 6);
  });

  it("reports live left and right clearance against adjoining measured-wall cabinets", () => {
    const left = seatedBase("left", "B36", 36, "wall-101", 0);
    const moving = seatedBase("moving", "B12", 12, "wall-101", 40.9375);
    const right = seatedBase("right", "B18", 18, "wall-101", 70);

    expect(wallSpanMeasure(moving, measuredRoom, [left, moving, right], "wall-101")).toMatchObject({
      before: 4.9375,
      after: 17.0625,
      beforeIsCabinet: true,
      afterIsCabinet: true,
    });
  });
});

const uKitchen: RoomData = { width: 144, depth: 96, ceilingHeight: 96 };
const lKitchen: RoomData = { width: 120, depth: 96, ceilingHeight: 96 };

function straightCabinet(
  room: RoomData,
  uid: string,
  code: string,
  width: number,
  placement: "base" | "wall",
  wall: WallSide,
  along: number,
): PlacedCabinet {
  const depth = placement === "wall" ? 12 : 24;
  const height = placement === "wall" ? (code.endsWith("24") ? 24 : 42) : 34.5;
  const spot = wallPlacementAt(along, width, depth, wall, room);
  return {
    uid,
    cabinetId: 1,
    masterCode: code,
    description: code,
    placement,
    width,
    depth,
    height,
    rotation: spot.rotation,
    x: spot.x,
    y: spot.y,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    numberOfDoors: 1,
    numberOfDrawers: 0,
  };
}

function cornerCabinet(
  room: RoomData,
  uid: string,
  code: string,
  width: number,
  placement: "base" | "wall",
  wall: WallSide,
  at: "start" | "end",
  cornerType?: PlacedCabinet["cornerType"],
): PlacedCabinet {
  const height = placement === "wall" ? 42 : 34.5;
  const seed: PlacedCabinet = {
    uid,
    cabinetId: 1,
    masterCode: code,
    description: code,
    placement,
    width,
    depth: placement === "wall" ? 12 : 24,
    height,
    rotation: 0,
    x: 0,
    y: 0,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    ...(cornerType ? { cornerType } : {}),
  };
  const frame = wallRunFrame(wall, room);
  const spot = frame ? wallRunCornerPlacement(seed, frame, at, room) : null;
  if (!spot) throw new Error(`no corner seat for ${uid} on ${wall}`);
  return { ...seed, ...spot, wallId: spot.wallId, wallOffset: spot.wallOffset };
}

function chainFor(
  room: RoomData,
  cabinets: readonly PlacedCabinet[],
  wallId: string,
  layer: "base" | "wall",
): FloorPlanWallDimensionChain {
  const chain = floorPlanWallDimensionChains(room, cabinets)
    .find((candidate) => candidate.wallId === wallId && candidate.layer === layer);
  expect(chain, `${wallId} ${layer}`).toBeDefined();
  return chain!;
}

function cabinetRuns(chain: FloorPlanWallDimensionChain) {
  return chain.segments
    .filter((segment) => segment.kind === "cabinet")
    .map((segment) => ({ code: segment.masterCode, start: segment.start, length: segment.length }));
}

function expectChainAddsUp(chain: FloorPlanWallDimensionChain, wallLength: number) {
  expect(chain.length).toBeCloseTo(wallLength, 6);
  expect(chain.segments.reduce((total, segment) => total + segment.length, 0)).toBeCloseTo(chain.length, 6);
  const cabinetTotal = chain.segments
    .filter((segment) => segment.kind === "cabinet")
    .reduce((total, segment) => total + segment.length, 0);
  expect(cabinetTotal).toBeLessThanOrEqual(chain.length + 1e-6);
}

describe("corner cabinets in both wall dimension chains", () => {
  it("measures both diagonal corners of a U-kitchen on every wall they touch", () => {
    const cabinets = [
      cornerCabinet(uKitchen, "left-dcw", "DCW2442", 24, "wall", "top", "start"),
      straightCabinet(uKitchen, "back-w30-left", "W3042", 30, "wall", "top", 24),
      straightCabinet(uKitchen, "back-w36", "W3624", 36, "wall", "top", 54),
      straightCabinet(uKitchen, "back-w30-right", "W3042", 30, "wall", "top", 90),
      cornerCabinet(uKitchen, "right-dcw", "DCW2442", 24, "wall", "right", "start"),
      straightCabinet(uKitchen, "left-w30", "W3042", 30, "wall", "left", 24),
      straightCabinet(uKitchen, "right-w30", "W3042", 30, "wall", "right", 24),
      cornerCabinet(uKitchen, "left-dcb", "DCB36", 36, "base", "top", "start"),
      straightCabinet(uKitchen, "back-b18-left", "B18", 18, "base", "top", 36),
      straightCabinet(uKitchen, "back-sink", "SB36", 36, "base", "top", 54),
      straightCabinet(uKitchen, "back-b18-right", "B18", 18, "base", "top", 90),
      cornerCabinet(uKitchen, "right-dcb", "DCB36", 36, "base", "right", "start"),
      straightCabinet(uKitchen, "left-b18", "B18", 18, "base", "left", 36),
      straightCabinet(uKitchen, "right-b18", "B18", 18, "base", "right", 36),
    ];

    // The seating rule anchors the left corner to the back wall and the right
    // corner to the right wall. Both legs still have to be dimensioned.
    expect(cabinets.find((cabinet) => cabinet.uid === "left-dcw")!.wallId).toBe("top");
    expect(cabinets.find((cabinet) => cabinet.uid === "right-dcw")!.wallId).toBe("right");
    expect(cabinets.find((cabinet) => cabinet.uid === "left-dcb")!.wallId).toBe("top");
    expect(cabinets.find((cabinet) => cabinet.uid === "right-dcb")!.wallId).toBe("right");

    const backWall = chainFor(uKitchen, cabinets, "top", "wall");
    const backBase = chainFor(uKitchen, cabinets, "top", "base");
    const leftWall = chainFor(uKitchen, cabinets, "left", "wall");
    const leftBase = chainFor(uKitchen, cabinets, "left", "base");
    const rightWall = chainFor(uKitchen, cabinets, "right", "wall");
    const rightBase = chainFor(uKitchen, cabinets, "right", "base");

    expect(cabinetRuns(backWall)).toEqual([
      { code: "DCW2442", start: 0, length: 24 },
      { code: "W3042", start: 24, length: 30 },
      { code: "W3624", start: 54, length: 36 },
      { code: "W3042", start: 90, length: 30 },
      { code: "DCW2442", start: 120, length: 24 },
    ]);
    expect(cabinetRuns(backBase)).toEqual([
      { code: "DCB36", start: 0, length: 36 },
      { code: "B18", start: 36, length: 18 },
      { code: "SB36", start: 54, length: 36 },
      { code: "B18", start: 90, length: 18 },
      { code: "DCB36", start: 108, length: 36 },
    ]);
    expect(cabinetRuns(leftWall)).toEqual([
      { code: "DCW2442", start: 0, length: 24 },
      { code: "W3042", start: 24, length: 30 },
    ]);
    expect(cabinetRuns(leftBase)).toEqual([
      { code: "DCB36", start: 0, length: 36 },
      { code: "B18", start: 36, length: 18 },
    ]);
    expect(cabinetRuns(rightWall)).toEqual([
      { code: "DCW2442", start: 0, length: 24 },
      { code: "W3042", start: 24, length: 30 },
    ]);
    expect(cabinetRuns(rightBase)).toEqual([
      { code: "DCB36", start: 0, length: 36 },
      { code: "B18", start: 36, length: 18 },
    ]);

    for (const chain of [backWall, backBase, leftWall, leftBase, rightWall, rightBase]) {
      expectChainAddsUp(chain, chain.wallId === "top" ? 144 : 96);
    }
    expect(backWall.segments[0]).toMatchObject({ kind: "cabinet", masterCode: "DCW2442" });
    expect(backWall.segments.at(-1)).toMatchObject({ kind: "cabinet", masterCode: "DCW2442" });
    expect(backBase.segments[0]).toMatchObject({ kind: "cabinet", masterCode: "DCB36" });
    expect(backBase.segments.at(-1)).toMatchObject({ kind: "cabinet", masterCode: "DCB36" });
    expect(leftWall.segments[0]).toMatchObject({ kind: "cabinet", masterCode: "DCW2442" });
    expect(rightWall.segments[0]).toMatchObject({ kind: "cabinet", masterCode: "DCW2442" });
  });

  it("measures the single corner of an L-kitchen on both walls", () => {
    const cabinets = [
      cornerCabinet(lKitchen, "dcw", "DCW2442", 24, "wall", "top", "start"),
      straightCabinet(lKitchen, "back-w30", "W3042", 30, "wall", "top", 24),
      straightCabinet(lKitchen, "left-w30", "W3042", 30, "wall", "left", 24),
      cornerCabinet(lKitchen, "dcb", "DCB36", 36, "base", "top", "start"),
      straightCabinet(lKitchen, "back-b18", "B18", 18, "base", "top", 36),
      straightCabinet(lKitchen, "left-b18", "B18", 18, "base", "left", 36),
    ];

    const backWall = chainFor(lKitchen, cabinets, "top", "wall");
    const backBase = chainFor(lKitchen, cabinets, "top", "base");
    const leftWall = chainFor(lKitchen, cabinets, "left", "wall");
    const leftBase = chainFor(lKitchen, cabinets, "left", "base");

    expect(cabinetRuns(backWall)).toEqual([
      { code: "DCW2442", start: 0, length: 24 },
      { code: "W3042", start: 24, length: 30 },
    ]);
    expect(cabinetRuns(backBase)).toEqual([
      { code: "DCB36", start: 0, length: 36 },
      { code: "B18", start: 36, length: 18 },
    ]);
    expect(cabinetRuns(leftWall)).toEqual([
      { code: "DCW2442", start: 0, length: 24 },
      { code: "W3042", start: 24, length: 30 },
    ]);
    expect(cabinetRuns(leftBase)).toEqual([
      { code: "DCB36", start: 0, length: 36 },
      { code: "B18", start: 36, length: 18 },
    ]);
    for (const chain of [backWall, backBase, leftWall, leftBase]) {
      expectChainAddsUp(chain, chain.wallId === "top" ? 120 : 96);
    }
    expect(floorPlanWallDimensionChains(lKitchen, cabinets).some((chain) => chain.wallId === "right")).toBe(false);
  });

  it("uses catalog footprints for an easy-reach corner, a blind corner, and a 45-degree wall", () => {
    const erb = cornerCabinet(lKitchen, "erb", "ERB33", 33, "base", "top", "start", "l-shape");
    const besideErb = straightCabinet(lKitchen, "beside-erb", "B18", 18, "base", "top", 33);
    const returnErb = straightCabinet(lKitchen, "return-erb", "B15", 15, "base", "left", 33);
    const erbChains = [erb, besideErb, returnErb];
    expect(cabinetRuns(chainFor(lKitchen, erbChains, "top", "base"))).toEqual([
      { code: "ERB33", start: 0, length: 33 },
      { code: "B18", start: 33, length: 18 },
    ]);
    expect(cabinetRuns(chainFor(lKitchen, erbChains, "left", "base"))).toEqual([
      { code: "ERB33", start: 0, length: 33 },
      { code: "B15", start: 33, length: 15 },
    ]);

    const blind = cornerCabinet(lKitchen, "bbc", "BBC36", 36, "base", "top", "start", "blind-corner");
    const besideBlind = straightCabinet(lKitchen, "beside-bbc", "B24", 24, "base", "top", 36);
    const returnBlind = straightCabinet(lKitchen, "return-bbc", "B18", 18, "base", "left", 24);
    const blindChains = [blind, besideBlind, returnBlind];
    expect(cabinetRuns(chainFor(lKitchen, blindChains, "top", "base"))).toEqual([
      { code: "BBC36", start: 0, length: 36 },
      { code: "B24", start: 36, length: 24 },
    ]);
    expect(cabinetRuns(chainFor(lKitchen, blindChains, "left", "base"))).toEqual([
      { code: "BBC36", start: 0, length: 24 },
      { code: "B18", start: 24, length: 18 },
    ]);

    const angled: RoomData = {
      width: 220,
      depth: 220,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "corner", x: 20, y: 20 },
        { id: "east", x: 120, y: 120 },
        { id: "north", x: -80, y: 120 },
      ],
      customWalls: [
        { id: "east-wall", startVertexId: "corner", endVertexId: "east", label: "45 degree wall" },
        { id: "north-wall", startVertexId: "corner", endVertexId: "north", label: "return wall" },
      ],
    };
    const diagonal = cornerCabinet(angled, "angled-dcw", "DCW2442", 24, "wall", "east-wall" as WallSide, "start");
    const angledBase = cornerCabinet(angled, "angled-dcb", "DCB36", 36, "base", "east-wall" as WallSide, "start");
    const eastUpper = straightCabinet(angled, "east-w30", "W3042", 30, "wall", "east-wall" as WallSide, 24);
    const eastBase = straightCabinet(angled, "east-b18", "B18", 18, "base", "east-wall" as WallSide, 36);
    const angledCabinets = [diagonal, angledBase, eastUpper, eastBase];
    const eastLength = Math.hypot(100, 100);
    const wallChain = chainFor(angled, angledCabinets, "east-wall", "wall");
    const baseChain = chainFor(angled, angledCabinets, "east-wall", "base");
    const returnWall = chainFor(angled, angledCabinets, "north-wall", "wall");
    const returnBase = chainFor(angled, angledCabinets, "north-wall", "base");
    expect(cabinetRuns(wallChain)).toEqual([
      { code: "DCW2442", start: 0, length: 24 },
      { code: "W3042", start: 24, length: 30 },
    ]);
    expect(cabinetRuns(baseChain)).toEqual([
      { code: "DCB36", start: 0, length: 36 },
      { code: "B18", start: 36, length: 18 },
    ]);
    expect(cabinetRuns(returnWall)).toEqual([{ code: "DCW2442", start: 0, length: 24 }]);
    expect(cabinetRuns(returnBase)).toEqual([{ code: "DCB36", start: 0, length: 36 }]);
    for (const chain of [wallChain, baseChain, returnWall, returnBase]) {
      expectChainAddsUp(chain, eastLength);
    }
  });

  it("leaves an ordinary cabinet on its own wall", () => {
    const ordinary = straightCabinet(uKitchen, "plain", "B24", 24, "base", "top", 0);
    const chains = floorPlanWallDimensionChains(uKitchen, [ordinary]);
    expect(chains.map((chain) => chain.wallId)).toEqual(["top"]);
    expect(cabinetRuns(chains[0]!)).toEqual([{ code: "B24", start: 0, length: 24 }]);
    expectChainAddsUp(chains[0]!, 144);
  });
});
