import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ShoppingCart,
  Users,
  Package,
  DollarSign,
  Truck,
  Settings,
  Building2,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Hammer,
  Layers,
  Search,
  ExternalLink,
} from "lucide-react";

// Tab content components
import { CrmBoard } from "@/components/crm/CrmBoard";
import AffiliatesAdmin from "@/components/admin/AffiliatesAdmin";
import DistributorImport from "@/components/admin/DistributorImport";
import LineBrandingEditor from "@/components/admin/LineBrandingEditor";
import DistributorFulfillmentEditor from "@/components/admin/DistributorFulfillmentEditor";
import CustomersAdmin from "@/components/admin/CustomersAdmin";
import RolesAdmin from "@/components/admin/RolesAdmin";
import SkuImageManager from "@/components/admin/SkuImageManager";
import FeaturedStylesAdmin from "@/components/admin/FeaturedStylesAdmin";
import ShippingAdmin, { FreightApiLogsPanel, FreightQuoteHistoryPanel } from "@/components/admin/ShippingAdmin";
import CarrierKeysPanel from "@/components/admin/CarrierKeysPanel";
import MarginsAdmin from "@/components/admin/MarginsAdmin";
import DistributorMultipliersAdmin from "@/components/admin/DistributorMultipliersAdmin";
import ConflictsAdmin from "@/components/admin/ConflictsAdmin";
import PayoutsAdmin from "@/components/admin/PayoutsAdmin";
import CostLookupAdmin from "@/components/admin/CostLookupAdmin";
import PaymentsAdmin from "@/components/admin/PaymentsAdmin";
import DesignLeadsAdmin from "@/components/admin/DesignLeadsAdmin";
import DoorCorrectionsAdmin from "@/components/admin/DoorCorrectionsAdmin";
import ConsultationsAdmin from "@/components/admin/ConsultationsAdmin";
import SalesCommissionsAdmin from "@/components/admin/SalesCommissionsAdmin";
import AffiliateInvoicesAdmin from "@/components/admin/AffiliateInvoicesAdmin";
import CabinetSpreadsheetAdmin from "@/components/admin/CabinetSpreadsheetAdmin";
import CabinetLineDownload from "@/components/admin/CabinetLineDownload";
import { PricingAccessAdmin } from "@/components/admin/PricingAccessAdmin";
import { DesignerAvailabilityAdmin } from "@/components/admin/DesignerAvailabilityAdmin";
import EmailSettingsAdmin from "@/components/admin/EmailSettingsAdmin";
import BrandingSettingsAdmin from "@/components/admin/BrandingSettingsAdmin";
import NotificationSettingsAdmin from "@/components/admin/NotificationSettingsAdmin";
import ApiStatusAdmin from "@/components/admin/ApiStatusAdmin";
import QuickBooksAdmin from "@/components/admin/QuickBooksAdmin";
import IncomingOrdersAdmin from "@/components/admin/IncomingOrdersAdmin";
import { DesignerCoverageAdmin } from "@/components/admin/DesignerCoverageAdmin";
import { AdminTabHelp } from "@/components/admin/AdminTabHelp";
import ApprovedVendorsAdmin from "@/components/admin/ApprovedVendorsAdmin";
import PelicanCatalogAdmin from "@/components/admin/PelicanCatalogAdmin";
import { AnalyticsAdmin } from "@/components/admin/AnalyticsAdmin";
import FullDatabaseExport from "@/components/admin/FullDatabaseExport";

