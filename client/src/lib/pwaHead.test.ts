import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("web app manifest and install icons", () => {
  it("links the manifest, PNG apple-touch-icon, and apple web-app meta tags from index.html", () => {
    const html = read("client/index.html");
    expect(html).toContain('<link rel="manifest" href="/manifest.json" />');
    expect(html).toContain('href="/apple-touch-icon.png"');
    expect(html).toContain('sizes="180x180"');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="CabinetDealz" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
    expect(html).toContain("viewport-fit=cover");
    expect(html).not.toContain('href="/favicon.svg" sizes');
  });

  it("ships 192, 512, and maskable PNG icons plus a 180 apple-touch-icon", () => {
    const manifest = JSON.parse(read("client/public/manifest.json"));
    const sources = manifest.icons.map((icon: { src: string }) => icon.src);
    expect(sources).toEqual(expect.arrayContaining([
      "/android-chrome-192x192.png",
      "/android-chrome-512x512.png",
      "/android-chrome-512x512-maskable.png",
    ]));
    const maskable = manifest.icons.find((icon: { purpose?: string }) => icon.purpose === "maskable");
    expect(maskable?.src).toBe("/android-chrome-512x512-maskable.png");
    expect(maskable?.sizes).toBe("512x512");

    const files = [
      "client/public/apple-touch-icon.png",
      "client/public/android-chrome-192x192.png",
      "client/public/android-chrome-512x512.png",
      "client/public/android-chrome-512x512-maskable.png",
    ];
    for (const file of files) {
      expect(existsSync(resolve(root, file)), file).toBe(true);
      expect(statSync(resolve(root, file)).size).toBeGreaterThan(1000);
    }
  });
});

describe("affiliate storefront home-screen install", () => {
  it("keeps the platform manifest static and named CabinetDealz for the main site", () => {
    const manifest = JSON.parse(read("client/public/manifest.json"));
    expect(manifest.name).toBe("CabinetDealz");
    expect(manifest.short_name).toBe("CabinetDealz");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("routes each storefront's manifest and icons to the backend, including from a store subdomain", () => {
    const vercel = JSON.parse(read("vercel.json")) as {
      redirects: Array<{ source: string; destination: string; has?: unknown[] }>;
      rewrites: Array<{ source: string; destination: string }>;
    };
    // /store/:slug/manifest.webmanifest and /store/:slug/app-icon-*.png reach
    // the backend, which serves them before the HTML shell.
    const storeRewrite = vercel.rewrites.find((rule) => rule.source === "/store/:path*");
    expect(storeRewrite?.destination).toMatch(/\/_shell\/store\/:path\*$/);
    const storeIndex = vercel.rewrites.indexOf(storeRewrite!);
    const spaIndex = vercel.rewrites.findIndex((rule) => rule.destination === "/index.html");
    expect(storeIndex).toBeLessThan(spaIndex);

    // A subdomain visit lands on /store/:slug, inside the manifest scope, and
    // /store/... requests on the subdomain are never redirected again.
    const subdomainRules = vercel.redirects.filter((rule) => Array.isArray(rule.has));
    expect(subdomainRules.find((rule) => rule.source === "/")?.destination).toBe("/store/:slug");
    const pathRule = subdomainRules.find((rule) => rule.source.startsWith("/:path("));
    const pathPattern = new RegExp(`^/${pathRule!.source.slice("/:path(".length, -")".length)}$`);
    expect(pathPattern.test("/store/reaves/manifest.webmanifest")).toBe(false);
    expect(pathPattern.test("/store/reaves/app-icon-192.png")).toBe(false);
    expect(pathPattern.test("/design")).toBe(true);
  });
});

describe("sticky header safe-area padding", () => {
  it("applies max() safe-area insets on the site header, menu, and page footers", () => {
    const css = read("client/src/components/TopNav.css");
    const globalCss = read("client/src/index.css");
    const html = read("client/index.html");
    const source = read("client/src/components/TopNav.tsx");
    expect(html).toContain("viewport-fit=cover");
    expect(source).toContain("data-site-header");
    expect(css).toContain("padding-top: max(0px, env(safe-area-inset-top, 0px))");
    expect(css).toContain("padding-left: max(0px, env(safe-area-inset-left, 0px))");
    expect(css).toContain("padding-right: max(0px, env(safe-area-inset-right, 0px))");
    expect(css).toContain("padding-bottom: max(0px, env(safe-area-inset-bottom, 0px))");
    expect(globalCss).toContain("footer {");
    expect(globalCss).toContain("padding-bottom: max(0px, env(safe-area-inset-bottom, 0px))");
  });
});
