import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { affiliateDashboardLinks, affiliateDashboardPath, affiliateDesignerPath, affiliateStorefrontUrl } from "@/lib/affiliateStorefrontUrl";
import { resolveAffiliateDashboardSelection } from "@/lib/affiliateDashboardSelection";
import { useAuth } from "@/_core/hooks/useAuth";
import { AffiliateDashboardLayout, type AffiliateSection } from "@/components/affiliate/AffiliateDashboardLayout";
import AffiliatePricingPanel from "@/components/affiliate/AffiliatePricingPanel";
import AffiliateCatalogPanel from "@/components/affiliate/AffiliateCatalogPanel";
import AffiliateAnalyticsPanel from "@/components/affiliate/AffiliateAnalyticsPanel";
import { AffiliateImageCabinet } from "@/components/affiliate/AffiliateImageCabinet";
import AffiliateMarketingHub from "@/components/affiliate/AffiliateMarketingHub";
import AffiliatePromotionsPanel from "@/components/affiliate/AffiliatePromotionsPanel";
import { AffiliatePluginsPanel } from "@/components/affiliate/AffiliatePluginsPanel";
import { AffiliateAppointmentsPanel } from "@/components/affiliate/AffiliateAppointmentsPanel";
import { InstallationEstimatesPanel } from "@/components/affiliate/InstallationEstimatesPanel";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Copy, ExternalLink, DollarSign, Package, CheckCircle2, Store,
  LinkIcon, Save, Loader2, PencilRuler, Globe, Users,
  ArrowRight, Sparkles, Star, TrendingUp, Shield, Palette, Truck,
  Wand2, Send, ChevronRight, ImageIcon, FileText, AlertCircle, Upload, Eye, EyeOff,
  ShoppingBag, BarChart2, BookOpen, Tag, Megaphone, Wrench, Share2, Facebook, Linkedin, Info,
} from "lucide-react";
import { CrmBoard } from "@/components/crm/CrmBoard";
import {
  AFFILIATE_MEMBERSHIP,
  formatMembershipPrice,
} from "@shared/affiliate";
import {
  AFFILIATE_STOREFRONT_TEMPLATES,
  type AffiliateStorefrontTemplate,
} from "@shared/affiliateStorefrontTemplates";
import { KITCHEN_SCENES } from "@/lib/doorFamilyPhotos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MEMBERSHIP_BENEFIT_ICONS = [PencilRuler, Globe, Users];

