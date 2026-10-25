import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addMasterTracConceptStorage } from "@/components/design/InteractiveRoom3D";
import { masterTracCornerAssembly, MasterTracCornerElevation } from "@/components/design/MasterTracCornerViews";
import { masterTracRodAssembly, MasterTracRodElevation } from "@/components/design/MasterTracRodViews";
import { buildDesignCabinetCartLines } from "./designCartLines";
import { masterTracProduct } from "./closet";
import { removeOverlappingPlacements, type RoomData } from "./design";
import { defaultTowerConfig, planMasterTracTower, towerConceptReferenceSubtotal, towerConceptStorageReferenceItems,
  towerConfigFromPlacements, towerRodHardwareTakeoff, type TowerStorageItem } from "./masterTracTower";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const items: TowerStorageItem[] = [
  ...[7, 13, 19, 25].map((elevationIn): TowerStorageItem => ({ kind: "drawer", elevationIn, drawerSize: "small", frontStyle: "slab" })),
  ...[31, 32, 33, 34].map((elevationIn): TowerStorageItem => ({ kind: "shoe", elevationIn, fenceFinish: "Chrome" })),
  { kind: "rod", elevationIn: 60, rodFinish: "Chrome" },
  { kind: "shelf", elevationIn: 70 },
];

function mixed(corner?: "start" | "end") {
  const config = defaultTowerConfig();
  config.corner = corner;
  if (corner) config.cornerAdjustableHeightsIn = [30, 54, 70];
  config.bays[1] = { ...config.bays[1], adjustableHeightsIn: [30, 54], storageItems: items.map((item) => ({ ...item })) };
  return { config, result: planMasterTracTower(config, room, "top", corner === "end" ? room.width - 79.75 : 0, []) };
}

describe("MasterTrac freely mixed per-bay storage (reference-only)", () => {
  it("places four drawers, four shoes, a rod and a real adjustable shelf in one bay with sourced quantities and no checkout", () => {
    const { result } = mixed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const anchor = result.plan.boards.find((board) => board.masterTracTowerBayIndex === 1 && board.masterTracTowerRole === "fixed-bottom")!;
    expect(anchor.masterTracStorageItems).toHaveLength(10);
    expect(result.plan.boards.filter((board) => board.masterTracTowerBayIndex === 1 && board.masterTracTowerRole === "adjustable").map((board) => board.mountBottom)).toEqual([30, 54, 70]);
    expect(towerConceptStorageReferenceItems(result.plan.boards).map(({ quantity }) => quantity)).toEqual([4, 4, 4, 4]);
    expect(towerRodHardwareTakeoff(result.plan.boards)).toMatchObject([{ rodCount: 1, cupCount: 2, cupPacks: 1 }]);
    expect(result.plan.listSubtotal).toBeCloseTo(result.plan.boards.reduce((sum, board) => sum + (masterTracProduct(board.masterCode)?.listEachUsd ?? 0), 0) + towerConceptReferenceSubtotal(result.plan.boards));
    const restored = removeOverlappingPlacements(JSON.parse(JSON.stringify(result.plan.boards)), room);
    expect(restored.rejected).toHaveLength(0);
    expect(towerConfigFromPlacements(restored.placed, "tower-preview")?.config.bays[1]).toMatchObject({ storageItems: items, adjustableHeightsIn: [30, 54] });
    expect(buildDesignCabinetCartLines({ placed: restored.placed, styleId: 330011, distributorId: 210001, tier: "homeowner", styleNameById: new Map([[330011, "Test"]]), unitPriceFor: () => 999 })).toHaveLength(0);
  });

  it("rejects only actual source-board overlap or out-of-panel positioned content, not combinations or count caps", () => {
    const { config } = mixed();
    for (const bad of [
      { kind: "shelf", elevationIn: 30.5 } as TowerStorageItem,
      { kind: "shoe", elevationIn: 86.1, fenceFinish: "Chrome" } as TowerStorageItem,
      { kind: "rod", elevationIn: Number.NaN, rodFinish: "Chrome" } as TowerStorageItem,
    ]) {
      const attempt = { ...config, bays: [config.bays[0], { ...config.bays[1], storageItems: [...items, bad] }] };
      expect(planMasterTracTower(attempt, room, "top", 0, []).ok).toBe(false);
    }
    const sixRods = { ...config, bays: [config.bays[0], { ...config.bays[1], adjustableHeightsIn: [], storageItems: [
      ...[25, 26, 27, 28, 29, 30].map((elevationIn): TowerStorageItem => ({ kind: "rod", elevationIn, rodFinish: "Chrome" })),
    ] }] };
    expect(planMasterTracTower(sixRods, room, "top", 0, []).ok).toBe(true);
  });

  it.each(["start", "end"] as const)("keeps the %s five-level corner and mixed second bay visible in 3D and elevation", (side) => {
    const { result } = mixed(side);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const root = masterTracCornerAssembly(result.plan.boards)!;
    expect(root.children.filter((node) => node.userData.masterTracCorner)).toHaveLength(5);
    expect(root.children.filter((node) => node.userData.masterTracCornerReturn)).toHaveLength(1);
    expect(root.children.filter((node) => node.userData.masterTracConceptComponent === "drawer-front-illustration")).toHaveLength(4);
    expect(root.children.filter((node) => node.userData.masterTracConceptComponent === "shoe-board-illustration")).toHaveLength(4);
    expect(root.children.filter((node) => node.userData.masterTracRodIllustration)).toHaveLength(1);
    const markup = renderToStaticMarkup(createElement(MasterTracCornerElevation, { placed: result.plan.boards, wall: "top", onEdit: () => {} }));
    expect(markup.match(/data-testid="mastertrac-mixed-drawer-elevation"/g)).toHaveLength(4);
    expect(markup.match(/data-testid="mastertrac-mixed-shoe-elevation"/g)).toHaveLength(4);
    expect(markup).toContain('data-testid="corner-return-elevation"');
  });

  it("renders straight mixed storage in its dedicated view, while ordinary 3D uses the same saved positions", () => {
    const { result } = mixed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const root = masterTracRodAssembly(result.plan.boards)!;
    expect(root.children.filter((node) => node.userData.masterTracConceptComponent === "drawer-front-illustration")).toHaveLength(4);
    expect(root.children.filter((node) => node.userData.masterTracConceptComponent === "shoe-board-illustration")).toHaveLength(4);
    expect(root.children.filter((node) => node.userData.masterTracRodIllustration)).toHaveLength(1);
    const markup = renderToStaticMarkup(createElement(MasterTracRodElevation, { placed: result.plan.boards, wall: "top", onEdit: () => {} }));
    expect(markup.match(/data-testid="mastertrac-mixed-drawer-elevation"/g)).toHaveLength(4);
    expect(markup.match(/data-testid="mastertrac-mixed-shoe-elevation"/g)).toHaveLength(4);
    const anchor = result.plan.boards.find((board) => board.masterTracTowerBayIndex === 1 && board.masterTracTowerRole === "fixed-bottom")!;
    const ordinary = new THREE.Group();
    addMasterTracConceptStorage(ordinary, anchor, room);
    expect(ordinary.children.filter((node) => node.userData.masterTracRodIllustration)).toHaveLength(0); // rod is nested in its positioned group
    expect(ordinary.children.find((node) => node.children.some((child) => child.userData.masterTracRodIllustration))).toBeDefined();
  });
});
