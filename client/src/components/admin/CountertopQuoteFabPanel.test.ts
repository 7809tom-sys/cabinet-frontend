import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fabShopDistanceLabel } from "./CountertopQuoteFabPanel";
import { filterFabShops } from "./FabricationShopsAdmin";
import { FAB_SHOP_EMAIL_DRAFTS_ENABLED } from "@shared/fabricationShops";

describe("fabrication shops in the admin", () => {
  it("labels how a shop was matched", () => {
    expect(fabShopDistanceLabel({ method: "same_zip", distanceMiles: 0 })).toBe("same ZIP");
    expect(fabShopDistanceLabel({ method: "distance", distanceMiles: 12.4 })).toBe("about 12 mi");
    expect(fabShopDistanceLabel({ method: "state", distanceMiles: 88 })).toBe("about 88 mi (nearest in state)");
    expect(fabShopDistanceLabel({ method: "state", distanceMiles: null })).toBe("same state");
  });

  it("searches by name, city or ZIP", () => {
    const shops = [
      { id: 1, name: "Edge Stone", state: "FL", zip: "32703", zipSource: "address", city: "Apopka", address: null, region: null, phone: null, website: null, googleRating: null, reviewCount: null, confidence: "high" },
      { id: 2, name: "Gulf Tops", state: "FL", zip: "33602", zipSource: "address", city: "Tampa", address: null, region: null, phone: null, website: null, googleRating: null, reviewCount: null, confidence: "low" },
    ];
    expect(filterFabShops(shops, "tampa").map((s) => s.id)).toEqual([2]);
    expect(filterFabShops(shops, "327").map((s) => s.id)).toEqual([1]);
    expect(filterFabShops(shops, "").length).toBe(2);
  });

  it("keeps shop emailing off by default", () => {
    expect(FAB_SHOP_EMAIL_DRAFTS_ENABLED).toBe(false);
  });

  it("adds the Fabrication Shops tab and the quote panels", () => {
    const tabs = readFileSync(new URL("./AdminGroupedTabs.tsx", import.meta.url), "utf8");
    expect(tabs).toContain('{ value: "fab-shops", label: "Fabrication Shops" }');
    expect(tabs).toContain('<TabsContent value="fab-shops" className="mt-6"><AdminTabErrorBoundary tabName="Fabrication Shops"><AdminTabHelp tab="fab-shops" /><FabricationShopsAdmin /></AdminTabErrorBoundary></TabsContent>');
    expect(tabs).toContain("<CountertopQuoteFabShops quote={q}");
    expect(tabs).toContain("<CountertopQuoteLineArt quote={q} />");
  });
});
