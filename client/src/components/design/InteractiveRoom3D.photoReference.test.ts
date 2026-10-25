import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { captureWithRoomWallsHidden, photoReferenceRoomWallMeshes } from "./InteractiveRoom3D";

describe("locked Gemini photo reference capture", () => {
  const scene = () => {
    const root = new THREE.Scene();
    const leftRoomWall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    leftRoomWall.userData.roomWall = true;
    const backRoomWall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    backRoomWall.userData.roomWall = true;
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    cabinet.userData.placementUid = "glass-stacker";
    const stackerGlass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    stackerGlass.userData.placementUid = "glass-stacker";
    root.add(leftRoomWall, backRoomWall, cabinet, stackerGlass);
    return { root, leftRoomWall, backRoomWall, cabinet, stackerGlass };
  };

  it("selects every and only Designer room-wall mesh, including a currently invisible wall", () => {
    const { root, leftRoomWall, backRoomWall, cabinet } = scene();
    backRoomWall.visible = false;
    expect(photoReferenceRoomWallMeshes(root)).toEqual([leftRoomWall, backRoomWall]);
    expect(photoReferenceRoomWallMeshes(root)).not.toContain(cabinet);
  });

  it("hides all Designer room walls only for the capture and leaves the entire cabinet stack visible", () => {
    const { root, leftRoomWall, backRoomWall, cabinet, stackerGlass } = scene();
    const capture = vi.fn(() => ({
      walls: [leftRoomWall.visible, backRoomWall.visible],
      cabinets: [cabinet.visible, stackerGlass.visible],
    }));
    expect(captureWithRoomWallsHidden(root, capture)).toEqual({ walls: [false, false], cabinets: [true, true] });
    expect(leftRoomWall.visible).toBe(true);
    expect(backRoomWall.visible).toBe(true);
    expect(capture).toHaveBeenCalledOnce();
  });

  it("restores the existing visibility of an already hidden wall if capture throws", () => {
    const { root, leftRoomWall, backRoomWall } = scene();
    backRoomWall.visible = false;
    expect(() => captureWithRoomWallsHidden(root, () => { throw new Error("render failed"); })).toThrow("render failed");
    expect(leftRoomWall.visible).toBe(true);
    expect(backRoomWall.visible).toBe(false);
  });
});
