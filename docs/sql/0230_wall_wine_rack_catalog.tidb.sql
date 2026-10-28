-- TiDB SQL editor version. Numbered 0230.
-- These numbers are already used: 0226, 0227, 0228, 0229.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Does not insert prices and does not DELETE cabinet or distributor_skus rows.
--
-- Why: WRC3015 (Skyline 30x15 wall wine rack, cabinet id 9360166) is verified
-- in cabinet config but the public catalog and Designer omit it. A sku master
-- alias WRC3015 -> LWR3015 retires the Skyline code, and wine-rack rows filed
-- as "Wall Wine Rack", "Wine Rack / Open Display", "Wine Storage", or
-- "Specialty / Wine Rack" never match the Wall category filter.
-- WRC / WXR / WWC / LWR are wall cabinets. WR#### refrigerator walls are not
-- in this update. Apply before or with the frontend release. The backend
-- patch docs/patches/cabinet-backend-wall-wine-rack.patch teaches the API
-- the same category names if a later import uses them again.

-- 1. Stop retiring the Skyline WRC3015 master onto the Ashford LWR code.
DELETE FROM cabinet_dealz.sku_master_aliases
WHERE aliasCode = 'WRC3015';

-- 2. Keep the hyphenated Skyline code as a one-hop alias of WRC3015.
INSERT INTO cabinet_dealz.sku_master_aliases (aliasCode, masterCode, notes, conflictStatus)
SELECT 'WRC-30-15', 'WRC3015', 'Hyphenated Skyline wall wine rack', 'ok'
FROM cabinet_dealz.cabinets AS wine_rack_master
WHERE wine_rack_master.masterCode = 'WRC3015'
  AND NOT EXISTS (
    SELECT 1
    FROM (
      SELECT aliasCode
      FROM cabinet_dealz.sku_master_aliases
    ) AS existing_wine_alias
    WHERE existing_wine_alias.aliasCode = 'WRC-30-15'
  );

-- 3. Publish verified wall wine racks under Wall so the storefront and
--    Designer wall picker can see them. Leaves an intentional conflict review
--    (conflictStatus = 'review') in place.
UPDATE cabinet_dealz.cabinets
SET
  category = 'Wall',
  subCategory = IF(
    subCategory IN ('Wine Rack', 'Wine Rack / Open Display', 'Wine Storage'),
    subCategory,
    'Wine Rack / Open Display'
  ),
  placementType = 'wall',
  isActive = 1,
  showInCatalog = 1,
  showInDesigner = 1,
  designerEligible = 1,
  isCornerCabinet = 0,
  conflictStatus = IF(conflictStatus = 'review', conflictStatus, 'none'),
  graphicType = IF(graphicType IS NULL OR graphicType = '', 'wine-rack', graphicType)
WHERE masterCode IN ('WRC3015', 'WRC3018', 'WRC2430', 'LWR3015', 'LWR3018', 'WXR3018', 'WWC630')
   OR (
     configVerified = 1
     AND masterCode REGEXP '^(WRC|WXR|WWC|LWR)[0-9]'
   );

-- 4. Fill the Skyline 3015 box only when a dimension is missing.
--    30 W x 15 H x 12 D is the verified Skyline wine-rack size.
UPDATE cabinet_dealz.cabinets
SET
  width = IF(width IS NULL OR width = 0, 30, width),
  height = IF(height IS NULL OR height = 0, 15, height),
  depth = IF(depth IS NULL OR depth = 0, 12, depth),
  numberOfDoors = 0
WHERE masterCode = 'WRC3015';

-- 5. Read-only check. Each listed code should be category Wall, placement wall,
--    active, and visible. published_priced_sku_count must be greater than 0
--    or that code still will not appear on a door-style page.
SELECT
  wine_rack_cabinet.masterCode,
  wine_rack_cabinet.category,
  wine_rack_cabinet.subCategory,
  wine_rack_cabinet.placementType,
  wine_rack_cabinet.isActive,
  wine_rack_cabinet.showInCatalog,
  wine_rack_cabinet.showInDesigner,
  wine_rack_cabinet.designerEligible,
  wine_rack_cabinet.conflictStatus,
  wine_rack_cabinet.configVerified,
  (
    SELECT COUNT(*)
    FROM cabinet_dealz.distributor_skus AS priced_wine_sku
    WHERE priced_wine_sku.cabinetId = wine_rack_cabinet.id
      AND priced_wine_sku.isAvailable = 1
      AND priced_wine_sku.isPublished = 1
      AND (COALESCE(priced_wine_sku.listPrice, 0) > 0 OR COALESCE(priced_wine_sku.yourCost, 0) > 0)
  ) AS published_priced_sku_count
FROM cabinet_dealz.cabinets AS wine_rack_cabinet
WHERE wine_rack_cabinet.masterCode IN ('WRC3015', 'WRC3018', 'WRC2430', 'LWR3015', 'WXR3018', 'WWC630');
