import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Percent, Save, Receipt, FileText } from "lucide-react";
import { Link } from "wouter";
import {
  computeFeeStack,
  priceLadder,
  formatCents,
  type PlatformPricingSettings,
} from "@shared/pricing";

// UI edits whole percents; engine stores basis points (500 = 5%). The tech cap
// is edited in whole dollars but stored in cents.
const bpsToPct = (bps: number) => Math.round((bps / 100) * 100) / 100;
const pctToBps = (pct: string) => Math.round((parseFloat(pct) || 0) * 100);
const centsToDollars = (cents: number) => Math.round((cents / 100) * 100) / 100;
const dollarsToCents = (d: string) => Math.round((parseFloat(d) || 0) * 100);

interface FeeForm {
  wholesalePct: string;
  affiliatePct: string;
  retailPct: string;
  damagePct: string;
  techPct: string;
  techCapDollars: string;
  cardPct: string;
}

// Sample figures used purely for the live preview.
const SAMPLE_BASE_CENTS = 10000; // $100 base cabinet cost
const SAMPLE_AFFILIATE_COST_CENTS = 500000; // $5,000 affiliate cabinet cost

function formToSettings(f: FeeForm): PlatformPricingSettings {
  return {
    wholesaleMarkupBps: pctToBps(f.wholesalePct),
    affiliateMarkupBps: pctToBps(f.affiliatePct),
    retailMarkupBps: pctToBps(f.retailPct),
    damageFeeBps: pctToBps(f.damagePct),
    techFeeBps: pctToBps(f.techPct),
    techFeeCapCents: dollarsToCents(f.techCapDollars),
    cardFeeBps: pctToBps(f.cardPct),
  };
}

export default function FeeSystemAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.pricing.adminGetFeeSettings.useQuery();
  const [form, setForm] = useState<FeeForm | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      wholesalePct: String(bpsToPct(data.wholesaleMarkupBps)),
      affiliatePct: String(bpsToPct(data.affiliateMarkupBps)),
      retailPct: String(bpsToPct(data.retailMarkupBps)),
      damagePct: String(bpsToPct(data.damageFeeBps)),
      techPct: String(bpsToPct(data.techFeeBps)),
      techCapDollars: String(centsToDollars(data.techFeeCapCents)),
      cardPct: String(bpsToPct(data.cardFeeBps)),
    });
  }, [data]);

  const save = trpc.pricing.adminUpdateFeeSettings.useMutation({
    onSuccess: () => {
      toast.success("Fee settings saved");
      utils.pricing.adminGetFeeSettings.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to save fee settings"),
  });

  // Live preview: derive the ladder + a sample order's fee stack from the form.
  const preview = useMemo(() => {
    if (!form) return null;
    const settings = formToSettings(form);
    const ladder = priceLadder(SAMPLE_BASE_CENTS, settings);
    const card = computeFeeStack(
      { cabinetSubtotalCents: 0, affiliateCostCents: SAMPLE_AFFILIATE_COST_CENTS, paymentMethod: "card", isAffiliateOrder: true },
      settings,
    );
    const ach = computeFeeStack(
      { cabinetSubtotalCents: 0, affiliateCostCents: SAMPLE_AFFILIATE_COST_CENTS, paymentMethod: "ach", achApproved: true, isAffiliateOrder: true },
      settings,
    );
    return { ladder, card, ach };
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
        {error?.message || "Could not load fee settings."}
      </div>
    );
  }

  const pctField = (label: string, key: keyof FeeForm, hint?: string) => (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="relative mt-1">
        <Input
          type="number"
          step="0.1"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
        <Percent className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Fee System (price ladder + order fees)
            </CardTitle>
            <CardDescription>
              The platform price ladder and the affiliate-cost fee stack. Damage, technology, and card
              fees apply <strong>only to an affiliate’s cabinet cost</strong>; they never increase customer
              retail or freight. An approved affiliate bank/ACH transfer waives the card fee.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 bg-background">
            <Link href="/admin/fee-system">
              <FileText className="mr-1.5 h-4 w-4" /> Print / PDF
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Price ladder markups
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {pctField("Wholesale", "wholesalePct", "base cost → wholesale")}
            {pctField("Affiliate", "affiliatePct", "wholesale → affiliate (~5%)")}
            {pctField("Suggested retail", "retailPct", "affiliate → customer")}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Order fee stack
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {pctField("Damage fee", "damagePct", "of affiliate cabinet cost only")}
            {pctField("Tech fee", "techPct", "of affiliate cabinet cost only")}
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tech fee cap</Label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="1"
                  className="pl-7"
                  value={form.techCapDollars}
                  onChange={(e) => setForm({ ...form, techCapDollars: e.target.value })}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">per transaction</p>
            </div>
            {pctField("Card fee", "cardPct", "affiliate cost only; ACH waived")}
          </div>
        </div>

        {preview && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live preview
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  Ladder for a {formatCents(SAMPLE_BASE_CENTS)} base cost
                </div>
                <ul className="space-y-0.5 text-sm">
                  <li className="flex justify-between"><span className="text-muted-foreground">Wholesale</span><span className="font-medium">{formatCents(preview.ladder.wholesaleCents)}</span></li>
                  <li className="flex justify-between"><span className="text-muted-foreground">Affiliate</span><span className="font-medium">{formatCents(preview.ladder.affiliateCents)}</span></li>
                  <li className="flex justify-between"><span className="text-muted-foreground">Suggested retail</span><span className="font-bold">{formatCents(preview.ladder.suggestedRetailCents)}</span></li>
                </ul>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  Affiliate cost invoice: {formatCents(SAMPLE_AFFILIATE_COST_CENTS)} cabinets
                </div>
                <ul className="space-y-0.5 text-sm">
                  <li className="flex justify-between"><span className="text-muted-foreground">Damage fee</span><span className="font-medium">{formatCents(preview.card.damageFeeCents)}</span></li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Tech fee{preview.card.techFeeCapped ? " (capped)" : ""}</span>
                    <span className="font-medium">{formatCents(preview.card.techFeeCents)}</span>
                  </li>
                  <li className="flex justify-between"><span className="text-muted-foreground">Card fee</span><span className="font-medium">{formatCents(preview.card.cardFeeCents)}</span></li>
                  <li className="flex justify-between border-t border-border pt-1"><span>Affiliate cost total (card)</span><span className="font-bold">{formatCents(preview.card.affiliateTotalCostCents)}</span></li>
                  <li className="flex justify-between"><span className="text-muted-foreground">Affiliate cost total (ACH)</span><span className="font-semibold">{formatCents(preview.ach.affiliateTotalCostCents)}</span></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={() => save.mutate({
            wholesaleMarkupBps: pctToBps(form.wholesalePct),
            affiliateMarkupBps: pctToBps(form.affiliatePct),
            retailMarkupBps: pctToBps(form.retailPct),
            damageFeeBps: pctToBps(form.damagePct),
            techFeeBps: pctToBps(form.techPct),
            techFeeCapCents: dollarsToCents(form.techCapDollars),
            cardFeeBps: pctToBps(form.cardPct),
          })}
          disabled={save.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? "Saving…" : "Save fee settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
