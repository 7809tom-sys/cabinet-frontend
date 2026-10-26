import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { AdminEditModeBar } from "@/components/admin/AdminEditModeBar";
import ChatWidget from "@/components/ChatWidget";
import { useWhiteLabelHead } from "@/hooks/useWhiteLabelHead";
import { StorefrontEmbed } from "@/components/storefront/StorefrontEmbed";
import { GoogleAnalyticsTracker } from "@/components/GoogleAnalyticsTracker";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { startVersionWatcher, setVersionNotifier } from "@/lib/versionWatcher";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  affiliateSlugForStoreScope,
  affiliateStorefrontFallbackPath,
	  isAffiliateManagementPath,
  resolveStoreScope,
} from "@/lib/affiliateContext";
import { ShoppingCart } from "lucide-react";
import { PreferredProductsProvider } from "@/contexts/PreferredProductsContext";
import { affiliateCatalogPath, affiliateDesignerPath, affiliateOrderPath, affiliateOwnerScopeDestination } from "@/lib/affiliateStorefrontUrl";
import { DEFAULT_SECTION_LABELS, storefrontCssVars } from "@shared/affiliateStorefrontControls";

// Lazy-loaded pages
const Catalog = lazy(() => import("@/pages/Catalog"));
const Countertops = lazy(() => import("@/pages/Countertops"));
const CabinetDetail = lazy(() => import("@/pages/CabinetDetail"));
const DoorStyles = lazy(() => import("@/pages/DoorStyles"));
const Family = lazy(() => import("@/pages/Family"));
// The Designer is intentionally route-split because it is the largest page in
// the app. On a direct /design visit, waiting until React reaches the route
// before starting that import leaves a phone showing only PageLoader while Vite
// compiles/downloads the large module. Warm the same promise as soon as the app
// entry loads, but only for Designer URLs so normal storefront pages do not pay
// the Designer's startup cost.
const isDirectDesignerRoute = typeof window !== "undefined"
  && (window.location.pathname === "/design" || /^\/store\/[^/]+\/design\/?$/.test(window.location.pathname));
