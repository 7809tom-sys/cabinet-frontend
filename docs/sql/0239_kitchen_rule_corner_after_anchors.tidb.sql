-- TiDB SQL editor version. Numbered 0239. Run after 0233 (the kitchen_rules table must exist).
-- One statement. Every table is cabinet_dealz.<table>.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
-- Safe to re-run: INSERT IGNORE. Adds only the corner-after-anchors rule (Owner placement, auto, pending).
-- The admin Kitchen Rules list already shows this rule from the built-in catalog; this row only adds it to the table.

-- 1
INSERT IGNORE INTO cabinet_dealz.kitchen_rules (
  ruleCode, category, title, ruleDescription, parameterJson, enforcementKind, sourceText,
  implementationStatus, enabledFlag, notesText, readsParameters
) VALUES
('owner-corner-after-anchors', 'Owner placement', 'Corner cabinet is chosen after the appliances, sink and refrigerator', 'Order of placement: appliances, sink and refrigerator first. Then the corner cabinet is chosen from what is left on each leg, picking the corner that needs the fewest fillers while still working (doors and drawers open, lazy Susan or blind corner usable). Fillers close what remains.', '{}', 'auto', 'Owner', 'pending', 1, 'Today Auto-Design seats the largest corner that fits (diagonal, then lazy Susan, then blind). It does not yet compare the filler each candidate leaves. Tom set this rule 2026-11-01.', 0);
