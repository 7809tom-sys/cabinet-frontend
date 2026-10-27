-- TiDB SQL editor version of the approved door-render reference.
-- Paste each numbered block on its own. Apply before deploying the backend patch
-- docs/patches/door-render-approved-reference.patch.
-- One statement per block. No statement-breakpoint markers.
-- Safe to re-run: IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
-- Every table is cabinet_dealz.<table>.
-- Render versions stay append-only. This script does not DELETE them.
-- Approving a render writes door_styles pointer columns and a history row.
-- It does not copy the image onto doorSampleImageUrl or drawerSampleImageUrl.

-- 1
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS approvedRenderVersionId INT NULL;

-- 2
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS approvedReferenceImageUrl VARCHAR(512) NULL;

-- 3
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS approvedAt TIMESTAMP NULL DEFAULT NULL;

-- 4
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS approvedByUserId INT NULL;

-- 5
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS approvedByName VARCHAR(255) NULL;

-- 6
ALTER TABLE cabinet_dealz.door_styles
  ADD COLUMN IF NOT EXISTS approvalNote VARCHAR(512) NULL;

-- 7
CREATE INDEX IF NOT EXISTS door_styles_approved_render_idx
  ON cabinet_dealz.door_styles (approvedRenderVersionId);

-- 8
CREATE TABLE IF NOT EXISTS cabinet_dealz.door_rendering_approvals (
  id INT NOT NULL AUTO_INCREMENT,
  styleId INT NOT NULL,
  versionId INT NOT NULL,
  action ENUM('approved','revoked') NOT NULL,
  actorUserId INT NOT NULL,
  actorName VARCHAR(255) NULL,
  note VARCHAR(512) NULL,
  imageUrl VARCHAR(512) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 9
CREATE INDEX IF NOT EXISTS door_rendering_approvals_style_idx
  ON cabinet_dealz.door_rendering_approvals (styleId, id);

-- 10
CREATE INDEX IF NOT EXISTS door_rendering_approvals_version_idx
  ON cabinet_dealz.door_rendering_approvals (versionId);

-- 11 read-only check. Expect every value below to be 1.
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'approvedRenderVersionId') AS approved_render_version_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'approvedReferenceImageUrl') AS approved_reference_image_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'approvedAt') AS approved_at_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'approvedByUserId') AS approved_by_user_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'approvedByName') AS approved_by_name_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND COLUMN_NAME = 'approvalNote') AS approval_note_column,
  (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_styles'
      AND INDEX_NAME = 'door_styles_approved_render_idx') AS approved_render_index,
  (SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_rendering_approvals') AS approvals_table,
  (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_rendering_approvals'
      AND INDEX_NAME = 'door_rendering_approvals_style_idx') AS approvals_style_index;
