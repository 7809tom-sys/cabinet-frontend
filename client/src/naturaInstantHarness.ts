/**
 * Dev-only capture harness: a 144 × 144 inch L-shaped kitchen built by the
 * INSTANT (auto) designer in Natura Maple, rendered by the real 3D engine.
 *
 * Natura Maple is the Ashford `Designer Natural` row (door_styles 330004, code
 * `DN`, color `#D4B896`, a maple stain). The instant designer places cabinets
 * with `styleId`, and the 3D view resolves each one through the same
 * `designerThreeDAssignments` path the regular Designer uses — so this harness
 * feeds the engine exactly what that path yields: the style's finish color, its
 * door profile, and its door/drawer face plan (crop included).
 *
 * `?before=1` restores the pre-fix appearance (no `grainSubstituted`, no
 * `tintLinear`) so one page produces both halves of a before/after pair.
 *
 * Imported by nothing in the app; loaded from /dev/natura-instant-shot.html by
 * e2e/natura-instant-designer-screenshot.spec.ts.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import {
  isRangeOrOven,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";
import {
  addCabinet,
  existingCabinetSku,
  existingCabinetTransform,
} from "@/components/design/InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { designerFacePlan } from "@/lib/designerFacePlan";
import { RESTORED_DOOR_LIGHTS } from "@shared/doorRenderLights";
import type { CabinetFacePlan } from "@shared/doorFaceRecognition";

/** The Ashford `Designer Natural` row — the door Tom calls "Natura maple". */
const NATURA_MAPLE = {
  id: 330004,
  distributorId: 210001,
  distributorName: "Ashford",
  styleCode: "DN",
  ourName: "Designer Natural",
  aliasName: "Natura Maple (Ashford)",
  color: "#D4B896",
  finish: "Natura Maple (Ashford)",
  doorStyle: "Shaker",
  woodSpecies: "Maple",
} as const;

const ROOM: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };
const PARAMS = new URLSearchParams(window.location.search);
const BEFORE = PARAMS.get("before") === "1";
/**
 * `?flat=1` repaints the same kitchen's fronts flat in the door record's own
 * colour, with no grain. It is the control: if the grain render matches this in
 * the same rig and lighting, the door appearance is the record's, not a substitute.
 */
const FLAT = PARAMS.get("flat") === "1";

/**
 * The instant designer builds with the SELECTED LINE's source-priced cabinets and
 * resolves the door style separately (`styleId`). There is no priced-cabinet
 * fixture for 330004 in this repo, so this uses the Ashford line pool — the same
 * distributor (210001) as Natura Maple, which is the pool the box construction
 * comes from. The door style below is Natura Maple, and that is what decides every
 * front's appearance.
 */
type Pack = {
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  surround?: { deepAbove?: DesignCabinet[]; bridgeAbove?: DesignCabinet[]; endPanels?: DesignCabinet[]; smoothPanels?: DesignCabinet[] };
};
const pack = (matrixCatalog as unknown as Record<string, Pack>)["330002"]!;

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0,
    masterCode: code,
    description: code,
    category: "Appliance",
    subCategory: "Appliance",
    width: String(width),
    depth: String(depth),
    height: String(height),
    placement: "appliance",
  } as DesignCabinet;
}

const APPLIANCES = [
  appliance("RANGE-30", 30, 25, 36),
  appliance("DW-24", 24, 24, 34.5),
  appliance("FRIDGE-36", 36, 30, 70),
  appliance("HOOD-30", 30, 18, 18),
  appliance("HOOD-36", 36, 18, 18),
];

/** A measured 144 × 144 L-shape on two adjacent walls (back and right). */
function instantInput(): AutoDesignInputs {
  return {
    layoutType: "l-shape",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    // Wall 1 is the back wall and Wall 2 the right wall, so this kitchen is a real
    // L in the back-right corner: the range and refrigerator on Wall 1, the sink
    // on Wall 2.
    sink: { wallLabel: "Wall 2", centerOffsetIn: 72 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: 44 },
    dishwasher: null,
    dishwasherSide: "right",
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 112 },
    refrigeratorWidthIn: 36,
    refrigeratorPanels: "both",
    refrigeratorEnclosure: "cabinet-above",
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
  } as AutoDesignInputs;
}

