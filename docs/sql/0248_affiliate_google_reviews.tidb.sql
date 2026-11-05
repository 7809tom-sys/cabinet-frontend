-- TiDB SQL editor version. Numbered 0248. Run after 0247.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
--
-- Why: affiliate storefronts gain a "Google reviews" tab, and each affiliate
-- connects it with THEIR OWN Google account: their Place ID, their own Places
-- API key, and optionally their own Maps Embed key.
--
-- What is stored here, and why it is safe to store:
--   - googlePlaceId: the one Places value Google's terms let us keep indefinitely.
--   - googlePlacesApiKeyEnc / googleMapsEmbedApiKeyEnc: the affiliate's own keys,
--     CIPHERTEXT ONLY. The application encrypts before insert and decrypts only
--     on the server at request time. Never plaintext, never a hash (a hash cannot
--     be used to call Google), never logged, never returned to a browser.
--   - The *UpdatedAt columns: when a key was last written, so the portal can say
--     "Key saved" without reading anything.
--
-- Review text, ratings, author names, and photos are NEVER stored in any column:
-- Google's Maps Platform terms do not allow storing or caching Places content.
--
-- This file only adds columns. It inserts nothing, updates no rows, and deletes
-- nothing.

-- 1. Read-only: confirm the columns are still absent. Safe to run twice.
SELECT
  existing.column_name AS presentColumn,
  existing.data_type AS columnType,
  existing.is_nullable AS nullable
FROM information_schema.columns AS existing
WHERE existing.table_schema = 'cabinet_dealz'
  AND existing.table_name = 'affiliates'
  AND existing.column_name IN (
    'googlePlaceId',
    'googlePlaceIdRefreshedAt',
    'googlePlacesApiKeyEnc',
    'googlePlacesApiKeyUpdatedAt',
    'googleMapsEmbedApiKeyEnc',
    'googleMapsEmbedApiKeyUpdatedAt'
  )
ORDER BY existing.column_name;

-- 2. The affiliate's Place ID. Nullable: null means Google is not connected and
--    the storefront renders no reviews tab at all.
ALTER TABLE cabinet_dealz.affiliates
  ADD COLUMN IF NOT EXISTS googlePlaceId VARCHAR(255) NULL
  AFTER embedEnabled;

-- 3. When the stored place ID was last refreshed. Google recommends refreshing a
--    stored place ID at least every 12 months. This is a date for the place ID
--    only; it is not a cache of review content.
ALTER TABLE cabinet_dealz.affiliates
  ADD COLUMN IF NOT EXISTS googlePlaceIdRefreshedAt TIMESTAMP NULL
  AFTER googlePlaceId;

-- 4. The affiliate's own Places API (New) key, ENCRYPTED by the application
--    before insert. TEXT is required: an encrypted envelope (nonce + tag +
--    ciphertext, base64) is longer than the 39-character key itself.
--    Nullable: null means "no key of their own", and the server falls back to
--    the platform key from the API server environment.
ALTER TABLE cabinet_dealz.affiliates
  ADD COLUMN IF NOT EXISTS googlePlacesApiKeyEnc TEXT NULL
  AFTER googlePlaceIdRefreshedAt;

-- 5. When that key was last written. Used for the portal's "Key saved" date.
--    Clearing the key sets both the ciphertext and this date to null.
ALTER TABLE cabinet_dealz.affiliates
  ADD COLUMN IF NOT EXISTS googlePlacesApiKeyUpdatedAt TIMESTAMP NULL
  AFTER googlePlacesApiKeyEnc;

-- 6. The affiliate's own Maps Embed API key, also ENCRYPTED. Optional: when it is
--    absent the server falls back to the Places key for the iframe, and if that
--    key is not referrer-restricted the section renders the link card instead.
ALTER TABLE cabinet_dealz.affiliates
  ADD COLUMN IF NOT EXISTS googleMapsEmbedApiKeyEnc TEXT NULL
  AFTER googlePlacesApiKeyUpdatedAt;

-- 7. When that key was last written.
ALTER TABLE cabinet_dealz.affiliates
  ADD COLUMN IF NOT EXISTS googleMapsEmbedApiKeyUpdatedAt TIMESTAMP NULL
  AFTER googleMapsEmbedApiKeyEnc;

-- 8. Read-only check: confirm all six columns now exist.
SELECT
  added.column_name AS addedColumn,
  added.data_type AS columnType,
  added.is_nullable AS nullable
FROM information_schema.columns AS added
WHERE added.table_schema = 'cabinet_dealz'
  AND added.table_name = 'affiliates'
  AND added.column_name IN (
    'googlePlaceId',
    'googlePlaceIdRefreshedAt',
    'googlePlacesApiKeyEnc',
    'googlePlacesApiKeyUpdatedAt',
    'googleMapsEmbedApiKeyEnc',
    'googleMapsEmbedApiKeyUpdatedAt'
  )
ORDER BY added.column_name;

-- 9. Read-only spot check: which affiliates have connected their own Google
--    account. Deliberately does NOT select the ciphertext, and must never be
--    changed to: nothing reads a key value out of this table except the server's
--    decrypt path.
SELECT
  checked_affiliate.id AS affiliateId,
  checked_affiliate.slug,
  checked_affiliate.googlePlaceId,
  (checked_affiliate.googlePlacesApiKeyEnc IS NOT NULL) AS hasPlacesKey,
  (checked_affiliate.googleMapsEmbedApiKeyEnc IS NOT NULL) AS hasEmbedKey,
  checked_affiliate.googlePlacesApiKeyUpdatedAt,
  checked_affiliate.googleMapsEmbedApiKeyUpdatedAt
FROM cabinet_dealz.affiliates AS checked_affiliate
WHERE checked_affiliate.googlePlaceId IS NOT NULL
   OR checked_affiliate.googlePlacesApiKeyEnc IS NOT NULL
   OR checked_affiliate.googleMapsEmbedApiKeyEnc IS NOT NULL
ORDER BY checked_affiliate.id
LIMIT 50;

-- Note on backfill: none. An affiliate with no place ID and no keys keeps
-- rendering the storefront exactly as it does today, with no reviews tab.
