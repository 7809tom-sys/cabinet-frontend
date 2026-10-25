import { trpc } from "@/lib/trpc";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { DollarSign, Eye, Package, Sparkles, TrendingUp, Users } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1.5">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <div className="font-serif text-3xl font-bold tabular-nums">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AffiliateAnalyticsPanel() {
  const earningsQ = trpc.affiliates.myEarnings.useQuery();
  const referralsQ = trpc.affiliates.myReferrals.useQuery();
  const featuredLinesQ = trpc.affiliates.myFeaturedDistributorAnalytics.useQuery();
  const featuredStylesQ = trpc.affiliates.myFeaturedStyleAnalytics.useQuery();

  const isLoading = earningsQ.isLoading || referralsQ.isLoading || featuredLinesQ.isLoading || featuredStylesQ.isLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  const earnings = earningsQ.data;
  const referrals = referralsQ.data;
  const featuredLines = featuredLinesQ.data ?? [];
  const featuredStyles = featuredStylesQ.data ?? [];

  if (!earnings || !referrals) {
    return <p className="text-sm text-muted-foreground py-6">Could not load analytics data.</p>;
  }

  const { summary, orders, commissionRate } = referrals;
  const conversionRate = summary.referredCount > 0
    ? ((summary.confirmedCount / summary.referredCount) * 100).toFixed(1)
    : "0.0";

  // Build weekly chart data from earnings weeks
  const weeklyData = earnings.weeks.slice(-12).map((w) => ({
    week: w.weekKey.slice(5), // "MM-DD" from "YYYY-MM-DD"
    commission: parseFloat((w.totalCommissionCents / 100).toFixed(2)),
    orders: w.count,
  }));

  // Order status breakdown
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    count,
  }));

  // Average order value
  const confirmedOrders = orders.filter((o) => o.status === "confirmed" && o.totalAmount != null);
  const avgOrderValue = confirmedOrders.length > 0
    ? confirmedOrders.reduce((s, o) => s + Number(o.totalAmount), 0) / confirmedOrders.length
    : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold">Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your storefront performance — scoped entirely to your store and referral link.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Total referred" value={summary.referredCount} />
        <StatCard icon={TrendingUp} label="Confirmed orders" value={summary.confirmedCount} sub={`${conversionRate}% conversion`} />
        <StatCard icon={DollarSign} label="Commission earned" value={`$${(earnings.lifetimeCents / 100).toFixed(2)}`} sub={`${(commissionRate * 100).toFixed(1)}% rate`} />
        <StatCard icon={Users} label="Avg order value" value={avgOrderValue > 0 ? `$${avgOrderValue.toFixed(0)}` : "—"} sub="confirmed orders" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-amber-600" /> Featured distributor performance</CardTitle>
          <p className="text-xs text-muted-foreground">Anonymous storefront views and verified Designer leads from your currently featured cabinet lines.</p>
        </CardHeader>
        <CardContent>
          {featuredLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Feature a distributor in My Catalog to begin measuring its storefront performance.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {featuredLines.map((line) => (
                <div key={line.distributorId} className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="font-semibold">{line.lineMark} <span className="ml-1">{line.name}</span></p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-background p-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Views</span><strong className="mt-1 block text-lg tabular-nums">{line.views}</strong></div>
                    <div className="rounded-md bg-background p-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Designer leads</span><strong className="mt-1 block text-lg tabular-nums">{line.leads}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Featured door-style performance</CardTitle>
          <p className="text-xs text-muted-foreground">Views and verified Designer leads for the individual door styles you feature first in My Catalog.</p>
        </CardHeader>
        <CardContent>
          {featuredStyles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Feature individual door styles in My Catalog to begin measuring their performance.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {featuredStyles.map((style) => (
                <div key={style.styleId} className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="font-semibold truncate" title={style.name}>{style.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{style.distributorName}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-background p-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Views</span><strong className="mt-1 block text-lg tabular-nums">{style.views}</strong></div>
                    <div className="rounded-md bg-background p-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Designer leads</span><strong className="mt-1 block text-lg tabular-nums">{style.leads}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "This week", value: `$${(earnings.thisWeekCents / 100).toFixed(2)}`, color: "text-primary" },
          { label: "Paid out", value: `$${(earnings.paidCents / 100).toFixed(2)}`, color: "text-emerald-600" },
          { label: "Pending payout", value: `$${(earnings.pendingCents / 100).toFixed(2)}`, color: "text-amber-600" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly Commission Chart */}
      {weeklyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly Commission (last 12 weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Commission"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="commission" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Weekly Orders Chart */}
      {weeklyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly Orders (last 12 weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weeklyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Order Status Breakdown */}
      {statusData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Order Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {statusData.map((s) => (
                <div key={s.status} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <span className="text-2xl font-bold tabular-nums">{s.count}</span>
                  <span className="text-sm text-muted-foreground">{s.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {weeklyData.length === 0 && orders.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <BarChart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No data yet</p>
          <p className="text-sm mt-1">Analytics will appear here once you start referring orders through your storefront.</p>
        </div>
      )}
    </div>
  );
}
