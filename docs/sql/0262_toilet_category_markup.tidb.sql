-- Toilet pricing: restore the repo's Toilets & Bidets markup (3500 bps = +35%).
--
-- Run after reviewing the preview SELECT. One statement per block; paste each
-- block on its own in the TiDB SQL editor. Table is cabinet_dealz.pelican_products.
--
-- WHY: every sell price is derived at read time, never stored:
--   sell = positive_authorized_price_base x (1 + pelican_category_markups.markupBps/10000)
-- The stored base (listPrice) is correct and matches Pelican's own price list.
-- Only the category markup row drifted: it now holds 18400 (+184%) instead of the
-- repo's 3500 (+35%), which is the only lever that can misprice every toilet at once.

-- 1. PREVIEW: current stored markup vs the repo default for every visible category.
SELECT category, markupBps, ROUND(markupBps / 100, 2) AS markupPercent
FROM cabinet_dealz.pelican_category_markups
ORDER BY category;

-- 2. PREVIEW: what Tom sees today vs the correct price, per toilet SKU.
SELECT p.pelicanCode,
       p.listPrice AS source_cost,
       m.markupBps AS current_markup_bps,
       ROUND(p.listPrice * (1 + m.markupBps / 10000), 2) AS current_sell_price,
       ROUND(p.listPrice * 1.35, 2) AS correct_sell_price_35pct
FROM cabinet_dealz.pelican_products p
JOIN cabinet_dealz.pelican_category_markups m ON m.category = p.category
WHERE p.category = 'Toilets & Bidets'
  AND p.isActive = 1
  AND p.showInCatalog = 1
  AND (p.yourCost > 0 OR p.listPrice > 0)
ORDER BY p.pelicanCode;

-- 3. UPDATE: set the Toilets & Bidets markup back to the repo rule (+35%).
UPDATE cabinet_dealz.pelican_category_markups SET markupBps = 3500 WHERE category = 'Toilets & Bidets';

-- 4. CONFIRM the new sell prices before closing the editor.
SELECT p.pelicanCode,
       p.listPrice AS source_cost,
       ROUND(p.listPrice * (1 + m.markupBps / 10000), 2) AS sell_price_after
FROM cabinet_dealz.pelican_products p
JOIN cabinet_dealz.pelican_category_markups m ON m.category = p.category
WHERE p.category = 'Toilets & Bidets'
  AND p.isActive = 1
  AND p.showInCatalog = 1
  AND (p.yourCost > 0 OR p.listPrice > 0)
ORDER BY p.pelicanCode;
