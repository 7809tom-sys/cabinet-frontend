import { describe, expect, it } from "vitest";
import {
  designBelongsToAccount,
  designOpenPath,
  designStoreLabel,
  designStoreScope,
  designWriteScope,
  newDesignSaveScope,
} from "@/lib/designOwnerScope";

const richDesign = { id: 481, userId: 7, affiliateId: null, affiliateSlug: null, affiliateName: null };
const firstClassDesign = { id: 512, userId: 7, affiliateId: 44, affiliateSlug: "firstclass", affiliateName: "First Class Flooring & Cabinet Design" };

describe("a saved design's own store decides where it opens", () => {
  it("opens a house design on the platform designer, never on a store's route", () => {
    expect(designOpenPath(richDesign)).toBe("/design?load=481");
  });

  it("opens a store-owned design on that store's route", () => {
    expect(designOpenPath(firstClassDesign)).toBe("/store/firstclass/design?load=512");
  });

  it("keeps assisted and CRM opens on the design's own store", () => {
    expect(designOpenPath(firstClassDesign, { assist: true }))
      .toBe("/store/firstclass/design?load=512&assist=1");
    expect(designOpenPath(richDesign, { assist: true, loadParam: "designId" }))
      .toBe("/design?designId=481&assist=1");
  });

  it("normalises an owner scope back to the platform route", () => {
    expect(designStoreScope({ affiliateSlug: "OWNER" })).toBe("owner");
    expect(designOpenPath({ id: 9, affiliateSlug: "owner" })).toBe("/design?load=9");
  });
});

describe("writes for an existing design stay in that design's store", () => {
  it("uses the design's own store even when the address says another store", () => {
    expect(designWriteScope({ urlScope: "firstclass", design: richDesign })).toBe("owner");
    expect(designWriteScope({ urlScope: "owner", design: firstClassDesign })).toBe("firstclass");
  });

  it("falls back to the address only when no design is loaded yet", () => {
    expect(designWriteScope({ urlScope: "reaves-way-cabinet-shop" })).toBe("reaves-way-cabinet-shop");
  });
});

describe("a new save attaches to the signed-in account", () => {
  it("files a platform admin's new design on their own account, not the storefront they are on", () => {
    expect(newDesignSaveScope({
      urlScope: "firstclass",
      role: "admin",
      viewerAffiliateId: null,
      storeAffiliateId: 44,
    })).toBe("owner");
  });

  it("files a store designer's new design on the store they work for", () => {
    expect(newDesignSaveScope({
      urlScope: "firstclass",
      role: "designer",
      viewerAffiliateId: 44,
      storeAffiliateId: 44,
    })).toBe("firstclass");
  });

  it("keeps a storefront customer's new design with that storefront", () => {
    expect(newDesignSaveScope({
      urlScope: "firstclass",
      role: "user",
      viewerAffiliateId: null,
      storeAffiliateId: 44,
    })).toBe("firstclass");
  });

  it("files staff work on the platform designer on their own account", () => {
    expect(newDesignSaveScope({ urlScope: "owner", role: "designer" })).toBe("owner");
  });

  it("keeps a guest's work on the storefront they are browsing so sign-in can adopt it", () => {
    expect(newDesignSaveScope({ urlScope: "reaves-way-cabinet-shop", role: null, storeAffiliateId: 91 }))
      .toBe("reaves-way-cabinet-shop");
  });
});

describe("ownership is the account, not the store", () => {
  it("recognises the account's own design and rejects another account's", () => {
    expect(designBelongsToAccount(richDesign, 7)).toBe(true);
    expect(designBelongsToAccount(richDesign, 8)).toBe(false);
    expect(designBelongsToAccount({ userId: null }, 7)).toBe(false);
  });

  it("labels a house design as the person's own CabinetDealz account", () => {
    expect(designStoreLabel(richDesign)).toBe("CabinetDealz");
    expect(designStoreLabel(firstClassDesign)).toBe("First Class Flooring & Cabinet Design");
    expect(designStoreLabel({ affiliateSlug: "reaves-way-cabinet-shop" })).toBe("reaves way cabinet shop");
    expect(designStoreLabel({ affiliateSlug: "owner" }, "My account")).toBe("My account");
  });
});
