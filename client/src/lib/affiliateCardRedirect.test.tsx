// @vitest-environment jsdom
import { useEffect } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AFFILIATE_CARD_ROOT,
  affiliateCardPath,
  affiliateStorefrontPath,
  affiliateOwnerScopeDestination,
} from "./affiliateStorefrontUrl";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

/** Mirror of the redirect component in App.tsx, which is not exported. */
function AffiliateCardRedirect({ slug }: { slug: string }) {
  useEffect(() => {
    window.location.replace(affiliateStorefrontPath(slug));
  }, [slug]);
  return <div data-testid="card-redirect-pending" />;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("legacy digital business card address", () => {
  it("builds the legacy /card/<slug> address for printed links", () => {
    expect(AFFILIATE_CARD_ROOT).toBe("/card");
    expect(affiliateCardPath("FirstClass")).toBe("/card/firstclass");
    expect(affiliateCardPath(" reaves-way-cabinet-shop ")).toBe("/card/reaves-way-cabinet-shop");
  });

  it("redirects a card visit to the canonical routed storefront", () => {
    const replace = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, origin: "https://www.cabinetdealz.com", replace },
    });

    render(<AffiliateCardRedirect slug="firstclass" />);

    expect(replace).toHaveBeenCalledWith("/store/firstclass");
    expect(screen.getByTestId("card-redirect-pending")).toBeTruthy();

    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("does not bounce an affiliate owner away from a shared training guide", () => {
    const affiliate = { affiliateId: 5730001, slug: "reaves-way-cabinet-shop" };
    expect(affiliateOwnerScopeDestination({
      pathname: "/affiliate/guide/10-steps-to-a-sale",
      search: "",
      ...affiliate,
    })).toBeNull();
    expect(affiliateOwnerScopeDestination({
      pathname: "/affiliate/guide/does-not-exist",
      search: "",
      ...affiliate,
    })).toBeNull();
    // Management sections still return the owner to their own record.
    expect(affiliateOwnerScopeDestination({
      pathname: "/affiliate",
      search: "?section=marketing",
      ...affiliate,
    })).toBe("/affiliate?viewAs=5730001&section=marketing");
  });
});

describe("route registration", () => {
  it("registers both dead-link repairs before the catch-all 404", () => {
    const guideRoute = appSource.indexOf('<Route path="/affiliate/guide/:slug">');
    const cardRoute = appSource.indexOf('<Route path="/card/:slug">');
    const notFoundRoute = appSource.lastIndexOf("<Route>");
    expect(guideRoute).toBeGreaterThan(-1);
    expect(cardRoute).toBeGreaterThan(-1);
    expect(guideRoute).toBeLessThan(notFoundRoute);
    expect(cardRoute).toBeLessThan(notFoundRoute);
  });
});
