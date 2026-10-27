-- TiDB SQL editor version of distributor order email, the order status trail,
-- CRM New Sale support, and the image-generated counters.
-- Paste each numbered block on its own. One statement per block.
-- Do not paste drizzle breakpoint markers into these blocks.
-- Safe to re-run: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Every table is cabinet_dealz.<table>.
-- Existing crm_deals.stage values are unchanged. new_sale is added beside them.
-- 0225 and 0226 belong to other changes. 0228 is the image-generation ledger.

-- 1
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS distributorEmailStatus VARCHAR(32) NULL;

-- 2
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS distributorEmailSentAt TIMESTAMP NULL;

-- 3
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS distributorEmailTo VARCHAR(1024) NULL;

-- 4
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS distributorEmailError VARCHAR(1024) NULL;

-- 5
CREATE TABLE IF NOT EXISTS cabinet_dealz.order_distributor_emails (
  id INT NOT NULL AUTO_INCREMENT,
  orderRequestId INT NOT NULL,
  distributorId INT NOT NULL,
  distributorEmailStatus VARCHAR(32) NOT NULL DEFAULT 'pending',
  distributorEmailSentAt TIMESTAMP NULL,
  distributorEmailTo VARCHAR(1024) NULL,
  distributorEmailError VARCHAR(1024) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY order_distributor_emails_order_dist_uq (orderRequestId, distributorId)
);

-- 6
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderVerifiedAt TIMESTAMP NULL;

-- 7
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderVerifiedBy VARCHAR(255) NULL;

-- 8
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderShippedAt TIMESTAMP NULL;

-- 9
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderShippedBy VARCHAR(255) NULL;

-- 10
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS shipmentCarrier VARCHAR(120) NULL;

-- 11
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS shipmentTracking VARCHAR(255) NULL;

-- 12
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderSignedAt TIMESTAMP NULL;

-- 13
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderSignedBy VARCHAR(255) NULL;

-- 14
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS signerName VARCHAR(255) NULL;

-- 15
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS crmSyncStatus VARCHAR(32) NULL;

-- 16
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS crmSyncError VARCHAR(1024) NULL;

-- 17
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS crmDealId INT NULL;

-- 18
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS imageGeneratedCount INT NOT NULL DEFAULT 0;

-- 19
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS lastImageGeneratedAt TIMESTAMP NULL;

-- 20
ALTER TABLE cabinet_dealz.crm_deals ADD COLUMN IF NOT EXISTS saleRefundedAt TIMESTAMP NULL;

-- 21
ALTER TABLE cabinet_dealz.crm_deals MODIFY COLUMN stage ENUM('new','new_sale','contacted','qualified','image_review','quoted','won','lost') NOT NULL DEFAULT 'new';

-- 22
SELECT r.id, r.requestNumber, r.distributorEmailStatus, r.distributorEmailSentAt, r.distributorEmailTo, r.orderVerifiedAt, r.orderShippedAt, r.orderSignedAt, r.crmSyncStatus, r.crmDealId, r.imageGeneratedCount, r.lastImageGeneratedAt
FROM cabinet_dealz.order_requests AS r
ORDER BY r.id DESC
LIMIT 20;
