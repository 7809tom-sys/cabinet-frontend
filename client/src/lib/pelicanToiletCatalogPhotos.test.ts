import { describe, expect, it } from "vitest";
import { pelicanToiletCatalogPhoto } from "./pelicanToiletCatalogPhotos";

describe("pelicanToiletCatalogPhoto", () => {
  it("points each photographed toilet at the Pelican product image", () => {
    expect(pelicanToiletCatalogPhoto("PL-12044")).toBe("https://buildpelican.com/cdn/shop/files/PL-12044_A.jpg");
    expect(pelicanToiletCatalogPhoto("PL-12044 MB")).toBe("https://buildpelican.com/cdn/shop/files/PL-12044MB_A.jpg");
    expect(pelicanToiletCatalogPhoto("PL-A249 ADA")).toBe("https://buildpelican.com/cdn/shop/files/PL-A249.png");
    expect(pelicanToiletCatalogPhoto("PL-12305 MB")).toBe("https://buildpelican.com/cdn/shop/files/12305Black.png");
    expect(pelicanToiletCatalogPhoto("PL-12230")).toBeNull();
    expect(pelicanToiletCatalogPhoto(null)).toBeNull();
  });
});
