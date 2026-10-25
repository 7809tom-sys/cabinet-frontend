import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cartPathForStoreScope, isAffiliateStorefrontPath, affiliateSlugFromHostname, affiliateSlugFromPath } from "./affiliateContext";
import { buildSheetCsv, type BuildSheetArgs } from "@/components/design/DesignActions";

const ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("affiliate storefront context detection", () => {
  it("recognizes storefront paths (subdomains are rewritten to /store/:slug)", () => {
    expect(isAffiliateStorefrontPath("/store/reaves-way-cabinet-shop")).toBe(true);
    expect(isAffiliateStorefrontPath("/store/firstclass/cart")).toBe(true);
    expect(isAffiliateStorefrontPath("/store-preview/classic")).toBe(true);
  });

  it("does not treat platform pages as storefront pages", () => {
    expect(isAffiliateStorefrontPath("/")).toBe(false);
    expect(isAffiliateStorefrontPath("/catalog")).toBe(false);
    expect(isAffiliateStorefrontPath("/affiliate")).toBe(false);
    // guard against a naive "includes" style check
    expect(isAffiliateStorefrontPath("/admin/stores")).toBe(false);
  });

  it("extracts the slug from a storefront path", () => {
    expect(affiliateSlugFromPath("/store/reaves-way-cabinet-shop")).toBe("reaves-way-cabinet-shop");
    expect(affiliateSlugFromPath("/store/firstclass/cart")).toBe("firstclass");
    expect(affiliateSlugFromPath("/catalog")).toBeNull();
  });

  it("extracts an affiliate slug from a direct custom-domain commerce visit", () => {
    expect(affiliateSlugFromHostname("reaves-way-cabinet-shop.cabinetdealz.com")).toBe("reaves-way-cabinet-shop");
    expect(affiliateSlugFromHostname("www.cabinetdealz.com")).toBeNull();
  });

  it("keeps Designer cart handoffs in the active affiliate storefront", () => {
    expect(cartPathForStoreScope("reaves-way-cabinet-shop")).toBe("/store/reaves-way-cabinet-shop/cart");
    expect(cartPathForStoreScope("owner")).toBe("/cart");
  });
});

describe("no platform branding leaks on the affiliate storefront", () => {
  it("the chat widget is suppressed on storefront routes", () => {
    const src = read("client/src/components/ChatWidget.tsx");
    // The widget must bail out when in affiliate context.
    expect(src).toMatch(/isAffiliateStorefrontPath/);
    expect(src).toMatch(/if \(isAffiliateStore \|\|/);
  });

  it('the storefront footer no longer renders "Powered by Cabinet Dealz"', () => {
    const src = read("client/src/pages/Storefront.tsx");
    expect(src).not.toMatch(/footer_powered/);
  });

  it("the storefront white-labels the document head", () => {
    const src = read("client/src/pages/Storefront.tsx");
    expect(src).toMatch(/useWhiteLabelHead/);
  });

  it("the storefront source contains no hardcoded platform name", () => {
    const src = read("client/src/pages/Storefront.tsx");
    expect(src).not.toMatch(/Cabinet\s?Dealz/i);
  });

  it("the affiliate shell (cart/order/design) white-labels the head too", () => {
    const src = read("client/src/App.tsx");
    expect(src).toMatch(/useWhiteLabelHead\(\{\s*storeName: data\?\.storeName/);
  });

  it("direct affiliate-host cart visits select the affiliate shell before the central layout", () => {
    const src = read("client/src/App.tsx");
    expect(src).toMatch(/affiliateSlugForStoreScope\(resolveStoreScope\(\{/);
    expect(src).toMatch(/hostname: window\.location\.hostname/);
    expect(src).toMatch(/<AffiliateShell slug=\{slug\}/);
  });

  it("does not wrap the affiliate dashboard in the central TopNav layout", () => {
    const src = read("client/src/App.tsx");
    expect(src).toMatch(/<Route path="\/affiliate">\s*<Suspense fallback=\{<PageLoader \/>\}>\s*<AffiliateDashboard \/>/);
  });
});

describe("build sheet export is white-labeled", () => {
  const base: BuildSheetArgs = {
    room: { width: 120, depth: 96 },
    styleName: "Shaker Antique White",
    tier: "Homeowner",
    total: 1000,
    extraLines: [],
    buildRows: [
      {
        code: "B15",
        description: '15" Base Cabinet',
        qty: 1,
        unitPrice: 100,
        placement: "base",
      } as BuildSheetArgs["buildRows"][number],
    ],
  };

  it("uses the affiliate's store name in the header when provided", () => {
    const csv = buildSheetCsv({ ...base, brandName: "Reaves Way Cabinet Shop" })!;
    expect(csv.split("\n")[0]).toBe("Reaves Way Cabinet Shop Build Sheet");
    expect(csv).not.toMatch(/Cabinet Dealz/);
  });

  it("falls back to the platform name only when no brand is supplied", () => {
    const csv = buildSheetCsv(base)!;
    expect(csv.split("\n")[0]).toBe("Cabinet Dealz Build Sheet");
  });

  it("ignores a blank brand name", () => {
    const csv = buildSheetCsv({ ...base, brandName: "   " })!;
    expect(csv.split("\n")[0]).toBe("Cabinet Dealz Build Sheet");
  });
});

describe("plugins panel points to third-party stores only", () => {
  const src = read("client/src/components/affiliate/AffiliatePluginsPanel.tsx");

  it("links out to external plugin stores", () => {
    expect(src).toMatch(/elfsight\.com/);
    expect(src).toMatch(/powr\.io/);
    expect(src).toMatch(/target="_blank"/);
  });

  it("opens external links safely", () => {
    expect(src).toMatch(/rel="noreferrer noopener"/);
  });

  it("excludes incompatible ecosystems", () => {
    // We must not send affiliates to plugin stores that cannot run on this stack.
    expect(src).not.toMatch(/wordpress\.org\/plugins/);
    expect(src).not.toMatch(/apps\.shopify\.com/);
  });
});
