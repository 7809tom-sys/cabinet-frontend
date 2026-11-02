import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { designerFacePlan } from "@/lib/designerFacePlan";
import { addCabinet, doorProfileKind } from "./InteractiveRoom3D";

function meshes(root: THREE.Object3D) {
  const found: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) found.push(node);
  });
  return found;
}

const baseSku = {
  distributorSkuId: 1,
  cabinetId: 1,
  masterCode: "B24",
  description: "Base 24",
  placementType: "base" as const,
  width: 24,
  height: 34.5,
  depth: 24,
  numberOfDoors: 1,
  numberOfDrawers: 0,
};

describe("five-piece slab fronts", () => {
  it("maps the door-front label ahead of shaker and one-piece slab", () => {
    expect(doorProfileKind("Shaker", "five-piece slab")).toBe("five-piece-slab");
    expect(doorProfileKind("5 piece", null)).toBe("five-piece-slab");
    expect(doorProfileKind("5-piece slab", null)).toBe("five-piece-slab");
    expect(doorProfileKind("Slab", null)).toBe("flat");
    expect(doorProfileKind("Shaker", "Flat recessed center panel")).toBe("shaker");
  });

  it("builds a clean five-piece slab and does not keep the old shaker photo or notch", () => {
    const root = new THREE.Group();
    addCabinet(
      root,
      baseSku,
      null,
      {},
      144,
      120,
      "#c4a574",
      "#ffffff",
      { doorStyle: "Shaker", doorPanelType: "five-piece slab", railWidth: 2.75, stileWidth: 2.75 },
    );
    const all = meshes(root);
    const rails = all.filter((mesh) => mesh.userData.fivePieceSlab && mesh.userData.physicalRail);
    expect(rails.length).toBeGreaterThanOrEqual(4);
    expect(all.some((mesh) => mesh.userData.shakerNotch)).toBe(false);
    const center = all.find((mesh) => mesh.userData.fivePieceSlabCenter);
    expect(center).toBeTruthy();
    expect((center!.material as THREE.MeshStandardMaterial).map).toBeNull();
    expect((rails[0]!.material as THREE.MeshStandardMaterial).map).toBeNull();
  });

  it("still builds the shaker notch on a hickory shaker door", () => {
    const root = new THREE.Group();
    addCabinet(
      root,
      baseSku,
      null,
      {},
      144,
      120,
      "#8B6914",
      "#ffffff",
      { doorStyle: "Shaker", doorPanelType: "Recessed Panel", railWidth: 3, stileWidth: 3 },
    );
    const all = meshes(root);
    expect(all.some((mesh) => mesh.userData.shakerNotch)).toBe(true);
    expect(all.some((mesh) => mesh.userData.fivePieceSlab)).toBe(false);
  });
});

describe("hickory wood grain after the shaker blueprint", () => {
  it("keeps the hickory photo and does not retint it onto the brand palette", () => {
    const hickory = {
      id: 330007,
      distributorId: 210001,
      styleCode: "HS",
      ourName: "Hickory Shaker",
      aliasName: "Silva Shaker (Ashford)",
      doorStyle: "Shaker",
      railWidth: 3,
      color: "#8B6914",
      doorSampleImageUrl: "/manus-storage/media-library/hickory_shaker_door.jpg",
      drawerSampleImageUrl: "/manus-storage/media-library/hickory_shaker_drawer.jpg",
    };
    const rustic = {
      id: 330011,
      distributorId: 210001,
      styleCode: "RH",
      ourName: "Rustic Hickory",
      aliasName: "Forest Rust (Ashford)",
      doorStyle: "Shaker",
      railWidth: 2.75,
      renderHex: "#73482a",
      doorSampleImageUrl: "/manus-storage/media-library/forestrust_door.jpg",
      drawerSampleImageUrl: "/manus-storage/media-library/forestrust_drawer.jpg",
    };
    const hickoryPlan = designerFacePlan(hickory, "base");
    const rusticPlan = designerFacePlan(rustic, "base");
    expect(hickoryPlan?.doorUrl).toBe(hickory.doorSampleImageUrl);
    expect(hickoryPlan?.drawerUrl).toBe(hickory.drawerSampleImageUrl);
    expect(hickoryPlan?.dlcCrop).toBeUndefined();
    expect(rusticPlan?.doorUrl).toBe(rustic.doorSampleImageUrl);
    expect(rusticPlan?.dlcCrop).toBeUndefined();
    const painted = designerFacePlan({ doorStyle: "Shaker", ourName: "Classic Cream", railWidth: 3, color: "#f2e8d0", doorSampleImageUrl: "/uploads/framed-door.jpg" }, "base");
    expect(painted?.doorUrl).not.toBe("/uploads/framed-door.jpg");
    expect(painted?.dlcCrop?.solidColor).toBeTruthy();
  });
});
