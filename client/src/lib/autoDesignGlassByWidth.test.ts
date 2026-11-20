import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { applyGlassUpperPreference } from "./autoDesignFormOptions";
import { emptyAutoDesignIntake, type AutoDesignIntake } from "./autoDesignFifteenRules";
import {
  elevationBox, glassStackerParentPlacement, wallPlacementAt, wallRunOffset,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

/**
 * Glass placement is purely dimensional (Tom, Nov 20 2026): a 15 in upper gets the line's
 * 15 in glass stacker, on any wall. The old test asked whether the parent touched the room's
 * bounding box (isAgainstWall), so custom-id walls and 45 degree walls never got glass.
 */
const WALL = (matrixCatalog as unknown as Record<string, { wall: DesignCabinet[] }>)["330014"]!.wall;
const GLASS: AutoDesignIntake = { ...emptyAutoDesignIntake(), construction: "new", preferences: ["glass-uppers"] };
const row = (code: string) => {
  const found = WALL.find((item) => item.masterCode === code);
  if (!found) throw new Error(`fixture has no ${code}`);
  return found;
};

/** A 240 x 120 rectangle drawn as custom walls with ids that are not top/right/bottom/left. */
function customRoom(extra: Partial<RoomData> = {}): RoomData {
  return {
    width: 240, depth: 120, ceilingHeight: 108, openWallPath: false,
    vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 240, y: 0 }, { id: "c", x: 240, y: 120 }, { id: "d", x: 0, y: 120 }],
    customWalls: [
      { id: "w1", label: "Wall 1", startVertexId: "a", endVertexId: "b" },
      { id: "w2", label: "Wall 2", startVertexId: "b", endVertexId: "c" },
      { id: "w3", label: "Wall 3", startVertexId: "c", endVertexId: "d" },
      { id: "w4", label: "Wall 4", startVertexId: "d", endVertexId: "a" },
    ],
    ...extra,
  } as RoomData;
}

