-- Designer availability override: forced ready, forced off, or automatic.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS only.
--
-- `designerReadyOverride` is a TRI-STATE, not a boolean:
--
--   NULL     automatic — the catalog's own rules decide (the normal case)
--   'ready'  FORCED READY — an admin cleared the red flag on an item the rules
--            would refuse, e.g. one whose dimensions can be derived from its SKU
--            (W3024 → 30 × 24 × 12)
--   'off'    FORCED OFF — an admin hid a perfectly valid item, e.g. a cabinet
--            out of stock for months. It leaves the Designer palette and
--            auto-design, but saved designs keep it with an "unavailable" badge.
--
-- A boolean cannot express both directions: `false` is indistinguishable from
-- "no override", so turning an item off would silently fall back to automatic.
--
-- `designerOffUntil` is a CALENDAR DATE (not a timestamp). Once that date is
-- reached the item is treated as automatic again, evaluated at read time, so no
-- scheduled job is needed. NULL means "off until an administrator resets it".

ALTER TABLE cabinet_dealz.cabinets ADD COLUMN IF NOT EXISTS designerReadyOverride ENUM('ready','off') NULL;

ALTER TABLE cabinet_dealz.cabinets ADD COLUMN IF NOT EXISTS designerReadyOverrideBy VARCHAR(255) NULL;

ALTER TABLE cabinet_dealz.cabinets ADD COLUMN IF NOT EXISTS designerReadyOverrideAt TIMESTAMP NULL;

ALTER TABLE cabinet_dealz.cabinets ADD COLUMN IF NOT EXISTS designerReadyDerivedFrom VARCHAR(64) NULL;

ALTER TABLE cabinet_dealz.cabinets ADD COLUMN IF NOT EXISTS designerOffReason VARCHAR(255) NULL;

ALTER TABLE cabinet_dealz.cabinets ADD COLUMN IF NOT EXISTS designerOffUntil DATE NULL;

SELECT c.id, c.masterCode, c.designerEligible, c.designerReadyOverride, c.designerReadyOverrideBy, c.designerReadyOverrideAt, c.designerOffReason, c.designerOffUntil FROM cabinet_dealz.cabinets AS c WHERE c.designerReadyOverride IS NOT NULL ORDER BY c.designerReadyOverrideAt DESC LIMIT 50;
