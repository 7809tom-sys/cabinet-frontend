/**
 * Admin: Door Box Blueprint (Tom, voice, Nov 21 2026, 11:59 AM and 12:00 PM CT).
 *
 * Shows the admin the 3D designer blueprint of a door's box: the DL shaker door
 * (stiles, rails, center panel, box dimensions) and the canonical slab door
 * reference the library falls back to every time. Raised panel and slim shaker
 * sections were added Nov 21 2026, 1:11 PM CT (Tom). Read-only. Numbers come from
 * shared/doorBoxBlueprint.ts, which reads the same constants the 3D Designer uses.
 * This screen does not touch InteractiveRoom3D, DesignTool, or the wall builder.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DL_SHAKER_FIRM_RULE,
  DL_SHAKER_REFERENCE_SOURCES,
  DL_SHAKER_SLAB_BELOW_IN,
  RAISED_PANEL_REFERENCE_SOURCES,
  SLAB_REFERENCE_SOURCES,
  SLIM_SHAKER_REFERENCE_SOURCES,
  TBD_CONFIRM_WITH_TOM,
  dlShakerDoorBox,
  raisedPanelDoorBox,
  slabDoorBox,
  slimShakerDoorBox,
  type DoorBoxBlueprint,
} from "@shared/doorBoxBlueprint";
import { PLATFORM_APPROVED_DOOR_STYLES, PLATFORM_DEFAULT_DOOR_STYLE } from "@shared/platformDoorDefaults";

const FINISH_HEX = "#e9e5dc";

const BOX_KIND_LABEL: Record<DoorBoxBlueprint["kind"], string> = {
  "dl-shaker": "DL shaker",
  slab: "Slab",
  "slim-shaker": "DL slim shaker",
  "raised-panel": "DL raised panel",
};

const PIECE_FILL: Partial<Record<string, string>> = {
  "center-panel": "rgba(207,227,255,0.08)",
  groove: "rgba(0,0,0,0.35)",
  bevel: "rgba(207,227,255,0.10)",
  "raised-panel": "rgba(207,227,255,0.28)",
};

function fmt(value: number): string {
  return `${Number(value.toFixed(3))}"`;
}

/** Dimensioned 2D front elevation plus a side section showing depth. */
export function DoorBoxBlueprintSvg({ box, testId }: { box: DoorBoxBlueprint; testId: string }) {
  const pad = 9;
  const sideGap = 6;
  const sideScale = 4; // depth is tiny; draw the side section 4x deeper so it reads
  const sideW = Math.max(1.5, box.depthIn * sideScale);
  const viewW = box.widthIn + pad * 2 + sideGap + sideW + 6;
  const viewH = box.heightIn + pad * 2;
  const ox = pad;
  const oy = pad;
  // SVG y grows down; blueprint y grows up from the bottom edge.
  const yTop = (yIn: number, hIn: number) => oy + box.heightIn - yIn - hIn;
  const stroke = 0.12;
  const font = Math.max(1.1, Math.min(box.widthIn, box.heightIn) / 14);
  const sideX = ox + box.widthIn + sideGap;
  return (
    <svg
      data-testid={testId}
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="w-full max-w-xl rounded border bg-[#0f2a4a]"
      role="img"
      aria-label={`${BOX_KIND_LABEL[box.kind]} door box blueprint ${box.widthIn} by ${box.heightIn} inches`}
    >
      <g stroke="#cfe3ff" strokeWidth={stroke} fill="none">
        {box.pieces.map((piece) => (
          <rect
            key={piece.id}
            data-piece={piece.id}
            x={ox + piece.xIn}
            y={yTop(piece.yIn, piece.heightIn)}
            width={piece.widthIn}
            height={piece.heightIn}
            fill={PIECE_FILL[piece.id] ?? "rgba(207,227,255,0.18)"}
          />
        ))}
        {/* Overall width */}
        <line x1={ox} y1={oy - 4} x2={ox + box.widthIn} y2={oy - 4} />
        <line x1={ox} y1={oy - 5} x2={ox} y2={oy - 1} />
        <line x1={ox + box.widthIn} y1={oy - 5} x2={ox + box.widthIn} y2={oy - 1} />
        {/* Overall height */}
        <line x1={ox - 4} y1={oy} x2={ox - 4} y2={oy + box.heightIn} />
        <line x1={ox - 5} y1={oy} x2={ox - 1} y2={oy} />
        <line x1={ox - 5} y1={oy + box.heightIn} x2={ox - 1} y2={oy + box.heightIn} />
        {/* Side section (depth, exaggerated) */}
        {box.pieces.filter((p) => p.id !== "center-panel").length > 0 && (
          <rect x={sideX} y={oy} width={sideW} height={box.heightIn} fill="rgba(207,227,255,0.18)" />
        )}
      </g>
      <g fill="#ffffff" fontSize={font} fontFamily="monospace" textAnchor="middle">
        <text x={ox + box.widthIn / 2} y={oy - 5.2}>{fmt(box.widthIn)} W</text>
        <text x={ox - 5.4} y={oy + box.heightIn / 2} transform={`rotate(-90 ${ox - 5.4} ${oy + box.heightIn / 2})`}>{fmt(box.heightIn)} H</text>
        <text x={sideX + sideW / 2} y={oy + box.heightIn + font * 1.4}>{fmt(box.depthIn)} D</text>
        {box.kind === "dl-shaker" && (
          <>
            <text x={ox + box.widthIn / 2} y={yTop(box.heightIn - box.frameIn, box.frameIn) + box.frameIn / 2 + font / 3}>top rail {fmt(box.frameIn)}</text>
            <text x={ox + box.widthIn / 2} y={yTop(0, box.frameIn) + box.frameIn / 2 + font / 3}>bottom rail {fmt(box.frameIn)}</text>
            <text x={ox + box.widthIn / 2} y={oy + box.heightIn / 2}>center panel</text>
            <text x={ox + box.widthIn / 2} y={oy + box.heightIn / 2 + font * 1.3}>
              {fmt(box.widthIn - box.frameIn * 2)} × {fmt(box.heightIn - box.frameIn * 2)}
            </text>
            <text x={ox + box.frameIn / 2} y={oy + box.heightIn / 2} transform={`rotate(-90 ${ox + box.frameIn / 2} ${oy + box.heightIn / 2})`}>stile {fmt(box.frameIn)}</text>
            <text x={ox + box.widthIn - box.frameIn / 2} y={oy + box.heightIn / 2} transform={`rotate(-90 ${ox + box.widthIn - box.frameIn / 2} ${oy + box.heightIn / 2})`}>stile {fmt(box.frameIn)}</text>
          </>
        )}
        {(box.kind === "slim-shaker" || box.kind === "raised-panel") && (
          <>
            <text x={ox + box.widthIn / 2} y={yTop(box.heightIn - box.frameIn, box.frameIn) + box.frameIn / 2 + font / 3}>top rail {fmt(box.frameIn)}</text>
            <text x={ox + box.widthIn / 2} y={yTop(0, box.frameIn) + box.frameIn / 2 + font / 3}>bottom rail {fmt(box.frameIn)}</text>
            <text x={ox + box.frameIn / 2} y={oy + box.heightIn / 2} transform={`rotate(-90 ${ox + box.frameIn / 2} ${oy + box.heightIn / 2})`}>stile {fmt(box.frameIn)}</text>
            <text x={ox + box.widthIn - box.frameIn / 2} y={oy + box.heightIn / 2} transform={`rotate(-90 ${ox + box.widthIn - box.frameIn / 2} ${oy + box.heightIn / 2})`}>stile {fmt(box.frameIn)}</text>
            {box.pieces.filter((p) => p.id === "center-panel" || p.id === "raised-panel").map((p) => (
              <g key={p.id}>
                <text x={ox + box.widthIn / 2} y={oy + box.heightIn / 2}>{p.id === "raised-panel" ? "raised panel" : "center panel"}</text>
                <text x={ox + box.widthIn / 2} y={oy + box.heightIn / 2 + font * 1.3}>{fmt(p.widthIn)} × {fmt(p.heightIn)}</text>
              </g>
            ))}
          </>
        )}
        {box.kind === "slab" && (
          <text x={ox + box.widthIn / 2} y={oy + box.heightIn / 2}>flat slab</text>
        )}
      </g>
    </svg>
  );
}

