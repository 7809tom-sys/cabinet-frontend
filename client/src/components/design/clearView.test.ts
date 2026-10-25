import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  THREE_D_CUTAWAY_WALL_OPACITY,
  THREE_D_WALL_OPACITY,
  THREE_D_DESIGNER_WALL_OPACITY,
  THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY,
  threeDWallObscuresOrbitTarget,
} from "./InteractiveRoom3D";

const front = [{ x: 0, y: 0 }, { x: 120, y: 0 }] as const;
const back = [{ x: 0, y: 120 }, { x: 120, y: 120 }] as const;
const right = [{ x: 120, y: 0 }, { x: 120, y: 120 }] as const;

describe("regular Designer clear 3D view", () => {
  it("keeps regular Designer walls visibly translucent rather than solid or invisible", () => {
    expect(THREE_D_DESIGNER_WALL_OPACITY).toBe(0.28);
    expect(THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY).toBe(0.14);
    expect(THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY).toBeGreaterThan(0.05);
    expect(THREE_D_DESIGNER_WALL_OPACITY).toBeLessThan(THREE_D_WALL_OPACITY);
    const renderer = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(renderer).toContain("cutawayRoomWalls && !showSolidFrontWalls ? THREE_D_DESIGNER_WALL_OPACITY : THREE_D_WALL_OPACITY");
    expect(renderer).toContain("? THREE_D_DESIGNER_FOREGROUND_WALL_OPACITY : THREE_D_DESIGNER_WALL_OPACITY");
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

  it("opts in only the regular Designer, retaining a solid-walls control", () => {
    const host = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
    const renderer = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(host).toContain("cutawayRoomWalls");
    expect(renderer).toContain('cutawayRoomWalls = false');
    expect(renderer).toContain("Show solid front walls");
    expect(renderer).toContain("setShowSolidFrontWalls");
  });
});
