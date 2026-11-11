import { describe, expect, it } from "vitest";
import { existingCabinetTransform } from "@/components/design/InteractiveRoom3D";
import { buildMandatoryAutoDesignRefrigeratorBay } from "./autoDesignRefrigeratorBay";
import { normalizeRefrigeratorBridgeDepth } from "./refrigeratorBridgeDepth";
import {
  cabinetFrontIn,
  syncWallRunOffsets,
  wallPlacementAt,
  wallRunFrame,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function source(overrides: Partial<DesignCabinet>): DesignCabinet {
  return {
    id: 1,
    masterCode: "W3624",
    description: "Refrigerator wall cabinet",
    category: "Wall",
    subCategory: "Refrigerator Cabinet",
    width: "36",
    height: "12",
    depth: "24",
    placement: "wall",
    numberOfDoors: 2,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    ...overrides,
  } as DesignCabinet;
}

const panelRow = source({
  id: 201,
  masterCode: "REP2496",
  description: "Refrigerator End Panel",
  category: "Panel",
  subCategory: "Refrigerator End Panel",
  width: "0.75",
  height: "96",
  depth: "24",
  placement: "tall",
  numberOfDoors: 0,
});

function fridgeOn(side: WallSide, enclosure: RoomData, along = 40): PlacedCabinet {
  const spot = wallPlacementAt(along, 36, 30, side, enclosure);
  return {
    uid: "fridge",
    cabinetId: 100,
    masterCode: "FRIDGE-36",
    description: "36 Refrigerator",
    category: "Appliance",
    placement: "appliance",
    ...spot,
    width: 36,
    depth: 30,
    height: 70,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
  } as PlacedCabinet;
}

/** 3D front distance from the wall, and whether the doors point into the room. */
function sceneFace(item: PlacedCabinet, enclosure: RoomData, wall: string) {
  const frame = wallRunFrame(wall, enclosure)!;
  const transform = existingCabinetTransform(item, enclosure);
  const frontX = Math.sin(transform.rotation);
  const frontZ = Math.cos(transform.rotation);
  const dot = frontX * frame.inward.x + frontZ * frame.inward.y;
  const across = (transform.x - frame.start.x) * frame.inward.x + (transform.z - frame.start.y) * frame.inward.y;
  return {
    front: across + dot * (Number(item.depth) / 2),
    facingForward: dot > 0.9,
    wallId: item.wallId ?? null,
  };
}

function expectFlushAndForward(placed: PlacedCabinet[], enclosure: RoomData, wall: string) {
  const synced = syncWallRunOffsets(placed, enclosure);
  const bridge = synced.find((item) => item.refrigeratorAssemblyRole === "bridge");
  const panel = synced.find((item) => item.refrigeratorAssemblyRole === "left-panel" || item.refrigeratorAssemblyRole === "right-panel");
  expect(bridge, wall).toBeTruthy();
  expect(panel, wall).toBeTruthy();
  const panelFront = cabinetFrontIn(panel!, wall, enclosure);
  expect(cabinetFrontIn(bridge!, wall, enclosure)).toBeCloseTo(panelFront, 1);
  expect(bridge!.wallId).toBe(wall);
  const scene = sceneFace(bridge!, enclosure, wall);
  expect(scene.front).toBeCloseTo(panelFront, 1);
  expect(scene.facingForward).toBe(true);
  expect(scene.wallId).toBe(wall);
}

function autoPlaced(wall: WallSide, depth: number, enclosure: RoomData = room): PlacedCabinet[] {
  const bay = buildMandatoryAutoDesignRefrigeratorBay({
    refrigerator: fridgeOn(wall, enclosure),
    room: enclosure,
    caps: [source({ id: depth, masterCode: depth === 24 ? "W362424" : "W3612", depth: String(depth) })],
    endPanels: [panelRow],
    styleId: 1,
    makeUid: (() => { let n = 0; return () => `${wall}-${depth}-${++n}`; })(),
  });
  expect(bay.ok, wall).toBe(true);
  if (!bay.ok) return [];
  return normalizeRefrigeratorBridgeDepth([bay.refrigerator, ...bay.additions], enclosure);
}

function manualPlaced(wall: WallSide, depth: number, enclosure: RoomData = room): PlacedCabinet[] {
  const fridge = fridgeOn(wall, enclosure);
  const spot = wallPlacementAt(40, 36, depth, wall, enclosure);
  const bridge = {
    uid: "manual-bridge",
    cabinetId: 9,
    masterCode: depth === 24 ? "W362424" : "W3612",
    description: "dropped upper",
    placement: "wall" as const,
    ...spot,
    width: 36,
    depth,
    height: 12,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    refrigeratorAssemblyId: fridge.uid,
    refrigeratorAssemblyRole: "bridge" as const,
    mountBottom: 72,
  } as PlacedCabinet;
  const left = wallPlacementAt(39.25, 0.75, 24, wall, enclosure);
  const right = wallPlacementAt(76, 0.75, 24, wall, enclosure);
  const panelAt = (uid: string, role: "left-panel" | "right-panel", at: typeof left): PlacedCabinet => ({
    uid,
    cabinetId: 201,
    masterCode: "REP2496",
    description: "panel",
    placement: "tall",
    ...at,
    width: 0.75,
    depth: 24,
    height: 96,
    rotation: at.rotation,
    wallId: at.wallId,
    wallOffset: at.wallOffset,
    refrigeratorAssemblyId: fridge.uid,
    refrigeratorAssemblyRole: role,
    mountBottom: 0,
  } as PlacedCabinet);
  return normalizeRefrigeratorBridgeDepth([
    fridge,
    bridge,
    panelAt("lp", "left-panel", left),
    panelAt("rp", "right-panel", right),
  ], enclosure);
}

describe("over-fridge cabinet stays flush and faces forward", () => {
  const walls: WallSide[] = ["top", "left", "right"];

  for (const wall of walls) {
    for (const depth of [12, 24]) {
      it(`Auto Design ${wall} wall, ${depth} in deep`, () => {
        expectFlushAndForward(autoPlaced(wall, depth), room, wall);
      });
      it(`manual popup ${wall} wall, ${depth} in deep`, () => {
        expectFlushAndForward(manualPlaced(wall, depth), room, wall);
      });
    }
  }

  it("prefers the 24 in box when the line sells one", () => {
    const bay = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: fridgeOn("right", room),
      room,
      caps: [
        source({ id: 12, masterCode: "W3612", depth: "12" }),
        source({ id: 24, masterCode: "W362424", depth: "24", height: "24" }),
      ],
      endPanels: [panelRow],
      styleId: 1,
      makeUid: () => "prefer-24",
    });
    expect(bay.ok).toBe(true);
    if (!bay.ok) return;
    expect(bay.additions[0].depth).toBe(24);
    expect(bay.additions[0].depthPositionAdjusted).toBeUndefined();
  });

  it("keeps a right-wall 12 in box facing forward even after its wall id was lost", () => {
    const placed = manualPlaced("right", 12);
    const bridge = placed.find((item) => item.refrigeratorAssemblyRole === "bridge")!;
    const stripped = { ...bridge, wallId: undefined, wallOffset: undefined };
    const scene = sceneFace(stripped, room, "right");
    expect(scene.front).toBeCloseTo(24, 1);
    expect(scene.facingForward).toBe(true);
  });
});

describe("over-fridge cabinet on an angled wall", () => {
  const angled: RoomData = {
    width: 220,
    depth: 140,
    ceilingHeight: 96,
    openWallPath: true,
    vertices: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 144, y: 0 },
      { id: "c", x: 204, y: 60 },
    ],
    customWalls: [
      { id: "straight", label: "Wall 1", startVertexId: "a", endVertexId: "b" },
      { id: "angled", label: "Wall 2", startVertexId: "b", endVertexId: "c", lockedAngle: 45 },
    ],
  };

  for (const depth of [12, 24]) {
    it(`Auto Design 45° wall, ${depth} in deep`, () => {
      expectFlushAndForward(autoPlaced("angled" as WallSide, depth, angled), angled, "angled");
    });
    it(`manual popup 45° wall, ${depth} in deep`, () => {
      expectFlushAndForward(manualPlaced("angled" as WallSide, depth, angled), angled, "angled");
    });
  }
});
