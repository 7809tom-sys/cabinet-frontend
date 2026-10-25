import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("./components/TopNav.tsx", import.meta.url), "utf8");
const footerSource = readFileSync(new URL("./components/SiteFooter.tsx", import.meta.url), "utf8");

describe("public navigation and update notification", () => {
  it("keeps the deployed-version notice persistent and dismissible until a user chooses to refresh", () => {
    expect(appSource).toContain("duration: Infinity");
    expect(appSource).toContain('cancel: { label: "Later", onClick: () => undefined }');
    expect(appSource).toContain('action: { label: "Refresh now", onClick: onReload }');
  });

  it("registers the About page and exposes a working navigation route", () => {
    expect(appSource).toContain('const About = lazy(() => import("@/pages/About"))');
    expect(appSource).toContain('<Route path="/about">');
    expect(footerSource).toContain('{ label: "About Cabinet Dealz", href: "/about" }');
  });

  it("exposes a public vendor and supplier application route in the footer", () => {
    expect(footerSource).toContain('{ label: "Become a Vendor / Supplier", href: "/become-a-vendor" }');
    expect(appSource).toContain('<Route path="/become-a-vendor">');
  });

  it("redirects the legacy distributor address to the selected unified supplier portal", () => {
    expect(appSource).toContain("function DistributorPortalRedirect()");
    expect(appSource).toContain('window.location.replace("/vendor?as=210001")');
    expect(appSource).toContain('<Route path="/distributor">');
    expect(appSource).toContain("<DistributorPortalRedirect />");
    expect(appSource).toContain("Vendor Portal continues to enforce administrator-only `?as=`");
  });

  it("keeps the affiliate catalog-root URL inside the branded storefront", () => {
    expect(appSource).toContain('<Route path="/store/:slug/catalog">');
    expect(appSource).toContain('<Storefront slug={params.slug} focusShop />');
  });

	  it("returns affiliate owners from unscoped platform pages to their own administration page", () => {
	    expect(appSource).toContain("function AffiliateOwnerScopeGuard");
	    expect(appSource).toContain('user?.role === "admin"');
	    expect(appSource).toContain("affiliateOwnerScopeDestination");
	    expect(appSource).toContain("affiliateId: affiliate.id");
	    expect(appSource).toContain("if (destination) window.location.replace(destination)");
	  });

	  it("repairs legacy storefront-prefixed management URLs before they can show a 404", () => {
	    expect(appSource).toContain('function AffiliateManagementAliasRedirect');
	    expect(appSource).toContain('<Route path="/store/:slug/affiliate">');
	    expect(appSource).toContain('<AffiliateManagementAliasRedirect target="/affiliate" />');
	    expect(appSource).toContain('<Route path="/store/:slug/admin">');
	  });

  it("renders the branded subdomain sign-in rewrite instead of a 404", () => {
    expect(appSource).toContain('<Route path="/store/:slug/signin">');
    expect(appSource).toContain("<AffiliateShell slug={params.slug}>");
    expect(appSource).toContain("<SignIn />");
  });

	  it("keeps the affiliate shell's catalog, designer, quote, and cart links scoped", () => {
    expect(appSource).toContain("affiliateCatalogPath(slug)");
    expect(appSource).toContain("affiliateDesignerPath(slug)");
    expect(appSource).toContain("affiliateOrderPath(slug)");
    expect(appSource).toContain('href={`/store/${slug}/cart`}');
  });

  it("uses the compact navigation before the header can overflow at standard desktop widths", () => {
    expect(topNavSource).toContain('className="hidden xl:flex items-center gap-0"');
    expect(topNavSource).toContain('className="xl:hidden"');
    expect(topNavSource).toContain('className="xl:hidden border-t border-border bg-background slide-up"');
  });
});
