-- NOT APPLIED. Proposed migration for review only (Auto Design subscription gate,
-- Tom, voice, Nov 19, 2026, 7:52 AM CT). Nothing in cabinet-frontend runs this.
-- TiDB SQL editor version. Numbered 0279. Run after 0278, and only once the
-- cabinet-backend procedures in docs/auto-design-subscription-gate.md exist.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Do not run this from the application. Tom pastes it by hand.
-- A duplicate-table error on a re-run is safe: skip that line.
--
-- Identity for Auto Design limits and the 90-day credit is the VERIFIED PHONE.
-- phoneHash = SHA-256 of the E.164 number (same as server/lib/twilioVerify.ts
-- hashPhoneE164). The UNIQUE key on phoneHash is what stops one phone from
-- opening several free accounts under different emails.
-- Store fee policy: grossCents is what the customer paid and is what gets
-- credited. storeFeeCents (Apple/Google cut) is recorded for accounting only and
-- is never charged to the customer or added to kitchen prices.
-- Touches no existing table. Does not touch freight_zones or any SKU.

-- 1  One row per verified phone. Links to the account that verified it.
CREATE TABLE cabinet_dealz.auto_design_phones (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, phoneHash VARCHAR(64) NOT NULL, phoneE164 VARCHAR(32) NOT NULL, userId INT NOT NULL, verificationProvider VARCHAR(32) NOT NULL DEFAULT 'twilio_verify', verificationSid VARCHAR(128) NULL, verifiedAt DATETIME NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY auto_design_phones_phone_uq (phoneHash), KEY auto_design_phones_user_idx (userId));

-- 2  Every Auto Design run, counted per phone (free-run limit) and used for the credit window.
CREATE TABLE cabinet_dealz.auto_design_runs (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, phoneHash VARCHAR(64) NOT NULL, userId INT NOT NULL, kitchenDesignId INT NULL, roomType VARCHAR(32) NOT NULL, basis ENUM('free_run','subscribed') NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY auto_design_runs_phone_idx (phoneHash, createdAt), KEY auto_design_runs_design_idx (kitchenDesignId));

-- 3  $9.99 access / app download fee payments (web Stripe now; App Store / Play Store later).
CREATE TABLE cabinet_dealz.auto_design_payments (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, phoneHash VARCHAR(64) NOT NULL, userId INT NOT NULL, channel ENUM('web','app_store','play_store') NOT NULL, providerRef VARCHAR(255) NOT NULL, grossCents INT NOT NULL, storeFeeCents INT NULL, currency CHAR(3) NOT NULL DEFAULT 'USD', paidAt DATETIME NOT NULL, refundedAt DATETIME NULL, subscriptionId VARCHAR(255) NULL, activeUntil DATETIME NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY auto_design_payments_provider_uq (channel, providerRef), KEY auto_design_payments_phone_idx (phoneHash, paidAt));

-- 4  The one credit per phone on its first kitchen order. UNIQUE phoneHash = applied once.
CREATE TABLE cabinet_dealz.auto_design_order_credits (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, phoneHash VARCHAR(64) NOT NULL, paymentId INT NOT NULL, orderId INT NOT NULL, creditCents INT NOT NULL, qualifyingDesignIds JSON NOT NULL, appliedAt DATETIME NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY auto_design_order_credits_phone_uq (phoneHash), UNIQUE KEY auto_design_order_credits_order_uq (orderId));