function buildKitchen(): AutoDesignLayoutSuccess {
  let uid = 0;
  const run = runAutoDesignLayout({
    input: instantInput(),
    room: ROOM,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [],
    styleId: NATURA_MAPLE.id,
    makeUid: () => `instant-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return run;
}

/** What the regular Designer's `designerThreeDAssignments` yields for this style. */
function styleAppearance() {
  const finish = doorStyleFinishColors(NATURA_MAPLE as never);
  const profile = designerCatalogDoorProfile(NATURA_MAPLE as never);
  return { finish, profile };
}

/**
 * The face plan the 3D view hands the renderer. `before` strips the two signals
 * this change adds, which is exactly what the shipped code did.
 */
function facePlanFor(placement: string | null): CabinetFacePlan | null {
  const plan = designerFacePlan(NATURA_MAPLE as never, placement);
  if (!plan?.dlcCrop || !BEFORE) return plan;
  return { ...plan, dlcCrop: { ...plan.dlcCrop, grainSubstituted: false, tintLinear: null } };
}

const INCH = 1 / 12;

function wallKeyFor(item: PlacedCabinet): string | null {
  const wall = (item as { wallId?: string | null }).wallId;
  return wall === "left" || wall === "right" ? wall : "top";
}

function mount(): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  run: AutoDesignLayoutSuccess;
} {
  const host = document.getElementById("pane")!;
  const width = 1200;
  const height = 800;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = RESTORED_DOOR_LIGHTS.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef1f4");
  // The Designer's own environment map. Without it a wall seen edge-on goes flat
  // and dark, which reads as a second finish; with it both runs of the L take the
  // same light the Designer gives them.
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = RESTORED_DOOR_LIGHTS.environment;

  const roomW = ROOM.width * INCH;
  const roomD = ROOM.depth * INCH;
  const ceiling = (ROOM.ceilingHeight ?? 96) * INCH;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW * 1.4, roomD * 1.4), new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // The two walls of the L, drawn so the plan reads as a corner kitchen.
  const wallMat = new THREE.MeshStandardMaterial({ color: "#f6f4ef", roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomW, ceiling, 4 * INCH), wallMat);
  backWall.position.set(roomW / 2, ceiling / 2, -2 * INCH);
  backWall.receiveShadow = true;
  scene.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(4 * INCH, ceiling, roomD), wallMat);
  leftWall.position.set(-2 * INCH, ceiling / 2, roomD / 2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  scene.add(new THREE.HemisphereLight(
    RESTORED_DOOR_LIGHTS.hemisphere.sky,
    RESTORED_DOOR_LIGHTS.hemisphere.ground,
    RESTORED_DOOR_LIGHTS.hemisphere.intensity,
  ));
  const key = new THREE.DirectionalLight(RESTORED_DOOR_LIGHTS.key.color, RESTORED_DOOR_LIGHTS.key.intensity);
  key.position.set(roomW * 1.0, ceiling + 2, roomD * 0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const shadowCam = key.shadow.camera as THREE.OrthographicCamera;
  shadowCam.left = -roomW;
  shadowCam.right = roomW;
  shadowCam.top = ceiling * 2;
  shadowCam.bottom = -2;
  shadowCam.near = 0.1;
  shadowCam.far = 60;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fillLight = new THREE.DirectionalLight(RESTORED_DOOR_LIGHTS.fill.color, RESTORED_DOOR_LIGHTS.fill.intensity);
  fillLight.position.set(-roomW * 0.5, ceiling * 0.7, roomD * 1.3);
  scene.add(fillLight);

  const run = buildKitchen();
  const { finish, profile } = styleAppearance();

  const root = new THREE.Group();
  scene.add(root);

  // Every cabinet the instant designer placed, rendered by the real engine with the
  // style's own face plan — the same inputs the regular Designer passes.
  for (const cabinet of run.placed) {
    const sku = existingCabinetSku(cabinet, ROOM);
    const plan = facePlanFor(cabinet.placement ?? null);
    const transform = existingCabinetTransform(cabinet, ROOM, run.placed);
    const before = root.children.length;
    addCabinet(
      root,
      { ...sku, catalogImageUrl: null },
      wallKeyFor(cabinet),
      { back: 0, left: 0, right: 0, front: 0 },
      ROOM.width,
      ROOM.depth,
      finish.face,
      "#eeeeee",
      profile as never,
      transform,
      plan?.doorUrl ?? null,
      undefined,
      {
        countertop: null,
        selectedToeKick: false,
        drawerSampleUrl: plan?.drawerUrl ?? null,
        faceSourceKind: plan?.sourceKind,
        faceCrop: plan?.dlcCrop ?? null,
      },
    );
    // Tag the group this cabinet produced so materials can be read per wall.
    for (const child of root.children.slice(before)) {
      child.userData = { ...child.userData, placementWall: (cabinet as { wallId?: string }).wallId ?? "unknown" };
      child.traverse((node) => { node.userData = { ...node.userData, placementWall: (cabinet as { wallId?: string }).wallId ?? "unknown" }; });
    }
  }

  // Frame the L from the built geometry, from the room's opening side.
  const bounds = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  bounds.getCenter(center);
  bounds.getSize(size);
  const span = Math.max(size.x, size.z, 4);
  // Stand back in the open part of the room at standing eye height and look into
  // the back-right corner, so the door fronts are the subject rather than the
  // countertops.
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 300);
  camera.position.set(roomW * 0.10, 5.6, roomD * 0.92);
  camera.lookAt(roomW * 0.62, 3.0, roomD * 0.22);

  return { renderer, scene, camera, root, run };
}

/** Mean sRGB of a rectangular region of the rendered canvas. */
function regionHex(canvas: HTMLCanvasElement, rx: number, ry: number, rw: number, rh: number) {
  const probe = document.createElement("canvas");
  probe.width = canvas.width;
  probe.height = canvas.height;
  const context = probe.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(canvas, 0, 0);
  const data = context.getImageData(
    Math.round(canvas.width * rx),
    Math.round(canvas.height * ry),
    Math.max(1, Math.round(canvas.width * rw)),
    Math.max(1, Math.round(canvas.height * rh)),
  ).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) { r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++; }
  const hex = (v: number) => Math.round(v / Math.max(1, n)).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Sample the rendered pixels of real door fronts. Each front mesh is projected
 * through the camera, and a small patch at its centre is averaged, so the number
 * reported is the colour of a door in this render — not a guessed screen region.
 * The front is also reported with the material colour the engine gave it.
 */
function sampleDoorFaces(
  root: THREE.Group,
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  placed: readonly PlacedCabinet[],
) {
  const probe = document.createElement("canvas");
  probe.width = canvas.width;
  probe.height = canvas.height;
  const context = probe.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(canvas, 0, 0);

  const wallOf = new Map<string, string>();
  for (const item of placed) wallOf.set(item.uid, (item as { wallId?: string }).wallId ?? "unknown");

  const out: Array<{ wall: string; role: string; screen: string; material: string }> = [];
  const seen = new Set<string>();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.userData.cabinetFront) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
    if (!material || !("color" in material)) return;
    const wall = (mesh.userData as { placementWall?: string }).placementWall ?? "unknown";
    const role = mesh.userData.grainPiece ? `door-${mesh.userData.grainPiece}` : "door-panel";
    const key = `${wall}:${role}`;
    if (seen.has(key)) return;

    // Centre of the front in world space, projected to the canvas.
    const box = new THREE.Box3().setFromObject(mesh);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    const projected = centre.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) return;
    const px = Math.round((projected.x + 1) / 2 * canvas.width);
    const py = Math.round((1 - projected.y) / 2 * canvas.height);
    const half = 6;
    if (px - half < 0 || py - half < 0 || px + half >= canvas.width || py + half >= canvas.height) return;
    const data = context.getImageData(px - half, py - half, half * 2, half * 2).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++; }
    const hex = (v: number) => Math.round(v / Math.max(1, n)).toString(16).padStart(2, "0");
    seen.add(key);
    out.push({ wall, role, screen: `#${hex(r)}${hex(g)}${hex(b)}`, material: `#${material.color.getHexString()}` });
  });
  return out.sort((a, b) => `${a.wall}${a.role}`.localeCompare(`${b.wall}${b.role}`));
}

