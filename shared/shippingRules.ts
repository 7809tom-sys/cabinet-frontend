/**
 * Shipping-rules config: the single source of truth for how each merchandise
 * category is quoted. Cart, checkout, and (on the backend) order status and
 * owner-email alerts all read from this file.
 *
 * Three sale paths, so a missing rate never blocks a save:
 *   1. fixed    — a known amount is applied (Florida slabs, free hardware).
 *   2. estimate — the customer requests a team estimate; the order can still
 *                 be placed or saved with shipping shown as pending (never
 *                 silently treated as $0).
 *   3. manual   — the customer sends the whole invoice to the team; payment
 *                 is not captured until the team quotes it.
 *
 * "existing" is not a customer path. It means "keep today's cabinet / other
 * carrier logic" (live LTL, distributor rules, catalog free-shipping).
 */

export const FLORIDA_COUNTERTOP_CENTS_PER_SLAB = 5000;

export const OUT_OF_STATE_COUNTERTOP_PENDING_LABEL =
  "Countertop shipping outside Florida: quoted separately / pending";

export const BACKSPLASH_UPS_PENDING_LABEL =
  "Backsplash UPS shipping: quoted separately / pending";

export const FLOORING_PENDING_LABEL =
  "Flooring shipping: quoted separately / pending";

export const HARDWARE_FREE_LABEL = "Free";

export const AWAITING_SHIPPING_ESTIMATE_STATUS = "awaiting_shipping_estimate" as const;
export const AWAITING_MANUAL_SHIPPING_QUOTE_STATUS = "awaiting_manual_shipping_quote" as const;

export const SHIPPING_QUOTE_STATUSES = [
  "none",
  "quoted",
  AWAITING_SHIPPING_ESTIMATE_STATUS,
  AWAITING_MANUAL_SHIPPING_QUOTE_STATUS,
] as const;

export type ShippingQuoteStatus = (typeof SHIPPING_QUOTE_STATUSES)[number];

export type ShippingCategory =
  | "cabinets"
  | "countertops"
  | "hardware"
  | "backsplashes"
  | "flooring"
  | "other";

/** Customer-facing path, plus "existing" for today's cabinet/other carrier logic. */
export type ShippingPath = "fixed" | "estimate" | "manual" | "existing";

export type ShippingCarrierLane = "ups" | "slab-freight" | "ltl" | "parcel" | null;

export type CategoryShippingRule = {
  path: ShippingPath;
  label: string;
  policy: string;
  carrierLane: ShippingCarrierLane;
  /** Flat fee when the path is fixed and not per-unit. 0 means free. */
  fixedFeeCents?: number;
  unitFeeCents?: number;
  unitLabel?: string;
};

/**
 * Default rate source per category. Destination can refine a path — today
 * only countertops do: fixed in Florida, estimate everywhere else.
 */
export const SHIPPING_RULES: Record<ShippingCategory, CategoryShippingRule> = {
  cabinets: {
    path: "existing",
    label: "Cabinets",
    policy: "Cabinet shipping uses the current carrier or distributor freight quote.",
    carrierLane: "ltl",
  },
  countertops: {
    path: "fixed",
    label: "Countertops",
    policy: "Countertops ship at $50 per slab to any Florida address, Miami through the panhandle. Outside Florida, request a shipping estimate — no amount is guessed.",
    carrierLane: "slab-freight",
    unitFeeCents: FLORIDA_COUNTERTOP_CENTS_PER_SLAB,
    unitLabel: "slab",
  },
  hardware: {
    path: "fixed",
    label: "Hardware",
    policy: "Hardware (knobs, pulls, hinges, and other hardware) ships free.",
    carrierLane: "parcel",
    fixedFeeCents: 0,
  },
  backsplashes: {
    path: "estimate",
    label: "Backsplashes",
    policy: "Backsplashes ship by UPS, on a separate lane from slab freight. The UPS rate is not yet published, so an estimate is requested and no amount is invented.",
    carrierLane: "ups",
  },
  flooring: {
    path: "estimate",
    label: "Flooring",
    policy: "Flooring shipping is requested as an estimate. No amount is invented.",
    carrierLane: "ltl",
  },
  other: {
    path: "existing",
    label: "Other surfaces",
    policy: "Other surface items use the current shipping quote when one exists.",
    carrierLane: null,
  },
};

