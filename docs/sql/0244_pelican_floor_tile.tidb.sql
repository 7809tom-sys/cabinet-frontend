-- Mosaic floor flag on each Pelican product. Separate from imageUrl, materialImageUrl,
-- and roomSceneImageUrl. Unchecked (the default) keeps the sheet as a wall
-- backsplash only. Checked sheets may also be chosen as a floor tile.
-- Numbered 0244. Run after 0242 (pelican room-scene column) and BEFORE deploying
-- docs/patches/cabinet-backend-pelican-floor-tile.patch.
-- pelican.byCategory, pelican.adminList, and pelican.bySlug select every
-- pelican_products column, so those queries error until this column exists.
-- Paste each numbered block on its own in the TiDB SQL editor.
-- One statement per block. Do not paste this into an automatic migration.
-- The table is cabinet_dealz.pelican_products. Safe to re-run: IF NOT EXISTS.

-- 1
ALTER TABLE cabinet_dealz.pelican_products ADD COLUMN IF NOT EXISTS usableAsFloor TINYINT(1) NOT NULL DEFAULT 0;

-- 2
COMMIT;

-- 3
SELECT 'COMMITTED';
