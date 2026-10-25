import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  type IslandZone, type PlacedCabinet, type RoomData, type WallSide,
  type SinkFixture,
  COUNTERTOP_DEPTH_IN, countertopMaterial, edgeProfile,
  countertopArea, countertopSurfaces, cabinetWall, placedFootprint,
  bearsCountertop,
} from "@/lib/design";
import { islandCountertopVisibleRects } from "@/lib/islandScene";

/**
 * Fabricator Countertop Sheet — a dimensioned top-down drawing showing:
 * 1. Countertop slab outlines with exact dimensions (inches)
 * 2. Sink cutout locations and sizes
 * 3. Edge profile specification per exposed edge
 * 4. Material, thickness, and backsplash height
 * 5. Seam locations for slabs > 120" (industry standard max slab length)
 *
 * Reads design from localStorage (same draft as DesignTool).
 * Print-optimized with @media print CSS.
 */

const MAX_SLAB_LENGTH_IN = 120; // industry standard max before seam

function getDraftKey(): string {
  try {
    const raw = localStorage.getItem("cabinet-dealz-active-design-id");
    return raw ? `cabinet-dealz-draft-${raw}` : "cabinet-dealz-draft-default";
  } catch {
    return "cabinet-dealz-draft-default";
  }
}

interface DraftSnapshot {
  room: RoomData;
  placed: PlacedCabinet[];
  island?: IslandZone | null;
  sinks?: SinkFixture[];
  countertopMaterialId?: string | null;
  edgeProfileId?: string | null;
  backsplashMaterialId?: string | null;
}

// Merge adjacent countertop surfaces on the same wall into continuous runs
interface CounterRun {
  wall: WallSide;
  startAlong: number; // inches from wall start
  length: number;     // inches along the wall
  depth: number;      // inches into the room (always COUNTERTOP_DEPTH_IN for base)
  sinks: { offsetAlong: number; width: number; depth: number; type: string; pelicanProductName?: string }[];
}

function mergeRunsOnWall(
  placed: PlacedCabinet[],
  room: RoomData,
  sinks: SinkFixture[],
  wall: WallSide
): CounterRun | null {
  const basesOnWall = placed
    .filter((p) => bearsCountertop(p) && cabinetWall(p, room) === wall)
    .sort((a, b) => {
      const horizontal = wall === "top" || wall === "bottom";
      return horizontal ? a.x - b.x : a.y - b.y;
    });

  if (basesOnWall.length === 0) return null;

  const horizontal = wall === "top" || wall === "bottom";
  let minPos = Infinity;
  let maxEnd = 0;
  for (const p of basesOnWall) {
    const pos = horizontal ? p.x : p.y;
    const size = placedFootprint(p).w;
    if (pos < minPos) minPos = pos;
    if (pos + size > maxEnd) maxEnd = pos + size;
  }

  // Find sinks on this wall
  const wallSinks = sinks.filter((s) => {
    // A sink is on a wall if its position overlaps with base cabinets on that wall
    if (horizontal) {
      const sinkCenter = s.x + s.width / 2;
      return sinkCenter >= minPos && sinkCenter <= maxEnd &&
        ((wall === "top" && s.y < room.depth / 2) || (wall === "bottom" && s.y >= room.depth / 2));
    } else {
      const sinkCenter = s.y + s.depth / 2;
      return sinkCenter >= minPos && sinkCenter <= maxEnd &&
        ((wall === "left" && s.x < room.width / 2) || (wall === "right" && s.x >= room.width / 2));
    }
  });

  const runSinks = wallSinks.map((s) => ({
    offsetAlong: (horizontal ? s.x : s.y) - minPos,
    width: horizontal ? s.width : s.depth,
    depth: horizontal ? s.depth : s.width,
    type: s.type,
    pelicanProductName: s.pelicanProductName,
  }));

  return {
    wall,
    startAlong: minPos,
    length: maxEnd - minPos,
    depth: COUNTERTOP_DEPTH_IN,
    sinks: runSinks,
  };
}

