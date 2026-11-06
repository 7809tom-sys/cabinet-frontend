import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPublicDesignViewUrl, PUBLIC_SHARE_ORIGIN, shareOriginFor } from "@/lib/designShare";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

/**
 * The reported bug: a design shared from the Kitchen Designer did not open for
 * the person it was emailed to. A share link must survive the three things that
 * break a recipient's copy — the sender's affiliate host, the API proxy host,
 * and an expired session — and land on a route that exists.
 */
describe("a shared design link opens for the person it was sent to", () => {
  const token = "CTP4eg-NXLkn-H1DwOgNCWXG";

  it("is built on the public site even when the sender is inside an affiliate store", () => {
    const link = buildPublicDesignViewUrl({
      origin: "https://reaves-way-cabinet-shop.cabinetdealz.com",
      token,
    });
    expect(link).toBe(`${PUBLIC_SHARE_ORIGIN}/3d/${token}`);
    // An affiliate subdomain rewrites every non-store path to /store/:slug,
    // so a branded /3d link would land on a page that does not exist.
    expect(new URL(link).pathname.startsWith("/store/")).toBe(false);
  });

  it("does not depend on the sender's origin being a customer-facing address", () => {
    // A preview or deployment host must never be handed to the recipient.
    expect(shareOriginFor("https://www.cabinetdealz.com")).toBe(PUBLIC_SHARE_ORIGIN);
    expect(buildPublicDesignViewUrl({
      origin: "https://www.cabinetdealz.com",
      token,
    })).toBe(`${PUBLIC_SHARE_ORIGIN}/3d/${token}`);
  });

  it("targets a route the app actually renders", () => {
    expect(appSource).toContain('<Route path="/3d/:token">');
    const url = new URL(buildPublicDesignViewUrl({ origin: PUBLIC_SHARE_ORIGIN, token }));
    expect(url.pathname).toBe(`/3d/${token}`);
  });

  it("keeps an affiliate-branded copy of the same link reachable inside the store tree", () => {
    // Older links used a branded host. Vercel/Express rewrites those to
    // /store/:slug/<path>, so the shared views need routes there too.
    expect(appSource).toContain('<Route path="/store/:slug/3d/:token">');
    expect(appSource).toContain('<Route path="/store/:slug/design/session/:token">');
  });

  it("carries no design id, account cookie, or sender scope the recipient would need", () => {
    const link = buildPublicDesignViewUrl({ origin: PUBLIC_SHARE_ORIGIN, token });
    expect(link).not.toContain("load=");
    expect(link).not.toContain("affiliate=");
    expect(link).not.toContain("/api/");
    // The token is the only identity; the server resolves the design from it.
    expect(new URL(link).pathname).toBe(`/3d/${token}`);
  });

  it("still carries the shared camera perspective for the recipient", () => {
    const view = "1,12.346,8.200,-4.050,6.500,3.100,2.250,1.250";
    const url = new URL(buildPublicDesignViewUrl({ origin: PUBLIC_SHARE_ORIGIN, token, view }));
    expect(url.searchParams.get("view")).toBe(view);
  });
});
