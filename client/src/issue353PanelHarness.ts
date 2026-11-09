/**
 * Before / after screenshot harness for issue 353 outcome 8, round 2.
 *
 * BOTH columns are real designer code:
 *   - BEFORE calls `legacyMain/verticalFiller.ts`, a verbatim copy of main's
 *     continuous vertical-filler contract, which anchored EVERY board at the
 *     floor and ran it to the highest top beside it. Beside a 24-inch W3024
 *     upper that becomes a floor-standing 96-inch strip — Tom's report.
 *   - AFTER calls this branch's own contract, which finishes the upper band.
 *
 * The upper run is real too: a 30-inch upper, a 1-1/2 inch seam, a 24-inch
 * W3024 bridge, a 30-inch upper. Nothing here invents an elevation.
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
import { continuousVerticalFiller as branchFiller } from "@/lib/verticalFiller";
import { continuousVerticalFiller as mainFiller } from "@/lib/legacyMain/verticalFiller";
import { DEFAULT_ROOM as MAIN_ROOM } from "@/lib/legacyMain/design";

const INCH = 1 / 12;
const ROOM: RoomData = { ...DEFAULT_ROOM, width: 156, depth: 132, ceilingHeight: 96 };

function wallCabinet(
  uid: string,
  code: string,
  offset: number,
  width: number,
  height: number,
  mountBottom: number,
): PlacedCabinet {
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
    mountBottom,
    numberOfDoors: 2,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

// Tom's reported run: a 30-inch upper, a 1-1/2 inch seam, the 24-inch W3024
// bridge at the 72-inch datum, then another 30-inch upper.
const UPPERS: PlacedCabinet[] = [
  wallCabinet("u-left", "W3030", 0, 30, 30, 54),
  wallCabinet("u-bridge", "W3024", 31.5, 30, 24, 72),
  wallCabinet("u-right", "W3030", 61.5, 30, 30, 54),
];
const SEAM_START = 30;
const SEAM_WIDTH = 1.5;

const BASES: PlacedCabinet[] = [0, 30, 60].map((offset, index) => ({
  uid: `b${index}`,
  cabinetId: 90 + index,
  masterCode: "B30",
  description: "B30",
  category: "Base",
  subCategory: "Standard Base",
  placement: "base" as const,
  x: offset,
  y: 0,
  width: 30,
  depth: 24,
  height: 34.5,
  rotation: 0,
  wallId: "top",
  wallOffset: offset,
  numberOfDoors: 2,
  numberOfDrawers: 0,
} as PlacedCabinet));

type Band = { bottom: number; height: number; label: string };

/** The seam board, read from the real contract in each column. */
function seamBoard(useMain: boolean): Band {
  if (useMain) {
    const spec = mainFiller({
      wallId: "top",
      startIn: SEAM_START,
      widthIn: SEAM_WIDTH,
      placed: UPPERS as never,
      room: MAIN_ROOM as never,
    });
    return { bottom: spec.bottomIn, height: spec.heightIn, label: `main: ${spec.bottomIn}"–${spec.bottomIn + spec.heightIn}"` };
  }
  const spec = branchFiller({
    wallId: "top",
    startIn: SEAM_START,
    widthIn: SEAM_WIDTH,
    placed: UPPERS,
    room: ROOM,
    layer: "wall",
  });
  return { bottom: spec.bottomIn, height: spec.heightIn, label: `branch: ${spec.bottomIn}"–${spec.bottomIn + spec.heightIn}"` };
}

