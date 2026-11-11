import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "./InteractiveRoom3D";
import { DOOR_PULL_EDGE_CLEARANCE_IN, TALL_DOOR_PULL_FLOOR_HEIGHT_IN } from "@/lib/hardware";
import type { PlacedCabinet } from "@/lib/design";

function render(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "masterCode" | "placement" | "width" | "height" | "description">) {
  const cabinet = {
    uid: partial.masterCode,
    cabinetId: 1,
    depth: partial.placement === "wall" ? 12 : 24,
    x: 0,
    y: 0,
    rotation: 0,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    ...partial,
  } as PlacedCabinet;
  const root = new THREE.Group();
  addCabinet(
    root,
    existingCabinetSku(cabinet),
    null,
    {},
    144,
    120,
    "#e6d3a3",
    "#ffffff",
    { doorStyle: "Shaker", doorPanelType: "shaker" },
    existingCabinetTransform(cabinet),
    undefined,
    undefined,
    { hardwareStyleId: "bar-pull" },
  );
  const fronts: THREE.Mesh[] = [];
  const pulls: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && node.userData.cabinetFront && !node.userData.physicalRail && !node.userData.shakerNotch) fronts.push(node);
    if (node.userData.cabinetHardware && node.userData.cabinetPull && !node.userData.cabinetHardwareMount) pulls.push(node);
  });
  return { fronts, pulls };
}

function doorOf(fronts: THREE.Mesh[]) {
  return fronts.filter((node) => !node.userData.cabinetDrawerFront);
}

