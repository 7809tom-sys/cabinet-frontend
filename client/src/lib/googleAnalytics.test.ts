// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureGoogleAnalytics,
  sendGoogleAnalyticsPageView,
} from "./googleAnalytics";

describe("Google Analytics browser loader", () => {
  afterEach(() => {
    document.querySelectorAll("script[data-cabinet-dealz-ga4]").forEach((element) => element.remove());
    delete (window as Window & { dataLayer?: unknown[] }).dataLayer;
    delete (window as Window & { gtag?: unknown }).gtag;
    vi.restoreAllMocks();
  });

  it("installs one asynchronous Google tag and configures it without an automatic duplicate page view", () => {
    const gtag = vi.fn();
    (window as Window & { gtag?: typeof gtag }).gtag = gtag;

    expect(configureGoogleAnalytics("g-PSW1MY7HB4", "www.cabinetdealz.com")).toBe(true);
    expect(configureGoogleAnalytics("G-PSW1MY7HB4", "www.cabinetdealz.com")).toBe(true);

    const tags = document.querySelectorAll<HTMLScriptElement>("script[data-cabinet-dealz-ga4='G-PSW1MY7HB4']");
    expect(tags).toHaveLength(1);
    expect(tags[0].src).toContain("https://www.googletagmanager.com/gtag/js?id=G-PSW1MY7HB4");
    expect(tags[0].async).toBe(true);
    expect(gtag).toHaveBeenCalledWith("config", "G-PSW1MY7HB4", { send_page_view: false });
  });

  it("does not load Google Analytics on local or temporary Manus preview hosts", () => {
    const gtag = vi.fn();
    (window as Window & { gtag?: typeof gtag }).gtag = gtag;

    expect(configureGoogleAnalytics("G-PSW1MY7HB4", "localhost")).toBe(false);
    expect(configureGoogleAnalytics("G-PSW1MY7HB4", "3000-example.manus.computer")).toBe(false);
    expect(document.querySelector("script[data-cabinet-dealz-ga4]")).toBeNull();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("sends the route, page title, and storefront hostname on SPA navigation", () => {
    const gtag = vi.fn();
    (window as Window & { gtag?: typeof gtag }).gtag = gtag;
    document.title = "Cabinet Dealz | Demo Store";

    expect(sendGoogleAnalyticsPageView({
      measurementId: "G-PSW1MY7HB4",
      hostname: "sales-demo.cabinetdealz.com",
      pathname: "/store/demo/catalog",
      search: "?finish=white",
      origin: "https://sales-demo.cabinetdealz.com",
      title: document.title,
    })).toBe(true);

    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_location: "https://sales-demo.cabinetdealz.com/store/demo/catalog?finish=white",
      page_path: "/store/demo/catalog?finish=white",
      page_title: "Cabinet Dealz | Demo Store",
      site_hostname: "sales-demo.cabinetdealz.com",
    });
  });
});
