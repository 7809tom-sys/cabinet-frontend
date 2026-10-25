import { describe, expect, it } from "vitest";
import {
  PELICAN_QUARTZ_MATERIAL_MAPS,
  pelicanQuartzMaterialMap,
} from "./pelicanQuartzMaterialMaps";

const OFFICIAL_CURRENT_VARIANTS = [
  "Aurora 3cm",
  "Bedrock 3cm",
  "Calacatta Oro 3cm",
  "Calacatta Oro 3cm Super Jumbo",
  "Calacatta Super 3cm",
  "Calista 3cm",
  "Fossil 3cm",
  "Fossil 3cm Super Jumbo",
  "Full Moon 3cm",
  "Full Moon 3cm Super Jumbo",
  "Giotto 3cm",
  "Grey Mist 3cm",
  "Icelandic 3cm",
  "Icelandic 3cm Super Jumbo",
  "Nivara 3cm Super Jumbo",
  "Nocturne 3cm Super Jumbo",
  "Pallum 3cm Super Jumbo",
  "Pure White 3cm",
  "Pure White 3cm Super Jumbo",
  "Raiden 3cm",
  "Riverstone 3cm",
  "Riviera 3cm Left",
  "Riviera 3cm Right",
  "Sedona 3cm",
  "Siesta Key 3cm",
  "Strassa 3cm",
  "Super White 3cm",
  "Venezia 3cm",
  "Venezia 3cm Super Jumbo",
  "Virelle 3cm",
] as const;

describe("Pelican Quartz material-map registry", () => {
  it("maps every current official Pelican quartz code to one exact, source-qualified slab at its published dimensions", () => {
    expect(PELICAN_QUARTZ_MATERIAL_MAPS).toHaveLength(29);
    for (const code of OFFICIAL_CURRENT_VARIANTS) {
      const map = pelicanQuartzMaterialMap(code);
      expect(map, code).not.toBeNull();
      expect(map?.sourceProductUrl).toMatch(/^https:\/\/buildpelican\.com\/products\//);
      expect(map?.sourceImageUrl).toMatch(/^https:\/\/cdn\.shopify\.com\//);
      expect(map?.physicalWidthIn).toBeGreaterThan(0);
      expect(map?.physicalDepthIn).toBeGreaterThan(0);
      expect([126, 138]).toContain(map?.physicalWidthIn);
      expect([63, 79]).toContain(map?.physicalDepthIn);
      expect(map?.crop).toMatchObject({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) });
      expect(map?.crop.width).toBeGreaterThan(0);
      expect(map?.crop.height).toBeGreaterThan(0);
    }
  });

  it("keeps both Riviera orientations on the same exact source slab rather than inventing alternate material artwork", () => {
    const left = pelicanQuartzMaterialMap("Riviera 3cm Left");
    const right = pelicanQuartzMaterialMap("Riviera 3cm Right");
    expect(left).not.toBeNull();
    expect(right).toEqual(left);
  });

  it("does not treat a local-only legacy quartz row as a current official product map", () => {
    expect(pelicanQuartzMaterialMap("Apollo 3cm")).toBeNull();
    expect(pelicanQuartzMaterialMap("Calacatta Terremotto Left")).toBeNull();
    expect(pelicanQuartzMaterialMap("Pietra Grey 3cm")).toBeNull();
    expect(pelicanQuartzMaterialMap("Full Moon 3cm (old)")).toBeNull();
  });
});
