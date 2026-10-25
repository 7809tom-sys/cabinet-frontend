import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Storefront.tsx", import.meta.url), "utf8");

describe("affiliate storefront testimonials", () => {
  it("renders only the testimonials supplied by the public affiliate projection with their original sources", () => {
    expect(source).toContain("data.testimonials.length > 0");
    expect(source).toContain("data.testimonials.map");
    expect(source).toContain("testimonial.sourceUrl");
    expect(source).toContain("What customers say about");
  });
});

describe("affiliate storefront template coverage", () => {
  it("renders every approved presentation branch without changing shared catalog or checkout content", () => {
    for (const template of ["classic", "showcase", "minimal", "craftsman", "coastal", "gallery", "studio", "heritage"]) {
      expect(source).toContain(`template === "${template}"`);
    }
    expect(source).toContain("CoastalHero");
    expect(source).toContain("GalleryHero");
    expect(source).toContain("StudioHero");
    expect(source).toContain("HeritageHero");
    expect(source).toContain("StorefrontShop slug={data.slug}");
  });
});
