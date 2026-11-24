import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Waves, Save, Percent } from "lucide-react";

// Pelican markups are stored in basis points (6500 = 65%). This editor works in
// whole percents. Sell price = cost × (1 + markup%). Nothing is hardcoded — the
// values shown pre-fill from the DB (or research defaults for untouched rows).
const bpsToPct = (bps: number) => Math.round((bps / 100) * 100) / 100;
const pctToBps = (pct: string) => Math.max(0, Math.round((parseFloat(pct) || 0) * 100));
/** Empty means the affiliate percent is unset. Zero is an explicit 0% (price = cost). */
const affiliatePctToBps = (pct: string): number | null => {
  const trimmed = pct.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
};

export default function PelicanMarkupsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.pelican.getMarkups.useQuery();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [affiliateDrafts, setAffiliateDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const d: Record<string, string> = {};
    const affiliate: Record<string, string> = {};
    for (const row of data) {
      d[row.category] = String(bpsToPct(row.markupBps));
      affiliate[row.category] = row.affiliateMarkupBps == null ? "" : String(bpsToPct(row.affiliateMarkupBps));
    }
    setDrafts(d);
    setAffiliateDrafts(affiliate);
  }, [data]);

  const setMarkup = trpc.pelican.setMarkup.useMutation({
    onSuccess: () => {
      toast.success("Markup saved");
      utils.pelican.getMarkups.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to save markup"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Waves className="h-5 w-5" /> Pelican Surfaces &amp; Fixtures — markups
        </CardTitle>
        <CardDescription>
          Per-category markup applied on top of Pelican cost. Sell price ={" "}
          <strong>cost × (1 + markup%)</strong>. Affiliate % is separate and is
          used only on affiliate-store checkout: affiliate sale ={" "}
          <strong>cost × (1 + affiliate %)</strong>. Leave Affiliate % blank to
          keep the automatic product price. A fixed price on one item, set
          below, wins over both.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">
            {error.message || "Could not load Pelican markups."}
          </p>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active Pelican categories found.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Avg cost</TableHead>
                <TableHead className="w-[140px]">Markup %</TableHead>
                <TableHead className="text-right">Sample sell</TableHead>
                <TableHead className="w-[140px]">Affiliate %</TableHead>
                <TableHead className="text-right">Affiliate sale</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const pct = drafts[row.category] ?? String(bpsToPct(row.markupBps));
                const affiliatePct = affiliateDrafts[row.category] ?? (row.affiliateMarkupBps == null ? "" : String(bpsToPct(row.affiliateMarkupBps)));
                const avg = row.avgCost ?? 0;
                const sample = avg * (1 + (parseFloat(pct) || 0) / 100);
                const affiliateSample = affiliatePct.trim() === "" || row.avgCost == null
                  ? null
                  : avg * (1 + (parseFloat(affiliatePct) || 0) / 100);
                return (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium">
                      {row.category}
                      {row.isDefault && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.productCount}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.avgCost == null ? "—" : `$${avg.toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={pct}
                          onChange={(e) =>
                            setDrafts({ ...drafts, [row.category]: e.target.value })
                          }
                        />
                        <Percent className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {row.avgCost == null ? "—" : `$${sample.toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={affiliatePct}
                          placeholder="Blank"
                          aria-label={`Affiliate percent for ${row.category}`}
                          onChange={(e) =>
                            setAffiliateDrafts({ ...affiliateDrafts, [row.category]: e.target.value })
                          }
                        />
                        <Percent className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {affiliateSample == null ? "—" : `$${affiliateSample.toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setMarkup.isPending}
                        onClick={() => {
                          const affiliateMarkupBps = affiliatePctToBps(affiliatePct);
                          if (affiliatePct.trim() !== "" && affiliateMarkupBps == null) {
                            toast.error("Enter a zero or positive affiliate percent, or leave it blank.");
                            return;
                          }
                          setMarkup.mutate({
                            category: row.category,
                            markupBps: pctToBps(pct),
                            affiliateMarkupBps,
                          });
                        }}
                        className="gap-1"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
