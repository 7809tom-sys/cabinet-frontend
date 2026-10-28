import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, threeDCabinetFrontVisualUrl, threeDUsesCatalogFrontVisual } from "./InteractiveRoom3D";
import { cornerDrawerFrontLayout, cornerDrawerPanelsStayInFootprint } from "@/lib/cornerDrawerLayout";

const CATALOG_IMAGE = "/manus-storage/catalog-images/1784649203084_1000002545_ec7c4e6a.webp";

function cdbSku(overrides: Record<string, unknown> = {}) {
  return {
    placementUid: "cdb36",
    distributorSkuId: 9390027,
    cabinetId: 9390027,
    masterCode: "CDB36",
    description: '36" Corner Drawer Base Cabinet',
    placementType: "base",
    width: 36,
    height: 34.5,
    depth: 36,
    numberOfDoors: 0,
    numberOfDrawers: 3,
    graphicType: "corner-drawer-base",
    customProfile: "corner-drawer-base",
    cornerGeometryKind: "l-shape",
    catalogImageUrl: CATALOG_IMAGE,
    ...overrides,
  } as Parameters<typeof addCabinet>[1];
}

function renderCdb(overrides: Record<string, unknown> = {}, doorSampleUrl?: string | null, surfaceTextures?: Parameters<typeof addCabinet>[12]) {
  const root = new THREE.Group();
  addCabinet(
    root,
    cdbSku(overrides),
    null,
    {},
    144,
    120,
    "#c4a574",
    "#f4f1ea",
    { doorStyle: "Shaker", doorPanelType: "shaker" },
    { x: 18, z: 18, rotation: 0, bottom: 0 },
    doorSampleUrl,
    undefined,
    surfaceTextures,
  );
  const cabinet = root.children.find((node) => node.userData.masterCode === "CDB36")!;
  return { root, cabinet };
}

function localBox(mesh: THREE.Object3D, cabinet: THREE.Object3D) {
  cabinet.updateMatrixWorld(true);
  const inverse = cabinet.matrixWorld.clone().invert();
  const box = new THREE.Box3().setFromObject(mesh);
  return box.applyMatrix4(inverse);
}

