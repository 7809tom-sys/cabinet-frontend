-- TiDB SQL editor version. Numbered 0274. Run after 0273.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
-- This file was NOT executed against production.
--
-- Door-style catalog preview (doorStyles.styleSkuPreview) and Auto Design
-- (design.placeableCabinets) both read cabinet_dealz.cabinets.description.
-- There is one description per master code, shared by every door style that
-- sells that code. These updates change that shared wording.
--
-- Source of the new text: Faircrest Cabinets Product Specification Guide,
-- November 2026 Edition, DESCRIPTION column, copied exactly. The `from`
-- text is the wording in the repo cabinet snapshot (autoDesignRealCatalog
-- style 330011). An UPDATE matches only when the live description is still
-- that exact sentence, so a row someone already rewrote is left alone.
-- No code is inserted or deleted. Width, height, and depth are not changed:
-- W2142 is already 21 x 42 x 12, W3024 is already 30 x 24 x 12, and
-- W362424 is already 36 x 24 x 24 in the snapshot. W362424 is not in the
-- extracted guide pages. WEP1542's guide columns are W 3, H 42, D 15, and
-- the AltaEuro snapshot of the same code is 15.25 x 41.75 x 0.75, so the
-- dimension is not changed here.

SELECT described_cabinet.masterCode, described_cabinet.description, described_cabinet.width, described_cabinet.height, described_cabinet.depth, described_cabinet.numberOfDoors FROM cabinet_dealz.cabinets AS described_cabinet WHERE described_cabinet.masterCode IN ('WBC2730', 'WBC2736', 'WBC2742', 'W2412PG', 'W2712PG', 'W3012PG', 'W3312PG', 'W3612PG', 'MW3030', 'MW3036', 'MW3042', 'AG2418', 'WEP1542', 'LCM8') ORDER BY described_cabinet.masterCode;
UPDATE cabinet_dealz.cabinets SET description = '27" x 30" Blind Corner Wall Cabinet' WHERE masterCode = 'WBC2730' AND description = '27" × 30" × 12" Wall Blind Corner Cabinet — 1 Door, 2 Shelves';
UPDATE cabinet_dealz.cabinets SET description = '27" x 36" Blind Corner Wall Cabinet' WHERE masterCode = 'WBC2736' AND description = '27" × 36" × 12" Wall Blind Corner Cabinet — 1 Door, 2 Shelves';
UPDATE cabinet_dealz.cabinets SET description = '27" x 42" Blind Corner Wall Cabinet' WHERE masterCode = 'WBC2742' AND description = '27" × 42" × 12" Wall Blind Corner Cabinet — 1 Door, 3 Shelves';
UPDATE cabinet_dealz.cabinets SET description = '24" x 12" Wall Cabinet w/Plain Glass Doors' WHERE masterCode = 'W2412PG' AND description = '24" W x 12" H x 12" D Wall Stacker Cabinet — Plain Glass (PG) Door(s), glass included; door count TBD';
UPDATE cabinet_dealz.cabinets SET description = '27" x 12" Wall Cabinet w/Plain Glass Doors' WHERE masterCode = 'W2712PG' AND description = '27" W x 12" H x 12" D Wall Stacker Cabinet — 2 Plain Glass (PG) Doors, glass included';
UPDATE cabinet_dealz.cabinets SET description = '30" x 12" Wall Cabinet w/Plain Glass Doors' WHERE masterCode = 'W3012PG' AND description = '30" W x 12" H x 12" D Wall Stacker Cabinet — 2 Plain Glass (PG) Doors, glass included';
UPDATE cabinet_dealz.cabinets SET description = '33" x 12" Wall Cabinet w/Plain Glass Doors' WHERE masterCode = 'W3312PG' AND description = '33" W x 12" H x 12" D Wall Stacker Cabinet — 2 Plain Glass (PG) Doors, glass included';
UPDATE cabinet_dealz.cabinets SET description = '36" x 12" Wall Cabinet w/Plain Glass Doors' WHERE masterCode = 'W3612PG' AND description = '36" W x 12" H x 12" D Wall Stacker Cabinet — 2 Plain Glass (PG) Doors, glass included';
UPDATE cabinet_dealz.cabinets SET description = '30" x 30" Microwave Cabinet' WHERE masterCode = 'MW3030' AND description = '30" Microwave Wall Cabinet';
UPDATE cabinet_dealz.cabinets SET description = '30" x 36" Microwave Cabinet' WHERE masterCode = 'MW3036' AND description = '30" Microwave Wall Cabinet';
UPDATE cabinet_dealz.cabinets SET description = '30" x 42" Microwave Cabinet' WHERE masterCode = 'MW3042' AND description = '30" Microwave Wall Cabinet';
UPDATE cabinet_dealz.cabinets SET description = 'Appliance Garage' WHERE masterCode = 'AG2418' AND description = '24" x 18" Single Door Appliance Garage Cabinet';
UPDATE cabinet_dealz.cabinets SET description = '15" x 42" Wall End Panels' WHERE masterCode = 'WEP1542' AND description = 'Wall End Panel — 15" W x 42" H; thickness TBD';
UPDATE cabinet_dealz.cabinets SET description = '8" Crown Moulding' WHERE masterCode = 'LCM8' AND description = 'Crown Molding - 96"';
