-- TiDB SQL editor version. Numbered 0248. Run after 0247.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
--
-- Why: affiliate storefronts gain a "Google reviews" tab. The affiliate pastes a
-- Google Place ID; the public storefront uses it for the Maps Embed iframe and
-- for the "see all reviews" / "write a review" links. Nothing else is stored:
-- review text, ratings, and author names are read from Google at request time
-- and are never cached in this column (Google's Maps Platform terms do not allow
-- storing Places content, and the place ID is the one documented exception).
--
-- This file only adds a column. It inserts nothing, updates no rows, and deletes
-- nothing. Review text is never written here.

-- 1. Read-only: confirm the column is still absent. Safe to run twice.
SELECT
  existing.column_name AS presentColumn,
  existing.data_type AS columnType,
  existing.is_nullable AS nullable
FROM information_schema.columns AS existing
WHERE existing.table_schema = 'cabinet_dealz'
  AND existing.table_name = 'affiliates'
  AND existing.column_name IN ('googlePlaceId', 'googleReviewFetchedAt')
ORDER BY existing.column_name;

-- 2. The place ID. Nullable: null means the affiliate has not connected Google,
--    and the storefront renders no reviews tab at all.
--    255 characters is enough for the longest IDs Google documents (they have no
--    documented maximum, but a real business place ID is ~27–200 chars; anything
--    longer is rejected by the parser before it reaches this column).
ALTER TABLE cabinet_dealz.affiliates
  ADD COLUMN IF NOT EXISTS googlePlaceId VARCHAR(255) NULL
  AFTER embedEnabled;

-- 3. When the stored place ID was last refreshed. Google recommends refreshing a
--    stored place ID at least every 12 months (a place ID can go stale when a
--    business moves or closes). Null means "never refreshed". This is a date for
--    the place ID only — it is NOT a cache of review content.
ALTER TABLE cabinet_dealz.affiliates
  ADD COLUMN IF NOT EXISTS googlePlaceIdRefreshedAt TIMESTAMP NULL
  AFTER googlePlaceId;

-- 4. Read-only check: confirm both columns now exist.
SELECT
  added.column_name AS addedColumn,
  added.data_type AS columnType,
  added.is_nullable AS nullable
FROM information_schema.columns AS added
WHERE added.table_schema = 'cabinet_dealz'
  AND added.table_name = 'affiliates'
  AND added.column_name IN ('googlePlaceId', 'googlePlaceIdRefreshedAt')
ORDER BY added.column_name;

-- 5. Optional read-only spot check: which affiliates have connected Google.
--    Expect zero rows immediately after this file runs, because nothing is
--    backfilled and no affiliate has set a place yet.
SELECT
  checked_affiliate.id AS affiliateId,
  checked_affiliate.slug,
  checked_affiliate.googlePlaceId,
  checked_affiliate.googlePlaceIdRefreshedAt
FROM cabinet_dealz.affiliates AS checked_affiliate
WHERE checked_affiliate.googlePlaceId IS NOT NULL
ORDER BY checked_affiliate.id
LIMIT 50;

-- Note on backfill: none. An affiliate with no place ID keeps rendering the
-- storefront exactly as it does today, with no reviews tab and no empty block.
