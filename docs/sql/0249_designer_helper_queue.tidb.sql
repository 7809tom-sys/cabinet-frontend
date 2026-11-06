-- TiDB SQL editor version. Numbered 0249. Run after 0248.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- DO NOT let an automatic migration run this. It is for Tom to run by hand.
--
-- Why: a customer in the 3D Designer can press "Share / Get a designer helper".
-- That shares the current design and creates one help request. Designers whose
-- Helper sign is on are queued for it, get an in-app notice, and get an email
-- to the address on their own user account. An admin also sees a pop-up and can
-- join the customer's design, which records who joined and when.
--
-- Two new tables and no changes to existing ones:
--   designer_helper_queue    one row per designer: the Helper sign and when it
--                            was turned on. The designer's email is NOT copied
--                            here; it is read from users.email at notify time so
--                            the queue entry always carries the address on file.
--   designer_helper_requests one row per customer help request, with the design
--                            it shared, the customer's note, the status, and who
--                            accepted / joined and when.
--   designer_helper_events   append-only trail (requested, notified, emailed,
--                            email_skipped, accepted, joined, closed).
--
-- This file inserts nothing, updates no rows, and deletes nothing.

-- 1. Read-only: confirm the two tables are still absent. Safe to run twice.
SELECT
  existing.table_name AS presentTable
FROM information_schema.tables AS existing
WHERE existing.table_schema = 'cabinet_dealz'
  AND existing.table_name IN ('designer_helper_queue', 'designer_helper_requests', 'designer_helper_events')
ORDER BY existing.table_name;

-- 2. The Helper sign, one row per designer. available = 1 means he is queued.
--    signedOnAt is the moment the sign was turned on; the queue is ordered by it
--    so the longest-waiting designer is offered the next request first.
CREATE TABLE IF NOT EXISTS cabinet_dealz.designer_helper_queue (
  id INT NOT NULL AUTO_INCREMENT,
  designerUserId INT NOT NULL,
  available TINYINT(1) NOT NULL DEFAULT 0,
  signedOnAt TIMESTAMP NULL,
  acceptedCount INT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY designer_helper_queue_user_uq (designerUserId)
);

-- 3. One customer help request. shareToken is the customer's own read-only link.
--    acceptedBy/joinedBy are the real staff ids and names, with their times, so
--    "who accepted and when" and "who joined and when" are recorded facts.
CREATE TABLE IF NOT EXISTS cabinet_dealz.designer_helper_requests (
  id INT NOT NULL AUTO_INCREMENT,
  designId INT NULL,
  designName VARCHAR(256) NULL,
  customerUserId INT NULL,
  customerName VARCHAR(256) NULL,
  customerEmail VARCHAR(320) NULL,
  customerPhone VARCHAR(32) NULL,
  helpNote TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  shareToken VARCHAR(64) NULL,
  affiliateId INT NULL,
  requestedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acceptedByUserId INT NULL,
  acceptedByName VARCHAR(256) NULL,
  acceptedAt TIMESTAMP NULL,
  joinedByUserId INT NULL,
  joinedByName VARCHAR(256) NULL,
  joinedAt TIMESTAMP NULL,
  closedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 4. The open-request list reads status and time; the design reads designId.
CREATE INDEX IF NOT EXISTS designer_helper_requests_status_idx
  ON cabinet_dealz.designer_helper_requests (status, requestedAt);

-- 5. Append-only trail. One row per thing that happened to a request.
CREATE TABLE IF NOT EXISTS cabinet_dealz.designer_helper_events (
  id INT NOT NULL AUTO_INCREMENT,
  requestId INT NOT NULL,
  action VARCHAR(32) NOT NULL,
  actorUserId INT NULL,
  actorName VARCHAR(256) NULL,
  detail VARCHAR(512) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 6. A request's trail is read newest-last for one request at a time.
CREATE INDEX IF NOT EXISTS designer_helper_events_request_idx
  ON cabinet_dealz.designer_helper_events (requestId, createdAt);

-- 7. Read-only check: confirm all three tables now exist.
SELECT
  added.table_name AS addedTable
FROM information_schema.tables AS added
WHERE added.table_schema = 'cabinet_dealz'
  AND added.table_name IN ('designer_helper_queue', 'designer_helper_requests', 'designer_helper_events')
ORDER BY added.table_name;

-- 8. Read-only spot check: who has the Helper sign on right now, and with which
--    email address the next request would be mailed to them. It joins the real
--    users row, because that is where the address on file lives.
SELECT
  queue_row.designerUserId AS designerUserId,
  users_row.name AS designerName,
  users_row.email AS emailOnFile,
  queue_row.available AS helperSignOn,
  queue_row.signedOnAt AS signedOnAt
FROM cabinet_dealz.designer_helper_queue AS queue_row
LEFT JOIN cabinet_dealz.users AS users_row ON users_row.id = queue_row.designerUserId
ORDER BY queue_row.signedOnAt
LIMIT 50;

-- 9. Read-only spot check: a designer is seeded OFF. Nothing is inserted for
--    anyone, so every designer keeps a blank Helper sign until he turns it on.
SELECT
  designer_row.id AS designerUserId,
  designer_row.name AS designerName,
  designer_row.role AS role
FROM cabinet_dealz.users AS designer_row
WHERE designer_row.role = 'designer'
ORDER BY designer_row.id
LIMIT 50;

-- Note on backfill: none. A designer with no designer_helper_queue row is
-- treated as "Helper sign off": he is not queued and receives no request. The
-- first time he turns the sign on, the row is created with signedOnAt = now.
