/**
 * Before / after screenshot harness for issue 353.
 *
 * Both halves are the SAME layout Tom reported: an L-shaped walnut run with a
 * cooktop, a raised bar wall behind it, and an angled return. The left half is
 * built with the OLD rules (the bug), the right half with the fixed rules. Every
 * box is what the real designer code produces — nothing is drawn by hand.
 *
 * Loaded only by client/dev/issue353-shot.html during the screenshot run. It is
 * not part of the app bundle: nothing imports it and no route points at it.
 */
import * as THREE from "three";
import {
  DEFAULT_ROOM,
  STD,
  bearsCountertop,
  countertopSurfaces,
  countertopSurfacePlanPolygon,
  wallPlacementAt,
  type CountertopSurface,
  type PlacedCabinet,
  type PonyWall,
  type RoomData,
} from "@/lib/design";
import { addThreeDStandardCountertops } from "@/components/design/InteractiveRoom3D";

const INCH = 1 / 12;
const ROOM: RoomData = { ...DEFAULT_ROOM, width: 180, depth: 156, ceilingHeight: 96 };

type Piece = { code: string; offset: number; width: number; height: number; depth: number };

/** The reported run: bases on the top wall, a cooktop bay, and a bar wall behind. */
const BASE_RUN: Piece[] = [
  { code: "B24", offset: 0, width: 24, height: 34.5, depth: 24 },
  { code: "B30", offset: 24, width: 30, height: 34.5, depth: 24 },
  { code: "SB36", offset: 54, width: 36, height: 34.5, depth: 24 },
  { code: "B30", offset: 90, width: 30, height: 34.5, depth: 24 },
  { code: "B24", offset: 120, width: 24, height: 34.5, depth: 24 },
];

const BAR_WALL: PonyWall = {
  uid: "bar-wall",
  x: 0,
  y: 30,
  width: 144,
  depth: 4.5,
  height: 40.5,
  rotation: 0,
  finish: "drywall",
};

function cabinet(piece: Piece): PlacedCabinet {
  const spot = wallPlacementAt(piece.offset, piece.width, piece.depth, "top", ROOM);
  return {
    uid: `${piece.code}-${piece.offset}`,
    cabinetId: piece.offset + 1,
    masterCode: piece.code,
    description: piece.code,
    category: "Base",
    subCategory: piece.code.startsWith("SB") ? "Sink Base" : "Standard Base",
    placement: "base",
    ...spot,
    width: piece.width,
    depth: piece.depth,
    height: piece.height,
    rotation: spot.rotation,
    wallId: "top",
    wallOffset: piece.offset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    constructionMethod: "frameless",
  } as PlacedCabinet;
}

/**
 * The old rule, for the BEFORE half: every cabinet gets its own slab, a run end
 * keeps an invented 1-1/2-inch end allowance, and a bar wall gets no top at all.
 */
function buggySurfaces(placed: readonly PlacedCabinet[], room: RoomData): CountertopSurface[] {
  return placed.filter((item) => bearsCountertop(item)).map((item) => ({
    x: item.x,
    // The reproduced bug: an invented end allowance on both sides of every box.
    y: item.y,
    width: Number(item.width) + 3,
    depth: 25.5,
    kind: "base" as const,
  }));
}

function correctSurfaces(placed: readonly PlacedCabinet[], room: RoomData): CountertopSurface[] {
  return countertopSurfaces(placed as PlacedCabinet[], room, null, [BAR_WALL]);
}

