import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calculator, Save, Info, PackageCheck, ExternalLink } from "lucide-react";

// ─── Fee constants ────────────────────────────────────────────────────────────
const BASELINE_PCT = 0.05;   // 5% Cabinet Dealz margin on affiliate
const DAMAGE_PCT   = 0.01;   // 1% damage fee
const CC_PCT       = 0.04;   // 4% credit card processing
const IT_PCT       = 0.10;   // 10% IT/platform fee
const IT_MAX       = 100;    // capped at $100

const CATEGORIES = [
  "base", "wall", "tall", "vanity", "specialty",
  "Sinks & Faucets", "Flooring", "Shower & Bath", "Toilets & Bidets",
  "Tile & Mosaic", "Quartz Slabs (Countertops)", "Samples", "Marketing & Merchandise",
] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_LABELS: Record<Category, string> = {
  base: "Base Cabinets",
  wall: "Wall Cabinets",
  tall: "Tall / Pantry",
  vanity: "Vanity",
  specialty: "Specialty",
  "Sinks & Faucets": "Sinks & Faucets",
  Flooring: "Flooring",
  "Shower & Bath": "Shower & Bath",
  "Toilets & Bidets": "Toilets & Bidets",
  "Tile & Mosaic": "Tile & Mosaic",
  "Quartz Slabs (Countertops)": "Quartz Countertops",
  Samples: "Samples",
  "Marketing & Merchandise": "Marketing & Merchandise",
};

function computeFloor(retail: number): {
  baseline: number;
  afterDamage: number;
  afterCC: number;
  itFee: number;
  floor: number;
} {
  const baseline  = retail * (1 + BASELINE_PCT);
  const afterDamage = baseline * (1 + DAMAGE_PCT);
  const afterCC   = afterDamage * (1 + CC_PCT);
  const itFee     = Math.min(retail * IT_PCT, IT_MAX);
  const floor     = afterCC + itFee;
  return { baseline, afterDamage, afterCC, itFee, floor };
}

function bpsToPercent(bps: number) {
  return (bps / 100).toFixed(2);
}
function percentToBps(pct: string) {
  return Math.round(parseFloat(pct) * 100);
}

/** A blank field means “use the inherited markup”; a saved markup can never be negative. */
function markupInputError(pct: string): string | null {
  const normalized = pct.trim();
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return "Enter a valid markup percentage.";
  if (value < 0) return "Minimum is 0% — a customer sale price cannot be below the protected cost floor.";
  return null;
}

type AffiliatePricingPanelProps = {
  /** Required whenever an administrator is previewing a specific affiliate. */
  affiliateId?: number;
  isAdminView?: boolean;
  /** Branded customer catalog; the selected store scope determines current hardware prices. */
  hardwareCatalogHref?: string;
};

