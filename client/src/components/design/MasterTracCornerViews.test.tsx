import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { planMasterTracTower, defaultTowerConfig } from "@/lib/masterTracTower";
import type { RoomData } from "@/lib/design";
import { MasterTracCornerElevation, illustrativeMasterTracCornerShape, masterTracCornerAssembly } from "./MasterTracCornerViews";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

describe("Closet-only illustrative MasterTrac corner views", () => {
  it("draws two 14.5-inch straight mating edges within the sourced 29.5-inch footprint, leaving the curved transition illustrative", () => {
    const points = illustrativeMasterTracCornerShape().getPoints(28).map((point) => ({ x: point.x * 12, z: point.y * 12 }));
    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].z).toBeCloseTo(0);
    expect(points[1].x).toBeCloseTo(29.5);
    expect(points[1].z).toBeCloseTo(0);
    expect(points[2].x).toBeCloseTo(29.5);
    expect(points[2].z).toBeCloseTo(14.5);
    expect(points.at(-2)?.x).toBeCloseTo(0);
    expect(points.at(-2)?.z).toBeCloseTo(29.5);
    expect(points.some((point) => Math.abs(point.x - 14.5) < 1e-8 && Math.abs(point.z - 29.5) < 1e-8)).toBe(true);
    expect(points.some((point) => point.x > 14.5 && point.x < 29.5 && point.z > 14.5 && point.z < 29.5)).toBe(true);
  });
  for (const side of ["start", "end"] as const) {
    it(`renders ${side} corner plus two bays in a measured SKU box with no kitchen geometry`, () => {
      const config = { ...defaultTowerConfig("Spiced Mahogany"), corner: side };
      const result = planMasterTracTower(config, room, "top", side === "start" ? 0 : 64.25, []);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const root = masterTracCornerAssembly(result.plan.boards)!;
      const corner = root.children.find((object) => object.userData.masterTracCorner) as THREE.Group;
      expect(corner.userData.masterTracCorner).toMatchObject({ sku: "432786", finish: "Spiced Mahogany", side, widthIn: 29.5, depthIn: 29.5, illustrative: true });
      const bounds = new THREE.Box3().setFromObject(corner);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      expect(size.x * 12).toBeCloseTo(29.5);
      expect(size.z * 12).toBeCloseTo(29.5);
      expect(size.y * 12).toBeCloseTo(0.75);
      const upright = result.plan.boards.find((board) => board.masterTracTowerRole === (side === "start" ? "left" : "right"))!;
      const cornerEdge = side === "start" ? bounds.max.x : bounds.min.x;
      const uprightX = ((upright.wallOffset ?? 0) - Math.min(...result.plan.boards.filter((board) => board.masterTracTowerRole !== "corner-return").map((board) => board.wallOffset ?? 0))) / 12;
      expect(cornerEdge).toBeCloseTo(side === "start" ? uprightX : uprightX + 0.75 / 12);
      expect(corner.userData.masterTracCorner).toMatchObject({ connectionEdgeIn: 14.5, returnModeled: false, camLockGeometry: false });
      expect(root.children.filter((object) => object.userData.masterTracCorner)).toHaveLength(2);
      expect(root.children.filter((object) => object.userData.masterTracStraightBoard)).toHaveLength(11);
      const perpendicular = root.children.find((object) => object.userData.masterTracCornerReturn) as THREE.Mesh;
      expect(perpendicular.userData).toMatchObject({ sourcedDimensions: true, camLockGeometry: false });
      const supportBounds = new THREE.Box3().setFromObject(perpendicular);
      expect((supportBounds.max.z - bounds.max.z) * 12).toBeCloseTo(0.75);
      expect((supportBounds.max.x - supportBounds.min.x) * 12).toBeCloseTo(14.5);
      expect(root.children.every((object) => !object.userData.toeKickHeightIn && !object.userData.countertop)).toBe(true);
      const markup = renderToStaticMarkup(createElement(MasterTracCornerElevation, { placed: result.plan.boards, wall: "top", onEdit: () => {} }));
      expect(markup).toContain('data-testid="mastertrac-corner-elevation"');
      expect(markup).toContain('data-testid="mastertrac-corner-elevation-shelf"');
      expect(markup).toContain('432786');
      expect(markup).toContain('433176');
      expect(markup).toContain('illustrative, not installation geometry');
      expect(markup).toContain('data-testid="corner-return-elevation"');
      expect(markup).toContain('a complete return bay is not modeled');
    });

    it(`renders every adjustable shelf stacked at the ${side} corner in 3D and elevation`, () => {
      const config = { ...defaultTowerConfig("Spiced Mahogany"), corner: side, cornerAdjustableHeightsIn: [18, 40, 64] };
      const result = planMasterTracTower(config, room, "top", side === "start" ? 0 : 64.25, []);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const root = masterTracCornerAssembly(result.plan.boards)!;
      const corners = root.children.filter((object) => object.userData.masterTracCorner) as THREE.Group[];
      expect(corners).toHaveLength(5);
      expect(corners.map((object) => object.userData.masterTracCorner.sku)).toEqual(["432786", "432787", "432787", "432787", "432786"]);
      expect(corners.map((object) => object.position.y * 12)).toEqual([87, 18.75, 40.75, 64.75, 6.75]);
      expect(root.userData.cornerCount).toBe(5);
      const markup = renderToStaticMarkup(createElement(MasterTracCornerElevation, { placed: result.plan.boards, wall: "top", onEdit: () => {} }));
      expect(markup.match(/data-testid="mastertrac-corner-elevation-shelf"/g)).toHaveLength(5);
      expect(markup).toContain("5 curved corner shelves");
      expect(markup).toContain("432786");
      expect(markup).toContain("432787");
    });
  }
});
