import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyPartWoodGrain,
  applyPartWoodGrainUvs,
  configurePartGrainTexture,
  partWoodGrainAxis,
} from "./partWoodGrain";

/** Versa / Natura Maple door tile, inches: across the grain, then along it. */
const TILE = { across: 6.35, along: 11.8 };

function board(widthIn: number, heightIn: number, depthIn = 0.75) {
  return new THREE.BoxGeometry(widthIn / 12, heightIn / 12, depthIn / 12);
}

function faceSamples(geometry: THREE.BufferGeometry, axis: "x" | "y" | "z", sign: 1 | -1) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const samples: Array<{ x: number; y: number; z: number; u: number; v: number }> = [];
  for (let index = 0; index < position.count; index += 1) {
    const n = axis === "x" ? normal.getX(index) : axis === "y" ? normal.getY(index) : normal.getZ(index);
    if (n * sign < 0.9) continue;
    samples.push({
      x: position.getX(index) * 12,
      y: position.getY(index) * 12,
      z: position.getZ(index) * 12,
      u: uv.getX(index),
      v: uv.getY(index),
    });
  }
  return samples;
}

function span(samples: Array<Record<string, number>>, key: string) {
  const values = samples.map((sample) => sample[key]!);
  return Math.max(...values) - Math.min(...values);
}

describe("per-part wood grain", () => {
  it("keeps one real-inch scale and an axis-aligned direction on rails, stiles, and sides", () => {
    const stile = board(2.75, 24);
    const rail = board(30, 2.75);
    const side = board(0.75, 36, 24);
    const drawer = board(12, 6);
    applyPartWoodGrainUvs(stile, "vertical", TILE, 0.2);
    applyPartWoodGrainUvs(rail, "horizontal", TILE, 0.05);
    applyPartWoodGrainUvs(side, "vertical", TILE, 0);
    applyPartWoodGrainUvs(drawer, "vertical", TILE, 0);

    const stileFront = faceSamples(stile, "z", 1);
    const railFront = faceSamples(rail, "z", 1);
    const sideFace = faceSamples(side, "x", 1);
    const drawerFront = faceSamples(drawer, "z", 1);

    // Vertical grain: V follows height, U follows width. Same inches per tile
    // on a 12 in drawer and a 36 in side.
    expect(span(stileFront, "v") / span(stileFront, "y")).toBeCloseTo(1 / TILE.along, 2);
    expect(span(stileFront, "u") / span(stileFront, "x")).toBeCloseTo(1 / TILE.across, 2);
    expect(span(drawerFront, "v") / span(drawerFront, "y")).toBeCloseTo(1 / TILE.along, 2);
    expect(span(sideFace, "v") / span(sideFace, "y")).toBeCloseTo(1 / TILE.along, 2);
    expect(span(sideFace, "v") / 36).toBeCloseTo(span(drawerFront, "v") / 6, 2);

    // Horizontal grain on the rail: V follows the length, U follows the height.
    // The 2.75 in rail is not stretched to a full tile.
    expect(span(railFront, "v") / span(railFront, "x")).toBeCloseTo(1 / TILE.along, 2);
    expect(span(railFront, "u") / span(railFront, "y")).toBeCloseTo(1 / TILE.across, 2);
    expect(span(railFront, "u")).toBeCloseTo(2.75 / TILE.across, 2);
    expect(span(railFront, "u")).toBeLessThan(1);
    expect(span(railFront, "v") / 30).toBeCloseTo(span(stileFront, "v") / 24, 2);

    // No diagonal: on a vertical board, V does not change across the width,
    // and on a rail it does not change with height.
    const stileLeft = stileFront.filter((sample) => sample.x < 0);
    const stileRight = stileFront.filter((sample) => sample.x > 0);
    expect(span(stileLeft, "v")).toBeCloseTo(span(stileFront, "v"), 2);
    expect(Math.abs(span(stileLeft, "u"))).toBeLessThan(0.02);
    expect(Math.abs(span(stileRight, "u"))).toBeLessThan(0.02);
    const railTop = railFront.filter((sample) => sample.y > 0);
    const railBottom = railFront.filter((sample) => sample.y < 0);
    expect(span(railTop, "v")).toBeCloseTo(span(railFront, "v"), 2);
    expect(Math.abs(span(railTop, "u"))).toBeLessThan(0.02);
    expect(Math.abs(span(railBottom, "u"))).toBeLessThan(0.02);

    // The thin edge of the rail keeps the same scale. It does not show the
    // whole tile squeezed into the board thickness.
    const railEnd = faceSamples(rail, "x", 1);
    expect(span(railEnd, "u")).toBeLessThan(0.75 / TILE.across + 0.05);
    expect(span(railEnd, "u")).toBeGreaterThan(0);
  });

  it("resets the shared texture to one unrotated mirrored tile", () => {
    const texture = new THREE.Texture();
    texture.repeat.set(3.8, 2.4);
    texture.offset.set(0.62, 0.18);
    texture.rotation = Math.PI / 2;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const rail = new THREE.Mesh(board(24, 2.75), material);
    rail.userData = { physicalRail: true, grainPiece: "rail" };
    const stile = new THREE.Mesh(board(2.75, 20), material);
    stile.userData = { physicalRail: true, grainPiece: "stile" };
    const kick = new THREE.Mesh(board(36, 4.5, 3), material);
    kick.userData = { baseToeKick: true };
    const group = new THREE.Group();
    group.add(rail, stile, kick);

    const count = applyPartWoodGrain(group, { door: TILE, placementUid: "b24" });
    expect(count).toBe(3);
    configurePartGrainTexture(texture);
    expect(texture.repeat.x).toBeCloseTo(1);
    expect(texture.repeat.y).toBeCloseTo(1);
    expect(texture.offset.x).toBeCloseTo(0);
    expect(texture.offset.y).toBeCloseTo(0);
    expect(texture.rotation).toBe(0);
    expect(texture.wrapS).toBe(THREE.MirroredRepeatWrapping);
    expect(texture.wrapT).toBe(THREE.MirroredRepeatWrapping);
    expect(rail.userData.partWoodGrainAxis).toBe("horizontal");
    expect(stile.userData.partWoodGrainAxis).toBe("vertical");
    expect(kick.userData.partWoodGrainAxis).toBe("horizontal");
    expect(partWoodGrainAxis({ cabinetDrawerFront: true })).toBe("vertical");
    expect(partWoodGrainAxis({ grainPiece: "rail", cabinetDrawerFront: true })).toBe("horizontal");
    expect(partWoodGrainAxis({ faceFrameEdge: "top" })).toBe("horizontal");
    expect(partWoodGrainAxis({ decorativeEndPanel: true })).toBe("vertical");
    expect(partWoodGrainAxis({ shakerFrameOutline: true })).toBeNull();

    const first = faceSamples(rail.geometry, "z", 1).map((sample) => sample.v.toFixed(4)).join(",");
    applyPartWoodGrain(group, { door: TILE, placementUid: "b24" });
    const again = faceSamples(rail.geometry, "z", 1).map((sample) => sample.v.toFixed(4)).join(",");
    expect(again).toBe(first);
  });
});
