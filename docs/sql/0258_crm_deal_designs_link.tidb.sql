-- TiDB SQL editor version. Numbered 0258. Run after 0257.
-- Paste each numbered block on its own. One statement per line, one block per statement.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
--
-- Why: opening a customer in the CRM showed every saved design on the account
-- instead of only the design(s) linked to that customer. The screens now read
-- the stored link only. Nothing needs to be created for that to work — the link
-- tables already exist:
--   - cabinet_dealz.crm_deal_designs (dealId -> designId), written by "Attach"
--     in the CRM deal drawer and by crm.linkDesign.
--   - cabinet_dealz.kitchen_designs.contractorCustomerId, written by the
--     contractor portal's "Assign to customer" on a saved design.
--
-- So this file does NOT add a column, insert a row, update a row, or delete
-- anything. It adds two indexes (crm_deal_designs has neither today) and ends
-- with read-only checks. The checks tell you how many customers currently have a
-- stored design link, and they print the link rows for customer 5192 so you can
-- see exactly what is stored.
--
-- The two CREATE INDEX lines are plain and unguarded. Run block 1 first: if it
-- already lists an index, skip the matching CREATE INDEX line below. Running a
-- CREATE INDEX twice fails harmlessly with a duplicate-name error and changes
-- nothing. Every other block is a read-only SELECT and is always safe to re-run.

-- 1. Read-only: do these indexes already exist? Expect no rows on a fresh database.
SELECT index_name AS existingIndex FROM information_schema.statistics WHERE table_schema = 'cabinet_dealz' AND table_name = 'crm_deal_designs' AND index_name IN ('crm_deal_designs_deal_idx', 'crm_deal_designs_design_idx') GROUP BY index_name ORDER BY index_name;

-- 2. Index the deal side of the link. The customer view filters on dealId every
--    time a deal is opened, and crm_deal_designs has no index on it.
--    Skip this line if block 1 already lists crm_deal_designs_deal_idx.
CREATE INDEX crm_deal_designs_deal_idx ON cabinet_dealz.crm_deal_designs (dealId);

-- 3. Index the design side, so unlinking and duplicate checks do not scan.
--    Skip this line if block 1 already lists crm_deal_designs_design_idx.
CREATE INDEX crm_deal_designs_design_idx ON cabinet_dealz.crm_deal_designs (designId);

-- 4. Read-only: confirm both indexes now exist. Expect two rows.
SELECT index_name AS indexedColumn FROM information_schema.statistics WHERE table_schema = 'cabinet_dealz' AND table_name = 'crm_deal_designs' AND index_name IN ('crm_deal_designs_deal_idx', 'crm_deal_designs_design_idx') GROUP BY index_name ORDER BY index_name;

-- 5. Read-only: how linkage is stored at all. Expect crm_deal_designs to have one
--    row per linked design, and kitchen_designs.contractorCustomerId to be the
--    contractor-folder link. A design that appears in neither is not linked.
SELECT (SELECT COUNT(*) FROM cabinet_dealz.crm_deal_designs) AS dealDesignLinks, (SELECT COUNT(*) FROM cabinet_dealz.crm_deal_designs AS link_row JOIN cabinet_dealz.kitchen_designs AS design_row ON design_row.id = link_row.designId WHERE design_row.id IS NULL) AS dealLinksPointingAtAMissingDesign, (SELECT COUNT(*) FROM cabinet_dealz.kitchen_designs WHERE contractorCustomerId IS NOT NULL) AS designsInACustomerFolder;

-- 6. Read-only: what is stored for customer 5192. The rows with linkKind 'deal' are
--    links you made with "Attach" in the CRM; 'customerFolder' rows are designs the
--    contractor assigned to this customer. If both lists are empty, this customer
--    has no stored link and the customer view will correctly show "No design linked".
SELECT 'deal' AS linkKind, link_row.id AS linkId, link_row.dealId, link_row.designId, design_row.name AS designName, design_row.affiliateId, link_row.createdAt FROM cabinet_dealz.crm_deal_designs AS link_row LEFT JOIN cabinet_dealz.kitchen_designs AS design_row ON design_row.id = link_row.designId WHERE link_row.dealId = 5192 UNION ALL SELECT 'customerFolder' AS linkKind, NULL AS linkId, folder_deal.id AS dealId, design_row.id AS designId, design_row.name AS designName, design_row.affiliateId, NULL AS createdAt FROM cabinet_dealz.crm_deals AS folder_deal JOIN cabinet_dealz.kitchen_designs AS design_row ON design_row.contractorCustomerId = folder_deal.contractorCustomerId WHERE folder_deal.id = 5192 AND folder_deal.contractorCustomerId IS NOT NULL ORDER BY linkKind, designId;

-- 7. Read-only: the same customer, seen the other way. Designs saved on the account
--    that are NOT linked are the ones the CRM used to list. This counts them, so the
--    difference between "saved" and "linked" is visible for customer 5192.
SELECT customer_deal.id AS dealId, customer_deal.contactName, COUNT(DISTINCT design_row.id) AS designsLinked, COUNT(DISTINCT owned_row.id) AS designsSavedOnTheAccountByEmailMatch FROM cabinet_dealz.crm_deals AS customer_deal LEFT JOIN cabinet_dealz.crm_deal_designs AS link_row ON link_row.dealId = customer_deal.id LEFT JOIN cabinet_dealz.kitchen_designs AS design_row ON design_row.id = link_row.designId LEFT JOIN cabinet_dealz.users AS account_row ON account_row.email = customer_deal.contactEmail LEFT JOIN cabinet_dealz.kitchen_designs AS owned_row ON owned_row.userId = account_row.id WHERE customer_deal.id = 5192 GROUP BY customer_deal.id, customer_deal.contactName;
