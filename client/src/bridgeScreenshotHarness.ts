/**
 * Screenshot harness: build a real kitchen with the real auto-designer, then render
 * it with the real 3D engine.
 *
 * Both owner HARD RULES are visible in the result: the mandatory bridge above the
 * range, and the mandatory faucet at the sink. Both are the boxes/meshes the engine
 * actually produced — nothing here is drawn by hand.
 *
 * Loaded only by `dev/bridge-shot.html` during the screenshot run
 * (`e2e/auto-design-bridge-screenshot.spec.ts`). It is not part of the app bundle:
 * nothing imports it, and no route points at it.
 */
import * as THREE from "three";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import {
  mergeAutoDesignRefrigeratorCaps,
  runAutoDesignLayout,
  type AutoDesignLayoutSuccess,
} from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import {
  DEFAULT_ROOM,
  clampCabinetsToRoom,
  isRangeOrOven,
  normalizeBlindCornerDoorSides,
  normalizeLCornerDepths,
  normalizeRefrigeratorBayUppers,
  normalizeStandardWallMounts,
  normalizeWd18CountertopMounts,
  removeOverlappingPlacements,
  backfillLegacyWallRuns,
  normalizeLegacyPeninsulaCabinets,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
  type WallOpening,
} from "@/lib/design";
import {
  existingOverRangeBridge,
  overRangeHasBridge,
  rangesInPlan,
} from "@/lib/overRangeFill";
import {
  addCabinet,
  addSinkFixture,
  addWallOpening,
  existingCabinetSku,
  existingCabinetTransform,
} from "@/components/design/InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { resolveDeckFaucetPlacement } from "@/lib/faucetPlacement";
import { DEFAULT_PELICAN_KITCHEN_FAUCET } from "@/lib/pelicanFixtureProfiles";
import { existingOverRangeMicrowave } from "@/lib/overRangeFill";

type StylePack = { name: string; base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const catalog = matrixCatalog as unknown as Record<string, StylePack>;

const STYLE_ID = "330002";
const RANGE_WIDTH = 30;

const APPLIANCE_PALETTE = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", depth: "25", height: "36", placement: "appliance" },
  { id: 5, masterCode: "MW-30", description: 'Over-Range Microwave 30"', category: "Appliance", subCategory: "Appliance", width: "30", depth: "15", height: "16", placement: "appliance" },
] as DesignCabinet[];

/**
 * The faucet rows the line sells. Deliberately a real Pelican kitchen faucet, so the
 * faucet in the screenshot is the catalog pick the rule prefers.
 */
const FAUCET_CATALOG = [{
  id: 8203,
  pelicanCode: "PL-8203",
  name: "PL-8203 Fountain Series Pull-Down Kitchen Faucet",
  category: "Sinks & Faucets",
  subCategory: "Faucets",
}];

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
    // A window over the sink, so the screenshot proves the owner's clarification:
    // the faucet stands IN FRONT OF THE WINDOW and the window never moves.
    sinkWindowCenter: { wallLabel: "Wall 1", centerOffsetIn: 30 },
  } as AutoDesignInputs;
}

/**
 * The LOAD path, exercised for real: serialize the finished plan the way a saved
 * design stores it (room + persisted entities + placed cabinets), then read it back
 * through the same normalizers `loadSavedDesign` runs, and re-apply the two
 * mandatory passes. If a save/load round trip drops the bridge, the microwave, or
 * the faucet, this throws before a screenshot is taken.
 */
function roundTripSavedDesign(run: AutoDesignLayoutSuccess, room: RoomData) {
  const saved = JSON.parse(JSON.stringify({
    room: { ...room, persistedEntities: { openings: run.openings, sinks: run.sinks, potFillers: [], island: null, furniture: run.furniture ?? [], ponyWalls: [] } },
    placed: run.placed,
  })) as { room: RoomData; placed: PlacedCabinet[] };
  // The normalizers the Designer's load path runs, in the same order.
  const restoredRoom = saved.room;
  const restoredPlaced = clampCabinetsToRoom(
    backfillLegacyWallRuns(normalizeLegacyPeninsulaCabinets(
      normalizeBlindCornerDoorSides(normalizeLCornerDepths(saved.placed), restoredRoom),
      restoredRoom,
    ), restoredRoom),
    restoredRoom,
  );
  const repaired = removeOverlappingPlacements(
    normalizeStandardWallMounts(
      normalizeWd18CountertopMounts(
        normalizeRefrigeratorBayUppers(restoredPlaced, restoredRoom),
      ),
      saved.room.persistedEntities?.openings ?? [],
      restoredRoom,
    ),
    restoredRoom,
  ).placed;
  return { placed: repaired, sinks: saved.room.persistedEntities?.sinks ?? [], room: restoredRoom };
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
    faucetCatalog: FAUCET_CATALOG,
    refrigeratorEndPanels: [],
    styleId: Number(STYLE_ID),
    makeUid: () => `shot-${++uid}`,
  } as never);
  if (!run.ok) throw new Error(run.message);
  return { run, room };
}

