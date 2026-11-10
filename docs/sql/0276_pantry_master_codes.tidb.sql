-- TiDB SQL editor version. Numbered 0276. Run after 0275.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
-- This file was NOT executed against production.
-- Add only. A second paste of an INSERT matches nothing. The CREATE is the
-- one new table: a second paste of that line answers that the table already
-- exists, and the INSERTs still skip rows that are already there.
-- Nothing here changes or removes a row.
--
-- No bundle, kit, or composite cabinet table was in the repo. sku_master_aliases
-- points one alias at one master and does not list components or sum prices.
-- Kitchen packages are whole layouts, not a SKU the customer orders.
-- W1830 is the regular 18 x 30 x 12 wall cabinet. Code 1830 is not a pantry
-- master and this file does not insert it. Tom's "1830 = UCB1854 + 30 inch top"
-- is the same stack as 1884, so 1830 is left alone.
--
-- 1884 is the code Tom named: UCB1854 (54 inch base) + W183024 (30 inch top).
-- 1890 and 1896 use the same height sum and are waiting on Tom:
--   1890 = UCB1854 + W183624 (36 inch top) = 90 inches
--   1896 = UCB1854 + W184224 (42 inch top) = 96 inches
-- confirmedFlag 1 means Tom named it. 0 means it still needs his yes.
--
-- Prices are not stored on the master. The order price for one distributor and
-- one door style is the sum of the two component prices. If either component
-- has no price, that sum is NULL. shared/pantryMasterCodes.ts does that sum.

CREATE TABLE cabinet_dealz.pantry_master_components (id INT NOT NULL AUTO_INCREMENT, masterCode VARCHAR(32) NOT NULL, componentCode VARCHAR(32) NOT NULL, componentRole VARCHAR(16) NOT NULL, sortOrder INT NOT NULL, confirmedFlag TINYINT NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY pantry_master_components_pair (masterCode, componentCode));

INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1884', 'UCB1854', 'base', 1, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1884' AND existing_part.componentCode = 'UCB1854');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1884', 'W183024', 'top', 2, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1884' AND existing_part.componentCode = 'W183024');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1890', 'UCB1854', 'base', 1, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1890' AND existing_part.componentCode = 'UCB1854');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1890', 'W183624', 'top', 2, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1890' AND existing_part.componentCode = 'W183624');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1896', 'UCB1854', 'base', 1, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1896' AND existing_part.componentCode = 'UCB1854');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1896', 'W184224', 'top', 2, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1896' AND existing_part.componentCode = 'W184224');

INSERT INTO cabinet_dealz.cabinets (masterCode, description, category, subCategory, placementType, width, height, depth, isCornerCabinet, isActive, showInCatalog, showInDesigner, conflictStatus) SELECT '1884', '84" pantry stack: UCB1854 base + W183024 top', 'Tall', NULL, 'tall', 18, 84, 24, 0, 1, 1, 1, 'none' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.cabinets AS existing_cabinet WHERE existing_cabinet.masterCode = '1884');
INSERT INTO cabinet_dealz.cabinets (masterCode, description, category, subCategory, placementType, width, height, depth, isCornerCabinet, isActive, showInCatalog, showInDesigner, conflictStatus) SELECT '1890', '90" pantry stack: UCB1854 base + W183624 top', 'Tall', NULL, 'tall', 18, 90, 24, 0, 1, 1, 1, 'none' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.cabinets AS existing_cabinet WHERE existing_cabinet.masterCode = '1890');
INSERT INTO cabinet_dealz.cabinets (masterCode, description, category, subCategory, placementType, width, height, depth, isCornerCabinet, isActive, showInCatalog, showInDesigner, conflictStatus) SELECT '1896', '96" pantry stack: UCB1854 base + W184224 top', 'Tall', NULL, 'tall', 18, 96, 24, 0, 1, 1, 1, 'none' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.cabinets AS existing_cabinet WHERE existing_cabinet.masterCode = '1896');

SELECT pantry_part.masterCode, pantry_part.componentCode, pantry_part.componentRole, pantry_part.sortOrder, pantry_part.confirmedFlag FROM cabinet_dealz.pantry_master_components AS pantry_part WHERE pantry_part.masterCode IN ('1884', '1890', '1896') ORDER BY pantry_part.masterCode, pantry_part.sortOrder;
