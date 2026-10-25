import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Save, Calculator } from "lucide-react";

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface Row {
  id: number;
  code: string | null;
  name: string | null;
  brandName: string | null;
  costMultiplier: string | null;
  baseMultiplier: string | null;
  freightMultiplier: string | null;
  retailPriceBasis: "cost_plus_tier" | "source_list";
  skuCount: number;
  avgListPrice: number | null;
}

interface DraftParts {
  base: string;
  freight: string;
}

function toStr(v: string | null): string {
  return v != null ? String(Number(v)) : "";
}

export default function DistributorMultipliersAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } =
    trpc.pricing.adminListDistributorMultipliers.useQuery();
  const marginsQ = trpc.pricing.adminGetMargins.useQuery();

  const [draft, setDraft] = useState<Record<number, DraftParts>>({});

  useEffect(() => {
    if (!data?.rows) return;
    const d: Record<number, DraftParts> = {};
    for (const r of data.rows as Row[]) {
      d[r.id] = {
        base: toStr(r.baseMultiplier),
        freight: toStr(r.freightMultiplier),
      };
    }
    setDraft(d);
  }, [data]);

  const homeownerMult = useMemo(() => {
    const bps = marginsQ.data?.settings.homeownerMarkupBps ?? 16500;
    return bps / 10000;
  }, [marginsQ.data]);

  const setMultiplier = trpc.pricing.adminSetDistributorMultiplier.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Saved — effective ${res.multiplier.toFixed(4)} · ${res.skusRecomputed.toLocaleString()} cabinet${
          res.skusRecomputed === 1 ? "" : "s"
        } re-costed`
      );
      utils.pricing.adminListDistributorMultipliers.invalidate();
      utils.pricing.adminGetMargins.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to save multiplier"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-10 text-center text-sm text-destructive">
        {error.message || "Could not load supply lines."}
      </div>
    );
  }

  const rows = (data?.rows ?? []) as Row[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5" /> Distributor Multipliers
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            One multiplier per supply line. <strong>Base</strong> = core cost
            fraction of the distributor's list.{" "}
            <strong>Tariff / freight rate</strong> = the percentage added over
            that core cost (changes when tariff rates change). Our cost ={" "}
            <strong>(list × Base) × (1 + Tariff)</strong>. Saving re-costs every
            SKU automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active supply lines yet.
            </p>
          ) : (
            rows.map((r) => {
              const parts = draft[r.id] ?? { base: "", freight: "" };
              const base = num(parts.base);
              const freight = num(parts.freight);
              const eff =
                base != null || freight != null
                  ? (base ?? 0) * (1 + (freight ?? 0))
                  : null;
              const avgList =
                r.avgListPrice != null ? Number(r.avgListPrice) : null;
              const estCost =
                eff != null && avgList != null ? avgList * eff : null;
              const estSell = estCost != null ? estCost * homeownerMult : null;
              const savedBase = toStr(r.baseMultiplier);
              const savedFreight = toStr(r.freightMultiplier);
              const dirty =
                parts.base !== savedBase
                || parts.freight !== savedFreight;
              const effValid = eff != null && eff >= 0.01 && eff <= 1;

              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  {/* Line header bar */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                    <div>
                      <p className="font-semibold text-base">
                        {r.name || r.code || `Line ${r.id}`}
                      </p>
                      {r.brandName && (
                        <p className="text-xs text-muted-foreground">
                          {r.brandName}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {r.skuCount.toLocaleString()} SKUs
                      </p>
                      <p className="text-xs text-muted-foreground">
                        avg {avgList != null ? `$${avgList.toFixed(0)}` : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Input fields — large and finger-friendly */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-foreground">
                          Base
                        </label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max="1"
                          value={parts.base}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [r.id]: { ...parts, base: e.target.value },
                            })
                          }
                          placeholder="0.23"
                          className="h-14 text-xl font-bold text-center px-2"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-foreground">
                          Tariff / freight rate
                        </label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max="1"
                          value={parts.freight}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [r.id]: { ...parts, freight: e.target.value },
                            })
                          }
                          placeholder="0.07"
                          className="h-14 text-xl font-bold text-center px-2"
                        />
                      </div>
                    </div>

                    <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                      Every customer and trade price is recalculated from this line&apos;s landed cost and the saved platform markup rules. The supplier list is a cost source, never a retail-price override.
                    </p>

                    {/* Live computed preview */}
                    <div className="grid grid-cols-3 divide-x divide-border rounded-lg bg-muted/50 border border-border overflow-hidden">
                      <div className="py-3 px-2 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                          Effective
                        </p>
                        <p className="text-base font-bold tabular-nums">
                          {eff != null ? eff.toFixed(3) : "—"}
                        </p>
                      </div>
                      <div className="py-3 px-2 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                          Est. cost
                        </p>
                        <p className="text-base font-semibold tabular-nums">
                          {estCost != null ? `$${estCost.toFixed(0)}` : "—"}
                        </p>
                      </div>
                      <div className="py-3 px-2 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                          HO sell
                        </p>
                        <p className="text-base font-bold tabular-nums text-primary">
                          {estSell != null ? `$${estSell.toFixed(0)}` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Save button — full width, large */}
                    <Button
                      size="lg"
                      variant={dirty ? "default" : "outline"}
                      disabled={setMultiplier.isPending || !effValid || !dirty}
                      className="w-full h-12 text-base gap-2"
                      onClick={() => {
                        if (!effValid) {
                          toast.error(
                            "Landed cost factor (Base × (1 + Tariff)) must be between 0.01 and 1.00"
                          );
                          return;
                        }
                        setMultiplier.mutate({
                          distributorId: r.id,
                          baseMultiplier: base ?? 0,
                          freightMultiplier: freight ?? 0,
                        });
                      }}
                    >
                      <Save className="h-4 w-4" />
                      {dirty ? "Save changes" : "Saved"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">
            "Est. cost" and "HO sell" use the line's average list price for a
            quick sanity check. Actual per-cabinet prices are computed from each
            SKU's own list price. The homeowner preview uses the current
            homeowner markup ({((homeownerMult - 1) * 100).toFixed(0)}%) from
            the Pricing &amp; Margins tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