// SVG dimension line component
function DimLine({
  x1, y1, x2, y2, label, scale, offset = 20,
}: {
  x1: number; y1: number; x2: number; y2: number;
  label: string; scale: number; offset?: number;
}) {
  const horizontal = Math.abs(y1 - y2) < 0.01;
  const tickLen = 6;
  const fontSize = Math.max(9, 11 / scale);

  if (horizontal) {
    const y = y1 + offset;
    return (
      <g className="text-gray-700">
        {/* Extension lines */}
        <line x1={x1} y1={y1} x2={x1} y2={y + tickLen / 2} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2,2" />
        <line x1={x2} y1={y2} x2={x2} y2={y + tickLen / 2} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2,2" />
        {/* Dimension line */}
        <line x1={x1} y1={y} x2={x2} y2={y} stroke="currentColor" strokeWidth={0.8} markerStart="url(#arrowStart)" markerEnd="url(#arrowEnd)" />
        {/* Ticks */}
        <line x1={x1} y1={y - tickLen / 2} x2={x1} y2={y + tickLen / 2} stroke="currentColor" strokeWidth={0.8} />
        <line x1={x2} y1={y - tickLen / 2} x2={x2} y2={y + tickLen / 2} stroke="currentColor" strokeWidth={0.8} />
        {/* Label */}
        <text x={(x1 + x2) / 2} y={y - 4} textAnchor="middle" fontSize={fontSize} fill="currentColor" fontWeight="600">
          {label}
        </text>
      </g>
    );
  } else {
    const x = x1 + offset;
    return (
      <g className="text-gray-700">
        <line x1={x1} y1={y1} x2={x + tickLen / 2} y2={y1} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2,2" />
        <line x1={x2} y1={y2} x2={x + tickLen / 2} y2={y2} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2,2" />
        <line x1={x} y1={y1} x2={x} y2={y2} stroke="currentColor" strokeWidth={0.8} />
        <line x1={x - tickLen / 2} y1={y1} x2={x + tickLen / 2} y2={y1} stroke="currentColor" strokeWidth={0.8} />
        <line x1={x - tickLen / 2} y1={y2} x2={x + tickLen / 2} y2={y2} stroke="currentColor" strokeWidth={0.8} />
        <text x={x + 8} y={(y1 + y2) / 2 + 3} textAnchor="start" fontSize={fontSize} fill="currentColor" fontWeight="600">
          {label}
        </text>
      </g>
    );
  }
}

function formatDim(inches: number): string {
  const ft = Math.floor(inches / 12);
  const rem = Math.round((inches % 12) * 10) / 10;
  if (ft === 0) return `${rem}"`;
  if (rem === 0) return `${ft}'`;
  return `${ft}'-${rem}"`;
}