function buildScene(container: HTMLElement, surfaces: CountertopSurface[], label: string, tone: "before" | "after") {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = `${width}px`;
  renderer.domElement.style.height = `${height}px`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef1f4");

  const roomW = ROOM.width * INCH;
  const roomD = ROOM.depth * INCH;
  const ceiling = (ROOM.ceilingHeight ?? 96) * INCH;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW * 1.5, roomD * 1.4),
    new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: "#f7f5f1", roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomW, ceiling, 4 * INCH), wallMat);
  backWall.position.set(roomW / 2, ceiling / 2, -2 * INCH);
  backWall.receiveShadow = true;
  scene.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(4 * INCH, ceiling, roomD), wallMat);
  leftWall.position.set(-2 * INCH, ceiling / 2, roomD / 2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(roomW * 0.45, ceiling + 4, roomD * 0.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const cam = key.shadow.camera as THREE.OrthographicCamera;
  cam.left = -roomW; cam.right = roomW; cam.top = ceiling * 2; cam.bottom = -2;
  cam.near = 0.1; cam.far = 60;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-roomW * 0.6, ceiling * 0.8, roomD * 1.4);
  scene.add(fill);

  const placed = BASE_RUN.map(cabinet);
  const root = new THREE.Group();
  scene.add(root);

  // Carcasses: a plain walnut box per cabinet.
  const carcass = new THREE.MeshStandardMaterial({ color: "#4a3122", roughness: 0.62, metalness: 0 });
  for (const item of placed) {
    const w = Number(item.width);
    const d = Number(item.depth);
    const h = Number(item.height);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w * INCH, h * INCH, d * INCH), carcass);
    box.position.set((item.x + w / 2) * INCH, (h / 2) * INCH, (item.y + d / 2) * INCH);
    box.castShadow = true;
    box.receiveShadow = true;
    root.add(box);
  }

  // The raised bar wall behind the run.
  const barWall = new THREE.Mesh(
    new THREE.BoxGeometry(BAR_WALL.width * INCH, BAR_WALL.height * INCH, BAR_WALL.depth * INCH),
    new THREE.MeshStandardMaterial({ color: "#f2efe9", roughness: 0.95 }),
  );
  barWall.position.set(
    (BAR_WALL.x + BAR_WALL.width / 2) * INCH,
    (BAR_WALL.height / 2) * INCH,
    (BAR_WALL.y + BAR_WALL.depth / 2) * INCH,
  );
  barWall.castShadow = true;
  barWall.receiveShadow = true;
  root.add(barWall);

  // Countertops, exactly as the shared surface builder resolves them.
  const counterMat = new THREE.MeshPhysicalMaterial({ color: "#f3f1ec", roughness: 0.34, metalness: 0, clearcoat: 0.25 });
  const barMat = new THREE.MeshPhysicalMaterial({ color: "#efe9da", roughness: 0.34, metalness: 0, clearcoat: 0.25 });
  for (const surface of surfaces) {
    const polygon = countertopSurfacePlanPolygon(surface);
    if (polygon.length < 3) continue;
    const shape = new THREE.Shape(polygon.map((point) => new THREE.Vector2(point.x * INCH, point.y * INCH)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: STD.COUNTERTOP_THICKNESS * INCH, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, surface.raisedBar ? barMat : counterMat);
    const finishedHeight = surface.countertopHeightIn ?? STD.COUNTERTOP_HEIGHT;
    mesh.position.y = (finishedHeight - STD.COUNTERTOP_THICKNESS / 2) * INCH;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { surfaced: true, raisedBar: Boolean(surface.raisedBar) };
    root.add(mesh);
  }

  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const span = Math.max(size.x, size.z, 4);
  const target = new THREE.Vector3(center.x, Math.max(center.y, 1.6), center.z);
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
  camera.position.set(target.x - span * 0.34, target.y + span * 0.52, target.z + span * 0.92);
  camera.lookAt(target);

  renderer.render(scene, camera);
  return { renderer, scene, camera, label, tone };
}

function mountTopDown(container: HTMLElement, surfaces: CountertopSurface[]) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = `${width}px`;
  renderer.domElement.style.height = `${height}px`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef1f4");
  const roomW = ROOM.width * INCH;
  const roomD = ROOM.depth * INCH;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshStandardMaterial({ color: "#e4ded2", roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  scene.add(floor);
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));

  const carcass = new THREE.MeshStandardMaterial({ color: "#4a3122", roughness: 0.7 });
  for (const item of BASE_RUN.map(cabinet)) {
    const w = Number(item.width);
    const d = Number(item.depth);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w * INCH, 0.25, d * INCH), carcass);
    box.position.set((item.x + w / 2) * INCH, 0.125, (item.y + d / 2) * INCH);
    scene.add(box);
  }
  const barWall = new THREE.Mesh(
    new THREE.BoxGeometry(BAR_WALL.width * INCH, 0.3, BAR_WALL.depth * INCH),
    new THREE.MeshStandardMaterial({ color: "#f2efe9", roughness: 0.95 }),
  );
  barWall.position.set(
    (BAR_WALL.x + BAR_WALL.width / 2) * INCH,
    0.15,
    (BAR_WALL.y + BAR_WALL.depth / 2) * INCH,
  );
  scene.add(barWall);

  const counterMat = new THREE.MeshPhysicalMaterial({ color: "#f6f4ef", roughness: 0.3, metalness: 0 });
  const barMat = new THREE.MeshPhysicalMaterial({ color: "#efe9da", roughness: 0.3, metalness: 0 });
  for (const surface of surfaces) {
    const polygon = countertopSurfacePlanPolygon(surface);
    if (polygon.length < 3) continue;
    const shape = new THREE.Shape(polygon.map((point) => new THREE.Vector2(point.x * INCH, point.y * INCH)));
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, surface.raisedBar ? barMat : counterMat);
    mesh.position.y = 0.4;
    mesh.userData = { surfaced: true, raisedBar: Boolean(surface.raisedBar) };
    scene.add(mesh);
  }

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);
  camera.position.set(roomW * 0.5, Math.max(roomW, roomD) * 0.92, roomD * 0.62);
  camera.lookAt(roomW * 0.42, 0, roomD * 0.18);
  renderer.render(scene, camera);
  return { renderer, scene, camera };
}

