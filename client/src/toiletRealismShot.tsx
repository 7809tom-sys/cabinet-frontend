/**
 * Toilet-realism render harness.
 *
 * Renders one or more Pelican toilets through the REAL `addFurniture` path in a
 * lit bathroom scene — glossy floor, tiled back wall, a window softbox, and the
 * same `RoomEnvironment` IBL the designer uses — so a screenshot shows what the
 * owner actually sees rather than an isolated grey mesh.
 *
 * Query: ?codes=PL-12011,PL-12305 MB&view=persp|top|close&w=900&h=700
 */
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { addFurniture } from "@/components/design/InteractiveRoom3D";
import { FURNITURE_CATALOG, makeFurniture } from "@/lib/design";
import { verifiedPelicanBathroomFixtureProfile } from "@/lib/pelicanBathroomFixtureProfiles";

const INCH = 1 / 12;
const params = new URLSearchParams(location.search);
const codes = (params.get("codes") ?? "PL-12011").split(",").map((c) => c.trim()).filter(Boolean);
const view = params.get("view") ?? "persp";
const W = Number(params.get("w") ?? 900);
const H = Number(params.get("h") ?? 700);
const columns = Number(params.get("cols") ?? Math.min(codes.length, 4));

const scene = new THREE.Scene();
scene.background = new THREE.Color("#eef1f4");

// ---- Renderer -------------------------------------------------------------
const qs0 = new URLSearchParams(location.search);
if (qs0.get("rough")) (window as any).__ROUGH = Number(qs0.get("rough"));
RectAreaLightUniformsLib.init();
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(2);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(new URLSearchParams(location.search).get("exp") ?? 0.52);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---- Image-based lighting, same as the designer --------------------------
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = environment.texture;
scene.environmentIntensity = Number(new URLSearchParams(location.search).get("env") ?? 0.72);

// ---- Room -----------------------------------------------------------------
function tileTexture(base: string, grout: string, rx: number, ry: number) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = grout;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, size, size);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(rx, ry);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const wallMaterial = new THREE.MeshStandardMaterial({
  map: tileTexture("#b9b2a6", "#a29a8d", 6, 8),
  roughness: 0.62,
  metalness: 0.02,
});
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(26, 10), wallMaterial);
backWall.position.set(0, 5, -3.2);
backWall.receiveShadow = true;
scene.add(backWall);

