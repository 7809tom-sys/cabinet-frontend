/**
 * Before/after screenshot harness for Tom's two refrigerator-run rules.
 *
 * Builds a real 144 x 144 L-shaped Natura Maple kitchen with the real
 * Auto-Designer (`runAutoDesignLayout`) and draws the result twice with the
 * real viewers:
 *   - Floor plan: the real `PlanCanvas` component.
 *   - 3D: the real `addCabinet` / `existingCabinetTransform` engine.
 *
 * Dev-only. Served at /dev/fridge-shot.html; imported by nothing in the app.
 */
import * as THREE from "three";
import "@/index.css";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import realCatalog from "@/lib/__fixtures__/autoDesignRealCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "@/lib/autoDesignLayout";
import { PlanCanvas } from "@/components/design/PlanCanvas";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "@/components/design/InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import {
  DEFAULT_ROOM,
  cabinetWall,
  elevationBox,
  isRefrigerator,
  normalizeRefrigeratorBayUppers,
  normalizeStandardWallMounts,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "@/lib/design";
import { applyDesignerLayoutRules } from "@/lib/designerLayoutRules";
import { normalizeOverApplianceWallMounts } from "@/lib/overApplianceMount";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const CATALOG = realCatalog as unknown as Record<string, Pack>;

/** Natura Maple (Ashford) is style 330004; the Ashford line sells the same SKUs as 330011. */
const STYLE = {
  id: 330004,
  styleCode: "DN",
  ourName: "Designer Natural",
  aliasName: "Natura Maple (Ashford)",
  color: "#D4B896",
  finish: "Natura Maple (Ashford)",
  doorStyle: "Shaker",
  distributorId: 210001,
};
const CATALOG_KEY = "330011";

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

const PALETTE = [
  appliance("RANGE-30", 30, 25, 36),
  appliance("RANGE-36", 36, 25, 36),
  appliance("DW-24", 24, 24, 34.5),
  appliance("FRIDGE-30", 30, 30, 70),
  appliance("FRIDGE-33", 33, 34, 70),
  appliance("FRIDGE-36", 36, 30, 70),
  appliance("FRIDGE-42", 42, 30, 70),
  appliance("HOOD-30", 30, 18, 18),
  appliance("HOOD-36", 36, 18, 18),
];

function build(rangeWidth: 30 | 36, fridgeWidth: 30 | 36 = 30, layout: "l-shape" | "u-shape" = "l-shape", upperHeight: 30 | 36 | 42 = 30): { run: AutoDesignLayoutSuccess; room: RoomData } {
  const pack = CATALOG[CATALOG_KEY]!;
  const room: RoomData = { ...DEFAULT_ROOM, width: 144, depth: 144, ceilingHeight: 96 };
  const endPanels = [...pack.accessory, ...pack.wall];
  const uShape = layout === "u-shape";
  let uid = 0;
  const run = runAutoDesignLayout({
    input: {
      layoutType: layout,
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: upperHeight,
      sink: { wallLabel: uShape ? "Wall 1" : "Wall 3", centerOffsetIn: 72 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 72 },
      dishwasher: null,
      skipDishwasher: true,
      refrigerator: { wallLabel: uShape ? "Wall 3" : "Wall 1", centerOffsetIn: 72 },
      refrigeratorWidthIn: fridgeWidth,
      refrigeratorPanels: "both",
      refrigeratorEnclosure: "cabinet-above",
    } as never,
    room,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: PALETTE,
    refrigeratorCaps: [
      ...mergeAutoDesignRefrigeratorCaps(pack.wall, []),
      // The line's own deep wall boxes of every width (the surrounding-query
      // rows Auto-Design reads for the refrigerator bay).
      ...pack.wall.filter((row) => Number(row.depth) >= 20 && Number(row.width) >= 24 && Number(row.height) < 30),
    ].filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index),
    refrigeratorEndPanels: endPanels,
    styleId: STYLE.id,
    makeUid: () => `fridge-shot-${++uid}`,
    stoveMasterCode: rangeWidth === 36 ? "RANGE-36" : "RANGE-30",
  } as never);
  if (!run.ok) throw new Error(run.message);
  return { run, room };
}

