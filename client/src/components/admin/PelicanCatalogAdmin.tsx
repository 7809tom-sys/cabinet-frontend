import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Search, ShieldCheck, Star, Waves } from "lucide-react";
import { authorizedSurfacePriceBasis } from "../../../../shared/surfacePricing";

const CATEGORIES = [
  "Sinks & Faucets",
  "Flooring",
  "Shower & Bath",
  "Toilets & Bidets",
  "Tile & Mosaic",
  "Quartz Slabs (Countertops)",
  "Samples",
  "Marketing & Merchandise",
] as const;

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toFixed(2)}`;

export default function PelicanCatalogAdmin() {
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [unpricedOnly, setUnpricedOnly] = useState(false);

  // simple debounce
  useMemo(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error } = trpc.pelican.adminList.useQuery({
    category: category === "all" ? undefined : (category as any),
    search: debounced || undefined,
    unpricedOnly,
    limit: 200,
    offset: 0,
  });
  const { data: readinessAudit, isLoading: readinessAuditLoading } = trpc.pelican.designerReadinessAudit.useQuery();
  const readinessById = useMemo(
    () => new Map((readinessAudit?.rows ?? []).map((row) => [row.id, row])),
    [readinessAudit],
  );

  const setVisibility = trpc.pelican.setVisibility.useMutation({
    onSuccess: () => {
      void utils.pelican.adminList.invalidate();
      void utils.pelican.designerReadinessAudit.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to update"),
  });
  const setPricing = trpc.pelican.setPricing.useMutation({
    onSuccess: (result) => {
      void utils.pelican.adminList.invalidate();
      void utils.pelican.designerReadinessAudit.invalidate();
      if (result.unpublished) {
        toast.warning("No positive verified source price remains. This item is now unavailable and unpublished.");
      } else {
        toast.success("Verified source price saved.");
      }
    },
    onError: (e) => toast.error(e.message || "The source price could not be saved."),
  });
  const setPopular = trpc.pelican.setPopular.useMutation({
    onSuccess: () => utils.pelican.adminList.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to update"),
  });
  const setCoverage = trpc.pelican.setCoverage.useMutation({
    onSuccess: () => {
      void utils.pelican.adminList.invalidate();
      void utils.pelican.designerReadinessAudit.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to update"),
  });
  const setUnsupportedOverhangLimit = trpc.pelican.setUnsupportedOverhangLimit.useMutation({
    onSuccess: () => {
      void utils.pelican.adminList.invalidate();
      void utils.pelican.designerReadinessAudit.invalidate();
      toast.success("Verified structural overhang limit saved.");
    },
    onError: (e) => toast.error(e.message || "The structural overhang limit could not be saved."),
  });
  const setMaterialImage = trpc.pelican.setMaterialImage.useMutation({
    onSuccess: () => {
      void utils.pelican.adminList.invalidate();
      void utils.pelican.designerReadinessAudit.invalidate();
      toast.success("3D material swatch updated.");
    },
    onError: (e) => toast.error(e.message || "The material swatch could not be updated."),
  });

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Waves className="h-5 w-5" /> Pelican Catalog
        </CardTitle>
        <CardDescription>
          Manage which Pelican items are active, shown in the catalog and
          designer, and flagged as featured. Sell prices come from the per-category
          markups on the Pricing &amp; Margins tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {readinessAuditLoading ? (
          <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
        ) : readinessAudit && (
          <section data-testid="pelican-designer-readiness-audit" className="rounded-xl border border-sky-200 bg-sky-50/60 p-3.5 dark:border-sky-900 dark:bg-sky-950/20">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-sky-950 dark:text-sky-100">
                  <ShieldCheck className="h-4 w-4" /> Designer evidence audit
                </div>
                <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  Every row marked for Designer is checked against its source price, category role, approved material or measured fixture profile, and the required order/placement evidence. This report does not invent missing dimensions, coverage, or overhang limits.
                </p>
              </div>
              <Badge variant={readinessAudit.totals.evidenceComplete === readinessAudit.totals.configured ? "default" : "outline"} className="whitespace-nowrap">
                {readinessAudit.totals.evidenceComplete}/{readinessAudit.totals.configured} evidence-complete
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border bg-background/70 p-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Configured rows</div>
                <div className="mt-0.5 text-xl font-semibold">{readinessAudit.totals.configured}</div>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-2.5 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Exact palette role ready</div>
                <div className="mt-0.5 flex items-center gap-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{readinessAudit.totals.paletteReady}</div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50/80 p-2.5 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">Evidence needs review</div>
                <div className="mt-0.5 flex items-center gap-1 text-xl font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4" />{readinessAudit.totals.configured - readinessAudit.totals.evidenceComplete}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Role coverage</div>
                <div className="flex flex-wrap gap-1.5">
                  {readinessAudit.roles.map((role) => (
                    <Badge key={role.role} variant="secondary" className="gap-1 text-[10px]">
                      {role.role}: <strong>{role.paletteReady}/{role.configured}</strong>
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Top evidence blockers</div>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  {readinessAudit.blockers.slice(0, 3).map((blocker) => <div key={blocker.reason}>{blocker.count} · {blocker.reason}</div>)}
                  {readinessAudit.blockers.length === 0 && <div>All configured rows have their required evidence.</div>}
                </div>
              </div>
            </div>
          </section>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, description…"
              className="pl-9"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium text-foreground">
            <Switch
              checked={unpricedOnly}
              onCheckedChange={setUnpricedOnly}
              aria-label="Show only items missing a verified source price"
            />
            Needs source price
          </label>
          {data && (
            <span className="text-sm text-muted-foreground">
              {data.total} item{data.total === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">
            {error.message || "Could not load Pelican items."}
          </p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {unpricedOnly
              ? "No unpriced surface items remain in this audit scope."
              : "No Pelican items match your filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="min-w-[190px] text-right">Verified Source Price</TableHead>
                  <TableHead className="text-right">Sell</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Catalog</TableHead>
                  <TableHead className="text-center">Designer</TableHead>
                  <TableHead className="min-w-[160px]">Readiness</TableHead>
                  <TableHead className="text-center">Featured</TableHead>
                  <TableHead className="text-right">Sq ft/Box</TableHead>
                  <TableHead className="min-w-[160px] text-right">Unsupported overhang (in.)</TableHead>
                  <TableHead className="min-w-[220px]">3D Material Swatch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it: any) => {
                  const readiness = readinessById.get(it.id);
                  const sourceBasis = authorizedSurfacePriceBasis(it);
                  const hasQuoteReference = Number(it.msrp) > 0;
                  return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{it.pelicanCode}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {it.category}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {!sourceBasis && (
                        <div
                          data-testid={`pelican-price-required-${it.id}`}
                          className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-left text-[10px] leading-snug text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                          <div className="flex items-center gap-1 font-semibold"><AlertTriangle className="h-3 w-3 shrink-0" />Needs authorized price</div>
                          <div className="mt-0.5">
                            {hasQuoteReference
                              ? "Public reference only — enter a verified cost or supplier list. This item remains quote-only and outside the Designer."
                              : "Enter a verified cost or supplier list before this item can be sold or placed in the Designer."}
                          </div>
                        </div>
                      )}
                      <div>{money(sourceBasis?.amount)}</div>
                      {sourceBasis && (
                        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {sourceBasis.kind === "landed_cost" ? "Verified cost" : "Supplier list"}
                        </div>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-left">
                        <label className="text-[10px] font-medium text-muted-foreground">
                          Cost
                          <input
                            aria-label={`Verified cost for ${it.name}`}
                            type="number"
                            min="0"
                            step="0.01"
                            className="mt-0.5 h-7 w-full rounded border border-border bg-transparent px-1.5 text-right text-xs text-foreground"
                            defaultValue={it.yourCost == null ? "" : Number(it.yourCost)}
                            placeholder="—"
                            onBlur={(event) => {
                              const raw = event.target.value.trim();
                              if (raw === "") return;
                              const next = Number(raw);
                              if (!Number.isFinite(next) || next < 0) {
                                toast.error("Enter a non-negative verified source cost.");
                                event.target.value = it.yourCost == null ? "" : String(it.yourCost);
                                return;
                              }
                              if (next !== Number(it.yourCost ?? 0)) {
                                setPricing.mutate({ id: it.id, yourCost: next });
                              }
                            }}
                          />
                        </label>
                        <label className="text-[10px] font-medium text-muted-foreground">
                          List
                          <input
                            aria-label={`Supplier list price for ${it.name}`}
                            type="number"
                            min="0"
                            step="0.01"
                            className="mt-0.5 h-7 w-full rounded border border-border bg-transparent px-1.5 text-right text-xs text-foreground"
                            defaultValue={it.listPrice == null ? "" : Number(it.listPrice)}
                            placeholder="—"
                            onBlur={(event) => {
                              const raw = event.target.value.trim();
                              if (raw === "") return;
                              const next = Number(raw);
                              if (!Number.isFinite(next) || next < 0) {
                                toast.error("Enter a non-negative supplier list price.");
                                event.target.value = it.listPrice == null ? "" : String(it.listPrice);
                                return;
                              }
                              if (next !== Number(it.listPrice ?? 0)) {
                                setPricing.mutate({ id: it.id, listPrice: next });
                              }
                            }}
                          />
                        </label>
                      </div>
                      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">Blank keeps the existing source value. Saving both fields as 0 makes the item unavailable.</p>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {money(it.sellPrice)}
                      {typeof it.markupBps === "number" && (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          {(it.markupBps / 100).toFixed(0)}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={!!it.isActive}
                        onCheckedChange={(v) =>
                          setVisibility.mutate({ id: it.id, isActive: v })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={!!it.showInCatalog}
                        onCheckedChange={(v) =>
                          setVisibility.mutate({ id: it.id, showInCatalog: v })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={!!it.showInDesigner}
                        onCheckedChange={(v) =>
                          setVisibility.mutate({ id: it.id, showInDesigner: v })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {readiness ? (
                        <div className="space-y-0.5">
                          <Badge variant={readiness.evidenceComplete ? "default" : "outline"} className={`text-[10px] ${readiness.evidenceComplete ? "bg-emerald-600 hover:bg-emerald-600" : "border-amber-300 text-amber-800 dark:text-amber-300"}`}>
                            {readiness.evidenceComplete ? "Evidence complete" : "Evidence needed"}
                          </Badge>
                          <div className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                            {readiness.evidenceComplete ? `${readiness.role} · verified` : readiness.blockers[0] ?? "Review source evidence"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not configured</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={it.isPopular ? "default" : "outline"}
                        className="h-8 w-8 p-0"
                        onClick={() =>
                          setPopular.mutate({
                            id: it.id,
                            isPopular: !it.isPopular,
                            popularRank: it.popularRank ?? 0,
                          })
                        }
                        title={it.isPopular ? "Unfeature" : "Feature"}
                      >
                        <Star
                          className={`h-4 w-4 ${it.isPopular ? "fill-current" : ""}`}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-16 rounded border border-border bg-transparent px-1.5 py-0.5 text-right text-xs"
                        defaultValue={it.coverageSqFt ? parseFloat(String(it.coverageSqFt)) : ""}
                        placeholder="—"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          const num = val ? parseFloat(val) : null;
                          if (num !== (it.coverageSqFt ? parseFloat(String(it.coverageSqFt)) : null)) {
                            setCoverage.mutate({ id: it.id, coverageSqFt: num && num > 0 ? num : null });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {it.category === "Quartz Slabs (Countertops)" ? (
                        <input
                          aria-label={`Verified unsupported overhang for ${it.name}`}
                          type="number"
                          step="0.125"
                          min="0"
                          max="36"
                          className="w-20 rounded border border-border bg-transparent px-1.5 py-0.5 text-right text-xs"
                          defaultValue={it.unsupportedOverhangLimitIn == null ? "" : Number(it.unsupportedOverhangLimitIn)}
                          placeholder="Unverified"
                          onBlur={(event) => {
                            const value = event.target.value.trim();
                            const next = value === "" ? null : Number(value);
                            const current = it.unsupportedOverhangLimitIn == null ? null : Number(it.unsupportedOverhangLimitIn);
                            if (next !== current) {
                              setUnsupportedOverhangLimit.mutate({
                                id: it.id,
                                unsupportedOverhangLimitIn: next != null && Number.isFinite(next) ? next : null,
                              });
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 min-w-[210px] text-xs"
                        type="url"
                        defaultValue={it.materialImageUrl ?? ""}
                        placeholder="Approved repeatable material image URL"
                        onBlur={(event) => {
                          const nextValue = event.target.value.trim() || null;
                          if (nextValue !== (it.materialImageUrl ?? null)) {
                            setMaterialImage.mutate({ id: it.id, materialImageUrl: nextValue });
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
