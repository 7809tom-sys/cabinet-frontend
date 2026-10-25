import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "./InteractiveRoom3D";
import {
  FARMHOUSE_SINK_APRON_DROP_IN,
  farmhouseSinkBaseDoorCount,
  farmhouseSinkBaseFaceLayout,
} from "@/lib/farmhouseSinkBaseFace";

/**
 * A real farmhouse (apron-front) sink base has NO top rail and NO false drawer
 * front. The sink's apron slab occupies the TOP of the face and two doors fill
 * the lower face beneath it. These tests build the real production mesh and
 * measure where each piece lands, so a layout can no longer be "present" yet
 * wrong (the August 2026 front had the apron mid-face with doors beside it).
 */
const room = { width: 144, depth: 120, ceilingHeight: 96 } as never;
const IN = 12;

function fsb(masterCode: string, width: number) {
  return {
    uid: `${masterCode}-uid`, cabinetId: 9360037, masterCode, description: `${width}" Farm Sink Base Cabinet`,
    placement: "base", x: 51, y: 0, width, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0,
  } as never;
}

function build(placed: never, options: Record<string, unknown> = {}) {
  const root = new THREE.Group();
  addCabinet(
    root, existingCabinetSku(placed), null, {}, 144, 120, "#7e8d72", "#f8f8f6", undefined,
    existingCabinetTransform(placed, room), undefined, undefined, { hardwareStyleId: "bar-pull", ...options },
  );
  root.updateMatrixWorld(true);
  const nodes: THREE.Object3D[] = [];
  root.traverse((node) => nodes.push(node));
  return { root, nodes };
}

const boxIn = (node: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(node);
  return {
    minY: box.min.y * IN, maxY: box.max.y * IN,
    minX: box.min.x * IN, maxX: box.max.x * IN,
    minZ: box.min.z * IN, maxZ: box.max.z * IN,
    width: (box.max.x - box.min.x) * IN, height: (box.max.y - box.min.y) * IN,
  };
};

describe("farmhouse sink base shared face layout", () => {
  it("puts the apron zone on top (8.5 inches) and leaves the rest of the face to doors", () => {
    expect(FARMHOUSE_SINK_APRON_DROP_IN).toBe(8.5);
    const layout = farmhouseSinkBaseFaceLayout(36, 34.5);
    expect(layout.apronZoneIn).toBe(8.5);
    expect(layout.doorZoneIn).toBe(26);
    expect(layout.apronWidthIn).toBeCloseTo(33.12, 2);
    expect(layout.doorCount).toBe(2);
    expect(layout.apronZonePct).toBeCloseTo((8.5 / 34.5) * 100, 6);
  });
  it("keeps two doors for FSB30 and above", () => {
    expect(farmhouseSinkBaseDoorCount(30, 2)).toBe(2);
    expect(farmhouseSinkBaseDoorCount(33, 0)).toBe(2);
    expect(farmhouseSinkBaseDoorCount(36, 1)).toBe(2);
  });
});

