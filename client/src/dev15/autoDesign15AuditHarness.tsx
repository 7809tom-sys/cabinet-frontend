/**
 * Dev-only audit harness for the Auto Design 15-rule spec (Nov 13 2026).
 * Loaded from /dev/auto-design-15-audit.html; imported by nothing in the app.
 *
 *   ?scenario=<id>   one instant design from AUDIT_SCENARIOS: the real 3D engine render,
 *                    a plain elevation per wall (continuous upper runs outlined, counter
 *                    landings between sink / fridge / range marked, fillers highlighted),
 *                    and every rule finding the build produced.
 *   ?scene=popup             the faucet & sink pop-up as it opens with the Designer.
 *   ?scene=popup-dismissed   the same page after "Skip for now".
 *   ?scene=intake            the Auto Design intake questions (rules 1, 2, 11, 12).
 *
 * Sink and faucet rows come from the repo's pelicanCatalogRows fixture with their
 * fixture prices; nothing is invented.
 */
import "@/index.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "@/components/design/InteractiveRoom3D";
import { DesignerFixturePickPopup, type FixturePick } from "@/components/design/DesignerFixturePickPopup";
import { AutoDesignIntakeSection } from "@/components/design/AutoDesignIntakeSection";
import { RESTORED_DOOR_LIGHTS } from "@shared/doorRenderLights";
import { wallRunOffset, wallRunSpan, type PlacedCabinet, type RoomData } from "@/lib/design";
import { emptyAutoDesignIntake, type AutoDesignIntake } from "@/lib/autoDesignFifteenRules";
import pelicanRows from "@/lib/__fixtures__/pelicanCatalogRows.json";
import { AUDIT_SCENARIOS, runAuditScenario, type AuditResult } from "./autoDesign15AuditScenarios";

declare global { interface Window { auditReady?: boolean; auditSummary?: unknown } }

const PARAMS = new URLSearchParams(window.location.search);
const INCH = 1 / 12;
const GREEN = "#244338";
const GOLD = "#d7a46c";
const CREAM = "#fffdf9";
const SAND = "#f6f3ed";

function wallKeyFor(item: PlacedCabinet): string | null {
  const wall = item.wallId;
  return wall === "left" || wall === "right" ? wall : "top";
}

