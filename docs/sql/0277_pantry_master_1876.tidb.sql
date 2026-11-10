-- TiDB SQL editor version. Numbered 0277. Run after 0276.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
-- This file was NOT executed against production.
-- Add only. Inserts skip a row that already exists. Nothing here changes or
-- removes a row, and it does not recreate pantry_master_components.
--
-- 1876 is the confined-space pantry. The base on the floor is 3DB18, the
-- catalog's 18" three-drawer base (18 x 34.5 x 24, three drawers, no door).
-- DB18 is not a catalog code. B18 is an 18" door-and-drawer base, not this one.
-- The cabinet on top is W184224 (18 x 42 x 24). 34.5 + 42 = 76.5.
-- Tom described a 42" base with a 34.5" top. The pieces are stored in the
-- physical order: 3DB18 on the floor, W184224 above it. confirmedFlag is 0
-- until Tom accepts that order and the code 1876.
-- This stack does not use UCB1854 and is separate from 1884, 1890, and 1896.
-- The framed 3DB18 row is 34.5" tall. The same code on the frameless line is
-- 34.75" tall, so that line's stack is a quarter inch over 76.5.
--
-- The order price is the sum of the two component prices for one distributor
-- and one door style. A missing component price makes that sum NULL.
-- shared/pantryMasterCodes.ts does that sum. No price is written here.

INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1876', '3DB18', 'base', 1, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1876' AND existing_part.componentCode = '3DB18');
INSERT INTO cabinet_dealz.pantry_master_components (masterCode, componentCode, componentRole, sortOrder, confirmedFlag) SELECT '1876', 'W184224', 'top', 2, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pantry_master_components AS existing_part WHERE existing_part.masterCode = '1876' AND existing_part.componentCode = 'W184224');

INSERT INTO cabinet_dealz.cabinets (masterCode, description, category, subCategory, placementType, width, height, depth, isCornerCabinet, isActive, showInCatalog, showInDesigner, conflictStatus) SELECT '1876', '76.5" pantry stack: 3DB18 base + W184224 top', 'Tall', NULL, 'tall', 18, 76.5, 24, 0, 1, 1, 1, 'none' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.cabinets AS existing_cabinet WHERE existing_cabinet.masterCode = '1876');

SELECT pantry_part.masterCode, pantry_part.componentCode, pantry_part.componentRole, pantry_part.sortOrder, pantry_part.confirmedFlag FROM cabinet_dealz.pantry_master_components AS pantry_part WHERE pantry_part.masterCode = '1876' ORDER BY pantry_part.sortOrder;
