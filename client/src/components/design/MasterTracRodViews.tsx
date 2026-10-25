import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { masterTracFinishColor, masterTracProduct } from "@/lib/closet";
import type { PlacedCabinet, WallSide } from "@/lib/design";
import { isMasterTracCornerBoard } from "@/lib/masterTracTower";
import { addIllustrativeTowerMixedStorage, addIllustrativeTowerRods, addStraightBoard } from "./MasterTracCornerViews";

const IN = 1 / 12;

function rodGroup(placed: PlacedCabinet[]) {
  const anchor = placed.find((board) => board.masterTracTowerRole === "fixed-bottom" && (board.masterTracConceptStorage?.kind === "rod" || board.masterTracStorageItems?.some((item) => item.kind !== "shelf")));
  if (!anchor?.masterTracTowerId) return null;
  const boards = placed.filter((board) => board.masterTracTowerId === anchor.masterTracTowerId);
  const start = Math.min(...boards.map((board) => board.wallOffset ?? 0));
  const end = Math.max(...boards.map((board) => (board.wallOffset ?? 0) + board.width));
  const height = Math.max(...boards.map((board) => (board.mountBottom ?? 0) + (board.height ?? 0)));
  return { anchor, boards, start, width: end - start, height };
}

export function masterTracRodAssembly(placed: PlacedCabinet[]): THREE.Group | null {
  const group = rodGroup(placed);
  if (!group) return null;
  const root = new THREE.Group();
  for (const board of group.boards) {
    // The dedicated mixed-storage preview supports straight towers; curved corners use their own Closet assembly.
    if (isMasterTracCornerBoard(board)) continue;
    const x = (board.wallOffset ?? group.start) - group.start;
    addStraightBoard(root, board, x);
    addIllustrativeTowerRods(root, board, x);
    addIllustrativeTowerMixedStorage(root, board, x);
  }
  root.userData = { masterTracRodTower: true, widthIn: group.width, notInstallationGeometry: true };
  return root;
}

