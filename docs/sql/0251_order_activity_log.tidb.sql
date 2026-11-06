-- Order activity log, and who sent the distributor PO.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.
--
-- 1-2  The short "we received your order" note. It is a separate email from the
--      verified note, so it gets its own columns and the two can never overwrite
--      each other. No row is written by this file: an administrator sends it from
--      the admin order page.
-- 3    Who sent the distributor PO. 0227 added distributorEmailSentAt but no
--      "by", so the trail could say when but not who. An administrator sending
--      the PO records their name/email; an automatic send records 'system'.
-- 4    The same actor on the per-distributor row, so the order-level summary and
--      the per-distributor record agree.
-- 5    The append-only activity log. Every action — including repeats such as a
--      resend — becomes its own row, so the sales order timeline can show the
--      full history with a named person on each line. It is append-only by
--      convention: nothing in the app updates or deletes these rows.
--      Orders that predate this table are backfilled at read time from their own
--      *_At / *_By columns; see server/lib/orderActivityLog.ts.
--
-- Numbering: 0249 is taken by 0249_kbis_2027_booth_assets and 0250 by
-- 0250_payment_notice_email, so this is 0251.

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderReceivedEmailSentAt TIMESTAMP NULL;

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS orderReceivedEmailTo VARCHAR(320) NULL;

ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS distributorEmailSentBy VARCHAR(255) NULL;

ALTER TABLE cabinet_dealz.order_distributor_emails ADD COLUMN IF NOT EXISTS distributorEmailSentBy VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS cabinet_dealz.order_events (
  id INT NOT NULL AUTO_INCREMENT,
  orderRequestId INT NOT NULL,
  action VARCHAR(64) NOT NULL,
  actorUserId INT NULL,
  actorName VARCHAR(255) NULL,
  detail VARCHAR(1024) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY order_events_order_created_idx (orderRequestId, createdAt)
);

SELECT r.id, r.requestNumber, r.orderReceivedEmailSentAt, r.orderVerifiedAt, r.distributorEmailSentAt, r.distributorEmailSentBy, r.orderShippedAt, r.orderSignedAt FROM cabinet_dealz.order_requests AS r ORDER BY r.id DESC LIMIT 10;

SELECT e.orderRequestId, e.action, e.actorName, e.createdAt FROM cabinet_dealz.order_events AS e ORDER BY e.id DESC LIMIT 20;
