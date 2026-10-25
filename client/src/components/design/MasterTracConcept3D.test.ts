import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addMasterTracConceptStorage } from "./InteractiveRoom3D";
import { defaultTowerConfig, planMasterTracTower } from "@/lib/masterTracTower";
import type { RoomData } from "@/lib/design";

const room: RoomData = { width: 144, depth: 96, ceilingHeight: 96 };

function sceneFor(kind: "drawers" | "shoe") {
  const config = defaultTowerConfig();
  config.bays[0] = { ...config.bays[0], adjustableHeightsIn: [], storage: kind === "drawers"
    ? { kind: "drawers", count: 2, drawerSize: "large", frontStyle: "shaker" }
    : { kind: "shoe", count: 3, fenceFinish: "Matt Nickel" } };
  const plan = planMasterTracTower(config, room, "top", 12, []);
  expect(plan.ok).toBe(true);
  if (!plan.ok) throw new Error(plan.reason);
  const anchor = plan.plan.boards.find((board) => board.masterTracConceptStorage)!;
  const root = new THREE.Group();
  addMasterTracConceptStorage(root, anchor, room);
  const marked: Record<string, THREE.Object3D[]> = {};
  root.traverse((node) => { if (node.userData.masterTracConceptComponent) (marked[node.userData.masterTracConceptComponent] ??= []).push(node); });
  return { root, anchor, marked, plan: plan.plan };
}

describe("MasterTrac 3D storage illustrations", () => {
  it("shows two open-tray drawers with separate real-SKU front references, not generic kitchen cabinets", () => {
    const { root, anchor, marked, plan } = sceneFor("drawers");
    expect(plan.conceptualItems.filter((item) => item.sku === "432608")).toHaveLength(2);
    expect(plan.conceptualItems.filter((item) => item.sku !== "432608").map((item) => item.sku)).toEqual(["432389", "432574"]);
    expect(marked["drawer-front-illustration"]).toHaveLength(2);
    expect(marked["drawer-tray-bottom-illustration"]).toHaveLength(2);
    expect(marked["drawer-tray-side-illustration"]).toHaveLength(4);
    expect(marked["drawer-pull-illustration"]).toHaveLength(2);
    expect(root.children[0].userData.masterTracIllustration).toMatchObject({ kind: "drawers", notInstallationGeometry: true });
    expect(marked["drawer-front-illustration"][0].userData.placedUid).toBe(anchor.uid);
    expect(JSON.stringify(root.toJSON())).not.toContain("toeKick");
  });

  it("shows an angled board with a distinct metal fence, not a generic flat kitchen shelf", () => {
    const { root, marked, plan } = sceneFor("shoe");
    expect(plan.conceptualItems.filter((item) => item.sku === "432608")).toHaveLength(2);
    expect(plan.conceptualItems.filter((item) => item.sku !== "432608").map((item) => item.sku)).toEqual(["432559", "432927"]);
    expect(marked["shoe-board-illustration"]).toHaveLength(3);
    expect(marked["shoe-fence-illustration"]).toHaveLength(3);
    expect(marked["shoe-board-illustration"][0].rotation.x).toBeGreaterThan(0);
    expect(root.children[0].userData.masterTracIllustration).toMatchObject({ kind: "shoe", notInstallationGeometry: true });
  });
});
