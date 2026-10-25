import React, { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Store, Plus, ExternalLink, Copy, DollarSign, Package, Mail, Phone, MapPin, Eye, Send, FileText, CheckCircle2, KeyRound,
  Calculator, Save, Info, BarChart2, TrendingUp, Users, UserPlus, QrCode, Megaphone, BookOpen, Download, Youtube,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { affiliateStorefrontPath, affiliateStorefrontUrl, copyAffiliateStorefrontLink } from "@/lib/affiliateStorefrontUrl";
import { affiliateAdminRowLinks } from "@/lib/affiliateAdminRowLinks";
import {
  AFFILIATE_STOREFRONT_TEMPLATES,
  type AffiliateStorefrontTemplate,
} from "@shared/affiliateStorefrontTemplates";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "inactive") return "destructive";
  return "secondary"; // paused
}

export default function AffiliatesAdmin() {
  const utils = trpc.useUtils();
  const { data: affiliates, isLoading, error, refetch } = trpc.affiliates.adminList.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Auto-expand a specific affiliate when arriving from the storefront admin link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("affiliateId");
    if (id) {
      setExpandedId(Number(id));
      // Scroll to the affiliate card after data loads
      setTimeout(() => {
        const el = document.getElementById(`affiliate-row-${id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 500);
    }
  }, []);

  const setStatus = trpc.affiliates.adminUpdate.useMutation({
    onSuccess: () => {
      utils.affiliates.adminList.invalidate();
      toast.success("Affiliate updated");
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
        <p className="text-destructive">Couldn't load affiliates: {error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {affiliates?.length ?? 0} affiliate{(affiliates?.length ?? 0) === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          {/* Demo storefront — sales tool: opens the classic template as a live example */}
          <a href="/store-preview/classic" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Demo Storefront
            </Button>
          </a>
          <SalesDemoInviteDialog />
          <CreateAffiliateDialog onCreated={() => utils.affiliates.adminList.invalidate()} />
        </div>
      </div>

      {(!affiliates || affiliates.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          <Store className="h-10 w-10 mx-auto mb-3 opacity-50" />
          No affiliates yet. Add your first partner store.
        </div>
      ) : (
        affiliates.map((a) => (
          <Card key={a.id} id={`affiliate-row-${a.id}`}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{a.storeName}</span>
                    <Badge variant={statusVariant(a.status)} className="capitalize">{a.status}</Badge>
                    <Badge variant="outline" className="font-mono">{a.referralCode}</Badge>
                    <Badge variant="secondary">{(Number(a.commissionRate) * 100).toFixed(1)}%</Badge>
                    {a.w9Status === "verified" && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
                        <FileText className="h-3 w-3" /> W-9 Verified
                      </Badge>
                    )}
                    {a.w9Status === "submitted" && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300 gap-1">
                        <FileText className="h-3 w-3" /> W-9 Pending Review
                      </Badge>
                    )}
                    {a.w9Status === "pending" && (
                      <Badge variant="outline" className="text-amber-700 border-amber-400 gap-1">
                        <FileText className="h-3 w-3" /> W-9 Not Submitted
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    {a.contactName && <span>{a.contactName}</span>}
                    {a.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {a.email}</span>}
                    {a.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {a.phone}</span>}
                    {a.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {a.location}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <a href={affiliateStorefrontUrl(a.slug)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" /> {affiliateStorefrontPath(a.slug)}
                    </a>
                  </div>
                </div>

                <div className="flex md:flex-col gap-2 shrink-0">
                  <Select
                    value={a.status}
                    onValueChange={(v) => setStatus.mutate({ id: a.id, status: v as "active" | "paused" | "inactive" })}
                  >
                    <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <a href={affiliateStorefrontUrl(a.slug)} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" /> View Store
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => {
                      void copyAffiliateStorefrontLink(a.slug)
                        .then(() => toast.success("Storefront link copied"))
                        .catch(() => toast.error("Could not copy storefront link"));
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy storefront link
                  </Button>
                  <a href={affiliateAdminRowLinks(a.id).portalUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Store className="h-3.5 w-3.5" /> Affiliate Portal
                    </Button>
                  </a>
                  <a href={affiliateAdminRowLinks(a.id).fullPageUrl}>
                    <Button size="sm" className="w-full gap-1.5 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90">
                      <Eye className="h-3.5 w-3.5" /> Full Page View
                    </Button>
                  </a>
                  <a href={`/store-preview/${a.template ?? "classic"}`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Preview Template
                    </Button>
                  </a>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  >
                    {expandedId === a.id ? "Hide" : "Details"}
                  </Button>
                </div>
              </div>

              {expandedId === a.id && <AffiliateDetailsPanel affiliate={a} origin={origin} />}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function SalesDemoInviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<"sales_representative" | "affiliate_candidate">("sales_representative");
  const invite = trpc.affiliates.adminInviteSalesDemo.useMutation({
    onSuccess: () => {
      toast.success("Sales Demo invitation sent");
      setOpen(false);
      setEmail("");
      setName("");
      setAudience("sales_representative");
    },
    onError: (error) => toast.error(error.message),
  });

  function sendInvite() {
    if (!email.trim()) {
      toast.error("Enter an email address");
      return;
    }
    invite.mutate({
      email: email.trim(),
      name: name.trim() || undefined,
      audience,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Invite to Sales Demo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to Cabinet Dealz Sales Demo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Send a guided training invitation for the Sales Demo storefront, designer, order walkthrough, and CRM. The recipient cannot access First Class or other live affiliate records.</p>
          <div className="space-y-2">
            <Label htmlFor="sales-demo-invite-email">Email address</Label>
            <Input id="sales-demo-invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="candidate@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sales-demo-invite-name">Name <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="sales-demo-invite-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Smith" />
          </div>
          <div className="space-y-2">
            <Label>Invite audience</Label>
            <Select value={audience} onValueChange={(value) => setAudience(value as "sales_representative" | "affiliate_candidate")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales_representative">Sales representative</SelectItem>
                <SelectItem value="affiliate_candidate">Prospective affiliate candidate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full gap-2" onClick={sendInvite} disabled={invite.isPending}>
            <Send className="h-4 w-4" /> {invite.isPending ? "Sending invitation…" : "Send Sales Demo invitation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Full details panel shown when an affiliate row is expanded
type AffiliateItem = {
  id: number;
  storeName: string;
  slug: string;
  referralCode: string;
  email: string;
  contactName: string | null;
  template: string | null;
  commissionRate: string | number;
  status: string;
  phone: string | null;
  location: string | null;
  website: string | null;
  notes: string | null;
  w9Status: string;
  w9LegalName: string | null;
  w9IdDocumentUrl: string | null;
  w9SubmittedAt: Date | null;
  w9VerifiedAt: Date | null;
  w9AdminNotes: string | null;
};

function AffiliateDetailsPanel({ affiliate: a, origin }: { affiliate: AffiliateItem; origin: string }) {
  const utils = trpc.useUtils();
  const storeUrl = affiliateStorefrontUrl(a.slug, origin);
  const refLink = `${storeUrl}/order?ref=${a.referralCode}`;
  const loginUrl = `${origin}/affiliate`;
  const [activeTab, setActiveTab] = useState<"credentials" | "template" | "referrals" | "earnings" | "crm" | "catalog" | "storefront" | "analytics" | "pricing" | "marketing" | "w9">("credentials");

  const setTemplate = trpc.affiliates.adminUpdate.useMutation({
    onSuccess: () => {
      utils.affiliates.adminList.invalidate();
      toast.success("Template updated");
    },
    onError: (e) => toast.error(e.message),
  });

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Could not copy")
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/20 overflow-hidden">
      {/* Sub-tab bar */}
      <div className="flex flex-wrap border-b border-border">
        {(["credentials", "template", "referrals", "earnings", "crm", "analytics", "pricing", "catalog", "storefront", "marketing", "w9"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeTab === t
                ? "border-b-2 border-primary text-primary bg-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === "credentials" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Affiliate Credentials</p>
            {[
              { label: "Storefront URL", value: storeUrl },
              { label: "Referral Link", value: refLink },
              { label: "Referral Code", value: a.referralCode },
              { label: "Login Portal", value: loginUrl },
              { label: "Email", value: a.email },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                <code className="flex-1 text-xs bg-muted rounded px-2 py-1 truncate">{value}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyText(value, label)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                {(label === "Storefront URL" || label === "Login Portal") && (
                  <a href={value} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
              </div>
            ))}
            <div className="pt-2 flex flex-wrap gap-2">
              <Button
                variant="outline" size="sm" className="gap-1.5"
                onClick={() => {
                  const all = `Storefront: ${storeUrl}\nReferral link: ${refLink}\nReferral code: ${a.referralCode}\nLogin: ${loginUrl}\nEmail: ${a.email}`;
                  copyText(all, "All credentials");
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copy All
              </Button>
              <AffiliateLoginManager affiliateId={a.id} currentEmail={a.email ?? ""} />
              <SendCredentialsButton affiliateId={a.id} />
            </div>
          </div>
        )}

        {activeTab === "template" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Storefront Template</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TEMPLATES.map((t) => {
                const active = (a.template ?? "classic") === t.id;
                return (
                  <div key={t.id} className={`rounded-lg border p-3 space-y-1.5 cursor-pointer transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                    onClick={() => !active && setTemplate.mutate({ id: a.id, template: t.id })}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{t.name}</span>
                      {active && <span className="text-xs text-primary font-medium">Active</span>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{t.desc}</p>
                    <a href={`/store-preview/${t.id}`} target="_blank" rel="noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "referrals" && <AffiliateReferrals affiliateId={a.id} />}
        {activeTab === "earnings" && <AffiliateEarningsAdmin affiliateId={a.id} />}
        {activeTab === "crm" && <AffiliateCrmAdmin affiliateId={a.id} />}
        {activeTab === "catalog" && <AffiliateCatalogMarkupAdmin affiliateId={a.id} />}
        {activeTab === "storefront" && <AffiliateStorefrontEditor affiliate={a} onSaved={() => utils.affiliates.adminList.invalidate()} />}
        {activeTab === "analytics" && <AffiliateAnalyticsAdmin affiliateId={a.id} />}
        {activeTab === "pricing" && <AffiliatePricingAdmin affiliateId={a.id} />}
        {activeTab === "marketing" && <AffiliateMarketingAdmin affiliate={a} origin={origin} />}
        {activeTab === "w9" && <AffiliateW9Review affiliate={a} />}
      </div>
    </div>
  );
}

function AffiliateReferrals({ affiliateId }: { affiliateId: number }) {
  const { data, isLoading } = trpc.affiliates.adminReferrals.useQuery({ affiliateId }, { retry: false });
  if (isLoading) return <div className="py-4 flex justify-center"><Spinner className="h-5 w-5" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground py-3">No data.</p>;

  const { orders, summary } = data;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-1.5"><Package className="h-4 w-4" /> {summary.referredCount} referred</span>
        <span className="inline-flex items-center gap-1.5 text-emerald-600">{summary.confirmedCount} confirmed</span>
        <span className="inline-flex items-center gap-1.5 font-medium"><DollarSign className="h-4 w-4" /> ${summary.commission.toFixed(2)} commission</span>
      </div>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No referred orders yet.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between py-1.5">
              <span className="font-mono">{o.requestNumber ?? `#${o.id}`}</span>
              <span className="text-muted-foreground">{o.originatorEmail}</span>
              <Badge variant="outline" className="capitalize">{o.status}</Badge>
              <span className="tabular-nums">{o.totalAmount != null ? `$${Number(o.totalAmount).toFixed(2)}` : "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Admin: Catalog + Markup tab for one affiliate ─────────────────────────────
function AffiliateCatalogMarkupAdmin({ affiliateId }: { affiliateId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.affiliates.adminBranding.useQuery({ affiliateId }, { retry: false });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Record<number, { brandName: string; markupPct: string }>>({});
  const [defaultMarkupPct, setDefaultMarkupPct] = useState("");
  const [savingDefault, setSavingDefault] = useState(false);

  const upsert = trpc.affiliates.adminUpsertStyleBranding.useMutation({
    onSuccess: () => utils.affiliates.adminBranding.invalidate({ affiliateId }),
    onError: (e) => toast.error(e.message),
  });
  const updateMarkup = trpc.affiliates.adminUpdateMarkup.useMutation({
    onSuccess: () => {
      utils.affiliates.adminBranding.invalidate({ affiliateId });
      toast.success("Default markup saved");
      setSavingDefault(false);
    },
    onError: (e) => { toast.error(e.message); setSavingDefault(false); },
  });

  useEffect(() => {
    if (data) setDefaultMarkupPct(data.defaultMarkupBps != null ? (data.defaultMarkupBps / 100).toFixed(1) : "");
  }, [data?.defaultMarkupBps]);

  if (isLoading) return <div className="py-4 flex justify-center"><Spinner className="h-5 w-5" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground py-3">No catalog data.</p>;

  const filtered = data.styles.filter((s) =>
    !search || (s.ourName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.override?.brandName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function startEdit(styleId: number, current: { brandName: string | null; markupBps: number | null }) {
    setEditing((prev) => ({
      ...prev,
      [styleId]: {
        brandName: current.brandName ?? "",
        markupPct: current.markupBps != null ? (current.markupBps / 100).toFixed(1) : "",
      },
    }));
  }

  function saveStyle(styleId: number) {
    const e = editing[styleId];
    if (!e) return;
    const markupBps = e.markupPct.trim() !== "" ? Math.round(parseFloat(e.markupPct) * 100) : null;
    upsert.mutate({
      affiliateId,
      styleId,
      brandName: e.brandName.trim() || null,
      markupBps: isNaN(markupBps as number) ? null : markupBps,
    }, {
      onSuccess: () => {
        setEditing((prev) => { const n = { ...prev }; delete n[styleId]; return n; });
        toast.success("Style saved");
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* Default markup */}
      <div className="flex items-end gap-3 p-3 rounded-lg border border-border bg-card">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground font-medium block mb-1">Default Markup % (all styles unless overridden)</label>
          <Input
            value={defaultMarkupPct}
            onChange={(e) => setDefaultMarkupPct(e.target.value)}
            placeholder="e.g. 15"
            className="h-8 text-sm w-32"
          />
        </div>
        <Button size="sm" disabled={savingDefault} onClick={() => {
          setSavingDefault(true);
          const bps = defaultMarkupPct.trim() !== "" ? Math.round(parseFloat(defaultMarkupPct) * 100) : 0;
          updateMarkup.mutate({ affiliateId, defaultMarkupBps: isNaN(bps) ? 0 : bps });
        }}>Save Default</Button>
      </div>

      {/* Per-style search + table */}
      <Input
        placeholder="Search door styles…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="rounded-lg border border-border overflow-hidden max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Style (Central Name)</th>
              <th className="text-left px-3 py-2 font-medium">Affiliate Name</th>
              <th className="text-right px-3 py-2 font-medium">Markup %</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => {
              const isEditing = s.id in editing;
              const e = editing[s.id];
              return (
                <tr key={s.id} className={isEditing ? "bg-primary/5" : ""}>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{s.ourName ?? s.styleCode}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Input
                        value={e.brandName}
                        onChange={(ev) => setEditing((p) => ({ ...p, [s.id]: { ...p[s.id], brandName: ev.target.value } }))}
                        placeholder={s.ourName ?? ""}
                        className="h-7 text-xs"
                      />
                    ) : (
                      <span className={s.override?.brandName ? "font-medium" : "text-muted-foreground italic"}>
                        {s.override?.brandName || "(default)"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <Input
                        value={e.markupPct}
                        onChange={(ev) => setEditing((p) => ({ ...p, [s.id]: { ...p[s.id], markupPct: ev.target.value } }))}
                        placeholder="%"
                        className="h-7 text-xs w-20 ml-auto"
                      />
                    ) : (
                      <span className="tabular-nums">
                        {s.override?.markupBps != null ? `${(s.override.markupBps / 100).toFixed(1)}%` : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => saveStyle(s.id)}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing((p) => { const n = { ...p }; delete n[s.id]; return n; })}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => startEdit(s.id, { brandName: s.override?.brandName ?? null, markupBps: s.override?.markupBps ?? null })}>
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Admin: Storefront Editor tab for one affiliate ──────────────────────────
function AffiliateStorefrontEditor({ affiliate: a, onSaved }: { affiliate: AffiliateItem; onSaved: () => void }) {
  const [form, setForm] = useState({
    storeName: a.storeName ?? "",
    contactName: a.contactName ?? "",
    email: a.email ?? "",
    phone: a.phone ?? "",
    website: a.website ?? "",
    location: a.location ?? "",
    tagline: "",
    taglineEs: "",
    aboutText: "",
    aboutTextEs: "",
    serviceArea: "",
    yearsInBusiness: "",
    facebookUrl: "",
    instagramUrl: "",
  });
  const [loaded, setLoaded] = useState(false);
  const syncRef = useRef<string>("");

  // Load full affiliate data (adminList only has partial fields)
  const { data: fullData } = trpc.affiliates.adminList.useQuery(undefined, { retry: false });
  useEffect(() => {
    const af = fullData?.find((x) => x.id === a.id);
    if (af) {
      // Re-sync whenever fresh server data arrives (including right after a save)
      // so the fields reflect what is actually stored instead of the values
      // captured on first render.
      const stamp = `${af.id}:${String((af as Record<string, unknown>).updatedAt ?? "")}`;
      if (stamp !== syncRef.current) {
        syncRef.current = stamp;
        setForm({
          storeName: af.storeName ?? "",
          contactName: af.contactName ?? "",
          email: af.email ?? "",
          phone: af.phone ?? "",
          website: af.website ?? "",
          location: af.location ?? "",
          tagline: (af as Record<string, unknown>).tagline as string ?? "",
          taglineEs: (af as Record<string, unknown>).taglineEs as string ?? "",
          aboutText: (af as Record<string, unknown>).aboutText as string ?? "",
          aboutTextEs: (af as Record<string, unknown>).aboutTextEs as string ?? "",
          serviceArea: (af as Record<string, unknown>).serviceArea as string ?? "",
          yearsInBusiness: (af as Record<string, unknown>).yearsInBusiness != null ? String((af as Record<string, unknown>).yearsInBusiness) : "",
          facebookUrl: (af as Record<string, unknown>).facebookUrl as string ?? "",
          instagramUrl: (af as Record<string, unknown>).instagramUrl as string ?? "",
        });
        setLoaded(true);
      }
    }
  }, [fullData, loaded, a.id]);

  const utils = trpc.useUtils();
  const save = trpc.affiliates.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("Storefront updated");
      utils.affiliates.adminList.invalidate();
      utils.affiliates.adminReferrals.invalidate();
      utils.affiliates.bySlug.invalidate();
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  function field(label: string, key: keyof typeof form, multiline?: boolean, hint?: string) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
        {multiline ? (
          <textarea
            value={form[key]}
            onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[72px]"
          />
        ) : (
          <Input
            value={form[key]}
            onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            className="h-8 text-sm"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("Store Name", "storeName")}
        {field("Contact Name", "contactName")}
        {field("Email", "email")}
        {field("Phone", "phone")}
        {field("Website", "website")}
        {field("Location / City", "location")}
        {field("Service Area", "serviceArea", false, "Shown in footer contact block")}
        {field("Years in Business", "yearsInBusiness", false, "Shown in hero badge")}
        {field("Facebook URL", "facebookUrl")}
        {field("Instagram URL", "instagramUrl")}
      </div>
      <div className="space-y-3">
        {field("Hero Tagline (English)", "tagline", false, "Big headline on the storefront")}
        {field("Hero Tagline (Spanish)", "taglineEs", false, "Optional — shown when visitor switches to ES")}
        {field("About Text (English)", "aboutText", true, "Short paragraph about the affiliate's business")}
        {field("About Text (Spanish)", "aboutTextEs", true, "Optional Spanish version")}
      </div>
      <Button
        size="sm"
        disabled={save.isPending}
        onClick={() => save.mutate({
          id: a.id,
          storeName: form.storeName || undefined,
          contactName: form.contactName || null,
          email: form.email || undefined,
          phone: form.phone || null,
          website: form.website || null,
          location: form.location || null,
          tagline: form.tagline || null,
          taglineEs: form.taglineEs || null,
          aboutText: form.aboutText || null,
          aboutTextEs: form.aboutTextEs || null,
          serviceArea: form.serviceArea || null,
          yearsInBusiness: form.yearsInBusiness ? parseInt(form.yearsInBusiness) : null,
          facebookUrl: form.facebookUrl || null,
          instagramUrl: form.instagramUrl || null,
        })}
      >
        {save.isPending ? "Saving…" : "Save Storefront"}
      </Button>
    </div>
  );
}

// ─── Admin: Earnings tab for one affiliate ───────────────────────────────────
function AffiliateEarningsAdmin({ affiliateId }: { affiliateId: number }) {
  const { data, isLoading } = trpc.affiliates.adminEarnings.useQuery({ affiliateId }, { retry: false });
  if (isLoading) return <div className="py-4 flex justify-center"><Spinner className="h-5 w-5" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground py-3">No earnings data.</p>;

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Lifetime Earned", value: fmt(data.lifetimeCents), color: "text-emerald-600" },
          { label: "Pending Payout", value: fmt(data.pendingCents), color: "text-amber-600" },
          { label: "Total Paid", value: fmt(data.paidCents), color: "text-blue-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">Commission rate: {(data.commissionRate * 100).toFixed(1)}%</div>
      {data.weeks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No confirmed orders yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Week</th>
                <th className="text-right px-3 py-2 font-medium">Orders</th>
                <th className="text-right px-3 py-2 font-medium">Commission</th>
                <th className="text-right px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.weeks.map((w) => (
                <tr key={w.weekKey}>
                  <td className="px-3 py-2 font-mono text-xs">{w.weekKey}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{w.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(w.totalCommissionCents)}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge variant={w.payout?.status === "paid" ? "default" : "outline"} className="text-xs capitalize">
                      {w.payout?.status ?? "pending"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Admin: CRM deals tab for one affiliate ───────────────────────────────────
function AffiliateCrmAdmin({ affiliateId }: { affiliateId: number }) {
  const { data, isLoading } = trpc.crm.adminAffiliateDeals.useQuery({ affiliateId }, { retry: false });
  if (isLoading) return <div className="py-4 flex justify-center"><Spinner className="h-5 w-5" /></div>;
  if (!data || data.deals.length === 0) return <p className="text-sm text-muted-foreground py-3">No CRM deals found for this affiliate.</p>;

  const stageBadgeVariant = (stage: string): "default" | "secondary" | "outline" | "destructive" => {
    if (stage === "won") return "default";
    if (stage === "lost") return "destructive";
    if (stage === "proposal") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{data.deals.length} deal{data.deals.length !== 1 ? "s" : ""} in pipeline</p>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Deal</th>
              <th className="text-left px-3 py-2 font-medium">Contact</th>
              <th className="text-right px-3 py-2 font-medium">Value</th>
              <th className="text-right px-3 py-2 font-medium">Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.deals.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2 font-medium max-w-[180px] truncate">{d.title}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs max-w-[160px] truncate">
                  {d.contactName || d.contactEmail || "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {d.estimatedValue != null ? `$${Number(d.estimatedValue).toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Badge variant={stageBadgeVariant(d.stage ?? "")} className="text-xs capitalize">
                    {d.stage ?? "—"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Admin Analytics Panel ───────────────────────────────────────────────────
function AffiliateAnalyticsAdmin({ affiliateId }: { affiliateId: number }) {
  const earningsQ = trpc.affiliates.adminEarnings.useQuery({ affiliateId }, { retry: false });
  const referralsQ = trpc.affiliates.adminReferrals.useQuery({ affiliateId }, { retry: false });
  const isLoading = earningsQ.isLoading || referralsQ.isLoading;

  if (isLoading) return <div className="py-4 flex justify-center"><Spinner className="h-5 w-5" /></div>;

  const earnings = earningsQ.data;
  const referrals = referralsQ.data;

  if (!earnings || !referrals) return <p className="text-sm text-muted-foreground py-3">No analytics data available.</p>;

  const { summary, orders, commissionRate } = referrals;
  const conversionRate = summary.referredCount > 0
    ? ((summary.confirmedCount / summary.referredCount) * 100).toFixed(1)
    : "0.0";

  const weeklyData = earnings.weeks.slice(-12).map((w) => ({
    week: w.weekKey.slice(5),
    commission: parseFloat((w.totalCommissionCents / 100).toFixed(2)),
    orders: w.count,
  }));

  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({ status: status.charAt(0).toUpperCase() + status.slice(1), count }));

  const confirmedOrders = orders.filter((o) => o.status === "confirmed" && o.totalAmount != null);
  const avgOrderValue = confirmedOrders.length > 0
    ? confirmedOrders.reduce((s, o) => s + Number(o.totalAmount), 0) / confirmedOrders.length
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Package, label: "Total referred", value: summary.referredCount },
          { icon: TrendingUp, label: "Confirmed", value: summary.confirmedCount, sub: `${conversionRate}% conversion` },
          { icon: DollarSign, label: "Commission", value: `$${(earnings.lifetimeCents / 100).toFixed(2)}`, sub: `${(commissionRate * 100).toFixed(1)}% rate` },
          { icon: Users, label: "Avg order", value: avgOrderValue > 0 ? `$${avgOrderValue.toFixed(0)}` : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><s.icon className="h-3.5 w-3.5" />{s.label}</div>
            <div className="font-serif text-2xl font-bold tabular-nums">{s.value}</div>
            {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "This week", value: `$${(earnings.thisWeekCents / 100).toFixed(2)}`, color: "text-primary" },
          { label: "Paid out", value: `$${(earnings.paidCents / 100).toFixed(2)}`, color: "text-emerald-600" },
          { label: "Pending", value: `$${(earnings.pendingCents / 100).toFixed(2)}`, color: "text-amber-600" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
            <p className={`text-xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
      {weeklyData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-3">Weekly Commission (last 12 weeks)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <RechartsTooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Commission"]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Bar dataKey="commission" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {statusData.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statusData.map((s) => (
            <div key={s.status} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-xl font-bold tabular-nums">{s.count}</span>
              <span className="text-sm text-muted-foreground">{s.status}</span>
            </div>
          ))}
        </div>
      )}
      {weeklyData.length === 0 && orders.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No analytics data yet for this affiliate.</p>
      )}
    </div>
  );
}

// ─── Admin Pricing Panel ──────────────────────────────────────────────────────
const DAMAGE_PCT = 0.01;
const CC_PCT = 0.04;
const IT_PCT = 0.10;
const IT_MAX = 100;
const PRICE_CATEGORIES = ["base", "wall", "tall", "vanity", "specialty"] as const;
type PriceCategory = typeof PRICE_CATEGORIES[number];
const PRICE_CATEGORY_LABELS: Record<PriceCategory, string> = { base: "Base Cabinets", wall: "Wall Cabinets", tall: "Tall / Pantry", vanity: "Vanity", specialty: "Specialty" };
function computeFloor(affiliateCost: number) {
  const baseline = affiliateCost;
  const damageFee = affiliateCost * DAMAGE_PCT;
  const cardFee = affiliateCost * CC_PCT;
  const itFee = Math.min(affiliateCost * IT_PCT, IT_MAX);
  return { baseline, damageFee, cardFee, itFee, floor: affiliateCost + damageFee + cardFee + itFee };
}
function bpsToPercent(bps: number) { return (bps / 100).toFixed(2); }
function percentToBps(pct: string) { return Math.round(parseFloat(pct) * 100); }

function AffiliatePricingAdmin({ affiliateId }: { affiliateId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.affiliates.adminBranding.useQuery({ affiliateId }, { retry: false });
  const [defaultPct, setDefaultPct] = useState("");
  const [categoryPcts, setCategoryPcts] = useState<Partial<Record<PriceCategory, string>>>({});
  const [calcRetail, setCalcRetail] = useState("1000");
  const [initialized, setInitialized] = useState(false);

  const updateMarkup = trpc.affiliates.adminUpdateMarkup.useMutation({
    onSuccess: () => { toast.success("Pricing saved"); utils.affiliates.adminBranding.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (data && !initialized) {
    setDefaultPct(bpsToPercent(data.defaultMarkupBps));
    const cats: Partial<Record<PriceCategory, string>> = {};
    for (const cat of PRICE_CATEGORIES) {
      if (data.categoryMarkup[cat] !== undefined) cats[cat] = bpsToPercent(data.categoryMarkup[cat]);
    }
    setCategoryPcts(cats);
    setInitialized(true);
  }

  const affiliateCost = parseFloat(calcRetail) || 0;
  const { baseline, damageFee, cardFee, itFee, floor } = useMemo(() => computeFloor(affiliateCost), [affiliateCost]);
  const defaultMarkupBps = percentToBps(defaultPct || "0");
  const customerPrice = affiliateCost * (1 + defaultMarkupBps / 10000);

  function save() {
    const defaultBps = percentToBps(defaultPct || "0");
    if (isNaN(defaultBps) || defaultBps < 0) { toast.error("Invalid markup"); return; }
    const catMap: Record<string, number> = {};
    for (const cat of PRICE_CATEGORIES) {
      const v = categoryPcts[cat];
      if (v !== undefined && v !== "") { const bps = percentToBps(v); if (!isNaN(bps) && bps >= 0) catMap[cat] = bps; }
    }
    updateMarkup.mutate({ affiliateId, defaultMarkupBps: defaultBps, categoryMarkup: catMap });
  }

  if (isLoading) return <div className="py-4 flex justify-center"><Spinner className="h-5 w-5" /></div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /> Affiliate Cost Invoice Calculator</p>
        <div className="flex items-end gap-3">
          <div className="space-y-1 flex-1 max-w-xs">
            <Label className="text-xs">Affiliate cabinet cost ($)</Label>
            <Input type="number" value={calcRetail} onChange={(e) => setCalcRetail(e.target.value)} placeholder="1000" />
          </div>
        </div>
        <div className="rounded-lg border border-border overflow-hidden text-sm">
          {[
            ["Affiliate cabinet cost", `$${baseline.toFixed(2)}`],
            ["Damage protection (1% of cost)", `$${damageFee.toFixed(2)}`],
            ["Credit card fee (4% of cost)", `$${cardFee.toFixed(2)}`],
            ["IT/platform fee (10% of cost, max $100)", `$${itFee.toFixed(2)}`],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between px-3 py-1.5 border-b border-border last:border-0">
              <span className="text-muted-foreground text-xs">{label}</span>
              <span className="tabular-nums text-xs">{val}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 bg-amber-50 font-semibold text-sm">
            <span>Affiliate invoice total</span><span className="tabular-nums text-amber-700">${floor.toFixed(2)}</span>
          </div>
        </div>
        {defaultMarkupBps > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm flex justify-between">
            <span className="text-emerald-800">Suggested customer price — cabinet cost only ({bpsToPercent(defaultMarkupBps)}% markup)</span>
            <span className="tabular-nums font-semibold text-emerald-800">${customerPrice.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <p className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Markup Settings</p>
        <div className="space-y-1">
          <Label className="text-xs">Default markup % (all styles unless overridden)</Label>
          <div className="flex items-center gap-2 max-w-xs">
            <Input type="number" min="0" step="0.5" value={defaultPct} onChange={(e) => setDefaultPct(e.target.value)} placeholder="e.g. 20" />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Per-category overrides <span className="text-muted-foreground">(optional)</span></Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRICE_CATEGORIES.map((cat) => (
              <div key={cat} className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">{PRICE_CATEGORY_LABELS[cat]}</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" min="0" step="0.5" value={categoryPcts[cat] ?? ""} onChange={(e) => setCategoryPcts((p) => ({ ...p, [cat]: e.target.value }))} placeholder={defaultPct || "default"} className="text-xs" />
                  <span className="text-muted-foreground text-xs">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Per-style overrides (Catalog tab) take priority over category overrides, which take priority over the default markup.
        </div>
        <Button onClick={save} disabled={updateMarkup.isPending} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" />{updateMarkup.isPending ? "Saving…" : "Save Pricing"}
        </Button>
      </div>
    </div>
  );
}

// ─── Admin Marketing Panel ────────────────────────────────────────────────────
function useQRCode(url: string) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    if (!url) return;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(url, { width: 256, margin: 2 }).then(setDataUrl).catch(() => {});
    });
  }, [url]);
  return dataUrl;
}

function AffiliateMarketingAdmin({ affiliate: a, origin }: { affiliate: AffiliateItem; origin: string }) {
  const storefrontUrl = affiliateStorefrontUrl(a.slug, origin);
  const referralUrl = `${origin}?ref=${a.referralCode}`;
  const qrDataUrl = useQRCode(storefrontUrl);

  const SCRIPTS = [
    { label: "Text Message", text: `Hey! I wanted to share my cabinet store with you. We have great prices on kitchen and bath cabinets — check it out: ${storefrontUrl}` },
    { label: "Email Subject", text: `Check out my cabinet store — ${a.storeName}` },
    { label: "Email Body", text: `Hi,\n\nI wanted to let you know about my cabinet store, ${a.storeName}. We carry a wide selection of kitchen and bath cabinets at trade pricing.\n\nBrowse the catalog here: ${storefrontUrl}\n\nFeel free to reach out with any questions!` },
    { label: "Social Media Post", text: `🏠 Looking for quality cabinets at great prices? Check out ${a.storeName}! We carry kitchen and bath cabinets with fast shipping. Shop now: ${storefrontUrl}` },
  ];

  return (
    <div className="space-y-5">
      <Tabs defaultValue="links">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="links" className="gap-1.5 text-xs"><QrCode className="h-3.5 w-3.5" /> Links & QR</TabsTrigger>
          <TabsTrigger value="scripts" className="gap-1.5 text-xs"><Megaphone className="h-3.5 w-3.5" /> Scripts</TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" /> Training</TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="space-y-4 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shareable Links</p>
              {[{ label: "Storefront", url: storefrontUrl }, { label: "Referral Link", url: referralUrl }].map(({ label, url }) => (
                <div key={label} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xs font-mono truncate">{url}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success(`${label} copied`))}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <a href={url} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="icon" className="h-6 w-6"><ExternalLink className="h-3 w-3" /></Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide self-start">QR Code</p>
              {qrDataUrl ? (
                <div className="rounded-xl border border-border p-2 bg-white">
                  <img src={qrDataUrl} alt="QR code" className="w-32 h-32" />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-xl border border-border flex items-center justify-center bg-muted">
                  <Spinner className="h-5 w-5" />
                </div>
              )}
              {qrDataUrl && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { const el = document.createElement("a"); el.href = qrDataUrl; el.download = `${a.slug}-qr.png`; el.click(); toast.success("QR downloaded"); }}>
                  <Download className="h-3 w-3" /> Download QR
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scripts" className="space-y-3 pt-3">
          {SCRIPTS.map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{s.label}</Label>
                <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => navigator.clipboard.writeText(s.text).then(() => toast.success(`${s.label} copied`))}>
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>
              <Textarea readOnly value={s.text} className="text-xs font-mono resize-none" rows={s.text.split("\n").length + 1} />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="training" className="space-y-3 pt-3">
          {[
            { icon: "🎯", title: "10 Steps to a Sale", desc: "Complete sales playbook from prospect to referral." },
            { icon: "📐", title: "Kitchen Design Fundamentals", desc: "Measurements, standard sizes, work triangle, and layouts." },
            { icon: "📊", title: "How to Use Your CRM", desc: "Turn your pipeline into predictable sales." },
            { icon: "✉️", title: "Marketing Scripts & Templates", desc: "Ready-to-use text, email, and social media templates." },
          ].map((g) => (
            <div key={g.title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <span className="text-2xl">{g.icon}</span>
              <div>
                <p className="font-semibold text-sm">{g.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">YouTube Resources</p>
            {[
              { name: "Alex Hormozi", url: "https://www.youtube.com/@AlexHormozi", desc: "Business growth, offers, and sales systems." },
              { name: "Jeremy Miner", url: "https://www.youtube.com/@JeremyMiner", desc: "Modern sales psychology and objection handling." },
            ].map((y) => (
              <a key={y.name} href={y.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 py-2 hover:text-primary transition-colors">
                <Youtube className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{y.name}</p>
                  <p className="text-xs text-muted-foreground">{y.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const TEMPLATES = AFFILIATE_STOREFRONT_TEMPLATES;

function CreateAffiliateDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<AffiliateStorefrontTemplate>("showcase");
  const [form, setForm] = useState({
    storeName: "", contactName: "", email: "", phone: "", website: "",
    location: "", slug: "", referralCode: "", commissionPct: "5",
  });

  const create = trpc.affiliates.adminCreate.useMutation({
    onSuccess: () => {
      toast.success("Affiliate created");
      setOpen(false);
      setStep("template");
      setSelectedTemplate("showcase");
      setForm({ storeName: "", contactName: "", email: "", phone: "", website: "", location: "", slug: "", referralCode: "", commissionPct: "5" });
      onCreated();
    },
    onError: (e) => toast.error("Could not create", { description: e.message }),
  });

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit() {
    if (!form.storeName.trim()) { toast.error("Store name is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Valid email required"); return; }
    const pct = Number(form.commissionPct);
    create.mutate({
      storeName: form.storeName.trim(),
      contactName: form.contactName || undefined,
      email: form.email.trim(),
      phone: form.phone || undefined,
      website: form.website || undefined,
      location: form.location || undefined,
      slug: form.slug || undefined,
      referralCode: form.referralCode || undefined,
      commissionRate: isNaN(pct) ? 0.05 : pct / 100,
      status: "active",
      template: selectedTemplate,
    });
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) { setStep("template"); setSelectedTemplate("showcase"); }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Affiliate</Button>
      </DialogTrigger>

      {/* ── Step 1: Template picker ── */}
      {step === "template" && (
        <DialogContent className="!flex h-[min(82dvh,36rem)] max-h-[calc(100dvh-1rem)] w-[min(54rem,calc(100vw-1rem))] flex-col overflow-hidden p-4 sm:max-w-none sm:p-5">
          <DialogHeader className="shrink-0 pr-7">
            <DialogTitle>Choose Affiliate Storefront Template</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Choose one of eight approved storefront presentations. Every option keeps the same white-label catalog, pricing, CRM routing, Designer access, and canonical links; only the public presentation changes.
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 pr-1">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {TEMPLATES.map((tpl) => {
                const active = tpl.id === selectedTemplate;
                return (
                  <div
                    key={tpl.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTemplate(tpl.id);
                      }
                    }}
                    className={
                      "relative min-w-0 cursor-pointer rounded-lg border-2 p-2.5 transition-all " +
                      (active
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50")
                    }
                  >
                    {active && (
                      <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div className="mb-1 flex min-w-0 items-start gap-1.5 pr-4">
                      <div className="truncate font-semibold text-sm">{tpl.name}</div>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{active ? "Selected" : tpl.badge}</span>
                    </div>
                    <p className="line-clamp-3 min-h-[3.75rem] text-xs leading-snug text-muted-foreground">{tpl.desc}</p>
                    <a
                      href={`/store-preview/${tpl.id}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Live preview
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setStep("details")}>
              Continue with {TEMPLATES.find((template) => template.id === selectedTemplate)?.name ?? "selected"} →
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {/* ── Step 2: Details form ── */}
      {step === "details" && (
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Affiliate</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Template: <span className="font-medium text-foreground">{TEMPLATES.find((template) => template.id === selectedTemplate)?.name ?? "Selected"}</span>
              {" — "}
              <button onClick={() => setStep("template")} className="text-primary hover:underline text-sm">Change</button>
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Store name *</Label>
              <Input value={form.storeName} onChange={(e) => setField("storeName", e.target.value)} placeholder="First Class Flooring & Cabinet Design" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact name</Label>
                <Input value={form.contactName} onChange={(e) => setField("contactName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="store@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={form.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://…" />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setField("location", e.target.value)} placeholder="Osprey, FL" />
              </div>
              <div className="space-y-1.5">
                <Label>Commission %</Label>
                <Input type="number" value={form.commissionPct} onChange={(e) => setField("commissionPct", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Storefront slug</Label>
                <Input value={form.slug} onChange={(e) => setField("slug", e.target.value)} placeholder="auto from name" className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Referral code</Label>
                <Input value={form.referralCode} onChange={(e) => setField("referralCode", e.target.value)} placeholder="auto from name" className="font-mono text-sm" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The affiliate signs in with this email to access their dashboard. Slug and referral code are
              generated from the store name if left blank.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("template")}>← Back</Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create affiliate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

// ─── Send Credentials Button ───────────────────────────────────────────────────
// Triggers adminSendCredentials which notifies the owner to forward credentials
// to the affiliate. Shows a confirmation dialog before sending.
function SendCredentialsButton({ affiliateId }: { affiliateId: number }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<{ email: string; welcomeGuideUrl?: string } | null>(null);
  const send = trpc.affiliates.adminSendCredentials.useMutation({
    onSuccess: (data) => {
      toast.success(`Credentials notification sent for ${data.email}`);
      setSent({ email: data.email, welcomeGuideUrl: data.welcomeGuideUrl });
    },
    onError: (err) => {
      toast.error(`Failed to send: ${err.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSent(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Send className="h-3.5 w-3.5" /> Send Credentials
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Credentials</DialogTitle>
        </DialogHeader>
        {sent ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-600 font-medium">✓ Notification sent for {sent.email}</p>
            <p className="text-sm text-muted-foreground">Include this Welcome Guide PDF when you email the affiliate their credentials:</p>
            {sent.welcomeGuideUrl && (
              <a
                href={sent.welcomeGuideUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm font-medium hover:bg-muted transition-colors"
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                Affiliate Welcome Guide (PDF)
              </a>
            )}
            <DialogFooter>
              <Button onClick={() => { setOpen(false); setSent(null); }}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This will notify the owner to send the affiliate's storefront URL, referral link, login portal, and Welcome Guide PDF to their email address.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => send.mutate({ id: affiliateId })}
                disabled={send.isPending}
              >
                {send.isPending ? "Sending…" : "Send Now"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
// ─── Admin affiliate login manager ───────────────────────────────────────────
// Passwords are never displayed or returned; the admin supplies a replacement
// password and the server stores only its bcrypt hash.
function AffiliateLoginManager({ affiliateId, currentEmail }: { affiliateId: number; currentEmail: string }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const manage = trpc.affiliates.adminManageCredentials.useMutation({
    onSuccess: (data) => {
      utils.affiliates.adminList.invalidate();
      toast.success(`Affiliate login updated for ${data.email ?? email}`);
      setPassword("");
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });
  const sendSetupInvite = trpc.affiliates.adminSendSetupInvite.useMutation({
    onSuccess: (data) => {
      utils.affiliates.adminList.invalidate();
      toast.success(`Password setup link sent to ${data.sentTo}`);
      setPassword("");
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });
  const submit = () => {
    const nextEmail = email.trim();
    manage.mutate({
      id: affiliateId,
      ...(nextEmail && nextEmail !== currentEmail.trim() ? { email: nextEmail } : {}),
      ...(password ? { password } : {}),
    });
  };
  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) { setEmail(currentEmail); setPassword(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> Manage Login
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Affiliate Login</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Change the sign-in email or send the affiliate a one-time link where they create their own password. Affiliate accounts remain ordinary non-admin accounts and cannot edit Cabinet Configuration.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`affiliate-email-${affiliateId}`}>Sign-in email</Label>
            <Input id={`affiliate-email-${affiliateId}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`affiliate-password-${affiliateId}`}>New password</Label>
            <Input id={`affiliate-password-${affiliateId}`} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Leave blank to keep the current password" autoComplete="new-password" />
            <p className="text-xs text-muted-foreground">Minimum 8 characters. The password is never shown after saving.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="secondary"
            onClick={() => sendSetupInvite.mutate({ id: affiliateId, email: email.trim() })}
            disabled={sendSetupInvite.isPending || !/^\S+@\S+\.\S+$/.test(email.trim())}
          >
            {sendSetupInvite.isPending ? "Sending…" : "Email password setup"}
          </Button>
          <Button onClick={submit} disabled={manage.isPending || (!password && email.trim() === currentEmail.trim())}>
            {manage.isPending ? "Saving…" : "Save Login"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// ─── Admin W-9 Review Panel ────────────────────────────────────────────────────
function AffiliateW9Review({ affiliate: a }: { affiliate: AffiliateItem }) {
  const utils = trpc.useUtils();
  const [adminNotes, setAdminNotes] = useState(a.w9AdminNotes ?? "");

  const verifyW9 = trpc.affiliates.adminVerifyW9.useMutation({
    onSuccess: () => {
      toast.success("W-9 status updated.");
      utils.affiliates.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (a.w9Status === "pending") {
    return (
      <div className="py-6 text-center space-y-2">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">This affiliate has not yet submitted their W-9 information.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-3">
        {a.w9Status === "verified" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-sm font-medium">
            <FileText className="h-4 w-4" /> Submitted — Awaiting Review
          </span>
        )}
        {a.w9SubmittedAt && (
          <span className="text-xs text-muted-foreground">
            Submitted {new Date(a.w9SubmittedAt).toLocaleDateString()}
          </span>
        )}
        {a.w9VerifiedAt && (
          <span className="text-xs text-muted-foreground">
            Verified {new Date(a.w9VerifiedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="grid gap-2 text-sm">
        <div className="flex gap-2">
          <span className="text-muted-foreground w-32 shrink-0">Legal Name</span>
          <span className="font-medium">{a.w9LegalName ?? "—"}</span>
        </div>
      </div>

      {a.w9IdDocumentUrl && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Government ID</p>
          <a
            href={a.w9IdDocumentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View uploaded ID document
          </a>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`w9-notes-${a.id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin Notes</Label>
        <textarea
          id={`w9-notes-${a.id}`}
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Internal notes on this W-9 (not visible to affiliate)"
        />
      </div>

      {a.w9Status !== "verified" && (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            onClick={() => verifyW9.mutate({ affiliateId: a.id, action: "verify", adminNotes })}
            disabled={verifyW9.isPending}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Verify W-9
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive/10 gap-1.5"
            onClick={() => verifyW9.mutate({ affiliateId: a.id, action: "reject", adminNotes })}
            disabled={verifyW9.isPending}
          >
            Reject &amp; Request Re-submission
          </Button>
        </div>
      )}
    </div>
  );
}
