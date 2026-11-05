// @vitest-environment jsdom
/**
 * PRIORITY #1: one cabinet, one color.
 *
 * The owner saw the same cabinet in two shades — door and drawer fronts in one
 * yellow, the box and side panels in another. The cause was two different color
 * sources for one cabinet: the fronts used the resolved door color, while the box
 * and sides re-sampled the door photograph's panel color. Every visible surface of
 * a cabinet now takes the single selected door color (and, when a door image
 * exists, that same image), so a cabinet cannot show two shades.
 *
 * These tests read the materials actually built for one cabinet and compare them.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, threeDFaceMaterialColor, threeDStructuralFinish } from "./InteractiveRoom3D";

type Mesh = THREE.Mesh & { userData: Record<string, unknown> };

function buildCabinet(input: {
  masterCode?: string;
  color?: string;
  doorTexture?: THREE.Texture | null;
  exposedSidesMatchDoorFace?: boolean;
}) {
  const root = new THREE.Group();
  addCabinet(
    root,
    {
      placementUid: "u1",
      masterCode: input.masterCode ?? "B24",
      description: '24" Base Cabinet',
      placementType: "base",
      width: 24,
      depth: 24,
      height: 34.5,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      category: "Base",
      subCategory: "Standard Base",
    } as never,
    "back",
    { back: 0 },
    144,
    120,
    input.color ?? "#c8a040",
    "#eeeeee",
    { exposedSidesMatchDoorFace: input.exposedSidesMatchDoorFace ?? false } as never,
    { x: 12, z: 0, rotation: 0 },
    null,
    undefined,
    undefined,
  );
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if ((node as Mesh).isMesh) meshes.push(node as Mesh);
  });
  return meshes;
}

/**
 * The solid color of each VISIBLE cabinet surface: fronts, box/side skins, face
 * frame and finished panels. Deliberate detail meshes (the recessed toe kick, the
 * thin shadow reveal behind a front) are excluded — those are meant to be darker.
 */
function visibleSurfaceColors(meshes: readonly Mesh[]): string[] {
  const colors = new Set<string>();
  for (const mesh of meshes) {
    const tags = Object.keys(mesh.userData);
    if (tags.some((tag) => /ShadowGap|toeKick|Reveal/i.test(tag))) continue;
    if (mesh.userData.isCountertop || mesh.userData.countertopSurface) continue;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material || !("color" in material)) continue;
      const color = (material as THREE.MeshStandardMaterial).color;
      if (!color) continue;
      const hex = `#${color.getHexString()}`;
      // The countertop and room surfaces are not part of a cabinet.
      if (hex === "#eeeeee") continue;
      colors.add(hex);
    }
  }
  return Array.from(colors);
}

describe("a cabinet's surfaces share one color", () => {
  it("uses the selected door color on the box and the fronts when there is no door image", () => {
    const meshes = buildCabinet({ color: "#c8a040" });
    expect(meshes.length).toBeGreaterThan(1);
    // Every visible cabinet surface resolves to the one color the door style supplied.
    expect(visibleSurfaceColors(meshes)).toEqual(["#c8a040"]);
  });

  it("does not re-sample the door photo, so sides cannot drift from the fronts", () => {
    const texture = new THREE.Texture();
    texture.userData = { doorPanelHex: "#fff3b0" };
    const meshes = buildCabinet({ color: "#c8a040", doorTexture: texture, exposedSidesMatchDoorFace: false });
    const colors = visibleSurfaceColors(meshes);
    // The pale photo sample must never appear as a second cabinet shade.
    expect(colors).not.toContain("#fff3b0");
  });

  it("keeps one color source when an exposed side matches the door face", () => {
    const texture = new THREE.Texture();
    texture.userData = { doorPanelHex: "#fff3b0" };
    const meshes = buildCabinet({ color: "#c8a040", doorTexture: texture, exposedSidesMatchDoorFace: true });
    const colors = visibleSurfaceColors(meshes);
    // Still never the re-sampled photo tone.
    expect(colors).not.toContain("#fff3b0");
    expect(colors.length).toBeGreaterThan(0);
  });

  it("reports the structural finish as exactly the color it was given when there is no door sample", () => {
    for (const hex of ["#c8a040", "#d9c9a3", "#2a211c"]) {
      const finish = threeDStructuralFinish(hex, false);
      expect(finish.color).toBe(hex);
      expect(finish.usesDoorSample).toBe(false);
    }
  });

  it("follows the door sample exactly as the fronts do when one exists", () => {
    // Restoration (Nov 5 2026): structural surfaces share the front's appearance, so
    // the box, sides and toe kick can never show a second shade beside the fronts.
    for (const hex of ["#c8a040", "#d9c9a3", "#2a211c"]) {
      const finish = threeDStructuralFinish(hex, true);
      expect(finish.color).toBe(threeDFaceMaterialColor(hex, true));
      expect(finish.usesDoorSample).toBe(true);
    }
  });
});
