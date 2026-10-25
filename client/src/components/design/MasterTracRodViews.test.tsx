import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { defaultTowerConfig, planMasterTracTower } from "@/lib/masterTracTower";
import type { RoomData } from "@/lib/design";
import { masterTracCornerAssembly, MasterTracCornerElevation } from "./MasterTracCornerViews";
import { masterTracRodAssembly, MasterTracRodElevation } from "./MasterTracRodViews";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function withRods(corner?: "start" | "end") {
  const config = defaultTowerConfig();
  config.corner = corner;
  config.bays[0].adjustableHeightsIn = [];
  config.bays[0].storage = { kind: "rod", count: 2, rodFinish: "Chrome", heightsIn: [40, 70] };
  return planMasterTracTower(config, room, "top", 0, []);
}

describe("Closet-only MasterTrac rod views", () => {
  it("renders two real measured bay spans with illustrative rod/cup profiles in a straight tower", () => {
    const result = withRods();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const root = masterTracRodAssembly(result.plan.boards)!;
    expect(root.userData).toMatchObject({ masterTracRodTower: true, notInstallationGeometry: true });
    const rods = root.children.filter((child) => child.userData.masterTracRodIllustration);
    expect(rods).toHaveLength(2);
    expect(root.children.filter((child) => child.userData.masterTracCupIllustration)).toHaveLength(4);
    for (const rod of rods) {
      expect(rod.userData).toMatchObject({ stockSku: "433223", installedSpanIn: 24, finish: "Chrome", notInstallationGeometry: true });
      const size = new THREE.Vector3();
      new THREE.Box3().setFromObject(rod).getSize(size);
      expect(size.x * 12).toBeCloseTo(24);
    }
    const markup = renderToStaticMarkup(createElement(MasterTracRodElevation, { placed: result.plan.boards, wall: "top", onEdit: () => {} }));
    expect(markup).toContain('data-testid="mastertrac-rod-elevation"');
    expect(markup.match(/data-testid="mastertrac-rod-elevation-line"/g)).toHaveLength(2);
    expect(markup).toContain("illustrative, not installation geometry");
  });

  it("shows rod levels beside a real curved corner in the dedicated Closet corner views", () => {
    const result = withRods("start");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const root = masterTracCornerAssembly(result.plan.boards)!;
    expect(root.children.filter((child) => child.userData.masterTracRodIllustration)).toHaveLength(2);
    const markup = renderToStaticMarkup(createElement(MasterTracCornerElevation, { placed: result.plan.boards, wall: "top", onEdit: () => {} }));
    expect(markup.match(/data-testid="mastertrac-rod-elevation"/g)).toHaveLength(2);
    expect(markup).toContain("432556");
  });
});
