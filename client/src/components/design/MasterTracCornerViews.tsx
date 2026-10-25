import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { masterTracFinishColor, masterTracProduct } from "@/lib/closet";
import type { PlacedCabinet, WallSide } from "@/lib/design";
import { CORNER_FOOTPRINT_IN, isMasterTracCornerBoard, type MasterTracCornerBoard } from "@/lib/masterTracTower";

const IN = 1 / 12;
/** Owner-described straight mating edges. The source SKU still supplies the 29.5-inch bounding size. */
const CORNER_MATING_EDGE_IN = 14.5;

function groupBoards(placed: PlacedCabinet[]) {
  const corner = placed.find(isMasterTracCornerBoard);
  if (!corner?.masterTracTowerId) return null;
  const boards = placed.filter((board) => board.masterTracTowerId === corner.masterTracTowerId);
  const runBoards = boards.filter((board) => board.masterTracTowerRole !== "corner-return");
  const start = Math.min(...runBoards.map((board) => board.wallOffset ?? 0));
  const end = Math.max(...runBoards.map((board) => (board.wallOffset ?? 0) + board.width));
  const height = Math.max(...boards.map((board) => (board.mountBottom ?? 0) + (board.height ?? 0)));
  return { corner, boards, start, width: end - start, height };
}

/** User-described 14.5-inch straight mating edges; the curve remains an illustration, not a CNC or support profile. */
export function illustrativeMasterTracCornerShape(): THREE.Shape {
  const b = CORNER_FOOTPRINT_IN * IN;
  const mating = CORNER_MATING_EDGE_IN * IN;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(b, 0);
  // x=b meets the existing upright over z=0..14.5. The unmodeled perpendicular
  // return meets z=b over x=0..14.5. Only the opening-facing transition is curved.
  shape.lineTo(b, mating);
  shape.bezierCurveTo(b, b * 0.75, b * 0.75, b, mating, b);
  shape.lineTo(0, b);
  shape.lineTo(0, 0);
  return shape;
}

/** Extrudes only the sourced ¾-inch board, never a cam lock or a second, unpriced return run. */
export function illustrativeMasterTracCornerGeometry(): THREE.ExtrudeGeometry {
  const shape = illustrativeMasterTracCornerShape();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.75 * IN, bevelEnabled: false, steps: 1, curveSegments: 28 });
  // Source outline is XY; lay it horizontally in XZ. Extrusion extends downward from the SKU's top.
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export function addIllustrativeMasterTracCorner(parent: THREE.Group, board: MasterTracCornerBoard, localXIn: number): THREE.Group {
  const group = new THREE.Group();
  const finish = masterTracProduct(board.masterCode)?.finish ?? "Glacier White";
  const material = new THREE.MeshStandardMaterial({ color: masterTracFinishColor(finish), roughness: 0.82, side: THREE.DoubleSide });
  const shelf = new THREE.Mesh(illustrativeMasterTracCornerGeometry(), material);
  shelf.castShadow = true;
  // Extruded curved polygons can self-shadow in the closet preview; only the
  // measured straight boards and room floor receive cast shadows.
  shelf.receiveShadow = false;
  shelf.userData = { sku: board.masterCode, masterTracCornerSurface: true, illustrative: true };
  group.add(shelf);
  group.position.set((localXIn + (board.masterTracCorner.side === "end" ? CORNER_FOOTPRINT_IN : 0)) * IN, ((board.mountBottom ?? 0) + 0.75) * IN, 0);
  if (board.masterTracCorner.side === "end") group.scale.x = -1;
  group.userData = { masterTracCorner: { sku: board.masterCode, finish, side: board.masterTracCorner.side, widthIn: CORNER_FOOTPRINT_IN, depthIn: CORNER_FOOTPRINT_IN, connectionEdgeIn: CORNER_MATING_EDGE_IN, returnModeled: false, camLockGeometry: false, illustrative: true } };
  parent.add(group);
  return group;
}

