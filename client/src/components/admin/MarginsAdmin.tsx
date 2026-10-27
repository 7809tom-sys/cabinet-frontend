import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import FeeSystemAdmin from "./FeeSystemAdmin";
import PelicanMarkupsAdmin from "./PelicanMarkupsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Percent, Save, TrendingUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// UI edits whole percents; DB stores basis points where 10000 = no change (0%).
// A displayed "+15%" => bps 11500. "0%" => 10000.
const bpsToPct = (bps: number) => Math.round(((bps - 10000) / 100) * 100) / 100;
const pctToBps = (pct: string) => Math.round((parseFloat(pct) || 0) * 100) + 10000;

interface MarginForm {
  globalPct: string;
  homeownerPct: string;
  contractorPct: string;
  wholesalePct: string;
  wholesaleIncreaseRequiresApproval: boolean;
}

interface EnforcementResult {
  updated: number;
  costPlusTier: number;
  skippedUnpriced: number;
  unpublishedUnpriced: number;
}

// Sample base price used purely for the live preview.
const SAMPLE_BASE = 100;

export default function MarginsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.pricing.adminGetMargins.useQuery();
  const [form, setForm] = useState<MarginForm | null>(null);
  const [lastEnforcement, setLastEnforcement] = useState<EnforcementResult | null>(null);

  useEffect(() => {
    if (!data) return;
    const s = data.settings;
    setForm({
      globalPct: String(bpsToPct(s.globalMarkupBps)),
      homeownerPct: String(bpsToPct(s.homeownerMarkupBps)),
      contractorPct: String(bpsToPct(s.contractorMarkupBps)),
      wholesalePct: String(bpsToPct(s.wholesaleMarkupBps)),
      wholesaleIncreaseRequiresApproval: s.wholesaleIncreaseRequiresApproval,
    });
  }, [data]);

  const saveMargins = trpc.pricing.adminUpdateMargins.useMutation({
    onSuccess: (result) => {
      const refreshed = result.recalculation.updated;
      setLastEnforcement(result.recalculation);
      toast.success(
        refreshed > 0
          ? `Margins saved and enforced across ${refreshed.toLocaleString()} priced SKU rows.`
          : "Margins saved",
      );
      utils.pricing.adminGetMargins.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to save margins"),
  });

  // Live preview: a sample $100 base price through each tier multiplier.
  const preview = useMemo(() => {
    if (!form) return null;
    const mult = (pct: string) => (pctToBps(pct) / 10000) * SAMPLE_BASE;
    return {
      homeowner: mult(form.homeownerPct),
      contractor: mult(form.contractorPct),
      wholesale: mult(form.wholesalePct),
    };
  }, [form]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (error || !form) {
    return (
      <div className="py-10 text-center text-sm text-destructive">
        {error?.message || "Could not load pricing settings."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FeeSystemAdmin />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Pricing & Margins
          </CardTitle>
          <CardDescription>
            Saving applies the tier margins to every SKU with an authorized
            cost/list input. Each tier&apos;s sell price is computed as{" "}
            <strong>our cost × (1 + this markup)</strong>, where our cost comes
            from the per-line multiplier on the Multipliers tab. Unpriced source
            rows are excluded rather than assigned an invented sell price.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Global default markup (new supply-line guidance)
            </Label>
            <div className="relative mt-1 max-w-[180px]">
              <Input
                type="number"
                step="0.5"
                value={form.globalPct}
                onChange={(e) => setForm({ ...form, globalPct: e.target.value })}
              />
              <Percent className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ["Homeowner retail multiplier", "homeownerPct"],
              ["Contractor", "contractorPct"],
              ["Wholesale", "wholesalePct"],
            ] as const).map(([label, key]) => (
              <div key={key}>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {label} markup
                </Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.5"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                  <Percent className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            The homeowner percent is the site-wide retail multiplier for vendor wholesale. Retail is computed when a price is read: wholesale × this multiplier, then any existing per-vendor or category markup. It took effect {data?.settings.updatedAt ? new Date(data.settings.updatedAt).toLocaleString() : "when these settings were last saved"}.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.wholesaleIncreaseRequiresApproval}
              onCheckedChange={(checked) => setForm({ ...form, wholesaleIncreaseRequiresApproval: checked === true })}
            />
            Wholesale increases require admin approval before they change the live price
          </label>

          {preview && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Live preview — a ${SAMPLE_BASE.toFixed(2)} base price becomes
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Homeowner</div>
                  <div className="text-lg font-bold">${preview.homeowner.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Contractor</div>
                  <div className="text-lg font-bold">${preview.contractor.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Wholesale</div>
                  <div className="text-lg font-bold">${preview.wholesale.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {lastEnforcement && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-lg border border-emerald-300/70 bg-emerald-50/70 p-4 text-sm text-emerald-950"
            >
              <p className="font-semibold">Pricing enforced on save</p>
              <p className="mt-1 leading-relaxed">
                Refreshed <strong>{lastEnforcement.updated.toLocaleString()}</strong>{" "}
                priced SKU rows from their verified source cost/list basis. All homeowner,
                contractor, and wholesale prices now follow the saved tier margins.
                {lastEnforcement.skippedUnpriced > 0 && (
                  <>
                    {" "}
                    <strong>{lastEnforcement.skippedUnpriced.toLocaleString()}</strong>{" "}
                    unpriced source rows were left excluded—no $0 or inferred customer price was created.
                    {lastEnforcement.unpublishedUnpriced > 0 && (
                      <>
                        {" "}
                        <strong>{lastEnforcement.unpublishedUnpriced.toLocaleString()}</strong>{" "}
                        of those rows were also made unavailable and unpublished.
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          )}

          <Button
            onClick={() =>
              saveMargins.mutate({
                globalMarkupBps: pctToBps(form.globalPct),
                homeownerMarkupBps: pctToBps(form.homeownerPct),
                contractorMarkupBps: pctToBps(form.contractorPct),
                wholesaleMarkupBps: pctToBps(form.wholesalePct),
                wholesaleIncreaseRequiresApproval: form.wholesaleIncreaseRequiresApproval,
              })
            }
            disabled={saveMargins.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saveMargins.isPending ? "Saving and enforcing…" : "Save and enforce pricing"}
          </Button>
        </CardContent>
      </Card>

      <PelicanMarkupsAdmin />
    </div>
  );
}
