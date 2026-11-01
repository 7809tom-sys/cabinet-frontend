-- TiDB SQL editor version. Numbered 0237. Run after 0233 (the kitchen_rules table must exist).
-- One statement. Every table is cabinet_dealz.<table>.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
-- Safe to re-run: INSERT IGNORE. Adds only the all-mosaics hard rule (Backsplash, auto, implemented).
-- The admin Kitchen Rules list already shows this rule from the built-in catalog; this row only adds it to the table.

-- 1
INSERT IGNORE INTO cabinet_dealz.kitchen_rules (
  ruleCode, category, title, ruleDescription, parameterJson, enforcementKind, sourceText,
  implementationStatus, enabledFlag, notesText, readsParameters
) VALUES
('owner-mosaic-interlock', 'Backsplash', 'All mosaics show no sheet edges', 'Every mosaic in the catalog (hex, square, picket, herringbone, penny, linear and every other mosaic, not a short list of names) sits at its real repeat spacing, flush against the next sheet, so the only thing visible at any joint is an even grout line of 1/16 to 1/8 inch. No brightness change from sheet to sheet, no darker outlines and no seams where sheets meet: the backsplash reads as one continuous surface, never a grid of rectangles. Same rule in 3D and in the elevation view.', '{"mosaic_grout_min_in":0.0625,"mosaic_grout_max_in":0.125}', 'auto', 'Owner', 'implemented', 1, 'Hard rule from the owner. Lives in lib/backsplashMosaic.ts; the per-product tests and the every-catalog-mosaic-has-a-spec test fail if any sheet gets a tint, an outline, or the wrong spacing or grout. Mosaics without a curated row get a generic seamless spec from their catalog size. Spacing, overlap and grout values are estimates until measured from the product photos.', 0);