import CatalogImporterTab from "@/components/admin/CatalogImporterTab";
import { CabinetConfigAdmin } from "@/components/admin/CabinetConfigAdmin";
import CabinetConfigReviewQueueAdmin from "@/components/admin/CabinetConfigReviewQueueAdmin";
import MasterChangesAdmin from "@/components/admin/MasterChangesAdmin";
import DataRecoveryAdmin from "@/components/admin/DataRecoveryAdmin";
import UnpricedCabinetsAdmin from "@/components/admin/UnpricedCabinetsAdmin";
import DesignerPriceFlagsAdmin from "@/components/admin/DesignerPriceFlagsAdmin";
import PotentialMergesAdmin from "@/components/admin/PotentialMergesAdmin";
import { BannerAdmin } from "@/components/admin/BannerAdmin";
import MasterSkuAdmin from "@/components/admin/MasterSkuAdmin";
import CategoriesAdmin from "@/components/admin/CategoriesAdmin";
import PendingReviewAdmin from "@/components/admin/PendingReviewAdmin";
import PendingDistributorConnectionsAdmin from "@/components/admin/PendingDistributorConnectionsAdmin";
import GenericCabinetsAdmin from "@/components/admin/GenericCabinetsAdmin";
import { BulkDimensionsAdmin } from "@/components/admin/BulkDimensionsAdmin";
import BundleDealsAdmin from "@/components/admin/BundleDealsAdmin";
import PriceShop10x10 from "@/pages/PriceShop10x10";
import MediaLibraryAdmin from "@/components/admin/MediaLibraryAdmin";
import { GeneratedDesignImagesAdmin } from "@/components/admin/GeneratedDesignImagesAdmin";
import AdminStickyNotes from "@/components/admin/AdminStickyNotes";
import GeminiImageProviderAdmin from "@/components/admin/GeminiImageProviderAdmin";
import ElevenLabsOperationsAdmin from "@/components/admin/ElevenLabsOperationsAdmin";
import { ManualAiRenderQueueAdmin } from "@/components/admin/ManualAiRenderQueueAdmin";
import StripePaymentSettingsAdmin from "@/components/admin/StripePaymentSettingsAdmin";
import AffiliateLiteratureAdmin from "@/components/admin/AffiliateLiteratureAdmin";

