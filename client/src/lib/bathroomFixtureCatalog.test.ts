import { describe, expect, it } from "vitest";
import {
  bathroomFixtureCardImage,
  isBathroomDesignerFaucet,
  mergeBathroomFaucetRows,
} from "./bathroomFixtureCatalog";

describe("bathroom fixture catalog", () => {
  it("replaces a dead tub override with the stored catalog photo and keeps a photo that already loads", () => {
    expect(bathroomFixtureCardImage('PL-02141 59"', "/manus-storage/tub-pl-02141_44be67ae.png"))
      .toBe("/manus-storage/pelican/464_9428b503.png");
    expect(bathroomFixtureCardImage("PL-02850L", "/manus-storage/pelican/476_9f0f12e1.png"))
      .toBe("/manus-storage/pelican/476_9f0f12e1.png");
    expect(bathroomFixtureCardImage("PL-12044", "/manus-storage/toilet-pl-12044_89151b6d.png"))
      .toBe("/manus-storage/toilet-pl-12044_89151b6d.png");
    expect(bathroomFixtureCardImage("PL-A249 ADA", null))
      .toBe("https://buildpelican.com/cdn/shop/files/PL-A249.png");
  });

  it("adds priced vanity faucets that sit past the recommended query window", () => {
    const recommended = [
      { id: 802, pelicanCode: "PL-8515 BN", sellPrice: 432.64 },
      { id: 1, pelicanCode: "PL-8206 BN", sellPrice: 200 },
    ];
    const catalog = [
      { id: 802, pelicanCode: "PL-8515 BN", sellPrice: 432.64 },
      { id: 718, pelicanCode: "PL-8104 BN", sellPrice: 133.3 },
      { id: 723, pelicanCode: "PL-8112 BN", sellPrice: 116.1 },
      { id: 1606, pelicanCode: "PL-1606 White", sellPrice: 80 },
      { id: 0, pelicanCode: "PL-8303 BN", sellPrice: 0 },
    ];
    expect(mergeBathroomFaucetRows(recommended, catalog).map((row) => row.pelicanCode)).toEqual([
      "PL-8515 BN",
      "PL-8104 BN",
      "PL-8112 BN",
    ]);
    expect(isBathroomDesignerFaucet("PL-8206 BN")).toBe(false);
    expect(isBathroomDesignerFaucet("PL-8164 BN")).toBe(true);
  });
});
