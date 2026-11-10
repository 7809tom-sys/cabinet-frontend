/**
 * Screenshot harness for issue #354 — a frameless range base with its range top.
 *
 * ONE cabinet, rendered by the real 3D engine (`existingCabinetSku` +
 * `existingCabinetTransform` + `addCabinet` + `addThreeDStandardCountertops`
 * from InteractiveRoom3D), exactly the way the Designer draws a sink base:
 *
 *   the box      the frameless `RB3DB24` range base (two drawers with one
 *                false front), labelled with its designer-facing name
 *   the top      the shared countertop slab over the box
 *   the top      the `countertop-opening` range top set INTO that surface, drawn
 *                by the engine's built-in cooktop branch (surface + burners)
 *
 * There is NO freestanding range anywhere in this scene: the cooking surface is
 * the range top seated in the cabinet's top, the same relationship a sink
 * basin has to its sink base.
 *
 * Loaded only by `dev/issue354-shot.html` during the screenshot run
 * (`e2e/issue354-before-after.spec.ts`). Not part of the app bundle.
 */
import * as THREE from "three";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import {
  DEFAULT_ROOM,
  STD,
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";
import { designerCabinetName } from "@/lib/designerCabinetNames";
import {
  addCabinet,
  addThreeDStandardCountertops,
  existingCabinetSku,
  existingCabinetTransform,
} from "@/components/design/InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";

const INCH = 1 / 12;

const STYLE = {
  id: 540005,
  styleCode: "TDW",
  ourName: "Torino TDW",
  aliasName: "Torino TDW",
  color: "#b8916a",
  doorStyle: "Slab",
  doorPanelType: "Slab",
  distributorId: 210001,
} as const;

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 };
const CABINET_WIDTH_IN = 30;
const CABINET_OFFSET_IN = 24;

/** The frameless range base, at the width the render uses. */
function rangeBaseRow(): DesignCabinet {
  return {
    id: 2030,
    masterCode: `RB3DB${CABINET_WIDTH_IN}`,
    description: `${CABINET_WIDTH_IN}" W × 34.75" H × 24" D Two Drawer Base with One False Front for a range top`,
    category: "Base",
    subCategory: null,
    width: String(CABINET_WIDTH_IN),
    height: "34.75",
    depth: "24",
    placement: "base",
    numberOfDoors: 0,
    numberOfDrawers: 2,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  } as DesignCabinet;
}

/** The base box, seated on the wall like any other base cabinet. */
function rangeBaseCabinet(): PlacedCabinet {
  const row = rangeBaseRow();
  const spot = wallPlacementAt(CABINET_OFFSET_IN, CABINET_WIDTH_IN, 24, "top", ROOM);
  return {
    uid: "range-base",
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: "Base",
    subCategory: null,
    placement: "base",
    ...spot,
    width: CABINET_WIDTH_IN,
    depth: 24,
    height: 34.75,
    numberOfDoors: 0,
    numberOfDrawers: 2,
    styleId: STYLE.id,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  };
}

/**
 * The range top, seated in the base's own countertop exactly as the frameless
 * range-top conversion seats it: a `countertop-opening` appliance on the base uid,
 * its top meeting the finished 36" countertop line.
 */
function rangeTopOn(base: PlacedCabinet): PlacedCabinet {
  return {
    uid: `${base.uid}:cooktop`,
    cabinetId: 0,
    masterCode: "CATALOG-APPLIANCE-gas",
    description: 'Gas range top 30"',
    category: "Appliance",
    subCategory: "Cooktop",
    placement: "appliance",
    applianceRole: "countertop-opening",
    applianceProductId: 30001,
    applianceCatalogCode: "CATALOG-APPLIANCE-gas",
    applianceCatalogName: 'Gas range top 30"',
    x: base.x,
    y: base.y,
    rotation: base.rotation,
    wallId: base.wallId,
    wallOffset: base.wallOffset,
    width: base.width,
    depth: base.depth,
    height: STD.COUNTERTOP_THICKNESS,
    mountBottom: STD.COUNTERTOP_HEIGHT - STD.COUNTERTOP_THICKNESS,
    rangeTopFinish: null,
  };
}

function stylePack() {
  return {
    finish: doorStyleFinishColors(STYLE as never),
    profile: designerCatalogDoorProfile(STYLE as never),
  };
}

function makeRenderer(width: number, height: number) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

