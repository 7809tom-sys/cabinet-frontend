-- 0283: invoice lookup, shipment tracking and damage claims (Tom, Nov 19 2026).
--
-- One order = one invoice: invoiceNumber lives on orders, there is no separate
-- invoices table, and a kitchen may still have several order_shipments rows (one
-- per freight/parcel tracking number).
--
-- Claim photos are stored in the normal storage bucket but are only served through
-- signed URLs: the customer sees them on the invoice after a verified lookup, and
-- admins see the same evidence in the review queue. Nothing is public.

-- 1. The invoice number the customer types on the lookup page.
ALTER TABLE cabinet_dealz.orders
  ADD COLUMN IF NOT EXISTS invoiceNumber VARCHAR(32) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_invoice_number
  ON cabinet_dealz.orders (invoiceNumber);

-- 2. Tracking fields the shipment row needs for the customer view.
ALTER TABLE cabinet_dealz.order_shipments
  ADD COLUMN IF NOT EXISTS trackingUrl VARCHAR(1024) NULL,
  ADD COLUMN IF NOT EXISTS estimatedDeliveryAt TIMESTAMP NULL;

-- 3. Damage claims: header, per-line quantities, photos.
CREATE TABLE IF NOT EXISTS cabinet_dealz.damage_claims (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  invoiceNumber VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'submitted',
  description TEXT NOT NULL,
  discoveredStage VARCHAR(32) NULL,
  contactEmail VARCHAR(320) NOT NULL,
  submittedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolutionNote TEXT NULL,
  INDEX idx_damage_claims_order (orderId),
  INDEX idx_damage_claims_status (status)
);

CREATE TABLE IF NOT EXISTS cabinet_dealz.damage_claim_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  damageClaimId INT NOT NULL,
  orderItemId INT NOT NULL,
  sku VARCHAR(64) NOT NULL,
  damagedQuantity INT NOT NULL,
  itemNotes VARCHAR(512) NULL,
  INDEX idx_damage_claim_items_claim (damageClaimId)
);

CREATE TABLE IF NOT EXISTS cabinet_dealz.damage_claim_photos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  damageClaimId INT NOT NULL,
  damageClaimItemId INT NULL,
  fileUrl VARCHAR(1024) NOT NULL,
  uploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_damage_claim_photos_claim (damageClaimId)
);