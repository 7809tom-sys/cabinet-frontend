import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cartContext = readFileSync(new URL("../contexts/CartContext.tsx", import.meta.url), "utf8");
const preferredContext = readFileSync(new URL("../contexts/PreferredProductsContext.tsx", import.meta.url), "utf8");
const designTool = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
const presentation = readFileSync(new URL("../pages/DesignPresentation.tsx", import.meta.url), "utf8");
const cart = readFileSync(new URL("../pages/Cart.tsx", import.meta.url), "utf8");
const orderBuilder = readFileSync(new URL("../pages/OrderBuilder.tsx", import.meta.url), "utf8");
const orderReview = readFileSync(new URL("../components/order/OrderReview.tsx", import.meta.url), "utf8");
const topNav = readFileSync(new URL("../components/TopNav.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const storefrontShop = readFileSync(new URL("../components/storefront/StorefrontShop.tsx", import.meta.url), "utf8");
const dashboardLayout = readFileSync(new URL("../components/affiliate/AffiliateDashboardLayout.tsx", import.meta.url), "utf8");

describe("store-scope persistence contract", () => {
  it("remounts cart and Preferred providers into scoped storage buckets", () => {
    expect(cartContext).toContain("cartStorageKeys(scope)");
    expect(cartContext).toContain("<ScopedCartProvider key={scope} scope={scope}>");
    expect(cartContext).toContain("sessionStorage.getItem(keys.sourceDesign)");
    expect(preferredContext).toContain("scopedBrowserStorageKey(STORAGE_KEY, scope)");
    expect(preferredContext).toContain("<ScopedPreferredProductsProvider key={scope} scope={scope}>");
  });

  it("uses v2 Designer keys with an immutable origin scope and owner-only v1 migration", () => {
    expect(designTool).toContain("designerDraftStorageKey(storeScope, verifiedEmail)");
    expect(designTool).toContain("originScope: storeScope");
    expect(designTool).toContain("d.v === 2 && d.originScope === storeScope");
    expect(designTool).toContain("migrateLegacyDesignerDraftToOwner(localStorage, verifiedEmail)");
	  expect(designTool).toContain("if (loadDesignId != null || bundleIdParam != null)");
	  expect(designTool).toContain("crmDealId: crmDealId ?? undefined");
    expect(presentation).toContain("parsed.v === 2 && parsed.originScope === scope");
    expect(presentation).not.toContain('startsWith("cabinet-dealz:designer-draft:v1:")');
  });

	it("scopes checkout handoff and never derives current branding from an old cart", () => {
    expect(cart).toContain("cartPrefillStorageKey(storeScope)");
    expect(orderBuilder).toContain("cartPrefillStorageKey(storeScope)");
    expect(orderReview).toContain("affiliateSlugForStoreScope(storeScope)");
    expect(topNav).not.toContain('localStorage.getItem("cd_cart_slug_v1")');
    expect(app).not.toContain('localStorage.getItem("cd_cart_slug_v1")');
	  expect(storefrontShop).toContain('slug ? `/store/${slug}/order` : "/order/new"');
	});

	it("keeps affiliate dashboard and customer-shell navigation inside the affiliate scope", () => {
		expect(dashboardLayout).toContain("affiliateCatalogPath(storeSlug)");
		expect(dashboardLayout).toContain("affiliateDesignerPath(storeSlug)");
		expect(dashboardLayout).toContain("affiliateOrderPath(storeSlug)");
		expect(app).toContain("affiliateCatalogPath(slug)");
		expect(app).toContain("affiliateDesignerPath(slug)");
		expect(app).toContain("affiliateOrderPath(slug)");
	});
});
