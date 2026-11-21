-- NOT APPLIED. Proposed data backfill for review only. Nothing in cabinet-frontend runs this.
-- Tom, voice, Nov 21 2026, 2:07 PM CT: approved on PR 504. Existing door styles saved with no
-- door style become DL Shaker. doorStyle = 'Shaker' is the value the code renders as DL Shaker
-- (PLATFORM_DEFAULT_DOOR_STYLE in shared/platformDoorDefaults.ts, DL_SHAKER_FIRM_RULE).
-- TiDB SQL editor version. Numbered 0280. One statement per line. Every table is cabinet_dealz.<table>.
-- Do not run this from the application. Tom pastes it by hand.
-- Affects only door_styles rows whose doorStyle is NULL, empty, or whitespace only.
-- Rows that already have any door style are never touched. Re-running is safe: the
-- second run matches zero rows. Touches no other table, code, or SKU.

-- 1  PREVIEW (read only): how many rows will change.
SELECT COUNT(*) AS rows_to_fill FROM cabinet_dealz.door_styles WHERE doorStyle IS NULL OR TRIM(doorStyle) = '' OR doorStyle REGEXP '^[[:space:]]*$';

-- 2  PREVIEW (read only): exactly which rows will change.
SELECT id, distributorId, styleCode, ourName, distributorName, doorStyle FROM cabinet_dealz.door_styles WHERE doorStyle IS NULL OR TRIM(doorStyle) = '' OR doorStyle REGEXP '^[[:space:]]*$' ORDER BY distributorId, id;

-- 3  BACKFILL: fill only those rows with 'Shaker' (DL Shaker).
UPDATE cabinet_dealz.door_styles SET doorStyle = 'Shaker' WHERE doorStyle IS NULL OR TRIM(doorStyle) = '' OR doorStyle REGEXP '^[[:space:]]*$';

-- 4  CHECK (read only): should return 0.
SELECT COUNT(*) AS rows_still_blank FROM cabinet_dealz.door_styles WHERE doorStyle IS NULL OR TRIM(doorStyle) = '' OR doorStyle REGEXP '^[[:space:]]*$';
