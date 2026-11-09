/**
 * Before / after screenshot harness for issue 353, round 2.
 *
 * BOTH columns are real designer code, not a hand-written model:
 *   - BEFORE calls `legacyMain/design.ts` — a verbatim copy of `design.ts` and
 *     `freestandingRun.ts` as they stand on `main` (the `__parity` test proves
 *     that copy still reproduces Tom's report: two slabs, a gap, no miter).
 *   - AFTER calls the branch's own `countertopSurfaces`.
 *
 * The layout is Tom's: an L-shaped run. Straights are seated on the back wall,
 * the angled leg of the 45-degree return is dropped beside them with the Wall
 * Builder's 11-inch inside-corner hold, and a raised bar wall stands behind the
 * run. Nothing in this file builds a countertop by hand.
 *
 * Loaded only by client/dev/issue353-shot.html during the screenshot run.
 */
import * as THREE from "three";
import {
  STD,
  countertopSurfaces as branchCountertops,
  countertopSurfacePlanPolygon as branchPolygon,
  wallPlacementAt,
  type CountertopSurface,
  type PlacedCabinet,
  type PonyWall,
  type RoomData,
} from "@/lib/design";
import { DEFAULT_ROOM } from "@/lib/design";
import {
  countertopSurfaces as mainCountertops,
  countertopSurfacePlanPolygon as mainPolygon,
} from "@/lib/legacyMain/design";
import { DEFAULT_ROOM as MAIN_ROOM } from "@/lib/legacyMain/design";

const INCH = 1 / 12;
const ROOM: RoomData = { ...DEFAULT_ROOM, width: 204, depth: 168, ceilingHeight: 96 };
const MAIN_ROOM_DATA = { ...MAIN_ROOM, width: 204, depth: 168, ceilingHeight: 96 };

function wallBase(uid: string, offset: number, width: number, room: RoomData, asMain = false): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", room);
  void asMain;
  return {
    uid,
    cabinetId: 1,
    masterCode: `B${width}`,
    description: `B${width}`,
    category: "Base",
    subCategory: "Standard Base",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: "top",
    wallOffset: offset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    constructionMethod: "frameless",
  } as PlacedCabinet;
}

/** The angled leg, seated at the Wall Builder's 11-inch inside-corner hold. */
function angledLeg(uid: string, vertex: { x: number; y: number }, rotation: number, width: number): PlacedCabinet {
  const tangent = { x: Math.cos((rotation * Math.PI) / 180), y: Math.sin((rotation * Math.PI) / 180) };
  const forward = { x: -Math.sin((rotation * Math.PI) / 180), y: Math.cos((rotation * Math.PI) / 180) };
  const backLeft = { x: vertex.x + tangent.x * 11, y: vertex.y + tangent.y * 11 };
  const center = {
    x: backLeft.x + tangent.x * (width / 2) + forward.x * 12,
    y: backLeft.y + tangent.y * (width / 2) + forward.y * 12,
  };
  const radians = (rotation * Math.PI) / 180;
  const boundWidth = Math.abs(width * Math.cos(radians)) + Math.abs(24 * Math.sin(radians));
  const boundDepth = Math.abs(width * Math.sin(radians)) + Math.abs(24 * Math.cos(radians));
  return {
    uid,
    cabinetId: 2,
    masterCode: `B${width}`,
    description: `B${width}`,
    category: "Base",
    subCategory: "Standard Base",
    placement: "base",
    x: center.x - boundWidth / 2,
    y: center.y - boundDepth / 2,
    width,
    depth: 24,
    height: 34.5,
    rotation,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    constructionMethod: "frameless",
  } as PlacedCabinet;
}

// Tom's L: four straight bases on the back wall, then the angled return.
const STRAIGHTS = [
  { offset: 0, width: 24 },
  { offset: 24, width: 30 },
  { offset: 54, width: 36 },
  { offset: 90, width: 30 },
];
const RUN_END = 120;
const CORNER = { x: RUN_END + 11, y: 0 };

function layout(room: RoomData): PlacedCabinet[] {
  return [
    ...STRAIGHTS.map((entry, index) => wallBase(`w${index}`, entry.offset, entry.width, room)),
    angledLeg("a0", CORNER, 45, 36),
  ];
}

const BAR_WALL: PonyWall = {
  uid: "bar-wall",
  x: 0,
  y: 30,
  width: RUN_END,
  depth: 4.5,
  height: 40.5,
  rotation: 0,
  finish: "drywall",
};

type Column = {
  id: string;
  label: string;
  surfaces: CountertopSurface[];
  polygon: (surface: CountertopSurface) => { x: number; y: number }[];
  placed: PlacedCabinet[];
};

