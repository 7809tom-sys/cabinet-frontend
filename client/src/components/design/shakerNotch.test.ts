import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { dlcFrameStrips } from "@shared/dlcFr26Textures";
import { addCabinet, doorProfileKind, existingCabinetSku, existingCabinetTransform, threeDShakerRailThickness, threeDUsesPhysicalShakerRails } from "./InteractiveRoom3D";
import { shakerNotchPieces, shakerNotchRingIsComplete } from "./shakerNotch";

const INCH = 1 / 12;

/**
 * Styles Tom named, plus a frameless slab that must stay flat. Rail widths are
 * the profile the Designer already uses when the catalog record supplies them.
 * Live admin colors are not read here.
 */
const CATALOG = [
  { name: "Aura Cream", doorStyle: "Shaker", doorPanelType: "Recessed Panel", rail: 3, stile: 3, framed: true },
  { name: "Nimbus Gray", doorStyle: "Shaker", doorPanelType: "Shaker", rail: 3, stile: 3, framed: true },
  { name: "Terra Shaker", doorStyle: "Terra Shaker", doorPanelType: "Flat Panel", rail: 2.5, stile: 2.5, framed: true },
  { name: "Onyx Shadow", doorStyle: "Shaker", doorPanelType: "Recessed", rail: 3, stile: 3, framed: true },
  { name: "Sterling Pulse", doorStyle: "Shaker", doorPanelType: "Shaker", rail: 2.25, stile: 2.25, framed: true },
  { name: "Slim Shaker", doorStyle: "Slim Shaker", doorPanelType: null, rail: 1, stile: 1, framed: true },
  { name: "Frameless Euro", doorStyle: "Frameless Euro", doorPanelType: "Slab", rail: null, stile: null, framed: false },
] as const;

const FACES = [
  { place: "wall", w: 9, h: 30 },
  { place: "wall", w: 12, h: 30 },
  { place: "wall", w: 15, h: 42 },
  { place: "wall", w: 18, h: 30 },
  { place: "wall", w: 21, h: 30 },
  { place: "wall", w: 21, h: 42 },
  { place: "base", w: 12, h: 24 },
  { place: "base", w: 18, h: 25 },
  { place: "base", w: 24, h: 24 },
  { place: "tall", w: 18, h: 72 },
  { place: "tall", w: 24, h: 84 },
  { place: "drawer", w: 12, h: 6 },
  { place: "drawer", w: 15, h: 5 },
  { place: "drawer", w: 18, h: 8 },
  { place: "drawer", w: 24, h: 6 },
  { place: "drawer", w: 30, h: 10 },
  { place: "drawer", w: 36, h: 6 },
] as const;

function openingFor(railIn: number, stileIn: number, faceW: number, faceH: number) {
  const width = faceW * INCH;
  const height = faceH * INCH;
  const rail = threeDShakerRailThickness(width, height, railIn);
  const stile = threeDShakerRailThickness(width, height, stileIn);
  return { width: width - stile * 2, height: height - rail * 2 };
}

