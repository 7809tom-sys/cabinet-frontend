import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, LogOut, PanelLeft, ShoppingBag, DollarSign,
  Palette, FileText, BarChart2, Megaphone, Tag, BookOpen, ExternalLink,
  Calendar, Gift, Users, Puzzle, Wrench, PackageOpen, ImageIcon, Settings,
  ChevronDown, Layers, Store,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { affiliateCatalogPath, affiliateDesignerPath, affiliateOrderPath, affiliateStorefrontUrl } from "@/lib/affiliateStorefrontUrl";
import { AffiliateStoreSwitcher } from "./AffiliateStoreSwitcher";
import { buildAffiliateCatalogVendors, customerLinkVisibility } from "@shared/affiliateStorefrontControls";

export type AffiliateSection =
  | "overview"
  | "crm"
  | "design"
  | "products"
  | "orders"
  | "earnings"
  | "analytics"
  | "catalog"
  | "images"
  | "pricing"
  | "promotions"
  | "appointments"
  | "installation"
  | "customize"
  | "marketing"
  | "plugins"
  | "tax"
  | "team"
  | "settings"
  | "bundles";

const NAV_ITEMS: { icon: React.ElementType; label: string; section: AffiliateSection }[] = [
  { icon: LayoutDashboard, label: "Overview", section: "overview" },
  { icon: ShoppingBag, label: "My CRM", section: "crm" },
  { icon: Palette, label: "Design Workspace", section: "design" },
  { icon: PackageOpen, label: "Products: Pelican & Closets", section: "products" },
  { icon: ShoppingBag, label: "Orders", section: "orders" },
  { icon: DollarSign, label: "Earnings", section: "earnings" },
  { icon: BarChart2, label: "Analytics", section: "analytics" },
  { icon: BookOpen, label: "My Catalog", section: "catalog" },
  { icon: ImageIcon, label: "Image Cabinet", section: "images" },
  { icon: Tag, label: "Pricing & Margins", section: "pricing" },
  { icon: Gift, label: "Promotions & Banners", section: "promotions" },
  { icon: Calendar, label: "Appointments", section: "appointments" },
  { icon: Wrench, label: "Installation Estimates", section: "installation" },
  { icon: Palette, label: "Customize Store", section: "customize" },
  { icon: Megaphone, label: "Marketing Hub", section: "marketing" },
  { icon: PackageOpen, label: "Kitchen Packages", section: "bundles" },
  { icon: Puzzle, label: "Plugins & Add-ons", section: "plugins" },
  { icon: FileText, label: "Tax Info (W-9)", section: "tax" },
  { icon: Users, label: "My Team", section: "team" },
  { icon: Settings, label: "Domain Setup", section: "settings" },
];

const SIDEBAR_WIDTH_KEY = "affiliate-sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 320;

type Props = {
  section: AffiliateSection;
  onSection: (s: AffiliateSection) => void;
  storeName: string;
  storeSlug: string;
  /** Current affiliate id — required for the admin store switcher. */
  affiliateId?: number;
  /** Team-member capabilities; owners and admins receive the full navigation. */
  isAffiliateOwner?: boolean;
  canAccessCrm?: boolean;
  canAccessDesigner?: boolean;
  catalogVendor?: string | null;
  onOpenCatalog?: (vendorKey: string | null) => void;
  children: React.ReactNode;
};
export function AffiliateDashboardLayout({ section, onSection, storeName, storeSlug, affiliateId, isAffiliateOwner = true, canAccessCrm = true, canAccessDesigner = true, catalogVendor = null, onOpenCatalog, children }: Props) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const isMobile = useIsMobile();
  const { logout } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <h1 className="text-2xl font-semibold tracking-tight text-center">Sign in to continue</h1>
          <p className="text-sm text-muted-foreground text-center">Access to the affiliate dashboard requires authentication.</p>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <SidebarInner
        section={section}
        onSection={onSection}
        storeName={storeName}
        storeSlug={storeSlug}
        affiliateId={affiliateId}
        isAffiliateOwner={isAffiliateOwner}
        canAccessCrm={canAccessCrm}
        canAccessDesigner={canAccessDesigner}
        catalogVendor={catalogVendor}
        onOpenCatalog={onOpenCatalog}
        setSidebarWidth={setSidebarWidth}
        user={user}
        logout={logout}
        isMobile={isMobile}
      >
        {children}
      </SidebarInner>
    </SidebarProvider>
  );
}

