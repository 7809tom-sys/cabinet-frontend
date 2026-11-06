-- TiDB SQL editor version. Numbered 0259. Run after 0254.
-- One statement per line, so each line can be pasted on its own in the TiDB SQL
-- editor. Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
--
-- WHY THIS FILE EXISTS
-- "REAR DECK TOO SHALLOW" on a 30" Pelican basin over a 30" vanity base.
-- Root cause was CODE, not data. The Designer measured the rear deck with a
-- retired 3" front setback and then treated a narrow deck as a blocking error.
-- The catalog depths were already right:
--   VS30 / VSB30 vanity sink base = 30" wide x 21" deep
--   3VDB15 vanity drawer base    = 15" wide x 21" deep
--   21" base + 1.5" front overhang = 22.5" finished vanity top
--   22.5" top - 2" setback - 18" basin = 2.5" rear deck
-- So NO UPDATE IS REQUIRED for the reported case. The PR fixed the rule.
--
-- The SELECTs below are the preview Tom asked for. Run them first and read the
-- result before touching anything. The one UPDATE at the end is OPTIONAL and
-- guarded: it only repairs a genuinely wrong catalog row (PL-3099, whose size
-- field holds bowl dimensions and whose name claims a 33" farmhouse sink while
-- the verified technical sheet says 20.875" x 15.625" undermount vanity).
-- Re-run safe: the UPDATE carries a WHERE that matches the wrong value, so a
-- second run changes nothing.

-- 1) PREVIEW — the two cabinet depths the deck rule reads.
SELECT masterCode, description, width, depth, category, subCategory FROM cabinet_dealz.cabinet_master WHERE masterCode IN ('VS30', 'VS30S', 'VSB30', '3VDB15') ORDER BY masterCode;

-- 2) PREVIEW — the vanity sink bases, to confirm every one is 21" deep.
SELECT masterCode, description, width, depth FROM cabinet_dealz.cabinet_master WHERE category = 'Vanity' AND (subCategory = 'Vanity Sink' OR description LIKE '%Vanity Sink Base%') ORDER BY width;

-- 3) PREVIEW — the Pelican sinks that a 30" vanity base accepts, and their published sizes.
SELECT id, pelicanCode, name, subCategory, size, isActive, showInDesigner FROM cabinet_dealz.pelican_products WHERE pelicanCode LIKE 'PL-VS3018%' OR pelicanCode LIKE 'PL-HA109%' ORDER BY pelicanCode;

-- 4) PREVIEW — the PL-3099 catalog row whose stored size disagrees with its technical sheet.
SELECT id, pelicanCode, name, subCategory, size FROM cabinet_dealz.pelican_products WHERE pelicanCode LIKE 'PL-3099%';

-- 5) OPTIONAL DATA FIX — PL-3099 only. Guarded to the wrong stored size, so a
--    second run is a no-op. Skip this entirely if Tom prefers to fix PL-3099 in
--    the catalog importer instead; the PR does not depend on it.
UPDATE cabinet_dealz.pelican_products SET size = '20.875" x 15.625"' WHERE pelicanCode = 'PL-3099 Bone' AND size = '18" x 13"';

-- 6) VERIFY — run the same preview again and confirm the row now reads 20.875" x 15.625".
SELECT id, pelicanCode, name, size FROM cabinet_dealz.pelican_products WHERE pelicanCode LIKE 'PL-3099%';
