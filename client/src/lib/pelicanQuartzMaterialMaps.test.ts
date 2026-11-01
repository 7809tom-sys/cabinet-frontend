import { describe, expect, it } from "vitest";
import {
  PELICAN_QUARTZ_MATERIAL_MAPS,
  pelicanQuartzMaterialMap,
  resolvePelicanDesignerMaterial,
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

  it("prefers an uploaded Designer photo over the static quartz slab and falls back when none is set", () => {
    const bedrock = pelicanQuartzMaterialMap("Bedrock 3cm");
    const uploaded = "/manus-storage/pelican/uploads/bedrock-designer.webp";
    expect(resolvePelicanDesignerMaterial("Bedrock 3cm", uploaded)).toEqual({
      url: uploaded,
      key: `pelican-quartz:bedrock-3cm:${uploaded}`,
      physicalWidthIn: bedrock?.physicalWidthIn,
      physicalDepthIn: bedrock?.physicalDepthIn,
      source: "uploaded",
    });
    expect(resolvePelicanDesignerMaterial("Bedrock 3cm", "  ")).toMatchObject({
      url: bedrock?.materialImageUrl,
      key: "pelican-quartz:bedrock-3cm",
      source: "static-map",
    });
    expect(resolvePelicanDesignerMaterial("Bedrock 3cm", null)).toMatchObject({
      url: bedrock?.materialImageUrl,
      key: "pelican-quartz:bedrock-3cm",
      physicalWidthIn: 126,
      physicalDepthIn: 63,
      source: "static-map",
    });
    expect(resolvePelicanDesignerMaterial("Bedrock 3cm", "/textures/bedrock_normal.jpg")?.url).toBe(bedrock?.materialImageUrl);
    const custom = "/manus-storage/pelican/uploads/custom-limestone.png";
    expect(resolvePelicanDesignerMaterial("Custom Limestone", custom)).toEqual({
      url: custom,
      key: `pelican-quartz:uploaded:${custom}`,
      physicalWidthIn: 126,
      physicalDepthIn: 63,
      source: "uploaded",
    });
    expect(resolvePelicanDesignerMaterial("Custom Limestone", null)).toBeNull();
    expect(resolvePelicanDesignerMaterial("Apollo 3cm", null)).toBeNull();
  });

  it("does not treat a local-only legacy quartz row as a current official product map", () => {
    expect(pelicanQuartzMaterialMap("Apollo 3cm")).toBeNull();
    expect(pelicanQuartzMaterialMap("Calacatta Terremotto Left")).toBeNull();
    expect(pelicanQuartzMaterialMap("Pietra Grey 3cm")).toBeNull();
    expect(pelicanQuartzMaterialMap("Full Moon 3cm (old)")).toBeNull();
  });
});
