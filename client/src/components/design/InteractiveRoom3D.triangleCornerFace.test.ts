import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  addCabinet,
  addThreeDCrownMolding,
  existingCabinetSku,
  existingCabinetTransform,
  threeDCrownPerimeterSegments,
  triangleCornerFrontPose,
} from "./InteractiveRoom3D";

const INCH = 1 / 12;
const room = { width: 120, depth: 96, ceilingHeight: 96 } as never;

function wtc(width: number, depth: number) {
  return {
    uid: `wtc-${width}x${depth}`, cabinetId: 1, masterCode: "WTC2430", description: "Triangle Wall Corner",
    placement: "wall", x: 0, y: 0, width, depth, height: 30, rotation: 0, mountBottom: 54,
    numberOfDoors: 2, numberOfDrawers: 0,
  } as never;
}

function renderedDoors(width: number, depth: number) {
  const record = wtc(width, depth);
  const root = new THREE.Group();
  addCabinet(root, existingCabinetSku(record), null, {}, 120, 96, "#7e8d72", "#f8f8f6", undefined, existingCabinetTransform(record, room));
  const doors: THREE.Mesh[] = [];
  root.traverse((node) => { if (node.userData.triangleDoor) doors.push(node as THREE.Mesh); });
  return doors;
}

/** Both outer ends of a door slab, in the cabinet's local plan (feet). */
function doorEnds(door: THREE.Mesh) {
  const half = (door.geometry as THREE.BoxGeometry).parameters.width / 2;
  const r = door.rotation.y;
  return [-1, 1].map((side) => ({ x: door.position.x + side * half * Math.cos(r), z: door.position.z - side * half * Math.sin(r) }));
}

describe("triangle corner wall cabinet (WTC) door face and crown", () => {
  it("seats both doors of a 24-by-12 WTC2430 on the carcass hypotenuse instead of a fixed 45 degrees", () => {
    const width = 24 * INCH;
    const depth = 12 * INCH;
    const doors = renderedDoors(24, 12);
    expect(doors).toHaveLength(2);
    const lineAngle = Math.atan2(depth, width);
    for (const door of doors) {
      expect(door.rotation.y).toBeCloseTo(-lineAngle, 9);
      for (const end of doorEnds(door)) {
        // Distance from the hypotenuse line z = (depth / width) * x stays at the small face offset.
        const distance = Math.abs(end.z - (depth / width) * end.x) / Math.hypot(1, depth / width);
        expect(distance).toBeLessThan(0.04);
        // And the slab never leaves the 24-by-12 box (before: ends reached z = +-9.6 inches).
        expect(Math.abs(end.x)).toBeLessThanOrEqual(width / 2 + 0.04);
        expect(Math.abs(end.z)).toBeLessThanOrEqual(depth / 2 + 0.04);
      }
    }
  });

  it("keeps a square 24-by-24 triangle corner at exactly 45 degrees", () => {
    const pose = triangleCornerFrontPose(2, 2);
    expect(pose.rotation).toBeCloseTo(-Math.PI / 4, 12);
    expect(pose.normalX).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(pose.normalZ).toBeCloseTo(Math.SQRT1_2, 12);
    expect(triangleCornerFrontPose(2, 2, undefined, "left").rotation).toBeCloseTo(Math.PI / 4, 12);
    for (const door of renderedDoors(24, 24)) expect(door.rotation.y).toBeCloseTo(-Math.PI / 4, 9);
  });

  it("mirrors the 24-by-12 pose for a left-hand triangle: same face angle, normal toward +x", () => {
    const theta = Math.atan2(12, 24);
    const right = triangleCornerFrontPose(2, 1);
    const left = triangleCornerFrontPose(2, 1, undefined, "left");
    expect(right.rotation).toBeCloseTo(-theta, 12);
    expect(left.rotation).toBeCloseTo(theta, 12);
    expect(left.normalX).toBeCloseTo(-right.normalX, 12);
    expect(left.normalZ).toBeCloseTo(right.normalZ, 12);
    expect(left.normalX).toBeGreaterThan(0);
    // The left-hand hypotenuse joins (-w/2, d/2) to (w/2, -d/2); its tangent is perpendicular to the normal.
    expect(left.tangentX * 2 + left.tangentZ * -1).toBeCloseTo(Math.hypot(2, 1), 12);
    expect(left.tangentX * left.normalX + left.tangentZ * left.normalZ).toBeCloseTo(0, 12);
  });

  it("runs crown along the WTC door face (hypotenuse) and not across the empty rectangle", () => {
    const segments = threeDCrownPerimeterSegments([wtc(24, 12)], room);
    expect(segments.some((segment) => segment.kind === "front" || segment.kind === "left-return")).toBe(false);
    const face = segments.find((segment) => segment.kind === "diagonal-front");
    expect(face).toBeDefined();
    expect(face!.length).toBeCloseTo(Math.hypot(24, 12), 6);
    // World plan: the cabinet box spans x 0..24, z 0..12; the face joins (24, 12) to (0, 0).
    const ends = [face!.start, face!.end].map((point) => [Math.round(point.x * 100) / 100, Math.round(point.z * 100) / 100]);
    expect(ends).toEqual(expect.arrayContaining([[24, 12], [0, 0]]));
    // The rail leans outward (away from the back-right square corner at (24, 0)).
    const direction = { x: (face!.end.x - face!.start.x) / face!.length, z: (face!.end.z - face!.start.z) / face!.length };
    const outward = { x: direction.z, z: -direction.x };
    const toSquareCorner = { x: 24 - face!.center.x, z: 0 - face!.center.z };
    expect(outward.x * toSquareCorner.x + outward.z * toSquareCorner.z).toBeLessThan(0);

    const root = new THREE.Group();
    addThreeDCrownMolding(root, [wtc(24, 12)], room, undefined, "#7e8d72");
    expect(root.children.some((rail) => rail.userData.crownMolding === true && rail.userData.segment === "diagonal-front" && rail.userData.crownMoldingFront === true)).toBe(true);
  });
});
