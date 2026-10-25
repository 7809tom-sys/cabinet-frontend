import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  CheckCircle2,
  CornerDownLeft,
  CornerDownRight,
  FileImage,
  FileText,
  Loader2,
  Redo2,
  RotateCcw,
  RotateCw,
  Ruler,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseLengthToInches, formatEighthInches } from "@/lib/design";
import { downloadWallBuilderPdf, downloadWallBuilderPng } from "@/lib/wallBuilderExport";
import {
  appendWallBuilderSegment,
  checkWallBuilderClosure,
  WALL_BUILDER_MIN_WALL_IN,
  wallBuilderGeometry,
  wallBuilderMetrics,
  wallBuilderRoomGeometry,
  type WallBuilderRoomGeometry,
  type WallBuilderSegment,
  type WallBuilderTurn,
} from "@/lib/polygonRoom";

export type TurnChoice = Exclude<WallBuilderTurn, "start">;

const WALL_BUILDER_SAVE_FEEDBACK_MS = 450;

export interface SegmentHistory {
  past: WallBuilderSegment[][];
  present: WallBuilderSegment[];
  future: WallBuilderSegment[][];
}

/**
 * The in-progress measured-wall sequence belongs to the Designer, not to a
 * transient dialog. Keeping this small draft outside the modal lets a user
 * safely close/reopen the room-layout dialog or switch between device layouts
 * without silently losing wall measurements.
 */
export interface WallBuilderDraft {
  expanded: boolean;
  segmentHistory: SegmentHistory;
  lengthText: string;
  turn: TurnChoice;
  viewRotationDeg: number;
}

interface Props {
  wallHeightIn: number;
  blockedReason?: string | null;
  draft?: WallBuilderDraft | null;
  onDraftChange?: (draft: WallBuilderDraft) => void;
  onApply: (room: WallBuilderRoomGeometry) => void | Promise<void>;
}

const TURN_CHOICES: Array<{
  value: TurnChoice;
  label: string;
  hint: string;
  icon: typeof ArrowRight;
}> = [
  { value: "straight", label: "Straight", hint: "Continue in the same direction", icon: ArrowRight },
  { value: "left45", label: "45° left", hint: "Use only to follow an inside recess in the clockwise walk", icon: ArrowDownRight },
  { value: "right45", label: "45° right", hint: "Follow an outside clockwise 45-degree corner", icon: ArrowDownRight },
  { value: "left90", label: "90° left", hint: "Use only to follow an inside recess in the clockwise walk", icon: CornerDownLeft },
  { value: "right90", label: "90° right", hint: "Follow an outside clockwise 90-degree corner", icon: CornerDownRight },
];

function headingLabel(headingDeg: number): string {
  const heading = ((Math.round(headingDeg) % 360) + 360) % 360;
  return ({
    0: "right",
    45: "down-right",
    90: "down",
    135: "down-left",
    180: "left",
    225: "up-left",
    270: "up",
    315: "up-right",
  } as Record<number, string>)[heading] ?? `${heading}°`;
}

function turnLabel(turn: WallBuilderTurn): string {
  if (turn === "start") return "Start";
  if (turn === "straight") return "Straight";
  if (turn === "left45") return "45° left";
  if (turn === "right45") return "45° right";
  if (turn === "left90") return "90° left";
  return "90° right";
}

function rotatePreviewPoint(point: { x: number; y: number }, rotationDeg: number) {
  const rotation = ((rotationDeg % 360) + 360) % 360;
  if (rotation === 90) return { x: -point.y, y: point.x };
  if (rotation === 180) return { x: -point.x, y: -point.y };
  if (rotation === 270) return { x: point.y, y: -point.x };
  return point;
}