function Header({ width, wall, view }: { width: number; wall: WallSide; view: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-[#192432] px-4 py-3 text-xs text-white"><strong className="text-sm">MasterTrac Closet · {view}</strong><span>{wall} wall · {width.toFixed(2)}″ overall · 2022 List reference only</span></div>;
}

export function MasterTracRodElevation({ placed, wall, onEdit }: { placed: PlacedCabinet[]; wall: WallSide; onEdit: () => void }) {
  const group = rodGroup(placed);
  if (!group) return null;
  const pad = 24, width = 940, height = 520, baseline = 472;
  const scale = Math.min((width - 2 * pad) / group.width, (height - 100) / group.height);
  const origin = (width - group.width * scale) / 2;
  return <div className="flex h-full flex-col bg-[#f5f2e9]" data-testid="mastertrac-rod-elevation">
    <Header width={group.width} wall={wall} view="Front elevation" />
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3"><svg role="img" aria-label="MasterTrac connected tower with sourced rods and calculated cups; rod section illustrated" viewBox={`0 0 ${width} ${height}`} className="max-h-full min-h-[260px] w-full max-w-[950px] rounded-lg bg-white shadow-sm">
      <rect width={width} height={height} fill="#faf9f5" /><line x1={origin - pad} x2={origin + group.width * scale + pad} y1={baseline} y2={baseline} stroke="#6b625b" strokeWidth="2" />
      {group.boards.map((board) => {
        const x = origin + ((board.wallOffset ?? group.start) - group.start) * scale;
        const y = baseline - ((board.mountBottom ?? 0) + (board.height ?? 0.75)) * scale;
        return <rect key={board.uid} data-sku={board.masterCode} x={x} y={y} width={Math.max(2, board.width * scale)} height={Math.max(2, (board.height ?? 0.75) * scale)} fill={masterTracFinishColor(masterTracProduct(board.masterCode)?.finish ?? "Glacier White")} stroke="#827b73" />;
      })}
      {group.boards.filter((board) => board.masterTracTowerRole === "fixed-bottom").flatMap((board) => (board.masterTracStorageItems
        ? board.masterTracStorageItems.filter((item) => item.kind === "rod").map((item) => item.elevationIn)
        : board.masterTracConceptStorage?.kind === "rod" ? board.masterTracConceptStorage.rodHeightsIn ?? [] : []).map((elevation, index) => {
        const x = origin + ((board.wallOffset ?? group.start) - group.start) * scale;
        const y = baseline - elevation * scale;
        return <g key={`${board.uid}-${index}`} data-testid="mastertrac-rod-elevation-line"><line x1={x} x2={x + board.width * scale} y1={y} y2={y} stroke="#747a7e" strokeWidth="5" /><circle cx={x} cy={y} r="5" fill="#5b6265" /><circle cx={x + board.width * scale} cy={y} r="5" fill="#5b6265" /><text x={x + board.width * scale / 2} y={y - 9} textAnchor="middle" fontSize="11" fill="#3f484b">Rod · {elevation}″</text></g>;
      }))}
      {group.boards.filter((board) => board.masterTracTowerRole === "fixed-bottom").flatMap((board) => (board.masterTracStorageItems ?? []).filter((item) => item.kind === "drawer" || item.kind === "shoe").map((item, index) => {
        const x = origin + ((board.wallOffset ?? group.start) - group.start) * scale;
        const h = item.kind === "drawer" ? item.drawerSize === "small" ? 5 : 10 : 0.75;
        return <g key={`${board.uid}-mixed-${index}`} data-testid={`mastertrac-mixed-${item.kind}-elevation`}><rect x={x + 2} y={baseline - (item.elevationIn + h) * scale} width={board.width * scale - 4} height={Math.max(3, h * scale)} fill={item.kind === "drawer" ? "#b49b79" : "#b8a58b"} stroke="#756457" /><title>{item.kind} · {item.elevationIn}″ · illustrative</title></g>;
      }))}
      <text x={width / 2} y={height - 14} textAnchor="middle" fontSize="13" fill="#554c43">{group.width.toFixed(2)}″ total · shared uprights · 2 cups per rod</text>
    </svg></div>
    <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2 text-[11px] text-stone-700"><span>Drawer fronts, shoe tilt, rod/cup section and hole positions are <strong>illustrative, not installation geometry</strong>.{placed.length > group.boards.length && ` Focused view: ${placed.length - group.boards.length} other placed items not shown.`}</span><button type="button" onClick={onEdit} className="rounded border border-stone-400 px-2 py-1 font-semibold">Edit connected towers</button></div>
  </div>;
}

export function MasterTracRod3D({ placed, wall, onEdit }: { placed: PlacedCabinet[]; wall: WallSide; onEdit: () => void }) {
  const group = useMemo(() => rodGroup(placed), [placed]);
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = mount.current;
    if (!element || !group) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#eae7df");
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.dataset.testid = "mastertrac-rod-3d-canvas";
    element.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
    const span = group.width * IN;
    camera.position.set(span * 0.77, 11.8, Math.max(10, span * 1.65));
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(span / 2, 3.4, 0.95); controls.enableDamping = true; controls.update();
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const light = new THREE.DirectionalLight(0xffffff, 2.15); light.position.set(span / 2 - 1, 14, 7); scene.add(light);
    const assembly = masterTracRodAssembly(group.boards);
    if (assembly) scene.add(assembly);
    const resize = () => { camera.aspect = Math.max(1, element.clientWidth) / Math.max(1, element.clientHeight); camera.updateProjectionMatrix(); renderer.setSize(Math.max(1, element.clientWidth), Math.max(1, element.clientHeight), false); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    let active = true, frame = 0;
    const tick = () => { if (!active) return; controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(tick); }; tick();
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); assembly?.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) { object.geometry.dispose(); const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach((material) => material.dispose()); } }); renderer.dispose(); element.removeChild(renderer.domElement); };
  }, [group]);
  if (!group) return null;
  return <div className="flex h-full flex-col bg-[#eeeae0]" data-testid="mastertrac-rod-3d"><Header width={group.width} wall={wall} view="3D mixed storage" /><div ref={mount} className="min-h-[320px] flex-1 overflow-hidden" aria-label="Rotateable MasterTrac connected tower with sourced parts and illustrative mixed storage" /><div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2 text-[11px] text-stone-700"><span>Source-backed List part quantities; drawer fronts, shoe tilt, rod/cup profiles and hardware fit are <strong>illustrative</strong>. Rotate to inspect, not an installation drawing.{placed.length > group.boards.length && ` Focused view: ${placed.length - group.boards.length} other placed items not shown.`}</span><button type="button" onClick={onEdit} className="rounded border border-stone-400 px-2 py-1 font-semibold">Edit connected towers</button></div></div>;
}
