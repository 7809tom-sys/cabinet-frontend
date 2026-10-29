-- TiDB SQL editor version. Numbered 0235. Run after 0234.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS, and INSERT IGNORE.
--
-- The three inserted tiers are placeholders for Tom to edit. Their numbers are
-- neutral (×1.00 of cost, or 0% off list) and are not live discounts.
-- No affiliate is assigned a tier by this script.

-- 1
CREATE TABLE IF NOT EXISTS cabinet_dealz.affiliate_pricing_tiers (
  id INT NOT NULL AUTO_INCREMENT,
  tierCode VARCHAR(64) NOT NULL,
  tierName VARCHAR(128) NOT NULL,
  basisKind VARCHAR(32) NOT NULL,
  basisPoints INT NOT NULL,
  volumeThresholdCents INT NULL,
  examplePlaceholder TINYINT(1) NOT NULL DEFAULT 0,
  sortOrder INT NOT NULL DEFAULT 0,
  activeFlag TINYINT(1) NOT NULL DEFAULT 1,
  notesText TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY affiliate_pricing_tiers_code_uq (tierCode)
);

-- 2
ALTER TABLE cabinet_dealz.affiliates
  ADD COLUMN IF NOT EXISTS pricingTierId INT NULL;

-- 3
CREATE INDEX IF NOT EXISTS affiliates_pricing_tier_idx
  ON cabinet_dealz.affiliates (pricingTierId);

-- 4
INSERT IGNORE INTO cabinet_dealz.affiliate_pricing_tiers (
  tierCode,
  tierName,
  basisKind,
  basisPoints,
  volumeThresholdCents,
  examplePlaceholder,
  sortOrder,
  activeFlag,
  notesText
) VALUES
(
  'example-tier-1',
  'Tier 1 (example)',
  'cost_multiplier',
  10000,
  NULL,
  1,
  1,
  1,
  'Placeholder. ×1.00 of Cabinetdealz cost until Tom sets the real multiplier. Not a live discount. Assign it only after editing.'
),
(
  'example-tier-2',
  'Tier 2 (example)',
  'list_discount',
  0,
  NULL,
  1,
  2,
  1,
  'Placeholder. 0% off list until Tom sets the real discount. Not a live discount. Assign it only after editing.'
),
(
  'example-tier-3',
  'Tier 3 (example)',
  'cost_multiplier',
  10000,
  NULL,
  1,
  3,
  1,
  'Placeholder volume tier. Set the volume threshold and the multiplier before assigning anyone. Not a live discount.'
);