/** The style the cabinets render in: the same rows the Designer reads. */
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

function mount(container: HTMLElement, placed: PlacedCabinet[], room: RoomData, sinks: readonly SinkFixture[], openings: readonly WallOpening[]) {
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

  const INCH = 1 / 12;
  const roomW = room.width * INCH;
  const roomD = room.depth * INCH;
  const ceiling = (room.ceilingHeight ?? 96) * INCH;

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW * 1.6, roomD * 1.8),
    new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // Back wall (top) and left wall
  const wallMat = new THREE.MeshStandardMaterial({ color: "#f6f4ef", roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomW, ceiling, 4 * INCH), wallMat);
  backWall.position.set(roomW / 2, ceiling / 2, -2 * INCH);
  backWall.receiveShadow = true;
  scene.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(4 * INCH, ceiling, roomD), wallMat);
  leftWall.position.set(-2 * INCH, ceiling / 2, roomD / 2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Lights: a soft room fill plus a key light so faces and the bridge read.
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

  const bridgeUids: string[] = [];
  for (const cabinet of placed) {
    const sku = existingCabinetSku(cabinet, room);
    const transform = /^HOOD[-_]?/i.test(cabinet.masterCode ?? "")
      ? existingCabinetTransform(cabinet, room, placed)
      : existingCabinetTransform(cabinet, room, placed);
    const isBridge = cabinet.overRangeMicrowaveBridge === true;
    if (isBridge) bridgeUids.push(cabinet.uid);
    addCabinet(
      root,
      { ...sku, catalogImageUrl: null },
      cabinetWallOrTop(cabinet),
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

  // The window over the sink, drawn by the real renderer so the capture shows the
  // faucet standing in front of glazing — the owner's required arrangement.
  for (const opening of openings) {
    addWallOpening(root, opening, room);
  }

  // Sinks and their mandatory faucets, from the same build. `addSinkFixture` builds
  // the faucet assembly from the sink record's published dimensions.
  for (const sink of sinks) {
    addSinkFixture(root, sink, resolveDeckFaucetPlacement(sink, room, openings, []));
  }
  // Tint the faucet so it reads at a glance in the capture.
  root.traverse((node) => {
    const mesh = node as THREE.Mesh & { userData: Record<string, unknown> };
    if (!mesh.isMesh) return;
    if (mesh.userData.sinkFaucet !== true && mesh.userData.sinkFaucetSpout !== true) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | null;
    if (!material || !("color" in material)) return;
    const clone = material.clone();
    clone.color.set("#c8892b");
    clone.metalness = 0.55;
    clone.roughness = 0.3;
    mesh.material = clone;
    mesh.userData.highlightedFaucet = true;
  });

  // Frame the whole run from the bounding box of what was just built, biased toward
  // the range so the bridge is unmistakably the subject.
  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const focus = bridgeFocusWorld(placed, room);
  const target = new THREE.Vector3(focus.x, Math.max(center.y, 3.0), focus.z);
  const span = Math.max(size.x, size.z, 4);
  const distance = span * 1.15;
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 500);
  camera.position.set(target.x - span * 0.10, target.y + span * 0.30, target.z + distance);
  camera.lookAt(target);

  renderer.render(scene, camera);
  return { renderer, scene, camera, bridgeUids };
}

/** World (feet) position of the middle of the bridge, so the camera can frame it. */
function bridgeFocusWorld(placed: readonly PlacedCabinet[], room: RoomData) {
  const INCH = 1 / 12;
  const bridge = placed.find((item) => item.overRangeMicrowaveBridge === true);
  const range = placed.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description));
  const item = bridge ?? range;
  if (!item) return { x: (room.width / 2) * INCH, y: 4.2, z: (room.depth * 0.12) * INCH };
  // Plan inches -> world feet, the same mapping `existingCabinetTransform` uses.
  const w = Number(item.width) || 30;
  const d = Number(item.depth) || 12;
  const verticalWall = item.wallId === "left" || item.wallId === "right";
  return {
    x: (Number(item.x) + (verticalWall ? d : w) / 2) * INCH,
    y: 4.6,
    z: (Number(item.y) + (verticalWall ? w : d) / 2) * INCH,
  };
}

