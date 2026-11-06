import { describe, expect, it } from "vitest";
import {
  buildDesignShareUrl,
  buildPublicDesignViewUrl,
  buildRemoteDesignSessionUrl,
  PUBLIC_SHARE_ORIGIN,
  shareOriginFor,
} from "./designShare";

describe("affiliate-branded design sharing", () => {
  it("preserves the active affiliate host and identifies the saved design", () => {
    expect(buildDesignShareUrl({
      origin: "https://reaves-way-cabinet-shop.cabinetdealz.com",
      designId: 8190001,
      affiliateSlug: "reaves-way-cabinet-shop",
    })).toBe("https://reaves-way-cabinet-shop.cabinetdealz.com/design?load=8190001&affiliate=reaves-way-cabinet-shop");
  });

  it("shares a saved design without an affiliate parameter on the central site", () => {
    expect(buildDesignShareUrl({
      origin: "https://www.cabinetdealz.com",
      designId: 42,
    })).toBe("https://www.cabinetdealz.com/design?load=42");
  });

  it("builds a tokenized remote design session link without exposing a raw design id", () => {
    expect(buildRemoteDesignSessionUrl({
      origin: "https://www.cabinetdealz.com",
      token: "abc.123/encoded",
    })).toBe("https://www.cabinetdealz.com/design/session/abc.123%2Fencoded");
  });

  it("puts a branded remote session link on the public site, where the route exists", () => {
    expect(buildRemoteDesignSessionUrl({
      origin: "https://reaves-way-cabinet-shop.cabinetdealz.com",
      token: "abc.123/encoded",
    })).toBe(`${PUBLIC_SHARE_ORIGIN}/design/session/abc.123%2Fencoded`);
  });
});

describe("shared 3D view links open for the recipient", () => {
  it("points an affiliate-subdomain share at the public site instead of the store route tree", () => {
    expect(buildPublicDesignViewUrl({
      origin: "https://reaves-way-cabinet-shop.cabinetdealz.com",
      token: "aBcD1234_efGhI56",
    })).toBe(`${PUBLIC_SHARE_ORIGIN}/3d/aBcD1234_efGhI56`);
  });

  it("never hands the recipient an API-host preview hop", () => {
    const url = buildPublicDesignViewUrl({ origin: "https://www.cabinetdealz.com", token: "aBcD1234_efGhI56" });
    expect(url).not.toContain("/api/shared-3d-view/");
    expect(new URL(url).pathname).toBe("/3d/aBcD1234_efGhI56");
  });

  it("keeps the shared camera perspective and encodes the token", () => {
    expect(buildPublicDesignViewUrl({
      origin: "https://www.cabinetdealz.com",
      token: "a/b",
      view: "1,12.346,8.200,-4.050,6.500,3.100,2.250,1.250",
    })).toBe(`${PUBLIC_SHARE_ORIGIN}/3d/a%2Fb?view=1%2C12.346%2C8.200%2C-4.050%2C6.500%2C3.100%2C2.250%2C1.250`);
  });

  it("normalizes the apex and www hosts to one public origin so a shared link is stable", () => {
    expect(shareOriginFor("https://cabinetdealz.com")).toBe(PUBLIC_SHARE_ORIGIN);
    expect(shareOriginFor("https://www.cabinetdealz.com/")).toBe(PUBLIC_SHARE_ORIGIN);
    expect(shareOriginFor("https://www.cabinetdealz.com:443")).toBe(PUBLIC_SHARE_ORIGIN);
  });

  it("keeps a local or preview origin so the link is testable before deploy", () => {
    expect(shareOriginFor("http://localhost:5173")).toBe("http://localhost:5173");
    expect(shareOriginFor("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(shareOriginFor("https://cabinet-preview-abc.vercel.app")).toBe("https://cabinet-preview-abc.vercel.app");
    expect(shareOriginFor("https://ntr4awi5q3josrid53qp-production.up.railway.app"))
      .toBe("https://ntr4awi5q3josrid53qp-production.up.railway.app");
  });

  it("returns an unusable origin unchanged instead of throwing in the share handler", () => {
    expect(shareOriginFor("not a url")).toBe("not a url");
  });
});
