import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CRM_STAGES, CRM_PIPELINE_STAGES, CRM_CLOSED_STAGES, CRM_STAGE_LABELS,
  CRM_PRIORITY_LABELS, isClosedStage,
  crmEmailBlockedReason, CRM_EMAIL_BLOCK_MESSAGES,
  type CrmStage, type CrmPriority, type CrmLanguage,
} from "@shared/crm";
import {
  Plus, Phone, Mail, MapPin, Building2, ChevronRight, Inbox,
  CircleDollarSign, Languages, Trash2, Send, AlertTriangle, Settings2, FileText, Upload, Download, Image,
} from "lucide-react";
import { CRM_CUSTOMER_LIST_TEMPLATE, crmCustomerFileReadProgress, parseCrmCustomerListCsv, type CrmCustomerImportRow, type CrmCustomerImportSkippedRow } from "@shared/crmCustomerListImport";
import { affiliateCardColor, type CrmAffiliateBrand } from "@/lib/crmAffiliateBrand";
import { MASTER_AFFILIATE_FILTER_ALL, masterAffiliateFilterId } from "@/lib/crmMasterFilter";
import { filterDealsByHelpType, type CrmHelpFilter } from "@/lib/crmHelpFilter";
import { crmQuickInvoiceTotal, openCrmQuickInvoicePdf, type CrmQuickInvoiceBrand, type CrmQuickInvoiceLine } from "@/lib/crmQuickInvoice";

type Lang = CrmLanguage;
const L = (lang: Lang) => ({
  title: lang === "es" ? "CRM de ventas" : "Sales CRM",
  subtitle: lang === "es"
    ? "Gestiona tus prospectos y oportunidades por etapa."
    : "Track your leads and deals through each stage.",
  newDeal: lang === "es" ? "Nuevo trato" : "New Deal",
  importLeads: lang === "es" ? "Importar prospectos" : "Import Leads",
  empty: lang === "es" ? "Sin tratos en esta etapa" : "No deals in this stage",
  pipelineValue: lang === "es" ? "Valor del pipeline" : "Pipeline value",
  openDeals: lang === "es" ? "Tratos abiertos" : "Open deals",
  won: lang === "es" ? "Ganados" : "Won",
});

function money(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

interface DealRow {
  id: number;
  title: string;
  stage: CrmStage;
  priority: CrmPriority;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  company: string | null;
  location: string | null;
  language: Lang;
  estimatedValue: string | null;
  designValue?: string | null;
  shippingQuote?: string | null;
  shippingAddress?: string | null;
  shippingAddressVerified?: boolean;
  designSyncedAt?: string | Date | null;
  source: string;
  referralCode: string | null;
  nextFollowUpAt: string | Date | null;
  notes: string | null;
  updatedAt: string | Date;
  affiliateId?: number | null;
  needsHelpClosing?: boolean;
  needsHelpDesigning?: boolean;
  needsHelpShipping?: boolean;
  laborEstimateId?: number | null;
}

type CrmInvoicePrefill = {
  cabinetOrderAmount: string | number | null;
  cabinetOrderSource: string | null;
  shippingAmount: string | number | null;
  shippingSource: string | null;
  shippingNote: string | null;
  laborAmount: string | number | null;
  laborSource: string | null;
};

type CrmLaborEstimate = {
  id: number;
  orderRequestId: number | null;
  customerName: string | null;
  customerEmail: string | null;
  status: "draft" | "shared" | "accepted" | "cancelled";
  totalAmount: string | number;
  updatedAt: string | Date;
};

type LinkedInvoiceDesign = {
  viewCount?: number;
  lastViewedAt?: string | Date | null;
  recentViews?: { viewedAt: string | Date; viewerName: string | null; viewerKind: string }[];
  id: number;
  designId: number;
  designName: string;
	creatorScope: string;
	creatorStoreName: string;
	 designUrl: string;
	 designUpdatedAt: string | Date;
	 designCreatedAt: string | Date;
	 designOrderValue: string | number | null;
	 selectedStyleId: number | null;
	selectedSurfaces: unknown;
  catalogSubtotal: string | number | null;
  catalogSubtotalSource: string | null;
  materialLines: { description: string; quantity: number }[];
};

const priorityColor: Record<CrmPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-700",
};