// ─── Group definitions ────────────────────────────────────────────────────────
const GROUPS = [
  {
    id: "sales",
    label: "Sales & Orders",
    icon: ShoppingCart,
    tabs: [
      { value: "orders", label: "Incoming Orders" },
      { value: "crm", label: "Sales CRM" },
      { value: "consultations", label: "Consultations" },
      { value: "design-leads", label: "Design Leads" },
      { value: "quotes", label: "Countertop Quotes" },
      { value: "payments", label: "Payments" },
    ],
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    tabs: [
      { value: "customers", label: "Customers" },
      { value: "roles", label: "Roles" },
      { value: "affiliates", label: "Affiliates" },
      { value: "affiliate-invoices", label: "Affiliate Invoices" },
      { value: "payouts", label: "Payouts" },
      { value: "commissions", label: "Sales Commissions" },
      { value: "pros", label: "Pro Applications" },
      { value: "vendors", label: "Vendors" },
      { value: "approved-vendors", label: "Approved Vendors" },
    ],
  },
  {
    id: "catalog",
    label: "Products & Catalog",
    icon: Package,
    tabs: [
      { value: "cabinets", label: "Catalog" },
      { value: "distributors", label: "Distributors" },
      { value: "glass-policy", label: "Glass Policy" },
      { value: "catalog-importer", label: "📥 Catalog Importer" },
      { value: "featured", label: "Featured Styles" },
      { value: "door-corrections", label: "Door Corrections" },
      { value: "images", label: "Product Images" },
      { value: "pelican-catalog", label: "Pelican Catalog" },
      { value: "conflicts", label: "Conflicts" },
      { value: "merge-suggestions", label: "Merge Suggestions" },
      { value: "master-sku", label: "Master SKU Aliases" },
      { value: "cabinet-config", label: "Cabinet Config" },
      { value: "master-changes", label: "Master Changes" },
      { value: "data-recovery", label: "🛟 Data Recovery" },
      { value: "package-data", label: "📦 Package Data & Parcel" },
      { value: "cabinet-attention", label: "⚠ Cabinet Attention" },
      { value: "unpriced-items", label: "⚠ Unpriced Items" },
      { value: "designer-price-flags", label: "🚩 Designer Price Flags" },
      { value: "categories", label: "Categories" },
      { value: "pending-review", label: "⏳ Pending Review" },
      { value: "pending-distributor-connections", label: "✎ Supplier Products" },
      { value: "bundle-deals", label: "📦 Kitchen Packages" },
      { value: "price-shop-10x10", label: "10×10 Price Shop" },
      { value: "media-library", label: "📁 Media Library" },
      { value: "generated-design-images", label: "✨ Generated Design Images" },
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    icon: DollarSign,
    tabs: [
      { value: "multipliers", label: "Multipliers" },
      { value: "margins", label: "Pricing & Margins" },
      { value: "cost-lookup", label: "Price Audit" },
      { value: "pricing-access", label: "Pricing Access" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Truck,
    tabs: [
      { value: "shipping", label: "Shipping" },
      { value: "coverage", label: "Designer Coverage" },
      { value: "designer-availability", label: "Designer Availability" },
      { value: "gemini-image-provider", label: "AI Image Provider" },
      { value: "elevenlabs-operations", label: "ElevenLabs Audio" },
      { value: "manual-ai-renders", label: "Manual AI Renders" },
      { value: "team-notes", label: "Team Notes" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    tabs: [
      { value: "stripe-payment", label: "Stripe Payment" },
      { value: "email-settings", label: "Email Settings" },
      { value: "banners", label: "Banner Management" },
      { value: "branding", label: "Site Branding" },
      { value: "notifications", label: "Notifications" },
      { value: "quickbooks", label: "QuickBooks" },
      { value: "api-status", label: "API Status" },
      { value: "analytics", label: "Analytics" },
      { value: "export", label: "Full Export" },
      { value: "affiliate-literature", label: "Affiliate Literature" },
    ],
  },
] as const;

// Build a lookup from tab value → group id
const TAB_TO_GROUP: Record<string, string> = {};
for (const g of GROUPS) {
  for (const t of g.tabs) {
    TAB_TO_GROUP[t.value] = g.id;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved" || status === "won") return "default";
  if (status === "rejected" || status === "lost") return "destructive";
  if (status === "quoted") return "secondary";
  return "outline";
}

// ─── Inline sub-components (moved from Admin.tsx) ─────────────────────────────

function ProApplications() {
  const utils = trpc.useUtils();
  const { data: apps, isLoading, error, refetch } = trpc.pros.adminList.useQuery();
  const setStatus = trpc.pros.adminSetStatus.useMutation({
    onSuccess: () => {
      utils.pros.adminList.invalidate();
      toast.success("Application updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  if (error) return <div className="text-center py-12 space-y-3"><p className="text-destructive">Couldn't load applications: {error.message}</p><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>;
  if (!apps || apps.length === 0) return <div className="text-center py-12 text-muted-foreground">No pro applications yet. Share the <a href="/pro-network" className="text-primary underline">Join Our Pro Network</a> page to start receiving applications.</div>;

  return (
    <div className="space-y-4">
      {apps.map((a: any) => (
        <Card key={a.id}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{a.companyName}</span>
                  <Badge variant={statusVariant(a.status)} className="capitalize">{a.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>{a.contactName}</span>
                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {a.email}</span>
                  {a.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {a.phone}</span>}
                  {a.baseZip && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {a.baseZip} · {a.serviceRadiusMiles}mi</span>}
                  {a.insured && <span className="inline-flex items-center gap-1 text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" /> Insured</span>}
                  {a.website && <a href={a.website.startsWith("http") ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Website</a>}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(a.trades ?? []).map((t: string) => (
                    <Badge key={t} variant="outline" className="gap-1">
                      {t === "installation" ? <Hammer className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
                      {t === "installation" ? "Installation" : "Fabrication"}
                    </Badge>
                  ))}
                  {(a.materials ?? []).map((m: string) => <Badge key={m} variant="secondary">{m}</Badge>)}
                </div>
                {a.serviceZips && a.serviceZips.length > 0 && <div className="text-xs text-muted-foreground">ZIPs: {a.serviceZips.join(", ")}</div>}
                {a.notes && <p className="text-sm text-muted-foreground pt-1">{a.notes}</p>}
              </div>
              <div className="flex md:flex-col gap-2 shrink-0">
                <Button size="sm" disabled={a.status === "approved" || setStatus.isPending} onClick={() => setStatus.mutate({ id: a.id, status: "approved" })} className="bg-emerald-600 hover:bg-emerald-700 text-white">Approve</Button>
                <Button size="sm" variant="outline" disabled={a.status === "rejected" || setStatus.isPending} onClick={() => setStatus.mutate({ id: a.id, status: "rejected" })}>Reject</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function VendorApplications() {
  const utils = trpc.useUtils();
  const { data: apps, isLoading, error, refetch } = trpc.vendor.adminList.useQuery();
  const setStatus = trpc.vendor.adminSetStatus.useMutation({
    onSuccess: () => {
      utils.vendor.adminList.invalidate();
      toast.success("Vendor application updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  if (error) return <div className="text-center py-12 space-y-3"><p className="text-destructive">Couldn't load vendor applications: {error.message}</p><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>;
  if (!apps || apps.length === 0) return <div className="text-center py-12 text-muted-foreground">No vendor applications yet. Share the <a href="/become-a-vendor" className="text-primary underline">Become a Vendor</a> page to start receiving applications.</div>;

  return (
    <div className="space-y-4">
      {apps.map((a: any) => (
        <Card key={a.id}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{a.companyName}</span>
                  <Badge variant={statusVariant(a.status)} className="capitalize">{a.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>{a.contactName}</span>
                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {a.email}</span>
                  {a.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {a.phone}</span>}
                  {a.headquarters && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {a.headquarters}</span>}
                  {a.website && <a href={a.website.startsWith("http") ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Website</a>}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {a.categories && a.categories.split(",").map((c: string) => c.trim()).filter(Boolean).map((c: string) => (
                    <Badge key={c} className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90">{c}</Badge>
                  ))}
                  {a.productLines && <Badge variant="secondary">{a.productLines}</Badge>}
                  {a.doorStyleCount != null && <Badge variant="outline">{a.doorStyleCount} door styles</Badge>}
                  {a.leadTimeDays != null && <Badge variant="outline">{a.leadTimeDays}-day lead</Badge>}
                  {a.offersTradePricing && <Badge variant="outline" className="gap-1 text-emerald-600"><DollarSign className="h-3 w-3" /> Trade pricing</Badge>}
                  {a.hasCatalogImages && <Badge variant="outline" className="gap-1"><Layers className="h-3 w-3" /> Has images/specs</Badge>}
                </div>
                {a.message && <p className="text-sm text-muted-foreground pt-1">{a.message}</p>}
              </div>
              <div className="flex md:flex-col gap-2 shrink-0">
                <Button size="sm" disabled={a.status === "approved" || setStatus.isPending} onClick={() => setStatus.mutate({ id: a.id, status: "approved" })} className="bg-emerald-600 hover:bg-emerald-700 text-white">Approve</Button>
                <Button size="sm" variant="outline" disabled={a.status === "rejected" || setStatus.isPending} onClick={() => setStatus.mutate({ id: a.id, status: "rejected" })}>Reject</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CountertopQuotes() {
  const utils = trpc.useUtils();
  const { data: quotes, isLoading, error, refetch } = trpc.design.listCountertopQuotes.useQuery();
  const [matchZip, setMatchZip] = useState("");
  const [activeQuoteId, setActiveQuoteId] = useState<number | null>(null);
  const update = trpc.design.updateCountertopQuote.useMutation({
    onSuccess: () => { utils.design.listCountertopQuotes.invalidate(); toast.success("Quote updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  if (error) return <div className="text-center py-12 space-y-3"><p className="text-destructive">Couldn't load quotes: {error.message}</p><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>;
  if (!quotes || quotes.length === 0) return <div className="text-center py-12 text-muted-foreground">No countertop quote requests yet.</div>;

  return (
    <div className="space-y-4">
      {quotes.map((q: any) => (
        <Card key={q.id}>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{q.contactEmail}</span>
                <Badge variant={statusVariant(q.status)} className="capitalize">{q.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {Number(q.squareFeet).toFixed(1)} sq ft · {Number(q.linearFeet).toFixed(1)} lin ft
                {q.hasIsland ? " · island" : ""}
                {q.material ? ` · ${q.material}` : ""}
                {q.zip ? ` · ZIP ${q.zip}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="number" placeholder="Quoted price" className="w-40" defaultValue={q.quotedPrice ? Number(q.quotedPrice) : undefined} id={`qp-${q.id}`} />
              <Button size="sm" variant="outline" onClick={() => { const el = document.getElementById(`qp-${q.id}`) as HTMLInputElement | null; const price = el?.value ? Number(el.value) : undefined; update.mutate({ id: q.id, status: "quoted", quotedPrice: price }); }}>Save Quote</Button>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: q.id, status: "won" })}>Mark Won</Button>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: q.id, status: "lost" })}>Mark Lost</Button>
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => { setActiveQuoteId(activeQuoteId === q.id ? null : q.id); setMatchZip(q.zip ?? ""); }}>
                <Search className="h-3.5 w-3.5 mr-1" /> Find Pros
              </Button>
            </div>
            {q.quotedPrice && (
              <div className="text-sm rounded-md bg-muted px-3 py-2">
                Quoted: <strong>${Number(q.quotedPrice).toLocaleString()}</strong> · Est. platform fee (15%): <strong>${(Number(q.quotedPrice) * 0.15).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              </div>
            )}
            {activeQuoteId === q.id && <ProMatcher zip={matchZip} onZipChange={setMatchZip} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProMatcher({ zip, onZipChange }: { zip: string; onZipChange: (z: string) => void }) {
  const [search, setSearch] = useState(zip);
  const { data: matches, isFetching } = trpc.pros.matchByArea.useQuery(
    { zip: search, trade: "countertop_fabrication" },
    { enabled: search.length >= 3 }
  );

  return (
    <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <Input value={search} onChange={(e) => { setSearch(e.target.value); onZipChange(e.target.value); }} placeholder="ZIP to match fabricators" className="w-48" />
        {isFetching && <Spinner className="h-4 w-4 text-primary" />}
      </div>
      {search.length >= 3 && matches && matches.length === 0 && <p className="text-sm text-muted-foreground">No approved fabricators cover this ZIP yet.</p>}
      {matches && matches.length > 0 && (
        <ul className="space-y-2">
          {matches.map((p: any) => (
            <li key={p.id} className="text-sm flex items-center justify-between gap-2">
              <span><strong>{p.companyName}</strong> — {p.contactName} · {p.email}{p.phone ? ` · ${p.phone}` : ""}</span>
              <Badge variant="outline">{p.baseZip ?? "—"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminGroupedTabs() {
  const initialTab = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "crm";
  }, []);

  const initialGroup = TAB_TO_GROUP[initialTab] || "sales";

  const [activeGroup, setActiveGroup] = useState(initialGroup);
  const [activeTab, setActiveTab] = useState(initialTab);

  const currentGroup = GROUPS.find((g) => g.id === activeGroup)!;

  const handleGroupChange = (groupId: string) => {
    setActiveGroup(groupId);
    const group = GROUPS.find((g) => g.id === groupId)!;
    const firstTab = group.tabs[0].value;
    setActiveTab(firstTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", firstTab);
    window.history.replaceState({}, "", url.toString());
  };

  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabValue);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="space-y-4">
      {/* Group buttons row */}
      <div className="flex flex-wrap gap-2">
        {GROUPS.map((g) => {
          const Icon = g.icon;
          const isActive = g.id === activeGroup;
          return (
            <Button
              key={g.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className={cn(
                "gap-2 transition-all",
                isActive && "bg-[var(--color-navy)] text-white shadow-md"
              )}
              onClick={() => handleGroupChange(g.id)}
            >
              <Icon className="h-4 w-4" />
              {g.label}
            </Button>
          );
        })}
      </div>

      {/* Sub-tabs for the active group */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className={currentGroup.id === "settings" ? "lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6" : undefined}
      >
        <TabsList className={cn(
          "h-auto w-full gap-y-1",
          currentGroup.id === "settings"
            ? "grid grid-cols-2 sm:grid-cols-3 lg:flex lg:w-full lg:flex-col lg:items-stretch lg:justify-start lg:gap-1 lg:bg-muted/50 lg:p-2"
            : "flex-wrap justify-start",
        )}>
          {currentGroup.tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className={currentGroup.id === "settings" ? "justify-start px-3" : undefined}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className={currentGroup.id === "settings" ? "min-w-0" : undefined}>
        {/* Sales & Orders */}
        <TabsContent value="orders" className="mt-6"><AdminTabHelp tab="orders" /><IncomingOrdersAdmin /></TabsContent>
        <TabsContent value="crm" className="mt-6"><AdminTabHelp tab="crm" /><CrmBoard lang="en" /></TabsContent>
        <TabsContent value="consultations" className="mt-6"><AdminTabHelp tab="consultations" /><ConsultationsAdmin /></TabsContent>
        <TabsContent value="design-leads" className="mt-6"><AdminTabHelp tab="design-leads" /><DesignLeadsAdmin /></TabsContent>
        <TabsContent value="quotes" className="mt-6"><AdminTabHelp tab="quotes" /><CountertopQuotes /></TabsContent>
        <TabsContent value="payments" className="mt-6"><AdminTabHelp tab="payments" /><PaymentsAdmin /></TabsContent>

        {/* People */}
        <TabsContent value="customers" className="mt-6"><AdminTabHelp tab="customers" /><CustomersAdmin /></TabsContent>
        <TabsContent value="roles" className="mt-6"><AdminTabHelp tab="roles" /><RolesAdmin /></TabsContent>
        <TabsContent value="affiliates" className="mt-6"><AdminTabHelp tab="affiliates" /><AffiliatesAdmin /></TabsContent>
        <TabsContent value="affiliate-invoices" className="mt-6"><AdminTabHelp tab="affiliate-invoices" /><AffiliateInvoicesAdmin /></TabsContent>
        <TabsContent value="payouts" className="mt-6"><AdminTabHelp tab="payouts" /><PayoutsAdmin /></TabsContent>
        <TabsContent value="commissions" className="mt-6"><AdminTabHelp tab="commissions" /><SalesCommissionsAdmin /></TabsContent>
        <TabsContent value="pros" className="mt-6"><AdminTabHelp tab="pros" /><ProApplications /></TabsContent>
        <TabsContent value="vendors" className="mt-6"><AdminTabHelp tab="vendors" /><VendorApplications /></TabsContent>
        <TabsContent value="approved-vendors" className="mt-6"><ApprovedVendorsAdmin /></TabsContent>

        {/* Products & Catalog */}
        <TabsContent value="cabinets" className="mt-6 space-y-8"><AdminTabHelp tab="cabinets" /><GenericCabinetsAdmin /><CabinetSpreadsheetAdmin /><CabinetLineDownload /></TabsContent>
        <TabsContent value="distributors" className="mt-6 space-y-6"><AdminTabHelp tab="distributors" /><LineBrandingEditor /><DistributorFulfillmentEditor /><DistributorImport /></TabsContent>
        <TabsContent value="glass-policy" className="mt-6"><AdminTabHelp tab="glass-policy" /><DistributorFulfillmentEditor glassOnly /></TabsContent>
        <TabsContent value="catalog-importer" className="mt-6"><CatalogImporterTab /></TabsContent>
        <TabsContent value="featured" className="mt-6"><AdminTabHelp tab="featured" /><FeaturedStylesAdmin /></TabsContent>
        <TabsContent value="door-corrections" className="mt-6"><AdminTabHelp tab="door-corrections" /><DoorCorrectionsAdmin /></TabsContent>
        <TabsContent value="images" className="mt-6"><AdminTabHelp tab="images" /><SkuImageManager /></TabsContent>
        <TabsContent value="pelican-catalog" className="mt-6"><PelicanCatalogAdmin /></TabsContent>
        <TabsContent value="conflicts" className="mt-6"><AdminTabHelp tab="conflicts" /><ConflictsAdmin /></TabsContent>
        <TabsContent value="merge-suggestions" className="mt-6"><PotentialMergesAdmin /></TabsContent>
        <TabsContent value="master-sku" className="mt-6"><MasterSkuAdmin /></TabsContent>
        <TabsContent value="cabinet-config" className="mt-6"><CabinetConfigAdmin /></TabsContent>
        <TabsContent value="master-changes" className="mt-6"><MasterChangesAdmin /></TabsContent>
        <TabsContent value="data-recovery" className="mt-6"><DataRecoveryAdmin /></TabsContent>
        <TabsContent value="package-data" className="mt-6"><BulkDimensionsAdmin /></TabsContent>
        <TabsContent value="cabinet-attention" className="mt-6"><CabinetConfigReviewQueueAdmin /></TabsContent>
        <TabsContent value="unpriced-items" className="mt-6"><UnpricedCabinetsAdmin /></TabsContent>
        <TabsContent value="designer-price-flags" className="mt-6"><DesignerPriceFlagsAdmin /></TabsContent>
        <TabsContent value="categories" className="mt-6"><CategoriesAdmin /></TabsContent>
        <TabsContent value="pending-review" className="mt-6"><PendingReviewAdmin /></TabsContent>
        <TabsContent value="pending-distributor-connections" className="mt-6"><PendingDistributorConnectionsAdmin /></TabsContent>
        <TabsContent value="bundle-deals" className="mt-6"><BundleDealsAdmin /></TabsContent>
        <TabsContent value="price-shop-10x10" className="mt-6"><PriceShop10x10 /></TabsContent>
        <TabsContent value="media-library" className="mt-6"><MediaLibraryAdmin /></TabsContent>
        <TabsContent value="generated-design-images" className="mt-6"><GeneratedDesignImagesAdmin /></TabsContent>

        {/* Pricing */}
        <TabsContent value="multipliers" className="mt-6"><DistributorMultipliersAdmin /></TabsContent>
        <TabsContent value="margins" className="mt-6"><AdminTabHelp tab="margins" /><MarginsAdmin /></TabsContent>
        <TabsContent value="cost-lookup" className="mt-6"><AdminTabHelp tab="cost-lookup" /><CostLookupAdmin /></TabsContent>
        <TabsContent value="pricing-access" className="mt-6"><AdminTabHelp tab="pricing-access" /><PricingAccessAdmin /></TabsContent>

        {/* Operations */}
        <TabsContent value="shipping" className="mt-6"><AdminTabHelp tab="shipping" /><div className="mb-6"><CarrierKeysPanel /></div><ShippingAdmin /><div className="mt-6"><FreightApiLogsPanel /><FreightQuoteHistoryPanel /></div></TabsContent>
        <TabsContent value="coverage" className="mt-6"><AdminTabHelp tab="coverage" /><DesignerCoverageAdmin /></TabsContent>
        <TabsContent value="designer-availability" className="mt-6"><AdminTabHelp tab="designer-availability" /><DesignerAvailabilityAdmin /></TabsContent>
        <TabsContent value="gemini-image-provider" className="mt-6"><GeminiImageProviderAdmin /></TabsContent>
        <TabsContent value="elevenlabs-operations" className="mt-6"><ElevenLabsOperationsAdmin /></TabsContent>
        <TabsContent value="manual-ai-renders" className="mt-6"><ManualAiRenderQueueAdmin /></TabsContent>
        <TabsContent value="team-notes" className="mt-6"><AdminStickyNotes /></TabsContent>

        {/* Settings */}
        <TabsContent value="banners" className="mt-6"><BannerAdmin /></TabsContent>
        <TabsContent value="stripe-payment" className="mt-6"><StripePaymentSettingsAdmin /></TabsContent>
        <TabsContent value="email-settings" className="mt-6"><AdminTabHelp tab="email-settings" /><EmailSettingsAdmin /></TabsContent>
        <TabsContent value="branding" className="mt-6"><AdminTabHelp tab="branding" /><BrandingSettingsAdmin /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><AdminTabHelp tab="notifications" /><NotificationSettingsAdmin /></TabsContent>
        <TabsContent value="quickbooks" className="mt-6"><QuickBooksAdmin /></TabsContent>
        <TabsContent value="api-status" className="mt-6"><ApiStatusAdmin /></TabsContent>
        <TabsContent value="analytics" className="mt-6"><AnalyticsAdmin /></TabsContent>
        <TabsContent value="export" className="mt-6"><FullDatabaseExport /></TabsContent>
        <TabsContent value="affiliate-literature" className="mt-6"><AdminTabHelp tab="affiliate-literature" /><AffiliateLiteratureAdmin /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
