import { describe, expect, it } from "vitest";
import {
  decidePackageAccess,
  packageLinesKeepSupplierTrim,
  packagePricesChanged,
  packageVisibleOnStore,
  planKitchenPackageCopy,
  resolvePackagePrice,
  type PackageLineItem,
} from "./kitchenPackage";

const lines: PackageLineItem[] = [
  { label: "Base cabinet", code: "B24", category: "Cabinet", supplier: "Pelican", qty: 2, unitPrice: 100, lineTotal: 200, section: "cabinet" },
  { label: "Crown", code: "CR", category: "Trim", supplier: "Pelican", qty: 1, unitPrice: 40, lineTotal: 40, section: "cabinet" },
  { label: "Light rail", code: "LR", category: "Trim", supplier: "Other Mill", qty: 1, unitPrice: 15, lineTotal: 15, section: "other" },
];

describe("kitchen packages", () => {
  it("auto-sums, then applies an override or a discount", () => {
    expect(resolvePackagePrice({ lineItems: lines })).toEqual({ autoSum: 255, finalPrice: 255 });
    expect(resolvePackagePrice({ lineItems: lines, override: 199 }).finalPrice).toBe(199);
    expect(resolvePackagePrice({ lineItems: lines, discount: 55 }).finalPrice).toBe(200);
  });

  it("warns when the live catalog total no longer matches the snapshot", () => {
    expect(packagePricesChanged(255, 255)).toBe(false);
    expect(packagePricesChanged(255, 260)).toBe(true);
  });

  it("copies a design into a package and leaves the source design alone", () => {
    const plan = planKitchenPackageCopy({
      sourceDesignId: 12,
      snapshot: { placed: [{ id: "a" }] },
      lineItems: lines,
      price: resolvePackagePrice({ lineItems: lines, discount: 5 }),
      affiliateId: 7,
      name: "White shaker",
    });
    expect(plan.updatesSourceDesign).toBe(false);
    expect(plan.movesSourceDesign).toBe(false);
    expect(plan.bundle.sourceDesignId).toBe(12);
    expect(plan.bundle.homeownerPrice).toBe("250.00");
    expect(plan.bundle.bomSnapshotTotal).toBe("255.00");
    expect(plan.bundle.lineItemsJson).toHaveLength(3);
  });

  it("shows a package only on its own storefront", () => {
    expect(packageVisibleOnStore(7, 7)).toBe(true);
    expect(packageVisibleOnStore(7, 8)).toBe(false);
    expect(packageVisibleOnStore(7, null)).toBe(false);
    expect(packageVisibleOnStore(null, null)).toBe(true);
  });

  it("keeps each supplier's trim on its own line", () => {
    expect(packageLinesKeepSupplierTrim(lines)).toBe(true);
    expect(lines.filter((item) => item.category === "Trim").map((item) => item.supplier)).toEqual(["Pelican", "Other Mill"]);
  });

  it("lets an owner or designer publish only on their store", () => {
    const access = { affiliateId: 7, isOwner: false, accessDesigner: true };
    expect(decidePackageAccess({ role: "user", access, requestedAffiliateId: 7 })).toEqual({ ok: true, affiliateId: 7 });
    expect(decidePackageAccess({ role: "user", access, requestedAffiliateId: 9 }).ok).toBe(false);
    expect(decidePackageAccess({ role: "user", access: { ...access, accessDesigner: false }, requestedAffiliateId: 7 }).ok).toBe(false);
    expect(decidePackageAccess({ role: "admin", access: null, requestedAffiliateId: null })).toEqual({ ok: true, affiliateId: null });
  });
});
