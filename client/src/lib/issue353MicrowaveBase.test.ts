/**
 * Issue 353, outcome 6 (Tom, Nov 9 2026).
 *
 * A BASE microwave cabinet is drawn as a cabinet with a real microwave bay and
 * a drawer under it, never as one big door over the drawer. The bay is a
 * constructed unbranded stainless appliance face inside the cabinet's own
 * configured opening, exactly like the enclosed WALL microwave family.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, isBaseMicrowaveCabinet, resolvedThreeDFaceLayout } from "@/components/design/InteractiveRoom3D";

type Mesh = THREE.Mesh & { userData: Record<string, unknown> };

const microwaveBase = {
  placementUid: "mw-base",
  masterCode: "BMC30",
  description: '30" Microwave Base Cabinet',
  placementType: "base",
  width: 30,
  depth: 24,
  height: 34.5,
  numberOfDoors: 0,
  numberOfDrawers: 1,
  category: "Base",
  subCategory: "Microwave Base Cabinet",
  openingType: "top",
  drawerHeight: 12,
};

function build(sku: Record<string, unknown>) {
  const root = new THREE.Group();
  addCabinet(root, { ...sku } as never, null, {}, 144, 120, "#eeeadf", "#f8f8f6", null, undefined, null);
  const meshes: Mesh[] = [];
  root.traverse((node) => { if ((node as Mesh).isMesh) meshes.push(node as Mesh); });
  return meshes;
}

const count = (meshes: Mesh[], key: string) => meshes.filter((mesh) => mesh.userData[key] === true).length;

describe("outcome 6: a base microwave cabinet renders a microwave in 3D", () => {
  it("recognises the base microwave family by code and by description", () => {
    expect(isBaseMicrowaveCabinet(microwaveBase as never)).toBe(true);
    expect(isBaseMicrowaveCabinet({ ...microwaveBase, masterCode: "BMW-30" } as never)).toBe(true);
    // A supplier's own code is caught by the cabinet's own microwave-base face description.
    expect(isBaseMicrowaveCabinet({ ...microwaveBase, masterCode: "B30MC" } as never)).toBe(true);
    expect(isBaseMicrowaveCabinet({ ...microwaveBase, masterCode: "B30MC", subCategory: "Standard Base", description: '30" Base Cabinet' } as never)).toBe(false);
    // A wall microwave is the other family's job.
    expect(isBaseMicrowaveCabinet({ ...microwaveBase, placementType: "wall" } as never)).toBe(false);
    // No configured opening: there is no bay to draw.
    expect(isBaseMicrowaveCabinet({ ...microwaveBase, openingType: null } as never)).toBe(false);
  });

  it("draws a constructed microwave face and a drawer instead of one big door", () => {
    const meshes = build(microwaveBase);
    expect(count(meshes, "microwaveFront")).toBe(1);
    expect(count(meshes, "baseMicrowaveFront")).toBe(1);
    expect(count(meshes, "cabinetDoorFront")).toBe(0);
    expect(count(meshes, "cabinetDrawerFront")).toBe(1);
    // The appliance detail is real: glass, control band, display, handle.
    expect(count(meshes, "wallMicrowaveGlass")).toBe(1);
    expect(count(meshes, "wallMicrowaveControlBand")).toBe(1);
    expect(count(meshes, "wallMicrowaveDisplay")).toBe(1);
    expect(count(meshes, "wallMicrowaveHandle")).toBe(1);
  });

  it("seats the microwave inside its configured opening envelope", () => {
    const meshes = build({ ...microwaveBase, openingWidth: 27, openingHeight: 17 });
    const face = meshes.find((mesh) => mesh.userData.microwaveFront === true)!;
    expect(face.userData.openingWidthIn as number).toBeCloseTo(27, 6);
    expect(face.userData.openingHeightIn as number).toBeLessThanOrEqual(17 + 1e-6);
    expect(face.userData.seatedInsideConfiguredOpening).toBe(true);
    // It sits above the drawer, in the upper half of the box.
    expect(face.userData.openingCenterYIn as number).toBeGreaterThan(0);
  });

  it("keeps the configured front contract intact", () => {
    expect(resolvedThreeDFaceLayout({
      masterCode: "BMC30",
      description: '30" Microwave Base Cabinet',
      placementType: "base",
      openingType: "top",
      numberOfDoors: 0,
      numberOfDrawers: 1,
    })).toEqual({ hasConfiguredOpening: true, doorCount: 0, drawerCount: 1 });
  });

  it("leaves an ordinary base with a plain configured opening alone", () => {
    const meshes = build({
      ...microwaveBase,
      masterCode: "B30",
      description: '30" Base Cabinet',
      subCategory: "Standard Base",
      numberOfDrawers: 0,
      openingWidth: 27,
      openingHeight: 17,
    });
    // No microwave face on a cabinet that is not a microwave base.
    expect(count(meshes, "microwaveFront")).toBe(0);
    expect(count(meshes, "configuredOpening")).toBe(1);
  });
});
