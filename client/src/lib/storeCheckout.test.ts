import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkoutPrefillState, storeCartPath, storeCheckoutPath } from "./storeCheckout";

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("affiliate store checkout path", () => {
  it("builds the store checkout and cart paths", () => {
    expect(storeCheckoutPath("cabinetman66")).toBe("/store/cabinetman66/checkout");
    expect(storeCheckoutPath("a b")).toBe("/store/a%20b/checkout");
    expect(storeCartPath("cabinetman66")).toBe("/store/cabinetman66/cart");
    expect(storeCartPath(null)).toBe("/cart");
  });

  it("routes /store/:slug/checkout to the checkout step instead of a 404", () => {
    const app = source("client/src/App.tsx");
    const at = app.indexOf('<Route path="/store/:slug/checkout">');
    expect(at).toBeGreaterThan(-1);
    expect(app.slice(at, at + 400)).toContain("<OrderBuilder checkout />");
    // The quote tool and the payment return pages keep their own routes.
    expect(app).toContain('path="/store/:slug/order"');
    expect(app).toContain('path="/store/:slug/checkout/success"');
    expect(app).toContain('path="/store/:slug/checkout/cancelled"');
  });

  it("sends an affiliate cart to the store checkout, not the Build an Order tool", () => {
    const cart = source("client/src/pages/Cart.tsx");
    expect(cart).toContain('navigate(currentAffiliateSlug ? storeCheckoutPath(currentAffiliateSlug) : "/order/new")');
    expect(cart).not.toContain("`/store/${currentAffiliateSlug}/order`");
  });
});

describe("checkout page state before review", () => {
  it("never shows the code-entry tools while a cart hand-off is loading or failed", () => {
    expect(checkoutPrefillState({ hasPrefill: true, pending: false, failed: false, lineCount: 0 })).toBe("loading");
    expect(checkoutPrefillState({ hasPrefill: true, pending: true, failed: false, lineCount: 0 })).toBe("loading");
    expect(checkoutPrefillState({ hasPrefill: true, pending: false, failed: true, lineCount: 0 })).toBe("error");
    expect(checkoutPrefillState({ hasPrefill: false, pending: false, failed: false, lineCount: 0 })).toBe("empty");
    expect(checkoutPrefillState({ hasPrefill: false, pending: false, failed: false, lineCount: 1 })).toBe("ready");
  });

  it("keeps the cart hand-off until its lines are matched and hides the tabs in checkout", () => {
    const builder = source("client/src/pages/OrderBuilder.tsx");
    const load = builder.slice(builder.indexOf("const loadPrefill"), builder.indexOf("useEffect(() => {\n    if (prefillConsumed.current)"));
    expect(load).not.toMatch(/getItem\(prefillKey\);\s*if \(raw\) sessionStorage\.removeItem/);
    expect(load).toContain("if (!checkout) dropPrefill();");
    expect(builder).toContain("resolveCheckoutHandoff");
    expect(builder).toContain("if (!checkout && affiliateSlugForStoreScope(storeScope)) return;");
    expect(builder).toContain("{!checkout && !hasLines && (");
    expect(builder).toContain('{checkout ? "Checkout" : t("ob_title")}');
  });

  it("does not let the cart continue button submit the page back onto itself", () => {
    const cart = source("client/src/pages/Cart.tsx");
    const checkoutStart = cart.indexOf("onClick={requestOrder}");
    const buttonStart = cart.lastIndexOf("<Button", checkoutStart);
    expect(cart.slice(buttonStart, checkoutStart)).toContain('type="button"');
    expect(cart).toContain("persistCheckoutHandoff");
    expect(cart).toContain('browserStorage("local")');
  });
});
