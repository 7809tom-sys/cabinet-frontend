-- TiDB SQL editor version. Numbered 0255. Run after 0254.
-- One statement per line, so each line can be pasted on its own in the TiDB
-- editor. Every table is cabinet_dealz.<table>. No reserved-word aliases and no
-- table aliases, so a line pastes cleanly into the TiDB Cloud editor.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
--
-- Statement 1 is the visibility column on its own. Nothing else in this file may
-- sit in front of it: every later statement reads that column, so if it is not
-- added first the rest fails with "Unknown column 'visibility'".
--
-- Safe to re-run, but not silent about it: this file uses PLAIN ADD COLUMN and
-- PLAIN CREATE INDEX, because TiDB Cloud rejects "ADD COLUMN IF NOT EXISTS" and
-- "CREATE INDEX IF NOT EXISTS". On a second run those statements answer
-- "Duplicate column name ..." or "Duplicate key name ...". THAT ERROR IS SAFE:
-- the column or index already exists, which is what the statement wanted. Skip
-- that one line and paste the next.
--
-- Why: the document library could only express "published" or "not published",
-- so an internal strategy document had no safe home. Now every document carries
-- a visibility, and the two states are the only two states:
--
--   internal   admin only. Never returned by an affiliate query, never served
--              from a public path. This is the default for a new PDF.
--   affiliate  the admin checked "Affiliate library". A SIGNED-IN affiliate
--              sees it in the portal's Printed Materials, through a signed
--              storage URL. It is still not public: there is no third value,
--              no public query, and no public bucket path for these files.
--
-- The checkbox is the only writer of these columns. The backend refuses to
-- serve a document to an affiliate unless visibility = 'affiliate' AND
-- isPublished = 1, so a hand edit to one column alone cannot publish a file.
--
-- affiliateToggledByName is a snapshot of the admin's name at the moment of the
-- toggle, so the audit line survives a rename or a deleted account.
--
-- Number order: 0250 belongs to the kitchen rules SQL, 0251-0253 to pull
-- request 268, and 0254 is taken, so this file uses 0255.
--
-- The internal proposal PDF ships in the frontend repo at
-- docs/library/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf
-- (excluded from the Vercel build by .vercelignore). It is never served from the
-- site: the row below points at the private bucket, and the importer in the patch
-- uploads the committed file there.
--
-- Rollback: the four ALTERs are additive and harm nothing if left in place.
-- Dropping `visibility` returns every document to the old isPublished-only
-- behaviour. The last statement shows the internal row so it can be deleted by id.

-- 1. FIRST AND ON ITS OWN. The visibility column. Internal is the default, so every new upload is admin-only until an admin checks "Affiliate library". This must succeed before any line below runs.
ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT 'internal';

-- 2. When the "Affiliate library" checkbox was last changed. Null means never toggled.
ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN affiliateToggledAt DATETIME NULL;

-- 3. Which admin account changed it. Null means never toggled, or the account was deleted.
ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN affiliateToggledBy INT NULL;

-- 4. The admin's display name at the moment of the toggle, so the audit line survives a rename.
ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN affiliateToggledByName VARCHAR(255) NULL;

-- 5. Verification. This reads visibility, so it succeeds only if statement 1 worked. Expect documentCount greater than zero; internalCount is how many documents the affiliate portal cannot see. Do not go past this line until it returns a number.
SELECT COUNT(*) AS documentCount, SUM(CASE WHEN visibility = 'internal' THEN 1 ELSE 0 END) AS internalCount FROM cabinet_dealz.affiliate_literature;

-- 6. Verification, the four columns this file adds, with their real types. Expect four rows before you continue.
SELECT column_name AS presentColumn, data_type AS columnType, is_nullable AS nullable, column_default AS defaultValue FROM information_schema.columns WHERE table_schema = 'cabinet_dealz' AND table_name = 'affiliate_literature' AND column_name IN ('visibility', 'affiliateToggledAt', 'affiliateToggledBy', 'affiliateToggledByName') ORDER BY column_name;

-- 7. Verification, current state, so the backfill below is predictable. Read-only.
SELECT id AS literatureId, title, mimeType, isPublished, visibility FROM cabinet_dealz.affiliate_literature ORDER BY id;

-- 8. Keep the affiliate portal exactly as it is today: a document that is already published was already visible to affiliates, so it becomes affiliate-visible rather than silently disappearing. No table alias here. A row an admin later unchecks has isPublished set to 0 by the backend, so this WHERE clause cannot re-publish it on a re-run.
UPDATE cabinet_dealz.affiliate_literature SET visibility = 'affiliate' WHERE visibility = 'internal' AND isPublished = 1 AND affiliateToggledAt IS NULL;

-- 9. Index for the affiliate read, which is always "visibility = affiliate AND isPublished = 1". "Duplicate key name" on a re-run is safe to skip.
CREATE INDEX affiliate_literature_visibility_idx ON cabinet_dealz.affiliate_literature (visibility, isPublished, sortOrder);

-- 10. Register the Marazzi / website-improvement proposal as an INTERNAL document: visibility internal, isPublished 0, no affiliate toggle recorded. The bytes are NOT public: fileKey sits under library-documents/, which the patched backend puts in the private Supabase bucket and refuses on the public storage proxy. Upload the committed PDF to that exact key with the importer in docs/patches/cabinet-backend-library-internal-documents.patch, then it opens from the admin page only.
INSERT INTO cabinet_dealz.affiliate_literature (title, description, category, filename, fileKey, url, mimeType, sizeBytes, isPublished, visibility, sortOrder) SELECT 'Website Improvement Proposal — Lessons from Marazzi USA', 'Internal strategy proposal for Tom. Adapts Marazzi USA merchandising patterns (shop-by-look, room-first product pages, sample doors as CRM leads, find-a-dealer) to Cabinetdealz, in three phases. Internal only: never shown on the public site or in an affiliate portal.', 'Internal', 'website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf', 'library-documents/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf', '/manus-storage/library-documents/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf', 'application/pdf', 92281, 0, 'internal', 900 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_literature WHERE fileKey = 'library-documents/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf');

-- 11. Read-only check: the library after this file, with the visibility the backend will enforce.
SELECT id AS literatureId, title, visibility, isPublished, affiliateToggledAt, affiliateToggledByName FROM cabinet_dealz.affiliate_literature ORDER BY visibility, sortOrder, id;

-- 12. Read-only check: exactly what an affiliate portal can see. This should list only visibility = 'affiliate' rows, and never the proposal.
SELECT id AS literatureId, title, visibility FROM cabinet_dealz.affiliate_literature WHERE visibility = 'affiliate' AND isPublished = 1 ORDER BY sortOrder, id;
