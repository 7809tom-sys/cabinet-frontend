-- TiDB SQL editor version. Numbered 0276. Run after 0275.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
-- This file was NOT executed against production.
-- Add only. CREATE TABLE IF NOT EXISTS is a no-op when the table is already
-- there. A second paste of an INSERT matches nothing.
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
-- Each assembly also gets a distributor_skus row for every Faircrest distributorId
-- and styleId where BOTH the base and the top already have a distributor_skus row.
-- Faircrest is distributors.name or distributors.brandName of Faircrest, Clark and
-- Son, or Clark & Son, or distributors.code CS. No distributor id is hardcoded.
-- If Faircrest carries neither part, the insert adds nothing.
-- listPrice and yourCost are the plain sum of the two component amounts, so
-- either NULL makes that stored amount NULL. isAvailable and isPublished are 1
-- only when both components are 1 and at least one summed amount is not NULL.
-- A row whose listPrice and yourCost are both NULL is unpublished. That stored
-- price is a snapshot taken at paste time.
-- shared/pantryMasterCodes.ts still computes the live sum, and a later price
-- change on a component will not update the stored bundle row.

CREATE TABLE IF NOT EXISTS cabinet_dealz.pantry_master_components (id INT NOT NULL AUTO_INCREMENT, masterCode VARCHAR(32) NOT NULL, componentCode VARCHAR(32) NOT NULL, componentRole VARCHAR(16) NOT NULL, sortOrder INT NOT NULL, confirmedFlag TINYINT NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY pantry_master_components_pair (masterCode, componentCode));

INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1884', 'UCB1854', 'base', 1, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1884' AND existing_part.componentCode = 'UCB1854');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1884', 'W183024', 'top', 2, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1884' AND existing_part.componentCode = 'W183024');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1890', 'UCB1854', 'base', 1, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1890' AND existing_part.componentCode = 'UCB1854');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1890', 'W183624', 'top', 2, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1890' AND existing_part.componentCode = 'W183624');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1896', 'UCB1854', 'base', 1, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1896' AND existing_part.componentCode = 'UCB1854');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1896', 'W184224', 'top', 2, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1896' AND existing_part.componentCode = 'W184224');

INSERT INTO cabinet_dealz.cabinets (masterCode, description, category, subCategory, placementType, width, height, depth, isCornerCabinet, isActive, showInCatalog, showInDesigner, conflictStatus) SELECT '1884', '84" pantry stack: UCB1854 base + W183024 top', 'Tall', NULL, 'tall', 18, 84, 24, 0, 1, 1, 1, 'none' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.cabinets AS existing_cabinet WHERE existing_cabinet.masterCode = '1884');
INSERT INTO cabinet_dealz.cabinets (masterCode, description, category, subCategory, placementType, width, height, depth, isCornerCabinet, isActive, showInCatalog, showInDesigner, conflictStatus) SELECT '1890', '90" pantry stack: UCB1854 base + W183624 top', 'Tall', NULL, 'tall', 18, 90, 24, 0, 1, 1, 1, 'none' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.cabinets AS existing_cabinet WHERE existing_cabinet.masterCode = '1890');
INSERT INTO cabinet_dealz.cabinets (masterCode, description, category, subCategory, placementType, width, height, depth, isCornerCabinet, isActive, showInCatalog, showInDesigner, conflictStatus) SELECT '1896', '96" pantry stack: UCB1854 base + W184224 top', 'Tall', NULL, 'tall', 18, 96, 24, 0, 1, 1, 1, 'none' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.cabinets AS existing_cabinet WHERE existing_cabinet.masterCode = '1896');

INSERT INTO cabinet_dealz.distributor_skus (cabinetId, distributorId, styleId, code, isAvailable, isPublished, listPrice, yourCost) SELECT assembly_cabinet.id, base_sku.distributorId, base_sku.styleId, assembly_cabinet.masterCode, CASE WHEN base_sku.isAvailable = 1 AND top_sku.isAvailable = 1 AND (base_sku.listPrice + top_sku.listPrice IS NOT NULL OR base_sku.yourCost + top_sku.yourCost IS NOT NULL) THEN 1 ELSE 0 END, CASE WHEN base_sku.isPublished = 1 AND top_sku.isPublished = 1 AND (base_sku.listPrice + top_sku.listPrice IS NOT NULL OR base_sku.yourCost + top_sku.yourCost IS NOT NULL) THEN 1 ELSE 0 END, base_sku.listPrice + top_sku.listPrice, base_sku.yourCost + top_sku.yourCost FROM cabinet_dealz.cabinets AS assembly_cabinet JOIN cabinet_dealz.pantry_master_components AS base_part ON base_part.masterCode = assembly_cabinet.masterCode AND base_part.componentRole = 'base' JOIN cabinet_dealz.pantry_master_components AS top_part ON top_part.masterCode = assembly_cabinet.masterCode AND top_part.componentRole = 'top' JOIN cabinet_dealz.cabinets AS base_cabinet ON base_cabinet.masterCode = base_part.componentCode JOIN cabinet_dealz.cabinets AS top_cabinet ON top_cabinet.masterCode = top_part.componentCode JOIN cabinet_dealz.distributor_skus AS base_sku ON base_sku.cabinetId = base_cabinet.id JOIN cabinet_dealz.distributors AS faircrest_distributor ON faircrest_distributor.id = base_sku.distributorId AND (UPPER(TRIM(faircrest_distributor.name)) IN ('FAIRCREST', 'CLARK AND SON', 'CLARK & SON') OR UPPER(TRIM(COALESCE(faircrest_distributor.brandName, ''))) IN ('FAIRCREST', 'CLARK AND SON', 'CLARK & SON') OR UPPER(TRIM(faircrest_distributor.code)) = 'CS') JOIN cabinet_dealz.distributor_skus AS top_sku ON top_sku.cabinetId = top_cabinet.id AND top_sku.distributorId = base_sku.distributorId AND top_sku.styleId <=> base_sku.styleId WHERE assembly_cabinet.masterCode IN ('1884', '1890', '1896') AND NOT EXISTS (SELECT 1 FROM cabinet_dealz.distributor_skus AS existing_sku WHERE existing_sku.cabinetId = assembly_cabinet.id AND existing_sku.distributorId = base_sku.distributorId AND existing_sku.styleId <=> base_sku.styleId);

SELECT pantry_part.masterCode, pantry_part.componentCode, pantry_part.componentRole, pantry_part.sortOrder, pantry_part.confirmedFlag FROM cabinet_dealz.pantry_master_components AS pantry_part WHERE pantry_part.masterCode IN ('1884', '1890', '1896') ORDER BY pantry_part.masterCode, pantry_part.sortOrder;
SELECT added_cabinet.masterCode, added_cabinet.description, added_cabinet.category, added_cabinet.placementType, added_cabinet.width, added_cabinet.height, added_cabinet.depth, (SELECT COUNT(*) FROM cabinet_dealz.distributor_skus AS linked_sku WHERE linked_sku.cabinetId = added_cabinet.id) AS style_link_count, (SELECT COUNT(*) FROM cabinet_dealz.distributor_skus AS priced_pantry_sku WHERE priced_pantry_sku.cabinetId = added_cabinet.id AND (COALESCE(priced_pantry_sku.listPrice, 0) > 0 OR COALESCE(priced_pantry_sku.yourCost, 0) > 0)) AS priced_link_count FROM cabinet_dealz.cabinets AS added_cabinet WHERE added_cabinet.masterCode IN ('1884', '1890', '1896') ORDER BY added_cabinet.masterCode;
