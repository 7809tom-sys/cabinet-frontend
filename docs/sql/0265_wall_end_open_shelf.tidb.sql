-- TiDB SQL editor version. Numbered 0265. Run AFTER 0264.
-- One statement per line. Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Does not insert new cabinet rows, does not invent prices, and does not DELETE any cabinet row.
--
-- Why: the Wall Open Shelf renders as a generic door box today, and the renderer now reads the shelf
-- count from each cabinet's edit config. This file gives the 9-wide rows whose shelf count is
-- documented the config the renderer expects: 0 doors, 0 drawers, 2 fixed shelves, and wall placement.
--
-- Naming: Faircrest's 2020 catalog calls this cabinet WOS. Distributor sheets and saved plans also
-- carry WEOS and the misspelling WOES. All three name the same box, so each non-WOS spelling gets an
-- alias row pointing at its WOS master. The frontend already resolves the family itself; these rows
-- make the same equivalence visible to pricing and to every server-side lookup.
--
-- Catalog status, for the record: WOS0930, WOS0936 and WOS0942 do not appear in any report under
-- data/dlc-fr26; only the WEOS spellings do, and those appear as "DL SKU not found in 20-20 list".
-- None of the family is in the Designer catalog fixtures, so this file updates rows that must
-- already exist and adds alias rows that point at them. Nothing here creates a cabinet row, a price,
-- or a distributor_skus row. If the read-only check returns no row for a code, that SKU is not in
-- the catalog yet and has to be imported from the distributor price list first.
--
-- The 12-wide codes WOS1230, WOS1236 and WOS1242 are absent from both data/dlc-fr26 and the Designer
-- catalog, so this file does not touch them. Adding them needs a distributor price list.
--
-- Alias rows are written as INSERT ... SELECT ... WHERE NOT EXISTS rather than INSERT IGNORE so the
-- file stays a plain one-statement-per-line script: each one inserts only when the alias is absent
-- AND its target master actually exists.

-- 1. WOS0930: 9" W x 30" H wall open shelf, no doors, no drawers, two fixed shelves.
UPDATE cabinet_dealz.cabinets SET placementType = 'wall', width = 9, height = 30, depth = 12, numberOfDoors = 0, numberOfDrawers = 0, numberOfFixedShelves = 2 WHERE masterCode = 'WOS0930';

-- 2. WOS0936: 9" W x 36" H wall open shelf, no doors, no drawers, two fixed shelves.
UPDATE cabinet_dealz.cabinets SET placementType = 'wall', width = 9, height = 36, depth = 12, numberOfDoors = 0, numberOfDrawers = 0, numberOfFixedShelves = 2 WHERE masterCode = 'WOS0936';

-- 3. WOS0942: 9" W x 42" H wall open shelf, no doors, no drawers. The box and face counts only: the
--    shelf count is left at whatever the row already has, because no source document in the
--    repository states the 42-inch shelf count.
UPDATE cabinet_dealz.cabinets SET placementType = 'wall', width = 9, height = 42, depth = 12, numberOfDoors = 0, numberOfDrawers = 0 WHERE masterCode = 'WOS0942';

-- 4. Alias the distributor spelling WEOS0930 to WOS0930.
INSERT INTO cabinet_dealz.sku_master_aliases (aliasCode, masterCode, notes, conflictStatus) SELECT 'WEOS0930', 'WOS0930', 'Distributor spelling of the Faircrest WOS open shelf', 'ok' FROM cabinet_dealz.cabinets AS alias_target WHERE alias_target.masterCode = 'WOS0930' AND NOT EXISTS (SELECT 1 FROM (SELECT aliasCode FROM cabinet_dealz.sku_master_aliases) AS existing_alias WHERE existing_alias.aliasCode = 'WEOS0930');

-- 5. Alias the misspelling WOES0930 to WOS0930.
INSERT INTO cabinet_dealz.sku_master_aliases (aliasCode, masterCode, notes, conflictStatus) SELECT 'WOES0930', 'WOS0930', 'Misspelling of the Faircrest WOS open shelf', 'ok' FROM cabinet_dealz.cabinets AS alias_target WHERE alias_target.masterCode = 'WOS0930' AND NOT EXISTS (SELECT 1 FROM (SELECT aliasCode FROM cabinet_dealz.sku_master_aliases) AS existing_alias WHERE existing_alias.aliasCode = 'WOES0930');