/**
 * The refrigerator attributes pop-up path: a refrigerator dropped from the
 * palette, its end panels, and an ORDINARY upper above it — the case Tom
 * reported. The pop-up's own selection loop is not reachable here, so the same
 * source rows are seated directly and then run through the same load/pop-up
 * passes the Designer runs (`clampRefrigeratorAssemblyToPanels` and the shared
 * layout rules), which is where the depth rule lives.
 */
function buildPopupCase(panelDepthIn: 24 | 30): { placed: PlacedCabinet[]; room: RoomData } {
  const pack = CATALOG[CATALOG_KEY]!;
  const room: RoomData = { ...DEFAULT_ROOM, width: 144, depth: 144, ceilingHeight: 96 };
  const baseRow = pack.base.find((row) => row.masterCode === "B27") ?? pack.base.find((row) => Number(row.width) === 27)!;
  const panelRow = pack.accessory.find((row) => /REPV24|REPV30|REPV/i.test(row.masterCode)) ?? pack.accessory[0]!;
  const upperRow = pack.wall.find((row) => row.masterCode === "W3612")!;
  let uid = 0;
  const make = (row: DesignCabinet, along: number, overrides: Partial<PlacedCabinet>): PlacedCabinet => ({
    uid: `popup-${++uid}`,
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: row.category ?? null,
    subCategory: row.subCategory ?? null,
    placement: row.placement,
    ...wallPlacementAt(along, Number(row.width), Number(row.depth), "top", room),
    width: Number(row.width),
    depth: Number(row.depth),
    height: Number(row.height),
    rotation: 0,
    wallId: "top",
    wallOffset: along,
    ...overrides,
  } as PlacedCabinet);

  const fridge: PlacedCabinet = {
    uid: "popup-fridge", cabinetId: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator',
    category: "Appliance", subCategory: "Appliance", placement: "appliance",
    ...wallPlacementAt(48, 36, 30, "top", room), width: 36, depth: 30, height: 70, rotation: 0,
    wallId: "top", wallOffset: 48, applianceRole: "base-height",
  } as PlacedCabinet;
  const leftPanel = make(panelRow, 46.5, {
    width: 1.5, depth: panelDepthIn, height: 96, customProfile: "refrigerator-end-panel",
    refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "left-panel",
  });
  const rightPanel = make(panelRow, 84.5, {
    width: 1.5, depth: panelDepthIn, height: 96, customProfile: "refrigerator-end-panel",
    refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "right-panel",
  });
  const upper = make(upperRow, 21, { width: 36, depth: 12, height: 30, mountBottom: 54, placement: "wall" });
  const aboveFridge = make(upperRow, 48, { width: 36, depth: 12, height: 12, mountBottom: 54, placement: "wall" });
  let placed: PlacedCabinet[] = [
    make(baseRow, 21, {}),
    fridge,
    aboveFridge,
    upper,
    leftPanel,
    rightPanel,
  ];
  // The same passes the Designer runs on load and after the pop-up commits.
  placed = normalizeRefrigeratorBayUppers(placed, room);
  placed = normalizeStandardWallMounts(placed, [], room);
  placed = normalizeOverApplianceWallMounts(placed, room);
  placed = applyDesignerLayoutRules({ placed, room, openings: [], fillers: pack.accessory, makeUid: () => `popup-pass-${++uid}`, styleId: STYLE.id } as never).placed;
  return { placed, room };
}

/** Distance from the wall plane to a cabinet's front face, in inches. */
function frontIn(item: PlacedCabinet, room: RoomData): number {
  const side = cabinetWall(item, room);
  const depth = Number(item.depth) || 0;
  if (side === "top") return item.y + depth;
  if (side === "bottom") return room.depth - item.y;
  if (side === "left") return item.x + depth;
  return room.width - item.x;
}

