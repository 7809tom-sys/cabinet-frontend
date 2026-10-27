-- TiDB SQL editor version of the paid-image customer ledger.
-- Paste each numbered block on its own. Apply before deploying the backend patch
-- docs/patches/cabinet-backend-image-customer-link.patch.
-- One statement per block. Do not use Drizzle breakpoint markers.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- and ADD COLUMN IF NOT EXISTS.
-- Every table is cabinet_dealz.<table>.
--
-- order_requests.imageGeneratedCount and order_requests.lastImageGeneratedAt
-- are owned by SQL 0227 (distributor email/CRM). Blocks 15 and 16 repeat those
-- ADD COLUMN IF NOT EXISTS statements so this script still works on its own.
-- Do not add a second ALTER that changes the column type.

-- 1
CREATE TABLE IF NOT EXISTS cabinet_dealz.image_generation_ledger (
  id INT NOT NULL AUTO_INCREMENT,
  customerId INT NULL,
  customerKind VARCHAR(8) NULL,
  crmDealId INT NULL,
  designId INT NULL,
  orderId INT NULL,
  imageType VARCHAR(32) NOT NULL,
  model VARCHAR(128) NOT NULL,
  purpose ENUM('customer', 'internal') NOT NULL,
  requestedByUserId INT NULL,
  status ENUM('succeeded', 'failed', 'blocked') NOT NULL,
  imageUrl VARCHAR(512) NULL,
  estimatedCost DECIMAL(10, 4) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 2
CREATE INDEX IF NOT EXISTS image_generation_ledger_purpose_idx
  ON cabinet_dealz.image_generation_ledger (purpose, createdAt);

-- 3
CREATE INDEX IF NOT EXISTS image_generation_ledger_customer_idx
  ON cabinet_dealz.image_generation_ledger (customerKind, customerId, createdAt);

-- 4
CREATE INDEX IF NOT EXISTS image_generation_ledger_order_idx
  ON cabinet_dealz.image_generation_ledger (orderId);

-- 5
CREATE INDEX IF NOT EXISTS image_generation_ledger_deal_idx
  ON cabinet_dealz.image_generation_ledger (crmDealId);

-- 6
ALTER TABLE cabinet_dealz.design_photo_renders
  ADD COLUMN IF NOT EXISTS customerId INT NULL;

-- 7
ALTER TABLE cabinet_dealz.design_gemini_image_test_jobs
  ADD COLUMN IF NOT EXISTS customerId INT NULL;

-- 8
ALTER TABLE cabinet_dealz.affiliate_generated_images
  ADD COLUMN IF NOT EXISTS customerId INT NULL;

-- 9
ALTER TABLE cabinet_dealz.surface_previews
  ADD COLUMN IF NOT EXISTS customerId INT NULL;

-- 10
ALTER TABLE cabinet_dealz.cabinet_3d_previews
  ADD COLUMN IF NOT EXISTS customerId INT NULL;

-- 11
ALTER TABLE cabinet_dealz.door_style_room_scenes
  ADD COLUMN IF NOT EXISTS customerId INT NULL;

-- 12
ALTER TABLE cabinet_dealz.door_style_room_scene_generations
  ADD COLUMN IF NOT EXISTS customerId INT NULL;

-- 13
ALTER TABLE cabinet_dealz.design_gemini_image_test_jobs
  ADD COLUMN IF NOT EXISTS customerKind VARCHAR(8) NULL;

-- 14
ALTER TABLE cabinet_dealz.design_gemini_image_test_jobs
  ADD COLUMN IF NOT EXISTS orderId INT NULL;

-- 15
-- Same columns as SQL 0227. Safe to re-run.
ALTER TABLE cabinet_dealz.order_requests
  ADD COLUMN IF NOT EXISTS imageGeneratedCount INT NOT NULL DEFAULT 0;

-- 16
ALTER TABLE cabinet_dealz.order_requests
  ADD COLUMN IF NOT EXISTS lastImageGeneratedAt TIMESTAMP NULL DEFAULT NULL;

-- 17 read-only check. Expect every value below to be 1.
SELECT
  (SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'image_generation_ledger') AS ledger_table,
  (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'image_generation_ledger'
      AND INDEX_NAME = 'image_generation_ledger_purpose_idx') AS ledger_purpose_index,
  (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'image_generation_ledger'
      AND INDEX_NAME = 'image_generation_ledger_customer_idx') AS ledger_customer_index,
  (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'image_generation_ledger'
      AND INDEX_NAME = 'image_generation_ledger_order_idx') AS ledger_order_index,
  (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'image_generation_ledger'
      AND INDEX_NAME = 'image_generation_ledger_deal_idx') AS ledger_deal_index,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'design_photo_renders'
      AND COLUMN_NAME = 'customerId') AS photo_render_customer_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'design_gemini_image_test_jobs'
      AND COLUMN_NAME = 'customerId') AS gemini_job_customer_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'affiliate_generated_images'
      AND COLUMN_NAME = 'customerId') AS affiliate_image_customer_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'surface_previews'
      AND COLUMN_NAME = 'customerId') AS surface_preview_customer_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'cabinet_3d_previews'
      AND COLUMN_NAME = 'customerId') AS cabinet_preview_customer_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_style_room_scenes'
      AND COLUMN_NAME = 'customerId') AS door_scene_customer_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'door_style_room_scene_generations'
      AND COLUMN_NAME = 'customerId') AS door_scene_generation_customer_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'design_gemini_image_test_jobs'
      AND COLUMN_NAME = 'customerKind') AS gemini_job_kind_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'design_gemini_image_test_jobs'
      AND COLUMN_NAME = 'orderId') AS gemini_job_order_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'order_requests'
      AND COLUMN_NAME = 'imageGeneratedCount') AS image_generated_count_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'cabinet_dealz'
      AND TABLE_NAME = 'order_requests'
      AND COLUMN_NAME = 'lastImageGeneratedAt') AS last_image_generated_at_column;
