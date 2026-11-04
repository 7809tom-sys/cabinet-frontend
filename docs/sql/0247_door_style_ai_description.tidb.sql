-- TiDB SQL editor version. Numbered 0247. Run after 0246.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
--
-- DO NOT RUN THIS AGAINST PRODUCTION YET. It is committed so the schema change is
-- reviewable and ready when the backend work is scheduled. The door editor writes
-- both fields to a browser draft today (shared/aiDoorDescriptionStore.ts), the same
-- way it already stores doorSkin and glazing, so nothing is blocked on this file.
--
-- Why: the door editor gained two text fields that are not on door_styles.
--
-- 1. colorDescription — the finish in words beyond a hex value: sheen, undertone,
--    e.g. "warm ivory with a soft matte, low-luster finish, slight cream undertone".
--    Blank by default; never derived from a color name or a hex.
--
-- 2. doorAiDescription — the AI door-description comparison for this style: the
--    three pasted descriptions (GPT, Claude, Gemini) with their model names, which
--    one was chosen official, and the winner's parsed parameters. The winning text
--    also lands in the existing profileDescription column, so the profile record
--    itself keeps working without this column.
--
-- This file only adds columns. It inserts nothing, updates no rows, and deletes
-- nothing.

-- 1. Read-only: confirm the two columns are still absent before adding them.
--    Safe to run twice. Nothing is changed.
SELECT
  existing.column_name AS presentColumn,
  existing.data_type AS columnType,
  existing.is_nullable AS nullable
FROM information_schema.columns AS existing
WHERE existing.table_schema = 'cabinet_dealz'
  AND existing.table_name = 'door_styles'
  AND existing.column_name IN ('colorDescription', 'doorAiDescription')
ORDER BY existing.column_name;

-- 2. The finish in words. Nullable: null means "not described yet", and the
--    editor shows the field blank rather than guessing.
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS colorDescription VARCHAR(512) NULL
  AFTER profileDescription;

-- 3. The AI description comparison as JSON: { fields, chosen, reference, params }.
--    Nullable: null means no comparison has been recorded for this style.
--    Kept as JSON so the losing descriptions survive as reference without a
--    second table, and so the parsed parameters travel with the text that
--    produced them. Every dimension inside it is only what a description
--    stated; unstated values are recorded as null and listed in `unstated`.
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS doorAiDescription JSON NULL
  AFTER colorDescription;

-- 4. Read-only check: confirm both columns now exist.
SELECT
  added.column_name AS addedColumn,
  added.data_type AS columnType,
  added.is_nullable AS nullable
FROM information_schema.columns AS added
WHERE added.table_schema = 'cabinet_dealz'
  AND added.table_name = 'door_styles'
  AND added.column_name IN ('colorDescription', 'doorAiDescription')
ORDER BY added.column_name;

-- 5. Optional read-only spot check: show any style that already carries either
--    value, so a reviewer can see what a filled record looks like. Expect zero
--    rows immediately after this file runs, because nothing is backfilled.
SELECT
  checked_style.id AS styleId,
  checked_style.styleCode,
  checked_style.ourName,
  checked_style.colorDescription,
  JSON_EXTRACT(checked_style.doorAiDescription, '$.chosen') AS chosenModel
FROM cabinet_dealz.door_styles AS checked_style
WHERE checked_style.colorDescription IS NOT NULL
   OR checked_style.doorAiDescription IS NOT NULL
ORDER BY checked_style.id
LIMIT 50;

-- Note on backfill: none. A style with no recorded comparison keeps a null
-- doorAiDescription and draws from the library profiles exactly as it does now
-- (see shared/doorLibraryProfiles.ts). No existing value is read, changed, or
-- cleared by this file.
