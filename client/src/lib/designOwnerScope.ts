/**
 * Who a saved design belongs to, and which store it opens under.
 *
 * A saved design has exactly one owner: the account (kitchen_designs.userId)
 * that saved it. The storefront it was saved on (kitchen_designs.affiliateId)
 * is only the design's origin — the shop whose catalog and team it came
 * through. Two rules follow, and every helper here exists to enforce them:
 *
 *  1. An EXISTING design always writes and opens under its OWN stored store.
 *     The address in the browser (a deal's store, a storefront the person
 *     happens to be browsing, a stale `?affiliate=` link) never decides it.
 *     This is what stops a design saved by one person from being re-labelled
 *     as another store's design just because that is where it was clicked.
 *
 *  2. A NEW design saved by a signed-in person belongs to that person's
 *     account scope ("owner") when they are platform staff who does not belong
 *     to the storefront they are on. A storefront CUSTOMER, or a member of that
 *     store's own team, keeps the store scope, because that store's CRM is
 *     meant to receive the plan.
 *
 * Both rules are pure so the Designer, the account pages, and the CRM links all
 * agree, and so they can be tested without a browser.
 */
import { OWNER_STORE_SCOPE, normalizeStoreScope, type StoreScope } from "@/lib/affiliateContext";

/** Roles that already pass the Designer's email gate (see designerFreshStart). */
const STAFF_ROLES = new Set(["admin", "designer", "sales_rep", "distributor"]);

export type SavedDesignOwnership = {
  id: number;
  /** Account that owns the design. Null only on legacy rows saved anonymously. */
  userId?: number | null;
  /** Store the design was created on. Null is the platform's own (house) scope. */
  affiliateId?: number | null;
  /** Slug of that store, when the server resolved it for the row. */
  affiliateSlug?: string | null;
  /** Display name of that store, when the server resolved it for the row. */
  affiliateName?: string | null;
};

/** The store scope a saved design really lives in, or "owner" for a house design. */
export function designStoreScope(design: Pick<SavedDesignOwnership, "affiliateSlug"> | null | undefined): StoreScope {
  return normalizeStoreScope(design?.affiliateSlug ?? null);
}

/** True when this design is the account's own saved work. */
export function designBelongsToAccount(
  design: Pick<SavedDesignOwnership, "userId"> | null | undefined,
  accountId: number | null | undefined,
): boolean {
  if (!design || accountId == null) return false;
  return design.userId != null && design.userId === accountId;
}

/**
 * Where an "Open in designer" link must point. The design's own store decides,
 * never the store of the deal or customer record that links to it.
 */
export function designOpenPath(
  design: SavedDesignOwnership,
  options: { assist?: boolean; loadParam?: "load" | "designId" } = {},
): string {
  const param = options.loadParam ?? "load";
  const scope = designStoreScope(design);
  const base = scope === OWNER_STORE_SCOPE
    ? "/design"
    : `/store/${encodeURIComponent(scope)}/design`;
  const search = new URLSearchParams();
  search.set(param, String(design.id));
  if (options.assist) search.set("assist", "1");
  return `${base}?${search.toString()}`;
}

/**
 * Store scope used for an EXISTING design's reads and writes. When the server
 * tells us the design's own store, that wins over whatever the address says.
 */
export function designWriteScope(input: {
  /** Scope resolved from the current address. */
  urlScope: string;
  /** The loaded design, when there is one. */
  design?: Pick<SavedDesignOwnership, "affiliateSlug"> | null;
}): StoreScope {
  const own = input.design ? designStoreScope(input.design) : null;
  return own ?? normalizeStoreScope(input.urlScope);
}

/**
 * Store scope a NEW design is saved into.
 *
 * Guests (nobody signed in) keep the storefront they are browsing: that work is
 * adopted into the account on sign-in. Signed-in platform staff save to their
 * own account scope so the design is theirs on every device, unless they belong
 * to the store they are on. Storefront customers keep the store scope.
 */
export function newDesignSaveScope(input: {
  urlScope: string;
  role?: string | null;
  /** Affiliate id the signed-in person belongs to, from affiliates.myAccess. */
  viewerAffiliateId?: number | null;
  /** Affiliate id of the storefront currently being browsed. */
  storeAffiliateId?: number | null;
}): StoreScope {
  const urlScope = normalizeStoreScope(input.urlScope);
  if (urlScope === OWNER_STORE_SCOPE) return OWNER_STORE_SCOPE;

  const isMemberOfStore =
    input.viewerAffiliateId != null
    && input.storeAffiliateId != null
    && input.viewerAffiliateId === input.storeAffiliateId;
  if (isMemberOfStore) return urlScope;

  const role = (input.role ?? "").trim().toLowerCase();
  if (STAFF_ROLES.has(role)) return OWNER_STORE_SCOPE;

  return urlScope;
}

/**
 * Human store label for a saved design. A house design is the person's own
 * CabinetDealz account, not "unknown" and not the platform operator's store.
 */
export function designStoreLabel(
  design: Pick<SavedDesignOwnership, "affiliateSlug" | "affiliateName"> | null | undefined,
  fallback = "CabinetDealz",
): string {
  const name = (design?.affiliateName ?? "").trim();
  if (name) return name;
  const scope = designStoreScope(design);
  return scope === OWNER_STORE_SCOPE ? fallback : scope.replace(/-/g, " ");
}

/**
 * True when the design was created on a store other than the one the address
 * names, so the Designer must not render it under the wrong store's brand.
 */
export function designOpensOutsideAddressScope(input: {
  urlScope: string;
  design?: Pick<SavedDesignOwnership, "affiliateSlug"> | null;
  /** Assist and CRM links deliberately open a customer's design in place. */
  allowCrossStore?: boolean;
}): boolean {
  if (input.allowCrossStore || !input.design) return false;
  return designStoreScope(input.design) !== normalizeStoreScope(input.urlScope);
}