function mountPlan(host: HTMLElement, placed: PlacedCabinet[], room: RoomData) {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  host.appendChild(container);
  createRoot(container).render(createElement(LanguageProvider, null, createElement(PlanCanvas as never, {
    room,
    cabinets: placed,
    selectedUid: null,
    onSelect: () => {},
    showWallLayer: true,
    countertopMaterialId: null,
    sinks: [],
    openings: [],
    autoDesignWallGuides: [],
    finish: doorStyleFinishColors(STYLE as never),
    activeWall: "top",
  } as never)));
}

function mount3D(host: HTMLElement, placed: PlacedCabinet[], room: RoomData) {
  const width = host.clientWidth;
  const height = host.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.width = `${width}px`;
  renderer.domElement.style.height = `${height}px`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef1f4");
  const INCH = 1 / 12;
  const roomW = room.width * INCH;
  const roomD = room.depth * INCH;
  const ceiling = (room.ceilingHeight ?? 96) * INCH;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW * 1.8, roomD * 1.8),
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
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(4 * INCH, ceiling, roomD), wallMat);
  leftWall.position.set(-2 * INCH, ceiling / 2, roomD / 2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(roomW * 0.5, ceiling + 5, roomD * 0.45);
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

  const { face } = doorStyleFinishColors(STYLE as never);
  const profile = designerCatalogDoorProfile(STYLE as never);
  const root = new THREE.Group();
  scene.add(root);
  for (const cabinet of placed) {
    addCabinet(
      root,
      { ...existingCabinetSku(cabinet, room), catalogImageUrl: null },
      cabinet.wallId ?? "top",
      { back: 0, left: 0, right: 0, front: 0 },
      room.width,
      room.depth,
      face,
      "#eeeeee",
      profile as never,
      existingCabinetTransform(cabinet, room, placed),
      null,
      undefined,
      { countertop: null, selectedToeKick: false },
    );
  }

  // Frame on the refrigerator bay, three-quarter view from the room centre.
  const fridge = placed.find(isRefrigerator);
  const focusPlan = fridge ?? placed[0]!;
  const center = new THREE.Vector3((focusPlan.x + Number(focusPlan.width) / 2) * INCH, 3.2, (focusPlan.y + Number(focusPlan.depth) / 2) * INCH);
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 400);
  camera.position.set(center.x + roomW * 0.42, ceiling * 0.55, center.z + roomD * 0.92);
  camera.lookAt(center);
  camera.position.set(center.x + roomW * 0.30, ceiling * 0.52, center.z + roomD * 0.82);
  camera.lookAt(center);

  let frames = 0;
  const tick = () => {
    renderer.render(scene, camera);
    frames += 1;
    if (frames < 24) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { renderer, scene, camera, root };
}

