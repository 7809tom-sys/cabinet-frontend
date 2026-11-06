-- Pelican bathroom vanity sink + vanity faucet tags.
-- Numbered 0250. Run AFTER 0249 (the read-only preview) and 0248.
-- Paste each numbered block on its own in the TiDB SQL editor. One statement per
-- line. Do not paste this file into an automatic migration.
-- Every table is cabinet_dealz.<table>. No reserved words are used as aliases.
-- Safe to re-run: every UPDATE is an idempotent SET on an exact pelicanCode.
--
-- WHY: pelican_products stores only category + subCategory, and those two values
-- are shared by kitchen and bathroom fixtures. This adds one nullable tag column
-- so the Bathroom Designer can read a source-verified bathroom identity instead of
-- matching a product name. NULL on every other Pelican row, so nothing else moves.
--
-- WHERE THE VALUES COME FROM: Pelican's published specification sheets at
-- buildpelican.com. The mount type, bowl count and pre-drilled hole count below are
-- the sheet's stated facts. A model with no sheet is absent rather than guessed;
-- docs/pelican-vanity-fixtures.md lists the evidence and what still needs Tom.
--
-- Tags written:
--   bathroom-vanity-sink / bathroom-vanity-faucet   what the row is
--   mount-undermount mount-drop-in mount-vessel mount-integrated   how a basin installs
--   bowl-single / bowl-double   source bowl count
--   faucet-holes-1 / faucet-holes-3   source pre-drilled faucet holes
--   faucet-spread-4 / faucet-spread-8   source hole spacing, three-hole only
--   faucet-for-vessel-sink   the sheet says "Works with Vessel Style Sinks"
--
-- Counts: 59 vanity sink rows (33 undermount, 4 drop-in, 8 vessel,
-- 14 integrated top, 0 double bowl) and 29 vanity faucet rows
-- (19 single hole, 10 three hole: 6 at 4" centerset and 4 at 8" widespread;
-- 3 vessel-height).

-- 1 — one nullable tag column. Defaults to NULL, so every other row is unchanged.
ALTER TABLE cabinet_dealz.pelican_products ADD COLUMN bathroomFixtureTags VARCHAR(191) NULL;

-- 2
COMMIT;

-- 3 — vanity basins and integrated vanity tops: 59 exact SKUs.
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-1606 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-1634 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-1637 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-1646 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-1647 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3033 Bone';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3033 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3044 Bone';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3044 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3059 Bone';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3059 Gloss Black';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3059 Individually Packed';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3059 Matte Black';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3059 Matte Grey';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3059 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3064 Bone';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3064 Individually Packed';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3064 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3072 Bone';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3072 Individually Packed';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3072 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3088 Bone';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3088 Individually Packed';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3088 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3099 Bone';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3099 Gloss Black';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3099 Individually Packed';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3099 Matte Black';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3099 Matte Grey';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3099 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3608';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3611 White';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-undermount,bowl-single' WHERE pelicanCode = 'PL-3639';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-vessel,bowl-single' WHERE pelicanCode = 'PL-3001';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-vessel,bowl-single' WHERE pelicanCode = 'PL-3002';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-vessel,bowl-single' WHERE pelicanCode = 'PL-3014';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-vessel,bowl-single' WHERE pelicanCode = 'PL-3053';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-vessel,bowl-single' WHERE pelicanCode = 'PL-3060';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-vessel,bowl-single' WHERE pelicanCode = 'PL-3079';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-vessel,bowl-single' WHERE pelicanCode = 'PL-3081';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-vessel,bowl-single' WHERE pelicanCode = 'PL-3082';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-drop-in,bowl-single' WHERE pelicanCode = 'PL-3086';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-drop-in,bowl-single,faucet-holes-1' WHERE pelicanCode = 'PL-5053-1';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-drop-in,bowl-single,faucet-holes-3,faucet-spread-4' WHERE pelicanCode = 'PL-1011 Spread 4"';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-drop-in,bowl-single,faucet-holes-3,faucet-spread-8' WHERE pelicanCode = 'PL-1011 Spread 8"';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-1' WHERE pelicanCode = 'PL-R1917W';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-1' WHERE pelicanCode = 'PL-R2519W';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-1' WHERE pelicanCode = 'PL-R2522W';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3' WHERE pelicanCode = 'PL-R3119W';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3' WHERE pelicanCode = 'PL-R3122W';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3' WHERE pelicanCode = 'PL-R3722W';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3' WHERE pelicanCode = 'PL-R4322W';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3' WHERE pelicanCode = 'PL-R4922W';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-1' WHERE pelicanCode = 'PL-O2519WBS';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-1' WHERE pelicanCode = 'PL-O2522WBS';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3' WHERE pelicanCode = 'PL-O3122WBS';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3' WHERE pelicanCode = 'PL-O3719WBS';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3' WHERE pelicanCode = 'PL-O3722WBS';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3' WHERE pelicanCode = 'PL-O4922WBS';

