-- TiDB SQL editor version. Numbered 0281. Run after 0280.
-- One statement per numbered block, and each statement is one physical line,
-- so each block can be pasted on its own in the TiDB SQL editor. Every table
-- is cabinet_dealz.<table>. No reserved-word aliases. Do not run this from an
-- application. Tom pastes it in the TiDB editor.
--
-- RUNNING IT TWICE IS SAFE. The UPDATE is idempotent: a second run finds the
-- default already at 3 and the title already rewritten, and changes nothing
-- further. A valueText that is already 3, NULL, or a custom number other than 2
-- is left alone.
--
-- WHY
-- Auto Design's appliance wiggle room is now 3 inches across the board (range,
-- refrigerator, sink base, and dishwasher). The code default of
-- anchor_wiggle_cap_in is 3. The Designer reads a LIVE override from
-- cabinet_dealz.kitchen_rule_settings.valueText when that column is set; a
-- saved "2" would keep every shopper on 2 inches even after the frontend
-- deploys. defaultValueText is documentation of the code default at seed time
-- and does not override a newer code default by itself, but it should stay in
-- step so the table is not misleading.
--
-- This file does not insert rows, does not delete rows, and does not change
-- any other setting. A custom valueText that is not 2 (for example 1.5 or 4)
-- is preserved. If the row does not exist, the UPDATE affects 0 rows and the
-- Designer already uses the code default of 3 — this script is still safe.
--
-- Do not run this against the live database from this PR. Paste it in the
-- TiDB editor when you are ready.

-- 1. Read-only: the current row, if any. Safe to run twice. Nothing is changed.
SELECT existing_setting.id AS settingId, existing_setting.settingKey, existing_setting.title, existing_setting.description, existing_setting.valueText, existing_setting.defaultValueText, existing_setting.enabledFlag, existing_setting.updatedBy, existing_setting.updatedAt FROM cabinet_dealz.kitchen_rule_settings AS existing_setting WHERE existing_setting.settingKey = 'anchor_wiggle_cap_in' AND existing_setting.deletedAt IS NULL;

-- 2. Set the documented default and the published title/description to 3 inches for every appliance. Rewrite valueText only when it is the old default of 2 (including 2.0). NULL stays NULL (the Designer then uses the code default of 3). Any other saved number is left alone.
UPDATE cabinet_dealz.kitchen_rule_settings AS existing_setting SET existing_setting.title = 'Wiggle room for appliances', existing_setting.description = 'Every appliance — the range, refrigerator, sink base, and dishwasher — may slide at most this far each way from the measured center. A sink base also keeps its sink on the window within this cap. Windows never move.', existing_setting.defaultValueText = '3', existing_setting.valueText = CASE WHEN existing_setting.valueText IS NULL THEN existing_setting.valueText WHEN TRIM(existing_setting.valueText) IN ('2', '2.0', '2.00') THEN '3' ELSE existing_setting.valueText END WHERE existing_setting.settingKey = 'anchor_wiggle_cap_in' AND existing_setting.deletedAt IS NULL;

-- 3. Read-only check: confirm the default is 3, and show whether a live override is still stored. Expect defaultValueText = '3'. valueText is '3' only when it used to be 2; otherwise it is NULL or the custom value that was already there.
SELECT existing_setting.settingKey, existing_setting.title, existing_setting.defaultValueText, existing_setting.valueText FROM cabinet_dealz.kitchen_rule_settings AS existing_setting WHERE existing_setting.settingKey = 'anchor_wiggle_cap_in' AND existing_setting.deletedAt IS NULL;
