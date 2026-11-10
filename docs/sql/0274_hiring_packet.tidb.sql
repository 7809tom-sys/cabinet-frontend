-- Hiring and onboarding packets. File number 0274.
-- Paste ONE LINE at a time in the TiDB Cloud SQL editor. Every statement is
-- on a single line by design, and every table is cabinet_dealz.<table>.
-- No IF-NOT-EXISTS clause, because TiDB Cloud rejects that form of CREATE TABLE in some regions.
--
-- Not applied by the application, and never run by CI. Tom runs it by hand.
-- Do not run this against production from an application or a script.
--
-- Safe to re-run, but not silent: on a second run a CREATE TABLE answers
-- "Table ... already exists" and a CREATE INDEX answers "Duplicate key name".
-- THAT ERROR IS SAFE: the object already exists. Skip that line and paste the
-- next. No statement here is a DELETE, DROP, TRUNCATE, ALTER, or UPDATE, so a
-- re-run cannot change or destroy existing data.
--
-- What this adds:
--
--   hiring_packets              one row per hire or applicant.
--   hiring_packet_documents     the six forms (application, I-9 Section 1,
--                               W-4, state withholding, direct deposit, policy).
--                               payloadJson holds the answers. The application
--                               must not write that column to a log.
--   hiring_packet_files         ID uploads. storageKey is always under
--                               hiring-packets/, which stays in the private
--                               bucket. The only way out is a short-lived
--                               signed URL. There is no public URL column.
--   hiring_packet_signatures    APPEND-ONLY typed-name signature evidence,
--                               matching the columns of affiliate_legal_signatures
--                               (SQL 0272): signer, email, content hash,
--                               provider, optional provider submission id.
--   hiring_settings             the state withholding code and the handbook.
--                               stateCode is null until an admin sets it.
--                               Nothing here inserts a person or a state.

-- 1. One packet per hire.
CREATE TABLE cabinet_dealz.hiring_packets (id INT NOT NULL AUTO_INCREMENT, userId INT NULL, applicantEmail VARCHAR(320) NOT NULL, applicantName VARCHAR(255) NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), KEY hiring_packets_user_idx (userId), KEY hiring_packets_email_idx (applicantEmail)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. The six forms. One row per packet and form.
CREATE TABLE cabinet_dealz.hiring_packet_documents (id INT NOT NULL AUTO_INCREMENT, packetId INT NOT NULL, kind VARCHAR(40) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'not_started', payloadJson MEDIUMTEXT NULL, signedAt TIMESTAMP NULL DEFAULT NULL, signedByUserId INT NULL, signedByName VARCHAR(255) NULL, reviewedAt TIMESTAMP NULL DEFAULT NULL, reviewedByUserId INT NULL, reviewedByName VARCHAR(255) NULL, contentSha256 VARCHAR(64) NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY hiring_packet_documents_packet_kind_uq (packetId, kind), KEY hiring_packet_documents_status_idx (status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Private ID files. storageKey is the private-bucket key, never a public URL.
CREATE TABLE cabinet_dealz.hiring_packet_files (id INT NOT NULL AUTO_INCREMENT, packetId INT NOT NULL, documentKind VARCHAR(40) NOT NULL, slot VARCHAR(32) NOT NULL, storageKey VARCHAR(512) NOT NULL, filename VARCHAR(255) NOT NULL, mimeType VARCHAR(128) NOT NULL, sizeBytes INT NOT NULL, uploadedByUserId INT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), KEY hiring_packet_files_packet_idx (packetId, documentKind)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Append-only signature evidence. A later signature inserts another row.
CREATE TABLE cabinet_dealz.hiring_packet_signatures (id INT NOT NULL AUTO_INCREMENT, packetId INT NOT NULL, documentId INT NOT NULL, kind VARCHAR(40) NOT NULL, signerUserId INT NULL, signerName VARCHAR(255) NOT NULL, signerEmail VARCHAR(320) NULL, contentSha256 VARCHAR(64) NOT NULL, provider VARCHAR(16) NOT NULL DEFAULT 'typed-name', providerSubmissionId VARCHAR(64) NULL, signedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY hiring_packet_signatures_document_hash_uq (documentId, contentSha256), KEY hiring_packet_signatures_packet_idx (packetId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Which state withholding certificate the company uses, and the handbook the hire signs. No row is inserted here.
CREATE TABLE cabinet_dealz.hiring_settings (id INT NOT NULL AUTO_INCREMENT, stateCode VARCHAR(2) NULL, handbookTitle VARCHAR(255) NULL, handbookVersion VARCHAR(64) NULL, handbookBody MEDIUMTEXT NULL, updatedByUserId INT NULL, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. VERIFY the five tables exist. Expect five rows.
SELECT table_name AS createdTable FROM information_schema.tables WHERE table_schema = 'cabinet_dealz' AND table_name IN ('hiring_packets', 'hiring_packet_documents', 'hiring_packet_files', 'hiring_packet_signatures', 'hiring_settings') ORDER BY table_name;

-- 7. VERIFY the signature row cannot be duplicated for the same document and the same bytes. Expect uniqueKey = 1.
SELECT index_name AS indexName, non_unique AS notUnique, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnsCovered FROM information_schema.statistics WHERE table_schema = 'cabinet_dealz' AND table_name = 'hiring_packet_signatures' AND index_name = 'hiring_packet_signatures_document_hash_uq' GROUP BY index_name, non_unique;

-- 8. Read-only. Empty until a hire starts a packet. No personal data is written by this file.
SELECT id AS packetId, userId, applicantEmail, applicantName, createdAt FROM cabinet_dealz.hiring_packets ORDER BY id;
