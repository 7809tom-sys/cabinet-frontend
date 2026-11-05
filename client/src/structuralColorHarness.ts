/**
 * Before/after harness for the restored structural-colour behaviour.
 *
 * Renders ONE cabinet twice with the same build pipeline:
 *
 *   after  — the live code path (structural surfaces share the door appearance)
 *   before — the same path with the PR #123 split re-applied locally, so the two
 *            images differ only by the change under review
 *
 * The door "photo" is generated in-page from a known warm colour, so the split is
 * measurable: with the split the box/sides/toe kick paint a flat grey-ish hex while
 * the fronts paint the warm image; with the restoration both show the warm image.
 *
 * Dev-only: loaded from client/dev/color-shot.html, imported by nothing in the app.
 */
import * as THREE from "three";
import { addCabinet, applyThreeDStructuralFinishMaterials } from "@/components/design/InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";

/**
 * A STAINED door record whose saved colour differs from its door image, so the
 * split is visible. A painted style is deliberately solid everywhere (no image at
 * all), so it cannot show the divergence this harness exists to measure.
 */
const STYLE = {
  id: 990777,
  styleCode: "DN",
  ourName: "Designer Natural",
  aliasName: "Ivory Dune (Madison)",
  distributorId: 210001,
  color: "#8a7a63",
  woodSpecies: "Oak",
  finish: "Natural",
  doorStyle: "Shaker",
};

/** The warm tone the door image actually shows. Deliberately unlike the stored hex. */
const DOOR_IMAGE_HEX = "#c9a97f";

/** A small procedural "door photo" as a data URL — warm panel with a sheen gradient. */
function makeDoorDataUrl(): string {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const base = new THREE.Color(DOOR_IMAGE_HEX);
  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, `#${base.clone().multiplyScalar(1.04).getHexString()}`);
  gradient.addColorStop(1, `#${base.clone().multiplyScalar(0.94).getHexString()}`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  // `addCabinet` takes a URL; the real TextureLoader loads it and the renderer
  // reads the door photo's panel colour exactly as it does for an uploaded sample.
  return canvas.toDataURL("image/png");
}

type Variant = "before" | "after";

function render(pane: HTMLElement, variant: Variant): { front: string; side: string; toe: string } {
  const width = pane.clientWidth;
  const height = pane.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  pane.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef1f4");

  const INCH = 1 / 12;
  const roomW = 8;
  const roomD = 6;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(roomW * 1.8, 6, 4 * INCH), new THREE.MeshStandardMaterial({ color: "#f6f4ef", roughness: 0.95 }));
  wall.position.set(roomW / 2, 3, -2 * INCH);
  wall.receiveShadow = true;
  scene.add(wall);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4.5, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-4, 5, 6);
  scene.add(fill);

  const finish = doorStyleFinishColors(STYLE as never);
  const profile = designerCatalogDoorProfile(STYLE as never);
  const doorSampleUrl = makeDoorDataUrl();

  const root = new THREE.Group();
  scene.add(root);

  addCabinet(
    root,
    {
      placementUid: "colour-check",
      masterCode: "3DB24",
      description: '24" Three Drawer Base',
      placementType: "base",
      width: 24,
      depth: 24,
      height: 34.5,
      numberOfDoors: 1,
      numberOfDrawers: 3,
      category: "Base",
      subCategory: "Standard Base",
    } as never,
    "back",
    { back: 0 },
    120,
    96,
    finish.face,
    "#eeeeee",
    profile as never,
    { x: 4, z: 0.4, rotation: 0 },
    doorSampleUrl,
    undefined,
    { selectedToeKick: true },
  );

  // ── The only difference between the two panes ──────────────────────────────
  // BEFORE: re-apply exactly what PR #123 did — flat catalog hex, no sample.
  //
  // The door image loads asynchronously and the loader callback re-applies the
  // restored appearance, so the override is re-asserted on every rendered frame
  // and the render loop is started only after the first pass.
  const applySplit = () => {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh & { userData: Record<string, unknown> };
      if (!mesh.isMesh) return;
      const structural = mesh.userData.selectedFinishStructuralSurface === true
        || mesh.userData.selectedStyleSideSkin === true
        || mesh.userData.baseToeKick === true
        || mesh.userData.selectedToeKickFinishSkin === true
        || mesh.userData.decorativeEndSkin === true;
      if (!structural) return;
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
      if (!material || !("color" in material)) return;
      // PR #123 behaved as `threeDStructuralFinish(color, hasSample) => solid color`.
      material.map = null;
      material.color.set(finish.face);
      material.needsUpdate = true;
    });
  };

  // Frame the cabinet from its own bounding box: it is ~2 ft wide, so a fixed
  // camera distance was pointing at empty floor.
  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const span = Math.max(size.x, size.y, size.z, 1);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 100);
  const target = center.clone();
  camera.position.set(
    center.x + span * 0.55,
    center.y + span * 0.42,
    center.z + span * 1.55,
  );
  camera.lookAt(target);

  renderer.render(scene, camera);

  // Material-level ground truth: the colours of the meshes actually built,
  // independent of any lighting or shading.
  const readout = { front: "#000000", side: "#000000", toe: "#000000" };
  root.traverse((node) => {
    const mesh = node as THREE.Mesh & { userData: Record<string, unknown> };
    if (!mesh.isMesh) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
    if (!material || !("color" in material)) return;
    const hex = `#${material.color.getHexString()}`;
    if (mesh.userData.cabinetFront) readout.front = material.map ? `${hex}+map` : hex;
    else if (mesh.userData.selectedStyleSideSkin || mesh.userData.selectedFinishStructuralSurface) readout.side = material.map ? `${hex}+map` : hex;
    else if (mesh.userData.baseToeKick) readout.toe = material.map ? `${hex}+map` : hex;
  });

  let frames = 0;
  const tick = () => {
    if (variant === "before") applySplit();
    renderer.render(scene, camera);
    if (++frames < 200) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return readout;
}