describe("shaker notch across catalog styles and door sizes", () => {
  it("builds a closed four-sided ring whenever the opening can hold one, and never a partial ring", () => {
    const affected: string[] = [];
    for (const style of CATALOG) {
      if (!style.framed) {
        expect(doorProfileKind(style.doorStyle, style.doorPanelType)).toBe("flat");
        expect(threeDUsesPhysicalShakerRails("flat", true)).toBe(false);
        continue;
      }
      expect(threeDUsesPhysicalShakerRails(doorProfileKind(style.doorStyle, style.doorPanelType), true)).toBe(true);
      for (const face of FACES) {
        const opening = openingFor(style.rail, style.stile, face.w, face.h);
        const pieces = shakerNotchPieces(opening.width, opening.height);
        const label = `${style.name} ${face.place} ${face.w}x${face.h}`;
        expect([0, 8], label).toContain(pieces.length);
        if (pieces.length === 0) continue;
        expect(shakerNotchRingIsComplete(opening.width, opening.height, pieces), label).toBe(true);
        const sides = new Set(pieces.map((piece) => piece.side));
        expect([...sides].sort(), label).toEqual(["bottom", "left", "right", "top"]);
        affected.push(label);
      }
    }
    // Every named shaker style has at least the common door sizes, including 21 inch.
    for (const name of ["Aura Cream", "Nimbus Gray", "Terra Shaker", "Onyx Shadow", "Sterling Pulse", "Slim Shaker"]) {
      expect(affected.some((label) => label.startsWith(`${name} wall 21x30`))).toBe(true);
      expect(affected.some((label) => label.startsWith(`${name} base`))).toBe(true);
      expect(affected.some((label) => label.startsWith(`${name} tall`))).toBe(true);
      expect(affected.some((label) => label.startsWith(`${name} drawer`))).toBe(true);
    }
  });

  it("does not borrow Driftwood shadow strips for any other finish", () => {
    for (const slug of ["aura-cream", "nimbus-gray", "terra-shaker", "onyx-shadow", "sterling-pulse", "slim-shaker-alabaster", null]) {
      expect(dlcFrameStrips(1, 2, 0.9, slug)).toEqual([]);
    }
    expect(dlcFrameStrips(1, 2, 0.4, "driftwood").length).toBeGreaterThan(0);
  });
});

function placed(partial: Record<string, unknown>) {
  return {
    category: "Wall",
    rotation: 0,
    wallId: "top",
    depth: 12,
    numberOfDrawers: 0,
    numberOfDoors: 1,
    ...partial,
  } as never;
}

function build(item: Record<string, unknown>, profile: { doorStyle: string; doorPanelType?: string | null; railWidth?: number; stileWidth?: number }, extra?: Record<string, unknown>) {
  const room = { width: 144, depth: 120, ceilingHeight: 96 };
  const root = new THREE.Group();
  addCabinet(
    root,
    existingCabinetSku(placed(item) as never),
    null,
    {},
    144,
    120,
    "#ded5c1",
    "#ffffff",
    profile,
    existingCabinetTransform(placed(item) as never, room),
    null,
    undefined,
    extra as never,
  );
  const frames: THREE.Object3D[] = [];
  const strips: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node.userData.physicalRails && node.userData.selectedStyleFace === "shaker") frames.push(node);
    if (node.userData.dlcFrameDetail) strips.push(node);
  });
  return { frames, strips };
}

function expectFullRing(frame: THREE.Object3D) {
  const notches = frame.children.filter((child) => child.userData.shakerNotch);
  // A very short front can be all rail, with no opening left. That is an empty
  // ring, never a one-sided notch.
  expect([0, 8]).toContain(notches.length);
  if (notches.length === 0) return;
  expect(new Set(notches.map((node) => node.userData.shakerNotchSide))).toEqual(new Set(["top", "bottom", "left", "right"]));
  expect(new Set(notches.map((node) => node.userData.shakerNotchBand))).toEqual(new Set(["outer", "inner"]));
}

