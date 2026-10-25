/**
 * AR Tape Measure
 *
 * Two modes:
 *  1. WebXR hit-test (Android Chrome + ARCore) — live AR ruler overlay with
 *     a rendered reticle ring, placed-point markers, and a distance line.
 *  2. Photo reference measurement (all browsers) — upload/capture photo with a
 *     known reference object and tap two points to measure real-world distance.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearch } from "wouter";
import {
  ArrowLeft, Camera, Ruler, RefreshCw, Info, CheckCircle,
  AlertTriangle, Trash2, Copy, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "detecting" | "webxr" | "photo";
type PhotoStep = "capture" | "ref-point-1" | "ref-point-2" | "meas-point-1" | "meas-point-2" | "result";

interface Point { x: number; y: number }
interface Vec3 { x: number; y: number; z: number }

// Known reference object sizes in mm
const REFERENCE_OBJECTS = [
  { label: "Credit Card (width)", mm: 85.6 },
  { label: "Credit Card (height)", mm: 53.98 },
  { label: "US Dollar Bill (length)", mm: 156 },
  { label: "US Dollar Bill (width)", mm: 66.3 },
  { label: "US Quarter (diameter)", mm: 24.26 },
  { label: "iPhone 15 (height)", mm: 147.6 },
  { label: "Standard Brick (length)", mm: 194 },
];

// ─── WebGL helpers ────────────────────────────────────────────────────────────

function createShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

function createProgram(gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, createShader(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(p, createShader(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  return p;
}

// Build a flat ring (annulus) in the XZ plane centred at origin.
function buildRingGeometry(outerR: number, innerR: number, segments: number): Float32Array {
  const verts: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    verts.push(outerR * cos, 0, outerR * sin);
    verts.push(innerR * cos, 0, innerR * sin);
  }
  return new Float32Array(verts);
}

// Build a small sphere-ish dot (flat circle) for placed points.
function buildDotGeometry(r: number, segments: number): Float32Array {
  const verts: number[] = [0, 0, 0];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    verts.push(r * Math.cos(a), 0, r * Math.sin(a));
  }
  return new Float32Array(verts);
}

// Build a line (two points) for the distance line.
function buildLineGeometry(a: Vec3, b: Vec3): Float32Array {
  return new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z]);
}

// Simple perspective projection matrix (column-major, like WebGL expects).
function perspectiveMatrix(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

// ─── WebXR AR Mode ────────────────────────────────────────────────────────────

interface Measurement { label: string; value: string; meters: number }

export function WebXRMeasure({ onExit, sessionToken }: { onExit: () => void; sessionToken?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "measuring" | "error">("starting");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  // Per-measurement segment type (parallel array to measurements)
  const [segmentTypes, setSegmentTypes] = useState<Array<"wall" | "window" | "door" | "plumbing" | "electrical">>([]); 
  // Per-measurement optional note (parallel array)
  const [segmentNotes, setSegmentNotes] = useState<string[]>([]);
  // Which measurement index is currently being tagged (null = tag panel hidden)
  const [taggingIdx, setTaggingIdx] = useState<number | null>(null);
  // Note input step: shown after plumbing/electrical is tapped
  const [noteInputIdx, setNoteInputIdx] = useState<number | null>(null);
  const [noteInputValue, setNoteInputValue] = useState("");
  const saveMeasurements = trpc.measureSessions.saveMeasurements.useMutation({
    onSuccess: () => toast.success("Measurements sent to the 3D Designer!"),
    onError: (e) => toast.error(`Failed to send: ${e.message}`),
  });
  function sendToDesigner() {
    if (!sessionToken || measurements.length === 0) return;
    saveMeasurements.mutate({
      token: sessionToken,
      walls: measurements.map((m, i) => ({
        label: m.label || `Segment ${i + 1}`,
        inches: m.meters * 39.3701,
        feet: m.meters * 3.28084,
        meters: m.meters,
        segmentType: segmentTypes[i] ?? "wall",
        ...(segmentNotes[i] ? { note: segmentNotes[i] } : {}),
      })),
    });
  }
  const [pointCount, setPointCount] = useState(0);

  // WebXR refs
  const sessionRef = useRef<XRSession | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const rafRef = useRef<number>(0);

  // Reticle state (world position from hit-test)
  const reticleMatRef = useRef<Float32Array | null>(null);
  const reticleVisibleRef = useRef(false);

  // Placed points (world positions)
  const placedPointsRef = useRef<Vec3[]>([]);

  // WebGL program refs
  const progRef = useRef<WebGLProgram | null>(null);
  const ringBufRef = useRef<WebGLBuffer | null>(null);
  const dotBufRef = useRef<WebGLBuffer | null>(null);
  const lineBufRef = useRef<WebGLBuffer | null>(null);
  const ringCountRef = useRef(0);
  const dotCountRef = useRef(0);

  const stopSession = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (hitTestSourceRef.current) { hitTestSourceRef.current.cancel(); hitTestSourceRef.current = null; }
    if (sessionRef.current) { sessionRef.current.end().catch(() => {}); sessionRef.current = null; }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startAR() {
      try {
        const nav = navigator as Navigator & { xr?: XRSystem };
        if (!nav.xr) { setStatus("error"); return; }
        const supported = await nav.xr.isSessionSupported("immersive-ar");
        if (!supported || cancelled) { setStatus("error"); return; }

        const overlayEl = overlayRef.current;
        const session = await nav.xr.requestSession("immersive-ar", {
          requiredFeatures: ["hit-test"],
          optionalFeatures: ["dom-overlay"],
          ...(overlayEl ? { domOverlay: { root: overlayEl } } : {}),
        } as XRSessionInit);

        if (cancelled) { session.end(); return; }
        sessionRef.current = session;

        const canvas = canvasRef.current!;
        const gl = canvas.getContext("webgl", { xrCompatible: true, alpha: true }) as WebGLRenderingContext;
        glRef.current = gl;
        await (gl as any).makeXRCompatible?.();

        const baseLayer = new XRWebGLLayer(session, gl);
        await session.updateRenderState({ baseLayer });

        // ── Build WebGL program ──
        const vert = `
          attribute vec3 aPos;
          uniform mat4 uMVP;
          void main() { gl_Position = uMVP * vec4(aPos, 1.0); gl_PointSize = 8.0; }
        `;
        const frag = `
          precision mediump float;
          uniform vec4 uColor;
          void main() { gl_FragColor = uColor; }
        `;
        const prog = createProgram(gl, vert, frag);
        progRef.current = prog;

        // Ring geometry (reticle)
        const ringVerts = buildRingGeometry(0.08, 0.065, 48);
        ringCountRef.current = ringVerts.length / 3;
        const ringBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, ringBuf);
        gl.bufferData(gl.ARRAY_BUFFER, ringVerts, gl.STATIC_DRAW);
        ringBufRef.current = ringBuf;

        // Dot geometry (placed points)
        const dotVerts = buildDotGeometry(0.025, 32);
        dotCountRef.current = dotVerts.length / 3;
        const dotBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, dotBuf);
        gl.bufferData(gl.ARRAY_BUFFER, dotVerts, gl.STATIC_DRAW);
        dotBufRef.current = dotBuf;

        // Line buffer (dynamic, updated each frame)
        const lineBuf = gl.createBuffer()!;
        lineBufRef.current = lineBuf;

        const refSpace = await session.requestReferenceSpace("local");
        const viewerSpace = await session.requestReferenceSpace("viewer");
        const hitTestSource = await session.requestHitTestSource!({ space: viewerSpace });
        hitTestSourceRef.current = hitTestSource ?? null;

        setStatus("ready");

        // ── Render loop ──
        const onFrame = (_time: number, frame: XRFrame) => {
          if (!sessionRef.current) return;
          rafRef.current = session.requestAnimationFrame(onFrame);

          const pose = frame.getViewerPose(refSpace);
          if (!pose) return;

          const ht = hitTestSourceRef.current;
          if (ht) {
            const hits = frame.getHitTestResults(ht);
            if (hits.length > 0) {
              const hitPose = hits[0].getPose(refSpace);
              if (hitPose) {
                reticleMatRef.current = hitPose.transform.matrix as unknown as Float32Array;
                reticleVisibleRef.current = true;
              }
            } else {
              reticleVisibleRef.current = false;
            }
          }

          // Draw
          gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.enable(gl.DEPTH_TEST);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

          const view = pose.views[0];
          const proj = view.projectionMatrix;
          const viewMat = view.transform.inverse.matrix;

          gl.useProgram(prog);
          const uMVP = gl.getUniformLocation(prog, "uMVP");
          const uColor = gl.getUniformLocation(prog, "uColor");
          const aPos = gl.getAttribLocation(prog, "aPos");

          // Helper: multiply 4x4 matrices (column-major)
          function mul(a: Float32Array | number[], b: Float32Array | number[]): Float32Array {
            const out = new Float32Array(16);
            for (let i = 0; i < 4; i++) {
              for (let j = 0; j < 4; j++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) sum += a[i + k * 4] * b[k + j * 4];
                out[i + j * 4] = sum;
              }
            }
            return out;
          }

          // Helper: translate a mat4 by (tx, ty, tz)
          function translateMat(m: Float32Array | number[], tx: number, ty: number, tz: number): Float32Array {
            const out = new Float32Array(m);
            out[12] = m[0]*tx + m[4]*ty + m[8]*tz + m[12];
            out[13] = m[1]*tx + m[5]*ty + m[9]*tz + m[13];
            out[14] = m[2]*tx + m[6]*ty + m[10]*tz + m[14];
            out[15] = m[3]*tx + m[7]*ty + m[11]*tz + m[15];
            return out;
          }

          function drawBuffer(buf: WebGLBuffer, count: number, mode: number, modelMat: Float32Array, color: [number, number, number, number]) {
            const mv = mul(viewMat, modelMat);
            const mvp = mul(proj, mv);
            gl.uniformMatrix4fv(uMVP, false, mvp);
            gl.uniform4f(uColor, ...color);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
            gl.drawArrays(mode, 0, count);
          }

          // Draw reticle ring at hit-test position
          if (reticleVisibleRef.current && reticleMatRef.current) {
            const model = new Float32Array(reticleMatRef.current);
            drawBuffer(ringBufRef.current!, ringCountRef.current * 2, gl.TRIANGLE_STRIP, model, [0.83, 0.65, 0.35, 0.9]);
          }

          // Draw placed point dots
          for (const pt of placedPointsRef.current) {
            const identity = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
            const model = translateMat(identity, pt.x, pt.y, pt.z);
            drawBuffer(dotBufRef.current!, dotCountRef.current, gl.TRIANGLE_FAN, model, [0.83, 0.65, 0.35, 1.0]);
          }

          // Draw line between last two placed points
          const pts = placedPointsRef.current;
          if (pts.length >= 2) {
            const a = pts[pts.length - 2];
            const b = pts[pts.length - 1];
            const lineVerts = buildLineGeometry(a, b);
            gl.bindBuffer(gl.ARRAY_BUFFER, lineBufRef.current!);
            gl.bufferData(gl.ARRAY_BUFFER, lineVerts, gl.DYNAMIC_DRAW);
            const identity = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
            drawBuffer(lineBufRef.current!, 2, gl.LINES, identity, [1, 1, 1, 0.9]);
          }
        };

        rafRef.current = session.requestAnimationFrame(onFrame);

        session.addEventListener("end", () => {
          setStatus("starting");
          hitTestSourceRef.current = null;
          sessionRef.current = null;
        });
      } catch (e) {
        console.error("WebXR error:", e);
        if (!cancelled) setStatus("error");
      }
    }

    startAR();
    return () => {
      cancelled = true;
      stopSession();
    };
  }, [stopSession]);

  function handleTap() {
    if (status !== "ready" && status !== "measuring") return;
    if (!reticleVisibleRef.current || !reticleMatRef.current) {
      toast.info("Point your camera at a flat surface first");
      return;
    }

    const mat = reticleMatRef.current;
    const pt: Vec3 = { x: mat[12], y: mat[13], z: mat[14] };
    placedPointsRef.current = [...placedPointsRef.current, pt];
    const count = placedPointsRef.current.length;
    setPointCount(count);

    if (count % 2 === 0) {
      const a = placedPointsRef.current[count - 2];
      const b = placedPointsRef.current[count - 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const meters = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const inches = meters * 39.3701;
      const feet = Math.floor(inches / 12);
      const remIn = (inches % 12).toFixed(1);
      const label = `Measurement ${Math.floor(count / 2)}`;
      const value = feet > 0
        ? `${feet}′ ${remIn}″  (${(meters * 100).toFixed(1)} cm)`
        : `${inches.toFixed(1)}″  (${(meters * 100).toFixed(1)} cm)`;
      const newIdx = Math.floor(count / 2) - 1;
      setMeasurements((prev) => [...prev, { label, value, meters }]);
      setSegmentTypes((prev) => [...prev, "wall"]); // default; user can change via tag panel
      setTaggingIdx(newIdx); // show tag panel for this measurement
      setStatus("ready");
      toast.success(value, { duration: 3000 });
    } else {
      setStatus("measuring");
    }
  }

  function clearAll() {
    placedPointsRef.current = [];
    setPointCount(0);
    setMeasurements([]);
    setSegmentTypes([]);
    setSegmentNotes([]);
    setTaggingIdx(null);
    setNoteInputIdx(null);
    setNoteInputValue("");
    setStatus("ready");
  }

  function undoLast() {
    const pts = [...placedPointsRef.current];
    if (pts.length === 0) return;
    pts.pop();
    placedPointsRef.current = pts;
    setPointCount(pts.length);
    if (pts.length % 2 === 0) setStatus("ready");
    else setStatus("measuring");
    if (pts.length % 2 !== 0) {
      // Removed second point of a pair — remove last measurement too
      setMeasurements((prev) => prev.slice(0, -1));
      setSegmentTypes((prev) => prev.slice(0, -1));
      setSegmentNotes((prev) => prev.slice(0, -1));
      setTaggingIdx(null);
      setNoteInputIdx(null);
      setNoteInputValue("");
    }
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f1929] text-white px-6 text-center gap-6">
        <AlertTriangle className="h-16 w-16 text-amber-400" />
        <h2 className="text-2xl font-bold">AR Not Available</h2>
        <p className="text-[#8a9bb8] max-w-sm">
          WebXR AR requires Android Chrome with ARCore installed. Your device or browser doesn't support it.
        </p>
        <Button onClick={onExit} className="bg-[#d4a75a] text-[#1a2744] hover:bg-[#e0b86a] font-bold">
          Use Photo Measurement Instead
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* WebGL canvas — AR camera passthrough renders here */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" onClick={handleTap} />

      {/* DOM overlay — buttons and labels on top of AR */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none">

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-safe-top pt-4 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); stopSession(); onExit(); }}
            className="flex items-center gap-1.5 bg-black/50 backdrop-blur rounded-full px-3 py-2 text-white text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Exit AR
          </button>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); undoLast(); }}
              className="bg-black/50 backdrop-blur rounded-full px-3 py-2 text-white text-sm font-medium"
            >
              Undo
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="bg-black/50 backdrop-blur rounded-full p-2 text-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Crosshair (visual guide — actual reticle rendered in WebGL) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-8 h-8 opacity-50">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white -translate-y-1/2" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white -translate-x-1/2" />
          </div>
        </div>

        {/* Status pill */}
        <div className="absolute bottom-40 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur rounded-2xl px-5 py-3 text-white text-center max-w-xs">
            {status === "starting" && <p className="text-sm">Initializing AR…</p>}
            {status === "ready" && (
              <p className="text-sm">
                {pointCount % 2 === 0
                  ? <>Tap to place <strong>Point 1</strong></>
                  : <>Tap to place <strong>Point 1</strong></>}
              </p>
            )}
            {status === "measuring" && (
              <p className="text-sm">Tap to place <strong>Point 2</strong> and measure</p>
            )}
          </div>
        </div>

        {/* Note input panel — shown after plumbing/electrical is tapped */}
        {noteInputIdx !== null && (
          <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
            <div className="bg-black/90 backdrop-blur rounded-2xl p-4 space-y-3">
              <p className="text-white font-bold text-sm text-center">
                {segmentTypes[noteInputIdx] === "plumbing" ? "🚰 Plumbing" : "⚡ Electrical"} — Add a note
              </p>
              <input
                autoFocus
                type="text"
                maxLength={120}
                value={noteInputValue}
                onChange={(e) => setNoteInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (noteInputValue.trim()) {
                      setSegmentNotes((prev) => {
                        const updated = [...prev];
                        updated[noteInputIdx] = noteInputValue.trim();
                        return updated;
                      });
                    }
                    setNoteInputIdx(null);
                    setNoteInputValue("");
                  }
                }}
                placeholder={segmentTypes[noteInputIdx] === "plumbing" ? "e.g. sink, dishwasher, ice maker" : "e.g. 110v outlet, GFCI, 240v range"}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#d4a75a]"
              />
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (noteInputValue.trim()) {
                      setSegmentNotes((prev) => {
                        const updated = [...prev];
                        updated[noteInputIdx] = noteInputValue.trim();
                        return updated;
                      });
                    }
                    setNoteInputIdx(null);
                    setNoteInputValue("");
                  }}
                  className="flex-1 bg-[#d4a75a] text-[#1a2744] font-bold rounded-xl py-2.5 text-sm"
                >
                  Done
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setNoteInputIdx(null); setNoteInputValue(""); }}
                  className="px-4 border border-white/20 text-white/60 rounded-xl py-2.5 text-sm"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Segment tag panel — appears after each measurement, dismissed by tapping a tag */}
        {taggingIdx !== null && noteInputIdx === null && measurements[taggingIdx] && (
          <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
            <div className="bg-black/85 backdrop-blur rounded-2xl p-4 space-y-3">
              <div className="text-center">
                <p className="text-white font-bold text-base">{measurements[taggingIdx].value}</p>
                <p className="text-white/50 text-xs mt-0.5">What did you just measure?</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { type: "wall" as const,        emoji: "🧱", label: "Wall" },
                  { type: "window" as const,      emoji: "🪟", label: "Window" },
                  { type: "door" as const,        emoji: "🚪", label: "Door" },
                  { type: "plumbing" as const,    emoji: "🚰", label: "Plumbing" },
                  { type: "electrical" as const,  emoji: "⚡", label: "Electrical" },
                ] as const).map(({ type, emoji, label }) => {
                  const active = segmentTypes[taggingIdx] === type;
                  return (
                    <button
                      key={type}
                      onClick={(e) => {
                        e.stopPropagation();
                        const idx = taggingIdx;
                        setSegmentTypes((prev) => {
                          const updated = [...prev];
                          updated[idx] = type;
                          return updated;
                        });
                        setTaggingIdx(null);
                        // For plumbing/electrical, open the note input
                        if (type === "plumbing" || type === "electrical") {
                          setNoteInputIdx(idx);
                          setNoteInputValue("");
                        }
                      }}
                      className={[
                        "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
                        active
                          ? "border-[#d4a75a] bg-[#d4a75a]/20 text-white"
                          : "border-white/20 text-white/80 hover:border-[#d4a75a]/60",
                      ].join(" ")}
                    >
                      <span>{emoji}</span> {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Measurements list — shown when tag panel is not active */}
        {measurements.length > 0 && taggingIdx === null && (
          <div className="absolute bottom-4 left-4 right-4 space-y-1.5 pointer-events-auto">
            {measurements.slice(-4).map((m, absIdx) => {
              const realIdx = measurements.length - Math.min(4, measurements.length) + absIdx;
              const segIcon = ({ wall: "🧱", window: "🪟", door: "🚪", plumbing: "🚰", electrical: "⚡" } as Record<string, string>)[segmentTypes[realIdx] ?? "wall"] ?? "🧱";
              return (
                <div
                  key={realIdx}
                  className="bg-black/75 backdrop-blur rounded-xl px-4 py-2.5 flex justify-between items-center text-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{segIcon}</span>
                    <div>
                      <span className="text-white/50 text-xs">{m.label}</span>
                      {segmentNotes[realIdx] && (
                        <p className="text-[#d4a75a] text-xs mt-0.5">{segmentNotes[realIdx]}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{m.value}</span>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(m.value); toast.success("Copied!"); }}
                      className="text-white/40 hover:text-white/80 transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {sessionToken && measurements.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); sendToDesigner(); }}
                disabled={saveMeasurements.isPending}
                className="w-full bg-[#d4a75a] text-[#1a2744] font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {saveMeasurements.isPending ? "Sending…" : `Send ${measurements.length} Segment${measurements.length > 1 ? "s" : ""} to Designer`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Photo Reference Mode ─────────────────────────────────────────────────────

function PhotoMeasure({ sessionToken }: { sessionToken?: string | null } = {}) {
  const [step, setStep] = useState<PhotoStep>("capture");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [refObjIdx, setRefObjIdx] = useState(0);
  const [customRefMm, setCustomRefMm] = useState<string>("");
  const [refPoints, setRefPoints] = useState<[Point, Point] | null>(null);
  const [measPoints, setMeasPoints] = useState<[Point, Point] | null>(null);
  const [result, setResult] = useState<{ inches: number; cm: number; feet: string } | null>(null);
  const [history, setHistory] = useState<{ feet: string; cm: string; ref: string }[]>([]);
  const [allResults, setAllResults] = useState<{ inches: number; cm: number; feet: string; segmentType: "wall" | "window" | "door" | "plumbing" | "electrical"; note?: string }[]>([]);
  // Note input state for photo mode
  const [photoNoteInputOpen, setPhotoNoteInputOpen] = useState(false);
  const [photoNoteValue, setPhotoNoteValue] = useState("");
  const saveMeasurements = trpc.measureSessions.saveMeasurements.useMutation({
    onSuccess: () => toast.success("Measurements sent to the 3D Designer!"),
    onError: (e) => toast.error(`Failed to send: ${e.message}`),
  });
  function sendToDesigner() {
    if (!sessionToken || allResults.length === 0) return;
    saveMeasurements.mutate({
      token: sessionToken,
      walls: allResults.map((r, i) => ({
        label: `Segment ${i + 1}`,
        inches: r.inches,
        feet: r.inches / 12,
        meters: r.inches * 0.0254,
        segmentType: r.segmentType as "wall" | "window" | "door" | "plumbing" | "electrical",
        ...(r.note ? { note: r.note } : {}),
      })),
    });
  }
  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const refMm = customRefMm && Number(customRefMm) > 0
    ? Number(customRefMm)
    : REFERENCE_OBJECTS[refObjIdx].mm;

  function handleImageTap(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const pt: Point = { x, y };

    if (step === "ref-point-1") {
      setRefPoints([pt, pt]);
      setStep("ref-point-2");
    } else if (step === "ref-point-2") {
      setRefPoints((prev) => [prev![0], pt]);
      setStep("meas-point-1");
    } else if (step === "meas-point-1") {
      setMeasPoints([pt, pt]);
      setStep("meas-point-2");
    } else if (step === "meas-point-2") {
      setMeasPoints((prev) => {
        const updated: [Point, Point] = [prev![0], pt];
        compute(updated);
        return updated;
      });
      setStep("result");
    }
  }

  function compute(mp: [Point, Point]) {
    if (!refPoints || !imgRef.current) return;
    const img = imgRef.current;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const refPx = Math.sqrt(
      Math.pow((refPoints[1].x - refPoints[0].x) * w, 2) +
      Math.pow((refPoints[1].y - refPoints[0].y) * h, 2)
    );
    if (refPx < 4) { toast.error("Reference points too close together — try again"); return; }

    const measPx = Math.sqrt(
      Math.pow((mp[1].x - mp[0].x) * w, 2) +
      Math.pow((mp[1].y - mp[0].y) * h, 2)
    );
    const measMm = (measPx / refPx) * refMm;
    const cm = measMm / 10;
    const inches = measMm / 25.4;
    const feet = Math.floor(inches / 12);
    const remIn = (inches % 12).toFixed(1);
    const feetStr = feet > 0 ? `${feet}′ ${remIn}″` : `${inches.toFixed(1)}″`;
    setResult({ inches, cm, feet: feetStr });
    setAllResults((prev) => [...prev, { inches, cm, feet: feetStr, segmentType: "wall" as const }]);
    setHistory((prev) => [
      { feet: feetStr, cm: cm.toFixed(1), ref: REFERENCE_OBJECTS[refObjIdx].label },
      ...prev.slice(0, 4),
    ]);
  }

  function reset() {
    setStep("capture");
    setImageUrl(null);
    setRefPoints(null);
    setMeasPoints(null);
    setResult(null);
  }

  function measureAgain() {
    setStep("meas-point-1");
    setMeasPoints(null);
    setResult(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setStep("ref-point-1");
  }

  // Draw overlay dots and lines on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imageUrl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      canvas.width = img.offsetWidth;
      canvas.height = img.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      function dot(p: Point, color: string, label: string) {
        const x = p.x * canvas!.width;
        const y = p.y * canvas!.height;
        ctx!.beginPath();
        ctx!.arc(x, y, 9, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();
        ctx!.strokeStyle = "white";
        ctx!.lineWidth = 2.5;
        ctx!.stroke();
        // Label background
        const tw = ctx!.measureText(label).width + 8;
        ctx!.fillStyle = "rgba(0,0,0,0.65)";
        ctx!.beginPath();
        ctx!.roundRect?.(x + 14, y - 9, tw, 18, 4);
        ctx!.fill();
        ctx!.fillStyle = "white";
        ctx!.font = "bold 11px system-ui, sans-serif";
        ctx!.fillText(label, x + 18, y + 4);
      }

      function line(a: Point, b: Point, color: string, dashed = true) {
        ctx!.beginPath();
        ctx!.moveTo(a.x * canvas!.width, a.y * canvas!.height);
        ctx!.lineTo(b.x * canvas!.width, b.y * canvas!.height);
        ctx!.strokeStyle = color;
        ctx!.lineWidth = 2;
        if (dashed) ctx!.setLineDash([7, 4]);
        else ctx!.setLineDash([]);
        ctx!.stroke();
        ctx!.setLineDash([]);
      }

      if (refPoints) {
        dot(refPoints[0], "#d4a75a", "R1");
        if (step !== "ref-point-2") {
          dot(refPoints[1], "#d4a75a", "R2");
          line(refPoints[0], refPoints[1], "#d4a75a");
        }
      }
      if (measPoints) {
        dot(measPoints[0], "#4ade80", "M1");
        if (step === "result") {
          dot(measPoints[1], "#4ade80", "M2");
          line(measPoints[0], measPoints[1], "#4ade80", false);
          // Midpoint label
          const mx = ((measPoints[0].x + measPoints[1].x) / 2) * canvas!.width;
          const my = ((measPoints[0].y + measPoints[1].y) / 2) * canvas!.height;
          if (result) {
            const lbl = result.feet;
            const tw = ctx!.measureText(lbl).width + 16;
            ctx!.fillStyle = "rgba(26,39,68,0.9)";
            ctx!.beginPath();
            ctx!.roundRect?.(mx - tw / 2, my - 13, tw, 26, 6);
            ctx!.fill();
            ctx!.fillStyle = "white";
            ctx!.font = "bold 13px system-ui, sans-serif";
            ctx!.textAlign = "center";
            ctx!.fillText(lbl, mx, my + 5);
            ctx!.textAlign = "left";
          }
        }
      }
    };

    draw();
  }, [step, refPoints, measPoints, imageUrl, result]);

  const stepInstructions: Record<PhotoStep, string> = {
    capture: "Take a photo or upload one that includes a known reference object",
    "ref-point-1": `Tap the LEFT edge of your reference object (${REFERENCE_OBJECTS[refObjIdx].label})`,
    "ref-point-2": "Tap the RIGHT (or opposite) edge of your reference object",
    "meas-point-1": "Tap the START of what you want to measure",
    "meas-point-2": "Tap the END of what you want to measure",
    result: "Measurement complete!",
  };

  return (
    <div className="min-h-screen bg-[#0f1929] text-white pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1929]/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10 -ml-1">
          <Link href="/app"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-sm font-bold">Photo Measurement</h1>
          <p className="text-[10px] text-[#8a9bb8]">Works on all devices</p>
        </div>
        {step !== "capture" && (
          <Button onClick={reset} variant="ghost" size="sm" className="text-white hover:bg-white/10">
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Instruction banner */}
        <div className="bg-[#1a2744] border border-[#2a3a5c] rounded-xl px-4 py-3 flex items-start gap-3">
          <Info className="h-4 w-4 text-[#d4a75a] shrink-0 mt-0.5" />
          <p className="text-sm text-[#c8d4e8] leading-relaxed">{stepInstructions[step]}</p>
        </div>

        {/* Reference object selector */}
        {(step === "capture" || step === "ref-point-1") && (
          <div>
            <label className="block text-xs font-semibold text-[#8a9bb8] mb-2 uppercase tracking-wider">
              Reference Object
            </label>
            <div className="grid grid-cols-1 gap-1.5 mb-3">
              {REFERENCE_OBJECTS.map((obj, i) => (
                <button
                  key={obj.label}
                  onClick={() => { setRefObjIdx(i); setCustomRefMm(""); }}
                  className={[
                    "flex items-center justify-between rounded-lg border px-4 py-2 text-sm text-left transition-colors",
                    refObjIdx === i && !customRefMm
                      ? "border-[#d4a75a] bg-[#d4a75a]/10 text-white"
                      : "border-[#2a3a5c] text-[#8a9bb8] hover:border-[#d4a75a]/50",
                  ].join(" ")}
                >
                  <span>{obj.label}</span>
                  <span className="font-mono text-xs">{obj.mm} mm</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#8a9bb8] shrink-0">Custom (mm):</label>
              <input
                type="number"
                value={customRefMm}
                onChange={(e) => setCustomRefMm(e.target.value)}
                placeholder="e.g. 300"
                className="flex-1 bg-[#1a2744] border border-[#2a3a5c] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#4a5a7a] focus:outline-none focus:border-[#d4a75a]"
              />
            </div>
          </div>
        )}

        {/* Capture button */}
        {step === "capture" && (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              className="w-full bg-[#d4a75a] text-[#1a2744] hover:bg-[#e0b86a] font-bold gap-2 h-14 text-base"
            >
              <Camera className="h-5 w-5" />
              Take Photo with Camera
            </Button>
            <Button
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.removeAttribute("capture");
                  fileRef.current.click();
                  setTimeout(() => fileRef.current?.setAttribute("capture", "environment"), 500);
                }
              }}
              variant="outline"
              className="w-full border-[#2a3a5c] text-white hover:bg-white/10 gap-2"
            >
              Upload Existing Photo
            </Button>
          </div>
        )}

        {/* Image with tap overlay */}
        {imageUrl && step !== "capture" && (
          <div className="relative rounded-xl overflow-hidden border border-[#2a3a5c] cursor-crosshair">
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Measurement photo"
              className="w-full block select-none"
              onClick={handleImageTap}
              draggable={false}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            {step !== "result" && (
              <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur rounded-lg px-3 py-2 text-xs text-white text-center">
                👆 Tap on the image above
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {step === "result" && result && (
          <div className="bg-[#1e2e4a] border border-[#d4a75a]/40 rounded-2xl p-6 text-center space-y-4">
            <CheckCircle className="h-10 w-10 text-[#d4a75a] mx-auto" />
            <div>
              <div className="text-4xl font-extrabold text-white">{result.feet}</div>
              <div className="text-lg text-[#d4a75a] font-semibold mt-1">{result.cm.toFixed(1)} cm</div>
              <div className="text-sm text-[#8a9bb8] mt-1">{result.inches.toFixed(2)} inches</div>
            </div>
            <div className="text-xs text-[#6a7a9a]">
              Based on {customRefMm ? `custom ${customRefMm} mm` : `${REFERENCE_OBJECTS[refObjIdx].label} (${REFERENCE_OBJECTS[refObjIdx].mm} mm)`}
            </div>

            {/* Segment type tag — what is this measurement? */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#8a9bb8] uppercase tracking-wider">What did you just measure?</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { type: "wall" as const,        emoji: "🧱", label: "Wall" },
                  { type: "window" as const,      emoji: "🪟", label: "Window" },
                  { type: "door" as const,        emoji: "🚪", label: "Door" },
                  { type: "plumbing" as const,    emoji: "🚰", label: "Plumbing" },
                  { type: "electrical" as const,  emoji: "⚡", label: "Electrical" },
                ] as const).map(({ type, emoji, label }) => {
                  const current = allResults[allResults.length - 1]?.segmentType ?? "wall";
                  const active = current === type;
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        setAllResults((prev) => {
                          if (prev.length === 0) return prev;
                          const updated = [...prev];
                          updated[updated.length - 1] = { ...updated[updated.length - 1], segmentType: type };
                          return updated;
                        });
                        // Open note input for plumbing/electrical
                        if (type === "plumbing" || type === "electrical") {
                          setPhotoNoteInputOpen(true);
                          setPhotoNoteValue("");
                        }
                      }}
                      className={[
                        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "border-[#d4a75a] bg-[#d4a75a]/15 text-white"
                          : "border-[#2a3a5c] text-[#8a9bb8] hover:border-[#d4a75a]/50 hover:text-white",
                      ].join(" ")}
                    >
                      <span>{emoji}</span> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note input — shown after plumbing/electrical is tapped */}
            {photoNoteInputOpen && (
              <div className="bg-[#131f35] border border-[#d4a75a]/30 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[#d4a75a] uppercase tracking-wider">
                  {allResults[allResults.length - 1]?.segmentType === "plumbing" ? "🚰 Plumbing note" : "⚡ Electrical note"}
                </p>
                <input
                  autoFocus
                  type="text"
                  maxLength={120}
                  value={photoNoteValue}
                  onChange={(e) => setPhotoNoteValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (photoNoteValue.trim()) {
                        setAllResults((prev) => {
                          if (prev.length === 0) return prev;
                          const updated = [...prev];
                          updated[updated.length - 1] = { ...updated[updated.length - 1], note: photoNoteValue.trim() };
                          return updated;
                        });
                      }
                      setPhotoNoteInputOpen(false);
                      setPhotoNoteValue("");
                    }
                  }}
                  placeholder={allResults[allResults.length - 1]?.segmentType === "plumbing" ? "e.g. sink, dishwasher, ice maker" : "e.g. 110v outlet, GFCI, 240v range"}
                  className="w-full bg-white/5 border border-[#2a3a5c] rounded-lg px-3 py-2.5 text-white placeholder-[#4a5a7a] text-sm focus:outline-none focus:border-[#d4a75a]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (photoNoteValue.trim()) {
                        setAllResults((prev) => {
                          if (prev.length === 0) return prev;
                          const updated = [...prev];
                          updated[updated.length - 1] = { ...updated[updated.length - 1], note: photoNoteValue.trim() };
                          return updated;
                        });
                      }
                      setPhotoNoteInputOpen(false);
                      setPhotoNoteValue("");
                    }}
                    className="flex-1 bg-[#d4a75a] text-[#1a2744] font-bold rounded-lg py-2 text-sm"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => { setPhotoNoteInputOpen(false); setPhotoNoteValue(""); }}
                    className="px-4 border border-[#2a3a5c] text-[#8a9bb8] rounded-lg py-2 text-sm"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => { navigator.clipboard?.writeText(`${result.feet} (${result.cm.toFixed(1)} cm)`); toast.success("Copied!"); }}
                variant="outline"
                className="flex-1 border-[#2a3a5c] text-white hover:bg-white/10 gap-1.5"
              >
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button
                onClick={measureAgain}
                className="flex-1 bg-[#d4a75a] text-[#1a2744] hover:bg-[#e0b86a] font-bold"
              >
                Measure Again
              </Button>
            </div>
            {sessionToken && allResults.length > 0 && (
              <Button
                onClick={sendToDesigner}
                disabled={saveMeasurements.isPending}
                className="w-full bg-[#d4a75a] text-[#1a2744] hover:bg-[#e0b86a] font-bold gap-2"
              >
                <Send className="h-4 w-4" />
                {saveMeasurements.isPending ? "Sending…" : `Send ${allResults.length} Measurement${allResults.length > 1 ? "s" : ""} to Designer`}
              </Button>
            )}
            <Button onClick={reset} variant="ghost" className="w-full text-[#8a9bb8] hover:text-white">
              New Photo
            </Button>
          </div>
        )}

        {/* Measurement history */}
        {history.length > 0 && step === "capture" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#8a9bb8] uppercase tracking-wider">Recent Measurements</label>
              <button onClick={() => setHistory([])} className="text-xs text-[#4a5a7a] hover:text-white">Clear</button>
            </div>
            <div className="space-y-1.5">
              {history.map((h, i) => (
                <div key={i} className="bg-[#1a2744] border border-[#2a3a5c] rounded-lg px-4 py-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white">{h.feet}</span>
                    <span className="text-[#8a9bb8] text-xs ml-2">{h.cm} cm</span>
                  </div>
                  <span className="text-[#4a5a7a] text-xs">{h.ref}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {step === "capture" && (
          <div className="bg-[#1a2744] border border-[#2a3a5c] rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-[#d4a75a]">Tips for Accurate Results</h3>
            <ul className="text-xs text-[#8a9bb8] space-y-1.5">
              <li>• Place the reference object on the same flat surface as what you're measuring</li>
              <li>• Take the photo straight-on, not at an angle</li>
              <li>• Make sure both the reference object and measurement target are clearly visible</li>
              <li>• Good lighting helps — avoid shadows across the reference object</li>
              <li>• For walls: place a tape measure or known object at the same depth as the wall</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ARMeasure() {
  const [mode, setMode] = useState<Mode>("detecting");
  const search = useSearch();
  const sessionToken = new URLSearchParams(search).get("session") ?? null;

  useEffect(() => {
    async function detect() {
      const nav = navigator as Navigator & { xr?: XRSystem };
      if (nav.xr) {
        try {
          const supported = await nav.xr.isSessionSupported("immersive-ar");
          if (supported) { setMode("webxr"); return; }
        } catch {
          // fall through
        }
      }
      setMode("photo");
    }
    detect();
  }, []);

  if (mode === "detecting") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f1929] text-white">
        <div className="text-center space-y-4">
          <Ruler className="h-12 w-12 text-[#d4a75a] mx-auto animate-pulse" />
          <p className="text-[#8a9bb8]">Checking AR capabilities…</p>
        </div>
      </div>
    );
  }

  if (mode === "webxr") {
    return <WebXRMeasure onExit={() => setMode("photo")} sessionToken={sessionToken} />;
  }

  return <PhotoMeasure sessionToken={sessionToken} />;
}