-- 6. Alias the distributor spelling WEOS0936 to WOS0936.
INSERT INTO cabinet_dealz.sku_master_aliases (aliasCode, masterCode, notes, conflictStatus) SELECT 'WEOS0936', 'WOS0936', 'Distributor spelling of the Faircrest WOS open shelf', 'ok' FROM cabinet_dealz.cabinets AS alias_target WHERE alias_target.masterCode = 'WOS0936' AND NOT EXISTS (SELECT 1 FROM (SELECT aliasCode FROM cabinet_dealz.sku_master_aliases) AS existing_alias WHERE existing_alias.aliasCode = 'WEOS0936');

-- 7. Alias the misspelling WOES0936 to WOS0936.
INSERT INTO cabinet_dealz.sku_master_aliases (aliasCode, masterCode, notes, conflictStatus) SELECT 'WOES0936', 'WOS0936', 'Misspelling of the Faircrest WOS open shelf', 'ok' FROM cabinet_dealz.cabinets AS alias_target WHERE alias_target.masterCode = 'WOS0936' AND NOT EXISTS (SELECT 1 FROM (SELECT aliasCode FROM cabinet_dealz.sku_master_aliases) AS existing_alias WHERE existing_alias.aliasCode = 'WOES0936');

-- 8. Alias the distributor spelling WEOS0942 to WOS0942.
INSERT INTO cabinet_dealz.sku_master_aliases (aliasCode, masterCode, notes, conflictStatus) SELECT 'WEOS0942', 'WOS0942', 'Distributor spelling of the Faircrest WOS open shelf', 'ok' FROM cabinet_dealz.cabinets AS alias_target WHERE alias_target.masterCode = 'WOS0942' AND NOT EXISTS (SELECT 1 FROM (SELECT aliasCode FROM cabinet_dealz.sku_master_aliases) AS existing_alias WHERE existing_alias.aliasCode = 'WEOS0942');

-- 9. Alias the misspelling WOES0942 to WOS0942.
INSERT INTO cabinet_dealz.sku_master_aliases (aliasCode, masterCode, notes, conflictStatus) SELECT 'WOES0942', 'WOS0942', 'Misspelling of the Faircrest WOS open shelf', 'ok' FROM cabinet_dealz.cabinets AS alias_target WHERE alias_target.masterCode = 'WOS0942' AND NOT EXISTS (SELECT 1 FROM (SELECT aliasCode FROM cabinet_dealz.sku_master_aliases) AS existing_alias WHERE existing_alias.aliasCode = 'WOES0942');

-- 10. Read-only. Expect one row per WOS master that exists, plus one row per alias that resolved.
--     A WOS code with no row means that SKU is not in the catalog yet.
SELECT wall_open_shelf.masterCode, wall_open_shelf.placementType, wall_open_shelf.width, wall_open_shelf.height, wall_open_shelf.numberOfDoors, wall_open_shelf.numberOfDrawers, wall_open_shelf.numberOfFixedShelves, wall_open_shelf.numberOfAdjShelves, wall_open_shelf.category, wall_open_shelf.subCategory, wall_open_shelf.showInDesigner, wall_open_shelf.designerEligible, (SELECT COUNT(*) FROM cabinet_dealz.distributor_skus AS priced_wall_open_sku WHERE priced_wall_open_sku.cabinetId = wall_open_shelf.id AND priced_wall_open_sku.isAvailable = 1 AND priced_wall_open_sku.isPublished = 1 AND (COALESCE(priced_wall_open_sku.listPrice, 0) > 0 OR COALESCE(priced_wall_open_sku.yourCost, 0) > 0)) AS published_priced_sku_count FROM cabinet_dealz.cabinets AS wall_open_shelf WHERE wall_open_shelf.masterCode IN ('WOS0930', 'WOS0936', 'WOS0942', 'WOS1230', 'WOS1236', 'WOS1242');

-- 11. Read-only. Expect six alias rows pointing at their WOS masters once blocks 4-9 have run.
SELECT open_shelf_alias.aliasCode, open_shelf_alias.masterCode, open_shelf_alias.notes FROM cabinet_dealz.sku_master_aliases AS open_shelf_alias WHERE open_shelf_alias.aliasCode IN ('WEOS0930', 'WOES0930', 'WEOS0936', 'WOES0936', 'WEOS0942', 'WOES0942') ORDER BY open_shelf_alias.aliasCode;
