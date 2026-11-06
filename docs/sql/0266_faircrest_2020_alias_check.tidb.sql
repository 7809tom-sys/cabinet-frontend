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
SELECT aliased_cabinet.masterCode, aliased_cabinet.description, aliased_cabinet.category, aliased_cabinet.subCategory, aliased_cabinet.placementType, aliased_cabinet.isActive, aliased_cabinet.showInCatalog, aliased_cabinet.showInDesigner, aliased_cabinet.designerEligible, (SELECT COUNT(*) FROM cabinet_dealz.distributor_skus AS aliased_sku WHERE aliased_sku.cabinetId = aliased_cabinet.id AND aliased_sku.isAvailable = 1 AND aliased_sku.isPublished = 1 AND (COALESCE(aliased_sku.listPrice, 0) > 0 OR COALESCE(aliased_sku.yourCost, 0) > 0)) AS published_priced_sku_count FROM cabinet_dealz.cabinets AS aliased_cabinet WHERE aliased_cabinet.masterCode IN ('WEOS0930', 'WEOS0936', 'WEOS0942', 'WOES0930', 'WOES0936', 'WOES0942', 'AW1230', 'AW1236', 'AW1242', 'DCW2430', 'DCW2436', 'DCW2442', 'LSB33', 'LSB36', 'LS3612', 'LS36', 'BER33', 'BER36', 'ERB33', 'ERB36', 'WER2430', 'WER2436', 'WER2442', 'AG2418', 'BT9', 'BBC36', 'WBC2730', 'WBC2736', 'WBC2742') ORDER BY aliased_cabinet.masterCode;

-- 2) READ-ONLY: any existing retirement that points at one of the codes above.
--    Expect no rows. A row here means sku_master_aliases already redirects that
--    code, and the Faircrest alias must be reviewed against that decision before
--    anyone relies on the mapping for pricing.
SELECT existing_alias.aliasCode, existing_alias.masterCode, existing_alias.conflictStatus, existing_alias.notes FROM cabinet_dealz.sku_master_aliases AS existing_alias WHERE existing_alias.aliasCode IN ('WEOS0930', 'WEOS0936', 'WEOS0942', 'WOES0930', 'WOES0936', 'WOES0942', 'AW1230', 'AW1236', 'AW1242', 'DCW2430', 'DCW2436', 'DCW2442', 'LSB33', 'LSB36', 'LS3612', 'LS36', 'BER33', 'BER36', 'ERB33', 'ERB36', 'WER2430', 'WER2436', 'WER2442', 'AG2418', 'BT9', 'BBC36', 'WBC2730', 'WBC2736', 'WBC2742') OR existing_alias.masterCode IN ('WEOS0930', 'WEOS0936', 'WEOS0942', 'WOES0930', 'WOES0936', 'WOES0942', 'AW1230', 'AW1236', 'AW1242', 'DCW2430', 'DCW2436', 'DCW2442', 'LSB33', 'LSB36', 'LS3612', 'LS36', 'BER33', 'BER36', 'ERB33', 'ERB36', 'WER2430', 'WER2436', 'WER2442', 'AG2418', 'BT9', 'BBC36', 'WBC2730', 'WBC2736', 'WBC2742') ORDER BY existing_alias.aliasCode;
