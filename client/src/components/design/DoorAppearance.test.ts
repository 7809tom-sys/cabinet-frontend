import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { addWallOpening } from "./InteractiveRoom3D";
import { OPENINGS, makeOpening } from "@/lib/design";

const room = { width:120, depth:96, ceilingHeight:96 };
const door = makeOpening(OPENINGS.find((item) => item.key === "interior-door")!, "left", room);
const parts = (root: THREE.Group) => { const result: THREE.Mesh[] = []; root.traverse((obj) => { if (obj instanceof THREE.Mesh) result.push(obj); }); return result; };

describe("room door 3D appearance and attribute wiring", () => {
  it("draws a white translucent slab and panels with no opaque backing", () => {
    const root = new THREE.Group();
    addWallOpening(root, door, room);
    const meshes = parts(root);
    const slab = meshes.find((m) => m.userData.architecturalDoorSlab)!;
    expect((slab.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("ffffff");
    expect(slab.material).toMatchObject({ transparent:true, opacity:.25, depthWrite:false });
    expect(meshes.find((m)=>m.userData.architecturalOpeningBacking)?.material).toMatchObject({ opacity:0, depthWrite:false });
    for (const panel of meshes.filter((m)=>m.userData.architecturalDoorPanel)) {
      expect((panel.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("ffffff");
      expect(panel.material).toMatchObject({ transparent:true, opacity:.15, depthWrite:false });
    }
  });
  it("renders exact changed door size and paint without changing the wall anchor", () => {
    const root = new THREE.Group();
    addWallOpening(root, { ...door, width:32.5, height:84, doorColor:"#aabbcc", doorOpacity:.1 }, room);
    const slab = parts(root).find((m) => m.userData.architecturalDoorSlab)!;
    expect((slab.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("aabbcc");
    expect(slab.material).toMatchObject({ opacity:.1 });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(slab).getSize(new THREE.Vector3());
    expect(box.z * 12).toBeCloseTo(32.5 - .08*12);
    expect(box.y * 12).toBeCloseTo(84 - .08*12);
    expect(root.children[0].userData.openingUid).toBe(door.uid);
  });
  it.each(["top", "bottom", "left", "right"] as const)("swings inward 90 degrees on the %s wall without moving the frame", (side) => {
    for (const hinge of ["left", "right"] as const) {
      const root = new THREE.Group();
      addWallOpening(root, { ...door, side, doorOpenAngle:90, doorHinge:hinge }, room);
      root.updateMatrixWorld(true);
      const pivot = root.children[0].children.find((obj) => obj.userData.architecturalDoorLeafPivot)!;
      expect(pivot.userData).toMatchObject({ openAngle:90, hinge });
      const slab = parts(root).find((obj) => obj.userData.architecturalDoorSlab)!;
      const position = slab.getWorldPosition(new THREE.Vector3());
      if (side === "top") expect(position.z).toBeGreaterThan(.2);
      if (side === "bottom") expect(position.z).toBeLessThan(room.depth/12-.2);
      if (side === "left") expect(position.x).toBeGreaterThan(.2);
      if (side === "right") expect(position.x).toBeLessThan(room.width/12-.2);
      const frame = parts(root).find((obj) => obj.userData.architecturalOpeningTrim)!;
      expect(frame.parent).toBe(root.children[0]);
    }
  });
  it("preserves existing window glass and legacy closet bifold material", () => {
    const root = new THREE.Group();
    addWallOpening(root, { ...door, kind:"window" }, room);
    expect(parts(root).find((m)=>m.userData.architecturalOpeningBacking)?.material).toMatchObject({ opacity:1 });
    const bifold = new THREE.Group();
    addWallOpening(bifold, { ...door, doorStyle:"bifold" }, room);
    expect(parts(bifold).find((m)=>m.userData.architecturalBifoldLeaf)?.material).toMatchObject({ opacity:.38 });
  });
  it("uses the same door attributes callbacks from plan, tablet and 3D", () => {
    const host = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url),"utf8");
    const renderer = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url),"utf8");
    const plan = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url),"utf8");
    expect(host.match(/onOpenDoorEditor=\{openDoorAttributes\}/g)).toHaveLength(2);
    expect(host.match(/onOpenDoorAttributes=\{openDoorAttributes\}/g)).toHaveLength(2);
    expect(host.includes("<DoorAttributesDialog")).toBe(true);
    expect(renderer.match(/if \(openDoorAtPoint\(event.clientX, event.clientY\)\)/g)).toHaveLength(3);
    expect(plan.includes('if (opening.kind === "door") onOpenDoorAttributes?.(opening.uid);')).toBe(true);
  });
});
