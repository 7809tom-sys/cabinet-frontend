-- TiDB SQL editor version. Numbered 0274. Run on its own.
-- One statement per line, so each line can be pasted on its own in the TiDB
-- editor. Every table is cabinet_dealz.<table>. No table aliases.
-- Do not run this from an application. Tom pastes it in the TiDB editor.
--
-- This file only adds. It does not DELETE, DROP, TRUNCATE, or UPDATE.
-- RUNNING IT TWICE IS SAFE, AND AN "already exists" ERROR IS SAFE TO SKIP.
-- Tom's TiDB Cloud editor rejects IF NOT EXISTS, so this file uses a plain
-- CREATE TABLE. On a second run that statement fails with
-- "Table 'distributor_legal_terms' already exists". Skip that error and run
-- the INSERT IGNORE. The unique key is (distributorKey, sectionKey), so a
-- second run inserts nothing and does not overwrite a paste an admin saved.
--
-- WHAT THIS STORES
-- One row per distributor section on the admin Legal tab
-- (/admin?tab=legal): shipping, returns, and warranty for U.S. Cabinet Depot,
-- Skyline, Faircrest (Clark and Son), Milestone Cabinetry, and Pelican, plus
-- one shared Cabinet Deals row (cabinet-deals / return-rules).
--
-- bodyText NULL means the admin tab shows the captured wording in
-- client/src/lib/distributorLegalTerms.captures.ts. That file is the
-- distributor's own text. This SQL does not copy that text, so a second run
-- cannot overwrite it and cannot drift from it. An admin paste sets bodyText.
-- Clearing a paste sets bodyText back to NULL and the capture shows again.
--
-- The Cabinet Deals row is the two return rules plus the restocking fee line
-- spelled "thirty percent (30%)". It is not a distributor section. NULL there
-- means the wording in client/src/lib/distributorLegalTerms.ts.
--
-- sourceUrl is the page the capture came from. More than one page is joined
-- with " | ". capturedOn is the day those pages were read: 2026-11-10.

-- 1. The table. Plain CREATE TABLE: a second run fails here with "Table 'distributor_legal_terms' already exists", which is safe to skip.
CREATE TABLE cabinet_dealz.distributor_legal_terms (id INT NOT NULL AUTO_INCREMENT, distributorKey VARCHAR(64) NOT NULL, sectionKey VARCHAR(32) NOT NULL, bodyText MEDIUMTEXT NULL, sourceUrl TEXT NULL, capturedOn VARCHAR(10) NULL, updatedByName VARCHAR(255) NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY distributor_legal_terms_key_uq (distributorKey, sectionKey));

-- 2. VERIFY (read-only). Expect no rows on a first run.
SELECT existing_term.id AS termId, existing_term.distributorKey, existing_term.sectionKey, existing_term.bodyText, existing_term.sourceUrl, existing_term.capturedOn, existing_term.updatedByName, existing_term.updatedAt FROM cabinet_dealz.distributor_legal_terms AS existing_term ORDER BY existing_term.distributorKey, existing_term.sectionKey;

-- 3. Seed one row per section. bodyText stays NULL so the tab keeps showing the captured wording until an admin saves a paste. INSERT IGNORE does not replace a row that is already there.
INSERT IGNORE INTO cabinet_dealz.distributor_legal_terms (distributorKey, sectionKey, bodyText, sourceUrl, capturedOn) VALUES ('us-cabinet-depot', 'shipping', NULL, 'https://www.uscabinetdepot.com/terms-and-conditions', '2026-11-10'), ('us-cabinet-depot', 'returns', NULL, 'https://www.uscabinetdepot.com/terms-and-conditions', '2026-11-10'), ('us-cabinet-depot', 'warranty', NULL, 'https://www.uscabinetdepot.com/warranty', '2026-11-10'), ('skyline', 'shipping', NULL, 'https://shop.skylinecabinetry.com/shipping-returns', '2026-11-10'), ('skyline', 'returns', NULL, 'https://shop.skylinecabinetry.com/shipping-returns', '2026-11-10'), ('skyline', 'warranty', NULL, 'https://shop.skylinecabinetry.com/warranty', '2026-11-10'), ('faircrest', 'shipping', NULL, 'https://www.faircrestcabinets.com/shipping-policy/ | https://www.faircrestcabinets.com/faqs', '2026-11-10'), ('faircrest', 'returns', NULL, 'https://www.faircrestcabinets.com/return-refund-policy/', '2026-11-10'), ('faircrest', 'warranty', NULL, 'https://www.faircrestcabinets.com/media/catalog/Clark-Son-Catalog-2023.pdf', '2026-11-10'), ('milestone', 'shipping', NULL, 'https://shop.milestonecabinetry.com/shipping-returns', '2026-11-10'), ('milestone', 'returns', NULL, 'https://shop.milestonecabinetry.com/shipping-returns', '2026-11-10'), ('milestone', 'warranty', NULL, 'https://shop.milestonecabinetry.com/warranty', '2026-11-10'), ('pelican', 'shipping', NULL, 'https://buildpelican.com/pages/terms-of-service | https://buildpelican.com/pages/terms-conditions', '2026-11-10'), ('pelican', 'returns', NULL, 'https://buildpelican.com/pages/returns | https://buildpelican.com/pages/terms-of-service | https://buildpelican.com/pages/terms-conditions', '2026-11-10'), ('pelican', 'warranty', NULL, 'https://buildpelican.com/pages/terms-of-service', '2026-11-10'), ('cabinet-deals', 'return-rules', NULL, NULL, '2026-11-10');

-- 4. VERIFY (read-only). Sixteen rows. bodyText is NULL on every row that has not been pasted over. updatedByName is NULL until an admin saves.
SELECT seeded_term.distributorKey, seeded_term.sectionKey, seeded_term.bodyText, seeded_term.sourceUrl, seeded_term.capturedOn, seeded_term.updatedByName FROM cabinet_dealz.distributor_legal_terms AS seeded_term ORDER BY seeded_term.distributorKey, seeded_term.sectionKey;
