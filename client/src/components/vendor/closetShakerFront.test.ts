import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CLOSET_DL_SHAKER_FRAME_IN, closetDlShakerMembers, createClosetDlShakerFront } from "./closetShakerFront";

describe("closet DL shaker fronts", () => {
  it("keeps a 2.75 inch square frame and a flat center on a door-sized front", () => {
    const members = closetDlShakerMembers(24, 30);
    expect(CLOSET_DL_SHAKER_FRAME_IN).toBe(2.75);
    expect(members.railIn).toBeCloseTo(2.75, 5);
    expect(members.stileIn).toBeCloseTo(2.75, 5);
    expect(members.centerWidthIn).toBeCloseTo(24 - 5.5, 5);
    expect(members.centerHeightIn).toBeCloseTo(30 - 5.5, 5);

    const front = createClosetDlShakerFront(24, 30, "#774d3a", "door");
    expect(front.userData.glassDoor).toBe(false);
    expect(front.userData.insideEdgeProfile).toBe("square");
    const boxes = front.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    expect(boxes).toHaveLength(5);
    for (const mesh of boxes) {
      expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
      expect(mesh.userData.squareCorner).toBe(true);
    }
    const center = boxes.find((mesh) => mesh.userData.dlShakerCenterSlab);
    const rails = boxes.filter((mesh) => mesh.userData.physicalRail);
    expect(center).toBeTruthy();
    expect(rails).toHaveLength(4);
    expect(center!.position.z).toBeLessThan(rails[0]!.position.z);
  });

  it("does not invent a glass or beveled front for a short drawer", () => {
    const front = createClosetDlShakerFront(24, 5, "#774d3a", "drawer");
    expect(front.userData.glassDoor).toBe(false);
    expect(front.userData.panelConstruction).toBe("flat");
    const members = closetDlShakerMembers(24, 5);
    expect(members.centerHeightIn).toBeGreaterThan(0);
    expect(members.centerWidthIn).toBeGreaterThan(0);
  });
});
