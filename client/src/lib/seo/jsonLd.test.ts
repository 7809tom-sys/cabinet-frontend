import { describe, it, expect } from "vitest";
import { buildKitchenDiscoveryJsonLd, buildKitchenPackageCollectionJsonLd, buildProductJsonLd } from "./jsonLd";

describe("buildProductJsonLd (cabinet)", () => {
  it("emits a valid Product node with brand and sku, no offer", () => {
    const ld = buildProductJsonLd({
      name: "Base Cabinet 12 in. - one door, one shelf",
      description: "One door, one adjustable shelf, soft-close hinges.",
      sku: "B12",
      image: "https://cdn.example.com/b12.png",
      url: "https://cabinet-dealz.com/catalog/B12",
      category: "Base Cabinets",
    });

    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toContain("Base Cabinet");
    expect(ld.sku).toBe("B12");
    expect(ld.mpn).toBe("B12");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "Cabinet Dealz" });
    // Cabinets must NOT publish tier-gated pricing
    expect(ld.offers).toBeUndefined();
    expect(ld.url).toBe("https://cabinet-dealz.com/catalog/B12");
  });

  it("omits empty/undefined fields", () => {
    const ld = buildProductJsonLd({ name: "Filler Strip", description: "" });
    expect(ld.name).toBe("Filler Strip");
    expect("description" in ld).toBe(false);
    expect("sku" in ld).toBe(false);
    expect("image" in ld).toBe(false);
  });

  it("produces JSON-serializable output", () => {
    const ld = buildProductJsonLd({ name: "Wall Cabinet 30 in." });
    expect(() => JSON.stringify(ld)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(ld));
    expect(parsed["@type"]).toBe("Product");
  });
});

describe("buildKitchenDiscoveryJsonLd", () => {
  it("describes the complete-kitchen journey without publishing product pricing", () => {
    const ld = buildKitchenDiscoveryJsonLd({
      origin: "https://www.cabinetdealz.com",
      name: "Plan Your Complete Kitchen",
      description: "Plan a kitchen from style to quote.",
    });
    const graph = ld["@graph"] as Array<Record<string, unknown>>;
    const journey = graph.find((node) => node["@type"] === "ItemList");
    const collection = graph.find((node) => node["@type"] === "CollectionPage");

    expect(collection).toMatchObject({
      url: "https://www.cabinetdealz.com/kitchens",
      name: "Plan Your Complete Kitchen",
    });
    expect(journey?.itemListElement).toHaveLength(4);
    expect(JSON.stringify(ld)).not.toContain("offers");
    expect(JSON.stringify(ld)).not.toContain("price");
  });

  it("keeps affiliate kitchen journey links inside the branded storefront route tree", () => {
    const ld = buildKitchenDiscoveryJsonLd({
      origin: "https://reaves-way-cabinet-shop.cabinetdealz.com",
      path: "/store/reaves-way-cabinet-shop/kitchens",
      journeyBasePath: "/store/reaves-way-cabinet-shop",
      name: "Plan Your Complete Kitchen with Reaves Way Cabinet Shop",
      description: "Plan a kitchen with Reaves Way Cabinet Shop.",
    });
    const graph = ld["@graph"] as Array<Record<string, unknown>>;
    const journey = graph.find((node) => node["@type"] === "ItemList")!;
    const urls = (journey.itemListElement as Array<Record<string, string>>).map((item) => item.url);

    expect(urls).toEqual([
      "https://reaves-way-cabinet-shop.cabinetdealz.com/store/reaves-way-cabinet-shop/kitchens#choose-a-direction",
      "https://reaves-way-cabinet-shop.cabinetdealz.com/store/reaves-way-cabinet-shop/bundles",
      "https://reaves-way-cabinet-shop.cabinetdealz.com/store/reaves-way-cabinet-shop/design",
      "https://reaves-way-cabinet-shop.cabinetdealz.com/store/reaves-way-cabinet-shop/order",
    ]);
  });

  it("publishes only the displayed kitchen-planning answers in FAQ schema", () => {
    const faqs = [{
      question: "How do I start planning a complete kitchen?",
      answer: "Start with a kitchen look, then explore a package or build your layout in the kitchen designer.",
    }];
    const ld = buildKitchenDiscoveryJsonLd({
      origin: "https://www.cabinetdealz.com",
      name: "Plan Your Complete Kitchen",
      description: "Plan a kitchen from style to quote.",
      faqs,
    });
    const graph = ld["@graph"] as Array<Record<string, unknown>>;
    const faq = graph.find((node) => node["@type"] === "FAQPage")!;

    expect(faq.mainEntity).toEqual([{
      "@type": "Question",
      name: faqs[0].question,
      acceptedAnswer: { "@type": "Answer", text: faqs[0].answer },
    }]);
    expect(JSON.stringify(ld)).not.toContain("price");
  });
});

describe("buildKitchenPackageCollectionJsonLd", () => {
  it("lists actual kitchen packages by their public in-page discovery URLs without prices", () => {
    const ld = buildKitchenPackageCollectionJsonLd({
      origin: "https://www.cabinetdealz.com",
      path: "/bundles",
      name: "Kitchen Packages",
      description: "Explore ready-to-customize kitchen package ideas.",
      packages: [{
        name: "Bright Kitchen Package",
        description: "Homeowner price: $4,116.84. A kitchen layout starting point.",
        image: "https://cdn.example/kitchen.png",
        path: "/bundles#package-12",
      }],
    });
    const graph = ld["@graph"] as Array<Record<string, unknown>>;
    const list = graph.find((node) => node["@type"] === "ItemList")!;
    const item = (list.itemListElement as Array<Record<string, unknown>>)[0];

    expect(item.url).toBe("https://www.cabinetdealz.com/bundles#package-12");
    expect(item.name).toBe("Bright Kitchen Package");
    expect(item.description).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain("price");
    expect(JSON.stringify(ld)).not.toContain("offers");
  });
});
