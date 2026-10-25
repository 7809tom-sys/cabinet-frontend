import { describe, expect, it } from "vitest";
import {
  isPelicanBathroomFixtureProfileVerified,
  pelicanBathroomFixturePlacementText,
  verifiedPelicanBathroomFixtureProfile,
} from "./pelicanBathroomFixtureProfiles";
import { FURNITURE_CATALOG, makePelicanBathroomFixture } from "./design";

describe("Pelican bathroom fixture placement profiles", () => {
  it("uses exact official exterior envelopes for current toilet and bidet models", () => {
    expect(verifiedPelicanBathroomFixtureProfile("PL-12044")).toMatchObject({
      kind: "toilet",
      widthIn: 14 + 9 / 16,
      depthIn: 26 + 37 / 64,
      heightIn: 29 + 17 / 32,
      finish: "vitreous-china-white",
      toiletStyle: "one-piece",
      toiletFlushControl: "dual-button",
      toiletFlushTechnology: "multi-jet-siphonic",
    });
    expect(verifiedPelicanBathroomFixtureProfile("PL-12230")).toMatchObject({
      kind: "toilet",
      widthIn: 15,
      depthIn: 26.4,
      heightIn: 20,
      toiletStyle: "smart",
      toiletFlushControl: "touchless",
    });
    expect(verifiedPelicanBathroomFixtureProfile("PL-A249 ADA")).toMatchObject({
      kind: "toilet",
      toiletStyle: "two-piece",
      heightIn: 31.125,
      toiletFlushControl: "single-button",
    });
    expect(verifiedPelicanBathroomFixtureProfile("PL-12382")).toMatchObject({
      toiletStyle: "one-piece",
      toiletFlushControl: "single-button",
      toiletFlushTechnology: "tornado-rimless",
    });
    expect(verifiedPelicanBathroomFixtureProfile("PL-12248")).toMatchObject({
      kind: "bidet",
      widthIn: 14 + 11 / 64,
      depthIn: 21 + 21 / 32,
      heightIn: 16 + 9 / 64,
    });
  });

  it("distinguishes drain-side alcove tubs and all five measured 67-inch variants", () => {
    expect(verifiedPelicanBathroomFixtureProfile("PL-02850L")).toMatchObject({
      kind: "alcove-tub",
      widthIn: 32 + 1 / 64,
      depthIn: 60,
      heightIn: 21 + 21 / 32,
      drain: "left",
    });
    expect(verifiedPelicanBathroomFixtureProfile("PL-02850R")).toMatchObject({ drain: "right" });
    expect(verifiedPelicanBathroomFixtureProfile('PL-02146 59"')).toMatchObject({
      kind: "freestanding-tub",
      widthIn: 29 + 21 / 64,
      depthIn: 59 + 1 / 16,
      heightIn: 22 + 53 / 64,
      drain: "center",
    });
    for (const [code, width, depth, height, drain] of [
      ['PL-02138 67"', 29 + 17 / 32, 66 + 59 / 64, 23 + 1 / 32, "center"],
      ['PL-02141 67"', 29 + 9 / 64, 66 + 21 / 32, 27 + 3 / 4, "left"],
      ['PL-02146 67"', 29 + 13 / 32, 66 + 21 / 32, 22 + 53 / 64, "center"],
      ['PL-02562 67"', 30 + 29 / 32, 66 + 59 / 64, 22 + 53 / 64, "center"],
      ['PL-02563 67"', 31 + 7 / 64, 66 + 59 / 64, 22 + 53 / 64, "center"],
    ] as const) {
      expect(verifiedPelicanBathroomFixtureProfile(code)).toMatchObject({ widthIn: width, depthIn: depth, heightIn: height, drain });
      expect(verifiedPelicanBathroomFixtureProfile(code)?.specificationUrl).toContain("cdn.accentuate.io");
    }
    expect(pelicanBathroomFixturePlacementText('PL-02146 67"')).toContain("Place measured");
  });

  it("uses Pelican's nominal shower-door and tub-door dimensions only as visual planning envelopes", () => {
    expect(verifiedPelicanBathroomFixtureProfile("PL-03A42S")).toMatchObject({
      kind: "shower-door",
      widthIn: 60,
      depthIn: 0.5,
      heightIn: 76,
      visiblePanelHeightIn: 71 + 5 / 8,
      planningOnly: true,
    });
    expect(verifiedPelicanBathroomFixtureProfile("PL-03A42T")).toMatchObject({
      kind: "tub-door",
      widthIn: 60,
      depthIn: 0.5,
      heightIn: 59 + 1 / 6,
      visiblePanelHeightIn: 54 + 13 / 16,
      planningOnly: true,
    });
    expect(verifiedPelicanBathroomFixtureProfile("PL-03A42S60 MB")).toMatchObject({
      id: "pelican-shower-door-pl-03a42s",
      pelicanCode: "PL-03A42S60 MB",
      widthIn: 60,
      planningOnly: true,
    });
    expect(verifiedPelicanBathroomFixtureProfile("PL-603074 Brick")).toMatchObject({
      id: "pelican-shower-wall-pl-603074",
      pelicanCode: "PL-603074 BRICK",
      widthIn: 60,
      depthIn: 30,
      heightIn: 74,
    });
    expect(pelicanBathroomFixturePlacementText("PL-03A42S")).toContain("visual planning envelope");
  });

  it("rejects non-current and unresolved catalog rows from measured placement", () => {
    expect(isPelicanBathroomFixtureProfileVerified("PL-12228")).toBe(false);
    expect(isPelicanBathroomFixtureProfileVerified("PL-12243")).toBe(false);
    expect(isPelicanBathroomFixtureProfileVerified("PL-02849LNSO")).toBe(false);
  });

  it("persists a source product identity only for an exact measured profile", () => {
    const placed = makePelicanBathroomFixture({
      id: 9101,
      pelicanCode: "PL-12044 MB",
      name: "PL-12044 MB Vortex Toilet",
      category: "Toilets & Bidets",
      sellPrice: 599.95,
    }, 20, 32);
    expect(placed).toMatchObject({
      pelicanCode: "PL-12044 MB",
      pelicanProductId: 9101,
      pelicanSellPrice: 599.95,
      x: 20,
      y: 32,
    });
    expect(FURNITURE_CATALOG.find((item) => item.id === placed?.defId)).toMatchObject({
      category: "bathroom-fixture",
      pelicanCode: "PL-12044 MB",
      w: 14 + 9 / 16,
      d: 26 + 37 / 64,
    });
    expect(makePelicanBathroomFixture({
      id: 9102,
      pelicanCode: 'PL-02146 67"',
      name: "PL-02146 67-inch Tub",
      category: "Shower & Bath",
      sellPrice: 999.95,
    }, 0, 0)).toMatchObject({ pelicanCode: 'PL-02146 67"', pelicanProductId: 9102 });
  });
});
