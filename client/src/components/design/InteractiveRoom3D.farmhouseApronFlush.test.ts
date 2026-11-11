// @vitest-environment jsdom
/**
 * A farmhouse apron stands 1/2" proud of the door faces. It must not sit back
 * inside the face frame, and it must not jump out by half the sink width
 * (the old 6" bug).
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, addSinkFixture, existingCabinetSku, existingCabinetTransform, farmhouseApronEdgeInsetIn } from "./InteractiveRoom3D";
import { makeSinkForCabinet, type PlacedCabinet, type RoomData } from "@/lib/design";
import { FARMHOUSE_SINK_APRON_PROUD_IN } from "@/lib/farmhouseSinkBaseFace";

const INCH = 1 / 12;

const room = { width: 144, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData;

function farmBase(width: number, overrides: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid: `fsb-${width}`,
    cabinetId: 11,
    masterCode: `FSB${width}`,
    description: `Farm Sink Base ${width}`,
    category: "Base",
    subCategory: "Sink Base",
    placement: "base",
    x: 12,
    y: 0,
    width,
    depth: 24,
    height: 34.5,
    rotation: 0,
    wallId: "top",
    wallOffset: 12,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    ...overrides,
  } as PlacedCabinet;
}

function mountedFarmSink(baseWidth = 36, sinkWidth = 33, sinkDepth = 21) {
  const base = farmBase(baseWidth);
  const sink = {
    ...makeSinkForCabinet("farmhouse", base, room, { width: sinkWidth, depth: sinkDepth }),
    apronFront: true,
  };
  return { base, sink };
}

function worldFront(node: THREE.Object3D, side: "max" | "min" = "max") {
  const box = new THREE.Box3().setFromObject(node);
  return (side === "max" ? box.max.z : box.min.z) / INCH;
}

describe("farmhouse apron stands proud of the cabinet doors", () => {
  it("puts the apron half an inch in front of the door slab, not back inside the frame", () => {
    const { base, sink } = mountedFarmSink();
    const root = new THREE.Group();
    addCabinet(
      root,
      existingCabinetSku(base),
      null,
      {},
      room.width,
      room.depth,
      "#6d7580",
      "#f4f1ea",
      undefined,
      existingCabinetTransform(base, room),
      undefined,
      undefined,
      { suppressFarmhouseSinkPlaceholder: true },
    );
    addSinkFixture(root, sink);
    root.updateMatrixWorld(true);
    let door: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.farmhouseBaseDoor === 1) door = node;
      if (node.userData.sinkApronFront) apron = node;
    });
    expect(door).not.toBeNull();
    expect(apron).not.toBeNull();
    const doorFrontIn = worldFront(door!);
    const apronFrontIn = worldFront(apron!);
    expect(apronFrontIn - doorFrontIn).toBeCloseTo(FARMHOUSE_SINK_APRON_PROUD_IN, 2);
  });

  it("stays within an inch of the counter front instead of standing 6 inches proud", () => {
    const countertopFrontIn = 25.5;
    const { sink } = mountedFarmSink();
    const root = new THREE.Group();
    addSinkFixture(root, sink);
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.sinkApronFront) apron = node;
    });
    const apronFrontIn = worldFront(apron!);
    expect(apronFrontIn).toBeLessThan(countertopFrontIn + 1);
    expect(apronFrontIn).toBeGreaterThan(24);
  });

  it("keeps a 30, 33, and 36 inch apron the same small distance past the cabinet box", () => {
    for (const [baseWidth, sinkWidth] of [[30, 30], [36, 33], [36, 36]] as const) {
      const { base, sink } = mountedFarmSink(baseWidth, sinkWidth);
      const root = new THREE.Group();
      addSinkFixture(root, sink);
      let apron: THREE.Object3D | null = null;
      root.traverse((node) => {
        if (node.userData.sinkApronFront) apron = node;
      });
      const carcassFrontIn = base.y + base.depth;
      expect(worldFront(apron!)).toBeCloseTo(carcassFrontIn + 1.13, 2);
    }
  });

  it("stands proud on a bottom wall as well, mirrored", () => {
    const base = farmBase(36, { wallId: "bottom", y: 120 - 24, wallOffset: 12 });
    const sink = {
      ...makeSinkForCabinet("farmhouse", base, room, { width: 33, depth: 21 }),
      apronFront: true,
    };
    const root = new THREE.Group();
    addSinkFixture(root, sink);
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.sinkApronFront) apron = node;
    });
    const carcassFrontIn = base.y;
    expect(worldFront(apron!, "min")).toBeCloseTo(carcassFrontIn - 1.13, 2);
  });

  it("keeps the apron on the sink's room-facing edge", () => {
    const { sink } = mountedFarmSink();
    const root = new THREE.Group();
    addSinkFixture(root, sink);
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.sinkApronFront) apron = node;
    });
    expect(worldFront(apron!)).toBeCloseTo(sink.y + sink.depth, 2);
  });

  it("measures the inset on the into-the-room axis, not the lateral span", () => {
    const inset = farmhouseApronEdgeInsetIn({ planWidthIn: 33, planDepthIn: 21, apronThicknessIn: 1.2, side: "top" });
    expect(inset).toBeCloseTo(21 / 2 - 1.2 / 2, 5);
    expect(farmhouseApronEdgeInsetIn({ planWidthIn: 60, planDepthIn: 21, apronThicknessIn: 1.2, side: "top" })).toBeCloseTo(inset, 5);
    expect(farmhouseApronEdgeInsetIn({ planWidthIn: 21, planDepthIn: 33, apronThicknessIn: 1.2, side: "left" })).toBeCloseTo(21 / 2 - 1.2 / 2, 5);
  });
});
