// @vitest-environment jsdom
/**
 * Hard seam at the corner (Tom, Nov 14 2026): one off-white Shaker line rendered
 * cream on one wall and white on the other, and the SAME cabinet changed colour
 * when moved between walls. Auto Design faces carry a DLC solid-colour face crop,
 * so their doors, drawers and sides are drawn with tone mapping off. Drawers and
 * sides were divided by the light compensation; door faces were not, so a pale
 * door's full light sum went straight to the screen, clipping to white on walls
 * facing the old key light and staying cream on walls facing away.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DARK_STAIN_DOOR_LIGHTS, RESTORED_DOOR_LIGHTS } from "@shared/doorRenderLights";
import {
  addCabinet, addThreeDDesignerRoomLights, threeDCompensatedSolidFaceColor,
  threeDDesignerRoomCompensationRig, threeDDesignerRoomPhotoCompensation,
} from "./InteractiveRoom3D";

const SKU = {
  placementUid: "same-cabinet", masterCode: "B24", description: '24" Base',
  placementType: "base" as const, width: 24, depth: 24, height: 34.5,
  numberOfDoors: 1, numberOfDrawers: 1,
};
const profile = { doorStyle: "Shaker", doorPanelType: "shaker", railWidth: 3, stileWidth: 3, paintedFinish: true };
const transforms = [
  { x: 72, z: 12, rotation: 0 },
  { x: 12, z: 72, rotation: Math.PI / 2 },
  { x: 132, z: 72, rotation: -Math.PI / 2 },
];

// The Auto Design face path: a solid-colour face crop, no photo or overlay.
function build(finish: string, transform = transforms[0]) {
  const root = new THREE.Group();
  addCabinet(root, SKU, null, {}, 144, 144, finish, "#e9e7e2", profile, transform, null, undefined, {
    faceCrop: { solidColor: finish, doorSize: [1, 1], drawerSize: null, drawerSolidColor: finish, grainUrl: null },
  });
  const doors: THREE.MeshStandardMaterial[] = [], drawers: THREE.MeshStandardMaterial[] = [];
  root.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    if (mesh.userData.cabinetDrawerFront) drawers.push(mesh.material as THREE.MeshStandardMaterial);
    else if (mesh.userData.cabinetFront) doors.push(mesh.material as THREE.MeshStandardMaterial);
  });
  return { root, doors, drawers };
}

for (const finish of ["#f2f0e3", "#e3e4df", "#f0ead6"]) {
  it(`${finish}: doors and drawers share one compensated finish on the back, left and right walls`, () => {
    const colors = new Set<string>();
    for (const transform of transforms) {
      const { doors, drawers } = build(finish, transform);
      expect(doors.length).toBeGreaterThan(0);
      expect(drawers.length).toBeGreaterThan(0);
      const compensation = threeDDesignerRoomPhotoCompensation(finish);
      const expected = new THREE.Color(finish).multiply(new THREE.Color(compensation.hex)).getHexString();
      expect(expected).not.toBe(finish.slice(1)); // the old door face used the raw finish
      for (const material of [...doors, ...drawers]) {
        expect(material.map).toBeNull();
        expect(material.toneMapped).toBe(false);
        expect(material.color.getHexString()).toBe(expected);
        colors.add(material.color.getHexString());
      }
    }
    expect(colors.size).toBe(1);
  });
}

it("leaves tone-mapped solid faces unchanged", () => {
  expect(threeDCompensatedSolidFaceColor("#f2f0e3", null)).toBe("#f2f0e3");
});

for (const [name, studio] of [["standard", RESTORED_DOOR_LIGHTS], ["dark stain", DARK_STAIN_DOOR_LIGHTS]] as const) {
  it(`${name} rig: compensation uses the key light the room actually puts on every wall facing`, () => {
    const scene = new THREE.Scene();
    const lights = addThreeDDesignerRoomLights(scene, studio, 144, 120, 8);
    const rig = threeDDesignerRoomCompensationRig(studio);
    const amount = (position: readonly number[]) => position[2] / Math.hypot(...position);
    const expected = rig.key.intensity * amount(rig.key.position) + rig.fill.intensity * amount(rig.fill.position);
    for (const normal of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)]) {
      const actual = lights.reduce((sum, light) => {
        if (!(light instanceof THREE.DirectionalLight)) return sum;
        expect(light.color.getHexString()).toBe("ffffff");
        const direction = light.position.clone().sub(light.target.position).normalize();
        return sum + light.intensity * Math.max(0, direction.dot(normal));
      }, 0);
      expect(actual).toBeCloseTo(expected, 10);
    }
  });
}
