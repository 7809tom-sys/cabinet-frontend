import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LayoutPanelTop, Loader2, Ruler, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import type { RoomData } from "@/lib/design";
import type { WallBuilderRoomGeometry } from "@/lib/polygonRoom";
import { WallBuilder, type WallBuilderDraft } from "./WallBuilder";

export type SeededRoomShape = {
  id: string;
  name: string;
  description: string | null;
  roomType: string;
  geometryTemplate: unknown;
  defaultDimensions: unknown;
};

export type SeededLayout = {
  id: string;
  roomShapePresetId: string;
  name: string;
  description: string | null;
  minimumWidth: unknown;
  minimumDepth: unknown;
};

export const GUIDED_ROOM_WORKFLOW_STEPS = [
  { step: 1, label: "Floorplan" },
  { step: 2, label: "Pick a layout" },
  { step: 3, label: "Design your kitchen" },
  { step: 4, label: "Summary" },
] as const;

export function guidedRoomWorkflowStepState(activeStep: number, step: number) {
  return { active: activeStep === step, complete: activeStep > step };
}

export function numberedLayoutTile(layouts: SeededLayout[], layoutId: string) {
  const index = layouts.findIndex((layout) => layout.id === layoutId);
  return index < 0 ? null : index + 1;
}

type NormalizedVertex = { x: number; y: number };

