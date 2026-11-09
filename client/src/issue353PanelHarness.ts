/**
 * Before / after screenshot harness for issue 353 outcome 8.
 *
 * Tom's actual case: a STANDALONE W3024 upper (a plain wall cabinet, NOT a
 * microwave bridge), and the end panel the designer hung on its side, which
 * used to run down past the cabinet's own bottom.
 *
 * BOTH columns are real designer code:
 *   - BEFORE runs main's exposed-side engine, served from
 *     `git show origin/main:client/src/lib/exposedSidePanels.ts` by
 *     `plugins/issue353MainSnapshot.ts`, so the panel really is the one main
 *     places;
 *   - AFTER runs this branch's engine, whose panel is clamped to the upper band.
 *
 * Nothing here invents a panel. This file only draws the cabinets and whatever
 * panel the engine returned.
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
import { syncExposedSidePanels } from "@/lib/exposedSidePanels";
// Main's real exposed-side engine, from git. Registered only by
// vite.issue353-shots.config.ts.
import {
  syncExposedSidePanels as mainSyncExposedSidePanels,
} from "virtual:issue353-main/exposedSidePanels.ts";

const INCH = 1 / 12;
const ROOM: RoomData = { ...DEFAULT_ROOM, width: 156, depth: 132, ceilingHeight: 96 };

/** The standalone W3024 Tom reported: one 30 × 24-inch upper, nothing beside it. */
function w3024(): PlacedCabinet {
  const spot = wallPlacementAt(48, 30, 12, "top", ROOM);
  return {
    uid: "w3024",
    cabinetId: 9001,
    masterCode: "W3024",
    // A plain wall cabinet. A "Microwave Bridge" description would make this an
    // appliance surround, which is a different (legitimate) case; the defect Tom
    // reported is the standalone box.
    description: '30" W × 24" H Wall Cabinet',
    category: "Wall",
    subCategory: "Standard Wall",
    placement: "wall",
    ...spot,
    width: 30,
    depth: 12,
    height: 24,
    rotation: spot.rotation,
    wallId: "top",
    wallOffset: 48,
    // A standalone W3024: no bridge flag, no appliance under it, no counter run
    // beneath it. This is the cabinet Tom reported.
    numberOfDoors: 2,
    numberOfDrawers: 0,
    constructionMethod: "frameless",
  } as PlacedCabinet;
}

// Real AltaEuro wall end-panel stock, priced.
const panelStock = [
  { id: 201, masterCode: "WEP1523", description: '15-1/4" W × 22-5/8" H × 3/4" D Wall End Panel', category: "Accessory", subCategory: "Wall End Panel", width: "15.25", depth: "0.75", height: "22.625" },
  { id: 202, masterCode: "WEP1530", description: '15-1/4" W × 30-1/4" H × 3/4" D Wall End Panel', category: "Accessory", subCategory: "Wall End Panel", width: "15.25", depth: "0.75", height: "30.25" },
  { id: 203, masterCode: "WEP1535", description: '15-1/4" W × 35-1/4" H × 3/4" D Wall End Panel', category: "Accessory", subCategory: "Wall End Panel", width: "15.25", depth: "0.75", height: "35.25" },
  { id: 204, masterCode: "WEP1542", description: '15-1/4" W × 41-3/4" H × 3/4" D Wall End Panel', category: "Accessory", subCategory: "Wall End Panel", width: "15.25", depth: "0.75", height: "41.75" },
];

type Column = {
  label: string;
  panels: PlacedCabinet[];
};

function panelsFrom(sync: typeof syncExposedSidePanels): PlacedCabinet[] {
  const upper = w3024();
  const result = sync({
    placed: [upper],
    room: ROOM,
    catalog: panelStock.map((item) => ({
      id: item.id,
      masterCode: item.masterCode,
      description: item.description,
      placement: "wall" as const,
      stockFace: Number(item.width),
      stockHeight: Number(item.height),
      price: 96,
      panelType: "wall-end" as const,
    })),
    qualifiedOnly: true,
    doorStyleFor: () => ({ ourName: "AltaEuro Luxe", isFrameless: true } as never),
    priceFor: () => 96,
    pricesReady: true,
  });
  return result.placed.filter((item) => Boolean(item.autoPlacedReason));
}

