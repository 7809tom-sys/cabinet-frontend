import React, { useEffect, useMemo, useRef, useState } from "react";
import { GlassPolicyBadge } from "@/components/GlassPolicyBadge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { readReferralCode, readAffiliateSlug, setReferralCode as persistReferralCode } from "@/hooks/useReferral";
import { affiliateSlugForStoreScope, resolveStoreScope } from "@/lib/affiliateContext";
import { requiresFinishMatch, finishMatchLabel, finishMatchOrderNote } from "@shared/finishMatch";
import { isUnfinishedExteriorStyleName, unfinishedExteriorSkinNote } from "@shared/skinMatch";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  CheckCircle2, AlertTriangle, Trash2, Plus, Minus, Search, Loader2, Pencil, Lock, Truck, MapPin, FileText,
} from "lucide-react";
import { CabinetImage } from "@/components/CabinetImage";
import PayWithStripe from "@/components/order/PayWithStripe";
import { FreightCalculatingStatus } from "@/components/order/FreightCalculatingStatus";
import { useLanguage } from "@/contexts/LanguageContext";
import { US_STATE_TAX_RATES } from "@shared/usSalesTax";
import { resolveCheckoutTier, type CheckoutTier } from "@/lib/checkoutContext";
import { checkoutPresentation } from "@/lib/checkoutPresentation";
import { resolveCheckoutAlias } from "@/lib/affiliateCheckoutAlias";
import { installationEstimateDocumentPath } from "@shared/installationEstimateLink";
import { isHardwareCheckoutLine, isSurfaceCheckoutLine } from "@/lib/cartCheckoutPrefill";
import { checkoutUnitPriceForLine, isCabinetFreightLine } from "@/lib/orderLinePricing";
import { getSiteSignInUrl } from "@/const";
import { isTemporaryOneDollarFreeShippingOrder, isTemporaryOneDollarCheckoutTestItem } from "@shared/temporaryCheckoutTest";
import { isStagingTestHost } from "@shared/stagingTestMode";
import { optionalPositiveFreightId } from "@shared/freight";

// A single working line in the review table. Derived from the matcher output
// but locally editable (qty, swap an unmatched code, remove).
export type ReviewLine = {
  rawCode: string;
  normalized: string;
  qty: number;
  cabinetId: number | null;
  masterCode: string | null;
  description: string | null;
  matched: boolean;
  confidence: "exact" | "normalized" | "fuzzy" | "none";
  // Split-pantry auto-pairing: when set, this line is the TOP auto-added for the
  // split-pantry BOTTOM at the given cabinetId. Used to keep the pair in sync.
  pantryTopFor?: number | null;
  pantryTotalHeight?: 84 | 90 | 96 | null;
  /** Exact customer price selected in the Design Tool and passed through cart. */
  cartUnitPrice?: number | null;
  cartPriceLocked?: boolean;
  cartStyleId?: number | null;
  /** Exact supplier line selected in the cart; preserves the live freight origin. */
  cartDistributorId?: number | null;
  glassIncluded?: boolean | null;
  cartTier?: string | null;
  cartProductKind?: "surface" | "hardware" | null;
  cartCategory?: string | null;
  /** Exact Pelican SKU used to match the verified shipping profile. */
  cartPelicanProductId?: number | null;
  /** Exact Hardware Resources catalog row for server-authoritative repricing. */
  cartVendorProductId?: number | null;
};

type StyleOption = {
  styleId: number;
  name: string;
  doorStyle: string | null;
  finish: string | null;
  color: string | null;
  coversAll: boolean;
  coverage: number;
};

type Tier = CheckoutTier;

interface Props {
  lines: ReviewLine[];
  source: "ocr" | "csv" | "design" | "manual" | "barcode";
  onLinesChange: (next: ReviewLine[]) => void;
  onReset: () => void;
  /** Pre-select this door style (from cart item) instead of auto-selecting the first available. */
  initialStyleId?: number;
  /** Pre-select this pricing tier (from cart item) instead of defaulting to Contractor. */
  initialTier?: string;
  /** Exact saved Designer plan that synchronized this cart, if the cart was unchanged. */
  kitchenDesignId?: number;
  /** Optional cart selection to request a verified UPS parcel quote only. */
  carrierPreference?: "ups";
}

// Extract the dimension digits from a raw code so the Fix picker can pre-search
// by size. "W2496" -> "2496", "WP-24-96" -> "2496", "W 24 96" -> "2496".
// Falls back to the raw code itself when no usable digit run is present.
function dimensionSeed(rawCode?: string | null): string {
  const raw = (rawCode || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  // 3+ digits almost always encodes a dimension (e.g. 2496, 3042, 2742).
  return digits.length >= 3 ? digits : raw;
}

// ─── Inline cabinet search for fixing an unmatched line ─────────────────────────
function CabinetSearchPicker({
  onPick,
  initialTerm = "",
}: {
  onPick: (c: { id: number; masterCode: string; description: string }) => void;
  initialTerm?: string;
}) {
  const { t } = useLanguage();
  const [term, setTerm] = useState(initialTerm);
  const [debounced, setDebounced] = useState(initialTerm);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isLoading } = trpc.cabinets.list.useQuery(
    { search: debounced || undefined, limit: 50, offset: 0 },
    { enabled: debounced.length >= 1 }
  );
  const items = data?.items ?? [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          autoFocus
          placeholder={t("or_search_ph")}
          className="pl-8 h-9"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      {isLoading && debounced ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("or_searching")}
        </div>
      ) : items.length > 0 ? (
        <div className="relative z-20 max-h-72 overflow-auto rounded-md border border-border divide-y divide-border bg-popover">
          {items.length >= 2 && (
            <p className="px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/50 sticky top-0">
              {t("or_matches_pick", { n: items.length })}
            </p>
          )}
          {items.map((c) => {
            const cab = c as { id: number; masterCode: string; description?: string | null };
            return (
              <button
                key={cab.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPick({
                    id: cab.id,
                    masterCode: cab.masterCode,
                    description: cab.description ?? cab.masterCode,
                  });
                }}
                className="relative z-10 block w-full text-left px-3 py-2 hover:bg-muted transition-colors cursor-pointer"
              >
                <span className="font-mono text-sm font-semibold">{cab.masterCode}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {cab.description ?? "—"}
                </span>
              </button>
            );
          })}
        </div>
      ) : debounced ? (
        <p className="text-sm text-muted-foreground py-2">{t("or_no_cabinets_for", { term: debounced })}</p>
      ) : (
        <p className="text-sm text-muted-foreground py-2">{t("or_type_to_search")}</p>
      )}
    </div>
  );
}

function ConfidenceBadge({ line }: { line: ReviewLine }) {
  const { t } = useLanguage();
  if (!line.matched) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-400/60 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
        <AlertTriangle className="h-3 w-3" /> {t("or_needs_review")}
      </Badge>
    );
  }
  if (line.confidence === "exact" || line.confidence === "normalized") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-400/60 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
        <CheckCircle2 className="h-3 w-3" /> {t("or_matched")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-blue-400/60 text-blue-600 bg-blue-50 dark:bg-blue-950/30">
      <CheckCircle2 className="h-3 w-3" /> {t("or_best_guess")}
    </Badge>
  );
}

