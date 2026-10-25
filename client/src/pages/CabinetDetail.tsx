import { useState, useMemo, useEffect } from "react";
import { GlassPolicyBadge } from "@/components/GlassPolicyBadge";
import { Link, useLocation, useSearch } from "wouter";
import {
  ChevronLeft, Package, Palette, DollarSign,
  ShoppingCart, Info, Check, Lock,
  Pencil, X, Upload, Search, Sparkles, ArrowRight,
  AlertTriangle, Plus, Trash2, GripVertical, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CabinetVerificationControl } from "@/components/admin/CabinetVerificationControl";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  type PricingTier,
  resolveStorefrontTier,
  resolveTierPrice,
  compareAtPrice,
  tierLabel,
  ownerCostBreakdown,
} from "@shared/pricingTier";
import { CabinetImage } from "@/components/CabinetImage";
import { styleDisplayName } from "@/lib/styleDisplayName";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { DrawerLayoutEditor, LayoutSpecBuilder, defaultLayoutSpec } from "@/components/admin/CabinetConfigAdmin";
import { CUSTOM_CABINET_PROFILES } from "@/lib/customCabinetProfiles";
import { cabinetTypeLabel, resolveDoorDrawerCounts, cabinetDrawingType } from "@/lib/cabinetGraphics";
import { DoorStyleSwatch } from "@/components/DoorStyleSwatch";
import { doorFamilyPhoto } from "@/lib/doorFamilyPhotos";
import { finishColors, finishColorsWithName } from "@/lib/design";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSeo } from "@/hooks/useSeo";
import { buildProductJsonLd } from "@/lib/seo/jsonLd";
import { translateSpec } from "@/lib/i18n/specPhrases";
import { nonEmptyStyleCategories } from "@/lib/catalogCategories";
import { DoorDrawerDiagram } from "@/components/design/DoorDrawerDiagram";
import { affiliateCabinetHref, affiliateCatalogRootHref, affiliateDesignerHref } from "@/lib/affiliateStorefrontRoute";
import { affiliateSlugForStoreScope, resolveStoreScope } from "@/lib/affiliateContext";
import { aefPrintedGeometryForSku } from "@shared/aefFramelessGeometry";
import { catalogPublicCopy, publicTechnicalDrawingNote } from "@shared/catalogPublicDescription";
import { aefProductDiagramCabinet } from "@shared/aefProductRenderPresentation";
import {
  CABINET_ATTENTION_RETURN_URL,
  DESIGNER_COVERAGE_RETURN_URL,
  canFinalizeCabinetConfiguration,
  DISTRIBUTOR_CONNECTION_REQUIRED_MESSAGE,
  shouldShowCabinetAttentionReturn,
  shouldShowDesignerCoverageReturn,
} from "@shared/cabinetConfigReview";

// ─── Cabinet categories (loaded from DB, with hardcoded fallback) ────────────
const FALLBACK_CATEGORIES = [
  "Base", "Wall", "Tall", "Corner", "Drawer", "Specialty",
  "Vanity", "Pantry", "Island", "Filler", "Molding", "Accessory",
] as const;

const FALLBACK_SUB_CATEGORIES: Record<string, string[]> = {
  Base:      ["Standard Base","Sink Base","Blind Corner Base","Drawer Base","Lazy Susan","Appliance Garage","Pull-Out"],
  Wall:      ["Standard Wall","Blind Corner Wall","Corner Wall","Open Shelf","Microwave Wall","Glass Door"],
  Tall:      ["Pantry","Oven Tower","Utility","Linen"],
  Corner:    ["Lazy Susan","Blind Corner","Diagonal","Easy Reach"],
  Drawer:    ["Drawer Base","Peg Drawer","Utensil Drawer"],
  Specialty: ["Spice Pull-Out","Tray Divider","Waste Bin","Appliance Lift","Mixer Shelf"],
  Vanity:    ["Vanity Base","Vanity Drawer","Vanity Sink","Medicine Cabinet","Linen Tower"],
  Pantry:    ["Pantry Cabinet","Pantry Pull-Out"],
  Island:    ["Island Base","Island Drawer"],
  Filler:    ["Filler Panel","Side Panel","Scribe Moulding"],
  Molding:   ["Crown Moulding","Light Rail","Base Moulding","Valance"],
  Accessory: ["Hardware","Organizer","Shelf","Lazy Susan Insert","Drawer Insert"],
};

/** Hook to get dynamic categories from DB with fallback */
function useDynamicCategories() {
  const { data: dbCats } = trpc.cabinetCategories.list.useQuery();
  if (!dbCats || dbCats.length === 0) {
    return { categoryNames: FALLBACK_CATEGORIES as unknown as string[], subCategoriesMap: FALLBACK_SUB_CATEGORIES };
  }
  const categoryNames = dbCats.map((c) => c.name);
  const subCategoriesMap: Record<string, string[]> = {};
  for (const cat of dbCats) {
    subCategoriesMap[cat.name] = cat.subCategories.map((s) => s.name);
  }
  return { categoryNames, subCategoriesMap };
}

// ─── Price tier display ───────────────────────────────────────────────────────
// Retail storefront: guests/homeowners see retail (homeowner) pricing with a
// "Compare at" strike-through. Logged-in pros see the tier the owner assigned
// to their account (contractor or wholesale).

const TIER_DESCRIPTION: Record<PricingTier, string> = {
  homeowner: "Retail price for homeowners",
  contractor: "For general contractors & remodelers",
  wholesale: "For licensed dealers & high-volume trade accounts",
};

// Kept as a re-export while focused detail-page tests migrate to the shared
// presentation helper. The original admin/source values remain untouched.
export { publicTechnicalDrawingNote };
// These codes are supplier/legacy references for the same physical cabinet.
// Keep their links working after the catalog is consolidated under BA-24.
export const LEGACY_CANONICAL_CABINET_CODES: Record<string, string> = {
  "BA-24": "BEC-24",
  BEC24: "BEC-24",
};

export function canonicalCabinetDetailCode(masterCode: string): string {
  return LEGACY_CANONICAL_CABINET_CODES[masterCode.trim().toUpperCase()] ?? masterCode;
}

export function isBlindCornerCode(masterCode: string | null, description?: string | null): boolean {
  const code = (masterCode || "").toUpperCase();
  if (/^(BBC|WBC|BBL|BBR|WBL|WBR)/.test(code)) return true;
  if (/-BLIND|BLIND/.test(code)) return true;
  return /blind\s*corner/.test((description || "").toLowerCase());
}

function fmt(val: string | null | undefined): string {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
}

/** Display stored decimal inches in the source book's familiar eighth-inch form. */
function formatCatalogInches(value: string | null | undefined): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const whole = Math.floor(n);
  const eighths = Math.round((n - whole) * 8);
  const fraction = new Map<number, string>([
    [1, "1/8"], [2, "1/4"], [3, "3/8"], [4, "1/2"],
    [5, "5/8"], [6, "3/4"], [7, "7/8"],
  ]).get(eighths);
  if (eighths === 0) return `${whole}\"`;
  if (eighths === 8) return `${whole + 1}\"`;
  return fraction ? `${whole} ${fraction}\"` : `${n}\"`;
}

// ─── Door-style pricing row (distributor identity never exposed) ───────────────

interface StyleRow {
  styleId: number;
  styleCode: string;
  name: string;
  doorStyle: string | null;
  finish: string | null;
  color: string | null;
  doorSampleImageUrl: string | null;
  roomSceneImageUrl: string | null;
  thumbnailImageUrl: string | null;
  listPrice: string | null;
  adjustedListPrice: string | null;
  wholesalePrice: string | null;
  contractorPrice: string | null;
  homeownerPrice: string | null;
  // Administration-only raw supplier acquisition cost.
  yourCost?: string | null;
  // Affiliate-owner-only amount after Administration multiplier/fees. The raw
  // supplier acquisition cost must never be returned alongside this value.
  affiliateCost?: string | null;
  platformSku: string;
  /** Customer-facing product description, scoped to the selected cabinet line. */
  supplierDescription?: string | null;
  /** Customer-safe construction signal for verified printed geometry. */
  isFrameless?: boolean;
  leadTimeDays: number | null;
  distributorId: number | null;
  /** Whether this selected distributor includes the insert for PG/GD/G cabinetry. */
  glassIncluded?: boolean | null;
  // Image assigned in the Product Images admin tab for this specific SKU/cabinet.
  skuImageUrl?: string | null;
  // Resolved shipping package dimensions (distributor override ?? master fallback)
  pkgLength?: string | null;
  pkgWidth?: string | null;
  pkgHeight?: string | null;
  pkgWeight?: string | null;
  // Line-specific image override (null = use master catalogImageUrl)
  distributorImageUrl?: string | null;
}

function priceNumberForTier(row: StyleRow, tier: PricingTier): number | null {
  return resolveTierPrice(tier, row);
}

function priceForTier(row: StyleRow, tier: PricingTier): string {
  const n = priceNumberForTier(row, tier);
  return n == null ? "—" : `$${n.toFixed(2)}`;
}

// ─── Promo helpers ──────────────────────────────────────────────────────────
type ActivePromo = {
  id: number;
  distributorId: number;
  name: string;
  skuIds: unknown;
  styleId: number | null;
  category: string | null;
  discountType: "percent" | "fixed_price";
  discountValue: string;
};

function findMatchingPromo(
  promos: ActivePromo[],
  row: StyleRow,
  cabinetCategory?: string | null
): ActivePromo | null {
  if (!promos.length) return null;
  for (const p of promos) {
    if (row.distributorId != null && p.distributorId !== row.distributorId) continue;
    // Check targeting: skuIds, styleId, or category
    const matchesSku = p.skuIds && Array.isArray(p.skuIds) && (p.skuIds as number[]).includes(row.styleId);
    const matchesStyle = p.styleId != null && p.styleId === row.styleId;
    const matchesCategory = p.category != null && cabinetCategory != null && p.category === cabinetCategory;
    const isUntargeted = !p.skuIds && p.styleId == null && !p.category;
    if (matchesSku || matchesStyle || matchesCategory || isUntargeted) return p;
  }
  return null;
}

function applyPromoToPrice(promo: ActivePromo, originalPrice: number): number {
  const val = Number(promo.discountValue);
  if (promo.discountType === "percent") {
    return originalPrice * (1 - val / 100);
  }
  // fixed_price = the promo IS the new price
  return val;
}

// ─── Price card (tier price + homeowner "Compare at" strike-through) ─────────