describe("3D door handle placement", () => {
  it("puts a base door pull just under the top edge, on the stile opposite the hinge", () => {
    const { fronts, pulls } = render({
      masterCode: "B18FH",
      description: "18 inch Full Height Single Door Base Cabinet",
      placement: "base",
      width: 18,
      height: 34.5,
      numberOfDoors: 1,
      numberOfDrawers: 0,
      swing: "left",
    });
    const door = doorOf(fronts)[0]!;
    const pull = pulls.find((node) => node.userData.cabinetPull === "door") as THREE.Mesh;
    const doorHeight = (door.geometry as THREE.BoxGeometry).parameters.height;
    const pullHeight = (pull.geometry as THREE.BoxGeometry).parameters.height;
    const doorTop = door.position.y + doorHeight / 2;
    expect(pull.userData.verticalPull).toBe(true);
    expect(pull.userData.pullVerticalAnchor).toBe("top");
    expect(pull.userData.handleSide).toBe("right");
    expect(((doorTop - (pull.position.y + pullHeight / 2)) * 12)).toBeCloseTo(DOOR_PULL_EDGE_CLEARANCE_IN, 6);
    expect(Math.abs(pull.position.x)).toBeGreaterThan(doorHeight * 0.15);
  });

  it("keeps a drawer-over-door drawer pull centered and the door pull at the top of the door", () => {
    const { fronts, pulls } = render({
      masterCode: "B18",
      description: "18 inch Single Door Single Drawer Base Cabinet",
      placement: "base",
      width: 18,
      height: 34.5,
      numberOfDoors: 1,
      numberOfDrawers: 1,
      swing: "left",
    });
    const door = doorOf(fronts)[0]!;
    const doorPull = pulls.find((node) => node.userData.cabinetPull === "door") as THREE.Mesh;
    const drawerPull = pulls.find((node) => node.userData.cabinetPull === "drawer") as THREE.Mesh;
    const doorHeight = (door.geometry as THREE.BoxGeometry).parameters.height;
    const pullHeight = (doorPull.geometry as THREE.BoxGeometry).parameters.height;
    expect(drawerPull.userData).toMatchObject({ verticalPull: false, pullEdge: "center", handleSide: "center" });
    expect(drawerPull.position.x).toBeCloseTo(0, 6);
    expect(doorPull.userData.pullVerticalAnchor).toBe("top");
    expect(((door.position.y + doorHeight / 2) - (doorPull.position.y + pullHeight / 2)) * 12).toBeCloseTo(DOOR_PULL_EDGE_CLEARANCE_IN, 6);
    expect(doorPull.position.x).toBeGreaterThan(0);
  });

  it("puts two base door pulls on the inner meeting stiles", () => {
    const { fronts, pulls } = render({
      masterCode: "B30",
      description: "30 inch Double Door Base Cabinet",
      placement: "base",
      width: 30,
      height: 34.5,
      numberOfDoors: 2,
      numberOfDrawers: 1,
    });
    const doors = doorOf(fronts).sort((a, b) => a.position.x - b.position.x);
    const doorPulls = pulls.filter((node) => node.userData.cabinetPull === "door").sort((a, b) => a.position.x - b.position.x);
    expect(doors).toHaveLength(2);
    expect(doorPulls).toHaveLength(2);
    doors.forEach((door, index) => {
      const width = (door.geometry as THREE.BoxGeometry).parameters.width;
      const towardCenter = index === 0 ? 1 : -1;
      expect((doorPulls[index]!.position.x - door.position.x) * towardCenter).toBeGreaterThan(0);
      expect((width / 2 - Math.abs(doorPulls[index]!.position.x - door.position.x)) * 12).toBeCloseTo(1.5, 6);
      expect(doorPulls[index]!.userData.verticalPull).toBe(true);
    });
  });

  it("puts a wall door pull just above the bottom edge, opposite the hinge", () => {
    const { fronts, pulls } = render({
      masterCode: "W1830",
      description: "18 inch Wall Cabinet",
      placement: "wall",
      width: 18,
      height: 30,
      numberOfDoors: 1,
      numberOfDrawers: 0,
      mountBottom: 54,
      swing: "right",
    });
    const door = doorOf(fronts)[0]!;
    const pull = pulls.find((node) => node.userData.cabinetPull === "door") as THREE.Mesh;
    const doorHeight = (door.geometry as THREE.BoxGeometry).parameters.height;
    const pullHeight = (pull.geometry as THREE.BoxGeometry).parameters.height;
    const doorBottom = door.position.y - doorHeight / 2;
    expect(pull.userData.pullVerticalAnchor).toBe("bottom");
    expect(pull.userData.handleSide).toBe("left");
    expect(((pull.position.y - pullHeight / 2) - doorBottom) * 12).toBeCloseTo(DOOR_PULL_EDGE_CLEARANCE_IN, 6);
  });

  it("puts a full-height tall pull at a 42 inch reach, and stacked pantry pulls at the meeting rail", () => {
    const tall = render({
      masterCode: "T3090",
      description: "30 inch Tall Cabinet",
      placement: "tall",
      width: 30,
      height: 90,
      numberOfDoors: 1,
      numberOfDrawers: 0,
    });
    const tallPull = tall.pulls.find((node) => node.userData.cabinetPull === "door")!;
    expect(tallPull.userData.pullVerticalAnchor).toBe("reach");
    // Cabinet center is 45" off the floor; local y is feet above that center.
    expect(45 + tallPull.position.y * 12).toBeCloseTo(TALL_DOOR_PULL_FLOOR_HEIGHT_IN, 5);

    const pantry = render({
      masterCode: "P2490",
      description: "24 inch Pantry Cabinet",
      placement: "tall",
      width: 24,
      height: 90,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    });
    const leaves = pantry.fronts.filter((node) => node.userData.pantryDoorSet).sort((a, b) => a.position.y - b.position.y);
    const leafPulls = pantry.pulls.filter((node) => node.userData.cabinetPull === "door").sort((a, b) => a.position.y - b.position.y);
    expect(leaves).toHaveLength(2);
    expect(leafPulls).toHaveLength(2);
    const lower = leaves[0]!;
    const upper = leaves[1]!;
    const lowerPull = leafPulls[0] as THREE.Mesh;
    const upperPull = leafPulls[1] as THREE.Mesh;
    const lowerTop = lower.position.y + (lower.geometry as THREE.BoxGeometry).parameters.height / 2;
    const upperBottom = upper.position.y - (upper.geometry as THREE.BoxGeometry).parameters.height / 2;
    expect(lowerPull.userData.pullVerticalAnchor).toBe("top");
    expect(upperPull.userData.pullVerticalAnchor).toBe("bottom");
    expect((lowerTop - (lowerPull.position.y + (lowerPull.geometry as THREE.BoxGeometry).parameters.height / 2)) * 12).toBeCloseTo(DOOR_PULL_EDGE_CLEARANCE_IN, 5);
    expect(((upperPull.position.y - (upperPull.geometry as THREE.BoxGeometry).parameters.height / 2) - upperBottom) * 12).toBeCloseTo(DOOR_PULL_EDGE_CLEARANCE_IN, 5);
  });

  it("re-derives opening-edge pulls for a saved top-center door, and keeps a B18 top-rail choice", () => {
    const staleBase = render({
      masterCode: "B30",
      description: "30 inch Double Door Base",
      placement: "base",
      width: 30,
      height: 34.5,
      numberOfDoors: 2,
      numberOfDrawers: 1,
      hardwarePosition: "top-center",
      handleSide: "top",
      swing: "left",
    });
    const doorPulls = staleBase.pulls.filter((node) => node.userData.cabinetPull === "door");
    expect(doorPulls).toHaveLength(2);
    expect(doorPulls.every((pull) => pull.userData.verticalPull === true && pull.userData.pullVerticalAnchor === "top")).toBe(true);
    const doors = doorOf(staleBase.fronts).sort((a, b) => a.position.x - b.position.x);
    doors.forEach((door, index) => {
      const towardCenter = index === 0 ? 1 : -1;
      expect((doorPulls.sort((a, b) => a.position.x - b.position.x)[index]!.position.x - door.position.x) * towardCenter).toBeGreaterThan(0);
    });

    const staleWall = render({
      masterCode: "W3030",
      description: "30 inch Wall Cabinet",
      placement: "wall",
      width: 30,
      height: 30,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      mountBottom: 54,
      hardwarePosition: "top-center",
      swing: "right",
    });
    const wallPulls = staleWall.pulls.filter((node) => node.userData.cabinetPull === "door");
    expect(wallPulls).toHaveLength(2);
    expect(wallPulls.every((pull) => pull.userData.verticalPull === true && pull.userData.pullVerticalAnchor === "bottom")).toBe(true);

    const chosen = render({
      masterCode: "B18",
      description: "18 inch Base",
      placement: "base",
      width: 18,
      height: 34.5,
      numberOfDoors: 1,
      numberOfDrawers: 1,
      hardwarePosition: "top-center",
      swing: "left",
    });
    const chosenPull = chosen.pulls.find((node) => node.userData.cabinetPull === "door")!;
    expect(chosenPull.userData).toMatchObject({ verticalPull: false, hardwarePosition: "top-center", pullEdge: "top-center" });
  });

  it("does not change a selected bar-pull finish when the pull moves", () => {
    const { pulls } = render({
      masterCode: "B18",
      description: "18 inch Base",
      placement: "base",
      width: 18,
      height: 34.5,
      numberOfDoors: 1,
      numberOfDrawers: 1,
    });
    const pull = pulls.find((node) => node.userData.cabinetPull === "door") as THREE.Mesh;
    expect(pull.userData.hardwareStyleId).toBe("bar-pull");
    expect(pull.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
  });
});
