// @vitest-environment jsdom
/**
 * One finish, every wall (Tom, Nov 14 2026).
 *
 * An Auto Design kitchen in one off-white Shaker line rendered cream on the
 * fridge/range wall and bright white on the sink wall. The cabinet data was
 * already one finish: every generated cabinet carries the same style id and the
 * same material color (checked below). The split came from the 3D room lighting:
 *
 *  - the key light was warm (#fff5e6) and came from +X, the fill was cool blue
 *    (#cfe0f4) and came from -X, so a left-wall cabinet (facing +X) was lit warm
 *    and a right-wall cabinet (facing -X) was lit blue-white;
 *  - three's RoomEnvironment has its light boxes on one side, and a scene
 *    environment drives cabinet materials at full strength, so back-wall fronts
 *    received far more ambient light than side-wall fronts.
 *
 * The room now uses one neutral light color, a mirrored key pair that gives the
 * back and both side walls the same direct light, and an environment that varies
 * only with height.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, uniformCabinetStyleId } from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import { designerThreeDAssignments, type DesignerStyleRow } from "@/lib/designerThreeDStyles";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import type { DesignCabinet, RoomData } from "@/lib/design";
import { DARK_STAIN_DOOR_LIGHTS, RESTORED_DOOR_LIGHTS } from "@shared/doorRenderLights";
import {
  addCabinet,
  addThreeDDesignerRoomLights,
  createThreeDDesignerRoomEnvironment,
  existingCabinetSku,
  existingCabinetTransform,
  THREE_D_ROOM_LIGHT_COLOR,
} from "./InteractiveRoom3D";

const INCH = 1 / 12;

const WHITE_SHAKER: DesignerStyleRow = {
  id: 4401,
  ourName: "Off-White Shaker",
  aliasName: "Off-White Shaker",
  color: "#f2f0ea",
  finish: "Painted Off-White",
  finishCategory: "painted",
  doorStyle: "Shaker",
} as DesignerStyleRow;

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const pack = (matrixCatalog as unknown as Record<string, Pack>)["330002"]!;

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

/** An L kitchen like Tom's: fridge and range on Wall 1, the sink on Wall 2. */
function autoDesignKitchen() {
  let uid = 0;
  const room: RoomData = { width: 144, depth: 132, ceilingHeight: 96 };
  const run = runAutoDesignLayout({
    input: {
      layoutType: "l-shape",
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 2", centerOffsetIn: 66 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 72 },
      dishwasher: null,
      dishwasherSide: "right",
      refrigerator: null,
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    } as unknown as AutoDesignInputs,
    room,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: [
      appliance("RANGE-30", 30, 25, 36),
      appliance("DW-24", 24, 24, 34.5),
      appliance("FRIDGE-36", 36, 30, 70),
      appliance("HOOD-30", 30, 18, 18),
    ],
    refrigeratorCaps: [],
    refrigeratorEndPanels: [],
    tallCatalog: [],
    styleId: WHITE_SHAKER.id,
    makeUid: () => `finish-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return run.placed;
}

/** Direct (Lambert) light a vertical front receives, per RGB channel, ignoring distance falloff. */
function directLight(lights: THREE.Light[], normal: THREE.Vector3, at: THREE.Vector3) {
  const total = new THREE.Vector3();
  for (const light of lights) {
    if (light instanceof THREE.DirectionalLight) {
      const direction = light.position.clone().sub(light.target.position).normalize();
      const amount = Math.max(0, direction.dot(normal)) * light.intensity;
      total.add(new THREE.Vector3(light.color.r, light.color.g, light.color.b).multiplyScalar(amount));
    } else if (light instanceof THREE.PointLight) {
      const toLight = light.position.clone().sub(at);
      const distance = toLight.length();
      const amount = Math.max(0, toLight.normalize().dot(normal)) * light.intensity / (distance * distance);
      total.add(new THREE.Vector3(light.color.r, light.color.g, light.color.b).multiplyScalar(amount));
    }
  }
  return total;
}

describe("an Auto Design kitchen in one door line is one finish in the data", () => {
  it("stamps every cabinet, upper, filler and corner with the one style and one material color", () => {
    const placed = autoDesignKitchen();
    const cabinets = placed.filter((item) => item.placement === "base" || item.placement === "wall" || item.placement === "tall");
    expect(cabinets.length).toBeGreaterThan(6);
    // Cabinets on more than one wall, as in the reported kitchen.
    expect(new Set(cabinets.map((item) => item.wallId)).size).toBeGreaterThan(1);
    expect(new Set(cabinets.map((item) => item.styleId))).toEqual(new Set([WHITE_SHAKER.id]));
    expect(uniformCabinetStyleId(placed)).toBe(WHITE_SHAKER.id);

    const assignments = designerThreeDAssignments({ placed: cabinets, defaultStyleId: null, doorStyles: [WHITE_SHAKER], acceptedRows: [] });
    const faces = new Set(assignments.map((assignment) => doorStyleFinishColors(assignment.style).face.toLowerCase()));
    expect(faces.size).toBe(1);
    const profiles = new Set(assignments.map((assignment) => JSON.stringify(assignment.profile)));
    // Base and wall profiles may differ only by placement, never by wall.
    expect(profiles.size).toBeLessThanOrEqual(2);
    const room: RoomData = { width: 144, depth: 132, ceilingHeight: 96 };
    const dump = cabinets.map((cabinet) => {
      const assignment = assignments.find((entry) => entry.uid === cabinet.uid)!;
      const face = doorStyleFinishColors(assignment.style).face;
      const root = new THREE.Group();
      addCabinet(root, existingCabinetSku(cabinet, room, placed), null, { back: 0 }, room.width, room.depth,
        face, "#eeeeee", assignment.profile as never, existingCabinetTransform(cabinet, room, placed), null, undefined, {});
      const materials = new Set<string>();
      root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh || !mesh.userData.cabinetFront) return;
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        materials.add(`${material.type}:#${material.color.getHexString()}:${material.map ? "map" : "solid"}`);
      });
      // Fillers have no door/front mesh, but still inherit the one resolved face color.
      for (const material of Array.from(materials)) expect(material).toContain(`:${face.toLowerCase()}:solid`);
      return { uid: cabinet.uid, masterCode: cabinet.masterCode, wallId: cabinet.wallId, placement: cabinet.placement,
        styleId: cabinet.styleId, face, paintedFinish: assignment.profile?.paintedFinish, materials: Array.from(materials) };
    });
    if (process.env.FINISH_CONSISTENCY_DUMP) console.log("FINISH_CONSISTENCY_DUMP", JSON.stringify(dump));
  });

  it("builds identical front material colors for a cabinet on every wall", () => {
    const face = doorStyleFinishColors(WHITE_SHAKER).face;
    const profile = designerCatalogDoorProfile(WHITE_SHAKER as never);
    const colors = new Set<string>();
    for (const [wall, rotation, x, z] of [["back", 0, 72, 12], ["left", Math.PI / 2, 12, 66], ["right", -Math.PI / 2, 132, 66]] as const) {
      const root = new THREE.Group();
      addCabinet(root, {
        placementUid: `front-${wall}`, masterCode: "B24", description: '24" Base', placementType: "base",
        width: 24, depth: 24, height: 34.5, numberOfDoors: 1, numberOfDrawers: 1, category: "Base", subCategory: "Standard Base",
      } as never, null, { back: 0 }, 144, 132, face, "#eeeeee", profile as never, { x, z, rotation }, null, undefined, {});
      root.traverse((node) => {
        const mesh = node as THREE.Mesh & { userData: Record<string, unknown> };
        if (!mesh.isMesh || !mesh.userData.cabinetFront) return;
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        colors.add(`#${material.color.getHexString()}${material.map ? "+map" : ""}`);
      });
    }
    expect(Array.from(colors)).toEqual([face.toLowerCase()]);
  });
});

