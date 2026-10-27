import { describe, expect, it } from "vitest";
import {
  affiliateCatalogIndexPath,
  affiliateDesignPath,
  affiliateFamilyPath,
  affiliateQuotePath,
  affiliateStylesPath,
  catalogSearchWithStyle,
  catalogSearchWithoutBrowse,
  overlayAffiliateStyle,
  styleIdFromSearch,
} from "./affiliateBrowse";

describe("affiliate browse paths", () => {
  it("keeps shop-by-style, family, catalog, design, and quote inside the store", () => {
    expect(affiliateStylesPath("firstclass")).toBe("/store/firstclass/styles");
    expect(affiliateStylesPath()).toBe("/styles");
    expect(affiliateFamilyPath("firstclass", "CW")).toBe("/store/firstclass/family/CW");
    expect(affiliateFamilyPath(undefined, "A B")).toBe("/family/A%20B");
    expect(affiliateCatalogIndexPath("firstclass")).toBe("/store/firstclass/catalog");
    expect(affiliateDesignPath("firstclass", 330026)).toBe("/store/firstclass/design?style=330026");
    expect(affiliateQuotePath("firstclass", 330026)).toBe("/store/firstclass/order?style=330026");
    expect(affiliateDesignPath(null, 7)).toBe("/design?style=7");
  });

  it("reads and replaces the pinned style without dropping the referral", () => {
    expect(styleIdFromSearch("?style=330026&ref=FC")).toBe(330026);
    expect(styleIdFromSearch("?style=0")).toBeNull();
    expect(styleIdFromSearch("")).toBeNull();
    expect(catalogSearchWithStyle("?style=330026&ref=FC", 390016)).toBe("?style=390016&ref=FC");
    expect(catalogSearchWithStyle("?style=330026&ref=FC", null)).toBe("?ref=FC");
    expect(catalogSearchWithoutBrowse("?style=330026&category=Base&q=sink&ref=FC")).toBe("?ref=FC");
  });

  it("uses the affiliate line name and its own room scene on a shared style record", () => {
    const overlaid = overlayAffiliateStyle(
      {
        id: 330026,
        ourName: "Internal Casselberry",
        featuredLabel: "Old label",
        roomSceneImageUrl: "/platform-scene.jpg",
        doorSampleImageUrl: "/door.jpg",
      },
      {
        styleId: 330026,
        name: "Casselberry Blanc",
        roomSceneImageUrl: "/affiliate-scene.jpg",
      },
    );
    expect(overlaid.ourName).toBe("Casselberry Blanc");
    expect(overlaid.featuredLabel).toBe("Casselberry Blanc");
    expect(overlaid.roomSceneImageUrl).toBe("/affiliate-scene.jpg");
    expect(overlaid.doorSampleImageUrl).toBe("/door.jpg");
  });
});
