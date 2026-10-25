import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  priceLadder,
  computeFeeStack,
  formatCents,
  normalizePricingSettings,
  type PlatformPricingSettings,
} from "@shared/pricing";

/**
 * Cabinet Dealz — Fee System reference sheet (admin/owner).
 *
 * A self-contained, print-optimized document that lays out the complete price
 * ladder and order fee stack with a worked example, using the LIVE platform
 * pricing settings. Built for the person who handles the money (e.g. Rich) to
 * review and "Print / Save as PDF". Mirrors the PlanSheet print pattern.
 */

function pct(bps: number): string {
  return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

export default function FeeSystemDoc() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const isAdmin = user?.role === "admin";

  // Redirect non-admins away from the money doc.
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isAdmin, navigate]);

  const { data, isLoading } = trpc.pricing.adminGetFeeSettings.useQuery(undefined, {
    enabled: isAdmin,
  });

  if (authLoading || (isAdmin && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!isAdmin) return null;

  const s: PlatformPricingSettings = normalizePricingSettings(data ?? null);

  // Worked example: a $10,000 affiliate cabinet-cost invoice.
  const exampleBaseCents = 1_000_000; // $10,000 internal base cost
  const ladder = priceLadder(exampleBaseCents, s);

  const exampleAffiliateCost = ladder.affiliateCents;
  const card = computeFeeStack(
    { cabinetSubtotalCents: 0, affiliateCostCents: exampleAffiliateCost, paymentMethod: "card", isAffiliateOrder: true },
    s,
  );
  const ach = computeFeeStack(
    { cabinetSubtotalCents: 0, affiliateCostCents: exampleAffiliateCost, paymentMethod: "ach", achApproved: true, isAffiliateOrder: true },
    s,
  );

  const generated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.6in; }
          .no-print { display: none !important; }
          .fee-doc { box-shadow: none !important; margin: 0 !important; border: none !important; }
          html, body { background: #fff !important; }
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Admin
          </Link>
        </Button>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Live fee schedule — print or save as PDF for review.
        </p>
        <Button
          size="sm"
          onClick={() => window.print()}
          className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
        >
          <Printer className="mr-1.5 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="mx-auto max-w-[8.5in] p-4 print:p-0">
        <div className="fee-doc rounded-lg border border-border bg-white p-8 text-[#1a2236] shadow-sm print:rounded-none print:p-0 print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--color-navy)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--color-navy)] text-sm font-bold text-white">
                  CD
                </div>
                <span className="font-serif text-2xl font-bold text-[var(--color-navy)]">
                  Cabinet<span className="text-[var(--color-gold)]">Dealz</span>
                </span>
              </div>
              <h1 className="mt-3 font-serif text-2xl font-bold">Fee System &amp; Price Ladder</h1>
              <p className="text-sm text-muted-foreground">Internal reference — how every order is priced.</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Generated {generated}</div>
              <div>Confidential — internal use</div>
            </div>
          </div>

          {/* 1. Price ladder */}
          <section className="mt-6">
            <h2 className="font-serif text-lg font-bold">1. Price ladder</h2>
            <p className="mt-1 text-sm">
              Each cabinet line is derived from our internal base cost. Each configured markup is measured
              against that same cost; there is no markup-on-markup chaining.
            </p>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1a2236]/20 text-left">
                  <th className="py-1.5">Rung</th>
                  <th className="py-1.5">Markup applied</th>
                  <th className="py-1.5 text-right">On $10,000 base</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#1a2236]/10">
                  <td className="py-1.5 font-medium">Internal base cost</td>
                  <td className="py-1.5 text-muted-foreground">— what we pay</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(ladder.baseCostCents)}</td>
                </tr>
                <tr className="border-b border-[#1a2236]/10">
                  <td className="py-1.5 font-medium">Wholesale</td>
                  <td className="py-1.5">base + {pct(s.wholesaleMarkupBps)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(ladder.wholesaleCents)}</td>
                </tr>
                <tr className="border-b border-[#1a2236]/10">
                  <td className="py-1.5 font-medium">Affiliate cost</td>
                  <td className="py-1.5">base + {pct(s.affiliateMarkupBps)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(ladder.affiliateCents)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-medium">Suggested retail</td>
                  <td className="py-1.5">base + {pct(s.retailMarkupBps)}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{formatCents(ladder.suggestedRetailCents)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 2. Order fees */}
          <section className="mt-6">
            <h2 className="font-serif text-lg font-bold">2. Order fees</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li>
                <span className="font-semibold">Damage coverage — {pct(s.damageFeeBps)}.</span> Applied only to an
                affiliate’s cabinet cost invoice, never to customer retail or freight.
              </li>
              <li>
                <span className="font-semibold">Technology fee — {pct(s.techFeeBps)}, capped at {formatCents(s.techFeeCapCents)}.</span>{" "}
                On the affiliate’s cabinet cost; never exceeds the cap per transaction.
              </li>
              <li>
                <span className="font-semibold">Card processing — {pct(s.cardFeeBps)}.</span> Charged only on the
                affiliate’s cabinet cost for card-funded affiliate invoices. An approved bank transfer (ACH)
                <strong> waives this fee</strong>. Customer retail and freight never form a fee base.
              </li>
            </ul>
          </section>

          {/* 3. Worked example */}
          <section className="mt-6">
            <h2 className="font-serif text-lg font-bold">3. Worked example</h2>
            <p className="mt-1 text-sm">
              An affiliate cost invoice with a {formatCents(exampleAffiliateCost)} cabinet cost, shown both ways.
            </p>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1a2236]/20 text-left">
                  <th className="py-1.5">Line</th>
                  <th className="py-1.5 text-right">Card</th>
                  <th className="py-1.5 text-right">Bank transfer (ACH)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#1a2236]/10">
                  <td className="py-1.5">Affiliate cabinet cost</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(card.affiliateCostCents)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(ach.affiliateCostCents)}</td>
                </tr>
                <tr className="border-b border-[#1a2236]/10">
                  <td className="py-1.5">Damage fee ({pct(s.damageFeeBps)})</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(card.damageFeeCents)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(ach.damageFeeCents)}</td>
                </tr>
                <tr className="border-b border-[#1a2236]/10">
                  <td className="py-1.5">
                    Tech fee ({pct(s.techFeeBps)}{card.techFeeCapped ? `, capped at ${formatCents(s.techFeeCapCents)}` : ""})
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(card.techFeeCents)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(ach.techFeeCents)}</td>
                </tr>
                <tr className="border-b border-[#1a2236]/10">
                  <td className="py-1.5">Customer retail / freight fee base</td>
                  <td className="py-1.5 text-right tabular-nums">$0.00</td>
                  <td className="py-1.5 text-right tabular-nums">$0.00</td>
                </tr>
                <tr className="border-b border-[#1a2236]/10">
                  <td className="py-1.5">Card fee ({pct(s.cardFeeBps)})</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCents(card.cardFeeCents)}</td>
                  <td className="py-1.5 text-right tabular-nums text-green-700">waived</td>
                </tr>
                <tr>
                  <td className="py-2 font-bold">Affiliate cost total</td>
                  <td className="py-2 text-right font-bold tabular-nums">{formatCents(card.affiliateTotalCostCents)}</td>
                  <td className="py-2 text-right font-bold tabular-nums">{formatCents(ach.affiliateTotalCostCents)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              Choosing an approved bank transfer saves {formatCents(card.affiliateTotalCostCents - ach.affiliateTotalCostCents)} on this affiliate cost invoice.
            </p>
          </section>

          <p className="mt-8 border-t border-[#1a2236]/15 pt-3 text-[11px] text-muted-foreground">
            All values reflect the live platform pricing settings at the time this sheet was generated and are
            editable under Admin → Pricing &amp; Margins → Fee System. Figures are illustrative; actual order
            totals are computed per order by the same engine.
          </p>
        </div>
      </div>
    </div>
  );
}
