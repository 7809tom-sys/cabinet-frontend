import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  threeDBacksplashPlaneReversed,
  threeDBacksplashPlaneUv,
  threeDBacksplashSegments,
  threeDBacksplashTakeoffSqFt,
  threeDBacksplashTransform,
  threeDRenderedBacksplashSegments,
  threeDRenderPlacements,
  type ThreeDBacksplashSegment,
} from "./InteractiveRoom3D";
import { roomWallRunFrames, wallPlacementAt, wallRunFrame, type PlacedCabinet, type RoomData } from "@/lib/design";

/** Back wall, a 45-degree wall, then a vertical drawn right wall (like the angledRoom() fixture). */
function angledRoom(): RoomData {
  return {
    width: 220,
    depth: 200,
    ceilingHeight: 96,
    openWallPath: true,
    vertices: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 144, y: 0 },
      { id: "c", x: 204, y: 60 },
      { id: "d", x: 204, y: 200 },
    ],
    customWalls: [
      { id: "straight", label: "Wall 1", startVertexId: "a", endVertexId: "b" },
      { id: "angled", label: "Wall 2", startVertexId: "b", endVertexId: "c", lockedAngle: 45 },
      { id: "side", label: "Wall 3", startVertexId: "c", endVertexId: "d" },
    ],
  } as RoomData;
}

/** Same walls walked the other way, so the inward normal is the other side of travel. */
function reversedRoom(): RoomData {
  const room = angledRoom();
  return {
    ...room,
    customWalls: [
      { id: "straight", label: "Wall 1", startVertexId: "b", endVertexId: "a" },
      { id: "angled", label: "Wall 2", startVertexId: "c", endVertexId: "b" },
      { id: "side", label: "Wall 3", startVertexId: "d", endVertexId: "c" },
    ],
  } as RoomData;
}

/** A diamond room: four drawn walls at 45/135/225/315 degrees. */
function diamondRoom(): RoomData {
  return {
    width: 200,
    depth: 200,
    ceilingHeight: 96,
    vertices: [
      { id: "n", x: 100, y: 0 },
      { id: "e", x: 200, y: 100 },
      { id: "s", x: 100, y: 200 },
      { id: "w", x: 0, y: 100 },
    ],
    customWalls: [
      { id: "ne", startVertexId: "n", endVertexId: "e" },
      { id: "se", startVertexId: "e", endVertexId: "s" },
      { id: "sw", startVertexId: "s", endVertexId: "w" },
      { id: "nw", startVertexId: "w", endVertexId: "n" },
    ],
  } as RoomData;
}

/** World-space normal of a PlaneGeometry front face after the backsplash rotation. */
function planeNormal(rotation: number) {
  const object = new THREE.Object3D();
  object.rotation.y = rotation;
  object.updateMatrixWorld(true);
  return new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion);
}

function planeAxisX(rotation: number) {
  const object = new THREE.Object3D();
  object.rotation.y = rotation;
  object.updateMatrixWorld(true);
  return new THREE.Vector3(1, 0, 0).applyQuaternion(object.quaternion);
}

function segmentOn(side: string, start = 10, end = 40): ThreeDBacksplashSegment {
  return { side, start, end, bottom: 36, top: 54 } as ThreeDBacksplashSegment;
}

function place(uid: string, masterCode: string, description: string, placement: PlacedCabinet["placement"], width: number, depth: number, wallId: string, wallOffset: number, room: RoomData): PlacedCabinet {
  return {
    uid,
    cabinetId: 0,
    masterCode,
    description,
    placement,
    width,
    depth,
    height: placement === "appliance" ? 36 : 34.5,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    ...wallPlacementAt(wallOffset, width, depth, wallId, room),
    wallId,
    wallOffset,
  } as PlacedCabinet;
}

