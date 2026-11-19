-- 0283: invoice lookup, customer-facing tracking and damage claims (Tom, Nov 19 2026).
--
-- Decisions that shape this migration:
--   * One order = one invoice: invoiceNumber lives on orders; there is no separate
--     invoices table. A kitchen may still have several outbound shipments.
--   * Customer contact lives ON the order (contactEmail, contactZip), because guest
--     and contractor orders have no account to join through. That is what makes
--     "invoice number + email or ZIP" verification correct for every order type.
--   * Customer-facing freight tracking is its own table (order_tracking), keyed by
--     orderId. order_shipments (keyed by orderRequestId) stays exactly what it is:
--     internal vendor fulfilment. Two different journeys must never share a table,
--     or a vendor's inbound tracking number ends up on a customer's invoice.
--   * Claim photos live in the normal storage bucket but are only served through
--     signed URLs: the customer sees them after a verified lookup, admins see the
--     same evidence in the review queue. Nothing is public.

-- 1. Invoice number and the contact fields the lookup verifies against.
ALTER TABLE cabinet_dealz.orders
  ADD COLUMN IF NOT EXISTS invoiceNumber VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS contactEmail VARCHAR(320) NULL,
  ADD COLUMN IF NOT EXISTS contactZip VARCHAR(10) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_invoice_number
  ON cabinet_dealz.orders (invoiceNumber);

CREATE INDEX IF NOT EXISTS idx_orders_contact_email
  ON cabinet_dealz.orders (contactEmail);

-- Backfill the contact fields from the linked customer where there is one.
-- Guests keep NULL until checkout captures it.
UPDATE cabinet_dealz.orders o
JOIN cabinet_dealz.users u ON u.id = o.userId
SET o.contactEmail = COALESCE(o.contactEmail, u.email)
WHERE o.userId IS NOT NULL AND o.contactEmail IS NULL;

-- 2. Customer-facing freight tracking. One row per pallet/freight load.
CREATE TABLE IF NOT EXISTS cabinet_dealz.order_tracking (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  carrier VARCHAR(64) NULL,
  trackingNumber VARCHAR(128) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  trackingUrl VARCHAR(1024) NULL,
  estimatedDeliveryAt TIMESTAMP NULL,
  shippedAt TIMESTAMP NULL,
  deliveredAt TIMESTAMP NULL,
  notes VARCHAR(1000) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_tracking_order (orderId),
  INDEX idx_order_tracking_status (status)
);

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