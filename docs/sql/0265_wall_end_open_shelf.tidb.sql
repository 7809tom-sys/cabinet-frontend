-- TiDB SQL editor version. Numbered 0265. Run AFTER 0264.
-- One statement per line. Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Does not insert new cabinet rows, does not invent prices, and does not DELETE any cabinet or distributor_skus row.
--
-- Why: WEOS0930 renders as a generic door box today, and the renderer now reads the shelf count
-- from each cabinet's edit config. This file gives the two Wall End Open Shelf rows whose shelf
-- count is documented a config the renderer expects: 0 doors, 0 drawers, 2 fixed shelves, wall
-- placement, and verified 9" W x 12" D at 30/36 inches high.
--
-- Catalog status, for the record: WEOS0930, WEOS0936 and WEOS0942 appear in
-- data/dlc-fr26/reports/cabinet_code_mismatches.csv as "DL SKU not found in 20-20 list". They are
-- NOT in the Designer catalog fixtures, so these are UPDATE statements against rows that must
-- already exist. Nothing here creates a cabinet row, a price, or a distributor_skus row. If the
-- read-only check below returns no row for a code, that SKU is not in the catalog yet and has to be
-- imported from the distributor price list before the Designer can place it.

-- 1. WEOS0930: 9" W x 30" H x 12" D wall end open shelf, no doors, no drawers, two fixed shelves.
UPDATE cabinet_dealz.cabinets SET placementType = 'wall', width = 9, height = 30, depth = 12, numberOfDoors = 0, numberOfDrawers = 0, numberOfFixedShelves = 2 WHERE masterCode = 'WEOS0930';

-- 2. WEOS0936: 9" W x 36" H x 12" D wall end open shelf, no doors, no drawers, two fixed shelves.
UPDATE cabinet_dealz.cabinets SET placementType = 'wall', width = 9, height = 36, depth = 12, numberOfDoors = 0, numberOfDrawers = 0, numberOfFixedShelves = 2 WHERE masterCode = 'WEOS0936';

-- 3. WEOS0942: 9" W x 42" H x 12" D wall end open shelf, no doors, no drawers. The box and the face
--    counts only: this file deliberately leaves the shelf count at whatever the row already has,
--    because no source document in the repository states the 42-inch shelf count.
UPDATE cabinet_dealz.cabinets SET placementType = 'wall', width = 9, height = 42, depth = 12, numberOfDoors = 0, numberOfDrawers = 0 WHERE masterCode = 'WEOS0942';

-- 4. Read-only. Expect one row per code that exists, each with wall placement, 9 by 12, zero doors,
--    zero drawers, and the shelf count. A code with no row means that SKU is not in the catalog yet.
SELECT wall_end_shelf.masterCode, wall_end_shelf.placementType, wall_end_shelf.width, wall_end_shelf.height, wall_end_shelf.depth, wall_end_shelf.numberOfDoors, wall_end_shelf.numberOfDrawers, wall_end_shelf.numberOfFixedShelves, wall_end_shelf.numberOfAdjShelves, wall_end_shelf.category, wall_end_shelf.subCategory, wall_end_shelf.showInDesigner, wall_end_shelf.designerEligible, (SELECT COUNT(*) FROM cabinet_dealz.distributor_skus AS priced_wall_end_sku WHERE priced_wall_end_sku.cabinetId = wall_end_shelf.id AND priced_wall_end_sku.isAvailable = 1 AND priced_wall_end_sku.isPublished = 1 AND (COALESCE(priced_wall_end_sku.listPrice, 0) > 0 OR COALESCE(priced_wall_end_sku.yourCost, 0) > 0)) AS published_priced_sku_count FROM cabinet_dealz.cabinets AS wall_end_shelf WHERE wall_end_shelf.masterCode IN ('WEOS0930', 'WEOS0936', 'WEOS0942');
