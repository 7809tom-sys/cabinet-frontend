import { describe, expect, it } from "vitest";
import {
  AFFILIATE_FEATURES,
  anyAffiliateFeaturePublished,
  catalogVendorPublished,
  isPublishedForAffiliate,
  type AffiliateFeaturePublishRow,
} from "./affiliateFeaturePublish";

const row = (patch: Partial<AffiliateFeaturePublishRow> & Pick<AffiliateFeaturePublishRow, "subjectKind" | "subjectId" | "featureKey" | "published">): AffiliateFeaturePublishRow => ({
  updatedByName: null,
  updatedAt: null,
  ...patch,
});

describe("affiliate feature publish", () => {
  it("lists the builders and affiliate features found in the product, and leaves literature out", () => {
    const keys = AFFILIATE_FEATURES.map((feature) => feature.key);
    expect(keys).toEqual(expect.arrayContaining([
      "kitchen_designer",
      "bathroom_builder",
      "laundry_builder",
      "closet_builder",
      "closet_studio",
    ]));
    expect(keys.join(" ")).not.toMatch(/literature/i);
  });

  it("stays unpublished until an explicit row is on", () => {
    const rows = [
      row({ subjectKind: "distributor", subjectId: 4, featureKey: "kitchen_designer", published: false, updatedByName: "Tom", updatedAt: "2026-11-01T12:00:00.000Z" }),
    ];
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "kitchen_designer")).toBe(false);
    expect(isPublishedForAffiliate([], { kind: "distributor", id: 4 }, "kitchen_designer")).toBe(false);
    expect(anyAffiliateFeaturePublished(rows, "bathroom_builder")).toBe(false);
  });

  it("publishes only the distributor and feature that were turned on", () => {
    const rows = [
      row({ subjectKind: "distributor", subjectId: 4, featureKey: "closet_studio", published: true, updatedByName: "Tom", updatedAt: "2026-11-02T15:04:00.000Z" }),
    ];
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "closet_studio")).toBe(true);
    expect(isPublishedForAffiliate(rows, { kind: "vendor", id: 4 }, "closet_studio")).toBe(false);
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 9 }, "closet_studio")).toBe(false);
    expect(catalogVendorPublished(rows, { key: "closet", kind: "closet" })).toBe(false);
    expect(catalogVendorPublished(rows, { key: "distributor:4", kind: "cabinet" })).toBe(false);
  });

  it("opens a platform catalog only after some subject publishes that feature", () => {
    const rows = [
      row({ subjectKind: "vendor", subjectId: 2, featureKey: "pelican_catalog", published: true }),
    ];
    expect(catalogVendorPublished(rows, { key: "pelican", kind: "surface" })).toBe(true);
    expect(catalogVendorPublished(rows, { key: "hardware", kind: "hardware" })).toBe(false);
    expect(anyAffiliateFeaturePublished(rows, "bathroom_builder")).toBe(false);
  });
});
