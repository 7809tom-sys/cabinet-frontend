import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addThreeDPeninsulaCountertops } from "@/components/design/InteractiveRoom3D";
import {
  COUNTERTOP_DEPTH_IN,
  RAISED_BAR_HEIGHT_IN,
  countertopPolygonSelfIntersects,
  countertopSurfaces,
  countertopSurfacePlanPolygon,
  peninsulaRaisedBarSurface,
  peninsulaCountertopSurface,
  type PeninsulaRun,
  type PlacedCabinet,
  type RoomData,
  wallPlacementAt,
} from "./design";
import { islandRaisedBarRects } from "./islandScene";

const room: RoomData = {
  width: 144,
  depth: 144,
  peninsulaRuns: [
    {
      id: "main",
      parentWall: "top",
      startOffset: 24,
      direction: "right",
      length: 72,
      height: 96,
      cabinetSide: "left",
      countertopRaisedBar: true,
      countertopRaisedBarOverhang: 15,
    },
    {
      id: "return-45",
      parentRunId: "main",
      parentWall: "top",
      startOffset: 0,
      direction: "right",
      turn: 45,
      length: 42,
      height: 96,
      cabinetSide: "left",
    },
  ],
};

const root = room.peninsulaRuns![0]!;
const return45 = room.peninsulaRuns![1]!;

function baseOnRun(uid: string, run: PeninsulaRun, offset: number, width: number): PlacedCabinet {
  const position = wallPlacementAt(offset, width, 24, run.id as any, room, run.cabinetSide);
  return {
    uid,
    cabinetId: 1,
    masterCode: "B24",
    description: "24 inch base cabinet",
    placement: "base",
    x: position.x,
    y: position.y,
    width,
    depth: 24,
    height: 34.5,
    rotation: position.rotation,
    wallId: run.id,
    wallOffset: offset,
  };
}

