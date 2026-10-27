import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyThreeDCabinetPieceGrain,
  threeDPieceGrainTransform,
  type WoodGrainDirection,
} from "./woodGrainVariation";

const sample = "https://cdn.example/knotty-alder.jpg";

function doorSeed(pieceIndex: number, placementUid = "cabinet-a", role = "door") {
  return {
    placementUid,
    sampleUrl: sample,
    role,
    pieceIndex,
    grainDirection: "vertical" as const,
    curated: false,
  };
}

function uvSignature(geometry: THREE.BufferGeometry): string {
  const uv = geometry.getAttribute("uv");
  const values: string[] = [];
  for (let index = 0; index < uv.count; index += 1) {
    values.push(uv.getX(index).toFixed(5), uv.getY(index).toFixed(5));
  }
  return values.join(",");
}

function uvExtent(geometry: THREE.BufferGeometry) {
  const uv = geometry.getAttribute("uv");
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (let index = 0; index < uv.count; index += 1) {
    minU = Math.min(minU, uv.getX(index));
    minV = Math.min(minV, uv.getY(index));
    maxU = Math.max(maxU, uv.getX(index));
    maxV = Math.max(maxV, uv.getY(index));
  }
  return { minU, minV, maxU, maxV };
}

describe("per-piece wood grain", () => {
  it("repeats the same window for the same cabinet piece", () => {
    const first = threeDPieceGrainTransform(doorSeed(0));
    const again = threeDPieceGrainTransform(doorSeed(0));
    expect(again).toEqual(first);
    expect(first.repeatX).toBe(first.repeatY);
    expect(first.repeatX).toBeGreaterThanOrEqual(0.42);
    expect(first.repeatX).toBeLessThanOrEqual(0.64);
  });

  it("gives two adjacent doors different UV windows and keeps vertical grain vertical", () => {
    const left = threeDPieceGrainTransform(doorSeed(0));
    const right = threeDPieceGrainTransform(doorSeed(1));
    expect(right).not.toEqual(left);
    const shift = Math.max(
      Math.abs(left.offsetX - right.offsetX),
      Math.abs(left.offsetY - right.offsetY),
    );
    expect(shift > 0.02 || left.flipX !== right.flipX || left.flipY !== right.flipY || left.rotation !== right.rotation).toBe(true);
    for (const transform of [left, right]) {
      expect(transform.rotation === 0 || transform.rotation === Math.PI).toBe(true);
      for (const value of [transform.u0, transform.u1, transform.v0, transform.v1]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps grain on its axis for every catalog direction", () => {
    const directions: WoodGrainDirection[] = ["vertical", "horizontal", "none", "vertical-stiles-horizontal-rails"];
    for (const grainDirection of directions) {
      for (let pieceIndex = 0; pieceIndex < 8; pieceIndex += 1) {
        const transform = threeDPieceGrainTransform({ ...doorSeed(pieceIndex), grainDirection });
        expect(transform.rotation === 0 || transform.rotation === Math.PI).toBe(true);
        expect(transform.repeatX).toBeCloseTo(transform.repeatY);
      }
    }
  });

  it("changes the crop for a drawer front, a second cabinet, and a style-sized seed", () => {
    const door = threeDPieceGrainTransform(doorSeed(0));
    expect(threeDPieceGrainTransform(doorSeed(0, "cabinet-a", "drawer"))).not.toEqual(door);
    expect(threeDPieceGrainTransform(doorSeed(0, "cabinet-b"))).not.toEqual(door);
    const styleA = threeDPieceGrainTransform({ ...doorSeed(0, "style:10"), sampleUrl: sample });
    const styleAAgain = threeDPieceGrainTransform({ ...doorSeed(0, "style:10"), sampleUrl: sample });
    const styleB = threeDPieceGrainTransform({ ...doorSeed(0, "style:11"), sampleUrl: sample });
    expect(styleAAgain).toEqual(styleA);
    expect(styleB).not.toEqual(styleA);
  });

  it("stamps different UVs on adjacent doors while sharing one texture image", () => {
    const texture = new THREE.Texture();
    texture.repeat.set(0.42, 0.42);
    texture.offset.set(0.29, 0.29);
    const material = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: texture, roughness: 0.4, clearcoat: 0.1 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.06), material);
    const right = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.06), material);
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.06), material);
    left.userData = { cabinetFront: true };
    right.userData = { cabinetFront: true };
    drawer.userData = { cabinetFront: true, cabinetDrawerFront: true };
    const boxTexture = texture.clone();
    const boxMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", map: boxTexture, roughness: 0.48 });
    boxMaterial.userData = { selectedFinishStructuralSurface: true, usesDoorSample: true };
    const side = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 0.05), boxMaterial);
    const group = new THREE.Group();
    group.add(left, right, drawer, side);

    const options = {
      placementUid: "run-24",
      sampleUrl: sample,
      grainDirection: "vertical" as const,
      curated: false,
      sourceTexture: texture,
    };
    applyThreeDCabinetPieceGrain(group, options);

    expect(left.material).toBe(material);
    expect(right.material).toBe(material);
    expect(drawer.material).toBe(material);
    expect(material.map).toBe(texture);
    expect(boxMaterial.map).toBe(boxTexture);
    expect(boxTexture.source).toBe(texture.source);
    expect(texture.repeat.x).toBeCloseTo(0.42);
    expect(texture.offset.x).toBeCloseTo(0.29);
    expect(texture.offset.y).toBeCloseTo(0.29);
    expect(material.roughness).toBeCloseTo(0.4);
    expect(material.color.getHexString()).toBe("ffffff");

    expect(left.userData.woodGrainRole).toBe("door");
    expect(right.userData.woodGrainRole).toBe("door");
    expect(left.userData.woodGrainPieceIndex).toBe(0);
    expect(right.userData.woodGrainPieceIndex).toBe(1);
    expect(drawer.userData.woodGrainRole).toBe("drawer");
    expect(side.userData.woodGrainRole).toBe("box");
    expect(uvSignature(left.geometry)).not.toBe(uvSignature(right.geometry));
    expect(uvSignature(drawer.geometry)).not.toBe(uvSignature(left.geometry));
    expect(uvSignature(side.geometry)).not.toBe(uvSignature(left.geometry));
    for (const mesh of [left, right, drawer, side]) {
      const extent = uvExtent(mesh.geometry);
      expect(extent.minU).toBeGreaterThanOrEqual(-0.0001);
      expect(extent.minV).toBeGreaterThanOrEqual(-0.0001);
      expect(extent.maxU).toBeLessThanOrEqual(1.0001);
      expect(extent.maxV).toBeLessThanOrEqual(1.0001);
    }

    const stamped = uvSignature(left.geometry);
    applyThreeDCabinetPieceGrain(group, options);
    expect(uvSignature(left.geometry)).toBe(stamped);

    const replay = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.06), material);
    replay.userData = { cabinetFront: true };
    const replayGroup = new THREE.Group();
    replayGroup.add(replay);
    applyThreeDCabinetPieceGrain(replayGroup, options);
    expect(uvSignature(replay.geometry)).toBe(stamped);

    const neighbor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.06), material);
    neighbor.userData = { cabinetFront: true };
    const neighborGroup = new THREE.Group();
    neighborGroup.add(neighbor);
    applyThreeDCabinetPieceGrain(neighborGroup, { ...options, placementUid: "run-27" });
    expect(uvSignature(neighbor.geometry)).not.toBe(stamped);
  });
});
