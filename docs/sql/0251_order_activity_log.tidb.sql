-- TiDB SQL editor version. Numbered 0251. Run after 0227.
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
-- Why: three things needed a home.
--
--   1-2  The short "we received your order" note. It is a separate email from the
--        verified note, so it gets its own columns and the two can never
--        overwrite each other.
--   3-4  Who sent the distributor PO. 0227 added distributorEmailSentAt but no
--        "by", so the trail could say when but not who. An administrator sending
--        the PO records their name; an automatic send records 'system'.
--   5    The append-only activity log. Every action - including a resend, which
--        would otherwise overwrite the previous send time - becomes its own row,
--        so the sales order timeline can show each one with a named person.
--
-- The activity log's verification query at the end proves the table is there.
-- No row is written to it by this file: the backend writes as actions happen.
--
-- Number order: 0249 is taken by the KBIS booth assets and 0250 by the payment
-- notice, so this file uses 0251.

-- 1. When the "we received your order" note was sent. Null means never sent. Deliberately separate from distributorEmailSentAt.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN orderReceivedEmailSentAt TIMESTAMP NULL;

-- 2. Who received that note.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN orderReceivedEmailTo VARCHAR(320) NULL;

-- 3. Who sent the distributor PO: an administrator's "Name <email>", or 'system' for an automatic send.
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN distributorEmailSentBy VARCHAR(255) NULL;

-- 4. The same actor on the per-distributor row, so the order summary and the per-distributor record agree.
ALTER TABLE cabinet_dealz.order_distributor_emails ADD COLUMN distributorEmailSentBy VARCHAR(255) NULL;

-- 5. The append-only activity log. Every status action writes one row; nothing updates or deletes them. On a re-run the "Table already exists" error is safe to skip. The index is created separately below so this stays one statement on one line.
CREATE TABLE cabinet_dealz.order_events (id INT NOT NULL AUTO_INCREMENT, orderRequestId INT NOT NULL, action VARCHAR(64) NOT NULL, actorUserId INT NULL, actorName VARCHAR(255) NULL, detail VARCHAR(1024) NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id));

-- 6. The read the timeline always makes: one order's events, oldest first. "Duplicate key name" on a re-run is safe to skip.
CREATE INDEX order_events_order_created_idx ON cabinet_dealz.order_events (orderRequestId, createdAt);

-- 7. Verification, read-only. Expect the three new order columns. Anything absent did not run.
SELECT column_name AS presentColumn, data_type AS columnType FROM information_schema.columns WHERE table_schema = 'cabinet_dealz' AND table_name = 'order_requests' AND column_name IN ('orderReceivedEmailSentAt','orderReceivedEmailTo','distributorEmailSentBy') ORDER BY column_name;

-- 8. Verification, read-only. Expect the order_events table and its four data columns. This is what the sales order timeline reads.
SELECT column_name AS presentColumn, data_type AS columnType FROM information_schema.columns WHERE table_schema = 'cabinet_dealz' AND table_name = 'order_events' ORDER BY ordinal_position;

-- 9. Verification, read-only. Orders that predate the log still show a timeline: the backend backfills it from these columns on first read. Expect your existing status timestamps here.
SELECT id, requestNumber, orderReceivedEmailSentAt, distributorEmailSentAt, distributorEmailSentBy, orderVerifiedAt, orderShippedAt, orderSignedAt FROM cabinet_dealz.order_requests ORDER BY id DESC LIMIT 20;
