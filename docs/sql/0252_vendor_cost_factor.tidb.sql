-- TiDB SQL editor version. Numbered 0252. Run after 0251.
-- One statement per line, so each line can be pasted on its own in the TiDB
-- editor. Every table is cabinet_dealz.<table>. No table aliases, so a line
-- pastes cleanly into the TiDB Cloud editor, and no UPDATE in this file uses one.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
--
-- Safe to re-run, but not silent about it: this file uses PLAIN ADD COLUMN, with
-- no conditional-DDL keywords anywhere, because the TiDB Cloud editor rejects
-- them. On a second run those statements answer "Duplicate column name ...".
-- THAT ERROR IS SAFE: the column already exists, which is what the statement
-- wanted. Skip that one line and paste the next.
--
-- Why: a vendor catalog row with no stored cost shows "-" today. The real cost is
-- the list price times that supply line's landed-cost factor, which until now was
-- only visible as two numbers on the Multipliers tab. These two columns are that
-- same pair, made explicit, so a report can state which percentage it used and an
-- administrator can set it per vendor.
--
-- What these columns mean, and why they are not "margin percent":
--
--   cost = listPrice x costMultiplier x (1 + freightMultiplier)
--
-- costMultiplier is a FRACTION OF THE LIST PRICE (0.01 to 1.00), matching the
-- "Distributor Multipliers" tab where Base = "core cost fraction of the
-- distributor's list". It is NOT a markup applied to cost, and it is NOT
-- pricing_settings.homeownerMarkupBps - that multiplies cost UP to a sell price,
-- so using it here would present a retail price as our cost.
--
-- Worked example, the real order CD-20261022-OLOUT:
--   distributor cost $284.39, list price $449.34
--   284.39 / 449.34 = 0.632906  -> costMultiplier about 0.6329, freight 0
--   449.34 x 0.6329 = 284.39    -> rebuilds the stored cost exactly
--   (the sell side is the inverse: 449.34 / 284.39 = 1.58, a 36.7% margin)
--
-- NULL means "not set". A vendor with no factor keeps showing "-" for rows with
-- no stored cost. The app never borrows another vendor's number and never
-- substitutes the list price.
--
-- This file writes no row. The values are set by an administrator on the
-- Distributor Multipliers tab, which is the only writer of these columns.

-- 1. The landed-cost fraction of list price. NULL means this vendor has no factor, and its rows show "-" rather than a guess.
ALTER TABLE cabinet_dealz.distributors ADD COLUMN costMultiplier DECIMAL(10,6) NULL;

-- 2. The tariff or freight rate added over that base. NULL means none.
ALTER TABLE cabinet_dealz.distributors ADD COLUMN freightMultiplier DECIMAL(10,6) NULL;

-- 3. Verification, read-only. Expect both columns with their real types. Anything absent did not run.
SELECT column_name AS presentColumn, data_type AS columnType, is_nullable AS nullable FROM information_schema.columns WHERE table_schema = 'cabinet_dealz' AND table_name = 'distributors' AND column_name IN ('costMultiplier','freightMultiplier') ORDER BY column_name;

-- 4. Verification, read-only. Every supply line with the factor it will use. A blank costMultiplier is a vendor whose catalog rows stay "-" until an administrator sets one.
SELECT id AS distributorId, code, name, brandName, costMultiplier, freightMultiplier FROM cabinet_dealz.distributors ORDER BY id;
