/**
 * Source-qualified Pelican Quartz material maps.
 *
 * Each asset is an interior-only crop of the exact official Pelican product
 * gallery slab photograph named in its record. It deliberately excludes staged
 * settings, sample discs, floor/support hardware, and generic series artwork.
 * These are finite physical slab maps, not invented seamless textures.
 * Source audit: docs/research/pelican-quartz-public-source-audit-2026-10-19.md
 */
export type PelicanQuartzMaterialMap = {
  handle: string;
  codes: readonly string[];
  materialImageUrl: string;
  physicalWidthIn: 126 | 138;
  physicalDepthIn: 63 | 79;
  sourceProductUrl: string;
  sourceImageUrl: string;
  sourceImageFile: string;
  sourceImageSize: readonly [number, number];
  crop: Readonly<{ x: number; y: number; width: number; height: number }>;
};

export const PELICAN_QUARTZ_MATERIAL_MAPS: readonly PelicanQuartzMaterialMap[] = [
  {
    "handle": "nocturne-3cm-super-jumbo",
    "codes": [
      "Nocturne 3cm Super Jumbo"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/nocturne-3cm-super-jumbo_source_slab_c5da2996.webp",
    "physicalWidthIn": 138,
    "physicalDepthIn": 79,
    "sourceProductUrl": "https://buildpelican.com/products/nocturne-3cm-super-jumbo",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/NocturneSlabResized.jpg?v=1781018437",
    "sourceImageFile": "NocturneSlabResized.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1022,
      "height": 585
    }
  },
  {
    "handle": "nivara-3cm-super-jumbo",
    "codes": [
      "Nivara 3cm Super Jumbo"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/nivara-3cm-super-jumbo_source_slab_0a9e0362.webp",
    "physicalWidthIn": 138,
    "physicalDepthIn": 79,
    "sourceProductUrl": "https://buildpelican.com/products/nivara-3cm-super-jumbo",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/NivaraSlab-Resized.jpg?v=1781017993",
    "sourceImageFile": "NivaraSlab-Resized.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1022,
      "height": 585
    }
  },
  {
    "handle": "pallum-3cm-super-jumbo",
    "codes": [
      "Pallum 3cm Super Jumbo"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/pallum-3cm-super-jumbo_source_slab_f72af416.webp",
    "physicalWidthIn": 138,
    "physicalDepthIn": 79,
    "sourceProductUrl": "https://buildpelican.com/products/pallum-3cm-super-jumbo",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/PallumSlabResized.jpg?v=1781018486",
    "sourceImageFile": "PallumSlabResized.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1022,
      "height": 585
    }
  },
  {
    "handle": "venezia-3cm-super-jumbo",
    "codes": [
      "Venezia 3cm Super Jumbo"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/venezia-3cm-super-jumbo_source_slab_ae67943f.webp",
    "physicalWidthIn": 138,
    "physicalDepthIn": 79,
    "sourceProductUrl": "https://buildpelican.com/products/venezia-3cm-super-jumbo",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/VeneziaSlab_2.jpg?v=1773776659",
    "sourceImageFile": "VeneziaSlab_2.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1022,
      "height": 585
    }
  },
  {
    "handle": "full-moon-3cm-jumbo-1",
    "codes": [
      "Calacatta Oro 3cm Super Jumbo"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/full-moon-3cm-jumbo-1_source_slab_4dd73868.webp",
    "physicalWidthIn": 138,
    "physicalDepthIn": 79,
    "sourceProductUrl": "https://buildpelican.com/products/full-moon-3cm-jumbo-1",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/CalacattaOroSlab.jpg?v=1782405928",
    "sourceImageFile": "CalacattaOroSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1022,
      "height": 585
    }
  },
  {
    "handle": "riverstone-3cm",
    "codes": [
      "Riverstone 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/riverstone-3cm_source_slab_df96fccb.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/riverstone-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/Riverstone_Slab2.jpg?v=1752236208",
    "sourceImageFile": "Riverstone_Slab2.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "sedona-3cm",
    "codes": [
      "Sedona 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/sedona-3cm_source_slab_ea098ca1.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/sedona-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/SedonaSlab2.jpg?v=1751466180",
    "sourceImageFile": "SedonaSlab2.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "strassa-3cm",
    "codes": [
      "Strassa 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/strassa-3cm_source_slab_14b8bd88.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/strassa-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/Strassa_Slab2.jpg?v=1752236403",
    "sourceImageFile": "Strassa_Slab2.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "virelle-3cm",
    "codes": [
      "Virelle 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/virelle-3cm_source_slab_f8eef1ce.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/virelle-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/Virelle_Slab2.jpg?v=1752237452",
    "sourceImageFile": "Virelle_Slab2.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "full-moon-3cm-jumbo",
    "codes": [
      "Full Moon 3cm Super Jumbo"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/full-moon-3cm-jumbo_source_slab_2740a064.webp",
    "physicalWidthIn": 138,
    "physicalDepthIn": 79,
    "sourceProductUrl": "https://buildpelican.com/products/full-moon-3cm-jumbo",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/FullMoonSlab.jpg?v=1741026939",
    "sourceImageFile": "FullMoonSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1022,
      "height": 585
    }
  },
  {
    "handle": "pure-white-3cm-jumbo",
    "codes": [
      "Pure White 3cm Super Jumbo"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/pure-white-3cm-jumbo_source_slab_ed358ac1.webp",
    "physicalWidthIn": 138,
    "physicalDepthIn": 79,
    "sourceProductUrl": "https://buildpelican.com/products/pure-white-3cm-jumbo",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/PureWhiteslab.jpg?v=1741026321",
    "sourceImageFile": "PureWhiteslab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1022,
      "height": 585
    }
  },
  {
    "handle": "venezia-3cm",
    "codes": [
      "Venezia 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/venezia-3cm_source_slab_32de386b.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/venezia-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/VeneziaSlab.jpg?v=1741027671",
    "sourceImageFile": "VeneziaSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "calista-3cm",
    "codes": [
      "Calista 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/calista-3cm_source_slab_56c5763f.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/calista-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/CalistaSlab.jpg?v=1741027823",
    "sourceImageFile": "CalistaSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "riviera-3cm",
    "codes": [
      "Riviera 3cm Left",
      "Riviera 3cm Right"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/riviera-3cm_source_slab_0db30cd3.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/riviera-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/RivieraSlab.jpg?v=1741027897",
    "sourceImageFile": "RivieraSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "raiden-3cm",
    "codes": [
      "Raiden 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/raiden-3cm_source_slab_e80e2d95.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/raiden-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/RaidenSlab.jpg?v=1741028111",
    "sourceImageFile": "RaidenSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "giotto-3cm",
    "codes": [
      "Giotto 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/giotto-3cm_source_slab_a297a1a1.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/giotto-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/Giotto-Slab.jpg?v=1741028396",
    "sourceImageFile": "Giotto-Slab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "calacatta-super-3cm",
    "codes": [
      "Calacatta Super 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/calacatta-super-3cm_source_slab_8494476d.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/calacatta-super-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/CalacattaSuperSlab.jpg?v=1741028965",
    "sourceImageFile": "CalacattaSuperSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "calacatta-oro-3cm",
    "codes": [
      "Calacatta Oro 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/calacatta-oro-3cm_source_slab_1f5fe3c1.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/calacatta-oro-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/CALACATTAORO3CM_A.jpg?v=1724677139",
    "sourceImageFile": "CALACATTAORO3CM_A.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "aurora-3cm",
    "codes": [
      "Aurora 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/aurora-3cm_source_slab_67d3e721.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/aurora-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/Auroraslab.png?v=1741029210",
    "sourceImageFile": "Auroraslab.png",
    "sourceImageSize": [
      2400,
      1600
    ],
    "crop": {
      "x": 240,
      "y": 560,
      "width": 1248,
      "height": 624
    }
  },
  {
    "handle": "pure-white-3cm",
    "codes": [
      "Pure White 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/pure-white-3cm_source_slab_1841519f.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/pure-white-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/PUREWHITE3CM_A.jpg?v=1724684368",
    "sourceImageFile": "PUREWHITE3CM_A.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "icelandic-3cm-jumbo",
    "codes": [
      "Icelandic 3cm Super Jumbo"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/icelandic-3cm-jumbo_source_slab_843ac3b9.webp",
    "physicalWidthIn": 138,
    "physicalDepthIn": 79,
    "sourceProductUrl": "https://buildpelican.com/products/icelandic-3cm-jumbo",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/IcelandicSlab.jpg?v=1741026575",
    "sourceImageFile": "IcelandicSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1022,
      "height": 585
    }
  },
  {
    "handle": "fossil-3cm-jumbo",
    "codes": [
      "Fossil 3cm Super Jumbo"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/fossil-3cm-jumbo_source_slab_222cef59.webp",
    "physicalWidthIn": 138,
    "physicalDepthIn": 79,
    "sourceProductUrl": "https://buildpelican.com/products/fossil-3cm-jumbo",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/Fossil_Slab_Img.jpg?v=1743602642",
    "sourceImageFile": "Fossil_Slab_Img.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1022,
      "height": 585
    }
  },
  {
    "handle": "full-moon-3cm-1",
    "codes": [
      "Full Moon 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/full-moon-3cm-1_source_slab_4ad10a39.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/full-moon-3cm-1",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/media_2bf039ff-54f7-4826-99ab-8dcd0153098f.jpg?v=1744996397",
    "sourceImageFile": "media_2bf039ff-54f7-4826-99ab-8dcd0153098f.jpg",
    "sourceImageSize": [
      2400,
      1600
    ],
    "crop": {
      "x": 240,
      "y": 560,
      "width": 1248,
      "height": 624
    }
  },
  {
    "handle": "super-white-3cm",
    "codes": [
      "Super White 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/super-white-3cm_source_slab_77fe3444.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/super-white-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/Super_White_Slab.jpg?v=1743603641",
    "sourceImageFile": "Super_White_Slab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "grey-mist-3cm",
    "codes": [
      "Grey Mist 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/grey-mist-3cm_source_slab_d8dda63a.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/grey-mist-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/GreyMistSlab.jpg?v=1741028338",
    "sourceImageFile": "GreyMistSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "siesta-key-3cm",
    "codes": [
      "Siesta Key 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/siesta-key-3cm_source_slab_cc287344.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/siesta-key-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/SiestaKeySlab.jpg?v=1741028024",
    "sourceImageFile": "SiestaKeySlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "icelandic-3cm",
    "codes": [
      "Icelandic 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/icelandic-3cm_source_slab_1d957397.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/icelandic-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/IcelandicSlab_e5985140-222a-43f1-a9a5-17d1c3b17b5b.jpg?v=1741028256",
    "sourceImageFile": "IcelandicSlab_e5985140-222a-43f1-a9a5-17d1c3b17b5b.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "fossil-3cm",
    "codes": [
      "Fossil 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/fossil-3cm_source_slab_1110a025.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/fossil-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/Fossil_Slab_Img.jpg?v=1743602642",
    "sourceImageFile": "Fossil_Slab_Img.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  },
  {
    "handle": "bedrock-3cm",
    "codes": [
      "Bedrock 3cm"
    ],
    "materialImageUrl": "/manus-storage/pelican/quartz/bedrock-3cm_source_slab_e61a47e8.webp",
    "physicalWidthIn": 126,
    "physicalDepthIn": 63,
    "sourceProductUrl": "https://buildpelican.com/products/bedrock-3cm",
    "sourceImageUrl": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/BedrockSlab.jpg?v=1741029114",
    "sourceImageFile": "BedrockSlab.jpg",
    "sourceImageSize": [
      2000,
      1500
    ],
    "crop": {
      "x": 200,
      "y": 525,
      "width": 1170,
      "height": 585
    }
  }
] as const;

function normalizePelicanQuartzCode(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Resolves only an exact official current code; legacy/local-only materials remain unresolved. */
export function pelicanQuartzMaterialMap(code: string | null | undefined): PelicanQuartzMaterialMap | null {
  const normalized = normalizePelicanQuartzCode(code);
  if (!normalized) return null;
  return PELICAN_QUARTZ_MATERIAL_MAPS.find((map) => map.codes.some((candidate) => normalizePelicanQuartzCode(candidate) === normalized)) ?? null;
}