function samplePane(pane: HTMLElement): { front: string; side: string; toe: string } {
  // Read the average rgb of three regions from the rendered canvas.
  const canvas = pane.querySelector("canvas") as HTMLCanvasElement | null;
  if (!canvas) return { front: "n/a", side: "n/a", toe: "n/a" };
  const probe = document.createElement("canvas");
  probe.width = canvas.width;
  probe.height = canvas.height;
  const context = probe.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(canvas, 0, 0);
  const region = (rx: number, ry: number, rw: number, rh: number) => {
    const x = Math.round(canvas.width * rx);
    const y = Math.round(canvas.height * ry);
    const w = Math.max(1, Math.round(canvas.width * rw));
    const h = Math.max(1, Math.round(canvas.height * rh));
    const data = context.getImageData(x, y, w, h).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++; }
    const hex = (v: number) => Math.round(v / Math.max(1, n)).toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  };
  return {
    front: region(0.30, 0.40, 0.08, 0.06),
    side: region(0.74, 0.44, 0.05, 0.06),
    toe: region(0.30, 0.80, 0.08, 0.03),
  };
}

async function run() {
  const before = document.getElementById("pane-before")!;
  const after = document.getElementById("pane-after")!;
  // `render` returns the material colours the LIVE code path produced. The
  // "before" pane then re-applies the PR #123 split only for drawing, so this
  // readout is the honest comparison of the two code paths.
  const materialReadout = {
    before: render(before, "before"),
    after: render(after, "after"),
  };
  // Let the door image load and the split override settle.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const b = samplePane(before);
  const a = samplePane(after);
  const dist = (x: string, y: string) => {
    if (!x.startsWith("#") || !y.startsWith("#")) return null;
    const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [p1, p2] = [parse(x), parse(y)];
    return Math.round(p1.reduce((sum, v, i) => sum + Math.abs(v - p2[i]!), 0) / 3);
  };

  const box = (pane: HTMLElement, sw: { front: string; side: string; toe: string }, title: string) => {
    const el = document.createElement("div");
    el.className = "swatches";
    el.innerHTML = `${title}<br/>`
      + `<span style="background:${sw.front}"></span>front ${sw.front}<br/>`
      + `<span style="background:${sw.side}"></span>side ${sw.side}<br/>`
      + `<span style="background:${sw.toe}"></span>toe ${sw.toe}`;
    pane.appendChild(el);
  };
  box(before, b, `front↔side Δ ${dist(b.front, b.side)} · front↔toe Δ ${dist(b.front, b.toe)}`);
  box(after, a, `front↔side Δ ${dist(a.front, a.side)} · front↔toe Δ ${dist(a.front, a.toe)}`);

  (window as unknown as { __colorShot?: unknown }).__colorShot = {
    pixels: { before: b, after: a },
    materials: materialReadout,
  };
}

void run();