function CustomerLink({ label, href, icon: Icon, tooltip }: { label: string; href: string; icon: React.ElementType; tooltip: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={tooltip} className="h-10 font-normal">
        <a href={href} target="_blank" rel="noopener noreferrer">
          <Icon className="h-4 w-4" />
          <span className="truncate">{label}</span>
          <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden />
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarInner({
  section, onSection, storeName, storeSlug, affiliateId, isAffiliateOwner, canAccessCrm, canAccessDesigner, catalogVendor, onOpenCatalog, setSidebarWidth, user, logout, isMobile, children,
}: Props & { setSidebarWidth: (w: number) => void; user: { name?: string | null; email?: string | null; role?: string | null } | null; logout: () => void; isMobile: boolean }) {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [customerLinksOpen, setCustomerLinksOpen] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeItem = NAV_ITEMS.find((i) => i.section === section);
  const storeUrl = affiliateStorefrontUrl(storeSlug);
  const catalogUrl = affiliateCatalogPath(storeSlug);
  const designerUrl = affiliateDesignerPath(storeSlug);
  const quoteUrl = affiliateOrderPath(storeSlug);
  const isAdmin = user?.role === "admin";
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    isAffiliateOwner || isAdmin || item.section === "overview" || (item.section === "crm" && canAccessCrm) || (item.section === "design" && canAccessDesigner),
  );
  const ordersRank = NAV_ITEMS.findIndex((item) => item.section === "orders");
  const rankOf = (item: { section: AffiliateSection }) => NAV_ITEMS.findIndex((entry) => entry.section === item.section);
  const headItems = visibleNavItems.filter((item) => rankOf(item) <= ordersRank);
  const tailItems = visibleNavItems.filter((item) => rankOf(item) > ordersRank);
  const linkAccess = customerLinkVisibility({
    isAffiliateOwner: Boolean(isAffiliateOwner),
    isAdmin: Boolean(isAdmin),
    canAccessCrm: Boolean(canAccessCrm),
    canAccessDesigner: Boolean(canAccessDesigner),
  });
  const ownBranding = trpc.affiliates.myBranding.useQuery(undefined, {
    enabled: Boolean(isAffiliateOwner && !isAdmin),
  });
  const adminBranding = trpc.affiliates.adminBranding.useQuery(
    { affiliateId: affiliateId ?? 0 },
    { enabled: Boolean(isAdmin && affiliateId) },
  );
  const distributorSelections = (isAdmin ? adminBranding.data : ownBranding.data)?.distributorSelections;
  const vendorNav = buildAffiliateCatalogVendors(
    distributorSelections
      ? distributorSelections.map((row) => ({ id: row.id, name: row.name, publicName: row.publicName, selected: row.selected }))
      : null,
  );
  const openCatalog = (vendorKey: string | null) => {
    onOpenCatalog?.(vendorKey);
    onSection("catalog");
  };

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const w = e.clientX - left;
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setSidebarWidth(w);
    };
    const onUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  {user?.role === "admin" && affiliateId ? (
                    <AffiliateStoreSwitcher
                      currentId={affiliateId}
                      currentName={storeName}
                      isAdmin
                    />
                  ) : (
                    <span className="font-semibold tracking-tight truncate text-sm">{storeName}</span>
                  )}
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-x-hidden overflow-y-auto">
            <SidebarMenu className="px-2 py-1">
              {headItems.map((item) => {
                const isActive = item.section === section;
                return (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSection(item.section)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                      data-tab={item.section}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span className="truncate">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {linkAccess.showSection && (
              <SidebarGroup className="px-2 py-1" data-testid="customer-links">
                <Collapsible open={customerLinksOpen || isCollapsed} onOpenChange={setCustomerLinksOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex h-8 w-full items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden">
                      Customer links
                      <ChevronDown className={`ml-auto size-4 transition-transform ${customerLinksOpen ? "" : "-rotate-90"}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {linkAccess.catalog && (
                          <CustomerLink label="Browse my catalog" href={catalogUrl} icon={BookOpen} tooltip="Browse my catalog" />
                        )}
                        {linkAccess.designer && (
                          <CustomerLink label="Preview Storefront Designer" href={designerUrl} icon={Palette} tooltip="See the 3D designer the way your customers see it. To design for a customer, use Design Workspace." />
                        )}
                        {linkAccess.closet && (
                          <CustomerLink label="Open Closet Studio" href={`/store/${storeSlug}/closet`} icon={Layers} tooltip="Open Closet Studio" />
                        )}
                        {linkAccess.quote && (
                          <CustomerLink label="Preview Quote Page" href={quoteUrl} icon={FileText} tooltip="The quote request page your customers see" />
                        )}
                        {linkAccess.storefront && (
                          <CustomerLink label="View my storefront" href={storeUrl} icon={Store} tooltip="View my storefront" />
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            )}

            <SidebarGroup className="px-2 py-1" data-testid="sidebar-tail">
              <SidebarGroupContent>
                <SidebarMenu>
                  {tailItems.map((item) => {
                    if (item.section === "catalog") {
                      return (
                        <Collapsible key={item.section} open={catalogOpen || isCollapsed} onOpenChange={setCatalogOpen}>
                          <SidebarMenuItem>
                            <div className="flex items-center">
                              <SidebarMenuButton
                                isActive={section === "catalog" && !catalogVendor}
                                tooltip="My Catalog"
                                className="h-10 min-w-0 flex-1 font-normal"
                                onClick={() => openCatalog(null)}
                                data-tab="catalog"
                              >
                                <BookOpen className="h-4 w-4" />
                                <span className="truncate">My Catalog</span>
                              </SidebarMenuButton>
                              <CollapsibleTrigger asChild>
                                <button type="button" className="mr-1 inline-flex size-7 items-center justify-center rounded-md hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden" aria-label="Show vendor catalogs">
                                  <ChevronDown className={`size-4 transition-transform ${catalogOpen ? "" : "-rotate-90"}`} />
                                </button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {vendorNav.vendors.map((vendor) => (
                                  <SidebarMenuSubItem key={vendor.key}>
                                    <SidebarMenuSubButton
                                      isActive={section === "catalog" && catalogVendor === vendor.key}
                                      className="h-10"
                                      onClick={() => openCatalog(vendor.key)}
                                    >
                                      <span className="truncate">{vendor.label}</span>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }
                    const isActive = item.section === section;
                    return (
                      <SidebarMenuItem key={item.section}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => onSection(item.section)}
                          tooltip={item.label}
                          className="h-10 transition-all font-normal"
                          data-tab={item.section}
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="relative z-10 bg-sidebar p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">{user?.email || "-"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground">{activeItem?.label ?? "Dashboard"}</span>
            </div>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