describe("shaker notch meshes on built cabinets", () => {
  const shaker = { doorStyle: "Shaker", doorPanelType: "Recessed Panel", railWidth: 3, stileWidth: 3 };

  it("puts a full ring on wall, base, tall, and drawer fronts", () => {
    const wall = build({ uid: "w", cabinetId: 1, masterCode: "W2130", description: "21 inch wall", placement: "wall", x: 0, y: 0, width: 21, height: 30, mountBottom: 54, numberOfDoors: 1 }, shaker);
    expect(wall.frames.length).toBeGreaterThan(0);
    wall.frames.forEach(expectFullRing);
    expect(wall.frames.every((frame) => frame.children.filter((child) => child.userData.shakerNotch).length === 8)).toBe(true);
    expect(wall.strips).toHaveLength(0);

    const base = build({ uid: "b", cabinetId: 2, masterCode: "B24", description: "24 base", placement: "base", category: "Base", x: 0, y: 24, width: 24, height: 34.5, depth: 24, numberOfDoors: 1, numberOfDrawers: 1 }, shaker);
    const baseDoors = base.frames.filter((frame) => frame.userData.faceRole === "door");
    const baseDrawers = base.frames.filter((frame) => frame.userData.faceRole === "drawer");
    expect(baseDoors.length).toBeGreaterThan(0);
    expect(baseDrawers.length).toBeGreaterThan(0);
    base.frames.forEach(expectFullRing);
    expect(baseDoors.every((frame) => frame.children.filter((child) => child.userData.shakerNotch).length === 8)).toBe(true);

    const tall = build({ uid: "t", cabinetId: 3, masterCode: "T1896", description: "tall cabinet", placement: "tall", category: "Tall", x: 30, y: 0, width: 18, height: 84, depth: 24, numberOfDoors: 1 }, shaker);
    expect(tall.frames.length).toBeGreaterThan(0);
    tall.frames.forEach(expectFullRing);

    const drawers = build({ uid: "d", cabinetId: 4, masterCode: "3DB30", description: "three drawer base", placement: "base", category: "Base", x: 60, y: 24, width: 30, height: 34.5, depth: 24, numberOfDoors: 0, numberOfDrawers: 3 }, shaker);
    expect(drawers.frames.length).toBeGreaterThanOrEqual(3);
    drawers.frames.forEach(expectFullRing);
  });

  it("uses the one-inch slim frame and leaves a frameless slab with no notch", () => {
    const slim = build(
      { uid: "s", cabinetId: 5, masterCode: "W1830", description: "slim wall", placement: "wall", x: 0, y: 0, width: 18, height: 30, mountBottom: 54 },
      { doorStyle: "Slim Shaker", doorPanelType: null, railWidth: 1, stileWidth: 1 },
    );
    expect(slim.frames).toHaveLength(1);
    expectFullRing(slim.frames[0]!);
    const rails = slim.frames[0]!.children.filter((child) => child.userData.physicalRail && child.userData.grainPiece === "rail");
    expect(rails.length).toBeGreaterThan(0);
    expect((rails[0] as THREE.Mesh).geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(((rails[0] as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.height).toBeCloseTo(INCH, 5);

    const frameless = build(
      { uid: "f", cabinetId: 6, masterCode: "W1830", description: "frameless wall", placement: "wall", x: 0, y: 0, width: 18, height: 30, mountBottom: 54 },
      { doorStyle: "Frameless Euro", doorPanelType: "Slab" },
    );
    expect(frameless.frames).toHaveLength(0);
    expect(frameless.strips).toHaveLength(0);
  });

  it("keeps Driftwood shadow strips and still draws the notch; other DL finishes get the notch only", () => {
    const crop = { doorSize: [100, 200] as [number, number], drawerSize: null, drawerSolidColor: null, grainUrl: null };
    const driftwood = build(
      { uid: "dw", cabinetId: 7, masterCode: "W1830", description: "driftwood wall", placement: "wall", x: 0, y: 0, width: 18, height: 30, mountBottom: 54 },
      shaker,
      { faceCrop: { ...crop, slug: "driftwood", solidColor: "#c4b39a" } },
    );
    expect(driftwood.frames).toHaveLength(1);
    expectFullRing(driftwood.frames[0]!);
    expect(driftwood.strips.length).toBeGreaterThan(0);

    const nimbus = build(
      { uid: "ng", cabinetId: 8, masterCode: "W1830", description: "nimbus wall", placement: "wall", x: 0, y: 0, width: 18, height: 30, mountBottom: 54 },
      shaker,
      { faceCrop: { ...crop, slug: "nimbus-gray", solidColor: "#b7b7b4" } },
    );
    expect(nimbus.frames).toHaveLength(1);
    expectFullRing(nimbus.frames[0]!);
    expect(nimbus.strips).toHaveLength(0);
  });
});