function render3D(host: HTMLElement, room: RoomData, placed: readonly PlacedCabinet[]) {
  const width = 860;
  const height = 520;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = RESTORED_DOOR_LIGHTS.exposure;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eeeae2");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = RESTORED_DOOR_LIGHTS.environment;
  const roomW = room.width * INCH;
  const roomD = room.depth * INCH;
  const ceiling = (room.ceilingHeight ?? 96) * INCH;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW * 1.4, roomD * 1.4), new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: "#f6f4ef", roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(roomW, ceiling, 4 * INCH), wallMat);
  back.position.set(roomW / 2, ceiling / 2, -2 * INCH);
  scene.add(back);
  const walls = new Set(placed.map((item) => item.wallId));
  if (walls.has("right")) {
    const right = new THREE.Mesh(new THREE.BoxGeometry(4 * INCH, ceiling, roomD), wallMat);
    right.position.set(roomW + 2 * INCH, ceiling / 2, roomD / 2);
    scene.add(right);
  }
  if (walls.has("left")) {
    const left = new THREE.Mesh(new THREE.BoxGeometry(4 * INCH, ceiling, roomD), wallMat);
    left.position.set(-2 * INCH, ceiling / 2, roomD / 2);
    scene.add(left);
  }
  scene.add(new THREE.HemisphereLight(RESTORED_DOOR_LIGHTS.hemisphere.sky, RESTORED_DOOR_LIGHTS.hemisphere.ground, RESTORED_DOOR_LIGHTS.hemisphere.intensity));
  const key = new THREE.DirectionalLight(RESTORED_DOOR_LIGHTS.key.color, RESTORED_DOOR_LIGHTS.key.intensity);
  key.position.set(roomW * 0.6, ceiling + 2, roomD * 1.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(RESTORED_DOOR_LIGHTS.fill.color, RESTORED_DOOR_LIGHTS.fill.intensity);
  fill.position.set(-roomW * 0.5, ceiling * 0.7, roomD * 1.3);
  scene.add(fill);
  const root = new THREE.Group();
  scene.add(root);
  for (const cabinet of placed) {
    const sku = existingCabinetSku(cabinet, room);
    const transform = existingCabinetTransform(cabinet, room, placed);
    addCabinet(root, { ...sku, catalogImageUrl: null }, wallKeyFor(cabinet), { back: 0, left: 0, right: 0, front: 0 },
      room.width, room.depth, "#e9dfcc", "#eeeeee", undefined, transform, null, undefined,
      { countertop: null, selectedToeKick: false });
  }
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 300);
  const corner = walls.has("right") || walls.has("left");
  if (walls.has("bottom") || placed.some((item) => item.wallId && !["top", "left", "right", "bottom"].includes(item.wallId))) {
    // Peninsula or a front-wall run: look down from above the open side so nothing blocks the view.
    camera.position.set(roomW * 0.5, 17, roomD * 1.25);
    camera.lookAt(roomW * 0.5, 0, roomD * 0.45);
  } else if (corner) {
    camera.position.set(roomW * 0.15, 6.2, roomD * 1.05);
    camera.lookAt(roomW * 0.62, 3.0, roomD * 0.3);
  } else {
    camera.position.set(roomW * 0.5, 5.8, roomD * 0.95);
    camera.lookAt(roomW * 0.5, 3.4, 0);
  }
  renderer.render(scene, camera);
  return () => renderer.render(scene, camera);
}

const isFillerItem = (item: PlacedCabinet) => /filler/i.test(`${item.description ?? ""} ${item.subCategory ?? ""}`) || /^(?:B|W|T)?F\d|^FOL/i.test(item.masterCode);

function itemBottom(item: PlacedCabinet): number {
  const mount = Number((item as { mountBottom?: number }).mountBottom);
  if (Number.isFinite(mount) && mount > 0) return mount;
  return item.placement === "wall" ? 54 : 0;
}

function wallLength(wallId: string, room: RoomData, placed: readonly PlacedCabinet[]): number {
  const own = placed.filter((item) => item.wallId === wallId);
  const reach = Math.max(0, ...own.map((item) => wallRunOffset(item, wallId, room) + wallRunSpan(item, wallId, room)));
  const nominal = wallId === "top" || wallId === "bottom" ? room.width : wallId === "left" || wallId === "right" ? room.depth : reach;
  return Math.max(nominal, reach);
}

