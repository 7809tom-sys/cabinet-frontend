import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  makeShowerNicheParts,
  makeShowerPanParts,
  makeShowerSurroundParts,
  makeShowerSystemParts,
} from "@/components/design/showerFixtureGeometry";
import {
  showerFinishFromCode,
  showerGlassMaterial,
  showerMetalMaterial,
  showerPanTexture,
  showerSurroundFinish,
  showerSurroundTexture,
} from "@/components/design/showerFinishes";
import { verifiedPelicanBathroomFixtureProfile } from "@/lib/pelicanBathroomFixtureProfiles";

/**
 * Isolated render of an assembled shower, built from the SAME geometry builders and
 * finishes the designer uses. Used to judge and iterate on realism without the whole
 * designer app, and to produce the before/after comparison.
 *
 * Query: ?surround=PL-603696 Marble&pan=PL-016036C&system=PL-86S22S CHR&door=PL-03B71SSO BN&niche=PL-SN1614&view=persp|front|top&finish=chrome
 */

const params = new URLSearchParams(location.search);
const code = (key: string, fallback: string) => params.get(key) ?? fallback;

const SURROUND = code("surround", "PL-603696 Marble");
const PAN = code("pan", "PL-016036C");
const SYSTEM = code("system", "PL-86S22S CHR");
const DOOR = code("door", "PL-03B71SSO BN");
const NICHE = code("niche", "PL-SN1614");
const VIEW = code("view", "persp");
const VARIANT = code("variant", "after");

const INCH = 1 / 12;

RectAreaLightUniformsLib.init();

const W = 1400;
const H = 950;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(2);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(params.get("exp") ?? 1.0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#e8e6e1");

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;

const root = new THREE.Group();
scene.add(root);

/** Collect every part the builders return, exactly as the designer adds them. */
function addParts(parts: { mesh: THREE.Mesh; part: string }[], group: THREE.Group) {
  for (const { mesh, part } of parts) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.part = part;
    group.add(mesh);
  }
}

const surroundProfile = verifiedPelicanBathroomFixtureProfile(SURROUND);
const panProfile = verifiedPelicanBathroomFixtureProfile(PAN);
const systemProfile = verifiedPelicanBathroomFixtureProfile(SYSTEM);
const doorProfile = verifiedPelicanBathroomFixtureProfile(DOOR);
const nicheProfile = verifiedPelicanBathroomFixtureProfile(NICHE);

if (!surroundProfile || !panProfile) {
  document.body.textContent = `Missing profile: surround=${SURROUND} pan=${PAN}`;
  throw new Error("missing profile");
}

// ── The surround, with the finish the SKU is actually sold in ────────────────
const surroundFinish = showerSurroundFinish(SURROUND);
const surroundTexture = showerSurroundTexture(surroundFinish);
const surroundPanel =
  VARIANT === "after"
    ? new THREE.MeshPhysicalMaterial({
        color: surroundTexture ? "#ffffff" : surroundFinish.color,
        map: surroundTexture,
        roughness: surroundFinish.roughness,
        metalness: 0,
        clearcoat: surroundFinish.clearcoat,
        clearcoatRoughness: 0.3,
        side: THREE.DoubleSide,
      })
    : // BEFORE: the old flat near-white panel with no texture at all.
      new THREE.MeshPhysicalMaterial({
        color: "#efedea",
        roughness: 0.5,
        metalness: 0,
        clearcoat: 0.2,
        clearcoatRoughness: 0.35,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });

const panTexture = showerPanTexture();
const panShell =
  VARIANT === "after"
    ? new THREE.MeshPhysicalMaterial({
        color: panTexture ? "#ffffff" : "#fbfbf8",
        map: panTexture,
        roughness: 0.2,
        metalness: 0,
        clearcoat: 0.42,
        clearcoatRoughness: 0.18,
        side: THREE.DoubleSide,
      })
    : new THREE.MeshPhysicalMaterial({
        color: "#f7f8f5",
        roughness: 0.22,
        metalness: 0,
        clearcoat: 0.3,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });

const surroundGroup = new THREE.Group();
addParts(makeShowerSurroundParts(surroundProfile, {
  shell: panShell,
  metal: showerMetalMaterial(showerFinishFromCode(SURROUND)),
  panel: surroundPanel,
}), surroundGroup);
root.add(surroundGroup);

// ── The pan, sitting inside the surround ─────────────────────────────────────
const panGroup = new THREE.Group();
addParts(makeShowerPanParts(panProfile, {
  shell: panShell,
  metal: showerMetalMaterial("brushed-nickel"),
}), panGroup);
root.add(panGroup);

// ── The system, on the back wall ─────────────────────────────────────────────
if (systemProfile) {
  const systemGroup = new THREE.Group();
  addParts(makeShowerSystemParts(systemProfile, {
    shell: panShell,
    metal:
      VARIANT === "after"
        ? showerMetalMaterial(showerFinishFromCode(SYSTEM))
        : new THREE.MeshStandardMaterial({ color: "#b9c2c7", roughness: 0.24, metalness: 0.9 }),
  }), systemGroup);
  systemGroup.position.set(0, 0, (surroundProfile.depthIn / 2) * INCH);
  root.add(systemGroup);
}

// ── The door, on the open front ──────────────────────────────────────────────
if (doorProfile) {
  const doorGroup = new THREE.Group();
  const panelHeight = (doorProfile.visiblePanelHeightIn ?? doorProfile.heightIn) * INCH;
  const dw = doorProfile.widthIn * INCH;
  if (VARIANT === "after") {
    const metal = showerMetalMaterial(showerFinishFromCode(DOOR));
    const glass = showerGlassMaterial();
    for (const x of [-dw / 4, dw / 4]) {
      const pw = dw / 2 - 0.006;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, panelHeight, 0.03), glass);
      panel.position.set(x, panelHeight / 2, 0);
      panel.userData.part = "door-glass";
      doorGroup.add(panel);
      for (const edge of [-1, 1] as const) {
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.05, panelHeight, 0.033), metal);
        stile.position.set(x + edge * (pw / 2 - 0.025), panelHeight / 2, 0);
        stile.userData.part = "door-frame";
        doorGroup.add(stile);
      }
      for (const y of [panelHeight - 0.025, 0.025]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.05, 0.033), metal);
        bar.position.set(x, y, 0);
        doorGroup.add(bar);
      }
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(dw, 0.06, 0.06), metal);
    rail.position.y = doorProfile.heightIn * INCH - 0.03;
    rail.userData.part = "door-rail";
    doorGroup.add(rail);
    const track = new THREE.Mesh(new THREE.BoxGeometry(dw, 0.028, 0.05), metal);
    track.position.y = 0.014;
    doorGroup.add(track);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, panelHeight * 0.42, 16), metal);
    handle.position.set(-dw * 0.02, panelHeight * 0.52, 0.045);
    doorGroup.add(handle);
  } else {
    const glass = new THREE.MeshPhysicalMaterial({ color: "#d8eef4", roughness: 0.05, transmission: 0.68, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
    const metal = new THREE.MeshStandardMaterial({ color: "#77828a", roughness: 0.28, metalness: 0.85 });
    for (const x of [-dw / 4, dw / 4]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(dw / 2 - 0.006, panelHeight, 0.015), glass);
      panel.position.set(x, panelHeight / 2, 0);
      doorGroup.add(panel);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(dw, 0.045, 0.045), metal);
    rail.position.y = doorProfile.heightIn * INCH - 0.0225;
    doorGroup.add(rail);
  }
  doorGroup.position.set(0, 0, -(surroundProfile.depthIn / 2) * INCH + 0.06);
  root.add(doorGroup);
}