/** Small three.js preview of the same pieces. Loaded on mount only (browser). */
function DoorBox3DPreview({ box, testId }: { box: DoorBoxBlueprint; testId: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let cleanup = () => {};
    import("three")
      .then((THREE) => {
        if (disposed) return;
        const width = mount.clientWidth || 320;
        const height = 260;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#f4f6f8");
        const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
        const span = Math.max(box.widthIn, box.heightIn);
        camera.position.set(span * 0.9, span * 0.35, span * 1.9);
        camera.lookAt(0, 0, 0);
        let renderer: InstanceType<typeof THREE.WebGLRenderer>;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true });
        } catch {
          setFailed(true);
          return;
        }
        renderer.setSize(width, height);
        mount.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const key = new THREE.DirectionalLight(0xffffff, 0.9);
        key.position.set(span, span, span * 2);
        scene.add(key);
        const group = new THREE.Group();
        const frontDepth = box.depthIn;
        for (const piece of box.pieces) {
          const material = new THREE.MeshStandardMaterial({ color: FINISH_HEX, roughness: piece.id === "center-panel" ? 0.85 : 0.55 });
          if (piece.id === "center-panel") material.color.multiplyScalar(0.85);
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(piece.widthIn, piece.heightIn, piece.depthIn), material);
          mesh.position.set(
            piece.xIn + piece.widthIn / 2 - box.widthIn / 2,
            piece.yIn + piece.heightIn / 2 - box.heightIn / 2,
            piece.zIn ?? (piece.id === "center-panel" ? -(frontDepth - piece.depthIn) / 2 : 0),
          );
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x1f3a5c }));
          mesh.add(edges);
          group.add(mesh);
        }
        scene.add(group);
        let frame = 0;
        const animate = () => {
          group.rotation.y = Math.sin(Date.now() / 1800) * 0.5;
          renderer.render(scene, camera);
          frame = requestAnimationFrame(animate);
        };
        animate();
        cleanup = () => {
          cancelAnimationFrame(frame);
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      cleanup();
    };
  }, [box]);
  return (
    <div data-testid={testId} className="w-full max-w-xl">
      <div ref={mountRef} className="w-full overflow-hidden rounded border" style={{ minHeight: 260 }} />
      {failed && <p className="text-xs text-muted-foreground mt-1">3D preview is unavailable in this browser. The blueprint above has every dimension.</p>}
    </div>
  );
}

