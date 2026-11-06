-- TiDB SQL editor version. Numbered 0253. Run after 0252.
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
-- Why: a catalog cabinet is offered in the 3D Designer only when
-- cabinets.designerEligible is true, and that flag needs a published price AND a
-- box the Designer can build. Anything short of both shows a red flag on the
-- vendor screens, and there was no way for an administrator to intervene in
-- either direction.
--
-- designerReadyOverride is a TRI-STATE, not a boolean:
--
--   NULL     automatic - the catalog's own rules decide (the normal case)
--   'ready'  FORCED READY - an admin cleared the red flag on an item the rules
--            would refuse, for example one whose dimensions can be derived from
--            its SKU (W3024 -> 30 x 24 x 12 wall)
--   'off'    FORCED OFF - an admin hid a perfectly valid item, for example a
--            cabinet out of stock for months. It leaves the Designer palette and
--            auto-design, but saved designs keep it with an "unavailable" badge.
--
-- A boolean cannot express both directions: false is indistinguishable from "no
-- override", so turning an item off would silently fall back to automatic.
--
-- designerOffUntil is a CALENDAR DATE, not a timestamp. Once that date is reached
-- the item is treated as automatic again, evaluated at read time, so no scheduled
-- job is needed. NULL means "off until an administrator resets it".
--
-- This file writes no row. The override is set from the vendor catalog by an
-- administrator, and "Reset to automatic" nulls it again.

-- 1. The override itself. VARCHAR rather than ENUM so an ALTER never has to touch existing rows; the backend accepts only 'ready' and 'off'.
ALTER TABLE cabinet_dealz.cabinets ADD COLUMN designerReadyOverride VARCHAR(16) NULL;

-- 2. Who made the change, as "Name <email>". Shown as "Manually approved by Dana Reaves - Nov 5, 2026" or "Turned off by ...".
ALTER TABLE cabinet_dealz.cabinets ADD COLUMN designerReadyOverrideBy VARCHAR(255) NULL;

-- 3. When they made it.
ALTER TABLE cabinet_dealz.cabinets ADD COLUMN designerReadyOverrideAt TIMESTAMP NULL;

-- 4. The SKU the dimensions were derived from, when the catalog row had none. Null when the row already carried them.
ALTER TABLE cabinet_dealz.cabinets ADD COLUMN designerReadyDerivedFrom VARCHAR(64) NULL;

-- 5. Why the item was turned off. Defaults to "Out of stock" in the app, not in the column, so an empty reason stays visibly empty.
ALTER TABLE cabinet_dealz.cabinets ADD COLUMN designerOffReason VARCHAR(255) NULL;

-- 6. The back-in-stock date. DATE, not TIMESTAMP, because it is a calendar day: the item returns on that day in Central time.
ALTER TABLE cabinet_dealz.cabinets ADD COLUMN designerOffUntil DATE NULL;

-- 7. Verification, read-only. Expect all six columns with their real types. Anything absent did not run. Note designerOffUntil is type date.
SELECT column_name AS presentColumn, data_type AS columnType, is_nullable AS nullable FROM information_schema.columns WHERE table_schema = 'cabinet_dealz' AND table_name = 'cabinets' AND column_name IN ('designerReadyOverride','designerReadyOverrideBy','designerReadyOverrideAt','designerReadyDerivedFrom','designerOffReason','designerOffUntil') ORDER BY column_name;

-- 8. Verification, read-only. Every item currently overridden, and in which direction. An empty result means nothing has been overridden yet, which is the expected state right after this file runs.
SELECT id AS cabinetId, masterCode, designerEligible, designerReadyOverride, designerReadyOverrideBy, designerReadyOverrideAt, designerOffReason, designerOffUntil FROM cabinet_dealz.cabinets WHERE designerReadyOverride IS NOT NULL ORDER BY designerReadyOverrideAt DESC LIMIT 50;