function describeBay(placed: PlacedCabinet[], room: RoomData) {
  const fridge = placed.find(isRefrigerator);
  if (!fridge) return { lines: ["No refrigerator in the plan."], ok: false };
  const side = cabinetWall(fridge, room) as WallSide;
  const bridge = placed.find((item) => item.refrigeratorAssemblyId === fridge.uid && item.refrigeratorAssemblyRole === "bridge");
  const panels = placed.filter((item) => item.refrigeratorAssemblyId === fridge.uid && (item.refrigeratorAssemblyRole ?? "").endsWith("panel"));
  const bases = placed.filter((item) => item.placement === "base"
    && cabinetWall(item, room) === side
    // A corner box legitimately reaches further into the room than the straight
    // run it joins, so the row comparison is against the straight bases only.
    && !item.cornerType
    && Math.abs(Number(item.depth) - Number(fridge.depth)) <= 0.6);
  const uppers = placed.filter((item) => item.placement === "wall" && cabinetWall(item, room) === side && item.refrigeratorAssemblyRole !== "bridge");
  const baseFronts = [...new Set(bases.map((item) => Math.round(frontIn(item, room) * 8) / 8))];
  const upperFronts = [...new Set(uppers.map((item) => Math.round(frontIn(item, room) * 8) / 8))];
  const fridgeFront = Math.round(frontIn(fridge, room) * 8) / 8;
  const bridgeFront = bridge ? Math.round(frontIn(bridge, room) * 8) / 8 : null;
  const start = wallRunOffset(fridge, side, room);
  const end = start + wallRunSpan(fridge, side, room);
  const baseRuns = bases.map((item) => {
    const s = wallRunOffset(item, side, room);
    return { code: item.masterCode, start: s, end: s + wallRunSpan(item, side, room) };
  }).sort((a, b) => a.start - b.start);
  const leftNeighbor = baseRuns.filter((run) => run.end <= start + 0.01).at(-1);
  const rightNeighbor = baseRuns.find((run) => run.start >= end - 0.01);
  const leftPanel = panels.find((panel) => panel.refrigeratorAssemblyRole === "left-panel");
  const rightPanel = panels.find((panel) => panel.refrigeratorAssemblyRole === "right-panel");
  const bayLeft = leftPanel ? wallRunOffset(leftPanel, side, room) : start;
  const bayRight = rightPanel ? wallRunOffset(rightPanel, side, room) + wallRunSpan(rightPanel, side, room) : end;
  const bayFront = panels.length ? Math.min(...panels.map((panel) => Math.round(frontIn(panel, room) * 8) / 8)) : fridgeFront;
  const alignsRun = baseFronts.every((front) => Math.abs(front - fridgeFront) <= 0.13);
  const flushWithPanel = bridgeFront != null && Math.abs(bridgeFront - bayFront) <= 0.13;
  const uppersLineUp = uppers.length > 0 && Math.abs(
    Math.min(...uppers.map((item) => elevationBox(item, room).bottom + elevationBox(item, room).height))
      - (bridge ? (bridge.mountBottom ?? 0) + Number(bridge.height) : 0),
  ) <= 0.30;
  const lines = [
    `Refrigerator ${fridge.masterCode} sits on <b>${side}</b> wall at ${start.toFixed(2)}″–${end.toFixed(2)}″, ${fridge.depth}″ deep.`,
    `Fridge front: <b>${fridgeFront}″</b> from the wall · base cabinet fronts on that wall: <b>${baseFronts.join(", ")}″</b> · uppers: <b>${upperFronts.join(", ")}″</b>.`,
    `Fridge align with the cabinet row: ${alignsRun ? '<span class="ok">yes</span>' : '<span class="bad">no</span>'}.`,
    bridge
      ? `Cabinet above: <b>${bridge.masterCode}</b>, front at <b>${bridgeFront}″</b> · panel fronts at <b>${bayFront}″</b> → flush: ${flushWithPanel ? '<span class="ok">yes</span>' : '<span class="bad">no</span>'}.`
      : `<span class="bad">No cabinet above the refrigerator.</span>`,
    bridge
      ? `Cabinet above tops at <b>${((bridge.mountBottom ?? 0) + Number(bridge.height)).toFixed(2)}″</b>, other uppers top at <b>${[...new Set(uppers.map((item) => (elevationBox(item, room).bottom + elevationBox(item, room).height).toFixed(2)))].join(", ")}″</b> → height line-up: ${uppersLineUp ? '<span class="ok">yes</span>' : '<span class="bad">no</span>'}.`
      : "",
    `Bay occupies ${bayLeft.toFixed(2)}″–${bayRight.toFixed(2)}″; base run continues to <b>${leftNeighbor ? `${leftNeighbor.code} ends ${leftNeighbor.end}″` : "nothing"}</b> / <b>${rightNeighbor ? `${rightNeighbor.code} starts ${rightNeighbor.start}″` : "nothing"}</b>.`,
  ].filter(Boolean);
  return { lines, ok: alignsRun && flushWithPanel && uppersLineUp };
}