function PieceTable({ box }: { box: DoorBoxBlueprint }) {
  return (
    <table className="text-sm w-full max-w-xl">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1">Piece</th><th>W</th><th>H</th><th>D</th><th>From left</th><th>From bottom</th>
        </tr>
      </thead>
      <tbody>
        {box.pieces.map((piece) => (
          <tr key={piece.id} className="border-t">
            <td className="py-1">{piece.label}</td>
            <td>{fmt(piece.widthIn)}</td><td>{fmt(piece.heightIn)}</td><td>{fmt(piece.depthIn)}</td>
            <td>{fmt(piece.xIn)}</td><td>{fmt(piece.yIn)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** dlcabinetry.com values and the values still to confirm. Only the new sections pass these. */
function PublishedAndTbd({ box }: { box: DoorBoxBlueprint }) {
  return (
    <div className="space-y-2 text-sm">
      {box.published && box.published.length > 0 && (
        <div>
          <p className="font-medium">Published by DL Cabinetry (dlcabinetry.com)</p>
          <ul className="list-disc pl-5">{box.published.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}
      {box.tbd && box.tbd.length > 0 && (
        <div data-testid={`door-box-${box.kind}-tbd`} className="rounded border border-red-300 bg-red-50 p-2 text-red-900">
          <p className="font-semibold">{TBD_CONFIRM_WITH_TOM}</p>
          <ul className="list-disc pl-5">{box.tbd.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function Sources({ sources }: { sources: Record<string, string> }) {
  return (
    <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
      {Object.entries(sources).map(([key, value]) => (
        <li key={key}><code>{value}</code></li>
      ))}
    </ul>
  );
}

export type DoorBoxBlueprintViewProps = {
  widthIn: number;
  heightIn: number;
  railIn: 2.75 | 3;
  /** Off in server-rendered tests, which have no WebGL. */
  show3D?: boolean;
};

export function DoorBoxBlueprintView({ widthIn, heightIn, railIn, show3D = true }: DoorBoxBlueprintViewProps) {
  const shaker = useMemo(() => dlShakerDoorBox(widthIn, heightIn, railIn), [widthIn, heightIn, railIn]);
  const slab = useMemo(() => slabDoorBox(widthIn, heightIn), [widthIn, heightIn]);
  const raised = useMemo(() => raisedPanelDoorBox(widthIn, heightIn), [widthIn, heightIn]);
  const slim = useMemo(() => slimShakerDoorBox(widthIn, heightIn), [widthIn, heightIn]);
  return (
    <div className="space-y-6">
      <div data-testid="platform-default-door-style" className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
        <p>
          <span className="font-semibold">Platform default starter style: {PLATFORM_DEFAULT_DOOR_STYLE.label}.</span>{" "}
          Every distributor starts here when it has no saved door style. Also approved:
        </p>
        <ul className="mt-1 flex flex-wrap gap-2">
          {PLATFORM_APPROVED_DOOR_STYLES.map((style) => (
            <li key={style.id}>
              <a className="underline" href={`#door-box-${style.id}`}>
                {style.label}{style.id === PLATFORM_DEFAULT_DOOR_STYLE.id ? " (default)" : ""}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="dl-shaker-firm-rule" className="rounded border-2 border-amber-500 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
        {DL_SHAKER_FIRM_RULE} Any shaker door chosen or rendered in the Designer uses the DL shaker blueprint below.
      </div>

      <Card id="door-box-dl-shaker" data-testid="door-box-dl-shaker">
        <CardHeader><CardTitle>DL shaker door box</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {shaker.smallFrontSlab && (
            <p className="text-sm text-amber-800">This size is under {DL_SHAKER_SLAB_BELOW_IN}" tall or wide, so the Designer renders it as a plain slab (small front rule).</p>
          )}
          <DoorBoxBlueprintSvg box={shaker} testId="door-box-dl-shaker-svg" />
          {show3D && <DoorBox3DPreview box={shaker} testId="door-box-dl-shaker-3d" />}
          <PieceTable box={shaker} />
          <ul className="text-sm list-disc pl-5">{shaker.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          <Sources sources={DL_SHAKER_REFERENCE_SOURCES} />
        </CardContent>
      </Card>

      <Card id="door-box-slab" data-testid="door-box-slab">
        <CardHeader>
          <CardTitle>Slab door — canonical slab reference</CardTitle>
          <p className="text-sm text-muted-foreground">
            This is the generic slab door the library pulls from every time. A slab style has no library entry, so the Designer
            draws this one flat panel at the face size, in the style's own color (solid) or grain (wood).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <DoorBoxBlueprintSvg box={slab} testId="door-box-slab-svg" />
          {show3D && <DoorBox3DPreview box={slab} testId="door-box-slab-3d" />}
          <PieceTable box={slab} />
          <ul className="text-sm list-disc pl-5">{slab.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          <Sources sources={SLAB_REFERENCE_SOURCES} />
          <p className="text-xs text-muted-foreground">
            Five-piece fronts are not this slab: a five-piece front stays five-piece and is never replaced by the plain slab reference.
            No separate five-piece-slab geometry exists in the code today, so it is not shown as its own reference.
          </p>
        </CardContent>
      </Card>

      <Card id="door-box-raised-panel" data-testid="door-box-raised-panel">
        <CardHeader>
          <CardTitle>DL raised panel door box</CardTitle>
          <p className="text-sm text-muted-foreground">Approved DL Cabinetry style (Glacier White). The 3D Designer's raised panel geometry, with DL's published values and anything still unconfirmed.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <DoorBoxBlueprintSvg box={raised} testId="door-box-raised-panel-svg" />
          {show3D && <DoorBox3DPreview box={raised} testId="door-box-raised-panel-3d" />}
          <PieceTable box={raised} />
          <ul className="text-sm list-disc pl-5">{raised.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          <PublishedAndTbd box={raised} />
          <Sources sources={RAISED_PANEL_REFERENCE_SOURCES} />
        </CardContent>
      </Card>

      <Card id="door-box-slim-shaker" data-testid="door-box-slim-shaker">
        <CardHeader>
          <CardTitle>DL slim shaker door box</CardTitle>
          <p className="text-sm text-muted-foreground">Approved DL Cabinetry style (Slim Shaker Alabaster, Slim Shaker Ebony). Its own 1 inch frame, not the 2.75/3 inch DL shaker template above.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <DoorBoxBlueprintSvg box={slim} testId="door-box-slim-shaker-svg" />
          {show3D && <DoorBox3DPreview box={slim} testId="door-box-slim-shaker-3d" />}
          <PieceTable box={slim} />
          <ul className="text-sm list-disc pl-5">{slim.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          <PublishedAndTbd box={slim} />
          <Sources sources={SLIM_SHAKER_REFERENCE_SOURCES} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DoorBoxBlueprintAdmin() {
  const [widthIn, setWidthIn] = useState(15);
  const [heightIn, setHeightIn] = useState(30);
  const [railIn, setRailIn] = useState<2.75 | 3>(3);
  const clamp = (value: number, fallback: number) => (Number.isFinite(value) && value > 0 ? Math.min(value, 96) : fallback);
  return (
    <div className="space-y-4" data-testid="door-box-blueprint-admin">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="door-box-width">Door width (in)</Label>
          <Input id="door-box-width" type="number" min={1} step={0.125} value={widthIn} onChange={(e) => setWidthIn(clamp(Number(e.target.value), 15))} className="w-28" />
        </div>
        <div>
          <Label htmlFor="door-box-height">Door height (in)</Label>
          <Input id="door-box-height" type="number" min={1} step={0.125} value={heightIn} onChange={(e) => setHeightIn(clamp(Number(e.target.value), 30))} className="w-28" />
        </div>
        <div>
          <Label htmlFor="door-box-rail">Rail / stile (in)</Label>
          <select id="door-box-rail" className="h-9 rounded border px-2" value={railIn} onChange={(e) => setRailIn(Number(e.target.value) === 2.75 ? 2.75 : 3)}>
            <option value={3}>3 (Designer default)</option>
            <option value={2.75}>2.75</option>
          </select>
        </div>
      </div>
      <DoorBoxBlueprintView widthIn={widthIn} heightIn={heightIn} railIn={railIn} />
    </div>
  );
}