// ── The niche, recessed into the back wall ──────────────────────────────────
if (nicheProfile) {
  const nicheGroup = new THREE.Group();
  addParts(makeShowerNicheParts(nicheProfile, {
    shell: new THREE.MeshStandardMaterial({ color: "#eeeae4", roughness: 0.42 }),
    metal: showerMetalMaterial(showerFinishFromCode(NICHE)),
  }), nicheGroup);
  nicheGroup.position.set(
    surroundProfile.widthIn * INCH * 0.22,
    44 * INCH,
    (surroundProfile.depthIn / 2) * INCH,
  );
  nicheGroup.rotation.y = Math.PI;
  root.add(nicheGroup);
}

// ── Floor + room, so the surround reads against something ───────────────────
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 24),
  new THREE.MeshPhysicalMaterial({ color: "#cfc8bd", roughness: 0.4, clearcoat: 0.2 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// The surround's own back panel sits at +Z and the camera looks from +Z, so the
// room wall belongs BEHIND it — at a larger +Z — never in front. A wall placed just
// proud of the panels hid the entire shower behind a flat plane.
const backWall = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 10),
  new THREE.MeshStandardMaterial({ color: "#ded9d1", roughness: 0.85 }),
);
backWall.position.set(0, 5, (surroundProfile.depthIn / 2) * INCH + 1.2);
backWall.rotation.y = Math.PI;
backWall.receiveShadow = true;
scene.add(backWall);

// ── Lights: soft key from the room side, plus a rim ─────────────────────────
const key = new THREE.RectAreaLight("#fff8ef", 7.5, 5, 6);
key.position.set(-4.5, 7.5, 5.5);
key.lookAt(0, 3, 0);
scene.add(key);
const fill = new THREE.RectAreaLight("#e8f0fa", 1.1, 4, 5);
fill.position.set(5, 4.5, 4);
fill.lookAt(0, 2.5, 0);
scene.add(fill);
const rim = new THREE.RectAreaLight("#ffffff", 1.8, 3, 4);
rim.position.set(1.5, 6, -4.5);
rim.lookAt(0, 3, 0);
scene.add(rim);

const sun = new THREE.DirectionalLight("#fff6ea", 2.1);
sun.position.set(-5, 10, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -9;
sun.shadow.camera.right = 9;
sun.shadow.camera.top = 9;
sun.shadow.camera.bottom = -9;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

scene.add(new THREE.AmbientLight("#ffffff", 0.06));

// ── Camera ──────────────────────────────────────────────────────────────────
const box = new THREE.Box3().setFromObject(root);
const centre = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());
const span = Math.max(size.x, size.y, size.z);
const camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 200);
if (VIEW === "front") camera.position.set(centre.x, centre.y + span * 0.25, centre.z + span * 2.1);
else if (VIEW === "top") camera.position.set(centre.x, centre.y + span * 1.9, centre.z + span * 0.35);
else camera.position.set(centre.x - span * 0.95, centre.y * 0.62, centre.z + span * 1.35);
camera.lookAt(centre.x, centre.y * 0.92, centre.z);
camera.updateMatrixWorld();

renderer.render(scene, camera);
// Expose geometry facts so the render can be verified by measurement.
(window as unknown as { __diag: () => unknown }).__diag = () => {
  const box = new THREE.Box3().setFromObject(root);
  return {
    rootMin: box.min.toArray().map((n) => Number(n.toFixed(2))),
    rootMax: box.max.toArray().map((n) => Number(n.toFixed(2))),
    camera: camera.position.toArray().map((n) => Number(n.toFixed(2))),
    meshes: root.children.reduce((sum, g) => sum + g.children.length, 0),
    surroundW: surroundProfile.widthIn, surroundD: surroundProfile.depthIn, surroundH: surroundProfile.heightIn,
  };
};
document.body.dataset.ready = "yes";
document.body.dataset.parts = String(root.children.reduce((sum, group) => sum + group.children.length, 0));
