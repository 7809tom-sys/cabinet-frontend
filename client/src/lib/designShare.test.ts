import { describe, expect, it } from "vitest";
import { buildDesignShareUrl, buildRemoteDesignSessionUrl } from "./designShare";

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
});
