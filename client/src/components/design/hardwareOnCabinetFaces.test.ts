import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { PlacedCabinet } from "@/lib/design";
import { DOOR_PULL_EDGE_CLEARANCE_IN, STANDARD_BASE_DRAWER_ROW_PCT } from "@/lib/hardware";
import { DoorFront, ElevationView, HardwareOverlay } from "./ElevationView";
import { IslandHardwareOverlay } from "./IslandElevationView";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "./InteractiveRoom3D";

function placed(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "masterCode" | "placement" | "width" | "height" | "description">): PlacedCabinet {
  return {
    uid: partial.masterCode,
    cabinetId: 1,
    depth: partial.placement === "wall" ? 12 : 24,
    x: 24,
    y: 0,
    rotation: 0,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    mountBottom: partial.placement === "wall" ? 54 : 0,
    ...partial,
  } as PlacedCabinet;
}

function render3d(cabinet: PlacedCabinet, style: "bar-pull" | "knob") {
  const root = new THREE.Group();
  addCabinet(
    root,
    existingCabinetSku(cabinet),
    null,
    {},
    144,
    120,
    "#f4efe4",
    "#ffffff",
    { doorStyle: "Shaker", doorPanelType: "shaker" },
    existingCabinetTransform(cabinet),
    undefined,
    undefined,
    { hardwareStyleId: style },
  );
  const faces: THREE.Mesh[] = [];
  const hardware: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node.userData.cabinetFront && !node.userData.physicalRail && !node.userData.shakerNotch) faces.push(node);
    if (node.userData.cabinetHardware && node.userData.cabinetPull) hardware.push(node);
  });
  return { faces, hardware };
}

function overlapsFace(pull: THREE.Mesh, face: THREE.Mesh) {
  const pullBox = new THREE.Box3().setFromObject(pull);
  const faceBox = new THREE.Box3().setFromObject(face);
  const overlapX = pullBox.max.x > faceBox.min.x && pullBox.min.x < faceBox.max.x;
  const overlapY = pullBox.max.y > faceBox.min.y && pullBox.min.y < faceBox.max.y;
  const depth = (face.geometry as THREE.BoxGeometry).parameters.depth ?? 0;
  const inFront = pull.position.z > face.position.z + depth / 2;
  return overlapX && overlapY && inFront;
}

function hardwareTops(markup: string, kind: "door-pull" | "drawer-pull") {
  return [...markup.matchAll(new RegExp(`data-cabinet-hardware="${kind}"[^>]*style="([^"]*)"`, "g"))].map((match) => {
    const top = match[1].match(/top:([-\d.]+)/);
    expect(top, match[1]).not.toBeNull();
    return Number(top![1]);
  });
}

