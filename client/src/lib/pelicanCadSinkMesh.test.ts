import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  MANUFACTURER_SINK_RIM_LIFT_FT,
  apronSideOf,
  hideParametricBasin,
  orientManufacturerSink,
  placeManufacturerSink,
} from "./pelicanCadSinkMesh";

const INCH = 1 / 12;

/** A box basin with a full-height apron on +Z and only a top flange on -Z. */
function apronFrontDrawing(): THREE.Group {
  const root = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 16));
  basin.position.set(0, -4.5, 1);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(33, 10, 1));
  apron.position.set(0, -5, 10);
  const flange = new THREE.Mesh(new THREE.BoxGeometry(33, 1, 4));
  flange.position.set(0, -0.5, -8.5);
  root.add(basin, apron, flange);
  orientManufacturerSink(root, 1);
  return root;
}

/** A basin hanging inside a wider top flange. */
function dropInDrawing(): THREE.Group {
  const root = new THREE.Group();
  const flange = new THREE.Mesh(new THREE.BoxGeometry(33, 1, 22));
  flange.position.set(0, -0.5, 0);
  const basin = new THREE.Mesh(new THREE.BoxGeometry(28, 9, 16));
  basin.position.set(0, -5.5, 0);
  root.add(flange, basin);
  orientManufacturerSink(root, 1);
  return root;
}

/** The built-in apron slab, placed the way addSinkFixture places it. */
function builtInApron(side: "top" | "bottom" | "left" | "right", widthIn = 33, depthIn = 21): THREE.Mesh {
  const thickness = Math.min(0.12, depthIn * INCH * 0.2);
  const across = side === "left" || side === "right";
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(
    across ? thickness : widthIn * INCH,
    10 * INCH,
    across ? widthIn * INCH : thickness,
  ));
  const inset = ((across ? widthIn : depthIn) * INCH) / 2 - thickness / 2;
  const direction = side === "bottom" ? -1 : across ? 0 : 1;
  const sideways = side === "left" ? 1 : side === "right" ? -1 : 0;
  mesh.position.set(5 + sideways * inset, 3 - 5 * INCH, 7 + direction * inset);
  mesh.userData = { sinkApronFront: true };
  return mesh;
}

describe("manufacturer sink seating", () => {
  it("finds the apron edge of an oriented drawing", () => {
    expect(apronSideOf(apronFrontDrawing())).toBe(1);
    const dropIn = dropInDrawing();
    expect(apronSideOf(dropIn)).toBe(0);
    const box = new THREE.Group();
    box.add(new THREE.Mesh(new THREE.BoxGeometry(33, 10, 21)));
    orientManufacturerSink(box, 1);
    expect(apronSideOf(box)).toBe(1);
  });

  it.each([
    ["top", "z", 1],
    ["bottom", "z", -1],
    ["left", "x", 1],
    ["right", "x", -1],
  ] as const)("puts the apron face on the built-in apron plane for a %s-wall sink", (side, axis, sign) => {
    const template = apronFrontDrawing();
    const holderPosition = new THREE.Vector3(5, 3 + MANUFACTURER_SINK_RIM_LIFT_FT, 7);
    const apron = builtInApron(side);
    const placed = placeManufacturerSink(template, holderPosition, [apron]);
    placed.updateMatrixWorld(true);
    const drawn = new THREE.Box3().setFromObject(placed);
    apron.updateMatrixWorld(true);
    const apronBox = new THREE.Box3().setFromObject(apron).translate(holderPosition.clone().negate());
    const drawnFace = sign === 1 ? drawn.max[axis] : drawn.min[axis];
    const apronFace = sign === 1 ? apronBox.max[axis] : apronBox.min[axis];
    expect(drawnFace).toBeCloseTo(apronFace, 6);
    const lateral = axis === "z" ? "x" : "z";
    expect((drawn.min[lateral] + drawn.max[lateral]) / 2).toBeCloseTo(0, 6);
    expect(drawn.getSize(new THREE.Vector3())[lateral]).toBeCloseTo(33 * INCH, 6);
    expect(drawn.max.y).toBeCloseTo(0, 6);
  });

  it("leaves a drawing without an apron where it was oriented", () => {
    const dropIn = dropInDrawing();
    const placed = placeManufacturerSink(dropIn, new THREE.Vector3(), [builtInApron("top")]);
    expect(placed.rotation.y).toBe(0);
    expect(placed.position.toArray()).toEqual([0, 0, 0]);
  });

  it("lifts the rim the same height as the built-in rim", () => {
    expect(MANUFACTURER_SINK_RIM_LIFT_FT).toBeCloseTo(0.018, 6);
  });

  it("reads the PL-300 drawing's apron on its front edge and aligns it", async () => {
    const file = path.resolve("client/public/models/pelican/pl-300.glb");
    if (!fs.existsSync(file)) return;
    const buffer = fs.readFileSync(file);
    const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) => new GLTFLoader().parse(data, "", resolve as never, reject));
    const root = new THREE.Group();
    root.add(gltf.scene);
    orientManufacturerSink(root, 39.37007874015748);
    expect(root.userData.manufacturerApronSign).toBe(1);
    const apron = builtInApron("top", 33, 20.75);
    const holderPosition = new THREE.Vector3(5, 3, 7);
    const placed = placeManufacturerSink(root, holderPosition, [apron]);
    placed.updateMatrixWorld(true);
    const drawn = new THREE.Box3().setFromObject(placed);
    expect(drawn.max.z).toBeCloseTo((20.75 * INCH) / 2, 5);
  });
});

describe("a manufacturer drawing never leaves a hole where the basin was", () => {
  it("keeps the measured bowl, floor and drain so the cabinet cannot show through, and replaces only the rim and apron", () => {
    const flags = ["sinkBowl", "sinkBowlFloor", "sinkDrain", "sinkRim", "sinkApronFront"] as const;
    const nodes = flags.map((flag) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      mesh.userData = { [flag]: true };
      return mesh;
    });
    hideParametricBasin(new THREE.Group(), nodes);

    expect(nodes[flags.indexOf("sinkBowl")]!.visible).toBe(true);
    expect(nodes[flags.indexOf("sinkBowlFloor")]!.visible).toBe(true);
    expect(nodes[flags.indexOf("sinkDrain")]!.visible).toBe(true);
    expect(nodes[flags.indexOf("sinkRim")]!.visible).toBe(false);
    expect(nodes[flags.indexOf("sinkApronFront")]!.visible).toBe(false);
  });
});
