import { describe, it, expect } from "vitest";
import {
  rectToPolygon,
  wallSegmentLength,
  wallMidpoint,
  polygonBounds,
  polygonArea,
  isClockwise,
  splitWall,
  moveVertex,
  normalizeVertices,
  pointInPolygon,
  closestWall,
  positionAlongWall,
  isLocked45Wall,
  lockWallToAngle,
  snapWallEndpointNear45,
  applyCompassWallEdit,
  mergeWalls,
  verticesToSvgPath,
  appendWallBuilderSegment,
  checkWallBuilderClosure,
  deleteCustomWallSegment,
  wallBuilderGeometry,
  wallBuilderMetrics,
  wallBuilderRoomGeometry,
  miteredWallOutlines,
  miteredWallOutlinesFromInteriorFaces,
  ROOM_WALL_THICKNESS_IN,
} from "./polygonRoom";

describe("polygonRoom", () => {

  describe("mitered wall outlines", () => {
    it("shares exact 45° and 135° offset-line corners without separate wall caps", () => {
      const outlines = miteredWallOutlines([
        { id: "straight", start: { x: 0, y: 0 }, end: { x: 96, y: 0 } },
        { id: "wall-45", start: { x: 96, y: 0 }, end: { x: 144, y: 48 } },
        { id: "wall-135", start: { x: 144, y: 48 }, end: { x: 96, y: 96 } },
      ], ROOM_WALL_THICKNESS_IN, false);

      expect(outlines).toHaveLength(3);
      expect(outlines[0]!.miteredEnd).toBe(true);
      expect(outlines[1]!.miteredStart).toBe(true);
      expect(outlines[1]!.miteredEnd).toBe(true);
      expect(outlines[2]!.miteredStart).toBe(true);
      // The two physical faces meet at the same calculated miter vertices;
      // no rounded cap or rectangular overlap is left at either corner.
      expect(outlines[0]!.corners[1]).toEqual(outlines[1]!.corners[0]);
      expect(outlines[0]!.corners[2]).toEqual(outlines[1]!.corners[3]);
      expect(outlines[1]!.corners[1]).toEqual(outlines[2]!.corners[0]);
      expect(outlines[1]!.corners[2]).toEqual(outlines[2]!.corners[3]);
    });

    it("keeps intentional open-wall ends square while mitering their connected joint", () => {
      const outlines = miteredWallOutlines([
        { id: "first", start: { x: 0, y: 0 }, end: { x: 72, y: 0 } },
        { id: "second", start: { x: 72, y: 0 }, end: { x: 108, y: 36 } },
      ], ROOM_WALL_THICKNESS_IN, false);

      expect(outlines[0]!.miteredStart).toBe(false);
      expect(outlines[1]!.miteredEnd).toBe(false);
      expect(outlines[0]!.corners[0].x).toBeCloseTo(0);
      expect(outlines[0]!.corners[3].x).toBeCloseTo(0);
      const [endLeft, endRight] = [outlines[1]!.corners[1], outlines[1]!.corners[2]];
      expect((endLeft.x + endRight.x) / 2).toBeCloseTo(108);
      expect((endLeft.y + endRight.y) / 2).toBeCloseTo(36);
      // The free cap is perpendicular to the 45° centre line: no rounded end.
      expect((endLeft.x - endRight.x) * 36 + (endLeft.y - endRight.y) * 36).toBeCloseTo(0);
      expect(outlines[0]!.corners[1]).toEqual(outlines[1]!.corners[0]);
    });

    it("keeps the authored room-facing wall face flush while extending the structural thickness outward", () => {
      const outlines = miteredWallOutlinesFromInteriorFaces([
        { id: "straight", start: { x: 0, y: 0 }, end: { x: 96, y: 0 }, interiorOnLeft: true },
        { id: "wall-45", start: { x: 96, y: 0 }, end: { x: 144, y: 48 }, interiorOnLeft: true },
      ], ROOM_WALL_THICKNESS_IN, false);

      // The left face is the user-measured interior surface. Cabinet backs are
      // placed on these exact coordinates, rather than halfway through a wall.
      expect(outlines[0]!.corners[0]).toEqual({ x: 0, y: 0 });
      expect(outlines[0]!.corners[1]).toEqual({ x: 96, y: 0 });
      expect(outlines[1]!.corners[0]).toEqual({ x: 96, y: 0 });
      expect(outlines[1]!.corners[1]).toEqual({ x: 144, y: 48 });
      // The outer faces still form one mitered structural joint, not separate
      // capped boxes at the 45-degree turn.
      expect(outlines[0]!.corners[2]).toEqual(outlines[1]!.corners[3]);
      expect(outlines[0]!.miteredEnd).toBe(true);
      expect(outlines[1]!.miteredStart).toBe(true);
      expect(outlines[0]!.corners[3].y).toBeCloseTo(-ROOM_WALL_THICKNESS_IN);
    });
  });

  describe("rectToPolygon", () => {
    it("creates 4 vertices and 4 walls for a rectangle", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      expect(vertices).toHaveLength(4);
      expect(customWalls).toHaveLength(4);
      // Verify corners
      expect(vertices[0]).toMatchObject({ x: 0, y: 0 });
      expect(vertices[1]).toMatchObject({ x: 120, y: 0 });
      expect(vertices[2]).toMatchObject({ x: 120, y: 96 });
      expect(vertices[3]).toMatchObject({ x: 0, y: 96 });
    });

    it("walls connect vertices in order", () => {
      const { vertices, customWalls } = rectToPolygon(100, 80);
      // Back wall: v0 → v1
      expect(customWalls[0].startVertexId).toBe(vertices[0].id);
      expect(customWalls[0].endVertexId).toBe(vertices[1].id);
      // Right wall: v1 → v2
      expect(customWalls[1].startVertexId).toBe(vertices[1].id);
      expect(customWalls[1].endVertexId).toBe(vertices[2].id);
      // Front wall: v2 → v3
      expect(customWalls[2].startVertexId).toBe(vertices[2].id);
      expect(customWalls[2].endVertexId).toBe(vertices[3].id);
      // Left wall: v3 → v0
      expect(customWalls[3].startVertexId).toBe(vertices[3].id);
      expect(customWalls[3].endVertexId).toBe(vertices[0].id);
    });
  });

  describe("wallSegmentLength", () => {
    it("returns correct length for horizontal wall", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      // Back wall (top): 120 inches
      expect(wallSegmentLength(customWalls[0], vertices)).toBeCloseTo(120);
      // Right wall: 96 inches
      expect(wallSegmentLength(customWalls[1], vertices)).toBeCloseTo(96);
    });
  });

  describe("wallMidpoint", () => {
    it("returns the midpoint of a wall", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const mid = wallMidpoint(customWalls[0], vertices);
      expect(mid.x).toBeCloseTo(60);
      expect(mid.y).toBeCloseTo(0);
    });
  });

  describe("polygonBounds", () => {
    it("computes bounding box", () => {
      const { vertices } = rectToPolygon(120, 96);
      const bounds = polygonBounds(vertices);
      expect(bounds.width).toBe(120);
      expect(bounds.height).toBe(96);
      expect(bounds.minX).toBe(0);
      expect(bounds.minY).toBe(0);
    });
  });

  describe("polygonArea", () => {
    it("computes area of a rectangle", () => {
      const { vertices } = rectToPolygon(120, 96);
      expect(polygonArea(vertices)).toBeCloseTo(120 * 96);
    });
  });

  describe("isClockwise", () => {
    it("rectToPolygon produces clockwise vertices", () => {
      const { vertices } = rectToPolygon(120, 96);
      expect(isClockwise(vertices)).toBe(true);
    });
  });

  describe("splitWall", () => {
    it("splits a wall into two at the midpoint", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const backWallId = customWalls[0].id;
      const result = splitWall(backWallId, vertices, customWalls);

      expect(result.vertices).toHaveLength(5); // 4 + 1 new
      expect(result.customWalls).toHaveLength(5); // 4 - 1 + 2 = 5

      // New vertex is at midpoint of back wall
      const newV = result.vertices.find((v) => v.id === result.newVertexId);
      expect(newV).toBeDefined();
      expect(newV!.x).toBeCloseTo(60);
      expect(newV!.y).toBeCloseTo(0);
    });

    it("new walls connect through the new vertex", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const backWallId = customWalls[0].id;
      const result = splitWall(backWallId, vertices, customWalls);

      // The two new walls should share the new vertex
      const newWalls = result.customWalls.filter(
        (w) => w.startVertexId === result.newVertexId || w.endVertexId === result.newVertexId,
      );
      expect(newWalls).toHaveLength(2);
    });
  });

  describe("moveVertex", () => {
    it("moves a vertex and updates bounding box", () => {
      const { vertices } = rectToPolygon(120, 96);
      // Move top-right corner inward (creating a bump-in)
      const v1Id = vertices[1].id;
      const result = moveVertex(v1Id, 100, 20, vertices);
      const moved = result.vertices.find((v) => v.id === v1Id);
      expect(moved!.x).toBe(100);
      expect(moved!.y).toBe(20);
    });
  });

  describe("normalizeVertices", () => {
    it("shifts vertices so min x/y is at origin", () => {
      const vertices = [
        { id: "a", x: 10, y: 20 },
        { id: "b", x: 50, y: 20 },
        { id: "c", x: 50, y: 60 },
        { id: "d", x: 10, y: 60 },
      ];
      const norm = normalizeVertices(vertices);
      expect(norm[0]).toMatchObject({ x: 0, y: 0 });
      expect(norm[1]).toMatchObject({ x: 40, y: 0 });
    });
  });

  describe("pointInPolygon", () => {
    it("detects point inside rectangle", () => {
      const { vertices } = rectToPolygon(120, 96);
      expect(pointInPolygon(60, 48, vertices)).toBe(true);
    });

    it("detects point outside rectangle", () => {
      const { vertices } = rectToPolygon(120, 96);
      expect(pointInPolygon(200, 48, vertices)).toBe(false);
    });
  });

  describe("closestWall", () => {
    it("finds the nearest wall to a point", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      // Point near the top wall
      const wall = closestWall(60, 2, vertices, customWalls);
      expect(wall).toBeDefined();
      expect(wall!.label).toBe("Back");
    });

    it("finds left wall for point near left edge", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const wall = closestWall(2, 48, vertices, customWalls);
      expect(wall).toBeDefined();
      expect(wall!.label).toBe("Left");
    });
  });

  describe("positionAlongWall", () => {
    it("returns 0 for a point at the start of the wall", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const pos = positionAlongWall(0, 0, customWalls[0], vertices);
      expect(pos).toBeCloseTo(0);
    });

    it("returns wall length for a point at the end", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const pos = positionAlongWall(120, 0, customWalls[0], vertices);
      expect(pos).toBeCloseTo(120);
    });

    it("returns midpoint distance for a point at the middle", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const pos = positionAlongWall(60, 0, customWalls[0], vertices);
      expect(pos).toBeCloseTo(60);
    });
  });

  describe("locked 45-degree wall segments", () => {
    it("sets a selected wall to an exact persisted +45° direction while preserving its length", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const result = lockWallToAngle(customWalls[0].id, 45, vertices, customWalls);
      expect(result).not.toBeNull();
      const wall = result!.customWalls[0];
      const start = result!.vertices.find((vertex) => vertex.id === wall.startVertexId)!;
      const end = result!.vertices.find((vertex) => vertex.id === wall.endVertexId)!;
      expect(isLocked45Wall(wall)).toBe(true);
      expect(Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI).toBeCloseTo(45, 3);
      expect(wallSegmentLength(wall, result!.vertices)).toBeCloseTo(120, 1);
    });

    it("supports the mirrored -45° direction without introducing a free-form angle", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const result = lockWallToAngle(customWalls[0].id, -45, vertices, customWalls);
      expect(result).not.toBeNull();
      const wall = result!.customWalls[0];
      const start = result!.vertices.find((vertex) => vertex.id === wall.startVertexId)!;
      const end = result!.vertices.find((vertex) => vertex.id === wall.endVertexId)!;
      expect(wall.lockedAngle).toBe(-45);
      expect(Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI).toBeCloseTo(-45, 3);
    });

    it("snaps a near-diagonal endpoint to the exact supported 45-degree direction", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      const wall = customWalls[0];
      const snapped = snapWallEndpointNear45(wall, wall.endVertexId, { x: 53, y: 58 }, vertices);
      expect(snapped).toEqual({ x: 54, y: 54, lockedAngle: 45 });
      expect(snapWallEndpointNear45(wall, wall.endVertexId, { x: 72, y: 30 }, vertices)).toBeNull();
    });

    it("inserts one +45° end-corner transition while retaining the selected wall envelope and adjoining wall", () => {
      const { vertices, customWalls } = rectToPolygon(144, 120);
      const result = applyCompassWallEdit(customWalls[0].id, {
        angle: 45,
        angleStartIn: 120,
        lengthIn: 144,
        heightIn: 84,
      }, vertices, customWalls);
      expect(result).not.toBeNull();
      const approach = result!.customWalls.find((wall) => wall.id === customWalls[0].id)!;
      const edited = result!.customWalls.find((wall) => wall.id === result!.editedWallId)!;
      expect(wallSegmentLength(approach, result!.vertices)).toBeCloseTo(120, 3);
      expect(edited.lockedAngle).toBe(45);
      expect(edited.height).toBe(84);
      expect(wallSegmentLength(edited, result!.vertices)).toBeCloseTo(Math.sqrt(24 ** 2 + 24 ** 2), 2);
      const start = result!.vertices.find((vertex) => vertex.id === edited.startVertexId)!;
      const end = result!.vertices.find((vertex) => vertex.id === edited.endVertexId)!;
      expect(Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI).toBeCloseTo(45, 3);
      expect(result!.customWalls).toHaveLength(5);
      const adjoining = result!.customWalls.find((wall) => wall.id === customWalls[1].id)!;
      expect(wallSegmentLength(adjoining, result!.vertices)).toBeCloseTo(96, 2);
    });

    it("limits an angled Compass corner to the selected wall’s original span", () => {
      const { vertices, customWalls } = rectToPolygon(144, 120);
      const result = applyCompassWallEdit(customWalls[0].id, {
        angle: 45,
        angleStartIn: 36,
        lengthIn: 144,
        heightIn: 96,
      }, vertices, customWalls);
      expect(result).not.toBeNull();
      const edited = result!.customWalls.find((wall) => wall.id === result!.editedWallId)!;
      expect(wallSegmentLength(edited, result!.vertices)).toBeCloseTo(Math.sqrt(108 ** 2 + 108 ** 2), 1);
      const approach = result!.customWalls.find((wall) => wall.id === customWalls[0].id)!;
      expect(wallSegmentLength(approach, result!.vertices)).toBeCloseTo(36, 1);
    });

    it("restores a Compass 90° edit to a cardinal wall direction and clears a prior diagonal lock", () => {
      const { vertices, customWalls } = rectToPolygon(144, 120);
      const locked = lockWallToAngle(customWalls[0].id, -45, vertices, customWalls)!;
      const result = applyCompassWallEdit(locked.customWalls[0].id, {
        angle: 90,
        angleStartIn: 0,
        lengthIn: 72,
        heightIn: 96,
      }, locked.vertices, locked.customWalls);
      expect(result).not.toBeNull();
      expect(result!.customWalls[0].lockedAngle).toBeUndefined();
      expect(result!.customWalls[0].height).toBe(96);
      expect(wallSegmentLength(result!.customWalls[0], result!.vertices)).toBeCloseTo(72, 3);
      const start = result!.vertices.find((vertex) => vertex.id === result!.customWalls[0].startVertexId)!;
      const end = result!.vertices.find((vertex) => vertex.id === result!.customWalls[0].endVertexId)!;
      expect(Math.abs(Math.sin(Math.atan2(end.y - start.y, end.x - start.x)))).toBeLessThan(0.001);
    });
  });

  describe("mergeWalls", () => {
    it("merges two adjacent walls back into one", () => {
      const { vertices, customWalls } = rectToPolygon(120, 96);
      // Split the back wall first
      const split = splitWall(customWalls[0].id, vertices, customWalls);
      // Now merge the two new walls back
      const newWall1 = split.customWalls[0]; // first half
      const newWall2 = split.customWalls[1]; // second half

      const result = mergeWalls(newWall1.id, newWall2.id, split.vertices, split.customWalls);
      expect(result).not.toBeNull();
      expect(result!.vertices).toHaveLength(4); // back to original
      expect(result!.customWalls).toHaveLength(4); // back to original
    });
  });

  describe("verticesToSvgPath", () => {
    it("generates valid SVG path", () => {
      const { vertices } = rectToPolygon(120, 96);
      const path = verticesToSvgPath(vertices, 4); // 4 ppi
      expect(path).toContain("M 0 0");
      expect(path).toContain("L 480 0");
      expect(path).toContain("Z");
    });
  });

  describe("continuous Wall Builder", () => {
    it("draws exact measured 90-degree walls and closes a rectangle", () => {
      let segments = appendWallBuilderSegment([], 120, "start");
      segments = appendWallBuilderSegment(segments, 96, "right90");
      segments = appendWallBuilderSegment(segments, 120, "right90");
      segments = appendWallBuilderSegment(segments, 96, "right90");

      const geometry = wallBuilderGeometry(segments);
      expect(geometry).toMatchObject({ closed: true, error: null });
      expect(geometry.points.at(-1)).toMatchObject({ x: 0, y: 0 });

      const result = wallBuilderRoomGeometry(segments, 96);
      expect(result.error).toBeNull();
      expect(result.room).not.toBeNull();
      expect(result.room!.vertices).toHaveLength(4);
      expect(result.room!.customWalls).toHaveLength(4);
      expect(result.room).toMatchObject({ width: 120, depth: 96, openWallPath: false });
      expect(result.room!.customWalls.map((wall) => wall.label)).toEqual(["Wall 1", "Wall 2", "Wall 3", "Wall 4"]);
      expect(wallBuilderMetrics(segments)).toEqual({ perimeterIn: 432, areaSqFt: 80, closed: true });
    });

    it("uses a clockwise right-turn sequence from Wall 1 and preserves that order in the saved outline", () => {
      let segments = appendWallBuilderSegment([], 120, "start");
      segments = appendWallBuilderSegment(segments, 96, "right90");
      segments = appendWallBuilderSegment(segments, 120, "right90");
      segments = appendWallBuilderSegment(segments, 96, "right90");

      expect(segments.map((segment) => segment.headingDeg)).toEqual([0, 90, 180, 270]);
      const result = wallBuilderRoomGeometry(segments, 96);
      expect(result.room).not.toBeNull();
      expect(isClockwise(result.room!.vertices)).toBe(true);
      expect(result.room!.customWalls.map((wall) => wall.label)).toEqual(["Wall 1", "Wall 2", "Wall 3", "Wall 4"]);
    });

    it("keeps the supplied 101-inch wall and exact 78-inch 45-degree turn", () => {
      let segments = appendWallBuilderSegment([], 101, "start");
      segments = appendWallBuilderSegment(segments, 78, "right45");
      const geometry = wallBuilderGeometry(segments);
      expect(geometry.error).toBeNull();
      expect(segments[1]).toMatchObject({ lengthIn: 78, headingDeg: 45, turn: "right45" });
      expect(Math.hypot(
        geometry.points[2].x - geometry.points[1].x,
        geometry.points[2].y - geometry.points[1].y,
      )).toBeCloseTo(78, 3);
      expect(Math.abs(geometry.points[2].x - geometry.points[1].x)).toBeCloseTo(Math.abs(geometry.points[2].y - geometry.points[1].y), 3);
      expect(wallBuilderMetrics(segments)).toEqual({ perimeterIn: 179, areaSqFt: null, closed: false });
    });

    it("deletes only Wall 4 and preserves every other measured wall", () => {
      let segments = appendWallBuilderSegment([], 120, "start");
      segments = appendWallBuilderSegment(segments, 96, "right90");
      segments = appendWallBuilderSegment(segments, 60, "left45");
      segments = appendWallBuilderSegment(segments, 48, "right45");
      segments = appendWallBuilderSegment(segments, 72, "left90");
      segments = appendWallBuilderSegment(segments, 36, "right45");
      const built = wallBuilderRoomGeometry(segments, 108).room!;
      const wall4 = built.customWalls[3];
      const originalById = new Map(built.customWalls.map((wall) => [wall.id, {
        wall,
        length: wallSegmentLength(wall, built.vertices),
      }]));
      const deleted = deleteCustomWallSegment(wall4.id, built.vertices, built.customWalls);

      expect(deleted).not.toBeNull();
      expect(deleted!.openWallPath).toBe(true);
      expect(deleted!.customWalls).toHaveLength(5);
      expect(deleted!.customWalls.some((wall) => wall.id === wall4.id || wall.label === "Wall 4")).toBe(false);
      for (const wall of deleted!.customWalls) {
        const original = originalById.get(wall.id)!;
        expect(wall).toEqual(original.wall);
        expect(wallSegmentLength(wall, deleted!.vertices)).toBeCloseTo(original.length, 3);
      }
    });

    it("applies an open connected path with only the walls entered by the user", () => {
      let segments = appendWallBuilderSegment([], 101, "start");
      segments = appendWallBuilderSegment(segments, 78, "right45");
      const result = wallBuilderRoomGeometry(segments, 96);
      expect(result.error).toBeNull();
      expect(result.room).toMatchObject({ openWallPath: true });
      expect(result.room!.vertices).toHaveLength(3);
      expect(result.room!.customWalls).toHaveLength(2);
      expect(wallSegmentLength(result.room!.customWalls[0], result.room!.vertices)).toBeCloseTo(101, 3);
      expect(wallSegmentLength(result.room!.customWalls[1], result.room!.vertices)).toBeCloseTo(78, 3);
    });

    it("lets an open-path wall be resized later without changing downstream wall lengths", () => {
      let segments = appendWallBuilderSegment([], 101, "start");
      segments = appendWallBuilderSegment(segments, 78, "right45");
      segments = appendWallBuilderSegment(segments, 60, "right90");
      const built = wallBuilderRoomGeometry(segments, 96).room!;
      const edited = applyCompassWallEdit(built.customWalls[0].id, {
        angleStartIn: 0,
        lengthIn: 120,
        angle: 90,
        heightIn: 96,
      }, built.vertices, built.customWalls)!;

      expect(edited).not.toBeNull();
      const editedLengths = edited.customWalls.map((wall) => wallSegmentLength(wall, edited.vertices));
      expect(editedLengths[0]).toBeCloseTo(120, 3);
      expect(editedLengths[1]).toBeCloseTo(78, 3);
      expect(editedLengths[2]).toBeCloseTo(60, 3);
      expect(edited.customWalls[0].endVertexId).toBe(edited.customWalls[1].startVertexId);
      expect(edited.customWalls[1].endVertexId).toBe(edited.customWalls[2].startVertexId);
    });

    it("reports an open room without adding or changing a wall", () => {
      let segments = appendWallBuilderSegment([], 120, "start");
      segments = appendWallBuilderSegment(segments, 96, "right90");
      const result = checkWallBuilderClosure(segments);
      expect(result.closed).toBe(false);
      expect(result.error).toContain("Enter at least three measured walls");
      expect(segments).toHaveLength(2);
    });

    it("rejects a self-crossing room outline", () => {
      const bowTie = [
        { lengthIn: Math.sqrt(100 ** 2 + 100 ** 2), headingDeg: 45, turn: "start" as const },
        { lengthIn: 100, headingDeg: 180, turn: "right90" as const },
        { lengthIn: Math.sqrt(100 ** 2 + 100 ** 2), headingDeg: 315, turn: "right90" as const },
        { lengthIn: 100, headingDeg: 180, turn: "right90" as const },
      ];
      expect(wallBuilderGeometry(bowTie).error).toContain("crosses another wall");
      expect(wallBuilderRoomGeometry(bowTie).room).toBeNull();
    });

    it("rounds typed measurements to the nearest eighth inch", () => {
      const segments = appendWallBuilderSegment([], 101.07, "start");
      expect(segments[0].lengthIn).toBe(101.125);
    });
  });
});
