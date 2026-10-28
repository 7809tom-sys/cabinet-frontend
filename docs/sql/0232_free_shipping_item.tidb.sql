-- TiDB SQL editor version. Numbered 0232. Run AFTER 0231.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Apply this before deploying docs/patches/cabinet-backend-free-shipping-item.patch.
--
-- Why this column is on cabinets, not distributor_skus: free shipping is a
-- CabinetDealz offer on the catalog item the customer buys. One master can
-- have many supplier price rows. Package dimensions already live on the
-- master, and the Add Item form edits that record. Default 0 leaves every
-- existing item on quoted freight.

-- 1. Add the flag. Existing rows stay off.
ALTER TABLE cabinet_dealz.cabinets
  ADD COLUMN IF NOT EXISTS freeShipping TINYINT(1) NOT NULL DEFAULT 0;

-- 2. Read-only: the column exists and existing items are still standard freight.
--    Expect free_shipping_count = 0 until an admin marks an item Free shipping.
SELECT
  COUNT(*) AS cabinet_count,
  COALESCE(SUM(cabinet_master.freeShipping = 1), 0) AS free_shipping_count,
  COALESCE(SUM(cabinet_master.freeShipping = 0), 0) AS standard_shipping_count
FROM cabinet_dealz.cabinets AS cabinet_master;
