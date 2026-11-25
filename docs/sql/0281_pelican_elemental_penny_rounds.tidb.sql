-- DRAFT. Numbered 0281 in cabinet-frontend. NOT RUN against any database.
--
-- This file lives in cabinet-frontend only as a reviewable draft. The database and its SQL belong to
-- cabinet-backend, so it must be PORTED to cabinet-backend/docs/sql under that repo's next free number
-- (backend main already uses 0279 and 0280) and run ONLY with Tom's explicit go.
--
-- WHAT: adds the two Pelican Elemental Collection penny-round mosaics that the Designer's static mosaic
-- catalog (client/src/lib/mosaicCatalog.data.ts) now knows how to draw:
--   Carrara Penny Round, Calacatta Gold Penny Round.
-- Category 'Tile & Mosaic', sub-category 'Mosaic', like every other Pelican mosaic.
--
-- SOURCES (nothing here is invented):
--   * name / SKU / product page / photo: Pelican's storefront, https://buildpelican.com/products/<slug>
--   * size '11.14 x 12.09 x 8' and 'Marble Mosaic - Use on Wall & Floor': Pelican's own price list dated
--     7/1/2026 (cabinet-backend pelican_import/nls.txt and pelican_seed.json carry the same text).
--
-- PRICES ARE TBD. cost / list price / markup are NULL on purpose. TODO(Tom): supply the cost and markup.
--   (For reference only: Pelican's 7/1/2026 price list shows 10.43 for Carrara Penny Round and 15.46 for
--    Calacatta Gold Penny Round. Those figures are NOT loaded here. Tom decides whether they are cost or list.)
--
-- NOTHING GOES LIVE: isActive = 0, showInDesigner = 0, showInCatalog = 0. The Designer also requires a
-- positive sell price before a mosaic can be picked, so an unpriced row can never be selected.
-- Turn the three flags on only after the price is set.
--
-- Idempotent: each INSERT is skipped when a row with the same pelicanCode or slug already exists.
-- Every table is cabinet_dealz.<table>. No reserved words are used as aliases.

-- 0 - read-only preflight. Run this first. pelican_seed.json carries these two SKUs under
--     category 'Marketing & Merchandise' / 'Merchandise' (hidden). If this returns rows, the INSERTs below
--     do nothing; fix the existing rows instead (see the commented UPDATE at the bottom).
SELECT id, pelicanCode, slug, category, subCategory, size, listPrice, yourCost,
       isActive, showInCatalog, showInDesigner
FROM cabinet_dealz.pelican_products
WHERE pelicanCode IN ('Carrara Penny Round', 'Calacatta Gold Penny Round')
   OR slug IN ('carrara-penny-round', 'calacatta-gold-penny-round');

-- 1 - Carrara Penny Round
INSERT INTO cabinet_dealz.pelican_products
  (pelicanCode, slug, name, description, category, subCategory, size,
   listPrice, msrp, yourCost, vendorWholesale, retailPrice, markupPercent,
   tiered, isPopular, popularRank, imageUrl,
   showInDesigner, showInCatalog, isActive)
SELECT
  'Carrara Penny Round', 'carrara-penny-round', 'Carrara Penny Round',
  '11.14 x 12.09 x 8mm Marble Mosaic - Use on Wall & Floor',
  'Tile & Mosaic', 'Mosaic', '11.14 x 12.09 x 8',
  NULL, NULL, NULL, NULL, NULL, NULL,   -- TBD: cost / list / retail / markup come from Tom
  0, 0, 0,
  'https://cdn.shopify.com/s/files/1/0624/4476/5324/files/CarraraPennyRound.png?v=1770926276',
  0, 0, 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM cabinet_dealz.pelican_products
  WHERE pelicanCode = 'Carrara Penny Round' OR slug = 'carrara-penny-round'
);

-- 2 - Calacatta Gold Penny Round
INSERT INTO cabinet_dealz.pelican_products
  (pelicanCode, slug, name, description, category, subCategory, size,
   listPrice, msrp, yourCost, vendorWholesale, retailPrice, markupPercent,
   tiered, isPopular, popularRank, imageUrl,
   showInDesigner, showInCatalog, isActive)
SELECT
  'Calacatta Gold Penny Round', 'calacatta-gold-penny-round', 'Calacatta Gold Penny Round',
  '11.14 x 12.09 x 8mm Marble Mosaic - Use on Wall & Floor',
  'Tile & Mosaic', 'Mosaic', '11.14 x 12.09 x 8',
  NULL, NULL, NULL, NULL, NULL, NULL,   -- TBD: cost / list / retail / markup come from Tom
  0, 0, 0,
  'https://cdn.shopify.com/s/files/1/0624/4476/5324/files/CalcGoldPennyRound.png?v=1770925782',
  0, 0, 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM cabinet_dealz.pelican_products
  WHERE pelicanCode = 'Calacatta Gold Penny Round' OR slug = 'calacatta-gold-penny-round'
);

-- 3 - read-only check after running: both rows present, hidden, unpriced.
SELECT pelicanCode, category, subCategory, size, listPrice, yourCost, isActive, showInCatalog, showInDesigner
FROM cabinet_dealz.pelican_products
WHERE pelicanCode IN ('Carrara Penny Round', 'Calacatta Gold Penny Round');

-- OPTIONAL, ONLY IF THE PREFLIGHT SHOWED EXISTING 'Marketing & Merchandise' ROWS. Left commented out.
-- It re-files them as mosaics and keeps them hidden; it does not touch any price.
-- UPDATE cabinet_dealz.pelican_products
--    SET category = 'Tile & Mosaic', subCategory = 'Mosaic'
--  WHERE pelicanCode IN ('Carrara Penny Round', 'Calacatta Gold Penny Round')
--    AND category = 'Marketing & Merchandise';
