import { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/hooks/useSeo";
import { toast } from "sonner";
import { formatPrice, type PelicanCategory } from "@/lib/pelican";
import { StepProductGrid } from "@/components/surfaces/StepProductGrid";
import { AreaCalculator } from "@/components/surfaces/AreaCalculator";
import {
  DEFAULT_SQFT_PER_BOX,
  DEFAULT_WASTE_PCT,
  computeBoxes,
  saveSurfaceSelection,
  requestSurfaceHandoff,
  guessBacksplashMaterialId,
  guessCountertopMaterialId,
  guessFlooringMaterialId,
  type SurfacePick,
  type SurfaceRole,
  type SurfaceSelection,
} from "@/lib/surfaceSelection";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  PencilRuler,
  Waves,
  ImageIcon,
  RotateCcw,
  Save,
  Download,
  LogIn,
} from "lucide-react";

type StepDef = {
  role: SurfaceRole;
  category: PelicanCategory;
  title: string;
  blurb: string;
  needsArea: boolean;
  optional?: boolean;
};

const STEPS: StepDef[] = [
  {
    role: "flooring",
    category: "Flooring",
    title: "Flooring",
    blurb:
      "Pick your floor first — it sets the tone for the whole room. Enter the square footage and we'll work out how many boxes you need.",
    needsArea: true,
  },
  {
    role: "tile",
    category: "Tile & Mosaic",
    title: "Backsplash Tile & Mosaic",
    blurb:
      "Choose a backsplash tile. Enter the wall area to cover and we'll calculate the packages required.",
    needsArea: true,
    optional: true,
  },
  {
    role: "countertop",
    category: "Quartz Slabs (Countertops)",
    title: "Countertop",
    blurb:
      "Select your quartz countertop. This becomes the default surface in the 3D Designer, sized to sit on 34.5\" base cabinets for a standard 36\" finished height.",
    needsArea: false,
  },
  {
    role: "sink",
    category: "Sinks & Faucets",
    title: "Sink & Faucet",
    blurb:
      "Finish with a sink and faucet. These are recommended in the pre-design flow and carried into your design.",
    needsArea: false,
    optional: true,
  },
];

type AreaState = { areaSqft: number | null; sqftPerBox: number; wastePct: number };

const PREVIEW_EXAMPLE = "/manus-storage/wizard_preview_example_f9579597.png";

