/**
 * Tom's two Nov 4 2026 rules, checked against the meshes the live 3D renderer builds:
 *
 * 1. A painted / HDF / MDF face renders solid in the resolved door color. No door
 *    photo, no wood-grain tile, and no per-piece grain crop. Stained wood keeps its
 *    grain.
 * 2. The raised-panel profile and the door texture belong to door and drawer fronts
 *    only. Cabinet sides, tops, bottoms, and end skins stay flat finished surfaces.
 *    An end treatment is added only when the cabinet's end-side box is checked.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { addCabinet } from "./InteractiveRoom3D";

type Mesh = THREE.Mesh & { userData: Record<string, unknown> };

function baseSku(overrides: Record<string, unknown> = {}) {
  return {
    placementUid: "raised-1",
    masterCode: "B18",
    description: '18" Base Cabinet',
    placementType: "base",
    width: 18,
    depth: 24,
    height: 34.5,
    numberOfDoors: 1,
    numberOfDrawers: 1,
    category: "Base",
    subCategory: "Standard Base",
    ...overrides,
  } as never;
}

/** The raised face as the designer resolves it for Casselberry CW (330026). */
const RAISED_PAINTED_PROFILE = {
  doorStyle: "Raised Panel",
  doorPanelType: "Mitered frame",
  panelConstruction: "raised" as const,
  bevelWidth: 0.75,
  bevelDepth: 0.28,
  insideEdgeProfile: "bevel",
  drawerFrontType: "five-piece-raised" as const,
  paintedFinish: true,
  raisedPanelSource: "library" as const,
};

const RAISED_WOOD_PROFILE = {
  ...RAISED_PAINTED_PROFILE,
  paintedFinish: false,
};

function build(profile: Record<string, unknown>, options: {
  color?: string;
  doorSampleUrl?: string | null;
  drawerSampleUrl?: string | null;
  decorativeEnd?: "none" | "left" | "right" | "both";
  decorativeEndIsDoor?: boolean;
} = {}) {
  const root = new THREE.Group();
  addCabinet(
    root,
    baseSku({
      decorativeEnd: options.decorativeEnd ?? "none",
      decorativeEndIsDoor: options.decorativeEndIsDoor ?? false,
    }),
    null,
    {},
    144,
    120,
    options.color ?? "#eeeadf",
    "#f8f8f6",
    profile as never,
    undefined,
    options.doorSampleUrl ?? null,
    undefined,
    options.drawerSampleUrl ? { drawerSampleUrl: options.drawerSampleUrl } : undefined,
  );
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if ((node as Mesh).isMesh) meshes.push(node as Mesh);
  });
  return { root, meshes };
}

/** Frames are Groups, so collect them from the object tree, not the mesh list. */
function raisedMeshes(root: THREE.Object3D, meshes: readonly Mesh[]) {
  const groups: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node.userData.physicalRails === true) groups.push(node);
  });
  return {
    bevels: meshes.filter((mesh) => mesh.userData.raisedPanelBevel === true),
    centers: meshes.filter((mesh) => mesh.userData.raisedCenterPanel === true),
    recesses: meshes.filter((mesh) => mesh.userData.raisedPanelRecess === true),
    frames: groups,
  };
}

function frontMaterial(mesh: Mesh): THREE.MeshStandardMaterial | null {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return material instanceof THREE.MeshStandardMaterial ? material : null;
}

