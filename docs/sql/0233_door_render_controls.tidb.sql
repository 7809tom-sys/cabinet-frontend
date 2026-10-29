-- TiDB SQL editor version of the door render controls.
-- Numbered 0233. Run after 0232.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- Apply this before deploying the cabinet-backend door-render fields.
--
-- renderHex is the admin color that wins over the name fallback.
-- doorShape is raised, recessed-shaker, slab, or glass. Null keeps parsing.
-- swatchCode / swatchHex are the color-gate reference.
-- site_settings.renderExposure null keeps 0.84 (softer only for a very dark stain).
-- site_settings.colorMatchDeltaE null keeps the CIEDE2000 limit at 3.

-- 1
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS renderHex VARCHAR(7) NULL;

-- 2
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS doorShape VARCHAR(32) NULL;

-- 3
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS swatchCode VARCHAR(16) NULL;

-- 4
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS swatchHex VARCHAR(7) NULL;

-- 5
ALTER TABLE cabinet_dealz.site_settings
  ADD COLUMN IF NOT EXISTS renderExposure DECIMAL(4, 2) NULL;

-- 6
ALTER TABLE cabinet_dealz.site_settings
  ADD COLUMN IF NOT EXISTS colorMatchDeltaE DECIMAL(4, 2) NULL;

-- 7 read-only check. Expect every value below to be 1.
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'renderHex') AS render_hex_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'doorShape') AS door_shape_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'swatchCode') AS swatch_code_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'swatchHex') AS swatch_hex_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'site_settings'
      AND COLUMN_NAME = 'renderExposure') AS render_exposure_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'site_settings'
      AND COLUMN_NAME = 'colorMatchDeltaE') AS color_match_column;
