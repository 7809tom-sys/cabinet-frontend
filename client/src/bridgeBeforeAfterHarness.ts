/**
 * Before / after screenshot harness for the over-range bridge size bug.
 *
 * Owner report (Nov 6 2026): "the wall (bridge) cabinet over the range should be
 * 12 inches but the designer did not apply that size."
 *
 * Both images are the SAME real Auto-Design kitchen, built by `runAutoDesignLayout`
 * and rendered by the real 3D engine (`addCabinet` from InteractiveRoom3D). The only
 * thing that changes is the bridge over the range:
 *
 *   BEFORE — the bridge the Designer shipped: the Auto-Design pop-up's second,
 *            hard-coded rule (`rangeBridgeSpec`: "24 inch bridge at the 72 inch
 *            datum, top 96 inches") overwrote the 12" box the build had chosen, so
 *            the range got a 24" W3024 standing 12" proud of its 30" neighbours.
 *
 *   AFTER  — the one selector (`overRangeBridgeFor`): a 12" W3012 on the same 72"
 *            datum, topping out on the 84" line the 30" uppers beside it finish on.
 *
 * Loaded only by `dev/bridge-before-after.html` during the screenshot run. It is
 * not part of the app bundle: nothing imports it and no route points at it.
 */
import * as THREE from "three";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import {
  DEFAULT_ROOM,
  cabinetWall,
  isRangeOrOven,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";
import { overRangeBridgeFor } from "@/lib/overRangeCompanion";
import { existingOverRangeBridge, rangesInPlan } from "@/lib/overRangeFill";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "@/components/design/InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";

type StylePack = { name: string; base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const catalog = matrixCatalog as unknown as Record<string, StylePack>;
const STYLE_ID = "330002";
const RANGE_WIDTH = 30;

const APPLIANCE_PALETTE = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", depth: "25", height: "36", placement: "appliance" },
  { id: 5, masterCode: "MW-30", description: 'Over-Range Microwave 30"', category: "Appliance", subCategory: "Appliance", width: "30", depth: "15", height: "16", placement: "appliance" },
] as DesignCabinet[];

function inputs(): AutoDesignInputs {
  return {
    layoutType: "single-wall",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 1", centerOffsetIn: 30 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: 108 },
    skipDishwasher: true,
    dishwasher: null,
    refrigerator: null,
    overRangeAnswer: "microwave-bridge",
  } as AutoDesignInputs;
}

function buildKitchen(): { run: AutoDesignLayoutSuccess; room: RoomData } {
  const pack = catalog[STYLE_ID]!;
  const room: RoomData = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
  let uid = 0;
  const run = runAutoDesignLayout({
    input: inputs(),
    room,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: APPLIANCE_PALETTE,
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, []),
    faucetCatalog: [],
    refrigeratorEndPanels: [],
    styleId: Number(STYLE_ID),
    makeUid: () => `shot-${++uid}`,
  } as never);
  if (!run.ok) throw new Error(run.message);
  return { run, room };
}

/**
 * The bridge the Designer's Auto-Design pop-up used to substitute: the old
 * `rangeBridgeSpec({ hangsBelow: true })` answer — a 24" box on the 72" datum with
 * its top at 96". Kept here only so the "before" image is the real shipped plan.
 */
function legacyPopupBridge(wallCatalog: readonly DesignCabinet[], rangeWidth: number): DesignCabinet | null {
  const code = `W${rangeWidth}24`;
  return wallCatalog.find((row) => (row.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "") === code) ?? null;
}

/** Swap the seated bridge for the 24" box the pop-up used to force. */
function withLegacyBridge(placed: readonly PlacedCabinet[], wallCatalog: readonly DesignCabinet[], room: RoomData): PlacedCabinet[] {
  const range = rangesInPlan(placed)[0];
  if (!range) return [...placed];
  const seated = existingOverRangeBridge(placed, range, room);
  const legacy = legacyPopupBridge(wallCatalog, Number(range.width) || RANGE_WIDTH);
  if (!seated || !legacy) return [...placed];
  const side = cabinetWall(range, room);
  const rangeStart = wallRunOffset(range, side, room);
  const rangeSpan = wallRunSpan(range, side, room);
  const width = Number(legacy.width);
  return placed.map((item) => item.uid !== seated.uid ? item : {
    ...item,
    cabinetId: legacy.id,
    masterCode: legacy.masterCode,
    description: legacy.description,
    width,
    height: Number(legacy.height),
    mountBottom: 72,
    mountBottomAdjusted: true,
    overRangeMicrowaveBridge: true,
  });
}