describe("backsplash faces the room on drawn and 45-degree walls", () => {
  it("points the tile's front face into the room for every drawn-wall facing", () => {
    const facings = new Set<number>();
    for (const room of [angledRoom(), reversedRoom(), diamondRoom()]) {
      for (const frame of roomWallRunFrames(room)) {
        const transform = threeDBacksplashTransform(segmentOn(frame.id), room);
        const normal = planeNormal(transform.rotation);
        const dot = normal.x * frame.inward.x + normal.z * frame.inward.y;
        expect(dot, `${frame.id} facing ${frame.facingRotation}`).toBeGreaterThan(0.999);
        facings.add(frame.facingRotation);
      }
    }
    for (const facing of [0, 90, 180, 270, 45, 135]) expect(facings.has(facing), `facing ${facing}`).toBe(true);
  });

  it("is exactly square to a 45-degree wall, not edge-on", () => {
    const room = angledRoom();
    const frame = wallRunFrame("angled", room)!;
    const normal = planeNormal(threeDBacksplashTransform(segmentOn("angled"), room).rotation);
    expect(normal.x * frame.tangent.x + normal.z * frame.tangent.y).toBeCloseTo(0, 9);
    expect(normal.x * frame.inward.x + normal.z * frame.inward.y).toBeCloseTo(1, 9);
  });

  it("leaves the four standard walls exactly as before", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    expect(threeDBacksplashTransform(segmentOn("top"), room).rotation).toBe(0);
    expect(threeDBacksplashTransform(segmentOn("bottom"), room).rotation).toBe(Math.PI);
    expect(threeDBacksplashTransform(segmentOn("left"), room).rotation).toBe(Math.PI / 2);
    expect(threeDBacksplashTransform(segmentOn("right"), room).rotation).toBe(-Math.PI / 2);
    for (const side of ["top", "bottom", "left", "right"]) {
      const frame = wallRunFrame(side, room)!;
      const normal = planeNormal(threeDBacksplashTransform(segmentOn(side), room).rotation);
      expect(normal.x * frame.inward.x + normal.z * frame.inward.y).toBeCloseTo(1, 9);
    }
  });

  it("tiles the range on the 45-degree wall and the sink on the right wall, and bills exactly what it tiles", () => {
    const room = angledRoom();
    const placed = [
      place("b30", "B30", "30 inch Base", "base", 30, 24, "straight", 40, room),
      place("range", "RANGE-30", '30" Freestanding Range', "appliance", 30, 25, "angled", 27, room),
      place("b18", "B18", "18 inch Base", "base", 18, 24, "angled", 57, room),
      place("sb36", "SB36", "36 inch Sink Base", "base", 36, 24, "side", 40, room),
      place("b12", "B12", "12 inch Base", "base", 12, 24, "side", 76, room),
    ];
    const segments = threeDRenderedBacksplashSegments(placed, [], room);
    const on = (side: string) => segments.filter((segment) => segment.side === side);
    const covers = (side: string, start: number, end: number) =>
      on(side).some((segment) => segment.start <= start + 0.01 && segment.end >= end - 0.01);
    expect(covers("angled", 27, 57)).toBe(true);
    expect(covers("side", 40, 76)).toBe(true);
    expect(covers("straight", 40, 70)).toBe(true);
    // Every rendered segment faces the room, so none is a hidden, billed-only tile.
    for (const segment of segments) {
      const frame = wallRunFrame(segment.side, room)!;
      const normal = planeNormal(threeDBacksplashTransform(segment, room).rotation);
      expect(normal.x * frame.inward.x + normal.z * frame.inward.y).toBeGreaterThan(0.999);
    }
    // The renderer tiles threeDBacksplashSegments(threeDRenderPlacements(placed)); the takeoff uses the same list.
    const rendered = threeDBacksplashSegments(threeDRenderPlacements(placed, room, []), [], room);
    expect(segments).toEqual(rendered);
    const renderedSqFt = Math.round(rendered.reduce((sum, s) => sum + ((s.end - s.start) * (s.top - s.bottom)) / 144, 0) * 10) / 10;
    expect(threeDBacksplashTakeoffSqFt(segments)).toBe(renderedSqFt);
    expect(renderedSqFt).toBeGreaterThan(0);
  });

  it("does not bill tile beside a filler the 3D view drops", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    const placed = [
      place("b30", "B30", "30 inch Base", "base", 30, 24, "top", 40, room),
      place("bf3", "BF3", '3" Base Filler', "base", 3, 24, "top", 70, room),
    ];
    const rendered = threeDBacksplashSegments(threeDRenderPlacements(placed, room, []), [], room);
    // The raw plan list still has the filler; the renderer removes it, so no tile is drawn there.
    expect(threeDBacksplashTakeoffSqFt(threeDBacksplashSegments(placed, [], room)))
      .toBeGreaterThan(threeDBacksplashTakeoffSqFt(rendered));
    expect(threeDRenderedBacksplashSegments(placed, [], room)).toEqual(rendered);
  });

  it("anchors mosaic tile counts at the run start on every drawn wall", () => {
    const moduleIn = 12;
    for (const room of [angledRoom(), reversedRoom(), diamondRoom()]) {
      for (const frame of roomWallRunFrames(room)) {
        const segment = segmentOn(frame.id, 10, 40);
        const transform = threeDBacksplashTransform(segment, room);
        const axis = planeAxisX(transform.rotation);
        const reversed = threeDBacksplashPlaneReversed(frame.id, room);
        for (const planeU of [0, 0.5, 1]) {
          // World point on the plane at this U, measured back along the wall from its start.
          const local = (planeU - 0.5) * (segment.end - segment.start);
          const worldX = transform.x + axis.x * local;
          const worldZ = transform.z + axis.z * local;
          const along = (worldX - frame.start.x) * frame.tangent.x + (worldZ - frame.start.y) * frame.tangent.y;
          const uv = threeDBacksplashPlaneUv(segment, planeU, 0, segment.start, segment.end, moduleIn, moduleIn, undefined, reversed);
          expect(uv.u * moduleIn, `${frame.id} u=${planeU}`).toBeCloseTo(along, 6);
        }
      }
    }
  });
});
