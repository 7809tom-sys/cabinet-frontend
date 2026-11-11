-- TiDB SQL editor version. Numbered 0278. Run after 0272.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Do not run this from the application. Tom pastes it by hand.
-- A duplicate-table error on a re-run is safe: skip that line.
--
-- This adds sales-rep applications, editable commission settings, the rate
-- snapshot on each earned commission, checkout acknowledgements, and versioned
-- legal pages. It does not change order checkout, the cart, or quotes.
-- The seeded commission settings are $400 flat and 0.5% (50 basis points) of
-- confirmed order sales. The rep signup fee is left null on purpose.

-- 1
CREATE TABLE cabinet_dealz.sales_rep_applications (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, fullName VARCHAR(256) NOT NULL, email VARCHAR(320) NOT NULL, phone VARCHAR(32) NULL, state VARCHAR(64) NULL, businessName VARCHAR(256) NULL, status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', agreementVersion VARCHAR(80) NOT NULL, agreementAcceptedAt DATETIME NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY sales_rep_applications_status_idx (status));

-- 2
CREATE TABLE cabinet_dealz.sales_rep_commission_settings (id INT NOT NULL PRIMARY KEY, flatFeeCents INT NOT NULL, residualRateBps INT NOT NULL, residualBase VARCHAR(64) NOT NULL, repFeeCents INT NULL, repFeeCheckoutEnabled TINYINT(1) NOT NULL DEFAULT 0, updatedByUserId INT NULL, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);

-- 3
INSERT INTO cabinet_dealz.sales_rep_commission_settings (id, flatFeeCents, residualRateBps, residualBase, repFeeCents, repFeeCheckoutEnabled) VALUES (1, 40000, 50, 'confirmed_order_gross', NULL, 0);

-- 4
CREATE TABLE cabinet_dealz.sales_rep_affiliate_credits (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, salesRepApplicationId INT NOT NULL, affiliateId INT NOT NULL, paymentRef VARCHAR(255) NULL, flatFeeCents INT NOT NULL, residualRateBps INT NOT NULL, residualBase VARCHAR(64) NOT NULL, capturedAt DATETIME NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY sales_rep_affiliate_credits_affiliate_uq (affiliateId), KEY sales_rep_affiliate_credits_rep_idx (salesRepApplicationId));

-- 5
CREATE TABLE cabinet_dealz.sales_rep_commission_entries (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, salesRepApplicationId INT NOT NULL, affiliateId INT NOT NULL, kind ENUM('flat','residual') NOT NULL, sourceKey VARCHAR(128) NOT NULL, amountCents INT NOT NULL, flatFeeCents INT NOT NULL, residualRateBps INT NOT NULL, residualBase VARCHAR(64) NOT NULL, orderId INT NULL, status ENUM('pending','paid','void') NOT NULL DEFAULT 'pending', earnedAt DATETIME NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY sales_rep_commission_entries_source_uq (sourceKey), KEY sales_rep_commission_entries_rep_idx (salesRepApplicationId));

-- 6
CREATE TABLE cabinet_dealz.affiliate_checkout_acknowledgements (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, affiliateId INT NOT NULL, userId INT NOT NULL, plan ENUM('annual','monthly') NOT NULL, salesRepApplicationId INT NULL, operatorNoticeAcceptedAt DATETIME NOT NULL, agreementVersion VARCHAR(80) NOT NULL, agreementAcceptedAt DATETIME NOT NULL, stripeSessionId VARCHAR(255) NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY affiliate_checkout_ack_affiliate_idx (affiliateId));

-- 7
CREATE TABLE cabinet_dealz.legal_page_slots (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(64) NOT NULL, title VARCHAR(255) NOT NULL, publicPath VARCHAR(255) NOT NULL, publishedVersion INT NOT NULL DEFAULT 1, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY legal_page_slots_slug_uq (slug), UNIQUE KEY legal_page_slots_path_uq (publicPath));

-- 8
CREATE TABLE cabinet_dealz.legal_page_versions (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, slotId INT NOT NULL, version INT NOT NULL, source ENUM('migration','text','file','sheet') NOT NULL, bodyText MEDIUMTEXT NULL, fileName VARCHAR(255) NULL, mimeType VARCHAR(128) NULL, fileBase64 MEDIUMTEXT NULL, sheetJson MEDIUMTEXT NULL, uploadedBy VARCHAR(256) NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY legal_page_versions_slot_version_uq (slotId, version));

-- 9
INSERT INTO cabinet_dealz.legal_page_slots (slug, title, publicPath, publishedVersion) VALUES ('warranty', 'Warranty', '/warranty', 1), ('terms', 'Terms of Service / Terms and Conditions', '/terms', 1), ('affiliate-agreement', 'Affiliate Agreement', '/affiliate-agreement', 1), ('privacy', 'Privacy', '/privacy-policy', 1), ('sales-rep-agreement', 'Sales Rep Agreement', '/sales-rep-agreement', 1);

-- 10
INSERT INTO cabinet_dealz.legal_page_versions (slotId, version, source, bodyText, uploadedBy) SELECT id, 1, 'migration', NULL, 'Site page' FROM cabinet_dealz.legal_page_slots;

-- 11. Which approved rep is credited for an affiliate. The flat fee is written only after the membership payment.
CREATE TABLE cabinet_dealz.sales_rep_affiliate_assignments (affiliateId INT NOT NULL PRIMARY KEY, salesRepApplicationId INT NOT NULL, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
