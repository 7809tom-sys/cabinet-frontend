/**
 * Dev-only capture harness for the Natura Maple cabinet.
 *
 * Natura Maple is the Ashford `Designer Natural` row (style 330004, code DN,
 * color #D4B896, a maple stain). The pane builds the cabinet through the real
 * `addCabinet` pipeline at the Designer's own rig, so the capture is exactly what
 * the 3D Kitchen Designer draws for this door.
 *
 * `?before=1` restores the pre-fix appearance locally (DL photo light
 * compensation applied to a grain the door never had, and the sRGB tint clamped
 * to `#ffffff`), so one harness produces both halves of a before/after pair.
 *
 * Imported by nothing in the app; loaded from /dev/natura-door-shot.html by
 * e2e/natura-door-screenshot.spec.ts.
 */
import * as THREE from "three";
import { addCabinet } from "@/components/design/InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { designerFacePlan } from "@/lib/designerFacePlan";
import { dlcPhotoLightCompensation } from "@shared/dlcFr26Textures";
import { RESTORED_DOOR_LIGHTS, relativeLuminance } from "@shared/doorRenderLights";
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

const BEFORE = new URLSearchParams(window.location.search).get("before") === "1";

type Pane = {
  host: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
};

function makePane(host: HTMLElement): Pane {
  const size = 900;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = RESTORED_DOOR_LIGHTS.exposure;
  renderer.shadowMap.enabled = false;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(RESTORED_DOOR_LIGHTS.background);
  scene.environmentIntensity = RESTORED_DOOR_LIGHTS.environment;
  scene.add(new THREE.HemisphereLight(
    RESTORED_DOOR_LIGHTS.hemisphere.sky,
    RESTORED_DOOR_LIGHTS.hemisphere.ground,
    RESTORED_DOOR_LIGHTS.hemisphere.intensity,
  ));
  const key = new THREE.DirectionalLight(RESTORED_DOOR_LIGHTS.key.color, RESTORED_DOOR_LIGHTS.key.intensity);
  key.position.set(0.6, 1.5, 2.2);
  scene.add(key);
  const fillLight = new THREE.DirectionalLight(RESTORED_DOOR_LIGHTS.fill.color, RESTORED_DOOR_LIGHTS.fill.intensity);
  fillLight.position.set(-1.0, 0.4, 2.0);
  scene.add(fillLight);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  return { host, renderer, scene, camera };
}

/**
 * The crop the Designer hands the renderer. `before` strips the fix's two
 * signals, which is what the shipped code did.
 */
function faceCropFor(plan: CabinetFacePlan | null) {
  const crop = plan?.dlcCrop ?? null;
  if (!crop || !BEFORE) return crop;
  return { ...crop, grainSubstituted: false, tintLinear: null };
}

function build() {
  const style = NATURA_MAPLE as never;
  const finish = doorStyleFinishColors(style);
  const profile = designerCatalogDoorProfile(style);
  const plan = designerFacePlan(style, "base") as CabinetFacePlan;

  const root = new THREE.Group();
  addCabinet(
    root,
    {
      placementUid: "natura-maple-base",
      masterCode: "B24",
      description: '24" Two Door Base Cabinet',
      placementType: "base",
      width: 24,
      depth: 24,
      height: 34.5,
      // Door and drawer counts come from the cabinet edit config.
      numberOfDoors: 2,
      numberOfDrawers: 0,
      category: "Base",
      subCategory: "Standard Base",
    } as never,
    "back",
    { back: 0 },
    144,
    120,
    finish.face,
    "#eeeeee",
    profile as never,
    { x: 0, z: 0, rotation: 0 },
    plan?.doorUrl ?? null,
    undefined,
    {
      selectedToeKick: true,
      drawerSampleUrl: plan?.drawerUrl ?? null,
      faceSourceKind: plan?.sourceKind,
      faceCrop: faceCropFor(plan),
    },
  );
  return { root, plan, finish };
}