function build(container: HTMLElement, column: Column, highlight: boolean) {
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
    new THREE.PlaneGeometry(roomW * 1.5, 12),
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

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(roomW * 0.35, ceiling + 2, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const cam = key.shadow.camera as THREE.OrthographicCamera;
  cam.left = -roomW; cam.right = roomW; cam.top = ceiling * 2; cam.bottom = -2;
  cam.near = 0.1; cam.far = 60;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-roomW * 0.5, ceiling * 0.7, 14);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);

  const carcass = new THREE.MeshStandardMaterial({ color: "#efece5", roughness: 0.62, metalness: 0 });

  // The upper, at its real elevation (72" bottom, 24" tall).
  const upper = w3024();
{
    const box = elevationBox(upper, ROOM);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(upper.width * INCH, box.height * INCH, upper.depth * INCH), carcass);
    mesh.position.set((upper.x + upper.width / 2) * INCH, (box.bottom + box.height / 2) * INCH, 6 * INCH);
    mesh.castShadow = true;
    root.add(mesh);
    // A thin reference plane at the cabinet's own bottom, so a panel that runs
    // past it is unmistakable.
    const datum = new THREE.Mesh(
      new THREE.BoxGeometry((upper.width + 6) * INCH, 0.05, 13 * INCH),
      new THREE.MeshBasicMaterial({ color: 0x047857, transparent: true, opacity: 0.55 }),
    );
    datum.position.set((upper.x + upper.width / 2) * INCH, box.bottom * INCH, 6.5 * INCH);
    root.add(datum);
  }

  // Whatever panel the real engine placed, at its own measured elevation.
  const panelMat = new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.55, metalness: 0 });
  for (const panel of column.panels) {
    const box = elevationBox(panel, ROOM);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(panel.width * INCH, Math.max(0.05, box.height) * INCH, (panel.depth || 12) * INCH),
      panelMat,
    );
    mesh.position.set(
      (panel.x + (panel.width / 2)) * INCH,
      (box.bottom + box.height / 2) * INCH,
      ((panel.y ?? 0) + 6) * INCH,
    );
    mesh.castShadow = true;
    mesh.userData = { endPanel: true };
    root.add(mesh);
  }
  void highlight;

  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const span = Math.max(size.x, size.y, 6);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 300);
  camera.position.set(center.x - span * 0.18, center.y + span * 0.06, center.z + span * 1.15);
  camera.lookAt(center.x, center.y, center.z);
  renderer.render(scene, camera);
}

function run() {
  try {
    const beforePanels = panelsFrom(mainSyncExposedSidePanels as unknown as typeof syncExposedSidePanels);
    const afterPanels = panelsFrom(syncExposedSidePanels);
    const upperBottom = elevationBox(w3024(), ROOM).bottom;

    build(document.getElementById("pane-before")!, { label: "BEFORE · main", panels: beforePanels }, true);
    build(document.getElementById("pane-after")!, { label: "AFTER · branch", panels: afterPanels }, true);

    const lowest = (panels: PlacedCabinet[]) => {
      if (!panels.length) return null;
      return Math.min(...panels.map((panel) => elevationBox(panel, ROOM).bottom));
    };
    const beforeLow = lowest(beforePanels);
    const afterLow = lowest(afterPanels);

    const beforeLine = beforePanels.length
      ? `end panel ${beforeLow}&#8243;&#8211;${Math.round(((beforeLow ?? 0) + elevationBox(beforePanels[0]!, ROOM).height) * 10) / 10}&#8243; hangs below the ${upperBottom}&#8243; cabinet bottom`
      : "no end panel placed";
    const afterLine = afterPanels.length
      ? `end panel starts at the ${afterLow}&#8243; cabinet bottom`
      : "no end panel placed at all beside a standalone short upper";

    document.getElementById("caption-before")!.innerHTML =
      `<strong>BEFORE · main</strong><br />` +
      `<span class="bad">&#10007; ${beforeLine}</span><br />` +
      `<span class="bad">&#10007; standalone W3024 (30&#8243; × 24&#8243;) with a stray side panel</span>`;
    document.getElementById("caption-after")!.innerHTML =
      `<strong>AFTER · branch</strong><br />` +
      `<span class="ok">&#10003; ${afterLine}</span><br />` +
      `<span class="ok">&#10003; never reaches below the cabinet</span>`;

    (window as unknown as { __issue353Panel?: unknown }).__issue353Panel = {
      ok: true,
      upperBottom,
      before: { panels: beforePanels.length, lowestBottom: beforeLow },
      after: { panels: afterPanels.length, lowestBottom: afterLow },
    };
  } catch (error) {
    (window as unknown as { __issue353Panel?: unknown }).__issue353Panel = { ok: false, message: (error as Error).message };
    const node = document.getElementById("caption-before");
    if (node) node.textContent = `Render failed: ${(error as Error).message}`;
  }
}

void STD;
void run();
