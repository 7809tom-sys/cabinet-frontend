import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Compass, LayoutPanelTop, Loader2, Ruler, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { GUIDED_ROOM_WORKFLOW_STEPS, guidedRoomWorkflowStepState, numberedLayoutTile, roomFromSeededShape, type SeededLayout, type SeededRoomShape } from "@/components/design/RoomLayoutStarter";

const HANDOFF_KEY = "cabinetdealz_room_layout_handoff_v1";

function numberFrom(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function defaultMeasurements(shape: SeededRoomShape | null) {
  const source = shape?.defaultDimensions && typeof shape.defaultDimensions === "object"
    ? shape.defaultDimensions as Record<string, unknown>
    : {};
  return {
    width: numberFrom(source.width, 144),
    depth: numberFrom(source.depth, 120),
    ceilingHeight: numberFrom(source.ceilingHeight, 96),
  };
}

function visualShape(shapeId: string) {
  if (shapeId.includes("l_")) return "rounded-tl-[8rem] border-t-8 border-l-8 border-primary/80";
  if (shapeId.includes("galley")) return "border-y-8 border-primary/80";
  if (shapeId.includes("u_")) return "rounded-b-[5rem] border-x-8 border-b-8 border-primary/80";
  return "rounded-md border-8 border-primary/80";
}

export default function RoomLayouts() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = trpc.roomLayouts.presets.useQuery({ roomType: "kitchen" });
  const roomShapes = (data?.roomShapes ?? []) as SeededRoomShape[];
  const layouts = (data?.layouts ?? []) as SeededLayout[];
  const [shapeId, setShapeId] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const selectedShape = roomShapes.find((shape) => shape.id === shapeId) ?? null;
  const availableLayouts = useMemo(
    () => layouts.filter((layout) => layout.roomShapePresetId === shapeId),
    [layouts, shapeId],
  );
  const selectedLayout = availableLayouts.find((layout) => layout.id === layoutId) ?? null;
  const [measurements, setMeasurements] = useState({ width: 144, depth: 120, ceilingHeight: 96 });
  const [workflowStage, setWorkflowStage] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    if (!shapeId && roomShapes[0]) setShapeId(roomShapes[0].id);
  }, [roomShapes, shapeId]);
  useEffect(() => {
    if (!selectedShape) return;
    setMeasurements(defaultMeasurements(selectedShape));
  }, [selectedShape?.id]);
  useEffect(() => {
    if (availableLayouts.length && !availableLayouts.some((layout) => layout.id === layoutId)) {
      setLayoutId(availableLayouts[0].id);
    }
  }, [availableLayouts, layoutId]);

  const continueToDesigner = () => {
    if (!selectedShape || !selectedLayout) return;
    const room = roomFromSeededShape({
      ...selectedShape,
      defaultDimensions: measurements,
    });
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ room, layoutPresetId: selectedLayout.id }));
    setWorkflowStage(4);
    navigate("/design?panel=room");
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[radial-gradient(circle_at_10%_5%,hsl(var(--primary)/0.14),transparent_28%),linear-gradient(180deg,hsl(var(--muted)/0.4),transparent_48%)]">
      <section className="container py-10 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <Badge className="mb-4 gap-1.5 px-3 py-1"><Sparkles className="h-3.5 w-3.5" /> Cabinet Dealz Room Planner</Badge>
          <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-6xl">Start with your room.<br /><span className="text-primary">Finish with real cabinets.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">Choose a room shape and starter layout, then continue into the Cabinet Dealz designer. We only suggest cabinets that are active, published, available, and orderable for the distributor and door style you choose.</p>
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-4 gap-1 rounded-xl border bg-background/80 p-1 shadow-sm" aria-label="Guided room design progress">
            {GUIDED_ROOM_WORKFLOW_STEPS.map(({ step, label }) => {
              const { active, complete } = guidedRoomWorkflowStepState(workflowStage, step);
              return <button key={step} type="button" onClick={() => setWorkflowStage(step)} className={`rounded-lg px-2 py-2 text-center transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : complete ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}><span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold">{complete ? "✓" : step}</span><span className="mt-1 block truncate text-[10px] font-semibold sm:text-xs">{label}</span></button>;
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="mx-auto mt-12 flex max-w-lg items-center justify-center gap-2 rounded-2xl border bg-card p-10 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading approved room layouts…</div>
        ) : error || !roomShapes.length ? (
          <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center text-sm text-amber-900">Room layouts are not available yet. Please try again shortly.</div>
        ) : (
          <div className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-[1.25fr_0.75fr]">
            <Card className="overflow-hidden border-primary/15 shadow-xl shadow-primary/5">
              <CardContent className="space-y-8 p-5 sm:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Step 1</p>
                  <h2 className="mt-1 font-serif text-2xl font-bold">Choose a room shape</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Shapes create the room geometry; they never create a duplicate product catalog.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {roomShapes.map((shape) => {
                    const selected = shape.id === shapeId;
                    return <button key={shape.id} type="button" onClick={() => { setShapeId(shape.id); setWorkflowStage(2); }} className={`group rounded-2xl border p-4 text-left transition-all ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"}`}>
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 h-12 w-14 shrink-0 ${visualShape(shape.id)}`} />
                        <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2 font-semibold">{shape.name}{selected && <CheckCircle2 className="h-4 w-4 text-primary" />}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{shape.description || "A flexible room geometry for your cabinet design."}</p></div>
                      </div>
                    </button>;
                  })}
                </div>

                <div className="border-t pt-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Step 2</p>
                  <h2 className="mt-1 font-serif text-2xl font-bold">Choose a starter layout</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {availableLayouts.map((layout) => {
                      const selected = layout.id === layoutId;
                      const layoutNumber = numberedLayoutTile(availableLayouts, layout.id) ?? 1;
                      return <button key={layout.id} type="button" onClick={() => { setLayoutId(layout.id); setWorkflowStage(3); }} className={`rounded-2xl border p-4 text-left transition-all ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm"}`}>
                        <div className="flex items-start gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{layoutNumber}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2 font-semibold"><span>{layout.name}</span>{selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{layout.description || "A flexible catalog-aware starter layout."}</p></div></div>
                      </button>;
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <Card className="border-primary/25 bg-card shadow-xl shadow-primary/5">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-center gap-2"><Ruler className="h-5 w-5 text-primary" /><h2 className="font-serif text-xl font-bold">Room measurements</h2></div>
                  <p className="mt-2 text-sm text-muted-foreground">Set a starting size. You can edit exact walls, doors, and windows in the designer.</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {(["width", "depth", "ceilingHeight"] as const).map((field) => <label key={field} className={field === "ceilingHeight" ? "col-span-2" : ""}><span className="mb-1.5 block text-xs font-medium capitalize text-muted-foreground">{field === "ceilingHeight" ? "Ceiling height" : `${field} (inches)`}</span><Input type="number" min={48} max={360} value={measurements[field]} onChange={(event) => setMeasurements((current) => ({ ...current, [field]: numberFrom(event.target.value, current[field]) }))} /></label>)}
                  </div>
                  <Button className="mt-6 w-full gap-2" size="lg" disabled={!selectedShape || !selectedLayout} onClick={continueToDesigner}>Continue to designer <ArrowRight className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/70"><CardContent className="flex gap-3 p-5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="text-sm font-semibold text-emerald-950">Real catalog protection</p><p className="mt-1 text-xs leading-relaxed text-emerald-800">The designer resolves suggestions against the selected distributor and door style. When an item is not orderable, the zone stays available for you to choose an eligible cabinet.</p></div></CardContent></Card>
              <div className="flex items-start gap-3 rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground"><Compass className="mt-0.5 h-4 w-4 text-primary" /><span>Your manual design tools remain available. This starter simply gives you a faster, catalog-safe beginning.</span></div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
