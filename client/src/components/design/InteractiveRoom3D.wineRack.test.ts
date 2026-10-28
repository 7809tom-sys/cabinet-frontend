import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, resolvedThreeDSpecialtyProfile, threeDLatticeRackLayout } from "./InteractiveRoom3D";
import { PLATE_RACK_FRAME_IN, plateRackDividerLayout } from "@/lib/plateRackLayout";

// Kept out of InteractiveRoom3D.test.ts so these run even while that file's
// __fixtures__/fourAnchorGapKitchen.json import is missing from the repo.
describe("wine rack lattice render", () => {
  const rackSku = (overrides: Record<string, unknown> = {}) => ({
    placementUid: "wrc",
    distributorSkuId: 1,
    cabinetId: 1,
    masterCode: "WRC3015",
    description: "Wall Wine Rack Cabinet",
    placementType: "wall",
    width: 30,
    height: 15,
    depth: 12,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    ...overrides,
  }) as Parameters<typeof addCabinet>[1];

  it("clips every diagonal slat inside the opening", () => {
    const { slats } = threeDLatticeRackLayout(30 / 12, 15 / 12);
    expect(slats.length).toBeGreaterThan(10);
    for (const slat of slats) {
      const half = (slat.length / 2) / Math.SQRT2;
      const dy = slat.family === "rising" ? half : -half;
      for (const sign of [-1, 1]) {
        const x = slat.x + sign * half;
        const y = slat.y + sign * dy;
        expect(Math.abs(x)).toBeLessThanOrEqual(30 / 24 + 1e-6);
        expect(Math.abs(y)).toBeLessThanOrEqual(15 / 24 + 1e-6);
      }
    }
  });

  it("uses the same diamond size standing up or laid on its side", () => {
    const horizontal = threeDLatticeRackLayout(30 / 12, 15 / 12);
    const vertical = threeDLatticeRackLayout(15 / 12, 30 / 12);
    expect(horizontal.pitch).toBeCloseTo(vertical.pitch, 8);
    expect(vertical.slats).toHaveLength(horizontal.slats.length);
    expect(vertical.bottleCells).toHaveLength(horizontal.bottleCells.length);
  });

  it("holds 11 bottles in the WRC3015 / LWR3015 opening, either way up", () => {
    // 30 x 15 box less the 0.045 ft (about 1/2in) painted panels on each side.
    const panel = 0.045;
    const interiorWidth = 30 / 12 - panel * 2;
    const interiorHeight = 15 / 12 - panel * 2;
    for (const [width, height] of [[interiorWidth, interiorHeight], [interiorHeight, interiorWidth]]) {
      const layout = threeDLatticeRackLayout(width, height);
      expect(layout.bottleCells).toHaveLength(11);
      // Each cell is a whole diamond inside the opening, wide enough for a
      // standard 750 ml bottle (about 3 1/4in across).
      expect((layout.pitch * 12) / Math.SQRT2).toBeGreaterThan(3.25);
      for (const cell of layout.bottleCells) {
        expect(Math.abs(cell.x) + layout.pitch / 2).toBeLessThanOrEqual(width / 2 + 1e-9);
        expect(Math.abs(cell.y) + layout.pitch / 2).toBeLessThanOrEqual(height / 2 + 1e-9);
      }
    }
  });

  it("builds an open-front rack with two crossing slat layers in wood, no solid recess", () => {
    const root = new THREE.Group();
    addCabinet(root, rackSku(), null, {}, 144, 120, "#e8e6df", "#f8f8f6");
    const cabinet = root.children.find((node) => node.userData.placedUid === "wrc");
    expect(cabinet).toBeDefined();
    const slats: THREE.Object3D[] = [];
    let recess = 0;
    cabinet!.traverse((node) => {
      if (node.userData.wineRackSlat) slats.push(node);
      if (node.userData.specialtyProfile === "face-pattern" && (node as THREE.Mesh).isMesh) recess += 1;
    });
    expect(recess).toBe(0);
    expect(new Set(slats.map((node) => node.userData.latticeLayer))).toEqual(new Set(["front", "rear"]));
    expect(new Set(slats.map((node) => node.userData.latticeFamily))).toEqual(new Set(["rising", "falling"]));
    const frontZ = Math.min(...slats.filter((n) => n.userData.latticeLayer === "front").map((n) => n.position.z));
    const rearZ = Math.max(...slats.filter((n) => n.userData.latticeLayer === "rear").map((n) => n.position.z));
    expect(frontZ).toBeGreaterThan(rearZ);
    const slatMaterial = (slats[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(slatMaterial.color.getHexString()).not.toBe("e8e6df");
  });

  it("does not turn a wine cooler appliance into a lattice rack", () => {
    const root = new THREE.Group();
    addCabinet(root, rackSku({ placementUid: "wine-cooler", masterCode: "WINE-24", description: "Wine cooler", placementType: "appliance", width: 24, height: 34.5, depth: 24 }), null, {}, 144, 120, "#e8e6df", "#f8f8f6");
    let slats = 0;
    root.traverse((node) => { if (node.userData.wineRackSlat) slats += 1; });
    expect(slats).toBe(0);
  });

  it("renders a plate rack such as PR30 with slats, not the wine rack lattice", () => {
    const plateRack = { masterCode: "PR30", description: "Plate Rack", graphicType: null, customProfile: null, facePattern: null, cornerType: null };
    expect(resolvedThreeDSpecialtyProfile(plateRack)).toEqual({ kind: "face-pattern", pattern: "slats" });
    expect(resolvedThreeDSpecialtyProfile({ ...plateRack, masterCode: "WPR30", description: "Wall Plate Rack" })).toEqual({ kind: "face-pattern", pattern: "slats" });
    // An admin-set pattern still wins.
    expect(resolvedThreeDSpecialtyProfile({ ...plateRack, facePattern: "lattice" })).toEqual({ kind: "face-pattern", pattern: "lattice" });
    expect(resolvedThreeDSpecialtyProfile({ ...plateRack, masterCode: "LWR3015", description: "Wine Rack Wall Cabinet" })).toEqual({ kind: "face-pattern", pattern: "lattice" });
    const root = new THREE.Group();
    addCabinet(root, rackSku({ placementUid: "pr30", masterCode: "PR30", description: "Plate Rack" }), null, {}, 144, 120, "#e8e6df", "#f8f8f6");
    let slats = 0;
    let slatFaces = 0;
    root.traverse((node) => {
      if (node.userData.wineRackSlat) slats += 1;
      if (node.userData.specialtyProfile === "face-pattern" && node.userData.pattern === "slats") slatFaces += 1;
    });
    expect(slats).toBe(0);
    expect(slatFaces).toBeGreaterThan(0);
  });

  it("gives PR30 10 dowel dividers holding 11 plates inside a face frame", () => {
    const layout = plateRackDividerLayout(30 - PLATE_RACK_FRAME_IN * 2);
    expect(layout.plates).toBe(11);
    expect(layout.dividers).toHaveLength(10);
    const root = new THREE.Group();
    addCabinet(root, rackSku({ placementUid: "pr30", masterCode: "PR30", description: "Plate Rack", width: 30, height: 15 }), null, {}, 144, 120, "#e8e6df", "#f8f8f6");
    const dividers: THREE.Mesh[] = [];
    const frame: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (node.userData.plateRackDivider) dividers.push(node as THREE.Mesh);
      if (node.userData.plateRackFaceFrame) frame.push(node as THREE.Mesh);
    });
    expect(dividers).toHaveLength(10);
    expect(frame).toHaveLength(4);
    const innerHalfWidth = (30 / 2 - PLATE_RACK_FRAME_IN) / 12;
    for (const divider of dividers) expect(Math.abs(divider.position.x)).toBeLessThan(innerHalfWidth);
  });
});
