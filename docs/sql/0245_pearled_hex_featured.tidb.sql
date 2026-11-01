-- Feature Pelican item 426 Pearled Hex on the storefront front door.
-- The Tile & Mosaic landing page (and the affiliate copy of that page) shows
-- "Featured picks" from pelican.byCategory `suggested`. That list is the
-- catalog rows with isPopular, capped at 12, ordered by popularRank. There is
-- no frontend id or slug array for that picker.
-- Numbered 0245. Run any time after pelican_products exists. Does not add a
-- column, so IF NOT EXISTS does not apply. The WHERE clause is the guard:
-- id 426 must also be slug pearled-hex, named Pearled Hex, in Tile & Mosaic /
-- Mosaic. A different row is not updated. Safe to re-run.
-- Does not write a vendor id or a person's name. Does not write
-- materialImageUrl (the transparent sheet is uploaded separately). The sheet
-- stays wall backsplash without water; this statement does not mark it as a floor.
-- Paste each numbered block on its own in the TiDB SQL editor.
-- One statement per block. Do not paste this into an automatic migration.
-- The table is cabinet_dealz.pelican_products.

-- Mark the existing Pearled Hex row featured. Keep a rank already stored.
-- A row that is not featured yet gets popularRank 2, after the rank-0
-- mosaics and before Carrara Subway (rank 4) and Thassos Subway (rank 5).
-- 1
UPDATE cabinet_dealz.pelican_products
SET
  isPopular = 1,
  popularRank = IF(isPopular = 1, popularRank, 2)
WHERE id = 426
  AND slug = 'pearled-hex'
  AND name = 'Pearled Hex'
  AND category = 'Tile & Mosaic'
  AND subCategory = 'Mosaic';

-- Read-only. Expect one row, isPopular = 1, slug pearled-hex.
-- 2
SELECT
  pelican_product.id,
  pelican_product.slug,
  pelican_product.name,
  pelican_product.category,
  pelican_product.subCategory,
  pelican_product.isPopular,
  pelican_product.popularRank,
  pelican_product.isActive,
  pelican_product.showInCatalog
FROM cabinet_dealz.pelican_products AS pelican_product
WHERE pelican_product.id = 426
  AND pelican_product.slug = 'pearled-hex';

-- 3
COMMIT;

-- 4
SELECT 'COMMITTED';
