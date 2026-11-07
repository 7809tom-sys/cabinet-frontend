/**
 * Pelican's own bathroom-sink catalog copy (buildpelican.com bathroom sinks,
 * undermount collection). These replace the generic fireclay sentences stored
 * on the same SKUs.
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
