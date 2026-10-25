import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addThreeDPeninsulaCountertops } from "@/components/design/InteractiveRoom3D";
import { countertopSurfacePlanPolygon, countertopSurfaces, wallPlacementAt, type PeninsulaRun, type PlacedCabinet, type RoomData } from "./design";

describe("raised bar real 3D mesh", () => {
  it.each(["left", "right"] as const)("projects outward only on the %s side", (side) => {
    const room: RoomData = { width: 144, depth: 144, peninsulaRuns: [{ id: "main", parentWall: "top", startOffset: 24, direction: "right", length: 72, height: 96, cabinetSide: side, countertopRaisedBar: true, countertopRaisedBarOverhang: 15 }] };
    const placed = [0, 36].map((off, i) => {
      const p = wallPlacementAt(off, 36, 24, "main" as any, room, side);
      return { uid: `b${i}`, cabinetId: 1, masterCode: "B36", description: "b", placement: "base", x: p.x, y: p.y, width: 36, depth: 24, height: 34.5, rotation: p.rotation, wallId: "main", wallOffset: off } as PlacedCabinet;
    });
    const scene = new THREE.Group();
    addThreeDPeninsulaCountertops(scene, room, placed, "#fff");
    scene.updateMatrixWorld(true);
    const box = (raised: boolean) => {
      const mesh = scene.children.find((o) => o.userData.peninsulaRunId && Boolean(o.userData.raisedBar) === raised && (o as THREE.Mesh).isMesh)!;
      const b = new THREE.Box3().setFromObject(mesh);
      return { minX: b.min.x * 12, maxX: b.max.x * 12, minZ: b.min.z * 12, maxZ: b.max.z * 12 };
    };
    const low = box(false), high = box(true);
    expect(high.minZ).toBeCloseTo(low.minZ, 1);
    expect(high.maxZ).toBeCloseTo(low.maxZ, 1);
    // Cabinet fronts face the 1.5in edge; the bar projects out the back only.
    // The raised bar is ONLY the 15in strip behind the cabinets; it never lies over the lower top.
    if (side === "left") {
      expect(high.minX).toBeCloseTo(low.maxX, 1);
      expect(high.maxX).toBeCloseTo(low.maxX + 15, 1);
    } else {
      expect(high.maxX).toBeCloseTo(low.minX, 1);
      expect(high.minX).toBeCloseTo(low.minX - 15, 1);
    }
  });

  it.each(["left", "right"] as const)("45-degree return on the %s side only moves each run's own front edge outward", (side) => {
    const runs = [
      { id: "main", parentWall: "top", startOffset: 24, direction: "right", length: 72, height: 96, cabinetSide: side, countertopRaisedBar: true, countertopRaisedBarOverhang: 15 },
      { id: "return-45", parentRunId: "main", parentWall: "top", startOffset: 0, direction: "right", turn: 45, length: 42, height: 96, cabinetSide: side },
    ] as PeninsulaRun[];
    const room: RoomData = { width: 144, depth: 144, peninsulaRuns: runs };
    const mk = (uid: string, run: PeninsulaRun, off: number, w: number) => {
      const p = wallPlacementAt(off, w, 24, run.id as any, room, run.cabinetSide);
      return { uid, cabinetId: 1, masterCode: "B24", description: "b", placement: "base", x: p.x, y: p.y, width: w, depth: 24, height: 34.5, rotation: p.rotation, wallId: run.id, wallOffset: off } as PlacedCabinet;
    };
    const placed = [mk("a", runs[0]!, 0, 36), mk("b", runs[0]!, 36, 36), mk("c", runs[1]!, 0, 30), mk("d", runs[1]!, 30, 12)];
    const surfaces = countertopSurfaces(placed, room).filter((x) => x.peninsulaRunId);
    const low = surfaces.find((x) => !x.raisedBar)!;
    const high = surfaces.find((x) => x.raisedBar)!;
    const area = (s: typeof low) => s.areaInches ?? 0;
    // Projection is a thin 13.5in strip per run, never a hull that fills the 45-degree notch.
    expect(area(high)).toBeGreaterThan(0);
    expect(area(high)).toBeLessThan(area(low));
    // Every raised vertex sits within one mitred 13.5in offset of a lower vertex (15 / cos 22.5 = 16.2).
    const lp = countertopSurfacePlanPolygon(low);
    const hp = countertopSurfacePlanPolygon(high);
    for (const q of hp) expect(Math.min(...lp.map((p) => Math.hypot(p.x - q.x, p.y - q.y)))).toBeLessThan(17.5);
    // The back/cabinet-side vertices are unchanged.
    const lowPts = countertopSurfacePlanPolygon(low);
    const highPts = countertopSurfacePlanPolygon(high);
    const shared = lowPts.filter((p) => highPts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3));
    expect(shared.length).toBeGreaterThanOrEqual(2);
  });
});
