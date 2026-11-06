-- Payment-received notice marker for the owner.
-- Paste each numbered block on its own in the TiDB SQL editor (one statement per line).
-- Safe to re-run. Every table is qualified as cabinet_dealz.<table>.
-- This column lets a retried Stripe webhook avoid sending a second owner notice
-- for the same payment. The customer receipt marker (receiptSentAt) is separate
-- and already lives in 0224_order_admin_reconciliation.tidb.sql.

-- 1
ALTER TABLE cabinet_dealz.order_requests ADD COLUMN IF NOT EXISTS paymentNoticeSentAt TIMESTAMP NULL;