function Elevation({ wallId, result }: { wallId: string; result: AuditResult }) {
  const room = result.scenario.room;
  const items = result.placed.filter((item) => item.wallId === wallId);
  const length = wallLength(wallId, room, result.placed);
  const scale = Math.min(5, 1180 / Math.max(length, 1));
  const tall = 100;
  const H = tall * scale + 46;
  const y = (inches: number) => 20 + (tall - inches) * scale;
  const runs = result.wallRuns.filter((run) => run.wallId === wallId);
  const landings = result.landing.filter((gap) => gap.wallId === wallId);
  const pos = new Map(items.map((item) => [item.uid, { start: wallRunOffset(item, wallId, room), span: wallRunSpan(item, wallId, room) }]));
  const label = wallId === "top" ? "Back wall (Wall 1)" : wallId === "right" ? "Right wall (Wall 2)" : wallId === "bottom" ? "Front wall (Wall 3)" : wallId === "left" ? "Left wall" : "Peninsula";
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ font: "600 14px system-ui", color: GREEN }}>{label} — {Math.round(length * 10) / 10} in</div>
      <svg width={length * scale + 20} height={H} style={{ background: CREAM, border: `1px solid #d4d0c8` }}>
        <line x1={10} x2={10 + length * scale} y1={y(0)} y2={y(0)} stroke="#555" strokeWidth={2} />
        {items.map((item) => {
          const p = pos.get(item.uid)!;
          const h = Number(item.height) || 34.5;
          const b = itemBottom(item);
          const filler = isFillerItem(item);
          const appliance = item.placement === "appliance";
          return (
            <g key={item.uid}>
              <rect x={10 + p.start * scale} y={y(b + h)} width={Math.max(1, p.span * scale)} height={h * scale}
                fill={filler ? GOLD : appliance ? "#d6d6d6" : SAND} stroke={appliance ? "#777" : GREEN} strokeWidth={1} />
              {p.span * scale > 22 ? (
                <text x={10 + (p.start + p.span / 2) * scale} y={y(b + h / 2)} textAnchor="middle" fontSize={Math.min(12, p.span * scale / 6)} fill="#222" fontFamily="system-ui">{item.masterCode}</text>
              ) : null}
            </g>
          );
        })}
        {runs.filter((run) => run.uids.length >= 2).map((run, index) => (
          <rect key={`run-${index}`} x={10 + run.startIn * scale - 2} y={y(run.topIn) - 2} width={(run.endIn - run.startIn) * scale + 4} height={(run.topIn - run.bottomIn) * scale + 4}
            fill="none" stroke={GREEN} strokeWidth={3} strokeDasharray="8 4" />
        ))}
        {landings.map((gap, index) => {
          const from = pos.get(gap.from.uid);
          const to = pos.get(gap.to.uid);
          if (!from || !to) return null;
          const a = Math.min(from.start + from.span, to.start + to.span);
          const bEnd = Math.max(from.start, to.start);
          const x1 = 10 + Math.min(a, bEnd) * scale;
          const x2 = 10 + Math.max(a, bEnd) * scale;
          const color = gap.status === "ok" ? GREEN : gap.status === "tight" ? GOLD : "#8a2b1f";
          return (
            <g key={`gap-${index}`}>
              <line x1={x1} x2={x2} y1={y(36.5)} y2={y(36.5)} stroke={color} strokeWidth={4} />
              <text x={(x1 + x2) / 2} y={y(38.5)} textAnchor="middle" fontSize={12} fontWeight={700} fill={color} fontFamily="system-ui">
                {Math.round(gap.gapIn * 10) / 10} in {gap.status === "ok" ? "" : gap.status === "tight" ? "(under 18)" : "(under 15)"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ScenarioPage({ result }: { result: AuditResult }) {
  const s = result.scenario;
  const walls = Array.from(new Set(result.placed.map((item) => item.wallId ?? "island"))).sort();
  const ruleFindings = result.findings.filter((f) => f.ruleId.startsWith("auto-design-rule"));
  const warnings = result.findings.filter((f) => !f.ruleId.startsWith("auto-design-rule") && f.severity === "warning");
  const groupedWarnings = new Map<string, number>();
  for (const w of warnings) groupedWarnings.set(`${w.ruleId}: ${w.title.replace(/^\S+ keeps/, "… keeps")}`, (groupedWarnings.get(`${w.ruleId}: ${w.title.replace(/^\S+ keeps/, "… keeps")}`) ?? 0) + 1);
  const intake = s.intake;
  return (
    <div style={{ padding: 16, font: "13px system-ui", color: "#222", width: 1560 }}>
      <div style={{ font: "700 20px system-ui", color: GREEN }}>{s.id} — {s.title}</div>
      <div style={{ marginTop: 4, color: "#555" }}>
        Line {s.styleId}{s.dropSb33 ? " (SB33 removed from the line for this test)" : ""} · Room {s.room.width} × {s.room.depth} in · Construction: {intake.construction}
        {intake.canMove && Object.values(intake.canMove).some((v) => v === false) ? ` · Can't move: ${Object.entries(intake.canMove).filter(([, v]) => v === false).map(([k]) => k).join(", ")}` : ""}
        {intake.preferences.length ? ` · Picks: ${intake.preferences.join(", ")}` : ""}
        {intake.islandOrPeninsula !== "none" ? ` · ${intake.islandOrPeninsula} (${intake.peninsulaSide ?? "-"})` : ""}
      </div>
      {!result.ok ? (
        <div data-testid="audit-failed" style={{ marginTop: 14, padding: 14, border: "2px solid #8a2b1f", background: "#fbf1ee", maxWidth: 1200, fontSize: 15 }}>
          <b>No layout was built.</b><br />{result.message}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            <div id="three" style={{ width: 860, height: 520, border: "1px solid #d4d0c8" }} />
            <div style={{ flex: 1, maxHeight: 520, overflow: "hidden" }}>
              <div style={{ font: "700 14px system-ui", color: GREEN }}>Measured checks</div>
              <ul style={{ margin: "4px 0 8px 18px", padding: 0, lineHeight: 1.45 }}>
                <li>Sink base: <b>{result.sinkBaseCode ?? "none"}</b> · Fridge: <b>{result.fridgeWidth ?? "none"}{result.fridgeWidth ? " in" : ""}</b> (as asked; never auto-downsized)</li>
                <li>Landings: {result.landing.length ? result.landing.map((g) => `${g.from.role}→${g.to.role} ${Math.round(g.gapIn * 10) / 10} in (${g.status})`).join("; ") : "no adjacent sink/fridge/range pair on one wall"}</li>
                <li>Fillers: <b>{result.fillers}</b>{result.fillerCodes.length ? ` (${result.fillerCodes.join(", ")})` : ""}</li>
                <li>Smaller-before-bigger runs: {result.smallerFirst.length ? result.smallerFirst.map((v) => `${v.wallId}: ${v.widths.join("+")}`).join("; ") : "none"}</li>
                <li>Upper runs: {result.wallRuns.map((r) => `${r.wallId} ${Math.round(r.startIn)}–${Math.round(r.endIn)} (${r.uids.length})`).join("; ")}</li>
                <li>Corners: {result.corners.length ? result.corners.join("; ") : "none seated"} · Peninsula: {result.peninsula ? "built" : "no"}</li>
                <li>Wiggle moves: {result.wiggleMoves.length ? result.wiggleMoves.map((m) => `${m.kind} ${m.deltaAlongIn > 0 ? "+" : ""}${m.deltaAlongIn} in`).join(", ") : "none"}</li>
              </ul>
              <div style={{ font: "700 14px system-ui", color: GREEN }}>15-rule findings (review list)</div>
              <ul style={{ margin: "4px 0 8px 18px", padding: 0, lineHeight: 1.4 }}>
                {ruleFindings.map((f, i) => (
                  <li key={i}><span style={{ color: f.severity === "warning" ? "#8a2b1f" : GREEN, fontWeight: 600 }}>{f.ruleId.replace("auto-design-", "")} · {f.title}</span> — {f.detail}</li>
                ))}
              </ul>
              {groupedWarnings.size ? (
                <>
                  <div style={{ font: "700 14px system-ui", color: "#8a2b1f" }}>Other engine warnings</div>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.35 }}>
                    {Array.from(groupedWarnings.entries()).map(([k, n]) => <li key={k}>{k}{n > 1 ? ` ×${n}` : ""}</li>)}
                  </ul>
                </>
              ) : null}
            </div>
          </div>
          <div style={{ marginTop: 6, color: "#555" }}>
            Elevations: <span style={{ color: GREEN, fontWeight: 700 }}>dashed green frame</span> = one continuous wall-cabinet run ·
            <span style={{ color: GOLD, fontWeight: 700 }}> gold box</span> = filler · line + label on the counter = landing between sink / fridge / range (green ≥ 18, gold 15–18, red under 15)
          </div>
          {walls.map((wallId) => <Elevation key={wallId} wallId={wallId} result={result} />)}
        </>
      )}
    </div>
  );
}

type Row = { id: number; pelicanCode: string; name: string; category: string | null; subCategory: string | null; sellPrice: number | null; size: string | null };
const ROWS = (pelicanRows as unknown as Row[]);
const SINKS = ROWS.filter((row) => row.subCategory === "Sinks").slice(0, 6).map((row) => ({ ...row, imageUrl: null }));
const FAUCETS = ROWS.filter((row) => row.subCategory === "Faucets").slice(0, 6).map((row) => ({ ...row, imageUrl: null }));

function PopupScene({ dismissed }: { dismissed: boolean }) {
  const [open, setOpen] = useState(true);
  const [pick, setPick] = useState<FixturePick | null>(null);
  return (
    <div style={{ padding: 24, font: "14px system-ui", width: 1200, height: 860, background: SAND }}>
      <div style={{ font: "700 20px system-ui", color: GREEN }}>Kitchen Designer (audit stand-in page behind the pop-up)</div>
      <div data-testid="designer-behind" style={{ marginTop: 8 }}>
        Pop-up open: <b data-testid="popup-state">{open ? "yes" : "no"}</b> · Saved pick: <b>{pick ? `sink ${pick.sinkId ?? "-"}, faucet ${pick.faucetId ?? "-"}` : "none"}</b>
        {dismissed ? " · (this shot is taken after clicking “Skip for now”)" : ""}
      </div>
      <DesignerFixturePickPopup open={open} sinkProducts={SINKS as never} faucetProducts={FAUCETS as never} loading={false}
        onSave={(next) => { setPick(next); setOpen(false); }} onDismiss={() => setOpen(false)} />
    </div>
  );
}

function IntakeScene() {
  const [intake, setIntake] = useState<AutoDesignIntake>(() => ({ ...emptyAutoDesignIntake(), construction: "old", canMove: { electrical: true, plumbing: false, rangeHookup: true, sinkBase: false }, preferences: ["dishwasher", "lazy-susan", "lots-of-drawers"] } as AutoDesignIntake));
  return (
    <div style={{ padding: 24, width: 900, background: CREAM }}>
      <div style={{ font: "700 20px system-ui", color: GREEN, marginBottom: 12 }}>Auto Design — intake questions (rules 1, 2, 11, 12)</div>
      <AutoDesignIntakeSection intake={intake} onChange={setIntake} />
    </div>
  );
}

const scene = PARAMS.get("scene");
const scenarioId = PARAMS.get("scenario");
const rootEl = document.getElementById("root")!;
const reactRoot = createRoot(rootEl);
if (scene === "popup" || scene === "popup-dismissed") {
  reactRoot.render(<PopupScene dismissed={scene === "popup-dismissed"} />);
  setTimeout(() => { window.auditReady = true; }, 600);
} else if (scene === "intake") {
  reactRoot.render(<IntakeScene />);
  setTimeout(() => { window.auditReady = true; }, 600);
} else {
  const scenario = AUDIT_SCENARIOS.find((s) => s.id === scenarioId) ?? AUDIT_SCENARIOS[0]!;
  const result = runAuditScenario(scenario);
  window.auditSummary = { id: scenario.id, ok: result.ok, message: result.message };
  reactRoot.render(<ScenarioPage result={result} />);
  setTimeout(() => {
    const host = document.getElementById("three");
    if (host && result.ok) {
      try {
        const rerender = render3D(host, scenario.room, result.placed);
        setTimeout(() => { rerender(); window.auditReady = true; }, 1500);
      } catch (error) {
        host.textContent = `3D render failed: ${(error as Error).message}`;
        window.auditReady = true;
      }
    } else {
      window.auditReady = true;
    }
  }, 300);
}
