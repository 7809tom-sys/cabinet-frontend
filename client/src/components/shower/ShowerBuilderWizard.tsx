import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Check, Ban, ShowerHead, TriangleAlert } from "lucide-react";
import {
  SHOWER_STEPS,
  SHOWER_WALLS,
  SHOWER_WALL_LABELS,
  SHOWER_SURROUND_DECORS,
  choosePart,
  offeredParts,
  showerCartLines,
  showerPlacementIssues,
  showerSizeFit,
  showerSubtotal,
  showerSurroundDecor,
  showerSurroundGroups,
  showerSurroundSize,
  skipStep,
  type ShowerCatalogPart,
  type ShowerPartKind,
  type ShowerSelection,
  type ShowerStepId,
  type ShowerSurroundDecorId,
  type ShowerSurroundSize,
  type ShowerWall,
} from "@/lib/showerBuilder";

/**
 * Build Shower wizard.
 *
 * The order the owner asked for: panels & surrounds, then the pan inside them, then
 * heads & faucets, then niches & soap trays, then the glass door last. Each step picks
 * its own wall. Every step except the pan may be skipped.
 *
 * Each choice is handed back to the designer through `onPlacePart`, which places the
 * part in Floor Plan and 3D. A part that is placed is the only thing that reaches the
 * cart, so skipping a step or deleting a part removes it from the cart too.
 */

/**
 * Every step may be skipped, the pan included. A shopper can put in wall panels
 * today and add the pan later, or price a surround on its own. The wizard never
 * blocks; the warnings in `showerPlacementIssues` state what a partial shower still
 * needs so the omission is visible rather than silent.
 */
export const SKIPPABLE_STEPS: ReadonlySet<ShowerStepId> = new Set<ShowerStepId>([
  "surround",
  "pan",
  "heads",
  "niche",
  "door",
]);

const KIND_LABEL: Record<ShowerPartKind, string> = {
  surround: "Wall panel set",
  pan: "Shower pan",
  system: "Valve & head",
  niche: "Niche",
  soap: "Soap tray",
  door: "Glass door",
};

