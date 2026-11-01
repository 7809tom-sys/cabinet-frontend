import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  THREE_D_CUTAWAY_WALL_OPACITY,
  THREE_D_WALL_OPACITY,
  THREE_D_DESIGNER_WALL_OPACITY,
  THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY,
  THREE_D_DOLLHOUSE_MOUNT_DEPTH_IN,
  threeDDollhouseMountWalls,
  threeDDollhouseWallFrames,
  threeDDollhouseHidesWithWall,
  threeDDollhouseWallHidesFromCamera,
  threeDWallObscuresOrbitTarget,
} from "./InteractiveRoom3D";
import * as THREE from "three";

const front = [{ x: 0, y: 0 }, { x: 120, y: 0 }] as const;
const back = [{ x: 0, y: 120 }, { x: 120, y: 120 }] as const;
const right = [{ x: 120, y: 0 }, { x: 120, y: 120 }] as const;

const rectangle = [
  { side: "top", start: { x: 0, y: 0 }, end: { x: 12, y: 0 } },
  { side: "right", start: { x: 12, y: 0 }, end: { x: 12, y: -10 } },
  { side: "bottom", start: { x: 12, y: -10 }, end: { x: 0, y: -10 } },
  { side: "left", start: { x: 0, y: -10 }, end: { x: 0, y: 0 } },
];

