import { PELICAN_VANITY_FAUCET_SKUS } from "@shared/pelicanBathroomFixtures";

/**
 * The Bathroom Fixtures browser asks `surfaces.recommended` for one role.
 * That query reads the first 480 active Sinks & Faucets rows, popularity
 * first. The floor-mount tub fillers sit inside that window. The vanity
 * faucets sit past it (PL-8112 is around row 491), so the tab never sees
 * them even though each row is active, priced, and photographed.
 *
 * These searches hit `pelican.byCategory`, which finds a SKU by name
 * instead of by that popularity window.
 */
export const BATHROOM_FAUCET_CATALOG_SEARCHES = [
  "Bathroom Faucet",
  "Vanity Faucet",
  "Vessel Faucet",
  "Tub Faucet",
] as const;

/**
 * Priced bathroom faucet rows that are in the live catalog but are not in
 * the specification-sheet list. They stay selectable. They are not given a
 * made-up price or a borrowed photo.
 */
const ADDITIONAL_BATHROOM_FAUCET_SKUS = [
  "PL-8114 BN",
  "PL-8114 CHR",
  "PL-8164 BN",
  "PL-8303 BN",
  "PL-8303 CHR",
] as const;

const VANITY_FAUCET_SKUS = new Set<string>([
  ...PELICAN_VANITY_FAUCET_SKUS,
  ...ADDITIONAL_BATHROOM_FAUCET_SKUS,
]);

/** Floor-mounted tub fillers already sold as PL-8515, PL-8522, and PL-8538. */
function isFloorTubFaucet(code: string): boolean {
  return /^(?:PL-8515|PL-8522|PL-8538)\s+\S+$/i.test(code);
}

export function isBathroomDesignerFaucet(code: string | null | undefined): boolean {
  const normalized = (code ?? "").trim();
  return VANITY_FAUCET_SKUS.has(normalized) || isFloorTubFaucet(normalized);
}

export function mergeBathroomFaucetRows<T extends { id: number; pelicanCode?: string | null; sellPrice?: number | null }>(
  recommended: readonly T[],
  catalogMatches: readonly T[],
): T[] {
  const byId = new Map<number, T>();
  for (const row of [...recommended, ...catalogMatches]) {
    if (!isBathroomDesignerFaucet(row.pelicanCode)) continue;
    if ((row.sellPrice ?? 0) <= 0) continue;
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

/**
 * `surfaces.recommended` replaces some toilet and tub photos with
 * `/manus-storage/tub-pl-*` and `/manus-storage/toilet-pl-*` files that are
 * not on the site. The product's own catalog file, or the Pelican product
 * image, is the photo the card should use.
 */
const REPLACEMENT_CATALOG_PHOTO: Record<string, string> = {
  'PL-02141 59"': "/manus-storage/pelican/464_9428b503.png",
  'PL-02141 67"': "/manus-storage/pelican/465_331d40be.png",
  'PL-02563 59"': "/manus-storage/pelican/470_f364f9bf.png",
  'PL-02563 67"': "/manus-storage/pelican/471_799a74eb.png",
  "PL-02849L": "/manus-storage/pelican/472_1e5d9a0a.png",
  "PL-02849R": "/manus-storage/pelican/474_984a498d.png",
  "PL-02851L": "/manus-storage/pelican/480_e93170d9.png",
  "PL-02851R": "/manus-storage/pelican/482_54e470ef.png",
  "PL-12005 MB": "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/PL-12005Black_2.png",
  "PL-12027": "/manus-storage/pelican/561_c6af1e4c.png",
  "PL-12050": "/manus-storage/pelican/564_7ed6b8fb.png",
  "PL-12210": "/manus-storage/pelican/565_65d72e4b.png",
  "PL-12230": "/manus-storage/pelican/567_2ab9723b.png",
  "PL-12248": "/manus-storage/pelican/569_d7e9b486.png",
  "PL-12249": "/manus-storage/pelican/570_d3649675.png",
  "PL-12305": "https://buildpelican.com/cdn/shop/files/PL-12305.png",
  "PL-12305 MB": "https://buildpelican.com/cdn/shop/files/12305Black.png",
  "PL-12318": "/manus-storage/pelican/573_fcbdbeac.png",
  "PL-12335": "/manus-storage/pelican/574_6ac04364.png",
  "PL-12382": "/manus-storage/pelican/575_2a19366f.png",
  "PL-A249 ADA": "https://buildpelican.com/cdn/shop/files/PL-A249.png",
};

function deadOfficialOverride(imageUrl: string | null | undefined): boolean {
  return typeof imageUrl === "string" && /\/manus-storage\/(?:tub-pl-|toilet-pl-)/.test(imageUrl);
}

export function bathroomFixtureCardImage(
  pelicanCode: string | null | undefined,
  imageUrl: string | null | undefined,
): string | null {
  const replacement = pelicanCode ? REPLACEMENT_CATALOG_PHOTO[pelicanCode.trim()] : undefined;
  if (imageUrl && !deadOfficialOverride(imageUrl)) return imageUrl;
  return replacement ?? imageUrl ?? null;
}