interface RoomLayoutStarterProps {
  selectedStyleId?: number | null;
  selectedDistributorId?: number | null;
  onApplyRoom: (room: RoomData) => void;
  onLayoutSelected?: (layoutPresetId: string) => void;
  /** Shows the lightweight first-cabinet guide after a beginner room is applied. */
  onBeginnerRoomApplied?: () => void;
  onApplyContinuousRoom?: (room: WallBuilderRoomGeometry) => void;
  /** Friendly storefront copy when continuous-wall testing is not enabled in this scope. */
  continuousWallComingSoonMessage?: string | null;
  continuousWallBlockedReason?: string | null;
  wallHeightIn?: number;
  /** Preserves unfinished advanced wall measurements across dialog/sheet closes. */
  continuousWallDraft?: WallBuilderDraft | null;
  onContinuousWallDraftChange?: (draft: WallBuilderDraft) => void;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numeric(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function roomFromSeededShape(shape: SeededRoomShape): RoomData {
  const dimensions = record(shape.defaultDimensions);
  const width = numeric(dimensions.width, 144);
  const depth = numeric(dimensions.depth, 120);
  const ceilingHeight = numeric(dimensions.ceilingHeight, 96);
  const geometry = record(shape.geometryTemplate);
  const rawVertices = Array.isArray(geometry.vertices) ? geometry.vertices : [];
  const rawWalls = Array.isArray(geometry.walls) ? geometry.walls : [];

  // Keep seeded rectangles in the existing simple-room format. Polygon data is
  // only used where the chosen room shape truly has more than four vertices.
  if (shape.id === "rectangle" || rawVertices.length <= 4) return { width, depth, ceilingHeight };

  const stamp = `${shape.id}-${Date.now().toString(36)}`;
  const vertices = rawVertices.map((vertex, index) => {
    const point = record(vertex);
    return {
      id: `${stamp}-v${index}`,
      x: Math.max(0, Math.min(width, numeric(point.x, 0) * width)),
      y: Math.max(0, Math.min(depth, numeric(point.y, 0) * depth)),
    };
  });
  const customWalls = vertices.map((vertex, index) => ({
    id: `${stamp}-w${index}`,
    startVertexId: vertex.id,
    endVertexId: vertices[(index + 1) % vertices.length].id,
    label: typeof rawWalls[index] === "string" ? rawWalls[index] : `Wall ${index + 1}`,
  }));

  return { width, depth, ceilingHeight, vertices, customWalls };
}

export function RoomLayoutStarter({
  selectedStyleId,
  selectedDistributorId,
  onApplyRoom,
  onLayoutSelected,
  onBeginnerRoomApplied,
  onApplyContinuousRoom,
  continuousWallComingSoonMessage,
  continuousWallBlockedReason,
  wallHeightIn = 96,
  continuousWallDraft,
  onContinuousWallDraftChange,
}: RoomLayoutStarterProps) {
  const { data, isLoading, error } = trpc.roomLayouts.presets.useQuery({ roomType: "kitchen" });
  const [shapeId, setShapeId] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [workflowStage, setWorkflowStage] = useState<1 | 2 | 3 | 4>(1);
  const [startMode, setStartMode] = useState<"starter" | "continuous">("starter");
  const showContinuousWallComingSoon = !onApplyContinuousRoom && Boolean(continuousWallComingSoonMessage?.trim());

  const roomShapes = (data?.roomShapes ?? []) as SeededRoomShape[];
  const layouts = (data?.layouts ?? []) as SeededLayout[];
  const selectedShape = roomShapes.find((shape) => shape.id === shapeId) ?? null;
  const availableLayouts = useMemo(
    () => layouts.filter((layout) => layout.roomShapePresetId === shapeId),
    [layouts, shapeId],
  );
  const selectedLayout = availableLayouts.find((layout) => layout.id === layoutId) ?? null;

  useEffect(() => {
    if (!shapeId && roomShapes[0]) setShapeId(roomShapes[0].id);
  }, [roomShapes, shapeId]);
  useEffect(() => {
    if (availableLayouts.length && !availableLayouts.some((layout) => layout.id === layoutId)) {
      setLayoutId(availableLayouts[0].id);
    }
  }, [availableLayouts, layoutId]);

  const canResolveCatalog = Boolean(selectedLayout && selectedStyleId && selectedDistributorId);
  const { data: catalogData, isFetching: catalogLoading } = trpc.roomLayouts.eligibleCatalog.useQuery(
    {
      layoutPresetId: selectedLayout?.id ?? "unselected",
      distributorId: selectedDistributorId ?? 0,
      styleId: selectedStyleId ?? 0,
    },
    { enabled: canResolveCatalog },
  );

  if (isLoading) {
    return <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-4 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading room layouts…</div>;
  }
  if (error || !roomShapes.length) {
    return <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Room layouts are not available yet. Confirm that the room-layout migration and seed have completed.</div>;
  }

  return (
    <Card className="border-primary/20 bg-card shadow-none">
      <CardHeader className="space-y-1 px-3 py-2">
        <div className="flex items-center gap-2 text-primary"><Sparkles className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Fast start</span></div>
        <div className="grid grid-cols-4 gap-1 rounded-md border bg-muted/35 p-0.5" aria-label="Guided kitchen design progress">
          {GUIDED_ROOM_WORKFLOW_STEPS.map(({ step, label }) => {
            const { active, complete } = guidedRoomWorkflowStepState(workflowStage, step);
            return <button key={step} type="button" onClick={() => setWorkflowStage(step)} className={`min-w-0 truncate rounded px-1 py-1 text-center text-[11px] font-semibold leading-tight transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : complete ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-background"}`}>
              {complete ? "✓ " : `${step}. `}{label}
            </button>;
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 pt-0">
        {onApplyContinuousRoom ? (
          <section className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5" aria-label="Room design mode">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{startMode === "continuous" ? "Advanced continuous walls" : "Easy room shapes"}</span>
            <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide ${startMode === "continuous" ? "text-[#9a6717]" : "text-primary"}`}>{startMode === "continuous" ? "Advanced" : "Beginner"}</span>
            <Switch
              checked={startMode === "continuous"}
              onCheckedChange={(advanced) => setStartMode(advanced ? "continuous" : "starter")}
              aria-label="Use advanced continuous walls"
            />
          </section>
        ) : showContinuousWallComingSoon ? (
          <section className="rounded-xl border border-amber-300/80 bg-amber-50/70 p-3 shadow-sm" aria-label="Continuous walls availability">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-[#9a6717]"><Ruler className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-amber-950">Continuous walls are coming soon</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#9a6717]">Coming soon</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-900">{continuousWallComingSoonMessage}</p>
              </div>
            </div>
          </section>
        ) : null}
        <div key={startMode} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
        {startMode === "continuous" && onApplyContinuousRoom ? (
          <section className="space-y-2 rounded-xl border border-[#b98d3e]/40 bg-amber-50/40 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><Ruler className="h-4 w-4 text-[#b98d3e]" /> Build walls continuously</div>
            <p className="text-xs leading-relaxed text-muted-foreground">Advanced measured-wall mode. Use the wall attributes and exact turns here; beginner room shapes remain unchanged.</p>
            <WallBuilder
              wallHeightIn={wallHeightIn}
              blockedReason={continuousWallBlockedReason}
              draft={continuousWallDraft}
              onDraftChange={onContinuousWallDraftChange}
              onApply={onApplyContinuousRoom}
            />
          </section>
        ) : (
          <>
        <section className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold"><Ruler className="h-3.5 w-3.5 text-primary" /> 1. Pick a room shape</div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {roomShapes.map((shape) => {
              const active = shape.id === shapeId;
              return (
                <button key={shape.id} type="button" onClick={() => { setShapeId(shape.id); setWorkflowStage(2); }}
                  className={`rounded-md border px-2 py-1.5 text-left transition-colors ${active ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-background hover:border-primary/50"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{shape.name}</span>{active ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : null}</div>
                  {shape.description ? <p className="truncate text-[11px] leading-4 text-muted-foreground">{shape.description}</p> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold"><LayoutPanelTop className="h-3.5 w-3.5 text-primary" /> 2. Pick a starter layout</div>
          <div className="grid grid-cols-1 gap-1">
            {availableLayouts.map((layout) => {
              const active = layout.id === layoutId;
              const layoutNumber = numberedLayoutTile(availableLayouts, layout.id) ?? 1;
              return (
                <button key={layout.id} type="button" onClick={() => { setLayoutId(layout.id); setWorkflowStage(3); }}
                  className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${active ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-background hover:border-primary/50"}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{layoutNumber}</span>
                  <span className="shrink-0 text-sm font-semibold">{layout.name}</span>
                  {layout.description ? <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{layout.description}</span> : <span className="flex-1" />}
                  {active ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-md border bg-background/80 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">Design summary</span>{catalogLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}</div>
          {!canResolveCatalog ? <p className="text-[11px] leading-4 text-muted-foreground">Choose a door style first to view real orderable SKU options for this layout.</p> : null}
          {canResolveCatalog && catalogData ? (
            <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-3">
              {catalogData.zones.map((zone) => {
                const candidatesByZone = catalogData.candidatesByZone as Record<string, unknown[]>;
                const candidates = candidatesByZone[zone.zoneKey] ?? [];
                return <div key={zone.zoneKey} className="flex items-center justify-between gap-2 text-[11px]"><span className="font-medium">{zone.label}</span><Badge variant={candidates.length ? "secondary" : "outline"} className="px-1.5 py-0 text-[10px]">{candidates.length ? `${candidates.length} real SKU option${candidates.length === 1 ? "" : "s"}` : "Choose manually"}</Badge></div>;
              })}
            </div>
          ) : null}
        </section>

        <Button className="sticky bottom-0 z-10 w-full" disabled={!selectedShape || !selectedLayout} onClick={() => {
          if (!selectedShape || !selectedLayout) return;
          onApplyRoom(roomFromSeededShape(selectedShape));
          onLayoutSelected?.(selectedLayout.id);
          onBeginnerRoomApplied?.();
          setWorkflowStage(4);
        }}>
          Apply room shape and continue
        </Button>
          </>
        )}
        </div>
      </CardContent>
    </Card>
  );
}
