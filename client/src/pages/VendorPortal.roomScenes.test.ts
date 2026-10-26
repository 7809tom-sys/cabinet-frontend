import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/VendorPortal.tsx"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const doorStylesSource = readFileSync(resolve(process.cwd(), "client/src/pages/DoorStyles.tsx"), "utf8");
const librarySource = readFileSync(resolve(process.cwd(), "client/src/components/vendor/VendorRoomSceneLibrary.tsx"), "utf8");

describe("vendor room scenes stay inside existing sections", () => {
  it("uploads photos from Door Styles and Featured Styles instead of a new gallery section", () => {
    const doorStyles = source.slice(source.indexOf("function DoorStylesPage"), source.indexOf("type DoorMeasurementStyle"));
    const editor = source.slice(source.indexOf("function VendorFeaturedStyleEditor"), source.indexOf("function VendorFeaturedStylesPage"));
    const nav = source.slice(source.indexOf("const NAV_ITEMS"), source.indexOf("const PELICAN_NAV_IDS"));
    expect(doorStyles).toContain("<VendorRoomSceneLibrary");
    expect(editor).toContain("<VendorRoomSceneLibrary");
    expect(librarySource).toContain("uploadFeaturedStyleScenePhoto");
    expect(librarySource).toContain('data-testid="vendor-room-scene-library"');
    expect(librarySource).toContain("Upload photo into this scene");
    expect(nav.match(/id: "gallery"/g)?.length).toBe(1);
    expect(source).not.toContain("function VendorGalleryPage");
    expect(editor).not.toContain("Verified room scene library");
  });

  it("shows public room scenes on the supplier catalog without catalog edit controls", () => {
    const profileCatalog = source.slice(source.indexOf("function VendorProfileCatalogPanel"), source.indexOf("function SupplierPdfResource"));
    expect(profileCatalog).toContain("<VendorProfileRoomScenes");
    expect(profileCatalog).toContain('data-testid="vendor-profile-catalog"');
    expect(profileCatalog).not.toContain("updateImage");
    expect(profileCatalog).not.toContain("updatePrice");
    expect(profileCatalog).not.toContain("setVisibility");
    expect(source).toContain("trpc.doorStyles.publicRoomScenes.useQuery");
  });

  it("keeps the homepage cover photo and adds a photo viewer", () => {
    expect(homeSource).toContain("style.roomScenes?.[0]?.imageUrl");
    expect(homeSource).toContain("FeaturedCabinetPhotos");
    expect(homeSource).not.toContain("distributorName");
    expect(doorStylesSource).toContain("View room photos");
    expect(doorStylesSource).toContain("trpc.doorStyles.publicRoomScenes.useQuery");
  });
});

describe("vendor promotion discounts", () => {
  it("lets a vendor stack a percent or fixed amount on their own catalog", () => {
    const promotions = source.slice(source.indexOf("function PromotionsPage"), source.indexOf("// ─── Gallery Page"));
    expect(promotions).toContain('value="fixed_amount"');
    expect(promotions).toContain("Whole catalog");
    expect(promotions).toContain("Specific door style");
    expect(promotions).toContain("Specific items");
    expect(promotions).toContain("greater than 0 and at most 100");
    expect(promotions).toContain("stacks on the normal sell price");
    expect(promotions).toContain("skuIds: form.targetType === \"sku\" ? form.skuIds : undefined");
  });
});