describe("the designer room lights every wall's cabinets the same", () => {
  for (const [name, rig] of [["restored", RESTORED_DOOR_LIGHTS], ["dark stain", DARK_STAIN_DOOR_LIGHTS]] as const) {
    for (const [width, depth] of [[144, 132], [180, 120], [120, 168]] as const) {
      it(`${name} rig, ${width}x${depth} room: one light color and equal direct light on back, left and right fronts`, () => {
        const scene = new THREE.Scene();
        const lights = addThreeDDesignerRoomLights(scene, rig, width, depth, 96 * INCH);
        const neutral = new THREE.Color(THREE_D_ROOM_LIGHT_COLOR);
        for (const light of lights) {
          if (light instanceof THREE.HemisphereLight) continue;
          expect(light.color.getHex()).toBe(neutral.getHex());
        }
        const y = 4.5;
        const fronts = [
          { normal: new THREE.Vector3(0, 0, 1), at: new THREE.Vector3(width * INCH / 2, y, 2) },
          { normal: new THREE.Vector3(1, 0, 0), at: new THREE.Vector3(2, y, depth * INCH / 2) },
          { normal: new THREE.Vector3(-1, 0, 0), at: new THREE.Vector3(width * INCH - 2, y, depth * INCH / 2) },
        ];
        const directional = lights.filter((light) => light instanceof THREE.DirectionalLight);
        const received = fronts.map((front) => directLight(directional, front.normal, front.at));
        for (const light of received) {
          // Neutral: red, green and blue equal, so no wall is tinted warm or blue.
          expect(light.x).toBeCloseTo(light.y, 6);
          expect(light.y).toBeCloseTo(light.z, 6);
          // Every wall gets the same direct light as the back wall.
          expect(light.x).toBeCloseTo(received[0].x, 6);
          expect(light.x).toBeGreaterThan(0.3);
        }
        // The room point light adds no tint either.
        const withPoint = fronts.map((front) => directLight(lights, front.normal, front.at));
        for (const light of withPoint) expect(light.x).toBeCloseTo(light.z, 6);
      });
    }
  }

  it("keeps the rig's total key + fill energy", () => {
    const scene = new THREE.Scene();
    const lights = addThreeDDesignerRoomLights(scene, RESTORED_DOOR_LIGHTS, 144, 132, 8);
    const pair = lights.filter((light) => light instanceof THREE.DirectionalLight);
    expect(pair).toHaveLength(2);
    expect(pair.reduce((sum, light) => sum + light.intensity, 0)).toBeCloseTo(RESTORED_DOOR_LIGHTS.key.intensity + RESTORED_DOOR_LIGHTS.fill.intensity, 6);
  });
});