export function CrmBoard({ lang = "en", affiliateId }: { lang?: Lang; affiliateId?: number }) {
  const t = L(lang);
  const utils = trpc.useUtils();
  const [masterAffiliateFilter, setMasterAffiliateFilter] = useState(MASTER_AFFILIATE_FILTER_ALL);
  const [helpFilter, setHelpFilter] = useState<CrmHelpFilter>("all");
  const masterAffiliateId = masterAffiliateFilterId(masterAffiliateFilter);
  const boardInput = affiliateId != null
    ? { affiliateId }
    : masterAffiliateId != null
      ? { affiliateId: masterAffiliateId }
      : undefined;
  const { data, isLoading, error } = trpc.crm.board.useQuery(
    boardInput,
  );
  const [openDealId, setOpenDealId] = useState<number | null>(() => {
    const requested = Number(new URLSearchParams(window.location.search).get("deal"));
    return Number.isInteger(requested) && requested > 0 ? requested : null;
  });
  const [mobileStage, setMobileStage] = useState<CrmStage>("new");

  const deals = (data?.deals ?? []) as DealRow[];
  const filteredDeals = useMemo(() => filterDealsByHelpType(deals, helpFilter), [deals, helpFilter]);
  const affiliateNames = (data as any)?.affiliateNames as Record<number, string> | undefined;
  const affiliateBranding = (data as any)?.affiliateBranding as Record<number, CrmAffiliateBrand> | undefined;
  const isMasterView = (data as any)?.isMasterView === true;
  const affiliateOptions = useMemo(
    () => Object.entries(affiliateBranding ?? {}).sort(([, a], [, b]) => a.storeName.localeCompare(b.storeName)),
    [affiliateBranding],
  );

  const byStage = useMemo(() => {
    const map: Record<CrmStage, DealRow[]> = {
      new: [], contacted: [], qualified: [], image_review: [], quoted: [], won: [], lost: [],
    };
    for (const d of filteredDeals) map[d.stage]?.push(d);
    return map;
  }, [filteredDeals]);

  const openValue = useMemo(
    () => filteredDeals.filter((d) => !isClosedStage(d.stage)).reduce((s, d) => s + Number(d.estimatedValue ?? 0), 0),
    [filteredDeals],
  );
  const wonCount = byStage.won.length;
  const openCount = filteredDeals.filter((d) => !isClosedStage(d.stage)).length;

  const move = trpc.crm.moveStage.useMutation({
    onMutate: async (vars) => {
      await utils.crm.board.cancel();
      const prev = utils.crm.board.getData();
      utils.crm.board.setData(undefined, (old) =>
        old ? { ...old, deals: old.deals.map((d) => (d.id === vars.id ? { ...d, stage: vars.stage } : d)) } : old,
      );
      return { prev };
    },
    onError: (_e, _v, c) => { if (c?.prev) utils.crm.board.setData(undefined, c.prev); toast.error("Couldn't move deal"); },
    onSettled: () => utils.crm.board.invalidate(),
  });

  function onDropTo(stage: CrmStage, e: React.DragEvent) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/deal-id"));
    if (id) move.mutate({ id, stage });
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        {error.data?.code === "FORBIDDEN"
          ? (lang === "es"
              ? "Tu cuenta aún no tiene acceso al CRM."
              : "Your account doesn't have CRM access yet.")
          : (lang === "es" ? "No se pudo cargar el CRM." : "Couldn't load the CRM board.")}
      </div>
    );
  }

  return (
    <div>
      {/* Header + stats + actions */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isMasterView && (
            <Select value={masterAffiliateFilter} onValueChange={setMasterAffiliateFilter}>
              <SelectTrigger className="w-[210px] bg-card" aria-label="Filter deals by affiliate">
                <SelectValue placeholder="All affiliates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MASTER_AFFILIATE_FILTER_ALL}>All affiliates</SelectItem>
                {affiliateOptions.map(([id, affiliate]) => (
                  <SelectItem key={id} value={id}>{affiliate.storeName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={helpFilter} onValueChange={(value) => setHelpFilter(value as CrmHelpFilter)}>
            <SelectTrigger className="w-[210px] bg-card" aria-label="Filter deals by help type">
              <SelectValue placeholder="All help requests" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All help requests</SelectItem>
              <SelectItem value="design">Needs Design Help</SelectItem>
              <SelectItem value="shipping">Needs Shipping Cost Help</SelectItem>
            </SelectContent>
          </Select>
          <ImportLeadsDialog lang={lang} />
          <CustomerListImportDialog lang={lang} affiliateId={affiliateId} />
          <NewDealDialog lang={lang} affiliateId={affiliateId} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6 max-w-lg">
        <StatChip icon={<CircleDollarSign className="h-4 w-4" />} label={t.pipelineValue} value={money(String(openValue))} />
        <StatChip icon={<Inbox className="h-4 w-4" />} label={t.openDeals} value={String(openCount)} />
        <StatChip icon={<CircleDollarSign className="h-4 w-4" />} label={t.won} value={String(wonCount)} />
      </div>

      {/* Mobile stage selector */}
      <div className="md:hidden mb-4">
        <Select value={mobileStage} onValueChange={(v) => setMobileStage(v as CrmStage)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_PIPELINE_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {CRM_STAGE_LABELS[s][lang]} ({byStage[s].length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
        </div>
      ) : (
        <>
          {/* Mobile: single active stage */}
          <div className="md:hidden">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropTo(mobileStage, e)}
              className="rounded-lg border border-border bg-muted/20 p-3 min-h-[16rem]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">{CRM_STAGE_LABELS[mobileStage][lang]}</span>
                <Badge variant="secondary">{byStage[mobileStage].length}</Badge>
              </div>
              <div className="space-y-2">
                {byStage[mobileStage].length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">{t.empty}</p>
                ) : (
                  byStage[mobileStage].map((d) => (
                    <DealCard key={d.id} deal={d} lang={lang} onOpen={() => setOpenDealId(d.id)} affiliateName={isMasterView && d.affiliateId ? affiliateNames?.[d.affiliateId] : undefined} affiliateBrand={isMasterView && d.affiliateId ? affiliateBranding?.[d.affiliateId] : undefined} />
                  ))
                )}
              </div>
            </div>
          </div>
          {/* Desktop: all columns */}
          <div className="hidden md:grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {CRM_PIPELINE_STAGES.map((stage) => (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDropTo(stage, e)}
                className="rounded-lg border border-border bg-muted/20 p-3 min-h-[16rem]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-foreground">{CRM_STAGE_LABELS[stage][lang]}</span>
                  <Badge variant="secondary">{byStage[stage].length}</Badge>
                </div>
                <div className="space-y-2">
                  {byStage[stage].length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">{t.empty}</p>
                  ) : (
                    byStage[stage].map((d) => (
                      <DealCard key={d.id} deal={d} lang={lang} onOpen={() => setOpenDealId(d.id)} affiliateName={isMasterView && d.affiliateId ? affiliateNames?.[d.affiliateId] : undefined} affiliateBrand={isMasterView && d.affiliateId ? affiliateBranding?.[d.affiliateId] : undefined} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Closed lane */}
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        {CRM_CLOSED_STAGES.map((stage) => (
          <div
            key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropTo(stage, e)}
            className="rounded-lg border border-dashed border-border p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-muted-foreground">{CRM_STAGE_LABELS[stage][lang]}</span>
              <Badge variant="outline">{byStage[stage].length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {byStage[stage].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setOpenDealId(d.id)}
                  className="text-xs rounded border border-border bg-card px-2 py-1 hover:bg-accent"
                >
                  {d.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <DealDrawer dealId={openDealId} lang={lang} onClose={() => setOpenDealId(null)} />
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">{icon}{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DealCard({ deal, lang, onOpen, affiliateName, affiliateBrand }: { deal: DealRow; lang: Lang; onOpen: () => void; affiliateName?: string; affiliateBrand?: CrmAffiliateBrand }) {
  const brandColor = affiliateCardColor(affiliateBrand);
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/deal-id", String(deal.id))}
      onClick={onOpen}
      className="w-full text-left rounded-lg border border-border bg-card p-3 hover:shadow-sm transition-shadow cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={brandColor ? { borderLeftWidth: 4, borderLeftColor: brandColor } : undefined}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground leading-snug">{deal.contactName || deal.company || "Unnamed customer"}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Customer</div>
          <div className="mt-1 text-xs text-foreground leading-snug">{deal.title}</div>
        </div>
        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${priorityColor[deal.priority]}`}>
          {CRM_PRIORITY_LABELS[deal.priority][lang]}
        </span>
      </div>
      {affiliateName && (
        <div className="text-[10px] font-medium text-foreground bg-muted rounded px-1.5 py-0.5 inline-flex items-center gap-1.5 mb-1">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
          {affiliateName}
        </div>
      )}
      {deal.needsHelpClosing && (
        <div className="text-[10px] font-medium text-red-600 bg-red-50 rounded px-1.5 py-0.5 inline-block mb-1">Needs Help Closing</div>
      )}
      {deal.needsHelpDesigning && (
        <div className="text-[10px] font-medium text-indigo-700 bg-indigo-50 rounded px-1.5 py-0.5 inline-block mb-1">Needs Help Designing</div>
      )}
      {deal.needsHelpShipping && (
        <div className="text-[10px] font-medium text-amber-800 bg-amber-50 rounded px-1.5 py-0.5 inline-block mb-1">Needs Help Shipping Costs</div>
      )}
      {deal.source === "verified_plan_image_request" && (
        <div className="text-[10px] font-medium text-sky-800 bg-sky-50 rounded px-1.5 py-0.5 inline-flex items-center gap-1 mb-1"><Image className="h-3 w-3" />Manual AI image review</div>
      )}
      {deal.company && deal.company !== deal.contactName && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3 w-3" />{deal.company}</div>
      )}
      {deal.contactEmail && <div className="text-[11px] text-muted-foreground truncate">{deal.contactEmail}</div>}
      {deal.contactPhone && <div className="text-[11px] text-muted-foreground">{deal.contactPhone}</div>}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-semibold text-foreground">{money(deal.estimatedValue)}</span>
        <span className="flex items-center gap-1">
          {deal.language === "es" && <Languages className="h-3 w-3 text-[var(--color-gold,theme(colors.amber.600))]" />}
          {deal.referralCode && <Badge variant="outline" className="text-[10px]">{deal.referralCode}</Badge>}
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </div>
    </button>
  );
}

// ─── New deal dialog ────────────────────────────────────────────────────────
function NewDealDialog({ lang, affiliateId }: { lang: Lang; affiliateId?: number }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", contactName: "", contactEmail: "", contactPhone: "",
    company: "", location: "", estimatedValue: "", priority: "medium" as CrmPriority,
    language: lang as Lang, notes: "",
  });
  const create = trpc.crm.create.useMutation({
    onSuccess: () => {
      toast.success(lang === "es" ? "Trato creado" : "Deal created");
      utils.crm.board.invalidate();
      setOpen(false);
      setForm({ title: "", contactName: "", contactEmail: "", contactPhone: "", company: "", location: "", estimatedValue: "", priority: "medium", language: lang, notes: "" });
    },
    onError: () => toast.error("Couldn't create deal"),
  });
  function submit() {
    if (!form.title.trim()) { toast.error(lang === "es" ? "El título es obligatorio" : "Title is required"); return; }
    create.mutate({
      title: form.title.trim(),
      contactName: form.contactName || null,
      contactEmail: form.contactEmail || null,
      contactPhone: form.contactPhone || null,
      company: form.company || null,
      location: form.location || null,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
      priority: form.priority,
      language: form.language,
      notes: form.notes || null,
      ...(affiliateId != null ? { affiliateId } : {}),
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[var(--color-navy,#1a2b4a)] text-white"><Plus className="h-4 w-4 mr-1" />{L(lang).newDeal}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{L(lang).newDeal}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label={lang === "es" ? "Título" : "Title"}>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={lang === "es" ? "Remodelación de cocina — J. Rivera" : "Kitchen remodel — J. Rivera"} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "es" ? "Contacto" : "Contact"}><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
            <Field label={lang === "es" ? "Empresa" : "Company"}><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
            <Field label={lang === "es" ? "Teléfono" : "Phone"}><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
            <Field label={lang === "es" ? "Ubicación / ZIP" : "Location / ZIP"}><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label={lang === "es" ? "Valor estimado" : "Estimated value"}><Input type="number" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} /></Field>
            <Field label={lang === "es" ? "Prioridad" : "Priority"}>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as CrmPriority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["low", "medium", "high"] as CrmPriority[]).map((p) => <SelectItem key={p} value={p}>{CRM_PRIORITY_LABELS[p][lang]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={lang === "es" ? "Idioma del cliente" : "Customer language"}>
              <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v as Lang })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={lang === "es" ? "Notas" : "Notes"}><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={create.isPending} className="bg-[var(--color-navy,#1a2b4a)] text-white">
            {create.isPending ? "…" : (lang === "es" ? "Crear" : "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function CustomerListImportDialog({ lang, affiliateId }: { lang: Lang; affiliateId?: number }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CrmCustomerImportRow[]>([]);
  const [preflightSkipped, setPreflightSkipped] = useState<CrmCustomerImportSkippedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<{ imported: number; skipped: CrmCustomerImportSkippedRow[] } | null>(null);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const importList = trpc.crm.importCustomerList.useMutation({
    onSuccess: ({ imported, skipped }) => {
      setReport({ imported, skipped: [...preflightSkipped, ...skipped] });
      toast.success(`${imported} customer${imported === 1 ? "" : "s"} added.`);
      utils.crm.board.invalidate();
    },
    onError: (error) => toast.error(error.message || "Couldn't import the customer list"),
  });
  const readFile = (file?: File) => {
    if (!file) return;
    setRows([]); setPreflightSkipped([]); setReport(null); setFileName(file.name);
    setProgress({ value: 5, label: "Reading customer list…" });
    const reader = new FileReader();
    reader.onprogress = (event) => setProgress({
      value: crmCustomerFileReadProgress(event.loaded, event.total),
      label: "Reading customer list…",
    });
    reader.onload = () => {
      setProgress({ value: 90, label: "Parsing customer rows…" });
      window.setTimeout(() => {
        const parsed = parseCrmCustomerListCsv(String(reader.result ?? ""));
        setRows(parsed.rows); setPreflightSkipped(parsed.skipped); setProgress({ value: 100, label: "Preview ready." });
        if (!parsed.rows.length) toast.error("No valid rows found. Include Name plus Email or Phone columns.");
        window.setTimeout(() => setProgress(null), 700);
      }, 0);
    };
    reader.onerror = () => { setProgress(null); toast.error("Could not read that customer list."); };
    reader.readAsText(file);
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CRM_CUSTOMER_LIST_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cabinetdealz-customer-import-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="bg-card"><Upload className="h-4 w-4 mr-1" />Customer list</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Import customer list</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm text-muted-foreground">Upload a CSV exported from Excel, Google Sheets, or another CRM. Supported columns: Name, Email, Phone, Company, City/ZIP, and Notes. The original file stays on your device; only previewed customer records are sent.</p><Button type="button" size="sm" variant="outline" onClick={downloadTemplate}><Download className="h-3.5 w-3.5 mr-1" />Download sample CSV</Button></div>
        <Input type="file" accept=".csv,text/csv" onChange={(event) => readFile(event.target.files?.[0])} />
        {progress && <div className="space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{progress.label}</span><span>{progress.value}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Customer list upload and parsing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.value}>
            <div className="h-full rounded-full bg-[var(--color-gold,#d4a64a)] transition-[width] duration-200 ease-out" style={{ width: `${progress.value}%` }} />
          </div>
        </div>}
        {fileName && <p className="text-xs text-muted-foreground">{fileName}: {rows.length} ready{preflightSkipped.length ? ` · ${preflightSkipped.length} row${preflightSkipped.length === 1 ? "" : "s"} skipped before import` : ""}</p>}
        {rows.length > 0 && <div className="max-h-56 overflow-auto rounded border border-border">
          <table className="w-full text-sm"><thead className="sticky top-0 bg-muted text-left"><tr><th className="p-2">Customer</th><th className="p-2">Email / phone</th><th className="p-2">Company</th></tr></thead>
            <tbody>{rows.slice(0, 100).map((row, index) => <tr key={`${row.contactEmail ?? row.contactPhone}-${index}`} className="border-t border-border"><td className="p-2">{row.contactName}</td><td className="p-2">{row.contactEmail ?? row.contactPhone}</td><td className="p-2">{row.company ?? "—"}</td></tr>)}</tbody>
          </table>
        </div>}
        {report && <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2" role="status">
          <p className="font-semibold text-sm">Import report</p>
          <p className="text-sm"><strong>{report.imported}</strong> customer{report.imported === 1 ? "" : "s"} imported. <strong>{report.skipped.length}</strong> skipped.</p>
          {report.skipped.length > 0 ? <ul className="max-h-32 overflow-auto space-y-1 text-xs text-muted-foreground">{report.skipped.map((row, index) => <li key={`${row.rowNumber}-${index}`}><strong className="text-foreground">Row {row.rowNumber}: {row.contactName}</strong> — {row.reason}</li>)}</ul> : <p className="text-xs text-muted-foreground">No rows were skipped.</p>}
        </div>}
        <DialogFooter>{report ? <Button onClick={() => { setOpen(false); setRows([]); setPreflightSkipped([]); setFileName(""); setReport(null); }}>Close</Button> : <Button disabled={!rows.length || importList.isPending} onClick={() => importList.mutate({ rows, ...(affiliateId != null ? { affiliateId } : {}) })} className="bg-[var(--color-navy,#1a2b4a)] text-white">{importList.isPending ? "Importing…" : `Import ${rows.length || ""} customer${rows.length === 1 ? "" : "s"}`}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import leads dialog ──────────────────────────────────────────────────────
function ImportLeadsDialog({ lang }: { lang: Lang }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = trpc.crm.importableLeads.useQuery(undefined, { enabled: open });
  const importLead = trpc.crm.importLead.useMutation({
    onSuccess: () => {
      toast.success(lang === "es" ? "Prospecto importado" : "Lead imported");
      utils.crm.board.invalidate();
      utils.crm.importableLeads.invalidate();
    },
    onError: () => toast.error("Couldn't import lead"),
  });
  const reqs = data?.orderRequests ?? [];
  const apps = data?.proApplications ?? [];
  const nothing = !isLoading && reqs.length === 0 && apps.length === 0;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-card"><Inbox className="h-4 w-4 mr-1" />{L(lang).importLeads}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{L(lang).importLeads}</DialogTitle></DialogHeader>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : nothing ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {lang === "es" ? "No hay prospectos nuevos para importar." : "No new leads to import."}
          </p>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {reqs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{lang === "es" ? "Solicitudes de pedido" : "Order requests"}</p>
                <div className="space-y-2">
                  {reqs.map((r: { id: number; requestNumber: string; originatorName: string | null; totalAmount: string | null }) => (
                    <div key={r.id} className="flex items-center justify-between rounded border border-border p-2">
                      <div className="text-sm">
                        <div className="font-medium text-foreground">{r.requestNumber}</div>
                        <div className="text-xs text-muted-foreground">{r.originatorName ?? "—"} · {money(r.totalAmount)}</div>
                      </div>
                      <Button size="sm" variant="outline" disabled={importLead.isPending} onClick={() => importLead.mutate({ type: "order_request", id: r.id })}>
                        {lang === "es" ? "Importar" : "Import"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {apps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{lang === "es" ? "Solicitudes de profesionales" : "Pro applications"}</p>
                <div className="space-y-2">
                  {apps.map((a: { id: number; companyName: string; contactName: string }) => (
                    <div key={a.id} className="flex items-center justify-between rounded border border-border p-2">
                      <div className="text-sm">
                        <div className="font-medium text-foreground">{a.companyName}</div>
                        <div className="text-xs text-muted-foreground">{a.contactName}</div>
                      </div>
                      <Button size="sm" variant="outline" disabled={importLead.isPending} onClick={() => importLead.mutate({ type: "pro_application", id: a.id })}>
                        {lang === "es" ? "Importar" : "Import"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Deal detail drawer ───────────────────────────────────────────────────────
function DealDrawer({ dealId, lang, onClose }: { dealId: number | null; lang: Lang; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data } = trpc.crm.deal.useQuery({ id: dealId! }, { enabled: dealId != null });
  const [note, setNote] = useState("");
  const addActivity = trpc.crm.addActivity.useMutation({
    onSuccess: () => { setNote(""); utils.crm.deal.invalidate({ id: dealId! }); utils.crm.board.invalidate(); },
    onError: () => toast.error("Couldn't add note"),
  });
  const updateStage = trpc.crm.moveStage.useMutation({
    onSuccess: () => { utils.crm.deal.invalidate({ id: dealId! }); utils.crm.board.invalidate(); },
  });
  const remove = trpc.crm.remove.useMutation({
    onSuccess: () => { toast.success(lang === "es" ? "Trato eliminado" : "Deal removed"); utils.crm.board.invalidate(); onClose(); },
  });
  const updateDeal = trpc.crm.update.useMutation({
    onSuccess: () => { utils.crm.deal.invalidate({ id: dealId! }); utils.crm.board.invalidate(); },
    onError: () => toast.error("Update failed"),
  });
  const setLaborEstimate = trpc.crm.setLaborEstimate.useMutation({
    onSuccess: () => {
      utils.crm.deal.invalidate({ id: dealId! });
      utils.crm.board.invalidate();
      toast.success(lang === "es" ? "Mano de obra actualizada" : "Labor selection updated");
    },
    onError: (error) => toast.error(error.message || (lang === "es" ? "No se pudo actualizar la mano de obra" : "Couldn't update labor selection")),
  });

  const { data: linkable } = trpc.crm.linkableDesigns.useQuery({ dealId: dealId ?? undefined }, { enabled: dealId != null });
  const [designToLink, setDesignToLink] = useState<string>("");
  const linkDesign = trpc.crm.linkDesign.useMutation({
    onSuccess: (r) => {
      setDesignToLink("");
      utils.crm.deal.invalidate({ id: dealId! });
      toast.success(r?.alreadyLinked ? (lang === "es" ? "Ya estaba vinculado" : "Already linked") : (lang === "es" ? "Dise\u00f1o vinculado" : "Design linked"));
    },
    onError: () => toast.error(lang === "es" ? "No se pudo vincular" : "Couldn't link design"),
  });
  const unlinkDesign = trpc.crm.unlinkDesign.useMutation({
    onSuccess: () => utils.crm.deal.invalidate({ id: dealId! }),
    onError: () => toast.error(lang === "es" ? "No se pudo desvincular" : "Couldn't unlink"),
  });

  const deal = data?.deal as DealRow | undefined;
  const activities = (data?.activities ?? []) as { id: number; kind: string; body: string; createdAt: string | Date }[];
  const linkedDesigns = (data?.linkedDesigns ?? []) as LinkedInvoiceDesign[];
  const invoiceBrand = (data as { invoiceBrand?: CrmQuickInvoiceBrand } | undefined)?.invoiceBrand;
  const invoicePrefill = (data as { invoicePrefill?: CrmInvoicePrefill } | undefined)?.invoicePrefill;
  const laborEstimates = (data?.laborEstimates ?? []) as CrmLaborEstimate[];
  const emails = (data?.emails ?? []) as {
    id: number; toEmail: string; fromEmail: string; subject: string; body: string;
    sentByName: string | null; sentAt: string | Date;
  }[];
  const linkedIds = new Set(linkedDesigns.map((l) => l.designId));
  const availableDesigns = (linkable ?? []).filter((d) => !linkedIds.has(d.id));
  const selectedLaborEstimateIsEligible = Boolean(deal?.laborEstimateId && laborEstimates.some((estimate) => estimate.id === deal.laborEstimateId));

  return (
    <Sheet open={dealId != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {deal ? (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{deal.contactName || deal.company || deal.title}</SheetTitle>
              <p className="text-xs text-muted-foreground">{deal.title}</p>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Select value={deal.stage} onValueChange={(v) => updateStage.mutate({ id: deal.id, stage: v as CrmStage })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRM_STAGES.map((s) => <SelectItem key={s} value={s}>{CRM_STAGE_LABELS[s][lang]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className={`text-xs font-medium px-2 py-1 rounded ${priorityColor[deal.priority]}`}>{CRM_PRIORITY_LABELS[deal.priority][lang]}</span>
                {deal.language === "es" && <Badge variant="outline"><Languages className="h-3 w-3 mr-1" />ES</Badge>}
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
                {deal.contactName && <div>{deal.contactName}</div>}
                {deal.contactEmail && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><a className="text-primary hover:underline" href={`mailto:${deal.contactEmail}`}>{deal.contactEmail}</a></div>}
                {deal.contactPhone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><a className="text-primary hover:underline" href={`tel:${deal.contactPhone}`}>{deal.contactPhone}</a></div>}
                {deal.company && <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{deal.company}</div>}
                {deal.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{deal.location}</div>}
                <div className="flex items-center gap-2 font-semibold pt-1"><CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />{money(deal.estimatedValue)}</div>
                {(deal.designValue != null || deal.shippingQuote != null) && (
                  <div className="rounded-md bg-muted/40 p-2 text-xs space-y-0.5" data-testid="crm-design-pricing">
                    <div className="flex justify-between"><span>{lang === "es" ? "Precio del diseño" : "Kitchen design price"}</span><span className="font-semibold">{money(deal.designValue ?? null)}</span></div>
                    <div className="flex justify-between"><span>{lang === "es" ? "Envío" : "Shipping"}</span><span className="font-semibold">{deal.shippingQuote != null ? money(deal.shippingQuote) : (lang === "es" ? "Pendiente" : "Pending")}</span></div>
                    <div className="flex justify-between border-t border-border pt-0.5"><span>{lang === "es" ? "Total" : "Total"}</span><span className="font-semibold">{money(deal.estimatedValue)}</span></div>
                    {deal.designSyncedAt && <div className="text-[11px] text-muted-foreground">{lang === "es" ? "Guardado" : "Saved"} {new Date(deal.designSyncedAt).toLocaleDateString()}</div>}
                  </div>
                )}
                {deal.shippingAddress && (
                  <div className="flex items-start gap-2 text-xs" data-testid="crm-shipping-address">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                    <span>{deal.shippingAddress}{" "}
                      <Badge variant="outline" className={deal.shippingAddressVerified ? "border-emerald-500 text-emerald-700" : "border-amber-500 text-amber-700"}>
                        {deal.shippingAddressVerified ? (lang === "es" ? "Dirección verificada" : "Address verified") : (lang === "es" ? "Sin verificar" : "Not verified")}
                      </Badge>
                    </span>
                  </div>
                )}
                {deal.notes && <p className="text-xs text-muted-foreground pt-1 whitespace-pre-wrap">{deal.notes}</p>}
              </div>

              {linkedDesigns[0] && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{lang === "es" ? "Diseñador / diseño guardado" : "Designer / saved design"}</p>
                  <a href={linkedDesigns[0].designUrl} className="text-sm font-semibold text-primary hover:underline">{linkedDesigns[0].designName}</a>
                  <p className="text-[11px] text-muted-foreground">{linkedDesigns[0].creatorStoreName} · {deal.contactEmail || deal.contactPhone || "Unique customer contact"}</p>
                </div>
              )}

              {deal.source === "verified_plan_image_request" && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 space-y-2">
                  <div className="font-semibold flex items-center gap-1.5"><Image className="h-4 w-4" />Manual AI Image Review</div>
                  <p className="text-xs">This verified request belongs in Image Review. Open the locked saved plan below, then use Operations → Manual AI Renders to attach the finished image.</p>
                  <a href="/admin?tab=manual-ai-renders" className="inline-flex text-xs font-semibold underline">Open Manual AI Renders</a>
                </div>
              )}

              {/* Activity timeline */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{lang === "es" ? "Actividad" : "Activity"}</p>
                <div className="flex gap-2 mb-3">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={lang === "es" ? "Agregar nota…" : "Add a note…"} onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) addActivity.mutate({ dealId: deal.id, body: note.trim() }); }} />
                  <Button variant="outline" disabled={!note.trim() || addActivity.isPending} onClick={() => addActivity.mutate({ dealId: deal.id, body: note.trim() })}>{lang === "es" ? "Agregar" : "Add"}</Button>
                </div>
                <div className="space-y-2">
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{lang === "es" ? "Sin actividad todavía." : "No activity yet."}</p>
                  ) : activities.map((a) => (
                    <div key={a.id} className="text-xs border-l-2 border-border pl-3 py-0.5">
                      <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                      <span className="ml-2 uppercase text-[10px] tracking-wide text-muted-foreground">{a.kind}</span>
                      <p className="text-foreground">{a.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email the contact */}
              <EmailSection deal={deal} lang={lang} emails={emails} dealId={deal.id} linkedDesigns={linkedDesigns} />

              {/* Linked designs */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{lang === "es" ? "Dise\u00f1os vinculados" : "Linked Designs"}</p>
                <div className="flex gap-2 mb-3">
                  <Select value={designToLink} onValueChange={setDesignToLink}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder={availableDesigns.length ? (lang === "es" ? "Elegir un dise\u00f1o guardado\u2026" : "Choose a saved design\u2026") : (lang === "es" ? "Sin dise\u00f1os guardados" : "No saved designs")} /></SelectTrigger>
                    <SelectContent>
	                  {availableDesigns.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name} · {d.creatorStoreName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" disabled={!designToLink || linkDesign.isPending} onClick={() => linkDesign.mutate({ dealId: deal.id, designId: Number(designToLink) })}>{lang === "es" ? "Vincular" : "Attach"}</Button>
                </div>
                <div className="space-y-2">
                  {linkedDesigns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{lang === "es" ? "Ning\u00fan dise\u00f1o vinculado." : "No designs linked yet."}</p>
                  ) : linkedDesigns.map((l) => (
	                  <div key={l.id} className="flex items-center justify-between gap-3 text-sm border border-border rounded-md px-3 py-2">
	                    <div className="min-w-0">
	                      <a href={l.designUrl} className="text-primary hover:underline truncate block">{l.designName}</a>
	                      <p className="text-[11px] text-muted-foreground truncate">
                        {l.creatorStoreName} · Saved {new Date(l.designCreatedAt).toLocaleDateString()} · Value {money(l.designOrderValue)}
	                        {l.selectedStyleId ? ` · Style #${l.selectedStyleId}` : ""}
	                        {Array.isArray(l.selectedSurfaces) && l.selectedSurfaces.length > 0 ? ` · ${l.selectedSurfaces.length} surface selection${l.selectedSurfaces.length === 1 ? "" : "s"}` : ""}
	                      </p>
	                      <p className="text-[11px] text-muted-foreground" data-testid="crm-design-created">
                        {lang === "es" ? "Creado" : "Created"} {new Date(l.designCreatedAt).toLocaleString()}
                      </p>
                      <details className="text-[11px] text-muted-foreground" data-testid="crm-design-views">
                        <summary className="cursor-pointer">
                          {(l.viewCount ?? 0) === 0
                            ? (lang === "es" ? "Aún sin vistas" : "Not viewed yet")
                            : `${lang === "es" ? "Vistas" : "Viewed"} ${l.viewCount}× · ${lang === "es" ? "última" : "last"} ${new Date(l.lastViewedAt as string).toLocaleString()}`}
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                          {(l.recentViews ?? []).map((v, i) => (
                            <li key={i}>{new Date(v.viewedAt).toLocaleString()} — {v.viewerName || (lang === "es" ? "Visitante" : "Visitor")} ({v.viewerKind})</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                      <button className="text-muted-foreground hover:text-red-600 shrink-0 ml-2" onClick={() => unlinkDesign.mutate({ dealId: deal.id, linkId: l.id })} aria-label="Unlink design"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <Label htmlFor="crm-labor-estimate" className="text-xs font-semibold text-muted-foreground">{lang === "es" ? "Mano de obra" : "Labor"}</Label>
                <Select
                  value={selectedLaborEstimateIsEligible && deal.laborEstimateId != null ? String(deal.laborEstimateId) : "none"}
                  onValueChange={(value) => setLaborEstimate.mutate({ dealId: deal.id, laborEstimateId: value === "none" ? null : Number(value) })}
                  disabled={setLaborEstimate.isPending || (laborEstimates.length === 0 && deal.laborEstimateId == null)}
                >
                  <SelectTrigger id="crm-labor-estimate" className="mt-1.5"><SelectValue placeholder={lang === "es" ? "Sin mano de obra seleccionada" : "No labor selected"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{lang === "es" ? "No incluir mano de obra" : "Do not include labor"}</SelectItem>
                    {laborEstimates.map((estimate) => (
                      <SelectItem key={estimate.id} value={String(estimate.id)}>
                        {lang === "es" ? "Estimado de mano de obra" : "Labor estimate"} #{estimate.id} · {money(String(estimate.totalAmount))} · {estimate.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {laborEstimates.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{lang === "es" ? "No hay estimados de mano de obra elegibles para este cliente o pedido." : "No eligible labor estimate is linked to this customer or order."}</p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{lang === "es" ? "La selección se agrega como una línea de mano de obra separada en el total de la factura PDF." : "The selection is added as a separate Labor line in the consolidated PDF invoice total."}</p>
                )}
                {deal.laborEstimateId != null && !selectedLaborEstimateIsEligible && <p className="mt-1.5 text-[11px] text-amber-700">{lang === "es" ? "El estimado seleccionado ya no está disponible; elija otro o elimine la selección." : "The selected labor estimate is no longer available; choose another or clear the selection."}</p>}
              </div>

              <QuickInvoiceDialog deal={deal} dealId={deal.id} linkedDesigns={linkedDesigns} brand={invoiceBrand} prefill={invoicePrefill} lang={lang} />

              <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => remove.mutate({ id: deal.id })} disabled={remove.isPending}>
                <Trash2 className="h-4 w-4 mr-1" />{lang === "es" ? "Eliminar trato" : "Delete deal"}
              </Button>

              <div className="space-y-2" role="group" aria-label={lang === "es" ? "Tipos de ayuda necesarios" : "Help needed"}>
                <p className="text-xs font-semibold text-muted-foreground">{lang === "es" ? "Ayuda necesaria" : "Help needed"}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={deal.needsHelpClosing ? "default" : "outline"}
                    className={deal.needsHelpClosing ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-200 text-red-600 hover:bg-red-50"}
                    onClick={() => updateDeal.mutate({ id: deal.id, needsHelpClosing: !deal.needsHelpClosing })}
                    disabled={updateDeal.isPending}
                    aria-pressed={Boolean(deal.needsHelpClosing)}
                  >
                    {deal.needsHelpClosing
                      ? (lang === "es" ? "Ayuda para cerrar solicitada" : "Closing Help Requested")
                      : (lang === "es" ? "Solicitar ayuda para cerrar" : "Request Help Closing")}
                  </Button>
                  <Button
                    variant={deal.needsHelpDesigning ? "default" : "outline"}
                    className={deal.needsHelpDesigning ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"}
                    onClick={() => updateDeal.mutate({ id: deal.id, needsHelpDesigning: !deal.needsHelpDesigning })}
                    disabled={updateDeal.isPending}
                    aria-pressed={Boolean(deal.needsHelpDesigning)}
                  >
                    {deal.needsHelpDesigning
                      ? (lang === "es" ? "Ayuda de diseño solicitada" : "Design Help Requested")
                      : (lang === "es" ? "Solicitar ayuda de diseño" : "Request Design Help")}
                  </Button>
                  <Button
                    variant={deal.needsHelpShipping ? "default" : "outline"}
                    className={deal.needsHelpShipping ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-amber-200 text-amber-800 hover:bg-amber-50"}
                    onClick={() => updateDeal.mutate({ id: deal.id, needsHelpShipping: !deal.needsHelpShipping })}
                    disabled={updateDeal.isPending}
                    aria-pressed={Boolean(deal.needsHelpShipping)}
                  >
                    {deal.needsHelpShipping
                      ? (lang === "es" ? "Ayuda de costos de envío solicitada" : "Shipping Cost Help Requested")
                      : (lang === "es" ? "Solicitar ayuda de costos de envío" : "Request Shipping Cost Help")}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3 mt-6"><Skeleton className="h-8" /><Skeleton className="h-24" /></div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function QuickInvoiceDialog({
  deal,
  dealId,
  linkedDesigns,
  brand,
  prefill,
  lang,
}: {
  deal: DealRow;
  dealId: number;
  linkedDesigns: LinkedInvoiceDesign[];
  brand?: CrmQuickInvoiceBrand;
  prefill?: CrmInvoicePrefill;
  lang: Lang;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const hasPricedLinkedPlan = Number(linkedDesigns[0]?.catalogSubtotal ?? 0) > 0;
  const [cabinetOrder, setCabinetOrder] = useState({ enabled: Number(prefill?.cabinetOrderAmount ?? 0) > 0 && !hasPricedLinkedPlan, amount: prefill?.cabinetOrderAmount?.toString() ?? "" });
  const [kitchenDesign, setKitchenDesign] = useState({ enabled: Number(linkedDesigns[0]?.catalogSubtotal ?? 0) > 0, amount: linkedDesigns[0]?.catalogSubtotal?.toString() ?? "" });
  const [shipping, setShipping] = useState({ enabled: Number(prefill?.shippingAmount ?? 0) >= 0 && prefill?.shippingAmount != null, amount: prefill?.shippingAmount?.toString() ?? "" });
  const [labor, setLabor] = useState({ enabled: Number(prefill?.laborAmount ?? 0) > 0, amount: prefill?.laborAmount?.toString() ?? "" });
  const [selectedDesignId, setSelectedDesignId] = useState<string>(linkedDesigns[0] ? String(linkedDesigns[0].id) : "none");
  const [notes, setNotes] = useState("");
  const [previewLines, setPreviewLines] = useState<CrmQuickInvoiceLine[] | null>(null);

  useEffect(() => {
    const nextHasPricedLinkedPlan = Number(linkedDesigns[0]?.catalogSubtotal ?? 0) > 0;
    setCabinetOrder({ enabled: Number(prefill?.cabinetOrderAmount ?? 0) > 0 && !nextHasPricedLinkedPlan, amount: prefill?.cabinetOrderAmount?.toString() ?? "" });
    setKitchenDesign({ enabled: Number(linkedDesigns[0]?.catalogSubtotal ?? 0) > 0, amount: linkedDesigns[0]?.catalogSubtotal?.toString() ?? "" });
    setShipping({ enabled: Number(prefill?.shippingAmount ?? 0) >= 0 && prefill?.shippingAmount != null, amount: prefill?.shippingAmount?.toString() ?? "" });
    setLabor({ enabled: Number(prefill?.laborAmount ?? 0) > 0, amount: prefill?.laborAmount?.toString() ?? "" });
    setSelectedDesignId(linkedDesigns[0] ? String(linkedDesigns[0].id) : "none");
    setNotes("");
    setPreviewLines(null);
  }, [deal.id, linkedDesigns.length, linkedDesigns[0]?.id, linkedDesigns[0]?.catalogSubtotal, prefill?.cabinetOrderAmount, prefill?.shippingAmount, prefill?.laborAmount]);

  const addActivity = trpc.crm.addActivity.useMutation({
    onSuccess: () => utils.crm.deal.invalidate({ id: dealId }),
  });
  const { data: emailReadiness } = trpc.crm.emailReadiness.useQuery(undefined, { enabled: open && previewLines != null });
  const sendInvoiceEmail = trpc.crm.sendInvoiceEmail.useMutation({
    onSuccess: () => {
      toast.success(label("Branded invoice PDF emailed to the customer.", "La factura PDF personalizada se envió al cliente."));
      utils.crm.deal.invalidate({ id: dealId });
      utils.crm.board.invalidate();
      setPreviewLines(null);
      setOpen(false);
    },
    onError: (error) => {
      const message = error.message;
      if (message === "missing_recipient") toast.error(label("Add a customer email to this lead before sending the invoice.", "Agregue un correo electrónico del cliente antes de enviar la factura."));
      else if (message === "not_configured" || message === "disabled") toast.error(CRM_EMAIL_BLOCK_MESSAGES[message][lang]);
      else toast.error(message || label("Could not send the invoice email.", "No se pudo enviar el correo de la factura."));
    },
  });
  const selectedDesign = linkedDesigns.find((design) => String(design.id) === selectedDesignId) ?? null;
  const label = (english: string, spanish: string) => lang === "es" ? spanish : english;

  function lineFor(enabled: boolean, description: string, amount: string): CrmQuickInvoiceLine | null {
    if (!enabled) return null;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return { description, amount: parsed };
  }

  function collectLines(): CrmQuickInvoiceLine[] {
    const selectedDesignCharge = lineFor(
      kitchenDesign.enabled,
      selectedDesign ? `${label("Kitchen Design", "Diseño de cocina")} — ${selectedDesign.designName}` : label("Kitchen Design", "Diseño de cocina"),
      kitchenDesign.amount,
    );
    const includedMaterials = selectedDesignCharge && selectedDesign
      ? selectedDesign.materialLines.map((line) => ({
        description: `${label("Included material", "Material incluido")} · ${line.quantity} × ${line.description}`,
        amount: 0,
        kind: "included" as const,
      }))
      : [];
    return [
      lineFor(cabinetOrder.enabled, label("Cabinet Order", "Pedido de gabinetes"), cabinetOrder.amount),
      selectedDesignCharge,
      lineFor(shipping.enabled, label("Shipping", "Envío"), shipping.amount),
      lineFor(labor.enabled, label("Labor", "Mano de obra"), labor.amount),
      ...includedMaterials,
    ].filter((line): line is CrmQuickInvoiceLine => line !== null);
  }

  function chooseLinkedDesign(nextId: string) {
    setSelectedDesignId(nextId);
    const nextDesign = linkedDesigns.find((design) => String(design.id) === nextId);
    setKitchenDesign({
      enabled: Number(nextDesign?.catalogSubtotal ?? 0) > 0,
      amount: nextDesign?.catalogSubtotal?.toString() ?? "",
    });
  }

  function openPreview() {
    const lines = collectLines();
    if (!lines.length) {
      toast.error(label("Select at least one service and enter a valid amount.", "Seleccione al menos un servicio e ingrese un importe válido."));
      return;
    }
    setPreviewLines(lines);
  }

  function createInvoice() {
    const lines = previewLines ?? collectLines();
    if (!lines.length) return;
    const now = new Date();
    const opened = openCrmQuickInvoicePdf({
      invoiceNumber: `CRM-${dealId}-${now.toISOString().slice(0, 10).replaceAll("-", "")}`,
      issuedOn: now.toLocaleDateString(),
      customerName: deal.contactName || deal.company || deal.title,
      customerEmail: deal.contactEmail,
      customerPhone: deal.contactPhone,
      linkedDesignName: selectedDesign?.designName ?? null,
      notes: notes.trim() || null,
      lines,
      brand,
    });
    if (!opened) {
      toast.error(label("Your browser blocked the PDF window. Please allow pop-ups and try again.", "El navegador bloqueó la ventana de PDF. Permita ventanas emergentes e inténtelo de nuevo."));
      return;
    }
    addActivity.mutate({
      dealId,
      kind: "note",
      body: `Quick PDF invoice prepared: ${lines.map((line) => line.description).join(", ")}${selectedDesign ? ` · Linked design: ${selectedDesign.designName}` : ""}.`,
    });
    toast.success(label("Invoice opened. Use Print / Save as PDF to finish.", "Factura abierta. Use Imprimir / Guardar como PDF para finalizar."));
    setPreviewLines(null);
    setOpen(false);
  }

  function emailInvoice() {
    if (!previewLines?.length) return;
    sendInvoiceEmail.mutate({
      dealId,
      lines: previewLines,
      linkedDesignId: selectedDesign?.id ?? null,
      notes: notes.trim() || null,
    });
  }

  const ServiceRow = ({ id, title, state, setState, source, emptyAmountLabel }: {
    id: string;
    title: string;
    state: { enabled: boolean; amount: string };
    setState: (state: { enabled: boolean; amount: string }) => void;
    source?: string | null;
    emptyAmountLabel?: string;
  }) => (
    <div className="rounded-md border border-border p-2.5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_7rem] items-center gap-2">
        <Checkbox id={id} checked={state.enabled} onCheckedChange={(checked) => setState({ ...state, enabled: checked === true })} />
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">{title}</Label>
        <Input aria-label={`${title} amount`} type="number" min="0" step="0.01" placeholder={emptyAmountLabel ?? "$0.00"} value={state.amount} onChange={(event) => setState({ ...state, amount: event.target.value })} disabled={!state.enabled} />
      </div>
      {source && <p className="mt-1 pl-8 text-[11px] text-muted-foreground">{label("Imported from ", "Importado de ")}{source}</p>}
    </div>
  );

  const invoiceTotal = crmQuickInvoiceTotal(previewLines ?? []);
  const formatMoney = (amount: number) => amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
  const smtpReady = emailReadiness?.configured && emailReadiness.enabled;
  const customerEmail = deal.contactEmail?.trim();

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setPreviewLines(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full bg-card"><FileText className="mr-2 h-4 w-4" />{label("Quick PDF Invoice", "Factura PDF rápida")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{label("Quick PDF Invoice", "Factura PDF rápida")}</DialogTitle></DialogHeader>
        {previewLines ? (
          <>
            <p className="text-sm text-muted-foreground">{label("Review and adjust every price before the final PDF is generated.", "Revise y ajuste cada precio antes de generar el PDF final.")}</p>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3 bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground"><span>{label("Line item", "Concepto")}</span><span>{label("Price", "Precio")}</span></div>
              <div className="divide-y divide-border">
                {previewLines.map((line, index) => (
                  <div key={`${line.description}-${index}`} className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-3 px-3 py-2.5">
                    <span className="text-sm font-medium">{line.description}</span>
                    {line.kind === "included" ? <span className="text-right text-xs font-medium text-muted-foreground">{label("Included", "Incluido")}</span> : <Input aria-label={`${line.description} final price`} type="number" min="0" step="0.01" value={line.amount} onChange={(event) => {
                      const amount = Math.max(0, Number(event.target.value) || 0);
                      setPreviewLines((current) => current?.map((entry, entryIndex) => entryIndex === index ? { ...entry, amount } : entry) ?? current);
                    }} />}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-muted/30 px-3 py-3 text-sm font-bold"><span>{label("Invoice total", "Total de la factura")}</span><span>{formatMoney(invoiceTotal)}</span></div>
            </div>
            {selectedDesign && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"><strong>{label("Linked design:", "Diseño vinculado:")}</strong> {selectedDesign.designName}</div>}
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"><strong className="text-foreground">{brand?.storeName ?? "Cabinet Dealz"}</strong>{brand?.logoUrl ? label(" logo and colors will appear on both the PDF and customer email.", " aparecerán con su logo y colores en el PDF y el correo al cliente.") : label(" branding will appear on both the PDF and customer email.", " aparecerá en el PDF y el correo al cliente.")}</div>
            <DialogFooter className="gap-2 sm:justify-between"><Button variant="outline" onClick={() => setPreviewLines(null)}>{label("Back to selections", "Volver a selecciones")}</Button><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={emailInvoice} disabled={!customerEmail || !smtpReady || sendInvoiceEmail.isPending}><Mail className="mr-2 h-4 w-4" />{sendInvoiceEmail.isPending ? label("Sending…", "Enviando…") : label("Email PDF to Customer", "Enviar PDF al cliente")}</Button><Button onClick={createInvoice} disabled={addActivity.isPending} className="bg-[var(--color-navy,#1a2b4a)] text-white"><FileText className="mr-2 h-4 w-4" />{label("Generate Final PDF", "Generar PDF final")}</Button></div></DialogFooter>
            {!customerEmail && <p className="text-xs text-amber-700">{label("Add the customer email to this lead to enable direct invoice delivery.", "Agregue el correo del cliente a este prospecto para habilitar el envío directo.")}</p>}
            {customerEmail && !smtpReady && <p className="text-xs text-amber-700">{label("Configure and enable CRM email to send the PDF directly.", "Configure y habilite el correo CRM para enviar el PDF directamente.")}</p>}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{label("Select the parts of this lead to bill. You will review and edit the prices before opening the final PDF.", "Seleccione las partes de este prospecto para facturar. Podrá revisar y editar los precios antes de abrir el PDF final.")}</p>
            {linkedDesigns[0] && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <span className="font-semibold">{label("Customer design:", "Diseño del cliente:")}</span> {linkedDesigns[0].designName}
              </div>
            )}
            <div className="space-y-2">
              <ServiceRow id="invoice-cabinet-order" title={label("Cabinet Order", "Pedido de gabinetes")} state={cabinetOrder} setState={setCabinetOrder} source={prefill?.cabinetOrderSource} />
              <ServiceRow id="invoice-kitchen-design" title={selectedDesign ? `${label("Kitchen Design", "Diseño de cocina")} — ${selectedDesign.designName}` : label("Kitchen Design", "Diseño de cocina")} state={kitchenDesign} setState={setKitchenDesign} source={selectedDesign?.catalogSubtotalSource} emptyAmountLabel={label("Not priced", "Sin precio")} />
              {selectedDesign && !kitchenDesign.enabled && (
                <p className="-mt-1 px-1 text-[11px] text-amber-700">
                  {label("This plan needs a verified cart/order subtotal before it can be invoiced. ", "Este plano necesita un subtotal verificado de carrito/pedido antes de facturarse. ")}
	              <a className="font-semibold underline underline-offset-2" href={selectedDesign.designUrl}>{label("Open plan to prepare the order", "Abrir plano para preparar el pedido")}</a>
                </p>
              )}
              <ServiceRow id="invoice-shipping" title={label("Shipping", "Envío")} state={shipping} setState={setShipping} source={prefill?.shippingSource} emptyAmountLabel={label("Quote required", "Cotización requerida")} />
              {prefill?.shippingNote && <p className="-mt-1 px-1 text-[11px] text-amber-700">{prefill.shippingNote}</p>}
              <ServiceRow id="invoice-labor" title={label("Labor", "Mano de obra")} state={labor} setState={setLabor} source={prefill?.laborSource} />
            </div>
            <Field label={label("Linked design (optional)", "Diseño vinculado (opcional)")}>
              <Select value={selectedDesignId} onValueChange={chooseLinkedDesign}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{label("No linked design", "Sin diseño vinculado")}</SelectItem>
                  {linkedDesigns.map((design) => <SelectItem key={design.id} value={String(design.id)}>{design.designName}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={label("Invoice notes (optional)", "Notas de la factura (opcional)")}>
              <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={label("Scope, payment terms, or next steps", "Alcance, condiciones de pago o próximos pasos")} />
            </Field>
            <DialogFooter><Button onClick={openPreview} className="bg-[var(--color-navy,#1a2b4a)] text-white"><FileText className="mr-2 h-4 w-4" />{label("Preview Invoice", "Vista previa de factura")}</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Email the deal contact ───────────────────────────────────────────────────
function EmailSection({
  deal,
  lang,
  emails,
  dealId,
  linkedDesigns = [],
}: {
  linkedDesigns?: LinkedInvoiceDesign[];
  deal: DealRow;
  lang: Lang;
  emails: {
    id: number; toEmail: string; fromEmail: string; subject: string; body: string;
    sentByName: string | null; sentAt: string | Date;
  }[];
  dealId: number;
}) {
  const utils = trpc.useUtils();
  const { data: readiness } = trpc.crm.emailReadiness.useQuery();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(deal.contactEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const configured = readiness?.configured ?? false;
  const enabled = readiness?.enabled ?? false;
  const blockReason = crmEmailBlockedReason({ configured, enabled });
  const canSend = blockReason == null;

  // Keep the To field synced with the deal's contact email when a new deal opens.
  const [seededFor, setSeededFor] = useState<number | null>(null);
  if (seededFor !== dealId) {
    setSeededFor(dealId);
    setTo(deal.contactEmail ?? "");
    setSubject("");
    setBody("");
  }

  const send = trpc.crm.sendEmail.useMutation({
    onSuccess: () => {
      toast.success(lang === "es" ? "Correo enviado" : "Email sent");
      setOpen(false);
      setSubject("");
      setBody("");
      utils.crm.deal.invalidate({ id: dealId });
      utils.crm.emailLog.invalidate({ dealId });
      utils.crm.board.invalidate();
    },
    onError: (e) => {
      // The server returns "not_configured" / "disabled" for guard failures.
      const raw = e.message;
      if (raw === "not_configured" || raw === "disabled") {
        toast.error(CRM_EMAIL_BLOCK_MESSAGES[raw][lang]);
      } else {
        toast.error(raw || (lang === "es" ? "No se pudo enviar" : "Couldn't send email"));
      }
    },
  });

  function submit() {
    const t = to.trim();
    if (!t) { toast.error(lang === "es" ? "Falta el destinatario" : "Recipient is required"); return; }
    if (!subject.trim()) { toast.error(lang === "es" ? "Falta el asunto" : "Subject is required"); return; }
    if (!body.trim()) { toast.error(lang === "es" ? "El mensaje está vacío" : "Message is empty"); return; }
    send.mutate({ dealId, to: t, subject: subject.trim(), body: body.trim() });
  }

  const heading = lang === "es" ? "Correo" : "Email";
  const sentLabel = lang === "es" ? "Enviados" : "Sent";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground">{heading}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="bg-card h-7">
              <Send className="h-3.5 w-3.5 mr-1" />
              {lang === "es" ? "Enviar correo" : "Send email"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{lang === "es" ? "Enviar correo" : "Send email"}</DialogTitle>
            </DialogHeader>

            {!canSend ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p>{CRM_EMAIL_BLOCK_MESSAGES[blockReason!][lang]}</p>
                    <a
                      href="/admin?tab=email-settings"
                      className="mt-2 inline-flex items-center gap-1 font-medium text-amber-900 underline"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {lang === "es" ? "Abrir Configuración de correo" : "Open Email Settings"}
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {readiness?.from && (
                  <p className="text-xs text-muted-foreground">
                    {lang === "es" ? "Desde" : "From"}: <span className="font-medium text-foreground">{readiness.from}</span>
                  </p>
                )}
                <Field label={lang === "es" ? "Para" : "To"}>
                  <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" type="email" />
                </Field>
                <Field label={lang === "es" ? "Asunto" : "Subject"}>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </Field>
                {linkedDesigns[0] && (
                  <Button type="button" variant="outline" size="sm" className="justify-self-start" data-testid="crm-email-insert-design"
                    onClick={() => {
                      const d = linkedDesigns[0];
                      const link = d.designUrl.startsWith("http") ? d.designUrl : `${window.location.origin}${d.designUrl}`;
                      if (!subject.trim()) setSubject(`Your kitchen design: ${d.designName}`);
                      setBody((current) => `${current ? current + "\n\n" : `Hi ${deal.contactName ?? ""},\n\n`}Here is your kitchen design "${d.designName}" (saved ${new Date(d.designCreatedAt).toLocaleDateString()}):\n${link}\n`);
                    }}>
                    {lang === "es" ? "Insertar enlace del diseño" : "Insert design link"}
                  </Button>
                )}
                <Field label={lang === "es" ? "Mensaje" : "Message"}>
                  <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
                </Field>
              </div>
            )}

            <DialogFooter>
              {canSend && (
                <Button onClick={submit} disabled={send.isPending} className="bg-[var(--color-navy,#1a2b4a)] text-white">
                  {send.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="h-4 w-4" />
                      {lang === "es" ? "Enviando…" : "Sending…"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Send className="h-4 w-4" />
                      {lang === "es" ? "Enviar" : "Send"}
                    </span>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sent history */}
      {emails.length === 0 ? (
        <p className="text-xs text-muted-foreground">{lang === "es" ? "Ningún correo enviado aún." : "No emails sent yet."}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{sentLabel} ({emails.length})</p>
          {emails.map((m) => (
            <details key={m.id} className="text-xs rounded-md border border-border bg-card px-3 py-2">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground truncate">{m.subject}</span>
                  <span className="shrink-0 text-muted-foreground">{new Date(m.sentAt).toLocaleDateString()}</span>
                </div>
                <div className="text-muted-foreground truncate">
                  {lang === "es" ? "Para" : "To"}: {m.toEmail}
                </div>
              </summary>
              <div className="mt-2 border-t border-border pt-2 text-muted-foreground">
                <div>{lang === "es" ? "De" : "From"}: {m.fromEmail}</div>
                {m.sentByName && <div>{lang === "es" ? "Enviado por" : "Sent by"}: {m.sentByName}</div>}
                <div>{new Date(m.sentAt).toLocaleString()}</div>
                <p className="mt-2 whitespace-pre-wrap text-foreground">{m.body}</p>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