function columns(): { before: Column; after: Column } {
  const beforePlaced = layout(MAIN_ROOM_DATA as RoomData);
  const afterPlaced = layout(ROOM);
  const before = {
    id: "before",
    label: "BEFORE · main",
    surfaces: mainCountertops(beforePlaced as never, MAIN_ROOM_DATA as never) as unknown as CountertopSurface[],
    polygon: mainPolygon as unknown as (surface: CountertopSurface) => { x: number; y: number }[],
    placed: beforePlaced,
  };
  const after = {
    id: "after",
    label: "AFTER · branch",
    surfaces: branchCountertops(afterPlaced, ROOM, null, [BAR_WALL]),
    polygon: branchPolygon,
    placed: afterPlaced,
  };
  return { before, after };
}

function addLighting(scene: THREE.Scene, roomW: number, roomD: number, ceiling: number) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(roomW * 0.42, ceiling + 3, roomD * 0.42);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const cam = key.shadow.camera as THREE.OrthographicCamera;
  cam.left = -roomW; cam.right = roomW; cam.top = ceiling * 2; cam.bottom = -2;
  cam.near = 0.1; cam.far = 60;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-roomW * 0.5, ceiling * 0.7, roomD * 1.3);
  scene.add(fill);
}

function addShell(scene: THREE.Scene, roomW: number, roomD: number, ceiling: number) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW * 1.6, roomD * 1.5),
    new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.92 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: "#f7f5f1", roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(roomW, ceiling, 4 * INCH), wallMat);
  back.position.set(roomW / 2, ceiling / 2, -2 * INCH);
  back.receiveShadow = true;
  scene.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(4 * INCH, ceiling, roomD), wallMat);
  left.position.set(-2 * INCH, ceiling / 2, roomD / 2);
  left.receiveShadow = true;
  scene.add(left);
}

function addCabinets(root: THREE.Group, placed: readonly PlacedCabinet[]) {
  // Same finish and same geometry in BOTH columns, so the only visible
  // difference between before and after is the countertop.
  const carcass = new THREE.MeshStandardMaterial({ color: "#efece5", roughness: 0.62, metalness: 0 });
  for (const item of placed) {
    const radians = (Number(item.rotation) || 0) * Math.PI / 180;
    const w = Number(item.width);
    const d = Number(item.depth);
    const h = Number(item.height);
    const box3 = new THREE.Mesh(new THREE.BoxGeometry(w * INCH, h * INCH, d * INCH), carcass);
    const boundW = Math.abs(w * Math.cos(radians)) + Math.abs(d * Math.sin(radians));
    const boundD = Math.abs(w * Math.sin(radians)) + Math.abs(d * Math.cos(radians));
    box3.position.set((item.x + boundW / 2) * INCH, (h / 2) * INCH, (item.y + boundD / 2) * INCH);
    box3.rotation.y = -radians;
    box3.castShadow = true;
    box3.receiveShadow = true;
    root.add(box3);
  }
}

function addBarWall(root: THREE.Group) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(BAR_WALL.width * INCH, BAR_WALL.height * INCH, BAR_WALL.depth * INCH),
    new THREE.MeshStandardMaterial({ color: "#f2efe9", roughness: 0.95 }),
  );
  mesh.position.set(
    (BAR_WALL.x + BAR_WALL.width / 2) * INCH,
    (BAR_WALL.height / 2) * INCH,
    (BAR_WALL.y + BAR_WALL.depth / 2) * INCH,
  );
  mesh.castShadow = true;
  root.add(mesh);
}

