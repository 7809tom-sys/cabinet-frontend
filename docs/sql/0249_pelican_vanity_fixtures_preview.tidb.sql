-- READ-ONLY PREVIEW. Numbered 0249. Nothing in this file changes data.
-- Run this first and read the result. It is the candidate list behind
-- docs/sql/0250_pelican_vanity_fixtures_tag.tidb.sql.
-- Every table is cabinet_dealz.<table>. No reserved words are used as aliases.
--
-- WHY THIS IS NEEDED: pelican_products stores only category + subCategory.
-- "Sinks & Faucets" / "Sinks" holds every kitchen sink AND every bathroom basin;
-- "Sinks & Faucets" / "Faucets" holds every kitchen faucet AND every vanity
-- faucet. The Bathroom Designer therefore had no way to tell them apart and
-- offered one bathroom faucet.
--
-- Block 1 lists every Pelican row whose own name or description says it is a
-- bathroom / vanity / vessel / pedestal / lavatory item. That is the pattern
-- search, and it is only a starting point: a pattern hit is not proof.
-- Block 2 lists the exact SKUs the tagging file updates, so you can confirm each
-- one is the product you expect before it is tagged.

-- 1 — read-only: every Pelican row that self-identifies as a bathroom fixture.
SELECT
  pelicanCode,
  name,
  category,
  subCategory,
  size,
  listPrice,
  isActive,
  showInCatalog,
  showInDesigner,
  bathroomFixtureTags AS currentTags,
  description
FROM cabinet_dealz.pelican_products
WHERE description REGEXP '([Bb]athroom|[Vv]anity|[Vv]essel|[Pp]edestal|[Ll]avatory)'
   OR name REGEXP '([Bb]athroom|[Vv]anity|[Vv]essel|[Pp]edestal|[Ll]avatory)'
ORDER BY category, subCategory, pelicanCode;

-- 2 — read-only: the 59 vanity sinks and 29 vanity faucets this work tags.
-- Compare these against the specification sheets listed in
-- docs/pelican-vanity-fixtures.md before running 0250.
SELECT
  pelicanCode,
  name,
  category,
  subCategory,
  listPrice,
  isActive,
  showInDesigner
FROM cabinet_dealz.pelican_products
WHERE pelicanCode IN (
  'PL-1606 White', 'PL-1634 White', 'PL-1637 White', 'PL-1646 White', 'PL-1647 White', 'PL-3033 Bone', 'PL-3033 White', 'PL-3044 Bone', 'PL-3044 White', 'PL-3059 Bone', 'PL-3059 Gloss Black', 'PL-3059 Individually Packed', 'PL-3059 Matte Black', 'PL-3059 Matte Grey', 'PL-3059 White', 'PL-3064 Bone', 'PL-3064 Individually Packed', 'PL-3064 White', 'PL-3072 Bone', 'PL-3072 Individually Packed', 'PL-3072 White', 'PL-3088 Bone', 'PL-3088 Individually Packed', 'PL-3088 White', 'PL-3099 Bone', 'PL-3099 Gloss Black', 'PL-3099 Individually Packed', 'PL-3099 Matte Black', 'PL-3099 Matte Grey', 'PL-3099 White', 'PL-3608', 'PL-3611 White', 'PL-3639', 'PL-3001', 'PL-3002', 'PL-3014', 'PL-3053', 'PL-3060', 'PL-3079', 'PL-3081', 'PL-3082', 'PL-3086', 'PL-5053-1', 'PL-1011 Spread 4"', 'PL-1011 Spread 8"', 'PL-R1917W', 'PL-R2519W', 'PL-R2522W', 'PL-R3119W', 'PL-R3122W', 'PL-R3722W', 'PL-R4322W', 'PL-R4922W', 'PL-O2519WBS', 'PL-O2522WBS', 'PL-O3122WBS', 'PL-O3719WBS', 'PL-O3722WBS', 'PL-O4922WBS',
  'PL-8104 BN', 'PL-8104 CHR', 'PL-8107 BN', 'PL-8107 CHR', 'PL-8107 MB', 'PL-8112 BN', 'PL-8112 CHR', 'PL-8113 BG', 'PL-8113 BN', 'PL-8113 CHR', 'PL-8113 MB', 'PL-8116 BN', 'PL-8116 CHR', 'PL-8116 MB', 'PL-8136 BN', 'PL-8142 BG', 'PL-8142 BN', 'PL-8142 CHR', 'PL-8142 MB', 'PL-8162 BN', 'PL-8162 CHR', 'PL-8312 BG', 'PL-8312 BN', 'PL-8312 CHR', 'PL-8312 MB', 'PL-8330 BG', 'PL-8330 BN', 'PL-8330 CHR', 'PL-8330 MB'
)
ORDER BY CASE WHEN category = 'Sinks & Faucets' THEN 0 ELSE 1 END, pelicanCode;

-- 3 — read-only: rows a pattern search suggests but this work deliberately does NOT tag.
-- Pelican sells these as bathroom-category items, but their specification sheets
-- put them on the tub floor or in a shower, not on a vanity deck.
SELECT
  pelicanCode,
  name,
  category,
  subCategory,
  listPrice
FROM cabinet_dealz.pelican_products
WHERE pelicanCode IN (
  'PL-8515 BN', 'PL-8515 CHR', 'PL-8515 MB',
  'PL-8522 BG', 'PL-8522 CHR', 'PL-8522 MB',
  'PL-8538 BG', 'PL-8538 BN', 'PL-8538 MB',
  'PL-86H55S BN', 'PL-86H55S CHR', 'PL-86H55S MB', 'PL-86H15S BN', 'PL-86A33S BN', 'PL-86A23S BN', 'PL-86S22S BN',
  'PL-8114 BN', 'PL-8114 CHR', 'PL-8164 BN', 'PL-8303 BN', 'PL-8303 CHR',
  'Deck Plate Bathroom BG', 'Deck Plate Bathroom BN', 'Deck Plate Bathroom CHR', 'Deck Plate Bathroom MB',
  'PL-609', 'PL-618', 'PL-624', 'PL-645', 'PL-661', 'PL-697',
  'PL-7201 Spread 4"'
)
ORDER BY category, pelicanCode;