describe("cabinet faces keep their pulls and knobs", () => {
  const base = placed({
    masterCode: "B18",
    description: "18 inch Single Door Base",
    placement: "base",
    width: 18,
    height: 34.5,
    numberOfDoors: 1,
    numberOfDrawers: 1,
    swing: "left",
  });
  const wall = placed({
    masterCode: "W1830",
    description: "18 inch Single Door Wall",
    placement: "wall",
    width: 18,
    height: 30,
    numberOfDoors: 1,
    swing: "right",
  });

  it("puts a bar pull on the base door and a centered pull on its drawer, in front of both faces", () => {
    const { faces, hardware } = render3d(base, "bar-pull");
    const doors = faces.filter((face) => !face.userData.cabinetDrawerFront);
    const drawers = faces.filter((face) => face.userData.cabinetDrawerFront);
    const doorPulls = hardware.filter((node) => node.userData.cabinetPull === "door");
    const drawerPulls = hardware.filter((node) => node.userData.cabinetPull === "drawer");
    expect(doors.length).toBeGreaterThan(0);
    expect(drawers.length).toBeGreaterThan(0);
    expect(doorPulls).toHaveLength(1);
    expect(drawerPulls).toHaveLength(1);
    expect(doors.some((door) => overlapsFace(doorPulls[0]!, door))).toBe(true);
    expect(drawers.some((drawer) => overlapsFace(drawerPulls[0]!, drawer))).toBe(true);
    const door = doors[0]!;
    const doorTop = door.position.y + (door.geometry as THREE.BoxGeometry).parameters.height / 2;
    const pull = doorPulls[0]!;
    const pullTop = pull.position.y + (pull.geometry as THREE.BoxGeometry).parameters.height / 2;
    expect((doorTop - pullTop) * 12).toBeCloseTo(DOOR_PULL_EDGE_CLEARANCE_IN, 5);
  });

  it("puts a knob on the wall door and on the base drawer", () => {
    const wallKnobs = render3d(wall, "knob").hardware.filter((node) => node.userData.cabinetPull === "knob");
    const baseKnobs = render3d(base, "knob").hardware.filter((node) => node.userData.cabinetPull === "knob");
    expect(wallKnobs.length).toBeGreaterThan(0);
    expect(baseKnobs.length).toBeGreaterThanOrEqual(2);
    const wallFaces = render3d(wall, "knob");
    expect(wallFaces.faces.some((face) => overlapsFace(wallKnobs[0]!, face))).toBe(true);
  });

  it("draws the elevation drawer pull on the 20% drawer row and the door pull on the door beneath it", () => {
    const markup = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 1,
      drawers: 1,
      doorPiece: "pull",
      drawerPiece: "pull",
      accent: "#1a2744",
      hardwarePosition: "auto",
      swing: "left",
      isWall: false,
      faceWidthIn: 18,
      cabinetHeightIn: 34.5,
    }));
    const drawerTops = hardwareTops(markup, "drawer-pull");
    const doorTops = hardwareTops(markup, "door-pull");
    expect(drawerTops).toHaveLength(1);
    expect(doorTops).toHaveLength(1);
    expect(drawerTops[0]).toBeGreaterThan(0);
    expect(drawerTops[0]).toBeLessThan(STANDARD_BASE_DRAWER_ROW_PCT);
    expect(doorTops[0]).toBeGreaterThan(STANDARD_BASE_DRAWER_ROW_PCT);
    expect(doorTops[0]).toBeLessThan(100);
    const doorTopEdge = STANDARD_BASE_DRAWER_ROW_PCT;
    const pullVisualHeightPct = 24;
    const clearancePct = (DOOR_PULL_EDGE_CLEARANCE_IN / 34.5) * 100;
    expect(doorTops[0]! - pullVisualHeightPct / 2).toBeCloseTo(doorTopEdge + clearancePct, 5);
  });

  it("keeps an island base door pull on the door under the drawer row", () => {
    const markup = renderToStaticMarkup(createElement(IslandHardwareOverlay, {
      doors: 1,
      drawers: 1,
      doorPiece: "pull",
      drawerPiece: "pull",
      accent: "#1a2744",
      hardwarePosition: "auto",
      swing: "left",
      faceWidthIn: 18,
      isWall: false,
      faceHeightIn: 34.5,
    }));
    const [drawerTop] = hardwareTops(markup, "drawer-pull");
    const [doorTop] = hardwareTops(markup, "door-pull");
    expect(drawerTop).toBeGreaterThan(0);
    expect(drawerTop).toBeLessThan(STANDARD_BASE_DRAWER_ROW_PCT);
    expect(doorTop).toBeGreaterThan(STANDARD_BASE_DRAWER_ROW_PCT);
  });

  it("draws a stored 24 inch single-door wall as two doors, each with a pull", () => {
    const cabinet = placed({
      masterCode: "W2430S",
      description: "Single Door Wall",
      placement: "wall",
      width: 24,
      height: 30,
      numberOfDoors: 1,
    });
    const markup = renderToStaticMarkup(createElement(LanguageProvider, null, createElement(ElevationView, {
      room: { width: 144, depth: 120, ceilingHeight: 96 },
      cabinets: [cabinet],
      selectedUid: null,
      onSelect: () => undefined,
      wall: "back",
      hardwareStyleId: "bar-pull",
    })));
    expect(hardwareTops(markup, "door-pull")).toHaveLength(2);
    const doors = render3d(cabinet, "bar-pull").hardware.filter((node) => node.userData.cabinetPull === "door");
    expect(doors).toHaveLength(2);
    const face = renderToStaticMarkup(createElement(DoorFront, {
      kind: "shaker",
      edge: "#6b5438",
      face: "#f4efe4",
      doors: 2,
      drawers: 0,
      isWall: true,
      cabinetWidthIn: 24,
      cabinetHeightIn: 30,
      masterCode: "W2430S",
    }));
    expect(face).toContain("width:50%");
  });
});
