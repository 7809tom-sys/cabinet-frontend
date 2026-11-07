/**
 * Official Pelican product photos on buildpelican.com, used when a catalog row
 * has no imageUrl of its own. The designer sidebar then still shows the
 * product photo instead of an empty placeholder.
 * Matte-black rows fall back to the white photo only when Pelican has not
 * published a separate black image.
 */
const CDN = "https://buildpelican.com/cdn/shop/files";

const TOILET_CATALOG_PHOTOS: Record<string, string> = {
  "PL-12005": `${CDN}/PL-12005.png`,
  "PL-12005 MB": `${CDN}/PL-12005.png`,
  "PL-12011": `${CDN}/PL-12011_A.jpg`,
  "PL-12011 MB": `${CDN}/PL-12011MB_A.jpg`,
  "PL-12027": `${CDN}/PL-12027.png`,
  "PL-12044": `${CDN}/PL-12044_A.jpg`,
  "PL-12044 MB": `${CDN}/PL-12044MB_A.jpg`,
  "PL-12050": `${CDN}/PL-12050_A.jpg`,
  "PL-12210": `${CDN}/PL-12210_A.jpg`,
  "PL-12305": `${CDN}/PL-12305.png`,
  "PL-12305 MB": `${CDN}/12305Black.png`,
  "PL-12318": `${CDN}/PL-12318.png`,
  "PL-12335": `${CDN}/PL-12335_A.jpg`,
  "PL-12382": `${CDN}/PL-12382.png`,
  "PL-A249 ADA": `${CDN}/PL-A249.png`,
};

export function pelicanToiletCatalogPhoto(pelicanCode: string | null | undefined): string | null {
  if (!pelicanCode) return null;
  return TOILET_CATALOG_PHOTOS[pelicanCode.trim()] ?? null;
}