export type ShippingItemInput = {
  productKind?: string | null;
  category?: string | null;
  subCategory?: string | null;
  name?: string | null;
  description?: string | null;
  qty: number;
  qtyNote?: string | null;
};

export type ShippingDestination = {
  state?: string | null;
  zip?: string | null;
};

const COUNTERTOP_CATEGORIES = new Set(["quartz slabs (countertops)"]);
const FLOORING_CATEGORIES = new Set(["flooring"]);
const BACKSPLASH_CATEGORIES = new Set(["tile & mosaic"]);

function textBlob(item: ShippingItemInput): string {
  return [item.category, item.subCategory, item.name, item.description, item.qtyNote]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .toLowerCase();
}

function categoryName(item: ShippingItemInput): string {
  return (item.category ?? "").trim().toLowerCase();
}

/** Florida is state FL, or a complete ZIP in the 32000–34999 range (Miami through the panhandle). */
export function isFloridaDelivery(destination: ShippingDestination): boolean {
  const state = (destination.state ?? "").trim().toUpperCase();
  if (state === "FL" || state === "FLORIDA") return true;
  const zip = (destination.zip ?? "").replace(/\D/g, "").slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return false;
  const n = Number(zip);
  return n >= 32000 && n <= 34999;
}

export function isHardwareShippingItem(item: ShippingItemInput): boolean {
  return item.productKind === "hardware";
}

export function isCountertopShippingItem(item: ShippingItemInput): boolean {
  if (item.productKind === "hardware") return false;
  const category = categoryName(item);
  if (COUNTERTOP_CATEGORIES.has(category)) return true;
  const text = textBlob(item);
  return text.includes("countertop") || text.includes("quartz slab");
}

export function isFlooringShippingItem(item: ShippingItemInput): boolean {
  if (item.productKind === "hardware" || isCountertopShippingItem(item)) return false;
  const category = categoryName(item);
  if (FLOORING_CATEGORIES.has(category)) {
    const sub = (item.subCategory ?? "").trim().toLowerCase();
    return !sub || sub === "planks & flooring";
  }
  const text = textBlob(item);
  return /\bflooring\b|\bplanks?\b|\blvp\b|\blaminate\b/.test(text) && !/\btrim\b|\bbaseboard\b|\breducer\b/.test(text);
}

export function isBacksplashShippingItem(item: ShippingItemInput): boolean {
  if (item.productKind === "hardware" || isCountertopShippingItem(item) || isFlooringShippingItem(item)) return false;
  const category = categoryName(item);
  if (BACKSPLASH_CATEGORIES.has(category)) return true;
  const text = textBlob(item);
  return text.includes("backsplash") || text.includes("mosaic") || /\btile\b/.test(text);
}

export function shippingCategoryForItem(item: ShippingItemInput): ShippingCategory {
  if (isHardwareShippingItem(item)) return "hardware";
  if (item.productKind === "surface" || item.productKind === "pelican") {
    if (isCountertopShippingItem(item)) return "countertops";
    if (isFlooringShippingItem(item)) return "flooring";
    if (isBacksplashShippingItem(item)) return "backsplashes";
    return "other";
  }
  if (isCountertopShippingItem(item)) return "countertops";
  if (isFlooringShippingItem(item)) return "flooring";
  if (isBacksplashShippingItem(item)) return "backsplashes";
  return "cabinets";
}

/**
 * How this category is quoted at this destination. Countertops are fixed in
 * Florida and estimate everywhere else; every other category uses its config path.
 */
