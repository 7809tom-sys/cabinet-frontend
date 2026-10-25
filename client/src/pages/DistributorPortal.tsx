import { useMemo, useState } from "react";
import {
  Boxes, Eye, EyeOff, Loader2, PackageSearch, ClipboardList, Lock, Search, PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

const ALL = "__all__";

function money(v: string | null): string {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

export default function DistributorPortal() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  const role = user?.role;
  const isDistributor = role === "distributor";
  const isAdmin = role === "admin";
  const canAccess = isDistributor || isAdmin;

  // Admin must select a line to act on; distributors are auto-scoped.
  const [adminLineId, setAdminLineId] = useState<number | null>(null);
  const distInput = isAdmin && adminLineId ? { distributorId: adminLineId } : undefined;

  const lineList = trpc.distributorAdmin.adminList.useQuery(undefined, { enabled: isAdmin });

  const myLine = trpc.distributorPortal.myLine.useQuery(distInput, {
    enabled: canAccess && (isDistributor || !!adminLineId),
    retry: false,
  });

  const [styleId, setStyleId] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [onlyHidden, setOnlyHidden] = useState(false);

  const catalogInput = useMemo(
    () => ({
      ...(distInput ?? {}),
      styleId: styleId === ALL ? undefined : Number(styleId),
      category: category === ALL ? undefined : category,
      search: search.trim() || undefined,
      onlyHidden: onlyHidden || undefined,
      limit: 200,
      offset: 0,
    }),
    [distInput, styleId, category, search, onlyHidden]
  );

  const catalog = trpc.distributorPortal.catalog.useQuery(catalogInput, {
    enabled: canAccess && (isDistributor || !!adminLineId),
  });

  const orders = trpc.distributorPortal.orders.useQuery(distInput ?? {}, {
    enabled: canAccess && (isDistributor || !!adminLineId),
  });
  const [invoiceDrafts, setInvoiceDrafts] = useState<Record<number, { reference: string; amount: string; notes: string }>>({});
  const confirmInventory = trpc.distributorPortal.confirmInventoryAndInvoice.useMutation({
    onSuccess: () => {
      void utils.distributorPortal.orders.invalidate();
      toast.success("Inventory confirmed and updated invoice sent to affiliate review.");
    },
    onError: (error) => toast.error(error.message),
  });

  const setVisibility = trpc.distributorPortal.setVisibility.useMutation({
    onMutate: async (vars) => {
      await utils.distributorPortal.catalog.cancel(catalogInput);
      const prev = utils.distributorPortal.catalog.getData(catalogInput);
      utils.distributorPortal.catalog.setData(catalogInput, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((i) =>
                i.skuId === vars.skuId ? { ...i, isPublished: vars.isPublished } : i
              ),
            }
          : old
      );
      return { prev };
    },
    onError: (_e, _v, c) => {
      if (c?.prev) utils.distributorPortal.catalog.setData(catalogInput, c.prev);
      toast.error("Could not update visibility.");
    },
    onSettled: () => {
      utils.distributorPortal.catalog.invalidate();
      utils.distributorPortal.myLine.invalidate();
    },
  });

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const i of catalog.data?.items ?? []) if (i.category) s.add(i.category);
    return Array.from(s).sort();
  }, [catalog.data]);

  // ─── Access gates ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="container max-w-3xl py-20">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-lg py-24 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="font-serif text-2xl font-bold mb-2">Distributor Portal</h1>
        <p className="text-muted-foreground mb-6">
          Sign in with your supplier account to manage your line's catalog and orders.
        </p>
        <Button onClick={() => (window.location.href = getLoginUrl())}>Member Sign In</Button>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="container max-w-lg py-24 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="font-serif text-2xl font-bold mb-2">Supplier access only</h1>
        <p className="text-muted-foreground">
          This portal is for supply-line partners. If you believe you should have access, contact
          the platform administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Boxes className="h-4 w-4" /> Distributor Portal
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold mt-1">
          {myLine.data ? myLine.data.line.name : "Your Supply Line"}
        </h1>
        {myLine.isError && (
          <p className="text-sm text-destructive mt-1">
            Couldn't load your line summary.{" "}
            <button className="underline" onClick={() => myLine.refetch()}>Retry</button>
          </p>
        )}
        <p className="text-muted-foreground mt-1 text-sm">
          Manage which products appear on the platform and review incoming order requests.
        </p>
      </div>

      {/* Admin line picker */}
      {isAdmin && (
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Acting on line:</span>
            <Select
              value={adminLineId ? String(adminLineId) : ""}
              onValueChange={(v) => setAdminLineId(Number(v))}
            >
              <SelectTrigger className="w-[220px] bg-background">
                <SelectValue placeholder="Select a supply line" />
              </SelectTrigger>
              <SelectContent>
                {(lineList.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!adminLineId && (
              <span className="text-xs text-muted-foreground">
                Select a line to view its catalog as the distributor would.
              </span>
            )}
          </div>
        </Card>
      )}

      {(isDistributor || adminLineId) && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <StatCard label="Products in line" value={myLine.data?.counts.total} icon={<Boxes className="h-4 w-4" />} />
            <StatCard label="Published (visible)" value={myLine.data?.counts.published} icon={<Eye className="h-4 w-4" />} />
            <StatCard label="In stock / available" value={myLine.data?.counts.available} icon={<PackageSearch className="h-4 w-4" />} />
          </div>

          <Tabs defaultValue="catalog">
            <TabsList>
              <TabsTrigger value="catalog">
                <PackageSearch className="mr-1.5 h-4 w-4" /> Catalog
              </TabsTrigger>
              <TabsTrigger value="orders">
                <ClipboardList className="mr-1.5 h-4 w-4" /> Orders
                {orders.data && orders.data.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{orders.data.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="bundles">
                <PackageOpen className="mr-1.5 h-4 w-4" /> Kitchen Packages
              </TabsTrigger>
            </TabsList>

            {/* ─── Catalog management ─────────────────────────────────────── */}
            <TabsContent value="catalog" className="mt-5">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search code or description"
                    className="pl-8 w-[240px]"
                  />
                </div>
                <Select value={styleId} onValueChange={setStyleId}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="Door style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All door styles</SelectItem>
                    {(myLine.data?.styles ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.ourName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-[160px] bg-background">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch checked={onlyHidden} onCheckedChange={setOnlyHidden} />
                  Hidden only
                </label>
              </div>

              {catalog.isError ? (
                <Card className="p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Couldn't load your catalog.</p>
                  <Button variant="outline" className="bg-background" onClick={() => catalog.refetch()}>Retry</Button>
                </Card>
              ) : catalog.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (catalog.data?.items.length ?? 0) === 0 ? (
                <Card className="p-10 text-center text-muted-foreground">
                  No products match these filters.
                </Card>
              ) : (
                <Card className="divide-y divide-border overflow-hidden">
                  {catalog.data!.items.map((item) => (
                    <div key={item.skuId} className="flex items-center gap-4 p-3 sm:p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{item.masterCode}</span>
                          {!item.isPublished && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">Hidden</Badge>
                          )}
                          {!item.isAvailable && (
                            <Badge variant="outline" className="text-muted-foreground">Out of stock</Badge>
                          )}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.styleName} · {item.category}
                          {item.subCategory ? ` / ${item.subCategory}` : ""} · Contractor {money(item.contractorPrice)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.isPublished ? (
                          <Eye className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Switch
                          checked={item.isPublished}
                          onCheckedChange={(v) =>
                            setVisibility.mutate({ ...(distInput ?? {}), skuId: item.skuId, isPublished: v })
                          }
                          aria-label={`Toggle visibility for ${item.masterCode}`}
                        />
                      </div>
                    </div>
                  ))}
                </Card>
              )}
              {catalog.data && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing {catalog.data.items.length} of {catalog.data.total} products in your line.
                </p>
              )}
            </TabsContent>

            {/* ─── Orders ─────────────────────────────────────────────────── */}
            <TabsContent value="orders" className="mt-5">
              {orders.isError ? (
                <Card className="p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Couldn't load orders.</p>
                  <Button variant="outline" className="bg-background" onClick={() => orders.refetch()}>Retry</Button>
                </Card>
              ) : orders.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (orders.data?.length ?? 0) === 0 ? (
                <Card className="p-10 text-center text-muted-foreground">
                  No submitted orders reference your line yet.
                </Card>
              ) : (
                <Card className="divide-y divide-border overflow-hidden">
                  {orders.data!.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{o.requestNumber}</span>
                          <Badge variant="secondary">{o.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {o.styleName ?? "—"} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {o.tier}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{money(o.totalAmount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="w-full grid gap-2 border-t pt-3 sm:grid-cols-[1fr_8rem_1fr_auto]">
                        <Input
                          aria-label={`Updated invoice reference for ${o.requestNumber}`}
                          placeholder="Updated invoice #"
                          value={invoiceDrafts[o.id]?.reference ?? ""}
                          onChange={(event) => setInvoiceDrafts((drafts) => ({ ...drafts, [o.id]: { reference: event.target.value, amount: drafts[o.id]?.amount ?? "", notes: drafts[o.id]?.notes ?? "" } }))}
                        />
                        <Input
                          aria-label={`Updated invoice amount for ${o.requestNumber}`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Amount"
                          value={invoiceDrafts[o.id]?.amount ?? ""}
                          onChange={(event) => setInvoiceDrafts((drafts) => ({ ...drafts, [o.id]: { reference: drafts[o.id]?.reference ?? "", amount: event.target.value, notes: drafts[o.id]?.notes ?? "" } }))}
                        />
                        <Input
                          aria-label={`Inventory notes for ${o.requestNumber}`}
                          placeholder="Inventory / invoice notes (optional)"
                          value={invoiceDrafts[o.id]?.notes ?? ""}
                          onChange={(event) => setInvoiceDrafts((drafts) => ({ ...drafts, [o.id]: { reference: drafts[o.id]?.reference ?? "", amount: drafts[o.id]?.amount ?? "", notes: event.target.value } }))}
                        />
                        <Button
                          disabled={confirmInventory.isPending || !invoiceDrafts[o.id]?.reference || invoiceDrafts[o.id]?.amount === ""}
                          onClick={() => confirmInventory.mutate({
                            ...(distInput ?? {}), orderId: o.id,
                            invoiceReference: invoiceDrafts[o.id]?.reference ?? "",
                            invoiceAmount: Number(invoiceDrafts[o.id]?.amount ?? 0),
                            invoiceNotes: invoiceDrafts[o.id]?.notes || undefined,
                          })}
                        >Confirm inventory</Button>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </TabsContent>
            <TabsContent value="bundles" className="mt-5">
              <VendorBundleDealsPanel distributorId={myLine.data?.line.id} distributorName={myLine.data?.line.name} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value?: number; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 text-3xl font-bold">
        {value == null ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : value}
      </div>
    </Card>
  );
}
import { VendorBundleDealsPanel } from "@/components/vendor/VendorBundleDealsPanel";
