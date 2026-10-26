import { describe, expect, it } from "vitest";
import {
  CABINET_VENDOR_FEATURES,
  NON_CABINET_VENDOR_FEATURES,
  ORDER_SAMPLES_CAPABILITY,
  cabinetFlagFromLineLinks,
  canManageSampleKits,
  canOrderSamples,
  featuresForVendor,
  hasVendorFeature,
  vendorApprovalChoiceError,
  vendorCanOpenPortalPage,
  vendorKind,
  vendorKindLabel,
  vendorPortalPages,
} from "./vendorFeatures";

const cabinet = { isCabinetVendor: true as const };
const nonCabinet = { isCabinetVendor: false as const };
const unset = { isCabinetVendor: null };

describe("vendor feature map", () => {
  it("gives cabinet vendors cabinet tools, samples, and the shared supplier tools", () => {
    expect(vendorKind(cabinet)).toBe("cabinet");
    expect(vendorKindLabel(cabinet)).toBe("Cabinet vendor");
    for (const feature of [
      "cabinet_catalog",
      "cabinet_config",
      "door_styles",
      "featured_styles",
      "room_scenes",
      "designer_eligibility",
      "cabinet_conflict_review",
      "design_tools",
      "samples",
      "sample_kits",
      "sales_forecast",
      "inventory",
      "pricing",
      "shipping_fulfillment",
      "promotions",
      "storefront",
    ] as const) {
      expect(hasVendorFeature(cabinet, feature)).toBe(true);
    }
    expect(hasVendorFeature(cabinet, "category_catalog")).toBe(false);
    expect(hasVendorFeature(cabinet, "product_designer_visibility")).toBe(false);
    expect(CABINET_VENDOR_FEATURES).toContain("samples");
    expect(CABINET_VENDOR_FEATURES).toContain("sample_kits");
  });

  it("gives non-cabinet vendors a category catalog and the shared tools, not cabinet tools", () => {
    expect(vendorKind(nonCabinet)).toBe("non_cabinet");
    expect(featuresForVendor(nonCabinet)).toEqual(NON_CABINET_VENDOR_FEATURES);
    for (const feature of [
      "door_styles",
      "featured_styles",
      "cabinet_config",
      "cabinet_catalog",
      "cabinet_conflict_review",
      "designer_eligibility",
      "room_scenes",
      "design_tools",
      "samples",
      "sample_kits",
    ] as const) {
      expect(hasVendorFeature(nonCabinet, feature)).toBe(false);
    }
    expect(hasVendorFeature(nonCabinet, "category_catalog")).toBe(true);
    expect(hasVendorFeature(nonCabinet, "product_designer_visibility")).toBe(true);
    expect(hasVendorFeature(nonCabinet, "sales_forecast")).toBe(true);
    expect(hasVendorFeature(nonCabinet, "promotions")).toBe(true);
    expect(hasVendorFeature(nonCabinet, "storefront")).toBe(true);
  });

  it("keeps an unset flag on the supplier profile until an administrator chooses", () => {
    expect(vendorKind(unset)).toBeNull();
    expect(vendorKindLabel(unset)).toBe("Needs cabinet choice");
    expect(vendorPortalPages(unset)).toEqual(["supplier-profile"]);
    expect(hasVendorFeature(unset, "door_styles")).toBe(false);
    expect(hasVendorFeature(null, "storefront")).toBe(true);
  });

  it("opens only the pages that exist for each type", () => {
    const cabinetPages = vendorPortalPages(cabinet);
    const nonCabinetPages = vendorPortalPages(nonCabinet);
    expect(cabinetPages).toEqual(expect.arrayContaining([
      "overview",
      "supplier-profile",
      "catalog",
      "styles",
      "featured-styles",
      "picks",
      "gallery",
      "shipping",
      "fulfillment",
      "promotions",
    ]));
    expect(nonCabinetPages).toEqual([
      "overview",
      "supplier-profile",
      "catalog",
      "shipping",
      "promotions",
      "fulfillment",
    ]);
    expect(nonCabinetPages).not.toContain("styles");
    expect(nonCabinetPages).not.toContain("featured-styles");
    expect(nonCabinetPages).not.toContain("picks");
    expect(nonCabinetPages).not.toContain("gallery");
    expect(vendorCanOpenPortalPage(nonCabinet, "styles")).toBe(false);
    expect(vendorCanOpenPortalPage(cabinet, "styles")).toBe(true);
  });

  it("backfills cabinet lines to true, Pelican to false, and unknown vendors to unset", () => {
    expect(cabinetFlagFromLineLinks({
      sourceKey: "dist:4",
      matchesCabinetDistributor: true,
      matchesPelicanDistributor: false,
    })).toBe(true);
    expect(cabinetFlagFromLineLinks({
      sourceKey: "pelican",
      matchesCabinetDistributor: false,
      matchesPelicanDistributor: true,
    })).toBe(false);
    expect(cabinetFlagFromLineLinks({
      sourceKey: "pelican",
      matchesCabinetDistributor: true,
      matchesPelicanDistributor: true,
    })).toBe(false);
    expect(cabinetFlagFromLineLinks({
      sourceKey: "dist:9",
      matchesCabinetDistributor: false,
      matchesPelicanDistributor: true,
    })).toBe(false);
    expect(cabinetFlagFromLineLinks({
      sourceKey: "saunders-closets",
      matchesCabinetDistributor: false,
      matchesPelicanDistributor: false,
    })).toBeNull();
  });

  it("refuses to approve a vendor until the cabinet checkbox has a yes or no", () => {
    expect(vendorApprovalChoiceError({ isApproved: true, isCabinetVendor: null })).toMatch(/cabinet vendor/i);
    expect(vendorApprovalChoiceError({ isApproved: true, isCabinetVendor: undefined })).toMatch(/cabinet vendor/i);
    expect(vendorApprovalChoiceError({ isApproved: true, isCabinetVendor: false })).toBeNull();
    expect(vendorApprovalChoiceError({ isApproved: true, isCabinetVendor: true })).toBeNull();
    expect(vendorApprovalChoiceError({ isApproved: false, isCabinetVendor: null })).toBeNull();
  });

  it("keeps sample ordering in the back office for affiliates and administrators", () => {
    expect(ORDER_SAMPLES_CAPABILITY).toBe("order_samples");
    expect(canOrderSamples({ role: "affiliate" })).toBe(true);
    expect(canOrderSamples({ role: "admin" })).toBe(true);
    expect(canOrderSamples({ role: "distributor" })).toBe(false);
    expect(canOrderSamples({ role: "user" })).toBe(false);
    expect(canOrderSamples(null)).toBe(false);
    expect(canManageSampleKits({ role: "admin" })).toBe(true);
    expect(canManageSampleKits({ role: "affiliate" })).toBe(false);
    expect(canManageSampleKits({ role: "distributor" })).toBe(false);
  });

});
