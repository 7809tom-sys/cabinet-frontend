import { useEffect, useState, useMemo, type ReactNode } from "react";
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
import AffiliatePricingTiersAdmin from "@/components/admin/AffiliatePricingTiersAdmin";
import DistributorImport from "@/components/admin/DistributorImport";
import LineBrandingEditor from "@/components/admin/LineBrandingEditor";
import DistributorFulfillmentEditor from "@/components/admin/DistributorFulfillmentEditor";
import CustomersAdmin from "@/components/admin/CustomersAdmin";
import ImageGenerationsAdmin from "@/components/admin/ImageGenerationsAdmin";
import CrmCleanupAdmin from "@/components/admin/CrmCleanupAdmin";
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
import DoorRenderingAuditAdmin from "@/components/admin/DoorRenderingAuditAdmin";
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
import { CATALOG_SECTIONS, canonicalAdminTab, catalogLeaves, resolveCatalogTab } from "@/components/admin/catalogAdminTabs";
import ApprovedVendorsAdmin from "@/components/admin/ApprovedVendorsAdmin";
import VendorReferralsAdmin from "@/components/admin/VendorReferralsAdmin";
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
import StripeInvoicesAdmin from "@/components/admin/StripeInvoicesAdmin";
import AffiliateLiteratureAdmin from "@/components/admin/AffiliateLiteratureAdmin";
import AffiliateResourcesAdmin from "@/components/admin/AffiliateResourcesAdmin";
import SalesForecastAdmin from "@/components/admin/SalesForecastAdmin";
import VendorUpdatesAdmin from "@/components/admin/VendorUpdatesAdmin";
import VendorInventoryAdmin from "@/components/admin/VendorInventoryAdmin";
import VendorOnboardingAdmin from "@/components/admin/VendorOnboardingAdmin";
import { SampleOrderDesk } from "@/components/samples/SampleOrderDesk";
import KitchenRulesAdmin from "@/components/admin/KitchenRulesAdmin";
import ContractorAccessAdmin from "@/components/admin/ContractorAccessAdmin";
import { AdminTabErrorBoundary } from "@/components/admin/AdminTabErrorBoundary";

// ─── Group definitions ────────────────────────────────────────────────────────
const GROUPS = [
  {
    id: "sales",
    label: "Sales & Orders",
    icon: ShoppingCart,
    tabs: [
      { value: "orders", label: "Incoming Orders" },
      { value: "sales-forecast", label: "Sales Forecast" },
      { value: "sample-orders", label: "Sample Orders" },
      { value: "vendor-updates", label: "Vendor Updates" },
      { value: "vendor-inventory", label: "Vendor Inventory" },
      { value: "crm", label: "Sales CRM" },
      { value: "consultations", label: "Consultations" },
      { value: "design-leads", label: "Design Leads" },
      { value: "quotes", label: "Countertop Quotes" },
      { value: "payments", label: "Payments" },
      { value: "stripe-invoices", label: "Stripe Invoices" },
    ],
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    tabs: [
      { value: "customers", label: "Customers" },
      { value: "image-generations", label: "Image Generations" },
      { value: "crm-cleanup", label: "CRM Cleanup" },
      { value: "roles", label: "Roles" },
      { value: "affiliates", label: "Affiliates" },
      { value: "affiliate-invoices", label: "Affiliate Invoices" },
      { value: "payouts", label: "Payouts" },
      { value: "commissions", label: "Sales Commissions" },
      { value: "pros", label: "Pro Applications" },
      { value: "contractor-access", label: "Contractor Access" },
      { value: "vendors", label: "Vendors" },
      { value: "approved-vendors", label: "Approved Vendors" },
      { value: "vendor-referrals", label: "Vendor Referrals" },
    ],
  },
  {
    id: "catalog",
    label: "Products & Catalog",
    icon: Package,
    tabs: CATALOG_SECTIONS.map((section) => ({ value: section.id, label: section.label })),
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
      { value: "affiliate-tiers", label: "Affiliate Tiers" },
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
      { value: "kitchen-rules", label: "Kitchen Rules" },
      { value: "export", label: "Full Export" },
      { value: "affiliate-literature", label: "Affiliate Literature" },
      { value: "affiliate-resources", label: "Affiliate Resources" },
    ],
  },
];

