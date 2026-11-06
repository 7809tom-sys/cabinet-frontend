/**
 * Screenshot harness for the wall end open shelf family (WEOS).
 *
 * Builds one real upper run — shaker wall cabinets followed by the open shelf at
 * the exposed end of the run — through the shared placement contract and the real
 * 3D engine (`existingCabinetSku` + `addCabinet`), so the capture is what the
 * Designer draws. The same placed records feed the real elevation component.
 *
 * Loaded only by `dev/open-shelf-shot.html` during the screenshot run
 * (`e2e/open-shelf-screenshot.spec.ts`). Not part of the app bundle: nothing
 * imports it and no route points at it.
 */
import * as THREE from "three";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_ROOM,
  normalizeStandardWallMounts,
  normalizeWallOpenShelfMounts,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import {
  addCabinet,
  addWallOpening,
  existingCabinetSku,
  existingCabinetTransform,
} from "@/components/design/InteractiveRoom3D";
import { ElevationView } from "@/components/design/ElevationView";
import { LanguageProvider } from "@/contexts/LanguageContext";

const INCH = 1 / 12;

const STYLE = {
  id: 330002,
  styleCode: "SW",
  ourName: "Shaker White",
  aliasName: "Shaker White",
  color: "#e8e2d6",
  doorStyle: "Shaker",
  doorPanelType: "Recessed Panel",
  distributorId: 210001,
} as const;

const query = new URLSearchParams(window.location.search);
const OPEN_SHELF_CODE = query.get("code") ?? "WEOS0930";
const SHELF_HEIGHT = Number(query.get("height") ?? OPEN_SHELF_CODE.replace(/^\D+/, "").slice(-2) ?? 30);

function wallCabinet(uid: string, x: number, width: number, height: number): PlacedCabinet {
  return {
    uid,
    cabinetId: 1,
    masterCode: `W${width}${height}`,
    description: `${width}" Wall Cabinet`,
    category: "Wall",
    subCategory: "Wall Cabinet",
    placement: "wall",
    x,
    y: 0,
    width,
    depth: 12,
    height,
    rotation: 0,
    numberOfDoors: width > 18 ? 2 : 1,
    numberOfDrawers: 0,
    wallId: "top",
    wallOffset: x,
  };
}

function openShelf(uid: string, x: number, height: number): PlacedCabinet {
  return {
    uid,
    cabinetId: 930,
    masterCode: OPEN_SHELF_CODE,
    description: "Wall End Open Shelf",
    category: "Wall",
    subCategory: "Open Shelf",
    placement: "wall",
    x,
    y: 0,
    width: 9,
    depth: 12,
    height,
    rotation: 0,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    fixedShelfCount: 2,
    wallId: "top",
    wallOffset: x,
  };
}

function buildRun(): { placed: PlacedCabinet[]; room: RoomData } {
  const room: RoomData = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 };
  // The adjacent uppers are ordinary 30-inch wall cabinets, so the shelf has to
  // prove it follows the run's finished top line whatever its own height is.
  const placed: PlacedCabinet[] = [
    wallCabinet("left-upper", 0, 30, 30),
    wallCabinet("right-upper", 30, 24, 30),
    openShelf("open-shelf", 54, SHELF_HEIGHT),
  ];
  return { placed: normalizeWallOpenShelfMounts(normalizeStandardWallMounts(placed, [], room), room), room };
}

function stylePack() {
  return {
    finish: doorStyleFinishColors(STYLE as never),
    profile: designerCatalogDoorProfile(STYLE as never),
  };
}

function mount(container: HTMLElement, placed: readonly PlacedCabinet[], room: RoomData) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = `${width}px`;
  renderer.domElement.style.height = `${height}px`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef1f4");

  const roomW = room.width * INCH;
  const roomD = room.depth * INCH;
  const ceiling = (room.ceilingHeight ?? 96) * INCH;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW * 1.6, roomD * 1.8),
    new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: "#f6f4ef", roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomW, ceiling, 4 * INCH), wallMat);
  backWall.position.set(roomW / 2, ceiling / 2, -2 * INCH);
  backWall.receiveShadow = true;
  scene.add(backWall);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(roomW * 0.55, ceiling + 4, roomD * 0.35);
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
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-roomW * 0.6, ceiling * 0.8, roomD * 1.4);
  scene.add(fill);

  const { finish, profile } = stylePack();
  const root = new THREE.Group();
  scene.add(root);

  for (const cabinet of placed) {
    const sku = existingCabinetSku(cabinet, room, placed);
    const transform = existingCabinetTransform(cabinet, room, placed);
    addCabinet(
      root,
      { ...sku, catalogImageUrl: null },
      cabinet.wallId ?? "top",
      { back: 0, left: 0, right: 0, front: 0 },
      room.width,
      room.depth,
      finish.face,
      "#eeeeee",
      profile as never,
      transform,
      null,
      undefined,
      { countertop: null, selectedToeKick: false },
    );
  }

  // A window immediately past the open end of the run, as in the report.
  addWallOpening(root, {
    uid: "window-past-run",
    kind: "window",
    side: "top",
    offset: 66,
    width: 36,
    height: 42,
    sill: 42,
  } as never, room);

  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const closeUp = query.get("closeup") === "1";
  const shelfY = (54 + SHELF_HEIGHT / 2) * INCH;
  let target = new THREE.Vector3(center.x - size.x * 0.18, shelfY, 0);
  let offset = new THREE.Vector3(4.6, 1.5, 7.4);
  if (closeUp) {
    // Frame the shelf cabinet's own bounds from the same three-quarter angle, so
    // the radiused shelf fronts and the finished interior are both readable.
    const shelfNode = root.children.find((node) => node.userData?.masterCode === OPEN_SHELF_CODE);
    const shelfBounds = new THREE.Box3().setFromObject(shelfNode ?? root);
    shelfBounds.getCenter(target);
    const shelfSize = new THREE.Vector3();
    shelfBounds.getSize(shelfSize);
    const radius = Math.max(shelfSize.x, shelfSize.y, shelfSize.z) * 1.35;
    offset = new THREE.Vector3(radius * 0.62, radius * 0.10, radius * 1.0);
  }
  const camera = new THREE.PerspectiveCamera(34, width / height, 0.05, 500);
  camera.position.set(target.x + offset.x, target.y + offset.y, target.z + offset.z);
  camera.lookAt(target);

  renderer.render(scene, camera);
  return { renderer, scene, camera };
}

