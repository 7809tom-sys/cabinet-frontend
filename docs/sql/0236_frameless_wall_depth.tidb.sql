-- TiDB SQL editor version. Numbered 0236. Run AFTER 0235.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Does not change application code. The Designer already places a frameless
-- standard wall at 13.5 inches when this column is missing or still 12.
-- AltaEuro spec book V8: standard wall families are 13-1/2" deep. The 24"D
-- family (12-5/8 / 15-1/8 / 17-5/8 / 22-5/8 H, and 24"D flip-up Aventos)
-- stays 24 inches and is only used above a refrigerator.
--
-- Audit of the frameless line in the Designer fixture (style 540005):
-- 72 standard wall rows are already 13.5, 17 deep rows are already 24.
-- The only standard wall stored at the old 12 inch fallback is W3012.

-- 1. Standard frameless wall W3012 is 12-5/8" high and must be 13-1/2" deep.
UPDATE cabinet_dealz.cabinets
SET depth = 13.5
WHERE masterCode = 'W3012'
  AND placementType = 'wall'
  AND (depth IS NULL OR ABS(depth - 13.5) > 0.2);

-- 2. Read-only. Expect w3012_depth = 13.5 and no other non-corner frameless
--    wall (construction method contains AltaEuro) sitting at a depth other
--    than 13.5 or 24.
SELECT
  cabinet_master.masterCode,
  cabinet_master.depth,
  cabinet_master.height,
  cabinet_master.subCategory
FROM cabinet_dealz.cabinets AS cabinet_master
WHERE cabinet_master.placementType = 'wall'
  AND cabinet_master.constructionMethod LIKE '%AltaEuro%'
  AND ABS(cabinet_master.depth - 13.5) > 0.2
  AND ABS(cabinet_master.depth - 24) > 0.2
ORDER BY cabinet_master.masterCode;
