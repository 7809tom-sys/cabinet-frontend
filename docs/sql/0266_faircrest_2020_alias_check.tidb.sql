-- TiDB SQL editor version. Numbered 0266. Run AFTER 0265.
-- One statement per line. Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
-- No existence guards, and NO writes: this file is read-only on purpose.
--
-- WHY THIS FILE EXISTS
-- The Faircrest 2020 alias layer (shared/faircrest2020Aliases.ts) resolves our
-- catalog codes to Faircrest's master codes in code only: search, OCR/cart
-- lines, vendor sheets and exports ask it "what does Faircrest call this".
-- It adds no cabinet row, no price and no distributor_skus row, and it does not
-- touch sku_master_aliases, because that table RETIRES the aliasCode it is given
-- (see 0230: WRC3015 -> LWR3015 removed). Faircrest's WOS/LS/BER/TB codes are
-- not rows of ours, so writing them there would retire nothing useful and could
-- hide a live code.
--
-- So nothing here NEEDS to be applied. These two SELECTs only answer the two
-- questions the mapping depends on:
--   1. does the catalog really carry the row each alias points at, and is it
--      sellable (published, priced, visible to the Designer)?
--   2. is any mapped code already retired by an existing sku_master_aliases
--      row, which would mean the alias and the existing retirement disagree?

-- 1) READ-ONLY: every code that has a Faircrest alias, with its catalog state.
--    Expect one row per code that exists; a missing code means the row is not in
--    the catalog yet and the alias has nothing to resolve onto.
SELECT aliased_cabinet.masterCode, aliased_cabinet.description, aliased_cabinet.category, aliased_cabinet.subCategory, aliased_cabinet.placementType, aliased_cabinet.isActive, aliased_cabinet.showInCatalog, aliased_cabinet.showInDesigner, aliased_cabinet.designerEligible, (SELECT COUNT(*) FROM cabinet_dealz.distributor_skus AS aliased_sku WHERE aliased_sku.cabinetId = aliased_cabinet.id AND aliased_sku.isAvailable = 1 AND aliased_sku.isPublished = 1 AND (COALESCE(aliased_sku.listPrice, 0) > 0 OR COALESCE(aliased_sku.yourCost, 0) > 0)) AS published_priced_sku_count FROM cabinet_dealz.cabinets AS aliased_cabinet WHERE aliased_cabinet.masterCode IN ('AG2418', 'AW1230', 'AW1236', 'AW1242', 'B9FH', 'BBC36', 'BBC45', 'BER33', 'BER36', 'BFH9', 'BM27', 'BMC27', 'BMC271DWR', 'BMC30', 'BMW30', 'BSD6', 'BSP6', 'BSR12', 'BSR9', 'BT09', 'BT12', 'BT15', 'BT9', 'BT9FH', 'CSB36', 'DCW2430', 'DCW2436', 'DCW2442', 'ER2430', 'ER2436', 'ER2442', 'ER36', 'ERB33', 'ERB36', 'ERW2430', 'ERW2436', 'ERW2442', 'LS36', 'LS3612', 'LSB33', 'LSB36', 'LZS33', 'LZS3612', 'MB30', 'TB9', 'WBC2730', 'WBC2736', 'WBC2742', 'WEOS0930', 'WEOS0936', 'WEOS0942', 'WER2430', 'WER2436', 'WER2442', 'WOES0930', 'WOES0936', 'WOES0942', 'WRC3015') ORDER BY aliased_cabinet.masterCode;

