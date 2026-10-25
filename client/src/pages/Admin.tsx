import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl, WEBMAIL_URL } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { CrmBoard } from "@/components/crm/CrmBoard";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Hammer,
  Layers,
  Search,
  UserRound,
  DollarSign,
  Inbox,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import AffiliatesAdmin from "@/components/admin/AffiliatesAdmin";
import DistributorImport from "@/components/admin/DistributorImport";
import LineBrandingEditor from "@/components/admin/LineBrandingEditor";
import DistributorFulfillmentEditor from "@/components/admin/DistributorFulfillmentEditor";
import CustomersAdmin from "@/components/admin/CustomersAdmin";
import RolesAdmin from "@/components/admin/RolesAdmin";
import SkuImageManager from "@/components/admin/SkuImageManager";
import FeaturedStylesAdmin from "@/components/admin/FeaturedStylesAdmin";
import ShippingAdmin from "@/components/admin/ShippingAdmin";
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
import IncomingOrdersAdmin from "@/components/admin/IncomingOrdersAdmin";
import { BulkDimensionsAdmin } from "@/components/admin/BulkDimensionsAdmin";
import { DesignerCoverageAdmin } from "@/components/admin/DesignerCoverageAdmin";
import { AdminTabHelp } from "@/components/admin/AdminTabHelp";
import ApprovedVendorsAdmin from "@/components/admin/ApprovedVendorsAdmin";
import PelicanCatalogAdmin from "@/components/admin/PelicanCatalogAdmin";
import { AnalyticsAdmin } from "@/components/admin/AnalyticsAdmin";
import FullDatabaseExport from "@/components/admin/FullDatabaseExport";
import AdminGroupedTabs from "@/components/admin/AdminGroupedTabs";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved" || status === "won") return "default";
  if (status === "rejected" || status === "lost") return "destructive";
  if (status === "quoted") return "secondary";
  return "outline";
}