describe("CDB36 corner drawer fronts", () => {
  it("never lays the catalog line drawing on a plane", () => {
    expect(threeDCabinetFrontVisualUrl({
      masterCode: "CDB36",
      description: '36" Corner Drawer Base Cabinet',
      placementType: "base",
      catalogImageUrl: CATALOG_IMAGE,
      numberOfDoors: 0,
      numberOfDrawers: 3,
    })).toBeNull();
    expect(threeDUsesCatalogFrontVisual({
      hasCatalogFrontVisual: true,
      hasDoorSample: false,
      hasDoorTexture: false,
      specialtyKind: "standard",
      isRefrigeratorEndPanel: false,
      hasVerifiedDoorLayout: false,
      masterCode: "CDB36",
      description: '36" Corner Drawer Base Cabinet',
      graphicType: "corner-drawer-base",
    })).toBe(false);
    const { cabinet } = renderCdb({ numberOfDoors: 0, numberOfDrawers: 0 });
    const planes: THREE.Object3D[] = [];
    cabinet.traverse((node) => {
      if (node.userData.authoritativeCabinetFrontVisual) planes.push(node);
    });
    expect(planes).toHaveLength(0);
  });

  it("builds three right-angle drawer fronts in the door finish, with hardware on each leg", () => {
    const { cabinet } = renderCdb({}, null, { hardwareStyleId: "bar-pull" });
    const faces: THREE.Mesh[] = [];
    const pulls: THREE.Object3D[] = [];
    const catalogPlanes: THREE.Object3D[] = [];
    cabinet.traverse((node) => {
      if (node.userData.cornerDrawerFace && node instanceof THREE.Mesh) faces.push(node);
      if (node.userData.cornerDrawerPull) pulls.push(node);
      if (node.userData.authoritativeCabinetFrontVisual) catalogPlanes.push(node);
    });
    expect(catalogPlanes).toHaveLength(0);
    expect(faces).toHaveLength(6);
    expect(faces.filter((face) => face.userData.cornerDrawerLeg === "back-leg")).toHaveLength(3);
    expect(faces.filter((face) => face.userData.cornerDrawerLeg === "side-leg")).toHaveLength(3);
    expect(new Set(faces.map((face) => face.rotation.y))).toEqual(new Set([0, Math.PI / 2]));
    const heights = [...new Set(faces.map((face) => (face.geometry as THREE.BoxGeometry).parameters.height))].sort((a, b) => a - b);
    expect(heights[0]).toBeLessThan(heights[1]!);
    for (const face of faces) {
      expect(face.userData).toMatchObject({ cabinetFront: true, cabinetDrawerFront: true, flushPhysicalFace: true, cornerDrawerRightAngle: true });
      // The selected door finish paints these meshes. A catalog diagram would be a flat MeshBasicMaterial instead.
      const material = face.material as THREE.MeshPhysicalMaterial;
      expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(material.color.getHexString()).toBe("c4a574");
    }
    expect(pulls).toHaveLength(6);
    expect(pulls.filter((pull) => pull.userData.cornerDrawerLeg === "back-leg")).toHaveLength(3);
    expect(pulls.filter((pull) => pull.userData.cornerDrawerLeg === "side-leg")).toHaveLength(3);
    const shaker: THREE.Object3D[] = [];
    cabinet.traverse((node) => {
      if (node.userData.selectedStyleFace === "shaker") shaker.push(node);
    });
    expect(shaker.length).toBeGreaterThan(0);
  });

  it("keeps drawer-front bounds inside the cabinet footprint and clear of both neighboring runs", () => {
    const { cabinet } = renderCdb();
    const layout = cornerDrawerFrontLayout({
      bodyWidth: 3,
      bodyDepth: 3,
      bodyHeight: 30 / 12,
      legRatio: 24 / 36,
      drawerCount: 3,
    });
    const faces: THREE.Mesh[] = [];
    cabinet.traverse((node) => {
      if (node.userData.cornerDrawerFace && node instanceof THREE.Mesh) faces.push(node);
    });
    const boxes = faces.map((face) => localBox(face, cabinet));
    expect(cornerDrawerPanelsStayInFootprint(faces.map((face) => {
      const geometry = face.geometry as THREE.BoxGeometry;
      return {
        x: face.position.x,
        z: face.position.z,
        width: geometry.parameters.width,
        thickness: geometry.parameters.depth,
        rotationY: face.rotation.y,
      };
    }), layout)).toBe(true);
    for (const box of boxes) {
      expect(box.max.x).toBeLessThanOrEqual(1.5 + 1e-4);
      expect(box.max.z).toBeLessThanOrEqual(1.5 + 1e-4);
      expect(box.min.x).toBeGreaterThanOrEqual(-1.5 - 1e-4);
      expect(box.min.z).toBeGreaterThanOrEqual(-1.5 - 1e-4);
      // Back-wall neighbor occupies x > 1.5, z <= 0.5. Left-wall neighbor occupies z > 1.5, x <= 0.5.
      const hitsBackNeighbor = box.max.x > 1.5 + 1e-4 && box.min.z < 0.5;
      const hitsLeftNeighbor = box.max.z > 1.5 + 1e-4 && box.min.x < 0.5;
      expect(hitsBackNeighbor).toBe(false);
      expect(hitsLeftNeighbor).toBe(false);
    }
  });

  it("does not change the lazy-Susan door fronts", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      placementUid: "lsb36",
      distributorSkuId: 1,
      cabinetId: 1,
      masterCode: "LSB36",
      description: "36 inch Lazy Susan Base",
      placementType: "base",
      width: 36,
      height: 34.5,
      depth: 36,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      cornerGeometryKind: "l-shape",
    } as Parameters<typeof addCabinet>[1], null, {}, 144, 120, "#c4a574", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, { x: 18, z: 18, rotation: 0 });
    const doors: THREE.Object3D[] = [];
    const cornerDrawers: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.lCornerDoor) doors.push(node);
      if (node.userData.cornerDrawerFace) cornerDrawers.push(node);
    });
    expect(doors.map((door) => door.userData.lCornerDoor).sort()).toEqual(["back-leg", "side-leg"]);
    expect(cornerDrawers).toHaveLength(0);
  });

  it("omits hardware when the selected style is none", () => {
    const { cabinet } = renderCdb({}, null, { hardwareStyleId: "none" });
    const pulls: THREE.Object3D[] = [];
    cabinet.traverse((node) => {
      if (node.userData.cornerDrawerPull || node.userData.cabinetPull) pulls.push(node);
    });
    expect(pulls).toHaveLength(0);
  });
});
