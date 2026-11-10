-- TiDB SQL editor version. Numbered 0273. Run after the library visibility columns
-- (0255, or 0269 if that is the file that added them on this database).
-- One statement per line, so each line can be pasted on its own in the TiDB
-- editor. Every table is cabinet_dealz.<table>. No table aliases.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
--
-- Reference material (catalogs, installation cost sheets, price lists, spec
-- books) has been sitting in the same library as affiliate literature. This
-- file adds documentRole and marks the rows the rule can identify. It does not
-- guess ids. A row is reference when ANY of these is true:
--
--   category is 'Product Catalogs' or 'Installation'
--     (the live admin list: SolidTrac Catalog is Product Catalogs; the Kitchen
--     Installation Cost Sheet is Installation. Sales & Marketing and Training
--     are affiliate literature and are not in this list.)
--   OR the title or the filename contains, ignoring case: cost sheet, costsheet,
--     price list, pricelist, spec book, specbook, or catalog.
--
-- The description is not part of the rule. A sales brochure can mention a
-- catalog without being one.
--
-- Reference rows that nobody has ticked in the admin (affiliateToggledAt is
-- null) are set back to internal and unpublished. A row the owner already
-- ticked keeps that publish and its audit. The affiliate read still requires
-- the tick: visibility affiliate AND isPublished 1 AND, for a reference row,
-- affiliateToggledAt set. Nothing here makes a document public.
--
-- Safe to re-run, but not silent about it. Statement 1 is a PLAIN ADD COLUMN
-- because TiDB Cloud rejects "ADD COLUMN IF NOT EXISTS". On a second run it
-- answers "Duplicate column name 'documentRole'". THAT ERROR IS SAFE: the
-- column already exists. Skip that line and paste the next. Statement 4 only
-- updates rows that are not already reference, so a second run changes nothing.
--
-- Run order: statement 1, then statement 2 must show the column, then statement
-- 3 is the preview. Read every row in that preview. If a document you want to
-- keep as ordinary affiliate literature is in it, stop and do not run statement
-- 4. Statement 5 shows what was marked. Statement 6 is what an affiliate can
-- see, and it must not list a reference row that was never ticked.

-- 1. The role column. literature is the default, so a row this file does not mark stays affiliate literature. This must succeed before any line below reads the column.
ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN documentRole VARCHAR(16) NOT NULL DEFAULT 'literature';

-- 2. VERIFY (read-only). Expect one row: documentRole, varchar, not nullable, default literature. Do not continue until you see it.
SELECT column_name AS presentColumn, data_type AS columnType, is_nullable AS nullable, column_default AS defaultValue FROM information_schema.columns WHERE table_schema = 'cabinet_dealz' AND table_name = 'affiliate_literature' AND column_name = 'documentRole' ORDER BY column_name;

-- 3. PREVIEW (read-only). These are the rows statement 4 will mark Reference. Read them before you update. Stop if a row here is affiliate literature you want to keep publishing without treating it as reference.
SELECT id AS literatureId, title, category, filename, visibility, isPublished, affiliateToggledAt, affiliateToggledByName, documentRole FROM cabinet_dealz.affiliate_literature WHERE documentRole <> 'reference' AND (category IN ('Product Catalogs', 'Installation') OR LOWER(title) LIKE '%cost sheet%' OR LOWER(title) LIKE '%costsheet%' OR LOWER(filename) LIKE '%cost sheet%' OR LOWER(filename) LIKE '%costsheet%' OR LOWER(title) LIKE '%price list%' OR LOWER(title) LIKE '%pricelist%' OR LOWER(filename) LIKE '%price list%' OR LOWER(filename) LIKE '%pricelist%' OR LOWER(title) LIKE '%spec book%' OR LOWER(title) LIKE '%specbook%' OR LOWER(filename) LIKE '%spec book%' OR LOWER(filename) LIKE '%specbook%' OR LOWER(title) LIKE '%catalog%' OR LOWER(filename) LIKE '%catalog%') ORDER BY id;

-- 4. UPDATE (run only after statement 3 lists the rows you expect). Marks them reference. A row with no affiliate tick is unpublished. A row already ticked keeps its visibility, isPublished, and the audit columns.
UPDATE cabinet_dealz.affiliate_literature SET documentRole = 'reference', isPublished = IF(affiliateToggledAt IS NULL, 0, isPublished), visibility = IF(affiliateToggledAt IS NULL, 'internal', visibility) WHERE documentRole <> 'reference' AND (category IN ('Product Catalogs', 'Installation') OR LOWER(title) LIKE '%cost sheet%' OR LOWER(title) LIKE '%costsheet%' OR LOWER(filename) LIKE '%cost sheet%' OR LOWER(filename) LIKE '%costsheet%' OR LOWER(title) LIKE '%price list%' OR LOWER(title) LIKE '%pricelist%' OR LOWER(filename) LIKE '%price list%' OR LOWER(filename) LIKE '%pricelist%' OR LOWER(title) LIKE '%spec book%' OR LOWER(title) LIKE '%specbook%' OR LOWER(filename) LIKE '%spec book%' OR LOWER(filename) LIKE '%specbook%' OR LOWER(title) LIKE '%catalog%' OR LOWER(filename) LIKE '%catalog%');

-- 5. VERIFY (read-only). The reference section after the update. A row with affiliateToggledAt null must show visibility internal and isPublished 0.
SELECT id AS literatureId, title, category, filename, documentRole, visibility, isPublished, affiliateToggledAt, affiliateToggledByName FROM cabinet_dealz.affiliate_literature WHERE documentRole = 'reference' ORDER BY id;

-- 6. VERIFY (read-only). Exactly what an affiliate portal can see. A reference row appears here only when it was ticked (affiliateToggledAt is set) and both publish flags agree.
SELECT id AS literatureId, title, documentRole, visibility, isPublished, affiliateToggledAt FROM cabinet_dealz.affiliate_literature WHERE visibility = 'affiliate' AND isPublished = 1 AND (documentRole <> 'reference' OR affiliateToggledAt IS NOT NULL) ORDER BY id;
