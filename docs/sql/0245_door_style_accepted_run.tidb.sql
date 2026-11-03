-- TiDB SQL editor version. Numbered 0245. Run after 0244.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- This file only adds columns. It inserts nothing, updates no rows, and deletes
-- nothing. Run it BEFORE deploying cabinet-backend-door-style-accepted-run.patch:
-- doorStyles queries select every column, so they error until these exist.
--
-- Why: an approved door render must become the kitchen's color. Accepting an audit
-- run writes the run's renderHex and approved image onto the door style, and the
-- Designer reads them. A revoked or reverted acceptance clears or re-points them,
-- and the style's own saved catalog color takes over again.

-- 1. Read-only: how many styles already carry an accepted run, and which ones.
--    Safe to run twice. Nothing is changed.
SELECT
  accepted_style.id AS styleId,
  accepted_style.styleCode,
  accepted_style.ourName,
  accepted_style.renderHex,
  accepted_style.approvedVersionId,
  accepted_style.approvedAt
FROM cabinet_dealz.door_styles AS accepted_style
WHERE accepted_style.approvedVersionId IS NOT NULL
ORDER BY accepted_style.approvedAt DESC
LIMIT 50;

-- 2. The accepted run's color. Nullable: null means "no accepted run", and the
--    Designer falls back to the style's own saved catalog color.
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS renderHex VARCHAR(7) NULL;

-- 3. The accepted run's approved door image, used as the kitchen's face texture.
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS approvedReferenceImageUrl VARCHAR(512) NULL;

-- 4. Which door_rendering_versions row is currently accepted. Non-null is the
--    signal that the two columns above may drive a kitchen.
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS approvedVersionId INT NULL;

-- 5. When that version was accepted. Ordering aid; the version id is authority.
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS approvedAt TIMESTAMP NULL;

-- 6. Read-only check: confirm the four columns exist on door_styles.
SELECT
  column_name AS addedColumn,
  data_type AS columnType,
  is_nullable AS nullable
FROM information_schema.columns
WHERE table_schema = 'cabinet_dealz'
  AND table_name = 'door_styles'
  AND column_name IN ('renderHex', 'approvedReferenceImageUrl', 'approvedVersionId', 'approvedAt')
ORDER BY column_name;

-- Note: renderHex may already exist from 0233_door_render_controls. Block 2 is
-- IF NOT EXISTS, so running it over an existing column changes nothing. Its
-- meaning widens: it used to be an admin hand-set color and is now also the
-- accepted run's color. Both are the same source of truth, so no data migration
-- is needed, and no existing value is cleared by this file.
