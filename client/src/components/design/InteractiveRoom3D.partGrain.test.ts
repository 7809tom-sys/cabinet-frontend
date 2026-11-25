// @vitest-environment jsdom
/**
 * Natura Maple borrows Versa Shaker's frame-free grain. Each board has to sample
 * that tile at the same inches, with the grain running the way the board is cut.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import catalog from "@shared/fixtures/doorStyleSideCatalog.json";
import { addCabinet } from "./InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { designerFacePlan } from "@/lib/designerFacePlan";

type CatalogStyle = {
  id: number;
  distributorId: number;
  styleCode?: string;
  ourName?: string;
  aliasName?: string;
  color?: string;
  finish?: string;
  doorStyle?: string;
  woodSpecies?: string;
};

const natura = (catalog as CatalogStyle[]).find((style) => style.id === 330004)!;

function faceSamples(geometry: THREE.BufferGeometry, axis: "x" | "y" | "z") {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const samples: Array<{ x: number; y: number; z: number; u: number; v: number; n: number }> = [];
  for (let index = 0; index < position.count; index += 1) {
    const n = axis === "x" ? normal.getX(index) : axis === "y" ? normal.getY(index) : normal.getZ(index);
    if (Math.abs(n) < 0.9) continue;
    samples.push({
      x: position.getX(index) * 12,
      y: position.getY(index) * 12,
      z: position.getZ(index) * 12,
      u: uv.getX(index),
      v: uv.getY(index),
      n,
    });
  }
  return samples;
}

function span(samples: Array<Record<string, number>>, key: string) {
  const values = samples.map((sample) => sample[key]!);
  return Math.max(...values) - Math.min(...values);
}

function build(masterCode: string, width: number, doors: number, drawers: number) {
  const plan = designerFacePlan(natura, "base")!;
  const root = new THREE.Group();
  addCabinet(
    root,
    {
      placementUid: masterCode,
      masterCode,
      description: masterCode,
      placementType: "base",
      width,
      depth: 24,
      height: 34.5,
      numberOfDoors: doors,
      numberOfDrawers: drawers,
      category: "Base",
    } as never,
    "back",
    { back: 0 },
    144,
    120,
    doorStyleFinishColors(natura).face,
    "#eeeeee",
    designerCatalogDoorProfile(natura) as never,
    { x: 0, z: 0, rotation: 0 },
    plan.doorUrl,
    undefined,
    {
      selectedToeKick: true,
      drawerSampleUrl: plan.drawerUrl,
      faceSourceKind: plan.sourceKind,
      faceCrop: plan.dlcCrop ?? null,
    },
  );
  return { root, plan };
}

describe("Natura Maple grain follows each board", () => {
  it("runs rails and the toe kick horizontally, and keeps one scale on stiles and the side", () => {
    const { root, plan } = build("B24", 24, 2, 0);
    const along = plan.dlcCrop!.faceTileIn![1]!;
    const across = plan.dlcCrop!.faceTileIn![0]!;
    const meshes: THREE.Mesh[] = [];
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) meshes.push(mesh);
    });
    const rail = meshes.find((mesh) => mesh.userData.grainPiece === "rail")!;
    const stile = meshes.find((mesh) => mesh.userData.grainPiece === "stile")!;
    const side = meshes.find((mesh) => mesh.userData.carcassShell === true)!;
    const kick = meshes.find((mesh) => mesh.userData.baseToeKick === true)!;
    expect(rail.userData.partWoodGrainAxis).toBe("horizontal");
    expect(stile.userData.partWoodGrainAxis).toBe("vertical");
    expect(side.userData.partWoodGrainAxis).toBe("vertical");
    expect(kick.userData.partWoodGrainAxis).toBe("horizontal");

    const railFront = faceSamples(rail.geometry, "z");
    const stileFront = faceSamples(stile.geometry, "z");
    const sideFace = faceSamples(side.geometry, "x");
    const kickFront = faceSamples(kick.geometry, "z");
    expect(span(railFront, "v") / span(railFront, "x")).toBeCloseTo(1 / along, 2);
    expect(span(railFront, "u") / span(railFront, "y")).toBeCloseTo(1 / across, 2);
    expect(span(stileFront, "v") / span(stileFront, "y")).toBeCloseTo(1 / along, 2);
    expect(span(sideFace, "v") / span(sideFace, "y")).toBeCloseTo(1 / along, 2);
    expect(span(kickFront, "v") / span(kickFront, "x")).toBeCloseTo(1 / along, 2);
    // A long rail is not a squeezed copy of the door, and it is not rotated as a texture.
    expect(span(railFront, "u")).toBeLessThan(1);
    const railMap = (rail.material as THREE.MeshStandardMaterial).map!;
    expect(railMap.rotation).toBe(0);
    expect(railMap.repeat.x).toBeCloseTo(1);
    expect(railMap.repeat.y).toBeCloseTo(1);
    expect(railMap.wrapS).toBe(THREE.MirroredRepeatWrapping);
    // Same inches per tile on the stile and the cabinet side.
    expect(span(stileFront, "v") / span(stileFront, "y")).toBeCloseTo(span(sideFace, "v") / span(sideFace, "y"), 2);
  });

  it("runs drawer-front rails horizontally and the drawer panel vertically", () => {
    const { root, plan } = build("3DB18", 18, 0, 3);
    const along = plan.dlcCrop!.faceTileIn![1]!;
    const drawerAlong = plan.dlcCrop!.faceTileDrawerIn?.[1] ?? along;
    let rail: THREE.Mesh | null = null;
    let panel: THREE.Mesh | null = null;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!rail && mesh.userData.grainPiece === "rail") rail = mesh;
      if (!panel && mesh.userData.cabinetDrawerFront === true && !mesh.userData.grainPiece) panel = mesh;
    });
    expect(rail).toBeTruthy();
    expect(panel).toBeTruthy();
    expect(rail!.userData.partWoodGrainAxis).toBe("horizontal");
    expect(panel!.userData.partWoodGrainAxis).toBe("vertical");
    const railFront = faceSamples(rail!.geometry, "z");
    const panelFront = faceSamples(panel!.geometry, "z");
    expect(span(railFront, "v") / span(railFront, "x")).toBeCloseTo(1 / along, 2);
    expect(span(panelFront, "v") / span(panelFront, "y")).toBeCloseTo(1 / drawerAlong, 2);
    expect((panel!.material as THREE.MeshStandardMaterial).map!.rotation).toBe(0);
  });
});