export function addStraightBoard(parent: THREE.Group, board: PlacedCabinet, localXIn: number) {
  const color = masterTracFinishColor(masterTracProduct(board.masterCode)?.finish ?? "Glacier White");
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(board.width * IN, (board.height ?? 0.75) * IN, board.depth * IN),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82 }),
  );
  mesh.position.set((localXIn + board.width / 2) * IN, ((board.mountBottom ?? 0) + (board.height ?? 0.75) / 2) * IN, board.depth / 2 * IN);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { sku: board.masterCode, masterTracStraightBoard: true };
  parent.add(mesh);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x756f65, transparent: true, opacity: 0.45 }));
  outline.position.copy(mesh.position);
  parent.add(outline);
}

/** Measured ¾ × height × 14.5-in sourced floor upright, perpendicular to the straight bays. */
export function addCornerReturnUpright(parent: THREE.Group, board: PlacedCabinet, side: "start" | "end", spanIn: number) {
  const color = masterTracFinishColor(masterTracProduct(board.masterCode)?.finish ?? "Glacier White");
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(board.depth * IN, (board.height ?? 87) * IN, board.width * IN),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
  mesh.position.set((side === "start" ? board.depth / 2 : spanIn - board.depth / 2) * IN,
    (board.height ?? 87) / 2 * IN, (CORNER_FOOTPRINT_IN + board.width / 2) * IN);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { sku: board.masterCode, masterTracCornerReturn: true, sourcedDimensions: true, camLockGeometry: false };
  parent.add(mesh);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x756f65, transparent: true, opacity: 0.48 }));
  outline.position.copy(mesh.position);
  parent.add(outline);
}

/** SKU and measured span are real; diameter, cup profile and hole location are illustrative. */
export function addIllustrativeTowerRods(parent: THREE.Group, anchor: PlacedCabinet, localXIn: number) {
  const storage = anchor.masterTracConceptStorage;
  const rods = anchor.masterTracStorageItems
    ? anchor.masterTracStorageItems.filter((item) => item.kind === "rod").map((item) => ({ height: item.elevationIn, finish: item.rodFinish }))
    : storage?.kind === "rod" ? (storage.rodHeightsIn ?? []).map((height) => ({ height, finish: storage.rodFinish ?? "Chrome" })) : [];
  rods.forEach(({ height, finish }, level) => {
    const material = new THREE.MeshStandardMaterial({ color: finish === "Matt Nickel" ? 0x747574 : 0xa7a8aa, metalness: 0.72, roughness: 0.29 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * IN, 0.42 * IN, anchor.width * IN, 12), material);
    rod.rotation.z = Math.PI / 2;
    rod.position.set((localXIn + anchor.width / 2) * IN, height * IN, anchor.depth * 0.5 * IN);
    rod.userData = { masterTracRodIllustration: true, stockSku: anchor.masterTracStorageItems ? undefined : storage?.skuReferences[0], finish, level, installedSpanIn: anchor.width, notInstallationGeometry: true };
    parent.add(rod);
    for (const end of [0, anchor.width]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * IN, 0.55 * IN, 0.12 * IN, 12), material);
      cup.rotation.z = Math.PI / 2;
      cup.position.set((localXIn + end) * IN, height * IN, anchor.depth * 0.5 * IN);
      cup.userData = { masterTracCupIllustration: true, notInstallationGeometry: true };
      parent.add(cup);
    }
  });
}

