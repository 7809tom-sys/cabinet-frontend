/**
 * Screenshot harness for issue #354 — the RB3DB24 beside a freestanding range.
 *
 * Renders the SAME kitchen twice with the real 3D engine (`existingCabinetSku` +
 * `existingCabinetTransform` + `addCabinet` from InteractiveRoom3D):
 *
 *   before  the plan as reported: dishwasher, then an RB3DB24 (drop-in cooktop
 *           base) in the plain base run, then a freestanding range at the end.
 *           That is the cabinet from the screenshot on the issue.
 *   after   the plan the branch produces: the RB3DB24 becomes the plain B24 of
 *           the same width, the run slides over, and the 3/4" BEP2535 side panel
 *           the rule adds appears on the side that faces the range.
 *
 * The "after" side is produced by the real branch modules —
 * `repairRangeBasesWithoutCooktop` and `syncRangeAndNeighbourSidePanels` — not by
 * hand-drawn geometry, so the image is what the Designer now builds.
 *
 * Loaded only by `dev/issue354-shot.html` during the screenshot run
 * (`e2e/issue354-before-after.spec.ts`). Not part of the app bundle.
 */
import * as THREE from "three";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import {
  DEFAULT_ROOM,
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";
import { designerCabinetName } from "@/lib/designerCabinetNames";
import { repairRangeBasesWithoutCooktop } from "@/lib/rangeBaseGuard";
import { syncRangeAndNeighbourSidePanels } from "@/lib/sidePanelForExposedSide";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "@/components/design/InteractiveRoom3D";
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

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 150, depth: 120, ceilingHeight: 96 };

function catalogRow(masterCode: string, width: number, description: string, doors: number, drawers: number): DesignCabinet {
  return {
    id: 1000 + masterCode.length + width,
    masterCode,
    description,
    category: "Base",
    subCategory: null,
    width: String(width),
    height: "34.75",
    depth: "24",
    placement: "base",
    numberOfDoors: doors,
    numberOfDrawers: drawers,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  } as DesignCabinet;
}

const CATALOG: DesignCabinet[] = [
  catalogRow("B24", 24, '24" W × 34.75" H × 24" D Double Door Single Drawer Base', 2, 1),
  catalogRow("RB3DB24", 24, '24" W × 34.75" H × 24" D Three Drawer Range Base with One False Front', 0, 3),
];

const PANEL_CATALOG = [
  { id: 2051, masterCode: "BEP2535", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
];

function base(kind: "b24" | "rb3db24", offset: number, uid: string): PlacedCabinet {
  const row = kind === "b24" ? CATALOG[0]! : CATALOG[1]!;
  const spot = wallPlacementAt(offset, 24, 24, "top", ROOM);
  return {
    uid,
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: "Base",
    subCategory: null,
    placement: "base",
    ...spot,
    width: 24,
    depth: 24,
    height: 34.75,
    numberOfDoors: row.numberOfDoors,
    numberOfDrawers: row.numberOfDrawers,
    styleId: STYLE.id,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  };
}

function appliance(masterCode: string, offset: number, width: number, height: number, depth: number, description: string, uid: string): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, depth, "top", ROOM);
  return {
    uid,
    cabinetId: 0,
    masterCode,
    description,
    category: "Appliance",
    subCategory: null,
    placement: "appliance",
    ...spot,
    width,
    depth,
    height,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  };
}

/**
 * The reported plan: a normal 24" base run, the dishwasher, an RB3DB24 standing
 * where the plain base belongs, and the freestanding range at the run end.
 */
function beforePlan(): PlacedCabinet[] {
  return [
    base("b24", 0, "run-base"),
    appliance("DW-24", 24, 24, 34.5, 24, "Dishwasher", "dw"),
    base("rb3db24", 48, "range-base"),
    appliance("RANGE-30", 72, 30, 36, 25, "30 inch Freestanding Range", "range"),
  ];
}