async function run() {
  const { renderer, scene, camera, root, run: layout } = mount();
  await new Promise((resolve) => setTimeout(resolve, 2200));
  if (FLAT) {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.userData.cabinetFront) return;
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
      if (!material || !("color" in material)) return;
      material.map = null;
      material.color.set(NATURA_MAPLE.color);
      material.toneMapped = true;
      material.needsUpdate = true;
    });
  }
  renderer.render(scene, camera);
  await new Promise((resolve) => setTimeout(resolve, 250));
  renderer.render(scene, camera);

  const canvas = document.querySelector("#pane canvas") as HTMLCanvasElement;

  // Material ground truth, straight off the meshes the engine built, per wall.
  const faces: string[] = [];
  const perWall: Record<string, Set<string>> = {};
  let frontCount = 0;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
    if (!material || !("color" in material)) return;
    const isFront = mesh.userData.cabinetFront || mesh.userData.cabinetDrawerFront;
    const isStructure = mesh.userData.selectedFinishStructuralSurface || mesh.userData.selectedStyleSideSkin || mesh.userData.baseToeKick;
    if (!isFront && !isStructure) return;
    const kind = mesh.userData.cabinetDrawerFront ? "drawer" : mesh.userData.cabinetFront ? "door" : "structure";
    const tag = `${kind} color=#${material.color.getHexString()} map=${material.map ? "y" : "n"} toneMapped=${material.toneMapped}`;
    if (isFront) { frontCount++; faces.push(tag); }
    const wall = (mesh.userData as { placementWall?: string }).placementWall ?? "unknown";
    (perWall[wall] ||= new Set()).add(tag);
  });

  const plan = facePlanFor("base");
  (window as unknown as { __naturaInstantShot?: unknown }).__naturaInstantShot = {
    variant: FLAT ? "flat-control (door colour, no grain)" : BEFORE ? "before" : "after",
    layout: "l-shape",
    room: { width: ROOM.width, depth: ROOM.depth },
    style: { id: NATURA_MAPLE.id, name: NATURA_MAPLE.aliasName, color: NATURA_MAPLE.color },
    placed: layout.placed.length,
    base: layout.placed.filter((item) => item.placement === "base").length,
    wall: layout.placed.filter((item) => item.placement === "wall").length,
    appliances: layout.placed.filter((item) => item.placement === "appliance").length,
    // A range sits on one wall and an appliance on the other: proof it is an L.
    wallsUsed: Array.from(new Set(layout.placed.filter((item) => item.placement === "base" || item.placement === "appliance").map((item) => (item as { wallId?: string }).wallId ?? "unknown"))),
    rangeOnWall: layout.placed.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description ?? ""))?.wallId ?? null,
    frontMeshes: frontCount,
    perWallFrontTreatments: Object.fromEntries(Object.entries(perWall).map(([wall, set]) => [wall, Array.from(set).sort()])),
    frontTreatments: Array.from(new Set(faces)).sort(),
    cropSlug: plan?.dlcCrop?.slug ?? null,
    grainSubstituted: plan?.dlcCrop?.grainSubstituted ?? false,
    doorColour: plan?.dlcCrop?.solidColor ?? null,
    doorFaces: sampleDoorFaces(root, camera, canvas, layout.placed),
  };
}

void run();
