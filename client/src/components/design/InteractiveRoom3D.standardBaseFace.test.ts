import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, resolvedThreeDDrawerRows, threeDCabinetFrontColumnLayout, threeDDrawerZoneHeight } from "./InteractiveRoom3D";

function renderBase(overrides: Partial<Parameters<typeof addCabinet>[1]>) {
  const root = new THREE.Group();
  addCabinet(root, {
    distributorSkuId: 1,
    cabinetId: 1,
    masterCode: "B42",
    description: '42" 2 Door 2 Drawer Base Cabinet with Adjustable Shelf',
    placementType: "base",
    width: 42,
    height: 34.5,
    depth: 24,
    numberOfDoors: 2,
    numberOfDrawers: 2,
    drawerLayout: null,
    ...overrides,
  }, null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: "shaker" });
  const drawers: THREE.Mesh[] = [];
  const doors: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.userData.cabinetFront) return;
    if (node.userData.cabinetDrawerFront) drawers.push(node);
    else doors.push(node);
  });
  return {
    doors: doors.sort((a, b) => a.position.x - b.position.x),
    drawers: drawers.sort((a, b) => a.position.x - b.position.x),
  };
}

function widths(meshes: THREE.Mesh[]) {
  return meshes.map((mesh) => (mesh.geometry as THREE.BoxGeometry).parameters.width);
}

describe("standard door base 3D fronts", () => {
  it("draws B33, B36, B39, and B42 as two doors under one row of two drawers when no layout is saved", () => {
    for (const [masterCode, width] of [["B33", 33], ["B36", 36], ["B39", 39], ["B42", 42]] as const) {
      const rows = resolvedThreeDDrawerRows({
        masterCode,
        drawerLayout: null,
        numberOfDoors: 1,
        numberOfDrawers: 1,
      }, 0.5, 1);
      expect(rows).toEqual([{ count: 2, height: 0.5 }]);
      const { doors, drawers } = renderBase({
        masterCode,
        width,
        description: `${width}" base`,
        numberOfDoors: 1,
        numberOfDrawers: 1,
        drawerLayout: null,
      });
      expect(doors).toHaveLength(2);
      expect(drawers).toHaveLength(2);
      expect(drawers[0]!.position.y).toBeCloseTo(drawers[1]!.position.y, 6);
      expect(Math.min(...drawers.map((drawer) => drawer.position.y))).toBeGreaterThan(Math.max(...doors.map((door) => door.position.y)));
      const columns = threeDCabinetFrontColumnLayout(width / 12, 2);
      expect(widths(drawers)).toEqual([
        expect.closeTo(columns.columnWidth, 6),
        expect.closeTo(columns.columnWidth, 6),
      ]);
      expect(widths(drawers)[0]).toBeLessThan(width / 12 / 2);
      expect((drawers[0]!.geometry as THREE.BoxGeometry).parameters.height).toBeCloseTo(0.5 - 0.025, 6);
    }
  });

  it("keeps B24, B27, and B30 as two doors under one full-width drawer even when numberOfDrawers is 2", () => {
    for (const [masterCode, width] of [["B24", 24], ["B27", 27], ["B30", 30]] as const) {
      const zone = threeDDrawerZoneHeight({
        availableHeight: 34.5 / 12 - 0.08,
        drawerCount: 2,
        doorCount: 2,
        hasConfiguredOpening: false,
        placement: "base",
        masterCode,
      });
      expect(zone).toBeCloseTo(0.5, 6);
      const { doors, drawers } = renderBase({
        masterCode,
        width,
        description: `${width}" base, 1 or 2 drawers`,
        numberOfDoors: 2,
        numberOfDrawers: 2,
        drawerLayout: null,
      });
      expect(doors).toHaveLength(2);
      expect(drawers).toHaveLength(1);
      expect(drawers[0]!.position.x).toBeCloseTo(0, 6);
      const columns = threeDCabinetFrontColumnLayout(width / 12, 1);
      expect(widths(drawers)[0]).toBeCloseTo(columns.columnWidth, 6);
    }
  });

  it("keeps B12, B15, B18, and B21 as one door and one full-width drawer when the stored door count is 2", () => {
    for (const [masterCode, width] of [["B12", 12], ["B15", 15], ["B18", 18], ["B21", 21]] as const) {
      const { doors, drawers } = renderBase({
        masterCode,
        width,
        description: "Base Cabinet",
        numberOfDoors: 2,
        numberOfDrawers: 2,
        drawerLayout: null,
      });
      expect(doors).toHaveLength(1);
      expect(drawers).toHaveLength(1);
      expect(drawers[0]!.position.x).toBeCloseTo(0, 6);
    }
  });

  it("lets a saved drawerLayout of one column override the B42 reference", () => {
    const rows = resolvedThreeDDrawerRows({
      masterCode: "B42",
      drawerLayout: JSON.stringify([{ count: 1 }]),
      numberOfDoors: 2,
      numberOfDrawers: 2,
    }, 0.5, 2);
    expect(rows).toEqual([{ count: 1, height: 0.5 }]);
    const { doors, drawers } = renderBase({
      drawerLayout: JSON.stringify([{ count: 1 }]),
      numberOfDrawers: 2,
    });
    expect(doors).toHaveLength(2);
    expect(drawers).toHaveLength(1);
    expect(widths(drawers)[0]).toBeGreaterThan(42 / 12 * 0.9);
  });

  it("still stacks a drawer-only base instead of using the door-base reference", () => {
    const rows = resolvedThreeDDrawerRows({
      masterCode: "3-DB30",
      numberOfDoors: 0,
      numberOfDrawers: 3,
      drawerLayout: null,
    }, 2, 3, true);
    expect(rows.map((row) => row.count)).toEqual([1, 1, 1]);
    expect(rows).toHaveLength(3);
  });
});
