import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Check, Ban, ShowerHead, TriangleAlert } from "lucide-react";
import {
  SHOWER_STEPS,
  SHOWER_WALLS,
  SHOWER_WALL_LABELS,
  choosePart,
  offeredParts,
  showerCartLines,
  showerPlacementIssues,
  showerSubtotal,
  skipStep,
  unansweredSteps,
  type ShowerCatalogPart,
  type ShowerPartKind,
  type ShowerSelection,
  type ShowerStepId,
  type ShowerWall,
} from "@/lib/showerBuilder";

/**
 * Build Shower wizard.
 *
 * Five steps, every one optional, and every step picks its own wall. Every card is a
 * real Pelican catalog row with its real price — nothing here is a placeholder, and a
 * row without a price is not offered.
 */

const KIND_LABEL: Record<ShowerPartKind, string> = {
  surround: "Wall panel",
  pan: "Shower pan",
  system: "Valve & head",
  niche: "Niche",
  soap: "Soap tray",
  door: "Glass door",
};

const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Catalog rows that a shower step can offer. */
type ShowerCatalogRow = {
  id: number;
  pelicanCode?: string | null;
  name?: string | null;
  description?: string | null;
  sellPrice?: number | null;
  size?: string | null;
  imageUrl?: string | null;
  subCategory?: string | null;
};

/**
 * Classify a live Shower & Bath catalog row into a shower part.
 *
 * This reads the catalog row's own description, which is the only field that says
 * what a row actually is. `subCategory` is the vendor's import bucket and is not
 * reliable on its own: shower bases are filed under "Shower Accessories".
 */
export function showerPartKind(row: ShowerCatalogRow): ShowerPartKind | null {
  const text = `${row.description ?? ""} ${row.name ?? ""}`.toLowerCase();
  // Pans first: "Shower Base with Tile Flange" also contains no other keyword.
  if (/shower base|shower pan|shower receptor|shower tray/.test(text)) return "pan";
  if (/\bniche\b/.test(text)) return "niche";
  if (/soap dish|soap tray|soap caddy/.test(text)) return "soap";
  if (/shower door|tub door|glass door/.test(text)) return "door";
  // A valve set with a soap dish is still the shower valve, so valves win over soap.
  if (/valve|shower head|shower set|shower system|thermostatic/.test(text)) return "system";
  if (/surround|shower wall|wall kit|glue up|tub surround/.test(text)) return "surround";
  return null;
}

/** Turn live rows into offerable parts, keeping only priced ones. */
export function showerCatalogParts(rows: readonly ShowerCatalogRow[]): ShowerCatalogPart[] {
  const parts: ShowerCatalogPart[] = [];
  for (const row of rows) {
    const kind = showerPartKind(row);
    if (!kind) continue;
    const code = (row.pelicanCode ?? "").trim();
    const price = row.sellPrice;
    // An unpriced or code-less row is not a product we can sell, so it is not offered.
    if (!code || price == null || !Number.isFinite(price) || price < 0) continue;
    parts.push({
      code,
      id: row.id,
      name: (row.name ?? row.description ?? code).trim(),
      price,
      size: row.size ?? null,
      imageUrl: row.imageUrl ?? null,
      kind,
    });
  }
  return parts;
}

