import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { type PlacedCabinet } from "@/lib/design";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "./InteractiveRoom3D";

function buildGlassCabinet(overrides: Partial<PlacedCabinet> = {}) {
  const room = { width: 144, depth: 120, ceilingHeight: 96 };
  const placed = {
    uid: "glass-wall-3d",
    cabinetId: 9360109,
    masterCode: "W2442GD",
    description: '24" Double Door Glass Door Wall Cabinet with 3 Adjustable Shelves',
    category: "Wall",
    subCategory: "Glass Door Wall",
    placement: "wall",
    x: 24,
    y: 0,
    width: 24,
    depth: 12,
    height: 42,
    rotation: 0,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    customProfile: "wall_2door_glass",
    ...overrides,
  } as PlacedCabinet;
  const sku = existingCabinetSku(placed, room);
  const root = new THREE.Group();
  addCabinet(root, sku, null, {}, room.width, room.depth, "#e8dfcf", "#f8f8f6", undefined, existingCabinetTransform(placed, room));
  const tagged = (key: string) => {
    const nodes: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData[key]) nodes.push(node); });
    return nodes;
  };
  return { root, sku, tagged };
}

describe("final Three.js glass-door cabinets", () => {
  it("normalizes W2442GD into two transparent doors, two selected-finish frames, one matching interior, and three shelves", () => {
    const { sku, tagged } = buildGlassCabinet({ glassDoor: false, fixedShelfCount: null, adjustableShelfCount: null });
    expect(sku).toMatchObject({ glassDoor: true, numberOfDoors: 2, adjustableShelfCount: 3 });
    expect(tagged("glassCabinetDoor")).toHaveLength(2);
    expect(tagged("glassDoorFrame")).toHaveLength(2);
    expect(tagged("glassCabinetInterior")).toHaveLength(1);
    expect(tagged("glassCabinetShelf")).toHaveLength(3);
    for (const node of tagged("glassCabinetDoor")) {
      expect((node as THREE.Mesh).material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(((node as THREE.Mesh).material as THREE.MeshPhysicalMaterial).transparent).toBe(true);
    }
    expect(tagged("selectedFinishInterior")).toHaveLength(4);
  });

  it("preserves one framed pane for a single-door legacy GD cabinet", () => {
    const { sku, tagged } = buildGlassCabinet({
      masterCode: "W-15-42GD",
      description: '15" Single Door Glass Door Wall Cabinet with 2 Adjustable Shelves',
      width: 15,
      numberOfDoors: 1,
      customProfile: null,
    });
    expect(sku).toMatchObject({ glassDoor: true, numberOfDoors: 1, adjustableShelfCount: 2 });
    expect(tagged("glassCabinetDoor")).toHaveLength(1);
    expect(tagged("glassDoorFrame")).toHaveLength(1);
    expect(tagged("glassCabinetShelf")).toHaveLength(2);
  });
});