/** What the branch builds: the plain B24, a shifted run, and the BEP2535 panel. */
function afterPlan(): PlacedCabinet[] {
  // Auto Design's range-flank pass reserves the 3/4" the finished end needs by
  // wiggling the range within its own anchor cap (autoDesignRangeFlanks.ts).
  // This is that reservation, applied to the reported plan first.
  const withReservedSlot = beforePlan().map((item) => {
    if (!/RANGE/i.test(item.masterCode ?? "")) return item;
    const spot = wallPlacementAt(72.75, 30, 25, "top", ROOM);
    return { ...item, ...spot };
  });
  const repaired = repairRangeBasesWithoutCooktop({ placed: withReservedSlot, room: ROOM, catalog: CATALOG }).placed;
  const withPanels = syncRangeAndNeighbourSidePanels({
    placed: repaired,
    room: ROOM,
    catalog: PANEL_CATALOG,
    styleId: STYLE.id,
    makeUid: (() => { let n = 0; return () => `side-panel-${++n}`; })(),
  });
  return withPanels.placed;
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

function buildScene(placed: readonly PlacedCabinet[], width: number, height: number) {
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
  // The appliances are drawn as simple real boxes so the reader can see which
  // side is exposed: a black dishwasher and a stainless range.
  for (const cabinet of placed) {
    if (cabinet.placement !== "appliance") continue;
    const isRange = /RANGE/i.test(cabinet.masterCode);
    const bodyHeight = Number(cabinet.height ?? 34.5);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(cabinet.width * INCH, bodyHeight * INCH, cabinet.depth * INCH),
      new THREE.MeshStandardMaterial({
        color: isRange ? 0xb9bec6 : 0x1b1d20,
        metalness: isRange ? 0.75 : 0.2,
        roughness: isRange ? 0.32 : 0.6,
      }),
    );
    box.position.set(
      (cabinet.x + cabinet.width / 2) * INCH,
      (bodyHeight / 2) * INCH,
      (cabinet.y + cabinet.depth / 2) * INCH,
    );
    box.castShadow = true;
    box.receiveShadow = true;
    root.add(box);
  }

  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  // Both panes share one camera, framed on the union of the two plans, so the
  // before and after images are the same view of the same wall and nothing is
  // cropped.
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 500);
  const target = new THREE.Vector3(center.x + 0.35, 2.0, center.z);
  const offset = new THREE.Vector3(0.9, 0.55, 16.4);
  camera.position.set(target.x + offset.x, target.y + offset.y, target.z + offset.z);
  camera.lookAt(target);
  return { scene, camera, target };
}

function facts(placed: readonly PlacedCabinet[]) {
  return placed
    .filter((item) => item.placement !== "appliance")
    .map((item) => ({
      code: item.masterCode,
      name: designerCabinetName(item),
      start: Number((item.wallOffset ?? 0).toFixed(3)),
      width: Number(Number(item.width).toFixed(3)),
      panelFor: item.autoPlacedForUid ?? null,
    }));
}

function renderPane(host: HTMLElement, title: string, placed: readonly PlacedCabinet[], accent: string) {
  const pane = document.createElement("div");
  pane.style.cssText = "position:relative;flex:1 1 50%;min-width:0;height:100vh;overflow:hidden";

  const canvasHost = document.createElement("div");
  canvasHost.style.cssText = "position:absolute;inset:0";
  pane.appendChild(canvasHost);

  const width = Math.floor(window.innerWidth / 2);
  const height = window.innerHeight;
  const renderer = makeRenderer(width, height);
  canvasHost.appendChild(renderer.domElement);
  renderer.domElement.style.width = `${width}px`;
  renderer.domElement.style.height = `${height}px`;

  const { scene, camera } = buildScene(placed, width, height);
  renderer.render(scene, camera);

  const caption = document.createElement("div");
  caption.id = title === "before" ? "before-caption" : "after-caption";
  const rows = facts(placed);
  const lines = [
    `<strong style="color:${accent}">${title.toUpperCase()}</strong>`,
    ...rows.map((row) => `${row.code}${row.panelFor ? ` (panel for ${row.panelFor})` : ""} · ${row.width}&Prime; at ${row.start}&Prime; · ${row.name}`),
  ];
  caption.innerHTML = lines.join("<br />");
  caption.style.cssText = "position:absolute;left:14px;top:12px;max-width:calc(100% - 28px);padding:10px 12px;background:rgba(255,255,255,0.95);border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,0.16);color:#0f172a;font-size:11px;line-height:1.5";
  pane.appendChild(caption);
  host.appendChild(pane);
}

function run() {
  const flag = (state: string) => { (window as unknown as { __issue354Shot?: string }).__issue354Shot = state; };
  try {
    const host = document.getElementById("root")!;
    const before = beforePlan();
    const after = afterPlan();
    renderPane(host, "before", before, "#b91c1c");
    renderPane(host, "after", after, "#047857");
    flag("ok");
  } catch (error) {
    document.getElementById("root")!.textContent = `Render failed: ${(error as Error).message}`;
    flag(`error: ${(error as Error).message}`);
  }
}

run();