export default function SurfacesWizard() {
  useSeo({
    title: "Build Your Kitchen — Surfaces & Fixtures Wizard | Cabinet Dealz",
    description:
      "A guided flow to choose flooring, backsplash tile, quartz countertops, sinks and faucets — with square-footage box math and an AI photoreal preview of your kitchen.",
  });

  const [, navigate] = useLocation();
  const [stepIdx, setStepIdx] = useState(0);
  const isPreviewStep = stepIdx === STEPS.length;

  // One pick per role.
  const [picks, setPicks] = useState<Partial<Record<SurfaceRole, SurfacePick>>>({});
  // Area inputs keyed by role (only used for flooring/tile).
  const [areas, setAreas] = useState<Partial<Record<SurfaceRole, AreaState>>>({
    flooring: { areaSqft: null, sqftPerBox: DEFAULT_SQFT_PER_BOX.flooring, wastePct: DEFAULT_WASTE_PCT },
    tile: { areaSqft: null, sqftPerBox: DEFAULT_SQFT_PER_BOX.tile, wastePct: DEFAULT_WASTE_PCT },
  });
  const [layout] = useState<SurfaceSelection["layout"]>("l-shape");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [profileRestored, setProfileRestored] = useState(false);

  const step = STEPS[stepIdx];

  const setArea = (role: SurfaceRole, next: AreaState) =>
    setAreas((prev) => ({ ...prev, [role]: next }));

  const pickFor = (role: SurfaceRole, product: SurfacePick) => {
    setPicks((prev) => ({ ...prev, [role]: { ...product, role } as SurfacePick }));
  };

  // ─── Running total ──────────────────────────────────────────────────────────
  const lineItems = useMemo(() => {
    const rows: {
      role: SurfaceRole;
      label: string;
      pick: SurfacePick;
      qty: number;
      qtyLabel: string;
      lineTotal: number | null;
    }[] = [];
    for (const s of STEPS) {
      const pick = picks[s.role];
      if (!pick) continue;
      if (s.needsArea) {
        const a = areas[s.role];
        const boxes = computeBoxes(a?.areaSqft, a?.sqftPerBox, a?.wastePct) ?? 0;
        rows.push({
          role: s.role,
          label: s.title,
          pick,
          qty: boxes,
          qtyLabel: boxes > 0 ? `${boxes} box${boxes > 1 ? "es" : ""}` : "enter area",
          lineTotal: pick.sellPrice != null && boxes > 0 ? pick.sellPrice * boxes : null,
        });
      } else {
        rows.push({
          role: s.role,
          label: s.title,
          pick,
          qty: 1,
          qtyLabel: "1",
          lineTotal: pick.sellPrice,
        });
      }
    }
    return rows;
  }, [picks, areas]);

  const runningTotal = lineItems.reduce((sum, r) => sum + (r.lineTotal ?? 0), 0);

  const canAdvance = () => {
    if (isPreviewStep) return false;
    if (step.optional) return true;
    return !!picks[step.role];
  };

  const goNext = () => {
    if (!isPreviewStep && !picks[step.role] && !step.optional) {
      toast.error(`Please choose a ${step.title.toLowerCase()} to continue, or skip if optional.`);
      return;
    }
    setStepIdx((i) => Math.min(i + 1, STEPS.length));
  };
  const goBack = () => setStepIdx((i) => Math.max(0, i - 1));

  // ─── AI preview ───────────────────────────────────────────────────────────
  const previewMutation = trpc.surfaces.previewKitchen.useMutation({
    onSuccess: (res) => {
      setPreviewUrl(res.url);
      toast.success("Your realistic preview is ready.");
    },
    onError: (err) => {
      toast.error(err.message || "Preview generation failed. Please try again.");
    },
  });

  const generatePreview = () => {
    const items = STEPS.map((s) => picks[s.role])
      .filter((p): p is SurfacePick => !!p)
      .map((p) => ({ id: p.id, category: p.category, role: p.role as any }));
    if (items.length === 0) {
      toast.error("Select at least one surface to generate a preview.");
      return;
    }
    previewMutation.mutate({ items, layout });
  };

  // ─── Build the current selection blob (pure) ────────────────────────────────
  const buildSelection = (): SurfaceSelection => ({
    v: 1,
    savedAt: Date.now(),
    layout,
    previewUrl: previewUrl ?? null,
    picks: Object.fromEntries(
      STEPS.map((s) => {
        const pick = picks[s.role];
        if (!pick) return [s.role, undefined];
        const a = s.needsArea ? areas[s.role] : undefined;
        const boxes = s.needsArea ? computeBoxes(a?.areaSqft, a?.sqftPerBox, a?.wastePct) : null;
        return [
          s.role,
          {
            ...pick,
            areaSqft: a?.areaSqft ?? null,
            sqftPerBox: a?.sqftPerBox ?? null,
            wastePct: a?.wastePct ?? null,
            boxes,
          } as SurfacePick,
        ];
      }).filter(([, v]) => v !== undefined) as [SurfaceRole, SurfacePick][]
    ),
  });

  const hasAnyPick = Object.values(picks).some(Boolean);

  // ─── Save profile (explicit, user-triggered) ────────────────────────────────
  const saveProfileMutation = trpc.surfaces.saveProfile.useMutation({
    onSuccess: () => {
      utils.surfaces.getProfile.invalidate();
      toast.success("Saved to your account — pick up right where you left off anytime.");
    },
    onError: (err) => toast.error(err.message || "Could not save your selections."),
  });

  const saveMySelections = () => {
    if (!hasAnyPick) {
      toast.error("Choose at least one product before saving.");
      return;
    }
    const sel = buildSelection();
    // Always keep a local copy so guests keep their work on this device.
    saveSurfaceSelection(sel);
    if (isAuthenticated) {
      saveProfileMutation.mutate({ selection: sel, previewUrl: previewUrl ?? null });
    } else {
      toast.success("Saved on this device. Sign in to keep it across devices.");
    }
  };

  // ─── Explicit hand-off to the Design Tool (only when the customer is ready) ──
  const startMyKitchen = () => {
    if (!hasAnyPick) {
      toast.error("Choose at least one product before designing your kitchen.");
      return;
    }
    const sel = buildSelection();
    saveSurfaceSelection(sel); // keep the profile too
    requestSurfaceHandoff(sel); // one-time opt-in signal the Design Tool consumes
    toast.success("Great — opening the 3D Designer with your selections.");
    navigate("/design");
  };

  const downloadPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = "cabinet-dealz-kitchen-preview.png";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const resetWizard = () => {
    setPicks({});
    setPreviewUrl(null);
    setStepIdx(0);
    setAreas({
      flooring: { areaSqft: null, sqftPerBox: DEFAULT_SQFT_PER_BOX.flooring, wastePct: DEFAULT_WASTE_PCT },
      tile: { areaSqft: null, sqftPerBox: DEFAULT_SQFT_PER_BOX.tile, wastePct: DEFAULT_WASTE_PCT },
    });
  };

  // ─── Restore a saved profile back into the wizard on return (signed-in only) ──
  const profileQuery = trpc.surfaces.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (profileRestored) return;
    if (!profileQuery.data) return;
    const sel = profileQuery.data.selection as SurfaceSelection | null;
    if (!sel || sel.v !== 1 || !sel.picks) {
      setProfileRestored(true);
      return;
    }
    // Only restore if the user hasn't already started picking in this session.
    if (hasAnyPick) {
      setProfileRestored(true);
      return;
    }
    const restoredPicks: Partial<Record<SurfaceRole, SurfacePick>> = {};
    const restoredAreas: Partial<Record<SurfaceRole, AreaState>> = {};
    (Object.keys(sel.picks) as SurfaceRole[]).forEach((role) => {
      const p = sel.picks[role];
      if (!p) return;
      restoredPicks[role] = { ...p, role } as SurfacePick;
      if (role === "flooring" || role === "tile") {
        restoredAreas[role] = {
          areaSqft: p.areaSqft ?? null,
          sqftPerBox: p.sqftPerBox ?? DEFAULT_SQFT_PER_BOX[role],
          wastePct: p.wastePct ?? DEFAULT_WASTE_PCT,
        };
      }
    });
    setPicks(restoredPicks);
    setAreas((prev) => ({ ...prev, ...restoredAreas }));
    if (sel.previewUrl) setPreviewUrl(sel.previewUrl);
    setProfileRestored(true);
    toast.info("Restored your saved selections. Continue where you left off, or reset to start fresh.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.data, profileRestored]);

  const progressPct = ((stepIdx + (isPreviewStep ? 1 : 0)) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="border-b border-border/60 bg-[var(--color-navy)] text-white">
        <div className="container py-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium">
            <Waves className="h-3.5 w-3.5 text-[var(--color-gold)]" /> Build your kitchen
          </div>
          <h1 className="font-serif text-3xl font-bold md:text-4xl">
            Surfaces & Fixtures, step by step
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Choose your flooring, backsplash, countertop, sink and faucet in order. We'll size the
            boxes you need and can render a photoreal preview from the real product photos before you
            open the 3D Designer.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="border-b border-border/60 bg-card">
        <div className="container py-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {STEPS.map((s, i) => {
              const done = !!picks[s.role];
              const active = i === stepIdx && !isPreviewStep;
              return (
                <button
                  key={s.role}
                  type="button"
                  onClick={() => setStepIdx(i)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-navy)] text-white"
                      : done
                        ? "bg-[var(--color-gold)]/15 text-[var(--color-navy)] dark:text-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      done ? "bg-[var(--color-gold)] text-[var(--color-navy)]" : "bg-black/10"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {s.title}
                  {s.optional && <span className="text-[10px] opacity-60">(optional)</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setStepIdx(STEPS.length)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isPreviewStep
                  ? "bg-[var(--color-navy)] text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Preview & Finish
            </button>
          </div>
          <Progress value={progressPct} className="mt-3 h-1.5" />
        </div>
      </div>

      {/* Body: content + summary */}
      <div className="container grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div>
          {!isPreviewStep ? (
            <>
              <div className="mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-2xl font-bold">
                    Step {stepIdx + 1}: {step.title}
                  </h2>
                  {step.optional && <Badge variant="secondary">Optional</Badge>}
                </div>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{step.blurb}</p>
              </div>

              {step.needsArea && (
                <div className="mb-5">
                  <AreaCalculator
                    label={step.title}
                    areaSqft={areas[step.role]?.areaSqft ?? null}
                    sqftPerBox={areas[step.role]?.sqftPerBox ?? DEFAULT_SQFT_PER_BOX[step.role]}
                    wastePct={areas[step.role]?.wastePct ?? DEFAULT_WASTE_PCT}
                    pricePerBox={picks[step.role]?.sellPrice ?? null}
                    onChange={(next) => setArea(step.role, next)}
                  />
                </div>
              )}

              <StepProductGrid
                category={step.category}
                role={step.role}
                selectedId={picks[step.role]?.id ?? null}
                onPick={(p) => pickFor(step.role, p)}
              />
            </>
          ) : (
            <PreviewStep
              picks={picks}
              previewUrl={previewUrl}
              isGenerating={previewMutation.isPending}
              onGenerate={generatePreview}
              exampleUrl={PREVIEW_EXAMPLE}
            />
          )}

          {/* Guest nudge: saving across devices needs sign-in */}
          {isPreviewStep && !isAuthenticated && hasAnyPick && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                Saving keeps your picks on this device. Sign in to keep them across devices and load
                them into the 3D Designer anytime.
              </span>
              <a href={getLoginUrl()}>
                <Button variant="outline" size="sm" className="gap-2">
                  <LogIn className="h-4 w-4" /> Sign in
                </Button>
              </a>
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <Button variant="outline" onClick={goBack} disabled={stepIdx === 0} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {!isPreviewStep ? (
              <div className="flex gap-2">
                {step.optional && !picks[step.role] && (
                  <Button variant="ghost" onClick={() => setStepIdx((i) => i + 1)}>
                    Skip
                  </Button>
                )}
                <Button
                  onClick={goNext}
                  disabled={!canAdvance()}
                  className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={saveMySelections}
                  disabled={!hasAnyPick || saveProfileMutation.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saveProfileMutation.isPending ? "Saving…" : "Save my selections"}
                </Button>
                {previewUrl && (
                  <Button variant="outline" onClick={downloadPreview} className="gap-2">
                    <Download className="h-4 w-4" /> Download render
                  </Button>
                )}
                <Button
                  onClick={startMyKitchen}
                  disabled={!hasAnyPick}
                  className="gap-2 bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]/90"
                >
                  <PencilRuler className="h-4 w-4" /> I'm ready to design my kitchen
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Summary rail */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Your selections</h3>
                <button
                  type="button"
                  onClick={resetWizard}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {lineItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing selected yet. Pick a product to get started.
                </div>
              ) : (
                lineItems.map((r) => (
                  <div key={r.role} className="flex gap-3 px-4 py-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {r.pick.imageUrl ? (
                        <img
                          src={r.pick.imageUrl}
                          alt={r.pick.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {r.label}
                      </div>
                      <div className="truncate text-xs font-semibold">{r.pick.name}</div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{r.qtyLabel}</span>
                        <span className="font-semibold text-foreground">
                          {r.lineTotal != null ? formatPrice(r.lineTotal) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {lineItems.length > 0 && (
              <div className="border-t border-border px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Estimated total</span>
                  <span className="font-bold text-[var(--color-navy)] dark:text-foreground">
                    {formatPrice(runningTotal)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  Member pricing shown. Countertop fabrication, freight and install are quoted
                  separately at order.
                </p>
              </div>
            )}
          </Card>

          <div className="mt-4 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            Prefer to browse first?{" "}
            <Link href="/surfaces" className="font-semibold text-[var(--color-navy)] underline dark:text-foreground">
              Shop all Surfaces & Fixtures
            </Link>
            .
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Preview step ─────────────────────────────────────────────────────────────
function PreviewStep({
  picks,
  previewUrl,
  isGenerating,
  onGenerate,
  exampleUrl,
}: {
  picks: Partial<Record<SurfaceRole, SurfacePick>>;
  previewUrl: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
  exampleUrl: string;
}) {
  const chosen = Object.values(picks).filter((p): p is SurfacePick => !!p);
  return (
    <div>
      <div className="mb-5">
        <h2 className="font-serif text-2xl font-bold">Preview & finish</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Generate a photoreal render of your kitchen built from the actual product photos you
          selected. Nothing moves automatically — when you're ready, save your selections or take
          them into the 3D Designer yourself.
        </p>
      </div>

      {/* Reference chips */}
      {chosen.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {chosen.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-xs"
            >
              <span className="h-6 w-6 overflow-hidden rounded-full bg-muted">
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />}
              </span>
              <span className="max-w-[140px] truncate font-medium">{p.name}</span>
            </div>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="relative aspect-[16/9] w-full bg-muted">
          {previewUrl ? (
            <img src={previewUrl} alt="Your kitchen preview" className="h-full w-full object-cover" />
          ) : (
            <>
              <img
                src={exampleUrl}
                alt="Example realistic kitchen preview"
                className="h-full w-full object-cover opacity-40"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30 text-center text-white">
                <Sparkles className="h-8 w-8 text-[var(--color-gold)]" />
                <div className="max-w-sm px-6 text-sm">
                  Example render shown. Generate your own from the products you picked.
                </div>
              </div>
            </>
          )}
          {isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="text-sm">Rendering your kitchen… this can take up to a minute.</div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            The render is an AI approximation to help you visualize materials together — not an exact
            quote drawing.
          </p>
          <Button
            onClick={onGenerate}
            disabled={isGenerating || chosen.length === 0}
            className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
          >
            <Sparkles className="h-4 w-4" />
            {previewUrl ? "Regenerate preview" : "Generate Realistic Preview"}
          </Button>
        </div>
      </Card>

      {/* Material mapping note */}
      <div className="mt-5 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        We'll pre-select the closest matching materials in the 3D Designer:
        <ul className="mt-2 space-y-1">
          {picks.flooring && (
            <li>
              Flooring → <span className="font-medium text-foreground">{picks.flooring.name}</span>{" "}
              (renders as {materialName("flooring", picks.flooring)})
            </li>
          )}
          {picks.tile && (
            <li>
              Backsplash → <span className="font-medium text-foreground">{picks.tile.name}</span>{" "}
              (renders as {materialName("tile", picks.tile)})
            </li>
          )}
          {picks.countertop && (
            <li>
              Countertop →{" "}
              <span className="font-medium text-foreground">{picks.countertop.name}</span>{" "}
              (renders as {materialName("countertop", picks.countertop)})
            </li>
          )}
          {picks.sink && (
            <li>
              Sink → <span className="font-medium text-foreground">{picks.sink.name}</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function materialName(role: SurfaceRole, pick: SurfacePick): string {
  if (role === "flooring") return prettyId(guessFlooringMaterialId(pick));
  if (role === "tile") return prettyId(guessBacksplashMaterialId(pick));
  if (role === "countertop") return prettyId(guessCountertopMaterialId(pick));
  return "";
}
function prettyId(id: string | null): string {
  if (!id) return "closest match";
  return id.replace(/-/g, " ");
}
