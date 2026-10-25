import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet } from "@/components/design/InteractiveRoom3D";
import { DEFAULT_ROOM, isCrownEligibleCabinet, removeOverlappingPlacements, placedFootprint, type PlacedCabinet } from "./design";
import { CLOSET_PARTS, closetPaletteByCategory, closetPartAsDesignCabinet, closetPartPrice, isMasterTracPlaceable, masterTracProduct } from "./closet";

describe("March 2022 MasterTrac catalog", () => {
  it("preserves every source SKU once, with positive List prices and no invoice fields", () => {
    expect(CLOSET_PARTS).toHaveLength(454);
    expect(new Set(CLOSET_PARTS.map((p) => p.sku)).size).toBe(454);
    expect(CLOSET_PARTS.every((p) => p.listEachUsd > 0 && p.listPackUsd > 0 && p.packQty > 0)).toBe(true);
    expect(JSON.stringify(CLOSET_PARTS)).not.toMatch(/invoice|wholesale|dealerPrice/i);
    expect(closetPaletteByCategory().flatMap((group) => group.items)).toHaveLength(454);
    expect(CLOSET_PARTS.filter((p) => p.placeable)).toHaveLength(147);
  });

  it("retains the SKU's actual board dimensions even if the nominal description is different", () => {
    const floorEnd = masterTracProduct("432514")!;
    expect(floorEnd.description).toContain('96"');
    expect(floorEnd.heightIn).toBe(94);
    expect(floorEnd.widthIn).toBe(0.75);
    expect(floorEnd.depthIn).toBe(14.5);
    expect(closetPartAsDesignCabinet(floorEnd)).toMatchObject({ masterCode: "432514", width: "0.75", height: "94", depth: "14.5" });
    const shelf = masterTracProduct("432527")!;
    expect(shelf.shape).toBe("shelf");
    expect(shelf.heightIn).toBe(0.75);
    expect(closetPartPrice(shelf.sku)).toBe(12.5);
  });

  it("keeps packaged accessories visible but non-placeable without a verified model", () => {
    const pack = masterTracProduct("419786")!;
    expect(pack.packQty).toBe(10);
    expect(pack.listPackUsd).toBe(180.68);
    expect(pack.placeable).toBe(false);
    expect(isMasterTracPlaceable(pack.sku)).toBe(false);
    expect(closetPartPrice("CL-PNL-24")).toBeNull();
  });

  it("renders a true ¾-inch shelf at its chosen elevation, with no kitchen carcass or countertop", () => {
    const shelf = masterTracProduct("432527")!;
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 0, cabinetId: 0, placementUid: "closet-shelf",
      masterCode: shelf.sku, description: shelf.description, placementType: "wall",
      width: shelf.widthIn, height: shelf.heightIn, depth: shelf.depthIn,
      mountBottom: 47.5, numberOfDoors: 0, numberOfDrawers: 0,
    }, null, {}, 144, 120, "#e6e3df", "#fefefe");
    expect(root.children).toHaveLength(1);
    const group = root.children[0] as THREE.Group;
    expect(group.userData.masterTracBoard).toMatchObject({ sku: "432527", shape: "shelf", thicknessIn: 0.75, bottomIn: 47.5 });
    expect(group.position.y * 12).toBeCloseTo(47.875, 4);
    const board = group.children.find((child) => child.userData.masterTracBoardSurface) as THREE.Mesh;
    expect(board).toBeTruthy();
    expect(board.children.some((child) => child.userData.masterTracBoardOutline)).toBe(true);
    const dims = new THREE.Vector3();
    new THREE.Box3().setFromObject(board).getSize(dims);
    expect(dims.x * 12).toBeCloseTo(12, 4);
    expect(dims.y * 12).toBeCloseTo(0.75, 4);
    expect(dims.z * 12).toBeCloseTo(14.5, 4);
    expect(group.children).toHaveLength(2); // board and matching edge band only
  });

  it("never adds kitchen crown to a hanging MasterTrac board", () => {
    const cabinet: PlacedCabinet = {
      uid: "p", cabinetId: 0, masterCode: "432527", category: "MasterTrac Closet",
      placement: "wall", x: 10, y: 10, width: 12, depth: 14.5, height: 0.75,
      rotation: 0, mountBottom: 42,
    };
    expect(isCrownEligibleCabinet(cabinet, DEFAULT_ROOM)).toBe(false);
  });

  it("keeps a dimensioned shelf flush between two MasterTrac hanging panels on saved-layout restore", () => {
    const part = (uid: string, code: string, x: number, bottom: number): PlacedCabinet => {
      const product = masterTracProduct(code)!;
      return {
        uid, cabinetId: 0, masterCode: code, description: product.description, category: "MasterTrac Closet",
        placement: "wall", x, y: 10, width: product.widthIn, height: product.heightIn,
        depth: product.depthIn, rotation: 0, mountBottom: bottom,
      };
    };
    const parts = [part("left", "432132", 40, 36), part("right", "432132", 52.75, 36), part("shelf", "432527", 40.75, 44)];
    expect(placedFootprint(parts[0]).w).toBe(0.75);
    const restored = removeOverlappingPlacements(parts, { ...DEFAULT_ROOM, width: 144, depth: 120 });
    expect(restored.rejected.map((p) => p.uid)).toEqual([]);
    expect(restored.placed.map((p) => p.uid)).toEqual(["left", "right", "shelf"]);
  });
});