describe("split-level countertop geometry", () => {
  it("keeps the lower worktop supported while the raised bar projects 15 inches", () => {
    const legacyRoom: RoomData = {
      ...room,
      peninsulaRuns: room.peninsulaRuns!.map((run) => run.id === "main" ? {
        ...run,
        countertopSeatingOverhang: 15,
        countertopPonyWallBarOverhang: 15,
      } : run),
    };
    const legacyMain = legacyRoom.peninsulaRuns![0]!;
    const lower = peninsulaCountertopSurface(legacyMain, legacyRoom, 0, 72);

    expect(lower).toMatchObject({
      width: 72,
      depth: COUNTERTOP_DEPTH_IN,
      ponyWallBarOverhangIn: 0,
      ponyWallBackExtensionIn: 0,
      areaInches: 72 * COUNTERTOP_DEPTH_IN,
    });
    const raised = peninsulaRaisedBarSurface(legacyMain, legacyRoom, 0, 72);
    expect(raised).toMatchObject({
      raisedBarOverhangIn: 15,
      countertopHeightIn: RAISED_BAR_HEIGHT_IN,
    });
    expect(countertopSurfacePlanPolygon(raised!)).not.toEqual(countertopSurfacePlanPolygon(lower));
    expect(raised!.areaInches).toBeGreaterThan(0);
    expect(raised!.areaInches).toBeLessThan(lower.areaInches);
    // Cabinet fronts face -X. The raised bar is only the 15in strip behind the cabinets (+X).
    const lowerOutline = countertopSurfacePlanPolygon(lower);
    const raisedOutline = countertopSurfacePlanPolygon(raised!);
    const lowMax = Math.max(...lowerOutline.map((point) => point.x));
    expect(Math.min(...raisedOutline.map((point) => point.x))).toBeCloseTo(lowMax, 1);
    expect(Math.max(...raisedOutline.map((point) => point.x))).toBeCloseTo(lowMax + 15, 1);
  });
  it("uses the exact cabinet-supported 1½-inch 45-degree countertop outline for the raised bar", () => {
    const placed = [
      baseOnRun("main-base", root, 0, 72),
      baseOnRun("return-base", return45, 0, 42),
    ];
    const surfaces = countertopSurfaces(placed, room);
    const raised = surfaces.filter((surface) => surface.raisedBar);
    const worktops = surfaces.filter((surface) => surface.peninsulaRunId && !surface.raisedBar);

    // The raised level keeps the same run ownership and miter treatment, but
    // adds the requested 15-inch seating projection beyond the lower edge.
    expect(worktops.length).toBeGreaterThanOrEqual(1);
    expect(raised).toHaveLength(worktops.length);
    raised.forEach((raisedBar, index) => {
      expect(raisedBar).toMatchObject({
        countertopHeightIn: RAISED_BAR_HEIGHT_IN,
        raisedBarOverhangIn: 15,
        raisedBar: true,
        raisedBarUsesSharedCountertopOutline: true,
      });
      expect(countertopPolygonSelfIntersects(countertopSurfacePlanPolygon(raisedBar))).toBe(false);
      expect(countertopSurfacePlanPolygon(raisedBar)).not.toEqual(countertopSurfacePlanPolygon(worktops[index]!));
      expect(raisedBar.areaInches).toBeGreaterThan(0);
    });

    const scene = new THREE.Group();
    addThreeDPeninsulaCountertops(scene, room, placed, "#ffffff");
    scene.updateMatrixWorld(true);
    const raisedMeshes = scene.children.filter((item) => item.userData.raisedBar) as THREE.Mesh[];
    expect(raisedMeshes).toHaveLength(1);
    const [mesh] = raisedMeshes;
    expect(mesh!.userData).toMatchObject({
      peninsulaRunId: "main",
      peninsulaRunIds: ["main", "return-45"],
      countertopHeightIn: RAISED_BAR_HEIGHT_IN,
      raisedBarUsesSharedCountertopOutline: true,
    });
    const positions = mesh!.geometry.getAttribute("position");
    const worldVertices = Array.from({ length: positions.count }, (_, index) => new THREE.Vector3()
      .fromBufferAttribute(positions, index)
      .applyMatrix4(mesh!.matrixWorld));
    for (const point of countertopSurfacePlanPolygon(raised[0]!)) {
      expect(worldVertices.some((vertex) => (
        Math.hypot(vertex.x * 12 - point.x, vertex.z * 12 - point.y) < 1e-5
      ))).toBe(true);
    }
  });

  it("keeps the raised bar on the cabinet footprint through either side and 45-degree direction", () => {
    for (const cabinetSide of ["left", "right"] as const) {
      for (const direction of ["left", "right"] as const) {
        const variantRoom: RoomData = {
          width: 240,
          depth: 240,
          peninsulaRuns: [
            { id: "variant-main", parentWall: "top", startOffset: 72, direction: "right", length: 72, height: 96, cabinetSide, countertopRaisedBar: true, countertopRaisedBarOverhang: 15 },
            { id: "variant-return", parentRunId: "variant-main", parentWall: "top", startOffset: 0, turn: 45, direction, length: 42, height: 96, cabinetSide },
          ],
        };
        const [variantMain, variantReturn] = variantRoom.peninsulaRuns!;
        const placeBase = (uid: string, run: PeninsulaRun, width: number): PlacedCabinet => ({
          uid,
          cabinetId: 1,
          masterCode: "B24",
          description: "24 inch base cabinet",
          placement: "base",
          ...wallPlacementAt(0, width, 24, run.id as any, variantRoom, run.cabinetSide),
          width,
          depth: 24,
          height: 34.5,
          wallId: run.id,
          wallOffset: 0,
          peninsulaSide: run.cabinetSide,
        });
        const surfaces = countertopSurfaces([
          placeBase("variant-main-base", variantMain, 72),
          placeBase("variant-return-base", variantReturn, 42),
        ], variantRoom);
        const raised = surfaces.filter((surface) => surface.raisedBar);
        const worktops = surfaces.filter((surface) => surface.peninsulaRunId && !surface.raisedBar);
        expect(raised).toHaveLength(worktops.length);
        raised.forEach((bar, index) => {
          expect(bar).toMatchObject({
            countertopHeightIn: RAISED_BAR_HEIGHT_IN,
            raisedBarOverhangIn: 15,
            raisedBarUsesSharedCountertopOutline: true,
          });
          const outline = countertopSurfacePlanPolygon(bar);
          expect(outline.length).toBeGreaterThanOrEqual(4);
          expect(countertopPolygonSelfIntersects(outline)).toBe(false);
          expect(outline).not.toEqual(countertopSurfacePlanPolygon(worktops[index]!));
          expect(bar.areaInches).toBeGreaterThan(0);
        });
      }
    }
  });

  it("keeps a raised island bar as a separate 15-inch seating projection", () => {
    const island = { x: 36, y: 42, width: 72, depth: 48, activeFace: "front" as const, raisedBar: true, raisedBarSide: "back" as const, raisedBarOverhang: 15 as const };
    const placed: PlacedCabinet[] = [{
      uid: "island-base",
      cabinetId: 1,
      masterCode: "B36",
      description: "36 inch base cabinet",
      placement: "base",
      islandFace: "front",
      x: 54,
      y: 66,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
    }];
    const bars = islandRaisedBarRects(island, placed);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ width: 39, depth: 19.5 });
    expect(bars[0]!.y).toBeLessThan(placed[0]!.y);
  });

  it("renders one cabinet-footprint 45-degree raised bar at 42 inches above the 36-inch worktop", () => {
    const placed = [baseOnRun("mesh-main", root, 0, 72), baseOnRun("mesh-return", return45, 0, 42)];
    const scene = new THREE.Group();
    addThreeDPeninsulaCountertops(scene, room, placed, "#ffffff");
    const raised: THREE.Object3D[] = [];
    const worktops: THREE.Object3D[] = [];
    scene.traverse((node) => {
      if (node.userData.raisedBar) raised.push(node);
      if (node.userData.peninsulaCountertop && !node.userData.raisedBar) worktops.push(node);
    });
    expect(raised).toHaveLength(worktops.length);
    expect(worktops.length).toBeGreaterThan(0);
    expect(raised.every((node) => node.userData.countertopHeightIn === 42 && node.userData.raisedBarOverhangIn === 15)).toBe(true);
    expect(raised.every((node) => node.userData.raisedBarUsesSharedCountertopOutline)).toBe(true);
    expect(worktops.every((node) => node.userData.countertopHeightIn === 36)).toBe(true);
  });
});
