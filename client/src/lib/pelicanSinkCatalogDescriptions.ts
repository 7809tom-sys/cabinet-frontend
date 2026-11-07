/**
 * Pelican's own bathroom-basin names and catalog copy.
 *
 * The imported StoneCreek rename called every "PL-3xxx" row a farmhouse apron
 * sink and gave every basin the same fireclay sentence. Pelican's tags and
 * specification sheets call the 17–24 inch Pearl and Sandbar models undermount
 * vanity basins. This module is the presentation layer for that correction; the
 * stored rows and their SKUs are untouched.
 */
import {
  pelicanVanitySinkCatalogTitle,
  pelicanVanitySinkProfile,
} from "@shared/pelicanBathroomFixtures";

/**
 * Pelican's own bathroom-sink catalog copy (buildpelican.com bathroom sinks,
 * undermount collection).
 */
const PELICAN_SINK_CATALOG_DESCRIPTIONS: Record<string, string> = {
  "PL-1647": "The Sandbar Series porcelain sinks are crafted with a modern look, featuring vertical sides resulting in more useable bowl space. The undermount installation gives a seamless, sleek look. Sandbar Series Sinks are ADA compliant.",
  "PL-1646": "The Sandbar Series porcelain sinks are crafted with a modern look, featuring vertical sides resulting in more useable bowl space. The undermount installation gives a seamless, sleek look. Sandbar Series Sinks are ADA compliant.",
  "PL-1637": "The Sandbar Series porcelain sinks are crafted with a modern look, featuring vertical sides resulting in more useable bowl space. The undermount installation gives a seamless, sleek look. Sandbar Series Sinks are ADA compliant.",
  "PL-3611": "The Sandbar Series porcelain sinks are crafted with a modern look, featuring vertical sides resulting in more useable bowl space. The undermount installation gives a seamless, sleek look. Sandbar Series Sinks are ADA compliant.",
  "PL-3639": "The Pelican Pearl Series PL-3639 Porcelain Undermount Sink is comprised of a Grade A Porcelain and goes through a vitreous china coating process which creates a glossy yet scratch resistant coating that is sure to last for years to come. This highly durable coating is made by heating a special type of refined clay to high temperatures. This layer is also nonporous meaning it is resistant to stains as well as fungi and bacteria growth. The Pearl Series Porcelain Sinks carry a limited lifetime warranty for as long as the original purchaser owns the home the sink was originally installed in.",
  "PL-3608": "The Pelican Pearl Series PL-3608 Porcelain Undermount Sink is comprised of a Grade A Porcelain and goes through a vitreous china coating process which creates a glossy yet scratch resistant coating that is sure to last for years to come. This highly durable coating is made by heating a special type of refined clay to high temperatures. This layer is also nonporous meaning it is resistant to stains as well as fungi and bacteria growth. The Pearl Series Porcelain Sinks carry a limited lifetime warranty for as long as the original purchaser owns the home the sink was originally installed in.",
  "PL-1634": "Our classic Pearl Series porcelain sinks are beautifully crafted from ceramic with a vitreous china coating, and sealed with an enamel glaze that provides a glossy look. Our Pearl Series sinks are equipped with an overflow drain and naturally easy to clean edges.",
  "PL-3044": "Introducing the Pelican Pearl Series PL-3044 Porcelain Undermount Sink. Crafted from Grade A Porcelain, it undergoes a vitreous china coating process for lasting durability. With a scratch-resistant and glossy finish, achieved through high-temperature treatment of refined clay, this sink ensures long-lasting beauty. Its nonporous surface repels stains, fungi, and bacteria growth. Backed by a limited lifetime warranty, it guarantees peace of mind for your home's lifetime.",
  "PL-3033": "Introducing the Pelican Pearl Series PL-3033 Porcelain Undermount Sink. Crafted from Grade A Porcelain, it undergoes a vitreous china coating process for enduring durability. Its scratch-resistant and glossy finish, created by heating refined clay to high temperatures, ensures long-lasting beauty. With a nonporous surface, it resists stains, fungi, and bacteria growth. Backed by a limited lifetime warranty, it provides lasting peace of mind for your home.",
  "PL-1606": "The Sandbar Series porcelain sinks are crafted with a modern look, featuring vertical sides resulting in more useable bowl space. The undermount installation gives a seamless, sleek look. Sandbar Series Sinks are ADA compliant.",
  "PL-3059": "Introducing the Pelican Pearl Series PL-3059 Porcelain Undermount Sink. Crafted from Grade A Porcelain, it boasts a vitreous china coating, ensuring a durable, scratch-resistant finish. Heat-treated for longevity, this nonporous surface resists stains, fungi, and bacteria growth. The latest editions include eye-catching Matte Black or Matte Grey.\nBacked by a limited lifetime warranty, it promises enduring quality for the life of your home!",
  "PL-3099": "Introducing the Pelican Pearl Series PL-3099 Porcelain Undermount Sink. Crafted from Grade A Porcelain, it boasts a vitreous china coating, ensuring a durable, scratch-resistant finish. Heat-treated for longevity, this nonporous surface resists stains, fungi, and bacteria growth. The latest editions include eye-catching Matte Black or Matte Grey.\nBacked by a limited lifetime warranty, it promises enduring quality for the life of your home!",
  "PL-3088": "Introducing the Pelican Pearl Series PL-3088 Porcelain Undermount Sink. Crafted from Grade A Porcelain, it undergoes a vitreous china coating process for enduring durability. Its scratch-resistant and glossy finish is achieved through high-temperature treatment of refined clay. With a nonporous surface, it repels stains, fungi, and bacteria growth. Backed by a limited lifetime warranty, it ensures lasting quality for your home.",
  "PL-3072": "Introducing the Pelican Pearl Series PL-3072 Porcelain Undermount Sink. Crafted from Grade A Porcelain, it undergoes a vitreous china coating process for enduring durability. Its scratch-resistant, glossy finish, created by heating refined clay to high temperatures, ensures long-lasting beauty. With a nonporous surface, it resists stains, fungi, and bacteria growth. Backed by a limited lifetime warranty, it provides lasting peace of mind for your home",
  "PL-3064": "Introducing the Pelican Pearl Series PL-3064 Porcelain Undermount Sink. Crafted from Grade A Porcelain, it undergoes a vitreous china coating process for enduring durability. Its scratch-resistant and glossy finish, achieved through high-temperature treatment of refined clay, ensures long-lasting beauty. With a nonporous surface, it resists stains, fungi, and bacteria growth. Backed by a limited lifetime warranty, it provides lasting peace of mind for your home.",
};

