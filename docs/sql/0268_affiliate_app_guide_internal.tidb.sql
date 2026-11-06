-- TiDB SQL editor version. Numbered 0268. Run after 0267.
-- One statement per line, so each line can be pasted on its own in the TiDB
-- editor. Every table is cabinet_dealz.<table>. No table aliases, so a line
-- pastes cleanly into the TiDB Cloud editor.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
--
-- Requires 0255 first: that file adds the visibility and affiliate-toggle
-- columns this row writes. If 0255 has not run, statement 3 answers
-- "Unknown column 'visibility'" and nothing is registered.
--
-- Registers "How to Create an App for an Affiliate" as an INTERNAL document, the
-- same way 0255 registers the Marazzi proposal:
--
--   visibility = 'internal'   admin only. Never returned by an affiliate query.
--   isPublished = 0           the affiliate portal read needs 1 as well.
--   category = 'Internal'     the admin library's internal category.
--   fileKey under library-documents/internal/, which the backend keeps in the
--   private Supabase bucket and refuses on the public storage proxy, so the
--   guide has no public address even if the key leaks.
--
-- The markdown ships in the frontend repo at
-- docs/library/internal/how-to-create-an-app-for-an-affiliate.md (8025 bytes,
-- SHA-256 66c0e9043fb15caad4d57283be87692c412ba66c80f2ab33d029617780579336).
-- It is never served from the site: `docs` is in .vercelignore, so Vite copies
-- none of it into dist/. The committed file is uploaded to the private bucket by
-- the importer in docs/patches/cabinet-backend-affiliate-app-guide-internal.patch.
--
-- Run order: upload the file FIRST, then paste statements 1-5 here. The importer
-- does not need the row to exist, so the bytes are already in the bucket at the
-- exact fileKey statement 3 stores. The reverse order leaves an admin library
-- entry whose Open button answers 404 until the upload runs.
--
-- Safe to re-run: statement 3 is guarded on the fileKey, so a second run
-- registers nothing and updates nothing.
--
-- Rollback: statement 4 shows the row so it can be deleted by id. Deleting it
-- removes the library entry only; the committed markdown is not touched.

-- 1. PREVIEW (read-only). Expect zero rows before the insert. A row here means the guide is already registered: stop, do not run statement 3.
SELECT id AS literatureId, title, category, visibility, isPublished, fileKey, mimeType, sizeBytes, sortOrder FROM cabinet_dealz.affiliate_literature WHERE title = 'How to Create an App for an Affiliate' OR fileKey = 'library-documents/internal/how-to-create-an-app-for-an-affiliate.md' ORDER BY id;

-- 2. PREVIEW (read-only). The internal rows and their sort order, so 901 is visibly free. Expect no row with sortOrder 901.
SELECT id AS literatureId, title, visibility, sortOrder FROM cabinet_dealz.affiliate_literature WHERE visibility = 'internal' ORDER BY sortOrder, id;

-- 3. INSERT (run only after statement 1 returns zero rows). Internal and unpublished, so it cannot reach an affiliate.
INSERT INTO cabinet_dealz.affiliate_literature (title, description, category, filename, fileKey, url, mimeType, sizeBytes, isPublished, visibility, sortOrder) SELECT 'How to Create an App for an Affiliate', 'Internal ops guide for Tom. One shared Cabinetdealz codebase for every affiliate, with a separate Google Play listing and a separate Apple App Store listing per affiliate brand (own name, icon, screenshots). The app resolves the affiliate at login from the signed-in account and that affiliate custom domain, not from which store listing was installed. Internal only: never shown on the public site or in an affiliate portal until Tom adds it to the affiliate library.', 'Internal', 'how-to-create-an-app-for-an-affiliate.md', 'library-documents/internal/how-to-create-an-app-for-an-affiliate.md', '/manus-storage/library-documents/internal/how-to-create-an-app-for-an-affiliate.md', 'text/plain', 8025, 0, 'internal', 901 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_literature WHERE fileKey = 'library-documents/internal/how-to-create-an-app-for-an-affiliate.md');

-- 4. VERIFY (read-only). Expect exactly one row, internal and unpublished, at the fileKey the importer uploaded.
SELECT id AS literatureId, title, visibility, isPublished, category, filename, fileKey, mimeType, sizeBytes, sortOrder FROM cabinet_dealz.affiliate_literature WHERE fileKey = 'library-documents/internal/how-to-create-an-app-for-an-affiliate.md' ORDER BY id;

-- 5. VERIFY (read-only). Exactly what an affiliate portal can see. This must not list the guide.
SELECT id AS literatureId, title, visibility FROM cabinet_dealz.affiliate_literature WHERE visibility = 'affiliate' AND isPublished = 1 ORDER BY sortOrder, id;
