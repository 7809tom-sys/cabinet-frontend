-- TiDB SQL editor version. Numbered 0267. Run AFTER 0266.
-- One statement per line. Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
--
-- WHY THIS FILE EXISTS
-- Tom's rule: in a cabinet code, "T" means tray and "S" means spice. BSR9 is a
-- 9" base spice rack / spice pull-out (same look as a BT9, but with a pull-out),
-- NOT a tray base. Our repo's BT9 alias cell used to list BSR9, and the live
-- sku_master_aliases table may carry the same mistake.
--
-- 0267 is deliberately separate from 0266 (which is read-only). This is the only
-- file in the pair that removes a bad alias, and it only ever removes rows that
-- literally name BSR9 as an alias of BT9. It inserts nothing, changes no price,
-- and retires no cabinet.
--
-- Order: run 1) first. If it returns no rows, skip 2) entirely — there is
-- nothing to clean up.

-- 1. PREVIEW: every live alias row that maps BSR9 onto BT9 (any spelling).
--    Expect zero rows in a healthy database. A row here is the mistake this file fixes.
SELECT bad_alias.aliasCode, bad_alias.masterCode, bad_alias.conflictStatus, bad_alias.notes FROM cabinet_dealz.sku_master_aliases AS bad_alias WHERE UPPER(TRIM(bad_alias.aliasCode)) IN ('BSR9', 'BSR-9') AND UPPER(TRIM(bad_alias.masterCode)) IN ('BT9', 'BT09', 'BT-9', 'TB9', 'TB09');

-- 2. FIX: drop only those rows. A second run is a no-op because the row is gone.
DELETE FROM cabinet_dealz.sku_master_aliases WHERE UPPER(TRIM(aliasCode)) IN ('BSR9', 'BSR-9') AND UPPER(TRIM(masterCode)) IN ('BT9', 'BT09', 'BT-9', 'TB9', 'TB09');

-- 3. PREVIEW: the three spice codes must stand on their own after the delete.
--    Expect BSR9, BSR12 and BSD6 (plus SPO9 if the catalog carries it) with
--    their own rows and no alias redirecting them away. A published_priced_sku_count
--    of 0 means that code has no price on any line — report it, do not fix it here.
SELECT spice_cabinet.masterCode, spice_cabinet.description, spice_cabinet.subCategory, spice_cabinet.isActive, spice_cabinet.showInCatalog, spice_cabinet.showInDesigner, (SELECT COUNT(*) FROM cabinet_dealz.sku_master_aliases AS redirect WHERE UPPER(TRIM(redirect.aliasCode)) = UPPER(TRIM(spice_cabinet.masterCode))) AS alias_rows_pointing_away, (SELECT COUNT(*) FROM cabinet_dealz.distributor_skus AS spice_sku WHERE spice_sku.cabinetId = spice_cabinet.id AND spice_sku.isAvailable = 1 AND spice_sku.isPublished = 1 AND (COALESCE(spice_sku.listPrice, 0) > 0 OR COALESCE(spice_sku.yourCost, 0) > 0)) AS published_priced_sku_count FROM cabinet_dealz.cabinets AS spice_cabinet WHERE spice_cabinet.masterCode IN ('BSR9', 'BSR12', 'BSD6', 'SPO9', 'BT9') ORDER BY spice_cabinet.masterCode;

-- 4. PREVIEW: nothing anywhere else should alias BSR9 to a tray family.
--    Expect no rows. This is the safety net after the delete above.
SELECT remaining.aliasCode, remaining.masterCode, remaining.conflictStatus FROM cabinet_dealz.sku_master_aliases AS remaining WHERE UPPER(TRIM(remaining.aliasCode)) = 'BSR9' ORDER BY remaining.masterCode;
