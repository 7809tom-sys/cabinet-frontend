import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, threeDCabinetFrontColumnLayout } from "./InteractiveRoom3D";

const INCH = 1 / 12;

function renderSku(overrides: Partial<Parameters<typeof addCabinet>[1]> & { masterCode: string; width: number }) {
  const root = new THREE.Group();
  addCabinet(root, {
    distributorSkuId: 1,
    cabinetId: 1,
    description: overrides.description ?? overrides.masterCode,
    placementType: "base",
    height: 34.5,
    depth: 24,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    drawerLayout: null,
    ...overrides,
  }, null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: "shaker" }, undefined, undefined, undefined, { hardwareStyleId: "bar-pull" });
  const drawers: THREE.Mesh[] = [];
  const doors: THREE.Mesh[] = [];
  const pulls: THREE.Object3D[] = [];
  const drawerBoxes: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node.userData.cabinetPull) pulls.push(node);
    if (node.userData.cabinetDrawerBox || node.userData.operableDrawer) drawerBoxes.push(node);
    if (!(node instanceof THREE.Mesh) || !node.userData.cabinetFront) return;
    if (node.userData.cabinetDrawerFront) drawers.push(node);
    else doors.push(node);
  });
  drawers.sort((a, b) => a.position.x - b.position.x || b.position.y - a.position.y);
  doors.sort((a, b) => a.position.x - b.position.x);
  return { doors, drawers, pulls, drawerBoxes };
}

function size(mesh: THREE.Mesh) {
  const g = mesh.geometry as THREE.BoxGeometry;
  return { width: g.parameters.width, height: g.parameters.height };
}

describe("horizontal drawer fronts on Auto Design base cabinets", () => {
  it("draws SB30 and SB36 with two equal side-by-side false fronts in one top row, one over each door", () => {
    for (const [masterCode, width] of [["SB30", 30], ["SB-36", 36]] as const) {
      const result = renderSku({ masterCode, width, description: `${width} inch Sink Base`, numberOfDrawers: 0 });
      const { doors, drawers } = result;
      expect(doors, masterCode).toHaveLength(2);
      expect(drawers, masterCode).toHaveLength(2);
      expect(drawers[0]!.position.y).toBeCloseTo(drawers[1]!.position.y, 6);
      expect(drawers[0]!.position.x).toBeLessThan(drawers[1]!.position.x);
      expect(Math.min(...drawers.map((d) => d.position.y))).toBeGreaterThan(Math.max(...doors.map((d) => d.position.y)));
      const columns = threeDCabinetFrontColumnLayout(width * INCH, 2);
      expect(size(drawers[0]!).width).toBeCloseTo(columns.columnWidth, 6);
      expect(size(drawers[1]!).width).toBeCloseTo(columns.columnWidth, 6);
      // Each front is horizontal: wider than it is tall. A 30-inch sink base
      // splits into two ~15-inch-wide fronts in the six-inch top band.
      expect(size(drawers[0]!).width).toBeGreaterThan(size(drawers[0]!).height);
      expect(size(drawers[0]!).width * 12).toBeCloseTo(width / 2, 0);
      expect(size(drawers[0]!).height * 12).toBeLessThan(8);
      // These are false fronts, not working drawers: tagged as such, no
      // drawer pull, and no drawer box or open/pull-out mesh.
      expect(drawers.every((d) => d.userData.falseDrawerFront === true), masterCode).toBe(true);
      expect(result.pulls.filter((n) => n.userData.cabinetPull === "drawer"), masterCode).toHaveLength(0);
      expect(result.pulls.filter((n) => n.userData.cabinetPull === "door"), masterCode).toHaveLength(2);
      expect(result.drawerBoxes, masterCode).toHaveLength(0);
    }
  });

  it("keeps 3DB18 as three stacked full-width horizontal fronts, matching the three-drawer model", () => {
    const { doors, drawers } = renderSku({
      masterCode: "3DB18",
      width: 18,
      description: '18" 3 Drawer Base Cabinet',
      numberOfDoors: 0,
      numberOfDrawers: 3,
    });
    expect(doors).toHaveLength(0);
    expect(drawers).toHaveLength(3);
    const widths = drawers.map((d) => size(d).width);
    expect(widths[0]).toBeCloseTo(widths[1]!, 6);
    expect(widths[0]).toBeCloseTo(widths[2]!, 6);
    expect(widths[0]! * 12).toBeGreaterThan(16);
    const ys = drawers.map((d) => d.position.y).sort((a, b) => b - a);
    expect(ys[0]).toBeGreaterThan(ys[1]!);
    expect(ys[1]).toBeGreaterThan(ys[2]!);
    // Top utility drawer is shorter than the two equal lower drawers.
    const heights = drawers
      .slice()
      .sort((a, b) => b.position.y - a.position.y)
      .map((d) => size(d).height);
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeCloseTo(heights[2]!, 6);
  });

  it("leaves B30 as one full-width top drawer and B36 as two side-by-side top drawers, per the catalog", () => {
    const b30 = renderSku({ masterCode: "B30", width: 30, numberOfDoors: 1, numberOfDrawers: 2 });
    expect(b30.doors).toHaveLength(2);
    expect(b30.drawers).toHaveLength(1);
    expect(size(b30.drawers[0]!).width * 12).toBeGreaterThan(28);
    expect(size(b30.drawers[0]!).width).toBeGreaterThan(size(b30.drawers[0]!).height);

    const b36 = renderSku({ masterCode: "B36", width: 36, numberOfDoors: 1, numberOfDrawers: 1 });
    expect(b36.doors).toHaveLength(2);
    expect(b36.drawers).toHaveLength(2);
    expect(b36.drawers[0]!.position.y).toBeCloseTo(b36.drawers[1]!.position.y, 6);
    expect(size(b36.drawers[0]!).width).toBeCloseTo(size(b36.drawers[1]!).width, 6);
    expect(size(b36.drawers[0]!).width).toBeGreaterThan(size(b36.drawers[0]!).height);
  });
});