// Build a lookup from tab value → group id.
// Catalog leaves keep their historical ?tab= values even though the visible
// row is the shorter section list.
const TAB_TO_GROUP: Record<string, string> = {};
for (const g of GROUPS) {
  for (const t of g.tabs) {
    TAB_TO_GROUP[t.value] = g.id;
  }
}
for (const leaf of catalogLeaves()) {
  TAB_TO_GROUP[leaf.value] = "catalog";
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

function PendingVendorCount({ compact = false }: { compact?: boolean }) {
  const review = trpc.vendors.pendingReview.useQuery(undefined, { refetchOnWindowFocus: false });
  const count = review.data?.count;
  if (count == null) return null;
  return (
    <Badge
      variant={count > 0 ? "default" : "secondary"}
      className={compact ? "ml-1 h-5 min-w-5 px-1.5" : "h-5 min-w-5 px-1.5"}
      data-testid="admin-pending-vendor-count"
    >
      {count}
    </Badge>
  );
}

function CatalogSubTabs({
  sectionId,
  activeTab,
  onSelect,
  children,
}: {
  sectionId: string;
  activeTab: string;
  onSelect: (value: string) => void;
  children: ReactNode;
}) {
  const section = CATALOG_SECTIONS.find((item) => item.id === sectionId);
  if (!section) return null;
  const leaves = catalogLeaves(section);
  const value = leaves.some((leaf) => leaf.value === activeTab) ? activeTab : leaves[0]?.value;
  if (!value) return null;
  return (
    <Tabs value={value} onValueChange={onSelect}>
      <div className="space-y-3" data-testid={`catalog-subtabs-${section.id}`}>
        {section.groups.map((group) => (
          <div key={group.label || section.id} className="space-y-1.5">
            {group.label ? (
              <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
            ) : null}
            <TabsList className="flex h-auto w-full max-w-full flex-wrap justify-start gap-y-1">
              {group.leaves.map((leaf) => (
                <TabsTrigger key={leaf.value} value={leaf.value}>
                  {leaf.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        ))}
      </div>
      {children}
    </Tabs>
  );
}

export default function AdminGroupedTabs() {
  const initialTab = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return canonicalAdminTab(params.get("tab") || "crm");
  }, []);

  const initialGroup = TAB_TO_GROUP[initialTab] || "sales";

  const [activeGroup, setActiveGroup] = useState(initialGroup);
  const [activeTab, setActiveTab] = useState(initialTab);

  const currentGroup = GROUPS.find((g) => g.id === activeGroup)!;
  const inbox = trpc.vendorInventory.inboxCount.useQuery();

  const selectTab = (tabValue: string) => {
    const next = canonicalAdminTab(tabValue);
    setActiveTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url.toString());
  };

  // A section id such as ?tab=door-styles opens that section's first editor
  // and the address bar keeps the leaf value those links already used.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("tab");
    if (!raw) return;
    const next = canonicalAdminTab(raw);
    if (next === raw) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url.toString());
  }, []);

  const handleGroupChange = (groupId: string) => {
    setActiveGroup(groupId);
    const group = GROUPS.find((g) => g.id === groupId)!;
    selectTab(group.tabs[0].value);
  };

  const outerTabValue = currentGroup.id === "catalog"
    ? (resolveCatalogTab(activeTab)?.sectionId ?? CATALOG_SECTIONS[0].id)
    : activeTab;

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
              {g.id === "people" && <PendingVendorCount />}
            </Button>
          );
        })}
      </div>

      {/* Sub-tabs for the active group */}
      <Tabs
        value={outerTabValue}
        onValueChange={selectTab}
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
              {t.value === "approved-vendors" && <PendingVendorCount compact />}
              {t.value === "vendor-updates" && (inbox.data?.unread ?? 0) > 0 && (
                <Badge className="ml-1">{inbox.data?.unread}</Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className={currentGroup.id === "settings" ? "min-w-0" : undefined}>
        {/* Sales & Orders */}
        <TabsContent value="orders" className="mt-6"><AdminTabErrorBoundary tabName="Incoming Orders"><AdminTabHelp tab="orders" /><IncomingOrdersAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="sales-forecast" className="mt-6"><AdminTabErrorBoundary tabName="Sales Forecast"><SalesForecastAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="sample-orders" className="mt-6"><AdminTabErrorBoundary tabName="Sample Orders"><SampleOrderDesk mode="admin" /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="vendor-updates" className="mt-6"><AdminTabErrorBoundary tabName="Vendor Updates"><VendorUpdatesAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="vendor-inventory" className="mt-6"><AdminTabErrorBoundary tabName="Vendor Inventory"><VendorInventoryAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="crm" className="mt-6"><AdminTabErrorBoundary tabName="Sales CRM"><AdminTabHelp tab="crm" /><CrmBoard lang="en" /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="consultations" className="mt-6"><AdminTabErrorBoundary tabName="Consultations"><AdminTabHelp tab="consultations" /><ConsultationsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="design-leads" className="mt-6"><AdminTabErrorBoundary tabName="Design Leads"><AdminTabHelp tab="design-leads" /><DesignLeadsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="quotes" className="mt-6"><AdminTabErrorBoundary tabName="Countertop Quotes"><AdminTabHelp tab="quotes" /><CountertopQuotes /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="payments" className="mt-6"><AdminTabErrorBoundary tabName="Payments"><AdminTabHelp tab="payments" /><PaymentsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="stripe-invoices" className="mt-6"><AdminTabErrorBoundary tabName="Stripe Invoices"><AdminTabHelp tab="stripe-invoices" /><StripeInvoicesAdmin /></AdminTabErrorBoundary></TabsContent>

        {/* People */}
        <TabsContent value="customers" className="mt-6"><AdminTabErrorBoundary tabName="Customers"><AdminTabHelp tab="customers" /><CustomersAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="image-generations" className="mt-6"><AdminTabErrorBoundary tabName="Image Generations"><ImageGenerationsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="crm-cleanup" className="mt-6"><AdminTabErrorBoundary tabName="CRM Cleanup"><AdminTabHelp tab="crm-cleanup" /><CrmCleanupAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="roles" className="mt-6"><AdminTabErrorBoundary tabName="Roles"><AdminTabHelp tab="roles" /><RolesAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="affiliates" className="mt-6"><AdminTabErrorBoundary tabName="Affiliates"><AdminTabHelp tab="affiliates" /><AffiliatesAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="affiliate-invoices" className="mt-6"><AdminTabErrorBoundary tabName="Affiliate Invoices"><AdminTabHelp tab="affiliate-invoices" /><AffiliateInvoicesAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="payouts" className="mt-6"><AdminTabErrorBoundary tabName="Payouts"><AdminTabHelp tab="payouts" /><PayoutsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="commissions" className="mt-6"><AdminTabErrorBoundary tabName="Sales Commissions"><AdminTabHelp tab="commissions" /><SalesCommissionsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="pros" className="mt-6"><AdminTabErrorBoundary tabName="Pro Applications"><AdminTabHelp tab="pros" /><ProApplications /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="contractor-access" className="mt-6"><AdminTabErrorBoundary tabName="Contractor Access"><ContractorAccessAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="vendors" className="mt-6"><AdminTabErrorBoundary tabName="Vendors"><AdminTabHelp tab="vendors" /><VendorApplications /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="approved-vendors" className="mt-6"><AdminTabErrorBoundary tabName="Approved Vendors"><ApprovedVendorsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="vendor-referrals" className="mt-6"><AdminTabErrorBoundary tabName="Vendor Referrals"><VendorReferralsAdmin /></AdminTabErrorBoundary></TabsContent>

        {/* Products & Catalog. Single-purpose editors stay on the top row.
            Grouped editors keep their original ?tab= value as an inner tab. */}
        <TabsContent value="cabinets" className="mt-6 space-y-8"><AdminTabErrorBoundary tabName="Catalog"><AdminTabHelp tab="cabinets" /><GenericCabinetsAdmin /><CabinetSpreadsheetAdmin /><CabinetLineDownload /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="door-styles" className="mt-4">
          <CatalogSubTabs sectionId="door-styles" activeTab={activeTab} onSelect={selectTab}>
            <TabsContent value="featured" className="mt-6"><AdminTabErrorBoundary tabName="Featured Styles"><AdminTabHelp tab="featured" /><FeaturedStylesAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="door-corrections" className="mt-6"><AdminTabErrorBoundary tabName="Door Corrections"><AdminTabHelp tab="door-corrections" /><DoorCorrectionsAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="door-rendering-audit" className="mt-6"><AdminTabErrorBoundary tabName="Door Rendering Audit"><AdminTabHelp tab="door-rendering-audit" /><DoorRenderingAuditAdmin /></AdminTabErrorBoundary></TabsContent>
          </CatalogSubTabs>
        </TabsContent>
        <TabsContent value="catalog-images" className="mt-4">
          <CatalogSubTabs sectionId="catalog-images" activeTab={activeTab} onSelect={selectTab}>
            <TabsContent value="images" className="mt-6"><AdminTabErrorBoundary tabName="Product Images"><AdminTabHelp tab="images" /><SkuImageManager /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="media-library" className="mt-6"><AdminTabErrorBoundary tabName="📁 Media Library"><MediaLibraryAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="generated-design-images" className="mt-6"><AdminTabErrorBoundary tabName="✨ Generated Design Images"><GeneratedDesignImagesAdmin /></AdminTabErrorBoundary></TabsContent>
          </CatalogSubTabs>
        </TabsContent>
        <TabsContent value="suppliers" className="mt-4">
          <CatalogSubTabs sectionId="suppliers" activeTab={activeTab} onSelect={selectTab}>
            <TabsContent value="distributors" className="mt-6 space-y-6"><AdminTabErrorBoundary tabName="Distributors"><AdminTabHelp tab="distributors" /><LineBrandingEditor /><DistributorFulfillmentEditor /><DistributorImport /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="glass-policy" className="mt-6"><AdminTabErrorBoundary tabName="Glass Policy"><AdminTabHelp tab="glass-policy" /><DistributorFulfillmentEditor glassOnly /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="catalog-importer" className="mt-6"><AdminTabErrorBoundary tabName="📥 Catalog Importer"><CatalogImporterTab /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="pending-distributor-connections" className="mt-6"><AdminTabErrorBoundary tabName="✎ Supplier Products"><PendingDistributorConnectionsAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="vendor-onboarding" className="mt-6"><AdminTabErrorBoundary tabName="Vendor Onboarding"><AdminTabHelp tab="vendor-onboarding" /><VendorOnboardingAdmin /></AdminTabErrorBoundary></TabsContent>
          </CatalogSubTabs>
        </TabsContent>
        <TabsContent value="cabinet-config" className="mt-6"><AdminTabErrorBoundary tabName="Cabinet Config"><CabinetConfigAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="categories" className="mt-6"><AdminTabErrorBoundary tabName="Categories"><CategoriesAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="package-data" className="mt-6"><AdminTabErrorBoundary tabName="📦 Package Data & Parcel"><BulkDimensionsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="pelican-catalog" className="mt-6"><AdminTabErrorBoundary tabName="Pelican Catalog"><PelicanCatalogAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="bundle-deals" className="mt-6"><AdminTabErrorBoundary tabName="📦 Kitchen Packages"><BundleDealsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="price-shop-10x10" className="mt-6"><AdminTabErrorBoundary tabName="10×10 Price Shop"><PriceShop10x10 /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="catalog-quality" className="mt-4">
          <CatalogSubTabs sectionId="catalog-quality" activeTab={activeTab} onSelect={selectTab}>
            <TabsContent value="conflicts" className="mt-6"><AdminTabErrorBoundary tabName="Conflicts"><AdminTabHelp tab="conflicts" /><ConflictsAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="merge-suggestions" className="mt-6"><AdminTabErrorBoundary tabName="Merge Suggestions"><PotentialMergesAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="master-sku" className="mt-6"><AdminTabErrorBoundary tabName="Master SKU Aliases"><MasterSkuAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="master-changes" className="mt-6"><AdminTabErrorBoundary tabName="Master Changes"><MasterChangesAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="unpriced-items" className="mt-6"><AdminTabErrorBoundary tabName="⚠ Unpriced Items"><UnpricedCabinetsAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="designer-price-flags" className="mt-6"><AdminTabErrorBoundary tabName="🚩 Designer Price Flags"><DesignerPriceFlagsAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="pending-review" className="mt-6"><AdminTabErrorBoundary tabName="⏳ Pending Review"><PendingReviewAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="cabinet-attention" className="mt-6"><AdminTabErrorBoundary tabName="⚠ Cabinet Attention"><CabinetConfigReviewQueueAdmin /></AdminTabErrorBoundary></TabsContent>
            <TabsContent value="data-recovery" className="mt-6"><AdminTabErrorBoundary tabName="🛟 Data Recovery"><DataRecoveryAdmin /></AdminTabErrorBoundary></TabsContent>
          </CatalogSubTabs>
        </TabsContent>

        {/* Pricing */}
        <TabsContent value="multipliers" className="mt-6"><AdminTabErrorBoundary tabName="Multipliers"><DistributorMultipliersAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="margins" className="mt-6"><AdminTabErrorBoundary tabName="Pricing & Margins"><AdminTabHelp tab="margins" /><MarginsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="cost-lookup" className="mt-6"><AdminTabErrorBoundary tabName="Price Audit"><AdminTabHelp tab="cost-lookup" /><CostLookupAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="pricing-access" className="mt-6"><AdminTabErrorBoundary tabName="Pricing Access"><AdminTabHelp tab="pricing-access" /><PricingAccessAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="affiliate-tiers" className="mt-6"><AdminTabErrorBoundary tabName="Affiliate Tiers"><AdminTabHelp tab="affiliate-tiers" /><AffiliatePricingTiersAdmin /></AdminTabErrorBoundary></TabsContent>

        {/* Operations */}
        <TabsContent value="shipping" className="mt-6"><AdminTabErrorBoundary tabName="Shipping"><AdminTabHelp tab="shipping" /><div className="mb-6"><CarrierKeysPanel /></div><ShippingAdmin /><div className="mt-6"><FreightApiLogsPanel /><FreightQuoteHistoryPanel /></div></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="coverage" className="mt-6"><AdminTabErrorBoundary tabName="Designer Coverage"><AdminTabHelp tab="coverage" /><DesignerCoverageAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="designer-availability" className="mt-6"><AdminTabErrorBoundary tabName="Designer Availability"><AdminTabHelp tab="designer-availability" /><DesignerAvailabilityAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="gemini-image-provider" className="mt-6"><AdminTabErrorBoundary tabName="AI Image Provider"><GeminiImageProviderAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="elevenlabs-operations" className="mt-6"><AdminTabErrorBoundary tabName="ElevenLabs Audio"><ElevenLabsOperationsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="manual-ai-renders" className="mt-6"><AdminTabErrorBoundary tabName="Manual AI Renders"><ManualAiRenderQueueAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="team-notes" className="mt-6"><AdminTabErrorBoundary tabName="Team Notes"><AdminStickyNotes /></AdminTabErrorBoundary></TabsContent>

        {/* Settings */}
        <TabsContent value="banners" className="mt-6"><AdminTabErrorBoundary tabName="Banner Management"><BannerAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="stripe-payment" className="mt-6"><AdminTabErrorBoundary tabName="Stripe Payment"><StripePaymentSettingsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="email-settings" className="mt-6"><AdminTabErrorBoundary tabName="Email Settings"><AdminTabHelp tab="email-settings" /><EmailSettingsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="branding" className="mt-6"><AdminTabErrorBoundary tabName="Site Branding"><AdminTabHelp tab="branding" /><BrandingSettingsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="notifications" className="mt-6"><AdminTabErrorBoundary tabName="Notifications"><AdminTabHelp tab="notifications" /><NotificationSettingsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="quickbooks" className="mt-6"><AdminTabErrorBoundary tabName="QuickBooks"><QuickBooksAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="api-status" className="mt-6"><AdminTabErrorBoundary tabName="API Status"><ApiStatusAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="analytics" className="mt-6"><AdminTabErrorBoundary tabName="Analytics"><AnalyticsAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="kitchen-rules" className="mt-6"><AdminTabErrorBoundary tabName="Kitchen Rules"><KitchenRulesAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="export" className="mt-6"><AdminTabErrorBoundary tabName="Full Export"><FullDatabaseExport /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="affiliate-literature" className="mt-6"><AdminTabErrorBoundary tabName="Affiliate Literature"><AdminTabHelp tab="affiliate-literature" /><AffiliateLiteratureAdmin /></AdminTabErrorBoundary></TabsContent>
        <TabsContent value="affiliate-resources" className="mt-6"><AdminTabErrorBoundary tabName="Affiliate Resources"><AdminTabHelp tab="affiliate-resources" /><AffiliateResourcesAdmin /></AdminTabErrorBoundary></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
