import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  CLOSET_DL_SHAKER_FRAME_IN,
  CLOSET_SLAB_BELOW_IN,
  closetDlShakerMembers,
  closetFrontIsSlab,
  createClosetDlShakerFront,
} from "./closetShakerFront";

describe("closet DL shaker fronts", () => {
  it("keeps a 2.75 inch square frame and a flat center on a door-sized front", () => {
    const members = closetDlShakerMembers(24, 30);
    expect(CLOSET_DL_SHAKER_FRAME_IN).toBe(2.75);
    expect(members.railIn).toBeCloseTo(2.75, 5);
    expect(members.stileIn).toBeCloseTo(2.75, 5);
    expect(members.centerWidthIn).toBeCloseTo(24 - 5.5, 5);
    expect(members.centerHeightIn).toBeCloseTo(30 - 5.5, 5);
    expect(members.slab).toBe(false);

    const front = createClosetDlShakerFront(24, 30, "#774d3a", "door");
    expect(front.userData.glassDoor).toBe(false);
    expect(front.userData.insideEdgeProfile).toBe("square");
    expect(front.userData.dlShakerPieces).toBe(5);
    expect(front.userData.slabFront).toBeUndefined();
    const boxes = front.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    const pieces = boxes.filter((mesh) => mesh.userData.physicalRail || mesh.userData.dlShakerCenterSlab);
    expect(pieces).toHaveLength(5);
    for (const mesh of pieces) {
      expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
      expect(mesh.userData.squareCorner).toBe(true);
    }
    const center = boxes.find((mesh) => mesh.userData.dlShakerCenterSlab);
    const rails = boxes.filter((mesh) => mesh.userData.physicalRail);
    expect(center).toBeTruthy();
    expect(rails).toHaveLength(4);
    expect(center!.position.z).toBeLessThan(rails[0]!.position.z);

    const shadows = boxes.filter((mesh) => mesh.userData.closetShadowLine === "shadow");
    const highlights = boxes.filter((mesh) => mesh.userData.closetShadowLine === "highlight");
    expect(shadows.length).toBeGreaterThanOrEqual(2);
    expect(highlights.length).toBeGreaterThanOrEqual(2);
    for (const strip of [...shadows, ...highlights]) {
      expect(strip.userData.squareCorner).toBeUndefined();
      expect(strip.userData.physicalRail).toBeUndefined();
    }
  });

  it("paints Stone Gray and Slate Rift as gray, not brand green", () => {
    for (const hex of ["#8d8f92", "#555553"]) {
      const front = createClosetDlShakerFront(24, 30, hex, "door");
      const boxes = front.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
      const rails = boxes.filter((mesh) => mesh.userData.physicalRail);
      expect(rails.length).toBeGreaterThan(0);
      for (const mesh of rails) {
        expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(hex.slice(1));
        expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).not.toBe("244338");
        expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).not.toBe("dedac6");
      }
      const center = boxes.find((mesh) => mesh.userData.dlShakerCenterSlab);
      expect((center?.material as THREE.MeshStandardMaterial).color.getHexString()).not.toBe("244338");
    }
  });

  it("renders a short drawer as a plain flat slab", () => {
    expect(CLOSET_SLAB_BELOW_IN).toBe(7);
    expect(closetFrontIsSlab(24, 5)).toBe(true);
    const members = closetDlShakerMembers(24, 5);
    expect(members.slab).toBe(true);
    expect(members.railIn).toBe(0);
    expect(members.stileIn).toBe(0);
    expect(members.centerWidthIn).toBe(24);
    expect(members.centerHeightIn).toBe(5);

    const front = createClosetDlShakerFront(24, 5, "#774d3a", "drawer");
    expect(front.name).toBe("dl-slab-front");
    expect(front.userData.glassDoor).toBe(false);
    expect(front.userData.panelConstruction).toBe("slab");
    expect(front.userData.selectedStyleFace).toBe("slab");
    expect(front.userData.physicalRails).toBe(false);
    expect(front.userData.dlShakerPieces).toBe(1);
    expect(front.userData.slabFront).toBe(true);
    const meshes = front.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]!.userData.slabFront).toBe(true);
    expect(meshes[0]!.userData.squareCorner).toBe(true);
    expect(meshes[0]!.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(meshes[0]!.geometry.parameters.height).toBeCloseTo((5 - 0.125) / 12, 6);
    expect(meshes.some((mesh) => mesh.userData.closetShadowLine)).toBe(false);
  });

  it("renders a narrow short drawer as a slab", () => {
    expect(closetFrontIsSlab(15, 5)).toBe(true);
    const members = closetDlShakerMembers(15, 5);
    expect(members.slab).toBe(true);
    const front = createClosetDlShakerFront(15, 5, "#774d3a", "drawer");
    expect(front.userData.slabFront).toBe(true);
  });

  it("keeps a 7 inch drawer as a framed shaker", () => {
    expect(closetFrontIsSlab(24, 7)).toBe(false);
    const members = closetDlShakerMembers(24, 7);
    expect(members.slab).toBe(false);
    expect(members.railIn).toBeCloseTo(2.75, 5);
    expect(members.stileIn).toBeCloseTo(2.75, 5);
    const front = createClosetDlShakerFront(24, 7, "#774d3a", "drawer");
    expect(front.userData.slabFront).toBeUndefined();
    expect(front.userData.dlShakerPieces).toBe(5);
  });
});