export function PriceCard({
  row,
  tier,
  viewerRole = "customer",
  promo = null,
  affiliateStorefront = false,
}: {
  row: StyleRow;
  tier: PricingTier;
  viewerRole?: "admin" | "affiliate-owner" | "customer";
  promo?: ActivePromo | null;
  affiliateStorefront?: boolean;
}) {
  let price = priceNumberForTier(row, tier);
  const compareAt = compareAtPrice(tier, row);
  const privateCost = viewerRole === "admin"
    ? row.yourCost
    : viewerRole === "affiliate-owner"
      ? row.affiliateCost
      : null;
  const owner = privateCost != null
    ? ownerCostBreakdown({ ...row, yourCost: privateCost }, tier)
    : null;
  const privateCostLabel = viewerRole === "admin" ? "My Cost" : "Affiliate Cost";
  const privateViewLabel = viewerRole === "admin"
    ? "Administration view · not shown to customers"
    : "Affiliate view · not shown to customers";

  // Apply promo discount if active
  let promoActive = false;
  let originalPrice = price;
  if (promo && price != null) {
    originalPrice = price;
    price = applyPromoToPrice(promo, price);
    promoActive = true;
  }

  const savePct =
    promoActive && originalPrice != null && price != null && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : compareAt != null && price != null && compareAt > price
        ? Math.round(((compareAt - price) / compareAt) * 100)
        : null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          {promoActive && (
            <div className="mb-1">
              <Badge className="bg-red-600 text-white hover:bg-red-600 text-[10px] uppercase tracking-wider">
                Sale — {promo!.name}
              </Badge>
            </div>
          )}
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="text-3xl font-bold text-foreground">
              {price == null ? "—" : `$${price.toFixed(2)}`}
            </div>
            {promoActive && originalPrice != null && (
              <div className="text-base text-muted-foreground line-through">
                ${originalPrice.toFixed(2)}
              </div>
            )}
            {!promoActive && compareAt != null && (
              <div className="text-base text-muted-foreground line-through">
                ${compareAt.toFixed(2)}
              </div>
            )}
            {savePct != null && savePct > 0 && (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                Save {savePct}%
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {affiliateStorefront ? "Affiliate sale price" : TIER_DESCRIPTION[tier]}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          {tier !== "homeowner" && <div>MSRP: {fmt(row.listPrice)}</div>}
          {row.leadTimeDays != null && <div>Lead time: ~{row.leadTimeDays} days</div>}
        </div>
      </div>

      {owner && owner.myCost != null && (
        <div className="mt-3 pt-3 border-t border-dashed border-amber-500/60 rounded-md bg-amber-500/5 px-3 py-2">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
            <span>{privateViewLabel}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">{privateCostLabel}</div>
              <div className="font-semibold text-foreground">${owner.myCost.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sells At ({tierLabel(tier)})</div>
              <div className="font-semibold text-foreground">
                {owner.sellPrice == null ? "—" : `$${owner.sellPrice.toFixed(2)}`}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Margin</div>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                {owner.marginDollars == null
                  ? "—"
                  : `$${owner.marginDollars.toFixed(2)}${owner.marginPct != null ? ` (${owner.marginPct}%)` : ""}`}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
        <span>{row.name}</span>
        {row.doorStyle && (
          <>
            <span className="mx-2">·</span>
            <span>{row.doorStyle}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function resolveCabinetDetailViewerRole(
  isAdministration: boolean,
  affiliateCost: string | null | undefined,
): "admin" | "affiliate-owner" | "customer" {
  if (isAdministration) return "admin";
  return affiliateCost != null ? "affiliate-owner" : "customer";
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

interface Props {
  masterCode: string;
}

export default function CabinetDetail({ masterCode }: Props) {
  const { categoryNames, subCategoriesMap } = useDynamicCategories();
  const searchStr = useSearch();
  const [, setLocation] = useLocation();
  const canonicalMasterCode = canonicalCabinetDetailCode(masterCode);
  const affiliateSlug = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return affiliateSlugForStoreScope(resolveStoreScope({
      pathname: window.location.pathname,
      search: searchStr,
      hostname: window.location.hostname,
    })) ?? undefined;
  }, [searchStr]);
  // When a shopper arrives from a door-style FAMILY page we pre-lock that style
  // (passed as ?style=<styleId>) so the cabinet shows in the family they picked.
  const styleParam = (() => {
    const v = new URLSearchParams(searchStr).get("style");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  })();
  const cabinetIdParam = (() => {
    const v = new URLSearchParams(searchStr).get("cabinetId");
    const n = v ? Number(v) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  })();
  const cabinetAttentionReturnSource = new URLSearchParams(searchStr).get("from");
  const gapDistributorParam = (() => {
    const value = new URLSearchParams(searchStr).get("distributorId");
    const parsed = value ? Number(value) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  })();
  const [selectedStyleId, setSelectedStyleId] = useState<number | null>(styleParam);
  const { user } = useAuth();
  // The viewer's storefront tier: guests/homeowners see retail; logged-in pros
  // see their assigned tier. Pros may toggle to compare, but the default is
  // their own tier.
  const viewerTier = resolveStorefrontTier(user);
  const [tierOverride, setTierOverride] = useState<PricingTier | null>(null);
  const tier: PricingTier = tierOverride ?? viewerTier;
  const setTier = (t: PricingTier) => setTierOverride(t);
  // Pros (assigned a trade tier) may switch between homeowner/contractor/
  // wholesale to compare; pure homeowners/guests only ever see retail.
  const isPro = viewerTier !== "homeowner";
  // Administration sees raw My Cost. An authorized affiliate owner sees only a
  // separate, multiplier-adjusted Affiliate Cost. Customers and staff see neither.
  const isOwner = user?.role === "admin";
  const showCabinetAttentionReturn = shouldShowCabinetAttentionReturn(isOwner, cabinetAttentionReturnSource);
  const showDesignerCoverageReturn = shouldShowDesignerCoverageReturn(isOwner, cabinetAttentionReturnSource);
  const isDesignerCoverageGapEdit = showDesignerCoverageReturn && styleParam != null && gapDistributorParam != null;
  const visibleTiers: PricingTier[] = isPro || isOwner
    ? ["homeowner", "contractor", "wholesale"]
    : ["homeowner"];
  const [qty, setQty] = useState(1);
  const { t, lang } = useLanguage();

  const { data: cabinetById, isLoading: cabinetByIdLoading } = trpc.cabinets.byId.useQuery(
    { id: cabinetIdParam ?? 0 },
    { enabled: cabinetIdParam != null },
  );
  const { data: cabinetByCode, isLoading: cabinetByCodeLoading } = trpc.cabinets.byCode.useQuery({
    masterCode: canonicalMasterCode,
  }, { enabled: cabinetIdParam == null });
  const masterCabinet = cabinetById ?? cabinetByCode;
  const cabinetLoading = cabinetIdParam != null ? cabinetByIdLoading : cabinetByCodeLoading;
  const { data: styles, isLoading: pricingLoading } = trpc.pricing.stylesForCabinet.useQuery(
    { cabinetId: masterCabinet?.id ?? 0, affiliateSlug, styleId: styleParam ?? undefined },
    { enabled: !!masterCabinet?.id }
  );

  const styleRows = (styles ?? []) as StyleRow[];
  const isAffiliateStorefront = Boolean(affiliateSlug);

  // Auto-select: the family passed in ?style= if it's available for this
  // cabinet, otherwise the explicit user choice, otherwise the first style.
  const styleParamAvailable =
    styleParam != null && styleRows.some((s) => s.styleId === styleParam);
  const activeStyle =
    selectedStyleId ??
    (styleParamAvailable ? styleParam : null) ??
    styleRows[0]?.styleId ??
    null;
  const selectedRow = styleRows.find((s) => s.styleId === activeStyle) ?? null;
  // A line may share the master code with another construction (for example,
  // Frameless B24S). Use the selected line's product description without ever
  // changing the shared master description.
  const displayedDescription = selectedRow?.supplierDescription?.trim() || masterCabinet?.description || canonicalMasterCode;
  // Supplier/master descriptions are retained as source records. Derive a
  // source-free, compact public title and dimension-aware SEO description only
  // for customer presentation; do not write either result back to the editor.
  const publicProductCopy = useMemo(
    () => catalogPublicCopy(displayedDescription, canonicalMasterCode),
    [displayedDescription, canonicalMasterCode],
  );
  const aefDetailGeometry = useMemo(
    () => selectedRow?.isFrameless && masterCabinet
      ? aefPrintedGeometryForSku(masterCabinet.masterCode)
      : null,
    [masterCabinet?.masterCode, selectedRow?.isFrameless],
  );
  // A distributor's own configuration rule (saved per distributor from the
  // Edit Cabinet picker) is layered over the shared master for display only
  // while that distributor's door style is selected. Never touches pricing.
  const { data: distributorRule } = trpc.cabinetOverrides.configForDistributor.useQuery(
    { cabinetId: masterCabinet?.id ?? 0, distributorId: selectedRow?.distributorId ?? 0 },
    { enabled: Boolean(masterCabinet?.id && selectedRow?.distributorId) },
  );
  const cabinet = useMemo(() => {
    if (!masterCabinet) return masterCabinet;
    const next: Record<string, unknown> = { ...masterCabinet };
    let changed = false;
    for (const [key, value] of Object.entries(distributorRule?.config ?? {})) {
      if (value === undefined || !(key in next)) continue;
      if (next[key] !== value) { next[key] = value; changed = true; }
    }
    // AEF shares master codes with framed lines. For this line only, show the
    // exact source-book dimensions instead of the shared master defaults.
    if (aefDetailGeometry) {
      for (const [key, value] of Object.entries({
        width: String(aefDetailGeometry.width),
        height: String(aefDetailGeometry.height),
        depth: String(aefDetailGeometry.depth),
      })) {
        if (next[key] !== value) { next[key] = value; changed = true; }
      }
    }
    return changed ? (next as typeof masterCabinet) : masterCabinet;
  }, [masterCabinet, distributorRule, aefDetailGeometry]);
  const hasDistributorRule = Boolean(distributorRule?.config) && cabinet !== masterCabinet;

  const resolvedMasterCode = cabinet?.masterCode ?? canonicalMasterCode;

  const seoName = translateSpec(publicProductCopy.title, lang);
  const seoDescription = translateSpec(publicProductCopy.description, lang);
  // Product structured data (no Offer — cabinet pricing is tier/member-gated
  // and must not be published in markup). Memoized so the JSON-LD <script>
  // isn't re-injected on every render.
  const cabinetJsonLd = useMemo(
    () =>
      cabinet
        ? buildProductJsonLd({
            name: seoName,
            description: seoDescription,
            sku: resolvedMasterCode,
            image: selectedRow?.distributorImageUrl || cabinet.catalogImageUrl || undefined,
            url:
              typeof window !== "undefined"
                ? `${window.location.origin}/catalog/${resolvedMasterCode}`
                : undefined,
            category: cabinet.category ?? undefined,
          })
        : undefined,
    [cabinet, seoDescription, seoName, resolvedMasterCode, selectedRow?.distributorImageUrl],
  );
  useSeo({
    title: t("seo_cabinet_t", { name: seoName }),
    description: t("seo_cabinet_d", { name: seoName }),
    type: "product",
    lang,
    ...(cabinetJsonLd ? { jsonLd: cabinetJsonLd } : {}),
  });

  // The server supplies raw `yourCost` only to Administration and the adjusted
  // `affiliateCost` only to an owner browsing their own storefront. No client
  // condition can create either value without server authorization.
  const viewerRole = resolveCabinetDetailViewerRole(isOwner, selectedRow?.affiliateCost);
  const canViewPrivateCost = viewerRole !== "customer";

  // Fetch active promotions for storefront display
  const { data: activePromos } = trpc.promotions.activeForStorefront.useQuery();
  const activePromo = useMemo(() => {
    // Affiliate storefront prices already come from the server's protected
    // cost-floor calculator. A generic platform promo must not replace them.
    if (isAffiliateStorefront) return null;
    if (!selectedRow || !activePromos?.length) return null;
    return findMatchingPromo(activePromos as ActivePromo[], selectedRow, cabinet?.category);
  }, [isAffiliateStorefront, selectedRow, activePromos, cabinet?.category]);

  // Recolor the to-scale drawing to the selected door style's real finish.
  const finishResult = finishColorsWithName(
    selectedRow?.name,
    selectedRow?.color,
    selectedRow?.finish,
    selectedRow?.styleCode
  );
  const finishFace = finishResult.face;
  const swColorName = finishResult.swName ?? null; // e.g. "Alabaster SW 7008"

  const { addItem, lockedDistributorId, lockedStyleLabel, clear } = useCart();

  // ── Pricing visibility gate ──────────────────────────────────────────────────
  const { data: siteSettingsData } = trpc.siteSettings.getPublicSettings.useQuery();
  const pricingVisibility = siteSettingsData?.pricingVisibility ?? "public";
  const canSeePricing = (() => {
    if (isOwner) return true; // admin always sees pricing
    if (pricingVisibility === "hidden") return false;
    if (pricingVisibility === "public") return true;
    if (pricingVisibility === "logged_in") return !!user;
    if (pricingVisibility === "dealer") {
      const tradeRoles = ["admin", "dealer", "distributor", "partner"];
      const tradeTiers = ["contractor", "wholesale"];
      return !!user && (tradeRoles.includes(user.role ?? "") || tradeTiers.includes(user.pricingTier ?? ""));
    }
    if (pricingVisibility === "admin") return false; // only admin (handled above)
    return true;
  })();

  // ── Admin inline edit ────────────────────────────────────────────────────────
  // Auto-open the edit dialog when ?edit=1 is in the URL (e.g. from "Edit Config" in the design tool).
  const autoEdit = new URLSearchParams(searchStr).get("edit") === "1";
  const [editOpen, setEditOpen] = useState(false);
  // Once auth resolves and user is confirmed admin, auto-open if ?edit=1 was in the URL.
  useEffect(() => {
    if (autoEdit && isOwner) setEditOpen(true);
  // Only fire once when isOwner first becomes true (auth loaded).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);
  const [overrideDistId, setOverrideDistId] = useState<number | null>(null);
  const [overrideFields, setOverrideFields] = useState<Record<string, string>>({});
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubCategory, setEditSubCategory] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [editShowInCatalog, setEditShowInCatalog] = useState(true);
  const [editShowInDesigner, setEditShowInDesigner] = useState(true);
  const [editShowIn2020, setEditShowIn2020] = useState(true);
  const [editWidth, setEditWidth] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editDepth, setEditDepth] = useState("__custom__");
  const [editPhysicalWidth, setEditPhysicalWidth] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editPkgLength, setEditPkgLength] = useState("");
  const [editPkgWidth, setEditPkgWidth] = useState("");
  const [editPkgHeight, setEditPkgHeight] = useState("");
  const [editPkgWeight, setEditPkgWeight] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  // Scoped image upload
  const [scopedImageOpen, setScopedImageOpen] = useState(false);
  const [scopedImageUploading, setScopedImageUploading] = useState(false);
  const [scopedImageScope, setScopedImageScope] = useState<"line" | "global">("line");
  const [scopedImagePickerUrl, setScopedImagePickerUrl] = useState("");
  const [editNumDoors, setEditNumDoors] = useState<string>("0");
  const [editNumDrawers, setEditNumDrawers] = useState<string>("0");
  const [editNumFixedShelves, setEditNumFixedShelves] = useState<string>("0");
  const [editNumAdjShelves, setEditNumAdjShelves] = useState<string>("0");
  const [editIsNotCabinet, setEditIsNotCabinet] = useState(false);
  const [editDoorOrientation, setEditDoorOrientation] = useState<string>("__none__");
  const [editCornerType, setEditCornerType] = useState<string>("__none__");
  const [editOpeningType, setEditOpeningType] = useState<string>("__none__");
  const [editDoorHeight, setEditDoorHeight] = useState<string>("");
  const [editDrawerHeight, setEditDrawerHeight] = useState<string>("");
  const [editDrawerLayout, setEditDrawerLayout] = useState<string | null>(null);
  const [editDoorsPerRow, setEditDoorsPerRow] = useState<string>("__auto__");
  const [editConfigVerified, setEditConfigVerified] = useState(false);
  // Additional fields matching CabinetConfigAdmin
  const [editGrainDirection, setEditGrainDirection] = useState<string>("");
  const [editIsDecorativeDoor, setEditIsDecorativeDoor] = useState(false);
  const [editMinPull, setEditMinPull] = useState<string>("");
  const [editMaxPull, setEditMaxPull] = useState<string>("");
  const [editOpeningWidth, setEditOpeningWidth] = useState<string>("");
  const [editShelfRadius, setEditShelfRadius] = useState<string>("");
  const [editShelfCount, setEditShelfCount] = useState<string>("__none__");
  const [editCabinetSquare, setEditCabinetSquare] = useState<string>("");
  const [editFaceWidth, setEditFaceWidth] = useState<string>("");
  const [editLegWidth, setEditLegWidth] = useState<string>("");
  const [editLayoutSpec, setEditLayoutSpec] = useState<string | null>(null);
  const [editSpecImageUrl, setEditSpecImageUrl] = useState<string>("");
  const [editSpecNotes, setEditSpecNotes] = useState<string>("");
  const [editFacePattern, setEditFacePattern] = useState<string>("__none__");
  const [editGraphicType, setEditGraphicType] = useState<string>("standard");
  const [editMasterCode, setEditMasterCode] = useState<string>("");
  const [connectionDistributorId, setConnectionDistributorId] = useState<string>("");
  const [connectionStyleId, setConnectionStyleId] = useState<string>("");
  const [connectionSku, setConnectionSku] = useState<string>("");
  const [saveScopeOpen, setSaveScopeOpen] = useState(false);
  const [saveScopeDistributorIds, setSaveScopeDistributorIds] = useState<number[]>([]);

  // The distributor override editor is deliberately within the same scrollable
  // form as the master fields. When a row is selected, take the editor into
  // view so its actual inputs are never hidden below the modal footer.
  useEffect(() => {
    if (overrideDistId === null || !editOpen) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("distributor-override-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editOpen, overrideDistId]);

  // Pre-fill form when dialog opens
  useEffect(() => {
    if (editOpen && cabinet) {
      setEditDescription(cabinet.description ?? "");
      setEditCategory(cabinet.category ?? "");
      setEditSubCategory(cabinet.subCategory ?? "");
      setEditImageUrl(cabinet.catalogImageUrl ?? "");
      setEditShowInCatalog(cabinet.showInCatalog ?? true);
      setEditShowInDesigner(cabinet.showInDesigner ?? true);
      setEditShowIn2020(cabinet.showIn2020 ?? true);
      setEditWidth(cabinet.width ?? "");
      setEditHeight(cabinet.height ?? "");
      setEditDepth(cabinet.depth ?? "__custom__");
      setEditPhysicalWidth(String((cabinet as Record<string, unknown>).physicalWidth ?? ""));
      setEditWeight(cabinet.weight ?? "");
      setEditPkgLength(String((cabinet as Record<string, unknown>).pkgLength ?? ""));
      setEditPkgWidth(String((cabinet as Record<string, unknown>).pkgWidth ?? ""));
      setEditPkgHeight(String((cabinet as Record<string, unknown>).pkgHeight ?? ""));
      setEditPkgWeight(String((cabinet as Record<string, unknown>).pkgWeight ?? ""));
      setEditIsActive(cabinet.isActive ?? true);
      const cab = cabinet as Record<string, unknown>;
      setEditNumDoors(String(cab.numberOfDoors ?? 0));
      setEditNumDrawers(String(cab.numberOfDrawers ?? 0));
      setEditNumFixedShelves(String(cab.numberOfFixedShelves ?? 0));
      setEditNumAdjShelves(String(cab.numberOfAdjShelves ?? 0));
      setEditIsNotCabinet(cab.isNotCabinet === true);
      setEditDoorOrientation(String(cab.doorOrientation ?? "__none__"));
      setEditCornerType(String(cab.cornerType ?? "__none__"));
      setEditOpeningType(String(cab.openingType ?? "__none__"));
      setEditDoorHeight(cab.doorHeight != null ? String(cab.doorHeight) : "");
      setEditDrawerHeight(cab.drawerHeight != null ? String(cab.drawerHeight) : "");
      setEditDrawerLayout(cab.drawerLayout != null ? String(cab.drawerLayout) : null);
      setEditDoorsPerRow(cab.doorsPerRow != null ? String(cab.doorsPerRow) : "__auto__");
      setEditConfigVerified(cab.configVerified === true);
      setEditGrainDirection(String(cab.grainDirection ?? ""));
      setEditIsDecorativeDoor(cab.isDecorativeDoor === true);
      setEditMinPull(cab.minPull != null ? String(cab.minPull) : "");
      setEditMaxPull(cab.maxPull != null ? String(cab.maxPull) : "");
      setEditOpeningWidth(cab.openingWidth != null ? String(cab.openingWidth) : "");
      setEditShelfRadius(cab.shelfRadius != null ? String(cab.shelfRadius) : "");
      setEditShelfCount(cab.shelfCount != null ? String(cab.shelfCount) : "__none__");
      setEditCabinetSquare(cab.cabinetSquare != null ? String(cab.cabinetSquare) : "");
      setEditFaceWidth(cab.faceWidth != null ? String(cab.faceWidth) : "");
      setEditLegWidth(cab.legWidth != null ? String(cab.legWidth) : "");
      setEditLayoutSpec(cab.layoutSpec != null ? String(cab.layoutSpec) : null);
      setEditSpecImageUrl(String(cab.specImageUrl ?? ""));
      setEditSpecNotes(String(cab.specNotes ?? ""));
      setEditFacePattern(String((cab as Record<string, unknown>).facePattern ?? "__none__"));
      setEditGraphicType(String(cab.graphicType ?? "standard"));
      setEditMasterCode(cabinet.masterCode ?? "");
    }
  }, [editOpen, cabinet]);

  // A red Designer Coverage cell identifies a cabinet/style/line with no
  // published SKU. Prefill that exact context, while still requiring the
  // administrator to enter the supplier's real SKU before submission.
  useEffect(() => {
    if (!editOpen || !isDesignerCoverageGapEdit || styleParam == null || gapDistributorParam == null) return;
    setConnectionDistributorId(String(gapDistributorParam));
    setConnectionStyleId(String(styleParam));
  }, [editOpen, gapDistributorParam, isDesignerCoverageGapEdit, styleParam]);

  // Distributor coverage + existing overrides for this cabinet (admin only)
  const { data: distCoverage, refetch: refetchDistCoverage } = trpc.genericCabinets.distributorCoverage.useQuery(
    { cabinetId: cabinet?.id ?? 0 },
    { enabled: !!cabinet?.id && isOwner }
  );
  const { data: distributorLines } = trpc.distributors.list.useQuery(undefined, { enabled: isOwner });
  const { data: allDoorStyles } = trpc.doorStyles.list.useQuery(undefined, { enabled: isOwner });
  const { data: existingOverrides, refetch: refetchOverrides } = trpc.cabinetOverrides.forCabinet.useQuery(
    { cabinetId: cabinet?.id ?? 0 },
    { enabled: !!cabinet?.id && isOwner }
  );
  const upsertOverride = trpc.cabinetOverrides.set.useMutation({
    onSuccess: () => {
      toast.success("Override saved");
      void refetchOverrides();
      setOverrideDistId(null);
      setOverrideFields({});
    },
    onError: (err: { message: string }) => toast.error(`Override failed: ${err.message}`),
  });
  const deleteOverride = trpc.cabinetOverrides.delete.useMutation({
    onSuccess: () => {
      toast.success("Override removed");
      void refetchOverrides();
    },
    onError: (err: { message: string }) => toast.error(`Delete failed: ${err.message}`),
  });

  const utils = trpc.useUtils();
  const connectDistributor = trpc.distributorPortal.submitNewProduct.useMutation({
    onSuccess: () => {
      toast.success("Distributor connection saved for review. Add approved pricing before publishing it.");
      void refetchDistCoverage();
      utils.pricing.stylesForCabinet.invalidate({ cabinetId: cabinet?.id ?? 0, affiliateSlug });
      void utils.cabinets.adminDesignerCoverage.invalidate();
      setConnectionDistributorId("");
      setConnectionStyleId("");
      setConnectionSku("");
    },
    onError: (err) => toast.error(`Distributor connection failed: ${err.message}`),
  });
  const updateCabinet = trpc.cabinets.adminUpdateCabinet.useMutation({
    onSuccess: () => {
      toast.success("Cabinet updated");
      utils.cabinets.byCode.invalidate({ masterCode });
      setEditOpen(false);
      if (showCabinetAttentionReturn) {
        setLocation(CABINET_ATTENTION_RETURN_URL);
      } else if (showDesignerCoverageReturn) {
        setLocation(DESIGNER_COVERAGE_RETURN_URL);
      }
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });
  const setDistributorConfig = trpc.cabinetOverrides.setConfig.useMutation({
    onSuccess: (_res, vars) => {
      toast.success(
        `Saved for ${vars.distributorIds.length} distributor${vars.distributorIds.length === 1 ? "" : "s"} only. The shared master was not changed.`,
      );
      utils.cabinets.byCode.invalidate({ masterCode });
      utils.cabinets.byId.invalidate();
      utils.cabinetOverrides.configForDistributor.invalidate();
      void refetchOverrides();
      setSaveScopeOpen(false);
      setEditOpen(false);
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });
  const uploadImage = trpc.cabinets.adminUploadCatalogImage.useMutation({
    onError: (err) => toast.error(`Upload failed: ${err.message}`),
  });
  const setLineImage = trpc.cabinetOverrides.setImage.useMutation({
    onSuccess: (res) => {
      toast.success(res.scope === "global" ? "Image updated for all lines" : "Image updated for this line only");
      utils.cabinets.byCode.invalidate({ masterCode });
      utils.pricing.stylesForCabinet.invalidate();
      setScopedImageOpen(false);
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });
  async function handleScopedImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !cabinet?.id) return;
    setScopedImageUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      const result = await uploadImage.mutateAsync({
        filename: file.name,
        dataBase64: dataUrl,
        contentType: file.type || "image/jpeg",
        slot: "thumbnail",
      });
      const distId = selectedRow?.distributorId ?? 0;
      await setLineImage.mutateAsync({
        cabinetId: cabinet.id,
        distributorId: distId,
        imageUrl: result.url,
        scope: scopedImageScope,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setScopedImageUploading(false);
    }
  }

  async function handleScopedImageUrl(url: string) {
    if (!url || !cabinet?.id) return;
    setScopedImagePickerUrl(url);
    setScopedImageUploading(true);
    try {
      const distId = selectedRow?.distributorId ?? 0;
      await setLineImage.mutateAsync({
        cabinetId: cabinet.id,
        distributorId: distId,
        imageUrl: url,
        scope: scopedImageScope,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setScopedImageUploading(false);
      setScopedImagePickerUrl("");
    }
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      const result = await uploadImage.mutateAsync({
        filename: file.name,
        dataBase64: dataUrl,
        contentType: file.type || "image/jpeg",
      });
      setEditImageUrl(result.url);
      toast.success("Image uploaded — click Save to apply");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setImageUploading(false);
    }
  }

  function handleSaveEdit() {
    if (!cabinet?.id) return;
    if (editConfigVerified && !canFinalizeCabinetConfiguration(distCoverage?.length)) {
      toast.error(DISTRIBUTOR_CONNECTION_REQUIRED_MESSAGE);
      return;
    }
    // A cabinet rule is never applied to every distributor at once from here:
    // the admin ticks each distributor the rule applies to.
    setSaveScopeDistributorIds([]);
    setSaveScopeOpen(true);
  }

  /** Rule fields stored per distributor (merged over the master at read time). */
  function buildDistributorConfigRule() {
    return {
      description: editDescription.trim() || null,
      category: editCategory.trim() || null,
      subCategory: editSubCategory.trim() || null,
      width: editWidth.trim() || null,
      height: editHeight.trim() || null,
      depth: (editDepth === "__custom__" || !editDepth.trim()) ? null : editDepth.trim(),
      physicalWidth: editPhysicalWidth.trim() || null,
      weight: editWeight.trim() || null,
      pkgLength: editPkgLength.trim() || null,
      pkgWidth: editPkgWidth.trim() || null,
      pkgHeight: editPkgHeight.trim() || null,
      pkgWeight: editPkgWeight.trim() || null,
      numberOfDoors: parseInt(editNumDoors) || 0,
      numberOfDrawers: parseInt(editNumDrawers) || 0,
      numberOfFixedShelves: parseInt(editNumFixedShelves) || 0,
      numberOfAdjShelves: parseInt(editNumAdjShelves) || 0,
      doorOrientation: editDoorOrientation === "__none__" ? null : (editDoorOrientation as "side-by-side" | "stacked"),
      cornerType:
        editCornerType === "__none__"
          ? null
          : (editCornerType as "lazy-susan" | "blind-corner" | "diagonal" | "pie-cut" | "l-shape"),
      openingType: editOpeningType === "__none__" ? null : (editOpeningType as "top" | "middle" | "bottom"),
      doorHeight: editDoorHeight ? parseFloat(editDoorHeight) : null,
      drawerHeight: editDrawerHeight ? parseFloat(editDrawerHeight) : null,
      drawerLayout: editDrawerLayout || null,
      doorsPerRow: editDoorsPerRow === "__auto__" ? null : parseInt(editDoorsPerRow),
      grainDirection: (editGrainDirection || null) as "vertical" | "horizontal" | null,
      isDecorativeDoor: editIsDecorativeDoor,
      minPull: editMinPull.trim() ? parseFloat(editMinPull) : null,
      maxPull: editMaxPull.trim() ? parseFloat(editMaxPull) : null,
      openingWidth: editOpeningWidth.trim() ? parseFloat(editOpeningWidth) : null,
      shelfRadius: editShelfRadius.trim() ? parseFloat(editShelfRadius) : null,
      shelfCount: editShelfCount !== "__none__" ? parseInt(editShelfCount) : null,
      cabinetSquare: editCabinetSquare.trim() ? parseFloat(editCabinetSquare) : null,
      faceWidth: editFaceWidth.trim() ? parseFloat(editFaceWidth) : null,
      legWidth: editLegWidth.trim() ? parseFloat(editLegWidth) : null,
      layoutSpec: editLayoutSpec || null,
      specImageUrl: editSpecImageUrl.trim() || null,
      specNotes: editSpecNotes.trim() || null,
      facePattern: (editFacePattern === "__none__" ? null : editFacePattern) as "slats" | "criss-cross" | "lattice" | "open" | null,
      graphicType: editGraphicType === "standard" ? null : editGraphicType,
    };
  }

  function submitForSelectedDistributors() {
    if (!cabinet?.id) return;
    if (saveScopeDistributorIds.length === 0) {
      toast.error("Tick at least one distributor.");
      return;
    }
    // Housekeeping flags (visibility, active, image, code) have no per-distributor
    // form; they remain on the master row and are not cabinet rules.
    updateCabinet.mutate(
      {
        id: cabinet.id,
        catalogImageUrl: editImageUrl.trim() || null,
        showInCatalog: editShowInCatalog,
        showInDesigner: editShowInDesigner,
        showIn2020: editShowIn2020,
        isActive: editIsActive,
        isNotCabinet: editIsNotCabinet,
        configVerified: editConfigVerified,
        masterCode: editMasterCode.trim() || undefined,
      },
      { onSuccess: () => undefined },
    );
    setDistributorConfig.mutate({
      cabinetId: cabinet.id,
      distributorIds: saveScopeDistributorIds,
      config: buildDistributorConfigRule(),
    });
  }

  // Add a specific style row to the cart (used directly and after an auto-switch).
  const addRow = (row: StyleRow) => {
    const saleTier: PricingTier = isAffiliateStorefront ? "homeowner" : tier;
    const unitPrice = priceNumberForTier(row, saleTier);
    const res = addItem({
      masterCode: resolvedMasterCode,
      name: publicProductCopy.title,
      styleId: row.styleId,
      styleLabel: styleDisplayName({ ourName: row.name, styleCode: row.styleCode }),
      distributorId: row.distributorId ?? null,
      tier: saleTier,
      unitPrice: unitPrice != null && !isNaN(unitPrice) ? unitPrice : null,
      qty,
      catalogImageUrl: cabinet?.catalogImageUrl ?? null,
      glassIncluded: row.glassIncluded ?? null,
    });
    if (res.ok) {
      toast.success(`Added ${qty}× ${resolvedMasterCode} to cart`, {
        description: `${styleDisplayName({ ourName: row.name, styleCode: row.styleCode })} · ${isAffiliateStorefront ? "affiliate sale" : tierLabel(saleTier)} pricing`,
      });
    }
    return res;
  };

  const handleAddToCart = () => {
    if (!selectedRow) return;
    const res = addRow(selectedRow);
    if (res.ok) return;

    // Distributor-locked: the cart already holds items from a DIFFERENT supply
    // line. Colors/styles mix freely WITHIN a distributor, but cross-distributor
    // mixing breaks pricing/freight, so we cannot combine them. Recover
    // gracefully:
    //   1) If this cabinet is also offered by the locked distributor, offer to
    //      switch the selection to a row from that distributor and add it.
    //   2) Otherwise offer to clear the cart and start fresh with this item.
    const sameDistRow =
      styleRows.find((s) => (s.distributorId ?? null) === res.lockedDistributorId) ?? null;
    if (sameDistRow) {
      toast.warning(`Your cart is from another supplier`, {
        description: `Orders ship from one supplier. Add this cabinet in ${sameDistRow.name} (same supplier) instead?`,
        action: {
          label: `Add in ${sameDistRow.name}`,
          onClick: () => {
            setSelectedStyleId(sameDistRow.styleId);
            addRow(sameDistRow);
          },
        },
      });
    } else {
      toast.warning(`Your cart is from another supplier`, {
        description: `${resolvedMasterCode} (${selectedRow.name}) is from a different supplier than what's in your cart. Clear the cart to start a new order with it?`,
        action: {
          label: "Clear cart & add",
          onClick: () => {
            clear();
            // Cart is async-cleared via state; add on next tick.
            setTimeout(() => addRow(selectedRow), 0);
          },
        },
      });
    }
  };

  if (cabinetLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-4 w-32 mb-6" />
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-64 rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!cabinet) {
    return (
      <div className="container py-16 text-center">
        <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
        <h2 className="font-serif text-2xl font-bold mb-2">Cabinet Not Found</h2>
        <p className="text-muted-foreground mb-4">No cabinet with code "{masterCode}" exists.</p>
        <Link href={affiliateCatalogRootHref()}>
          <Button variant="outline">Back to Catalog</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Breadcrumb + floating style pill on the same row */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={affiliateCatalogRootHref()} className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="h-3.5 w-3.5" />
            Catalog
          </Link>
          {showCabinetAttentionReturn && (
            <>
              <span>/</span>
              <Link href={CABINET_ATTENTION_RETURN_URL} className="font-medium text-primary hover:underline">
                Back to Cabinet Attention
              </Link>
            </>
          )}
          {showDesignerCoverageReturn && (
            <>
              <span>/</span>
              <Link href={DESIGNER_COVERAGE_RETURN_URL} className="font-medium text-primary hover:underline">
                Back to Designer Coverage
              </Link>
            </>
          )}
          {cabinet.category && (
            <>
              <span>/</span>
              <Link href={affiliateCatalogRootHref()} className="hover:text-foreground">
                {cabinet.category}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground font-medium">{resolvedMasterCode}</span>
        </nav>
        {/* Floating style selector pill — shows the active door style with a
            thumbnail swatch. Tapping it scrolls to the style picker in the
            pricing section so the user can switch styles without scrolling. */}
        {styleRows.length > 0 && (
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm hover:border-primary/50 hover:bg-muted/40 transition-colors group shrink-0"
            title="Change door style"
          >
            <div className="h-7 w-7 rounded-full overflow-hidden border border-border shrink-0">
              {selectedRow ? (
                <DoorStyleSwatch style={selectedRow} className="h-full w-full" />
              ) : (
                <div className="h-full w-full bg-muted" />
              )}
            </div>
            <span className="text-xs font-semibold text-foreground">
              {selectedRow?.name ?? (pricingLoading ? "Loading…" : "Select style")}
            </span>
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground rotate-180 group-hover:text-primary transition-colors" />
          </a>
        )}
      </div>

      {/* ── Category pills + search within door style ────────────────────────── */}
      {activeStyle != null && (
          <StyleCategoryNav
            styleId={activeStyle}
            currentCategory={cabinet.category}
            currentMasterCode={resolvedMasterCode}
        />
      )}

      {/* ── Door style compact strip (replaces old room-scene hero) ────────────── */}
      {(() => {
        const doorPhoto = doorFamilyPhoto(selectedRow ?? {});
        const styleLabel = selectedRow ? styleDisplayName({ ourName: selectedRow.name, styleCode: selectedRow.styleCode }) : "your finish";
        return doorPhoto ? (
          <a
            href="#pricing"
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 mb-4 hover:border-primary/50 hover:bg-muted/40 transition-colors group"
            title="View pricing & specs"
          >
            <div className="h-14 w-12 rounded-lg overflow-hidden shrink-0 border border-border shadow-sm">
              <img src={doorPhoto} alt={`${styleLabel} door`} className="h-full w-full object-cover" />
            </div>
            <div className="h-14 w-5 rounded shrink-0 border border-border/60" style={{ backgroundColor: finishFace }} title={swColorName ?? styleLabel} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-foreground truncate">{styleLabel}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {selectedRow?.doorStyle ? `${selectedRow.doorStyle} profile` : "Door style"}
                {swColorName ? ` · ${swColorName}` : " · true color"}
              </div>
              <div className="text-xs text-primary/80 mt-1 group-hover:text-primary transition-colors">
                Tap to view specs & pricing →
              </div>
            </div>
          </a>
        ) : null;
      })()}

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Left: Image + specs */}
        <div>
          {/* Supplier-scoped neutral construction render; finish is represented
              separately by the selected door sample. The geometry-driven front
              drawing remains the fallback when no product image is supplied. */}
          <div className="mb-2">
            <div className={`rounded-xl border border-border bg-gradient-to-b from-white to-muted/30 flex items-center justify-center overflow-hidden p-4 ${selectedRow?.isFrameless ? "h-80 sm:h-96 lg:h-[440px]" : "h-64"}`}>
              <CabinetImage
                cabinet={cabinet}
                finishColor={finishFace}
                className="h-full w-auto max-w-full"
                overrideImageUrl={selectedRow?.distributorImageUrl ?? null}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
              {(selectedRow?.distributorImageUrl || cabinet.catalogImageUrl)
                ? selectedRow?.isFrameless
                  ? "Cabinet construction render — choose your finish from the door samples"
                  : "Catalog illustration — confirm dimensions and configuration in the specifications"
                : `Drawn to scale${selectedRow ? ` in ${selectedRow.name}` : ""} — front elevation`}
            </p>
            {/* Admin: scoped image replace button */}
            {isOwner && (
              <div className="flex justify-center mt-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-6 px-2 gap-1"
                  onClick={() => setScopedImageOpen(true)}
                >
                  <Upload className="h-3 w-3" />
                  Replace image
                </Button>
              </div>
            )}
          </div>

          {/* Scoped image upload dialog */}
          {isOwner && (
            <Dialog open={scopedImageOpen} onOpenChange={setScopedImageOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Replace Cabinet Image</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    Choose where to apply the new image:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setScopedImageScope("line")}
                      className={`rounded-lg border-2 p-3 text-left transition-colors ${
                        scopedImageScope === "line"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="font-semibold text-sm mb-0.5">This line only</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedRow ? `${selectedRow.name} (${selectedRow.distributorId ? "this distributor" : "no distributor"})` : "Current distributor line"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopedImageScope("global")}
                      className={`rounded-lg border-2 p-3 text-left transition-colors ${
                        scopedImageScope === "global"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="font-semibold text-sm mb-0.5">All lines</div>
                      <div className="text-xs text-muted-foreground">Replaces the master image across every distributor</div>
                    </button>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Choose image</Label>
                    <MediaPicker
                      value={scopedImagePickerUrl}
                      onChange={handleScopedImageUrl}
                      placeholder="/manus-storage/... or https://..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setScopedImageOpen(false)} disabled={scopedImageUploading}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {/* Door style swatch (compact, below drawing) */}
          {selectedRow && (
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded border border-border shrink-0 overflow-hidden">
                <DoorStyleSwatch style={selectedRow} className="h-full w-auto" />
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selectedRow.name}</span>
                {selectedRow.doorStyle ? ` · ${selectedRow.doorStyle}` : ""}
                {swColorName ? ` · ${swColorName}` : " · true color"}
              </div>
            </div>
          )}

          {/* ── Room Scene + Add to Designer CTA ────────────── */}
          {selectedRow && cabinet && !cabinet.isNotCabinet && (
            <div className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 p-5 mb-6">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                See This Cabinet in Your Style
              </h3>
              {selectedRow.roomSceneImageUrl ? (
                <div className="space-y-3">
                  <div className="rounded-lg overflow-hidden border border-border bg-white">
                    <img
                      src={selectedRow.roomSceneImageUrl}
                      alt={`Kitchen with ${selectedRow.name} cabinets`}
                      className="w-full h-auto object-cover max-h-80"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    {selectedRow.name} — room scene
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mb-3">
                  See a photorealistic 3D render of this cabinet in <span className="font-medium text-foreground">{selectedRow.name}</span> —
                  exactly how it will look in your kitchen.
                </p>
              )}
              <div className={selectedRow.roomSceneImageUrl ? "mt-3" : ""}>
                <Link
                  href={affiliateDesignerHref(selectedRow.styleId)}
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground font-semibold text-sm py-3 px-4 transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  <ArrowRight className="h-4 w-4" />
                  Put This in the Designer
                </Link>
                <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                  Open the kitchen designer with this style pre-loaded
                </p>
              </div>
            </div>
          )}

          {/* Blind corner details */}
          {isBlindCornerCode(cabinet.masterCode, cabinet.description) && (cabinet.openingWidth || cabinet.minPull || cabinet.maxPull) && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-5 mb-6">
              <h3 className="font-semibold text-sm text-foreground mb-1 flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-600" />
                Blind Corner Details
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                A blind corner cabinet hides part of its run behind the adjacent cabinets. Pull it away from the
                corner within the range below so the neighboring run&apos;s doors and drawers clear, then add a corner filler.
              </p>
              <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
                {[
                  { label: "Opening Width", value: cabinet.openingWidth ? `${parseFloat(cabinet.openingWidth)}\"` : null },
                  { label: "Min Pull", value: cabinet.minPull ? `${parseFloat(cabinet.minPull)}\"` : null },
                  { label: "Max Pull", value: cabinet.maxPull ? `${parseFloat(cabinet.maxPull)}\"` : null },
                ]
                  .filter((item) => item.value)
                  .map((item) => (
                    <div key={item.label}>
                      <dt className="text-muted-foreground">{item.label}</dt>
                      <dd className="font-semibold text-foreground">{item.value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}

          {/* Specs */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              Specifications
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {(() => {
                const drawingType = cabinetDrawingType(cabinet as Parameters<typeof cabinetDrawingType>[0]);
                const isTrim = drawingType === "accessory-strip";
                const { doors, drawers } = resolveDoorDrawerCounts(cabinet);
                const rows: { label: string; value: string | null }[] = [
                  { label: "Type", value: cabinetTypeLabel(cabinet) },
                  { label: "Width", value: formatCatalogInches(cabinet.width) },
                  { label: "Height", value: formatCatalogInches(cabinet.height) },
                  { label: "Depth", value: formatCatalogInches(cabinet.depth) },
                ];
                if (!isTrim) {
                  if (doors) rows.push({ label: "Doors", value: String(doors) });
                  if (drawers) rows.push({ label: "Drawers", value: String(drawers) });
                  const fixedShelves = (cabinet as Record<string, unknown>).numberOfFixedShelves;
                  const adjShelves = (cabinet as Record<string, unknown>).numberOfAdjShelves;
                  if (fixedShelves != null && Number(fixedShelves) > 0)
                    rows.push({ label: "Fixed Shelves", value: String(fixedShelves) });
                  if (adjShelves != null && Number(adjShelves) > 0)
                    rows.push({ label: "Adj. Shelves", value: String(adjShelves) });
                  const weight = (cabinet as Record<string, unknown>).weight;
                  if (weight != null && weight !== '') rows.push({ label: "Weight", value: `${weight} lbs` });
                }
                return rows
                  .filter((item) => item.value)
                  .map((item) => (
                    <div key={item.label}>
                      <dt className="text-muted-foreground">{item.label}</dt>
                      <dd className="font-medium text-foreground">{item.value}</dd>
                    </div>
                  ));
              })()}
            </dl>
          </div>

          {/* Customer-facing technical drawing */}
          {(() => {
            const specImageUrl = (cabinet as Record<string, unknown>).specImageUrl as string | null;
            const specNotes = (cabinet as Record<string, unknown>).specNotes as string | null;
            const publicSpecNotes = publicTechnicalDrawingNote(specNotes);
            if (!specImageUrl && !publicSpecNotes) return null;
            return (
              <div className="rounded-xl border border-border p-5">
                <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="2" y1="9" x2="8" y2="9"/><line x1="2" y1="15" x2="8" y2="15"/></svg>
                  Technical Drawing
                </h3>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {specImageUrl && (
                    <div className="shrink-0 rounded-lg border border-border bg-white p-2 flex items-center justify-center" style={{ width: 140, height: 140 }}>
                      <img src={specImageUrl} alt="spec drawing" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  {publicSpecNotes && (
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">{publicSpecNotes}</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Door / Drawer Location Diagram — admin only */}
          {isOwner && !cabinet.isNotCabinet && (() => {
            const drawingType = cabinetDrawingType(cabinet as Parameters<typeof cabinetDrawingType>[0]);
            const isTrim = drawingType === "accessory-strip";
            if (isTrim) return null;
            return (
              <div className="rounded-xl border border-border p-5">
                <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="12" y1="9" x2="12" y2="21"/></svg>
                  Door &amp; Drawer Layout
                </h3>
                <div className="flex justify-center">
                  <DoorDrawerDiagram cabinet={aefProductDiagramCabinet(cabinet, selectedRow?.distributorImageUrl)} width={200} />
                </div>
              </div>
            );
          })()}
          {/* Shipping info is internal/freight-only — not shown to members */}
        </div>

        {/* Right: Pricing selector */}
        <div id="pricing">
          <div className="mb-1">
            <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
              {resolvedMasterCode}
            </span>
            <Badge variant="secondary" className="ml-2 text-xs">{cabinetTypeLabel(cabinet)}</Badge>
            <GlassPolicyBadge masterCode={resolvedMasterCode} glassIncluded={selectedRow?.glassIncluded ?? null} className="ml-2 align-middle" />
            {isOwner && cabinet.isActive === false && (
              <Badge variant="destructive" className="ml-2 text-xs">Inactive</Badge>
            )}
          </div>
          <div className="flex items-start justify-between gap-2 mt-2 mb-1">
            <div className="min-w-0">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">
                {seoName}
              </h1>
              {isOwner && hasDistributorRule && selectedRow && (
                <Badge variant="outline" className="mt-1 text-[10px]" data-testid="cabinet-detail-distributor-rule">
                  Exact frameless specifications applied
                </Badge>
              )}
            </div>
            {isOwner && (
              <button
                onClick={() => setEditOpen(true)}
                title="Edit cabinet (admin)"
                className="shrink-0 mt-1 p-1.5 rounded-lg border border-amber-400/60 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-500/40 dark:hover:bg-amber-900/40"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Door style selector — hidden for non-cabinet items (trim, accessories, corbels) */}
          {!cabinet?.isNotCabinet && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Select Door Style</span>
            </div>
            {pricingLoading ? (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-28 rounded-lg" />)}
              </div>
            ) : styleRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No door styles available for this item yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
                {styleRows.map((s) => (
                  <button
                    key={s.styleId}
                    onClick={() => setSelectedStyleId(s.styleId)}
                    title={`${s.name}${s.doorStyle ? ` · ${s.doorStyle}` : ""}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
                      activeStyle === s.styleId
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground/70 hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <DoorStyleSwatch style={s} className="h-4 w-4 rounded shrink-0" />
                    {s.name}
                    {activeStyle === s.styleId && <Check className="h-3 w-3 ml-0.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Pricing tier tabs + price display */}
          {selectedRow && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  {isPro ? "Your Pricing" : "Price"}
                </span>
              </div>

              {canSeePricing ? (
                isPro && !isAffiliateStorefront ? (
                  <Tabs value={tier} onValueChange={(v) => setTier(v as PricingTier)}>
                    <TabsList className="w-full">
                      {visibleTiers.map((t) => (
                        <TabsTrigger key={t} value={t} className="flex-1 text-xs">
                          {tierLabel(t)}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {visibleTiers.map((t) => (
                      <TabsContent key={t} value={t} className="mt-3">
                        <PriceCard row={selectedRow} tier={t} viewerRole={viewerRole} promo={activePromo} affiliateStorefront={isAffiliateStorefront} />
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  <PriceCard row={selectedRow} tier="homeowner" viewerRole={viewerRole} promo={activePromo} affiliateStorefront={isAffiliateStorefront} />
                )
              ) : (
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-2">
                  {pricingVisibility === "hidden" ? (
                    <>
                      <p className="font-medium text-foreground">Request a Quote</p>
                      <p>Pricing is available upon request. Contact us for a custom quote on this item.</p>
                    </>
                  ) : pricingVisibility === "logged_in" ? (
                    <>
                      <p className="font-medium text-foreground">Sign in to view pricing</p>
                      <p>Create a free account or sign in to see pricing for this product.</p>
                    </>
                  ) : pricingVisibility === "dealer" ? (
                    <>
                      <p className="font-medium text-foreground">Trade pricing available</p>
                      <p>Pricing is available to approved dealers and trade professionals. Contact us to request trade access.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-foreground">Contact us for pricing</p>
                      <p>Please reach out to get pricing information for this product.</p>
                    </>
                  )}
                </div>
              )}

              {/* Qty + Add to Cart */}
              <div className="mt-4 flex items-center gap-3">
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 text-sm font-medium border-x border-border min-w-[3rem] text-center">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty(qty + 1)}
                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    +
                  </button>
                </div>

                <Button
                  className="flex-1 gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </Button>
              </div>

              {/* Supplier-lock hint: colors & door styles mix freely within one
                  supplier (two-tone is welcome). We only warn when the selected
                  row is from a DIFFERENT supplier than the cart. */}
              {lockedDistributorId != null &&
                selectedRow &&
                (selectedRow.distributorId ?? null) !== lockedDistributorId && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <Lock className="h-3 w-3 shrink-0" />
                    Your cart is from another supplier. Adding this will offer to switch to
                    the same supplier or start a new cart. (You can freely mix colors within
                    one supplier.)
                  </p>
                )}
            </div>
          )}

          {/* No pricing available */}
          {!pricingLoading && styleRows.length === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No pricing available for this item.</p>
            </div>
          )}
        </div>
      </div>

      {/* Admin inline edit dialog — only rendered for admins */}
      {isOwner && (
        <>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg flex flex-col max-h-[90dvh]">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-amber-600" />
                Edit Cabinet
                <span className="font-mono text-xs font-normal text-muted-foreground ml-1">{resolvedMasterCode}</span>
              </DialogTitle>
              {showCabinetAttentionReturn && (
                <Button asChild size="sm" variant="outline" className="mt-3 w-fit gap-1.5">
                  <Link href={CABINET_ATTENTION_RETURN_URL}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back to Cabinet Attention
                  </Link>
                </Button>
              )}
            </DialogHeader>

            <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  placeholder="e.g. Base Cabinet 12W x 34.5H x 24D"
                />
              </div>

              {/* Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-cat">Category</Label>
                  <Select
                    value={editCategory || "__none__"}
                    onValueChange={(v) => {
                      const cat = v === "__none__" ? "" : v;
                      setEditCategory(cat);
                      setEditSubCategory(""); // reset sub-category when category changes
                    }}
                  >
                    <SelectTrigger id="edit-cat" className="w-full">
                      <SelectValue placeholder="— not set —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— not set —</SelectItem>
                      {categoryNames.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sub-category */}
                <div className="space-y-1.5">
                  <Label htmlFor="edit-sub">
                    Sub-Category{" "}
                    <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </Label>
                  <Select
                    value={editSubCategory || "__none__"}
                    onValueChange={(v) => setEditSubCategory(v === "__none__" ? "" : v)}
                    disabled={!editCategory}
                  >
                    <SelectTrigger id="edit-sub" className="w-full">
                      <SelectValue placeholder="— not set —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— not set —</SelectItem>
                      {(editCategory && subCategoriesMap[editCategory] ? subCategoriesMap[editCategory] : []).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Designer Drawing Rule — intentionally placed beside Category so
                  administrators can configure a non-standard cabinet without
                  scrolling through unrelated shipping and pricing fields. */}
              <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3">
                <div className="flex items-start gap-2">
                  <Layers className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <Label className="text-sm font-semibold">Designer Drawing Rule</Label>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Choose the cabinet drawing profile used in the 3D Designer and elevation views. Use <strong>Base end angle cabinet</strong> for BEC/end cabinets; do not use a corner rule.
                    </p>
                  </div>
                </div>
                <select
                  value={editGraphicType}
                  onChange={(e) => setEditGraphicType(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CUSTOM_CABINET_PROFILES.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.label}</option>
                  ))}
                </select>
                {editGraphicType !== "standard" && (
                  <div className="space-y-1.5 border-t border-primary/15 pt-3">
                    <Label className="text-xs">Generic Drawing / Reference Image</Label>
                    <MediaPicker
                      value={editSpecImageUrl}
                      onChange={(url) => setEditSpecImageUrl(url)}
                      placeholder="Upload or select the cabinet drawing image"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      The designer uses this image first. When no image is saved, it uses the selected rule's vector fallback.
                    </p>
                  </div>
                )}
                <div className="space-y-1.5 border-t border-primary/15 pt-3">
                  <Label className="text-xs">Corner Type</Label>
                  <Select value={editCornerType} onValueChange={setEditCornerType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Standard or end cabinet (not a corner)</SelectItem>
                      <SelectItem value="lazy-susan">Lazy Susan (LS)</SelectItem>
                      <SelectItem value="blind-corner">Rectangular Blind Corner (BBC / WBC)</SelectItem>
                      <SelectItem value="diagonal">Diagonal Corner (DC / WDC)</SelectItem>
                      <SelectItem value="pie-cut">Pie-Cut Lazy Susan</SelectItem>
                      <SelectItem value="l-shape">L-Shape Corner</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    End cabinets such as BEC must remain on “Standard or end cabinet”; this setting drives true-corner plan and elevation rules.
                  </p>
                </div>
              </div>

              {/* Active / Inactive toggle */}
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Inactive cabinets are hidden from the public catalog and designer</p>
                  </div>
                  <Switch
                    checked={editIsActive}
                    onCheckedChange={setEditIsActive}
                    aria-label="Active status"
                  />
                </div>
                {!editIsActive && (
                  <p className="mt-2 text-xs text-destructive font-medium">⚠ This cabinet will be hidden from all public views</p>
                )}
              </div>

              {/* Visibility toggles */}
              <div className="space-y-2">
                <Label>Visibility</Label>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {/* Public Catalog */}
                  <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="text-sm font-medium">Public Catalog</p>
                      <p className="text-xs text-muted-foreground">Visible on the storefront catalog &amp; search</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editShowInCatalog}
                      onChange={(e) => setEditShowInCatalog(e.target.checked)}
                      className="h-4 w-4 rounded accent-amber-600"
                    />
                  </label>
                  {/* Kitchen Designer */}
                  <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="text-sm font-medium">Kitchen Designer</p>
                      <p className="text-xs text-muted-foreground">Appears in the drag-and-drop design tool palette</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editShowInDesigner}
                      onChange={(e) => setEditShowInDesigner(e.target.checked)}
                      className="h-4 w-4 rounded accent-amber-600"
                    />
                  </label>
                  {/* 2020 Export */}
                  <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="text-sm font-medium">2020 Export</p>
                      <p className="text-xs text-muted-foreground">Included when exporting catalog for 2020 Design software</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editShowIn2020}
                      onChange={(e) => setEditShowIn2020(e.target.checked)}
                      className="h-4 w-4 rounded accent-amber-600"
                    />
                  </label>
                </div>
              </div>

              {/* Dimensions & Weight */}
              <div className="space-y-2">
                <Label>Dimensions &amp; Weight</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-width" className="text-xs text-muted-foreground">Width (in)</Label>
                    <Input
                      id="edit-width"
                      value={editWidth}
                      onChange={(e) => setEditWidth(e.target.value)}
                      placeholder="e.g. 12"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-height" className="text-xs text-muted-foreground">Height (in)</Label>
                    <Input
                      id="edit-height"
                      value={editHeight}
                      onChange={(e) => setEditHeight(e.target.value)}
                      placeholder="e.g. 34.5"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-depth" className="text-xs text-muted-foreground">Depth (in)</Label>
                    <Select value={editDepth} onValueChange={setEditDepth}>
                      <SelectTrigger id="edit-depth" className="h-8 text-sm"><SelectValue placeholder="Select depth" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__custom__">— custom —</SelectItem>
                        {["9","12","15","18","21","24","27","30","33","36"].map(d => (
                          <SelectItem key={d} value={d}>{d}"</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editDepth && !["9","12","15","18","21","24","27","30","33","36","","__custom__"].includes(editDepth) && (
                      <p className="text-[10px] text-amber-600">Custom: {editDepth}" — not a standard depth</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-physical-width" className="text-xs text-muted-foreground">Physical Width (in)</Label>
                    <Input
                      id="edit-physical-width"
                      value={editPhysicalWidth}
                      onChange={(e) => setEditPhysicalWidth(e.target.value)}
                      placeholder="e.g. 11.5"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-weight" className="text-xs text-muted-foreground">Weight (lbs)</Label>
                    <Input
                      id="edit-weight"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      placeholder="e.g. 45.5"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Enter numeric values in inches / pounds. Leave blank to keep current value.</p>
              </div>

              {/* Package Dimensions */}
              <div className="space-y-2">
                <Label>Package Dimensions</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-pkg-length" className="text-xs text-muted-foreground">Pkg Length (in)</Label>
                    <Input
                      id="edit-pkg-length"
                      value={editPkgLength}
                      onChange={(e) => setEditPkgLength(e.target.value)}
                      placeholder="e.g. 30"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-pkg-width" className="text-xs text-muted-foreground">Pkg Width (in)</Label>
                    <Input
                      id="edit-pkg-width"
                      value={editPkgWidth}
                      onChange={(e) => setEditPkgWidth(e.target.value)}
                      placeholder="e.g. 15"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-pkg-height" className="text-xs text-muted-foreground">Pkg Height (in)</Label>
                    <Input
                      id="edit-pkg-height"
                      value={editPkgHeight}
                      onChange={(e) => setEditPkgHeight(e.target.value)}
                      placeholder="e.g. 20"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-pkg-weight" className="text-xs text-muted-foreground">Pkg Weight (lbs)</Label>
                    <Input
                      id="edit-pkg-weight"
                      value={editPkgWeight}
                      onChange={(e) => setEditPkgWeight(e.target.value)}
                      placeholder="e.g. 50"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Shipping box dimensions. Leave blank to keep current value.</p>
              </div>

              {/* Not a Cabinet toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Not a Cabinet</p>
                  <p className="text-xs text-muted-foreground">Trim, panel, moulding, or accessory</p>
                </div>
                <Switch
                  checked={editIsNotCabinet}
                  onCheckedChange={setEditIsNotCabinet}
                />
              </div>

              {/* Doors / Drawers / Shelves */}
              <div className="space-y-2">
                <Label>Interior Configuration</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Doors</Label>
                    <Select value={editNumDoors} onValueChange={setEditNumDoors}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Drawers</Label>
                    <Select value={editNumDrawers} onValueChange={setEditNumDrawers}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[0,1,2,3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Fixed Shelves</Label>
                    <Select value={editNumFixedShelves} onValueChange={setEditNumFixedShelves}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[0,1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Adjustable Shelves</Label>
                    <Select value={editNumAdjShelves} onValueChange={setEditNumAdjShelves}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[0,1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Interior configuration for this cabinet. Used in specs and future catalog illustrations.</p>
              </div>

              {/* Door Orientation */}
              {parseInt(editNumDoors) >= 2 && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Door Orientation</Label>
                  <Select value={editDoorOrientation} onValueChange={setEditDoorOrientation}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— default (side by side) —</SelectItem>
                      <SelectItem value="side-by-side">Side by Side (left/right)</SelectItem>
                      <SelectItem value="stacked">Stacked (top/bottom)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">For pantries or tall cabinets with 2+ doors arranged vertically, choose "Stacked".</p>
                </div>
              )}

              {/* Appliance Opening Position */}
              <div className="space-y-1.5">
                <Label className="text-sm">Appliance Opening</Label>
                <Select value={editOpeningType} onValueChange={setEditOpeningType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— none —</SelectItem>
                    <SelectItem value="top">Top (doors above opening)</SelectItem>
                    <SelectItem value="middle">Middle (doors above, drawers below)</SelectItem>
                    <SelectItem value="bottom">Bottom (opening above drawers)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Set for oven, microwave, or appliance cabinets that have a cutout opening.</p>
              </div>

              {/* Door Height (shown when opening type is set) */}
              {editOpeningType !== "__none__" && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Door Height (inches)</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="e.g. 18.5"
                    value={editDoorHeight}
                    onChange={(e) => setEditDoorHeight(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Height of the door panels. The opening size is calculated from total height minus door/drawer heights.</p>
                </div>
              )}

              {/* Drawer Height (shown when drawers > 0) */}
              {parseInt(editNumDrawers) > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Drawer Height (inches)</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="e.g. 6"
                    value={editDrawerHeight}
                    onChange={(e) => setEditDrawerHeight(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Height of each drawer front in inches.</p>
                </div>
              )}

              {/* Drawer Layout — side-by-side quick-set (shown when drawers > 0) */}
              {parseInt(editNumDrawers) > 0 && (
                <DrawerLayoutEditor
                  value={editDrawerLayout}
                  onChange={setEditDrawerLayout}
                  totalDrawers={parseInt(editNumDrawers) || 1}
                />
              )}

              {/* Doors Per Row (shown when 2+ doors and not stacked) */}
              {parseInt(editNumDoors) >= 2 && editDoorOrientation !== "stacked" && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Doors Per Row (Side-by-Side)</Label>
                  <Select value={editDoorsPerRow} onValueChange={setEditDoorsPerRow}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto__">Auto (all doors in one row)</SelectItem>
                      {[1, 2, 3, 4].filter((n) => n <= parseInt(editNumDoors)).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} door{n > 1 ? "s" : ""} per row</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">How many doors appear side-by-side per row in the layout diagram.</p>
                </div>
              )}

              {/* Config Verified */}
              <CabinetVerificationControl
                checked={editConfigVerified}
                onCheckedChange={setEditConfigVerified}
              />

              {/* Catalog image */}
              <div className="space-y-1.5">
                <Label>Catalog Image</Label>
                <MediaPicker
                  value={editImageUrl}
                  onChange={(url) => setEditImageUrl(url)}
                  placeholder="/manus-storage/... or https://..."
                />
              </div>

              {/* Grain Direction + Decorative Door (panel fields) */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Grain Direction (panels only)</Label>
                  <select
                    value={editGrainDirection}
                    onChange={(e) => setEditGrainDirection(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">None / Not a panel</option>
                    <option value="vertical">Vertical (up/down)</option>
                    <option value="horizontal">Horizontal (left/right)</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">Set grain direction for skin/end/plywood panels. Leave blank for cabinets.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-isDecorativeDoor"
                    checked={editIsDecorativeDoor}
                    onChange={(e) => setEditIsDecorativeDoor(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="edit-isDecorativeDoor" className="text-sm">Decorative Door Panel</Label>
                </div>
                <p className="text-[11px] text-muted-foreground">Check if this panel uses the door style image (decorative end panels, island backs).</p>
              </div>

              {/* Master Code (rename with alias preservation) */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Master Code (SKU)</Label>
                <Input
                  value={editMasterCode}
                  onChange={(e) => setEditMasterCode(e.target.value.toUpperCase())}
                  placeholder="e.g. B24, W3015"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Rename only when this code does not already belong to another cabinet. If this item is a legacy duplicate, leave its code unchanged and add it as a Master Alias on the canonical cabinet instead.
                </p>
              </div>

              {/* Face Pattern (specialty open-front cabinets) */}
              <div className="space-y-1.5">
                <Label className="text-sm">Face Pattern (specialty open-front)</Label>
                <select
                  value={editFacePattern}
                  onChange={(e) => setEditFacePattern(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="__none__">None (standard door/drawer)</option>
                  <option value="slats">Vertical Slats (plate rack / wine rack)</option>
                  <option value="criss-cross">Criss-Cross / X (wine cubby)</option>
                  <option value="lattice">Lattice / Diamond (decorative)</option>
                  <option value="open">Open (no face treatment)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">Replaces door/drawer panels with a specialty open-front pattern in the elevation view. Auto-detected for WR, WPR, PR code prefixes.</p>
              </div>

              {/* Blind Corner Pull Spec (auto-shown for BBC/WBC codes) */}
              {(isBlindCornerCode(cabinet?.masterCode ?? null, cabinet?.description)) && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-50/10 dark:bg-amber-900/10 px-4 py-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Blind Corner Pull Spec</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The pull range controls how far this cabinet slides out from the corner. The designer enforces these limits when placing the cabinet.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Min Pull"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 3" value={editMinPull} onChange={(e) => setEditMinPull(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Max Pull"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 6" value={editMaxPull} onChange={(e) => setEditMaxPull(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Opening Width"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 9" value={editOpeningWidth} onChange={(e) => setEditOpeningWidth(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  {(!editMinPull || !editMaxPull) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Min and Max Pull are required — the designer defaults to 3–6" until set.
                    </p>
                  )}
                </div>
              )}

              {/* Corner Cabinet Measurements (conditional on cornerType) */}
              {editCornerType === "lazy-susan" && (
                <div className="rounded-lg border border-blue-500/40 bg-blue-50/10 dark:bg-blue-900/10 px-4 py-3 space-y-3">
                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Lazy Susan Measurements</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Cabinet Square"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 36" value={editCabinetSquare} onChange={(e) => setEditCabinetSquare(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Shelf Radius"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 14" value={editShelfRadius} onChange={(e) => setEditShelfRadius(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Shelf Count</Label>
                      <Select value={editShelfCount} onValueChange={setEditShelfCount}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— not set —</SelectItem>
                          {[1,2,3,4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {editCornerType === "diagonal" && (
                <div className="rounded-lg border border-purple-500/40 bg-purple-50/10 dark:bg-purple-900/10 px-4 py-3 space-y-3">
                  <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">Diagonal Corner Measurements</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Cabinet Square"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 36" value={editCabinetSquare} onChange={(e) => setEditCabinetSquare(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Face Width"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 24" value={editFaceWidth} onChange={(e) => setEditFaceWidth(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Leg Width"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 12" value={editLegWidth} onChange={(e) => setEditLegWidth(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {editCornerType === "pie-cut" && (
                <div className="rounded-lg border border-green-500/40 bg-green-50/10 dark:bg-green-900/10 px-4 py-3 space-y-3">
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">Pie-Cut Lazy Susan Measurements</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Cabinet Square"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 36" value={editCabinetSquare} onChange={(e) => setEditCabinetSquare(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Shelf Radius"</Label>
                      <Input type="number" step="0.25" min="0" placeholder="e.g. 14" value={editShelfRadius} onChange={(e) => setEditShelfRadius(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Shelf Count</Label>
                      <Select value={editShelfCount} onValueChange={setEditShelfCount}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— not set —</SelectItem>
                          {[1,2,3,4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Visual Layout Spec Builder */}
              <LayoutSpecBuilder
                value={editLayoutSpec}
                onChange={setEditLayoutSpec}
                cabinet={{
                  category: editCategory || cabinet?.category,
                  numberOfDoors: parseInt(editNumDoors) || 0,
                  numberOfDrawers: parseInt(editNumDrawers) || 0,
                  height: editHeight || cabinet?.height,
                  drawerHeight: editDrawerHeight || cabinet?.drawerHeight,
                  doorHeight: editDoorHeight || cabinet?.doorHeight,
                }}
              />

              {/* Spec Book Drawing */}
              <div className="space-y-1.5">
                <Label className="text-sm">Spec Book Drawing</Label>
                <MediaPicker
                  value={editSpecImageUrl}
                  onChange={(url) => setEditSpecImageUrl(url)}
                  placeholder="/manus-storage/spec_drawing.png"
                />
              </div>

              {/* Spec Notes */}
              <div className="space-y-1.5">
                <Label className="text-sm">Spec Notes</Label>
                <Textarea
                  className="text-xs min-h-[80px] resize-y"
                  placeholder="Spec notes from the Capital spec book (dimensions, construction details, etc.)"
                  value={editSpecNotes}
                  onChange={(e) => setEditSpecNotes(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Shown on the public cabinet detail page. Edit to customize for this cabinet.</p>
              </div>
            {/* ── Distributor-specific dimension overrides (admin only) ── */}
            {isOwner && cabinet?.id && (
              <div className="space-y-3 border-t border-dashed border-amber-500/40 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-amber-700 dark:text-amber-400">Distributor Dimension Overrides</Label>
                  <span className="text-[11px] text-muted-foreground">Per-supplier corrections (override master dims)</span>
                </div>
                {(distCoverage ?? []).length === 0 || isDesignerCoverageGapEdit ? (
                  <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4" />
                        {isDesignerCoverageGapEdit ? "Selected style SKU required" : "Distributor connection required"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isDesignerCoverageGapEdit
                          ? "Confirm the supplier’s actual SKU for the selected line and style. This creates a pending connection; it does not invent pricing or publish the cabinet."
                          : "Select the supplier line, its door style, and the supplier’s actual SKU. This creates a pending connection; it does not invent pricing or publish the cabinet."}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select
                        value={connectionDistributorId}
                        onValueChange={(value) => {
                          setConnectionDistributorId(value);
                          setConnectionStyleId("");
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Distributor line" /></SelectTrigger>
                        <SelectContent>
                          {(distributorLines ?? []).map((line) => (
                            <SelectItem key={line.id} value={String(line.id)}>{line.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={connectionStyleId} onValueChange={setConnectionStyleId} disabled={!connectionDistributorId}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Door style" /></SelectTrigger>
                        <SelectContent>
                          {(allDoorStyles ?? [])
                            .filter((style) => style.distributorId === Number(connectionDistributorId))
                            .map((style) => (
                              <SelectItem key={style.id} value={String(style.id)}>
                                {style.ourName}{style.styleCode ? ` (${style.styleCode})` : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-9 text-xs"
                        placeholder="Supplier SKU (required)"
                        value={connectionSku}
                        onChange={(event) => setConnectionSku(event.target.value)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 bg-amber-600 text-xs text-white hover:bg-amber-700"
                        disabled={
                          connectDistributor.isPending ||
                          !connectionDistributorId ||
                          !connectionStyleId ||
                          !connectionSku.trim()
                        }
                        onClick={() => {
                          connectDistributor.mutate({
                            distributorId: Number(connectionDistributorId),
                            cabinetId: cabinet.id,
                            styleId: Number(connectionStyleId),
                            distributorSku: connectionSku.trim(),
                          });
                        }}
                      >
                        {connectDistributor.isPending ? "Saving…" : isDesignerCoverageGapEdit ? "Save style SKU for review" : "Connect distributor"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                    Connected distributor line{(distCoverage ?? []).length === 1 ? "" : "s"}: {(distCoverage ?? []).map((line) => line.name).join(", ")}
                  </div>
                )}
                {/* Existing overrides list */}
                {(existingOverrides ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    {(existingOverrides ?? []).map((ov) => (
                      <div key={ov.id} className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">{ov.distributorName || `Dist #${ov.distributorId}`}</span>
                          <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                            {ov.width && <span>W: {ov.width}&quot;</span>}
                            {ov.height && <span>H: {ov.height}&quot;</span>}
                            {ov.depth && <span>D: {ov.depth}&quot;</span>}
                            {ov.physicalWidth && <span>PhysW: {ov.physicalWidth}&quot;</span>}
                            {ov.weight && <span>Wt: {ov.weight} lbs</span>}
                            {ov.pkgLength && <span>PkgL: {ov.pkgLength}&quot;</span>}
                            {ov.pkgWidth && <span>PkgW: {ov.pkgWidth}&quot;</span>}
                            {ov.pkgHeight && <span>PkgH: {ov.pkgHeight}&quot;</span>}
                            {ov.pkgWeight && <span>PkgWt: {ov.pkgWeight} lbs</span>}
                            {ov.note && <span className="italic">{ov.note}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              setOverrideDistId(ov.distributorId);
                              setOverrideFields({
                                width: ov.width ?? "",
                                height: ov.height ?? "",
                                depth: ov.depth ?? "",
                                physicalWidth: ov.physicalWidth ?? "",
                                weight: ov.weight ?? "",
                                pkgLength: ov.pkgLength ?? "",
                                pkgWidth: ov.pkgWidth ?? "",
                                pkgHeight: ov.pkgHeight ?? "",
                                pkgWeight: ov.pkgWeight ?? "",
                                note: ov.note ?? "",
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            disabled={deleteOverride.isPending}
                            onClick={() => deleteOverride.mutate({ distributorId: ov.distributorId, cabinetId: cabinet.id })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add / edit override form */}
                {overrideDistId !== null ? (
                  <div id="distributor-override-editor" className="rounded-md border-2 border-amber-500/40 bg-amber-500/5 p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Editing dimensions for {(distCoverage ?? []).find((d) => d.distributorId === overrideDistId)?.name ?? `Dist #${overrideDistId}`}
                      </div>
                      <Badge variant="outline" className="border-amber-500/40 bg-background text-[10px] text-amber-800">Fields below</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(["width","height","depth","physicalWidth","weight","pkgLength","pkgWidth","pkgHeight","pkgWeight"] as const).map((field) => (
                        <div key={field} className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                          <Input
                            value={overrideFields[field] ?? ""}
                            onChange={(e) => setOverrideFields((prev) => ({ ...prev, [field]: e.target.value }))}
                            placeholder="leave blank = use master"
                            className="h-7 text-xs"
                          />
                        </div>
                      ))}
                      <div className="col-span-2 space-y-0.5">
                        <Label className="text-[10px] text-muted-foreground">Note</Label>
                        <Input
                          value={overrideFields.note ?? ""}
                          onChange={(e) => setOverrideFields((prev) => ({ ...prev, note: e.target.value }))}
                          placeholder="optional note"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setOverrideDistId(null); setOverrideFields({}); }}>Cancel</Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={upsertOverride.isPending}
                        onClick={() => {
                          if (!cabinet?.id) return;
                          const toVal = (v: string) => v.trim() || null;
                          upsertOverride.mutate({
                            distributorId: overrideDistId,
                            cabinetId: cabinet.id,
                            width: toVal(overrideFields.width ?? ""),
                            height: toVal(overrideFields.height ?? ""),
                            depth: toVal(overrideFields.depth ?? ""),
                            physicalWidth: toVal(overrideFields.physicalWidth ?? ""),
                            weight: toVal(overrideFields.weight ?? ""),
                            pkgLength: toVal(overrideFields.pkgLength ?? ""),
                            pkgWidth: toVal(overrideFields.pkgWidth ?? ""),
                            pkgHeight: toVal(overrideFields.pkgHeight ?? ""),
                            pkgWeight: toVal(overrideFields.pkgWeight ?? ""),
                            note: toVal(overrideFields.note ?? ""),
                          });
                        }}
                      >
                        {upsertOverride.isPending ? "Saving…" : "Save Override"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(distCoverage ?? []).map((d) => (
                      <Button
                        key={d.distributorId}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          const existing = (existingOverrides ?? []).find((ov) => ov.distributorId === d.distributorId);
                          setOverrideDistId(d.distributorId);
                          setOverrideFields(existing ? {
                            width: existing.width ?? "",
                            height: existing.height ?? "",
                            depth: existing.depth ?? "",
                            physicalWidth: existing.physicalWidth ?? "",
                            weight: existing.weight ?? "",
                            pkgLength: existing.pkgLength ?? "",
                            pkgWidth: existing.pkgWidth ?? "",
                            pkgHeight: existing.pkgHeight ?? "",
                            pkgWeight: existing.pkgWeight ?? "",
                            note: existing.note ?? "",
                          } : {});
                        }}
                      >
                        + {d.name}
                      </Button>
                    ))}
                    {(distCoverage ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">No distributors carry this cabinet yet.</p>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

            <DialogFooter className="gap-2 shrink-0 border-t border-border pt-4">
              {showCabinetAttentionReturn && (
                <Button asChild variant="outline" className="mr-auto">
                  <Link href={CABINET_ATTENTION_RETURN_URL}>Back to Attention</Link>
                </Button>
              )}
              {showDesignerCoverageReturn && (
                <Button asChild variant="outline" className="mr-auto">
                  <Link href={DESIGNER_COVERAGE_RETURN_URL}>Back to Designer Coverage</Link>
                </Button>
              )}
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateCabinet.isPending || setDistributorConfig.isPending || imageUploading}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="cabinet-detail-save"
              >
                {updateCabinet.isPending || setDistributorConfig.isPending ? (
                  <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save…
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={saveScopeOpen} onOpenChange={(open) => { if (!open) setSaveScopeOpen(false); }}>
          <DialogContent className="max-w-lg" data-testid="cabinet-config-save-scope">
            <DialogHeader>
              <DialogTitle>Who gets this rule for {resolvedMasterCode}?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Pick each distributor this configuration applies to. Only the lines you tick change; every
                other distributor and the shared master keep their current values.
              </p>
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                {(distCoverage ?? []).length > 0 ? (
                  (distCoverage ?? []).map((dist) => {
                    const checked = saveScopeDistributorIds.includes(dist.distributorId);
                    const hasRule = (existingOverrides ?? []).some(
                      (o) => o.distributorId === dist.distributorId && Number(o.hasConfigRule) === 1,
                    );
                    return (
                      <label
                        key={dist.distributorId}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setSaveScopeDistributorIds((ids) =>
                              v ? Array.from(new Set([...ids, dist.distributorId])) : ids.filter((id) => id !== dist.distributorId),
                            )
                          }
                          aria-label={`Apply rule to ${dist.name}`}
                        />
                        <span className="min-w-0 flex-1 truncate">{dist.name}</span>
                        {hasRule && <Badge variant="outline" className="text-[10px]">has own rule</Badge>}
                      </label>
                    );
                  })
                ) : (
                  <p className="px-1.5 py-1 text-xs text-muted-foreground">No distributor carries this cabinet yet.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Button type="button" size="sm" variant="ghost" onClick={() => setSaveScopeDistributorIds([])}>
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Each distributor is chosen one at a time. The shared master is never changed from here.
              </p>
            </div>
            <DialogFooter className="flex-row flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setSaveScopeOpen(false)} disabled={setDistributorConfig.isPending}>
                Back
              </Button>
              <Button
                onClick={submitForSelectedDistributors}
                disabled={setDistributorConfig.isPending || saveScopeDistributorIds.length === 0}
                data-testid="cabinet-config-save-distributors"
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                {setDistributorConfig.isPending
                  ? "Saving…"
                  : `Save for ${saveScopeDistributorIds.length || ""} selected distributor${saveScopeDistributorIds.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
      )}
    </div>
  );
}

// ─── Style-scoped category navigation with search ─────────────────────────────

function StyleCategoryNav({
  styleId,
  currentCategory,
  currentMasterCode,
}: {
  styleId: number;
  currentCategory: string | null | undefined;
  currentMasterCode: string;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(currentCategory ?? null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data, isLoading } = trpc.cabinets.listForStyle.useQuery(
    {
      styleId,
      category: activeCategory ?? undefined,
      search: searchTerm || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { enabled: showResults }
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  // Category names come from the platform taxonomy, but the pills are only
  // shown when this selected door style has at least one sellable product in
  // that category. This prevents dead, empty category labels.
  const { categoryNames } = useDynamicCategories();
  const categories = useMemo(
    () => nonEmptyStyleCategories(categoryNames, data?.categoryCounts),
    [categoryNames, data],
  );

  // A detail route can open a product whose category is not carried by the
  // chosen style. Once availability loads, fall back to All instead of leaving
  // the visitor in an empty category result.
  useEffect(() => {
    if (!data || activeCategory === null) return;
    if ((data.categoryCounts?.[activeCategory] ?? 0) === 0) {
      setActiveCategory(null);
      setPage(0);
    }
  }, [activeCategory, data]);

  return (
    <div className="mb-4">
      {/* Category pills row with search */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => {
            setActiveCategory(null);
            setShowResults(true);
            setPage(0);
          }}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            activeCategory === null && showResults
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setShowResults(true);
              setPage(0);
            }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeCategory === cat && showResults
                ? "bg-primary text-primary-foreground border-primary"
                : cat === currentCategory
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
        {/* Search input */}
        <div className="relative shrink-0 ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowResults(true);
              setPage(0);
            }}
            className="pl-8 pr-3 py-1.5 rounded-full text-xs border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring w-36"
          />
        </div>
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div className="mt-2 rounded-xl border border-border bg-card shadow-lg max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs text-muted-foreground">
              {isLoading ? "Loading..." : `${total} cabinet${total !== 1 ? "s" : ""} in this style`}
            </span>
            <button
              onClick={() => setShowResults(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {!isLoading && items.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No cabinets found
            </div>
          )}
          {items.map((item: any) => (
            <Link
              key={item.id}
              href={affiliateCabinetHref(item.masterCode, styleId)}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border last:border-0 ${
                item.masterCode === currentMasterCode ? "bg-primary/5 border-l-2 border-l-primary" : ""
              }`}
            >
              <div className="h-10 w-10 rounded border border-border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                {item.catalogImageUrl ? (
                  <img src={item.catalogImageUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">
                  {item.masterCode}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {item.description || item.category}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {item.category}
              </Badge>
            </Link>
          ))}
          {total > PAGE_SIZE && (
            <div className="px-3 py-2 flex items-center justify-between border-t border-border">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!hasPrev}
                className="px-3 py-1 rounded text-xs font-medium border border-border bg-white hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
                className="px-3 py-1 rounded text-xs font-medium border border-border bg-white hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Photorealistic 3D Cabinet Preview Section ──────────────────────────────
// Shows a "See it in 3D" button that generates a photorealistic AI render of
// the cabinet in the selected door style/color. Cached per cabinet+style combo.
function Cabinet3dPreviewSection({
  cabinetId,
  styleId,
  styleName,
  masterCode,
}: {
  cabinetId: number;
  styleId: number;
  styleName: string;
  masterCode: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if a cached preview already exists
  const { data: cached } = trpc.cabinet3dPreview.get.useQuery(
    { cabinetId, styleId },
    { enabled: !!cabinetId && !!styleId }
  );

  // If cached, show it immediately
  useEffect(() => {
    if (cached?.imageUrl) {
      setPreviewUrl(cached.imageUrl);
    } else {
      setPreviewUrl(null);
    }
  }, [cached]);

  const generateMutation = trpc.cabinet3dPreview.generate.useMutation({
    onSuccess: (data) => {
      setPreviewUrl(data.imageUrl);
      setGenerating(false);
      setError(null);
    },
    onError: (err) => {
      setError("Could not generate preview. Please try again.");
      setGenerating(false);
      console.error("3D preview generation failed:", err);
    },
  });

  const handleGenerate = () => {
    setGenerating(true);
    setError(null);
    generateMutation.mutate({ cabinetId, styleId });
  };

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 p-5 mb-6">
      <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        See This Cabinet in Your Style
      </h3>

      {previewUrl ? (
        <div className="space-y-3">
          {/* Generated 3D preview image */}
          <div className="rounded-lg overflow-hidden border border-border bg-white">
            <img
              src={previewUrl}
              alt={`Photorealistic ${masterCode} cabinet in ${styleName}`}
              className="w-full h-auto object-contain max-h-80"
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            AI-generated preview — {styleName} finish
          </p>

          {/* Add to Designer CTA */}
          <Link
            href={affiliateDesignerHref(styleId)}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground font-semibold text-sm py-3 px-4 transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <ArrowRight className="h-4 w-4" />
            Put This in the Designer
          </Link>
          <p className="text-[11px] text-muted-foreground text-center">
            Open the kitchen designer with this style pre-loaded
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            See a photorealistic 3D render of this cabinet in <span className="font-medium text-foreground">{styleName}</span> — 
            exactly how it will look in your kitchen.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full gap-2"
            size="lg"
          >
            {generating ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Generating 3D Preview...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                See It in 3D
              </>
            )}
          </Button>
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          {/* Always show Add to Designer CTA even without the 3D preview */}
          <div className="pt-2 border-t border-border">
            <Link
              href={affiliateDesignerHref(styleId)}
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-primary text-primary font-medium text-sm py-2.5 px-4 transition-all hover:bg-primary/5 active:scale-[0.98]"
            >
              <ArrowRight className="h-4 w-4" />
              Put This in the Designer
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