describe("raised panel profile stays on door and drawer fronts", () => {
  it("builds the raised frame, bevel, and raised center on the fronts", () => {
    const { root, meshes } = build(RAISED_PAINTED_PROFILE);
    const raised = raisedMeshes(root, meshes);
    expect(raised.frames.length).toBeGreaterThanOrEqual(2);
    expect(raised.bevels.length).toBeGreaterThanOrEqual(2);
    expect(raised.centers.length).toBeGreaterThanOrEqual(2);
    // Every raised frame is a door or drawer front, never a box surface.
    for (const frame of raised.frames) {
      expect(["door", "drawer"]).toContain(frame.userData.faceRole);
    }
    for (const bevel of raised.bevels) {
      const frame = bevel.parent;
      expect(["door", "drawer"]).toContain(frame?.userData.faceRole);
    }
    for (const center of raised.centers) {
      expect(["door", "drawer"]).toContain(center.userData.faceRole);
    }
  });

  it("never attaches a raised bevel, center, or recess to a carcass, side, top, or end skin", () => {
    const { meshes } = build(RAISED_PAINTED_PROFILE, { decorativeEnd: "both" });
    const structural: Mesh[] = [];
    meshes.forEach((mesh) => {
      // Structural surfaces are the box, the side skins, the face frame, and the
      // end treatment panels; they are never a cabinet front.
      const isFront = mesh.userData.cabinetFront === true;
      const isStructural = mesh.userData.selectedFinishSideSkin === true
        || mesh.userData.selectedStyleSideSkin === true
        || mesh.userData.selectedFinishStructuralSurface === true
        || mesh.userData.decorativeEndPanel === true
        || mesh.userData.cabinetFaceFrame === true;
      if (isStructural && !isFront) structural.push(mesh);
    });
    expect(structural.length).toBeGreaterThan(0);
    for (const mesh of structural) {
      expect(mesh.userData.raisedPanelBevel, mesh.userData.decorativeEndSide as string ?? "box").toBeUndefined();
      expect(mesh.userData.raisedCenterPanel, String(mesh.userData.decorativeEndSide ?? "box")).toBeUndefined();
      expect(mesh.userData.raisedPanelRecess, String(mesh.userData.decorativeEndSide ?? "box")).toBeUndefined();
      expect(mesh.userData.physicalRails, String(mesh.userData.decorativeEndSide ?? "box")).toBeUndefined();
    }
  });

  it("adds an end treatment only when the end-side box is checked", () => {
    const { meshes: none } = build(RAISED_PAINTED_PROFILE, { decorativeEnd: "none" });
    expect(none.filter((mesh) => mesh.userData.decorativeEndPanel === true)).toHaveLength(0);

    const { meshes: right } = build(RAISED_PAINTED_PROFILE, { decorativeEnd: "right" });
    const rightPanels = right.filter((mesh) => mesh.userData.decorativeEndPanel === true);
    expect(rightPanels).toHaveLength(1);
    expect(rightPanels[0]?.userData.decorativeEndSide).toBe("right");

    const { meshes: both } = build(RAISED_PAINTED_PROFILE, { decorativeEnd: "both" });
    const bothPanels = both.filter((mesh) => mesh.userData.decorativeEndPanel === true);
    expect(bothPanels).toHaveLength(2);
    expect(bothPanels.map((mesh) => mesh.userData.decorativeEndSide).sort()).toEqual(["left", "right"]);
    // Even an explicit "this end is a door" treatment is a flat panel, not a raised door.
    for (const panel of bothPanels) {
      expect(panel.userData.explicitEndTreatment).toBe(true);
      expect(panel.userData.raisedPanelBevel).toBeUndefined();
      expect(panel.userData.raisedCenterPanel).toBeUndefined();
    }
  });

  it("keeps the raised bevel off a checked end panel that is a door skin", () => {
    const { root, meshes } = build(RAISED_PAINTED_PROFILE, { decorativeEnd: "both", decorativeEndIsDoor: true });
    const endPanels = meshes.filter((mesh) => mesh.userData.decorativeEndPanel === true);
    expect(endPanels).toHaveLength(2);
    const raised = raisedMeshes(root, meshes);
    for (const panel of endPanels) {
      expect(raised.bevels).not.toContain(panel);
      expect(raised.centers).not.toContain(panel);
      expect(panel.userData.faceRole).toBeUndefined();
    }
  });
});

