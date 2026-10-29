-- Contractor portal customers, design assignment, and contractor labor estimates.
-- Paste each numbered block on its own in the TiDB SQL editor.
-- One statement per block. Do not paste this into an automatic migration.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- and ADD COLUMN IF NOT EXISTS.
-- Every table is cabinet_dealz.<table>.
-- Order tracking reads existing order_requests and order_shipments columns.
-- It does not add order columns. Delivered uses the existing delivery signature
-- (orderSignedAt). Shipped uses orderShippedAt and order_shipments.shippedAt.
-- Sent to distributor uses sentToDistributorAt and the distributor email columns
-- from SQL 0227.

-- 1
CREATE TABLE IF NOT EXISTS cabinet_dealz.contractor_customers (
  id INT NOT NULL AUTO_INCREMENT,
  contractorUserId INT NOT NULL,
  name VARCHAR(256) NOT NULL,
  email VARCHAR(320) NULL,
  phone VARCHAR(32) NULL,
  notes TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 2
CREATE INDEX IF NOT EXISTS contractor_customers_owner_idx
  ON cabinet_dealz.contractor_customers (contractorUserId, name);

-- 3
ALTER TABLE cabinet_dealz.kitchen_designs
  ADD COLUMN IF NOT EXISTS contractorCustomerId INT NULL;

-- 4
CREATE INDEX IF NOT EXISTS kitchen_designs_contractor_customer_idx
  ON cabinet_dealz.kitchen_designs (contractorCustomerId);

-- 5
ALTER TABLE cabinet_dealz.affiliate_installation_estimates
  ADD COLUMN IF NOT EXISTS contractorUserId INT NULL;

-- 6
ALTER TABLE cabinet_dealz.affiliate_installation_estimates
  MODIFY COLUMN affiliateId INT NULL;

-- 7
CREATE INDEX IF NOT EXISTS affiliate_installation_estimates_contractor_idx
  ON cabinet_dealz.affiliate_installation_estimates (contractorUserId);

-- 8
CREATE TABLE IF NOT EXISTS cabinet_dealz.contractor_kitchen_cost_defaults (
  contractorUserId INT NOT NULL,
  defaultsJson TEXT NOT NULL,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (contractorUserId)
);

-- 9
ALTER TABLE cabinet_dealz.crm_deals
  ADD COLUMN IF NOT EXISTS contractorCustomerId INT NULL;

-- 10
CREATE INDEX IF NOT EXISTS crm_deals_contractor_customer_idx
  ON cabinet_dealz.crm_deals (contractorCustomerId);

-- 11
CREATE TABLE IF NOT EXISTS cabinet_dealz.contractor_access_requests (
  id INT NOT NULL AUTO_INCREMENT,
  userId INT NOT NULL,
  businessName VARCHAR(256) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  licenseNumber VARCHAR(64) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  reviewedByUserId INT NULL,
  reviewedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 12
CREATE INDEX IF NOT EXISTS contractor_access_requests_user_idx
  ON cabinet_dealz.contractor_access_requests (userId, status);