/** Head-on view of both doors, framed so the panels fill the pane. */
function aim(pane: Pane, root: THREE.Group) {
  pane.scene.add(root);
  const bounds = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  pane.camera.position.set(center.x, center.y, bounds.max.z + 1.55);
  pane.camera.lookAt(center.x, center.y, center.z);
}

function meanPatch(canvas: HTMLCanvasElement) {
  const probe = document.createElement("canvas");
  probe.width = canvas.width;
  probe.height = canvas.height;
  const context = probe.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(canvas, 0, 0);
  const region = (x0: number, x1: number, y0: number, y1: number) => {
    const data = context.getImageData(
      Math.round(canvas.width * x0), Math.round(canvas.height * y0),
      Math.max(1, Math.round(canvas.width * (x1 - x0))), Math.max(1, Math.round(canvas.height * (y1 - y0))),
    ).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++; }
    const hex = (v: number) => Math.round(v / Math.max(1, n)).toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  };
  return {
    leftPanel: region(0.28, 0.42, 0.34, 0.68),
    rightPanel: region(0.58, 0.72, 0.34, 0.68),
    leftStile: region(0.235, 0.265, 0.34, 0.68),
    topRail: region(0.28, 0.42, 0.16, 0.20),
  };
}

function faceMaterials(root: THREE.Group) {
  const rows: string[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
    if (!material || !("color" in material)) return;
    const kind = mesh.userData.cabinetFront ? "front"
      : mesh.userData.baseToeKick ? "toe-kick"
        : mesh.userData.selectedFinishStructuralSurface ? "side" : "";
    if (!kind) return;
    rows.push(`${kind} color=#${material.color.getHexString()} map=${material.map ? "y" : "n"} toneMapped=${material.toneMapped}`);
  });
  return Array.from(new Set(rows)).sort();
}

/**
 * Repaint the door fronts flat in the door's own colour, in this same rig. That
 * is the appearance the record asks for, so it is the reference the grain has to
 * match rather than a number of its own.
 */
function paintFlat(root: THREE.Group, hex: string) {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.cabinetFront !== true) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
    if (!material || !("color" in material)) return;
    material.map = null;
    material.color.set(hex);
    material.toneMapped = true;
    material.needsUpdate = true;
  });
}

async function run() {
  const host = document.getElementById("pane")!;
  const pane = makePane(host);
  const built = build();
  aim(pane, built.root);
  await new Promise((resolve) => setTimeout(resolve, 1600));
  pane.renderer.render(pane.scene, pane.camera);
  await new Promise((resolve) => setTimeout(resolve, 200));
  pane.renderer.render(pane.scene, pane.camera);

  const canvas = host.querySelector("canvas") as HTMLCanvasElement;
  const grainPixels = meanPatch(canvas);
  const grainMaterials = faceMaterials(built.root);

  // Same cabinet, same rig, fronts repainted flat in the record's own colour.
  paintFlat(built.root, built.finish.face);
  pane.renderer.render(pane.scene, pane.camera);
  const flatPixels = meanPatch(canvas);
  const flatMaterials = faceMaterials(built.root);

  (window as unknown as { __naturaDoorShot?: unknown }).__naturaDoorShot = {
    variant: BEFORE ? "before" : "after",
    recordColor: NATURA_MAPLE.color,
    recordDoorColor: built.plan?.dlcCrop?.solidColor ?? null,
    cropSlug: built.plan?.dlcCrop?.slug ?? null,
    grainSubstituted: built.plan?.dlcCrop?.grainSubstituted ?? false,
    tintLinear: built.plan?.dlcCrop?.tintLinear ?? null,
    photoCompensation: dlcPhotoLightCompensation(RESTORED_DOOR_LIGHTS, relativeLuminance(built.finish.face)).hex,
    pixels: grainPixels,
    materials: grainMaterials,
    flatControlPixels: flatPixels,
    flatControlMaterials: flatMaterials,
  };
}

void run();
