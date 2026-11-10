import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_FEATURES,
  anyAffiliateFeaturePublished,
  catalogVendorPublished,
  designerRoomOffered,
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

  it("keeps today's answer when there is no global row and no kill row", () => {
    const rows = [
      row({ subjectKind: "distributor", subjectId: 4, featureKey: "bathroom_builder", published: true }),
    ];
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "bathroom_builder")).toBe(true);
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 9 }, "bathroom_builder")).toBe(false);
    expect(anyAffiliateFeaturePublished(rows, "bathroom_builder")).toBe(true);
  });

  it("turns a feature off for every subject when Off everywhere is stored as published 0, and restores the same rows when it is published 1", () => {
    const subjectOn = row({ subjectKind: "distributor", subjectId: 4, featureKey: "bathroom_builder", published: true, updatedByName: "Tom" });
    const kitchenOn = row({ subjectKind: "distributor", subjectId: 4, featureKey: "kitchen_designer", published: true });
    const vendorOn = row({ subjectKind: "vendor", subjectId: 8, featureKey: "bathroom_builder", published: true });
    const off = row({ subjectKind: "global", subjectId: 0, featureKey: "bathroom_builder", published: false, updatedByName: "Tom", updatedAt: "2026-11-10T15:00:00.000Z" });
    const rows = [subjectOn, kitchenOn, vendorOn, off];
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "bathroom_builder")).toBe(false);
    expect(isPublishedForAffiliate(rows, { kind: "vendor", id: 8 }, "bathroom_builder")).toBe(false);
    expect(anyAffiliateFeaturePublished(rows, "bathroom_builder")).toBe(false);
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "kitchen_designer")).toBe(true);
    const restored = [subjectOn, vendorOn, { ...off, published: true }];
    expect(isPublishedForAffiliate(restored, { kind: "distributor", id: 4 }, "bathroom_builder")).toBe(true);
    expect(anyAffiliateFeaturePublished(restored, "bathroom_builder")).toBe(true);
    expect(restored.find((item) => item.featureKey === "bathroom_builder" && item.subjectId === 4)?.published).toBe(true);
    expect(rows).toHaveLength(4);
  });

  it("treats a stored 0 the same as off everywhere", () => {
    const rows = [
      row({ subjectKind: "distributor", subjectId: 4, featureKey: "bathroom_builder", published: true }),
      row({ subjectKind: "global", subjectId: 0, featureKey: "bathroom_builder", published: 0 as unknown as boolean }),
    ];
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "bathroom_builder")).toBe(false);
  });

  it("shuts off every feature for one distributor when featureKey all is published 0, and leaves the other rows untouched", () => {
    const bathroom = row({ subjectKind: "distributor", subjectId: 4, featureKey: "bathroom_builder", published: true });
    const kitchen = row({ subjectKind: "distributor", subjectId: 4, featureKey: "kitchen_designer", published: true });
    const other = row({ subjectKind: "distributor", subjectId: 9, featureKey: "bathroom_builder", published: true });
    const cabinet = row({ subjectKind: "distributor", subjectId: 4, featureKey: "cabinet_catalog", published: true });
    const kill = row({ subjectKind: "distributor", subjectId: 4, featureKey: "all", published: false, updatedByName: "Tom" });
    const rows = [bathroom, kitchen, other, cabinet, kill];
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "bathroom_builder")).toBe(false);
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "kitchen_designer")).toBe(false);
    expect(catalogVendorPublished(rows, { key: "distributor:4", kind: "cabinet" })).toBe(false);
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 9 }, "bathroom_builder")).toBe(true);
    expect(anyAffiliateFeaturePublished(rows, "bathroom_builder")).toBe(true);
    const restored = rows.map((item) => item.featureKey === "all" ? { ...item, published: true } : item);
    expect(isPublishedForAffiliate(restored, { kind: "distributor", id: 4 }, "bathroom_builder")).toBe(true);
    expect(isPublishedForAffiliate(restored, { kind: "distributor", id: 4 }, "kitchen_designer")).toBe(true);
    expect(catalogVendorPublished(restored, { key: "distributor:4", kind: "cabinet" })).toBe(true);
    expect(bathroom.published).toBe(true);
    expect(kitchen.published).toBe(true);
  });

  it("checks admin, then Off everywhere, then the distributor kill switch, then the feature row", () => {
    const rows = [
      row({ subjectKind: "global", subjectId: 0, featureKey: "bathroom_builder", published: false }),
      row({ subjectKind: "distributor", subjectId: 4, featureKey: "all", published: false }),
      row({ subjectKind: "distributor", subjectId: 4, featureKey: "bathroom_builder", published: true }),
    ];
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "bathroom_builder", { role: "admin" })).toBe(true);
    expect(anyAffiliateFeaturePublished(rows, "bathroom_builder", { role: "admin" })).toBe(true);
    expect(catalogVendorPublished(rows, { key: "distributor:4", kind: "cabinet" }, { role: "admin" })).toBe(true);
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "bathroom_builder", { role: "distributor" })).toBe(false);
    expect(isPublishedForAffiliate(rows, { kind: "distributor", id: 4 }, "bathroom_builder", { role: "affiliate" })).toBe(false);
    const killOnly = rows.filter((item) => item.subjectKind !== "global");
    expect(isPublishedForAffiliate(killOnly, { kind: "distributor", id: 4 }, "bathroom_builder", { role: "affiliate" })).toBe(false);
    const featureOnly = rows.filter((item) => item.featureKey === "bathroom_builder" && item.subjectKind === "distributor");
    expect(isPublishedForAffiliate(featureOnly, { kind: "distributor", id: 4 }, "bathroom_builder", { role: "affiliate" })).toBe(true);
  });

  it("hides a designer room for affiliates when it is off everywhere, and still offers it to an admin", () => {
    const rows = [
      row({ subjectKind: "distributor", subjectId: 4, featureKey: "bathroom_builder", published: true }),
      row({ subjectKind: "global", subjectId: 0, featureKey: "bathroom_builder", published: false }),
    ];
    expect(designerRoomOffered({ role: "affiliate", affiliateStore: true, publishReady: true, rows, featureKey: "bathroom_builder" })).toBe(false);
    expect(designerRoomOffered({ role: null, affiliateStore: false, publishReady: true, rows, featureKey: "bathroom_builder" })).toBe(false);
    expect(designerRoomOffered({ role: "admin", affiliateStore: true, publishReady: true, rows, featureKey: "bathroom_builder" })).toBe(true);
    expect(designerRoomOffered({ role: "distributor", affiliateStore: false, publishReady: true, rows, featureKey: "bathroom_builder" })).toBe(false);
    expect(designerRoomOffered({ role: null, affiliateStore: false, publishReady: true, rows: [], featureKey: "bathroom_builder" })).toBe(true);
    expect(designerRoomOffered({ role: null, affiliateStore: true, publishReady: false, rows, featureKey: "bathroom_builder" })).toBe(true);
  });

  it("gates the designer room tabs with this rule and leaves the continuous wall builder alone", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
    expect(source).toContain("designerRoomOffered");
    expect(source).toContain("const continuousWallsEnabled = true;");
    expect(source).not.toContain("affiliatePublishReady");
  });
});