describe("farmhouse sink base 3D front composition (real meshes)", () => {
  for (const [code, width] of [["FSB36", 36], ["FSB33", 33], ["FSB30", 30], ["ADA-FSB36", 36]] as const) {
    it(`${code}: apron slab on top, two doors beneath it, nothing beside or above`, () => {
      const { nodes } = build(fsb(code, width));
      const apron = nodes.filter((node) => node.userData.farmhouseApronFront);
      const doors = nodes.filter((node) => node.userData.farmhouseBaseDoor);
      expect(apron).toHaveLength(1);
      expect(doors).toHaveLength(2);
      // The August 2026 composition must never come back.
      expect(nodes.filter((node) => node.userData.farmhouseFalseFront)).toHaveLength(0);
      expect(nodes.filter((node) => node.userData.farmhouseSideDoor)).toHaveLength(0);
      expect(nodes.filter((node) => node.userData.cabinetDrawerFront)).toHaveLength(0);

      const apronBox = boxIn(apron[0]!);
      const doorBoxes = doors.map(boxIn);
      const layout = farmhouseSinkBaseFaceLayout(width, 30);
      // Apron: top of the face, about 33" wide on a 36" base, never taller than 10".
      expect(apronBox.width).toBeCloseTo(layout.apronWidthIn, 1);
      expect(apronBox.height).toBeGreaterThan(8);
      expect(apronBox.height).toBeLessThanOrEqual(10.01);
      expect(apronBox.maxY).toBeGreaterThanOrEqual(34.5 - 0.01);
      // Doors sit entirely BELOW the apron and span down to the toe kick.
      for (const door of doorBoxes) {
        expect(door.maxY).toBeLessThanOrEqual(apronBox.minY + 0.02);
        expect(door.minY).toBeLessThan(5.2);
        expect(door.height).toBeGreaterThan(19);
      }
      // Two doors share the full face width, side by side, same height.
      expect(Math.abs(doorBoxes[0]!.width - doorBoxes[1]!.width)).toBeLessThan(0.01);
      expect(Math.abs(doorBoxes[0]!.maxY - doorBoxes[1]!.maxY)).toBeLessThan(0.01);
      expect(doorBoxes[0]!.width + doorBoxes[1]!.width).toBeGreaterThan(width - 1.1);
      // The apron may stand up to ~1/2" proud of the door face but never recessed.
      expect(apronBox.maxZ).toBeGreaterThanOrEqual(Math.max(...doorBoxes.map((door) => door.maxZ)) - 0.001);
      expect(apronBox.maxZ - Math.max(...doorBoxes.map((door) => door.maxZ))).toBeLessThanOrEqual(1.01);
    });
  }

  it("keeps the doors and an open apron zone (no placeholder) when an exact Pelican fixture owns the apron", () => {
    const { nodes } = build(fsb("FSB36", 36), { suppressFarmhouseSinkPlaceholder: true });
    expect(nodes.filter((node) => node.userData.farmhouseApronFront)).toHaveLength(0);
    expect(nodes.filter((node) => node.userData.farmhouseSinkBasin)).toHaveLength(0);
    const doors = nodes.filter((node) => node.userData.farmhouseBaseDoor).map(boxIn);
    expect(doors).toHaveLength(2);
    for (const door of doors) {
      // The doors stop where the 10" installed apron (26" above the floor) begins.
      expect(door.maxY).toBeLessThanOrEqual(26.02);
      expect(door.maxY).toBeGreaterThan(24);
    }
  });

  it("puts one vertical pull on each lower door, on the centre meeting edge, and no drawer pull", () => {
    const { nodes } = build(fsb("FSB36", 36));
    const doors = nodes.filter((node) => node.userData.farmhouseBaseDoor).map(boxIn);
    const pulls = nodes.filter((node) => node.userData.cabinetHardware && node.userData.cabinetPull === "door");
    expect(pulls).toHaveLength(2);
    expect(nodes.filter((node) => node.userData.cabinetHardware && node.userData.cabinetPull === "drawer")).toHaveLength(0);
    const pullBoxes = pulls.map(boxIn).sort((a, b) => a.minX - b.minX);
    const sortedDoors = [...doors].sort((a, b) => a.minX - b.minX);
    const centre = (sortedDoors[0]!.maxX + sortedDoors[1]!.minX) / 2;
    expect(pullBoxes[0]!.maxX).toBeLessThanOrEqual(centre + 0.01);
    expect(pullBoxes[1]!.minX).toBeGreaterThanOrEqual(centre - 0.01);
    for (const [index, pull] of pullBoxes.entries()) {
      const door = sortedDoors[index]!;
      expect(pull.minY).toBeGreaterThanOrEqual(door.minY);
      expect(pull.maxY).toBeLessThanOrEqual(door.maxY);
    }
  });

  it("does not change an ordinary sink base (SB36 keeps its two false fronts over two doors)", () => {
    const placed = {
      uid: "sb36", cabinetId: 1, masterCode: "SB36", description: '36" Sink Base Cabinet',
      placement: "base", x: 51, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    const { nodes } = build(placed);
    expect(nodes.filter((node) => node.userData.falseDrawerFront)).toHaveLength(2);
    expect(nodes.filter((node) => node.userData.farmhouseBaseDoor)).toHaveLength(0);
    expect(nodes.filter((node) => node.userData.farmhouseApronFront)).toHaveLength(0);
  });

  it("keeps the apron on the room-facing side of a right-wall FSB36", () => {
    const placed = {
      uid: "fsb36-right", cabinetId: 36, masterCode: "FSB36", description: '36" Farm Sink Base',
      placement: "base", x: 96, y: 36, width: 36, depth: 24, height: 34.5, rotation: 90, numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    const rightRoom = { width: 120, depth: 120, ceilingHeight: 96 } as never;
    const root = new THREE.Group();
    addCabinet(root, existingCabinetSku(placed), null, {}, 120, 120, "#7e8d72", "#f8f8f6", undefined, existingCabinetTransform(placed, rightRoom));
    root.updateMatrixWorld(true);
    const cabinet = root.children.find((node) => node.userData.masterCode === "FSB36")!;
    const cabinetCentre = new THREE.Vector3();
    cabinet.getWorldPosition(cabinetCentre);
    const apronCentre = new THREE.Vector3();
    const doorCentres: THREE.Vector3[] = [];
    root.traverse((node) => {
      if (node.userData.farmhouseApronFront) node.getWorldPosition(apronCentre);
      if (node.userData.farmhouseBaseDoor) { const v = new THREE.Vector3(); node.getWorldPosition(v); doorCentres.push(v); }
    });
    expect(apronCentre.x).toBeLessThan(cabinetCentre.x);
    expect(doorCentres).toHaveLength(2);
    for (const door of doorCentres) expect(door.x).toBeLessThan(cabinetCentre.x);
  });
});