export default function FabricatorSheet() {
  const [location] = useLocation();
  const savedDesignId = useMemo(() => {
    const value = new URLSearchParams(location.split("?")[1] ?? "").get("designId");
    const designId = Number(value);
    return Number.isInteger(designId) && designId > 0 ? designId : null;
  }, [location]);
  const documentAccess = trpc.design.documentAccess.useQuery(
    { designId: savedDesignId ?? 1 },
    { enabled: savedDesignId !== null, retry: false },
  );
  const hasFullDocumentAccess = documentAccess.data?.level === "full";
  const [draft, setDraft] = useState<DraftSnapshot | null>(null);

  useEffect(() => {
    try {
      const key = getDraftKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDraft(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const runs = useMemo(() => {
    if (!draft) return [];
    const walls: WallSide[] = ["top", "bottom", "left", "right"];
    const sinks = draft.sinks ?? [];
    return walls
      .map((w) => mergeRunsOnWall(draft.placed, draft.room, sinks, w))
      .filter((r): r is CounterRun => r !== null);
  }, [draft]);

  const islandRun = useMemo(() => {
    if (!draft?.island || draft.island.width <= 0 || draft.island.depth <= 0) return null;
    return { width: draft.island.width, depth: draft.island.depth };
  }, [draft]);

  const material = useMemo(() => countertopMaterial(draft?.countertopMaterialId), [draft]);
  const ep = useMemo(() => edgeProfile(draft?.edgeProfileId), [draft]);
  const area = useMemo(() => {
    if (!draft) return null;
    return countertopArea(
      draft.placed,
      draft.island,
      draft.island ? islandCountertopVisibleRects(draft.island, draft.placed) : null,
      draft.room,
    );
  }, [draft]);

  if (!draft) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">No design found. Open the 3D Designer first.</p>
      </div>
    );
  }

  if (!hasFullDocumentAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="max-w-md rounded-xl border border-amber-300 bg-background p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Fabricator sheet protected</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Countertop measurements, seam locations, and supplier-ready specifications are available only to administrators and authorized same-affiliate project teams.</p>
          <Button className="mt-5" variant="outline" asChild>
            <Link href="/design"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Design</Link>
          </Button>
        </div>
      </div>
    );
  }

  const WALL_LABELS: Record<WallSide, string> = { top: "Back Wall", bottom: "Front Wall", left: "Left Wall", right: "Right Wall" };
  const PPI = 3; // pixels per inch for the SVG drawing

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between print:border-b-2 print:border-gray-300">
        <div className="flex items-center gap-4">
          <Link href="/design" className="print:hidden">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to Design
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Countertop Fabricator Sheet</h1>
            <p className="text-xs text-gray-500">
              Generated {new Date().toLocaleDateString()} • Room: {Math.round(draft.room.width)}" × {Math.round(draft.room.depth)}"
              ({formatDim(draft.room.width)} × {formatDim(draft.room.depth)})
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 print:hidden" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {/* Specifications Summary */}
      <div className="px-6 py-4 border-b print:border-b print:border-gray-200">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-3">Specifications</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block text-xs">Material</span>
            <span className="font-semibold">{material.name}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Edge Profile</span>
            <span className="font-semibold flex items-center gap-2">
              <svg viewBox="0 0 24 16" className="h-4 w-6 inline-block">
                <path d={ep.svgPath} fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {ep.name}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Depth (Standard)</span>
            <span className="font-semibold">{COUNTERTOP_DEPTH_IN}" (incl. 1.5" overhang)</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Total Area</span>
            <span className="font-semibold">{area?.squareFeet ?? 0} sq ft ({area?.linearFeet ?? 0} lin ft)</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Thickness</span>
            <span className="font-semibold">3 cm (1.25")</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Backsplash</span>
            <span className="font-semibold">4" standard height</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Runs</span>
            <span className="font-semibold">{runs.length} wall run{runs.length !== 1 ? "s" : ""}{islandRun ? " + island" : ""}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Sink Cutouts</span>
            <span className="font-semibold">{runs.reduce((s, r) => s + r.sinks.length, 0)}</span>
          </div>
        </div>
      </div>

      {/* Dimensioned Drawings */}
      <div className="px-6 py-6 space-y-8">
        {runs.map((run, idx) => {
          const svgW = run.length * PPI + 80;
          const svgH = run.depth * PPI + 80;
          const ox = 30; // origin offset x
          const oy = 15; // origin offset y
          const needsSeam = run.length > MAX_SLAB_LENGTH_IN;
          const seamPos = needsSeam ? Math.round(run.length / 2) : 0;

          return (
            <div key={idx} className="break-inside-avoid">
              <h3 className="text-sm font-bold text-gray-700 mb-2">
                {WALL_LABELS[run.wall]} — {formatDim(run.length)} × {formatDim(run.depth)}
              </h3>
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full max-w-[700px] border border-gray-200 rounded bg-gray-50 print:border-gray-300"
                style={{ height: "auto", maxHeight: 200 }}
              >
                <defs>
                  <marker id="arrowStart" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
                    <path d="M6,0 L0,3 L6,6" fill="none" stroke="currentColor" strokeWidth="0.8" />
                  </marker>
                  <marker id="arrowEnd" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" strokeWidth="0.8" />
                  </marker>
                </defs>

                {/* Slab outline */}
                <rect
                  x={ox} y={oy}
                  width={run.length * PPI} height={run.depth * PPI}
                  fill={material.fill} stroke="#333" strokeWidth={1.5}
                  rx={2}
                />

                {/* Exposed edge indicator (front edge - thick blue line) */}
                <line
                  x1={ox} y1={oy + run.depth * PPI}
                  x2={ox + run.length * PPI} y2={oy + run.depth * PPI}
                  stroke="#2563eb" strokeWidth={3}
                />
                <text
                  x={ox + run.length * PPI / 2}
                  y={oy + run.depth * PPI + 14}
                  textAnchor="middle" fontSize="8" fill="#2563eb" fontWeight="600"
                >
                  {ep.name} Edge (exposed)
                </text>

                {/* Wall edge (back - dashed) */}
                <line
                  x1={ox} y1={oy}
                  x2={ox + run.length * PPI} y2={oy}
                  stroke="#666" strokeWidth={1} strokeDasharray="4,3"
                />
                <text x={ox + run.length * PPI / 2} y={oy - 4} textAnchor="middle" fontSize="7" fill="#666">
                  WALL (backsplash 4")
                </text>

                {/* Sink cutouts */}
                {run.sinks.map((sink, si) => (
                  <g key={si}>
                    <rect
                      x={ox + sink.offsetAlong * PPI + 4}
                      y={oy + (run.depth - sink.depth) / 2 * PPI}
                      width={sink.width * PPI - 8}
                      height={sink.depth * PPI}
                      fill="white" stroke="#dc2626" strokeWidth={1.5}
                      strokeDasharray="4,2" rx={3}
                    />
                    <text
                      x={ox + (sink.offsetAlong + sink.width / 2) * PPI}
                      y={oy + run.depth / 2 * PPI + 3}
                      textAnchor="middle" fontSize="8" fill="#dc2626" fontWeight="600"
                    >
                      {sink.pelicanProductName || `${sink.type.toUpperCase()} SINK`} CUTOUT
                    </text>
                    <text
                      x={ox + (sink.offsetAlong + sink.width / 2) * PPI}
                      y={oy + run.depth / 2 * PPI + 13}
                      textAnchor="middle" fontSize="7" fill="#dc2626"
                    >
                      {formatDim(sink.width)} × {formatDim(sink.depth)}
                    </text>
                  </g>
                ))}

                {/* Seam line */}
                {needsSeam && (
                  <g>
                    <line
                      x1={ox + seamPos * PPI} y1={oy - 2}
                      x2={ox + seamPos * PPI} y2={oy + run.depth * PPI + 2}
                      stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6,3"
                    />
                    <text
                      x={ox + seamPos * PPI} y={oy + run.depth * PPI + 24}
                      textAnchor="middle" fontSize="7" fill="#f59e0b" fontWeight="600"
                    >
                      SEAM ({formatDim(seamPos)} from left)
                    </text>
                  </g>
                )}

                {/* Dimension: length (bottom) */}
                <DimLine
                  x1={ox} y1={oy + run.depth * PPI}
                  x2={ox + run.length * PPI} y2={oy + run.depth * PPI}
                  label={formatDim(run.length)} scale={1} offset={28}
                />

                {/* Dimension: depth (right side) */}
                <DimLine
                  x1={ox + run.length * PPI} y1={oy}
                  x2={ox + run.length * PPI} y2={oy + run.depth * PPI}
                  label={formatDim(run.depth)} scale={1} offset={20}
                />
              </svg>
            </div>
          );
        })}

        {/* Island */}
        {islandRun && (
          <div className="break-inside-avoid">
            <h3 className="text-sm font-bold text-gray-700 mb-2">
              Island — {formatDim(islandRun.width)} × {formatDim(islandRun.depth)}
            </h3>
            <svg
              viewBox={`0 0 ${islandRun.width * PPI + 80} ${islandRun.depth * PPI + 80}`}
              className="w-full max-w-[700px] border border-gray-200 rounded bg-gray-50 print:border-gray-300"
              style={{ height: "auto", maxHeight: 200 }}
            >
              <defs>
                <marker id="arrowStartI" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
                  <path d="M6,0 L0,3 L6,6" fill="none" stroke="currentColor" strokeWidth="0.8" />
                </marker>
                <marker id="arrowEndI" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" strokeWidth="0.8" />
                </marker>
              </defs>

              <rect
                x={30} y={15}
                width={islandRun.width * PPI} height={islandRun.depth * PPI}
                fill={material.fill} stroke="#333" strokeWidth={1.5} rx={2}
              />

              {/* All edges exposed on island */}
              <rect
                x={30} y={15}
                width={islandRun.width * PPI} height={islandRun.depth * PPI}
                fill="none" stroke="#2563eb" strokeWidth={2.5} rx={2}
              />
              <text
                x={30 + islandRun.width * PPI / 2} y={15 + islandRun.depth * PPI + 14}
                textAnchor="middle" fontSize="8" fill="#2563eb" fontWeight="600"
              >
                {ep.name} Edge (all sides exposed)
              </text>

              {/* Dimensions */}
              <DimLine
                x1={30} y1={15 + islandRun.depth * PPI}
                x2={30 + islandRun.width * PPI} y2={15 + islandRun.depth * PPI}
                label={formatDim(islandRun.width)} scale={1} offset={28}
              />
              <DimLine
                x1={30 + islandRun.width * PPI} y1={15}
                x2={30 + islandRun.width * PPI} y2={15 + islandRun.depth * PPI}
                label={formatDim(islandRun.depth)} scale={1} offset={20}
              />
            </svg>
          </div>
        )}
      </div>

      {/* Waterfall Panels */}
      {(() => {
        const wfPanels = (draft?.placed ?? []).filter(
          (p) => p.placement === "base" && (p.waterfallLeft || p.waterfallRight)
        );
        if (wfPanels.length === 0) return null;
        return (
          <div className="px-6 py-4 border-t print:border-t print:border-gray-200">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-3">Waterfall Panels</h2>
            <p className="text-xs text-gray-500 mb-2">Vertical countertop material panels cascading from countertop to floor.</p>
            <table className="w-full text-xs border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left font-semibold">Cabinet</th>
                  <th className="px-2 py-1 text-left font-semibold">Side</th>
                  <th className="px-2 py-1 text-left font-semibold">Height</th>
                  <th className="px-2 py-1 text-left font-semibold">Depth</th>
                  <th className="px-2 py-1 text-left font-semibold">Area</th>
                </tr>
              </thead>
              <tbody>
                {wfPanels.flatMap((p) => {
                  const sides: string[] = [];
                  if (p.waterfallLeft) sides.push("Left");
                  if (p.waterfallRight) sides.push("Right");
                  const h = p.height ?? 34.5;
                  const d = p.depth;
                  return sides.map((s) => (
                    <tr key={`${p.uid}-${s}`} className="border-t border-gray-100">
                      <td className="px-2 py-1 font-mono">{p.masterCode}</td>
                      <td className="px-2 py-1">{s}</td>
                      <td className="px-2 py-1">{h}"</td>
                      <td className="px-2 py-1">{d}"</td>
                      <td className="px-2 py-1">{Math.ceil((h * d / 144) * 10) / 10} sq ft</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Notes */}
      <div className="px-6 py-4 border-t print:border-t print:border-gray-200">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Fabrication Notes</h2>
        <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
          <li>All dimensions are nominal and should be field-verified before fabrication.</li>
          <li>Standard overhang: 1.5" past cabinet face. Verify with installer.</li>
          <li>Sink cutouts are centered on the sink base cabinet. Confirm exact template with plumber.</li>
          {runs.some((r) => r.length > MAX_SLAB_LENGTH_IN) && (
            <li className="text-amber-700 font-medium">
              Seam required: one or more runs exceed {MAX_SLAB_LENGTH_IN}" ({formatDim(MAX_SLAB_LENGTH_IN)}).
              Seam location shown is approximate — adjust for aesthetics and structural integrity.
            </li>
          )}
          <li>Edge profile: {ep.name} on all exposed (front-facing) edges. Back edges against wall remain raw/polished flat.</li>
          <li>Backsplash: 4" height, same material, polished top edge. Field-cut to fit.</li>
          <li>Thickness: 3 cm (1.25") standard. Mitered edge available on request.</li>
          {(draft?.placed ?? []).some((p) => p.waterfallLeft || p.waterfallRight) && (
            <li className="font-medium">Waterfall panels: same material, mitered at 45° to countertop. Grain direction runs vertically. Verify seam alignment on-site.</li>
          )}
        </ul>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          @page { margin: 0.5in; size: landscape; }
        }
      `}</style>
    </div>
  );
}