// ─── Affiliate Landing Page (shown to non-members) ──────────────────────────
function AffiliateLanding() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-[var(--color-navy)] text-white">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-[var(--color-gold)]" />
              Cabinet Dealz Affiliate Program
            </span>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold mt-6 leading-tight">
              Launch Your Own{" "}
              <span className="text-[var(--color-gold)]">Cabinet Business</span>{" "}
              — Without the Overhead
            </h1>
            <p className="text-white/80 text-lg md:text-xl mt-6 leading-relaxed">
              One annual membership gives you a fully branded storefront, the 3D Kitchen Designer,
              access to thousands of cabinets and surfaces at trade pricing, and we handle all the fulfillment.
              A single completed kitchen order typically returns more than the membership costs.
            </p>
            <div className="mt-10 flex flex-wrap items-end gap-6">
              <div>
                <span className="font-serif text-5xl md:text-6xl font-bold text-[var(--color-gold)]">
                  {formatMembershipPrice()}
                </span>
                <span className="text-white/70 text-lg ml-2">
                  per {AFFILIATE_MEMBERSHIP.billingPeriod}
                </span>
              </div>
              <Link href="/pro-network">
                <Button size="lg" className="bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]/90 font-bold text-base px-8 gap-2">
                  Apply Now <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What You're Actually Buying */}
      <section className="container py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            Not Just a Website — A Complete, Ready-to-Run Business
          </h2>
          <p className="text-muted-foreground text-lg mt-4">
            Built independently, this is a multi-thousand-dollar project plus a developer on retainer.
            With Cabinet Dealz, you get it all for one annual fee.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Palette,
              title: "Fully Branded Storefront",
              desc: "Your logo, your colors, your own web address. Customers see YOUR brand — not ours.",
            },
            {
              icon: Package,
              title: "Entire Product Catalog",
              desc: "Thousands of cabinets across dozens of door styles, plus surfaces, faucets, and fixtures — kept current for you.",
            },
            {
              icon: PencilRuler,
              title: "3D Kitchen Designer",
              desc: "Build rooms in 3D, place cabinets, and price jobs instantly. Your customers design their dream kitchen right on your site.",
            },
            {
              icon: Globe,
              title: "Bilingual Experience",
              desc: "Full English + Spanish customer experience built in. Reach more customers without extra work.",
            },
            {
              icon: Shield,
              title: "Hosting, Updates & Support",
              desc: "We handle security, uptime, catalog updates, and technical support — every year, handled for you.",
            },
            {
              icon: Truck,
              title: "We Handle Fulfillment",
              desc: "You sell, we ship. Orders go directly to our supply network and ship to your customer. Zero inventory.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-[var(--color-navy)]/10 flex items-center justify-center">
                <item.icon className="h-6 w-6 text-[var(--color-navy)]" />
              </div>
              <h3 className="font-serif text-lg font-bold mt-4">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Numbers */}
      <section className="bg-muted/40 py-16 md:py-20">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold">
              The Math Works in Your Favor
            </h2>
            <p className="text-muted-foreground text-lg mt-4">
              One kitchen order can return more than your annual membership. Every order after that is profit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="font-serif text-4xl md:text-5xl font-bold text-[var(--color-navy)]">
                {formatMembershipPrice()}
              </div>
              <div className="text-sm text-muted-foreground mt-2">Annual membership</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-4xl md:text-5xl font-bold text-emerald-600">
                $2,500+
              </div>
              <div className="text-sm text-muted-foreground mt-2">Average kitchen order margin</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-4xl md:text-5xl font-bold text-[var(--color-gold)]">
                $0
              </div>
              <div className="text-sm text-muted-foreground mt-2">Inventory or shipping costs</div>
            </div>
          </div>

          <div className="mt-12 max-w-2xl mx-auto">
            <div className="rounded-xl border border-border bg-card p-6 md:p-8">
              <div className="flex items-start gap-3">
                <Star className="h-6 w-6 text-[var(--color-gold)] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-lg">Trade Pricing Built In</div>
                  <p className="text-muted-foreground mt-1">
                    As a member, you order at buying-group pricing across our entire supply network.
                    Set your own markups on every door style. Your margin, your rules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            Up and Running in Days, Not Months
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            { step: "1", title: "Apply", desc: "Fill out a quick application" },
            { step: "2", title: "Brand It", desc: "Upload your logo, pick colors" },
            { step: "3", title: "Set Pricing", desc: "Choose your markups" },
            { step: "4", title: "Start Selling", desc: "Share your link & earn" },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-navy)] text-white font-bold text-lg flex items-center justify-center mx-auto">
                {s.step}
              </div>
              <div className="font-semibold mt-3">{s.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Who It's For */}
      <section className="bg-[var(--color-navy)] text-white py-16 md:py-20">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold">
              Built for the Cabinet Trade
            </h2>
            <p className="text-white/70 text-lg mt-4">
              Whether you supply, sell, or refer — there's a membership workflow designed for you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: TrendingUp,
                title: "Contractors & Remodelers",
                desc: "Offer cabinets to your clients without managing inventory. Design, quote, and order — all from one platform.",
              },
              {
                icon: Store,
                title: "Kitchen Dealers & Showrooms",
                desc: "Expand your catalog instantly. Access dozens of door styles and surfaces without stocking a single unit.",
              },
              {
                icon: Users,
                title: "Referral Partners",
                desc: "Share your link, earn on every order. No selling required — just connect people to great cabinets.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
                <item.icon className="h-8 w-8 text-[var(--color-gold)]" />
                <h3 className="font-serif text-lg font-bold mt-4">{item.title}</h3>
                <p className="text-sm text-white/70 mt-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 md:py-20">
        <div className="rounded-2xl border border-border bg-muted/30 p-8 md:p-12 text-center max-w-3xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            Ready to Start Your Cabinet Business?
          </h2>
          <p className="text-muted-foreground text-lg mt-4 mb-8">
            Join the network. Get your storefront. Start earning.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/pro-network">
              <Button size="lg" className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90 font-bold text-base px-8 gap-2">
                Apply to Join <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <a href={getLoginUrl()}>
              <Button size="lg" variant="outline" className="gap-2">
                Already a member? Sign in
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            {formatMembershipPrice()}/{AFFILIATE_MEMBERSHIP.billingPeriod} · Free to apply · No inventory required
          </p>
        </div>
      </section>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    confirmed: "border-emerald-400/60 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
    submitted: "border-blue-400/60 text-blue-600 bg-blue-50 dark:bg-blue-950/30",
    draft: "border-muted-foreground/40 text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}

export default function AffiliateDashboard() {
  const { isAuthenticated, loading, user } = useAuth();
  const utils = trpc.useUtils();
  // Admin "View as" support: ?viewAs=<affiliateId> lets admins see any affiliate's dashboard
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const viewAsId = params.get("viewAs");

  // Deep-link support: ?section=customize opens that panel directly.
  const VALID_SECTIONS = [
    "overview",
    "crm",
    "design",
    "products",
    "orders",
    "earnings",
    "analytics",
    "catalog",
    "images",
    "pricing",
    "promotions",
    "appointments",
    "customize",
    "marketing",
    "bundles",
    "plugins",
    "tax",
    "team",
    "settings",
  ] as const;
  const sectionParam = params.get("section");
  const initialSection = (
    sectionParam && (VALID_SECTIONS as readonly string[]).includes(sectionParam)
      ? sectionParam
      : "overview"
  ) as AffiliateSection;
  const [section, setSection] = useState<AffiliateSection>(initialSection);

  const isAdmin = user?.role === "admin";
  // Incrementing this key causes StorefrontPreviewPanel to reload its iframe.
  // Lifted here (parent of both CustomizeTab and StorefrontPreviewPanel) so a
  // save inside CustomizeTab can trigger a refresh of the sibling panel.
  const [previewKey, setPreviewKey] = useState(0);

  const dashboardSelection = resolveAffiliateDashboardSelection(viewAsId, isAdmin);
  const isAdminViewAs = dashboardSelection.kind === "admin-view-as";

  const myRef = trpc.affiliates.myReferrals.useQuery(undefined, {
    enabled: isAuthenticated && !isAdmin,
    retry: false,
  });

  const adminRef = trpc.affiliates.adminReferrals.useQuery(
    { affiliateId: isAdminViewAs ? dashboardSelection.affiliateId : 0 },
    { enabled: isAdminViewAs, retry: false }
  );

  // Admin without ?viewAs= param: load the full affiliate list and require an
  // explicit selection. Falling back to the first row silently showed one
  // affiliate's URLs inside another affiliate workflow.
  const adminList = trpc.affiliates.adminList.useQuery(undefined, {
    enabled: isAdmin && !isAdminViewAs,
    retry: false,
  });

  const myAccess = trpc.affiliates.myAccess.useQuery(undefined, {
    enabled: isAuthenticated && !isAdmin && !isAdminViewAs,
    retry: false,
  });
  const refreshOrderRail = () => {
    void utils.affiliates.myReferrals.invalidate();
    void utils.affiliates.adminReferrals.invalidate();
  };
  const approveForInventory = trpc.orders.affiliateApproveForInventory.useMutation({
    onSuccess: () => { refreshOrderRail(); toast.success("Approved and routed to the distributor inventory check."); },
    onError: (error) => toast.error(error.message),
  });
  const approveDistributorInvoice = trpc.orders.affiliateApproveDistributorInvoice.useMutation({
    onSuccess: () => { refreshOrderRail(); toast.success("Updated distributor invoice approved. Fulfillment is authorized."); },
    onError: (error) => toast.error(error.message),
  });
  const access = isAdmin || isAdminViewAs
    ? { isOwner: true, accessCrm: true, accessDesigner: true }
    : (myAccess.data ?? { isOwner: true, accessCrm: true, accessDesigner: true });

  useEffect(() => {
    if ((section === "crm" && !access.accessCrm) || (section === "design" && !access.accessDesigner) || (section === "team" && !access.isOwner)) {
      setSection("overview");
    }
  }, [access.accessCrm, access.accessDesigner, access.isOwner, section]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AffiliateLanding />;
  }

  if (dashboardSelection.kind === "admin-picker") {
    if (adminList.isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner className="h-7 w-7" />
        </div>
      );
    }
    const affiliateChoices = (adminList.data ?? []) as Array<{ id: number; storeName: string; slug: string; referralCode: string }>;
    return (
      <div className="container max-w-2xl py-12 space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold">Choose an Affiliate Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Select a specific affiliate so its storefront and referral links never mix with another record.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {affiliateChoices.map((choice) => (
            <a key={choice.id} href={affiliateDashboardPath(choice.id)} className="rounded-xl border border-border bg-card p-5 hover:border-primary hover:bg-primary/5 transition-colors">
              <p className="font-semibold">{choice.storeName}</p>
              <p className="mt-1 text-xs text-muted-foreground font-mono">{choice.referralCode}</p>
            </a>
          ))}
        </div>
      </div>
    );
  }

  // Determine which query to use based on role and context
  const activeQuery: typeof myRef = isAdminViewAs ? adminRef : myRef;

  if (activeQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!activeQuery.data) {
    // Admin should never see the landing page - show a message instead
    if (isAdmin) {
      return (
        <div className="container max-w-md py-20 text-center">
          <h1 className="font-serif text-2xl font-bold mb-3">No Affiliates Yet</h1>
          <p className="text-muted-foreground mb-6">Create your first affiliate from the Admin panel.</p>
          <a href="/admin">
            <Button className="bg-[var(--color-navy)] text-white">Go to Admin</Button>
          </a>
        </div>
      );
    }
    return <AffiliateLanding />;
  }

  const { affiliate, orders, summary, commissionRate } = activeQuery.data;
  const { storefrontUrl: storeUrl, referralUrl: refLink } = affiliateDashboardLinks(affiliate);
  const hardwareUrl = `${storeUrl.replace(/\/$/, "")}/hardware`;

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Could not copy")
    );
  }

  function renderSection() {
    switch (section) {
      case "design":
        return (
          <div className="max-w-2xl space-y-5">
            <div>
              <h1 className="font-serif text-2xl font-bold">Design Workspace</h1>
              <p className="mt-2 text-muted-foreground">Open the branded kitchen designer for this affiliate storefront.</p>
            </div>
            <a
              href={`${storeUrl.replace(/\/$/, "")}/design`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open 3D Designer <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        );
      case "products":
        return (
          <div className="max-w-4xl space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h1 className="font-serif text-2xl font-bold">Products</h1>
              </div>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Find the non-cabinet products customers can browse through your branded storefront. Every destination keeps your affiliate branding, referral attribution, and pricing context.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <a href={`${storeUrl.replace(/\/$/, "")}/surfaces`} className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-primary/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-primary/10 p-3"><Package className="h-6 w-6 text-primary" /></div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <h2 className="mt-5 text-lg font-semibold">Pelican Products</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Browse countertops, flooring, tile, sinks, faucets, tubs, toilets, showers, and other bathroom products.</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Browse Pelican catalog <ArrowRight className="h-4 w-4" /></span>
              </a>
              <a href={`${storeUrl.replace(/\/$/, "")}/closet`} className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-primary/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-primary/10 p-3"><PencilRuler className="h-6 w-6 text-primary" /></div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <h2 className="mt-5 text-lg font-semibold">Closet Studio</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Plan towers, hanging areas, shelves, corner pieces, drawers, and visual basket layouts in your branded closet workspace.</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Open Closet Studio <ArrowRight className="h-4 w-4" /></span>
              </a>
              <a href={hardwareUrl} className="group rounded-2xl border border-sky-200 bg-sky-50/40 p-6 transition-colors hover:border-primary hover:bg-primary/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-sky-100 p-3"><Package className="h-6 w-6 text-sky-800" /></div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <h2 className="mt-5 text-lg font-semibold">Hardware Resources</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Browse decorative knobs, pulls, and finishes in your branded hardware catalog. Customer prices use your separate above-list hardware markup.</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Browse hardware catalog <ArrowRight className="h-4 w-4" /></span>
              </a>
            </div>
          </div>
        );
      case "images":
        return <AffiliateImageCabinet />;
      case "overview":
        return (
          <div className="space-y-6 max-w-4xl">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-serif text-2xl font-bold">{affiliate.storeName}</h1>
                {statusBadge(affiliate.status)}
              </div>
              <p className="text-muted-foreground text-sm">
                {(commissionRate * 100).toFixed(1)}% commission on confirmed orders
              </p>
            </div>
            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: Package, label: "Referred orders", value: summary.referredCount },
                { icon: CheckCircle2, label: "Confirmed", value: summary.confirmedCount },
                { icon: DollarSign, label: "Commission earned", value: `$${summary.commission.toFixed(2)}` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1.5">
                    <s.icon className="h-4 w-4" /> {s.label}
                  </div>
                  <div className="font-serif text-3xl font-bold tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>
            {/* Quick links */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <LinkIcon className="h-4 w-4" /> Your links
              </h2>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Branded storefront</Label>
                <div className="flex gap-2">
                  <Input readOnly value={storeUrl} className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={() => copy(storeUrl, "Storefront link")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <a href={storeUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                  </a>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Quick referral link (code: <span className="font-mono">{affiliate.referralCode}</span>)
                </Label>
                <div className="flex gap-2">
                  <Input readOnly value={refLink} className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={() => copy(refLink, "Referral link")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            {/* Quick nav shortcuts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                { label: "My CRM", section: "crm" as AffiliateSection, icon: ShoppingBag },
                { label: "Pelican & Closets", section: "products" as AffiliateSection, icon: Package },
                { label: "Earnings", section: "earnings" as AffiliateSection, icon: DollarSign },
                { label: "Analytics", section: "analytics" as AffiliateSection, icon: BarChart2 },
                { label: "My Catalog", section: "catalog" as AffiliateSection, icon: BookOpen },
                { label: "Pricing", section: "pricing" as AffiliateSection, icon: Tag },
                { label: "Hardware pricing", section: "pricing" as AffiliateSection, icon: Package },
                { label: "Marketing Hub", section: "marketing" as AffiliateSection, icon: Megaphone },
                { label: "Installation", section: "installation" as AffiliateSection, icon: Wrench },
              ] as const).map((item) => (
                <button
                  key={`${item.section}-${item.label}`}
                  onClick={() => setSection(item.section)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <item.icon className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case "crm":
        return (
          <div className="max-w-full">
            <h2 className="text-xl font-bold mb-4">My CRM</h2>
            <CrmBoard lang="en" affiliateId={affiliate.id} />
          </div>
        );
      case "orders":
        return (
          <div className="max-w-4xl">
            <h2 className="text-xl font-bold mb-4">Referred Orders</h2>
            {orders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                No referred orders yet. Share your storefront or referral link to start earning.
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Order rail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => {
                      const total = o.totalAmount === null ? null : Number(o.totalAmount);
                      const commission =
                        o.status === "confirmed" && total != null
                          ? total * commissionRate
                          : null;
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-sm">{o.requestNumber ?? `#${o.id}`}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{o.originatorName || o.originatorEmail || "—"}</TableCell>
                          <TableCell className="space-y-1">{statusBadge(o.status)}<div className="text-xs text-muted-foreground">{String(o.orderRailStatus ?? "awaiting_payment").replaceAll("_", " ")}</div></TableCell>
                          <TableCell className="text-right tabular-nums">
                            {total != null ? `$${total.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {commission != null ? `$${commission.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            {o.orderRailStatus === "affiliate_review" && access.isOwner && (
                              <Button size="sm" disabled={approveForInventory.isPending} onClick={() => approveForInventory.mutate({ id: o.id })}>Approve for inventory</Button>
                            )}
                            {o.orderRailStatus === "affiliate_invoice_review" && access.isOwner && (
                              <div className="space-y-1"><p className="text-xs text-muted-foreground">Invoice {o.distributorInvoiceReference}: {o.distributorInvoiceAmount == null ? "—" : `$${Number(o.distributorInvoiceAmount).toFixed(2)}`}</p><Button size="sm" disabled={approveDistributorInvoice.isPending} onClick={() => approveDistributorInvoice.mutate({ id: o.id })}>Approve fulfillment</Button></div>
                            )}
                            {o.orderRailStatus === "distributor_inventory_check" && <span className="text-xs text-muted-foreground">Waiting for distributor</span>}
                            {o.orderRailStatus === "fulfillment_authorized" && <span className="text-xs font-medium text-emerald-700">Fulfillment authorized</span>}
                            {o.orderRailStatus === "awaiting_payment" && <span className="text-xs text-muted-foreground">Awaiting Stripe payment</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      case "earnings":
        return <EarningsPanel />;
      case "analytics":
        return <AffiliateAnalyticsPanel />;
      case "catalog":
        return <AffiliateCatalogPanel affiliateId={affiliate.id} isAdminView={isAdminViewAs} />;
      case "pricing":
        return <AffiliatePricingPanel affiliateId={affiliate.id} isAdminView={isAdminViewAs} hardwareCatalogHref={hardwareUrl} />;
      case "customize":
      return (
          <div className="flex gap-6 items-start w-full">
            {/* ── Settings column ─────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 max-w-3xl">
              <h2 className="text-xl font-bold mb-4">Customize Store</h2>
              <CustomizeTab
                affiliate={affiliate}
                isAdmin={isAdmin}
                onSaved={() => { activeQuery.refetch(); setPreviewKey((k) => k + 1); }}
              />
            </div>

            {/* ── Live preview column — visible only on xl+ ────────────── */}
            <StorefrontPreviewPanel slug={affiliate.slug} externalKey={previewKey} />
          </div>
      );
      case "plugins":
        return (
          <AffiliatePluginsPanel
            affiliateId={affiliate.id}
            isAdmin={isAdmin}
            embedCodeDraft={affiliate.embedCodeDraft}
            embedEnabled={Boolean(affiliate.embedEnabled)}
            storeName={affiliate.storeName}
            onSaved={() => { activeQuery.refetch(); setPreviewKey((k) => k + 1); }}
          />
        );
      case "promotions":
        return (
          <div className="max-w-4xl">
            <AffiliatePromotionsPanel />
          </div>
        );
      case "appointments":
        return (
          <div className="max-w-4xl">
            <AffiliateAppointmentsPanel />
          </div>
        );
      case "installation":
        return <InstallationEstimatesPanel affiliateId={affiliate.id} />;
      case "marketing":
        return <AffiliateMarketingHub />;
      case "bundles":
        return <AffiliateBundleDealsPanel affiliateId={affiliate.id} />;
      case "tax":
        return (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold mb-4">Tax Info (W-9)</h2>
            <W9Panel />
          </div>
        );
      case "team":
        return <AffiliateTeamPanel />;
      case "settings":
        return (
          <div className="space-y-6 max-w-4xl">
            <CustomDomainGuide
              storefrontSlug={affiliate.slug}
              defaultDomain={`${affiliate.slug}.cabinetdealz.com`}
            />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <AffiliateDashboardLayout
      section={section}
      onSection={setSection}
      storeName={affiliate.storeName}
      storeSlug={affiliate.slug}
      affiliateId={affiliate.id}
      isAffiliateOwner={access.isOwner}
      canAccessCrm={access.accessCrm}
      canAccessDesigner={access.accessDesigner}
    >
      {renderSection()}
    </AffiliateDashboardLayout>
  );
}

// ─── Credentials Panel ─────────────────────────────────────────────────────────
type CredentialsPanelProps = {
  affiliate: {
    storeName: string;
    slug: string;
    referralCode: string;
    template: string | null;
    email?: string | null;
    contactName?: string | null;
  };
  storeUrl: string;
  refLink: string;
  onCopy: (text: string, label: string) => void;
};

function CredentialsPanel({ affiliate, storeUrl, refLink, onCopy }: CredentialsPanelProps) {
  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/affiliate` : "/affiliate";
  const templateName = affiliate.template
    ? affiliate.template.charAt(0).toUpperCase() + affiliate.template.slice(1)
    : "Classic";
  const previewUrl = `/store-preview/${affiliate.template ?? "classic"}`;

  return (
    <div className="space-y-6">
      {/* Access credentials */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Your Access Credentials
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Affiliate Portal Login</Label>
            <div className="flex gap-2">
              <Input readOnly value={loginUrl} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => onCopy(loginUrl, "Login URL")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Sign in with your Cabinet Dealz account to access this dashboard.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Referral Code</Label>
            <div className="flex gap-2">
              <Input readOnly value={affiliate.referralCode} className="font-mono text-sm font-bold tracking-widest" />
              <Button variant="outline" size="icon" onClick={() => onCopy(affiliate.referralCode, "Referral code")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Embed this code in any link to tag orders to your account.</p>
          </div>
        </div>
      </div>

      {/* Storefront links */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> Your Storefront Links
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Branded Storefront URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={storeUrl} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => onCopy(storeUrl, "Storefront URL")}>
                <Copy className="h-4 w-4" />
              </Button>
              <a href={storeUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="icon"><ExternalLink className="h-4 w-4" /></Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">Share this link with customers — it's your fully branded cabinet store.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quick Referral Link (tags any order)</Label>
            <div className="flex gap-2">
              <Input readOnly value={refLink} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => onCopy(refLink, "Referral link")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Use this on social media or email — any order placed through it earns you commission.</p>
          </div>
        </div>
      </div>

      {/* Template */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Storefront Template
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current:</span>
            <span className="font-semibold text-sm">{templateName}</span>
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Preview
              </Button>
            </a>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          To change your template, go to the <strong>Customize</strong> tab. You can preview all eight templates before choosing.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {AFFILIATE_STOREFRONT_TEMPLATES.map(({ id: t, name }) => (
            <a key={t} href={`/store-preview/${t}`} target="_blank" rel="noreferrer"
              className={`rounded-lg border p-3 text-center text-sm hover:border-primary transition-colors cursor-pointer ${
                (affiliate.template ?? "classic") === t ? "border-primary bg-primary/5 font-semibold" : "border-border"
              }`}>
              {name}
              {(affiliate.template ?? "classic") === t && (
                <span className="ml-1 text-xs text-primary">(active)</span>
              )}
            </a>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <a href={storeUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2">
              <Store className="h-4 w-4" /> View My Storefront
            </Button>
          </a>
          <a href={affiliateDesignerPath(affiliate.slug)}>
            <Button variant="outline" className="gap-2">
              <PencilRuler className="h-4 w-4" /> Open 3D Designer
            </Button>
          </a>
          <Button variant="outline" className="gap-2" onClick={() => {
            const text = `Your affiliate credentials:\n\nStorefront: ${storeUrl}\nReferral link: ${refLink}\nReferral code: ${affiliate.referralCode}\nLogin: ${loginUrl}`;
            onCopy(text, "All credentials");
          }}>
            <Copy className="h-4 w-4" /> Copy All Credentials
          </Button>
          <a href="/manus-storage/Cabinet-Dealz-Affiliate-Welcome-Guide_f17152cc.pdf" target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              <Send className="h-4 w-4" /> Download Welcome Guide
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Customize Tab ──────────────────────────────────────────────────────────────
// Combines the BrandingEditor (template, colors, logo, tagline, about, socials)
// with a Room Scene Picker and an AI Concierge upsell card.

type AffiliateRow = {
  id: number;
  slug: string;
  referralCode: string;
  storeName: string;
  email: string | null;
  website: string | null;
  phone: string | null;
  location: string | null;
  updatedAt?: Date | string | null;
  tagline: string | null;
  taglineEs: string | null;
  aboutText: string | null;
  aboutTextEs: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  publicAddress: string | null;
  logoUrl: string | null;
  watermarkEnabled?: boolean | null;
  watermarkPosition?: "bottom-right" | null;
  watermarkOpacityBps?: number | null;
  heroImageUrl: string | null;
  serviceArea: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  storefrontEnabled: boolean | null;
  template: AffiliateStorefrontTemplate | null;
  fontFamily: string | null;
  headingFont: string | null;
  buttonRadius: string | null;
  embedCodeDraft?: string | null;
  embedEnabled?: boolean | null;
};

// ── Typography options ──────────────────────────────────────────────────────
const BODY_FONTS = [
  { value: "Inter", label: "Inter (Modern Sans-serif)" },
  { value: "Lato", label: "Lato (Clean & Friendly)" },
  { value: "Open Sans", label: "Open Sans (Neutral)" },
  { value: "Merriweather", label: "Merriweather (Serif)" },
  { value: "Roboto", label: "Roboto (Google Default)" },
  { value: "Source Sans 3", label: "Source Sans (Professional)" },
];
const HEADING_FONTS = [
  { value: "Playfair Display", label: "Playfair Display (Elegant Serif)" },
  { value: "Montserrat", label: "Montserrat (Bold Sans)" },
  { value: "Raleway", label: "Raleway (Geometric)" },
  { value: "Oswald", label: "Oswald (Condensed)" },
  { value: "Lora", label: "Lora (Literary Serif)" },
  { value: "Nunito", label: "Nunito (Rounded)" },
];
const BUTTON_RADII = [
  { value: "0px", label: "Sharp (0px)" },
  { value: "0.375rem", label: "Slightly Rounded (6px)" },
  { value: "0.75rem", label: "Rounded (12px)" },
  { value: "9999px", label: "Pill (fully rounded)" },
];

const TEMPLATE_THUMBNAILS: Record<AffiliateStorefrontTemplate, string> = {
  classic: "/manus-storage/classic_37966efb.jpg",
  showcase: "/manus-storage/showcase_888cd21d.jpg",
  minimal: "/manus-storage/minimal_ecbddcb9.jpg",
  craftsman: "/manus-storage/craftsman_1a0d1798.jpg",
  coastal: KITCHEN_SCENES["shaker-white"],
  gallery: KITCHEN_SCENES["shaker-espresso"],
  studio: KITCHEN_SCENES["slab-natural"],
  heritage: KITCHEN_SCENES["raised-cherry"],
};

const TEMPLATES = AFFILIATE_STOREFRONT_TEMPLATES.map((template) => ({
  ...template,
  thumb: TEMPLATE_THUMBNAILS[template.id],
}));

type KitchenSceneKey = "shaker-white" | "shaker-gray" | "shaker-espresso" | "raised-cherry" | "slab-natural";

type WebsiteBrandImportDraft = {
  sourceUrl: string;
  storeName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  publicAddress: string | null;
  aboutText: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  testimonials: Array<{ quote: string; author: string | null; sourceUrl: string }>;
};

const SCENE_LABELS: Record<KitchenSceneKey, { name: string; desc: string }> = {
  "shaker-white": { name: "White Shaker", desc: "Bright, timeless, and universally loved." },
  "shaker-gray": { name: "Gray Shaker", desc: "Warm greige — modern farmhouse feel." },
  "shaker-espresso": { name: "Espresso", desc: "Rich, dramatic, and contemporary." },
  "raised-cherry": { name: "Cherry Raised Panel", desc: "Classic warm wood with traditional depth." },
  "slab-natural": { name: "Natural Wood Slab", desc: "Sleek European-modern with warmth." },
};

function CustomizeTab({
  affiliate,
  onSaved,
  isAdmin,
}: {
  affiliate: AffiliateRow;
  onSaved: () => void;
  isAdmin?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState<AffiliateStorefrontTemplate | null>(null);
  const formFromAffiliate = (a: AffiliateRow) => ({
    storeName: a.storeName ?? "",
    tagline: a.tagline ?? "",
    taglineEs: a.taglineEs ?? "",
    aboutText: a.aboutText ?? "",
    aboutTextEs: a.aboutTextEs ?? "",
    primaryColor: a.primaryColor ?? "",
    accentColor: a.accentColor ?? "",
    publicEmail: a.publicEmail ?? a.email ?? "",
    publicPhone: a.publicPhone ?? a.phone ?? "",
    publicAddress: a.publicAddress ?? a.location ?? "",
    logoUrl: a.logoUrl ?? "",
    watermarkEnabled: a.watermarkEnabled ?? false,
    watermarkPosition: "bottom-right" as const,
    watermarkOpacityBps: a.watermarkOpacityBps ?? 7200,
    heroImageUrl: a.heroImageUrl ?? "",
    serviceArea: a.serviceArea ?? "",
    facebookUrl: a.facebookUrl ?? "",
    instagramUrl: a.instagramUrl ?? "",
    storefrontEnabled: a.storefrontEnabled ?? true,
    template: (a.template ?? "classic") as AffiliateStorefrontTemplate,
    fontFamily: a.fontFamily ?? "",
    headingFont: a.headingFont ?? "",
    buttonRadius: a.buttonRadius ?? "0.375rem",
  });
  const [form, setForm] = useState({
    storeName: affiliate.storeName ?? "",
    tagline: affiliate.tagline ?? "",
    taglineEs: affiliate.taglineEs ?? "",
    aboutText: affiliate.aboutText ?? "",
    aboutTextEs: affiliate.aboutTextEs ?? "",
    primaryColor: affiliate.primaryColor ?? "",
    accentColor: affiliate.accentColor ?? "",
    publicEmail: affiliate.publicEmail ?? affiliate.email ?? "",
    publicPhone: affiliate.publicPhone ?? affiliate.phone ?? "",
    publicAddress: affiliate.publicAddress ?? affiliate.location ?? "",
    logoUrl: affiliate.logoUrl ?? "",
    watermarkEnabled: affiliate.watermarkEnabled ?? false,
    watermarkPosition: "bottom-right" as const,
    watermarkOpacityBps: affiliate.watermarkOpacityBps ?? 7200,
    heroImageUrl: affiliate.heroImageUrl ?? "",
    serviceArea: affiliate.serviceArea ?? "",
    facebookUrl: affiliate.facebookUrl ?? "",
    instagramUrl: affiliate.instagramUrl ?? "",
    storefrontEnabled: affiliate.storefrontEnabled ?? true,
    template: (affiliate.template ?? "classic") as AffiliateStorefrontTemplate,
    fontFamily: affiliate.fontFamily ?? "",
    headingFont: affiliate.headingFont ?? "",
    buttonRadius: affiliate.buttonRadius ?? "0.375rem",
  });
  const [showLaunchSuccess, setShowLaunchSuccess] = useState(false);
  const [websiteImportUrl, setWebsiteImportUrl] = useState(affiliate.website ?? "");
  const [websiteImportDraft, setWebsiteImportDraft] = useState<WebsiteBrandImportDraft | null>(null);
  const [selectedImportedTestimonialQuotes, setSelectedImportedTestimonialQuotes] = useState<string[]>([]);

  // Re-sync the form whenever a different affiliate is loaded, or fresh data
  // arrives from the server after a save. Without this, the fields keep showing
  // the values captured on first mount and a successful save looks like it
  // "reverted".
  const syncKey = `${affiliate.id}:${String(affiliate.updatedAt ?? "")}`;
  const lastSyncRef = useRef(syncKey);
  useEffect(() => {
    if (lastSyncRef.current !== syncKey) {
      lastSyncRef.current = syncKey;
      setForm(formFromAffiliate(affiliate));
      setWebsiteImportUrl(affiliate.website ?? "");
      setWebsiteImportDraft(null);
      setSelectedImportedTestimonialQuotes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  const utils = trpc.useUtils();
  const save = trpc.affiliates.updateMyStorefront.useMutation({
    onSuccess: () => {
      toast.success("Storefront updated");
      utils.affiliates.bySlug.invalidate();
      utils.affiliates.myReferrals.invalidate();
      utils.affiliates.adminReferrals.invalidate();
      utils.affiliates.adminList.invalidate();
      onSaved();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });

  const websiteImport = trpc.affiliates.importWebsiteBrand.useMutation({
    onSuccess: (draft) => {
      setWebsiteImportDraft(draft as WebsiteBrandImportDraft);
      setSelectedImportedTestimonialQuotes(draft.testimonials.map((item) => item.quote));
      toast.success("Website draft ready", { description: "Review the detected details, then choose Apply." });
    },
    onError: (error) => toast.error("Could not import that website", { description: error.message }),
  });

  const applyWebsiteImport = trpc.affiliates.applyWebsiteBrandImport.useMutation({
    onSuccess: (_result, input) => {
      const draft = websiteImportDraft;
      if (draft) {
        setForm((current) => ({
          ...current,
          storeName: draft.storeName ?? current.storeName,
          logoUrl: draft.logoUrl ?? current.logoUrl,
          primaryColor: draft.primaryColor ?? current.primaryColor,
          publicEmail: draft.publicEmail ?? current.publicEmail,
          publicPhone: draft.publicPhone ?? current.publicPhone,
          publicAddress: draft.publicAddress ?? current.publicAddress,
          aboutText: draft.aboutText ?? current.aboutText,
          facebookUrl: draft.facebookUrl ?? current.facebookUrl,
          instagramUrl: draft.instagramUrl ?? current.instagramUrl,
        }));
      }
      setWebsiteImportUrl(input.website ?? websiteImportUrl);
      setWebsiteImportDraft(null);
      setSelectedImportedTestimonialQuotes([]);
      toast.success("Website details applied", { description: "Your selected testimonials are now published to your storefront." });
      utils.affiliates.bySlug.invalidate();
      utils.affiliates.myReferrals.invalidate();
      utils.affiliates.adminReferrals.invalidate();
      utils.affiliates.adminList.invalidate();
      onSaved();
    },
    onError: (error) => toast.error("Could not apply the website draft", { description: error.message }),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setShowLaunchSuccess(false);
  }

  const uploadHeroImage = trpc.affiliates.uploadHeroImage.useMutation({
    onSuccess: ({ url }) => {
      set("heroImageUrl", url);
      toast.success("Hero image uploaded — save to apply");
    },
    onError: (e) => toast.error("Upload failed", { description: e.message }),
  });

  async function handleHeroFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) { toast.error("Could not read image"); setUploading(false); return; }
        uploadHeroImage.mutate({ imageBase64: match[2], contentType: match[1], fileName: file.name }, {
          onSettled: () => setUploading(false),
        });
      };
      reader.readAsDataURL(file);
    } catch { setUploading(false); }
    e.target.value = "";
  }

  const uploadLogo = trpc.affiliates.uploadLogo.useMutation({
    onSuccess: ({ url }) => {
      // The server already persisted logoUrl; mirror it into the form so the
      // preview updates immediately and a later Save won't blank it out.
      set("logoUrl", url);
      toast.success("Logo uploaded", { description: "It is already saved to your store." });
      onSaved();
    },
    onError: (e) => toast.error("Logo upload failed", { description: e.message }),
  });

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast.error("Unsupported file type", { description: "Use PNG, JPG, WebP, GIF, or SVG." });
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be 5MB or smaller");
      e.target.value = "";
      return;
    }
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("Could not read that file");
      setLogoUploading(false);
    };
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        toast.error("Could not read that image");
        setLogoUploading(false);
        return;
      }
      uploadLogo.mutate(
        {
          imageBase64: match[2],
          contentType: match[1],
          fileName: file.name,
          ...(isAdmin ? { affiliateId: affiliate.id } : {}),
        },
        { onSettled: () => setLogoUploading(false) }
      );
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function storefrontPayload(storefrontEnabled = form.storefrontEnabled) {
    return {
      // Admins must target the affiliate they are actually viewing, otherwise the
      // server falls back to the first affiliate row and the edit lands on the
      // wrong store.
      ...(isAdmin ? { affiliateId: affiliate.id } : {}),
      storeName: form.storeName || undefined,
      tagline: form.tagline || null,
      taglineEs: form.taglineEs || null,
      aboutText: form.aboutText || null,
      aboutTextEs: form.aboutTextEs || null,
      primaryColor: form.primaryColor || null,
      accentColor: form.accentColor || null,
      publicEmail: form.publicEmail.trim() || null,
      publicPhone: form.publicPhone.trim() || null,
      publicAddress: form.publicAddress.trim() || null,
      logoUrl: form.logoUrl || null,
      watermarkEnabled: form.watermarkEnabled,
      watermarkPosition: "bottom-right" as const,
      watermarkOpacityBps: form.watermarkOpacityBps,
      heroImageUrl: form.heroImageUrl || null,
      serviceArea: form.serviceArea || null,
      facebookUrl: form.facebookUrl || null,
      instagramUrl: form.instagramUrl || null,
      storefrontEnabled,
      template: form.template,
      fontFamily: form.fontFamily || null,
      headingFont: form.headingFont || null,
      buttonRadius: form.buttonRadius || null,
    };
  }

  function handleSave() {
    save.mutate(storefrontPayload());
  }

  const { storefrontUrl } = affiliateDashboardLinks(affiliate);
  const designerUrl = `${storefrontUrl.replace(/\/$/, "")}/design`;
  const shareText = `${form.storeName || affiliate.storeName} — design your kitchen online`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storefrontUrl)}`;
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(storefrontUrl)}`;

  function copyStorefrontLink() {
    navigator.clipboard.writeText(storefrontUrl).then(
      () => toast.success("Storefront link copied"),
      () => toast.error("Could not copy the storefront link"),
    );
  }

  async function shareStorefrontLink() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: form.storeName || affiliate.storeName, text: shareText, url: storefrontUrl });
        return;
      } catch (error) {
        if ((error as DOMException | undefined)?.name === "AbortError") return;
      }
    }
    copyStorefrontLink();
  }

  function previewWebsiteImport() {
    if (!websiteImportUrl.trim()) {
      toast.error("Paste the public website URL first.");
      return;
    }
    websiteImport.mutate({ websiteUrl: websiteImportUrl.trim(), ...(isAdmin ? { affiliateId: affiliate.id } : {}) });
  }

  function applyWebsiteImportDraft() {
    if (!websiteImportDraft) return;
    applyWebsiteImport.mutate({
      ...(isAdmin ? { affiliateId: affiliate.id } : {}),
      website: websiteImportDraft.sourceUrl,
      storeName: websiteImportDraft.storeName ?? undefined,
      logoUrl: websiteImportDraft.logoUrl,
      primaryColor: websiteImportDraft.primaryColor,
      publicEmail: websiteImportDraft.publicEmail,
      publicPhone: websiteImportDraft.publicPhone,
      publicAddress: websiteImportDraft.publicAddress,
      aboutText: websiteImportDraft.aboutText,
      facebookUrl: websiteImportDraft.facebookUrl,
      instagramUrl: websiteImportDraft.instagramUrl,
      testimonials: websiteImportDraft.testimonials.filter((item) => selectedImportedTestimonialQuotes.includes(item.quote)),
    });
  }

  function handlePublish() {
    save.mutate(storefrontPayload(true), {
      onSuccess: () => setShowLaunchSuccess(true),
    });
  }

  // Detect which scene key is currently active (if heroImageUrl matches one)
  const activeScene = (Object.keys(KITCHEN_SCENES) as KitchenSceneKey[]).find(
    (k) => KITCHEN_SCENES[k] === form.heroImageUrl
  ) ?? null;
  const localSeoChecks = [
    {
      label: "Business name",
      ready: Boolean(form.storeName.trim()),
      detail: "Used in your storefront title and public business schema.",
    },
    {
      label: "Public contact",
      ready: Boolean(form.publicPhone.trim() || form.publicEmail.trim()),
      detail: "Provide a business phone or email that customers can use.",
    },
    {
      label: "Service area",
      ready: Boolean(form.serviceArea.trim() || form.publicAddress.trim()),
      detail: "List the city, counties, metro area, or region you genuinely serve.",
    },
    {
      label: "Business introduction",
      ready: Boolean(form.aboutText.trim()),
      detail: "Explain your real kitchen-planning and service approach in your own words.",
    },
  ];
  const localSeoReadyCount = localSeoChecks.filter((check) => check.ready).length;

  return (
    <div className="space-y-6">
      <section data-testid="affiliate-launch-setup" className="rounded-xl border border-primary/30 bg-primary/[0.04] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="outline" className="mb-2 border-primary/30 bg-background text-primary">First launch</Badge>
            <h2 className="font-serif text-2xl font-bold">Set up your storefront</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Start with your business details and brand. Your current pricing defaults are ready to use, so pricing changes never hold up a launch.
            </p>
          </div>
          <a href={storefrontUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted">
            <Eye className="h-4 w-4" /> Preview storefront
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quick-store-name">Business name <span className="text-destructive">*</span></Label>
            <Input id="quick-store-name" value={form.storeName} onChange={(event) => set("storeName", event.target.value)} placeholder="Your cabinet business" autoComplete="organization" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-public-email">Business email <span className="font-normal text-muted-foreground">(recommended)</span></Label>
            <Input id="quick-public-email" type="email" value={form.publicEmail} onChange={(event) => set("publicEmail", event.target.value)} placeholder="hello@yourbusiness.com" autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-public-phone">Business phone <span className="font-normal text-muted-foreground">(recommended)</span></Label>
            <Input id="quick-public-phone" type="tel" value={form.publicPhone} onChange={(event) => set("publicPhone", event.target.value)} placeholder="(555) 555-5555" autoComplete="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-public-address">Public address <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="quick-public-address" value={form.publicAddress} onChange={(event) => set("publicAddress", event.target.value)} placeholder="City and state, or customer-facing address" autoComplete="street-address" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="quick-service-area">Service area <span className="font-normal text-muted-foreground">(recommended)</span></Label>
            <Input id="quick-service-area" value={form.serviceArea} onChange={(event) => set("serviceArea", event.target.value)} placeholder="Example: Sarasota & Manatee County, FL" />
          </div>
        </div>

        <section data-testid="affiliate-local-seo-readiness" className="rounded-lg border border-primary/25 bg-background/70 p-4" aria-labelledby="affiliate-local-seo-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 id="affiliate-local-seo-title" className="font-semibold">Local search readiness</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{localSeoReadyCount} of {localSeoChecks.length} verified storefront details are ready for local discovery.</p>
            </div>
            <Badge variant={localSeoReadyCount === localSeoChecks.length ? "default" : "outline"} className="w-fit">{localSeoReadyCount === localSeoChecks.length ? "Profile ready" : "Complete your profile"}</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {localSeoChecks.map((check) => (
              <div key={check.label} className="flex gap-2 text-sm">
                {check.ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Ready" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Needs information" />}
                <div><p className="font-medium">{check.label}</p><p className="text-xs leading-relaxed text-muted-foreground">{check.detail}</p></div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">Only publish contact, service-area, and business details that are accurate and available to customers. Do not list a private home address unless customers are invited there.</p>
        </section>

        <div data-testid="affiliate-website-import" className="rounded-lg border border-dashed border-primary/40 bg-background/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="affiliate-website-import-url" className="flex items-center gap-1.5">Import from your website <Badge variant="secondary" className="font-normal">optional</Badge></Label>
              <Input id="affiliate-website-import-url" type="url" inputMode="url" value={websiteImportUrl} onChange={(event) => setWebsiteImportUrl(event.target.value)} placeholder="https://yourbusiness.com" autoComplete="url" />
            </div>
            <Button type="button" variant="outline" onClick={previewWebsiteImport} disabled={websiteImport.isPending} className="gap-2">
              {websiteImport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {websiteImport.isPending ? "Reading website…" : "Create draft"}
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Paste a public website or subdomain. Cabinet Dealz creates a private draft of visible business details and source-attributed testimonials; nothing changes on your storefront until you apply it.</p>

          {websiteImportDraft && (
            <div className="mt-4 space-y-3 rounded-md border border-border bg-card p-3" data-testid="affiliate-website-import-draft">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-medium">Review website draft</p><a href={websiteImportDraft.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">{websiteImportDraft.sourceUrl}</a></div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setWebsiteImportDraft(null); setSelectedImportedTestimonialQuotes([]); }}>Discard draft</Button>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="font-medium">Business:</span> {websiteImportDraft.storeName ?? "No name found"}</p>
                <p><span className="font-medium">Contact:</span> {[websiteImportDraft.publicEmail, websiteImportDraft.publicPhone].filter(Boolean).join(" · ") || "No contact found"}</p>
                <p className="sm:col-span-2"><span className="font-medium">About:</span> {websiteImportDraft.aboutText ?? "No public introduction found"}</p>
              </div>
              {websiteImportDraft.testimonials.length > 0 && (
                <fieldset className="space-y-2 border-t border-border pt-3">
                  <legend className="px-1 text-sm font-medium">Testimonials to publish</legend>
                  <p className="text-xs text-muted-foreground">Only selected quotes will be published. These remain attributed to the imported website; Cabinet Dealz does not generate reviews.</p>
                  {websiteImportDraft.testimonials.map((item, index) => {
                    const checked = selectedImportedTestimonialQuotes.includes(item.quote);
                    return <label key={`${item.sourceUrl}-${index}`} className="flex cursor-pointer items-start gap-2 rounded border border-border p-2 text-sm"><input type="checkbox" className="mt-1" checked={checked} onChange={(event) => setSelectedImportedTestimonialQuotes((current) => event.target.checked ? [...current, item.quote] : current.filter((quote) => quote !== item.quote))} /><span><span className="block">“{item.quote}”</span>{item.author && <span className="mt-1 block text-xs text-muted-foreground">— {item.author}</span>}</span></label>;
                  })}
                </fieldset>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3"><Button type="button" onClick={applyWebsiteImportDraft} disabled={applyWebsiteImport.isPending} className="gap-2">{applyWebsiteImport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Apply selected website details</Button><span className="text-xs text-muted-foreground">You can adjust every imported field afterward.</span></div>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="quick-primary">Primary color</Label>
            <div className="flex gap-2">
              <Input id="quick-primary" value={form.primaryColor} onChange={(event) => set("primaryColor", event.target.value)} placeholder="#1a2b4a" className="font-mono" />
              <input type="color" aria-label="Pick setup primary color" value={/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : "#1a2b4a"} onChange={(event) => set("primaryColor", event.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-accent">Accent color <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <div className="flex gap-2">
              <Input id="quick-accent" value={form.accentColor} onChange={(event) => set("accentColor", event.target.value)} placeholder="#c9a227" className="font-mono" />
              <input type="color" aria-label="Pick setup accent color" value={/^#[0-9a-fA-F]{6}$/.test(form.accentColor) ? form.accentColor : "#c9a227"} onChange={(event) => set("accentColor", event.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0" />
            </div>
          </div>
          <label className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted ${logoUploading || uploadLogo.isPending ? "pointer-events-none opacity-60" : ""}`}>
            {logoUploading || uploadLogo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {logoUploading || uploadLogo.isPending ? "Uploading…" : "Upload logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="sr-only" onChange={onLogoFile} disabled={logoUploading || uploadLogo.isPending} />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Mini homepage preview <Tooltip><TooltipTrigger asChild><button type="button" aria-label="About the mini homepage preview" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent side="right">This updates as you enter your name, logo, and colors. It is not public until you publish.</TooltipContent></Tooltip></div>
            <div className="rounded-md p-5 text-white" style={{ backgroundColor: form.primaryColor || "#1a2b4a" }}>
              <div className="flex items-center gap-2">
                {form.logoUrl ? <img src={form.logoUrl} alt="Store logo preview" className="h-8 max-w-[120px] object-contain" /> : <span className="rounded bg-white/15 px-2 py-1 text-xs font-semibold">{form.storeName.slice(0, 2).toUpperCase() || "CD"}</span>}
                <span className="font-semibold">{form.storeName || "Your storefront"}</span>
                <Tooltip><TooltipTrigger asChild><button type="button" aria-label="About your brand preview" className="ml-auto rounded p-0.5 text-white/80 hover:bg-white/15"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent side="left">Your logo and brand colors appear here, then on your published customer storefront.</TooltipContent></Tooltip>
              </div>
              <p className="mt-5 font-serif text-xl font-bold">Kitchen design starts here.</p>
              <p className="mt-1 text-sm text-white/75">Customers can shop and open your branded Designer.</p>
              <span className="mt-4 inline-flex items-center gap-1 rounded px-3 py-2 text-xs font-semibold" style={{ backgroundColor: form.accentColor || "#c9a227" }}>Open Designer <Tooltip><TooltipTrigger asChild><button type="button" aria-label="About the customer Designer button" className="rounded p-0.5 hover:bg-black/15"><Info className="h-3 w-3" /></button></TooltipTrigger><TooltipContent side="bottom">Customers enter your branded Designer from this action.</TooltipContent></Tooltip></span>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Launch with your defaults</p>
            <p className="mt-1">Your storefront starts with the pricing already assigned to your account. You can fine-tune prices later without taking the site offline.</p>
            <a href={`${isAdmin ? `${affiliateDashboardPath(affiliate.id)}&` : "/affiliate?"}section=pricing`} className="mt-3 inline-flex items-center gap-1 font-medium text-primary hover:underline">Adjust pricing later <ChevronRight className="h-4 w-4" /></a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="button" onClick={handlePublish} disabled={save.isPending || !form.storeName.trim()} className="gap-2 bg-primary text-primary-foreground">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {save.isPending ? "Publishing…" : "Publish storefront"}
          </Button>
          <span className="text-xs text-muted-foreground">Preview the brand above, then publish when you’re ready. Only the business name is required.</span>
        </div>

        {showLaunchSuccess && (
          <div data-testid="affiliate-publish-success" className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50">
            <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Your site is live now</p><p className="mt-0.5 text-sm">Your Cabinet Dealz storefront is available immediately at <a href={storefrontUrl} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">{storefrontUrl}</a>.</p><p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-100/80">A custom domain can be connected separately later, without delaying this launch.</p></div></div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyStorefrontLink} className="gap-1.5"><Copy className="h-3.5 w-3.5" /> Copy link</Button>
              <Button type="button" variant="outline" size="sm" onClick={shareStorefrontLink} className="gap-1.5"><Share2 className="h-3.5 w-3.5" /> Share</Button>
              <a href={facebookShareUrl} target="_blank" rel="noopener noreferrer" aria-label="Share storefront on Facebook" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"><Facebook className="h-3.5 w-3.5" /> Facebook</a>
              <a href={linkedInShareUrl} target="_blank" rel="noopener noreferrer" aria-label="Share storefront on LinkedIn" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</a>
              <a href={storefrontUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /> Open storefront</a>
              <a href={designerUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"><PencilRuler className="h-3.5 w-3.5" /> Open Designer as a customer</a>
            </div>
          </div>
        )}
      </section>

      <details className="rounded-xl border border-border bg-card p-5">
        <summary className="cursor-pointer font-semibold">More storefront options <span className="ml-2 text-sm font-normal text-muted-foreground">Templates, hero imagery, detailed copy, typography, and visibility controls</span></summary>
        <div className="space-y-6 pt-5">

      {/* ── Storefront on/off ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> Storefront Visibility
        </h2>
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <div className="font-medium text-sm">Storefront live</div>
            <div className="text-xs text-muted-foreground">Turn your public storefront on or off.</div>
          </div>
          <Switch checked={form.storefrontEnabled} onCheckedChange={(v) => set("storefrontEnabled", v)} />
        </div>
      </div>

      {/* ── Room Scene Picker ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" /> Hero Room Scene
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the kitchen scene displayed as your storefront hero image. This sets the visual mood for your brand.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(KITCHEN_SCENES) as KitchenSceneKey[]).map((key) => {
            const isActive = activeScene === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => set("heroImageUrl", KITCHEN_SCENES[key])}
                className={`relative rounded-xl overflow-hidden border-2 transition-all text-left group ${
                  isActive
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={KITCHEN_SCENES[key]}
                    alt={SCENE_LABELS[key].name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{SCENE_LABELS[key].name}</span>
                    {isActive && (
                      <Badge variant="default" className="text-xs px-2 py-0.5">Active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{SCENE_LABELS[key].desc}</p>
                </div>
              </button>
            );
          })}
          {/* Upload your own photo */}
          <div
            className={`rounded-xl border-2 p-3 transition-all ${
              !activeScene && form.heroImageUrl ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
            }`}
          >
            <div className="font-semibold text-sm mb-2 flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5" /> Upload Your Own Photo
            </div>
            {/* Preview */}
            {!activeScene && form.heroImageUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg mb-2">
                <img src={form.heroImageUrl} alt="Custom hero" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => set("heroImageUrl", "")}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/80"
                  title="Remove"
                >×</button>
              </div>
            ) : null}
            <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-lg border border-dashed border-border bg-muted/40 hover:bg-muted/70 transition-colors py-3 px-4 text-sm font-medium">
              {uploading || uploadHeroImage.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
              ) : (
                <><ImageIcon className="h-4 w-4" /> {!activeScene && form.heroImageUrl ? "Replace photo" : "Choose photo"}</>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleHeroFileChange}
                disabled={uploading || uploadHeroImage.isPending}
              />
            </label>
            <p className="text-xs text-muted-foreground mt-1.5">JPG, PNG, or WebP — max 10 MB. Appears only on your storefront.</p>
          </div>
        </div>
      </div>

      {/* ── Template picker ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" /> Layout Template
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((tpl) => {
            const active = form.template === tpl.id;
            return (
              <div
                key={tpl.id}
                role="group"
                className={
                  "rounded-lg border p-3 transition-colors " +
                  (active
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "border-border hover:bg-muted")
                }
              >
                {/* Clicking the name/desc row selects the template */}
                <button
                  type="button"
                  onClick={() => set("template", tpl.id)}
                  aria-pressed={active}
                  className="w-full text-left"
                >
                  {/* Thumbnail screenshot */}
                  <div className="relative rounded overflow-hidden mb-2 bg-muted" style={{ aspectRatio: "16/10" }}>
                    <img
                      src={tpl.thumb}
                      alt={`${tpl.name} template preview`}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                    />
                    {active && (
                      <div className="absolute top-1.5 right-1.5">
                        <Badge variant="default" className="text-[10px] px-1.5 py-0.5">Active</Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{tpl.name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{tpl.desc}</div>
                </button>
                {/* Preview button — opens the modal, does NOT select the template */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewingTemplate(tpl.id);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                >
                  Preview <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {/* ── Template preview modal ────────────────────────────────────────── */}
      <TemplatePreviewDialog
        open={previewingTemplate !== null}
        templateId={previewingTemplate}
        onClose={() => setPreviewingTemplate(null)}
        onSelect={(id) => { set("template", id); setPreviewingTemplate(null); }}
        currentTemplate={form.template}
      />

      {/* ── Brand identity ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" /> Brand Identity
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="storeName">Store display name</Label>
          <Input
            id="storeName"
            value={form.storeName}
            onChange={(e) => set("storeName", e.target.value)}
            placeholder="Reaves Way Cabinet Shop"
          />
          <p className="text-xs text-muted-foreground">
            Shown as your storefront name. If you have no logo image, this text is used as your logo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="primary">Primary color (hex)</Label>
            <div className="flex gap-2 items-center">
              <Input id="primary" value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} placeholder="#1a2b4a" className="font-mono" />
              <input
                type="color"
                aria-label="Pick primary color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : "#1a2b4a"}
                onChange={(e) => set("primaryColor", e.target.value)}
                className="h-9 w-9 rounded border border-border shrink-0 cursor-pointer bg-transparent p-0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accent">Accent color (hex)</Label>
            <div className="flex gap-2 items-center">
              <Input id="accent" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} placeholder="#c9a227" className="font-mono" />
              <input
                type="color"
                aria-label="Pick accent color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.accentColor) ? form.accentColor : "#c9a227"}
                onChange={(e) => set("accentColor", e.target.value)}
                className="h-9 w-9 rounded border border-border shrink-0 cursor-pointer bg-transparent p-0"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Store logo</Label>
          <div className="flex items-start gap-3 flex-wrap">
            {/* Current logo preview, or a text-logo hint when none is set. */}
            {form.logoUrl ? (
              <img
                src={form.logoUrl}
                alt="Current logo"
                className="h-14 w-auto max-w-[160px] object-contain rounded border border-border bg-white p-1"
              />
            ) : (
              <div className="h-14 px-3 flex items-center rounded border border-dashed border-border text-xs text-muted-foreground">
                No logo — your store name is shown as text
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {/*
                IMPORTANT: this is a plain <label> containing a hidden file input.
                Do NOT use <Button asChild> inside a label here — rendering a
                button-like element as a <span> inside a label previously caused a
                DOM-nesting crash (white screen) in the production build.
              */}
              <label
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background text-sm font-medium cursor-pointer hover:bg-muted transition-colors ${
                  logoUploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {logoUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {logoUploading ? "Uploading…" : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={onLogoFile}
                />
              </label>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={() => set("logoUrl", "")}
                  className="text-xs text-destructive hover:underline text-left"
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WebP, GIF, or SVG up to 5MB. If you don't have a logo file, leave this empty
            and your store name will be used as a text logo.
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Or paste a logo URL
            </summary>
            <Input
              id="logo"
              value={form.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value)}
              placeholder="https://…/logo.png"
              className="font-mono text-sm mt-2"
            />
          </details>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="affiliate-watermark" className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
              <ImageIcon className="h-4 w-4" /> Watermark generated images
            </Label>
            <p className="max-w-xl text-xs leading-relaxed text-indigo-900/80">
              When enabled, your logo is applied to a separate copy of affiliate-generated images in a consistent bottom-right safe area. The original image is always preserved.
            </p>
            {!form.logoUrl && <p className="text-xs font-medium text-amber-800">Upload a logo first. Your store name will be used as the fallback mark.</p>}
          </div>
          <Switch
            id="affiliate-watermark"
            checked={form.watermarkEnabled}
            onCheckedChange={(checked) => set("watermarkEnabled", checked)}
            aria-label="Enable affiliate image watermark"
          />
        </div>

        {/* ── Typography ──────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Body font</Label>
            <Select
              value={form.fontFamily || "__default__"}
              onValueChange={(v) => set("fontFamily", v === "__default__" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Default (Inter)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Default</SelectItem>
                {BODY_FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Heading font</Label>
            <Select
              value={form.headingFont || "__default__"}
              onValueChange={(v) => set("headingFont", v === "__default__" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Default (Playfair Display)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Default</SelectItem>
                {HEADING_FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Button radius ────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>Button shape</Label>
          <div className="flex flex-wrap gap-2">
            {BUTTON_RADII.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => set("buttonRadius", r.value)}
                className={`px-4 py-2 text-sm border transition-colors ${form.buttonRadius === r.value || (!form.buttonRadius && r.value === "0.375rem") ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-background text-foreground hover:border-primary/50"}`}
                style={{ borderRadius: r.value }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Live mini-preview ────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted text-xs font-medium text-muted-foreground">Live Preview</div>
          <div
            className="p-5 space-y-3"
            style={{
              backgroundColor: form.primaryColor || "#1a2b4a",
              fontFamily: form.fontFamily || "Inter, sans-serif",
            }}
          >
            <p
              className="text-2xl font-bold text-white"
              style={{ fontFamily: form.headingFont || "Playfair Display, serif" }}
            >
              {form.tagline || "Beautiful Kitchens, Built Around You."}
            </p>
            <p className="text-sm text-white/75">Your storefront headline will appear in your heading font above.</p>
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                className="px-5 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: form.accentColor || "#c9a227", borderRadius: form.buttonRadius || "0.375rem", fontFamily: form.fontFamily || "Inter, sans-serif" }}
              >
                Shop Cabinets
              </button>
              <button
                type="button"
                className="px-5 py-2 text-sm font-semibold border border-white/50 text-white bg-transparent"
                style={{ borderRadius: form.buttonRadius || "0.375rem", fontFamily: form.fontFamily || "Inter, sans-serif" }}
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Storefront copy ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <PencilRuler className="h-4 w-4 text-primary" /> Storefront Copy
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="tagline">Headline / tagline (English)</Label>
          <Input id="tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Beautiful Kitchens, Built Around You." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taglineEs">Headline / tagline (Spanish, optional)</Label>
          <Input id="taglineEs" value={form.taglineEs} onChange={(e) => set("taglineEs", e.target.value)} placeholder="Hermosas cocinas, hechas para usted." />
          <p className="text-xs text-muted-foreground">Shown when a visitor switches your storefront to Spanish. Leave blank to reuse the English headline.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="about">About your store (English)</Label>
          <Textarea id="about" rows={3} value={form.aboutText} onChange={(e) => set("aboutText", e.target.value)} placeholder="Tell customers about your business…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aboutEs">About your store (Spanish, optional)</Label>
          <Textarea id="aboutEs" rows={3} value={form.aboutTextEs} onChange={(e) => set("aboutTextEs", e.target.value)} placeholder="Cuéntele a los clientes sobre su negocio…" />
          <p className="text-xs text-muted-foreground">Optional Spanish version of your store blurb. Leave blank to reuse the English text.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="area">Service area</Label>
            <Input id="area" value={form.serviceArea} onChange={(e) => set("serviceArea", e.target.value)} placeholder="Sarasota & Manatee County, FL" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fb">Facebook URL</Label>
            <Input id="fb" value={form.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} placeholder="https://facebook.com/…" className="font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ig">Instagram URL</Label>
            <Input id="ig" value={form.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} placeholder="https://instagram.com/…" className="font-mono text-sm" />
          </div>
        </div>
      </div>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <Button onClick={handleSave} disabled={save.isPending} className="gap-2">
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save storefront
      </Button>

        </div>
      </details>

      {/* ── AI Concierge upsell card ──────────────────────────────────────── */}
      <AiConciergeCard />
    </div>
  );
}

// ─── AI Concierge Upsell Card ───────────────────────────────────────────────────
// ─── Storefront Live Preview Panel ──────────────────────────────────────────
// Renders a sticky iframe showing the affiliate's public storefront.
// Only visible on xl+ screens (≥1280px) so mobile/tablet layouts are unaffected.
// Uses a plain iframe — no shadcn components — to avoid any DOM nesting issues.
// ─── Template Preview Dialog ──────────────────────────────────────────────────
// Opens a full-screen dialog with a scaled iframe showing the /store-preview
// route for the selected template. Lets affiliates compare layouts before
// committing. Uses a plain iframe — no asChild / DOM nesting risk.
type TemplateId = AffiliateStorefrontTemplate;
function TemplatePreviewDialog({
  open,
  templateId,
  onClose,
  onSelect,
  currentTemplate,
}: {
  open: boolean;
  templateId: TemplateId | null;
  onClose: () => void;
  onSelect: (id: TemplateId) => void;
  currentTemplate: TemplateId;
}) {
  // Local state tracks which template is being previewed inside the dialog.
  // Starts from the templateId prop but can be changed by the switcher row
  // without closing the dialog.
  const [viewing, setViewing] = useState<TemplateId>(templateId ?? "classic");
  // Sync viewing when the dialog opens with a new template.
  useEffect(() => {
    if (templateId) setViewing(templateId);
  }, [templateId]);

  const tpl = TEMPLATES.find((t) => t.id === viewing);
  const isActive = viewing === currentTemplate;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-base font-semibold">
              {tpl?.name ?? "Template"} Preview
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{tpl?.desc}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isActive ? (
              <Badge variant="default" className="text-xs">Currently active</Badge>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(viewing)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Use this template
              </button>
            )}
            <a
              href={`/store-preview/${viewing}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border text-sm hover:bg-muted transition-colors"
              title="Open full page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </DialogHeader>

        {/* Scaled iframe — 1280px wide storefront scaled to fit the dialog */}
        <div style={{ height: "70vh", overflow: "hidden", position: "relative", background: "#f5f5f5" }}>
          {open && (
            <iframe
              key={viewing}
              src={`/store-preview/${viewing}`}
              title={`${tpl?.name ?? viewing} template preview`}
              style={{
                width: "1280px",
                height: "calc(70vh / 0.72)",
                border: "none",
                transformOrigin: "top left",
                transform: "scale(0.72)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {/* Template switcher row — click to switch which template is previewed */}
        <div className="flex gap-2 px-5 py-3 border-t border-border overflow-x-auto">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setViewing(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                t.id === viewing
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StorefrontPreviewPanel({
  slug,
  externalKey = 0,
}: {
  slug: string;
  /** Incrementing this from the parent triggers an iframe reload. */
  externalKey?: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Merge the external key (from parent save) with the local manual refresh key.
  const [localKey, setLocalKey] = useState(0);
  const key = externalKey * 1000 + localKey;
  const storeUrl = affiliateStorefrontUrl(slug);

  function refresh() {
    setLocalKey((k) => k + 1);
  }

  return (
    <div className="hidden xl:flex flex-col gap-2 w-[420px] shrink-0 sticky top-6 self-start">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            title="Reload preview"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Refresh
          </button>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            title="Open in new tab"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-muted/30 shadow-sm">
        {/* Scale the storefront down to fit the 420px panel width.
            The storefront is designed for 1280px, so scale = 420/1280 ≈ 0.328.
            We set the iframe to 1280px wide then scale it down so the layout
            renders correctly instead of reflowing to mobile breakpoints. */}
        <div
          style={{ height: "600px", overflow: "hidden", position: "relative" }}
        >
          <iframe
            key={key}
            ref={iframeRef}
            src={storeUrl}
            title="Storefront preview"
            style={{
              width: "1280px",
              height: "900px",
              border: "none",
              transformOrigin: "top left",
              transform: "scale(0.328)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Preview refreshes automatically after each Save.
      </p>
    </div>
  );
}

function AiConciergeCard() {
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const request = trpc.affiliates.requestAiConcierge.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setDescription("");
      toast.success("Request sent! Our design team will be in touch within 1 business day.");
    },
    onError: (e) => toast.error("Could not send request", { description: e.message }),
  });

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/20 p-6 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
        <div className="font-semibold text-lg">Request received!</div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Our design team will review your request and reach out within 1 business day to discuss your vision and confirm the scope.
        </p>
        <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
          Submit another request
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-gold)]/40 bg-gradient-to-br from-[var(--color-navy)]/5 to-[var(--color-gold)]/5 p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-[var(--color-navy)] flex items-center justify-center shrink-0">
          <Wand2 className="h-6 w-6 text-[var(--color-gold)]" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-serif text-xl font-bold">AI Concierge Service</h3>
            <Badge className="bg-[var(--color-gold)] text-[var(--color-navy)] font-semibold">$100 / hour</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
            Want a truly custom storefront? Our design team will work with you one-on-one to craft your front page, 
            write compelling copy, select the perfect room scenes, and fine-tune every detail — all powered by AI and 
            reviewed by a human designer.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Sparkles, title: "Custom copywriting", desc: "Headlines, taglines, and about text tailored to your brand voice" },
          { icon: ImageIcon, title: "Scene curation", desc: "Hand-picked room scenes and hero images that match your target market" },
          { icon: Palette, title: "Color & layout tuning", desc: "Brand colors, template selection, and layout optimized for conversions" },
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-border bg-card p-3 flex gap-3">
            <item.icon className="h-4 w-4 text-[var(--color-gold)] shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">{item.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Label htmlFor="concierge-desc" className="font-medium">
          Describe what you'd like to achieve
        </Label>
        <Textarea
          id="concierge-desc"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="E.g. I want my storefront to feel upscale and appeal to homeowners in the Sarasota area. I'd like a warm, modern look with cherry wood tones and Spanish language support…"
        />
        <p className="text-xs text-muted-foreground">
          Be as detailed as you like — the more context you give, the better we can tailor the work to your vision.
          We'll confirm the estimated hours and cost before starting.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => request.mutate({ description })}
          disabled={request.isPending || description.trim().length < 10}
          className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
        >
          {request.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Request
        </Button>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <ChevronRight className="h-3 w-3" /> We'll respond within 1 business day
        </span>
      </div>
    </div>
  );
}

// ─── Earnings Panel ─────────────────────────────────────────────────────────────

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function EarningsPanel() {
  const { data, isLoading } = trpc.affiliates.myEarnings.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
        No affiliate account is linked to you yet.
      </div>
    );
  }

  const statusClass: Record<string, string> = {
    pending: "border-amber-400/60 text-amber-700 bg-amber-50",
    issued: "border-blue-400/60 text-blue-700 bg-blue-50",
    paid: "border-emerald-400/60 text-emerald-700 bg-emerald-50",
  };

  // W-9 gate: if not started (pending) or submitted-but-awaiting-review, show a notice instead of payout details.
  // Schema: pending = not started, submitted = awaiting admin review, verified = approved
  if (data.w9Status === "pending" || data.w9Status === "submitted") {
    const isUnderReview = data.w9Status === "submitted";
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-6 space-y-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {isUnderReview ? "W-9 Under Review" : "W-9 Required Before Payouts"}
        </div>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          {isUnderReview
            ? "Your W-9 tax form has been submitted and is currently under review. Payout details will be visible once it has been verified by our team."
            : "To receive commission payouts, you must first complete and submit your W-9 tax form. This is required by the IRS for all affiliate payments."}
        </p>
        <button
          onClick={() => {
            // Navigate to the Tax Info tab
            const el = document.querySelector('[data-tab="tax"]') as HTMLElement | null;
            el?.click();
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
        >
          {isUnderReview ? "View W-9 Status" : "Complete W-9 Form"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" /> This week ({data.thisWeekKey})
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{money(data.thisWeekCents)}</div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" /> Pending (unpaid)
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{money(data.pendingCents)}</div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" /> Paid to date
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{money(data.paidCents)}</div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Commission is earned when a referred order is <strong>confirmed</strong>, calculated at{" "}
        {(data.commissionRate * 100).toFixed(1)}% and grouped by week (Mon–Sun). Payouts are
        issued weekly; status updates here once the team marks a week issued or paid.
      </p>

      {data.weeks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No confirmed referred orders yet.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Payout status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.weeks.map((w) => {
                const status = w.payout?.status ?? "pending";
                return (
                  <TableRow key={w.weekKey}>
                    <TableCell className="font-mono text-xs">{w.weekKey}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.count}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {money(w.totalCommissionCents)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass[status]}>{status}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── W-9 / Tax Compliance Panel ────────────────────────────────────────────────
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const ENTITY_LABELS: Record<string, string> = {
  individual: "Individual",
  sole_proprietor: "Sole Proprietor",
  llc_single: "LLC (Single-Member)",
  llc_partnership: "LLC (Partnership)",
  llc_corp: "LLC (C or S Corp)",
  c_corp: "C Corporation",
  s_corp: "S Corporation",
  partnership: "Partnership",
  trust: "Trust / Estate",
  other: "Other",
};

function W9Panel() {
  const utils = trpc.useUtils();
  const { data: w9, isLoading } = trpc.affiliates.getW9Status.useQuery();

  const [legalName, setLegalName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [entityType, setEntityType] = useState<string>("individual");
  const [taxIdType, setTaxIdType] = useState<"ssn" | "ein">("ssn");
  const [taxId, setTaxId] = useState("");
  const [showTaxId, setShowTaxId] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("FL");
  const [zip, setZip] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [formReady, setFormReady] = useState(false);

  // Pre-fill form from saved data
  useEffect(() => {
    if (!w9 || formReady) return;
    if (w9.w9LegalName) setLegalName(w9.w9LegalName);
    if (w9.w9BusinessName) setBusinessName(w9.w9BusinessName);
    if (w9.w9EntityType) setEntityType(w9.w9EntityType);
    if (w9.w9TaxIdType) setTaxIdType(w9.w9TaxIdType);
    if (w9.w9Address) setAddress(w9.w9Address);
    if (w9.w9City) setCity(w9.w9City);
    if (w9.w9State) setState(w9.w9State);
    if (w9.w9Zip) setZip(w9.w9Zip);
    setFormReady(true);
  }, [w9, formReady]);

  const saveInfo = trpc.affiliates.saveW9Info.useMutation({
    onSuccess: () => {
      toast.success("Tax information saved.");
      utils.affiliates.getW9Status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadId = trpc.affiliates.uploadIdDocument.useMutation({
    onSuccess: (data) => {
      toast.success("ID document uploaded.");
      setIdPreview(data.url);
      utils.affiliates.getW9Status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const submitW9 = trpc.affiliates.submitW9.useMutation({
    onSuccess: () => {
      toast.success("W-9 submitted for review. We'll verify within 1–2 business days.");
      utils.affiliates.getW9Status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleIdUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setIdPreview(dataUrl);
      const base64 = dataUrl.split(",")[1] ?? "";
      uploadId.mutate({ fileBase64: base64, contentType: file.type, fileName: file.name });
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!legalName || !taxId || !address || !city || !zip) {
      toast.error("Please fill in all required fields.");
      return;
    }
    saveInfo.mutate({
      legalName,
      businessName: businessName || undefined,
      entityType: entityType as Parameters<typeof saveInfo.mutate>[0]["entityType"],
      taxId,
      taxIdType,
      address,
      city,
      state,
      zip,
    });
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  const isVerified = w9?.w9Status === "verified";
  const isSubmitted = w9?.w9Status === "submitted";
  const hasId = !!(w9?.w9IdDocumentUrl || idPreview);

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {isVerified && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800">W-9 Verified</p>
            <p className="text-sm text-emerald-700">Your tax information has been verified. You are eligible for 1099 payouts.</p>
          </div>
        </div>
      )}
      {isSubmitted && !isVerified && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-300 bg-blue-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <p className="font-semibold text-blue-800">Under Review</p>
            <p className="text-sm text-blue-700">Your W-9 has been submitted and is being reviewed. We'll confirm within 1–2 business days.</p>
          </div>
        </div>
      )}
      {!isSubmitted && !isVerified && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Action Required — Complete Your W-9</p>
            <p className="text-sm text-amber-700">You must submit your tax information and a government-issued ID before commissions can be paid out. This is required by IRS regulations for 1099-NEC reporting.</p>
          </div>
        </div>
      )}

      {/* Legal information form */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Legal &amp; Tax Information
        </h2>
        <p className="text-sm text-muted-foreground -mt-2">
          This information is used solely for IRS 1099-NEC reporting. Your tax ID is stored securely and never shared with third parties.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="w9-legal-name">Legal name (as it appears on your tax return) <span className="text-destructive">*</span></Label>
            <Input
              id="w9-legal-name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="John Smith or ABC Cabinets LLC"
              disabled={isVerified}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="w9-biz-name">Business name / DBA <span className="text-muted-foreground font-normal">(if different from above)</span></Label>
            <Input
              id="w9-biz-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="ABC Cabinets (optional)"
              disabled={isVerified}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Federal tax classification <span className="text-destructive">*</span></Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              disabled={isVerified}
            >
              {Object.entries(ENTITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Tax ID type <span className="text-destructive">*</span></Label>
            <div className="flex gap-3 pt-1">
              {(["ssn", "ein"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="taxIdType"
                    value={t}
                    checked={taxIdType === t}
                    onChange={() => setTaxIdType(t)}
                    disabled={isVerified}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">{t === "ssn" ? "SSN (Individual)" : "EIN (Business)"}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w9-tax-id">
              {taxIdType === "ssn" ? "Social Security Number (SSN)" : "Employer Identification Number (EIN)"}
              <span className="text-destructive"> *</span>
            </Label>
            <div className="relative">
              <Input
                id="w9-tax-id"
                type={showTaxId ? "text" : "password"}
                value={isVerified ? (w9?.w9TaxIdMasked ?? "***-**-****") : taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder={taxIdType === "ssn" ? "XXX-XX-XXXX" : "XX-XXXXXXX"}
                disabled={isVerified}
                className="pr-10"
              />
              {!isVerified && (
                <button
                  type="button"
                  onClick={() => setShowTaxId(!showTaxId)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showTaxId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Your tax ID is encrypted and only used for 1099 reporting.</p>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold mb-3">Mailing Address</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="w9-address">Street address <span className="text-destructive">*</span></Label>
              <Input id="w9-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" disabled={isVerified} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w9-city">City <span className="text-destructive">*</span></Label>
              <Input id="w9-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sarasota" disabled={isVerified} />
            </div>
            <div className="space-y-1.5">
              <Label>State <span className="text-destructive">*</span></Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={isVerified}
              >
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w9-zip">ZIP code <span className="text-destructive">*</span></Label>
              <Input id="w9-zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="34230" disabled={isVerified} />
            </div>
          </div>
        </div>

        {!isVerified && (
          <Button onClick={handleSave} disabled={saveInfo.isPending} className="gap-2">
            {saveInfo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Tax Information
          </Button>
        )}
      </div>

      {/* Government ID upload */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" /> Government-Issued ID
        </h2>
        <p className="text-sm text-muted-foreground">
          Upload a clear photo or scan of a valid government-issued ID (driver's license, state ID, or passport). This is required to verify your identity before payouts are released.
        </p>

        {(w9?.w9IdDocumentUrl || idPreview) ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-sm font-medium text-emerald-800">ID document uploaded</span>
              {w9?.w9IdDocumentUrl && (
                <a href={w9.w9IdDocumentUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> View
                </a>
              )}
            </div>
            {!isVerified && (
              <label className="cursor-pointer">
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleIdUpload} className="hidden" />
                <Button variant="outline" size="sm" className="gap-2 pointer-events-none">
                  <Upload className="h-3.5 w-3.5" /> Replace ID Document
                </Button>
              </label>
            )}
          </div>
        ) : (
          <label className="cursor-pointer block">
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleIdUpload} className="hidden" disabled={isVerified} />
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Click to upload your ID</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, or PDF · Max 10MB</p>
              {uploadId.isPending && <Spinner className="mt-3" />}
            </div>
          </label>
        )}
      </div>

      {/* Submit for review */}
      {!isVerified && !isSubmitted && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-base">Submit for Review</h2>
          <p className="text-sm text-muted-foreground">
            Once you have filled in all your legal information and uploaded your ID, click below to submit your W-9 for review. We will verify within 1–2 business days and notify you when payouts are enabled.
          </p>
          <Button
            onClick={() => submitW9.mutate()}
            disabled={submitW9.isPending || !w9?.w9LegalName || !hasId}
            className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
          >
            {submitW9.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit W-9 for Review
          </Button>
          {(!w9?.w9LegalName || !hasId) && (
            <p className="text-xs text-muted-foreground">
              {!w9?.w9LegalName && "Please save your tax information first. "}
              {!hasId && "Please upload your government ID first."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
import { AffiliateTeamPanel } from "@/components/affiliate/AffiliateTeamPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomDomainGuide } from "@/components/affiliate/CustomDomainGuide";
import { AffiliateBundleDealsPanel } from "@/components/affiliate/AffiliateBundleDealsPanel";