-- 4
COMMIT;

-- 5 — vanity faucets: 29 exact SKUs.
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-4' WHERE pelicanCode = 'PL-8104 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-4' WHERE pelicanCode = 'PL-8104 CHR';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8107 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8107 CHR';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8107 MB';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1,faucet-for-vessel-sink' WHERE pelicanCode = 'PL-8112 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1,faucet-for-vessel-sink' WHERE pelicanCode = 'PL-8112 CHR';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8113 BG';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8113 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8113 CHR';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8113 MB';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8116 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8116 CHR';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8116 MB';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1,faucet-for-vessel-sink' WHERE pelicanCode = 'PL-8136 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8142 BG';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8142 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8142 CHR';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8142 MB';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8162 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-1' WHERE pelicanCode = 'PL-8162 CHR';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-8' WHERE pelicanCode = 'PL-8312 BG';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-8' WHERE pelicanCode = 'PL-8312 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-8' WHERE pelicanCode = 'PL-8312 CHR';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-8' WHERE pelicanCode = 'PL-8312 MB';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-4' WHERE pelicanCode = 'PL-8330 BG';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-4' WHERE pelicanCode = 'PL-8330 BN';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-4' WHERE pelicanCode = 'PL-8330 CHR';
UPDATE cabinet_dealz.pelican_products SET bathroomFixtureTags = 'bathroom-vanity-faucet,faucet-holes-3,faucet-spread-4' WHERE pelicanCode = 'PL-8330 MB';

-- 6
COMMIT;

-- 7 — read-only: what was applied.
SELECT bathroomFixtureTags, COUNT(*) AS skuCount FROM cabinet_dealz.pelican_products WHERE bathroomFixtureTags IS NOT NULL GROUP BY bathroomFixtureTags ORDER BY skuCount DESC;

-- 8 — read-only guard: must return 0. A non-zero count means one of these exact
-- pelicanCode values is not in the table, or was not tagged, so its UPDATE matched nothing.
SELECT COUNT(*) AS vanitySinkSkusNotUpdated FROM (SELECT 'PL-1606 White' AS pelicanCode UNION ALL SELECT 'PL-1634 White' AS pelicanCode UNION ALL SELECT 'PL-1637 White' AS pelicanCode UNION ALL SELECT 'PL-1646 White' AS pelicanCode UNION ALL SELECT 'PL-1647 White' AS pelicanCode UNION ALL SELECT 'PL-3033 Bone' AS pelicanCode UNION ALL SELECT 'PL-3033 White' AS pelicanCode UNION ALL SELECT 'PL-3044 Bone' AS pelicanCode UNION ALL SELECT 'PL-3044 White' AS pelicanCode UNION ALL SELECT 'PL-3059 Bone' AS pelicanCode UNION ALL SELECT 'PL-3059 Gloss Black' AS pelicanCode UNION ALL SELECT 'PL-3059 Individually Packed' AS pelicanCode UNION ALL SELECT 'PL-3059 Matte Black' AS pelicanCode UNION ALL SELECT 'PL-3059 Matte Grey' AS pelicanCode UNION ALL SELECT 'PL-3059 White' AS pelicanCode UNION ALL SELECT 'PL-3064 Bone' AS pelicanCode UNION ALL SELECT 'PL-3064 Individually Packed' AS pelicanCode UNION ALL SELECT 'PL-3064 White' AS pelicanCode UNION ALL SELECT 'PL-3072 Bone' AS pelicanCode UNION ALL SELECT 'PL-3072 Individually Packed' AS pelicanCode UNION ALL SELECT 'PL-3072 White' AS pelicanCode UNION ALL SELECT 'PL-3088 Bone' AS pelicanCode UNION ALL SELECT 'PL-3088 Individually Packed' AS pelicanCode UNION ALL SELECT 'PL-3088 White' AS pelicanCode UNION ALL SELECT 'PL-3099 Bone' AS pelicanCode UNION ALL SELECT 'PL-3099 Gloss Black' AS pelicanCode UNION ALL SELECT 'PL-3099 Individually Packed' AS pelicanCode UNION ALL SELECT 'PL-3099 Matte Black' AS pelicanCode UNION ALL SELECT 'PL-3099 Matte Grey' AS pelicanCode UNION ALL SELECT 'PL-3099 White' AS pelicanCode UNION ALL SELECT 'PL-3608' AS pelicanCode UNION ALL SELECT 'PL-3611 White' AS pelicanCode UNION ALL SELECT 'PL-3639' AS pelicanCode UNION ALL SELECT 'PL-3001' AS pelicanCode UNION ALL SELECT 'PL-3002' AS pelicanCode UNION ALL SELECT 'PL-3014' AS pelicanCode UNION ALL SELECT 'PL-3053' AS pelicanCode UNION ALL SELECT 'PL-3060' AS pelicanCode UNION ALL SELECT 'PL-3079' AS pelicanCode UNION ALL SELECT 'PL-3081' AS pelicanCode UNION ALL SELECT 'PL-3082' AS pelicanCode UNION ALL SELECT 'PL-3086' AS pelicanCode UNION ALL SELECT 'PL-5053-1' AS pelicanCode UNION ALL SELECT 'PL-1011 Spread 4"' AS pelicanCode UNION ALL SELECT 'PL-1011 Spread 8"' AS pelicanCode UNION ALL SELECT 'PL-R1917W' AS pelicanCode UNION ALL SELECT 'PL-R2519W' AS pelicanCode UNION ALL SELECT 'PL-R2522W' AS pelicanCode UNION ALL SELECT 'PL-R3119W' AS pelicanCode UNION ALL SELECT 'PL-R3122W' AS pelicanCode UNION ALL SELECT 'PL-R3722W' AS pelicanCode UNION ALL SELECT 'PL-R4322W' AS pelicanCode UNION ALL SELECT 'PL-R4922W' AS pelicanCode UNION ALL SELECT 'PL-O2519WBS' AS pelicanCode UNION ALL SELECT 'PL-O2522WBS' AS pelicanCode UNION ALL SELECT 'PL-O3122WBS' AS pelicanCode UNION ALL SELECT 'PL-O3719WBS' AS pelicanCode UNION ALL SELECT 'PL-O3722WBS' AS pelicanCode UNION ALL SELECT 'PL-O4922WBS' AS pelicanCode) AS wanted WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pelican_products AS tagged_product WHERE tagged_product.pelicanCode = wanted.pelicanCode AND tagged_product.bathroomFixtureTags LIKE '%bathroom-vanity-sink%');

