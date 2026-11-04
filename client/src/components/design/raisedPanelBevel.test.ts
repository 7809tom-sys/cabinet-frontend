import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  RAISED_PANEL_READABLE_BEVEL_DEPTH_IN,
  attachSlopedRaisedPanel,
  createSlopedRaisedPanelBevelGeometry,
  effectiveRaisedBevelDepthIn,
  threeDFaceUsesRaisedPanelBevel,
} from "./raisedPanelBevel";

describe("raised panel bevel", () => {
  it("keys the slope on the resolved profile, including a non-Lumina raised style", () => {
    expect(threeDFaceUsesRaisedPanelBevel({
      profileKind: "shaker",
      panelConstruction: "raised",
      drawerFrontType: "five-piece-raised",
      faceRole: "door",
    })).toBe(true);
    expect(threeDFaceUsesRaisedPanelBevel({
      profileKind: "raised",
      panelConstruction: "flat",
      faceRole: "door",
    })).toBe(true);
    expect(threeDFaceUsesRaisedPanelBevel({
      profileKind: "shaker",
      panelConstruction: "flat",
      drawerFrontType: "five-piece-raised",
      faceRole: "drawer",
    })).toBe(true);
    expect(threeDFaceUsesRaisedPanelBevel({
      profileKind: "shaker",
      panelConstruction: "flat",
      drawerFrontType: "five-piece-raised",
      faceRole: "door",
    })).toBe(false);
    expect(threeDFaceUsesRaisedPanelBevel({
      profileKind: "raised",
      panelConstruction: "raised",
      drawerFrontType: "slab",
      faceRole: "drawer",
    })).toBe(false);
    expect(threeDFaceUsesRaisedPanelBevel({
      profileKind: "shaker",
      panelConstruction: "flat",
      drawerFrontType: "slab",
      faceRole: "door",
    })).toBe(false);
    expect(threeDFaceUsesRaisedPanelBevel({
      profileKind: "raised",
      panelConstruction: "raised",
      faceRole: "door",
      forceGlassFrame: true,
    })).toBe(false);
  });

  it("keeps the raised profile on door and drawer fronts and off every other cabinet surface", () => {
    for (const faceRole of ["side", "left", "right", "top", "bottom", "back", "end-panel", "end-skin", "carcass", "face-frame", "toe-kick", "shelf", "interior"]) {
      expect(threeDFaceUsesRaisedPanelBevel({
        profileKind: "raised",
        panelConstruction: "raised",
        drawerFrontType: "five-piece-raised",
        faceRole,
      }), faceRole).toBe(false);
    }
    for (const faceRole of ["door", "drawer"] as const) {
      expect(threeDFaceUsesRaisedPanelBevel({
        profileKind: "raised",
        panelConstruction: "raised",
        faceRole,
      }), faceRole).toBe(true);
    }
  });

  it("builds sloped trapezoid faces with a darker bottom slope", () => {
    const geometry = createSlopedRaisedPanelBevelGeometry(0.8, 1.4, 0.06, RAISED_PANEL_READABLE_BEVEL_DEPTH_IN / 12);
    const normals = geometry.getAttribute("normal");
    const colors = geometry.getAttribute("color");
    expect(geometry.type).not.toBe("BoxGeometry");
    expect(geometry.userData.sharedRaisedPanelBevel).toBe(true);
    let slopesUp = false;
    let slopesDown = false;
    let slopesLeft = false;
    let slopesRight = false;
    let light = 0;
    let lightCount = 0;
    let dark = 0;
    let darkCount = 0;
    for (let index = 0; index < normals.count; index++) {
      const nx = normals.getX(index);
      const ny = normals.getY(index);
      const nz = normals.getZ(index);
      expect(nz).toBeGreaterThan(0.15);
      if (ny > 0.2) slopesUp = true;
      if (ny < -0.2) slopesDown = true;
      if (nx < -0.2) slopesLeft = true;
      if (nx > 0.2) slopesRight = true;
      if (ny > 0.2) {
        light += colors.getX(index);
        lightCount += 1;
      }
      if (ny < -0.2) {
        dark += colors.getX(index);
        darkCount += 1;
      }
    }
    expect(slopesUp && slopesDown && slopesLeft && slopesRight).toBe(true);
    expect(light / lightCount).toBeGreaterThan(dark / darkCount);

    const again = createSlopedRaisedPanelBevelGeometry(0.8, 1.4, 0.06, RAISED_PANEL_READABLE_BEVEL_DEPTH_IN / 12);
    expect(again).toBe(geometry);
    expect(effectiveRaisedBevelDepthIn(0.28)).toBe(RAISED_PANEL_READABLE_BEVEL_DEPTH_IN);
    expect(effectiveRaisedBevelDepthIn(0.5)).toBe(0.5);
  });

  it("marks the attached bevel sloped and keeps a dark recess groove", () => {
    const parent = new THREE.Group();
    const center = new THREE.MeshStandardMaterial({ color: "#f4f1ea" });
    attachSlopedRaisedPanel(parent, {
      outerWidth: 0.7,
      outerHeight: 1.2,
      bevelWidth: 0.06,
      bevelDepth: 0.45 / 12,
      faceColor: "#f7f4ef",
      insideEdgeProfile: "bevel",
      drawerFrontType: "five-piece-raised",
      centerMaterial: center,
      faceRole: "door",
    });
    const bevels: THREE.Object3D[] = [];
    const grooves: THREE.Object3D[] = [];
    parent.traverse((node) => {
      if (node.userData.raisedPanelBevel) bevels.push(node);
      if (node.userData.raisedPanelGroove) grooves.push(node);
    });
    expect(bevels).toHaveLength(1);
    expect(bevels[0]?.userData.sloped).toBe(true);
    expect(grooves).toHaveLength(1);
    const grooveMaterial = (grooves[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(grooveMaterial.color.getHexString()).toBe("0b0908");
    expect(grooveMaterial.opacity).toBeGreaterThan(0.9);
    center.dispose();
  });

  it("attaches nothing when the surface is a cabinet side, top, bottom, or end skin", () => {
    const center = new THREE.MeshStandardMaterial({ color: "#f4f1ea" });
    for (const faceRole of ["side", "top", "bottom", "end-panel", "carcass", "face-frame"]) {
      const parent = new THREE.Group();
      attachSlopedRaisedPanel(parent, {
        outerWidth: 0.7,
        outerHeight: 1.2,
        bevelWidth: 0.06,
        bevelDepth: 0.45 / 12,
        faceColor: "#f7f4ef",
        insideEdgeProfile: "bevel",
        centerMaterial: center,
        faceRole,
      });
      expect(parent.children, faceRole).toHaveLength(0);
    }
    // The same call on a door front still builds the full raised treatment.
    const door = new THREE.Group();
    attachSlopedRaisedPanel(door, {
      outerWidth: 0.7,
      outerHeight: 1.2,
      bevelWidth: 0.06,
      bevelDepth: 0.45 / 12,
      faceColor: "#f7f4ef",
      insideEdgeProfile: "bevel",
      centerMaterial: center,
      faceRole: "door",
    });
    expect(door.children.length).toBeGreaterThan(0);
    expect(door.children.some((node) => node.userData.raisedPanelBevel === true)).toBe(true);
    expect(door.children.some((node) => node.userData.raisedCenterPanel === true)).toBe(true);
    center.dispose();
  });
});