describe("painted finishes render solid", () => {
  it("puts the resolved color on the fronts and drops the door photo", () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, "load");
    try {
      const { meshes } = build(RAISED_PAINTED_PROFILE, {
        color: "#eeeadf",
        doorSampleUrl: "/uploads/casselberry-door.webp",
        drawerSampleUrl: "/uploads/casselberry-drawer.webp",
      });
      // A painted style never requests a texture at all.
      expect(load).not.toHaveBeenCalled();
      const fronts = meshes.filter((mesh) => mesh.userData.cabinetFront === true && mesh.userData.cabinetFaceShadowGap !== true);
      expect(fronts.length).toBeGreaterThan(0);
      for (const front of fronts) {
        const material = frontMaterial(front);
        if (!material) continue;
        expect(material.map, String(front.userData.masterCode ?? "front")).toBeNull();
        expect(`#${material.color.getHexString()}`).toBe("#eeeadf");
      }
    } finally {
      load.mockRestore();
    }
  });

  it("leaves a stained raised face on its grain path", () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation((() => new THREE.Texture()) as THREE.TextureLoader["load"]);
    try {
      const { root, meshes } = build(RAISED_WOOD_PROFILE, {
        color: "#8b6040",
        doorSampleUrl: "/uploads/casselberry-saddle-door.webp",
        drawerSampleUrl: "/uploads/casselberry-saddle-drawer.webp",
      });
      // Stained wood still loads its sample.
      expect(load).toHaveBeenCalled();
      const doorFronts = meshes.filter((mesh) => mesh.userData.cabinetFront === true && mesh.userData.cabinetDrawerFront !== true);
      expect(doorFronts.length).toBeGreaterThan(0);
      const textured = doorFronts.filter((mesh) => frontMaterial(mesh)?.map);
      expect(textured.length).toBeGreaterThan(0);
      // The raised geometry is still built on the stained door.
      expect(raisedMeshes(root, meshes).bevels.length).toBeGreaterThan(0);
    } finally {
      load.mockRestore();
    }
  });

  it("stamps no per-piece wood grain on a painted cabinet", () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation((() => new THREE.Texture()) as THREE.TextureLoader["load"]);
    try {
      const { meshes } = build(RAISED_PAINTED_PROFILE, {
        color: "#eeeadf",
        doorSampleUrl: "/uploads/casselberry-door.webp",
      });
      expect(meshes.some((mesh) => mesh.userData.woodGrainStamped === true)).toBe(false);
      expect(meshes.some((mesh) => mesh.geometry?.userData?.woodGrainStamped === true)).toBe(false);
    } finally {
      load.mockRestore();
    }
  });

  it("stamps grain on a stained cabinet", () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation((((url: string) => {
      const texture = new THREE.Texture();
      texture.name = String(url);
      return texture;
    }) as unknown) as THREE.TextureLoader["load"]);
    try {
      build(RAISED_WOOD_PROFILE, {
        color: "#8b6040",
        doorSampleUrl: "/uploads/casselberry-saddle-door.webp",
      });
      expect(load).toHaveBeenCalled();
    } finally {
      load.mockRestore();
    }
  });
});

describe("the door photo does not leak onto carcass surfaces", () => {
  it("keeps sides, tops, bottoms, and end skins on the same door appearance as the fronts", () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation((((url: string) => {
      const texture = new THREE.Texture();
      texture.name = String(url);
      return texture;
    }) as unknown) as THREE.TextureLoader["load"]);
    try {
      const { meshes } = build({ ...RAISED_WOOD_PROFILE, exposedSidesMatchDoorFace: false }, {
        color: "#8b6040",
        doorSampleUrl: "/uploads/casselberry-saddle-door.webp",
        decorativeEnd: "both",
      });
      const skins = meshes.filter((mesh) => mesh.userData.cabinetFront !== true && (
        mesh.userData.selectedFinishSideSkin === true
        || mesh.userData.selectedStyleSideSkin === true
        || mesh.userData.decorativeEndPanel === true
      ));
      expect(skins.length).toBeGreaterThan(0);
      for (const skin of skins) {
        const material = frontMaterial(skin);
        if (!material) continue;
        // Restoration (Nov 5 2026): structural surfaces share the door appearance,
        // so they carry the sample and a white tint instead of a second solid hex.
        expect(material.map, String(skin.userData.decorativeEndSide ?? "skin")).not.toBeNull();
        expect(`#${material.color.getHexString()}`, String(skin.userData.decorativeEndSide ?? "skin")).toBe("#ffffff");
        expect(skin.userData.raisedPanelBevel).toBeUndefined();
        expect(skin.userData.raisedCenterPanel).toBeUndefined();
      }
    } finally {
      load.mockRestore();
    }
  });
});
