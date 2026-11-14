/**
 * Finish consistency harness (Tom, Nov 14 2026: one off-white Shaker line rendered
 * cream on the fridge/range wall and bright white on the sink wall).
 *
 * Builds one room with the SAME painted off-white cabinets (a base and a wall
 * cabinet) on the back, left and right walls, with the live designer renderer
 * settings (ACES, exposure, RoomEnvironment, studio rig) and reads each door's
 * rendered pixel. Every cabinet carries the identical material color, so any
 * difference between walls is lighting only.
 *
 * `?rig=legacy` re-creates the room lights as they were before the fix (warm key
 * from +X, cool blue fill from -X, amber room point) so before/after can be read
 * from the same page. Default is the live `addThreeDDesignerRoomLights`.
 *
 * Dev-only: loaded from client/dev/finish-consistency-shot.html, imported by nothing in the app.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { addCabinet, addThreeDDesignerRoomLights, createThreeDDesignerRoomEnvironment } from "@/components/design/InteractiveRoom3D";
import { doorLightsForFinish, type DoorLightRig } from "@shared/doorRenderLights";
import { designerCatalogDoorProfile } from "@/lib/doorStyleAppearance";

const INCH = 1 / 12;
const ROOM_W = 144;
const ROOM_D = 132;
const WALL_H = 96;
const FINISH = new URLSearchParams(location.search).get("hex") ?? "#f2f0ea";
const RIG = new URLSearchParams(location.search).get("rig") ?? "live";
const ENV_KIND = new URLSearchParams(location.search).get("envkind") ?? "live";
const CROP = new URLSearchParams(location.search).get("crop") === "1";
const ENV = Number(new URLSearchParams(location.search).get("env") ?? "1");

const STYLE = {
  id: 990811,
  styleCode: "WS",
  ourName: "White Shaker",
  color: FINISH,
  finishCategory: "painted",
  finish: "Painted",
  doorStyle: "Shaker",
};

function legacyLights(scene: THREE.Scene, lights: DoorLightRig, wallHeight: number) {
  const maxSpan = Math.max(ROOM_W, ROOM_D) * INCH;
  scene.add(new THREE.HemisphereLight(lights.hemisphere.sky, lights.hemisphere.ground, lights.hemisphere.intensity));
  const key = new THREE.DirectionalLight(lights.key.color, lights.key.intensity);
  key.position.set(maxSpan, maxSpan * 1.8, maxSpan * 0.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(lights.fill.color, lights.fill.intensity);
  fill.position.set(-maxSpan, maxSpan, maxSpan);
  scene.add(fill);
  const warm = new THREE.PointLight("#ffdca6", 2.8, maxSpan * 3.2, 2);
  warm.position.set(ROOM_W * INCH * 0.52, wallHeight * 0.76, ROOM_D * INCH * 0.48);
  scene.add(warm);
}

type WallKey = "back" | "left" | "right";

const SKUS = (wall: WallKey) => [
  { placementUid: `${wall}-b`, masterCode: "B24", description: '24" Base', placementType: "base", width: 24, depth: 24, height: 34.5, numberOfDoors: 1, numberOfDrawers: 1, category: "Base", subCategory: "Standard Base" },
  { placementUid: `${wall}-w`, masterCode: "W2430", description: '24" Wall', placementType: "wall", width: 24, depth: 12, height: 30, numberOfDoors: 1, numberOfDrawers: 0, category: "Wall", subCategory: "Wall" },
];

function run() {
  const size = 480;
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const lights = doorLightsForFinish(FINISH, null);
  renderer.toneMappingExposure = lights.exposure;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(lights.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  // Legacy = three's RoomEnvironment (light boxes on one side); live = the azimuth-symmetric designer environment.
  scene.environment = RIG === "legacy" || ENV_KIND === "legacy"
    ? pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    : pmrem.fromScene(createThreeDDesignerRoomEnvironment().scene, 0.04).texture;
  scene.environmentIntensity = lights.environment * ENV;
  const wallHeight = WALL_H * INCH;
  if (RIG === "none") { /* environment only */ }
  else if (RIG === "legacy") legacyLights(scene, lights, wallHeight);
  else addThreeDDesignerRoomLights(scene, lights, ROOM_W, ROOM_D, wallHeight);

  const profile = designerCatalogDoorProfile(STYLE as never);
  const root = new THREE.Group();
  scene.add(root);
  // Explicit plan transforms (inches), as a saved design passes them: back faces +Z,
  // left faces +X, right faces -X.
  const placements: Record<WallKey, { x: number; z: number; rotation: number }> = {
    back: { x: ROOM_W / 2, z: 0, rotation: 0 },
    left: { x: 0, z: ROOM_D / 2, rotation: Math.PI / 2 },
    right: { x: ROOM_W, z: ROOM_D / 2, rotation: -Math.PI / 2 },
  };
  const owners = new Map<THREE.Object3D, string>();
  for (const wall of ["back", "left", "right"] as WallKey[]) {
    for (const sku of SKUS(wall)) {
      const count = root.children.length;
      const isWallCabinet = sku.placementType === "wall";
      const at = placements[wall];
      const depthOffset = sku.depth / 2;
      const transform = {
        x: at.x + Math.sin(at.rotation) * depthOffset,
        z: at.z + Math.cos(at.rotation) * depthOffset,
        rotation: at.rotation,
        ...(isWallCabinet ? { bottom: 54 } : {}),
      };
      addCabinet(root, sku as never, null, { back: 0, left: 0, right: 0, front: 0 }, ROOM_W, ROOM_D, FINISH, "#e9e7e2", profile as never, transform, null, undefined, CROP ? { faceCrop: { solidColor: FINISH, doorSize: [1, 1], drawerSize: null, drawerSolidColor: FINISH, grainUrl: null } } : {});
      root.children.slice(count).forEach((child) => owners.set(child, sku.placementUid));
    }
  }

  scene.updateMatrixWorld(true);
  // One materials readout: every cabinet front's actual material color.
  const materialHexes = new Set<string>();
  const fronts: Record<string, THREE.Mesh[]> = {};
  root.traverse((node) => {
    const mesh = node as THREE.Mesh & { userData: Record<string, unknown> };
    if (!mesh.isMesh || !mesh.userData.cabinetFront) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    materialHexes.add(`#${material.color.getHexString()}${material.map ? "+map" : ""}`);
    let owner: THREE.Object3D | null = mesh;
    while (owner && !owners.has(owner)) owner = owner.parent;
    const uid = owner ? owners.get(owner)! : "unknown";
    (fronts[uid] ??= []).push(mesh);
  });

  // Head-on, same distance, same height for every wall: the only variable is the wall's facing.
  const readouts: Record<string, string> = {};
    // Read the canvas itself (tone mapped + sRGB encoded), averaging a 5x5 patch.
  const gl = renderer.getContext();
  const patch = new Uint8Array(4 * 25);
  const sample = (camera: THREE.Camera, point: THREE.Vector3) => {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    const ndc = point.clone().project(camera);
    const x = Math.round((ndc.x * 0.5 + 0.5) * size) - 2;
    const y = Math.round((ndc.y * 0.5 + 0.5) * size) - 2;
    gl.readPixels(x, y, 5, 5, gl.RGBA, gl.UNSIGNED_BYTE, patch);
    const sum = [0, 0, 0];
    for (let i = 0; i < 25; i += 1) for (let c = 0; c < 3; c += 1) sum[c] += patch[i * 4 + c];
    return `#${sum.map((v) => Math.round(v / 25).toString(16).padStart(2, "0")).join("")}`;
  };
  const overview = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const maxSpan = Math.max(ROOM_W, ROOM_D) * INCH;
  overview.position.set(maxSpan * 0.5, maxSpan * 0.72, maxSpan * 1.8);
  overview.lookAt(ROOM_W * INCH * 0.5, 3.1, ROOM_D * INCH * 0.45);
  for (const [uid, meshes] of Object.entries(fronts)) {
    // The largest door front's center: a flat panel pixel, never a seam between fronts.
    const sized = meshes.map((mesh) => {
      const box = new THREE.Box3().setFromObject(mesh);
      const dims = box.getSize(new THREE.Vector3());
      return { mesh, box, area: dims.x * dims.y + dims.z * dims.y };
    }).sort((a, b) => b.area - a.area);
    const { mesh, box } = sized[0];
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    const point = box.getCenter(new THREE.Vector3());
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    camera.position.copy(point.clone().add(normal.clone().multiplyScalar(6)));
    camera.lookAt(point);
    readouts[`${uid} head-on`] = sample(camera, point);
    readouts[`${uid} overview`] = sample(overview, point);
    readouts[`${uid} materials`] = meshes.map((m) => `${(m.material as THREE.Material).type}:${(m.material as THREE.MeshStandardMaterial).color?.getHexString?.()}:${m.userData.cabinetDrawerFront ? "drawer" : "door"}`).join(" ");
    readouts[`${uid} point`] = point.toArray().map((v) => v.toFixed(2)).join(",");
    readouts[`${uid} normal`] = normal.toArray().map((v) => v.toFixed(2)).join(",");
  }
  renderer.render(scene, overview);
  (window as unknown as { __finishResult: unknown }).__finishResult = { rig: RIG, finish: FINISH, materialHexes: Array.from(materialHexes), readouts };
}

run();