-- 9 — read-only guard: must return 0. A non-zero count means one of these exact
-- pelicanCode values is not in the table, or was not tagged, so its UPDATE matched nothing.
SELECT COUNT(*) AS vanityFaucetSkusNotUpdated FROM (SELECT 'PL-8104 BN' AS pelicanCode UNION ALL SELECT 'PL-8104 CHR' AS pelicanCode UNION ALL SELECT 'PL-8107 BN' AS pelicanCode UNION ALL SELECT 'PL-8107 CHR' AS pelicanCode UNION ALL SELECT 'PL-8107 MB' AS pelicanCode UNION ALL SELECT 'PL-8112 BN' AS pelicanCode UNION ALL SELECT 'PL-8112 CHR' AS pelicanCode UNION ALL SELECT 'PL-8113 BG' AS pelicanCode UNION ALL SELECT 'PL-8113 BN' AS pelicanCode UNION ALL SELECT 'PL-8113 CHR' AS pelicanCode UNION ALL SELECT 'PL-8113 MB' AS pelicanCode UNION ALL SELECT 'PL-8116 BN' AS pelicanCode UNION ALL SELECT 'PL-8116 CHR' AS pelicanCode UNION ALL SELECT 'PL-8116 MB' AS pelicanCode UNION ALL SELECT 'PL-8136 BN' AS pelicanCode UNION ALL SELECT 'PL-8142 BG' AS pelicanCode UNION ALL SELECT 'PL-8142 BN' AS pelicanCode UNION ALL SELECT 'PL-8142 CHR' AS pelicanCode UNION ALL SELECT 'PL-8142 MB' AS pelicanCode UNION ALL SELECT 'PL-8162 BN' AS pelicanCode UNION ALL SELECT 'PL-8162 CHR' AS pelicanCode UNION ALL SELECT 'PL-8312 BG' AS pelicanCode UNION ALL SELECT 'PL-8312 BN' AS pelicanCode UNION ALL SELECT 'PL-8312 CHR' AS pelicanCode UNION ALL SELECT 'PL-8312 MB' AS pelicanCode UNION ALL SELECT 'PL-8330 BG' AS pelicanCode UNION ALL SELECT 'PL-8330 BN' AS pelicanCode UNION ALL SELECT 'PL-8330 CHR' AS pelicanCode UNION ALL SELECT 'PL-8330 MB' AS pelicanCode) AS wanted WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.pelican_products AS tagged_product WHERE tagged_product.pelicanCode = wanted.pelicanCode AND tagged_product.bathroomFixtureTags LIKE '%bathroom-vanity-faucet%');

-- 10 — read-only guard: must return 59 + 29 = 88. Nothing else may be tagged.
SELECT COUNT(*) AS totalTaggedRows FROM cabinet_dealz.pelican_products WHERE bathroomFixtureTags IS NOT NULL;