/** A 45 degree wall between two square walls (the Aero five-wall shape, shortened). */
function angledRoom(): RoomData {
  return {
    width: 204, depth: 210, ceilingHeight: 108, openWallPath: true,
    vertices: [
      { id: "v1", x: 0, y: 0 }, { id: "v2", x: 138, y: 0 }, { id: "v3", x: 204, y: 66 },
      { id: "v4", x: 204, y: 144 }, { id: "v5", x: 138, y: 210 }, { id: "v6", x: 40, y: 210 },
    ],
    customWalls: [
      { id: "top", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
      { id: "angTR", label: "Wall 2", startVertexId: "v2", endVertexId: "v3", lockedAngle: 45 },
      { id: "right", label: "Wall 3", startVertexId: "v3", endVertexId: "v4" },
      { id: "angBR", label: "Wall 4", startVertexId: "v4", endVertexId: "v5", lockedAngle: 45 },
      { id: "bottom", label: "Wall 5", startVertexId: "v5", endVertexId: "v6" },
    ],
  } as RoomData;
}

/** A wall cabinet seated through the run frame, exactly as the engine seats it. */
function upper(code: string, wallId: string, along: number, uid: string, room: RoomData): PlacedCabinet {
  const r = row(code);
  const width = Number(r.width);
  const depth = Number(r.depth);
  const seat = wallPlacementAt(along, width, depth, wallId as never, room);
  return {
    uid, cabinetId: r.id, masterCode: r.masterCode, description: r.description ?? "",
    category: r.category ?? null, subCategory: r.subCategory ?? null,
    placement: "wall", x: seat.x, y: seat.y, rotation: seat.rotation, wallId: seat.wallId ?? wallId, wallOffset: seat.wallOffset,
    width, depth, height: Number(r.height), mountBottom: 54,
  } as PlacedCabinet;
}

const stackersOf = (placed: readonly PlacedCabinet[]) => placed.filter((item) => item.glassDoor === true && item.stackedOnCabinetUid);

describe("glass by width alone", () => {
  it("rect room (control): a 15 in upper gets a 15 in glass stacker", () => {
    const room = { width: 240, depth: 120, ceilingHeight: 108 } as RoomData;
    const parent = { ...upper("W-15-30", "top", 30, "p1", { ...room, vertices: undefined, customWalls: undefined } as RoomData), wallId: "top" } as PlacedCabinet;
    const result = applyGlassUpperPreference({ placed: [parent], wallCatalog: WALL, intake: GLASS, room, wallHeightIn: 30 });
    expect(stackersOf(result.placed).map((item) => [item.masterCode, item.stackedOnCabinetUid])).toEqual([["W1518GD", "p1"]]);
  });

  it("custom wall id (w2): a 15 in upper under a 15 in span gets exactly one W1518GD stacker on it", () => {
    const room = customRoom();
    const parent = upper("W-15-30", "w2", 40, "p1", room);
    expect(parent.wallId).toBe("w2");
    const result = applyGlassUpperPreference({ placed: [parent], wallCatalog: WALL, intake: GLASS, room, wallHeightIn: 30 });
    const stackers = stackersOf(result.placed);
    expect(stackers.map((item) => [item.masterCode, item.stackedOnCabinetUid, item.wallId])).toEqual([["W1518GD", "p1", "w2"]]);
    expect(result.findings.filter((finding) => finding.severity === "warning")).toEqual([]);
    const box = elevationBox(stackers[0]!, room);
    expect(box.bottom).toBeCloseTo(84, 2);
    expect(box.bottom + box.height).toBeCloseTo(102, 2);
  });

  it("custom walls: the stacker picks its own parent by wall id even when two uppers share a width on different walls", () => {
    const room = customRoom();
    const onW1 = upper("W-15-30", "w1", 20, "a", room);
    const onW3 = upper("W-15-30", "w3", 20, "b", room);
    const result = applyGlassUpperPreference({ placed: [onW1, onW3], wallCatalog: WALL, intake: GLASS, room, wallHeightIn: 30 });
    const stackers = stackersOf(result.placed);
    expect(stackers.map((item) => [item.stackedOnCabinetUid, item.wallId]).sort()).toEqual([["a", "w1"], ["b", "w3"]]);
  });

  it("45 degree wall: a 15 in upper gets a W1518GD that follows the parent's rotation, front flush", () => {
    const room = angledRoom();
    const parent = upper("W-15-30", "angTR", 20, "p1", room);
    expect(Math.round(parent.rotation) % 90).not.toBe(0);
    const result = applyGlassUpperPreference({ placed: [parent], wallCatalog: WALL, intake: GLASS, room, wallHeightIn: 30 });
    const stackers = stackersOf(result.placed);
    expect(stackers.map((item) => [item.masterCode, item.stackedOnCabinetUid])).toEqual([["W1518GD", "p1"]]);
    const stacker = stackers[0]!;
    expect(stacker.rotation).toBeCloseTo(parent.rotation, 3);
    // Front flush: the 12 in stacker sits on the parent's face, so both fronts are on one line.
    // The stacker's run offset along the wall equals the parent's.
    expect(wallRunOffset(stacker, "angTR", room)).toBeCloseTo(wallRunOffset(parent, "angTR", room), 1);
  });

  it("width still has to match within 1/2 in: a 15 in stacker never lands on a 21 in upper", () => {
    const room = customRoom();
    const parent = upper("W2130", "w2", 40, "p1", room);
    const draft = { ...upper("W-15-30", "w2", 40, "s", room), masterCode: "W1518GD", height: 18, glassDoor: true } as PlacedCabinet;
    expect(glassStackerParentPlacement(draft, [parent], room, null)).toMatchObject({ ok: false, reason: "no-matching-parent" });
  });

  it("the ceiling is read on the parent's own wall: a low custom wall blocks the stacker, a tall one does not", () => {
    const low = customRoom({ wallCeilings: { w2: { high: 96, low: 96 } } as never });
    const parentLow = upper("W-15-30", "w2", 40, "p1", low);
    const blocked = applyGlassUpperPreference({ placed: [parentLow], wallCatalog: WALL, intake: GLASS, room: low, wallHeightIn: 30 });
    // 84 + 12 = 96 fits exactly, 15 and 18 do not: the 12 in stacker is chosen.
    expect(stackersOf(blocked.placed).map((item) => item.masterCode)).toEqual(["W1512GD"]);
    const tall = customRoom({ wallCeilings: { w2: { high: 108, low: 108 } } as never, ceilingHeight: 96 });
    const parentTall = upper("W-15-30", "w2", 40, "p1", tall);
    const open = applyGlassUpperPreference({ placed: [parentTall], wallCatalog: WALL, intake: GLASS, room: tall, wallHeightIn: 30 });
    expect(stackersOf(open.placed).map((item) => item.masterCode)).toEqual(["W1518GD"]);
  });

  it("a cabinet on a free-standing peninsula run is still not a glass parent", () => {
    const room = { width: 240, depth: 120, ceilingHeight: 108, peninsulaRuns: [{ id: "auto-peninsula", parentWall: "top", startOffset: 60, length: 60, cabinetSide: "left" }] } as unknown as RoomData;
    const parent = upper("W-15-30", "auto-peninsula", 0, "p1", room);
    const result = applyGlassUpperPreference({ placed: [parent], wallCatalog: WALL, intake: GLASS, room, wallHeightIn: 30 });
    expect(stackersOf(result.placed)).toEqual([]);
  });
});
