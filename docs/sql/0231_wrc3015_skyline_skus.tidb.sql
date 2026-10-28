-- TiDB SQL editor version. Numbered 0231. Run AFTER 0230.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Does not insert prices and does not DELETE cabinet or distributor_skus rows.
--
-- Why: 0230 removes the WRC3015 -> LWR3015 alias and republishes the Skyline
-- WRC3015 record. The Oct 13 alias audit showed that record with 0 supplier
-- links while LWR3015 had 31, so Skyline's 30x15 wall wine rack SKUs may be
-- attached to the Ashford LWR3015 lattice rack record instead. LWR is an
-- Ashford (CS) code; Skyline (SK) does not sell it, so any SK row on LWR3015
-- is the WRC3015 product. Block 2 moves only those rows back. If block 1
-- shows none, skip block 2.

-- 1. Read-only: which supplier rows sit on each 3015 wine rack record.
SELECT
  wine_rack_cabinet.id AS cabinetId,
  wine_rack_cabinet.masterCode,
  wine_rack_supplier.code AS supplierCode,
  COUNT(*) AS skuRows,
  SUM(wine_rack_sku.isAvailable = 1 AND wine_rack_sku.isPublished = 1
      AND (COALESCE(wine_rack_sku.listPrice, 0) > 0 OR COALESCE(wine_rack_sku.yourCost, 0) > 0)) AS publishedPricedRows
FROM cabinet_dealz.cabinets AS wine_rack_cabinet
JOIN cabinet_dealz.distributor_skus AS wine_rack_sku ON wine_rack_sku.cabinetId = wine_rack_cabinet.id
JOIN cabinet_dealz.distributors AS wine_rack_supplier ON wine_rack_supplier.id = wine_rack_sku.distributorId
WHERE wine_rack_cabinet.masterCode IN ('WRC3015', 'WRC-30-15', 'LWR3015')
GROUP BY wine_rack_cabinet.id, wine_rack_cabinet.masterCode, wine_rack_supplier.code
ORDER BY wine_rack_cabinet.masterCode, wine_rack_supplier.code;

-- 2. Move Skyline (SK) rows off the Ashford LWR3015 record onto WRC3015.
--    Ashford (CS) rows stay on LWR3015. Prices, styles, and SKUs are unchanged.
UPDATE cabinet_dealz.distributor_skus
SET cabinetId = (
  SELECT skyline_wine_rack.id
  FROM (SELECT id, masterCode FROM cabinet_dealz.cabinets) AS skyline_wine_rack
  WHERE skyline_wine_rack.masterCode = 'WRC3015'
)
WHERE cabinetId = (
    SELECT ashford_wine_rack.id
    FROM (SELECT id, masterCode FROM cabinet_dealz.cabinets) AS ashford_wine_rack
    WHERE ashford_wine_rack.masterCode = 'LWR3015'
  )
  AND distributorId IN (
    SELECT skyline_supplier.id
    FROM cabinet_dealz.distributors AS skyline_supplier
    WHERE skyline_supplier.code = 'SK'
  )
  AND EXISTS (
    SELECT 1
    FROM (SELECT masterCode FROM cabinet_dealz.cabinets) AS wrc_master_check
    WHERE wrc_master_check.masterCode = 'WRC3015'
  );

-- 3. Read-only: the alias must be gone and both racks must stand on their own.
--    Expect no WRC3015 alias row, and published_priced_sku_count > 0 for
--    WRC3015 (Skyline) and LWR3015 (Ashford).
SELECT
  wine_rack_cabinet.masterCode,
  wine_rack_cabinet.category,
  wine_rack_cabinet.isActive,
  wine_rack_cabinet.showInCatalog,
  wine_rack_cabinet.showInDesigner,
  wine_rack_cabinet.designerEligible,
  (
    SELECT GROUP_CONCAT(CONCAT(remaining_alias.aliasCode, ' -> ', remaining_alias.masterCode))
    FROM cabinet_dealz.sku_master_aliases AS remaining_alias
    WHERE remaining_alias.aliasCode = wine_rack_cabinet.masterCode
  ) AS aliasRow,
  (
    SELECT COUNT(*)
    FROM cabinet_dealz.distributor_skus AS priced_wine_sku
    WHERE priced_wine_sku.cabinetId = wine_rack_cabinet.id
      AND priced_wine_sku.isAvailable = 1
      AND priced_wine_sku.isPublished = 1
      AND (COALESCE(priced_wine_sku.listPrice, 0) > 0 OR COALESCE(priced_wine_sku.yourCost, 0) > 0)
  ) AS published_priced_sku_count
FROM cabinet_dealz.cabinets AS wine_rack_cabinet
WHERE wine_rack_cabinet.masterCode IN ('WRC3015', 'LWR3015');