export function pathForCategory(category: ShippingCategory, destination: ShippingDestination): ShippingPath {
  if (category === "countertops") {
    return isFloridaDelivery(destination) ? "fixed" : "estimate";
  }
  return SHIPPING_RULES[category].path;
}

/**
 * Slab count is the cart/checkout quantity on a countertop line. The designer
 * already sets qty to ceil(rendered sq ft / slab sq ft) in buildSurfaceCartLines;
 * a shop-added slab is also one unit per slab. qtyNote is only a display hint.
 */
export function countertopSlabCount(item: ShippingItemInput): number {
  const qty = Math.max(0, Math.round(Number(item.qty) || 0));
  return Number.isFinite(qty) ? qty : 0;
}

export type CategoryShippingQuote = {
  category: ShippingCategory;
  path: ShippingPath;
  label: string;
  policy: string;
  carrierLane: ShippingCarrierLane;
  itemIndexes: number[];
  slabCount: number;
  /** Known fee in cents. null means pending — never treat that as $0. */
  feeCents: number | null;
  displayAmount: string;
  pendingLabel: string | null;
};

export type ShippingRulesQuote = {
  categories: CategoryShippingQuote[];
  /** Sum of known (fixed) category fees only. Pending categories are omitted. */
  knownRuleShippingCents: number;
  hasPendingEstimate: boolean;
  pendingLabels: string[];
  canRequestEstimate: boolean;
  /** Manual quote is always available when the customer is unsure. */
  canRequestManualQuote: boolean;
};

function moneyFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function pendingLabelFor(category: ShippingCategory): string {
  if (category === "countertops") return OUT_OF_STATE_COUNTERTOP_PENDING_LABEL;
  if (category === "backsplashes") return BACKSPLASH_UPS_PENDING_LABEL;
  if (category === "flooring") return FLOORING_PENDING_LABEL;
  return `${SHIPPING_RULES[category].label} shipping: quoted separately / pending`;
}

function quoteOneCategory(
  category: ShippingCategory,
  items: Array<{ item: ShippingItemInput; index: number }>,
  destination: ShippingDestination,
): CategoryShippingQuote {
  const rule = SHIPPING_RULES[category];
  const path = pathForCategory(category, destination);
  const itemIndexes = items.map((entry) => entry.index);
  const slabCount = category === "countertops"
    ? items.reduce((sum, entry) => sum + countertopSlabCount(entry.item), 0)
    : 0;

  if (path === "fixed" && category === "hardware") {
    return {
      category,
      path,
      label: rule.label,
      policy: rule.policy,
      carrierLane: rule.carrierLane,
      itemIndexes,
      slabCount: 0,
      feeCents: 0,
      displayAmount: HARDWARE_FREE_LABEL,
      pendingLabel: null,
    };
  }

  if (path === "fixed" && category === "countertops") {
    const feeCents = slabCount * (rule.unitFeeCents ?? FLORIDA_COUNTERTOP_CENTS_PER_SLAB);
    const unit = slabCount === 1 ? "slab" : "slabs";
    return {
      category,
      path,
      label: rule.label,
      policy: rule.policy,
      carrierLane: rule.carrierLane,
      itemIndexes,
      slabCount,
      feeCents,
      displayAmount: `${slabCount} ${unit} \u00d7 $50 = ${moneyFromCents(feeCents)}`,
      pendingLabel: null,
    };
  }

  if (path === "estimate" || path === "manual") {
    const pending = pendingLabelFor(category);
    return {
      category,
      path,
      label: rule.label,
      policy: rule.policy,
      carrierLane: rule.carrierLane,
      itemIndexes,
      slabCount,
      feeCents: null,
      displayAmount: pending,
      pendingLabel: pending,
    };
  }

  return {
    category,
    path,
    label: rule.label,
    policy: rule.policy,
    carrierLane: rule.carrierLane,
    itemIndexes,
    slabCount,
    feeCents: null,
    displayAmount: "Quoted with cabinet freight",
    pendingLabel: null,
  };
}

