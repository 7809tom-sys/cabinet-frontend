-- Per-vendor landed-cost factor, for vendor catalog rows with no cost on file.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS only.
--
-- What these columns mean, and why they are not "margin percent":
--
--   cost = listPrice × costMultiplier × (1 + freightMultiplier)
--
-- costMultiplier is a FRACTION OF THE LIST PRICE (0.01 … 1.00), matching the
-- existing "Distributor Multipliers" tab where Base = "core cost fraction of the
-- distributor's list" and freight is the tariff added over it. It is NOT a
-- markup applied to cost, and it is NOT pricing_settings.homeownerMarkupBps
-- (that multiplies cost UP to a sell price — using it here would present a
-- retail price as our cost).
--
-- Worked example, the real order CD-20261022-OLOUT:
--   distributor cost $284.39, list price $449.34
--   284.39 / 449.34 = 0.632906  → costMultiplier ≈ 0.6329, freight 0
--   449.34 × 0.6329 = 284.39    → rebuilds the stored cost exactly
--   (the sell side is the inverse: 449.34 / 284.39 = 1.58, a 36.7% margin)
--
-- NULL means "not set". A vendor with no factor keeps showing "—" for rows with
-- no stored cost; the app never borrows another vendor's number and never
-- substitutes the list price.
--
-- If a distributor_skus.costMultiplier or .freightMultiplier column already
-- exists in this database, these statements are no-ops and the backend should
-- read the existing column instead of the one added here.

ALTER TABLE cabinet_dealz.distributors ADD COLUMN IF NOT EXISTS costMultiplier DECIMAL(10,6) NULL;

ALTER TABLE cabinet_dealz.distributors ADD COLUMN IF NOT EXISTS freightMultiplier DECIMAL(10,6) NULL;

SELECT d.id, d.code, d.name, d.brandName, d.costMultiplier, d.freightMultiplier FROM cabinet_dealz.distributors AS d ORDER BY d.id;