function run() {
  const caption = document.getElementById("caption")!;
  const root = document.getElementById("root")!;
  const flag = (state: string) => { (window as unknown as { __openShelfShot?: string }).__openShelfShot = state; };
  try {
    const { placed, room } = buildRun();
    const shelf = placed.find((item) => item.masterCode === OPEN_SHELF_CODE)!;
    const view = mount(root, placed, room);
    const skuHand = existingCabinetSku(shelf, room, placed).openShelfExposedHand;
    const meshFacts = (() => {
      let shell = 0;
      let shelves = 0;
      let fronts = 0;
      let faceFrames = 0;
      let outlines = 0;
      const sceneRoot = view.scene.children.find((node): node is THREE.Group => node instanceof THREE.Group);
      const shelfObj: THREE.Object3D | null = sceneRoot?.children.find((node) => node.userData?.masterCode === OPEN_SHELF_CODE) ?? null;
      const parts: string[] = [];
      const allMeshes: string[] = [];
      shelfObj?.traverse((node) => {
        if (node.userData?.wallOpenShelfPart) {
          shell += 1;
          parts.push(String(node.userData.wallOpenShelfPart));
        }
        if (node.userData?.wallOpenShelfFixedShelf) shelves += 1;
        if (node.userData?.cabinetFront) fronts += 1;
        if (node.userData?.cabinetFaceFrame) faceFrames += 1;
        if ((node as THREE.LineSegments).isLineSegments) outlines += 1;
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          const geo = mesh.geometry as THREE.BoxGeometry;
          const w = Number(geo?.parameters?.width ?? 0) * 12;
          const h = Number(geo?.parameters?.height ?? 0) * 12;
          const d = Number(geo?.parameters?.depth ?? 0) * 12;
          const key = Object.entries(mesh.userData ?? {})
            .filter(([, v]) => v === true)
            .map(([k]) => k)
            .join(",");
          allMeshes.push(`${mesh.geometry.type}@${w.toFixed(1)}x${h.toFixed(1)}x${d.toFixed(1)}[${key}]`);
        }
      });
      return { shell, shelves, fronts, faceFrames, outlines, parts, allMeshes };
    })();

    const elevationMarkup = renderToStaticMarkup(createElement(
      LanguageProvider,
      null,
      createElement(ElevationView, {
        room,
        cabinets: placed,
        selectedUid: null,
        onSelect: () => {},
        wall: "back",
        onSelectWall: () => {},
        finish: { face: "#e8dfcf", edge: "#796f61", label: "#302c27" },
        panelKind: "shaker",
      } as never),
    ));

    const factsHtml = `
      <strong>${OPEN_SHELF_CODE} &middot; ${Number(shelf.width)}&Prime; W &times; ${Number(shelf.height)}&Prime; H &times; ${Number(shelf.depth)}&Prime; D</strong><br />
      <span class="dim">bottom ${shelf.mountBottom}&Prime; &middot; top ${Number(shelf.mountBottom) + Number(shelf.height)}&Prime; &middot; doors ${shelf.numberOfDoors} &middot; drawers ${shelf.numberOfDrawers} &middot; fixed shelves ${shelf.fixedShelfCount}</span><br />
      <span class="dim">shell parts ${meshFacts.shell} &middot; fixed shelves ${meshFacts.shelves} &middot; cabinet fronts ${meshFacts.fronts} &middot; face frames ${meshFacts.faceFrames} &middot; outlines ${meshFacts.outlines}</span><br />
      <span class="dim">parts: ${meshFacts.parts.join(", ")}</span><br />
      <span class="dim">exposed hand: ${String(skuHand)}</span><br />
      <span class="dim">all meshes: ${meshFacts.allMeshes.join(" | ")}</span>
    `;
    caption.innerHTML = factsHtml;
    const pane = document.createElement("pre");
    pane.id = "elevation-markup";
    pane.style.cssText = "position:absolute;left:-9999px;top:0";
    pane.textContent = elevationMarkup;
    document.body.appendChild(pane);
    flag("ok");
    let frames = 0;
    const tick = () => {
      view.renderer.render(view.scene, view.camera);
      frames += 1;
      if (frames < 30) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch (error) {
    caption.textContent = `Render failed: ${(error as Error).message}`;
    flag(`error: ${(error as Error).message}`);
  }
}

void createRoot(document.createElement("div"));
run();