/** Quote every present category. Cabinets and "other" stay on existing carrier logic. */
export function quoteShippingByRules(
  items: readonly ShippingItemInput[],
  destination: ShippingDestination,
): ShippingRulesQuote {
  const grouped = new Map<ShippingCategory, Array<{ item: ShippingItemInput; index: number }>>();
  items.forEach((item, index) => {
    const category = shippingCategoryForItem(item);
    const list = grouped.get(category) ?? [];
    list.push({ item, index });
    grouped.set(category, list);
  });

  const order: ShippingCategory[] = ["cabinets", "countertops", "hardware", "backsplashes", "flooring", "other"];
  const categories = order
    .filter((category) => grouped.has(category))
    .map((category) => quoteOneCategory(category, grouped.get(category)!, destination));

  const knownRuleShippingCents = categories.reduce((sum, quote) => (
    quote.path === "fixed" && quote.feeCents != null ? sum + quote.feeCents : sum
  ), 0);
  const pendingLabels = categories
    .map((quote) => quote.pendingLabel)
    .filter((label): label is string => Boolean(label));

  return {
    categories,
    knownRuleShippingCents,
    hasPendingEstimate: pendingLabels.length > 0,
    pendingLabels,
    canRequestEstimate: pendingLabels.length > 0,
    canRequestManualQuote: items.length > 0,
  };
}

/** Categories the existing carrier quote must not invent a number for. */
export function isExistingCarrierCategory(category: ShippingCategory, destination: ShippingDestination): boolean {
  const path = pathForCategory(category, destination);
  return path === "existing";
}

export function itemUsesExistingCarrierQuote(item: ShippingItemInput, destination: ShippingDestination): boolean {
  return isExistingCarrierCategory(shippingCategoryForItem(item), destination);
}

export type ComposedCheckoutShipping = {
  /** Known shipping only: cabinet/other carrier cents plus fixed rule fees. */
  knownShippingCents: number;
  pendingLabels: string[];
  hasPendingEstimate: boolean;
  /** True when the customer chose the manual-quote path, or we must hold payment. */
  holdPaymentCapture: boolean;
};

/**
 * Combine today's cabinet (and other existing-path) freight with the rule fees.
 * Pending estimate amounts are listed, never added as $0.
 */
export function composeCheckoutShipping(input: {
  existingCarrierCents: number;
  rules: ShippingRulesQuote;
  /** Set when the customer chose "send this invoice for a manual quote". */
  manualQuoteRequested?: boolean;
}): ComposedCheckoutShipping {
  const existing = Number.isFinite(input.existingCarrierCents) ? Math.max(0, Math.round(input.existingCarrierCents)) : 0;
  const holdPaymentCapture = input.manualQuoteRequested === true;
  return {
    knownShippingCents: existing + input.rules.knownRuleShippingCents,
    pendingLabels: input.rules.pendingLabels,
    hasPendingEstimate: input.rules.hasPendingEstimate,
    holdPaymentCapture,
  };
}

/** Payment may be captured only when the invoice is not waiting on a manual team quote. */
export function canCaptureShippingPayment(status: ShippingQuoteStatus | string | null | undefined): boolean {
  return status !== AWAITING_MANUAL_SHIPPING_QUOTE_STATUS;
}

/** The estimate path lets the customer place or save the order with shipping pending. */
export function canPlaceOrderWithPendingShipping(status: ShippingQuoteStatus | string | null | undefined): boolean {
  return status !== AWAITING_MANUAL_SHIPPING_QUOTE_STATUS;
}

export function formatKnownShippingWithPending(knownShippingCents: number, pendingLabels: readonly string[]): string {
  const known = moneyFromCents(knownShippingCents);
  if (pendingLabels.length === 0) return known;
  return `${known} + ${pendingLabels.join("; ")}`;
}
