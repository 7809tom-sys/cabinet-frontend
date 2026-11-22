import { describe, expect, it } from "vitest";
import { DEMO_DEALERS, DEMO_DEFAULT_ZIP, DEALER_GATE_COPY, isDemoPurchasePath, nearestDealer, zipToPoint, distanceMiles } from "./demoDealers";

describe("demo dealers", () => {
  it("has 6-8 fictional dealers across the US with 555-01xx phones and example.com emails", () => {
    expect(DEMO_DEALERS.length).toBeGreaterThanOrEqual(6);
    expect(DEMO_DEALERS.length).toBeLessThanOrEqual(8);
    expect(new Set(DEMO_DEALERS.map((d) => d.state)).size).toBe(DEMO_DEALERS.length);
    for (const d of DEMO_DEALERS) {
      expect(d.phone).toMatch(/^\(\d{3}\) 555-01\d\d$/);
      expect(d.email).toMatch(/@example\.com$/);
      expect(d.street && d.city && d.hours && d.zip).toBeTruthy();
    }
  });

  it("recommends the nearest dealer from a ZIP (exact table, then ZIP region)", () => {
    expect(nearestDealer(zipToPoint(DEMO_DEFAULT_ZIP)!).dealer.id).toBe("brindlewood");
    expect(nearestDealer(zipToPoint("10001")!).dealer.id).toBe("saltmarsh");
    expect(nearestDealer(zipToPoint("33130")!).dealer.id).toBe("quillfield");
    expect(nearestDealer(zipToPoint("80202")!).dealer.id).toBe("larkspur"); // region 8
    expect(nearestDealer({ lat: 47.6, lng: -122.3 }).dealer.id).toBe("ferncliff"); // browser coords
    expect(zipToPoint("abc")).toBeNull();
    expect(Math.round(distanceMiles({ lat: 41.8858, lng: -87.6229 }, { lat: 42.3334, lng: -71.0495 }))).toBeGreaterThan(800);
  });

  it("treats cart, checkout and order routes as purchases", () => {
    for (const path of ["/cart", "/cart?x=1", "/checkout", "/checkout/success", "/order/new", "/bulk-order", "/store/sales-demo/cart", "/store/acme/checkout"]) expect(isDemoPurchasePath(path), path).toBe(true);
    for (const path of ["/design", "/distributor-preview/design?style=1", "/distributor-preview/storefront", "/closet", "/carts-info", "/store/acme/design"]) expect(isDemoPurchasePath(path), path).toBe(false);
  });

  it("uses Tom's copy", () => {
    expect(DEALER_GATE_COPY.headline).toBe("Sorry, but you can only buy cabinets from our approved dealers.");
    expect(DEALER_GATE_COPY.final("Cabinet Deals Demo Distributor", "Brindlewood Cabinet Studio")).toBe("Cabinet Deals Demo Distributor will contact you shortly to connect you with Brindlewood Cabinet Studio and get your price.");
  });
});