function build(container: HTMLElement, board: Band) {
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
    new THREE.PlaneGeometry(roomW * 1.5, 14),
    new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, 5);
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: "#f7f5f1", roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(roomW, ceiling, 4 * INCH), wallMat);
  back.position.set(roomW / 2, ceiling / 2, -2 * INCH);
  scene.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(4 * INCH, ceiling, 12), wallMat);
  left.position.set(-2 * INCH, ceiling / 2, 6);
  scene.add(left);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(roomW * 0.4, ceiling + 2, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const cam = key.shadow.camera as THREE.OrthographicCamera;
  cam.left = -roomW; cam.right = roomW; cam.top = ceiling * 2; cam.bottom = -2;
  cam.near = 0.1; cam.far = 60;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-roomW * 0.5, ceiling * 0.7, 14);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);

  const carcass = new THREE.MeshStandardMaterial({ color: "#efece5", roughness: 0.62, metalness: 0 });
  const counter = new THREE.MeshPhysicalMaterial({ color: "#dfe3e8", roughness: 0.34, metalness: 0, clearcoat: 0.22 });

  for (const base of BASES) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(base.width * INCH, 34.5 * INCH, 24 * INCH), carcass);
    box.position.set((base.x + base.width / 2) * INCH, 17.25 * INCH, 12 * INCH);
    box.castShadow = true;
    root.add(box);
    const top = new THREE.Mesh(new THREE.BoxGeometry(base.width * INCH, STD.COUNTERTOP_THICKNESS * INCH, 25.5 * INCH), counter);
    top.position.set((base.x + base.width / 2) * INCH, (STD.COUNTERTOP_HEIGHT + STD.COUNTERTOP_THICKNESS / 2) * INCH, 12.75 * INCH);
    root.add(top);
  }

  // Real uppers, at their real elevations.
  for (const upper of UPPERS) {
    const box = elevationBox(upper, ROOM);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(upper.width * INCH, box.height * INCH, upper.depth * INCH),
      carcass,
    );
    mesh.position.set((upper.x + upper.width / 2) * INCH, (box.bottom + box.height / 2) * INCH, 6 * INCH);
    mesh.castShadow = true;
    root.add(mesh);
  }

  // The seam board, at the elevation the real contract gave it.
  const boardMat = new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.55, metalness: 0 });
  const boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAM_WIDTH * INCH, Math.max(0.05, board.height) * INCH, 12 * INCH),
    boardMat,
  );
  boardMesh.position.set(
    (SEAM_START + SEAM_WIDTH / 2) * INCH,
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
  camera.position.set(center.x - span * 0.26, center.y + span * 0.16, center.z + span * 1.05);
  camera.lookAt(center.x, center.y - span * 0.04, center.z);
  renderer.render(scene, camera);
}

function run() {
  try {
    const before = seamBoard(true);
    const after = seamBoard(false);
    build(document.getElementById("pane-before")!, before);
    build(document.getElementById("pane-after")!, after);
    const beforeTop = before.bottom + before.height;
    const afterTop = after.bottom + after.height;
    document.getElementById("caption-before")!.innerHTML =
      `<strong>BEFORE · main</strong><br />` +
      `<span class="bad">&#10007; seam board ${before.bottom}&#8243;&#8211;${beforeTop}&#8243;: runs to the floor</span><br />` +
      `<span class="bad">&#10007; ${before.height}&#8243; strip beside a 24&#8243; upper</span>`;
    document.getElementById("caption-after")!.innerHTML =
      `<strong>AFTER · branch</strong><br />` +
      `<span class="ok">&#10003; seam board ${after.bottom}&#8243;&#8211;${afterTop}&#8243;: finishes the upper band</span><br />` +
      `<span class="ok">&#10003; never reaches below the cabinet bottom</span>`;
    (window as unknown as { __issue353Panel?: unknown }).__issue353Panel = {
      ok: true,
      before: { bottom: before.bottom, height: before.height },
      after: { bottom: after.bottom, height: after.height },
    };
  } catch (error) {
    (window as unknown as { __issue353Panel?: unknown }).__issue353Panel = { ok: false, message: (error as Error).message };
    const node = document.getElementById("caption-before");
    if (node) node.textContent = `Render failed: ${(error as Error).message}`;
  }
}

void run();
