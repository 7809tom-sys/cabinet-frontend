// @vitest-environment jsdom
/**
 * The mandatory faucet is not just a flag: the build's sink produces real 3D meshes.
 *
 * A faucet lives on the `SinkFixture` record (the flag plus a verified profile id and
 * the three published dimensions). `addSinkFixture` builds the base, the riser and
 * the spout from exactly those numbers. This test runs the real auto-design build,
 * takes the sink it produced, and reads the meshes the real renderer makes — so a
 * faucet that is "present" in the data but draws nothing fails here.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout } from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import { addSinkFixture } from "./InteractiveRoom3D";
import { resolveDeckFaucetPlacement } from "@/lib/faucetPlacement";
import { DEFAULT_PELICAN_KITCHEN_FAUCET } from "@/lib/pelicanFixtureProfiles";
import type { AutoDesignFaucetProduct } from "@/lib/autoDesignFaucet";
import { DEFAULT_ROOM, type DesignCabinet, type RoomData } from "@/lib/design";

type StylePack = { name: string; base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const catalog = matrixCatalog as unknown as Record<string, StylePack>;

const APPLIANCES = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", depth: "25", height: "36", placement: "appliance" },
] as DesignCabinet[];

const CATALOG_FAUCET: AutoDesignFaucetProduct = {
  id: 8203,
  pelicanCode: "PL-8203",
  name: "PL-8203 Fountain Series Pull-Down Kitchen Faucet",
  category: "Sinks & Faucets",
  subCategory: "Faucets",
};

function build(room: RoomData, faucetCatalog: readonly AutoDesignFaucetProduct[]) {
  const pack = catalog["540005"]!;
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: "single-wall",
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 30 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 110 },
      skipDishwasher: true,
      dishwasher: null,
      refrigerator: null,
    } as AutoDesignInputs,
    room,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: [],
    refrigeratorEndPanels: [],
    faucetCatalog,
    styleId: 540005,
    makeUid: () => `m-${++uid}`,
  } as never);
}

type Mesh = THREE.Mesh & { userData: Record<string, unknown> };

function faucetMeshes(root: THREE.Group): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.sinkFaucet === true || mesh.userData.sinkFaucetSpout === true) out.push(mesh);
  });
  return out;
}

describe("the build's faucet is drawn in 3D", () => {
  it("renders a base and a spout from a catalog faucet placed by the build", () => {
    const room: RoomData = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build(room, [CATALOG_FAUCET]);
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    const sink = result.sinks[0]!;
    expect(sink.faucet).toBe(true);

    const root = new THREE.Group();
    addSinkFixture(root, sink, resolveDeckFaucetPlacement(sink, room, [], []));
    const meshes = faucetMeshes(root);
    expect(meshes.length, "no faucet meshes were built").toBeGreaterThan(0);
    expect(meshes.some((mesh) => mesh.userData.sinkFaucetBase === true)).toBe(true);
    expect(meshes.some((mesh) => mesh.userData.sinkFaucetSpout === true)).toBe(true);
  });

  it("renders the built-in default fixture when the line sells no faucet", () => {
    const room: RoomData = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build(room, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedDefaultFaucet).toBe(true);
    const sink = result.sinks[0]!;
    expect(sink.pelicanFaucetProfileId).toBe(DEFAULT_PELICAN_KITCHEN_FAUCET.id);

    const root = new THREE.Group();
    addSinkFixture(root, sink, resolveDeckFaucetPlacement(sink, room, [], []));
    const meshes = faucetMeshes(root);
    expect(meshes.length, "the default fixture built no faucet meshes").toBeGreaterThan(0);
    expect(meshes.some((mesh) => mesh.userData.sinkFaucetBase === true)).toBe(true);
    expect(meshes.some((mesh) => mesh.userData.sinkFaucetSpout === true)).toBe(true);
  });

  it("stands the faucet on the countertop, above the sink rim", () => {
    const room: RoomData = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build(room, [CATALOG_FAUCET]);
    if (!result.ok) return;
    const sink = result.sinks[0]!;
    const root = new THREE.Group();
    addSinkFixture(root, sink, resolveDeckFaucetPlacement(sink, room, [], []));
    const base = faucetMeshes(root).find((mesh) => mesh.userData.sinkFaucetBase === true)!;
    expect(base).toBeDefined();
    // Counter height is 36 inches = 3 scene feet; the base sits just above it.
    expect(base.position.y).toBeGreaterThan(3);
    expect(base.position.y).toBeLessThan(3.4);
  });

  it("draws nothing when the sink has no faucet at all", () => {
    // The rule's job is to prevent this state, so the renderer must still be honest
    // about it rather than inventing a faucet.
    const room: RoomData = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build(room, [CATALOG_FAUCET]);
    if (!result.ok) return;
    const sink = { ...result.sinks[0]!, faucet: false };
    const root = new THREE.Group();
    addSinkFixture(root, sink, resolveDeckFaucetPlacement(sink, room, [], []));
    expect(faucetMeshes(root)).toHaveLength(0);
  });
});