function WallBuilderPreview({ segments, viewRotationDeg }: { segments: WallBuilderSegment[]; viewRotationDeg: number }) {
  const geometry = useMemo(() => wallBuilderGeometry(segments), [segments]);
  const displayPoints = useMemo(
    () => geometry.points.map((point) => rotatePreviewPoint(point, viewRotationDeg)),
    [geometry.points, viewRotationDeg],
  );
  const bounds = useMemo(() => {
    const xs = displayPoints.map((point) => point.x);
    const ys = displayPoints.map((point) => point.y);
    const minX = Math.min(0, ...xs);
    const maxX = Math.max(1, ...xs);
    const minY = Math.min(0, ...ys);
    const maxY = Math.max(1, ...ys);
    const width = Math.max(36, maxX - minX);
    const height = Math.max(36, maxY - minY);
    const padding = Math.max(18, Math.max(width, height) * 0.13);
    return { minX: minX - padding, minY: minY - padding, width: width + padding * 2, height: height + padding * 2 };
  }, [displayPoints]);
  const labelSize = Math.max(6, Math.min(13, Math.max(bounds.width, bounds.height) / 23));
  const path = displayPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const activeLeg = segments.length > 0
    ? { start: displayPoints[displayPoints.length - 2], end: displayPoints[displayPoints.length - 1] }
    : null;

  return (
    <div className="relative min-h-64 overflow-hidden rounded-xl border border-[#d8c7a1] bg-[#fbfaf6] shadow-inner" data-testid="wall-builder-preview" data-view-rotation={viewRotationDeg}>
      {segments.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted-foreground">
          Enter the first wall length. It starts to the right; every next wall continues from its end.
        </div>
      ) : (
        <svg
          className="h-72 w-full"
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Live clockwise continuous wall preview"
        >
          <defs>
            <pattern id="wall-builder-grid" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#d9e5df" strokeWidth="0.45" />
            </pattern>
            <marker id="wall-builder-clockwise-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#b98d3e" />
            </marker>
          </defs>
          <rect x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="url(#wall-builder-grid)" />
          {geometry.closed ? (
            <path d={`${path} Z`} fill="#d4a75a" fillOpacity="0.13" stroke="none" />
          ) : null}
          <path d={path} fill="none" stroke="#1a2744" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {activeLeg ? (
            <line
              data-testid="wall-builder-clockwise-arrow"
              x1={activeLeg.start.x}
              y1={activeLeg.start.y}
              x2={activeLeg.end.x}
              y2={activeLeg.end.y}
              stroke="#b98d3e"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              markerEnd="url(#wall-builder-clockwise-arrow)"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {displayPoints.map((point, index) => (
            <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={index === 0 ? 3.4 : 2.5} fill={index === 0 ? "#b98d3e" : "#1a2744"} stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <text x={displayPoints[0].x} y={displayPoints[0].y - labelSize * 1.15} textAnchor="middle" fontSize={labelSize * 0.78} fontWeight="700" fill="#765416">START · WALL 1</text>
          {activeLeg ? <text x={activeLeg.end.x} y={activeLeg.end.y - labelSize * 1.15} textAnchor="middle" fontSize={labelSize * 0.78} fontWeight="700" fill="#765416">NEXT WALL</text> : null}
          {segments.map((segment, index) => {
            const start = displayPoints[index];
            const end = displayPoints[index + 1];
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            return (
              <g key={`${segment.headingDeg}-${index}`}>
                <rect
                  x={midX - labelSize * 2.2}
                  y={midY - labelSize * 0.8}
                  width={labelSize * 4.4}
                  height={labelSize * 1.5}
                  rx={labelSize * 0.35}
                  fill="white"
                  fillOpacity="0.92"
                  stroke="#1a2744"
                  strokeWidth="0.5"
                />
                <text x={midX} y={midY + labelSize * 0.25} textAnchor="middle" fontSize={labelSize} fontWeight="700" fill="#1a2744">
                  {formatEighthInches(segment.lengthIn)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {segments.length > 0 ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border bg-white/90 px-2 py-1 text-[10px] font-semibold text-[#1a2744] shadow-sm">
          {geometry.closed ? "Room closed" : `Open end: ${headingLabel(segments[segments.length - 1].headingDeg)}`}
        </div>
      ) : null}
    </div>
  );
}

export function WallBuilder({ wallHeightIn, blockedReason, draft, onDraftChange, onApply }: Props) {
  const [expanded, setExpanded] = useState(draft?.expanded ?? false);
  const [segmentHistory, setSegmentHistory] = useState<SegmentHistory>(draft?.segmentHistory ?? { past: [], present: [], future: [] });
  const [lengthText, setLengthText] = useState(draft?.lengthText ?? "120");
  const [turn, setTurn] = useState<TurnChoice>(draft?.turn ?? "right90");
  const [message, setMessage] = useState<string | null>(null);
  const [viewRotationDeg, setViewRotationDeg] = useState(draft?.viewRotationDeg ?? 0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success">("idle");
  const [exportState, setExportState] = useState<"idle" | "png" | "pdf">("idle");
  const segments = segmentHistory.present;
  const geometry = useMemo(() => wallBuilderGeometry(segments), [segments]);
  const metrics = useMemo(() => wallBuilderMetrics(segments), [segments]);
  const parsedLength = parseLengthToInches(lengthText);
  const validLength = parsedLength != null && parsedLength >= WALL_BUILDER_MIN_WALL_IN;

  useEffect(() => {
    onDraftChange?.({ expanded, segmentHistory, lengthText, turn, viewRotationDeg });
  }, [expanded, lengthText, onDraftChange, segmentHistory, turn, viewRotationDeg]);

  const commitSegments = (next: WallBuilderSegment[]) => {
    setSegmentHistory((current) => ({
      past: [...current.past, current.present],
      present: next,
      future: [],
    }));
    setMessage(null);
    setSaveState("idle");
  };

  const addWall = () => {
    if (!validLength || parsedLength == null) {
      setMessage(`Enter a wall length of at least ${WALL_BUILDER_MIN_WALL_IN} inches.`);
      return;
    }
    const next = appendWallBuilderSegment(segments, parsedLength, segments.length === 0 ? "start" : turn);
    if (next.length === segments.length) {
      setMessage(`Enter a wall length of at least ${WALL_BUILDER_MIN_WALL_IN} inches.`);
      return;
    }
    const nextGeometry = wallBuilderGeometry(next);
    if (nextGeometry.error) {
      setMessage(nextGeometry.error);
      return;
    }
    commitSegments(next);
  };

  const checkClosure = () => {
    const result = checkWallBuilderClosure(segments);
    setMessage(result.error ?? "Your measured walls return to the starting point. The room is ready to apply.");
  };

  const undo = () => {
    setSegmentHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
    setMessage(null);
    setSaveState("idle");
  };

  const redo = () => {
    setSegmentHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      };
    });
    setMessage(null);
    setSaveState("idle");
  };

  const exportLayout = async (format: "png" | "pdf") => {
    if (segments.length === 0) {
      setMessage("Add at least one wall before downloading the room layout.");
      return;
    }
    setExportState(format);
    setMessage(null);
    try {
      if (format === "png") await downloadWallBuilderPng(segments, viewRotationDeg, wallHeightIn);
      else await downloadWallBuilderPdf(segments, viewRotationDeg, wallHeightIn);
      setMessage(`${format.toUpperCase()} room layout downloaded successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The room layout file could not be generated.");
    } finally {
      setExportState("idle");
    }
  };

  const apply = async () => {
    if (blockedReason) {
      setMessage(blockedReason);
      return;
    }
    const result = wallBuilderRoomGeometry(segments, wallHeightIn);
    if (!result.room) {
      setMessage(result.error);
      return;
    }
    setSaveState("saving");
    setMessage(null);
    await new Promise((resolve) => window.setTimeout(resolve, WALL_BUILDER_SAVE_FEEDBACK_MS));
    try {
      await onApply(result.room);
      setSaveState("success");
    } catch {
      setSaveState("idle");
      setMessage("The room layout could not be saved. Please try again.");
    }
  };

  return (
    <section className="rounded-xl border-2 border-[#d4a75a]/60 bg-gradient-to-br from-[#fffaf0] via-white to-[#f4f7fb] shadow-sm" data-testid="continuous-wall-builder">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-[#fff8e8]"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1a2744] text-white shadow-sm"><Ruler className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block font-serif text-base font-bold text-[#1a2744]">Build walls continuously</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Walk the room clockwise: type each wall length, choose the next turn, and watch the room draw itself.</span>
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-[#d4a75a] bg-white px-3 py-1 text-xs font-bold text-[#765416]">{expanded ? "Hide" : "Open builder"}</span>
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-[#d8c7a1] p-4">
          <div className="space-y-3">
            <div data-testid="wall-builder-clockwise-guide" className="rounded-lg border border-[#d4a75a]/70 bg-[#fff8e8] px-3 py-2.5 text-xs leading-5 text-[#654d24]">
              <strong className="text-[#1a2744]">Clockwise wall sequence.</strong> Start at the gold <strong>Wall 1</strong> point, then add each new wall from the gold arrow at the prior wall&apos;s end. At an outside corner choose a right turn; use a left turn only for an inside recess.
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
              <div>
                <p className="text-xs font-bold text-[#1a2744]">Drawing view</p>
                <p className="text-[10px] text-muted-foreground">Rotate the preview without changing any wall measurement.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewRotationDeg((current) => (current + 90) % 360)}
                aria-label="Rotate drawing view 90 degrees clockwise"
                data-testid="rotate-wall-builder-view"
              >
                <RotateCw className="mr-1.5 h-4 w-4" /> Rotate view · {viewRotationDeg}°
              </Button>
            </div>
            <WallBuilderPreview segments={segments} viewRotationDeg={viewRotationDeg} />
            <div className="grid grid-cols-2 gap-2" aria-label="Live room measurements">
              <div className="rounded-lg border border-[#d8c7a1] bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Perimeter</p>
                <p className="mt-1 text-lg font-bold text-[#1a2744]" data-testid="wall-builder-perimeter">{formatEighthInches(metrics.perimeterIn)}</p>
                <p className="text-[10px] text-muted-foreground">{(metrics.perimeterIn / 12).toFixed(1)} linear ft entered</p>
              </div>
              <div className="rounded-lg border border-[#d8c7a1] bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Room area</p>
                <p className="mt-1 text-lg font-bold text-[#1a2744]" data-testid="wall-builder-area">{metrics.areaSqFt == null ? "—" : `${metrics.areaSqFt.toFixed(1)} sq ft`}</p>
                <p className="text-[10px] text-muted-foreground">{metrics.closed ? "Calculated from the enclosed room" : "Close the walls to calculate"}</p>
              </div>
            </div>
            {message || geometry.error ? (
              <p className={`rounded-lg border px-3 py-2 text-xs leading-5 ${geometry.error ? "border-rose-300 bg-rose-50 text-rose-900" : "border-[#d8c7a1] bg-white text-[#654d24]"}`} role="status">
                {geometry.error ?? message}
              </p>
            ) : null}
            {blockedReason ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">{blockedReason}</p> : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#1a2744]">{segments.length === 0 ? "Wall 1" : `Wall ${segments.length + 1}`}</p>
                  <p className="text-[11px] text-muted-foreground">{segments.length === 0 ? "Clockwise start: Wall 1 begins at the gold point and runs right." : "Clockwise sequence: this wall begins at the gold arrow on the last wall."}</p>
                </div>
                <span className="rounded-md bg-[#1a2744]/5 px-2 py-1 text-[10px] font-bold text-[#1a2744]">Exact 1/8&quot;</span>
              </div>
              <div className="mt-3 space-y-2">
                <Label htmlFor="continuous-wall-length" className="text-xs font-semibold">Wall length</Label>
                <Input
                  id="continuous-wall-length"
                  value={lengthText}
                  onChange={(event) => setLengthText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") addWall(); }}
                  placeholder={'Example: 101", 8\' 5", or 78'}
                  inputMode="decimal"
                  aria-invalid={lengthText.trim().length > 0 && !validLength}
                />
                <p className="text-[10px] text-muted-foreground">Accepts tape-measure entries such as 126 3/4, 10&apos; 6&quot;, or 78.</p>
              </div>

              {segments.length > 0 ? (
                <div className="mt-3">
                  <Label className="text-xs font-semibold">Turn before this wall</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {TURN_CHOICES.map((choice) => {
                      const Icon = choice.icon;
                      const active = turn === choice.value;
                      return (
                        <button
                          key={choice.value}
                          type="button"
                          title={choice.hint}
                          onClick={() => setTurn(choice.value)}
                          className={`flex min-h-10 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors ${active ? "border-[#1a2744] bg-[#1a2744] text-white" : "border-border bg-background text-foreground hover:border-[#d4a75a] hover:bg-[#fff8e8]"}`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${choice.value === "left45" ? "-scale-y-100" : ""}`} /> {choice.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <Button type="button" className="mt-3 w-full bg-[#1a2744] text-white hover:bg-[#283c63]" onClick={addWall} disabled={!validLength || geometry.closed} data-testid="add-continuous-wall">
                <ArrowRight className="mr-1.5 h-4 w-4" /> Add {segments.length === 0 ? "first wall" : "next wall"}
              </Button>
            </div>

            <div className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-[#1a2744]">Wall list</p>
                <span className="text-[11px] text-muted-foreground">{segments.length} wall{segments.length === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                {segments.length === 0 ? <p className="rounded-md bg-muted/50 px-2 py-3 text-center text-xs text-muted-foreground">No walls added yet.</p> : null}
                {segments.map((segment, index) => (
                  <div key={`${segment.headingDeg}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/45 px-2.5 py-2 text-xs">
                    <span className="min-w-0"><strong>Wall {index + 1}</strong><span className="ml-1.5 text-muted-foreground">{turnLabel(segment.turn)} · {headingLabel(segment.headingDeg)}</span></span>
                    <span className="shrink-0 font-bold text-[#1a2744]">{formatEighthInches(segment.lengthIn)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={undo} disabled={segmentHistory.past.length === 0} data-testid="undo-wall-builder"><Undo2 className="mr-1.5 h-4 w-4" /> Undo</Button>
                <Button type="button" variant="outline" onClick={redo} disabled={segmentHistory.future.length === 0} data-testid="redo-wall-builder"><Redo2 className="mr-1.5 h-4 w-4" /> Redo</Button>
                <Button type="button" variant="outline" className="col-span-2" onClick={() => commitSegments([])} disabled={segments.length === 0}><Trash2 className="mr-1.5 h-4 w-4" /> Clear all walls</Button>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-3 shadow-sm">
              <div>
                <p className="text-sm font-bold text-[#1a2744]">Download room layout</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Export the current rotated view with every wall number and exact measurement.</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => exportLayout("png")} disabled={segments.length === 0 || exportState !== "idle"} data-testid="export-wall-builder-png">
                  {exportState === "png" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileImage className="mr-1.5 h-4 w-4" />} Download PNG
                </Button>
                <Button type="button" variant="outline" onClick={() => exportLayout("pdf")} disabled={segments.length === 0 || exportState !== "idle"} data-testid="export-wall-builder-pdf">
                  {exportState === "pdf" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />} Download PDF
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-[#d8c7a1] bg-[#fffaf0] p-3">
              <p className="text-xs leading-5 text-[#654d24]">Enter <strong>every wall length from your measurements</strong>. You may apply an open connected wall path at any time. Check closure is optional and never adds or changes a wall.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={checkClosure} disabled={segments.length < 3}><RotateCcw className="mr-1.5 h-4 w-4" /> Check closure</Button>
                <Button type="button" onClick={apply} disabled={segments.length === 0 || Boolean(geometry.error) || Boolean(blockedReason) || saveState === "saving" || saveState === "success"} data-testid="apply-continuous-wall-room" aria-busy={saveState === "saving"}>
                  {saveState === "saving" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : saveState === "success" ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
                  {saveState === "saving" ? "Saving room…" : saveState === "success" ? "Room saved" : "Apply walls"}
                </Button>
              </div>
              {saveState === "saving" ? <p className="mt-2 text-center text-xs font-semibold text-[#1a2744]" role="status">Saving your measured wall layout…</p> : null}
              {saveState === "success" ? <p className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-900" role="status"><CheckCircle2 className="mr-1 inline h-4 w-4" /> Room layout saved successfully.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
