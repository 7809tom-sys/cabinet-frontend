// @vitest-environment jsdom
/**
 * The owner's item 1: a farmhouse / apron-front sink must sit with its apron
 * flush with the cabinet door faces, not standing proud of the countertop.
 *
 * The sink is built exactly the way the Designer builds it — a real FSB sink
 * base plus `makeSinkForCabinet` — and then the rendered apron is measured
 * against the finished door plane. A real apron sink is flush with the doors
 * below it, so anything past the door plane is the bug.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addSinkFixture, farmhouseApronEdgeInsetIn } from "./InteractiveRoom3D";
import { makeSinkForCabinet, type PlacedCabinet, type RoomData } from "@/lib/design";

const INCH = 0.08333333333333333;

const room = { width: 144, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData;

function farmBase(width: number): PlacedCabinet {
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
  } as PlacedCabinet;
}

/** The Designer's own farmhouse fixture for a base on the top wall. */
function mountedFarmSink(baseWidth = 36, sinkWidth = 33, sinkDepth = 21) {
  const base = farmBase(baseWidth);
  const sink = {
    ...makeSinkForCabinet("farmhouse", base, room, { width: sinkWidth, depth: sinkDepth }),
    // `buildPelicanSinkOnCabinet` stamps this from the verified profile; the
    // generic helper only decides the box type.
    apronFront: true,
  };
  return { base, sink };
}

function apronBounds(sink: ReturnType<typeof mountedFarmSink>["sink"]) {
  const root = new THREE.Group();
  addSinkFixture(root, sink);
  let apron: THREE.Object3D | null = null;
  root.traverse((node) => {
    if (node.userData.sinkApronFront) apron = node;
  });
  expect(apron).not.toBeNull();
  return new THREE.Box3().setFromObject(apron!);
}

describe("farmhouse apron sits flush with the cabinet door faces", () => {
  it("puts the apron's front face on the sink base's door plane, not past it", () => {
    const { base, sink } = mountedFarmSink();
    const doorPlaneIn = base.y + base.depth; // 24" — the finished door face
    const apron = apronBounds(sink);
    const apronFrontIn = apron.max.z / INCH;
    // Flush: within a hair of the door face, and never past it.
    expect(apronFrontIn).toBeLessThanOrEqual(doorPlaneIn + 0.02);
    expect(apronFrontIn).toBeGreaterThan(doorPlaneIn - 0.5);
  });

  it("never stands proud of the countertop front, which was the 6 inch bug", () => {
    const countertopFrontIn = 25.5;
    const { sink } = mountedFarmSink();
    expect(apronBounds(sink).max.z / INCH).toBeLessThanOrEqual(countertopFrontIn + 0.01);
  });

  it("reports no protrusion for a 30, 33, and 36 inch apron sink", () => {
    for (const [baseWidth, sinkWidth] of [[30, 30], [36, 33], [36, 36]] as const) {
      const { base, sink } = mountedFarmSink(baseWidth, sinkWidth);
      const doorPlaneIn = base.y + base.depth;
      expect(apronBounds(sink).max.z / INCH).toBeLessThanOrEqual(doorPlaneIn + 0.02);
    }
  });

  it("stays flush on a bottom wall as well, mirrored", () => {
    const base = { ...farmBase(36), wallId: "bottom", y: 120 - 24, wallOffset: 12 } as PlacedCabinet;
    const sink = {
      ...makeSinkForCabinet("farmhouse", base, room, { width: 33, depth: 21 }),
      apronFront: true,
    };
    const apron = apronBounds(sink);
    const doorPlaneIn = base.y; // the room-facing face on a bottom wall
    expect(apron.min.z / INCH).toBeGreaterThanOrEqual(doorPlaneIn - 0.02);
    expect(apron.min.z / INCH).toBeLessThanOrEqual(doorPlaneIn + 0.5);
  });

  it("keeps the apron inside the sink's own footprint, so it cannot hang off the run", () => {
    const { sink } = mountedFarmSink();
    const sinkFrontIn = sink.y + sink.depth;
    expect(apronBounds(sink).max.z / INCH).toBeLessThanOrEqual(sinkFrontIn + 0.02);
  });

  it("measures the inset on the into-the-room axis, not the lateral span", () => {
    // Regression for the exact bug: the slab sits half the DEPTH in from center
    // plus half its own thickness. The old code used the WIDTH, which is 6"
    // further out for a 33 x 21 sink on a top wall.
    const inset = farmhouseApronEdgeInsetIn({ planWidthIn: 33, planDepthIn: 21, apronThicknessIn: 1.2, side: "top" });
    expect(inset).toBeCloseTo(21 / 2 - 1.2 / 2, 5);
    // Width never enters the top-wall answer.
    expect(farmhouseApronEdgeInsetIn({ planWidthIn: 60, planDepthIn: 21, apronThicknessIn: 1.2, side: "top" })).toBeCloseTo(inset, 5);
    // The into-the-room axis swaps on a left/right wall.
    expect(farmhouseApronEdgeInsetIn({ planWidthIn: 21, planDepthIn: 33, apronThicknessIn: 1.2, side: "left" })).toBeCloseTo(21 / 2 - 1.2 / 2, 5);
  });
});
