import { readFileSync } from "node:fs";
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

  it("gives the vanity step more than one model by merging the live bathroom faucet searches", () => {
    const designTool = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(designTool).toContain('search: "Bathroom Faucet"');
    expect(designTool).toContain('search: "Vanity Faucet"');
    expect(designTool).toContain('search: "Vessel Faucet"');
    expect(designTool).toContain("mergeBathroomFaucetRows(");

    const recommended = [{ id: 723, pelicanCode: "PL-8112 BN", sellPrice: 116.1 }];
    const catalog = [
      { id: 718, pelicanCode: "PL-8104 BN", sellPrice: 133.3 },
      { id: 720, pelicanCode: "PL-8107 BN", sellPrice: 152.86 },
      { id: 782, pelicanCode: "PL-8312 BN", sellPrice: 178.99 },
      { id: 786, pelicanCode: "PL-8330 BN", sellPrice: 113.95 },
      { id: 500, pelicanCode: "PL-8207 BN", sellPrice: 300 },
    ];
    expect(mergeBathroomFaucetRows(recommended, catalog).map((row) => row.pelicanCode)).toEqual([
      "PL-8112 BN",
      "PL-8104 BN",
      "PL-8107 BN",
      "PL-8312 BN",
      "PL-8330 BN",
    ]);
  });
});
