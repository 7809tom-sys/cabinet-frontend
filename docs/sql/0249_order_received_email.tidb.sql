-- Customer order emails and the distributor PO price fix.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS only.
--
-- 0249 adds the two stamps for the short "we received your order" note. It is a
-- separate email from the verified note, so it gets its own columns and the two
-- can never overwrite each other. No row is written by this file: an
-- administrator sends the note from the admin order page.

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderReceivedEmailSentAt TIMESTAMP NULL;

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderReceivedEmailTo VARCHAR(320) NULL;

SELECT r.id, r.requestNumber, r.orderReceivedEmailSentAt, r.orderReceivedEmailTo, r.orderVerifiedAt FROM cabinet_dealz.order_requests AS r ORDER BY r.id DESC LIMIT 10;
