-- TiDB SQL editor version. Numbered 0261. Run AFTER 0230 and 0231.
-- One statement per line, so each line can be pasted on its own in the TiDB
-- editor. Every table is cabinet_dealz.<table>. No table aliases, so a line
-- pastes cleanly into the TiDB Cloud editor, and no UPDATE in this file uses one.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
--
-- Safe to re-run. Nothing here adds a column or a table, so a second run answers
-- no "Duplicate column name" error; if your editor DOES show "already exists"
-- for any line, THAT ERROR IS SAFE to skip because the change is already in
-- place. Skip just that one line and paste the next.
--
-- WHY (issue #55, still reproducing after PR 59)
--
-- PR 59 taught the storefront and the Designer to treat a "Wall Wine Rack",
-- "Wine Rack / Open Display", "Accessories / Wine Storage", or
-- "Specialty / Wine Rack" row as a WALL cabinet, and 0230 republished the 3015 /
-- 3018 racks. Tom still cannot see them, so the remaining causes are in the
-- DATA, and this file fixes only the data it can prove:
--
--   1. The row is still filed where the category filter cannot reach it, or
--      placementType is not wall. Blocks 4 and 5 set Wall / wall.
--   2. The row is not published: isActive, showInCatalog, or showInDesigner is
--      0. The storefront needs isActive + showInCatalog; the Designer needs
--      isActive + showInDesigner + designerEligible. Blocks 4 and 5 set all of
--      them, but ONLY for rows already verified (configVerified = 1) or for the
--      exact codes the owner named. An unverified row is left alone on purpose.
--   3. A dimension is missing, so the Designer has no box to build. Blocks 6 to
--      8 fill only the sizes printed in docs/pelican-box-coverage.md, and only
--      where the column is empty or zero. No other size is invented here.
--   4. The SKU has no priced, published supplier row on the White Shaker line,
--      so neither the storefront nor the Designer can offer it. THIS FILE DOES
--      NOT INSERT PRICES. Blocks 1 to 3 and the last block print what is really
--      there, and docs/wall-wine-rack-issue-55.md lists what is ambiguous.
--
-- Nothing is guessed. Block 1 prints every rack-shaped row with its real
-- category, flags, dimensions, and priced-supplier count. Read block 1 before
-- running block 4. A row whose category you did not expect is a Cabinet Config
-- job, not a SQL job.

-- 1. Read-only preview. Every rack-shaped cabinet, whatever it is filed as, with
--    its exact flags and the count of priced, published supplier SKUs.
SELECT wine_rack_cabinet.id AS cabinetId, wine_rack_cabinet.masterCode, wine_rack_cabinet.category, wine_rack_cabinet.subCategory, wine_rack_cabinet.placementType, wine_rack_cabinet.isActive, wine_rack_cabinet.showInCatalog, wine_rack_cabinet.showInDesigner, wine_rack_cabinet.designerEligible, wine_rack_cabinet.configVerified, wine_rack_cabinet.conflictStatus, wine_rack_cabinet.width, wine_rack_cabinet.height, wine_rack_cabinet.depth, (SELECT COUNT(*) FROM cabinet_dealz.distributor_skus AS first_priced_wine_sku WHERE first_priced_wine_sku.cabinetId = wine_rack_cabinet.id AND first_priced_wine_sku.isAvailable = 1 AND first_priced_wine_sku.isPublished = 1 AND (COALESCE(first_priced_wine_sku.listPrice, 0) > 0 OR COALESCE(first_priced_wine_sku.yourCost, 0) > 0)) AS published_priced_sku_count FROM cabinet_dealz.cabinets AS wine_rack_cabinet WHERE wine_rack_cabinet.masterCode REGEXP '(WRC|WXR|WWC|LWR)[0-9]' ORDER BY wine_rack_cabinet.masterCode;

-- 2. Read-only preview. Which supplier line and which door style carry each of
--    the 3015 / 3018 codes, and at what price. A code with no row here has no
--    White Shaker price to show, and no flag change can make it appear there.
SELECT wine_rack_cabinet.masterCode, wine_rack_cabinet.id AS cabinetId, wine_rack_supplier.code AS supplierCode, wine_rack_supplier.name AS supplierName, wine_rack_style.styleCode, wine_rack_style.ourName AS styleName, wine_rack_sku.isAvailable, wine_rack_sku.isPublished, wine_rack_sku.listPrice, wine_rack_sku.yourCost FROM cabinet_dealz.cabinets AS wine_rack_cabinet LEFT JOIN cabinet_dealz.distributor_skus AS wine_rack_sku ON wine_rack_sku.cabinetId = wine_rack_cabinet.id LEFT JOIN cabinet_dealz.distributors AS wine_rack_supplier ON wine_rack_supplier.id = wine_rack_sku.distributorId LEFT JOIN cabinet_dealz.door_styles AS wine_rack_style ON wine_rack_style.id = wine_rack_sku.styleId WHERE wine_rack_cabinet.masterCode IN ('WRC3015', 'WRC3018', 'WXR3018', 'LWR3015', 'LWR3018', 'WWC630') ORDER BY wine_rack_cabinet.masterCode, wine_rack_supplier.code, wine_rack_style.styleCode;

-- 3. Read-only preview, the alias trap. 0230 removed the sku master alias that
--    pointed WRC3015 at the Ashford LWR3015 record, which retired the Skyline
--    code from every public query. If a row is back here, that code is being
--    redirected again and no flag change will surface it. 0230 owns that fix;
--    this block only proves whether it is gone.
SELECT wine_alias.aliasCode, wine_alias.masterCode, wine_alias.conflictStatus, wine_alias.notes FROM cabinet_dealz.sku_master_aliases AS wine_alias WHERE wine_alias.aliasCode IN ('WRC3015', 'WRC-30-15', 'LWR3015', 'WRC3018', 'WXR3018', 'WWC630') ORDER BY wine_alias.aliasCode;

-- 4. Publish the six codes the owner named as Wall. These are the exact codes,
--    so this line does not depend on configVerified being set on them.
UPDATE cabinet_dealz.cabinets SET category = 'Wall', placementType = 'wall', isCornerCabinet = 0, isActive = 1, showInCatalog = 1, showInDesigner = 1, designerEligible = 1 WHERE masterCode IN ('WRC3015', 'WRC3018', 'WXR3018', 'LWR3015', 'LWR3018', 'WWC630');

-- 5. Same publish for any later rack the owner has already verified under a
--    supplier category name. conflictStatus is left alone so an intentional
--    review stays visible in Cabinet Attention.
UPDATE cabinet_dealz.cabinets SET category = 'Wall', placementType = 'wall', isCornerCabinet = 0, isActive = 1, showInCatalog = 1, showInDesigner = 1, designerEligible = 1 WHERE configVerified = 1 AND conflictStatus <> 'conflict' AND masterCode REGEXP '(WRC|WXR|WWC|LWR)[0-9]';

-- 6. Fill the Skyline 3015 box only where a dimension is empty or zero. 30 W x
--    15 H x 12 D is the verified Skyline size in docs/pelican-box-coverage.md,
--    and a wine rack is an open front, so it carries no door.
UPDATE cabinet_dealz.cabinets SET width = IF(width IS NULL OR width = 0, 30, width), height = IF(height IS NULL OR height = 0, 15, height), depth = IF(depth IS NULL OR depth = 0, 12, depth), numberOfDoors = 0 WHERE masterCode = 'WRC3015';

-- 7. The 3018 box, same rule. 30 W x 18 H x 12 D is the verified size.
UPDATE cabinet_dealz.cabinets SET width = IF(width IS NULL OR width = 0, 30, width), height = IF(height IS NULL OR height = 0, 18, height), depth = IF(depth IS NULL OR depth = 0, 12, depth), numberOfDoors = 0 WHERE masterCode IN ('WRC3018', 'WXR3018');

-- 8. The 6-inch wine wall cabinet, same rule. 30 W x 6 H x 12 D is verified.
UPDATE cabinet_dealz.cabinets SET width = IF(width IS NULL OR width = 0, 30, width), height = IF(height IS NULL OR height = 0, 6, height), depth = IF(depth IS NULL OR depth = 0, 12, depth), numberOfDoors = 0 WHERE masterCode = 'WWC630';

-- 9. Read-only check. Each row must now read category Wall, placementType wall,
--    all three flags 1, and a real box size. published_priced_sku_count must be
--    greater than 0 or the code still will not appear on a door style, which is
--    a pricing gap this file does not touch.
SELECT wine_rack_cabinet.masterCode, wine_rack_cabinet.category, wine_rack_cabinet.subCategory, wine_rack_cabinet.placementType, wine_rack_cabinet.isActive, wine_rack_cabinet.showInCatalog, wine_rack_cabinet.showInDesigner, wine_rack_cabinet.designerEligible, wine_rack_cabinet.width, wine_rack_cabinet.height, wine_rack_cabinet.depth, (SELECT COUNT(*) FROM cabinet_dealz.distributor_skus AS checked_wine_sku WHERE checked_wine_sku.cabinetId = wine_rack_cabinet.id AND checked_wine_sku.isAvailable = 1 AND checked_wine_sku.isPublished = 1 AND (COALESCE(checked_wine_sku.listPrice, 0) > 0 OR COALESCE(checked_wine_sku.yourCost, 0) > 0)) AS published_priced_sku_count FROM cabinet_dealz.cabinets AS wine_rack_cabinet WHERE wine_rack_cabinet.masterCode IN ('WRC3015', 'WRC3018', 'WXR3018', 'LWR3015', 'LWR3018', 'WWC630') ORDER BY wine_rack_cabinet.masterCode;
