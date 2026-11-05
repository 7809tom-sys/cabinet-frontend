import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addStudioBay, createStudioDesign, snapStudioPart, STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG, type StudioDesign } from "./vendorClosetStudio";
import { STUDIO_DECOR_SHOE_BOARD_IN, STUDIO_DECOR_SHOE_DEPTH_IN, STUDIO_DECOR_SHOE_REST_BACK_IN, studioBayDecor, studioDecorShoeRest } from "./vendorClosetDecor";

const IN = 1 / 12;
const BAY = 1;

/** A two-tower design whose second tower asks for a shoe organizer near `preferredIn`. */
function designWithShoeShelf(preferredIn: number | null): StudioDesign {
  let design: StudioDesign = { ...createStudioDesign(), roomHeightIn: 100 };
  const neighbor = addStudioBay(design, 24);
  if (!neighbor.ok) throw new Error(neighbor.reason);
  design = neighbor.design;
  for (const [kind, at, itemId] of [["rod", 64, "test-rod"], ["drawer", 20, "test-drawer"]] as const) {
    const staged = snapStudioPart(design, BAY, kind, at, itemId);
    if (!staged.ok) throw new Error(staged.reason);
    design = staged.design;
  }
  if (preferredIn != null) {
    const staged = snapStudioPart(design, BAY, "shoe", preferredIn, "test-shoe");
    if (!staged.ok) throw new Error(staged.reason);
    design = staged.design;
  }
  return design;
}

/** The elevations of the shoe organizers this design really places, in inches. */
const shoeShelfBottoms = (design: StudioDesign) =>
  design.bays[BAY].items.filter((item) => item.kind === "shoe").map((item) => item.bottomIn);

/**
 * Rebuilds the hierarchy the 3D scene builds: a shelf group at the organizer's own elevation,
 * pitched to the illustrative board angle, with the pair a child resting on the board's top face.
 */
function shoeInScene(design: StudioDesign, mountOffsetIn = 0) {
  const [shelfBottomIn] = shoeShelfBottoms(design);
  const bays = design.bays[BAY];
  const shoe = studioBayDecor(design, bays, design.wall).shoes.find((candidate) => candidate.shelfBottomIn === shelfBottomIn);
  if (!shoe) throw new Error("no decor shoe for that shelf");
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(0, (shelfBottomIn + mountOffsetIn) * IN, 14.5 * IN);
  shelfGroup.rotation.x = STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG * Math.PI / 180;
  const rest = studioDecorShoeRest(shoe, bays.widthIn);
  const pair = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  pair.scale.set(shoe.widthIn * 0.46 * IN, shoe.heightIn * IN, STUDIO_DECOR_SHOE_DEPTH_IN * IN);
  pair.position.set(rest.offsetFromBayCenterIn * IN, rest.aboveShelfBottomIn * IN, -rest.behindFrontEdgeIn * IN);
  shelfGroup.add(pair);
  shelfGroup.updateMatrixWorld(true);
  return { world: pair.getWorldPosition(new THREE.Vector3()), rest, shoe, shelfGroup, shelfBottomIn, bayWidthIn: bays.widthIn };
}