export default function AffiliatePricingPanel({ affiliateId, isAdminView = false, hardwareCatalogHref }: AffiliatePricingPanelProps) {
  const utils = trpc.useUtils();
  // Never let an admin "view as" session fall back to the first affiliate
  // linked to that admin. Both reads and writes are explicitly keyed by the
  // storefront selected in AffiliateDashboard.
  const ownBranding = trpc.affiliates.myBranding.useQuery(undefined, { enabled: !isAdminView });
  const adminBranding = trpc.affiliates.adminBranding.useQuery(
    { affiliateId: affiliateId ?? 0 },
    { enabled: isAdminView && affiliateId !== undefined, retry: false },
  );
  const data = isAdminView ? adminBranding.data : ownBranding.data;
  const isLoading = isAdminView ? adminBranding.isLoading : ownBranding.isLoading;

  // Local state for default markup
  const [defaultPct, setDefaultPct] = useState<string>("");
  const [categoryPcts, setCategoryPcts] = useState<Partial<Record<Category, string>>>({});
  const [hardwarePct, setHardwarePct] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  // Calculator state
  const [calcRetail, setCalcRetail] = useState("1000");

  const updateOwnMarkup = trpc.affiliates.updateMyMarkup.useMutation({
    onSuccess: () => {
      toast.success("Pricing saved");
      utils.affiliates.myBranding.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateAdminMarkup = trpc.affiliates.adminUpdateMarkup.useMutation({
    onSuccess: () => {
      toast.success("Pricing saved for the selected affiliate");
      if (affiliateId !== undefined) void utils.affiliates.adminBranding.invalidate({ affiliateId });
    },
    onError: (e) => toast.error(e.message),
  });

  // Initialize local state from server data once
  if (data && !initialized) {
    setDefaultPct(bpsToPercent(data.defaultMarkupBps));
    setHardwarePct(bpsToPercent(data.hardwareMarkupBps ?? 0));
    const cats: Partial<Record<Category, string>> = {};
    for (const cat of CATEGORIES) {
      if (data.categoryMarkup[cat] !== undefined) {
        cats[cat] = bpsToPercent(data.categoryMarkup[cat]);
      }
    }
    setCategoryPcts(cats);
    setInitialized(true);
  }

  const retail = parseFloat(calcRetail) || 0;
  const { baseline, afterDamage, afterCC, itFee, floor } = useMemo(() => computeFloor(retail), [retail]);
  const defaultMarkupBps = percentToBps(defaultPct || "0");
  const customerPrice = floor * (1 + defaultMarkupBps / 10000);
  const profit = customerPrice - floor;
  const defaultMarkupError = markupInputError(defaultPct);
  const hardwareMarkupError = markupInputError(hardwarePct);
  const categoryMarkupError = CATEGORIES
    .map((category) => ({ category, error: markupInputError(categoryPcts[category] ?? "") }))
    .find((result) => result.error !== null);
  const pricingInputError = defaultMarkupError ?? categoryMarkupError?.error ?? hardwareMarkupError ?? null;

  function save() {
    if (pricingInputError) {
      toast.error(pricingInputError);
      return;
    }
    const defaultBps = percentToBps(defaultPct || "0");
    const hardwareBps = percentToBps(hardwarePct || "0");
    const catMap: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      const v = categoryPcts[cat];
      if (v !== undefined && v !== "") {
        const bps = percentToBps(v);
        catMap[cat] = bps;
      }
    }
    if (isAdminView) {
      if (affiliateId === undefined) {
        toast.error("Select an affiliate before saving pricing.");
        return;
      }
      updateAdminMarkup.mutate({ affiliateId, defaultMarkupBps: defaultBps, categoryMarkup: catMap, hardwareMarkupBps: hardwareBps });
      return;
    }
    updateOwnMarkup.mutate({ defaultMarkupBps: defaultBps, categoryMarkup: catMap, hardwareMarkupBps: hardwareBps });
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Pricing &amp; Margins</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdminView
            ? "Set the selected affiliate’s customer-facing overlay. The platform baseline is managed separately and is not overwritten here."
            : "Set your markup over your cost floor. Your customers see your prices — Cabinet Dealz is never shown."}
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="p-4 text-sm text-blue-950">
          <strong>Two pricing layers:</strong> Cabinet Dealz maintains the platform/category baseline. Each affiliate can add its own markup on cabinets, door styles, and Pelican non-cabinet categories. Blank category fields inherit the affiliate default; a saved 0% means no additional affiliate markup.
        </CardContent>
      </Card>

      <Card data-testid="affiliate-hardware-pricing" className="border-sky-200 bg-sky-50/50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><PackageCheck className="h-4 w-4 text-sky-700" /> Hardware Resources</CardTitle>
              <p className="mt-1 text-sm text-slate-600">Define one above-list markup for every decorative hardware style and finish in your branded catalog.</p>
            </div>
            <Badge variant="outline" className="border-sky-300 bg-white text-sky-900">Decorative hardware</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hardware-list-markup">Your markup above current list %</Label>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                id="hardware-list-markup"
                type="number"
                min="0"
                step="0.5"
                value={hardwarePct}
                onChange={(e) => setHardwarePct(e.target.value)}
                placeholder="0"
                aria-invalid={Boolean(hardwareMarkupError)}
                className={hardwareMarkupError ? "border-destructive focus-visible:ring-destructive" : undefined}
              />
              <span className="text-muted-foreground text-sm">%</span>
            </div>
          </div>
          {hardwareMarkupError ? <p className="text-xs text-destructive">{hardwareMarkupError}</p> : <div className="rounded-lg border border-sky-200 bg-white/80 p-3 text-xs leading-5 text-sky-950"><p><strong>Customer price:</strong> current Hardware Resources list price {Number(hardwarePct || 0) > 0 ? `+ ${hardwarePct}%` : "with no extra markup"}.</p><p className="mt-1">This applies to all hardware configurations and exact finishes. It never changes cabinet, surface, shipping, or tax pricing. After a paid order, hardware commission is locked at 25% of hardware merchandise only.</p></div>}
          <Button type="button" onClick={save} disabled={updateOwnMarkup.isPending || updateAdminMarkup.isPending || Boolean(hardwareMarkupError)} className="gap-1.5">
            <Save className="h-4 w-4" />
            {updateOwnMarkup.isPending || updateAdminMarkup.isPending ? "Saving…" : "Save hardware pricing"}
          </Button>
          {hardwareCatalogHref && <a href={hardwareCatalogHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"><ExternalLink className="h-4 w-4" /> Preview my Hardware Resources catalog</a>}
        </CardContent>
      </Card>

      {/* Cost Calculator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Cost Floor Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 flex-1 max-w-xs">
              <Label>Cabinet Dealz retail price ($)</Label>
              <Input
                type="number"
                value={calcRetail}
                onChange={(e) => setCalcRetail(e.target.value)}
                placeholder="1000"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden text-sm">
            <div className="bg-muted/40 px-4 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground">
              Cost Breakdown
            </div>
            <div className="divide-y divide-border">
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">Cabinet Dealz retail</span>
                <span className="tabular-nums">${retail.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">+ 5% affiliate baseline</span>
                <span className="tabular-nums">${baseline.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">+ 1% damage protection</span>
                <span className="tabular-nums">${afterDamage.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">+ 4% credit card fee</span>
                <span className="tabular-nums">${afterCC.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">+ IT/platform fee (10%, max $100)</span>
                <span className="tabular-nums">${itFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 bg-amber-50 font-semibold">
                <span>Your cost floor</span>
                <span className="tabular-nums text-amber-700">${floor.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {defaultMarkupBps > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 divide-y divide-emerald-100 text-sm overflow-hidden">
              <div className="flex justify-between px-4 py-2">
                <span className="text-emerald-800">Your markup ({bpsToPercent(defaultMarkupBps)}%)</span>
                <span className="tabular-nums text-emerald-700">+${(customerPrice - floor).toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 font-semibold">
                <span className="text-emerald-900">Customer pays</span>
                <span className="tabular-nums text-emerald-800">${customerPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2 text-xs">
                <span className="text-emerald-700">Your profit on this order</span>
                <span className="tabular-nums font-medium text-emerald-700">${profit.toFixed(2)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Default Markup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Your Markup Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
          <Label>Default markup % (applies to all products unless overridden)</Label>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={defaultPct}
                onChange={(e) => setDefaultPct(e.target.value)}
                placeholder="e.g. 20"
                aria-invalid={Boolean(defaultMarkupError)}
                className={defaultMarkupError ? "border-destructive focus-visible:ring-destructive" : undefined}
              />
              <span className="text-muted-foreground text-sm">%</span>
            </div>
            {defaultMarkupError ? (
              <p className="text-xs text-destructive">{defaultMarkupError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                This is your profit margin on top of your cost floor. A 20% markup on a $1,000 floor = $1,200 customer price. The minimum is 0%.
              </p>
            )}
          </div>

          {/* Per-category overrides */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Per-category overrides</Label>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Leave blank to use your default markup. Set a specific % to override for that category.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <div key={cat} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat]}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={categoryPcts[cat] ?? ""}
                      onChange={(e) => setCategoryPcts((p) => ({ ...p, [cat]: e.target.value }))}
                      placeholder={defaultPct || "default"}
                      aria-invalid={Boolean(markupInputError(categoryPcts[cat] ?? ""))}
                      className={markupInputError(categoryPcts[cat] ?? "") ? "text-sm border-destructive focus-visible:ring-destructive" : "text-sm"}
                    />
                    <span className="text-muted-foreground text-sm">%</span>
                  </div>
                  {markupInputError(categoryPcts[cat] ?? "") && (
                    <p className="text-xs text-destructive">{markupInputError(categoryPcts[cat] ?? "")}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              For cabinets, per-style overrides set in My Catalog take priority over category overrides. Non-cabinet Pelican products use the matching category override, then your default markup. The platform’s base markup remains separate; this setting is your additional customer-facing markup. A 0% markup is allowed.
            </span>
          </div>

          <Button onClick={save} disabled={updateOwnMarkup.isPending || updateAdminMarkup.isPending || Boolean(pricingInputError)} className="gap-1.5">
            <Save className="h-4 w-4" />
            {updateOwnMarkup.isPending || updateAdminMarkup.isPending ? "Saving…" : "Save Pricing"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
