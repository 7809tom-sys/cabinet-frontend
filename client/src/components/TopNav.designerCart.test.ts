import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./TopNav.tsx", import.meta.url), "utf8");

describe("TopNav mobile Designer cart", () => {
	it("uses self-explanatory affiliate and account labels beside the Admin button", () => {
	  expect(source).toContain('title="Manage this affiliate storefront"');
	  expect(source).toContain("Affiliate Portal");
	  expect(source).toContain('title="Manage your personal sign-in and profile"');
	  expect(source).toContain("My Account");
	});

  it("opens the in-page Designer cart with its drawing count on mobile while retaining the normal site cart elsewhere", () => {
    expect(source).toContain('const isDesignerMobile = useIsMobile(1024) && location.startsWith("/design")');
    expect(source).toContain("subscribeDesignerMobileCartCount(setDesignCartCount)");
    expect(source).toContain("requestDesignerMobileCartOpen()");
    expect(source).toContain('aria-label="Open Designer cart"');
    expect(source).toContain('<Link href="/cart" aria-label={t("nav_cart")}>');
  });
});
