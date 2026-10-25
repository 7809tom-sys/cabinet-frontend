import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet } from "./InteractiveRoom3D";

const rows = (heights: number[]) => JSON.stringify(heights.map(height => ({ count: 1, height })));

function renderFronts(overrides: Partial<Parameters<typeof addCabinet>[1]>) {
  const root = new THREE.Group();
  const sku = {
    distributorSkuId: -1, cabinetId: -1, masterCode: "T3DB3084",
    description: "Tall two-door cabinet with three drawers", placementType: "tall",
    width: 30, height: 84, depth: 24, numberOfDoors: 2, numberOfDrawers: 3,
    graphicType: "tall_2door_3drawer", drawerHeight: 29.75,
    drawerLayout: rows([7.375, 7.375, 15]), ...overrides,
  };
  const before = JSON.stringify(sku);
  addCabinet(root, sku, null, {}, 144, 120, "#cbb992", "#ffffff", { doorStyle: "Slab", doorPanelType: "slab" });
  root.updateMatrixWorld(true);
  const drawers: THREE.Mesh[] = [];
  const doors: THREE.Mesh[] = [];
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || !node.userData.cabinetFront) return;
    (node.userData.cabinetDrawerFront ? drawers : doors).push(node);
  });
  expect(JSON.stringify(sku)).toBe(before);
  return { root, drawers, doors };
}

const bounds = (mesh: THREE.Mesh) => new THREE.Box3().setFromObject(mesh);

describe("regular Designer pantry drawers below tall doors", () => {
  it.each([
    { masterCode: "T2DB1884", width: 18, numberOfDoors: 1, numberOfDrawers: 2, drawerHeight: 29.75, drawerLayout: rows([14.875, 14.875]), graphicType: "tall_2door_2drawer", description: "Tall one-door cabinet with two drawers" },
    { masterCode: "T3DB3084", width: 30, numberOfDoors: 2, numberOfDrawers: 3, drawerHeight: 29.75, drawerLayout: rows([7.375, 7.375, 15]), graphicType: "tall_2door_3drawer", description: "Tall two-door cabinet with three drawers" },
    { masterCode: "VT3DB1884", width: 18, depth: 21, numberOfDoors: 1, numberOfDrawers: 3, drawerHeight: 29.75, drawerLayout: rows([7.375, 7.375, 15]), graphicType: "tall_1door_3drawer", description: "Tall one-door vanity utility cabinet with three drawers" },
    { masterCode: "T2DB2494", width: 24, height: 94, numberOfDoors: 1, numberOfDrawers: 2, drawerHeight: null, drawerLayout: null, graphicType: "tall_2door_2drawer", description: '24" W × 94" H × 24" D Tall Two Door Cabinet with Two Drawers' },
  ])("places $masterCode's entire drawer bank below every tall door", fixture => {
    const { drawers, doors } = renderFronts(fixture);
    expect(drawers).toHaveLength(fixture.numberOfDrawers);
    expect(doors).toHaveLength(fixture.numberOfDoors);
    expect(Math.max(...drawers.map(drawer => bounds(drawer).max.y))).toBeLessThanOrEqual(Math.min(...doors.map(door => bounds(door).min.y)) + 0.001);
  });

  it("keeps top-to-bottom authored row heights after moving the bank to the bottom", () => {
    const { drawers } = renderFronts({});
    const ordered = drawers.sort((a, b) => bounds(b).getCenter(new THREE.Vector3()).y - bounds(a).getCenter(new THREE.Vector3()).y);
    expect(ordered.map(drawer => (drawer.geometry as THREE.BoxGeometry).parameters.height)).toEqual([
      expect.closeTo(7.375 / 12 - 0.025, 10), expect.closeTo(7.375 / 12 - 0.025, 10), expect.closeTo(15 / 12 - 0.025, 10),
    ]);
    const topDoor = renderFronts({}).doors[0]!;
    expect(bounds(ordered[0]!).max.y).toBeLessThan(bounds(topDoor).min.y);
  });

  it("does not drop pantry drawers when a legacy description includes the word pantry", () => {
    const { drawers, doors } = renderFronts({ description: "Pantry cabinet with two doors and three drawers" });
    expect(drawers).toHaveLength(3);
    expect(doors).toHaveLength(2);
    expect(Math.max(...drawers.map(drawer => bounds(drawer).max.y))).toBeLessThan(Math.min(...doors.map(door => bounds(door).min.y)));
  });

  it("retains a standard base's shallow drawer above its lower doors", () => {
    const { drawers, doors } = renderFronts({ masterCode: "B30", placementType: "base", height: 34.5, description: "Base cabinet with two doors and one drawer", graphicType: "base_2door_1drawer", numberOfDoors: 2, numberOfDrawers: 1, drawerHeight: 6, drawerLayout: rows([6]) });
    expect(drawers).toHaveLength(1);
    expect(bounds(drawers[0]!).min.y).toBeGreaterThanOrEqual(Math.max(...doors.map(door => bounds(door).max.y)) - 0.001);
  });

  it("retains four-door drawer-free pantry construction", () => {
    const { drawers, doors } = renderFronts({ masterCode: "T3084", description: "Pantry cabinet", graphicType: "tall_4door", numberOfDoors: 4, numberOfDrawers: 0, drawerHeight: null, drawerLayout: null });
    expect(drawers).toHaveLength(0);
    expect(doors).toHaveLength(4);
  });
});