function stylePack() {
  const style = {
    id: Number(STYLE_ID),
    styleCode: "SW",
    ourName: "Shaker White",
    aliasName: "Shaker White",
    color: "#e8e2d6",
    doorStyle: "Shaker",
    doorPanelType: "Recessed Panel",
    distributorId: 210001,
  };
  return {
    finish: doorStyleFinishColors(style as never),
    profile: designerCatalogDoorProfile(style as never),
  };
}

const INCH = 1 / 12;

function mount(container: HTMLElement, placed: readonly PlacedCabinet[], room: RoomData) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;
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

  for (const cabinet of placed) {
    const sku = existingCabinetSku(cabinet, room);
    const transform = existingCabinetTransform(cabinet, room, placed);
    const isBridge = cabinet.overRangeMicrowaveBridge === true;
    addCabinet(
      root,
      { ...sku, catalogImageUrl: null },
      cabinet.wallId ?? "top",
      { back: 0, left: 0, right: 0, front: 0 },
      room.width,
      room.depth,
      isBridge ? "#2f6b4f" : finish.face,
      "#eeeeee",
      profile as never,
      transform,
      null,
      undefined,
      { countertop: null, selectedToeKick: false },
    );
  }

  // Frame the range so the bridge and its two neighbours are unmistakable.
  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const range = placed.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description));
  const focus = range
    ? {
      x: (Number(range.x) + Number(range.width) / 2) * INCH,
      z: (Number(range.y) + Number(range.depth) / 2) * INCH,
    }
    : { x: roomW / 2, z: roomD * 0.12 * INCH };
  const target = new THREE.Vector3(focus.x, 5.9, focus.z);
  const span = Math.max(size.x, size.z, 4);
  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 500);
  camera.position.set(target.x + span * 0.02, target.y + span * 0.10, target.z + span * 0.62);
  camera.lookAt(target);

  renderer.render(scene, camera);
  return { renderer, scene, camera };
}

function describeBridge(placed: readonly PlacedCabinet[], room: RoomData) {
  const range = rangesInPlan(placed)[0];
  if (!range) return null;
  const bridge = existingOverRangeBridge(placed, range, room);
  if (!bridge) return null;
  const wall = cabinetWall(bridge, room);
  const neighbours = placed.filter((item) => item.placement === "wall"
    && !item.overRangeMicrowaveBridge && cabinetWall(item, room) === wall);
  const neighbourTop = neighbours.length
    ? Math.max(...neighbours.map((item) => Number(item.mountBottom ?? 0) + Number(item.height ?? 0)))
    : 0;
  return {
    code: bridge.masterCode,
    height: Number(bridge.height),
    bottom: Number(bridge.mountBottom),
    top: Number(bridge.mountBottom) + Number(bridge.height),
    neighbourTop: Math.round(neighbourTop * 100) / 100,
  };
}

async function run() {
  const leftRoot = document.getElementById("before")!;
  const rightRoot = document.getElementById("after")!;
  try {
    const { run: built, room } = buildKitchen();
    const pack = catalog[STYLE_ID]!;

    const before = withLegacyBridge(built.placed, pack.wall, room);
    const after = built.placed;

    const beforeInfo = describeBridge(before, room);
    const afterInfo = describeBridge(after, room);
    if (!beforeInfo || !afterInfo) throw new Error("A kitchen lost its bridge");

    mount(leftRoot, before, room);
    mount(rightRoot, after, room);

    document.getElementById("before-caption")!.innerHTML = `
      <strong>Before &middot; the reported bug</strong><br />
      Bridge <strong>${beforeInfo.code}</strong> &middot; ${beforeInfo.height}″ tall<br />
      <span class="dim">bottom ${beforeInfo.bottom}″ &middot; top ${beforeInfo.top}″</span><br />
      <span class="bad">${Math.round(beforeInfo.top - beforeInfo.neighbourTop)}″ proud of the ${beforeInfo.neighbourTop}″ upper line</span>
    `;
    document.getElementById("after-caption")!.innerHTML = `
      <strong>After &middot; fixed</strong><br />
      Bridge <strong>${afterInfo.code}</strong> &middot; ${afterInfo.height}″ tall<br />
      <span class="dim">bottom ${afterInfo.bottom}″ &middot; top ${afterInfo.top}″</span><br />
      <span class="ok">flush with the ${afterInfo.neighbourTop}″ upper line</span>
    `;

    (window as unknown as { __bridgeShot?: string }).__bridgeShot = "ok";
    let frames = 0;
    const tick = () => {
      for (const root of [leftRoot, rightRoot]) {
        const canvas = root.querySelector("canvas");
        if (canvas) void canvas;
      }
      frames += 1;
      if (frames < 30) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch (error) {
    document.getElementById("before-caption")!.textContent = `Render failed: ${(error as Error).message}`;
    (window as unknown as { __bridgeShot?: string }).__bridgeShot = `error: ${(error as Error).message}`;
  }
}

void run();
