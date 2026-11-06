-- TiDB SQL editor version of distributor order email, the order status trail,
-- CRM New Sale support, and the image-generated counters. Numbered 0227.
-- One statement per line, so each line can be pasted on its own in the TiDB
-- editor. Every table is cabinet_dealz.<table>. No table aliases, so a line
-- pastes cleanly into the TiDB Cloud editor.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
--
-- Safe to re-run, but not silent about it: this file uses PLAIN ADD COLUMN and
-- PLAIN CREATE TABLE, with no conditional-DDL keywords anywhere, because the
-- TiDB Cloud editor rejects them. On a second run those statements answer
-- "Duplicate column name ..." or "Table ... already exists". THAT ERROR IS SAFE:
-- the column or table already exists, which is what the statement wanted. Skip
-- that one line and paste the next.
--
-- Why: the order status dots ("Order verified", "Order shipped", "Order signed")
-- had nowhere to write, so marking an order failed with "Order status columns are
-- missing on order_requests". These are those columns, plus the distributor email
-- record, the CRM New Sale stage, and the image-generated counters.
--
-- Existing crm_deals.stage values are unchanged. new_sale is added beside them.
-- If your crm_deals.stage is already an ENUM with new_sale, statement 21 answers
-- "Data truncated" or is a no-op; it is safe to skip.
--
-- 0225 and 0226 belong to other changes. 0228 is the image-generation ledger.

-- 1. Which distributor the order was emailed to, and how it went. All four are read by the order trail and the Master Orders report.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN distributorEmailStatus VARCHAR(32) NULL;

-- 2. When the distributor PO was last successfully sent. Null means never sent.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN distributorEmailSentAt TIMESTAMP NULL;

-- 3. The recipients, so the trail can say who received it.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN distributorEmailTo VARCHAR(1024) NULL;

-- 4. The failure reason when a send failed. Null on success.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN distributorEmailError VARCHAR(1024) NULL;

-- 5. One row per distributor per order, so an order split across supply lines records each send. On a re-run the "Table already exists" error is safe to skip.
CREATE TABLE cabinet_dealz.order_distributor_emails (id INT NOT NULL AUTO_INCREMENT, orderRequestId INT NOT NULL, distributorId INT NOT NULL, distributorEmailStatus VARCHAR(32) NOT NULL DEFAULT 'pending', distributorEmailSentAt TIMESTAMP NULL, distributorEmailTo VARCHAR(1024) NULL, distributorEmailError VARCHAR(1024) NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY order_distributor_emails_order_dist_uq (orderRequestId, distributorId));

-- 6. When an administrator verified the order. This is the column the "Order verified" dot writes, and its absence is what made that button fail.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN orderVerifiedAt TIMESTAMP NULL;

-- 7. Who verified it, as "Name <email>". Shown as "Verified by Dana Reaves - Nov 5, 2026, 1:02 PM CT".
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN orderVerifiedBy VARCHAR(255) NULL;

-- 8. When it shipped, and 9. who marked it shipped. Same pattern as verified.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN orderShippedAt TIMESTAMP NULL;

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN orderShippedBy VARCHAR(255) NULL;

-- 10. The carrier booked, and 11. its tracking number.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN shipmentCarrier VARCHAR(120) NULL;

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN shipmentTracking VARCHAR(255) NULL;

-- 12. When delivery was signed for, and 13. who recorded it.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN orderSignedAt TIMESTAMP NULL;

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN orderSignedBy VARCHAR(255) NULL;

-- 14. The name of the person who signed, as opposed to the admin who typed it in.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN signerName VARCHAR(255) NULL;

-- 15. CRM sync result for this order: new_sale, failed, or null. And 16. its error text.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN crmSyncStatus VARCHAR(32) NULL;

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN crmSyncError VARCHAR(1024) NULL;

-- 17. The CRM deal this order created, so the trail can link straight to it.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN crmDealId INT NULL;

-- 18. How many 3D images were generated for this order, and 19. when the last one was.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN imageGeneratedCount INT NOT NULL DEFAULT 0;

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN lastImageGeneratedAt TIMESTAMP NULL;

-- 20. Set when the sale behind a deal is refunded. The deal itself is kept.
ALTER TABLE cabinet_dealz.crm_deals ADD COLUMN saleRefundedAt TIMESTAMP NULL;

-- 21. Add new_sale beside the existing stages. Existing values are unchanged. If your stage ENUM already lists new_sale this is a no-op, and "Data truncated" on a re-run is safe to skip.
ALTER TABLE cabinet_dealz.crm_deals MODIFY COLUMN stage ENUM('new','new_sale','contacted','qualified','image_review','quoted','won','lost') NOT NULL DEFAULT 'new';

-- 22. Verification, read-only. Expect the seven numbers and dates below to exist. Any that are missing means the matching statement above did not run.
SELECT id, requestNumber, distributorEmailStatus, distributorEmailSentAt, distributorEmailTo, orderVerifiedAt, orderShippedAt, orderSignedAt, crmSyncStatus, crmDealId, imageGeneratedCount, lastImageGeneratedAt FROM cabinet_dealz.order_requests ORDER BY id DESC LIMIT 20;

-- 23. Verification, read-only. Expect one row per column this file adds, with a real data type. Anything absent did not run.
SELECT column_name AS presentColumn, data_type AS columnType, is_nullable AS nullable FROM information_schema.columns WHERE table_schema = 'cabinet_dealz' AND table_name = 'order_requests' AND column_name IN ('distributorEmailStatus','distributorEmailSentAt','distributorEmailTo','distributorEmailError','orderVerifiedAt','orderVerifiedBy','orderShippedAt','orderShippedBy','shipmentCarrier','shipmentTracking','orderSignedAt','orderSignedBy','signerName','crmSyncStatus','crmSyncError','crmDealId','imageGeneratedCount','lastImageGeneratedAt') ORDER BY column_name;