/** Source-backed pieces represented as intentionally schematic faces/tilted boards. */
export function addIllustrativeTowerMixedStorage(parent: THREE.Group, anchor: PlacedCabinet, localXIn: number) {
  if (anchor.masterTracTowerRole !== "fixed-bottom" || !anchor.masterTracStorageItems) return;
  for (const item of anchor.masterTracStorageItems) {
    if (item.kind !== "drawer" && item.kind !== "shoe") continue;
    const drawer = item.kind === "drawer";
    const height = drawer ? item.drawerSize === "small" ? 5 : 10 : 0.75;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry((anchor.width - 0.4) * IN, height * IN, (drawer ? 0.5 : anchor.depth * 0.94) * IN),
      new THREE.MeshStandardMaterial({ color: drawer ? 0xb49b79 : masterTracFinishColor(masterTracProduct(anchor.masterCode)?.finish ?? "Glacier White") }));
    mesh.position.set((localXIn + anchor.width / 2) * IN, (item.elevationIn + height / 2) * IN, (drawer ? anchor.depth - 0.3 : anchor.depth / 2) * IN);
    // Mixed rows use only the sourced board thickness; an undocumented tilt
    // would intersect a neighboring ¾-inch level that the real-board fit accepts.
    mesh.userData = { masterTracConceptComponent: drawer ? "drawer-front-illustration" : "shoe-board-illustration", illustrative: true, notInstallationGeometry: true };
    parent.add(mesh);
    if (!drawer) {
      const fence = new THREE.Mesh(new THREE.BoxGeometry((anchor.width - 0.5) * IN, 0.15 * IN, 0.15 * IN),
        new THREE.MeshStandardMaterial({ color: item.fenceFinish === "Chrome" ? 0xa7a8aa : 0x747574, metalness: 0.6 }));
      fence.position.set(mesh.position.x, item.elevationIn * IN, (anchor.depth - 0.35) * IN);
      fence.userData = { masterTracConceptComponent: "shoe-fence-illustration", illustrative: true, notInstallationGeometry: true };
      parent.add(fence);
    }
  }
}

export function masterTracCornerAssembly(placed: PlacedCabinet[]): THREE.Group | null {
  const group = groupBoards(placed);
  if (!group) return null;
  const root = new THREE.Group();
  for (const board of group.boards) {
    if (board.masterTracTowerRole === "corner-return") {
      addCornerReturnUpright(root, board, group.corner.masterTracCorner.side, group.width);
      continue;
    }
    const offset = (board.wallOffset ?? group.start) - group.start;
    if (isMasterTracCornerBoard(board)) addIllustrativeMasterTracCorner(root, board, offset);
    else {
      addStraightBoard(root, board, offset);
      addIllustrativeTowerRods(root, board, offset);
      addIllustrativeTowerMixedStorage(root, board, offset);
    }
  }
  const corners = group.boards.filter(isMasterTracCornerBoard);
  root.userData = { cornerSku: group.corner.masterCode, cornerCount: corners.length,
    cornerSkus: corners.map((board) => board.masterCode), side: group.corner.masterTracCorner.side, widthIn: group.width };
  return root;
}