describe("regular Designer clear 3D view", () => {
  it("keeps walls that stay in view translucent, and hides the walls between the camera and the interior", () => {
    expect(THREE_D_DESIGNER_WALL_OPACITY).toBe(0.28);
    expect(THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY).toBe(0.14);
    expect(THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY).toBeGreaterThan(0.05);
    expect(THREE_D_DESIGNER_WALL_OPACITY).toBeLessThan(THREE_D_WALL_OPACITY);
    const renderer = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(renderer).toContain("cutawayRoomWalls && !showSolidFrontWalls ? THREE_D_DESIGNER_WALL_OPACITY : THREE_D_WALL_OPACITY");
    expect(renderer).toContain("threeDDollhouseWallHidesFromCamera");
    expect(renderer).toContain("setThreeDDollhouseHidden");
    expect(renderer).not.toContain("? THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY : THREE_D_DESIGNER_WALL_OPACITY");
  });
  it("ghosts only the foreground wall between the camera and the design", () => {
    const camera = { x: 60, z: 10 };
    const target = { x: 60, z: -60 };
    expect(threeDWallObscuresOrbitTarget(...front, camera, target)).toBe(true);
    expect(threeDWallObscuresOrbitTarget(...back, camera, target)).toBe(false);
    expect(threeDWallObscuresOrbitTarget(...right, camera, target)).toBe(false);
    expect(THREE_D_CUTAWAY_WALL_OPACITY).toBeLessThan(0.05);
    expect(THREE_D_WALL_OPACITY).toBeGreaterThan(0.7);
  });

  it("moves the cutaway with the orbit instead of hiding all walls", () => {
    const camera = { x: 130, z: -60 };
    const target = { x: 60, z: -60 };
    expect(threeDWallObscuresOrbitTarget(...right, camera, target)).toBe(true);
    expect(threeDWallObscuresOrbitTarget(...front, camera, target)).toBe(false);
  });

  it("does not ghost a wall outside the sightline, or a wall behind the camera", () => {
    expect(threeDWallObscuresOrbitTarget({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 60, z: 10 }, { x: 60, z: -60 })).toBe(false);
    expect(threeDWallObscuresOrbitTarget(...front, { x: 60, z: -60 }, { x: 60, z: -80 })).toBe(false);
  });

  it("defaults the dollhouse cutaway on for every Designer mount, and keeps a solid-walls control", () => {
    const host = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
    const renderer = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(host).toContain("cutawayRoomWalls");
    expect(renderer).toContain("cutawayRoomWalls = true");
    expect(renderer).toContain("Show solid front walls");
    expect(renderer).toContain("setShowSolidFrontWalls");
    expect(renderer).toContain("dollhouseHidden");
  });

  it("hides only the walls whose inward side faces away from the camera, including a corner orbit", () => {
    const walls = threeDDollhouseWallFrames(rectangle);
    const bySide = Object.fromEntries(walls.map((wall) => [wall.side, wall]));
    const inside = { x: 6, z: 5 };
    expect(walls.map((wall) => threeDDollhouseWallHidesFromCamera(wall, inside))).toEqual([false, false, false, false]);
    expect(threeDDollhouseWallHidesFromCamera(bySide.top, { x: 6, z: -2 })).toBe(true);
    expect(threeDDollhouseWallHidesFromCamera(bySide.right, { x: 6, z: -2 })).toBe(false);
    expect(threeDDollhouseWallHidesFromCamera(bySide.right, { x: 16, z: 5 })).toBe(true);
    expect(threeDDollhouseWallHidesFromCamera(bySide.bottom, { x: 16, z: 5 })).toBe(false);
    const outsideCorner = { x: 16, z: -2 };
    expect(threeDDollhouseWallHidesFromCamera(bySide.top, outsideCorner)).toBe(true);
    expect(threeDDollhouseWallHidesFromCamera(bySide.right, outsideCorner)).toBe(true);
    expect(threeDDollhouseWallHidesFromCamera(bySide.left, outsideCorner)).toBe(false);
    expect(threeDDollhouseWallHidesFromCamera(bySide.bottom, outsideCorner)).toBe(false);
  });

  it("hides a mounted cabinet with its nearest wall, and a true corner cabinet with either wall", () => {
    const walls = threeDDollhouseWallFrames(rectangle);
    expect(THREE_D_DOLLHOUSE_MOUNT_DEPTH_IN).toBe(32);
    expect(threeDDollhouseMountWalls({ x: 6, z: 0.2 }, walls, 3)).toEqual(["top"]);
    expect(threeDDollhouseMountWalls({ x: 11.2, z: 4 }, walls, 3)).toEqual(["right"]);
    expect(threeDDollhouseMountWalls({ x: 0.7, z: 0.7 }, walls, 3).sort()).toEqual(["left", "top"]);
    expect(threeDDollhouseMountWalls({ x: 6, z: 5 }, walls, 3)).toEqual([]);
  });

  it("keeps cabinets on a cut-away wall visible; only that wall's windows, doors, and backsplash go with it", () => {
    const item = (userData: Record<string, unknown>) => Object.assign(new THREE.Group(), { userData });
    expect(threeDDollhouseHidesWithWall(item({ placedUid: "b24", masterCode: "B24" }))).toBe(false);
    expect(threeDDollhouseHidesWithWall(item({ placedUid: "w3030", masterCode: "W3030" }))).toBe(false);
    expect(threeDDollhouseHidesWithWall(item({ countertop: true }))).toBe(false);
    expect(threeDDollhouseHidesWithWall(item({ openingUid: "window-1", kind: "window" }))).toBe(true);
    expect(threeDDollhouseHidesWithWall(item({ measuredBacksplash: true }))).toBe(true);
    // Baseboards (PR #162) are wall-mounted trim, so they fade with their wall like the backsplash does.
    expect(threeDDollhouseHidesWithWall(item({ baseboard: true, side: "top" }))).toBe(true);
    const renderer = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(renderer).toContain("setThreeDDollhouseHidden(child, threeDDollhouseHidesWithWall(child) && mounted.some((side) => hiddenSides.has(side)));");
    // Each wall's backsplash segment is its own top-level piece, so it fades
    // with that wall only.
    expect(renderer).toContain("mesh.userData = { measuredBacksplash: true, ...segment");
    expect(renderer).toContain("addThreeDBacksplash(catalogRoot, backsplashSegments");
    // The wall itself still fades away from the camera.
    expect(renderer).toContain("mesh.visible = !hide;");
  });
});