const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type ShowerCatalogRow = {
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
 * Reads the catalog row's own description, which is the field that says what the row
 * is. `subCategory` is the vendor's import bucket and is not reliable on its own:
 * shower bases are filed under "Shower Accessories".
 */
export function showerPartKind(row: ShowerCatalogRow): ShowerPartKind | null {
  const text = `${row.description ?? ""} ${row.name ?? ""}`.toLowerCase();
  if (/shower base|shower pan|shower receptor|shower tray/.test(text)) return "pan";
  if (/\bniche\b/.test(text)) return "niche";
  if (/soap dish|soap tray|soap caddy/.test(text)) return "soap";
  if (/shower door|tub door|glass door/.test(text)) return "door";
  // A valve set that ships with a soap dish is still the shower valve.
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

/**
 * The rows the wizard offers a part from.
 *
 * `pelican.byCategory` returns two different things. `suggested` is a short
 * "popular" teaser — for Shower & Bath the live API sends six glass doors there —
 * and `items` is the full category: every surround, pan, valve set, niche, soap tray
 * and door. The wizard used to read `suggested` first, so on production only the
 * glass door step had anything in it and the four steps before it reported "Pelican
 * has no priced ... right now". Tom could not choose a surround, pan, heads or niche
 * for that reason alone.
 *
 * The full list is what a chooser needs, so `items` wins; `suggested` is only a
 * fallback for an older backend that sent nothing else. The two are de-duplicated by
 * catalog id so a row that appears in both is still offered once.
 */
export function showerCatalogRows(
  data: { items?: readonly ShowerCatalogRow[] | null; suggested?: readonly ShowerCatalogRow[] | null } | null | undefined,
): ShowerCatalogRow[] {
  const merged: ShowerCatalogRow[] = [];
  const seen = new Set<number>();
  for (const row of [...(data?.items ?? []), ...(data?.suggested ?? [])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
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
        <span className="mt-auto flex items-baseline justify-between gap-2 pt-2">
          <span className="font-mono text-[11px] text-muted-foreground">{part.code}</span>
          <span className="text-sm font-semibold" data-testid={`shower-price-${part.code}`}>{money(part.price)}</span>
        </span>
      </div>
    </button>
  );
}

/**
 * One décor swatch: the finish the shopper chooses first, before the size.
 *
 * The chip is drawn from the same four colours the 3D material uses, with a second
 * colour showing the veining or grout, so the swatch predicts the wall rather than
 * being an abstract label. The real catalog photo is shown beside it when the
 * catalog has one, because that is the product they are actually buying.
 */
function DecorSwatch({
  label,
  swatch,
  accent,
  imageUrl,
  selected,
  optionCount,
  testId,
  onSelect,
}: {
  label: string;
  swatch: string;
  accent: string;
  imageUrl?: string | null;
  selected: boolean;
  optionCount: number;
  testId: string;
  onSelect: () => void;
}) {
  const [imageOk, setImageOk] = useState(Boolean(imageUrl));
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={testId}
      className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
        selected ? "border-[var(--color-gold)] ring-2 ring-[var(--color-gold)]/40" : "border-border hover:border-foreground/30"
      }`}
    >
      <span
        aria-hidden
        className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-black/10"
        style={{ background: `linear-gradient(135deg, ${swatch} 0%, ${swatch} 55%, ${accent} 55%, ${accent} 100%)` }}
      >
        {/* The décor gradient shows through until the catalog photo loads, so the
            swatch always predicts the wall even when the image is slow or missing. */}
        {imageUrl && imageOk ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageOk(false)}
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">
          {optionCount} size{optionCount === 1 ? "" : "s"}
        </span>
      </span>
      {selected && (
        <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)] text-[var(--color-navy)]">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

export type ShowerWizardProps = {
  /** Place (or replace) a part in the plan. Called on every choice. */
  onPlacePart?: (input: {
    stepId: ShowerStepId;
    part: ShowerCatalogPart;
    wall: ShowerWall | null;
    /** Mounting height above the pan floor, for a wall fitting. */
    heightIn?: number;
  }) => void;
  /** Undo a step: the part leaves the plan and the cart. */
  onRemovePart?: (stepId: ShowerStepId) => void;
  /** Sizing / mounting warning from the designer, shown in the step that caused it. */
  warningsByStep?: Partial<Record<ShowerStepId, string[]>>;
  /**
   * The clear width of each alcove the room can hold a shower in, keyed by the
   * wizard's own wall name. The surround step marks which sizes span the wall the
   * shopper picked, so the fit note talks about that wall rather than the widest one
   * in the room. A size that does not fit is still offered, with the gap named,
   * because the shopper may be planning a different wall or a future wall move.
   */
  alcoveWidthsByWall?: Partial<Record<ShowerWall, number>>;
  onDone?: (selection: ShowerSelection) => void;
  onClose?: () => void;
};

export function ShowerBuilderWizard({
  onPlacePart,
  onRemovePart,
  warningsByStep,
  onDone,
  onClose,
  alcoveWidthsByWall,
}: ShowerWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selection, setSelection] = useState<ShowerSelection>({});
  const [wallByStep, setWallByStep] = useState<Partial<Record<ShowerStepId, ShowerWall>>>({});
  const [valveHeight, setValveHeight] = useState("48");
  const [headHeight, setHeadHeight] = useState("80");
  const [nicheHeight, setNicheHeight] = useState("44");
  // Surround is a two-stage choice: décor first, then the size that fits. Keeping
  // the décor in its own state means the size list stays filtered to one finish even
  // before a size has been committed to the plan.
  const [surroundDecor, setSurroundDecor] = useState<ShowerSurroundDecorId | null>(null);

  // `pelican.byCategory` is the live catalog query the rest of the app reads. The
  // generated AppRouter in this checkout does not carry it, so it is read through a
  // typed shim (the same approach `lib/crmFormLetterContext` takes).
  const showerTrpc = trpc as unknown as {
    pelican: {
      byCategory: {
        useQuery: (
          input: { category: string; scope: "catalog"; limit: number; offset: number },
          options: { staleTime: number },
        ) => { data?: { items?: ShowerCatalogRow[]; suggested?: ShowerCatalogRow[] } | null; isLoading: boolean };
      };
    };
  };
  const catalog = showerTrpc.pelican.byCategory.useQuery(
    { category: "Shower & Bath", scope: "catalog", limit: 200, offset: 0 },
    { staleTime: 60_000 },
  );
  const rows = useMemo(() => showerCatalogRows(catalog.data), [catalog.data]);
  const catalogParts = useMemo(() => showerCatalogParts(rows), [rows]);

  const step = SHOWER_STEPS[stepIndex]!;
  const isLastStep = stepIndex === SHOWER_STEPS.length - 1;
  const { parts, droppedUnpriced } = offeredParts(step.id, catalogParts);
  const chosen = selection[step.id] ?? null;
  const wallForStep: ShowerWall = wallByStep[step.id] ?? chosen?.wall ?? "top";
  const issues = showerPlacementIssues(selection);
  const stepWarnings = warningsByStep?.[step.id] ?? [];

  const surroundGroups = useMemo(() => showerSurroundGroups(catalogParts), [catalogParts]);
  const activeDecor = surroundDecor ?? (chosen?.part ? showerSurroundDecor(chosen.part) : null);
  const activeDecorGroup = activeDecor
    ? surroundGroups.groups.find((group) => group.decor.id === activeDecor) ?? null
    : null;

  const heightForStep = (): number | undefined => {
    if (step.id === "heads") return Number(headHeight) || 80;
    if (step.id === "niche") return Number(nicheHeight) || 44;
    return undefined;
  };

  useEffect(() => {
    if (!step.picksWall) return;
    setWallByStep((current) => (current[step.id] ? current : { ...current, [step.id]: wallForStep }));
  }, [step.id, step.picksWall, wallForStep]);

  const pickPart = (part: ShowerCatalogPart) => {
    const wall = step.picksWall ? wallForStep : null;
    setSelection((current) => choosePart(current, step.id, part, wall));
    onPlacePart?.({ stepId: step.id, part, wall, heightIn: heightForStep() });
  };

  const pickWall = (wall: ShowerWall) => {
    setWallByStep((current) => ({ ...current, [step.id]: wall }));
    const pick = selection[step.id];
    if (!pick?.part) return;
    setSelection((current) => choosePart(current, step.id, pick.part!, wall));
    // Re-place the chosen part on its new wall.
    onPlacePart?.({ stepId: step.id, part: pick.part, wall, heightIn: heightForStep() });
  };

  const changeHeight = (value: string) => {
    if (step.id === "heads") setValveHeight(value);
    if (step.id === "niche") setNicheHeight(value);
    const pick = selection[step.id];
    if (!pick?.part) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    onPlacePart?.({ stepId: step.id, part: pick.part, wall: pick.wall, heightIn: numeric });
  };

  const skip = () => {
    setSelection((current) => skipStep(current, step.id));
    onRemovePart?.(step.id);
    if (isLastStep) {
      onDone?.(skipStep(selection, step.id));
      return;
    }
    setStepIndex((index) => Math.min(index + 1, SHOWER_STEPS.length - 1));
  };

  const advance = () => {
    if (isLastStep) {
      onDone?.(selection);
      return;
    }
    setStepIndex((index) => Math.min(index + 1, SHOWER_STEPS.length - 1));
  };

  return (
    <div className="flex w-full flex-col gap-4" data-testid="shower-builder-wizard">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Build a shower</h2>
          <p className="text-sm text-muted-foreground">
            Five steps in build order. Each step goes on the wall you choose, and every step can be skipped.
          </p>
        </div>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose} data-testid="shower-wizard-close">
            Close
          </Button>
        )}
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
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : done
                      ? "border-emerald-500/60 text-emerald-700"
                      : "border-border text-muted-foreground"
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
            <h3 className="text-base font-semibold">
              Step {stepIndex + 1} of {SHOWER_STEPS.length} · {step.title}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{step.blurb}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={skip} data-testid="shower-skip-step">
            <Ban className="mr-1.5 h-4 w-4" /> Skip / don&apos;t add
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
            <span className="text-xs text-muted-foreground" data-testid="shower-wall-hint">
              {step.id === "surround"
                ? "The back panel goes on this wall; side panels fill in automatically on its left and right."
                : "Only this step moves. Other steps keep their own wall."}
            </span>
          </div>
        )}

        {(step.id === "heads" || step.id === "niche") && (
          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid={`shower-height-${step.id}`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {step.id === "niche" ? "Niche height" : "Mount heights"}
            </span>
            {step.id === "niche" ? (
              <label className="flex items-center gap-1.5 text-xs">
                <Input
                  type="number"
                  min={0}
                  max={96}
                  step={1}
                  value={nicheHeight}
                  onChange={(event) => changeHeight(event.target.value)}
                  className="h-8 w-20 text-xs"
                  data-testid="shower-niche-height-input"
                />
                in above the pan
              </label>
            ) : (
              <>
                <label className="flex items-center gap-1.5 text-xs">
                  Valve
                  <Input
                    type="number" min={24} max={72} step={1} value={valveHeight}
                    onChange={(event) => changeHeight(event.target.value)}
                    className="h-8 w-20 text-xs" data-testid="shower-valve-height-input"
                  />
                  in
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  Head
                  <Input
                    type="number" min={60} max={96} step={1} value={headHeight}
                    onChange={(event) => { setHeadHeight(event.target.value); changeHeight(event.target.value); }}
                    className="h-8 w-20 text-xs" data-testid="shower-head-height-input"
                  />
                  in
                </label>
                <span className="text-xs text-muted-foreground">Standard is valve 48″ and head 80″ above the pan.</span>
              </>
            )}
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
        ) : step.id === "surround" ? (
          <>
            {/* Décor first: the finish is the choice a shopper actually makes, and it
                is the same four décors Pelican publishes for every width. */}
            <div className="mt-4" data-testid="shower-surround-decors">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Finish
              </span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {surroundGroups.groups.map((group) => (
                  <DecorSwatch
                    key={group.decor.id}
                    label={group.decor.label}
                    swatch={group.decor.swatch}
                    accent={group.decor.accent}
                    imageUrl={group.options[0]?.part.imageUrl ?? null}
                    optionCount={group.options.length}
                    selected={activeDecor === group.decor.id}
                    testId={`shower-decor-${group.decor.id}`}
                    onSelect={() => setSurroundDecor(group.decor.id)}
                  />
                ))}
              </div>
            </div>

            {activeDecorGroup ? (
              <div className="mt-4" data-testid="shower-surround-sizes">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Size · {activeDecorGroup.decor.label}
                </span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {activeDecorGroup.options.map(({ size, part }) => {
                    const fit = showerSizeFit(size, alcoveWidthsByWall?.[wallForStep]);
                    const selected = chosen?.part?.code === part.code;
                    return (
                      <button
                        key={part.code}
                        type="button"
                        onClick={() => pickPart(part)}
                        aria-pressed={selected}
                        data-testid={`shower-part-${part.code}`}
                        className={`flex flex-col gap-1 overflow-hidden rounded-lg border text-left transition-colors ${
                          selected
                            ? "border-[var(--color-gold)] ring-2 ring-[var(--color-gold)]/40"
                            : "border-border hover:border-foreground/30"
                        }`}
                      >
                        {/* The catalog's own product photo, so the size being chosen is
                            the real Pelican SKU and not a text row. */}
                        <span className="relative flex h-28 w-full items-center justify-center bg-muted">
                          {part.imageUrl ? (
                            <img
                              src={part.imageUrl}
                              alt={part.name}
                              className="h-full w-full object-contain p-2"
                              loading="lazy"
                            />
                          ) : null}
                          {selected && (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-gold)] text-[var(--color-navy)]">
                              <Check className="h-4 w-4" />
                            </span>
                          )}
                        </span>
                        <span className="flex flex-col gap-1 p-3">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{size.label}</span>
                            {fit.ok ? (
                              <Badge variant="secondary" className="shrink-0 text-[10px]">Fits</Badge>
                            ) : (
                              <Badge variant="outline" className="shrink-0 border-amber-400 text-[10px] text-amber-800">
                                {size.widthIn}″
                              </Badge>
                            )}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {size.tubHeight ? "Tub-height set" : "Full-height shower set"}
                            {size.depthIn ? ` · ${size.depthIn}″ deep` : ""}
                          </span>
                          {!fit.ok && fit.message && (
                            <span className="text-[11px] text-amber-800">{fit.message}</span>
                          )}
                          <span className="mt-auto flex items-baseline justify-between gap-2 pt-1">
                            <span className="font-mono text-[11px] text-muted-foreground">{part.code}</span>
                            <span className="text-sm font-semibold" data-testid={`shower-price-${part.code}`}>
                              {money(part.price)}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Pick a finish above and its sizes will appear here.
              </p>
            )}
            {droppedUnpriced > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {droppedUnpriced} catalog row{droppedUnpriced === 1 ? "" : "s"} in this category{" "}
                {droppedUnpriced === 1 ? "has" : "have"} no price and {droppedUnpriced === 1 ? "is" : "are"} not offered.
              </p>
            )}
          </>
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
                {droppedUnpriced} catalog row{droppedUnpriced === 1 ? "" : "s"} in this category{" "}
                {droppedUnpriced === 1 ? "has" : "have"} no price and {droppedUnpriced === 1 ? "is" : "are"} not offered.
              </p>
            )}
          </>
        )}

        {Array.from(new Set([
          ...stepWarnings,
          ...issues.filter((issue) => issue.stepId === step.id).map((issue) => issue.message),
        ])).map((message) => (
          <p key={message} className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {message}
          </p>
        ))}

        <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button
            size="sm"
            onClick={advance}
            data-testid="shower-next-step"
          >
            {isLastStep ? "Finish" : "Next"} <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Card className="p-4" data-testid="shower-summary">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShowerHead className="h-4 w-4" /> Your shower
          </h3>
          <Badge variant="secondary">{showerCartLines(selection).length} part{showerCartLines(selection).length === 1 ? "" : "s"}</Badge>
        </div>
        {showerCartLines(selection).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing chosen yet. Every step can be skipped.</p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {showerCartLines(selection).map((line) => (
              <li key={line.masterCode} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">
                  {line.name}
                  {line.wall && <span className="ml-2 text-xs text-muted-foreground">on the {SHOWER_WALL_LABELS[line.wall].toLowerCase()}</span>}
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
