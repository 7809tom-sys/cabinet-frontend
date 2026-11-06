-- TiDB SQL editor version. Numbered 0249. Run after 0233 (the kitchen_rules table must exist).
-- One statement per numbered block. Every table is cabinet_dealz.<table>.
-- Do not run this from an application. The owner pastes each block in the TiDB editor.
-- Safe to re-run: INSERT IGNORE. Adds only the owner's mosaic-backsplash 5% waste rule row.
-- The admin Kitchen Rules list already shows this rule from the built-in catalog; this row only
-- adds it to the kitchen_rules table so it can be enabled, edited and reported on like the others.
-- No schema change: the rule reuses the existing kitchen_rules table.
-- No backend procedure changes: the rule runs entirely in the Designer's cart calculator.

-- 1
INSERT IGNORE INTO cabinet_dealz.kitchen_rules (
  ruleCode, category, title, ruleDescription, parameterJson, enforcementKind, sourceText,
  implementationStatus, enabledFlag, notesText, readsParameters
) VALUES
('owner-mosaic-backsplash-waste', 'Backsplash', 'Mosaic backsplash carries 5% waste', 'HARD RULE (Tom, Nov 6 2026): when mosaic tile is used for a backsplash, the cart automatically adds 5% waste to the square footage. If the backsplash needs X sq ft of mosaic, the cart quantity is X * 1.05, rounded up to the product''s sellable unit exactly as the cart already rounds area-priced tile. A mosaic is sold by the sheet, so the count is whole sheets: a real Pelican mosaic has no sq ft per box, and its published sheet size (the first two numbers of the catalog size, never the 8 mm thickness) gives the sq ft per sheet. Applies only to mosaics in backsplash designs. Field tile and every other wall tile keep the existing 15% overage, flooring keeps its layout waste, and countertops, sinks and faucets are unchanged. A mosaic installed as the floor keeps the flooring waste. The cart line says ''includes 5% waste''.', '{"mosaic_backsplash_waste_pct":5}', 'auto', 'Owner', 'implemented', 1, 'Hard rule from the owner. Enforced in lib/mosaicBacksplashWaste.ts and applied in buildSurfaceCartLines (lib/surfaceCartLines.ts). Mosaic detection uses the existing product type data, Pelican subCategory Mosaic on category Tile & Mosaic or a verified Designer catalog row by distributor SKU, never a guess. A row whose only mosaic evidence is the word mosaic in its name is not given the 5% rate; it stays at the 15% tile overage and mosaicDetectionUncertainty reports it. No isMosaic column exists on pelican_products, so a mosaic saved with a wrong sub-category follows that typo. A vendor-entered coverageSqFt still wins over the sheet size.', 0);

-- 2
COMMIT;

-- 3
SELECT 'COMMITTED';
