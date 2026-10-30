import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const clientSrc = path.resolve(__dirname, "../..");

function source(relativePath: string): string {
  return fs.readFileSync(path.join(clientSrc, relativePath), "utf8");
}

/** Public storefront, catalog, and cart pages. Sample ordering must not be mounted here. */
const PUBLIC_CUSTOMER_PAGES = [
  "pages/Home.tsx",
  "pages/Catalog.tsx",
  "pages/Cart.tsx",
  "pages/DoorStyles.tsx",
  "pages/CabinetDetail.tsx",
  "pages/Family.tsx",
  "components/storefront/StorefrontShop.tsx",
  "components/order/OrderReview.tsx",
];

describe("sample ordering stays off public customer pages", () => {
  it("mounts the desk only in the admin and affiliate back office", () => {
    expect(source("components/admin/AdminGroupedTabs.tsx")).toContain('<SampleOrderDesk mode="admin" />');
    expect(source("components/admin/AdminGroupedTabs.tsx")).toContain('value: "stripe-invoices", label: "Stripe Invoices"');
    expect(source("pages/AffiliateDashboard.tsx")).toContain('<SampleOrderDesk mode="affiliate" affiliateId={affiliate.id} />');
    expect(source("pages/AffiliateDashboard.tsx")).toContain('"samples"');
    expect(source("components/affiliate/AffiliateDashboardLayout.tsx")).toContain('section: "samples"');
  });

  it("does not import the sample desk or vendor sample API on public pages", () => {
    for (const file of PUBLIC_CUSTOMER_PAGES) {
      const text = source(file);
      expect(text, file).not.toContain("SampleOrderDesk");
      expect(text, file).not.toContain("vendorSamples");
      expect(text, file).not.toContain("SampleAvailableBadge");
    }
  });

  it("keeps the vendor samples tab off Pelican and behind the samples feature", () => {
    const portal = source("pages/VendorPortal.tsx");
    expect(portal).toContain("NAV_ITEMS.filter((item) => vendorCanOpenPortalPage(portalVendor, item.id))");
    expect(portal).toContain("hasVendorFeature(portalVendor, \"samples\")");
    expect(portal).toContain('item.id !== "samples" || sampleAccess.data?.enabled');
    expect(portal).not.toContain("PELICAN_NAV_IDS");
    expect(portal).not.toContain('"samples", "shipping"');
  });
});
