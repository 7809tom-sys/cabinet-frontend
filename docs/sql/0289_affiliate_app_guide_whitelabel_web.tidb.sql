-- TiDB SQL editor version. Numbered 0289. Run after 0288.
-- One statement per line, so each line can be pasted on its own in the TiDB
-- editor. Every table is cabinet_dealz.<table>. No table aliases, so a line
-- pastes cleanly into the TiDB Cloud editor.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
--
-- Requires 0268 first: that file registers "How to Create an App for an
-- Affiliate" as an internal library document. 0268 is not edited; this file
-- only brings that row in line with the rewritten guide.
--
-- What changed: the guide now recommends the white-label web storefront with
-- Add to Home Screen under the affiliate's own name and icon, says separate
-- per-affiliate App Store / Google Play apps are not recommended (Apple App
-- Review Guidelines 4.2.6 and 4.3(a)), and keeps one Cabinetdealz store app
-- with a dealer picker as a future option. The guidance to submit store apps
-- under Cabinetdealz accounts is removed.
--
-- The markdown ships in the frontend repo at
-- docs/library/internal/how-to-create-an-app-for-an-affiliate.md (6714 bytes,
-- SHA-256 a1508ffa79195ed9258eb7f792de61e66369a761f3acc267c6d51793881111bf).
-- The row stores metadata only; the bytes live in the private bucket at the
-- same fileKey.
--
-- Run order: upload the file FIRST with the backend importer
-- (pnpm exec tsx server/scripts/import-internal-library-documents.ts, with
-- FRONTEND_REPO_ROOT pointing at a frontend checkout of this change), so the
-- bucket holds the new 6714 bytes, then paste statements 1-3 here. The
-- reverse order leaves a row whose sizeBytes does not match the stored file.
--
-- Statement 2 changes description and sizeBytes only. It never changes title,
-- fileKey, visibility or isPublished, so the guide stays internal and
-- unpublished. Safe to re-run: a second run writes the same values.
--
-- Rollback: re-upload the previous file, then set description and sizeBytes
-- back to the values in 0268 statement 3 (sizeBytes 8025).

-- 1. PREVIEW (read-only). Expect exactly one row, internal and unpublished, with sizeBytes 8025. No row means 0268 has not run: stop and run 0268 first.
SELECT id AS literatureId, title, visibility, isPublished, fileKey, sizeBytes, description FROM cabinet_dealz.affiliate_literature WHERE fileKey = 'library-documents/internal/how-to-create-an-app-for-an-affiliate.md' ORDER BY id;

-- 2. UPDATE (run only after statement 1 returns one row and the new file is uploaded). Description and size only.
UPDATE cabinet_dealz.affiliate_literature SET description = 'Internal ops guide for Tom. Affiliates get their white-label web storefront, which a customer installs with Add to Home Screen under the affiliate''s own name and icon from a per-store web manifest. Separate App Store or Google Play apps per affiliate are not recommended (Apple guidelines 4.2.6 and 4.3(a)); one Cabinetdealz store app with a dealer picker is a future option only. Internal only: never shown on the public site or in an affiliate portal until Tom adds it to the affiliate library.', sizeBytes = 6714 WHERE fileKey = 'library-documents/internal/how-to-create-an-app-for-an-affiliate.md';

-- 3. VERIFY (read-only). Expect one row with sizeBytes 6714, still visibility internal and isPublished 0.
SELECT id AS literatureId, title, visibility, isPublished, fileKey, sizeBytes, description FROM cabinet_dealz.affiliate_literature WHERE fileKey = 'library-documents/internal/how-to-create-an-app-for-an-affiliate.md' ORDER BY id;
