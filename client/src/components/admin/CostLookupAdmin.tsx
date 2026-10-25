import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Save, History, ShieldCheck, X, BadgeCheck, CircleAlert, CalendarClock, ListFilter, ChevronUp, ChevronDown, Download } from "lucide-react";

// Only authorized source values are editable. The customer/trade tiers remain
// visible below, but are calculated from the current source list/cost on save.
const SOURCE_FIELDS = [
  { key: "yourCost", label: "Your Cost" },
  { key: "listPrice", label: "List Price" },
] as const;
const CALCULATED_FIELDS = [
  { key: "wholesalePrice", label: "Wholesale" },
  { key: "contractorPrice", label: "Contractor" },
  { key: "homeownerPrice", label: "Homeowner" },
] as const;
const FIELDS = [...SOURCE_FIELDS, ...CALCULATED_FIELDS] as const;
type SourceFieldKey = (typeof SOURCE_FIELDS)[number]["key"];
type PriceFieldKey = (typeof FIELDS)[number]["key"];

type Sku = {
  skuId: number;
  distributorId: number | null;
  styleId: number | null;
  platformSku: string;
  distributorSku: string;
  supplierCabinetName: string | null;
  isAvailable: boolean;
  isPublished: boolean;
  yourCost: string | null;
  listPrice: string | null;
  wholesalePrice: string | null;
  contractorPrice: string | null;
  homeownerPrice: string | null;
  distributorName: string | null;
  distributorBrandName: string | null;
  styleOurName: string | null;
  styleCode: string | null;
  styleDistributorName: string | null;
};

type CabinetResult = {
  id: number;
  masterCode: string;
  description: string;
  category: string;
  subCategory: string | null;
  conflictStatus?: string;
  priceVerified?: boolean;
  priceVerifiedAt?: string | Date | null;
  priceVerifiedByName?: string | null;
  skus: Sku[];
};

function dollarsOrBlank(v: string | null): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