describe("decor shoes rest on their own shoe shelf", () => {
  it("takes each pair's shelf elevation from the shoe organizer it stands on, never a fixed height", () => {
    for (const preferredIn of [16, 24, 30, 42]) {
      const design = designWithShoeShelf(preferredIn);
      const placed = shoeShelfBottoms(design);
      expect(placed.length).toBe(1);
      const decor = studioBayDecor(design, design.bays[BAY], design.wall);
      expect(decor.shoes.length).toBeGreaterThan(0);
      // Every pair belongs to the shoe shelf that is really in this bay.
      for (const shoe of decor.shoes) expect(shoe.shelfBottomIn).toBe(placed[0]);
    }
  });

  it("tracks the shelf: raising the organizer raises the pair by exactly the same amount", () => {
    const low = shoeInScene(designWithShoeShelf(9));
    const high = shoeInScene(designWithShoeShelf(34));
    const riseIn = high.shelfBottomIn - low.shelfBottomIn;
    expect(riseIn).toBeGreaterThan(20);
    expect(high.world.y - low.world.y).toBeCloseTo(riseIn * IN, 6);
    // And both sit above their own shelf, not down near the floor as the bug reported.
    for (const scene of [low, high]) {
      expect(scene.world.y).toBeGreaterThan((scene.shelfBottomIn + STUDIO_DECOR_SHOE_BOARD_IN) * IN);
    }
  });

  it("follows the mount mode: a hanging tower lifts the pair by the same 6 in as its tower", () => {
    const design = designWithShoeShelf(24);
    const floorMounted = shoeInScene(design);
    const hanging = shoeInScene(design, 6);
    expect(hanging.world.y - floorMounted.world.y).toBeCloseTo(6 * IN, 6);
  });

  it("stands on the tilted board and inherits its illustrative pitch", () => {
    const scene = shoeInScene(designWithShoeShelf(24));
    expect(scene.rest.pitchDeg).toBe(STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG);
    const pitchRad = STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG * Math.PI / 180;
    expect(scene.shelfGroup.rotation.x).toBeCloseTo(pitchRad, 6);
    // The pair rests on the board's top face `restBack` inches behind the low front edge, so its
    // centre sits half its own height along the board normal above that face. On a 45° board that
    // is the perpendicular lift times cos plus the run back times sin — a tilted rest, not a flat one.
    const expectedRiseIn = (STUDIO_DECOR_SHOE_BOARD_IN + scene.shoe.heightIn / 2) * Math.cos(pitchRad)
      + STUDIO_DECOR_SHOE_REST_BACK_IN * Math.sin(pitchRad);
    expect(scene.world.y - scene.shelfBottomIn * IN).toBeCloseTo(expectedRiseIn * IN, 6);
    // A flat board at that depth would be much lower, so the pitch is what the render shows.
    expect(scene.world.y - scene.shelfBottomIn * IN).toBeGreaterThan(STUDIO_DECOR_SHOE_REST_BACK_IN * Math.sin(pitchRad) * 0.95 * IN);
    // The pair's own up axis follows the board instead of staying world-vertical.
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(scene.shelfGroup.getWorldQuaternion(new THREE.Quaternion()));
    expect(up.y).toBeCloseTo(Math.cos(pitchRad), 6);
    expect(up.z).toBeCloseTo(Math.sin(pitchRad), 6);
  });

  it("keeps the pair on the board: inside its depth and clear of the front fence", () => {
    const scene = shoeInScene(designWithShoeShelf(24));
    const backEdgeIn = scene.rest.behindFrontEdgeIn + STUDIO_DECOR_SHOE_DEPTH_IN / 2;
    const frontEdgeIn = scene.rest.behindFrontEdgeIn - STUDIO_DECOR_SHOE_DEPTH_IN / 2;
    expect(frontEdgeIn).toBeGreaterThan(0.5); // outside the 0.5 in illustrative fence
    expect(backEdgeIn).toBeLessThanOrEqual(14.5 * 0.94); // inside the pitched board
  });

  it("has nothing to draw on a tower without a shoe organizer", () => {
    const design = designWithShoeShelf(null);
    expect(shoeShelfBottoms(design)).toEqual([]);
    for (const bay of design.bays) expect(studioBayDecor(design, bay, design.wall).shoes).toEqual([]);
  });
});

describe("the 3D scene parents decor shoes to the shoe shelf instead of the floor", () => {
  const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");

  it("adds each pair to the shelf group built for its own elevation", () => {
    const shoeBranch = scene.split('else if (item.kind === "shoe")')[1]?.split('else if (item.kind === "drawer")')[0];
    expect(shoeBranch).toContain("shoeGroup.rotation.x = shoePitchRad");
    expect(shoeBranch).toContain("shoeShelfGroups.set(bay.id, shelves)");
    // The decor pair is built from the shared resting helper and hung off the shelf group.
    expect(scene).toContain("studioDecorShoeRest(shoe, bayWidthIn, pair)");
    expect(scene).toContain("shelf.decorGroup.add(piece)");
    expect(scene).toContain('decorKind: "shoe", decorOnly: true');
  });

  it("no longer places a pair at a hard-coded height or flat on the bay floor", () => {
    // The old bug: `(shoe.heightIn + hangingOffsetIn)` at a fixed 7.4 in depth, ignoring the shelf.
    expect(scene).not.toContain("shoe.heightIn + hangingOffsetIn");
    expect(scene).not.toMatch(/decorKind: "shoe"[^}]*?7\.4/);
  });

  it("still hides decor shoes when the Clothes toggle is off", () => {
    // The shoe decor group is registered on its own, because it is no longer a child of the bay group.
    expect(scene).toContain("decorGroups.push(decorGroup)");
    expect(scene).toContain("for (const group of decorGroupsRef.current) group.visible = decor;");
  });
});
