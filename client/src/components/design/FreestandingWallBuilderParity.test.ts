import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";
import { snapFreestandingFortyFive } from "@/lib/freestandingRun";
import { appendWallBuilderSegment, wallBuilderRoomGeometry } from "@/lib/polygonRoom";
import { addThreeDMeasuredWallMiterCountertops, addThreeDStandardCountertops } from "./InteractiveRoom3D";

const INCH = 1 / 12;
const base = (uid: string, x: number, y: number, rotation = 0, extra: Record<string, unknown> = {}) => ({
  uid, cabinetId: 1, masterCode: "B24", description: "24\" Base", placement: "base", x, y, width: 24, depth: 24, height: 34.5, rotation, ...extra,
} as PlacedCabinet);

/** World-space XZ footprint (inches, 1/8" grid) of every mesh in the group, sorted for comparison. */
function footprints(root: THREE.Group, origin: { x: number; y: number }): string[] {
  root.updateMatrixWorld(true);
  const out: string[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute("position");
    const pts = new Set<string>();
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      pts.add(JSON.stringify([Math.round((v.x / INCH - origin.x) * 8) / 8, Math.round((v.z / INCH - origin.y) * 8) / 8]));
    }
    out.push(JSON.stringify([...pts].sort()));
  });
  return out.sort();
}

describe("regular Designer vs Continuous Wall Builder — same U with a 45° peninsula", () => {
  it("builds identical countertop meshes from the one shared code path", () => {
    // Continuous Wall Builder room: 144" back wall, 96" right wall, 59" leg after a right 45° turn.
    const geometry = wallBuilderRoomGeometry(
      appendWallBuilderSegment(appendWallBuilderSegment(appendWallBuilderSegment([], 144, "start"), 96, "right90"), 59, "right45"),
      96,
    ).room!;
    const wbRoom = { width: 192, depth: 168, ceilingHeight: 96, vertices: geometry.vertices, customWalls: geometry.customWalls, openWallPath: geometry.openWallPath } as RoomData;
    const [w0, w1, w2] = wbRoom.customWalls!;
    const seat = (uid: string, wallId: string, along: number) => {
      const spot = wallPlacementAt(along, 24, 24, wallId as never, wbRoom, null, false);
      return base(uid, spot.x, spot.y, spot.rotation, { wallId: spot.wallId, wallOffset: spot.wallOffset });
    };
    const wbPlaced = [seat("a1", w0!.id, 0), seat("a2", w0!.id, 24), seat("a3", w0!.id, 48), seat("b1", w1!.id, 37), seat("b2", w1!.id, 61), seat("c1", w2!.id, 11), seat("c2", w2!.id, 35)];
    const wbRoot = new THREE.Group();
    addThreeDMeasuredWallMiterCountertops(wbRoot, wbRoom, wbPlaced, "#fff");

    // Regular Designer: plain room, same cabinets free-standing; the 45° one is dropped nearby and seated by the shared snap.
    const dRoom: RoomData = { width: 192, depth: 168, ceilingHeight: 96 };
    const origin = { x: 20, y: 20 };
    const rel = (c: PlacedCabinet) => base(c.uid, c.x - geometry.vertices[0]!.x + origin.x, c.y - geometry.vertices[0]!.y + origin.y, c.rotation);
    const free = wbPlaced.slice(0, 5).map(rel);
    const target = rel(wbPlaced[5]!);
    const snap = snapFreestandingFortyFive(base("c1", target.x + 3, target.y + 2, 135), free, dRoom, null, 12);
    expect(snap).not.toBeNull();
    expect(snap!.x).toBeCloseTo(target.x, 3);
    expect(snap!.y).toBeCloseTo(target.y, 3);
    const dPlaced = [...free, base("c1", snap!.x, snap!.y, 135), rel(wbPlaced[6]!)];
    const dRoot = new THREE.Group();
    addThreeDStandardCountertops(dRoot, dRoom, dPlaced, "#fff");

    const wb = footprints(wbRoot, geometry.vertices[0]!);
    const designer = footprints(dRoot, origin);
    expect(wb.length).toBeGreaterThan(0);
    expect(designer).toEqual(wb);
  });
});
