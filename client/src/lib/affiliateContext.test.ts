import { describe, expect, it } from "vitest";
import {
  OWNER_STORE_SCOPE,
  affiliateSlugForStoreScope,
  affiliateSlugFromHostname,
  affiliateStorefrontFallbackPath,
  designerDraftStorageKey,
  legacyDesignerDraftStorageKey,
  migrateLegacyDesignerDraftToOwner,
  resolveStoreScope,
  scopedBrowserStorageKey,
} from "./affiliateContext";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("affiliate custom-domain client fallback", () => {
  it("derives the branded slug from the single-level public host", () => {
    expect(affiliateSlugFromHostname("reaves-way-cabinet-shop.cabinetdealz.com")).toBe("reaves-way-cabinet-shop");
    expect(affiliateSlugFromHostname("www.cabinetdealz.com")).toBeNull();
    expect(affiliateSlugFromHostname("nested.reaves-way-cabinet-shop.cabinetdealz.com")).toBeNull();
  });

	  it("rewrites a transparent-proxy cabinet detail visit into the affiliate route while preserving the query", () => {
	    expect(affiliateStorefrontFallbackPath(
	      "/catalog/W-12-30",
      "reaves-way-cabinet-shop.cabinetdealz.com",
      "?style=330005&cabinetId=9360055",
    )).toBe("/store/reaves-way-cabinet-shop/catalog/W-12-30?style=330005&cabinetId=9360055");
	    expect(affiliateStorefrontFallbackPath("/store/reaves-way-cabinet-shop/catalog/W-12-30", "reaves-way-cabinet-shop.cabinetdealz.com")).toBeNull();
	  });

	  it("never rewrites affiliate or platform administration into the public storefront route tree", () => {
	    const host = "reaves-way-cabinet-shop.cabinetdealz.com";
	    expect(affiliateStorefrontFallbackPath("/affiliate", host, "?viewAs=5730001")).toBeNull();
	    expect(affiliateStorefrontFallbackPath("/admin", host, "?tab=affiliates&affiliateId=5730001")).toBeNull();
	  });
});

describe("store scope resolution", () => {
  it("uses storefront path before query and otherwise resolves owner", () => {
    expect(resolveStoreScope({ pathname: "/store/reaves-way-cabinet-shop/design", search: "?affiliate=other", hostname: "www.cabinetdealz.com" })).toBe("reaves-way-cabinet-shop");
	  expect(resolveStoreScope({ pathname: "/store-preview/reaves-way-cabinet-shop", search: "", hostname: "www.cabinetdealz.com" })).toBe("reaves-way-cabinet-shop");
    expect(resolveStoreScope({ pathname: "/design", search: "?affiliate=Reaves-Way-Cabinet-Shop", hostname: "www.cabinetdealz.com" })).toBe("reaves-way-cabinet-shop");
    expect(resolveStoreScope({ pathname: "/design", search: "", hostname: "www.cabinetdealz.com" })).toBe(OWNER_STORE_SCOPE);
    expect(affiliateSlugForStoreScope(OWNER_STORE_SCOPE)).toBeNull();
  });

  it("creates distinct owner and affiliate storage buckets", () => {
    expect(scopedBrowserStorageKey("cd_cart_v1", "owner")).toBe("cd_cart_v1:owner");
    expect(scopedBrowserStorageKey("cd_cart_v1", "reaves-way-cabinet-shop")).toBe("cd_cart_v1:reaves-way-cabinet-shop");
    expect(designerDraftStorageKey("owner", "CUSTOMER@EXAMPLE.COM ")).toBe("cabinet-dealz:designer-draft:v2:owner:customer@example.com");
    expect(designerDraftStorageKey("reaves-way-cabinet-shop", "customer@example.com")).toBe("cabinet-dealz:designer-draft:v2:reaves-way-cabinet-shop:customer@example.com");
  });
});

describe("legacy Designer draft migration", () => {
  it("moves a v1 draft only to owner, stamps origin, and deletes the source", () => {
    const storage = new MemoryStorage();
    const legacyKey = legacyDesignerDraftStorageKey("customer@example.com");
    storage.setItem(legacyKey, JSON.stringify({ v: 1, placed: [{ uid: "cab-1" }] }));

    expect(migrateLegacyDesignerDraftToOwner(storage, "customer@example.com")).toEqual({ migrated: true, removedLegacy: true });
    const owner = JSON.parse(storage.getItem(designerDraftStorageKey("owner", "customer@example.com"))!);
    expect(owner).toMatchObject({ v: 2, originScope: "owner", placed: [{ uid: "cab-1" }] });
    expect(storage.getItem(legacyKey)).toBeNull();
    expect(storage.getItem(designerDraftStorageKey("reaves-way-cabinet-shop", "customer@example.com"))).toBeNull();
  });

  it("never overwrites a newer owner v2 draft and remains idempotent", () => {
    const storage = new MemoryStorage();
    const ownerKey = designerDraftStorageKey("owner", "guest");
    storage.setItem(ownerKey, JSON.stringify({ v: 2, originScope: "owner", savedAt: 20 }));
    storage.setItem(legacyDesignerDraftStorageKey("guest"), JSON.stringify({ v: 1, savedAt: 10 }));

    expect(migrateLegacyDesignerDraftToOwner(storage, "guest")).toEqual({ migrated: false, removedLegacy: true });
    expect(JSON.parse(storage.getItem(ownerKey)!)).toMatchObject({ savedAt: 20 });
    expect(migrateLegacyDesignerDraftToOwner(storage, "guest")).toEqual({ migrated: false, removedLegacy: false });
  });
});