function ProApplications() {
  const utils = trpc.useUtils();
  const { data: apps, isLoading, error, refetch } = trpc.pros.adminList.useQuery();
  const setStatus = trpc.pros.adminSetStatus.useMutation({
    onSuccess: () => {
      utils.pros.adminList.invalidate();
      toast.success("Application updated");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive">Couldn't load applications: {error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!apps || apps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pro applications yet. Share the{" "}
        <a href="/pro-network" className="text-primary underline">
          Join Our Pro Network
        </a>{" "}
        page to start receiving applications.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {apps.map((a) => (
        <Card key={a.id}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{a.companyName}</span>
                  <Badge variant={statusVariant(a.status)} className="capitalize">
                    {a.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>{a.contactName}</span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {a.email}
                  </span>
                  {a.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {a.phone}
                    </span>
                  )}
                  {a.baseZip && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {a.baseZip} ·{" "}
                      {a.serviceRadiusMiles}mi
                    </span>
                  )}
                  {a.insured && (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <ShieldCheck className="h-3.5 w-3.5" /> Insured
                    </span>
                  )}
                  {a.website && (
                    <a
                      href={a.website.startsWith("http") ? a.website : `https://${a.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Website
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(a.trades ?? []).map((t) => (
                    <Badge key={t} variant="outline" className="gap-1">
                      {t === "installation" ? (
                        <Hammer className="h-3 w-3" />
                      ) : (
                        <Layers className="h-3 w-3" />
                      )}
                      {t === "installation" ? "Installation" : "Fabrication"}
                    </Badge>
                  ))}
                  {(a.materials ?? []).map((m) => (
                    <Badge key={m} variant="secondary">
                      {m}
                    </Badge>
                  ))}
                </div>
                {a.serviceZips && a.serviceZips.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    ZIPs: {a.serviceZips.join(", ")}
                  </div>
                )}
                {a.notes && <p className="text-sm text-muted-foreground pt-1">{a.notes}</p>}
              </div>

              <div className="flex md:flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={a.status === "approved" || setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: a.id, status: "approved" })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={a.status === "rejected" || setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: a.id, status: "rejected" })}
                >
                  Reject
                </Button>
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
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive">Couldn't load vendor applications: {error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!apps || apps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No vendor applications yet. Share the{" "}
        <a href="/become-a-vendor" className="text-primary underline">
          Become a Vendor
        </a>{" "}
        page to start receiving applications.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {apps.map((a) => (
        <Card key={a.id}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{a.companyName}</span>
                  <Badge variant={statusVariant(a.status)} className="capitalize">
                    {a.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>{a.contactName}</span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {a.email}
                  </span>
                  {a.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {a.phone}
                    </span>
                  )}
                  {a.headquarters && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {a.headquarters}
                    </span>
                  )}
                  {a.website && (
                    <a
                      href={a.website.startsWith("http") ? a.website : `https://${a.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Website
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {a.categories &&
                    a.categories
                      .split(",")
                      .map((c) => c.trim())
                      .filter(Boolean)
                      .map((c) => (
                        <Badge
                          key={c}
                          className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
                        >
                          {c}
                        </Badge>
                      ))}
                  {a.productLines && <Badge variant="secondary">{a.productLines}</Badge>}
                  {a.doorStyleCount != null && (
                    <Badge variant="outline">{a.doorStyleCount} door styles</Badge>
                  )}
                  {a.leadTimeDays != null && (
                    <Badge variant="outline">{a.leadTimeDays}-day lead</Badge>
                  )}
                  {a.offersTradePricing && (
                    <Badge variant="outline" className="gap-1 text-emerald-600">
                      <DollarSign className="h-3 w-3" /> Trade pricing
                    </Badge>
                  )}
                  {a.hasCatalogImages && (
                    <Badge variant="outline" className="gap-1">
                      <Layers className="h-3 w-3" /> Has images/specs
                    </Badge>
                  )}
                </div>
                {a.message && <p className="text-sm text-muted-foreground pt-1">{a.message}</p>}
              </div>

              <div className="flex md:flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={a.status === "approved" || setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: a.id, status: "approved" })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={a.status === "rejected" || setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: a.id, status: "rejected" })}
                >
                  Reject
                </Button>
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
    onSuccess: () => {
      utils.design.listCountertopQuotes.invalidate();
      toast.success("Quote updated");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive">Couldn't load quotes: {error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No countertop quote requests yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {quotes.map((q) => (
        <Card key={q.id}>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{q.contactEmail}</span>
                <Badge variant={statusVariant(q.status)} className="capitalize">
                  {q.status}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {Number(q.squareFeet).toFixed(1)} sq ft · {Number(q.linearFeet).toFixed(1)} lin ft
                {q.hasIsland ? " · island" : ""}
                {q.material ? ` · ${q.material}` : ""}
                {q.zip ? ` · ZIP ${q.zip}` : ""}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                placeholder="Quoted price"
                className="w-40"
                defaultValue={q.quotedPrice ? Number(q.quotedPrice) : undefined}
                id={`qp-${q.id}`}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const el = document.getElementById(`qp-${q.id}`) as HTMLInputElement | null;
                  const price = el?.value ? Number(el.value) : undefined;
                  update.mutate({ id: q.id, status: "quoted", quotedPrice: price });
                }}
              >
                Save Quote
              </Button>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: q.id, status: "won" })}>
                Mark Won
              </Button>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: q.id, status: "lost" })}>
                Mark Lost
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="ml-auto"
                onClick={() => {
                  setActiveQuoteId(activeQuoteId === q.id ? null : q.id);
                  setMatchZip(q.zip ?? "");
                }}
              >
                <Search className="h-3.5 w-3.5 mr-1" /> Find Pros
              </Button>
            </div>

            {q.quotedPrice && (
              <div className="text-sm rounded-md bg-muted px-3 py-2">
                Quoted: <strong>${Number(q.quotedPrice).toLocaleString()}</strong> · Est. platform
                fee (15%):{" "}
                <strong>
                  ${(Number(q.quotedPrice) * 0.15).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </strong>
              </div>
            )}

            {activeQuoteId === q.id && (
              <ProMatcher zip={matchZip} onZipChange={setMatchZip} />
            )}
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
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onZipChange(e.target.value);
          }}
          placeholder="ZIP to match fabricators"
          className="w-48"
        />
        {isFetching && <Spinner className="h-4 w-4 text-primary" />}
      </div>
      {search.length >= 3 && matches && matches.length === 0 && (
        <p className="text-sm text-muted-foreground">No approved fabricators cover this ZIP yet.</p>
      )}
      {matches && matches.length > 0 && (
        <ul className="space-y-2">
          {matches.map((p) => (
            <li key={p.id} className="text-sm flex items-center justify-between gap-2">
              <span>
                <strong>{p.companyName}</strong> — {p.contactName} · {p.email}
                {p.phone ? ` · ${p.phone}` : ""}
              </span>
              <Badge variant="outline">{p.baseZip ?? "—"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-md py-20 text-center">
        <h1 className="font-serif text-2xl font-bold mb-3">Admin Sign In Required</h1>
        <p className="text-muted-foreground mb-6">Please sign in with an admin account.</p>
        <a href={getLoginUrl()}>
          <Button className="bg-[var(--color-navy)] text-white">Sign In</Button>
        </a>
      </div>
    );
  }

  // Designers are internal sales staff: they may enter the admin backend but
  // ONLY get the Sales CRM — every other admin surface is hidden + server-gated.
  const isDesigner = user.role === "designer";
  // Sales reps (1099 contractors) get an even narrower workspace: CRM + Design Tool only.
  const isSalesRep = user.role === "sales_rep";
  if (user.role !== "admin" && !isDesigner && !isSalesRep) {
    return (
      <div className="container max-w-md py-20 text-center">
        <h1 className="font-serif text-2xl font-bold mb-3">Access Restricted</h1>
        <p className="text-muted-foreground">
          This area is for platform administrators only.
        </p>
      </div>
    );
  }

  if (isSalesRep) {
    return (
      <div className="container py-10">
        <h1 className="font-serif text-3xl font-bold mb-1">Sales Rep Workspace</h1>
        <p className="text-muted-foreground mb-8">
          Work your pipeline in the CRM and build customer kitchens in the 3D Designer. A flat $400
          commission is recorded automatically each time a deal you own is marked Won.
        </p>
        <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") || "crm"}>
          <TabsList>
            <TabsTrigger value="crm">Sales CRM</TabsTrigger>
            <TabsTrigger value="commissions">My Commissions</TabsTrigger>
          </TabsList>
          <TabsContent value="crm" className="mt-6">
            <CrmBoard lang="en" />
          </TabsContent>
          <TabsContent value="commissions" className="mt-6">
            <SalesCommissionsAdmin />
          </TabsContent>
        </Tabs>
        <div className="mt-8">
          <a href="/design">
            <Button className="bg-[var(--color-navy)] text-white gap-2">
              <UserRound className="h-4 w-4" /> Open 3D Designer
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (isDesigner) {
    return (
      <div className="container py-10">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
          <div>
            <h1 className="font-serif text-3xl font-bold mb-1">Designer Workspace</h1>
            <p className="text-muted-foreground">
              Manage your consultation availability and track your leads and deals.
            </p>
          </div>
          <a href={WEBMAIL_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <Inbox className="h-4 w-4" /> Email Inbox
            </Button>
          </a>
        </div>
        <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") || "crm"}>
          <TabsList>
            <TabsTrigger value="crm">Sales CRM</TabsTrigger>
            <TabsTrigger value="consultations">Consultations</TabsTrigger>
          </TabsList>
          <TabsContent value="crm" className="mt-6">
            <CrmBoard lang="en" />
          </TabsContent>
          <TabsContent value="consultations" className="mt-6">
            <ConsultationsAdmin />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold mb-1">Admin</h1>
          <p className="text-muted-foreground">
            Manage affiliates, review Pro Network applications, and handle countertop quote requests.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`${import.meta.env.VITE_ANALYTICS_ENDPOINT || ""}/share/${import.meta.env.VITE_ANALYTICS_WEBSITE_ID || ""}/Cabinet%20Dealz`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Analytics Dashboard
            </Button>
          </a>
          <a href={WEBMAIL_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <Inbox className="h-4 w-4" /> Email Inbox
            </Button>
          </a>
        </div>
      </div>

      <AdminGroupedTabs />
    </div>
  );
}
