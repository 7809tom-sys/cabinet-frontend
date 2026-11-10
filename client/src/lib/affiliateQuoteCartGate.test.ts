import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("cart and quote request routes", () => {
  const app = source("client/src/App.tsx");
  const hook = source("client/src/lib/useAffiliateFeaturePublish.ts");

  it("renders the affiliate cart and both quote routes without a publish gate", () => {
    expect(app).toContain('path="/store/:slug/cart"');
    expect(app).toContain("<Cart />");
    expect(app).toContain('path="/store/:slug/order"');
    expect(app).toContain('path="/store/:slug/order/new"');
    expect(app).toContain("<OrderBuilder />");
    expect(app).not.toContain('feature="quote"');
    expect(app).toContain('feature="closet_studio"');
    expect(app).toContain('feature="kitchen_packages"');
    expect(app).toContain('feature="pelican_catalog"');
    expect(app).toContain('feature="hardware_catalog"');
  });

  it("asks for the publish list only from an admin and treats a permission refusal as unavailable", () => {
    expect(hook).toContain('const canReadPublishList = role === "admin"');
    expect(hook).toContain("enabled: canReadPublishList");
    expect(hook).toContain("affiliatePublishListStatus");
    expect(hook).toContain('code === "FORBIDDEN" || code === "UNAUTHORIZED"');
  });
});

describe("docs/patches/cabinet-backend-quote-cart-always-open.patch", () => {
  const patch = source("docs/patches/cabinet-backend-quote-cart-always-open.patch");

  it("removes the quote publish guard from cart pricing and quote submission", () => {
    const ordersHunk = patch.slice(
      patch.indexOf("diff --git a/server/routers/orders.ts"),
      patch.indexOf("diff --git a/server/routers/orders.quoteAlwaysOpen.test.ts"),
    );
    expect(ordersHunk).toContain('-import { guardAffiliateFeature } from "../lib/affiliateFeaturePublish";');
    expect(ordersHunk).toContain('-      await guardAffiliateFeature(db, { role: ctx.user?.role, slug: input.affiliateSlug, feature: "quote" });');
    expect(ordersHunk).toContain('-        await guardAffiliateFeature(db, { role: ctx.user?.role, slug: scopeSlug, feature: "quote" });');
    expect(ordersHunk).not.toMatch(/^\+.*guardAffiliateFeature/m);
    expect(patch).toContain('expect(orders).not.toContain(\'feature: "quote"\')');
  });
});
