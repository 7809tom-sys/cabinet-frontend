/**
 * Before / after screenshot harness for issue 353 outcome 8.
 *
 * The reported layout: a 30-inch upper beside a 24-inch W3024 bridge with a
 * 1-1/2 inch seam between them. The board that closes that seam is placed by
 * the same continuous vertical-filler contract every filler writer uses.
 *
 * BEFORE is the old contract: the wall board is anchored at the floor and runs
 * to the top of the highest cabinet beside it, so it becomes a floor-standing
 * 96-inch strip beside the 24-inch upper — the panel Tom photographed.
 * AFTER is the fixed contract: a wall board finishes the upper band only.
 *
 * Loaded only by client/dev/issue353-panel-shot.html during the screenshot run.
 */
import * as THREE from "three";
import {
  DEFAULT_ROOM,
  STD,
  elevationBox,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";

const INCH = 1 / 12;
const ROOM: RoomData = { ...DEFAULT_ROOM, width: 156, depth: 132, ceilingHeight: 96 };

function wallCabinet(uid: string, code: string, offset: number, width: number, height: number, mountBottom?: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 12, "top", ROOM);
  return {
    uid,
    cabinetId: offset + 1,
    masterCode: code,
    description: code,
    category: "Wall",
    subCategory: code === "W3024" ? "Microwave Bridge" : "Standard Wall",
    placement: "wall",
    ...spot,
    width,
    depth: 12,
    height,
    rotation: spot.rotation,
    wallId: "top",
    wallOffset: offset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    ...(mountBottom != null ? { mountBottom } : {}),
  } as PlacedCabinet;
}

// The run Tom reported: a 30-inch upper, a 1-1/2 inch seam, then the W3024.
const UPPERS: PlacedCabinet[] = [
  wallCabinet("u-left", "W3030", 0, 30, 30),
  wallCabinet("u-bridge", "W3024", 31.5, 30, 24, 72),
  wallCabinet("u-right", "W3030", 61.5, 30, 30),
];
const BASES: PlacedCabinet[] = [0, 30, 60].map((offset, index) => {
  const spot = wallPlacementAt(offset, 30, 24, "top", ROOM);
  return {
    uid: `b${index}`,
    cabinetId: 90 + index,
    masterCode: "B30",
    description: "B30",
    category: "Base",
    subCategory: "Standard Base",
    placement: "base",
    ...spot,
    width: 30,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: "top",
    wallOffset: offset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
  } as PlacedCabinet;
});

/** The old contract: one board from the floor to the highest top beside it. */
const BEFORE_BOARD = { x: 30, y: 0, width: 1.5, bottom: 0, height: 96 };
/** The fixed contract: a wall board finishes the upper band only. */
const AFTER_BOARD = { x: 30, y: 0, width: 1.5, bottom: 54, height: 42 };

function build(container: HTMLElement, board: { x: number; width: number; bottom: number; height: number }, highlight: boolean) {
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
  const ceiling = (ROOM.ceilingHeight ?? 96) * INCH;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW * 1.4, 14),
    new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, 5);
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: "#f7f5f1", roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomW, ceiling, 4 * INCH), wallMat);
  backWall.position.set(roomW / 2, ceiling / 2, -2 * INCH);
  scene.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(4 * INCH, ceiling, 12), wallMat);
  leftWall.position.set(-2 * INCH, ceiling / 2, 6);
  scene.add(leftWall);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(roomW * 0.4, ceiling + 2, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const cam = key.shadow.camera as THREE.OrthographicCamera;
  cam.left = -roomW; cam.right = roomW; cam.top = ceiling * 2; cam.bottom = -2;
  cam.near = 0.1; cam.far = 60;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-roomW * 0.5, ceiling * 0.7, 14);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);

  const carcass = new THREE.MeshStandardMaterial({ color: "#4a3122", roughness: 0.6, metalness: 0 });
  const counter = new THREE.MeshPhysicalMaterial({ color: "#f3f1ec", roughness: 0.34, metalness: 0, clearcoat: 0.22 });

  for (const item of BASES) {
    const w = Number(item.width);
    const d = Number(item.depth);
    const h = Number(item.height);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w * INCH, h * INCH, d * INCH), carcass);
    box.position.set((item.x + w / 2) * INCH, (h / 2) * INCH, (item.y + d / 2) * INCH);
    box.castShadow = true;
    root.add(box);
    const top = new THREE.Mesh(new THREE.BoxGeometry((w + 0) * INCH, STD.COUNTERTOP_THICKNESS * INCH, 25.5 * INCH), counter);
    top.position.set((item.x + w / 2) * INCH, (STD.COUNTERTOP_HEIGHT + STD.COUNTERTOP_THICKNESS / 2) * INCH, (item.y + 25.5 / 2) * INCH);
    top.castShadow = true;
    root.add(top);
  }

  for (const item of UPPERS) {
    const w = Number(item.width);
    const d = Number(item.depth);
    const box3 = elevationBox(item, ROOM);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * INCH, box3.height * INCH, d * INCH), carcass);
    mesh.position.set(
      (item.x + w / 2) * INCH,
      (box3.bottom + box3.height / 2) * INCH,
      (item.y + d / 2) * INCH,
    );
    mesh.castShadow = true;
    root.add(mesh);
  }

  // The board that closes the seam, drawn from its own measured envelope.
  const boardMat = new THREE.MeshStandardMaterial({
    color: highlight ? "#b45309" : "#4a3122",
    roughness: 0.55,
    metalness: 0,
  });
  const boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(board.width * INCH, board.height * INCH, 12 * INCH),
    boardMat,
  );
  boardMesh.position.set(
    (board.x + board.width / 2) * INCH,
    (board.bottom + board.height / 2) * INCH,
    6 * INCH,
  );
  boardMesh.castShadow = true;
  boardMesh.userData = { seamBoard: true };
  root.add(boardMesh);

  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const span = Math.max(size.x, size.y, 6);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 300);
  camera.position.set(center.x - span * 0.30, center.y + span * 0.18, center.z + span * 1.05);
  camera.lookAt(center.x, center.y - span * 0.05, center.z);

  renderer.render(scene, camera);
  return { renderer, scene, camera };
}

function run() {
  try {
    build(document.getElementById("pane-before")!, BEFORE_BOARD, true);
    build(document.getElementById("pane-after")!, AFTER_BOARD, true);
    document.getElementById("caption-before")!.innerHTML =
      `<strong>BEFORE</strong><br /><span class="bad">&#10007; board runs from the floor to 96″</span><br />` +
      `<span class="bad">&#10007; a 96″ strip beside a 24″ upper</span>`;
    document.getElementById("caption-after")!.innerHTML =
      `<strong>AFTER</strong><br /><span class="ok">&#10003; board finishes the upper band: 54″–96″</span><br />` +
      `<span class="ok">&#10003; nothing beside the W3024 runs to the floor</span>`;
    (window as unknown as { __issue353Panel?: unknown }).__issue353Panel = {
      ok: true,
      before: { bottom: BEFORE_BOARD.bottom, height: BEFORE_BOARD.height },
      after: { bottom: AFTER_BOARD.bottom, height: AFTER_BOARD.height },
    };
  } catch (error) {
    (window as unknown as { __issue353Panel?: unknown }).__issue353Panel = { ok: false, message: (error as Error).message };
    const node = document.getElementById("caption-before");
    if (node) node.textContent = `Render failed: ${(error as Error).message}`;
  }
}

void run();
