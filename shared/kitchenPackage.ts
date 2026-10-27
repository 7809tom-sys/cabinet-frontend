export type PackageLineItem = {
  label: string;
  code: string;
  category: string;
  supplier: string;
  qty: number;
  unitPrice: number | null;
  lineTotal: number | null;
  section: "cabinet" | "other";
};

export type PackagePriceInput = {
  lineItems: readonly Pick<PackageLineItem, "lineTotal">[];
  override?: number | null;
  discount?: number | null;
};

export function applyMarkupBps(amount: number, markupBps: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(markupBps)) return amount;
  return Math.round(amount * (1 + markupBps / 10_000) * 100) / 100;
}

export function resolvePackagePrice(input: PackagePriceInput): { autoSum: number; finalPrice: number } {
  const autoSum = Math.round(input.lineItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0) * 100) / 100;
  if (input.override != null && Number.isFinite(input.override) && input.override >= 0) {
    return { autoSum, finalPrice: Math.round(input.override * 100) / 100 };
  }
  const discount = input.discount != null && Number.isFinite(input.discount) ? Math.max(0, input.discount) : 0;
  return { autoSum, finalPrice: Math.round(Math.max(0, autoSum - discount) * 100) / 100 };
}

export function packagePricesChanged(snapshotTotal: number | null, liveTotal: number | null): boolean {
  if (snapshotTotal == null || liveTotal == null) return liveTotal != null && snapshotTotal == null;
  return Math.round(snapshotTotal * 100) !== Math.round(liveTotal * 100);
}

export type PackageAccess = {
  affiliateId: number;
  isOwner: boolean;
  accessDesigner: boolean;
} | null;

export function decidePackageAccess(args: {
  role: string;
  access: PackageAccess;
  requestedAffiliateId?: number | null;
}): { ok: true; affiliateId: number | null } | { ok: false; message: string } {
  if (args.role === "admin") {
    return { ok: true, affiliateId: args.requestedAffiliateId ?? null };
  }
  if (!args.access || (!args.access.isOwner && !args.access.accessDesigner)) {
    return { ok: false, message: "Designer access has not been enabled for this team member." };
  }
  if (args.requestedAffiliateId != null && args.requestedAffiliateId !== args.access.affiliateId) {
    return { ok: false, message: "You can only publish packages on your own store." };
  }
  return { ok: true, affiliateId: args.access.affiliateId };
}

/** A package is a copy. The customer's design id is recorded and never updated. */
export function planKitchenPackageCopy<T extends Record<string, unknown>>(args: {
  sourceDesignId: number | null;
  snapshot: T;
  lineItems: PackageLineItem[];
  price: { autoSum: number; finalPrice: number };
  affiliateId: number | null;
  name: string;
}): {
  updatesSourceDesign: false;
  movesSourceDesign: false;
  bundle: {
    sourceDesignId: number | null;
    designSnapshot: T;
    lineItemsJson: PackageLineItem[];
    homeownerPrice: string;
    bomSnapshotTotal: string;
    affiliateId: number | null;
    name: string;
  };
} {
  return {
    updatesSourceDesign: false,
    movesSourceDesign: false,
    bundle: {
      sourceDesignId: args.sourceDesignId,
      designSnapshot: args.snapshot,
      lineItemsJson: args.lineItems,
      homeownerPrice: args.price.finalPrice.toFixed(2),
      bomSnapshotTotal: args.price.autoSum.toFixed(2),
      affiliateId: args.affiliateId,
      name: args.name,
    },
  };
}

export function packageVisibleOnStore(bundleAffiliateId: number | null, storeAffiliateId: number | null): boolean {
  if (storeAffiliateId == null) return bundleAffiliateId == null;
  return bundleAffiliateId === storeAffiliateId;
}

/** Trim stays on the line item's own supplier so two cabinet lines are not merged. */
export function packageLinesKeepSupplierTrim(items: readonly PackageLineItem[]): boolean {
  const trim = items.filter((item) => /trim/i.test(item.category));
  const suppliers = new Set(trim.map((item) => item.supplier));
  return trim.length < 2 || suppliers.size === trim.length || suppliers.size > 1;
}