// One editable SKU row. Tracks its own dirty draft so each row saves
// independently and only changed fields are sent.
function SkuRow({ sku, onSaved }: { sku: Sku; onSaved: () => void }) {
  const initial: Record<PriceFieldKey, string> = {
    yourCost: dollarsOrBlank(sku.yourCost),
    listPrice: dollarsOrBlank(sku.listPrice),
    wholesalePrice: dollarsOrBlank(sku.wholesalePrice),
    contractorPrice: dollarsOrBlank(sku.contractorPrice),
    homeownerPrice: dollarsOrBlank(sku.homeownerPrice),
  };
  const [draft, setDraft] = useState<Record<SourceFieldKey, string>>({
    yourCost: initial.yourCost,
    listPrice: initial.listPrice,
  });

  const dirty = SOURCE_FIELDS.some((f) => draft[f.key] !== initial[f.key]);

  const update = trpc.pricing.adminUpdateSkuCost.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.changed > 0
          ? `Saved and recalculated the price ladder (${res.recalculation.updated.toLocaleString()} priced SKU rows refreshed).`
          : "No source-price changes to save",
      );
      onSaved();
    },
    onError: (e) => toast.error(e.message || "Save failed"),
  });

  const handleSave = () => {
    const payload: Record<string, number | null> = { skuId: sku.skuId };
    for (const f of SOURCE_FIELDS) {
      if (draft[f.key] === initial[f.key]) continue;
      const trimmed = draft[f.key].trim();
      payload[f.key] = trimmed === "" ? null : Number(trimmed);
    }
    update.mutate(payload as Parameters<typeof update.mutate>[0]);
  };

  // White-label-safe supplier label: prefer neutral name, fall back to brand.
  const lineLabel = sku.distributorName || sku.distributorBrandName || `Line ${sku.distributorId ?? "?"}`;
  const styleLabel = sku.styleOurName || sku.styleCode || `Style ${sku.styleId ?? "?"}`;

  return (
    <TableRow className={dirty ? "bg-amber-50" : undefined}>
      <TableCell className="align-top">
        <div className="font-medium">{styleLabel}</div>
        <div className="text-xs text-muted-foreground">{lineLabel}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge variant="outline" className="font-mono text-[10px]">{sku.platformSku}</Badge>
          {!sku.isPublished && <Badge variant="secondary" className="text-[10px]">unpublished</Badge>}
          {!sku.isAvailable && <Badge variant="destructive" className="text-[10px]">unavailable</Badge>}
        </div>
        <p className="mt-1 max-w-[180px] text-[10px] leading-snug text-muted-foreground">
          Wholesale, contractor, and homeowner prices are calculated from the source cost and saved markup rules.
        </p>
      </TableCell>
      {SOURCE_FIELDS.map((f) => (
        <TableCell key={f.key} className="align-top">
          <Input
            inputMode="decimal"
            value={draft[f.key]}
            placeholder="—"
            className={draft[f.key] !== initial[f.key] ? "border-amber-500" : ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
          />
        </TableCell>
      ))}
      {CALCULATED_FIELDS.map((f) => (
        <TableCell key={f.key} className="align-top">
          <output className="block min-h-9 rounded-md border bg-muted/40 px-3 py-2 text-sm tabular-nums text-muted-foreground">
            {initial[f.key] === "" ? "—" : `$${Number(initial[f.key]).toFixed(2)}`}
          </output>
        </TableCell>
      ))}
      <TableCell className="align-top">
        <Button size="sm" disabled={!dirty || update.isPending} onClick={handleSave}>
          {update.isPending ? <Spinner className="size-4" /> : <Save className="size-4" />}
          <span className="ml-1">Save</span>
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Audit-trail drawer for a single cabinet number.
function AuditTrail({ masterCode, onClose }: { masterCode: string; onClose: () => void }) {
  const { data, isLoading } = trpc.pricing.adminCostHistory.useQuery(
    { masterCode, limit: 100 },
    { enabled: !!masterCode },
  );
  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" /> Change history — {masterCode}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}><X className="size-4" /></Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : !data || data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Old</TableHead>
                <TableHead>New</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{row.field}</TableCell>
                  <TableCell className="text-xs">{row.oldValue ?? "—"}</TableCell>
                  <TableCell className="text-xs font-medium">{row.newValue ?? "—"}</TableCell>
                  <TableCell className="text-xs">{row.changedByName ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Per-cabinet "audited against my price list" control + badge.
function VerifyButton({
  cabinetId,
  verified,
  verifiedAt,
  verifiedByName,
  onChanged,
}: {
  cabinetId: number;
  verified: boolean;
  verifiedAt?: string | Date | null;
  verifiedByName?: string | null;
  onChanged: () => void;
}) {
  const setVerified = trpc.pricing.adminSetPriceVerified.useMutation({
    onSuccess: (res) => {
      toast.success(res.verified ? "Marked price verified" : "Cleared verification");
      onChanged();
    },
    onError: (e) => toast.error(e.message || "Update failed"),
  });

  if (verified) {
    const when = verifiedAt ? new Date(verifiedAt).toLocaleDateString() : null;
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge className="bg-emerald-600 hover:bg-emerald-600">
          <BadgeCheck className="mr-1 size-3.5" /> Price verified
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {verifiedByName ? `by ${verifiedByName}` : ""}{when ? ` · ${when}` : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-muted-foreground"
          disabled={setVerified.isPending}
          onClick={() => setVerified.mutate({ cabinetId, verified: false })}
        >
          {setVerified.isPending ? <Spinner className="size-3" /> : "Clear"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Badge variant="outline" className="border-amber-500 text-amber-700">
        <CircleAlert className="mr-1 size-3.5" /> Not audited
      </Badge>
      <Button
        size="sm"
        className="bg-emerald-600 hover:bg-emerald-700"
        disabled={setVerified.isPending}
        onClick={() => setVerified.mutate({ cabinetId, verified: true })}
      >
        {setVerified.isPending ? <Spinner className="size-4" /> : <BadgeCheck className="size-4" />}
        <span className="ml-1">Mark price verified</span>
      </Button>
    </div>
  );
}

// A full cabinet card: header (code + verify + history) and the SKU price table.
// `defaultCollapsed` starts the price table hidden behind a toggle — used by the
// Daily Picks panel so 4 cabinets (each with many SKUs) stay scannable.
function CabinetCard({
  cab,
  auditOpen,
  onToggleAudit,
  onChanged,
  defaultCollapsed = false,
}: {
  cab: CabinetResult;
  auditOpen: boolean;
  onToggleAudit: () => void;
  onChanged: () => void;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="font-mono">{cab.masterCode}</CardTitle>
          <p className="text-sm text-muted-foreground">{cab.description}</p>
          <p className="text-xs text-muted-foreground">
            {cab.category}{cab.subCategory ? ` · ${cab.subCategory}` : ""} · {cab.skus.length} SKU{cab.skus.length === 1 ? "" : "s"}
          </p>
          {defaultCollapsed && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 bg-background"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              <span className="ml-1">{open ? "Hide prices" : "Open / edit prices"}</span>
            </Button>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <VerifyButton
            cabinetId={cab.id}
            verified={!!cab.priceVerified}
            verifiedAt={cab.priceVerifiedAt}
            verifiedByName={cab.priceVerifiedByName}
            onChanged={onChanged}
          />
          <Button variant="outline" size="sm" className="bg-background" onClick={onToggleAudit}>
            <History className="size-4" />
            <span className="ml-1">History</span>
          </Button>
        </div>
      </CardHeader>
      {open && (
      <CardContent>
        {cab.skus.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No SKUs mapped for this cabinet yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Door style / line</TableHead>
                  {SOURCE_FIELDS.map((f) => (
                    <TableHead key={f.key} className="min-w-[110px]">{f.label}</TableHead>
                  ))}
                  {CALCULATED_FIELDS.map((f) => (
                    <TableHead key={f.key} className="min-w-[110px]">{f.label}</TableHead>
                  ))}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cab.skus.map((sku) => (
                  <SkuRow key={sku.skuId} sku={sku} onSaved={onChanged} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {auditOpen && <AuditTrail masterCode={cab.masterCode} onClose={onToggleAudit} />}
      </CardContent>
      )}
      {!open && auditOpen && (
        <CardContent>
          <AuditTrail masterCode={cab.masterCode} onClose={onToggleAudit} />
        </CardContent>
      )}
    </Card>
  );
}

// ─── Today's picks: 4 unaudited items to check each day ──────────────────────
function DailyPicks() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.pricing.adminDailyAuditPicks.useQuery({ count: 4 });
  const [auditFor, setAuditFor] = useState<string | null>(null);

  const refetch = () => {
    utils.pricing.adminDailyAuditPicks.invalidate();
    utils.pricing.adminAuditDistributors.invalidate();
    if (auditFor) utils.pricing.adminCostHistory.invalidate();
  };

  const picks = (data?.picks ?? []) as CabinetResult[];

  return (
    <Card className="border-emerald-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-emerald-600" />
          Today&apos;s 4 to audit
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A fresh rotation of items that still need a price check — confirm these
          against your distributor paperwork so the catalog stays accurate.
          {typeof data?.remaining === "number" && (
            <span className="ml-1 font-medium text-foreground">
              {data.remaining} item{data.remaining === 1 ? "" : "s"} still unaudited.
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : picks.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-6 text-sm text-emerald-800">
            <BadgeCheck className="size-5" /> All items have been price-verified. Nothing to audit today.
          </div>
        ) : (
          picks.map((cab) => (
            <CabinetCard
              key={cab.id}
              cab={cab}
              defaultCollapsed
              auditOpen={auditFor === cab.masterCode}
              onToggleAudit={() => setAuditFor(auditFor === cab.masterCode ? null : cab.masterCode)}
              onChanged={refetch}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─── Missing approved customer prices: priority owner correction queue ────────
function MissingCustomerPriceQueue() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.pricing.adminMissingCustomerPriceQueue.useQuery({ limit: 25 });
  const { data: exportData, isLoading: isExportLoading } = trpc.pricing.adminMissingCustomerPriceQueue.useQuery({ limit: 500 });
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const cabinets = (data?.cabinets ?? []) as CabinetResult[];

  const exportCorrectionCsv = () => {
    const rows = ((exportData?.cabinets ?? []) as CabinetResult[]).flatMap((cab) =>
      cab.skus.map((sku) => [
        cab.masterCode,
        cab.description,
        cab.category,
        cab.subCategory ?? "",
        sku.styleOurName ?? sku.styleCode ?? "",
        sku.styleCode ?? "",
        sku.distributorName ?? sku.distributorBrandName ?? "",
        sku.platformSku,
        sku.distributorSku,
        "Quote required — approved customer price missing",
      ]),
    );
    const quote = (value: string) => `"${String(value).replaceAll('"', '""')}"`;
    const content = [
      ["Master code", "Description", "Category", "Subcategory", "Door style", "Style code", "Distributor", "Platform SKU", "Supplier SKU", "Status"],
      ...rows,
    ].map((row) => row.map(quote).join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "cabinetdealz-missing-customer-prices.csv";
    link.click();
    URL.revokeObjectURL(href);
    toast.success(`Downloaded ${rows.length} quote-only SKU${rows.length === 1 ? "" : "s"} for price correction`);
  };

  const refetch = () => {
    utils.pricing.adminMissingCustomerPriceQueue.invalidate();
    utils.pricing.adminDailyAuditPicks.invalidate();
    utils.pricing.adminAuditDistributors.invalidate();
    if (auditFor) utils.pricing.adminCostHistory.invalidate();
  };

  return (
    <Card className="border-amber-300 bg-amber-50/40">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-amber-950">
            <CircleAlert className="size-5 text-amber-700" />
            Published products needing customer pricing
          </CardTitle>
        <p className="text-sm text-amber-900/80">
          These products are visible but have no approved customer price source. They remain quote-only and cannot be added to cart until you enter an approved price.
          {typeof data?.remaining === "number" && (
            <span className="ml-1 font-medium text-amber-950">
              {data.remaining} cabinet{data.remaining === 1 ? "" : "s"} need attention.
            </span>
          )}
        </p>
        </div>
        <Button
          variant="outline"
          className="border-amber-400 bg-background text-amber-950 hover:bg-amber-100"
          onClick={exportCorrectionCsv}
          disabled={isExportLoading || !exportData}
        >
          {isExportLoading ? <Spinner className="size-4" /> : <Download className="size-4" />}
          <span className="ml-1">Download correction CSV</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : cabinets.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
            <BadgeCheck className="size-5" /> Every published product has a usable customer price source.
          </div>
        ) : (
          cabinets.map((cab) => (
            <CabinetCard
              key={cab.id}
              cab={cab}
              defaultCollapsed
              auditOpen={auditFor === cab.masterCode}
              onToggleAudit={() => setAuditFor(auditFor === cab.masterCode ? null : cab.masterCode)}
              onChanged={refetch}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─── Find by dropdown: Distributor → Door style → Item ───────────────────────
function DropdownFinder() {
  const utils = trpc.useUtils();
  const [distId, setDistId] = useState<number | null>(null);
  const [styleId, setStyleId] = useState<number | null>(null);
  const [cabinetId, setCabinetId] = useState<number | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const distQuery = trpc.pricing.adminAuditDistributors.useQuery();
  const stylesQuery = trpc.pricing.adminAuditStyles.useQuery(
    { distributorId: distId ?? 0 },
    { enabled: distId !== null },
  );
  const itemsQuery = trpc.pricing.adminAuditItems.useQuery(
    { distributorId: distId ?? 0, styleId: styleId ?? 0 },
    { enabled: distId !== null && styleId !== null },
  );

  const distributors = (distQuery.data ?? []) as {
    id: number; label: string; cabinetCount: number; auditedCount: number; unauditedCount: number;
  }[];
  const styles = (stylesQuery.data ?? []) as {
    id: number; label: string; ourName: string; styleCode: string; itemCount: number;
  }[];
  type Item = Sku & {
    cabinetId: number;
    masterCode: string;
    description: string;
    category: string;
    subCategory: string | null;
    priceVerified: boolean;
    priceVerifiedAt?: string | Date | null;
    priceVerifiedByName?: string | null;
  };
  const items = (itemsQuery.data ?? []) as Item[];

  const selectedItem = useMemo(
    () => items.find((it) => it.cabinetId === cabinetId) ?? null,
    [items, cabinetId],
  );

  // Build a CabinetResult shape from the single selected SKU so we can reuse
  // the same CabinetCard editor used everywhere else.
  const selectedCab: CabinetResult | null = useMemo(() => {
    if (!selectedItem) return null;
    return {
      id: selectedItem.cabinetId,
      masterCode: selectedItem.masterCode,
      description: selectedItem.description,
      category: selectedItem.category,
      subCategory: selectedItem.subCategory,
      priceVerified: selectedItem.priceVerified,
      priceVerifiedAt: selectedItem.priceVerifiedAt,
      priceVerifiedByName: selectedItem.priceVerifiedByName,
      skus: [selectedItem as Sku],
    };
  }, [selectedItem]);

  const refetch = () => {
    utils.pricing.adminAuditItems.invalidate();
    utils.pricing.adminAuditDistributors.invalidate();
    utils.pricing.adminDailyAuditPicks.invalidate();
    if (auditOpen) utils.pricing.adminCostHistory.invalidate();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListFilter className="size-5 text-emerald-600" />
            Find an item to audit
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            No SKU needed. Pick the original <strong>distributor</strong>, then the
            <strong> door style</strong>, then the <strong>item</strong> — its prices
            load below, ready to compare against your price list and mark audited.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Distributor */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Distributor</label>
              <Select
                value={distId !== null ? String(distId) : undefined}
                onValueChange={(v) => {
                  setDistId(Number(v));
                  setStyleId(null);
                  setCabinetId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={distQuery.isLoading ? "Loading…" : "Select distributor"} />
                </SelectTrigger>
                <SelectContent>
                  {distributors.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.label} ({d.auditedCount}/{d.cabinetCount} audited)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Door style */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Door style</label>
              <Select
                value={styleId !== null ? String(styleId) : undefined}
                disabled={distId === null}
                onValueChange={(v) => {
                  setStyleId(Number(v));
                  setCabinetId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    distId === null ? "Pick a distributor first"
                      : stylesQuery.isLoading ? "Loading…"
                      : "Select door style"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {styles.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.label} · {s.itemCount} item{s.itemCount === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Item</label>
              <Select
                value={cabinetId !== null ? String(cabinetId) : undefined}
                disabled={styleId === null}
                onValueChange={(v) => {
                  setCabinetId(Number(v));
                  setAuditOpen(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    styleId === null ? "Pick a door style first"
                      : itemsQuery.isLoading ? "Loading…"
                      : "Select item"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {items.map((it) => (
                    <SelectItem key={it.cabinetId} value={String(it.cabinetId)}>
                      {it.masterCode} — {it.description}
                      {it.priceVerified ? "  ✓" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {styleId !== null && !itemsQuery.isLoading && items.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">No items found for this door style.</p>
          )}
        </CardContent>
      </Card>

      {selectedCab && (
        <CabinetCard
          cab={selectedCab}
          auditOpen={auditOpen}
          onToggleAudit={() => setAuditOpen((o) => !o)}
          onChanged={refetch}
        />
      )}
    </div>
  );
}

// ─── Search by code / queue number (the original path) ───────────────────────
function SearchFinder() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState<string>("");
  const [auditFor, setAuditFor] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading, isFetching } = trpc.pricing.adminLookupCost.useQuery(
    { query: submitted },
    { enabled: submitted.length > 0 },
  );

  const doSearch = () => {
    const q = term.trim();
    if (!q) {
      toast.error("Enter a queue number or model code to search");
      return;
    }
    setSubmitted(q);
    setAuditFor(null);
  };

  const refetchAll = () => {
    utils.pricing.adminLookupCost.invalidate();
    utils.pricing.adminDailyAuditPicks.invalidate();
    if (auditFor) utils.pricing.adminCostHistory.invalidate();
  };

  const results = (data?.cabinets ?? []) as CabinetResult[];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5 text-emerald-600" />
            Search by code or queue number
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Look up an item by its <strong>queue number</strong> (e.g.
            <code className="mx-1 rounded bg-muted px-1">#123</code>) or by its
            <strong> model / cabinet code</strong> (e.g. B24, DB-24-3).
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Queue number (#123) or model code, e.g. B24, DB-24-3"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
              />
            </div>
            <Button onClick={doSearch} disabled={isFetching}>
              {isFetching ? <Spinner className="size-4" /> : <Search className="size-4" />}
              <span className="ml-1">Search</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && submitted && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}

      {submitted && !isLoading && results.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No cabinet found matching “{submitted}”.
          </CardContent>
        </Card>
      )}

      {results.map((cab) => (
        <CabinetCard
          key={cab.id}
          cab={cab}
          auditOpen={auditFor === cab.masterCode}
          onToggleAudit={() => setAuditFor(auditFor === cab.masterCode ? null : cab.masterCode)}
          onChanged={refetchAll}
        />
      ))}
    </div>
  );
}

export default function CostLookupAdmin() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600" />
            Cost Lookup &amp; Price Audit
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Owner-only. Compare stored prices against your master price list,
            correct any field inline, then hit <strong>Mark price verified</strong>.
            Every change is logged.
          </p>
        </CardHeader>
      </Card>

      <MissingCustomerPriceQueue />

      <DailyPicks />

      <Tabs defaultValue="dropdown" className="w-full">
        <TabsList>
          <TabsTrigger value="dropdown">
            <ListFilter className="mr-1.5 size-4" /> Find by dropdown
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="mr-1.5 size-4" /> Search by code
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dropdown" className="mt-4">
          <DropdownFinder />
        </TabsContent>
        <TabsContent value="search" className="mt-4">
          <SearchFinder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
