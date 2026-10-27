-- TiDB SQL editor version. Paste each numbered block on its own.
-- One statement per block. No statement-breakpoint markers.
-- Safe to re-run: IF NOT EXISTS, tables qualified as cabinet_dealz.<table>.
-- Existing door styles stay verified because the column defaults to 1.
-- The application sets styleVerified = 0 when it creates a new style.
-- No other data is updated.

-- 1
ALTER TABLE cabinet_dealz.door_styles ADD COLUMN IF NOT EXISTS styleVerified TINYINT(1) NOT NULL DEFAULT 1;

-- 2
ALTER TABLE cabinet_dealz.door_styles ADD COLUMN IF NOT EXISTS styleVerifiedBy VARCHAR(255) NULL;

-- 3
ALTER TABLE cabinet_dealz.door_styles ADD COLUMN IF NOT EXISTS styleVerifiedAt TIMESTAMP NULL DEFAULT NULL;

-- 4
ALTER TABLE cabinet_dealz.door_styles ADD COLUMN IF NOT EXISTS styleSourceNote VARCHAR(512) NULL;

-- 5
ALTER TABLE cabinet_dealz.door_styles ADD COLUMN IF NOT EXISTS combinedSourceImageUrl VARCHAR(512) NULL;

-- 6 read-only check. Expect each column count to be 1.
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'styleVerified') AS style_verified_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'styleVerifiedBy') AS style_verified_by_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'styleVerifiedAt') AS style_verified_at_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'styleSourceNote') AS style_source_note_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'combinedSourceImageUrl') AS combined_source_image_column;