describe("the designer environment is the same in every compass direction", () => {
  it("varies only with height, so a vertical front sees one environment on any wall", () => {
    const environment = createThreeDDesignerRoomEnvironment();
    const byHeight = new Map<string, string>();
    environment.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Every piece is centered on the vertical axis.
      expect(Math.abs(mesh.position.x)).toBeLessThan(1e-9);
      expect(Math.abs(mesh.position.z)).toBeLessThan(1e-9);
      const colors = mesh.geometry.getAttribute("color");
      if (!colors) return;
      const position = mesh.geometry.getAttribute("position");
      for (let index = 0; index < position.count; index += 1) {
        const key = position.getY(index).toFixed(4);
        const value = [colors.getX(index), colors.getY(index), colors.getZ(index)].map((channel) => channel.toFixed(5)).join(",");
        const seen = byHeight.get(key);
        if (seen) expect(value).toBe(seen);
        else byHeight.set(key, value);
        // Neutral grey, no tint.
        expect(colors.getX(index)).toBeCloseTo(colors.getY(index), 6);
        expect(colors.getY(index)).toBeCloseTo(colors.getZ(index), 6);
      }
    });
    expect(byHeight.size).toBeGreaterThan(10);
    environment.dispose();
  });

  it("is what the live 3D designer renders with, together with the balanced room lights", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
    const effect = source.slice(source.indexOf("const threeScene = new THREE.Scene();"), source.indexOf("const materialDefaults = {"));
    expect(effect).toContain("pmremGenerator.fromScene(roomEnvironment.scene, 0.04)");
    expect(effect).toContain("createThreeDDesignerRoomEnvironment()");
    expect(effect).toContain("addThreeDDesignerRoomLights(threeScene, studioLights, room.width, room.depth, wallHeight)");
    expect(effect).not.toContain("new RoomEnvironment(");
    expect(effect).not.toContain("new THREE.DirectionalLight(");
    expect(effect).not.toContain("#ffdca6");
  });
});