const floorMaterial = new THREE.MeshPhysicalMaterial({
  color: "#6f6a63",
  roughness: 0.18,
  metalness: 0,
  clearcoat: 0.55,
  clearcoatRoughness: 0.12,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// A soft window softbox so the ceramic gets a broad highlight and a real
// reflection, not just a point specular.
const windowPanel = new THREE.Mesh(
  new THREE.PlaneGeometry(5, 6),
  new THREE.MeshBasicMaterial({ color: "#ffffff" }),
);
windowPanel.position.set(-8, 5.5, 2);
windowPanel.lookAt(0, 3, 0);
scene.add(windowPanel);

// A second, dimmer panel on the right so the clearcoat picks up a broad highlight
// on that flank too, instead of one hard band down the middle.
const windowPanel2 = new THREE.Mesh(
  new THREE.PlaneGeometry(3.5, 4.5),
  new THREE.MeshBasicMaterial({ color: "#dfe9f2" }),
);
windowPanel2.position.set(7, 4.6, 1.5);
windowPanel2.lookAt(0, 2.6, 0);
scene.add(windowPanel2);

// Dark strip low on the back wall: a dark reflection under a highlight is what
// makes a glaze read as a glaze rather than as matte paint.
const darkBand = new THREE.Mesh(
  new THREE.PlaneGeometry(26, 1.6),
  new THREE.MeshStandardMaterial({ color: "#2f3438", roughness: 0.7 }),
);
darkBand.position.set(0, 0.85, -3.15);
scene.add(darkBand);

// ---- Lights ---------------------------------------------------------------
scene.add(new THREE.AmbientLight("#ffffff", 0.10));
// Area lights, not directional ones. A directional light delivers the same
// irradiance to every surface with the same normal, so a flat wall of ceramic
// renders as one uniform block of tone no matter how good the material is. A large
// area light falls off with distance and angle, which is what produces the soft
// gradient that lets the eye read a curve. This is also how product photography
// is actually lit: big softboxes close to the subject.
const keyLight = new THREE.RectAreaLight("#fff6ea", Number(qs0.get("key") ?? 3.4), 7, 9);
keyLight.position.set(-5.5, 8.5, 4.5);
keyLight.lookAt(0, 2.2, 0);
scene.add(keyLight);

const fillLight = new THREE.RectAreaLight("#e6f0ff", Number(qs0.get("fill") ?? 1.05), 6, 7);
fillLight.position.set(6.5, 4.6, 3.4);
fillLight.lookAt(0, 2.0, 0.6);
scene.add(fillLight);

const rimLight = new THREE.RectAreaLight("#ffffff", Number(qs0.get("rim") ?? 1.5), 5, 6);
rimLight.position.set(1.5, 6.0, -5.5);
rimLight.lookAt(0, 2.4, 0);
scene.add(rimLight);

// Shadows still need a directional caster; it is dim, only there to ground the
// fixture with a contact shadow under the base.
const shadowCaster = new THREE.DirectionalLight("#fff8f0", 0.55);
shadowCaster.position.set(-4, 10, 6);
shadowCaster.castShadow = true;
shadowCaster.shadow.mapSize.set(2048, 2048);
shadowCaster.shadow.camera.left = -14;
shadowCaster.shadow.camera.right = 14;
shadowCaster.shadow.camera.top = 14;
shadowCaster.shadow.camera.bottom = -6;
shadowCaster.shadow.bias = -0.0004;
shadowCaster.shadow.normalBias = 0.015;
shadowCaster.shadow.radius = 3;
scene.add(shadowCaster);

// ---- The toilets, through the real scene path ----------------------------
const spacing = 2.6;
const cols = Math.max(1, columns);
const rows = Math.ceil(codes.length / cols);
const placed: THREE.Group[] = [];
codes.forEach((code, index) => {
  const profile = verifiedPelicanBathroomFixtureProfile(code);
  if (!profile) return;
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === profile.id);
  if (!definition) return;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = (col - (cols - 1) / 2) * spacing;
  const z = (row - (rows - 1) / 2) * spacing;
  const root = new THREE.Group();
  addFurniture(root, makeFurniture(definition.id, 0, 0));
  root.position.set(x, 0, z);
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  scene.add(root);
  placed.push(root);
});

// ---- Camera ---------------------------------------------------------------
const bounds = new THREE.Box3();
for (const group of placed) bounds.expandByObject(group);
const centre = bounds.getCenter(new THREE.Vector3());
const size = bounds.getSize(new THREE.Vector3());
const span = Math.max(size.x, size.y, size.z);

const camera = new THREE.PerspectiveCamera(34, W / H, 0.05, 200);
if (view === "top") {
  camera.position.set(centre.x, centre.y + span * 2.2, centre.z + 0.02);
  camera.lookAt(centre.x, centre.y, centre.z);
} else if (view === "close") {
  camera.position.set(centre.x - span * 0.78, centre.y + span * 0.62, centre.z + span * 1.05);
  camera.lookAt(centre.x, centre.y * 1.05, centre.z);
} else {
  camera.position.set(centre.x - span * 0.55, centre.y + span * 0.72, centre.z + span * 1.5);
  camera.lookAt(centre.x, centre.y * 1.02, centre.z);
}
camera.updateMatrixWorld();

renderer.render(scene, camera);

// ---- Mask + measured statistics -------------------------------------------
// Renders the fixture alone as a silhouette, then measures the beauty pass
// inside that mask. Without the mask every "contrast" number is really a
// measurement of the wall, which is why the first attempt showed no change.
function measure(): {
  median: number;
  ceramicSpread: number;
  highlightPx: number;
  contactDark: number;
  clipPct: number;
} {
  const beauty = renderer.domElement;
  const w = beauty.width;
  const h = beauty.height;
  const ctx2 = document.createElement("canvas");
  ctx2.width = w;
  ctx2.height = h;
  const c2 = ctx2.getContext("2d")!;
  c2.drawImage(beauty, 0, 0);
  const beautyData = c2.getImageData(0, 0, w, h).data;

  // Silhouette pass: only the fixtures, on black.
  const hidden: { node: THREE.Object3D; visible: boolean }[] = [];
  scene.traverse((node) => {
    if (node === scene) return;
    let inFixture = false;
    for (const group of placed) {
      if (node === group) { inFixture = true; break; }
      let p: THREE.Object3D | null = node.parent;
      while (p) { if (p === group) { inFixture = true; break; } p = p.parent; }
      if (inFixture) break;
    }
    // Only hide meshes. Hiding the lights too renders the mask pass pure black,
    // which is exactly the bug that made the first measurement read zero.
    if (!inFixture && node.visible && (node as THREE.Mesh).isMesh) {
      hidden.push({ node, visible: true });
      node.visible = false;
    }
  });
  const oldBg = scene.background;
  const oldEnv = scene.environment;
  scene.background = new THREE.Color("#000000");
  scene.environment = null;
  renderer.render(scene, camera);
  c2.drawImage(renderer.domElement, 0, 0);
  const maskData = c2.getImageData(0, 0, w, h).data;
  for (const item of hidden) item.node.visible = true;
  scene.background = oldBg;
  scene.environment = oldEnv;

  // Bounding box of the mask, so the mask itself can be verified.
  let minX = w, maxX = -1, minY = h, maxY = -1;
  const luma: number[] = [];
  let clip = 0;
  let highlight = 0;
  let maskCount = 0;
  for (let i = 0; i < maskData.length; i += 4) {
    if (maskData[i] < 24) continue;
    maskCount += 1;
    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    const l = 0.2126 * beautyData[i] + 0.7152 * beautyData[i + 1] + 0.0722 * beautyData[i + 2];
    luma.push(l);
    if (l >= 252) clip += 1;
    if (l >= 246) highlight += 1;
  }
  (window as any).__maskCount = maskCount;
  (window as any).__maskBox = { w, h, minX, maxX, minY, maxY };
  luma.sort((a, b) => a - b);
  const q = (f: number) => luma[Math.min(luma.length - 1, Math.floor(f * luma.length))] ?? 0;

  // Contact shadow: the darkest tenth of the fixture is the crevice/base shading.
  const contactDark = q(0.10);
  return {
    median: Math.round(q(0.5) * 10) / 10,
    ceramicSpread: Math.round((q(0.97) - q(0.03)) * 10) / 10,
    highlightPx: highlight,
    contactDark: Math.round(contactDark * 10) / 10,
    clipPct: Math.round((clip / Math.max(1, maskCount)) * 1000) / 10,
  };
}
const stats = { ...measure(), maskCount: (window as any).__maskCount ?? -1, box: (window as any).__maskBox, placedCount: placed.length };
// measure() leaves the framebuffer holding the silhouette pass; redraw the beauty
// image before capturing it, or the saved PNG is the black mask.
renderer.render(scene, camera);
console.error("MASKDEBUG", JSON.stringify(stats));
document.body.dataset.stats = JSON.stringify(stats);

const img = document.createElement("img");
img.src = renderer.domElement.toDataURL("image/png");
img.style.width = "100%";
document.body.append(img);
document.body.dataset.ready = "yes";
document.body.dataset.rendered = String(placed.length);

// Scene-graph audit: proves which parts the builders actually emitted, and how
// many triangles each fixture carries. Used to verify detail work by fact rather
// than by eyeballing a render.
const audit = placed.map((root) => {
  const parts: string[] = [];
  let tris = 0;
  let maxSegments = 0;
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node.name) parts.push(node.name);
    const geo = node.geometry as THREE.BufferGeometry;
    const index = geo.getIndex();
    const pos = geo.getAttribute("position");
    if (index) tris += index.count / 3;
    else if (pos) tris += pos.count / 3;
    const params = (geo as unknown as { parameters?: { segments?: number; radialSegments?: number } }).parameters;
    maxSegments = Math.max(maxSegments, params?.segments ?? 0, params?.radialSegments ?? 0);
  });
  return { parts, tris: Math.round(tris), maxSegments };
});
(window as unknown as { __toiletAudit: unknown }).__toiletAudit = audit;
document.body.dataset.audit = JSON.stringify(audit.map((a) => ({ tris: a.tris, parts: a.parts })));
renderer.dispose();
pmrem.dispose();
