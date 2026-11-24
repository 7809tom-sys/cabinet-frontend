import { describe, expect, it } from "vitest";
import { autoDesignCorners, autoDesignShapeLabel, autoDesignWallList, autoDesignFixedShapeFallback } from "./autoDesignWallList";
import { wallPlacementAt, type PlacedCabinet, type RoomData, type WallSide } from "./design";

function fiveWall(): RoomData {
  const L = 138;
  return { width: 204, depth: 210, ceilingHeight: 96, openWallPath: true,
    vertices: [{ id: "v1", x: 0, y: 0 }, { id: "v2", x: L, y: 0 }, { id: "v3", x: L + 66, y: 66 }, { id: "v4", x: L + 66, y: 144 }, { id: "v5", x: L, y: 210 }, { id: "v6", x: 40, y: 210 }],
    customWalls: [
      { id: "top", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
      { id: "angTR", label: "Wall 2", startVertexId: "v2", endVertexId: "v3", lockedAngle: 45 },
      { id: "right", label: "Wall 3", startVertexId: "v3", endVertexId: "v4" },
      { id: "angBR", label: "Wall 4", startVertexId: "v4", endVertexId: "v5", lockedAngle: 45 },
      { id: "bottom", label: "Wall 5", startVertexId: "v5", endVertexId: "v6" },
    ] } as RoomData;
}
function chamferL(): RoomData {
  return { width: 150, depth: 144, ceilingHeight: 96, openWallPath: true,
    vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 120, y: 0 }, { id: "c", x: 150, y: 30 }, { id: "d", x: 150, y: 144 }],
    customWalls: [
      { id: "w1", label: "Wall 1", startVertexId: "a", endVertexId: "b" },
      { id: "w2", label: "Wall 2", startVertexId: "b", endVertexId: "c", lockedAngle: 45 },
      { id: "w3", label: "Wall 3", startVertexId: "c", endVertexId: "d" },
    ] } as RoomData;
}
function plainU(): RoomData {
  return { width: 144, depth: 120, ceilingHeight: 96, openWallPath: true,
    vertices: [{ id: "a", x: 0, y: 120 }, { id: "b", x: 0, y: 0 }, { id: "c", x: 144, y: 0 }, { id: "d", x: 144, y: 120 }],
    customWalls: [
      { id: "u1", label: "Wall 1", startVertexId: "a", endVertexId: "b" },
      { id: "u2", label: "Wall 2", startVertexId: "b", endVertexId: "c" },
      { id: "u3", label: "Wall 3", startVertexId: "c", endVertexId: "d" },
    ] } as RoomData;
}
function cab(room: RoomData, uid: string, wallId: string, offset: number): PlacedCabinet {
  return { uid, cabinetId: 1, masterCode: "B30", description: "B30", placement: "base", width: 30, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 1, numberOfDrawers: 0,
    ...wallPlacementAt(offset, 30, 24, wallId as WallSide, room) } as PlacedCabinet;
}

describe("wall-list shape model", () => {
  it("five walls with an empty Wall 4: all five listed in order, Wall 4 kept as an empty run, 45° turns as corners", () => {
    const room = fiveWall();
    const placed = ["top", "angTR", "right", "bottom"].map((wallId, i) => cab(room, `c${i}`, wallId, 20));
    const list = autoDesignWallList(room, placed);
    expect(list.map((wall) => `${wall.label}:${wall.wallId}`)).toEqual(["Wall 1:top", "Wall 2:angTR", "Wall 3:right", "Wall 4:angBR", "Wall 5:bottom"]);
    expect(list).toHaveLength(5);
    expect(list[3].empty).toBe(true);
    expect(list.filter((wall) => wall.empty)).toHaveLength(1);
    expect(list.slice(0, 4).map((wall) => wall.angleToNextDeg)).toEqual([135, 135, 135, 135]);
    expect(list[4].angleToNextDeg).toBeNull();
    expect(autoDesignShapeLabel(list)).toBe("five-wall U with chamfers");
    expect(autoDesignCorners(room).filter((corner) => corner.inside).map((corner) => corner.turnDeg)).toEqual([45, 45, 45, 45]);
  });

  it("chamfered L reads as an L with a 45° corner", () => {
    const list = autoDesignWallList(chamferL());
    expect(list.map((wall) => wall.angleToNextDeg)).toEqual([135, 135, null]);
    const label = autoDesignShapeLabel(list);
    expect(label).toBe("L with 45° corner");
    expect(autoDesignFixedShapeFallback(label)).toBe("l-shape");
  });

  it("plain U: three walls, two square corners", () => {
    const list = autoDesignWallList(plainU());
    expect(list.map((wall) => wall.angleToNextDeg)).toEqual([90, 90, null]);
    expect(autoDesignShapeLabel(list)).toBe("U-shape");
    expect(autoDesignCorners(plainU()).every((corner) => corner.inside)).toBe(true);
    expect(autoDesignShapeLabel(list.slice(0, 1))).toBe("single wall");
  });
});
