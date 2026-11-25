// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { storefrontSlugFromPathname, useWhiteLabelHead } from "./useWhiteLabelHead";

const indexHtml = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
const platformHead = indexHtml.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? "";

const attr = (selector: string, name: string) => document.head.querySelector(selector)?.getAttribute(name) ?? null;

beforeEach(() => {
  document.head.innerHTML = platformHead;
  document.title = "CabinetDealz — Professional Cabinet Platform";
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  document.head.innerHTML = "";
});

describe("useWhiteLabelHead home-screen install", () => {
  it("points the manifest, PNG touch icon, and iOS title at the storefront, then restores the platform", () => {
    window.history.replaceState(null, "", "/store/reaves-way-cabinet-shop/design");
    const { unmount } = renderHook(() => useWhiteLabelHead({
      storeName: "Reaves Way Cabinet Shop",
      tagline: "Cabinets designed for your home",
      logoUrl: "/manus-storage/affiliate-logo/reaves.png",
      faviconUrl: "/manus-storage/affiliate-favicon/reaves.svg",
    }));

    expect(attr('link[rel="manifest"]', "href")).toBe("/store/reaves-way-cabinet-shop/manifest.webmanifest");
    expect(attr('link[rel="apple-touch-icon"]', "href")).toBe("/store/reaves-way-cabinet-shop/app-icon-180.png");
    expect(attr('link[rel="apple-touch-icon"]', "sizes")).toBe("180x180");
    expect(attr('meta[name="apple-mobile-web-app-title"]', "content")).toBe("Reaves Way Cabinet Shop");
    expect(attr('link[rel="icon"]', "href")).toBe("/manus-storage/affiliate-favicon/reaves.svg");
    expect(document.title).toBe("Reaves Way Cabinet Shop — Cabinets designed for your home");
    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);

    unmount();
    expect(attr('link[rel="manifest"]', "href")).toBe("/manifest.json");
    expect(attr('link[rel="apple-touch-icon"]', "href")).toBe("/apple-touch-icon.png");
    expect(attr('meta[name="apple-mobile-web-app-title"]', "content")).toBe("CabinetDealz");
    expect(attr('link[rel="icon"]', "href")).toBe("/favicon.svg");
    expect(attr('link[rel="icon"]', "type")).toBe("image/svg+xml");
    expect(document.title).toBe("CabinetDealz — Professional Cabinet Platform");
  });

  it("adds the store manifest when the server shell has none and removes it on unmount", () => {
    document.head.querySelector('link[rel="manifest"]')?.remove();
    const { unmount } = renderHook(() => useWhiteLabelHead({ storeName: "Oak & Iron.", slug: "oak-and-iron" }));
    expect(attr('link[rel="manifest"]', "href")).toBe("/store/oak-and-iron/manifest.webmanifest");
    expect(attr('meta[name="apple-mobile-web-app-title"]', "content")).toBe("Oak & Iron");
    unmount();
    expect(document.head.querySelector('link[rel="manifest"]')).toBeNull();
  });

  it("leaves the platform manifest alone on the main site", () => {
    renderHook(() => useWhiteLabelHead({ storeName: null }));
    expect(attr('link[rel="manifest"]', "href")).toBe("/manifest.json");
    expect(attr('meta[name="apple-mobile-web-app-title"]', "content")).toBe("CabinetDealz");
  });

  it("only treats real storefront routes as installable stores", () => {
    expect(storefrontSlugFromPathname("/store/reaves-way-cabinet-shop")).toBe("reaves-way-cabinet-shop");
    expect(storefrontSlugFromPathname("/store/reaves-way-cabinet-shop/cart")).toBe("reaves-way-cabinet-shop");
    expect(storefrontSlugFromPathname("/store-preview/classic")).toBeNull();
    expect(storefrontSlugFromPathname("/design")).toBeNull();
  });
});
