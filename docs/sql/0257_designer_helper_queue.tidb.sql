-- TiDB SQL editor version. Numbered 0257. Run after 0256.
-- (This file has moved twice to avoid clashing with numbers other open PRs are
--  using: 0249 is 0249_kbis_2027_booth_assets, 0255 is
--  0255_library_internal_documents in PR 269, and 0256 is reserved for PR 274.)
-- Paste one numbered statement at a time, in order.
-- One statement per line. Every table and index target is cabinet_dealz.<table>.
-- DO NOT let an automatic migration run this. It is for Tom to run by hand.
--
-- IMPORTANT — this file has no IF NOT EXISTS. The TiDB Cloud SQL editor rejects
-- it, so the statements below are plain CREATE TABLE / CREATE INDEX.
-- That means a second run FAILS on everything it already created:
--   "Table 'designer_helper_queue' already exists"  -> safe, skip that statement
--   "Duplicate key name 'designer_helper_requests_status_idx'" -> safe, skip it
-- Only those two messages are safe to skip. Any other error is real: stop and
-- send it back rather than working around it.
--
-- Why: a customer in the 3D Designer can press "Share / Get a designer helper".
-- That shares the current design and creates one help request. Designers whose
-- Helper sign is on are queued for it, get an in-app notice, and get an email to
-- the address on their own user account. An admin also sees a pop-up and can join
-- the customer's design, which records who joined and when.
--
-- Three new tables and no changes to existing ones:
--   designer_helper_queue    one row per designer: the Helper sign and when it was
--                            turned on. The designer's email is NOT copied here; it
--                            is read from users.email at notify time, so a queue
--                            entry always carries the address on file.
--   designer_helper_requests one row per customer help request, with the design it
--                            shared, the customer's note, the status, and who
--                            accepted / joined and when.
--   designer_helper_events   append-only trail (requested, notified, emailed,
--                            email_skipped, accepted, joined, closed).
--
-- This file inserts nothing, updates no rows, and deletes nothing.

-- 1. Read-only, and always safe to run: which of the three tables exist now. Expect zero rows on the first run.
SELECT table_name AS presentTable FROM information_schema.tables WHERE table_schema = 'cabinet_dealz' AND table_name IN ('designer_helper_queue', 'designer_helper_requests', 'designer_helper_events') ORDER BY table_name;

-- 2. The Helper sign, one row per designer. available = 1 means he is queued. signedOnAt is when the sign was turned on; the queue is offered longest-waiting first. On a re-run this reports the table already exists — skip it.
CREATE TABLE cabinet_dealz.designer_helper_queue (id INT NOT NULL AUTO_INCREMENT, designerUserId INT NOT NULL, available TINYINT(1) NOT NULL DEFAULT 0, signedOnAt TIMESTAMP NULL, acceptedCount INT NOT NULL DEFAULT 0, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY designer_helper_queue_user_uq (designerUserId));

-- 3. One customer help request. shareToken is the customer's own read-only link. acceptedBy / joinedBy are the real staff ids and names with their times, so "who accepted and when" and "who joined and when" are recorded facts. On a re-run this reports the table already exists — skip it.
CREATE TABLE cabinet_dealz.designer_helper_requests (id INT NOT NULL AUTO_INCREMENT, designId INT NULL, designName VARCHAR(256) NULL, customerUserId INT NULL, customerName VARCHAR(256) NULL, customerEmail VARCHAR(320) NULL, customerPhone VARCHAR(32) NULL, helpNote TEXT NULL, status VARCHAR(16) NOT NULL DEFAULT 'open', shareToken VARCHAR(64) NULL, affiliateId INT NULL, requestedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, acceptedByUserId INT NULL, acceptedByName VARCHAR(256) NULL, acceptedAt TIMESTAMP NULL, joinedByUserId INT NULL, joinedByName VARCHAR(256) NULL, joinedAt TIMESTAMP NULL, closedAt TIMESTAMP NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id));

-- 4. The live-request list reads status and time. On a re-run this reports "Duplicate key name" — skip it.
CREATE INDEX designer_helper_requests_status_idx ON cabinet_dealz.designer_helper_requests (status, requestedAt);

-- 5. Append-only trail: one row per thing that happened to a request. On a re-run this reports the table already exists — skip it.
CREATE TABLE cabinet_dealz.designer_helper_events (id INT NOT NULL AUTO_INCREMENT, requestId INT NOT NULL, action VARCHAR(32) NOT NULL, actorUserId INT NULL, actorName VARCHAR(256) NULL, detail VARCHAR(512) NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id));

-- 6. A request's trail reads one request at a time, newest last. On a re-run this reports "Duplicate key name" — skip it.
CREATE INDEX designer_helper_events_request_idx ON cabinet_dealz.designer_helper_events (requestId, createdAt);

-- 7. Read-only, always safe: confirm all three tables now exist. Expect three rows after statements 2, 3 and 5.
SELECT table_name AS addedTable FROM information_schema.tables WHERE table_schema = 'cabinet_dealz' AND table_name IN ('designer_helper_queue', 'designer_helper_requests', 'designer_helper_events') ORDER BY table_name;

-- 8. Read-only, always safe: who has the Helper sign on, and the address on file the next request would be mailed to. Expect zero rows right after this file runs, because nothing is backfilled.
SELECT queue_row.designerUserId AS designerUserId, users_row.name AS designerName, users_row.email AS emailOnFile, queue_row.available AS helperSignOn, queue_row.signedOnAt AS signedOnAt FROM cabinet_dealz.designer_helper_queue AS queue_row LEFT JOIN cabinet_dealz.users AS users_row ON users_row.id = queue_row.designerUserId ORDER BY queue_row.signedOnAt LIMIT 50;

-- 9. Read-only, always safe: every designer account the Helper sign is available to. Nothing is inserted for anyone, so each starts OFF until he turns it on.
SELECT designer_row.id AS designerUserId, designer_row.name AS designerName, designer_row.role AS role FROM cabinet_dealz.users AS designer_row WHERE designer_row.role = 'designer' ORDER BY designer_row.id LIMIT 50;

-- Note on backfill: none. A designer with no designer_helper_queue row is treated as "Helper sign off": he is not queued and receives no request. The first time he turns the sign on, the row is created with signedOnAt = now.
