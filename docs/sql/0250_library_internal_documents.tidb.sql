-- TiDB SQL editor version. Numbered 0250. Run after 0249.
-- One statement per line, so each line can be pasted on its own in the TiDB
-- editor. Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, a guarded INSERT, and an UPDATE
-- whose WHERE clause cannot match a row twice.
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
-- Number order: 0249 is reserved by the open KBIS booth-assets pull request, so
-- this file takes the next free number, 0250. Run 0249 first if it has landed.
--
-- The internal proposal PDF ships in the frontend repo at
-- docs/library/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf
-- (excluded from the Vercel build by .vercelignore). It is never served from the
-- site: the row above points at the private bucket, and the importer in the patch
-- uploads the committed file there.
--
-- Rollback: the three ALTERs are additive and harm nothing if left in place.
-- Dropping `visibility` returns every document to the old isPublished-only
-- behaviour. The last statement below shows the internal row so it can be
-- deleted by id.

-- 1. Read-only: the columns this file adds, and whether they already exist.
SELECT existing_column.column_name AS presentColumn, existing_column.data_type AS columnType, existing_column.is_nullable AS nullable FROM information_schema.columns AS existing_column WHERE existing_column.table_schema = 'cabinet_dealz' AND existing_column.table_name = 'affiliate_literature' AND existing_column.column_name IN ('visibility', 'affiliateToggledAt', 'affiliateToggledBy', 'affiliateToggledByName') ORDER BY existing_column.column_name;

-- 2. Read-only: what the library holds today, so the backfill below is predictable.
SELECT existing_literature.id AS literatureId, existing_literature.title, existing_literature.mimeType, existing_literature.isPublished FROM cabinet_dealz.affiliate_literature AS existing_literature ORDER BY existing_literature.id;

-- 3. The visibility column. Internal is the default, so every new upload is admin-only until an admin checks "Affiliate library".
ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'internal';

-- 4. When the "Affiliate library" checkbox was last changed. Null means never toggled.
ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN IF NOT EXISTS affiliateToggledAt DATETIME NULL;

-- 5. Which admin account changed it. Null means never toggled, or the account was deleted.
ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN IF NOT EXISTS affiliateToggledBy INT NULL;

-- 6. The admin's display name at the moment of the toggle, so the audit line survives a rename.
ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN IF NOT EXISTS affiliateToggledByName VARCHAR(255) NULL;

-- 7. Keep the affiliate portal exactly as it is today: a document that is already published was already visible to affiliates, so it becomes affiliate-visible rather than silently disappearing. A row an admin later unchecks has isPublished set to 0 by the backend, so this WHERE clause cannot re-publish it on a re-run.
UPDATE cabinet_dealz.affiliate_literature AS backfill_literature SET backfill_literature.visibility = 'affiliate' WHERE backfill_literature.visibility = 'internal' AND backfill_literature.isPublished = 1 AND backfill_literature.affiliateToggledAt IS NULL;

-- 8. Index for the affiliate read, which is always "visibility = affiliate AND isPublished = 1".
CREATE INDEX IF NOT EXISTS affiliate_literature_visibility_idx ON cabinet_dealz.affiliate_literature (visibility, isPublished, sortOrder);

-- 9. Register the Marazzi / website-improvement proposal as an INTERNAL document: visibility internal, isPublished 0, no affiliate toggle recorded. The bytes are NOT public: fileKey sits under library-documents/, which the patched backend puts in the private Supabase bucket and refuses on the public storage proxy. Upload the committed PDF to that exact key with the importer in docs/patches/cabinet-backend-library-internal-documents.patch, then it opens from the admin page only.
INSERT INTO cabinet_dealz.affiliate_literature (title, description, category, filename, fileKey, url, mimeType, sizeBytes, isPublished, visibility, sortOrder) SELECT 'Website Improvement Proposal — Lessons from Marazzi USA', 'Internal strategy proposal for Tom. Adapts Marazzi USA merchandising patterns (shop-by-look, room-first product pages, sample doors as CRM leads, find-a-dealer) to Cabinetdealz, in three phases. Internal only: never shown on the public site or in an affiliate portal.', 'Internal', 'website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf', 'library-documents/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf', '/manus-storage/library-documents/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf', 'application/pdf', 92281, 0, 'internal', 900 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_literature AS present_literature WHERE present_literature.fileKey = 'library-documents/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf');

-- 10. Read-only check: the library after this file, with the visibility the backend will enforce.
SELECT checked_literature.id AS literatureId, checked_literature.title, checked_literature.visibility, checked_literature.isPublished, checked_literature.affiliateToggledAt, checked_literature.affiliateToggledByName FROM cabinet_dealz.affiliate_literature AS checked_literature ORDER BY checked_literature.visibility, checked_literature.sortOrder, checked_literature.id;

-- 11. Read-only check: exactly what an affiliate portal can see. This should list only visibility = 'affiliate' rows, and never the proposal.
SELECT affiliate_visible_literature.id AS literatureId, affiliate_visible_literature.title, affiliate_visible_literature.visibility FROM cabinet_dealz.affiliate_literature AS affiliate_visible_literature WHERE affiliate_visible_literature.visibility = 'affiliate' AND affiliate_visible_literature.isPublished = 1 ORDER BY affiliate_visible_literature.sortOrder, affiliate_visible_literature.id;