async function run() {
  const caption = document.getElementById("caption")!;
  try {
    const params = new URLSearchParams(location.search);
    const rangeWidth = Number(params.get("range") ?? 30) === 36 ? 36 : 30;
    const fridgeWidth = Number(params.get("fridge") ?? 30) === 36 ? 36 : 30;
    const layout = params.get("layout") === "u-shape" ? "u-shape" : "l-shape";
    const upperHeight = (Number(params.get("uppers") ?? 30) === 42 ? 42 : Number(params.get("uppers") ?? 30) === 36 ? 36 : 30) as 30 | 36 | 42;
    const popup = params.get("case") === "popup";
    const built = popup
      ? (() => { const builtPopup = buildPopupCase(24); return { placed: builtPopup.placed, room: builtPopup.room }; })()
      : (() => {
        const auto = build(rangeWidth as 30 | 36, fridgeWidth as 30 | 36, layout, upperHeight);
        return { placed: auto.run.placed, room: auto.room };
      })();
    const { room } = built;

    const planHost = document.getElementById("mount-plan")!;
    const threeHost = document.getElementById("mount-3d")!;
    mountPlan(planHost, built.placed, room);
    const view = mount3D(threeHost, built.placed, room);

    const bay = describeBay(built.placed, room);
    const range = built.placed.find((item) => item.placement === "appliance" && /RANGE/.test(item.masterCode));
    const rangeBridge = range
      ? built.placed.find((item) => item.overRangeMicrowaveBridge === true
        && cabinetWall(item, room) === cabinetWall(range, room)
        && Math.abs((wallRunOffset(item, cabinetWall(range, room), room) + wallRunSpan(item, cabinetWall(range, room), room) / 2)
          - (wallRunOffset(range, cabinetWall(range, room), room) + wallRunSpan(range, cabinetWall(range, room), room) / 2)) <= 1)
      : undefined;
    const finish = doorStyleFinishColors(STYLE as never);

    const rangeBridgeLine = popup
      ? "Refrigerator dropped from the palette, two end panels, and an ordinary 36 × 12 upper above it."
      : `Range bridge above ${range?.masterCode ?? "range"}: ${rangeBridge ? `<span class="ok">${rangeBridge.masterCode} present</span> at ${(rangeBridge.mountBottom ?? 0)}″` : '<span class="bad">missing</span>'}`;
    caption.innerHTML = `
      <b>Natura Maple (Ashford) · 144″ × 144″ ${popup ? "refrigerator pop-up case" : `${layout} · ${rangeWidth}″ range · ${fridgeWidth}″ refrigerator · ${upperHeight}″ uppers`}</b>
      <span class="dim">— plan and 3D are the real Designer output, ${built.placed.length} pieces</span><br />
      ${bay.lines.join("<br />")}<br />
      ${rangeBridgeLine}<br />
      Door finish: front <b>${finish.face}</b> · edge ${finish.edge} · profile ${STYLE.doorStyle} (${profileName()})
    `;
    (window as unknown as { __fridgeShot?: string }).__fridgeShot = bay.ok ? "ok" : "geometry-mismatch";
    // Debug: measured world-space box of each placed piece, in inches.
    const INCH = 1 / 12;
    const boxes: Record<string, { back: number; front: number; bottom: number; top: number }> = {};
    view.scene.updateMatrixWorld(true);
    view.root.children.forEach((child) => {
      const uid = (child.userData as { placedUid?: string }).placedUid;
      if (!uid) return;
      const placed = built.placed.find((item) => item.uid === uid);
      if (!placed) return;
      const box3 = new THREE.Box3().setFromObject(child);
      boxes[`${placed.masterCode}@${placed.uid}`] = {
        back: (box3.min.z / INCH),
        front: (box3.max.z / INCH),
        bottom: (box3.min.y / INCH),
        top: (box3.max.y / INCH),
      };
    });
    (window as unknown as { __fridgeDebug?: unknown }).__fridgeDebug = boxes;
  } catch (error) {
    caption.textContent = `Render failed: ${(error as Error).message}`;
    (window as unknown as { __fridgeShot?: string }).__fridgeShot = `error: ${(error as Error).message}`;
  }
}

function profileName(): string {
  const profile = designerCatalogDoorProfile(STYLE as never);
  return profile ? `${profile.doorStyle ?? "Shaker"}${profile.paintedFinish ? ", painted" : ""}` : "none";
}

void run();