function Heading({ placed, wall, view }: { placed: PlacedCabinet[]; wall: WallSide; view: string }) {
  const group = groupBoards(placed)!;
  const corner = group.corner;
  const corners = group.boards.filter(isMasterTracCornerBoard);
  const cornerList = corners.reduce((sum, board) => sum + (masterTracProduct(board.masterCode)?.listEachUsd ?? 0), 0);
  const joints = corners.filter((board) => board.masterTracCorner.hJointSku);
  const joint = joints.length ? masterTracProduct(joints[0].masterTracCorner.hJointSku!) : null;
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-[#192432] px-4 py-3 text-xs text-white">
    <div><strong className="text-sm">MasterTrac Closet · {view}</strong><span className="ml-2 text-stone-200">{corner.masterTracCorner.side === "start" ? "Left/start" : "Right/end"} · {wall} wall · {group.width.toFixed(2)}″ overall</span></div>
    <span>{corners.length} curved corner {corners.length === 1 ? "shelf" : "shelves"} · {masterTracProduct(corner.masterCode)?.finish} · ${cornerList.toFixed(2)} List{joint ? ` · ${joints.length}× H-joint ${joint.sku} $${(joint.listEachUsd * joints.length).toFixed(2)}` : ""}</span>
  </div>;
}

/** A separate Closet-only front elevation, not the kitchen cabinet elevation renderer. */
export function MasterTracCornerElevation({ placed, wall, onEdit }: { placed: PlacedCabinet[]; wall: WallSide; onEdit: () => void }) {
  const group = groupBoards(placed);
  if (!group) return null;
  const pad = 24;
  const svgWidth = 940;
  const svgHeight = 520;
  const scale = Math.min((svgWidth - 2 * pad) / group.width, (svgHeight - 100) / group.height);
  const baseline = svgHeight - 48;
  return <div className="flex h-full flex-col bg-[#f5f2e9]" data-testid="mastertrac-corner-elevation">
    <Heading placed={placed} wall={wall} view="Front elevation" />
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
      <svg role="img" aria-label={`MasterTrac ${group.corner.masterTracCorner.side} curved corner shelf and connected straight bays in front elevation`} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="max-h-full min-h-[260px] w-full max-w-[950px] rounded-lg bg-white shadow-sm">
        <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#faf9f5" />
        <line x1={pad} x2={svgWidth - pad} y1={baseline} y2={baseline} stroke="#6b625b" strokeWidth="2" />
        {group.boards.map((board) => {
          if (board.masterTracTowerRole === "corner-return") return null;
          const x = pad + ((board.wallOffset ?? group.start) - group.start) * scale;
          const w = board.width * scale;
          const h = (board.height ?? 0.75) * scale;
          const y = baseline - ((board.mountBottom ?? 0) + (board.height ?? 0.75)) * scale;
          const isCorner = isMasterTracCornerBoard(board);
          const fill = masterTracFinishColor(masterTracProduct(board.masterCode)?.finish ?? "Glacier White");
          return <g key={board.uid} data-sku={board.masterCode} data-testid={isCorner ? "mastertrac-corner-elevation-shelf" : undefined}>
            <rect x={x} y={y} width={Math.max(2, w)} height={Math.max(2, h)} fill={fill} stroke={isCorner ? "#a16b30" : "#827b73"} strokeDasharray={isCorner ? "4 2" : undefined} strokeWidth={isCorner ? 2 : 0.8} />
            {isCorner && <><text x={x + w / 2} y={y - 10} textAnchor="middle" fontSize="13" fill="#80430f">{board.masterCode} · {board.width}″ corner</text><path d={`M ${x + w * 0.18} ${y + 14} Q ${x + w * 0.48} ${y + 38} ${x + w * 0.82} ${y + 14}`} fill="none" stroke="#a16b30" strokeWidth="2" strokeDasharray="4 3" /></>}
          </g>;
        })}
        {group.boards.filter((board) => board.masterTracTowerRole === "corner-return").map((board) => {
          const x = pad + (group.corner.masterTracCorner.side === "start" ? 0 : group.width - board.width) * scale;
          return <g key={board.uid} data-testid="corner-return-elevation" data-sku={board.masterCode}>
            <rect x={x} y={baseline - (board.height ?? 87) * scale} width={Math.max(4, board.width * scale)} height={(board.height ?? 87) * scale} fill={masterTracFinishColor(masterTracProduct(board.masterCode)?.finish ?? "Glacier White")} stroke="#5d6870" strokeWidth="2" />
            <text x={x + (group.corner.masterTracCorner.side === "start" ? 72 : -72)} y="18" textAnchor="middle" fontSize="10" fill="#384756">Perpendicular upright · side view</text>
          </g>;
        })}
        {group.boards.filter((board) => board.masterTracTowerRole === "fixed-bottom").flatMap((board) => (board.masterTracStorageItems
          ? board.masterTracStorageItems.filter((item) => item.kind === "rod").map((item) => item.elevationIn)
          : board.masterTracConceptStorage?.kind === "rod" ? board.masterTracConceptStorage.rodHeightsIn ?? [] : []).map((height, index) => {
          const x = pad + ((board.wallOffset ?? group.start) - group.start) * scale;
          const y = baseline - height * scale;
          return <g key={`${board.uid}-rod-${index}`} data-testid="mastertrac-rod-elevation"><line x1={x} x2={x + board.width * scale} y1={y} y2={y} stroke="#7f8487" strokeWidth="5" /><text x={x + board.width * scale / 2} y={y - 7} textAnchor="middle" fontSize="10" fill="#3f484b">Rod · {height}″</text></g>;
        }))}
        {group.boards.filter((board) => board.masterTracTowerRole === "fixed-bottom").flatMap((board) => (board.masterTracStorageItems ?? []).filter((item) => item.kind === "drawer" || item.kind === "shoe").map((item, index) => {
          const x = pad + ((board.wallOffset ?? group.start) - group.start) * scale;
          const h = item.kind === "drawer" ? item.drawerSize === "small" ? 5 : 10 : 0.75;
          return <g key={`${board.uid}-item-${index}`} data-testid={`mastertrac-mixed-${item.kind}-elevation`}><rect x={x + 2} y={baseline - (item.elevationIn + h) * scale} width={board.width * scale - 4} height={Math.max(3, h * scale)} fill={item.kind === "drawer" ? "#b49b79" : "#b8a58b"} stroke="#756457" /><title>{item.kind} · {item.elevationIn}″ · illustrative</title></g>;
        }))}
        <text x={svgWidth / 2} y={svgHeight - 14} textAnchor="middle" fontSize="14" fill="#554c43">{group.width.toFixed(2)}″ straight-wall span · corner between two sourced uprights</text>
      </svg>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2 text-[11px] text-stone-700"><span>29.5 × 29.5 × 0.75″ is the sourced corner shelf bounding size. One sourced 14.5″-deep perpendicular upright is shown in side view; a complete return bay is not modeled. Curve, cam-lock connection and H-joint location are <strong>illustrative, not installation geometry</strong>.{placed.length > group.boards.length && ` Focused view: ${placed.length - group.boards.length} other placed items not shown.`}</span><button type="button" onClick={onEdit} className="rounded border border-stone-400 px-2 py-1 font-semibold">Edit connected towers</button></div>
  </div>;
}

/** A separate Closet-only Three.js scene; no edits to InteractiveRoom3D or kitchen meshes. */
export function MasterTracCorner3D({ placed, wall, onEdit }: { placed: PlacedCabinet[]; wall: WallSide; onEdit: () => void }) {
  const group = useMemo(() => groupBoards(placed), [placed]);
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = mount.current;
    if (!element || !group) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eae7df");
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    element.appendChild(renderer.domElement);
    renderer.domElement.dataset.testid = "mastertrac-corner-3d-canvas";
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
    const span = group.width * IN;
    camera.position.set(span * 0.77, 11.8, Math.max(10, span * 1.65));
    const target = new THREE.Vector3(span / 2, 3.4, 0.95);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.minDistance = 4;
    controls.maxDistance = 35;
    controls.update();
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.15);
    key.position.set(span / 2 - 1, 14, 7);
    key.castShadow = true;
    scene.add(key);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(16, span + 7), 11), new THREE.MeshStandardMaterial({ color: 0xddd8cb, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(span / 2, -0.04, 1);
    floor.receiveShadow = true;
    scene.add(floor);
    const assembly = masterTracCornerAssembly(group.boards);
    if (assembly) scene.add(assembly);
    const resize = () => {
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let active = true;
    let frame = 0;
    const tick = () => {
      if (!active) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      if (assembly) assembly.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      element.removeChild(renderer.domElement);
    };
  }, [group]);
  if (!group) return null;
  return <div className="flex h-full flex-col bg-[#eeeae0]" data-testid="mastertrac-corner-3d">
    <Heading placed={placed} wall={wall} view="3D closet assembly" />
    <div ref={mount} className="min-h-[320px] flex-1 overflow-hidden" aria-label="Rotateable MasterTrac curved-corner shelf and connected tower visualization" />
    <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2 text-[11px] text-stone-700"><span>Illustrative curve in the real 29.5″ SKU footprint · two 14.5″ mating edges meet actual sourced uprights on perpendicular walls. No complete return bay or cam-lock hole/fastener geometry is modeled. March 2022 List reference only; not an installation drawing.{placed.length > group.boards.length && ` Focused view: ${placed.length - group.boards.length} other placed items not shown.`}</span><button type="button" onClick={onEdit} className="rounded border border-stone-400 px-2 py-1 font-semibold">Edit connected towers</button></div>
  </div>;
}