const designToolModule = isDirectDesignerRoute ? import("@/pages/DesignTool") : null;
const DesignTool = lazy(() => designToolModule ?? import("@/pages/DesignTool"));
const DesignSession = lazy(() => import("@/pages/DesignSession"));
const ProNetwork = lazy(() => import("@/pages/ProNetwork"));
const BecomeVendor = lazy(() => import("@/pages/BecomeVendor"));
const OrderBuilder = lazy(() => import("@/pages/OrderBuilder"));
const CheckoutSuccess = lazy(() => import("@/pages/CheckoutSuccess"));
const CheckoutCancelled = lazy(() => import("@/pages/CheckoutCancelled"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminCatalogImport = lazy(() => import("@/pages/AdminCatalogImport"));
const Storefront = lazy(() => import("@/pages/Storefront"));
const StorefrontPreview = lazy(() => import("@/pages/StorefrontPreview"));
const AffiliateDashboard = lazy(() => import("@/pages/AffiliateDashboard"));
const ContractorDashboard = lazy(() => import("@/pages/ContractorDashboard"));
const Cart = lazy(() => import("@/pages/Cart"));
const VendorPortal = lazy(() => import("@/pages/VendorPortal"));
const VendorClosetStudio = lazy(() => import("@/pages/VendorClosetStudio"));
const PhotoToCart = lazy(() => import("@/pages/PhotoToCart"));
const FixturePhotoToCart = lazy(() => import("@/pages/FixturePhotoToCart"));
const SignIn = lazy(() => import("@/pages/SignIn"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AffiliateSetup = lazy(() => import("@/pages/AffiliateSetup"));
const Account = lazy(() => import("@/pages/Account"));
const PlanSheet = lazy(() => import("@/pages/PlanSheet"));
const FeeSystemDoc = lazy(() => import("@/pages/FeeSystemDoc"));
const Surfaces = lazy(() => import("@/pages/Surfaces"));
const SurfacesDepartment = lazy(() => import("@/pages/SurfacesDepartment"));
const SurfacesCategory = lazy(() => import("@/pages/SurfacesCategory"));
const SurfacesProduct = lazy(() => import("@/pages/SurfacesProduct"));
const SurfacesWizard = lazy(() => import("@/pages/SurfacesWizard"));
const DesignPresentation = lazy(() => import("@/pages/DesignPresentation"));
const SharedRoom3D = lazy(() => import("@/pages/SharedRoom3D"));
const RoomLayouts = lazy(() => import("@/pages/RoomLayouts"));
const FabricatorSheet = lazy(() => import("@/pages/FabricatorSheet"));
const StoneCreekCollection = lazy(() => import("@/pages/StoneCreekCollection"));
const PlumbersChoice = lazy(() => import("@/pages/PlumbersChoice"));
const PriceShop = lazy(() => import("@/pages/PriceShop"));
const BundleDeals = lazy(() => import("@/pages/BundleDeals"));
const KitchenDiscovery = lazy(() => import("@/pages/KitchenDiscovery"));
const KitchenPlanningGuide = lazy(() => import("@/pages/KitchenPlanningGuide"));
const DesignerWalkthrough = lazy(() => import("@/pages/DesignerWalkthrough"));
const ARMeasure = lazy(() => import("@/pages/ARMeasure"));
const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const ShippingPolicy = lazy(() => import("@/pages/ShippingPolicy"));
const ReturnPolicy = lazy(() => import("@/pages/ReturnPolicy"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Terms = lazy(() => import("@/pages/Terms"));
const InstallationEstimateDocument = lazy(() => import("@/pages/InstallationEstimateDocument"));
const Hardware = lazy(() => import("@/pages/Hardware"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AdminEditModeBar />
      <TopNav />
      <main className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function CartWithLayout() {
  // Branding is URL-owned. A cart created in another store may never repaint
  // the current owner or affiliate route through browser-storage history.
  const slug = typeof window !== "undefined"
    ? affiliateSlugForStoreScope(resolveStoreScope({
        pathname: window.location.pathname,
        search: window.location.search,
        hostname: window.location.hostname,
      }))
    : null;
  if (slug) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AffiliateShell slug={slug} />
      </Suspense>
    );
  }
  return (
    <AppLayout>
      <Cart />
    </AppLayout>
  );
}

function AffiliateShell({ slug, children, fullHeight = false, hideAdminEditModeBar = false }: { slug: string; children?: React.ReactNode; fullHeight?: boolean; hideAdminEditModeBar?: boolean }) {
  const { data } = trpc.affiliates.bySlug.useQuery({ slug });
  const storeName = data?.storeName ?? "Store";
  const logoUrl = data?.logoUrl ?? null;
  const primaryColor = data?.primaryColor || "#1a2b4a";
  const accentColor = data?.accentColor || "#c9a227";
  // Keep the tab/favicon on the affiliate's brand for cart, order, and design
  // pages reached from their storefront.
  const preserveRouteMetadata = typeof window !== "undefined"
    && window.location.pathname === `/store/${slug}/kitchens`;
  useWhiteLabelHead({
    storeName: data?.storeName,
    tagline: data?.tagline,
    logoUrl,
    faviconUrl: data?.faviconUrl,
    preserveRouteMetadata,
  });
  const labels = { ...DEFAULT_SECTION_LABELS, ...(data?.sectionLabels ?? {}) };
  const brandStyle = storefrontCssVars({
    primaryColor,
    accentColor,
    backgroundColor: data?.backgroundColor,
    textColor: data?.textColor,
    fontFamily: data?.fontFamily,
    headingFont: data?.headingFont,
    buttonRadius: data?.buttonRadius,
  });
  return (
    <div className={`flex flex-col ${fullHeight ? "h-[100dvh] overflow-hidden" : "min-h-screen"}`} style={{ ...brandStyle, background: "var(--sf-bg, transparent)", color: "var(--sf-text, inherit)", fontFamily: "var(--sf-font-body, inherit)" }}>
      {!hideAdminEditModeBar && <AdminEditModeBar />}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between" style={{ borderBottomColor: accentColor, borderBottomWidth: 2 }}>
        <a href={`/store/${slug}`} className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-8 w-auto max-w-[140px] object-contain" />
          ) : (
            <span className="text-lg font-bold" style={{ color: primaryColor }}>{storeName}</span>
          )}
        </a>
        <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs sm:text-sm font-medium text-muted-foreground" aria-label="Store navigation">
          <a href={affiliateCatalogPath(slug)} className="hover:text-foreground">{labels.catalog}</a>
          <a href={`/store/${slug}/surfaces`} className="hover:text-foreground">{labels.surfaces}</a>
          <a href={`/store/${slug}/closet`} className="hover:text-foreground">{labels.closet}</a>
          <a href={affiliateDesignerPath(slug)} className="hover:text-foreground">{labels.designer}</a>
          <a href={affiliateOrderPath(slug)} className="hover:text-foreground">{labels.quote}</a>
          <span data-testid="social-links-slot" className="sr-only">Social links</span>
          <a href={`/store/${slug}/cart`} aria-label="Shopping cart" className="hover:text-foreground">
            <ShoppingCart className="h-5 w-5" />
          </a>
        </nav>
      </header>
      <main className={fullHeight ? "flex-1 min-h-0 overflow-hidden" : "flex-1"}>
        {children ?? <Cart />}
      </main>
      {/* Affiliate's own published widget, so it follows customers through
          cart / order / design just like it does on the storefront. */}
      <StorefrontEmbed code={data?.embedCode} />
    </div>
  );
}

function DesignerRoute() {
  const search = useSearch();
  const affiliateSlug = new URLSearchParams(search).get("affiliate")?.trim() || null;
  const designer = (
    <Suspense fallback={<PageLoader />}>
      <DesignTool affiliateSlug={affiliateSlug ?? undefined} />
    </Suspense>
  );

  if (affiliateSlug) {
    return <AffiliateShell slug={affiliateSlug} fullHeight hideAdminEditModeBar>{designer}</AffiliateShell>;
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      <TopNav />
      <div className="flex-1 min-h-0 overflow-hidden">{designer}</div>
    </div>
  );
}

/**
 * Preserve the historic supplier URL while using the unified Vendor Portal.
 * The existing Vendor Portal continues to enforce administrator-only `?as=`
 * previews; supplier accounts remain scoped to their own linked supply line.
 */
function DistributorPortalRedirect() {
  useEffect(() => {
    window.location.replace("/vendor?as=210001");
  }, []);

  return <PageLoader />;
}

function AffiliateManagementAliasRedirect({ target }: { target: "/affiliate" | "/admin" }) {
	  useEffect(() => {
	    window.location.replace(`${target}${window.location.search}`);
	  }, [target]);

	  return <PageLoader />;
}

/**
 * Affiliate owners use their own dashboard as the permanent back door. If one
 * opens an unscoped platform URL—or another affiliate's store—return them to
 * their exact dashboard record. Admins are intentionally exempt so View As and
 * platform operations continue to work.
 */
function AffiliateOwnerScopeGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const { data } = trpc.affiliates.myReferrals.useQuery(undefined, {
    enabled: isAuthenticated && !loading && user?.role !== "admin",
    retry: false,
  });

  useEffect(() => {
    if (!isAuthenticated || loading || user?.role === "admin") return;
    const affiliate = data?.affiliate;
    if (!affiliate?.id || !affiliate.slug) return;
    const destination = affiliateOwnerScopeDestination({
      pathname: window.location.pathname,
      search: window.location.search,
      affiliateId: affiliate.id,
      slug: affiliate.slug,
    });
    if (destination) window.location.replace(destination);
  }, [data?.affiliate?.id, data?.affiliate?.slug, isAuthenticated, loading, user?.role]);

  return <>{children}</>;
}

export default function App() {
  const [, navigate] = useLocation();

  // Canonicalize an affiliate custom-domain visit into the branded route tree.
  // A full location replacement is intentional: some transparent proxy paths
  // load the SPA correctly but do not propagate an in-app history update.
  useEffect(() => {
    const slug = (window as unknown as Record<string, unknown>).__AFFILIATE_SLUG__ as string | undefined;
    const fallback = affiliateStorefrontFallbackPath(
      window.location.pathname,
      window.location.hostname,
      window.location.search,
    );
    if (fallback) {
      window.location.replace(fallback);
	    } else if (slug && !window.location.pathname.startsWith("/store/") && !isAffiliateManagementPath(window.location.pathname)) {
      const suffix = window.location.pathname === "/" ? "" : window.location.pathname;
      window.location.replace(`/store/${slug}${suffix}${window.location.search}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Show a gentle, non-blocking refresh prompt when a newer build is deployed,
    // so users (and customers) never get stuck on a stale cached version.
    setVersionNotifier(({ onReload }) => {
      toast("A new version is available", {
        id: "cabinet-dealz-version-update",
        description: "Refresh to apply the latest cabinets and fixes. Your open panel will not hide this notice.",
        // The prompt does not reload automatically, so it can remain visible
        // over an open Designer panel until the user chooses Refresh now or Later.
        duration: Infinity,
        action: { label: "Refresh now", onClick: onReload },
        cancel: { label: "Later", onClick: () => undefined },
      });
    });
    startVersionWatcher();
  }, []);

  return (
    <AffiliateOwnerScopeGuard>
      <GoogleAnalyticsTracker />
      <PreferredProductsProvider>
      <ThemeProvider defaultTheme="light">
      <Switch>
        {/* Home has its own footer, no AppLayout wrapper needed */}
        <Route path="/">
          <AdminEditModeBar />
          <Home />
        </Route>

        {/* Branded affiliate storefront — its own header/footer, no AppLayout */}
        <Route path="/store/:slug/cart">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <Cart />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/order">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <OrderBuilder />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        {/* Older referral messages used /order/new. Keep that published path
            working so it remains inside the affiliate shell and cart scope. */}
        <Route path="/store/:slug/order/new">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <OrderBuilder />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/checkout/success">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <CheckoutSuccess />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/checkout/cancelled">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <CheckoutCancelled />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/design">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug} fullHeight hideAdminEditModeBar>
                <DesignTool affiliateSlug={params.slug} />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        {/* A branded subdomain rewrites /signin to /store/:slug/signin. Keep
            that route in the same storefront scope instead of falling through
            to the platform 404, then return the customer to their saved-plan
            destination after authentication. */}
        <Route path="/store/:slug/signin">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <SignIn />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        {/* The family-locked storefront owns the catalog at #shop. Preserve
            older catalog-root links inside the same affiliate scope rather
            than falling through to the platform 404. */}
        <Route path="/store/:slug/catalog">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <Storefront slug={params.slug} focusShop />
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/catalog/:masterCode">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <ErrorBoundary>
                  <CabinetDetail masterCode={params.masterCode} />
                </ErrorBoundary>
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/kitchens">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <KitchenDiscovery affiliateSlug={params.slug} />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/bundles">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <BundleDeals affiliateSlug={params.slug} />
              </AffiliateShell>
            </Suspense>
          )}
	        </Route>
	        <Route path="/store/:slug/surfaces/department/:departmentSlug">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <SurfacesDepartment departmentSlug={params.departmentSlug} affiliateSlug={params.slug} />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/surfaces/product/:productSlug">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <SurfacesProduct slug={params.productSlug} affiliateSlug={params.slug} />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/surfaces/:categorySlug">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <SurfacesCategory slug={params.categorySlug} affiliateSlug={params.slug} />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/surfaces">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <Surfaces affiliateSlug={params.slug} />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/hardware">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug}>
                <Hardware />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
        <Route path="/store/:slug/closet">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <AffiliateShell slug={params.slug} fullHeight>
                <VendorClosetStudio affiliateSlug={params.slug} />
              </AffiliateShell>
            </Suspense>
          )}
        </Route>
	        <Route path="/store/:slug/affiliate">
	          <AffiliateManagementAliasRedirect target="/affiliate" />
	        </Route>
	        <Route path="/store/:slug/admin">
	          <AffiliateManagementAliasRedirect target="/admin" />
	        </Route>
	        <Route path="/store/:slug">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <Storefront slug={params.slug} />
            </Suspense>
          )}
        </Route>
        <Route path="/installation-estimate/:token">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <InstallationEstimateDocument token={params.token} />
            </Suspense>
          )}
        </Route>
        <Route path="/3d/:token">
          {(params) => (
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <SharedRoom3D token={params.token} />
              </Suspense>
            </AppLayout>
          )}
        </Route>
        {/* Live template preview — no real affiliate needed */}
        <Route path="/store-preview/:template">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <StorefrontPreview template={params.template} />
            </Suspense>
          )}
        </Route>

        {/* All other pages use AppLayout with TopNav */}
        <Route path="/catalog">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Catalog />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/catalog/:masterCode">
          {(params) => (
            <AppLayout>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <CabinetDetail masterCode={params.masterCode} />
                </Suspense>
              </ErrorBoundary>
            </AppLayout>
          )}
        </Route>

        <Route path="/hardware">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Hardware />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/styles">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <DoorStyles />
            </Suspense>
          </AppLayout>
        </Route>

        {/* Door-style FAMILY page: pick a family, shop every cabinet in it together */}
        <Route path="/family/:styleCode">
          {(params) => (
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <Family styleCode={decodeURIComponent(params.styleCode)} />
              </Suspense>
            </AppLayout>
          )}
        </Route>

        <Route path="/design/session/:token">
          <Suspense fallback={<PageLoader />}>
            <DesignSession />
          </Suspense>
        </Route>

        <Route path="/design">
          <DesignerRoute />
        </Route>

        {/* The public Closet program is separate from the kitchen Designer.
            Keep the existing /design route for saved legacy plans. */}
        <Route path="/closet">
          <Suspense fallback={<PageLoader />}>
            <VendorClosetStudio />
          </Suspense>
        </Route>

        <Route path="/designer-guide">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <DesignerWalkthrough />
            </Suspense>
          </AppLayout>
        </Route>

        {/* Phone-first AR/photo physical measurement. It owns its own compact UI
            and receives a short-lived designer session token in the query. */}
        <Route path="/measure">
          <Suspense fallback={<PageLoader />}>
            <ARMeasure />
          </Suspense>
        </Route>

        <Route path="/room-layouts">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <RoomLayouts />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/pro-network">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ProNetwork />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/become-a-vendor">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <BecomeVendor />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/design-surfaces">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <SurfacesWizard />
            </Suspense>
          </AppLayout>
        </Route>
        <Route path="/surfaces/build">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <SurfacesWizard />
            </Suspense>
          </AppLayout>
        </Route>
        <Route path="/surfaces/product/:slug">
          {(params) => (
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <SurfacesProduct slug={params.slug} />
              </Suspense>
            </AppLayout>
          )}
        </Route>
        <Route path="/surfaces/department/:departmentSlug">
          {(params) => (
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <SurfacesDepartment departmentSlug={params.departmentSlug} />
              </Suspense>
            </AppLayout>
          )}
        </Route>
        <Route path="/surfaces/:slug">
          {(params) => (
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <SurfacesCategory slug={params.slug} />
              </Suspense>
            </AppLayout>
          )}
        </Route>
        <Route path="/stonecreek">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <StoneCreekCollection />
            </Suspense>
          </AppLayout>
        </Route>
        <Route path="/plumbers-choice">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <PlumbersChoice />
            </Suspense>
          </AppLayout>
        </Route>
        <Route path="/surfaces">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Surfaces />
            </Suspense>
          </AppLayout>
        </Route>
        <Route path="/countertops">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Countertops />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/admin">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Admin />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/admin/catalog-import">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <AdminCatalogImport />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/distributor">
          <DistributorPortalRedirect />
        </Route>

        <Route path="/vendor/closet-studio">
          <Suspense fallback={<PageLoader />}>
            <VendorClosetStudio />
          </Suspense>
        </Route>

        <Route path="/vendor">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <VendorPortal />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/affiliate">
          <Suspense fallback={<PageLoader />}>
            <AffiliateDashboard />
          </Suspense>
        </Route>

        <Route path="/contractor">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ContractorDashboard />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/order/new">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <OrderBuilder />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/checkout/success">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <CheckoutSuccess />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/checkout/cancelled">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <CheckoutCancelled />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/bulk-order">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <OrderBuilder />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/cart">
          <Suspense fallback={<PageLoader />}>
            <CartWithLayout />
          </Suspense>
        </Route>

        <Route path="/account">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Account />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/signin">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <SignIn />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/reset-password">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ResetPassword />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/affiliate/setup">
          <Suspense fallback={<PageLoader />}>
            <AffiliateSetup />
          </Suspense>
        </Route>

        <Route path="/photo-to-cart">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <PhotoToCart />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/fixture-photo">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <FixturePhotoToCart />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/price-shop">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <PriceShop />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/bundles">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <BundleDeals />
            </Suspense>
          </AppLayout>
        </Route>
        <Route path="/kitchens">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <KitchenDiscovery />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/kitchen-planning">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <KitchenPlanningGuide />
            </Suspense>
          </AppLayout>
        </Route>

        {/* Printable graph-paper plan sheet — standalone, print-optimized, no app chrome */}
        <Route path="/plan-sheet">
          <Suspense fallback={<PageLoader />}>
            <PlanSheet />
          </Suspense>
        </Route>

        {/* Design Presentation — print-optimized design package for customers */}
        <Route path="/design/presentation">
          <Suspense fallback={<PageLoader />}>
            <DesignPresentation />
          </Suspense>
        </Route>
        <Route path="/design/fabricator-sheet">
          <Suspense fallback={<PageLoader />}>
            <FabricatorSheet />
          </Suspense>
        </Route>

        {/* Admin-only Fee System reference sheet — print/PDF, no app chrome */}
        <Route path="/admin/fee-system">
          <Suspense fallback={<PageLoader />}>
            <FeeSystemDoc />
          </Suspense>
        </Route>

        <Route path="/contact">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Contact />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/about">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <About />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/shipping-policy">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ShippingPolicy />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/return-policy">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ReturnPolicy />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/privacy-policy">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <PrivacyPolicy />
            </Suspense>
          </AppLayout>
        </Route>

        <Route path="/terms">
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Terms />
            </Suspense>
          </AppLayout>
        </Route>

        <Route>
          <AppLayout>
            <NotFound />
          </AppLayout>
        </Route>
      </Switch>
      <ChatWidget />
      <Toaster />
      </ThemeProvider>
      </PreferredProductsProvider>
    </AffiliateOwnerScopeGuard>
  );
}
