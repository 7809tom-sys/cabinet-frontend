import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";
import { addThreeDMeasuredWallMiterCountertops } from "./InteractiveRoom3D";

const room = {
  ...DEFAULT_ROOM,
  width: 180,
  depth: 180,
  vertices: [
    { id: "v1", x: 0, y: 0 },
    { id: "v2", x: 60, y: 60 },
    { id: "v3", x: 60, y: 180 },
    { id: "v4", x: 0, y: 180 },
  ],
  customWalls: [
    { id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 as const },
    { id: "straight", startVertexId: "v2", endVertexId: "v3" },
    { id: "return", startVertexId: "v3", endVertexId: "v4" },
    { id: "close", startVertexId: "v4", endVertexId: "v1" },
  ],
} as RoomData;

function seat(uid: string, wallId: string, offset: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const width = Number(extra.width ?? 24);
  const spot = wallPlacementAt(offset, width, 24, wallId as never, room, null, false);
  return {
    uid,
    cabinetId: 10,
    masterCode: "B-24",
    description: '24" Base Cabinet',
    placement: "base",
    x: spot.x,
    y: spot.y,
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId ?? wallId,
    wallOffset: spot.wallOffset ?? offset,
    ...extra,
  } as PlacedCabinet;
}

const angledDishwasher = () => seat("dw", "diagonal", Math.hypot(60, 60) - 24, {
  cabinetId: 24,
  masterCode: "DW-24",
  description: '24" Built-In Dishwasher',
  category: "Appliance",
  subCategory: null,
  placement: "appliance",
  mountBottom: 0,
  numberOfDoors: 0,
  numberOfDrawers: 0,
});

describe("3D countertop over an angled dishwasher", () => {
  const placed = [angledDishwasher(), seat("straight-base", "straight", 0)];

  it("renders the same two mitred slabs as an all-cabinet 45-degree turn", () => {
    const withDishwasher = new THREE.Group();
    addThreeDMeasuredWallMiterCountertops(withDishwasher, room, placed, "#ffffff");

    const withCabinet = new THREE.Group();
    addThreeDMeasuredWallMiterCountertops(withCabinet, room, [
      seat("base", "diagonal", Math.hypot(60, 60) - 24),
      seat("straight-base", "straight", 0),
    ], "#ffffff");

    const slabs = (group: THREE.Group) => group.children
      .filter((child) => (child as THREE.Mesh).userData.measuredWallContinuousCountertop === true)
      .map((child) => {
        const mesh = child as THREE.Mesh;
        const box = new THREE.Box3().setFromObject(mesh);
        return {
          mitered: mesh.userData.measuredWallMiterCountertop === true,
          infill: mesh.userData.measuredWallCornerInfillCountertop === true,
          seam: mesh.userData.customWallMiterVertexId ?? null,
          bounds: [box.min.x, box.min.z, box.max.x, box.max.z].map((value) => Math.round(value * 12 * 8) / 8),
        };
      })
      .sort((left, right) => String(left.seam).localeCompare(String(right.seam)) || left.bounds[0]! - right.bounds[0]!);

    expect(slabs(withDishwasher)).toHaveLength(2);
    expect(slabs(withDishwasher)).toEqual(slabs(withCabinet));
    // Both slabs carry the real 45° seam, so the top continues with no break.
    expect(slabs(withDishwasher).every((slab) => slab.mitered && slab.seam === "v2")).toBe(true);
  });

  it("produces one continuous slab that covers the dishwasher and the seam", () => {
    const root = new THREE.Group();
    addThreeDMeasuredWallMiterCountertops(root, room, placed, "#ffffff");
    root.updateMatrixWorld(true);

    const slabs = (root.children as THREE.Mesh[]).filter((mesh) => mesh.userData.measuredWallContinuousCountertop);
    expect(slabs).toHaveLength(2);

    // Just above the dishwasher and just above the seam, on the finished top.
    const dishwasher = placed[0]!;
    const hits = [
      { x: dishwasher.x + 12, y: dishwasher.y + 12 },
      { x: dishwasher.x + 16, y: dishwasher.y + 16 },
    ].map((point) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(point.x / 12, 5, point.y / 12), new THREE.Vector3(0, -1, 0));
      return ray.intersectObjects(slabs, true).some((hit) => Math.abs(hit.point.y * 12 - 36) < 0.01);
    });
    expect(hits).toEqual([true, true]);

    // The seam is shared: the two slab outlines meet edge to edge, no gap.
    const outlines = slabs.map((slab) => {
      const position = slab.geometry.getAttribute("position");
      const points = new Set<string>();
      const vertex = new THREE.Vector3();
      for (let index = 0; index < position.count; index += 1) {
        vertex.fromBufferAttribute(position, index).applyMatrix4(slab.matrixWorld);
        points.add(`${Math.round(vertex.x / (1 / 12) * 8) / 8},${Math.round(vertex.z / (1 / 12) * 8) / 8}`);
      }
      return points;
    });
    const shared = [...outlines[0]!].filter((point) => outlines[1]!.has(point));
    expect(shared.length).toBeGreaterThanOrEqual(2);
  });
});
