import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { addFurniture, bathroomFurnitureTransform } from "./InteractiveRoom3D";
import { FURNITURE_CATALOG, furnitureFootprint, furniturePlanFrame, makeFurniture } from "@/lib/design";
import { bathroomTubWallParallelPlacement, rotateBathroomFurniture } from "@/lib/bathroomPlanning";

describe("Bathroom tub plan and 3D parity", () => {
  it.each(["pelican-tub-pl-02146-59", "pelican-tub-pl-02146-67", "pelican-tub-pl-02563-67", "pelican-tub-pl-02562-59"])("renders a closed rounded-rectangle %s inside its exact supplier envelope", (id) => {
    const item = makeFurniture(id, 30, 20);
    const root = new THREE.Group();
    addFurniture(root, item);
    const group = root.children[0] as THREE.Group;
    // Every freestanding tub now shares one closed shell: exterior, interior,
    // rim, a capped basin floor, and a capped underside.
    expect(group.children.some((child) => child.userData.pelicanBathroomFixturePart === "freestanding-tub-exterior")).toBe(true);
    expect(group.children.some((child) => child.userData.pelicanBathroomFixturePart === "freestanding-tub-well")).toBe(true);
    expect(group.children.some((child) => child.userData.pelicanBathroomFixturePart === "freestanding-tub-base")).toBe(true);
    expect(group.children.some((child) => child.userData.pelicanBathroomFixturePart === "rectangular-freestanding-tub-shell")).toBe(false);
    const body = group.children.find((child) => child.userData.pelicanBathroomFixturePart === "freestanding-tub-exterior")!;
    const box = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
    const def = FURNITURE_CATALOG.find((entry) => entry.id === id)!;
    expect(box.x * 12).toBeCloseTo(def.w, 2);
    expect(box.z * 12).toBeCloseTo(def.d, 2);
  });

  it("rotates the same tub through four matching 2D/3D footprints without moving its center", () => {
    let item = makeFurniture("pelican-tub-pl-02141-67", 55, 40);
    const def = FURNITURE_CATALOG.find((entry) => entry.id === item.defId)!;
    for (let turn = 0; turn < 4; turn++) {
      const frame = furniturePlanFrame(item)!;
      const pose = bathroomFurnitureTransform(item);
      expect(pose.x * 12).toBeCloseTo(frame.centerX);
      expect(pose.z * 12).toBeCloseTo(frame.centerY);
      expect(pose.rotation).toBeCloseTo(-item.rotation * Math.PI / 180);
      const root = new THREE.Group();
      addFurniture(root, item);
      root.updateMatrixWorld(true);
      const body = (root.children[0] as THREE.Group).children.find((child) => child.userData.pelicanBathroomFixturePart === "freestanding-tub-exterior")!;
      const box = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
      const footprint = furnitureFootprint(item, def);
      expect(box.x * 12).toBeLessThanOrEqual(footprint.w + 0.001);
      expect(box.z * 12).toBeLessThanOrEqual(footprint.d + 0.001);
      item = rotateBathroomFurniture(item, { width: 180, depth: 160 });
    }
  });

  it("defaults an oversized soaking tub parallel to the nearest wall with no zone sizing", () => {
    expect(bathroomTubWallParallelPlacement(makeFurniture("pelican-tub-pl-02141-67", 45, 14), { width: 120, depth: 96 }).rotation).toBe(90);
    const tub = makeFurniture("pelican-tub-pl-02141-67", 10, 10);
    expect(furniturePlanFrame(tub)).toMatchObject({
      width: FURNITURE_CATALOG.find((entry) => entry.id === tub.defId)!.w,
      depth: FURNITURE_CATALOG.find((entry) => entry.id === tub.defId)!.d,
    });
  });

  it("wires both plan and 3D views to the same centered fixture rotation with no zone Attributes action", () => {
    const host = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
    const plan = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");
    const threeD = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(host.match(/onRotateFurn=\{rotateFurniture\}/g)).toHaveLength(2);
    expect(host.match(/onRotateFurniture=\{rotateFurniture\}/g)).toHaveLength(2);
    expect(host).not.toContain("onOpenFurnitureAttributes");
    expect(plan).toContain("furniturePlanFrame(f)");
    expect(plan).not.toContain("bathroomPlanningZone");
    expect(plan).not.toContain("bathroom-zone-attributes");
    expect(threeD).not.toContain("bathroom-zone");
  });
});
