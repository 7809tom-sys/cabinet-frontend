import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Percent, Save, Search } from "lucide-react";

const bpsToPct = (bps: number) => Math.round((bps / 100) * 100) / 100;
const affiliatePctToBps = (pct: string): number | null => {
  const trimmed = pct.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
};

type SaleItem = {
  id: number;
  name: string;
  code: string;
  category: string | null;
  yourCost: string | null;
  affiliateSalePrice: string | null;
};

export default function AffiliateCatalogSaleAdmin() {
  const utils = trpc.useUtils();
  const markups = trpc.hardware.getAffiliateMarkups.useQuery();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const saveMarkup = trpc.hardware.setAffiliateMarkup.useMutation({
    onSuccess: () => {
      toast.success("Hardware affiliate percent saved");
      void utils.hardware.getAffiliateMarkups.invalidate();
    },
    onError: (error) => toast.error(error.message || "Could not save the hardware affiliate percent"),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hardware Resources — affiliate %</CardTitle>
          <CardDescription>
            Separate from each store&apos;s above-list hardware markup. Affiliate sale ={" "}
            <strong>cost × (1 + affiliate %)</strong>. Leave the field blank to keep the
            existing list price plus that store&apos;s hardware markup. A fixed price on
            one item wins over this percent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {markups.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : markups.error ? (
            <p className="py-6 text-center text-sm text-destructive">{markups.error.message}</p>
          ) : !markups.data?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No published hardware categories found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead>
                  <TableHead className="w-[150px]">Affiliate %</TableHead>
                  <TableHead className="w-[90px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {markups.data.map((row) => {
                  const pct = drafts[row.category] ?? (row.affiliateMarkupBps == null ? "" : String(bpsToPct(row.affiliateMarkupBps)));
                  return (
                    <TableRow key={row.category}>
                      <TableCell className="font-medium">{row.category}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.productCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.avgCost == null ? "—" : `$${row.avgCost.toFixed(2)}`}</TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={pct}
                            placeholder="Blank"
                            aria-label={`Hardware affiliate percent for ${row.category}`}
                            onChange={(event) => setDrafts({ ...drafts, [row.category]: event.target.value })}
                          />
                          <Percent className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={saveMarkup.isPending}
                          onClick={() => {
                            const affiliateMarkupBps = affiliatePctToBps(pct);
                            if (pct.trim() !== "" && affiliateMarkupBps == null) {
                              toast.error("Enter a zero or positive affiliate percent, or leave it blank.");
                              return;
                            }
                            saveMarkup.mutate({ category: row.category, affiliateMarkupBps });
                          }}
                        >
                          <Save className="h-3.5 w-3.5" /> Save
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

      <FixedSaleSearch
        title="Pelican item affiliate price"
        placeholder="Search Pelican name or code"
        kind="pelican"
      />
      <FixedSaleSearch
        title="Hardware item affiliate price"
        placeholder="Search hardware SKU or name"
        kind="hardware"
      />
    </div>
  );
}

function FixedSaleSearch({ title, placeholder, kind }: { title: string; placeholder: string; kind: "pelican" | "hardware" }) {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [prices, setPrices] = useState<Record<number, string>>({});
  const pelican = trpc.pelican.adminSearchAffiliateSale.useQuery(
    { query: submitted },
    { enabled: kind === "pelican" && submitted.length > 0 },
  );
  const hardware = trpc.hardware.adminSearchAffiliateSale.useQuery(
    { query: submitted },
    { enabled: kind === "hardware" && submitted.length > 0 },
  );
  const result = kind === "pelican" ? pelican : hardware;
  const items: SaleItem[] = (result.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    code: "pelicanCode" in row ? row.pelicanCode : row.vendorSku,
    category: row.category,
    yourCost: row.yourCost,
    affiliateSalePrice: row.affiliateSalePrice,
  }));
  const savePelican = trpc.pelican.setAffiliateSalePrice.useMutation({
    onSuccess: () => {
      toast.success("Pelican affiliate price saved");
      void utils.pelican.adminSearchAffiliateSale.invalidate();
    },
    onError: (error) => toast.error(error.message || "Could not save the Pelican affiliate price"),
  });
  const saveHardware = trpc.hardware.setAffiliateSalePrice.useMutation({
    onSuccess: () => {
      toast.success("Hardware affiliate price saved");
      void utils.hardware.adminSearchAffiliateSale.invalidate();
    },
    onError: (error) => toast.error(error.message || "Could not save the hardware affiliate price"),
  });
  const pending = savePelican.isPending || saveHardware.isPending;

  const save = (id: number, raw: string) => {
    const trimmed = raw.trim();
    const affiliateSalePrice = trimmed === "" ? null : Number(trimmed);
    if (affiliateSalePrice != null && (!Number.isFinite(affiliateSalePrice) || affiliateSalePrice <= 0)) {
      toast.error("Enter a positive affiliate sale price, or leave it blank to clear it.");
      return;
    }
    if (kind === "pelican") savePelican.mutate({ id, affiliateSalePrice });
    else saveHardware.mutate({ id, affiliateSalePrice });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Optional fixed affiliate checkout price for one item. Blank clears it.
          A positive fixed price wins over the category affiliate percent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex max-w-lg gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <Input value={query} placeholder={placeholder} onChange={(event) => setQuery(event.target.value)} />
          <Button type="submit" variant="outline" className="gap-1"><Search className="h-4 w-4" /> Search</Button>
        </form>
        {result.isFetching ? <Spinner /> : null}
        {submitted && !result.isFetching && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching items.</p>
        ) : null}
        {items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="w-[160px]">Fixed affiliate $</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const value = prices[item.id] ?? (item.affiliateSalePrice == null ? "" : String(Number(item.affiliateSalePrice)));
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.code}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.category ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.yourCost == null ? "—" : `$${Number(item.yourCost).toFixed(2)}`}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={value}
                        placeholder="Blank"
                        aria-label={`Fixed affiliate price for ${item.code}`}
                        onChange={(event) => setPrices({ ...prices, [item.id]: event.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => save(item.id, value)}>Save</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