-- 2) READ-ONLY: any existing retirement that points at one of the codes above.
--    Expect no rows. A row here means sku_master_aliases already redirects that
--    code, and the Faircrest alias must be reviewed against that decision before
--    anyone relies on the mapping for pricing.
SELECT existing_alias.aliasCode, existing_alias.masterCode, existing_alias.conflictStatus, existing_alias.notes FROM cabinet_dealz.sku_master_aliases AS existing_alias WHERE existing_alias.aliasCode IN ('AG2418', 'AW1230', 'AW1236', 'AW1242', 'B9FH', 'BBC36', 'BBC45', 'BER33', 'BER36', 'BFH9', 'BM27', 'BMC27', 'BMC271DWR', 'BMC30', 'BMW30', 'BSD6', 'BSP6', 'BSR12', 'BSR9', 'BT09', 'BT12', 'BT15', 'BT9', 'BT9FH', 'CSB36', 'DCW2430', 'DCW2436', 'DCW2442', 'ER2430', 'ER2436', 'ER2442', 'ER36', 'ERB33', 'ERB36', 'ERW2430', 'ERW2436', 'ERW2442', 'LS36', 'LS3612', 'LSB33', 'LSB36', 'LZS33', 'LZS3612', 'MB30', 'TB9', 'WBC2730', 'WBC2736', 'WBC2742', 'WEOS0930', 'WEOS0936', 'WEOS0942', 'WER2430', 'WER2436', 'WER2442', 'WOES0930', 'WOES0936', 'WOES0942', 'WRC3015') OR existing_alias.masterCode IN ('AG2418', 'AW1230', 'AW1236', 'AW1242', 'B9FH', 'BBC36', 'BBC45', 'BER33', 'BER36', 'BFH9', 'BM27', 'BMC27', 'BMC271DWR', 'BMC30', 'BMW30', 'BSD6', 'BSP6', 'BSR12', 'BSR9', 'BT09', 'BT12', 'BT15', 'BT9', 'BT9FH', 'CSB36', 'DCW2430', 'DCW2436', 'DCW2442', 'ER2430', 'ER2436', 'ER2442', 'ER36', 'ERB33', 'ERB36', 'ERW2430', 'ERW2436', 'ERW2442', 'LS36', 'LS3612', 'LSB33', 'LSB36', 'LZS33', 'LZS3612', 'MB30', 'TB9', 'WBC2730', 'WBC2736', 'WBC2742', 'WEOS0930', 'WEOS0936', 'WEOS0942', 'WER2430', 'WER2436', 'WER2442', 'WOES0930', 'WOES0936', 'WOES0942', 'WRC3015') ORDER BY existing_alias.aliasCode;

-- 3) READ-ONLY: the wine-rack price check Tom asked for.
--    WRC3015 now aliases to Faircrest LWR3015 at the CODE level only. 0230 split
--    these two so Skyline's WRC3015 keeps its own supplier prices, and this PR
--    writes nothing to sku_master_aliases, so both rows must still stand alone
--    with their own priced supplier rows. Expect, for EACH master code: at least
--    one published row with a positive list or cost price. A published_priced_sku_count
--    of 0 means that code has no price on any line - report it, do not fix it here.
SELECT wine_rack_cabinet.masterCode, wine_rack_cabinet.description, wine_rack_cabinet.category, wine_rack_cabinet.subCategory, wine_rack_cabinet.isActive, wine_rack_cabinet.showInCatalog, wine_rack_cabinet.showInDesigner, COUNT(wine_rack_sku.id) AS total_sku_rows, SUM(CASE WHEN wine_rack_sku.isAvailable = 1 AND wine_rack_sku.isPublished = 1 AND (COALESCE(wine_rack_sku.listPrice, 0) > 0 OR COALESCE(wine_rack_sku.yourCost, 0) > 0) THEN 1 ELSE 0 END) AS published_priced_sku_count, MIN(wine_rack_sku.listPrice) AS lowest_list_price, MAX(wine_rack_sku.listPrice) AS highest_list_price FROM cabinet_dealz.cabinets AS wine_rack_cabinet LEFT JOIN cabinet_dealz.distributor_skus AS wine_rack_sku ON wine_rack_sku.cabinetId = wine_rack_cabinet.id WHERE wine_rack_cabinet.masterCode IN ('WRC3015', 'LWR3015') GROUP BY wine_rack_cabinet.id, wine_rack_cabinet.masterCode, wine_rack_cabinet.description, wine_rack_cabinet.category, wine_rack_cabinet.subCategory, wine_rack_cabinet.isActive, wine_rack_cabinet.showInCatalog, wine_rack_cabinet.showInDesigner ORDER BY wine_rack_cabinet.masterCode;

-- 4) READ-ONLY: the same two codes per supplier, so Tom can see exactly which
--    line carries the price for each one. Expect a priced row under each master.
SELECT wine_rack_cabinet.masterCode, wine_rack_supplier.code AS supplierCode, wine_rack_supplier.name AS supplierName, wine_rack_sku.code AS supplierSku, wine_rack_sku.isAvailable, wine_rack_sku.isPublished, wine_rack_sku.listPrice, wine_rack_sku.yourCost FROM cabinet_dealz.cabinets AS wine_rack_cabinet JOIN cabinet_dealz.distributor_skus AS wine_rack_sku ON wine_rack_sku.cabinetId = wine_rack_cabinet.id JOIN cabinet_dealz.distributors AS wine_rack_supplier ON wine_rack_supplier.id = wine_rack_sku.distributorId WHERE wine_rack_cabinet.masterCode IN ('WRC3015', 'LWR3015') ORDER BY wine_rack_cabinet.masterCode, wine_rack_supplier.code;
