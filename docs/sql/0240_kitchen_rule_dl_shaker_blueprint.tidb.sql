-- TiDB SQL editor version. Numbered 0240. Run after 0233 (the kitchen_rules table must exist).
-- One statement. Every table is cabinet_dealz.<table>.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
-- Safe to re-run: INSERT IGNORE. Adds only the DL shaker blueprint rule.

-- 1
INSERT IGNORE INTO cabinet_dealz.kitchen_rules (
  ruleCode, category, title, ruleDescription, parameterJson, enforcementKind, sourceText,
  implementationStatus, enabledFlag, notesText, readsParameters
) VALUES
(
  'owner-dl-shaker-blueprint',
  'Owner doors',
  '2.75 and 3 inch shaker doors use the DL shaker blueprint',
  'HARD RULE (Tom, Nov 1 2026): ALL 2.75 in and 3 in shaker doors start from the DL Shaker blueprint as the base template. Geometry (rail/stile frame, sharp square corners, flat center slab, notch) is proven and must not be changed per style. Only texture/color varies; any applied color must be from the brand palette (cream #fffdf9/#f6f3ed, green #244338, gold #d7a46c), never outside blue/teal/off-brand green. Deviation requires Tom''s explicit override. Each of those doors keeps its own finish color and is matched to the closest standard DL shaker (White, Grey, Versa, or Espresso) by paint versus wood and by color. Slim Shaker and Double Shaker are not this template.',
  '{}',
  'auto',
  'Owner',
  'implemented',
  1,
  'Enforced by standardShakerDlFacePlan in shared/shakerDoorBlueprint.ts. The test "fails if a 2.75 or 3 inch shaker bypasses the DL template or uses a non-brand UI tint" fails if a 2.75 or 3 inch shaker skips the template or the module uses an off-brand UI tint. Door finish colors are the style''s own color, not the brand palette.',
  0
);