function addCountertops(root: THREE.Group, column: Column) {
  const plain = new THREE.MeshPhysicalMaterial({ color: "#dfe3e8", roughness: 0.32, metalness: 0, clearcoat: 0.24 });
  const bar = new THREE.MeshPhysicalMaterial({ color: "#efe9da", roughness: 0.32, metalness: 0, clearcoat: 0.24 });
  for (const surface of column.surfaces) {
    const polygon = column.polygon(surface);
    if (polygon.length < 3) continue;
    // Polygons are local to (x, y); extrude in place under the finished height.
    const shape = new THREE.Shape(polygon.map((point) => new THREE.Vector2(point.x * INCH, point.y * INCH)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: STD.COUNTERTOP_THICKNESS * INCH, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, surface.raisedBar ? bar : plain);
    const finishedHeight = surface.countertopHeightIn ?? STD.COUNTERTOP_HEIGHT;
    mesh.position.set(0, (finishedHeight - STD.COUNTERTOP_THICKNESS / 2) * INCH, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { surfaced: true, raisedBar: Boolean(surface.raisedBar) };
    root.add(mesh);
    // Seam markers: a thin dark line on the top of every slab edge, so a
    // separate-slab break is unmistakable in the picture.
    const edges = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(polygon.map((point) => new THREE.Vector3(point.x * INCH, 0, point.y * INCH))),
      new THREE.LineBasicMaterial({ color: 0x1b2a44 }),
    );
    edges.position.y = finishedHeight * INCH;
    root.add(edges);
  }
}

function frame(container: HTMLElement, root: THREE.Group) {
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
  addShell(scene, roomW, roomD, ceiling);
  addLighting(scene, roomW, roomD, ceiling);
  scene.add(root);

  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const span = Math.max(size.x, size.z, 5);
  const target = new THREE.Vector3(center.x, Math.max(center.y, 1.4), center.z);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
  camera.position.set(target.x - span * 0.30, target.y + span * 0.46, target.z + span * 0.98);
  camera.lookAt(target);
  renderer.render(scene, camera);
  return renderer;
}

function frameTopDown(container: HTMLElement, root: THREE.Group) {
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
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 500);
  camera.position.set(roomW * 0.52, Math.max(roomW, roomD) * 0.95, roomD * 0.66);
  camera.lookAt(roomW * 0.40, 0, roomD * 0.16);
  renderer.render(scene, camera);
  return renderer;
}

/** Measured facts, so the picture is checkable without pixels. */
function measure(column: Column) {
  const flat = column.surfaces.filter((surface) => !surface.raisedBar);
  const polys = flat.map((surface) => column.polygon(surface));
  const minX = Math.min(...polys.flat().map((point) => point.x));
  const maxX = Math.max(...polys.flat().map((point) => point.x));
  const mitered = flat.filter((surface) => surface.miteredStart || surface.miteredEnd).length;
  return {
    slabs: flat.length,
    liftedBars: column.surfaces.filter((surface) => surface.raisedBar).length,
    minX: Math.round(minX * 10) / 10,
    maxX: Math.round(maxX * 10) / 10,
    mitered,
  };
}

function captionHtml(title: string, facts: ReturnType<typeof measure>, tone: "before" | "after") {
  const cls = tone === "before" ? "bad" : "ok";
  const mark = tone === "before" ? "&#10007;" : "&#10003;";
  return `<strong>${title}</strong><br />
    <span class="${cls}">${mark} ${facts.slabs} countertop piece${facts.slabs === 1 ? "" : "s"} across the L</span><br />
    <span class="${cls}">${mark} ${facts.mitered} mitred slab${facts.mitered === 1 ? "" : "s"} at the angled corner</span><br />
    <span class="${cls}">${mark} stone spans ${facts.minX}&#8243;&#8211;${facts.maxX}&#8243;</span><br />
    <span class="${cls}">${mark} ${facts.liftedBars} bar top${facts.liftedBars === 1 ? "" : "s"} over the bar wall</span>`;
}

function run() {
  try {
    const { before, after } = columns();
    const beforeFacts = measure({ ...before, polygon: before.polygon });
    const afterFacts = measure({ ...after, polygon: after.polygon });

    for (const [column, paneId, captionId, topId, tone] of [
      [before, "pane-3d-before", "caption-3d-before", null, "before"] as const,
      [after, "pane-3d-after", "caption-3d-after", null, "after"] as const,
    ]) {
      const root = new THREE.Group();
      addCabinets(root, column.placed);
      if (column.id === "after") addBarWall(root);
      addCountertops(root, column);
      frame(document.getElementById(paneId)!, root);
      document.getElementById(captionId)!.innerHTML = captionHtml(column.label, column.id === "before" ? beforeFacts : afterFacts, tone);
      void topId;
    }
    for (const [column, paneId, captionId, tone] of [
      [before, "pane-2d-before", "caption-2d-before", "before"] as const,
      [after, "pane-2d-after", "caption-2d-after", "after"] as const,
    ]) {
      const root = new THREE.Group();
      addCabinets(root, column.placed);
      if (column.id === "after") addBarWall(root);
      addCountertops(root, column);
      frameTopDown(document.getElementById(paneId)!, root);
      document.getElementById(captionId)!.innerHTML = captionHtml(column.label, column.id === "before" ? beforeFacts : afterFacts, tone);
    }

    (window as unknown as { __issue353?: unknown }).__issue353 = {
      ok: true,
      before: beforeFacts,
      after: afterFacts,
    };
  } catch (error) {
    (window as unknown as { __issue353?: unknown }).__issue353 = { ok: false, message: (error as Error).message };
    const node = document.getElementById("caption-3d-before");
    if (node) node.textContent = `Render failed: ${(error as Error).message}`;
  }
}

void run();