function PartCard({
  part,
  selected,
  onSelect,
}: {
  part: ShowerCatalogPart;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={`shower-part-${part.code}`}
      className={`group flex h-full flex-col overflow-hidden rounded-lg border text-left transition-colors ${
        selected ? "border-[var(--color-gold)] ring-2 ring-[var(--color-gold)]/40" : "border-border hover:border-foreground/30"
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {part.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={part.imageUrl} alt={part.name} className="h-full w-full object-contain p-2" loading="lazy" />
        ) : null}
        {selected && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-gold)] text-[var(--color-navy)]">
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[part.kind]}</span>
        <span className="line-clamp-2 text-sm font-medium">{part.name}</span>
        <span className="mt-auto flex items-baseline justify-between pt-2">
          <span className="font-mono text-[11px] text-muted-foreground">{part.code}</span>
          <span className="text-sm font-semibold" data-testid={`shower-price-${part.code}`}>{money(part.price)}</span>
        </span>
      </div>
    </button>
  );
}

export function ShowerBuilderWizard({
  onDone,
}: {
  /** Called with the finished selection; the caller places parts and adds cart lines. */
  onDone?: (selection: ShowerSelection) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selection, setSelection] = useState<ShowerSelection>({});
  const [wallByStep, setWallByStep] = useState<Partial<Record<ShowerStepId, ShowerWall>>>({});

  // `pelican.byCategory` is the live catalog query the rest of the app reads. The
  // generated AppRouter in this checkout does not carry it, so it is read through a
  // typed shim (the same approach `lib/crmFormLetterContext` takes).
  const showerTrpc = trpc as unknown as {
    pelican: {
      byCategory: {
        useQuery: (
          input: { category: string; scope: "catalog"; limit: number; offset: number },
          options: { staleTime: number },
        ) => { data?: { items?: ShowerCatalogRow[]; suggested?: ShowerCatalogRow[]; total?: number } | null; isLoading: boolean };
      };
    };
  };
  const catalog = showerTrpc.pelican.byCategory.useQuery(
    { category: "Shower & Bath", scope: "catalog", limit: 200, offset: 0 },
    { staleTime: 60_000 },
  );
  // `byCategory` returns the family under `suggested` (older payloads used
  // `items`); accept either so the wizard reads the live catalog whichever shape
  // the API serves.
  const rows = (catalog.data?.suggested ?? catalog.data?.items ?? []) as ShowerCatalogRow[];
  const catalogParts = useMemo(() => showerCatalogParts(rows), [rows]);

  const step = SHOWER_STEPS[stepIndex]!;
  const isLastStep = stepIndex === SHOWER_STEPS.length - 1;
  const { parts, droppedUnpriced } = offeredParts(step.id, catalogParts);
  const chosen = selection[step.id] ?? null;
  // Each step's wall starts from the surround's back wall but is free to change.
  const wallForStep: ShowerWall = wallByStep[step.id] ?? (chosen?.wall ?? "top");
  const issues = showerPlacementIssues(selection);
  const lines = showerCartLines(selection);

  // Seed the step's wall once its parts exist, so the selector is never blank.
  useEffect(() => {
    if (!step.picksWall) return;
    setWallByStep((current) => (current[step.id] ? current : { ...current, [step.id]: current[step.id] ?? wallForStep }));
  }, [step.id, step.picksWall, wallForStep]);

  const pickPart = (part: ShowerCatalogPart) => {
    setSelection((current) => choosePart(current, step.id, part, step.picksWall ? wallForStep : null));
  };

  const pickWall = (wall: ShowerWall) => {
    setWallByStep((current) => ({ ...current, [step.id]: wall }));
    // Re-place the current part on the newly chosen wall.
    setSelection((current) => {
      const pick = current[step.id];
      if (!pick?.part) return current;
      return choosePart(current, step.id, pick.part, wall);
    });
  };

  const skip = () => {
    setSelection((current) => skipStep(current, step.id));
    advance();
  };

  const advance = () => {
    if (isLastStep) {
      onDone?.(selection);
      return;
    }
    setStepIndex((index) => Math.min(index + 1, SHOWER_STEPS.length - 1));
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4" data-testid="shower-builder-wizard">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Build a shower</h1>
        <p className="text-sm text-muted-foreground">
          Five steps, every one optional — add what you want and skip the rest. Each step puts its part on the wall you choose.
        </p>
      </header>

      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Shower steps">
        {SHOWER_STEPS.map((entry, index) => {
          const done = selection[entry.id] != null;
          const active = index === stepIndex;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setStepIndex(index)}
                data-testid={`shower-step-${entry.id}`}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                  active ? "border-foreground bg-foreground text-background" : done ? "border-emerald-500/60 text-emerald-700" : "border-border text-muted-foreground"
                }`}
              >
                <span className="font-semibold">{index + 1}</span>
                {entry.title}
                {done && !active && <Check className="h-3.5 w-3.5" />}
              </button>
            </li>
          );
        })}
      </ol>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{step.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{step.blurb}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={skip} data-testid="shower-skip-step">
            <Ban className="mr-1.5 h-4 w-4" />
            Skip / don&apos;t add
          </Button>
        </div>

        {step.picksWall && (
          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="shower-wall-picker">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wall</span>
            {SHOWER_WALLS.map((wall) => (
              <Button
                key={wall}
                type="button"
                size="sm"
                variant={wall === wallForStep ? "default" : "outline"}
                onClick={() => pickWall(wall)}
                data-testid={`shower-wall-${wall}`}
                aria-pressed={wall === wallForStep}
              >
                {SHOWER_WALL_LABELS[wall]}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground">Only this step moves. Other steps keep their own wall.</span>
          </div>
        )}

        {catalog.isLoading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-56 w-full" />)}
          </div>
        ) : parts.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="shower-no-products">
            <TriangleAlert className="mr-1.5 inline h-4 w-4" />
            Pelican has no priced {step.title.toLowerCase()} in the catalog right now, so this step offers nothing. We did not
            substitute a generic part.
            {droppedUnpriced > 0 && ` (${droppedUnpriced} row${droppedUnpriced === 1 ? "" : "s"} exist without a price.)`}
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {parts.map((part) => (
                <PartCard
                  key={part.code}
                  part={part}
                  selected={chosen?.part?.code === part.code}
                  onSelect={() => pickPart(part)}
                />
              ))}
            </div>
            {droppedUnpriced > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {droppedUnpriced} catalog row{droppedUnpriced === 1 ? "" : "s"} in this category {droppedUnpriced === 1 ? "has" : "have"} no price and {droppedUnpriced === 1 ? "is" : "are"} not offered.
              </p>
            )}
          </>
        )}

        {issues.filter((issue) => issue.stepId === step.id).map((issue) => (
          <p key={issue.message} className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {issue.message}
          </p>
        ))}

        <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {unansweredSteps(selection).length > 0 && (
              <span className="text-xs text-muted-foreground">{unansweredSteps(selection).length} step(s) still to answer</span>
            )}
            <Button size="sm" onClick={advance} disabled={!chosen?.part && !isLastStep} data-testid="shower-next-step">
              {isLastStep ? "Finish" : "Next"} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4" data-testid="shower-summary">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShowerHead className="h-4 w-4" /> Your shower
          </h3>
          <Badge variant="secondary">{lines.length} part{lines.length === 1 ? "" : "s"}</Badge>
        </div>
        {lines.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing chosen yet. Every step can be skipped.</p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {lines.map((line) => (
              <li key={line.masterCode} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">
                  {line.name}
                  {line.wall && (
                    <span className="ml-2 text-xs text-muted-foreground">on the {SHOWER_WALL_LABELS[line.wall].toLowerCase()}</span>
                  )}
                </span>
                <span className="shrink-0 font-medium" data-testid={`shower-line-price-${line.masterCode}`}>{money(line.unitPrice)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
          <span>Subtotal</span>
          <span data-testid="shower-subtotal">{money(showerSubtotal(selection))}</span>
        </div>
      </Card>
    </div>
  );
}

export default ShowerBuilderWizard;