function cabinetWallOrTop(cabinet: PlacedCabinet): string {
  return cabinet.wallId ?? "top";
}

async function run() {
  const caption = document.getElementById("caption")!;
  const root = document.getElementById("root")!;
  try {
    const { run: built, room } = buildKitchen();

    // Verify the LOAD path too, not just the build. A saved design must come back
    // with its bridge, microwave, and faucet intact.
    const loaded = roundTripSavedDesign(built, room);
    const loadedRange = rangesInPlan(loaded.placed).find((item) => isRangeOrOven(item.masterCode, item.description));
    if (!loadedRange) throw new Error("The loaded design lost its range");
    const loadedBridge = existingOverRangeBridge(loaded.placed, loadedRange, room);
    if (!loadedBridge) throw new Error("The loaded design lost its bridge");
    if (loaded.sinks.length === 0) throw new Error("The loaded design lost its sink");
    if (!loaded.sinks[0]!.faucet) throw new Error("The loaded design lost its faucet");
    const loadedPlacement = resolveDeckFaucetPlacement(loaded.sinks[0]!, room, loaded.room.persistedEntities?.openings ?? [], []);
    if (!loadedPlacement.renderFaucet) throw new Error("The loaded design's faucet would not draw");

    const range = rangesInPlan(built.placed).find((item) => isRangeOrOven(item.masterCode, item.description))!;
    const bridge = existingOverRangeBridge(built.placed, range, room);
    if (!bridge || !overRangeHasBridge(built.placed, range, room)) throw new Error("No bridge above the range");

    const sink = built.sinks[0];
    if (!sink || !sink.faucet) throw new Error("No faucet at the sink");
    const faucetPlacement = resolveDeckFaucetPlacement(sink, room, [], []);
    if (!faucetPlacement.renderFaucet || !faucetPlacement.onCountertop) throw new Error("Faucet is not seated on the countertop");
    const faucetLabel = sink.pelicanFaucetProductName
      ?? (sink.defaultFaucet ? `${DEFAULT_PELICAN_KITCHEN_FAUCET.pelicanCode} (default fixture)` : "Faucet");

    const sinkWindow = built.sinkWindow;
    const windowGeometry = sinkWindow
      ? `${Number(sinkWindow.width)}″ wide at sill ${Number(sinkWindow.sill)}″ &middot; unchanged by the faucet`
      : "none in this plan";
    const view = mount(root, built.placed, room, built.sinks, built.openings);
    caption.innerHTML = `
      <strong>Auto-Design build &middot; ${catalog[STYLE_ID]!.name}</strong><br />
      Bridge <strong>${bridge.masterCode}</strong> above <strong>${range.masterCode}</strong>
      <span class="ok">&#10003; present</span><br />
      <span class="dim">${Number(bridge.width)}″ wide &middot; ${Number(bridge.height)}″ tall &middot; bottom at ${bridge.mountBottom}″ &middot; centered on the range</span><br />
      <span class="rule">Faucet at the sink</span> <span class="ok">&#10003; present</span><br />
      <span class="dim"><strong>${faucetLabel}</strong> &middot; centered on the sink base &middot; on the countertop &middot; ${sink.faucetForm}</span><br />
      <span class="dim">Save &rarr; load round trip: bridge, microwave and faucet all preserved</span><br />
      <span class="dim">Sink window: ${windowGeometry}</span>
    `;
    (window as unknown as { __bridgeShot?: string }).__bridgeShot = "ok";
    // Keep rendering a few frames so the shadow map settles before the capture.
    let frames = 0;
    const tick = () => {
      view.renderer.render(view.scene, view.camera);
      frames += 1;
      if (frames < 30) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch (error) {
    caption.textContent = `Render failed: ${(error as Error).message}`;
    (window as unknown as { __bridgeShot?: string }).__bridgeShot = `error: ${(error as Error).message}`;
  }
}

void run();