function sinkModelCode(pelicanCode: string | null | undefined): string | null {
  const match = (pelicanCode ?? "").trim().match(/^(PL-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Finish / packaging name Pelican sells for this exact SKU. Pelican's own
 * variant titles are the source: "Bone", "White", "Matte Black", "Matte Grey",
 * "Black", and "White (Foam Lined Box)" for the individually packed carton.
 */
const SINK_FINISH_BY_SUFFIX: Record<string, string> = {
  bone: "Bone White",
  white: "White",
  "matte black": "Matte Black",
  "matte grey": "Matte Grey",
  "matte gray": "Matte Grey",
  "gloss black": "Gloss Black",
  black: "Gloss Black",
  "individually packed": "White (Foam Lined Box)",
};

export function pelicanSinkFinishLabel(pelicanCode: string | null | undefined): string | null {
  const code = (pelicanCode ?? "").trim();
  const model = sinkModelCode(code);
  if (!model) return null;
  const suffix = code.slice(model.length).trim().toLowerCase();
  if (!suffix) return null;
  return SINK_FINISH_BY_SUFFIX[suffix] ?? null;
}

/** Pelican catalog description for a sink SKU, including finish variants. */
export function pelicanSinkCatalogDescription(pelicanCode: string | null | undefined): string | null {
  const model = sinkModelCode(pelicanCode);
  if (!model) return null;
  return PELICAN_SINK_CATALOG_DESCRIPTIONS[model] ?? null;
}

export function withPelicanSinkCatalogDescription<T extends { pelicanCode?: string | null; description?: string | null }>(product: T): T {
  const catalog = pelicanSinkCatalogDescription(product.pelicanCode);
  if (!catalog || product.description === catalog) return product;
  return { ...product, description: catalog };
}

/**
 * Pelican's model name for a vanity basin, replacing the imported "Farmhouse
 * Apron-Front" wording that the source does not support.
 *
 * Returns null for anything that is not a verified vanity basin, so kitchen
 * farmhouse sinks and unknown rows keep their own names.
 */
export function pelicanSinkCatalogName(pelicanCode: string | null | undefined): string | null {
  const base = pelicanVanitySinkCatalogTitle(pelicanCode, "StoneCreek")?.title;
  if (!base) return null;
  const finish = pelicanSinkFinishLabel(pelicanCode);
  return finish ? `${base} — ${finish}` : base;
}

/** Series, mount, and source-size line for a vanity basin, e.g. "Pearl Series · Undermount basin · 20 7/8\" × 15 5/8\"". */
export function pelicanSinkCatalogFactLine(pelicanCode: string | null | undefined): string | null {
  const details = pelicanVanitySinkCatalogTitle(pelicanCode);
  if (!details) return null;
  return `${details.series} · ${details.mountLabel} · ${details.sizeLabel}`;
}

/** "Pearl Series" style label for grouping a basin under its real Pelican series. */
export function pelicanSinkSeriesLabel(pelicanCode: string | null | undefined): string | null {
  return pelicanVanitySinkCatalogTitle(pelicanCode)?.series ?? null;
}

export function withPelicanSinkCatalogName<T extends { pelicanCode?: string | null; name: string }>(product: T): T {
  const name = pelicanSinkCatalogName(product.pelicanCode);
  if (!name || product.name === name) return product;
  return { ...product, name };
}

/** Replaces a basin's stored name and description in one pass. */
export function withPelicanSinkCatalogCopy<T extends { pelicanCode?: string | null; name: string; description?: string | null }>(product: T): T {
  return withPelicanSinkCatalogDescription(withPelicanSinkCatalogName(product));
}

/** True when this SKU is a verified vanity basin whose title we can state from Pelican data. */
export function hasPelicanSinkCatalogName(pelicanCode: string | null | undefined): boolean {
  return Boolean(pelicanVanitySinkProfile(pelicanCode));
}