export function OrderReview({ lines, source, onLinesChange, onReset, initialStyleId, initialTier, kitchenDesignId, carrierPreference }: Props) {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const accountTier = (user as { pricingTier?: string } | null)?.pricingTier;
  const normalizedAccountTier: Tier = resolveCheckoutTier(undefined, accountTier);
  const [tier, setTier] = useState<Tier>(resolveCheckoutTier(initialTier, accountTier));
  const [styleId, setStyleId] = useState<number | null>(initialStyleId ?? null);
  const [fixingIndex, setFixingIndex] = useState<number | null>(null);

  // Contact + submit state
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  // Fulfillment: default ship; switched to pickup only when the customer picks a
  // nearby distributor's pickup location (offered when ZIP is within radius).
  const [deliveryMethod, setDeliveryMethod] = useState<"ship" | "pickup">("ship");
  const [pickupDistributorId, setPickupDistributorId] = useState<number | null>(null);
  const [deliveryLocationType, setDeliveryLocationType] = useState<"business" | "residential">("business");
  const [liftgateRequired, setLiftgateRequired] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [submittedRequestNumber, setSubmittedRequestNumber] = useState<string | null>(null);
  const stagingTestMode = typeof window !== "undefined" && isStagingTestHost(window.location.hostname);
	const storeScope = resolveStoreScope({
	  pathname: typeof window !== "undefined" ? window.location.pathname : "/order/new",
	  search: typeof window !== "undefined" ? window.location.search : "",
	  hostname: typeof window !== "undefined" ? window.location.hostname : "",
	});
	const affiliateSlug = affiliateSlugForStoreScope(storeScope);
  // Sales tax: customer selects their state; we look up the combined rate.
  const [taxState, setTaxState] = useState<string>("");
  // Referral attribution captured from a storefront visit or ?ref= link.
	const [referralCode, setReferralCode] = useState<string | null>(() => {
	  const explicit = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : null;
	  if (explicit) return persistReferralCode(explicit, affiliateSlug ?? undefined);
	  return affiliateSlug && readAffiliateSlug() === affiliateSlug ? readReferralCode() : null;
	});
  const referralInfo = trpc.affiliates.byCode.useQuery(
    { code: referralCode ?? "" },
    { enabled: !!referralCode, retry: false }
  );
  // Manual referral-code entry (shown only when no code was auto-captured).
  const [refInput, setRefInput] = useState("");
  const refLookup = trpc.affiliates.byCode.useQuery(
    { code: refInput.trim() },
    { enabled: refInput.trim().length >= 3, retry: false }
  );
  function applyManualReferral() {
    const code = refInput.trim();
    if (!code || !refLookup.data) return;
    persistReferralCode(code);
    setReferralCode(code);
    setRefInput("");
    toast.success(t("or_referral_applied", { store: refLookup.data.storeName }));
  }

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
    if (user?.name && !name) setName(user.name);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTier(resolveCheckoutTier(initialTier, accountTier));
  }, [initialTier, accountTier]);

  // Debounce the ZIP so we only query pickup options once typing settles.
  const [zipDebounced, setZipDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setZipDebounced(zip.trim()), 350);
    return () => clearTimeout(id);
  }, [zip]);
  const pickupQuery = trpc.location.pickupOptions.useQuery(
    { zip: zipDebounced },
    { enabled: zipDebounced.length >= 5, retry: false }
  );
  const pickupOptions = pickupQuery.data?.options ?? [];
  // If the ZIP changes and the chosen pickup distributor is no longer eligible,
  // fall back to shipping so we never submit a stale pickup selection.
  useEffect(() => {
    if (deliveryMethod !== "pickup") return;
    if (!pickupOptions.some((o) => o.distributorId === pickupDistributorId)) {
      setDeliveryMethod("ship");
      setPickupDistributorId(null);
    }
  }, [pickupOptions, deliveryMethod, pickupDistributorId]);

  const matchedCabinetIds = useMemo(
    () => lines.filter((l) => l.matched && l.cabinetId != null).map((l) => l.cabinetId as number),
    [lines]
  );

  // ─── Touch-up kit checkout suggestion ─────────────────────────────────
  // We always suggest a touch-up kit at checkout (it's an Accessory). The prompt
  // appears once the order has at least one matched cabinet and the kit isn't
  // already a line; "Add" inserts it as a normal review line so it prices,
  // totals, and submits like any other item.
  const touchUpKitQuery = trpc.orders.touchUpKit.useQuery(undefined, { retry: false });
  const touchUpKit = touchUpKitQuery.data ?? null;
  const hasTouchUpKit = useMemo(
    () =>
      touchUpKit != null &&
      lines.some((l) => l.cabinetId === touchUpKit.id || (l.masterCode ?? "").toUpperCase() === "TUK"),
    [lines, touchUpKit]
  );
  const hasMatchedCabinet = matchedCabinetIds.length > 0;
  function addTouchUpKit() {
    if (!touchUpKit || hasTouchUpKit) return;
    const kitLine: ReviewLine = {
      rawCode: touchUpKit.masterCode,
      normalized: touchUpKit.masterCode,
      qty: 1,
      cabinetId: touchUpKit.id,
      masterCode: touchUpKit.masterCode,
      description: touchUpKit.description,
      matched: true,
      confidence: "exact",
    };
    onLinesChange([...lines, kitLine]);
    toast.success(t("or_touchup_added"));
  }
  const stableCabinetIds = useMemo(
    () => Array.from(new Set(matchedCabinetIds)).sort((a, b) => a - b),
    [matchedCabinetIds]
  );

  // Add (or bump the qty of) a recommended accessory as a normal review line so
  // it prices, totals, and submits like any other item.
  function addRecommended(rec: { id: number; masterCode: string; description: string }) {
    const existingIdx = lines.findIndex((l) => l.cabinetId === rec.id);
    if (existingIdx !== -1) {
      onLinesChange(
        lines.map((l, i) => (i === existingIdx ? { ...l, qty: l.qty + 1 } : l))
      );
      toast.success(t("or_added_another", { code: rec.masterCode, qty: lines[existingIdx].qty + 1 }));
      return;
    }
    const recLine: ReviewLine = {
      rawCode: rec.masterCode,
      normalized: rec.masterCode,
      qty: 1,
      cabinetId: rec.id,
      masterCode: rec.masterCode,
      description: rec.description,
      matched: true,
      confidence: "exact",
    };
    onLinesChange([...lines, recLine]);
    toast.success(t("or_added_to_order", { code: rec.masterCode }));
  }

  // Door styles that can fulfill the matched cabinets.
  const stylesQuery = trpc.orders.stylesForCabinets.useQuery(
    { cabinetIds: stableCabinetIds },
    { enabled: stableCabinetIds.length > 0, retry: false }
  );
  const styleOptions = (stylesQuery.data ?? []) as StyleOption[];

  // Auto-select the first style that covers everything once styles load.
  useEffect(() => {
    // Only auto-select if no initialStyleId was provided AND no style has been chosen yet.
    if (styleId == null && !initialStyleId && styleOptions.length > 0) {
      const best = styleOptions.find((s) => s.coversAll) ?? styleOptions[0];
      setStyleId(best.styleId);
    }
  }, [styleOptions, styleId, initialStyleId]);

  const { data: storeBranding } = trpc.storefront.brandingForSlug.useQuery(
    { slug: affiliateSlug! },
    { enabled: !!affiliateSlug, retry: false }
  );
  const selectedStyle = styleOptions.find((s) => s.styleId === styleId) ?? null;
  const brandedStyleName = resolveCheckoutAlias(
    selectedStyle,
    storeBranding?.styleNames as Record<number, string> | undefined,
  );
  const checkoutContext = checkoutPresentation(brandedStyleName, tier);

  // ─── Checkout recommendations (style-scoped accessories) ──────────────────
  // Cart-aware accessory suggestions for the chosen door style. Items already on
  // the order are excluded server-side so we never duplicate-suggest.
  const recommendQuery = trpc.orders.recommendAddOns.useQuery(
    { styleId: styleId ?? 0, cabinetIds: stableCabinetIds, tier },
    { enabled: styleId != null && stableCabinetIds.length > 0, retry: false }
  );
  const recommendGroups = useMemo(() => {
    const d = recommendQuery.data;
    if (!d) return [] as { key: string; label: string; blurb: string; items: NonNullable<typeof recommendQuery.data>["molding"] }[];
    return [
      { key: "touchUpKit", label: "Touch-up kit", blurb: "Finish-matched kit for nicks & scratches during install.", items: d.touchUpKit },
      { key: "molding", label: "Crown & trim molding", blurb: "Finish wall & tall cabinets to the ceiling line.", items: d.molding },
      { key: "endPanels", label: "Decorative end panels", blurb: "Optional cosmetic panels in the matching finish — cabinet ends already come finished.", items: d.endPanels },
      { key: "fillers", label: "Fillers & scribes", blurb: "Close gaps at walls and between cabinets.", items: d.fillers },
      { key: "rollOutTrays", label: "Roll-out shelves", blurb: "Add pull-out shelves inside base cabinets.", items: d.rollOutTrays },
    ].filter((g) => g.items.length > 0);
  }, [recommendQuery.data]);

  // ─── Split-pantry auto-pairing ────────────────────────────────────────────
  // Faircrest split pantries are two pieces: a 54" bottom (UCBxx54) + a matching
  // same-width top (Wxx..24). When a bottom is in the order, auto-add its top in
  // the SAME door style. Removing the bottom removes its auto-added top.
  const bottomsQuery = trpc.pantry.listBottoms.useQuery(undefined, { retry: false });
  const bottomIdSet = useMemo(
    () => new Set((bottomsQuery.data ?? []).map((b) => b.cabinetId)),
    [bottomsQuery.data]
  );
  const reconciling = useRef(false);
  useEffect(() => {
    if (reconciling.current) return;
    if (styleId == null) return;
    if (bottomIdSet.size === 0) return;

    // Bottom lines currently in the order (matched split-pantry bottoms).
    const bottomLines = lines.filter(
      (l) => l.matched && l.cabinetId != null && bottomIdSet.has(l.cabinetId)
    );
    const bottomIds = new Set(bottomLines.map((l) => l.cabinetId as number));

    // Remove orphaned auto-tops whose bottom is gone.
    const orphanIdx = lines.findIndex(
      (l) => l.pantryTopFor != null && !bottomIds.has(l.pantryTopFor)
    );
    if (orphanIdx !== -1) {
      onLinesChange(lines.filter((_, i) => i !== orphanIdx));
      return;
    }

    // Find a bottom that still needs its top added.
    const needs = bottomLines.find(
      (b) => !lines.some((l) => l.pantryTopFor === (b.cabinetId as number))
    );
    if (!needs) return;

    reconciling.current = true;
    const totalHeight = (needs.pantryTotalHeight ?? 84) as 84 | 90 | 96;
    utils.pantry.pairForBottom
      .fetch({ bottomCabinetId: needs.cabinetId as number, totalHeight, styleId })
      .then((top) => {
        if (top) {
          const topLine: ReviewLine = {
            rawCode: top.masterCode,
            normalized: top.masterCode,
            qty: needs.qty,
            cabinetId: top.cabinetId,
            masterCode: top.masterCode,
            description: top.description,
            matched: true,
            confidence: "exact",
            pantryTopFor: needs.cabinetId as number,
            pantryTotalHeight: totalHeight,
          };
          // Insert the top right after its bottom for readability.
          const idx = lines.findIndex((l) => l.cabinetId === needs.cabinetId);
          const next = [...lines];
          next.splice(idx + 1, 0, topLine);
          onLinesChange(next);
          toast.success(t("or_split_completed"), {
            description: t("or_split_completed_desc", { w: top.width, code: top.masterCode, h: top.totalHeight }),
          });
        }
      })
      .finally(() => {
        reconciling.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, bottomIdSet, styleId]);

  // Live pricing for the matched cabinets under the chosen style + tier.
  const priceQuery = trpc.orders.priceLines.useQuery(
    { cabinetIds: stableCabinetIds, styleId: styleId ?? 0, tier, affiliateSlug: affiliateSlug ?? undefined },
    { enabled: stableCabinetIds.length > 0 && styleId != null, retry: false }
  );
  const priceMap = useMemo(() => {
    const m = new Map<number, number | null>();
    (priceQuery.data?.prices ?? []).forEach((p) => m.set(p.cabinetId, p.unitPrice));
    return m;
  }, [priceQuery.data]);
  // Owner-only wholesale-floor cost per cabinet (server returns null for non-admins).
  const costMap = useMemo(() => {
    const m = new Map<number, number | null>();
    (priceQuery.data?.prices ?? []).forEach((p) => m.set(p.cabinetId, p.myCost));
    return m;
  }, [priceQuery.data]);

  const pricedLines = useMemo(() => {
    return lines.map((l) => {
      const unit = checkoutUnitPriceForLine(
        l,
        l.cabinetId != null ? priceMap.get(l.cabinetId) ?? null : null,
      );
      const linePrice = unit != null ? Number((unit * l.qty).toFixed(2)) : null;
      const unitCost =
        l.matched && l.cabinetId != null ? costMap.get(l.cabinetId) ?? null : null;
      const lineCost = unitCost != null ? Number((unitCost * l.qty).toFixed(2)) : null;
      return { ...l, unitPrice: unit, linePrice, unitCost, lineCost };
    });
  }, [lines, priceMap, costMap]);

  const total = pricedLines.reduce((sum, l) => sum + (l.linePrice ?? 0), 0);
  const hasOnlyTemporaryFreeShippingItems = useMemo(
    () => isTemporaryOneDollarFreeShippingOrder(pricedLines),
    [pricedLines],
  );

  const freightInput = useMemo(
    () => ({
      // Cart provides this only for an unchanged saved Designer plan. The server
      // validates ownership/scope before retaining it in freight history.
      kitchenDesignId: kitchenDesignId ?? undefined,
      deliveryAddress: {
        line1: addressLine1.trim(),
        line2: addressLine2.trim() || null,
        city: city.trim(),
        state: taxState,
        zip: zipDebounced,
      },
      merchandiseSubtotalCents: Math.max(0, Math.round(total * 100)),
      accessorials: {
        residential: deliveryLocationType === "residential",
        liftgate: liftgateRequired,
      },
      carrierPreference,
      items: pricedLines
        .filter((line) => (isCabinetFreightLine(line) || isSurfaceCheckoutLine(line)) && !isHardwareCheckoutLine(line))
        .filter((line) => !isTemporaryOneDollarCheckoutTestItem(line))
        .map((line) => ({
          cabinetId: line.cabinetId,
          masterCode: line.masterCode,
          styleId: isSurfaceCheckoutLine(line)
            ? null
            : optionalPositiveFreightId(line.cartStyleId) ?? optionalPositiveFreightId(selectedStyle?.styleId),
          distributorId: optionalPositiveFreightId(line.cartDistributorId),
          qty: line.qty,
          weightLbs: null,
          productKind: line.cartProductKind ?? null,
          category: line.cartCategory ?? null,
          pelicanProductId: isSurfaceCheckoutLine(line) ? line.cartPelicanProductId ?? null : null,
        })),
    }),
    [zipDebounced, addressLine1, addressLine2, city, taxState, total, deliveryLocationType, liftgateRequired, carrierPreference, pricedLines, selectedStyle?.styleId, kitchenDesignId],
  );
  const freightEstimate = trpc.freight.estimate.useQuery(freightInput, {
    enabled: deliveryMethod === "ship" && zipDebounced.length >= 5 && city.trim().length > 0 && taxState.length === 2 && addressLine1.trim().length > 0 && freightInput.items.length > 0,
    retry: false,
  });
  const freightCents = freightEstimate.data?.available ? freightEstimate.data.totalCents : 0;
  const hardwareQuoteInput = useMemo(() => ({
    items: pricedLines
      .filter((line) => isHardwareCheckoutLine(line))
      .map((line) => ({ vendorProductId: line.cartVendorProductId!, qty: line.qty })),
    affiliateSlug: affiliateSlug ?? undefined,
    containsKitchenMerchandise: pricedLines.some((line) => (
      isCabinetFreightLine(line)
      && optionalPositiveFreightId(line.cartDistributorId) != null
    )),
    deliveryAddress: {
      line1: addressLine1.trim(),
      line2: addressLine2.trim() || null,
      city: city.trim(),
      state: taxState,
      zip: zipDebounced,
    },
  }), [pricedLines, affiliateSlug, zipDebounced, addressLine1, addressLine2, city, taxState]);
  const hasHardwareLines = hardwareQuoteInput.items.length > 0;
  const hardwareFreightQuote = trpc.hardware.quote.useQuery(hardwareQuoteInput, {
    enabled: deliveryMethod === "ship" && hasHardwareLines && zipDebounced.length >= 5 && city.trim().length > 0 && addressLine1.trim().length > 0,
    retry: false,
  });
  const hardwareFreightCents = hardwareFreightQuote.data?.available ? (hardwareFreightQuote.data.shippingCents ?? 0) : 0;

  // Sales tax calculation: look up rate for selected state, compute tax amount.
  const taxRateQuery = trpc.location.getTaxRate.useQuery(
    { stateCode: taxState },
    { enabled: taxState.length === 2, retry: false }
  );
  const taxInfo = taxRateQuery.data ?? null;
  const taxAmount = taxInfo && total > 0 ? Number((total * taxInfo.rate).toFixed(2)) : 0;
  const grandTotal = total + taxAmount + (deliveryMethod === "ship" ? (freightCents + hardwareFreightCents) / 100 : 0);

  // Owner-only roll-up: total cost + gross margin across all priced lines.
  const isOwner = user?.role === "admin";
  const ownerCost = pricedLines.reduce((sum, l) => sum + (l.lineCost ?? 0), 0);
  const ownerHasCost = isOwner && pricedLines.some((l) => l.lineCost != null);
  const ownerMargin = Number((total - ownerCost).toFixed(2));
  const ownerMarginPct = total > 0 ? Math.round((ownerMargin / total) * 1000) / 10 : null;
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);
  const matchedCount = lines.filter((l) => l.matched).length;
  const unmatchedCount = lines.length - matchedCount;
  const pricedCount = pricedLines.filter((l) => l.unitPrice != null).length;

  // ─── Line mutations (local) ───────────────────────────────────────────────
  function updateLine(idx: number, patch: Partial<ReviewLine>) {
    onLinesChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    const removed = lines[idx];
    // Removing a split-pantry bottom also removes its auto-added top.
    if (removed?.cabinetId != null) {
      const bid = removed.cabinetId;
      onLinesChange(
        lines.filter((l, i) => i !== idx && l.pantryTopFor !== bid)
      );
      return;
    }
    onLinesChange(lines.filter((_, i) => i !== idx));
  }
  function setQty(idx: number, qty: number) {
    const clamped = Math.max(1, Math.min(999, Math.round(qty || 1)));
    const line = lines[idx];
    // Keep a split-pantry top's qty in lock-step with its bottom.
    if (line?.cabinetId != null) {
      const bid = line.cabinetId;
      onLinesChange(
        lines.map((l, i) =>
          i === idx || l.pantryTopFor === bid ? { ...l, qty: clamped } : l
        )
      );
      return;
    }
    updateLine(idx, { qty: clamped });
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();

  // Persist a manual Fix/swap so the same raw code auto-resolves next time.
  // Fire-and-forget: a failed save never blocks the local swap.
  const saveAlias = trpc.orders.saveAlias.useMutation();
  const createReq = trpc.orders.createRequest.useMutation({
    onSuccess: (res) => {
      setSubmittedId(res.id);
      setSubmittedRequestNumber(res.requestNumber);
      if (isAuthenticated) utils.orders.myRequests.invalidate();
      toast.success(t("or_submitted_toast"), {
        description: t("or_submitted_desc"),
      });
    },
    onError: (e) => {
      if (/shipping quote no longer matches|freight quote has expired/i.test(e.message)) {
        toast.info("Refreshing your verified shipping quote", {
          description: "Shipping or pricing details changed. Submit again when the refreshed quote appears.",
        });
        void freightEstimate.refetch();
        return;
      }
      toast.error(t("or_could_not_submit"), { description: e.message });
    },
  });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const customerInfoComplete = Boolean(
    name.trim() && emailValid && phone.trim() && addressLine1.trim() && city.trim() && taxState.length === 2 && /^\d{5}(?:-\d{4})?$/.test(zip.trim()),
  );

  function handleSubmit() {
    if (stagingTestMode) {
      toast.info("Staging test mode: submission is disabled.", {
        description: "Shipping quotes and address validation can be tested, but no order will be created.",
      });
      return;
    }
    if (!isAuthenticated) {
      toast.error("Sign in to continue to secure checkout.");
      window.location.href = getSiteSignInUrl();
      return;
    }
    if (lines.length === 0) {
      toast.error(t("or_add_one_first"));
      return;
    }
    if (!emailValid) {
      toast.error(t("or_valid_email_confirm"));
      return;
    }
    if (!customerInfoComplete) {
      toast.error("Enter your name, phone, complete delivery address, city, state, and ZIP before requesting or submitting shipping.");
      return;
    }
    const pendingPriceCodes = pricedLines
      .filter((line) => line.unitPrice == null || !Number.isFinite(line.unitPrice) || line.unitPrice <= 0)
      .map((line) => line.masterCode ?? line.rawCode)
      .filter((code, index, all) => Boolean(code) && all.indexOf(code) === index);
    if (pendingPriceCodes.length > 0) {
      toast.error("A current source-backed price is still required before submitting this order.", {
        description: `Cart kept every design item. Refresh or contact us to price: ${pendingPriceCodes.join(", ")}.`,
      });
      return;
    }
    const requiresCabinetOrSurfaceQuote = freightInput.items.length > 0 && !hasOnlyTemporaryFreeShippingItems;
    if (deliveryMethod === "ship" && requiresCabinetOrSurfaceQuote && !freightEstimate.data?.quoteToken) {
      toast.error("A current shipping quote is required before submitting this order.");
      return;
    }
    if (deliveryMethod === "ship" && hasHardwareLines && !hardwareFreightQuote.data?.quoteToken) {
      toast.error("A current Hardware Resources shipping quote is required before submitting this order.");
      return;
    }
    // Carry the finish-match rule through to the order: skins & decorative end
    // panels must be finished to the chosen door style. Append an explicit note
    // so the supplier sees it on the quote/order.
    const finishNote = finishMatchOrderNote(
      pricedLines.map((l) => ({
        masterCode: l.masterCode,
        description: l.description,
        subCategory: (l as { subCategory?: string | null }).subCategory ?? null,
      })),
      brandedStyleName ?? null,
    );
    const hickoryNote = unfinishedExteriorSkinNote(brandedStyleName ?? null);
    const composedNotes = [notes.trim(), finishNote, hickoryNote].filter(Boolean).join("\n\n");
    createReq.mutate({
      originatorName: name || undefined,
      originatorEmail: email,
      originatorPhone: phone || undefined,
      zip: zip || undefined,
      shippingAddressLine1: addressLine1.trim(),
      shippingAddressLine2: addressLine2.trim() || undefined,
      shippingCity: city.trim(),
      shippingState: taxState,
      source,
	  storeScope,
      styleId: selectedStyle?.styleId ?? null,
      styleName: brandedStyleName ?? null,
      tier,
      notes: composedNotes || undefined,
      referralCode: referralCode ?? undefined,
      deliveryMethod,
      deliveryLocationType,
      liftgateRequired: deliveryMethod === "ship" && liftgateRequired,
      freightQuoteToken: deliveryMethod === "ship" && !hasOnlyTemporaryFreeShippingItems
        ? freightEstimate.data?.quoteToken
        : undefined,
      hardwareFreightQuoteToken: deliveryMethod === "ship" && hasHardwareLines
        ? hardwareFreightQuote.data?.quoteToken ?? undefined
        : undefined,
      pickupDistributorId: deliveryMethod === "pickup" ? pickupDistributorId : null,
      taxState: taxState || undefined,
      taxRate: taxInfo?.rate,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      kitchenDesignId,
      submit: true,
      lineItems: pricedLines.map((l) => ({
        cabinetId: l.cabinetId,
        masterCode: l.masterCode ?? (l.normalized || l.rawCode),
        rawCode: l.rawCode,
        description: l.description ?? l.masterCode ?? l.rawCode,
        qty: l.qty,
        unitPrice: l.unitPrice,
        linePrice: l.linePrice,
        styleId: isSurfaceCheckoutLine(l) || isHardwareCheckoutLine(l)
          ? null
          : optionalPositiveFreightId(l.cartStyleId) ?? optionalPositiveFreightId(selectedStyle?.styleId),
        distributorId: isSurfaceCheckoutLine(l) || isHardwareCheckoutLine(l) ? null : optionalPositiveFreightId(l.cartDistributorId),
        productKind: isSurfaceCheckoutLine(l) ? "surface" : isHardwareCheckoutLine(l) ? "hardware" : null,
        pelicanProductId: isSurfaceCheckoutLine(l) ? l.cartPelicanProductId ?? null : null,
        vendorProductId: isHardwareCheckoutLine(l) ? l.cartVendorProductId ?? null : null,
        doorStyle: isSurfaceCheckoutLine(l) || isHardwareCheckoutLine(l) ? null : brandedStyleName ?? null,
        tier: resolveCheckoutTier(l.cartTier, accountTier),
        matched: l.matched,
      })),
    });
  }

  // ─── Ready for secure checkout ─────────────────────────────────────────────
  const installationDocument = trpc.installationEstimates.forOrderConfirmation.useQuery(
    { orderRequestId: submittedId ?? 0, customerEmail: email },
    { enabled: submittedId != null && emailValid, retry: false },
  );
  if (submittedId != null) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="font-serif text-2xl font-bold mb-2">Order ready for secure checkout</h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          Your {itemCount}-item order has been saved. Continue to Stripe to review the final payment total and complete your purchase.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={onReset}>
            {t("or_start_another")}
          </Button>
        </div>

        {installationDocument.data?.shareToken && (
          <section className="mx-auto mt-6 max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-950">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Separate installation estimate available</p>
                <p className="mt-1">Your affiliate’s installation document is separate from the Cabinet Dealz material invoice and payment.</p>
                <a className="mt-3 inline-flex font-semibold underline underline-offset-4" href={installationEstimateDocumentPath(installationDocument.data.shareToken)} target="_blank" rel="noreferrer">View installation estimate</a>
              </div>
            </div>
          </section>
        )}

        {/* Hosted payment: all line items and totals are constructed by the
            server from this stored request, then displayed by Stripe. */}
        <div className="mt-8 text-left max-w-lg mx-auto">
          <PayWithStripe
            orderRequestId={submittedId}
            orderNumber={submittedRequestNumber ?? `Order #${submittedId}`}
          />
        </div>
      </div>
    );
  }

  if (lines.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <Badge variant="secondary" className="gap-1">{t("or_lines", { n: lines.length })}</Badge>
        <Badge variant="secondary" className="gap-1">{t("or_pieces", { n: itemCount })}</Badge>
        <Badge variant="outline" className="gap-1 border-emerald-400/60 text-emerald-600">
          {t("or_n_matched", { n: matchedCount })}
        </Badge>
        {unmatchedCount > 0 && (
          <Badge variant="outline" className="gap-1 border-amber-400/60 text-amber-600">
            {t("or_n_need_review", { n: unmatchedCount })}
          </Badge>
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onReset}>{t("or_clear_start_over")}</Button>
        </div>
      </div>

      {/* Style and account pricing are selected before checkout; this is a read-only confirmation. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("or_door_style")}</Label>
          {stableCabinetIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("or_match_one_to_style")}</p>
          ) : stylesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground h-9">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("or_loading_styles")}
            </div>
          ) : (
            <p className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-medium text-foreground">
              {brandedStyleName ?? checkoutContext.doorStyle}
            </p>
          )}
          {isUnfinishedExteriorStyleName(brandedStyleName ?? null) && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{brandedStyleName}</strong> {t("or_unfinished_a")} <strong>{t("or_unfinished_b")}</strong>{t("or_unfinished_c")}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>{t("or_pricing_tier")}</Label>
          <p className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-medium text-foreground">
            {checkoutContext.pricingTier === "Wholesale"
              ? t("or_tier_wholesale")
              : checkoutContext.pricingTier === "Homeowner"
                ? t("or_tier_homeowner")
                : t("or_tier_contractor")}
          </p>
          <p className="text-xs text-muted-foreground">Pricing is applied automatically from your account.</p>
        </div>
      </div>

      {/* Line item table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">{t("or_th_code")}</TableHead>
              <TableHead>{t("or_th_description")}</TableHead>
              <TableHead className="w-[140px]">{t("or_th_status")}</TableHead>
              <TableHead className="w-[120px]">{t("or_th_qty")}</TableHead>
              <TableHead className="w-[100px] text-right">{t("or_th_unit")}</TableHead>
              <TableHead className="w-[110px] text-right">{t("or_th_line")}</TableHead>
              <TableHead className="w-[44px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricedLines.map((l, idx) => (
              <TableRow key={`${l.rawCode}-${idx}`} className={!l.matched ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}>
                <TableCell className="font-mono text-sm font-semibold">
                  <div className="flex items-center gap-2.5">
                    {/* Shared cabinet artwork — same CabinetImage used in the catalog,
                        detail page, cart, and Design Tool palette. Falls back to an
                        accurate to-scale drawing when no catalog image is mapped. */}
                    {l.matched && !isSurfaceCheckoutLine(l) && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
                        <CabinetImage
                          cabinet={{ masterCode: l.masterCode ?? l.rawCode, description: l.description }}
                          className="h-full w-auto max-w-full"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      {l.masterCode ?? l.rawCode}
                      {l.matched && l.masterCode && l.rawCode && l.masterCode.toUpperCase() !== l.rawCode.toUpperCase() && (
                        <span className="block text-[10px] font-normal text-muted-foreground">{t("or_from_raw", { raw: l.rawCode })}</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {l.description ?? <span className="text-muted-foreground italic">{t("or_unrecognized")}</span>}
                  {l.matched && !isSurfaceCheckoutLine(l) && (
                    <GlassPolicyBadge masterCode={l.masterCode ?? l.rawCode} glassIncluded={l.glassIncluded} className="ml-2 align-middle" />
                  )}
                  {l.pantryTopFor != null && (
                    <Badge variant="secondary" className="ml-2 text-[10px] align-middle">
                      {t("or_split_top_auto")}
                    </Badge>
                  )}
                  {l.matched && !isSurfaceCheckoutLine(l) &&
                    requiresFinishMatch({ description: l.description ?? l.masterCode }) &&
                    (() => {
                      const label = finishMatchLabel(brandedStyleName);
                      return (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px] align-middle border-[var(--color-gold)]/50 text-[var(--color-gold)]"
                          title="Skins & decorative end panels are finished to match the cabinet door style."
                        >
                          {label ?? t("or_finish_to_match")}
                        </Badge>
                      );
                    })()}
                </TableCell>
                <TableCell>
                  {fixingIndex === idx ? null : isSurfaceCheckoutLine(l) ? (
                    <Badge variant="secondary" className="text-[10px]">Selected product</Badge>
                  ) : <ConfidenceBadge line={l} />}
                  {!l.matched && fixingIndex !== idx && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setFixingIndex(idx)}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> {t("or_fix")}
                    </Button>
                  )}
                  {l.matched && !isSurfaceCheckoutLine(l) && fixingIndex !== idx && l.pantryTopFor == null && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-muted-foreground ml-2"
                      onClick={() => setFixingIndex(idx)}
                    >
                      {t("or_swap")}
                    </Button>
                  )}
                  {l.pantryTopFor != null && (
                    <span className="block text-[10px] text-muted-foreground">{t("or_controlled_by_base")}</span>
                  )}
                  {fixingIndex === idx && (
                    <div className="mt-1">
                      <CabinetSearchPicker
                        initialTerm={dimensionSeed(l.rawCode)}
                        onPick={(c) => {
                          // Remember this manual fix so the raw code resolves
                          // automatically next time (keyed by the raw code as
                          // typed/scanned, not the catalog master code).
                          const rawForAlias = (l.rawCode || "").trim();
                          if (rawForAlias) {
                            saveAlias.mutate({ rawCode: rawForAlias, cabinetId: c.id });
                          }
                          updateLine(idx, {
                            cabinetId: c.id,
                            masterCode: c.masterCode,
                            description: c.description,
                            matched: true,
                            confidence: "normalized",
                            normalized: c.masterCode,
                          });
                          setFixingIndex(null);
                          toast.success(t("or_code_fixed"), {
                            description: t("or_code_fixed_desc", { raw: rawForAlias, code: c.masterCode }),
                          });
                        }}
                      />
                      <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={() => setFixingIndex(null)}>
                        {t("or_cancel")}
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(idx, l.qty - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      value={l.qty}
                      onChange={(e) => setQty(idx, Number(e.target.value))}
                      className="h-7 w-12 text-center px-1"
                    />
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(idx, l.qty + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {l.unitPrice != null ? `$${l.unitPrice.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums">
                  {l.linePrice != null ? `$${l.linePrice.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    disabled={l.pantryTopFor != null}
                    title={l.pantryTopFor != null ? "Remove the pantry base to remove this top" : "Remove"}
                    onClick={() => removeLine(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add-on / recommended-accessory cross-sell removed per request — the
          design/order review no longer up-sells finishing accessories or a
          touch-up kit. (recommendAddOns query + addRecommended/addTouchUpKit
          handlers are retained but unused so the feature can be restored.) */}

      {/* Order Total with Tax Breakdown */}
      <div className="rounded-lg border border-border bg-card px-5 py-4 space-y-3">
        {/* Subtotal row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("or_est_total")}{" "}
              {pricedCount < matchedCount && (
                <span className="text-amber-600">{t("or_some_not_priced")}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedStyle ? `${brandedStyleName} · ${tier}` : t("or_select_style_to_price")}
            </p>
          </div>
          <p className="font-serif text-xl font-semibold tabular-nums">
            {total > 0 ? `$${total.toFixed(2)}` : "—"}
          </p>
        </div>

        {/* State selector for sales tax */}
        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label htmlFor="tax-state" className="text-xs text-muted-foreground mb-1 block">
                Sales Tax State <span className="font-normal">(optional — for estimate)</span>
              </Label>
              <Select value={taxState} onValueChange={setTaxState}>
                <SelectTrigger id="tax-state" className="h-8 text-sm">
                  <SelectValue placeholder="Select state…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {US_STATE_TAX_RATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name} {s.rate === 0 ? "(no tax)" : `(${(s.rate * 100).toFixed(2).replace(/\.?0+$/, "")}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {taxState && (
              <button
                type="button"
                onClick={() => setTaxState("")}
                className="text-xs text-muted-foreground hover:text-foreground mt-5"
              >
                Clear
              </button>
            )}
          </div>

          {/* Tax line */}
          {taxInfo && total > 0 && (
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-muted-foreground">
                {taxInfo.stateName} Sales Tax ({((taxInfo.rate) * 100).toFixed(2).replace(/\.?0+$/, "")}%)
                {taxInfo.hasLocalTax && <span className="text-xs ml-1">(est. incl. local)</span>}
                {taxInfo.rate === 0 && <span className="ml-1 text-emerald-600">— No tax</span>}
              </span>
              <span className="font-medium tabular-nums">
                {taxInfo.rate === 0 ? "$0.00" : `$${taxAmount.toFixed(2)}`}
              </span>
            </div>
          )}
        </div>

        {/* Grand total */}
        {taxInfo && total > 0 && (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-sm font-semibold">Estimated Total (with tax)</p>
            <p className="font-serif text-2xl font-bold tabular-nums">${grandTotal.toFixed(2)}</p>
          </div>
        )}

        {/* No state selected — show pre-tax total prominently */}
        {!taxInfo && total > 0 && (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Select your state above to see estimated tax</p>
            <p className="font-serif text-2xl font-bold tabular-nums">${total.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Owner-only cost & margin (never shown to non-admins) */}
      {ownerHasCost && (
        <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-50/60 px-5 py-3 dark:bg-amber-950/20">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-500">
            <Lock className="h-3 w-3" /> {t("or_owner_view")}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t("or_my_cost")}</p>
              <p className="font-semibold tabular-nums">${ownerCost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("or_gross_margin")}</p>
              <p className="font-semibold tabular-nums">${ownerMargin.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("or_margin_pct")}</p>
              <p className="font-semibold tabular-nums">{ownerMarginPct != null ? `${ownerMarginPct}%` : "—"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Contact + submit */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-serif text-lg font-semibold">{t("or_submit_this")}</h3>
        <p className="text-sm text-muted-foreground -mt-2">
          {t("or_submit_blurb")}
        </p>
        {referralInfo.data ? (
          <div className="flex items-center gap-2 rounded-md border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-3 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-gold)] shrink-0" />
            <span className="text-foreground">
              {t("or_referred_by")} <span className="font-semibold">{referralInfo.data.storeName}</span>
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="ord-ref">{t("or_referral_code")} <span className="text-muted-foreground font-normal">{t("or_optional")}</span></Label>
            <div className="flex gap-2">
              <Input
                id="ord-ref"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                placeholder={t("or_ref_ph")}
                className="uppercase"
              />
              <Button
                type="button"
                variant="outline"
                className="bg-card shrink-0"
                disabled={refInput.trim().length < 3 || !refLookup.data}
                onClick={applyManualReferral}
              >
                {t("or_apply")}
              </Button>
            </div>
            {refInput.trim().length >= 3 && !refLookup.isFetching && (
              refLookup.data ? (
                <p className="text-xs text-[var(--color-gold)]">{t("or_found_store", { store: refLookup.data.storeName })}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("or_no_store_match")}</p>
              )
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ord-name">{t("or_name")}</Label>
            <Input id="ord-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("or_name_ph")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ord-email">{t("or_email")} <span className="text-destructive">*</span></Label>
            <Input id="ord-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("or_email_ph")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ord-phone">{t("or_phone")} <span className="text-destructive">*</span></Label>
            <Input id="ord-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("or_phone_ph")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ord-address-1">Delivery address <span className="text-destructive">*</span></Label>
            <Input id="ord-address-1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Street address" autoComplete="street-address" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ord-address-2">Apartment, suite, or unit</Label>
            <Input id="ord-address-2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Optional" autoComplete="address-line2" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ord-city">City <span className="text-destructive">*</span></Label>
            <Input id="ord-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" autoComplete="address-level2" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ord-state">State <span className="text-destructive">*</span></Label>
            <Select value={taxState} onValueChange={setTaxState}>
              <SelectTrigger id="ord-state" className="h-9"><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {US_STATE_TAX_RATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ord-zip">{t("or_delivery_zip")} <span className="text-destructive">*</span></Label>
            <Input id="ord-zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder={t("or_zip_ph")} />
          </div>
        </div>

        {/* Delivery method: Ship (default) vs local Pickup when a distributor is
            within its pickup radius of the entered ZIP. */}
        {pickupOptions.length > 0 && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {t("or_delivery_method")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setDeliveryMethod("ship");
                  setPickupDistributorId(null);
                }}
                className={`flex items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                  deliveryMethod === "ship"
                    ? "border-primary bg-background ring-1 ring-primary"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <Truck className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  <span className="block text-sm font-medium">{t("or_ship_option")}</span>
                  <span className="block text-xs text-muted-foreground">{t("or_ship_hint")}</span>
                </span>
              </button>
              {pickupOptions.map((o) => {
                const active = deliveryMethod === "pickup" && pickupDistributorId === o.distributorId;
                return (
                  <button
                    key={o.distributorId}
                    type="button"
                    onClick={() => {
                      setDeliveryMethod("pickup");
                      setPickupDistributorId(o.distributorId);
                    }}
                    className={`flex items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-background ring-1 ring-primary"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      <span className="block text-sm font-medium">
                        {t("or_pickup_option", { name: o.displayName })}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t("or_pickup_hint", { miles: o.distanceMiles })}
                        {o.pickupAddress ? ` · ${o.pickupAddress}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {deliveryMethod === "ship" && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            {carrierPreference === "ups" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-100">
                <span aria-label="UPS" className="mt-0.5 inline-flex rounded-sm bg-[#351c15] px-1.5 py-0.5 text-[10px] font-black tracking-wide text-[#ffb500]">UPS</span>
                <span className="text-xs">
                  <strong>UPS package quote requested from cart.</strong> This checkout will only accept a UPS price when every carton has verified package data and passes UPS parcel limits. No LTL estimate is substituted for this request.
                </span>
              </div>
            )}
            {hasOnlyTemporaryFreeShippingItems ? (
              <div role="status" className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-950">
                <p className="text-sm font-semibold">Free test shipping</p>
                <p className="mt-1 text-xs text-emerald-800">
                  The temporary one-dollar checkout item is freight-exempt for this payment-flow test. Other cabinet products still require a current live shipping quote.
                </p>
              </div>
            ) : (
              <>
            <div>
              <p className="text-sm font-medium">Delivery location</p>
              <p className="text-xs text-muted-foreground">
                Select the actual location type. A ZIP alone cannot reliably identify a residential address.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["business", "residential"] as const).map((locationType) => (
                <button
                  key={locationType}
                  type="button"
                  onClick={() => {
                    setDeliveryLocationType(locationType);
                    setLiftgateRequired(locationType === "residential");
                  }}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    deliveryLocationType === locationType
                      ? "border-primary bg-background ring-1 ring-primary"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <span className="block text-sm font-medium capitalize">{locationType}</span>
                  <span className="block text-xs text-muted-foreground">
                    {locationType === "residential"
                      ? "Lift gate selected by default; you can change it below."
                      : "Commercial receiving location; confirm equipment below."}
                  </span>
                </button>
              ))}
            </div>
            <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
              <input
                type="checkbox"
                checked={liftgateRequired}
                onChange={(e) => setLiftgateRequired(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium">Lift gate required</span>
                <span className="block text-xs text-muted-foreground">
                  Select this when the delivery location does not have a loading dock or forklift for unloading.
                </span>
              </span>
            </label>
            {!customerInfoComplete ? (
              <p role="status" className="text-xs text-amber-800">Complete the required name, phone, street address, city, state, and ZIP above to calculate the shipping quote.</p>
            ) : freightEstimate.isFetching ? (
              <FreightCalculatingStatus upsRequested={carrierPreference === "ups"} />
            ) : freightEstimate.data?.available ? (
              <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-950">
                <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                  <span>Verified shipping total</span>
                  <span>${(freightEstimate.data.totalCents / 100).toFixed(2)}</span>
                </div>
                {(freightEstimate.data.rateGroups ?? []).map((group) => (
                  <div key={group.key} className="text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <span>
                        <strong>{group.vendorName ?? "Fulfillment vendor"}</strong> · {group.source === "parcel" ? "Live parcel" : group.source === "live" ? "Plan A live" : "Plan B fallback"} · {group.label}
                      </span>
                      <span className="shrink-0">${(group.baseAmountCents / 100).toFixed(2)}</span>
                    </div>
                    {group.parcelReviewWarnings?.length ? (
                      <p className="mt-1 rounded border border-amber-200 bg-amber-50 p-1.5 text-amber-900">
                        Carrier handling review: {group.parcelReviewWarnings.join(" ")}
                      </p>
                    ) : null}
                  </div>
                ))}
                {(freightEstimate.data.shipmentGroups ?? []).length > 0 && (
                  <div className="space-y-2 border-t border-emerald-200 pt-2 text-xs">
                    <p className="font-semibold">Shipment breakdown</p>
                    {freightEstimate.data.shipmentGroups?.map((group) => (
                      <div key={`${group.label}:${group.originZip}`} className="rounded border border-emerald-200 bg-background/70 p-2">
                        <div className="font-semibold">{group.vendorName ?? group.label}</div>
                        <div>{group.label}</div>
                        {group.packageEvidenceType === "comparable_estimate" && <div className="mt-1 rounded border border-amber-200 bg-amber-50 p-1.5 text-amber-900">Comparison-based package estimate used for carrier rating. Final packing may change the charge.</div>}
                        {group.pallets.map((pallet, index) => <div key={`pallet-${index}`}>Pallet {index + 1}: {pallet.lengthIn} × {pallet.widthIn} × {pallet.heightIn} in · {pallet.weightLbs} lb</div>)}
                        {(group.parcels ?? []).map((parcel, index) => <div key={`carton-${index}`}>Carton {index + 1}: {parcel.lengthIn} × {parcel.widthIn} × {parcel.heightIn} in · {parcel.weightLbs} lb</div>)}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-emerald-800">
                  Each origin is packed and quoted separately using final pallet dimensions and loaded weight.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {freightEstimate.error?.message ?? freightEstimate.data?.reason ?? "Shipping is not available for this order yet."}
                {freightEstimate.data?.partial && (freightEstimate.data.rateGroups ?? []).length > 0 && (
                  <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-950">
                    <div className="font-semibold">Shipping included so far: ${(freightEstimate.data.totalCents / 100).toFixed(2)}</div>
                    {(freightEstimate.data.rateGroups ?? []).map((rate) => <div key={rate.key}>{rate.vendorName ?? "Fulfillment vendor"}: {rate.label} · ${(rate.baseAmountCents / 100).toFixed(2)}</div>)}
                    <div className="mt-1">This total excludes the unavailable shipment groups listed below, so the order cannot be submitted yet.</div>
                  </div>
                )}
                {(freightEstimate.data?.shipmentGroups ?? []).length > 0 && (
                  <div className="mt-3 space-y-2 text-xs">
                    {freightEstimate.data?.shipmentGroups?.map((group) => (
                      <div key={`${group.label}:${group.originZip}`} className="rounded border border-amber-200 bg-background/70 p-2">
                        <div className="font-semibold text-foreground">{group.vendorName ?? group.label}</div>
                        <div>{group.label}</div>
                        <div className="font-medium">These items aren’t able to ship right now.</div>
                        {group.itemLabels?.length ? <div>Items retained in order: {group.itemLabels.join(", ")}</div> : null}
                        <div>Shipping is not included for this group. Other shipment quotes remain separate.</div>
                        {group.packageEvidenceType === "comparable_estimate" && <div>Package estimate: comparison-based; final packing may change the charge.</div>}
                        {group.pallets.map((pallet, index) => <div key={index}>Pallet {index + 1}: {pallet.lengthIn} × {pallet.widthIn} × {pallet.heightIn} in · {pallet.weightLbs} lb</div>)}
                        {(group.parcels ?? []).map((parcel, index) => <div key={index}>Carton {index + 1}: {parcel.lengthIn} × {parcel.widthIn} × {parcel.heightIn} in · {parcel.weightLbs} lb</div>)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="ord-notes">{t("or_notes")}</Label>
          <Textarea id="ord-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("or_notes_ph")} rows={3} />
        </div>
        {unmatchedCount > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {t("or_unmatched_warn", { n: unmatchedCount, s: unmatchedCount > 1 ? "s" : "" })}
            </span>
          </div>
        )}
        {stagingTestMode && (
          <div role="status" className="flex items-start gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span><strong>Staging test mode:</strong> order submission is disabled. You can test address validation and shipping quotes safely.</span>
          </div>
        )}
        <Button
          onClick={handleSubmit}
          disabled={stagingTestMode || createReq.isPending || (deliveryMethod === "ship" && freightEstimate.isFetching)}
          size="lg"
          className="w-full bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]/90 font-semibold"
        >
          {createReq.isPending ? t("or_submitting") : `${t("or_submit_request")}${grandTotal > 0 ? ` · $${grandTotal.toFixed(2)}` : ""}`}
        </Button>
      </div>
    </div>
  );
}

// Re-export Tabs primitives so the page can compose them alongside this component
// without re-importing in multiple places.
export { Tabs, TabsList, TabsTrigger, TabsContent };
