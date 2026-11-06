/**
 * KBIS 2027 booth marketing assets.
 *
 * The trade show files are plain files in `client/public/marketing/kbis-2027`, so
 * the site serves them at `/marketing/kbis-2027/<file>` from Vercel without a
 * backend or storage round trip. The paths keep a static extension on purpose:
 * the Vercel catch-all rewrite skips paths with a file extension, and the
 * affiliate-subdomain redirect skips them too.
 *
 * `docs/sql/0249_kbis_2027_booth_assets.tidb.sql` registers the same files in the
 * database-backed library (`cabinet_dealz.media_images` and
 * `cabinet_dealz.affiliate_resources`). This manifest is the fallback the
 * Marketing Hub renders until that SQL is run, so the assets are visible and
 * copyable the moment the frontend deploys.
 */

export const KBIS_BOOTH_ASSET_ROOT = "/marketing/kbis-2027";
export const KBIS_BOOTH_FOLDER = "KBIS 2027 Booth";
export const KBIS_BOOTH_SLUG = "kbis-2027-booth";

/** Labels an asset can carry in the library, used for the filter row. */
export const KBIS_BOOTH_TAGS = {
  conceptRendering: "Concept rendering",
  supplierReady: "Supplier-ready",
  copy: "Copy",
} as const;

export type KbisBoothTag = (typeof KBIS_BOOTH_TAGS)[keyof typeof KBIS_BOOTH_TAGS];

export type KbisBoothImage = {
  /** Stable id; also the slug used to spot the row in the SQL file. */
  slug: string;
  /** File name inside `client/public/marketing/kbis-2027`. */
  file: string;
  /** Public path the browser requests. */
  url: string;
  title: string;
  description: string;
  mimeType: "image/jpeg" | "image/png";
  sizeBytes: number;
  /** Every booth image is a rendering of a planned booth, not a photo of a built one. */
  conceptRendering: boolean;
  /** Safe to hand to a potential supplier; drives the library's supplier filter. */
  supplierReady: boolean;
  featured: boolean;
  sortOrder: number;
};

export type KbisBoothDocument = {
  slug: string;
  file: string;
  url: string;
  title: string;
  description: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  pageCount: number;
  supplierReady: boolean;
  featured: boolean;
  sortOrder: number;
};

function boothImage(image: Omit<KbisBoothImage, "url" | "conceptRendering">): KbisBoothImage {
  return {
    ...image,
    url: `${KBIS_BOOTH_ASSET_ROOT}/${image.file}`,
    conceptRendering: true,
  };
}

export const KBIS_BOOTH_IMAGES: readonly KbisBoothImage[] = [
  boothImage({
    slug: "closets-added",
    file: "cabinetdealz-kbis-booth-closets.jpg",
    title: "KBIS 2027 Booth — Closets Added",
    description:
      "Featured layout. The header lists every line the booth sells — Cabinets · Quartz · Tile · Flooring · Hardware · Closets — with a kitchen on one side, a lit closet display on the other, and “Closets: Design. Quote. Order.” on the closet front.",
    mimeType: "image/jpeg",
    sizeBytes: 255261,
    supplierReady: true,
    featured: true,
    sortOrder: 10,
  }),
  boothImage({
    slug: "final-layout",
    file: "cabinetdealz-kbis-booth-final.jpg",
    title: "KBIS 2027 Booth — Final Layout",
    description:
      "Affiliate poster on the right and the “Sign up today. Leave the show with your website LIVE.” counter sign, next to the quick-design TV and the purchasing-group sign.",
    mimeType: "image/jpeg",
    sizeBytes: 332797,
    supplierReady: true,
    featured: false,
    sortOrder: 20,
  }),
  boothImage({
    slug: "backdrop-and-counter",
    file: "cabinetdealz-kbis-booth-pop.png",
    title: "KBIS 2027 Booth — Backdrop, TV, and Counter",
    description:
      "The backdrop poster, the “Kitchen designed in 5 minutes” screen with its live price quote, the brochure stacks, and the counter cards.",
    mimeType: "image/png",
    sizeBytes: 974508,
    supplierReady: true,
    featured: false,
    sortOrder: 30,
  }),
  boothImage({
    slug: "concept-live-price",
    file: "cabinetdealz-kbis-booth-concept.jpg",
    title: "KBIS 2027 Booth — Concept with Live Price Screen",
    description:
      "Slate shaker cabinets, quartz top, and the “LIVE PRICE QUOTE” screen, with a rep walking an attendee through the design on a tablet.",
    mimeType: "image/jpeg",
    sizeBytes: 299225,
    supplierReady: true,
    featured: false,
    sortOrder: 40,
  }),
];

export const KBIS_BOOTH_DOCUMENTS: readonly KbisBoothDocument[] = [
  {
    slug: "opportunity-deck",
    file: "cabinetdealz-kbis-2027-opportunity-deck.pdf",
    url: `${KBIS_BOOTH_ASSET_ROOT}/cabinetdealz-kbis-2027-opportunity-deck.pdf`,
    title: "KBIS 2027 Opportunity Deck",
    description:
      "The 9-slide show-at-a-glance deck: dates and venue, who walks the floor, the conservative attendee-to-store funnel, the platform-profit model, and the white-label pitch. Share it with a potential supplier as-is — the file is published unchanged.",
    mimeType: "application/pdf",
    sizeBytes: 449980,
    pageCount: 9,
    supplierReady: true,
    featured: false,
    sortOrder: 50,
  },
];

export type KbisBoothCopyLine = {
  slug: string;
  title: string;
  text: string;
  sortOrder: number;
};

export const KBIS_BOOTH_COPY_LINES: readonly KbisBoothCopyLine[] = [
  {
    slug: "be-the-face",
    title: "Affiliate poster line",
    text: "Be an affiliate. Be the face of Cabinetdealz.",
    sortOrder: 10,
  },
  {
    slug: "purchasing-power",
    title: "Purchasing power line",
    text: "Cabinetdealz purchasing power and technology for your local influence.",
    sortOrder: 20,
  },
  {
    slug: "closets-like-kitchens",
    title: "Closets line",
    text: "Cabinetdealz covers closets the same way as kitchens: design, quote, order, all in one, with the same white-label affiliate model.",
    sortOrder: 30,
  },
];

export const KBIS_BOOTH_FEATURED_IMAGE: KbisBoothImage =
  KBIS_BOOTH_IMAGES.find((image) => image.featured) ?? KBIS_BOOTH_IMAGES[0];

/** True for a URL that the gallery can render as a picture. */
export function isBoothImageUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\.(?:png|jpe?g|webp|gif|avif)$/i.test(url.trim()));
}

/** True for a URL that is a shared document rather than a picture or a text asset. */
export function isBoothDocumentUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\.pdf$/i.test(url.trim()));
}

/** "449 KB" / "1.0 MB" — shown beside a document so the file size is obvious before download. */
export function formatAssetSize(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