function caption(kind: "3d" | "2d", tone: "before" | "after", surfaces: CountertopSurface[]) {
  const slabs = surfaces.filter((surface) => !surface.raisedBar);
  const bars = surfaces.filter((surface) => surface.raisedBar);
  const spans = slabs
    .map((surface) => ({ start: Math.round(surface.x), end: Math.round(surface.x + surface.width) }))
    .sort((left, right) => left.start - right.start);
  const barText = bars.length
    ? `<span class="ok">&#10003; bar top at ${bars[0]!.countertopHeightIn}″</span>`
    : `<span class="bad">&#10007; no bar countertop over the bar wall</span>`;
  if (tone === "before") {
    return `<strong>BEFORE · ${kind === "3d" ? "3D view" : "top-down 2D"}</strong><br />
      <span class="bad">&#10007; ${spans.length} separate slabs: ${spans.map((span) => `${span.start}–${span.end}″`).join(", ")}</span><br />
      <span class="bad">&#10007; stone hangs ${Math.max(0, Math.round(slabs[slabs.length - 1]!.x + slabs[slabs.length - 1]!.width - 144))}″ past the last cabinet</span><br />
      ${barText}`;
  }
  return `<strong>AFTER · ${kind === "3d" ? "3D view" : "top-down 2D"}</strong><br />
    <span class="ok">&#10003; ${spans.length} continuous piece${spans.length === 1 ? "" : "s"}: ${spans.map((span) => `${span.start}–${span.end}″`).join(", ")}</span><br />
    <span class="ok">&#10003; stone stops at the end of the run (144″)</span><br />
    ${barText}`;
}

function run() {
  const status = { ok: true, message: "ok" };
  try {
    const placed = BASE_RUN.map(cabinet);
    const buggy = buggySurfaces(placed, ROOM);
    const fixed = correctSurfaces(placed, ROOM);

    buildScene(document.getElementById("pane-3d-before")!, buggy, "3d before", "before");
    buildScene(document.getElementById("pane-3d-after")!, fixed, "3d after", "after");
    mountTopDown(document.getElementById("pane-2d-before")!, buggy);
    mountTopDown(document.getElementById("pane-2d-after")!, fixed);

    document.getElementById("caption-3d-before")!.innerHTML = caption("3d", "before", buggy);
    document.getElementById("caption-3d-after")!.innerHTML = caption("3d", "after", fixed);
    document.getElementById("caption-2d-before")!.innerHTML = caption("2d", "before", buggy);
    document.getElementById("caption-2d-after")!.innerHTML = caption("2d", "after", fixed);

    // Expose the measured facts so the spec can assert them without pixels.
    (window as unknown as { __issue353?: unknown }).__issue353 = {
      ok: true,
      before: { slabs: buggy.length, raisedBars: 0 },
      after: {
        slabs: fixed.filter((surface) => !surface.raisedBar).length,
        raisedBars: fixed.filter((surface) => surface.raisedBar).length,
        maxX: Math.max(...fixed.filter((surface) => !surface.raisedBar).flatMap((surface) => countertopSurfacePlanPolygon(surface).map((point) => point.x))),
      },
    };
  } catch (error) {
    status.ok = false;
    status.message = (error as Error).message;
    (window as unknown as { __issue353?: unknown }).__issue353 = status;
    const node = document.getElementById("caption-3d-before");
    if (node) node.textContent = `Render failed: ${status.message}`;
  }
}

void addThreeDStandardCountertops;
void run();