function buildScene(placed: PlacedCabinet[], width: number, height: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef1f4");
  const roomW = ROOM.width * INCH;
  const roomD = ROOM.depth * INCH;
  const ceiling = (ROOM.ceilingHeight ?? 96) * INCH;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW * 1.6, roomD * 1.8),
    new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  floor.receiveShadow = false;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: "#f6f4ef", roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomW, ceiling, 4 * INCH), wallMat);
  backWall.position.set(roomW / 2, ceiling / 2, -2 * INCH);
  backWall.receiveShadow = false;
  scene.add(backWall);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(roomW * 0.55, ceiling + 4, roomD * 0.35);
  key.castShadow = false;
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

  // 1. The cabinet box, exactly as the Designer draws it.
  for (const cabinet of placed) {
    if (cabinet.placement === "appliance") continue;
    const sku = existingCabinetSku(cabinet, ROOM, placed);
    const transform = existingCabinetTransform(cabinet, ROOM, placed);
    addCabinet(
      root,
      { ...sku, catalogImageUrl: null },
      cabinet.wallId ?? "top",
      { back: 0, left: 0, right: 0, front: 0 },
      ROOM.width,
      ROOM.depth,
      finish.face,
      "#eeeeee",
      profile as never,
      transform,
      null,
      undefined,
      { countertop: null, selectedToeKick: false },
    );
  }

  // 2. The shared countertop slab over the box — the same call the Designer
  //    makes, so a sink base and this range base finish their tops identically.
  addThreeDStandardCountertops(root, ROOM, placed, "#eeeae2", null);

  // 3. The range top, set into that top by the engine's own
  //    countertop-opening branch (glass surface, burners, no range chassis).
  for (const cabinet of placed) {
    if (cabinet.placement !== "appliance") continue;
    const sku = existingCabinetSku(cabinet, ROOM, placed);
    const transform = existingCabinetTransform(cabinet, ROOM, placed);
    addCabinet(
      root,
      { ...sku, catalogImageUrl: null },
      cabinet.wallId ?? "top",
      { back: 0, left: 0, right: 0, front: 0 },
      ROOM.width,
      ROOM.depth,
      finish.face,
      "#eeeeee",
      profile as never,
      transform,
      null,
      undefined,
      { countertop: null, selectedToeKick: false },
    );
  }

  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  // A three-quarter view from above the countertop, framed on the one cabinet.
  const camera = new THREE.PerspectiveCamera(33, width / height, 0.05, 500);
  const target = new THREE.Vector3(center.x, 2.0, center.z);
  const offset = new THREE.Vector3(2.5, 2.5, 5.6);
  camera.position.set(target.x + offset.x, target.y + offset.y, target.z + offset.z);
  camera.lookAt(target);
  return { scene, camera };
}

function facts(placed: readonly PlacedCabinet[]) {
  const base = placed.find((item) => item.placement === "base")!;
  const rangeTop = placed.find((item) => item.placement === "appliance")!;
  const baseTop = Number(base.mountBottom ?? 0) + Number(base.height ?? 0);
  const rangeTopTop = Number(rangeTop.mountBottom ?? 0) + Number(rangeTop.height ?? 0);
  return {
    name: designerCabinetName(base),
    code: base.masterCode,
    width: Number(base.width),
    baseTop,
    rangeTopTop,
    rangeTopName: rangeTop.applianceCatalogName ?? rangeTop.description,
  };
}

function run() {
  const flag = (state: string) => { (window as unknown as { __issue354Shot?: string }).__issue354Shot = state; };
  try {
    const host = document.getElementById("root")!;
    const base = rangeBaseCabinet();
    const placed = [base, rangeTopOn(base)];

    const width = window.innerWidth;
    const height = window.innerHeight;
    const renderer = makeRenderer(width, height);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = `${width}px`;
    renderer.domElement.style.height = `${height}px`;

    const { scene, camera } = buildScene(placed, width, height);
    renderer.render(scene, camera);

    const f = facts(placed);
    const caption = document.getElementById("caption")!;
    caption.id = "after-caption";
    caption.innerHTML = [
      `<strong style="color:#047857">${f.code} &middot; ${f.name}</strong>`,
      `${f.width}&Prime; W &times; 34.75&Prime; H &times; 24&Prime; D`,
      `countertop ${STD.COUNTERTOP_HEIGHT}&Prime; &middot; ${f.rangeTopName} installed in it`,
      `no freestanding range`,
    ].join("<br />");

    let frames = 0;
    const tick = () => {
      renderer.render(scene, camera);
      frames += 1;
      if (frames < 30) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    flag("ok");
  } catch (error) {
    document.getElementById("root")!.textContent = `Render failed: ${(error as Error).message}`;
    flag(`error: ${(error as Error).message}`);
  }
}

run();
